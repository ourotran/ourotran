// Recebe os alertas das câmeras com IA (Vigia), enviados pela ponte que roda no computador da OuroTran.
// Só aceita quem manda a chave da ponte no cabeçalho "x-chave-ponte"; no banco fica apenas o hash dela (tabela chaves_ponte).
// O vídeo nunca sai do computador: chega aqui só o alerta e a foto do momento, que vai para um bucket privado.
//   POST {acao: "alerta", camera, quando, tipo, pontuacao, detalhes, foto_base64}
//   POST {acao: "sinal", cameras: ["nome", ...]}   (a cada minuto: mostra no app que a câmera está online)
import { createClient } from "jsr:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const FORTES = ["possivel_ocultacao", "bandeja_suspeita"];
const DIAS_GUARDA = 30; // alertas não confirmados (e suas fotos) são apagados depois disso

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

async function sha256(txt: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// o Vigia manda a hora local do computador sem fuso ("2026-11-06T10:32:00"); Ouro Preto é UTC-3
function quandoISO(q: unknown) {
  if (typeof q !== "string" || !q) return new Date().toISOString();
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(q) ? q : q + "-03:00");
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

async function camera(nome: string) {
  const agora = new Date().toISOString();
  const { data } = await sb.from("cameras").select("id").eq("nome", nome).maybeSingle();
  if (data) {
    await sb.from("cameras").update({ ultimo_sinal: agora }).eq("id", data.id);
    return data.id as number;
  }
  const novo = await sb.from("cameras").insert({ nome, ultimo_sinal: agora }).select("id").single();
  if (novo.error) throw novo.error;
  return novo.data.id as number;
}

async function limparAntigos() {
  const corte = new Date(Date.now() - DIAS_GUARDA * 86400 * 1000).toISOString();
  const { data } = await sb.from("alertas_cameras").select("id, foto").lt("quando", corte).neq("status", "CONFIRMADO").limit(200);
  if (!data?.length) return;
  const fotos = data.map((a) => a.foto).filter(Boolean) as string[];
  if (fotos.length) await sb.storage.from("alertas-cameras").remove(fotos);
  await sb.from("alertas_cameras").delete().in("id", data.map((a) => a.id));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return resposta({ erro: "use POST" }, 405);
  const chave = req.headers.get("x-chave-ponte") || "";
  if (chave.length < 20) return resposta({ erro: "chave ausente" }, 401);
  const ok = await sb.from("chaves_ponte").select("id").eq("hash", await sha256(chave)).eq("ativo", true).maybeSingle();
  if (!ok.data) return resposta({ erro: "chave inválida" }, 401);

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return resposta({ erro: "JSON inválido" }, 400); }

  try {
    if (corpo.acao === "sinal") {
      const nomes = Array.isArray(corpo.cameras) ? corpo.cameras.map(String).filter(Boolean).slice(0, 50) : [];
      for (const n of nomes) await camera(n.slice(0, 80));
      await limparAntigos();
      return resposta({ ok: true });
    }

    if (corpo.acao !== "alerta") return resposta({ erro: "acao desconhecida" }, 400);
    const nome = String(corpo.camera || "camera").slice(0, 80);
    const tipo = String(corpo.tipo || "desconhecido").slice(0, 60);
    const camId = await camera(nome);
    const quando = quandoISO(corpo.quando);

    let foto: string | null = null;
    if (typeof corpo.foto_base64 === "string" && corpo.foto_base64) {
      const bytes = Uint8Array.from(atob(corpo.foto_base64), (c) => c.charCodeAt(0));
      if (bytes.length > 5 * 1024 * 1024) return resposta({ erro: "foto grande demais" }, 413);
      foto = `${camId}/${quando.slice(0, 10)}/${crypto.randomUUID()}.jpg`;
      const up = await sb.storage.from("alertas-cameras").upload(foto, bytes, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
    }

    const pont = Number(corpo.pontuacao);
    const ins = await sb.from("alertas_cameras").insert({
      camera_id: camId, camera_nome: nome, quando, tipo,
      nivel: FORTES.includes(tipo) ? "ALERTA" : "ATENCAO",
      pontuacao: isFinite(pont) ? pont : null,
      detalhes: typeof corpo.detalhes === "object" && corpo.detalhes ? corpo.detalhes : {},
      foto,
    }).select("id").single();
    if (ins.error) throw ins.error;
    return resposta({ ok: true, id: ins.data.id });
  } catch (e) {
    console.error(e);
    return resposta({ erro: "falha ao gravar" }, 500);
  }
});

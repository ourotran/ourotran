// Feed de interdições da OuroTran no formato CIFS do Waze (Waze for Cities).
// O Waze lê este link de tempos em tempos e fecha/reabre as ruas sozinho.
// Público de propósito (interdição de rua é informação pública); lê a tabela com a chave pública, respeitando o RLS.
// JSON por padrão; ?formato=xml devolve o mesmo conteúdo em XML.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const CHAVE_PUBLICA = "sb_publishable_rjpexCs21e0AsU051Folhw_d7yX_Lut";

const SUBTIPO: Record<string, string> = {
  OBRA: "ROAD_CLOSED_CONSTRUCTION",
  EVENTO: "ROAD_CLOSED_EVENT",
  RISCO: "ROAD_CLOSED_HAZARD",
};

// Ouro Preto: UTC-3 o ano todo (sem horário de verão desde 2019)
function horaBrasil(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 19) + "-03:00";
}

function escXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
}

type Interdicao = {
  id: number; rua: string; trecho: string; motivo: string; descricao: string; sentido: string;
  pontos: [number, number][]; inicio: string; fim: string; criado_em: string; atualizado_em: string;
};

Deno.serve(async (req: Request) => {
  const corte = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/interdicoes?select=id,rua,trecho,motivo,descricao,sentido,pontos,inicio,fim,criado_em,atualizado_em&fim=gt.${encodeURIComponent(corte)}&order=inicio`;
  const r = await fetch(url, { headers: { apikey: CHAVE_PUBLICA } });
  if (!r.ok) {
    return new Response(JSON.stringify({ erro: "Falha ao ler as interdições", status: r.status }), {
      status: 502, headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  const lista: Interdicao[] = await r.json();

  const incidents = lista.map((i) => ({
    id: `ourotran-${i.id}`,
    type: "ROAD_CLOSED",
    subtype: SUBTIPO[i.motivo] ?? "ROAD_CLOSED_HAZARD",
    polyline: i.pontos.map(([lat, lng]) => `${lat.toFixed(6)} ${lng.toFixed(6)}`).join(" "),
    street: i.rua,
    direction: i.sentido,
    starttime: horaBrasil(i.inicio),
    endtime: horaBrasil(i.fim),
    description: (i.descricao || i.trecho || "Interdição OuroTran").slice(0, 80),
    creationtime: horaBrasil(i.criado_em),
    updatetime: horaBrasil(i.atualizado_em),
  }));

  const cabecalhos = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" };

  if (new URL(req.url).searchParams.get("formato") === "xml") {
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<incidents xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.gstatic.com/road-incidents/cifsv2.xsd">\n' +
      incidents.map((x) =>
        `  <incident id="${escXml(x.id)}">\n` +
        `    <creationtime>${x.creationtime}</creationtime>\n    <updatetime>${x.updatetime}</updatetime>\n` +
        `    <type>${x.type}</type>\n    <subtype>${x.subtype}</subtype>\n` +
        `    <polyline>${x.polyline}</polyline>\n    <street>${escXml(x.street)}</street>\n    <direction>${x.direction}</direction>\n` +
        `    <starttime>${x.starttime}</starttime>\n    <endtime>${x.endtime}</endtime>\n` +
        `    <description>${escXml(x.description)}</description>\n  </incident>\n`
      ).join("") + "</incidents>\n";
    return new Response(xml, { headers: { ...cabecalhos, "Content-Type": "application/xml; charset=utf-8" } });
  }

  return new Response(JSON.stringify({ incidents }, null, 1), {
    headers: { ...cabecalhos, "Content-Type": "application/json; charset=utf-8" },
  });
});

"""Ponte entre o Vigia (detecção com IA nas câmeras) e o sistema da OuroTran.

Roda no computador que fica ligado às câmeras:
  1. abre o Vigia para cada câmera do config.json, com --webhook apontando para esta ponte;
  2. recebe cada alerta do Vigia, junta a foto do momento e manda para o sistema (Edge Function receber-alerta);
  3. a cada minuto avisa o sistema de que as câmeras estão no ar;
  4. se a internet cair, guarda os alertas em pendentes.jsonl e reenvia quando ela voltar.

O vídeo nunca sai deste computador. Só vai o alerta e uma foto.
Só usa a biblioteca padrão do Python.  Uso:  python ponte.py   (ou dois cliques em iniciar_monitoramento.bat)
"""
from __future__ import annotations

import base64
import json
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

AQUI = Path(__file__).resolve().parent
CONFIG = AQUI / "config.json"
PENDENTES = AQUI / "pendentes.jsonl"
PORTA = 8790
trava = threading.Lock()


def carregar_config() -> dict:
    if not CONFIG.exists():
        sys.exit(f"Falta o arquivo {CONFIG}. Copie config.exemplo.json para config.json e preencha.")
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    for campo in ("url", "chave", "pasta_vigia", "cameras"):
        if not cfg.get(campo):
            sys.exit(f"config.json: falta o campo '{campo}'.")
    return cfg


def enviar(cfg: dict, corpo: dict) -> bool:
    req = urllib.request.Request(
        cfg["url"], data=json.dumps(corpo, ensure_ascii=False).encode("utf-8"), method="POST",
        headers={"Content-Type": "application/json", "x-chave-ponte": cfg["chave"]},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return 200 <= r.status < 300
    except urllib.error.HTTPError as e:
        print(f"[ponte] o sistema recusou ({e.code}): {e.read().decode('utf-8', 'replace')[:200]}", flush=True)
        return e.code < 500 and e.code != 429  # erro do pedido (chave, JSON): não adianta reenviar
    except Exception as e:
        print(f"[ponte] sem conexão com o sistema: {e}", flush=True)
        return False


def montar_alerta(cfg: dict, registro: dict) -> dict:
    foto_b64 = None
    caminho = registro.get("imagem")
    if caminho:
        p = Path(caminho)
        if not p.is_absolute():
            p = Path(cfg["pasta_vigia"]) / p
        for _ in range(10):  # o Vigia grava a foto antes de avisar, mas espera um pouco por garantia
            if p.exists() and p.stat().st_size > 0:
                foto_b64 = base64.b64encode(p.read_bytes()).decode("ascii")
                break
            time.sleep(0.2)
    return {
        "acao": "alerta", "camera": registro.get("camera"), "quando": registro.get("quando"),
        "tipo": registro.get("tipo"), "pontuacao": registro.get("pontuacao"),
        "detalhes": registro.get("detalhes") or {}, "foto_base64": foto_b64,
    }


def guardar_pendente(alerta: dict) -> None:
    with trava, open(PENDENTES, "a", encoding="utf-8") as f:
        f.write(json.dumps(alerta, ensure_ascii=False) + "\n")


def reenviar_pendentes(cfg: dict) -> None:
    with trava:
        if not PENDENTES.exists():
            return
        linhas = [l for l in PENDENTES.read_text(encoding="utf-8").splitlines() if l.strip()]
        PENDENTES.unlink()
    sobra = [l for l in linhas if not enviar(cfg, json.loads(l))]
    if linhas:
        print(f"[ponte] reenviados {len(linhas) - len(sobra)} de {len(linhas)} alertas guardados", flush=True)
    for l in sobra:
        guardar_pendente(json.loads(l))


def criar_servidor(cfg: dict) -> ThreadingHTTPServer:
    class Receptor(BaseHTTPRequestHandler):
        def do_POST(self):
            tam = int(self.headers.get("Content-Length") or 0)
            try:
                registro = json.loads(self.rfile.read(tam).decode("utf-8"))
            except Exception:
                self.send_response(400); self.end_headers(); return
            self.send_response(200); self.end_headers()
            threading.Thread(target=self.tratar, args=(registro,), daemon=True).start()

        def tratar(self, registro: dict) -> None:
            alerta = montar_alerta(cfg, registro)
            if enviar(cfg, alerta):
                print(f"[ponte] alerta enviado ao sistema: {alerta['camera']} · {alerta['tipo']}", flush=True)
            else:
                guardar_pendente(alerta)
                print("[ponte] alerta guardado; reenvio quando a conexão voltar", flush=True)

        def log_message(self, *a):
            pass

    # só aceita conexões deste computador
    try:
        return ThreadingHTTPServer(("127.0.0.1", PORTA), Receptor)
    except OSError:
        sys.exit(f"A porta {PORTA} já está em uso: a ponte provavelmente já está aberta em outra janela.")


# câmera -> processo do Vigia; o sinal de "no ar" só vai para câmera com o Vigia aberto
vigias: dict[str, subprocess.Popen] = {}


def cameras_no_ar(cfg: dict) -> list[str]:
    if "--sem-vigia" in sys.argv:  # o Vigia foi aberto à mão: vale o que está ativo no config
        return [c["nome"] for c in cfg["cameras"] if c.get("ativa") is not False]
    return [nome for nome, p in vigias.items() if p.poll() is None]


def sinal_periodico(cfg: dict) -> None:
    while True:
        if enviar(cfg, {"acao": "sinal", "cameras": cameras_no_ar(cfg)}):
            reenviar_pendentes(cfg)
        time.sleep(60)


def abrir_vigias(cfg: dict) -> list[subprocess.Popen]:
    pasta = Path(cfg["pasta_vigia"])
    python = pasta / ".venv" / "Scripts" / "python.exe"
    if not python.exists():
        python = Path(sys.executable)
    procs = []
    for c in cfg["cameras"]:
        if c.get("ativa") is False:
            continue
        cmd = [str(python), "-m", "vigia", "--fonte", str(c["fonte"]), "--camera", c["nome"],
               "--webhook", f"http://127.0.0.1:{PORTA}/alerta", "--pasta", cfg.get("pasta_alertas", "alertas_ourotran")]
        cmd += c.get("opcoes", [])
        print(f"[ponte] abrindo o Vigia na câmera '{c['nome']}'", flush=True)
        p = subprocess.Popen(cmd, cwd=pasta)
        vigias[c["nome"]] = p
        procs.append(p)
    return procs


def main() -> None:
    cfg = carregar_config()
    srv = criar_servidor(cfg)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    print(f"[ponte] recebendo alertas do Vigia em http://127.0.0.1:{PORTA}/alerta", flush=True)
    procs = abrir_vigias(cfg) if "--sem-vigia" not in sys.argv else []
    threading.Thread(target=sinal_periodico, args=(cfg,), daemon=True).start()
    try:
        while True:
            time.sleep(1)
            if procs and all(p.poll() is not None for p in procs):
                print("[ponte] o Vigia foi fechado; encerrando a ponte. Se ele fechou sozinho logo ao abrir, "
                      "confira a 'fonte' da câmera no config.json (endereço RTSP, usuário e senha).", flush=True)
                break
    except KeyboardInterrupt:
        pass
    time.sleep(3)  # deixa terminar o envio do último alerta
    for p in procs:
        if p.poll() is None:
            p.terminate()
    srv.shutdown()


if __name__ == "__main__":
    main()

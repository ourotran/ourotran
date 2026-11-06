# Ponte das câmeras (piloto do Monitoramento com IA)

Liga o **Vigia** (detecção de comportamento suspeito nas câmeras) à aba **Monitoramento IA** do sistema da OuroTran.
Roda no computador que fica ligado às câmeras. O vídeo nunca sai desse computador: vai para o sistema só o
alerta e a foto do momento.

## Ligar

Dois cliques em `iniciar_monitoramento.bat`. Ele abre o Vigia em cada câmera do `config.json` e fica mandando os
alertas. Para desligar, aperte **Q** na janela do Vigia (ou feche esta janela).

## Cadastrar a câmera da OuroTran (Intelbras)

No `config.json`, troque a `fonte` da câmera (`"0"` é a webcam do computador) pelo endereço RTSP:

```
rtsp://USUARIO:SENHA@IP-DA-CAMERA:554/cam/realmonitor?channel=1&subtype=1
```

- `USUARIO` e `SENHA`: os do aplicativo da câmera ou do gravador (DVR/NVR).
- Se a câmera passa por um gravador, use o IP do gravador e troque `channel=1` pelo número do canal.
- `subtype=1` é a imagem menor, mais leve para o computador; `subtype=0` é a imagem cheia.

Para mais de uma câmera, repita o bloco dentro de `"cameras"` com outro `nome` e outra `fonte`.

## Segurança

- `config.json` tem a **chave da ponte** e as **senhas das câmeras**: fica só neste computador (o git ignora).
  Nunca mande esse arquivo por WhatsApp ou e-mail.
- Se a chave vazar, desative-a no banco (tabela `chaves_ponte`, `ativo = false`) e gere outra.
- Se a internet cair, os alertas ficam em `pendentes.jsonl` e são reenviados quando ela voltar.

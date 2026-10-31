# OuroTran — Sistema de Fiscalização de Táxi

Sistema da OuroTran (Prefeitura de Ouro Preto/MG) para fiscalizar os 110 táxis permissionários.
Publicado pelo GitHub Pages: cada `git push` na branch principal atualiza o site em 1–2 minutos.

## Estrutura

Tudo fica em um único arquivo, `index.html` (HTML + CSS + JavaScript puro, sem build e sem dependências).
- `PERM_DEFAULT`: lista inicial dos 110 permissionários, em uma única linha JSON dentro do `<script>`.
- Os dados ficam no `localStorage` do navegador: `perm` (permissionários), `fisc` (fiscalizações),
  `wppLog` (id → data da última notificação no WhatsApp), `wppMsg` (mensagem editada), `fiscal` (nome do último fiscal).
- Depois do primeiro acesso, o navegador usa os dados salvos, então mudanças em `PERM_DEFAULT` não chegam
  para quem já abriu o sistema. Para levar dados entre aparelhos, use o menu Dados → Salvar/Restaurar backup (JSON).

## Abas

Dashboard · Permissionários (busca, filtro, novo/editar/excluir ao clicar no cartão) · Fiscalização (checklist
OK/NOK) · WhatsApp (fila de envio, uma conversa por clique, porque o navegador bloqueia várias janelas abertas de uma vez) ·
Guarda Municipal (impressão/PDF e envio via WhatsApp) · Notificações · Histórico (busca, filtro, CSV).

## Convenções

- Visual escuro com dourado; cores só pelas variáveis em `:root` (`--gold`, `--red`, `--green`...).
- Textos da interface em português com acentos.
- Todo texto vindo dos dados entra no HTML via `esc()`.
- Datas sempre por `hojeISO()` (data local); `toISOString()` usa UTC e erra o dia depois das 21h.
- Telefone válido: `telValido()` (celular com 11 dígitos começando em 9, ou fixo com 10).
- Funciona no celular (abaixo de 860px o menu vira gaveta).

## Testar localmente

    python -m http.server 8765

e abrir http://localhost:8765/index.html.

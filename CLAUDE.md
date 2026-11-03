# OuroTran — Sistema de Fiscalização de Transportes (táxi, turismo e escolar)

Sistema da OuroTran (Prefeitura de Ouro Preto/MG) para fiscalizar táxis, jipes/jardineiras e vans escolares.
Publicado pelo GitHub Pages: cada `git push` na `main` atualiza o site em 1–2 minutos.
Autoria dos commits: Hugo Marotta.

## Estrutura

- `index.html`: todo o front-end (HTML + CSS + JavaScript puro, sem build). Usa `@supabase/supabase-js` pelo CDN.
- Banco: Supabase, projeto `ourotran` (id `hyjhxplpylbaerpkdrnl`, região São Paulo).
  - `permissionarios` (coluna `categoria`: `TAXI`, `TURISMO` = jipes/jardineiras, `ESCOLAR` = vans), `fiscalizacoes`,
    `configuracoes` (`wpp_msg` = mensagem do WhatsApp; `guarda_tel` e `guarda_email` = contato da Guarda).
  - `usuarios_autorizados`: e-mail + `papel` (`admin` ou `guarda`). Criar conta no login não dá acesso sem estar nessa tabela.
  - RLS por papel (`privado.papel()`): admin lê/grava tudo; guarda só lê permissionários (regulares e irregulares), sem gravar.
  - Modo guarda no front: `body.modo-guarda` esconde tudo com `.so-admin`; `irPara` força a página `guarda`.
  - Trigger `privado.ajustar_sequencia` avança o contador de ids após importar backup com ids explícitos.
- **Nenhum dado pessoal (nomes, placas, telefones) deve ir para o `index.html`**: o repositório e o site são públicos.
- A chave `sb_publishable_...` no código é pública por design; nunca colocar a `service_role` no front-end.
- O JS usa nomes camelCase (`numPerm`, `vencPerm`, `permId`, `wpp`); a conversão para as colunas fica em
  `permDoBanco`/`permParaBanco` e `fiscDoBanco`/`fiscParaBanco`.

## Abas

Dashboard · Táxis / Jipes e Jardineiras / Transporte Escolar (a mesma tela `page-permissionarios`, filtrada por
`catAtual`; `CATS` e `CAT_DA_PAG` ligam aba e categoria) · Fiscalização (checklist OK/NOK) · WhatsApp (fila de envio,
uma conversa por clique, porque o navegador bloqueia várias janelas) · Guarda Municipal (consulta de placa em todos os
tipos, filtro por tipo, impressão/PDF, WhatsApp e e-mail para o contato salvo) · Usuários (admin libera e-mails de
administradores e da Guarda) · Notificações · Histórico (busca, filtro, CSV) · Backup em JSON.

## Convenções

- Visual escuro com dourado; cores só pelas variáveis em `:root`.
- Textos da interface em português com acentos.
- Todo texto vindo dos dados entra no HTML via `esc()`.
- Datas por `hojeISO()` (data local); `toISOString()` usa UTC e erra o dia depois das 21h.
- Telefone válido: `telValido()` (celular com 11 dígitos começando em 9, ou fixo com 10).
- Gravações no banco passam por `acao()` (bloqueia clique duplo e mostra erro).
- Funciona no celular (abaixo de 860px o menu vira gaveta).

## Testar localmente

    python -m http.server 8765

e abrir http://localhost:8765/index.html (o login é o mesmo do site).

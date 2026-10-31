# OuroTran — Sistema de Fiscalização de Táxi

Sistema da OuroTran (Prefeitura de Ouro Preto/MG) para fiscalizar os táxis permissionários.
Publicado pelo GitHub Pages: cada `git push` na `main` atualiza o site em 1–2 minutos.
Autoria dos commits: Hugo Marotta.

## Estrutura

- `index.html`: todo o front-end (HTML + CSS + JavaScript puro, sem build). Usa `@supabase/supabase-js` pelo CDN.
- Banco: Supabase, projeto `ourotran` (id `hyjhxplpylbaerpkdrnl`, região São Paulo).
  - `permissionarios`, `fiscalizacoes`, `configuracoes` (`wpp_msg` = mensagem do WhatsApp).
  - `usuarios_autorizados`: e-mail + `papel` (`admin` ou `guarda`). Criar conta no login não dá acesso sem estar nessa tabela.
  - RLS por papel (`privado.papel()`): admin lê/grava tudo; guarda só lê permissionários IRREGULARES.
  - Modo guarda no front: `body.modo-guarda` esconde tudo com `.so-admin`; `irPara` força a página `guarda`.
  - Trigger `privado.ajustar_sequencia` avança o contador de ids após importar backup com ids explícitos.
- **Nenhum dado pessoal (nomes, placas, telefones) deve ir para o `index.html`**: o repositório e o site são públicos.
- A chave `sb_publishable_...` no código é pública por design; nunca colocar a `service_role` no front-end.
- O JS usa nomes camelCase (`numPerm`, `vencPerm`, `permId`, `wpp`); a conversão para as colunas fica em
  `permDoBanco`/`permParaBanco` e `fiscDoBanco`/`fiscParaBanco`.

## Abas

Dashboard · Permissionários (busca, filtro, novo/editar/excluir ao clicar no cartão) · Fiscalização (checklist
OK/NOK) · WhatsApp (fila de envio, uma conversa por clique, porque o navegador bloqueia várias janelas) ·
Guarda Municipal (consulta de placa, impressão/PDF e WhatsApp) · Usuários (admin libera e-mails da Guarda) · Notificações · Histórico (busca, filtro, CSV) · Backup em JSON.

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

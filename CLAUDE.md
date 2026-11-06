# OuroTran — Sistema de Fiscalização de Transportes (táxi, turismo e escolar)

Sistema da OuroTran (Prefeitura de Ouro Preto/MG) para fiscalizar táxis, jipes/jardineiras e vans escolares.
Publicado pelo GitHub Pages: cada `git push` na `main` atualiza o site em 1–2 minutos.
Autoria dos commits: Hugo Marotta.

## Estrutura

- `index.html`: todo o front-end (HTML + CSS + JavaScript puro, sem build). Usa `@supabase/supabase-js` pelo CDN.
- Banco: Supabase, projeto `ourotran` (id `hyjhxplpylbaerpkdrnl`, região São Paulo).
  - `permissionarios` (coluna `categoria`: `TAXI`, `TURISMO` = jipes/jardineiras, `ESCOLAR` = vans; `selado` + `data_selagem`),
    `fiscalizacoes` (`categoria`, `selado`, `data_selagem`, `auxiliares` = cópia dos auxiliares conferidos com o checklist de cada um),
    `motoristas_auxiliares` (quem dirige para o permissionário: nome, CPF, CNH, telefone, endereço, situação; `perm_id` com cascade),
    `configuracoes` (`wpp_msg` = mensagem do WhatsApp; `guarda_tel` e `guarda_email` = contato da Guarda).
  - `usuarios_autorizados`: e-mail + `papel` (`admin` ou `guarda`). Criar conta no login não dá acesso sem estar nessa tabela.
    O gatilho `privado.antes_de_criar_usuario` (em `auth.users`) recusa cadastro de e-mail fora da lista e já confirma os da lista,
    por isso "Primeiro acesso" entra na hora, sem e-mail.
- Senha: "Esqueci a senha" manda o link do Supabase para `trocar-senha.html` (página separada, mesmo visual do login),
  que também serve para quem já está logado trocar a senha. Se o link cair no `index.html`, ele repassa o `#hash` para lá.
  No Supabase, Site URL e Redirect URLs apontam para https://ourotran.github.io/ourotran/ (antes era localhost:3000).
  - RLS por papel (`privado.papel()`): admin lê/grava tudo; guarda só lê permissionários (regulares e irregulares), sem gravar.
  - Modo guarda no front: `body.modo-guarda` esconde tudo com `.so-admin`; `irPara` força a página `guarda`.
  - Trigger `privado.ajustar_sequencia` avança o contador de ids após importar backup com ids explícitos.
- Interdições de ruas (Smart City): tabela `interdicoes` (rua, trecho, motivo OBRA/EVENTO/RISCO, sentido, `pontos` =
  [[lat, lng], ...] na ordem do trânsito, início/fim). Admin grava; guarda lê; **anônimo lê as atuais/futuras** (informação pública).
  - Edge Function `waze-feed` (código em `supabase/functions/waze-feed/index.ts`, `verify_jwt` desligado, pública):
    https://hyjhxplpylbaerpkdrnl.supabase.co/functions/v1/waze-feed — feed CIFS do Waze for Cities (JSON; `?formato=xml`).
    "Reabrir agora" muda o `fim` para agora; o feed mantém a interdição por 2 dias para o Waze ver o novo fim.
  - Tela "Interdições" no `index.html` (mapa Leaflet + OpenStreetMap) e página pública `interdicoes.html`.
  - Políticas de admin/guarda usam `to authenticated`: o anônimo não pode avaliar `privado.papel()` (dá erro 401).
- Controle de KM da frota locada (viaturas da própria OuroTran): tabelas `veiculos_frota` (modelo, `tipo_modelo_3d` =
  `POLO` / `S10_CABINE_SIMPLES` / `S10` (cabine dupla), placa única, `prefixo` pintado na porta = "VTR" + final da placa, `ativo`)
  e `registros_km` (`veiculo_id` com cascade, data, `km_inicial`, `km_final`, `km_rodado` calculado pelo banco,
  responsável, observação; o banco recusa KM final menor que o inicial). **Só admin** lê e grava (a Guarda não vê).
  As 4 viaturas foram cadastradas direto no banco, não em arquivo do repositório.
  - `viaturas3d.js`: viaturas em 3D (Three.js 0.128 pelo CDN, carregado só quando a aba abre). Os modelos são montados no
    próprio código (forma lateral extrudada, sem .glb). A plotagem da foto oficial (amarelo-limão, faixas brancas e pretas em
    onda, xadrez, brasão `brasao-ourotran.png`, "118" com telefone, prefixo, giroflex) é pintada em canvas. Placa e prefixo vêm
    do banco e são desenhados na hora. Zoom só com Ctrl + rolagem ou pinça, para a rolagem continuar descendo a página.
    `Viaturas3D.montar` reaproveita a cena quando a tela é redesenhada; ela só pausa quando o cartão sai da tela.
  - Termo de recebimento e planilha da semana são impressos com `cabecalho.png` (logos da OuroTran e da Prefeitura).
  - `referencias/` (foto da viatura) e `*.docx` ficam fora do git (`.gitignore`): a foto mostra a placa de terceiros.
- Monitoramento com IA (piloto só na OuroTran, **só admin**): o Vigia (protótipo de detecção de furto por comportamento,
  projeto separado, roda no computador das câmeras) manda cada alerta por `--webhook` para a `ponte/ponte.py`, que junta a
  foto e envia à Edge Function `receber-alerta` (`verify_jwt` desligado; exige o cabeçalho `x-chave-ponte`, conferido pelo
  hash na tabela `chaves_ponte`, que tem RLS sem política). Tabelas `cameras` (`ultimo_sinal`: a ponte manda sinal a cada
  minuto, só para câmera com o Vigia aberto) e `alertas_cameras` (nível ALERTA/ATENCAO, status NOVO/CONFIRMADO/DESCARTADO, quem validou); fotos no bucket
  privado `alertas-cameras`. Não confirmados são apagados com a foto depois de 30 dias (feito pela função a cada sinal).
  O vídeo nunca sai do computador. `ponte/config.json` (chave e RTSP com senha) fica fora do git; o modelo é
  `config.exemplo.json`. Tela `page-monitoramento`: busca a cada 20 s; alerta novo toca sirene (um AudioContext liberado no primeiro clique da página,
  com aviso na tela enquanto não liberar), aviso do navegador se a aba estiver atrás (Notification) e contador no título;
  links das fotos valem 6 h e são renovados; Confirmar/Descartar
  (mede o acerto da IA) e Acionar Guarda por WhatsApp.
- **Nenhum dado pessoal (nomes, placas, telefones) deve ir para o `index.html`**: o repositório e o site são públicos.
- A chave `sb_publishable_...` no código é pública por design; nunca colocar a `service_role` no front-end.
- O JS usa nomes camelCase (`numPerm`, `vencPerm`, `permId`, `wpp`); a conversão para as colunas fica em
  `permDoBanco`/`permParaBanco`, `fiscDoBanco`/`fiscParaBanco`, `frotaDoBanco`/`frotaParaBanco` e `kmDoBanco`/`kmParaBanco`.

## Abas

Dashboard · Táxis / Jipes e Jardineiras / Transporte Escolar (a mesma tela `page-permissionarios`, filtrada por
`catAtual`; `CATS` e `CAT_DA_PAG` ligam aba e categoria) · Fiscalização (uma aba por tipo, `ckCat`; checklist OK/NOK
com os documentos exigidos de cada tipo em `CK_ITENS`/`CK_OBS`; selagem; motoristas auxiliares em `fiscAux`, com o mesmo
checklist; ao registrar, `salvarFisc` grava os auxiliares, a fiscalização e atualiza situação/observação/selagem do
permissionário) · WhatsApp (fila de envio,
uma conversa por clique, porque o navegador bloqueia várias janelas) · Guarda Municipal (consulta de placa em todos os
tipos, filtro por tipo, impressão/PDF, WhatsApp e e-mail para o contato salvo) · Usuários (admin libera e-mails de
administradores e da Guarda) · Controle de KM (`page-frota`, só admin: cartão de cada viatura com o 3D ao lado; lançar
KM, com o KM inicial puxado do último KM final; filtro por período, que abre na semana de segunda a domingo, e por
viatura; planilha CSV, impressão e termo de recebimento; cadastro e desativação de viaturas no `modal-frota`) ·
Notificações · Histórico (busca, filtro, CSV) · Backup em JSON (versão 3 inclui `veiculosFrota` e `registrosKm`).

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

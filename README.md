# Galinheiro Idle

Jogo **idle/colecionável de fazenda** em PWA, todo em português do Brasil. O jogador cuida de galinhas, patos, gansos e avestruzes, coleta ovos, vende no mercado, gira a roleta para ganhar novos animais e amplia o galinheiro.

> **Sem dinheiro real.** Toda a economia é interna (moedas do jogo). Não há compras, anúncios nem qualquer forma de pagamento.

---

## Sumário

- [Estrutura do monorepo](#estrutura-do-monorepo)
- [Requisitos](#requisitos)
- [Começando](#começando)
- [Scripts](#scripts)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Arquitetura](#arquitetura)
- [PWA](#pwa)
- [Painel administrador](#painel-administrador)
- [Convites e afiliação](#convites-e-afiliação)
- [Intercâmbio e cupons](#intercâmbio-e-cupons)
- [Ferramentas de desenvolvimento](#ferramentas-de-desenvolvimento)
- [Testes](#testes)
- [Deploy](#deploy)
- [Decisões que divergem do GDD](#decisões-que-divergem-do-gdd)
- [Segurança e conformidade](#segurança-e-conformidade)

---

## Estrutura do monorepo

Monorepo **pnpm** (`pnpm-workspace.yaml` → `apps/*` e `packages/*`).

```
galinheiro-idle/
├── apps/
│   └── web/                 # Next.js 16 (App Router) + API /api/v1 + PWA
│       ├── public/sw.js     # service worker
│       ├── scripts/         # captura.mjs, gerar-vapid.mjs, producao-local.mjs
│       ├── src/app/         # telas, painel /admin, rotas /api/v1 e /api/admin, /api/cron/tick, manifest e ícones
│       ├── src/cliente/     # código do navegador (API, PWA, telas do jogo, painel em cliente/admin)
│       ├── src/server/      # admin, auth, banco, domínio, HTTP, jobs, push, relógio, RNG
│       └── test/            # testes de banco, domínio e rotas HTTP
├── packages/
│   ├── game-core/           # regras puras em TypeScript (vida, ciclos, ovos, roleta, economia, nomes)
│   └── api-contract/        # DTOs + schemas zod 4 da API /api/v1
├── tools/
│   └── balance_sim.py       # simulação Monte Carlo do balanceamento
└── docs/
    └── DIRECAO_DE_ARTE.md   # direção de arte
```

| Pacote | Nome | Função |
|---|---|---|
| `apps/web` | `@galinheiro/web` | App web/PWA e API. Servidor autoritativo. |
| `packages/game-core` | `@galinheiro/game-core` | Regras puras, sem I/O, cobertas por *golden tests*. Usadas pelo servidor e pelo cliente (só para exibição). |
| `packages/api-contract` | `@galinheiro/api-contract` | Tipos e schemas zod compartilhados entre cliente e servidor, incluindo o catálogo de códigos de erro. |
| `tools/balance_sim.py` | — | Simula centenas de jogadores ao longo de 240 dias para validar o balanceamento. |

O **GDD completo** (`GALINHEIRO_IDLE_GDD.md`) **fica fora do repositório**, na pasta `GALINHA` da Área de Trabalho do autor. Os comentários do código citam seções do GDD (ex.: "GDD 7.11", "Apêndice D").

---

## Requisitos

| Ferramenta | Versão |
|---|---|
| Node.js | `>= 20.9` (testado com 22.13) |
| pnpm | 9.15 (via corepack) |
| Python | 3.x — apenas para `pnpm simular` |

```bash
corepack enable          # ativa o pnpm na versão do packageManager (pnpm@9.15.0)
```

---

## Começando

```bash
pnpm install
pnpm dev                 # → http://localhost:3000
```

Em desenvolvimento **nada é obrigatório**:

- **Banco:** sem `DATABASE_URL`, o app usa um PostgreSQL embutido (**PGlite**, Postgres em WASM) gravado em `apps/web/.data/pglite`. As migrations rodam sozinhas na subida.
- **Segredos:** o segredo de sessão (`.data/auth.json`) e as chaves VAPID (`.data/vapid.json`) são gerados automaticamente em `apps/web/.data/` (fora do controle de versão).

Para personalizar, copie `apps/web/.env.example` para `apps/web/.env.local`.

---

## Scripts

### Raiz

| Comando | O que faz |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento do `apps/web` em http://localhost:3000. |
| `pnpm build` | Build de produção do Next.js. |
| `pnpm start` | Sobe o build de produção (`next start`, porta 3000). Exige as variáveis de produção. |
| `pnpm start:local` | Sobe o build de produção em **http://localhost:3100** com um banco PGlite separado (`.data/pglite-producao`) e segredos locais. Serve para testar PWA, modo offline e push. Rode `pnpm build` antes. A porta muda com `PORT=xxxx`. |
| `pnpm test` | Testes do `game-core` e do `web`, um pacote por vez. |
| `pnpm typecheck` | `tsc --noEmit` em todos os pacotes. |
| `pnpm simular` | `python tools/balance_sim.py 300` (300 execuções Monte Carlo). |

### `apps/web`

| Comando | O que faz |
|---|---|
| `pnpm --filter @galinheiro/web vapid` | Gera um par de chaves VAPID e imprime as linhas `VAPID_*` para colar no ambiente. |
| `pnpm --filter @galinheiro/web senha-admin` | Pergunta a senha do painel administrador e imprime a linha `ADMIN_SENHA_HASH=…` para colar no ambiente (também aceita a senha pela entrada padrão). |

---

## Variáveis de ambiente

Todas ficam em `apps/web/.env.local` (desenvolvimento) ou nas variáveis do servidor (produção). Modelo em `apps/web/.env.example`.

| Variável | Descrição | Obrigatória? |
|---|---|---|
| `DATABASE_URL` | PostgreSQL de produção, acessado com postgres.js. Ex.: Supabase pelo pooler em modo transação (porta **6543**). Sem ela, usa PGlite. | Em produção |
| `PGLITE_DIR` | Pasta do banco embutido, usada só sem `DATABASE_URL`. Padrão: `.data/pglite`. | Não |
| `AUTH_SECRET` | Segredo para assinar as sessões (32 caracteres aleatórios ou mais). Em produção o servidor recusa subir sem ela. Em dev é gerada em `.data/auth.json`. | **Sim, em produção** |
| `VAPID_PUBLIC_KEY` | Chave pública VAPID (Web Push). Em dev é gerada em `.data/vapid.json`. | Para push em produção |
| `VAPID_PRIVATE_KEY` | Chave privada VAPID. | Para push em produção |
| `VAPID_SUBJECT` | Contato do remetente (`mailto:...`). Padrão: `mailto:contato@galinheiro.app`. | Recomendada |
| `CRON_SECRET` | Protege `/api/cron/tick` (cabeçalho `Authorization: Bearer <segredo>`). Sem ela, o endpoint só responde fora de produção. | Com cron externo |
| `JOBS_INTERNOS` | `0` desliga o agendador interno (a cada 60 s). Padrão: ligado. | Não (use `0` em serverless) |
| `DEV_RELOGIO` | `0` desliga o relógio ajustável. Padrão: ligado em desenvolvimento. Nunca funciona em produção. | Não |
| `DB_POOL_MAX` | Tamanho máximo do pool do postgres.js. Padrão: `5`. | Não |
| `ADMIN_USUARIO` | Usuário do **login do painel administrador** (`/admin`), separado das contas do jogo. Letras minúsculas, números, `.`, `_` ou `-`. | Para usar o painel |
| `ADMIN_SENHA_HASH` | Hash scrypt da senha do painel, gerado por `pnpm --filter @galinheiro/web senha-admin` (sai com `:` no lugar de `$`, que o `.env` expandiria). **Nunca a senha em si.** Trocar o hash derruba as sessões abertas do painel. | Para usar o painel |
| `ADMIN_NOME` | Nome que os membros veem nas respostas do atendimento enviadas pelo login do painel. Padrão: `Equipe Galinheiro`. | Não |
| `ADMIN_EMAILS` | Opcional: e-mails (separados por vírgula) de contas do **jogo** que também entram no painel. Veja o aviso em [Painel administrador](#painel-administrador). | Não |
| `NEXT_PUBLIC_VERSAO_APP` | Identificador do build, que versiona o service worker e os caches. Se ausente, é derivada de `VERCEL_GIT_COMMIT_SHA` ou da hora do build. | Não |

---

## Arquitetura

### Servidor autoritativo

- **O cliente nunca sorteia nada.** Roleta, quantidade de ovos e nomes padrão são decididos no servidor (`src/server/rng.ts`). O cliente só anima o resultado (ex.: o ângulo da roleta vem pronto do servidor).
- **Os ovos pendentes nunca vão para o cliente:** ele só sabe *quando* o animal fica pronto, não *quantos* ovos virão.
- **Relógio único:** toda regra usa o "agora" do servidor (`src/server/relogio.ts`).

### API `/api/v1`

Todas as respostas usam o mesmo envelope:

```jsonc
// sucesso
{ "ok": true,  "data": { ... }, "serverTime": "2026-10-05T12:00:00.000Z", "stateVersion": 42 }
// erro
{ "ok": false, "error": { "code": "SALDO_INSUFICIENTE", "message": "Moedas insuficientes." }, "serverTime": "..." }
```

| Grupo | Rotas |
|---|---|
| Autenticação | `auth/cadastrar`, `auth/entrar`, `auth/redefinir`, `auth/sair`, `auth/sessao` |
| Estado | `state` (com ETag), `me`, `players`, `config`, `health` |
| Jogo | `collect`, `collect-all`, `sell`, `spin`, `upgrade-nest`, `entities`, `entities/[id]`, `retirements/ack`, `tutorial`, `transactions` |
| Popups e atendimento | `avisos`, `avisos/[id]/visto`, `avisos/[id]/clique`, `suporte` |
| Convites | `convites`, `convites/[codigo]` (público) e o link curto `/c/[codigo]` (fora do `/v1`) |
| Intercâmbio e cupons | `intercambio`, `intercambio/comprar`, `intercambio/trocar`, `cupons/resgatar` |
| Push | `push/assinaturas` |
| Desenvolvimento | `dev/relogio`, `dev/admin` (só fora de produção) |
| Painel administrador | `/api/admin/*` (fora do `/v1`; veja [Painel administrador](#painel-administrador)) |
| Jobs | `/api/cron/tick` (fora do `/v1`) |

- **Catálogo de erros:** códigos fixos em `@galinheiro/api-contract` com status HTTP e mensagem em `src/server/erros.ts` (ex.: `NAO_AUTENTICADO` 401, `ACESSO_NEGADO` 403, `CONTA_BLOQUEADA` 403, `CONVITE_INVALIDO` 400, `TICKETS_INSUFICIENTES` 409, `CUPOM_INVALIDO` 404, `SALDO_INSUFICIENTE` 409, `IDEMPOTENCY_CONFLITO` 409, `PAYLOAD_INVALIDO` 400, `RATE_LIMITED` 429).
- **Idempotência:** toda mutação exige o cabeçalho `Idempotency-Key`. Repetir a mesma chave devolve a resposta original, e a mesma chave com outro corpo devolve `409 IDEMPOTENCY_CONFLITO`. As chaves são guardadas por 24 h.
- **Limite de taxa:** janela deslizante de 60 s **em memória** (por instância). Com várias instâncias, troque por um armazenamento compartilhado (ex.: Redis).
- **Concorrência:** cada mutação roda numa transação com `SELECT … FOR UPDATE` (ordem de travas: `players` → `entities`). Duas coletas simultâneas do mesmo animal creditam uma vez só.

### Autenticação própria

Só **membros cadastrados** jogam (não há conta de convidado).

| Recurso | Como funciona |
|---|---|
| Cadastro | `POST /auth/cadastrar` com **nome, telefone, e-mail e senha**, todos obrigatórios, validados pelo mesmo schema zod no formulário e no servidor (`CadastrarBody`). O telefone é brasileiro (DDD válido; celular com 9 dígitos começando em 9, ou fixo começando em 2–5), guardado em E.164 (`+55…`) e **único**; o e-mail também é único. Não há verificação por SMS (dá para ligar depois). |
| Login | E-mail + senha. Hash com **scrypt** (nativo do Node). |
| Recuperação | Código de recuperação (guardado só como hash) para redefinir a senha. |
| Sessão | JWT **HS256** (`jose`) em cookie `httpOnly`: `gi_sessao` em dev, `__Host-gi_sessao` em produção. |
| Invalidação | O token carrega `sessao_versao`. Redefinir a senha incrementa a versão e derruba todas as sessões antigas (o painel também faz isso em "Encerrar sessões" e ao bloquear). Só vale sessão de **membro completo** (nome + telefone) e **não bloqueado**: contas antigas de convidado não abrem mais sessão. |
| Bloqueio | Conta bloqueada pelo painel perde as sessões e, ao tentar entrar, recebe `CONTA_BLOQUEADA` com o motivo. |

### Banco de dados

| Ambiente | Driver |
|---|---|
| Desenvolvimento e testes | **PGlite** (arquivo local em `.data/pglite`) |
| Produção | **postgres.js** com `DATABASE_URL`. Ex.: Supabase via pooler na porta 6543, com `prepare: false` (obrigatório no modo transação). |

As **migrations rodam automaticamente na subida**, dentro de um *advisory lock* (`pg_advisory_xact_lock`) para que duas instâncias não migrem ao mesmo tempo. Ficam em `apps/web/src/server/db/migracoes.ts`:

| Migration | Conteúdo |
|---|---|
| `0001_init` | Tipos, tabelas (`contas`, `players`, `nests`, `entities`, `inventory`, `transactions`, `spins`, `collections`, `idempotency_keys`, `integridade_alertas`, `push_assinaturas`), restrições e índices. |
| `0002_funcoes` | Funções SQL: vida (`fn_vida`, a mesma fórmula do game-core), tier, aposentadoria e jobs. |
| `0003_presente_despedida` | Presente de despedida na aposentadoria. |
| `0004_blindagem_api_rest` | Liga **RLS sem políticas** em todas as tabelas e revoga o acesso dos papéis `anon`/`authenticated`. Isso blinda a API REST automática do Supabase, e só o servidor acessa o banco. |
| `0005_membros` | Colunas `nome` e `telefone` (E.164, índice único) em `contas`: só membros cadastrados. |
| `0006_admin` | Painel administrador: `papel` (`jogador`/`admin`) e bloqueio em `contas`; `atividade_diaria` (quem jogou em cada dia, com histórico recuperado de coletas e transações); atendimento (`suporte_conversas`, `suporte_mensagens`); popups (`popups`, `popups_vistos`); auditoria (`admin_acoes`). Todas com RLS. |
| `0007_afiliados` | Convites e afiliação: `convite_codigo`, `indicado_por` e `indicado_em` em `contas`; `afiliados_config` (taxas, linha única); `comissoes` (cada comissão paga); tipo de transação `COMISSAO_INDICACAO`. |
| `0008_intercambio` | Intercâmbio e cupons: `tickets` em `players` e o extrato `tickets_movimentos`; `intercambio_config` (linha única); `intercambio_ofertas` (com a tabela inicial); `cupons` e `cupons_resgates`; transação `COMPRA_TICKET` e origem de animal `INTERCAMBIO`. |
| `0009_painel` | Login próprio do painel: contas do tipo `operador` (com `usuario` único), que assinam as ações do painel sem serem membros; chaves de idempotência passam a referenciar `contas`. |

Em desenvolvimento, migrations novas também são aplicadas sem reiniciar o servidor (no *hot reload*).

### Jobs periódicos

O tick (`src/server/jobs/tick.ts`) aposenta animais vencidos de quem está offline e envia as notificações push. A cada 6 h, ele também limpa as chaves de idempotência antigas e as coletas com mais de 180 dias e checa a integridade (saldo = extrato, capacidade).

| Modo | Como ligar |
|---|---|
| Agendador interno (padrão) | Roda a cada **60 s** enquanto o servidor Node estiver de pé (`pnpm dev`, `next start`). |
| Serverless | `JOBS_INTERNOS=0` e um cron chamando `GET`/`POST /api/cron/tick` com `Authorization: Bearer $CRON_SECRET`. |

---

## PWA

| Recurso | Detalhes |
|---|---|
| Manifest | `src/app/manifest.ts` → `/manifest.webmanifest` |
| Ícones | PNGs gerados no build com `ImageResponse` (`src/app/icones`, `apple-icon.tsx`) |
| Service worker | `public/sw.js`, registrado como `/sw.js?v=<NEXT_PUBLIC_VERSAO_APP>`. Cada build instala um SW novo e apaga os caches da versão anterior. |
| Pré-cache | Telas do jogo (`/galinheiro`, `/roleta`, `/loja`, `/colecao`, `/ajustes`, `/extrato`, `/suporte`, `/convites`, `/intercambio`, `/entrar`), os arquivos `/_next/static` que elas usam, ícones e `offline.html` |
| Estratégias | Estáticos: cache primeiro. Páginas: rede primeiro, com o cache como reserva. API e RSC: sempre rede. |
| Offline | **Somente leitura**, com o último estado conhecido |
| Atualização | Aviso **"Nova versão disponível"** quando um SW novo está esperando |
| Instalação | Botão de instalar no Android e no desktop. No iOS, instruções para "Adicionar à Tela de Início". |
| Web Push (VAPID) | "Ovos prontos!": no máximo **1 a cada 20 h** por jogador, só **entre 8 h e 22 h** no fuso do jogador e só se ele estiver **inativo há 30 min** |

O service worker só é registrado em produção. Para testar PWA, offline e push localmente, use:

```bash
pnpm build && pnpm start:local    # http://localhost:3100
```

---

## Painel administrador

Em **`/admin`** (fora do jogo, sem indexação). Só entra quem é administrador; os demais veem "Acesso restrito". Todas as rotas ficam em `/api/admin/*` e passam pelo mesmo `rota()` do jogo com `admin: true` (sessão, limite de taxa, zod, transação e envelope) — quem não é admin recebe `403 ACESSO_NEGADO`.

| Seção | O que dá para fazer |
|---|---|
| **Visão geral** | Indicadores do dia (membros, ativos hoje/7 d/30 d, moedas em circulação, emitidas e gastas, ovos, giros, animais por espécie, atendimento, popups) e **gráficos com projeção** de **pessoas** (novos por dia, total de membros, ativos), **ovos** (produzidos e vendidos por dia, tendência e potencial) e **moedas** (emitidas × gastas, circulação total, potencial de emissão). Histórico de 7 a 365 dias e horizonte de 7 a 180 dias. |
| **Usuários** | Busca por nome, e-mail ou telefone, filtros (ativos/inativos em 7 dias, bloqueados, admins), ordenação e paginação. Na ficha: editar nome, telefone, e-mail e papel; bloquear (com motivo) e desbloquear; encerrar sessões; gerar novo código de recuperação; creditar/debitar moedas e ovos; dar animal; definir nível do galinheiro; ver animais, extrato, estatísticas e auditoria; abrir conversa no atendimento; excluir a conta. |
| **Atendimento** | Chat com os membros: fila de conversas (não lidas primeiro), resposta, resolver/reabrir. O membro fala com a equipe em **Ajustes › Falar com o suporte** (`/suporte`); a primeira mensagem recebe uma resposta automática. |
| **Popups** | Avisos na tela dos membros, **com ou sem link** (tela do jogo, como `/roleta`, ou endereço `https://` externo, que abre em outra aba), imagem opcional, texto do botão, público (todos ou membros escolhidos), frequência (**uma vez**, **uma vez por dia** ou **sempre que abrir o jogo**), período (início/fim) e liga/desliga. Mostra pessoas alcançadas, exibições e cliques. O jogo consulta os avisos a cada 45 s e ao voltar para o app, e não interrompe o tutorial. |
| **Rede de afiliados** | Quantos entraram por convite, comissões pagas por dia e por nível, ranking de quem mais convida e a rede de qualquer membro (quem convidou, níveis abaixo, diretos). Veja [Convites e afiliação](#convites-e-afiliação). |
| **Taxas e comissões** | Liga/pausa o programa, define de 1 a 5 níveis com a % de cada um e o teto diário por membro, com simulação. Vale para as vendas daqui em diante e fica na auditoria. |
| **Intercâmbio** | O que um ticket vale: a tabela de ofertas (N tickets → ovos ou 1 animal), abrir/fechar as trocas e, se quiser, a compra de tickets com moedas do jogo (preço e limite diário). Veja [Intercâmbio e cupons](#intercâmbio-e-cupons). |
| **Cupons** | Códigos que dão tickets, com limite de usos, validade e liga/desliga; mostra quem resgatou. Na ficha do usuário dá para creditar ou debitar tickets. |
| **Auditoria** | Toda ação do painel (quem, o quê, em quem, quando e com quais dados) fica registrada em `admin_acoes`. |

**Como as projeções são calculadas** (`src/server/admin/projecoes.ts`):

- **Tendência:** regressão linear sobre os últimos 28 dias da série, projetada para a frente (nunca negativa), com faixa de ±1,96 desvio-padrão dos resíduos. É **resistente a picos**: uma reta robusta (Theil–Sen) aponta os dias que fogem mais de 4× do desvio típico (ex.: um ajuste de saldo enorme) e eles são aparados antes do cálculo. Pessoas contam só membros cadastrados. Vale para novos membros, ativos, ovos produzidos e moedas emitidas e gastas; o total de membros e a circulação de moedas são acumulados a partir dessas projeções diárias.
- **Potencial de ovos:** quanto os **animais ativos de hoje** renderiam se todo ciclo fosse coletado na hora, pelas regras do `game-core` (ciclo de 24 h mais o atraso do cansaço, 1 + 2q ovos por coleta com q = 0,5 × multiplicador do humor, até o fim da vida de cada animal). É um teto: não conta animais novos nem jogadores que deixam de coletar. O **potencial de emissão** é esse potencial vendido a preço de mercado.

**Como entrar:** o painel tem **login próprio**, separado das contas do jogo. Abra `/admin` e entre com o usuário e a senha do painel.

1. Gere o hash da senha: `pnpm --filter @galinheiro/web senha-admin` (a senha não aparece em lugar nenhum; só o hash).
2. Defina no ambiente `ADMIN_USUARIO` e a linha `ADMIN_SENHA_HASH=…` que o comando imprimiu (em dev, no `apps/web/.env.local`; em produção, nas variáveis do servidor).
3. Para trocar a senha, gere um hash novo e substitua: as sessões abertas do painel caem na hora.

| Detalhe | Como funciona |
|---|---|
| Sessão | Cookie próprio (`gi_painel` em dev, `__Host-gi_painel` em produção), `httpOnly`, `SameSite=Strict`, válido por **12 h**. Não serve como sessão do jogo, e a do jogo não serve como a do painel. |
| Tentativas | No máximo 5 por minuto por IP; o erro não diz se o usuário ou a senha está errado e a conferência leva o mesmo tempo nos dois casos. |
| Quem assina | As ações do painel (auditoria, respostas do atendimento, popups, cupons) ficam em nome de uma conta **operador** com esse usuário. Ela não é membro nem jogador e não aparece em nenhuma estatística. Nas respostas do atendimento, os membros veem `ADMIN_NOME` (padrão "Equipe Galinheiro"). |

**Conta do jogo como admin (opcional):** uma conta do jogo com `papel = 'admin'` (promovida em **Usuários › ficha › Perfil**) ou com e-mail em `ADMIN_EMAILS` também entra no painel, sem o login próprio.

> ⚠️ **Se usar `ADMIN_EMAILS`, cadastre o e-mail antes de colocá-lo lá.** Como não há verificação de e-mail, quem cadastrar primeiro um endereço listado ali vira administrador. Um admin definido por `ADMIN_EMAILS` não pode ser rebaixado pelo painel (tire o e-mail da variável). Ninguém consegue bloquear, excluir ou rebaixar a si mesmo.

Em desenvolvimento há atalhos: **Ajustes › Desenvolvimento › Tornar esta conta admin**, `/dev/demo?para=/admin&admin=1` e `/dev/semear` (veja abaixo).

---

## Convites e afiliação

> **Tudo em moedas do jogo.** As comissões são pagas pelo jogo, em moedas do jogo: ninguém deposita, saca ou converte nada em dinheiro, e o indicado não perde nada. Não há bônus de cadastro.

| Peça | Como funciona |
|---|---|
| Código e link | Todo membro tem um código de convite (7 letras e dígitos, sem I, O, 0 e 1) e o link curto **`/c/CODIGO`**, que abre o cadastro já com o convite. O código também pode ser digitado no cadastro (aceita minúsculas, espaços e traço). |
| Rede | Quem se cadastra com um convite fica ligado a quem convidou (`contas.indicado_por`). Só no cadastro: a ligação não muda depois, então a rede não tem ciclos. |
| Comissões | Cada **venda de ovos** de um membro paga, além da venda inteira para ele, uma comissão a quem está acima na rede: nível 1 (quem convidou), nível 2 (quem convidou essa pessoa)… Padrão: **10% / 4% / 2%** em 3 níveis, até **200,00 moedas por dia** por membro. Membros bloqueados não recebem, mas não quebram a corrente. |
| Onde aparece | Jogador: **Ajustes › Convidar amigos** (`/convites`) com o link, a rede por nível, os ganhos e os indicados (só o nome curto, como "Ana L."). Extrato: "Comissão de indicação". Painel: **Rede de afiliados**, **Taxas e comissões** e o bloco **Afiliação** na ficha do usuário. |

As comissões são pagas na mesma transação da venda (`src/server/dominio/afiliados.ts`), travando os beneficiários de baixo para cima na rede, e cada uma fica registrada em `comissoes` com a transação `COMISSAO_INDICACAO` correspondente (o saldo continua igual à soma do extrato).

---

## Intercâmbio e cupons

> **Ticket é um vale do jogo.** Não se compra com dinheiro: vem de cupons, de ajustes da equipe e, se o painel ligar, da compra com moedas do jogo.

| Peça | Como funciona |
|---|---|
| Intercâmbio | O membro troca tickets pelas ofertas do painel: **ovos** (vão para o estoque) ou **1 animal** (vai para o menor ninho livre; galinheiro cheio não troca). Tabela inicial: 1 ticket = 7 ovos de galinha · 2 = 9 de pato · 3 = 10 de ganso · 5 = 10 de avestruz · 5 = 1 galinha · 10 = 1 pato · 20 = 1 ganso · 50 = 1 avestruz. |
| Cupons | Código de 4 a 20 letras e números (o membro pode digitar em minúsculas, com espaço ou traço) que dá N tickets. Um resgate por membro, dentro da validade e do limite de usos. |
| Compra com moedas | **Desligada por padrão.** Ligada, o membro compra tickets pelo preço do painel (padrão 10,00 moedas), com limite diário opcional. |
| Regra "sem lucro" | Com a compra ligada, o servidor recusa qualquer configuração (preço, oferta ou taxa de afiliação) em que uma troca de ovos valha mais do que custa, contando as comissões que a venda desses ovos geraria. Assim ninguém "fabrica" moedas comprando tickets, trocando e vendendo. |
| Extrato | Cada movimento de tickets (compra, cupom, troca, ajuste) fica em `tickets_movimentos`; o saldo é sempre a soma dos movimentos. A compra também aparece no extrato de moedas (`COMPRA_TICKET`). |
| Onde aparece | Jogador: **Loja › Intercâmbio** (`/intercambio`: saldo, resgate de cupom, ofertas, compra e histórico; o animal recebido chega com a mesma revelação de carta da roleta) e **Ajustes › Resgatar cupom**. Painel: **Intercâmbio**, **Cupons** e a seção **Tickets** na ficha do usuário. |

---

## Ferramentas de desenvolvimento

> **Nada disto existe em produção.** As rotas `/dev/*` retornam 404 e o relógio fica travado no horário real.

| Ferramenta | Uso |
|---|---|
| Relógio ajustável | **Ajustes › Ferramentas de teste**: `+1 h`, `+6 h`, `+1 dia`, `+10 dias`, `+30 dias`, `Zerar`. Também via `POST /api/v1/dev/relogio` com `{ "horas": N }`. Serve para testar ciclos, cansaço e aposentadorias sem esperar dias. |
| Galeria visual | `/dev/galeria/<secao>` (ex.: `animais`, `cartas`, `cenario`, `juca`, `roleta`, `telas`, `ui`) |
| Conta demo | `/dev/demo?para=/rota` entra numa conta pronta (16 ninhos e animais em vários estados). Use `&nova=1` para recriá-la e `&admin=1` para que ela seja administradora (ex.: `/dev/demo?para=/admin&admin=1`). ⚠️ **Troca o cookie de sessão do navegador que abrir a URL**, então use um navegador separado ou headless. |
| Dados fictícios | `/dev/semear?membros=40&dias=45` cria membros com histórico (cadastros espalhados, boa parte por convite, atividade diária, coletas, vendas com as comissões da rede, giros e conversas de atendimento) para encher os gráficos do painel. Pode chamar de novo para somar mais. `&convite=CODIGO` pendura a rede nova embaixo desse membro (ex.: a conta demo). |
| Tornar admin | **Ajustes › Desenvolvimento › Tornar esta conta admin** (ou `POST /api/v1/dev/admin`) promove a conta logada. |
| Captura headless | `scripts/captura.mjs`: captura de tela pelo Chrome/Edge via DevTools Protocol |

```bash
# em apps/web, com `pnpm dev` rodando
node scripts/captura.mjs dev/galeria/animais C:/tmp/a.png --inteira
node scripts/captura.mjs "dev/demo?para=/loja" C:/tmp/loja.png
node scripts/captura.mjs "dev/demo?para=/galinheiro" C:/tmp/col.png \
  --js "document.querySelector('[data-slot=\"2\"]').click()" --quadros 8
```

| Opção | Padrão | Descrição |
|---|---|---|
| `--largura` / `--altura` | 390 × 844 | Tamanho da tela em px CSS (celular) |
| `--escala` | 2 | Densidade de pixels |
| `--espera` | 2500 | ms de espera depois do carregamento |
| `--js "<código>"` | — | JavaScript executado na página (aceita `await`) |
| `--depois` | 600 | ms de espera depois do `--js` |
| `--inteira` | — | Captura a página inteira |
| `--quadros N` / `--intervalo` | 1 / 150 | N fotos seguidas (`saida-1.png`…) para ver animações |
| `--desktop` | — | Sem emulação de celular (1280 × 800) |

O navegador pode ser apontado pela variável `CHROME`. Os erros do console e as exceções da página saem no fim da execução.

---

## Testes

```bash
pnpm test
```

São **109 testes** (Vitest):

| Pacote | Arquivo | Testes | Cobertura |
|---|---|---|---|
| `game-core` | `test/golden.test.ts` | 49 | *Golden tests* do GDD (Apêndice D): vida e tiers, ciclos (último ciclo encurtado, janela de graça de 4 h, ovos em {1,2,3}), roleta (faixas, ângulos, frequências em 400 mil giros com margem de ±0,2 p.p.), economia, validação e filtro de nomes, formatos de tempo |
| `web` | `test/banco.test.ts` | 2 | Migrations aplicadas no PGlite e **blindagem `anon`/`authenticated`** |
| `web` | `test/dominio.test.ts` | 15 | Fluxo do jogo: conta inicial do membro, coleta e ciclo de 24 h, venda, roleta, saldo e ninhos, coletar todos, renomear, aposentadoria aos 90 dias, extrato paginado, invariantes de integridade, `fn_vida` igual ao `vidaEm` do game-core, janela de graça, cadastro (e-mail/telefone repetidos), login, redefinição de senha, contas antigas recusadas, faixas da roleta |
| `web` | `test/rotas.test.ts` | 11 | Rotas HTTP: 401 com envelope, ETag do `/state`, `Idempotency-Key` ausente, repetida e conflitante, **coletas concorrentes** (só uma credita), payload inválido, `/entities/[id]`, cadastro (cookie `httpOnly`, código de recuperação, telefone repetido/inválido), sessão de convidado recusada, config pública |
| `web` | `test/cadastro.test.ts` | 5 | Telefone brasileiro (normalização E.164, DDDs, celular/fixo, máscara) e mensagens do schema de cadastro |
| `web` | `test/painel-login.test.ts` | 4 | Login próprio do painel: usuário e senha do ambiente (hash com `:`), cookie `httpOnly`/`Strict`/12 h, erro genérico, token do painel recusado no jogo, ações assinadas pelo operador (auditoria, idempotência, nome da equipe no atendimento), sessão que cai ao trocar a senha, saída, e a conta do jogo com papel de admin ainda entrando |
| `web` | `test/admin.test.ts` | 7 | Painel: 403 para jogador comum e acesso por `ADMIN_EMAILS`; busca, ficha e edição; ajuste de saldo **idempotente** e sem saldo negativo; bloqueio derruba a sessão e mostra o motivo no login; atendimento ida e volta com contadores; popups ("uma vez", público por contas, cliques); séries e projeções dos gráficos |
| `web` | `test/afiliados.test.ts` | 5 | Convites e afiliação: código e link curto, conferência pública, cadastro com convite (e convite inválido), comissões de 10%/4%/2% em três níveis com saldo = extrato, bloqueado fora da corrente, teto diário, programa pausado, taxas pelo painel (auditadas), ranking, rede do membro e bloco da ficha |
| `web` | `test/intercambio.test.ts` | 3 | Intercâmbio e cupons: resgate (uma vez por membro, limite de usos, pausado e vencido), trocas por ovos e por animal (sem tickets, sem ninho, oferta pausada, intercâmbio fechado), compra com moedas (desligada, limite diário, saldo), regra "sem lucro" no preço, nas ofertas e nas comissões, ajuste na ficha, extrato dos tickets e auditoria |
| `web` | `test/projecoes.test.ts` | 8 | Datas no horário de Brasília, regressão linear e faixa, **resistência a picos**, acumulado e saldo projetados, potencial de ovos pelas regras do `game-core` (humor, cansaço, fim da vida) |

Os testes do `web` usam PGlite e não precisam de banco externo. Cada arquivo sobe o próprio banco, por isso o Vitest roda no máximo 3 arquivos ao mesmo tempo (`maxWorkers` em `vitest.config.mts`).

---

## Deploy

### (a) Servidor Node + PostgreSQL

```bash
pnpm install && pnpm build
DATABASE_URL=... AUTH_SECRET=... VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:... pnpm start
```

Os jobs rodam pelo agendador interno, então não é preciso cron.

### (b) Vercel (serverless)

| Variável | Valor |
|---|---|
| `DATABASE_URL` | PostgreSQL (ex.: Supabase, pooler na porta 6543) |
| `AUTH_SECRET` | 32 caracteres aleatórios ou mais |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Saída de `pnpm --filter @galinheiro/web vapid` |
| `ADMIN_USUARIO` / `ADMIN_SENHA_HASH` | Login do painel (`ADMIN_SENHA_HASH` = saída de `pnpm --filter @galinheiro/web senha-admin`) |
| `CRON_SECRET` | Segredo do cron |
| `JOBS_INTERNOS` | `0` |

Configure também um cron chamando `/api/cron/tick` com `Authorization: Bearer <CRON_SECRET>`.

> **Atenção:** cron a cada minuto na Vercel exige plano pago. Uma alternativa é um agendador externo (qualquer serviço que faça uma requisição HTTP periódica com o cabeçalho acima).

> **PGlite não serve para produção com várias instâncias:** é um arquivo local de um único processo. Em produção, use sempre `DATABASE_URL`.

---

## Decisões que divergem do GDD

| GDD | Implementação | Motivo |
|---|---|---|
| Supabase Auth (`auth.users`) | **Autenticação própria** (tabela `contas`, scrypt, JWT em cookie) | Funciona com qualquer PostgreSQL, sem serviço externo |
| Convidado com 1 toque | **Só membros cadastrados** (nome, telefone, e-mail e senha) | Decisão de produto |
| PostgreSQL/Supabase também em dev | **PGlite** no desenvolvimento e nos testes | `pnpm install && pnpm dev` funciona sem configurar nada |
| `pg_cron` | **Jobs da aplicação** (agendador interno ou `/api/cron/tick`) | Funciona em qualquer hospedagem e em PGlite |
| Políticas RLS por usuário | **RLS sem políticas** + revogação de `anon`/`authenticated` | Só o servidor acessa o banco, e a API REST automática do Supabase fica fechada |

---

## Segurança e conformidade

- **Cabeçalhos** (`next.config.ts`): `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (câmera, microfone, geolocalização e pagamento desligados). Em produção, também **HSTS** e **CSP** restrita a `'self'` (`frame-ancestors 'none'`, `form-action 'self'` etc.; imagens também de `https:`, para as imagens dos popups). O `X-Powered-By` é removido.
- **Painel administrador:** só para admins (403 para os demais), toda ação auditada, ajustes de saldo/ovos/animais idempotentes, e nenhum admin pode bloquear, excluir ou rebaixar a si mesmo. Links de popup aceitam só caminhos do jogo ou `https://`, e os externos abrem com `noopener`.
- **Cookie `__Host-`** em produção: exige `Secure` e `Path=/` e proíbe `Domain`, de modo que subdomínios não conseguem sobrescrever a sessão. O cookie também é `httpOnly`.
- **Sem dinheiro real:** não há loja paga, anúncios nem meios de pagamento. As comissões de afiliação são moedas do jogo pagas pelo próprio jogo; nada pode ser sacado ou convertido.
- **Sorteio no servidor:** RNG e regras ficam só no servidor, e os ovos pendentes não são expostos.
- **Banco blindado:** RLS sem políticas e acesso revogado para `anon`/`authenticated` (migration `0004`).
- **Exclusão de conta:** o jogador pode apagar a conta e todos os dados em Ajustes (`DELETE /api/v1/me`).
- **ECA Digital (Lei 15.211/2025):** os requisitos de proteção de crianças e adolescentes e como o jogo os atende estão no GDD (fora do repositório).

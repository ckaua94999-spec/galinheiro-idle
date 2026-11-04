// Migrations do banco (GDD seção 8, adaptadas para rodar em PostgreSQL puro e no PGlite).
// Diferenças em relação ao GDD: autenticação própria (tabela `contas` no lugar de auth.users),
// assinaturas de push e jobs chamados pela aplicação (sem pg_cron). As políticas de RLS do
// Supabase ficam em `sql/supabase-rls.sql` (opcional, só para quem usar o Supabase).

export interface Migracao { nome: string; sql: string }

const M0001_INIT = /* sql */ `
create type animal_tipo     as enum ('galinha', 'pato', 'ganso', 'avestruz');
create type raridade_tipo   as enum ('comum', 'raro', 'epico', 'lendario');
create type entidade_status as enum ('ativo', 'expirado');
create type entidade_origem as enum ('ROLETA', 'BOAS_VINDAS', 'SUPORTE');
create type tier_vida       as enum ('feliz', 'neutro', 'cansado', 'triste');
create type item_tipo       as enum ('ovo_galinha', 'ovo_pato', 'ovo_ganso', 'ovo_avestruz');
create type transacao_tipo  as enum ('BONUS_INICIAL', 'VENDA_OVOS', 'GIRO_ROLETA', 'UPGRADE_NINHO', 'AJUSTE_SUPORTE');
create type coleta_origem   as enum ('INDIVIDUAL', 'EM_MASSA', 'DESPEDIDA');

-- Contas (autenticação própria: convidado ou e-mail + senha)
create table contas (
  id                       uuid        primary key default gen_random_uuid(),
  tipo                     text        not null default 'convidado' check (tipo in ('convidado', 'email')),
  email                    text        unique,
  senha_hash               text,
  codigo_recuperacao_hash  text,
  sessao_versao            integer     not null default 1,
  criado_em                timestamptz not null default now(),
  atualizado_em            timestamptz not null default now(),
  constraint contas_email_ck check ((tipo = 'email') = (email is not null and senha_hash is not null))
);

create table players (
  id                        uuid        primary key references contas (id) on delete cascade,
  apelido                   text        check (apelido is null or char_length(apelido) between 1 and 24),
  moedas_x100               bigint      not null default 0 check (moedas_x100 >= 0),
  nivel_galinheiro          smallint    not null default 1 check (nivel_galinheiro between 1 and 32),
  capacidade                smallint    generated always as ((nivel_galinheiro * 4)::smallint) stored,
  tutorial_etapa            smallint    not null default 0 check (tutorial_etapa between 0 and 8),
  aposentadorias_vistas_ate timestamptz not null default now(),
  preferencias              jsonb       not null default '{}'::jsonb,
  config_versao             text        not null,
  versao                    bigint      not null default 0,
  criado_em                 timestamptz not null default now(),
  atualizado_em             timestamptz not null default now(),
  ultimo_acesso_em          timestamptz
);

create table nests (
  player_id  uuid        not null references players (id) on delete cascade,
  slot       smallint    not null check (slot between 1 and 128),
  criado_em  timestamptz not null default now(),
  primary key (player_id, slot)
);

create table entities (
  id                    uuid            primary key default gen_random_uuid(),
  player_id             uuid            not null references players (id) on delete cascade,
  nome                  text            not null check (char_length(nome) between 1 and 20),
  tipo                  animal_tipo     not null,
  raridade              raridade_tipo   not null,
  origem                entidade_origem not null default 'ROLETA',
  status                entidade_status not null default 'ativo',
  nascimento            timestamptz     not null,
  expiracao             timestamptz     not null,
  vida_ancora           numeric(9,6)    not null default 100 check (vida_ancora between 0 and 100),
  vida_ancora_em        timestamptz     not null,
  fator_decaimento_pct  smallint        not null check (fator_decaimento_pct between 1 and 100),
  slot_id               smallint,
  ciclo_n               integer         not null default 1 check (ciclo_n >= 1),
  ciclo_inicio          timestamptz     not null,
  ciclo_tier            tier_vida       not null,
  proximo_rendimento    timestamptz     not null,
  ovos_pendentes        smallint        not null check (ovos_pendentes between 0 and 3),
  ovos_total            integer         not null default 0 check (ovos_total >= 0),
  coletas_total         integer         not null default 0 check (coletas_total >= 0),
  expirado_em           timestamptz,
  criado_em             timestamptz     not null default now(),
  atualizado_em         timestamptz     not null default now(),
  constraint entities_ninho_fk foreign key (player_id, slot_id) references nests (player_id, slot),
  constraint entities_status_ck check (
       (status = 'ativo'    and slot_id is not null and expirado_em is null     and ovos_pendentes between 1 and 3)
    or (status = 'expirado' and slot_id is null     and expirado_em is not null and ovos_pendentes = 0)
  ),
  constraint entities_datas_ck check (
    expiracao > nascimento and ciclo_inicio <= proximo_rendimento and proximo_rendimento <= expiracao
  ),
  constraint entities_tipo_raridade_mvp_ck check (
       (tipo = 'galinha'  and raridade = 'comum')
    or (tipo = 'pato'     and raridade = 'raro')
    or (tipo = 'ganso'    and raridade = 'epico')
    or (tipo = 'avestruz' and raridade = 'lendario')
  )
);
create unique index entities_slot_ativo_ux on entities (player_id, slot_id) where status = 'ativo';
create index entities_player_status_ix    on entities (player_id, status);
create index entities_pronto_ix           on entities (player_id, proximo_rendimento) where status = 'ativo';
create index entities_expiracao_ix        on entities (expiracao) where status = 'ativo';
create index entities_aposentados_ix      on entities (player_id, expirado_em desc) where status = 'expirado';

create table inventory (
  player_id       uuid        not null references players (id) on delete cascade,
  item            item_tipo   not null,
  quantidade      integer     not null default 0 check (quantidade >= 0),
  total_coletado  bigint      not null default 0 check (total_coletado >= 0),
  total_vendido   bigint      not null default 0 check (total_vendido >= 0),
  atualizado_em   timestamptz not null default now(),
  primary key (player_id, item),
  constraint inventory_saldo_ck check (quantidade = total_coletado - total_vendido)
);

create table transactions (
  id               uuid           primary key default gen_random_uuid(),
  player_id        uuid           not null references players (id) on delete cascade,
  tipo             transacao_tipo not null,
  valor_x100       bigint         not null check (valor_x100 <> 0),
  saldo_apos_x100  bigint         not null check (saldo_apos_x100 >= 0),
  detalhes         jsonb          not null default '{}'::jsonb,
  config_versao    text           not null,
  criado_em        timestamptz    not null default now(),
  constraint transactions_sinal_ck check (
       (tipo in ('BONUS_INICIAL', 'VENDA_OVOS')  and valor_x100 > 0)
    or (tipo in ('GIRO_ROLETA', 'UPGRADE_NINHO') and valor_x100 < 0)
    or  tipo = 'AJUSTE_SUPORTE'
  )
);
create index transactions_player_ix       on transactions (player_id, criado_em desc, id desc);
create unique index transactions_bonus_ux on transactions (player_id) where tipo = 'BONUS_INICIAL';

create table spins (
  id             uuid          primary key default gen_random_uuid(),
  player_id      uuid          not null references players (id) on delete cascade,
  transacao_id   uuid          not null unique references transactions (id) on delete cascade,
  entity_id      uuid          not null unique references entities (id) on delete cascade,
  custo_x100     bigint        not null check (custo_x100 > 0),
  rng_valor      integer       not null check (rng_valor between 0 and 9999),
  tipo           animal_tipo   not null,
  raridade       raridade_tipo not null,
  angulo_graus   numeric(7,3)  not null check (angulo_graus >= 0 and angulo_graus < 360),
  config_versao  text          not null,
  criado_em      timestamptz   not null default now()
);
create index spins_player_ix on spins (player_id, criado_em desc);

create table collections (
  id           bigint        generated always as identity primary key,
  player_id    uuid          not null references players (id) on delete cascade,
  origem       coleta_origem not null,
  coletado_em  timestamptz   not null,
  total_ovos   integer       not null check (total_ovos > 0),
  por_item     jsonb         not null,
  detalhes     jsonb         not null
);
create index collections_player_ix on collections (player_id, coletado_em desc);

create table idempotency_keys (
  player_id     uuid        not null references players (id) on delete cascade,
  chave         text        not null check (char_length(chave) between 8 and 64),
  endpoint      text        not null,
  request_hash  text        not null,
  status_http   smallint    not null default 0,
  resposta      jsonb,
  criado_em     timestamptz not null default now(),
  primary key (player_id, chave)
);
create index idempotency_criado_ix on idempotency_keys (criado_em);

create table integridade_alertas (
  id         bigint      generated always as identity primary key,
  player_id  uuid,
  tipo       text        not null,
  detalhes   jsonb       not null,
  criado_em  timestamptz not null default now()
);

create table push_assinaturas (
  id               uuid        primary key default gen_random_uuid(),
  player_id        uuid        not null references players (id) on delete cascade,
  endpoint         text        not null unique,
  p256dh           text        not null,
  auth             text        not null,
  fuso_min         smallint    not null default -180,
  criado_em        timestamptz not null default now(),
  ultimo_envio_em  timestamptz
);
create index push_player_ix on push_assinaturas (player_id);
`;

const M0002_FUNCOES = /* sql */ `
-- Vida: mesma fórmula do game-core (âncora − fator × Δms / 7.776.000.000)
create or replace function fn_vida(p_ancora numeric, p_ancora_em timestamptz, p_fator_pct integer, p_agora timestamptz)
returns numeric
language sql immutable parallel safe as $$
  select greatest(0, least(100,
    p_ancora - p_fator_pct * (extract(epoch from (p_agora - p_ancora_em)) * 1000) / 7776000000.0));
$$;

create or replace function fn_tier(p_vida numeric)
returns tier_vida
language sql immutable parallel safe as $$
  select case
    when p_vida > 75 then 'feliz'::tier_vida
    when p_vida > 50 then 'neutro'::tier_vida
    when p_vida > 25 then 'cansado'::tier_vida
    when p_vida > 0  then 'triste'::tier_vida
  end;
$$;

-- Aposentadoria + presente de despedida (RN-ENT-03 e RN-REN-07).
-- Pré-condição: quem chama já travou a linha do jogador (ordem de travas: players -> entities).
create or replace function fn_aposentar(p_entity uuid, p_agora timestamptz)
returns boolean
language plpgsql as $$
declare
  e      entities%rowtype;
  v_item item_tipo;
  v_em   timestamptz;
begin
  select * into e from entities where id = p_entity for update;
  if not found or e.status <> 'ativo' then
    return false;
  end if;
  if e.expiracao > p_agora
     and fn_vida(e.vida_ancora, e.vida_ancora_em, e.fator_decaimento_pct, p_agora) > 0 then
    return false;
  end if;

  v_item := ('ovo_' || e.tipo::text)::item_tipo;
  v_em   := least(e.expiracao, p_agora);

  insert into inventory as inv (player_id, item, quantidade, total_coletado, atualizado_em)
  values (e.player_id, v_item, e.ovos_pendentes, e.ovos_pendentes, p_agora)
  on conflict (player_id, item) do update
     set quantidade     = inv.quantidade + excluded.quantidade,
         total_coletado = inv.total_coletado + excluded.total_coletado,
         atualizado_em  = p_agora;

  insert into collections (player_id, origem, coletado_em, total_ovos, por_item, detalhes)
  values (e.player_id, 'DESPEDIDA', v_em, e.ovos_pendentes,
          jsonb_build_object(v_item::text, e.ovos_pendentes),
          jsonb_build_array(jsonb_build_object(
            'e', e.id, 'c', e.ciclo_n, 't', e.ciclo_tier, 'o', e.ovos_pendentes, 'p', e.proximo_rendimento)));

  update entities
     set status         = 'expirado',
         slot_id        = null,
         expirado_em    = v_em,
         ovos_total     = ovos_total + e.ovos_pendentes,
         coletas_total  = coletas_total + 1,
         ovos_pendentes = 0,
         atualizado_em  = p_agora
   where id = e.id;

  update players set versao = versao + 1, atualizado_em = p_agora where id = e.player_id;
  return true;
end;
$$;

-- Job: aposenta quem venceu enquanto o jogador estava offline
create or replace function job_aposentar_vencidos(p_limite integer, p_agora timestamptz)
returns integer
language plpgsql as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select id, player_id from entities
     where status = 'ativo' and expiracao <= p_agora
     order by expiracao
     limit p_limite
  loop
    perform 1 from players where id = r.player_id for update;
    if fn_aposentar(r.id, p_agora) then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- Job: verificação diária das invariantes (GDD 3.5.6)
create or replace function job_checar_integridade()
returns integer
language plpgsql as $$
declare
  n integer := 0;
  c integer;
begin
  insert into integridade_alertas (player_id, tipo, detalhes)
  select p.id, 'INV-01_SALDO', jsonb_build_object('saldo_x100', p.moedas_x100, 'extrato_x100', coalesce(t.soma, 0))
    from players p
    left join (select player_id, sum(valor_x100) as soma from transactions group by player_id) t on t.player_id = p.id
   where p.moedas_x100 <> coalesce(t.soma, 0);
  get diagnostics c = row_count;
  n := n + c;

  insert into integridade_alertas (player_id, tipo, detalhes)
  select p.id, 'INV-04_CAPACIDADE', jsonb_build_object('ativos', a.qtd, 'capacidade', p.capacidade)
    from players p
    join (select player_id, count(*) as qtd from entities where status = 'ativo' group by player_id) a on a.player_id = p.id
   where a.qtd > p.capacidade;
  get diagnostics c = row_count;
  n := n + c;

  insert into integridade_alertas (player_id, tipo, detalhes)
  select s.player_id, 'INV-06_GIRO', jsonb_build_object('spin_id', s.id, 'transacao_id', s.transacao_id)
    from spins s
    join transactions t on t.id = s.transacao_id
   where t.tipo <> 'GIRO_ROLETA' or t.valor_x100 <> -s.custo_x100;
  get diagnostics c = row_count;
  n := n + c;

  return n;
end;
$$;

create or replace view v_entities_agora as
select e.*,
       fn_vida(e.vida_ancora, e.vida_ancora_em, e.fator_decaimento_pct, now())          as vida_atual,
       fn_tier(fn_vida(e.vida_ancora, e.vida_ancora_em, e.fator_decaimento_pct, now())) as tier_atual,
       (e.status = 'ativo' and now() >= e.proximo_rendimento)                           as pronto
  from entities e;
`;

// Guarda o "presente de despedida" na própria entidade para o modal de aposentadorias.
const M0003_PRESENTE = /* sql */ `
alter table entities add column presente_ovos smallint not null default 0 check (presente_ovos between 0 and 3);

create or replace function fn_aposentar(p_entity uuid, p_agora timestamptz)
returns boolean
language plpgsql as $$
declare
  e      entities%rowtype;
  v_item item_tipo;
  v_em   timestamptz;
begin
  select * into e from entities where id = p_entity for update;
  if not found or e.status <> 'ativo' then
    return false;
  end if;
  if e.expiracao > p_agora
     and fn_vida(e.vida_ancora, e.vida_ancora_em, e.fator_decaimento_pct, p_agora) > 0 then
    return false;
  end if;

  v_item := ('ovo_' || e.tipo::text)::item_tipo;
  v_em   := least(e.expiracao, p_agora);

  insert into inventory as inv (player_id, item, quantidade, total_coletado, atualizado_em)
  values (e.player_id, v_item, e.ovos_pendentes, e.ovos_pendentes, p_agora)
  on conflict (player_id, item) do update
     set quantidade     = inv.quantidade + excluded.quantidade,
         total_coletado = inv.total_coletado + excluded.total_coletado,
         atualizado_em  = p_agora;

  insert into collections (player_id, origem, coletado_em, total_ovos, por_item, detalhes)
  values (e.player_id, 'DESPEDIDA', v_em, e.ovos_pendentes,
          jsonb_build_object(v_item::text, e.ovos_pendentes),
          jsonb_build_array(jsonb_build_object(
            'e', e.id, 'c', e.ciclo_n, 't', e.ciclo_tier, 'o', e.ovos_pendentes, 'p', e.proximo_rendimento)));

  update entities
     set status         = 'expirado',
         slot_id        = null,
         expirado_em    = v_em,
         presente_ovos  = e.ovos_pendentes,
         ovos_total     = ovos_total + e.ovos_pendentes,
         coletas_total  = coletas_total + 1,
         ovos_pendentes = 0,
         atualizado_em  = p_agora
   where id = e.id;

  update players set versao = versao + 1, atualizado_em = p_agora where id = e.player_id;
  return true;
end;
$$;
`;

// Defesa em profundidade (Supabase e afins): o schema public pode ficar exposto por uma API REST
// automática (PostgREST), mas este app só acessa o banco pelo servidor. RLS ligado e sem políticas nega
// tudo a quem não é dono das tabelas; o usuário da DATABASE_URL (dono) não é afetado. As funções deixam
// de ser executáveis por PUBLIC — senão fn_aposentar/job_* poderiam ser chamadas via /rpc.
const M0004_BLINDAGEM = /* sql */ `
alter table contas              enable row level security;
alter table players             enable row level security;
alter table nests               enable row level security;
alter table entities            enable row level security;
alter table inventory           enable row level security;
alter table transactions        enable row level security;
alter table spins               enable row level security;
alter table collections         enable row level security;
alter table idempotency_keys    enable row level security;
alter table integridade_alertas enable row level security;
alter table push_assinaturas    enable row level security;
alter table schema_migrations   enable row level security;

revoke execute on all functions in schema public from public;
-- (o EXECUTE para PUBLIC é um padrão global; revogá-lo "in schema" não teria efeito)
alter default privileges revoke execute on functions from public;

do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('revoke all on all functions in schema public from %I', r);
      execute format('alter default privileges in schema public revoke all on tables from %I', r);
      execute format('alter default privileges in schema public revoke all on sequences from %I', r);
      execute format('alter default privileges in schema public revoke all on functions from %I', r);
    end if;
  end loop;
end $$;
`;

// Só membros cadastrados: nome + telefone (E.164, único) + e-mail + senha. Contas antigas (convidado, ou e-mail
// sem telefone) ficam no banco, mas não abrem mais sessão (sessaoValida exige o cadastro completo).
const M0005_MEMBROS = /* sql */ `
alter table contas add column nome text check (nome is null or char_length(nome) between 2 and 60);
alter table contas add column telefone text check (telefone is null or telefone ~ '^[+]55[1-9][0-9]{9,10}$');
create unique index contas_telefone_unico on contas (telefone) where telefone is not null;
`;

// Painel administrador: papel/bloqueio nas contas, atividade diária (DAU/WAU/MAU e projeção de pessoas),
// atendimento (uma conversa contínua por membro), popups com público/período/frequência e auditoria das
// ações do painel. Datas "do dia" seguem o horário de Brasília (UTC−3 fixo, sem horário de verão desde 2019).
const M0006_ADMIN = /* sql */ `
alter table contas add column papel text not null default 'jogador' check (papel in ('jogador', 'admin'));
alter table contas add column bloqueado_em timestamptz;
alter table contas add column bloqueio_motivo text check (bloqueio_motivo is null or char_length(bloqueio_motivo) <= 300);

create table atividade_diaria (
  conta_id  uuid not null references contas (id) on delete cascade,
  dia       date not null,
  primary key (conta_id, dia)
);
create index atividade_diaria_dia on atividade_diaria (dia);
-- histórico: quem coletou ou movimentou moedas conta como ativo naquele dia
insert into atividade_diaria (conta_id, dia)
select player_id, ((coletado_em at time zone 'UTC') - interval '3 hours')::date from collections
union
select player_id, ((criado_em at time zone 'UTC') - interval '3 hours')::date from transactions
on conflict do nothing;

create table suporte_conversas (
  id                  uuid        primary key default gen_random_uuid(),
  conta_id            uuid        not null unique references contas (id) on delete cascade,
  status              text        not null default 'aberta' check (status in ('aberta', 'resolvida')),
  nao_lidas_admin     integer     not null default 0 check (nao_lidas_admin >= 0),
  nao_lidas_jogador   integer     not null default 0 check (nao_lidas_jogador >= 0),
  ultima_mensagem_em  timestamptz,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create index suporte_conversas_fila on suporte_conversas (status, ultima_mensagem_em desc);

create table suporte_mensagens (
  id           bigint      generated always as identity primary key,
  conversa_id  uuid        not null references suporte_conversas (id) on delete cascade,
  autor        text        not null check (autor in ('jogador', 'admin', 'sistema')),
  admin_id     uuid        references contas (id) on delete set null,
  texto        text        not null check (char_length(texto) between 1 and 2000),
  criado_em    timestamptz not null default now()
);
create index suporte_mensagens_conversa on suporte_mensagens (conversa_id, id);

create table popups (
  id            uuid        primary key default gen_random_uuid(),
  titulo        text        not null check (char_length(titulo) between 1 and 80),
  mensagem      text        not null check (char_length(mensagem) between 1 and 1000),
  imagem_url    text        check (imagem_url is null or imagem_url ~ '^https://'),
  botao_texto   text        check (botao_texto is null or char_length(botao_texto) between 1 and 30),
  link          text        check (link is null or link ~ '^(/[^/]|https://)'),
  publico       text        not null default 'todos' check (publico in ('todos', 'contas')),
  contas        uuid[]      not null default '{}',
  frequencia    text        not null default 'uma_vez' check (frequencia in ('uma_vez', 'diaria', 'sempre')),
  inicio        timestamptz not null default now(),
  fim           timestamptz,
  ativo         boolean     not null default true,
  criado_por    uuid        references contas (id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint popups_periodo_ck check (fim is null or fim > inicio)
);
create index popups_ativos on popups (ativo, inicio);

create table popups_vistos (
  popup_id         uuid        not null references popups (id) on delete cascade,
  conta_id         uuid        not null references contas (id) on delete cascade,
  primeira_vez_em  timestamptz not null default now(),
  ultima_vez_em    timestamptz not null default now(),
  vezes            integer     not null default 1,
  clicou_em        timestamptz,
  primary key (popup_id, conta_id)
);

create table admin_acoes (
  id             bigint      generated always as identity primary key,
  admin_id       uuid        references contas (id) on delete set null,
  acao           text        not null,
  alvo_conta_id  uuid,
  detalhes       jsonb       not null default '{}'::jsonb,
  criado_em      timestamptz not null default now()
);
create index admin_acoes_criado on admin_acoes (criado_em desc);
create index admin_acoes_alvo on admin_acoes (alvo_conta_id, criado_em desc);

alter table atividade_diaria  enable row level security;
alter table suporte_conversas enable row level security;
alter table suporte_mensagens enable row level security;
alter table popups            enable row level security;
alter table popups_vistos     enable row level security;
alter table admin_acoes       enable row level security;
`;

// Convites e afiliação: comissões multinível sobre as vendas de ovos dos indicados, pagas pelo jogo em MOEDAS
// DO JOGO (nada de dinheiro real). O valor novo do enum não pode ser usado na mesma transação em que é criado
// (as migrations pendentes rodam juntas numa só), por isso a regra de sinal compara o tipo como texto.
const M0007_AFILIADOS = /* sql */ `
alter type transacao_tipo add value if not exists 'COMISSAO_INDICACAO';
alter table transactions drop constraint transactions_sinal_ck;
alter table transactions add constraint transactions_sinal_ck check (
     (tipo::text in ('BONUS_INICIAL', 'VENDA_OVOS', 'COMISSAO_INDICACAO') and valor_x100 > 0)
  or (tipo::text in ('GIRO_ROLETA', 'UPGRADE_NINHO') and valor_x100 < 0)
  or  tipo::text = 'AJUSTE_SUPORTE'
);

-- código do link de convite (gerado no cadastro ou na 1ª visita à tela de convites) e quem convidou
alter table contas add column convite_codigo text check (convite_codigo ~ '^[A-HJ-NP-Z2-9]{6,10}$');
create unique index contas_convite_codigo_ux on contas (convite_codigo);
alter table contas add column indicado_por uuid references contas (id) on delete set null;
alter table contas add column indicado_em timestamptz;
alter table contas add constraint contas_indicado_ck check (indicado_por is null or indicado_por <> id);
create index contas_indicado_por_ix on contas (indicado_por) where indicado_por is not null;

-- taxas (linha única, editada no painel): % de cada nível em pontos-base (1000 = 10%) e teto diário
create table afiliados_config (
  id                smallint    primary key default 1 check (id = 1),
  ativo             boolean     not null default true,
  comissoes_bp      integer[]   not null default '{1000,400,200}' check (
                      (cardinality(comissoes_bp) between 1 and 5) and 0 <= all (comissoes_bp) and 5000 >= all (comissoes_bp)),
  teto_diario_x100  bigint      default 20000 check (teto_diario_x100 is null or teto_diario_x100 > 0),
  atualizado_em     timestamptz not null default now(),
  atualizado_por    uuid        references contas (id) on delete set null
);
insert into afiliados_config (id) values (1);

-- cada comissão paga (o crédito em si é a transação COMISSAO_INDICACAO do beneficiário)
create table comissoes (
  id               bigint      generated always as identity primary key,
  beneficiario_id  uuid        not null references contas (id) on delete cascade,
  origem_conta_id  uuid        references contas (id) on delete set null,
  nivel            smallint    not null check (nivel between 1 and 5),
  base_x100        bigint      not null check (base_x100 > 0),
  valor_x100       bigint      not null check (valor_x100 > 0),
  transacao_id     uuid        references transactions (id) on delete set null,
  criado_em        timestamptz not null
);
create index comissoes_beneficiario_ix on comissoes (beneficiario_id, criado_em desc);
create index comissoes_origem_ix       on comissoes (origem_conta_id);
create index comissoes_criado_ix       on comissoes (criado_em);

alter table afiliados_config enable row level security;
alter table comissoes        enable row level security;
`;

// Intercâmbio e cupons: TICKET é um vale do jogo que se troca por ovos ou animais (tabela de ofertas do
// painel). Vem de cupons, de ajustes da equipe e, se o painel ligar, da compra com moedas do jogo — nunca de
// dinheiro real. Como na 0007, os valores novos dos enums não são usados nesta mesma transação.
const M0008_INTERCAMBIO = /* sql */ `
alter type transacao_tipo add value if not exists 'COMPRA_TICKET';
alter type entidade_origem add value if not exists 'INTERCAMBIO';
alter table transactions drop constraint transactions_sinal_ck;
alter table transactions add constraint transactions_sinal_ck check (
     (tipo::text in ('BONUS_INICIAL', 'VENDA_OVOS', 'COMISSAO_INDICACAO') and valor_x100 > 0)
  or (tipo::text in ('GIRO_ROLETA', 'UPGRADE_NINHO', 'COMPRA_TICKET') and valor_x100 < 0)
  or  tipo::text = 'AJUSTE_SUPORTE'
);

alter table players add column tickets integer not null default 0 check (tickets >= 0);

-- extrato dos tickets (como transactions para as moedas): saldo = soma dos deltas
create table tickets_movimentos (
  id          bigint      generated always as identity primary key,
  player_id   uuid        not null references players (id) on delete cascade,
  motivo      text        not null check (motivo in ('compra', 'cupom', 'troca', 'ajuste')),
  delta       integer     not null check (delta <> 0),
  saldo_apos  integer     not null check (saldo_apos >= 0),
  detalhes    jsonb       not null default '{}'::jsonb,
  criado_em   timestamptz not null
);
create index tickets_movimentos_player_ix on tickets_movimentos (player_id, criado_em desc, id desc);
create index tickets_movimentos_criado_ix on tickets_movimentos (criado_em);

-- regras do intercâmbio (linha única, editada no painel)
create table intercambio_config (
  id                 smallint    primary key default 1 check (id = 1),
  ativo              boolean     not null default true,
  compra_ativa       boolean     not null default false,
  preco_ticket_x100  bigint      not null default 1000 check (preco_ticket_x100 between 1 and 100000000),
  limite_compra_dia  integer     check (limite_compra_dia is null or limite_compra_dia > 0),
  atualizado_em      timestamptz not null default now(),
  atualizado_por     uuid        references contas (id) on delete set null
);
insert into intercambio_config (id) values (1);

-- o que um ticket vale: N tickets → ovos (item × quantidade) ou 1 animal
create table intercambio_ofertas (
  id             uuid        primary key default gen_random_uuid(),
  tipo           text        not null check (tipo in ('ovos', 'animal')),
  item           item_tipo,
  quantidade     integer     check (quantidade between 1 and 100000),
  animal         animal_tipo,
  custo_tickets  integer     not null check (custo_tickets between 1 and 100000),
  ativo          boolean     not null default true,
  ordem          integer     not null default 0,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint intercambio_ofertas_tipo_ck check (
       (tipo = 'ovos' and item is not null and quantidade is not null and animal is null)
    or (tipo = 'animal' and animal is not null and item is null and quantidade is null)
  )
);
insert into intercambio_ofertas (tipo, item, quantidade, custo_tickets, ordem) values
  ('ovos', 'ovo_galinha', 7, 1, 1), ('ovos', 'ovo_pato', 9, 2, 2), ('ovos', 'ovo_ganso', 10, 3, 3), ('ovos', 'ovo_avestruz', 10, 5, 4);
insert into intercambio_ofertas (tipo, animal, custo_tickets, ordem) values
  ('animal', 'galinha', 5, 11), ('animal', 'pato', 10, 12), ('animal', 'ganso', 20, 13), ('animal', 'avestruz', 50, 14);

-- cupons: código da equipe que dá tickets (um resgate por membro)
create table cupons (
  id             uuid        primary key default gen_random_uuid(),
  codigo         text        not null unique check (codigo ~ '^[A-Z0-9]{4,20}$'),
  descricao      text        check (descricao is null or char_length(descricao) <= 200),
  tickets        integer     not null check (tickets between 1 and 10000),
  usos_max       integer     check (usos_max is null or usos_max > 0),
  usos           integer     not null default 0 check (usos >= 0),
  inicio         timestamptz not null,
  fim            timestamptz,
  ativo          boolean     not null default true,
  criado_por     uuid        references contas (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint cupons_periodo_ck check (fim is null or fim > inicio)
);
create table cupons_resgates (
  cupom_id   uuid        not null references cupons (id) on delete cascade,
  conta_id   uuid        not null references contas (id) on delete cascade,
  tickets    integer     not null,
  criado_em  timestamptz not null,
  primary key (cupom_id, conta_id)
);
create index cupons_resgates_conta_ix on cupons_resgates (conta_id);

alter table tickets_movimentos  enable row level security;
alter table intercambio_config  enable row level security;
alter table intercambio_ofertas enable row level security;
alter table cupons              enable row level security;
alter table cupons_resgates     enable row level security;
`;

// Login próprio do painel: a conta "operador" (o usuário do painel, com a senha definida no ambiente) assina as
// ações do painel. Não é membro nem jogador (não tem galinheiro), então não aparece em nenhuma estatística. As
// chaves de idempotência passam a valer para qualquer conta (antes exigiam um jogador).
const M0009_PAINEL = /* sql */ `
alter table contas drop constraint contas_tipo_check;
alter table contas add constraint contas_tipo_check check (tipo in ('convidado', 'email', 'operador'));
alter table contas add column usuario text check (usuario ~ '^[a-z0-9._-]{3,40}$');
create unique index contas_usuario_ux on contas (usuario);
alter table contas add constraint contas_operador_ck check ((tipo = 'operador') = (usuario is not null));
alter table idempotency_keys drop constraint idempotency_keys_player_id_fkey;
alter table idempotency_keys add constraint idempotency_keys_player_id_fkey
  foreign key (player_id) references contas (id) on delete cascade;
`;

// Saque PIX: debita moedas (1,00 moeda = R$ 1,00) e manda o valor para o CPF na LofyPay.
// O estorno devolve as moedas se a LofyPay recusar depois de aceito.
const M0010_SAQUES = /* sql */ `
alter type transacao_tipo add value if not exists 'SAQUE';
alter type transacao_tipo add value if not exists 'SAQUE_ESTORNO';
alter table transactions drop constraint transactions_sinal_ck;
alter table transactions add constraint transactions_sinal_ck check (
     (tipo::text in ('BONUS_INICIAL', 'VENDA_OVOS', 'COMISSAO_INDICACAO', 'SAQUE_ESTORNO') and valor_x100 > 0)
  or (tipo::text in ('GIRO_ROLETA', 'UPGRADE_NINHO', 'COMPRA_TICKET', 'SAQUE') and valor_x100 < 0)
  or  tipo::text = 'AJUSTE_SUPORTE'
);

create table saques (
  id            uuid        primary key default gen_random_uuid(),
  player_id     uuid        not null references players (id) on delete cascade,
  centavos      integer     not null check (centavos >= 100),
  cpf           text        not null check (cpf ~ '^[0-9]{11}$'),
  nome          text        not null check (char_length(nome) between 3 and 80),
  status        text        not null check (status in ('processando', 'pago', 'falhou')),
  provedor      text        not null check (provedor = 'lofypay'),
  id_externo    text,
  idempotencia  text        not null,
  motivo        text,
  criado_em     timestamptz not null,
  atualizado_em timestamptz not null
);
create unique index saques_idempotencia_ux on saques (player_id, idempotencia);
create index saques_player_ix on saques (player_id, criado_em desc);
create index saques_externo_ix on saques (provedor, id_externo);
alter table saques enable row level security;
`;

const M0011_ROLETA_PIX = `
create table roleta_pix (
  id            uuid        primary key default gen_random_uuid(),
  player_id     uuid        not null references players (id) on delete cascade,
  centavos      integer     not null check (centavos >= 100),
  status        text        not null check (status in ('aguardando', 'pago', 'usado', 'expirado', 'falhou')),
  id_transacao  text        not null,
  copia_cola    text        not null,
  qr_data_url   text        not null default '',
  idempotencia  text        not null,
  criado_em     timestamptz not null,
  atualizado_em timestamptz not null,
  expira_em     timestamptz not null
);
create unique index roleta_pix_idempotencia_ux on roleta_pix (player_id, idempotencia);
create unique index roleta_pix_transacao_ux on roleta_pix (id_transacao);
create index roleta_pix_player_ix on roleta_pix (player_id, criado_em);
alter table roleta_pix enable row level security;

alter table spins alter column transacao_id drop not null;
alter table spins add column cobranca_id uuid unique references roleta_pix (id);
alter table spins add constraint spins_origem_ck check (transacao_id is not null or cobranca_id is not null);

create or replace function job_checar_integridade()
returns integer
language plpgsql as $$
declare
  n integer := 0;
  c integer;
begin
  insert into integridade_alertas (player_id, tipo, detalhes)
  select p.id, 'INV-01_SALDO', jsonb_build_object('saldo_x100', p.moedas_x100, 'extrato_x100', coalesce(t.soma, 0))
    from players p
    left join (select player_id, sum(valor_x100) as soma from transactions group by player_id) t on t.player_id = p.id
   where p.moedas_x100 <> coalesce(t.soma, 0);
  get diagnostics c = row_count;
  n := n + c;

  insert into integridade_alertas (player_id, tipo, detalhes)
  select p.id, 'INV-04_CAPACIDADE', jsonb_build_object('ativos', a.qtd, 'capacidade', p.capacidade)
    from players p
    join (select player_id, count(*) as qtd from entities where status = 'ativo' group by player_id) a on a.player_id = p.id
   where a.qtd > p.capacidade;
  get diagnostics c = row_count;
  n := n + c;

  insert into integridade_alertas (player_id, tipo, detalhes)
  select s.player_id, 'INV-06_GIRO', jsonb_build_object('spin_id', s.id, 'transacao_id', s.transacao_id)
    from spins s
    join transactions t on t.id = s.transacao_id
   where t.tipo <> 'GIRO_ROLETA' or t.valor_x100 <> -s.custo_x100;
  get diagnostics c = row_count;
  n := n + c;

  insert into integridade_alertas (player_id, tipo, detalhes)
  select s.player_id, 'INV-06_GIRO_PIX', jsonb_build_object('spin_id', s.id, 'cobranca_id', s.cobranca_id)
    from spins s
    left join roleta_pix p on p.id = s.cobranca_id
   where s.transacao_id is null
     and (p.id is null or p.status <> 'usado' or p.centavos <> s.custo_x100);
  get diagnostics c = row_count;
  n := n + c;

  return n;
end;
$$;
`;

/** Gateway ativa do PIX da roleta. Cobranças já abertas guardam o provedor em que nasceram. */
const M0012_PAGAMENTOS_GATEWAY = `
create table if not exists pagamentos_config (
  id            smallint    primary key check (id = 1),
  gateway       text        not null check (gateway in ('lofypay', 'kavropay')),
  atualizado_em timestamptz not null default now()
);
insert into pagamentos_config (id, gateway) values (1, 'kavropay') on conflict (id) do nothing;

alter table roleta_pix add column if not exists provedor text not null default 'lofypay';
alter table roleta_pix drop constraint if exists roleta_pix_provedor_ck;
alter table roleta_pix add constraint roleta_pix_provedor_ck check (provedor in ('lofypay', 'kavropay'));
`;

/** PIX da ampliação do galinheiro. O nível só sobe depois que a cobrança fica paga. */
const M0013_AMPLIACAO_PIX = `
create table if not exists ampliacao_pix (
  id            uuid        primary key default gen_random_uuid(),
  player_id     uuid        not null references players (id) on delete cascade,
  centavos      integer     not null check (centavos >= 100),
  status        text        not null check (status in ('aguardando', 'pago', 'usado', 'expirado', 'falhou')),
  id_transacao  text        not null,
  copia_cola    text        not null,
  qr_data_url   text        not null default '',
  idempotencia  text        not null,
  provedor      text        not null default 'lofypay' check (provedor in ('lofypay', 'kavropay')),
  criado_em     timestamptz not null,
  atualizado_em timestamptz not null,
  expira_em     timestamptz not null
);
create unique index if not exists ampliacao_pix_idempotencia_ux on ampliacao_pix (player_id, idempotencia);
create unique index if not exists ampliacao_pix_transacao_ux on ampliacao_pix (id_transacao);
create index if not exists ampliacao_pix_player_ix on ampliacao_pix (player_id, criado_em);
alter table ampliacao_pix enable row level security;
`;

/** Cupom pode dar giros da roleta. O saldo fica no jogador e cada giro grátis não passa pelo PIX. */
const M0014_CUPOM_GIROS = `
alter table cupons drop constraint if exists cupons_tickets_check;
alter table cupons drop constraint if exists cupons_tickets_ck;
alter table cupons add constraint cupons_tickets_ck check (tickets between 0 and 10000);
alter table cupons add column if not exists beneficio text not null default 'tickets';
alter table cupons drop constraint if exists cupons_beneficio_val_ck;
alter table cupons add constraint cupons_beneficio_val_ck check (beneficio in ('tickets', 'giros'));
alter table cupons add column if not exists giros integer not null default 0;
alter table cupons drop constraint if exists cupons_giros_ck;
alter table cupons add constraint cupons_giros_ck check (giros between 0 and 10000);
alter table cupons drop constraint if exists cupons_beneficio_ck;
alter table cupons add constraint cupons_beneficio_ck check (
     (beneficio = 'tickets' and tickets >= 1 and giros = 0)
  or (beneficio = 'giros' and giros >= 1 and tickets = 0)
);
alter table cupons_resgates add column if not exists giros integer not null default 0 check (giros >= 0);
alter table players add column if not exists giros_gratis integer not null default 0 check (giros_gratis >= 0);
alter table spins add column if not exists giro_gratis boolean not null default false;
alter table spins drop constraint if exists spins_origem_ck;
alter table spins add constraint spins_origem_ck check (transacao_id is not null or cobranca_id is not null or giro_gratis);

create or replace function job_checar_integridade()
returns integer
language plpgsql as $$
declare
  n integer := 0;
  c integer;
begin
  insert into integridade_alertas (player_id, tipo, detalhes)
  select p.id, 'INV-01_SALDO', jsonb_build_object('saldo_x100', p.moedas_x100, 'extrato_x100', coalesce(t.soma, 0))
    from players p
    left join (select player_id, sum(valor_x100) as soma from transactions group by player_id) t on t.player_id = p.id
   where p.moedas_x100 <> coalesce(t.soma, 0);
  get diagnostics c = row_count;
  n := n + c;

  insert into integridade_alertas (player_id, tipo, detalhes)
  select p.id, 'INV-04_CAPACIDADE', jsonb_build_object('ativos', a.qtd, 'capacidade', p.capacidade)
    from players p
    join (select player_id, count(*) as qtd from entities where status = 'ativo' group by player_id) a on a.player_id = p.id
   where a.qtd > p.capacidade;
  get diagnostics c = row_count;
  n := n + c;

  insert into integridade_alertas (player_id, tipo, detalhes)
  select s.player_id, 'INV-06_GIRO', jsonb_build_object('spin_id', s.id, 'transacao_id', s.transacao_id)
    from spins s
    join transactions t on t.id = s.transacao_id
   where t.tipo <> 'GIRO_ROLETA' or t.valor_x100 <> -s.custo_x100;
  get diagnostics c = row_count;
  n := n + c;

  insert into integridade_alertas (player_id, tipo, detalhes)
  select s.player_id, 'INV-06_GIRO_PIX', jsonb_build_object('spin_id', s.id, 'cobranca_id', s.cobranca_id)
    from spins s
    left join roleta_pix p on p.id = s.cobranca_id
   where s.transacao_id is null
     and s.giro_gratis = false
     and (p.id is null or p.status <> 'usado' or p.centavos <> s.custo_x100);
  get diagnostics c = row_count;
  n := n + c;

  return n;
end;
$$;
`;

/** Saque guarda a taxa (R$ 5 + 4%) e o líquido que foi para o PIX. O estorno devolve o valor debitado. */
const M0015_SAQUE_TAXA = `
alter table saques add column if not exists taxa_centavos integer not null default 0;
alter table saques drop constraint if exists saques_taxa_ck;
alter table saques add constraint saques_taxa_ck check (taxa_centavos >= 0);
alter table saques add column if not exists liquido_centavos integer;
update saques set liquido_centavos = centavos - taxa_centavos where liquido_centavos is null;
alter table saques alter column liquido_centavos set not null;
alter table saques drop constraint if exists saques_liquido_ck;
alter table saques add constraint saques_liquido_ck check (
  liquido_centavos >= 100 and centavos = liquido_centavos + taxa_centavos
);
`;

/** Saque PIX passa a poder sair pela KavroPay, além da LofyPay. */
const M0016_SAQUE_KAVROPAY = `
alter table saques drop constraint if exists saques_provedor_check;
alter table saques drop constraint if exists saques_provedor_ck;
alter table saques add constraint saques_provedor_ck check (provedor in ('lofypay', 'kavropay'));
`;

/** A equipe pode liberar o bônus inicial para saque sem PIX da roleta. */
const M0017_BONUS_SAQUE = `
alter table players add column if not exists bonus_saque_liberado boolean not null default false;
`;

/** SwytchPay entra como gateway de PIX e de saque. O PIX novo passa a nascer nela. */
const M0018_SWYTCHPAY = `
alter table pagamentos_config drop constraint if exists pagamentos_config_gateway_check;
alter table pagamentos_config drop constraint if exists pagamentos_config_gateway_ck;
alter table pagamentos_config add constraint pagamentos_config_gateway_ck check (gateway in ('lofypay', 'kavropay', 'swytchpay'));

alter table roleta_pix drop constraint if exists roleta_pix_provedor_ck;
alter table roleta_pix add constraint roleta_pix_provedor_ck check (provedor in ('lofypay', 'kavropay', 'swytchpay'));

alter table ampliacao_pix drop constraint if exists ampliacao_pix_provedor_check;
alter table ampliacao_pix drop constraint if exists ampliacao_pix_provedor_ck;
alter table ampliacao_pix add constraint ampliacao_pix_provedor_ck check (provedor in ('lofypay', 'kavropay', 'swytchpay'));

alter table saques drop constraint if exists saques_provedor_check;
alter table saques drop constraint if exists saques_provedor_ck;
alter table saques add constraint saques_provedor_ck check (provedor in ('lofypay', 'kavropay', 'swytchpay'));

update pagamentos_config set gateway = 'swytchpay', atualizado_em = now() where id = 1;
`;

/** A gateway do saque é escolhida à parte da gateway que cria o PIX. */
const M0019_SAQUE_GATEWAY = `
alter table pagamentos_config add column if not exists saque_gateway text not null default 'swytchpay';
alter table pagamentos_config drop constraint if exists pagamentos_config_saque_gateway_check;
alter table pagamentos_config drop constraint if exists pagamentos_config_saque_gateway_ck;
alter table pagamentos_config add constraint pagamentos_config_saque_gateway_ck
  check (saque_gateway in ('lofypay', 'kavropay', 'swytchpay'));
`;

/** Bônus de cadastro: um valor geral e, por membro, o valor de quem entra pelo link dele. */
const M0020_BONUS_CADASTRO = `
alter table contas add column if not exists bonus_link_x100 bigint;
alter table contas drop constraint if exists contas_bonus_link_check;
alter table contas drop constraint if exists contas_bonus_link_ck;
alter table contas add constraint contas_bonus_link_ck check (
  bonus_link_x100 is null or (bonus_link_x100 >= 0 and bonus_link_x100 <= 100000)
);

alter table afiliados_config add column if not exists bonus_geral_x100 bigint not null default 5000;
alter table afiliados_config drop constraint if exists afiliados_config_bonus_geral_check;
alter table afiliados_config drop constraint if exists afiliados_config_bonus_geral_ck;
alter table afiliados_config add constraint afiliados_config_bonus_geral_ck check (
  bonus_geral_x100 >= 0 and bonus_geral_x100 <= 100000
);
`;

/** Cobrança por membro: PIX (padrão) ou USDT. A carteira USDT é uma só, em Pagamentos. */
const M0021_COBRANCA_USDT = `
alter table contas add column if not exists cobranca text not null default 'pix';
alter table contas drop constraint if exists contas_cobranca_check;
alter table contas drop constraint if exists contas_cobranca_ck;
alter table contas add constraint contas_cobranca_ck check (cobranca in ('pix', 'usdt'));

alter table pagamentos_config add column if not exists usdt_rede text not null default 'TRC20';
alter table pagamentos_config drop constraint if exists pagamentos_config_usdt_rede_check;
alter table pagamentos_config drop constraint if exists pagamentos_config_usdt_rede_ck;
alter table pagamentos_config add constraint pagamentos_config_usdt_rede_ck check (usdt_rede in ('TRC20', 'ERC20', 'BEP20'));
alter table pagamentos_config add column if not exists usdt_endereco text not null default '';
alter table pagamentos_config drop constraint if exists pagamentos_config_usdt_endereco_check;
alter table pagamentos_config drop constraint if exists pagamentos_config_usdt_endereco_ck;
alter table pagamentos_config add constraint pagamentos_config_usdt_endereco_ck check (char_length(usdt_endereco) <= 128);
alter table pagamentos_config add column if not exists usdt_cotacao_centavos integer not null default 550;
alter table pagamentos_config drop constraint if exists pagamentos_config_usdt_cotacao_check;
alter table pagamentos_config drop constraint if exists pagamentos_config_usdt_cotacao_ck;
alter table pagamentos_config add constraint pagamentos_config_usdt_cotacao_ck check (usdt_cotacao_centavos between 100 and 100000);

alter table roleta_pix drop constraint if exists roleta_pix_provedor_check;
alter table roleta_pix drop constraint if exists roleta_pix_provedor_ck;
alter table roleta_pix add constraint roleta_pix_provedor_ck check (provedor in ('lofypay', 'kavropay', 'swytchpay', 'usdt'));
alter table roleta_pix add column if not exists meio text not null default 'pix';
alter table roleta_pix drop constraint if exists roleta_pix_meio_check;
alter table roleta_pix drop constraint if exists roleta_pix_meio_ck;
alter table roleta_pix add constraint roleta_pix_meio_ck check (meio in ('pix', 'usdt'));
alter table roleta_pix add column if not exists usdt_x100 integer;
alter table roleta_pix add column if not exists usdt_rede text;

alter table ampliacao_pix drop constraint if exists ampliacao_pix_provedor_check;
alter table ampliacao_pix drop constraint if exists ampliacao_pix_provedor_ck;
alter table ampliacao_pix add constraint ampliacao_pix_provedor_ck check (provedor in ('lofypay', 'kavropay', 'swytchpay', 'usdt'));
alter table ampliacao_pix add column if not exists meio text not null default 'pix';
alter table ampliacao_pix drop constraint if exists ampliacao_pix_meio_check;
alter table ampliacao_pix drop constraint if exists ampliacao_pix_meio_ck;
alter table ampliacao_pix add constraint ampliacao_pix_meio_ck check (meio in ('pix', 'usdt'));
alter table ampliacao_pix add column if not exists usdt_x100 integer;
alter table ampliacao_pix add column if not exists usdt_rede text;
`;

export const MIGRACOES: readonly Migracao[] = [
  { nome: '0001_init', sql: M0001_INIT },
  { nome: '0002_funcoes', sql: M0002_FUNCOES },
  { nome: '0003_presente_despedida', sql: M0003_PRESENTE },
  { nome: '0004_blindagem_api_rest', sql: M0004_BLINDAGEM },
  { nome: '0005_membros', sql: M0005_MEMBROS },
  { nome: '0006_admin', sql: M0006_ADMIN },
  { nome: '0007_afiliados', sql: M0007_AFILIADOS },
  { nome: '0008_intercambio', sql: M0008_INTERCAMBIO },
  { nome: '0009_painel', sql: M0009_PAINEL },
  { nome: '0010_saques', sql: M0010_SAQUES },
  { nome: '0011_roleta_pix', sql: M0011_ROLETA_PIX },
  { nome: '0012_pagamentos_gateway', sql: M0012_PAGAMENTOS_GATEWAY },
  { nome: '0013_ampliacao_pix', sql: M0013_AMPLIACAO_PIX },
  { nome: '0014_cupom_giros', sql: M0014_CUPOM_GIROS },
  { nome: '0015_saque_taxa', sql: M0015_SAQUE_TAXA },
  { nome: '0016_saque_kavropay', sql: M0016_SAQUE_KAVROPAY },
  { nome: '0017_bonus_saque', sql: M0017_BONUS_SAQUE },
  { nome: '0018_swytchpay', sql: M0018_SWYTCHPAY },
  { nome: '0019_saque_gateway', sql: M0019_SAQUE_GATEWAY },
  { nome: '0020_bonus_cadastro', sql: M0020_BONUS_CADASTRO },
  { nome: '0021_cobranca_usdt', sql: M0021_COBRANCA_USDT },
];

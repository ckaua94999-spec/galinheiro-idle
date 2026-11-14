import { describe, expect, it } from 'vitest';
import { criarBancoEmMemoria } from '@/server/db/banco';
import { MIGRACOES } from '@/server/db/migracoes';

describe('migrations', () => {
  it('aplicam no PGlite e criam as tabelas e funções', async () => {
    const banco = await criarBancoEmMemoria();
    const tabelas = await banco.q<{ t: string }>(`select table_name as t from information_schema.tables where table_schema = 'public' order by 1`);
    expect(tabelas.map((r) => r.t)).toEqual(expect.arrayContaining(['contas', 'players', 'nests', 'entities', 'inventory', 'transactions', 'spins', 'collections', 'idempotency_keys', 'push_assinaturas']));
    const v = await banco.um<{ v: number }>(`select fn_vida(100, '2026-01-01T00:00:00Z', 80, timestamptz '2026-01-01T00:00:00Z' + interval '84 days 9 hours') as v`);
    expect(v?.v).toBeCloseTo(25, 6);
    const t = await banco.um<{ t: string }>(`select fn_tier(75.0001) as t`);
    expect(t?.t).toBe('feliz');
    await banco.fechar();
  });

  it('bloqueiam a API REST automática (papéis anon/authenticated do Supabase)', async () => {
    // Simula um projeto Supabase: papéis da API com acesso padrão a tudo que for criado em public.
    const banco = await criarBancoEmMemoria(async (b) => {
      await b.script(`
        create role anon nologin;
        create role authenticated nologin;
        grant usage on schema public to anon, authenticated;
        alter default privileges in schema public grant all on tables to anon, authenticated;
        alter default privileges in schema public grant all on sequences to anon, authenticated;
        alter default privileges in schema public grant all on functions to anon, authenticated;
      `);
    });
    const semRls = await banco.q<{ t: string }>(`
      select c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(semRls).toEqual([]);

    for (const papel of ['anon', 'authenticated']) {
      await expect(banco.tx(async (c) => {
        await c.q(`set local role ${papel}`);
        return c.q('select * from contas');
      })).rejects.toThrow(/permission denied/);
      await expect(banco.tx(async (c) => {
        await c.q(`set local role ${papel}`);
        return c.q(`select fn_aposentar(gen_random_uuid(), now())`);
      })).rejects.toThrow(/permission denied/);
      await expect(banco.tx(async (c) => {
        await c.q(`set local role ${papel}`);
        return c.q('select * from v_entities_agora');
      })).rejects.toThrow(/permission denied/);
    }

    // O dono (usuário do servidor) continua com acesso normal.
    expect(await banco.q('select * from contas')).toEqual([]);
    expect((await banco.um<{ ok: boolean }>(`select fn_aposentar(gen_random_uuid(), now()) as ok`))?.ok).toBe(false);
    await banco.fechar();
  });

  it('0022 sobre um banco antigo (0001–0021 já aplicadas): codorna, roleta aberta para quem já jogava e PIX pago vira giro', async () => {
    let contaId = '';
    const banco = await criarBancoEmMemoria(async (b) => {
      // aplica até a 0021 numa transação própria (já confirmada), como num banco de produção
      await b.script('create table if not exists schema_migrations (nome text primary key, aplicada_em timestamptz not null default now())');
      await b.tx(async (c) => {
        for (const m of MIGRACOES) {
          if (m.nome === '0022_sem_dinheiro_real') break;
          await c.script(m.sql);
          await c.q('insert into schema_migrations (nome) values ($1)', [m.nome]);
        }
      });
      const conta = (await b.um<{ id: string }>(
        `insert into contas (tipo, email, senha_hash, nome, telefone) values ('email', 'antigo@exemplo.com', 'x', 'Antigo', '+5511999990000') returning id`,
      ))!;
      contaId = conta.id;
      await b.q(`insert into players (id, config_versao, criado_em) values ($1, '1.0.3', now() - interval '10 days')`, [contaId]);
      await b.q(`insert into nests (player_id, slot) select $1, g from generate_series(1, 4) g`, [contaId]);
      await b.q(`insert into inventory (player_id, item) select $1, i from unnest(enum_range(null::item_tipo)) i`, [contaId]);
      for (const [tabela, status, n] of [['roleta_pix', 'pago', 2], ['roleta_pix', 'aguardando', 1], ['ampliacao_pix', 'pago', 1]] as const) {
        for (let i = 0; i < n; i++) {
          await b.q(
            `insert into ${tabela} (player_id, centavos, status, id_transacao, copia_cola, idempotencia, criado_em, atualizado_em, expira_em)
             values ($1, 5500, $2, gen_random_uuid()::text, '000201', gen_random_uuid()::text, now(), now(), now() + interval '1 hour')`,
            [contaId, status],
          );
        }
      }
    });
    const p = (await banco.um<{ giros_gratis: number; nivel_galinheiro: number; liberada: boolean }>(
      'select giros_gratis, nivel_galinheiro, roleta_liberada_em is not null as liberada from players where id = $1',
      [contaId],
    ))!;
    expect(p).toEqual({ giros_gratis: 2, nivel_galinheiro: 2, liberada: true });
    expect((await banco.um<{ n: number }>('select count(*)::int as n from nests where player_id = $1', [contaId]))?.n).toBe(8);
    expect(await banco.q(`select status, count(*)::int as n from roleta_pix group by status order by status`)).toEqual([
      { status: 'expirado', n: 1 },
      { status: 'usado', n: 2 },
    ]);
    // os valores novos dos enums já valem depois da migration
    await banco.q(`insert into inventory (player_id, item) values ($1, 'ovo_codorna') on conflict do nothing`, [contaId]);
    const t = await banco.um<{ ok: boolean }>(`select 'LIBERACAO_ROLETA'::transacao_tipo is not null as ok`);
    expect(t?.ok).toBe(true);
    expect((await banco.um<{ v: string | null }>('select termos_versao as v from contas where id = $1', [contaId]))?.v).toBeNull();
    await banco.fechar();
  });
});

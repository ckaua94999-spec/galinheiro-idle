import { describe, expect, it } from 'vitest';
import { criarBancoEmMemoria } from '@/server/db/banco';

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
});

// Acesso ao PostgreSQL com dois motores:
//  - PGlite (Postgres em WASM, arquivo local) quando DATABASE_URL não está definida — desenvolvimento e testes;
//  - postgres.js quando DATABASE_URL está definida — produção (ex.: Supabase via pooler).
// O resto do servidor só enxerga a interface `Banco`/`Consulta` e escreve SQL puro.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { MIGRACOES } from './migracoes';

export type Linha = Record<string, unknown>;

export interface Consulta {
  q<T = Linha>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  um<T = Linha>(sql: string, params?: readonly unknown[]): Promise<T | null>;
  /** Vários comandos SQL de uma vez, sem parâmetros (usado pelas migrations). */
  script(sql: string): Promise<void>;
}

export interface Banco extends Consulta {
  readonly motor: 'pglite' | 'postgres';
  tx<T>(fn: (c: Consulta) => Promise<T>): Promise<T>;
  fechar(): Promise<void>;
}

// ---------------------------------------------------------------- PGlite
async function criarPglite(dataDir?: string): Promise<Banco> {
  const { PGlite, types } = await import('@electric-sql/pglite');
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const pg = new PGlite({
    dataDir,
    parsers: {
      [types.NUMERIC]: (v: string) => Number(v),
      [types.INT8]: (v: string) => Number(v),
    },
  });
  await pg.waitReady;

  type Exec = Pick<typeof pg, 'query' | 'exec'>;
  const consulta = (ex: Exec): Consulta => ({
    q: async <T,>(sql: string, params?: readonly unknown[]) =>
      (await ex.query<T>(sql, params ? [...params] : undefined)).rows,
    um: async <T,>(sql: string, params?: readonly unknown[]) =>
      (await ex.query<T>(sql, params ? [...params] : undefined)).rows[0] ?? null,
    script: async (sql: string) => {
      await ex.exec(sql);
    },
  });

  return {
    motor: 'pglite',
    ...consulta(pg),
    tx: (fn) => pg.transaction((t) => fn(consulta(t))),
    fechar: () => pg.close(),
  };
}

// ---------------------------------------------------------------- postgres.js
async function criarPostgres(url: string): Promise<Banco> {
  const { default: postgres } = await import('postgres');
  const sql = postgres(url, {
    prepare: false, // obrigatório com pooler em modo transação (Supabase/Supavisor)
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idle_timeout: 20,
    onnotice: () => {},
    types: {
      numeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
      bigint: { to: 20, from: [20], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const consulta = (s: any): Consulta => ({
    q: async <T,>(texto: string, params?: readonly unknown[]) => (await s.unsafe(texto, params ? [...params] : [])) as T[],
    um: async <T,>(texto: string, params?: readonly unknown[]) =>
      ((await s.unsafe(texto, params ? [...params] : [])) as T[])[0] ?? null,
    script: async (texto: string) => {
      await s.unsafe(texto);
    },
  });

  return {
    motor: 'postgres',
    ...consulta(sql),
    tx: async <T,>(fn: (c: Consulta) => Promise<T>) => (await sql.begin((t) => fn(consulta(t)))) as T,
    fechar: () => sql.end({ timeout: 5 }),
  };
}

// ---------------------------------------------------------------- migrations
export async function migrar(banco: Banco): Promise<string[]> {
  await banco.script(`
    create table if not exists schema_migrations (
      nome text primary key,
      aplicada_em timestamptz not null default now()
    );
  `);
  return banco.tx(async (c) => {
    await c.q('select pg_advisory_xact_lock(424242)'); // evita duas instâncias migrando juntas
    const feitas = new Set((await c.q<{ nome: string }>('select nome from schema_migrations')).map((r) => r.nome));
    const aplicadas: string[] = [];
    for (const m of MIGRACOES) {
      if (feitas.has(m.nome)) continue;
      await c.script(m.sql);
      await c.q('insert into schema_migrations (nome) values ($1)', [m.nome]);
      aplicadas.push(m.nome);
    }
    return aplicadas;
  });
}

// ---------------------------------------------------------------- singleton
const CHAVE = Symbol.for('galinheiro.banco');
const CHAVE_MIGRADAS = Symbol.for('galinheiro.banco.migradas');
type GlobalComBanco = typeof globalThis & { [CHAVE]?: Promise<Banco>; [CHAVE_MIGRADAS]?: Set<string> };

function dirPglite(): string {
  return process.env.PGLITE_DIR ?? path.join(process.cwd(), '.data', 'pglite');
}

async function aplicarPendentes(banco: Banco): Promise<Banco> {
  const aplicadas = await migrar(banco);
  if (aplicadas.length) console.info(`[banco] ${banco.motor}: migrations aplicadas: ${aplicadas.join(', ')}`);
  return banco;
}

async function iniciar(): Promise<Banco> {
  const url = process.env.DATABASE_URL;
  return aplicarPendentes(url ? await criarPostgres(url) : await criarPglite(dirPglite()));
}

/**
 * Banco compartilhado pelo processo (sobrevive ao hot reload do Next em desenvolvimento). Se o hot reload
 * trouxer migrations novas para um banco já aberto, elas são aplicadas na próxima chamada (antes, o servidor
 * de desenvolvimento seguia com o esquema antigo até reiniciar — ex.: "column telefone does not exist").
 */
export function obterBanco(): Promise<Banco> {
  const g = globalThis as GlobalComBanco;
  const migradas = (g[CHAVE_MIGRADAS] ??= new Set());
  const novas = MIGRACOES.some((m) => !migradas.has(m.nome));
  for (const m of MIGRACOES) migradas.add(m.nome);
  const falhou = (erro: unknown) => {
    g[CHAVE] = undefined;
    g[CHAVE_MIGRADAS] = undefined;
    throw erro;
  };
  if (!g[CHAVE]) g[CHAVE] = iniciar().catch(falhou);
  else if (novas) g[CHAVE] = g[CHAVE].then(aplicarPendentes).catch(falhou);
  return g[CHAVE];
}

/** Banco em memória, já migrado (testes). `antes` roda antes das migrations (ex.: simular papéis do Supabase). */
export async function criarBancoEmMemoria(antes?: (b: Banco) => Promise<void>): Promise<Banco> {
  const banco = await criarPglite(undefined);
  if (antes) await antes(banco);
  await migrar(banco);
  return banco;
}

/** Testes: faz as rotas usarem um banco específico. */
export function usarBancoNosTestes(banco: Banco): void {
  (globalThis as GlobalComBanco)[CHAVE] = Promise.resolve(banco);
}

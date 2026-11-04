// Conta demo para desenvolvimento (capturas de tela e revisão visual). NÃO existe em produção.
// GET /dev/demo?para=/loja        → entra na conta demo (criada uma vez, guardada em .data/demo.json) e redireciona
// GET /dev/demo?para=/loja&nova=1 → recria a conta demo do zero
// GET /dev/demo?para=/admin&admin=1 → a conta demo vira administradora (para ver o painel)
// Atenção: troca o cookie de sessão do navegador que abrir esta URL — use só em navegador separado/headless.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Tipo } from '@galinheiro/game-core';
import { NextResponse, type NextRequest } from 'next/server';
import { cadastrarMembro, ehMembro } from '@/server/auth/contas';
import { conexaoSegura, cookieDeSessao, emitirToken } from '@/server/auth/sessao';
import { obterBanco, type Consulta } from '@/server/db/banco';
import { creditarOvos, criarAnimal, incrementarVersao, movimentarSaldo } from '@/server/dominio/repo';
import { agoraMs } from '@/server/relogio';
import { rngServidor } from '@/server/rng';

export const dynamic = 'force-dynamic';

const ARQUIVO = path.join(process.cwd(), '.data', 'demo.json');
const NIVEL = 4; // 16 ninhos

// slot → espécie, vida e horas até o próximo rendimento (0 = pronto)
const ANIMAIS: { slot: number; tipo: Tipo; vida: number; faltaH: number; nome?: string }[] = [
  { slot: 2, tipo: 'pato', vida: 96, faltaH: 0 },
  { slot: 3, tipo: 'ganso', vida: 88, faltaH: 5.5 },
  { slot: 4, tipo: 'avestruz', vida: 99, faltaH: 0 },
  { slot: 5, tipo: 'galinha', vida: 64, faltaH: 2.2 },
  { slot: 6, tipo: 'pato', vida: 58, faltaH: 0 },
  { slot: 7, tipo: 'galinha', vida: 41, faltaH: 9 },
  { slot: 8, tipo: 'ganso', vida: 33, faltaH: 0.4 },
  { slot: 9, tipo: 'galinha', vida: 17, faltaH: 14 },
  { slot: 10, tipo: 'avestruz', vida: 22, faltaH: 0 },
  { slot: 12, tipo: 'galinha', vida: 79, faltaH: 18 },
];

async function semear(c: Consulta, id: string, agora: number): Promise<void> {
  const d = (ms: number) => new Date(ms);
  await c.q('update players set nivel_galinheiro = $2, tutorial_etapa = 8 where id = $1', [id, NIVEL]);
  await c.q(
    'insert into nests (player_id, slot, criado_em) select $1, g, $2 from generate_series(5, $3::int) g on conflict do nothing',
    [id, d(agora), NIVEL * 4],
  );
  await movimentarSaldo(c, id, 123_400, 'AJUSTE_SUPORTE', { motivo: 'conta demo (dev)' }, agora);
  await creditarOvos(c, id, 'ovo_galinha', 23, agora);
  await creditarOvos(c, id, 'ovo_pato', 8, agora);
  await creditarOvos(c, id, 'ovo_ganso', 3, agora);
  await creditarOvos(c, id, 'ovo_avestruz', 1, agora);
  for (const a of ANIMAIS) {
    const e = await criarAnimal(c, id, a.tipo, a.slot, agora, rngServidor, 'ROLETA');
    await c.q(
      `update entities set vida_ancora = $2, vida_ancora_em = $3, proximo_rendimento = $4,
              ciclo_inicio = least(ciclo_inicio, $4::timestamptz - interval '24 hours')
        where id = $1`,
      [e.id, a.vida, d(agora), d(agora + a.faltaH * 3_600_000)],
    );
  }
  // Um aposentado para a aba "Aposentados" da Coleção (já marcado como visto, para não abrir o aviso).
  const velho = await criarAnimal(c, id, 'pato', 16, agora - 91 * 86_400_000, rngServidor, 'ROLETA');
  await c.q('select fn_aposentar($1, $2)', [velho.id, d(agora)]);
  await c.q('update players set aposentadorias_vistas_ate = $2 where id = $1', [id, d(agora + 1000)]);
  await incrementarVersao(c, id, agora);
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') return new NextResponse('Not found', { status: 404 });
  const para = req.nextUrl.searchParams.get('para') ?? '/galinheiro';
  const destino = para.startsWith('/') && !para.startsWith('//') ? para : '/galinheiro';
  const banco = await obterBanco();
  const agora = agoraMs();

  let contaId: string | null = null;
  if (req.nextUrl.searchParams.get('nova') !== '1' && existsSync(ARQUIVO)) {
    contaId = (JSON.parse(readFileSync(ARQUIVO, 'utf8')) as { contaId: string }).contaId;
  }
  const salva = contaId
    ? await banco.um<{ id: string; sessao_versao: number; tipo: string; nome: string | null; telefone: string | null }>(
        'select id, sessao_versao, tipo, nome, telefone from contas where id = $1',
        [contaId],
      )
    : null;
  // contas demo antigas (de convidado) não abrem mais sessão: cria um membro novo
  let conta = salva && ehMembro(salva) ? salva : null;
  if (!conta) {
    const nova = await cadastrarMembro(
      banco,
      {
        nome: 'Conta Demo',
        telefone: `+55119${String(rngServidor.int(100_000_000)).padStart(8, '0')}`,
        email: `demo-${randomUUID().slice(0, 8)}@galinheiro.dev`,
        senha: randomUUID(),
      },
      agora,
      rngServidor,
    );
    await banco.tx((c) => semear(c, nova.contaId, agora));
    conta = { id: nova.contaId, sessao_versao: nova.versao, tipo: 'email', nome: 'Conta Demo', telefone: '' };
    mkdirSync(path.dirname(ARQUIVO), { recursive: true });
    writeFileSync(ARQUIVO, JSON.stringify({ contaId: conta.id }, null, 2), 'utf8');
  }

  if (req.nextUrl.searchParams.get('admin') === '1') {
    await banco.q(`update contas set papel = 'admin' where id = $1`, [conta.id]);
  }

  const resp = NextResponse.redirect(new URL(destino, req.url));
  resp.headers.append('Set-Cookie', cookieDeSessao(await emitirToken(conta.id, conta.sessao_versao), conexaoSegura(req)));
  resp.headers.set('Cache-Control', 'no-store');
  return resp;
}

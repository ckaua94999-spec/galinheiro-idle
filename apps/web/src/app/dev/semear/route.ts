// Dados fictícios para o painel administrador (só desenvolvimento): membros com cadastros espalhados nos
// últimos dias, boa parte vinda por convite de quem já estava (rede de afiliados), atividade diária, coletas,
// vendas (com as comissões da rede) e gastos — saldo sempre consistente com o extrato — e algumas conversas de
// atendimento. GET /dev/semear?membros=25&dias=45 (pode chamar de novo para somar mais).
// &convite=CODIGO pendura a rede nova embaixo desse membro (ex.: a conta demo, para ver a tela de convites).
import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { cadastrarMembro } from '@/server/auth/contas';
import { obterBanco } from '@/server/db/banco';
import { pagarComissoesDeVenda } from '@/server/dominio/afiliados';
import { creditarOvos, movimentarSaldo } from '@/server/dominio/repo';
import { agoraMs } from '@/server/relogio';
import { rngServidor } from '@/server/rng';

export const dynamic = 'force-dynamic';

const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Heitor', 'Iara', 'João', 'Kátia', 'Lucas', 'Marina', 'Nicolas', 'Olívia', 'Paulo', 'Rafa', 'Sofia', 'Tiago', 'Vera'];
const SOBRENOMES = ['Silva', 'Souza', 'Costa', 'Lima', 'Rocha', 'Alves', 'Pereira', 'Gomes', 'Ribeiro', 'Martins'];
const DDDS = [11, 21, 31, 41, 51, 61, 71, 81, 85, 92];
const PERGUNTAS = [
  'Meus ovos não apareceram depois da coleta.',
  'Como faço para ampliar o galinheiro?',
  'A roleta travou no meio do giro, perdi as moedas?',
  'Quero trocar o meu telefone de cadastro.',
  'Ganhei um avestruz! Ela bota mais ovos?',
];
const H = 3_600_000;
const D = 24 * H;

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') return new NextResponse('Not found', { status: 404 });
  const membros = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('membros') ?? 25)));
  const dias = Math.min(180, Math.max(3, Number(req.nextUrl.searchParams.get('dias') ?? 45)));
  const banco = await obterBanco();
  const agora = agoraMs();
  const sorte = (n: number) => Math.floor(Math.random() * n);
  let criados = 0;
  const rede: { id: string; t0: number; codigo: string }[] = [];
  const raiz = req.nextUrl.searchParams.get('convite')?.trim().toUpperCase();
  if (raiz) rede.push({ id: '', t0: -Infinity, codigo: raiz });

  for (let i = 0; i < membros; i++) {
    // mais cadastros nos dias recentes (crescimento)
    const diasAtras = Math.floor(dias * Math.random() ** 1.6);
    const t0 = agora - diasAtras * D - sorte(10) * H;
    const nome = `${NOMES[sorte(NOMES.length)]} ${SOBRENOMES[sorte(SOBRENOMES.length)]}`;
    const usuario = nome.split(' ')[0]!.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    // ~65% chegam por convite de alguém que se cadastrou antes
    const antes = rede.filter((r) => r.t0 < t0);
    const convidou = antes.length && Math.random() < (raiz ? 0.95 : 0.65) ? antes[sorte(antes.length)]! : null;
    let contaId: string;
    try {
      contaId = (
        await cadastrarMembro(
          banco,
          {
            nome,
            telefone: `+55${DDDS[sorte(DDDS.length)]}9${String(10_000_000 + sorte(89_999_999))}`,
            email: `${usuario}.${randomUUID().slice(0, 6)}@exemplo.com`,
            senha: randomUUID(),
            convite: convidou?.codigo,
          },
          t0,
          rngServidor,
        )
      ).contaId;
    } catch {
      continue; // telefone sorteado repetido: pula
    }
    criados++;
    const codigo = (await banco.um<{ convite_codigo: string }>('select convite_codigo from contas where id = $1', [contaId]))!.convite_codigo;
    rede.push({ id: contaId, t0, codigo });

    await banco.tx(async (c) => {
      let ultimo = t0;
      for (let d = 0; d <= diasAtras; d++) {
        const t = t0 + d * D + sorte(8) * H;
        if (t > agora) break;
        if (Math.random() < 0.35) continue; // não jogou neste dia
        if (d > 3 && Math.random() < 0.04) break; // abandonou
        ultimo = t;
        await c.q(
          `insert into atividade_diaria (conta_id, dia) values ($1, (($2::timestamptz at time zone 'UTC') - interval '3 hours')::date) on conflict do nothing`,
          [contaId, new Date(t)],
        );
        const ovos = 1 + sorte(5);
        await c.q(
          `insert into collections (player_id, origem, coletado_em, total_ovos, por_item, detalhes) values ($1, 'INDIVIDUAL', $2, $3, $4::jsonb, '[]'::jsonb)`,
          [contaId, new Date(t), ovos, JSON.stringify({ ovo_galinha: ovos })],
        );
        await creditarOvos(c, contaId, 'ovo_galinha', ovos, t);
        if (Math.random() < 0.7) {
          await c.q(
            `update inventory set quantidade = quantidade - $2, total_vendido = total_vendido + $2 where player_id = $1 and item = 'ovo_galinha'`,
            [contaId, ovos],
          );
          await movimentarSaldo(c, contaId, ovos * 120, 'VENDA_OVOS', { itens: { ovo_galinha: ovos }, precosX100: { ovo_galinha: 120 } }, t + 60_000);
          await pagarComissoesDeVenda(c, contaId, ovos * 120, t + 60_000);
        }
        const saldo = Number((await c.um<{ m: unknown }>('select moedas_x100 as m from players where id = $1', [contaId]))!.m);
        if (saldo >= 4000 && Math.random() < 0.3) {
          await movimentarSaldo(c, contaId, -4000, 'GIRO_ROLETA', { semeado: true }, t + 120_000);
        }
      }
      await c.q('update players set ultimo_acesso_em = $2 where id = $1', [contaId, new Date(ultimo)]);
      if (Math.random() < 0.25) {
        const tMsg = agora - sorte(48) * H;
        const conv = (await c.um<{ id: string }>(
          `insert into suporte_conversas (conta_id, status, nao_lidas_admin, ultima_mensagem_em, criado_em, atualizado_em)
           values ($1, 'aberta', 1, $2, $2, $2) returning id`,
          [contaId, new Date(tMsg)],
        ))!;
        await c.q(`insert into suporte_mensagens (conversa_id, autor, texto, criado_em) values ($1, 'jogador', $2, $3)`, [
          conv.id, PERGUNTAS[sorte(PERGUNTAS.length)], new Date(tMsg),
        ]);
      }
    });
  }
  return NextResponse.json({ ok: true, criados });
}

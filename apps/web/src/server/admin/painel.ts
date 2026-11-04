// Visão geral do painel: números do dia e séries históricas com projeções (pessoas, ovos e moedas).
// Dias no horário de Brasília (UTC−3 fixo), os mesmos da atividade diária. Tudo conta só MEMBROS (contas
// antigas de convidado, que não entram mais no jogo, ficam de fora das pessoas e da economia).
import type { AdminGraficosDTO, AdminResumoDTO, SerieDTO } from '@galinheiro/api-contract';
import type { Tipo } from '@galinheiro/game-core';
import type { Consulta } from '../db/banco';
import {
  acumularProjecao, diaBr, potencialDeOvos, projetarSaldo, projetarTendencia, somarDias, type AnimalParaProjecao,
} from './projecoes';

/** Expressão SQL do dia (Brasília) de uma coluna timestamptz. */
export const diaSql = (col: string) => `((${col} at time zone 'UTC') - interval '3 hours')::date`;
/** Contas que são membros completos (só elas contam como pessoas e como ativas; o alias da tabela é `c`). */
export const MEMBRO = `c.tipo = 'email' and c.nome is not null and c.telefone is not null`;

const n = (v: unknown): number => Number(v ?? 0);

export async function resumo(c: Consulta, agoraMs: number): Promise<AdminResumoDTO> {
  const hoje = diaBr(agoraMs);
  const d7 = somarDias(hoje, -6);
  const d30 = somarDias(hoje, -29);
  const agora = new Date(agoraMs);
  const p = (await c.um<Record<string, unknown>>(
    `select count(*) filter (where ${MEMBRO}) as membros,
            count(*) filter (where ${MEMBRO} and ${diaSql('c.criado_em')} = $1::date) as novos_hoje,
            count(*) filter (where ${MEMBRO} and ${diaSql('c.criado_em')} >= $2::date) as novos_7d,
            count(*) filter (where c.bloqueado_em is not null) as bloqueados,
            count(*) filter (where c.papel = 'admin') as admins
       from contas c`,
    [hoje, d7],
  ))!;
  const a = (await c.um<Record<string, unknown>>(
    `select count(distinct a.conta_id) filter (where a.dia = $1::date) as hoje,
            count(distinct a.conta_id) filter (where a.dia >= $2::date) as d7,
            count(distinct a.conta_id) as d30
       from atividade_diaria a join contas c on c.id = a.conta_id
      where a.dia >= $3::date and ${MEMBRO}`,
    [hoje, d7, d30],
  ))!;
  const m = (await c.um<Record<string, unknown>>(
    `select (select coalesce(sum(p.moedas_x100), 0) from players p join contas c on c.id = p.id where ${MEMBRO}) as circulacao,
            coalesce(sum(t.valor_x100) filter (where t.valor_x100 > 0), 0) as emitidas,
            coalesce(sum(-t.valor_x100) filter (where t.valor_x100 < 0), 0) as gastas
       from transactions t join contas c on c.id = t.player_id
      where ${diaSql('t.criado_em')} = $1::date and ${MEMBRO}`,
    [hoje],
  ))!;
  const o = (await c.um<Record<string, unknown>>(
    `select (select coalesce(sum(i.quantidade), 0) from inventory i join contas c on c.id = i.player_id where ${MEMBRO}) as estoque,
            (select coalesce(sum(k.total_ovos), 0) from collections k join contas c on c.id = k.player_id
              where ${diaSql('k.coletado_em')} = $1::date and ${MEMBRO}) as coletados,
            (select count(*) from spins s join contas c on c.id = s.player_id where ${diaSql('s.criado_em')} = $1::date and ${MEMBRO}) as giros`,
    [hoje],
  ))!;
  const animais = { galinha: 0, pato: 0, ganso: 0, avestruz: 0 } as Record<Tipo, number>;
  for (const l of await c.q<{ tipo: Tipo; n: unknown }>(
    `select e.tipo, count(*) as n from entities e join contas c on c.id = e.player_id where e.status = 'ativo' and ${MEMBRO} group by e.tipo`,
  )) {
    animais[l.tipo] = n(l.n);
  }
  const s = (await c.um<Record<string, unknown>>(
    `select count(*) filter (where status = 'aberta') as abertas, coalesce(sum(nao_lidas_admin), 0) as nao_lidas from suporte_conversas`,
  ))!;
  const pop = (await c.um<{ n: unknown }>(
    `select count(*) as n from popups where ativo and inicio <= $1 and (fim is null or fim > $1)`,
    [agora],
  ))!;
  return {
    hoje,
    pessoas: {
      membros: n(p.membros),
      novosHoje: n(p.novos_hoje),
      novos7d: n(p.novos_7d),
      ativosHoje: n(a.hoje),
      ativos7d: n(a.d7),
      ativos30d: n(a.d30),
      bloqueados: n(p.bloqueados),
      admins: n(p.admins),
    },
    economia: {
      moedasCirculacaoX100: n(m.circulacao),
      emitidasHojeX100: n(m.emitidas),
      gastasHojeX100: n(m.gastas),
      ovosEstoque: n(o.estoque),
      ovosColetadosHoje: n(o.coletados),
      girosHoje: n(o.giros),
      animaisAtivos: animais,
    },
    suporte: { abertas: n(s.abertas), naoLidas: n(s.nao_lidas) },
    popupsAtivos: n(pop.n),
  };
}

/** Série diária completa (dias sem dado = 0) entre `de` e `ate`, a partir de uma consulta (dia, v). */
async function serieDiaria(c: Consulta, de: string, ate: string, subconsulta: string, params: unknown[] = []): Promise<SerieDTO[]> {
  const linhas = await c.q<{ dia: string; valor: unknown }>(
    `with dias as (select generate_series($1::date, $2::date, interval '1 day')::date as dia)
     select to_char(d.dia, 'YYYY-MM-DD') as dia, coalesce(x.v, 0) as valor
       from dias d left join (${subconsulta}) x on x.dia = d.dia
      order by d.dia`,
    [de, ate, ...params],
  );
  return linhas.map((l) => ({ dia: l.dia, valor: n(l.valor) }));
}

function acumular(inicial: number, serie: SerieDTO[]): SerieDTO[] {
  let v = inicial;
  return serie.map((p) => ({ dia: p.dia, valor: (v += p.valor) }));
}

export async function graficos(c: Consulta, agoraMs: number, dias: number, projecao: number): Promise<AdminGraficosDTO> {
  const hoje = diaBr(agoraMs);
  const de = somarDias(hoje, -(dias - 1));

  // pessoas
  const novos = await serieDiaria(c, de, hoje, `select ${diaSql('c.criado_em')} as dia, count(*) as v from contas c where ${MEMBRO} group by 1`);
  const antes = (await c.um<{ n: unknown }>(`select count(*) as n from contas c where ${MEMBRO} and ${diaSql('c.criado_em')} < $1::date`, [de]))!;
  const total = acumular(n(antes.n), novos);
  const ativos = await serieDiaria(
    c, de, hoje,
    `select a.dia, count(*) as v from atividade_diaria a join contas c on c.id = a.conta_id where ${MEMBRO} group by a.dia`,
  );
  const projecaoNovos = projetarTendencia(novos, projecao);

  // ovos
  const produzidos = await serieDiaria(
    c, de, hoje,
    `select ${diaSql('k.coletado_em')} as dia, sum(k.total_ovos) as v
       from collections k join contas c on c.id = k.player_id where ${MEMBRO} group by 1`,
  );
  const vendidos = await serieDiaria(
    c, de, hoje,
    `select ${diaSql('t.criado_em')} as dia,
            sum((select coalesce(sum(value::int), 0) from jsonb_each_text(t.detalhes -> 'itens'))) as v
       from transactions t join contas c on c.id = t.player_id where t.tipo = 'VENDA_OVOS' and ${MEMBRO} group by 1`,
  );
  const animais = (await c.q<{
    tipo: Tipo; vida_ancora: number; vida_ancora_em: Date; fator_decaimento_pct: number; expiracao: Date; proximo_rendimento: Date; ovos_pendentes: number;
  }>(
    // só animais de membros que podem jogar (bloqueados não coletam)
    `select e.tipo, e.vida_ancora, e.vida_ancora_em, e.fator_decaimento_pct, e.expiracao, e.proximo_rendimento, e.ovos_pendentes
       from entities e join contas c on c.id = e.player_id
      where e.status = 'ativo' and ${MEMBRO} and c.bloqueado_em is null`,
  )).map<AnimalParaProjecao>((l) => ({
    tipo: l.tipo,
    vidaAncora: n(l.vida_ancora),
    vidaAncoraEmMs: new Date(l.vida_ancora_em).getTime(),
    fatorPct: n(l.fator_decaimento_pct),
    expiracaoMs: new Date(l.expiracao).getTime(),
    proximoRendimentoMs: new Date(l.proximo_rendimento).getTime(),
    ovosPendentes: n(l.ovos_pendentes),
  }));
  // potencial a partir de amanhã (hoje já está, em parte, no histórico)
  const potencial = potencialDeOvos(animais, agoraMs, projecao).slice(1);

  // moedas
  const movimento = (filtro: string) =>
    `select ${diaSql('t.criado_em')} as dia, sum(${filtro === '>' ? '' : '-'}t.valor_x100) as v
       from transactions t join contas c on c.id = t.player_id where t.valor_x100 ${filtro} 0 and ${MEMBRO} group by 1`;
  const emitidas = await serieDiaria(c, de, hoje, movimento('>'));
  const gastas = await serieDiaria(c, de, hoje, movimento('<'));
  const saldoAntes = (await c.um<{ n: unknown }>(
    `select coalesce(sum(t.valor_x100), 0) as n from transactions t join contas c on c.id = t.player_id
      where ${diaSql('t.criado_em')} < $1::date and ${MEMBRO}`,
    [de],
  ))!;
  const circulacao = acumular(n(saldoAntes.n), emitidas.map((e, i) => ({ dia: e.dia, valor: e.valor - (gastas[i]?.valor ?? 0) })));
  const projecaoEmitidas = projetarTendencia(emitidas, projecao);
  const projecaoGastas = projetarTendencia(gastas, projecao);

  return {
    geradoEm: new Date(agoraMs).toISOString(),
    pessoas: {
      novos,
      total,
      ativos,
      projecaoNovos,
      projecaoTotal: acumularProjecao(total[total.length - 1]?.valor ?? 0, projecaoNovos),
      projecaoAtivos: projetarTendencia(ativos, projecao),
    },
    ovos: {
      produzidos,
      vendidos,
      projecaoTendencia: projetarTendencia(produzidos, projecao),
      projecaoPotencial: potencial.map((p) => ({ dia: p.dia, valor: Math.round(p.ovos * 10) / 10 })),
    },
    moedas: {
      emitidasX100: emitidas,
      gastasX100: gastas,
      circulacaoX100: circulacao,
      projecaoEmitidasX100: projecaoEmitidas,
      projecaoGastasX100: projecaoGastas,
      projecaoCirculacaoX100: projetarSaldo(circulacao[circulacao.length - 1]?.valor ?? 0, projecaoEmitidas, projecaoGastas),
      potencialEmissaoX100: potencial.map((p) => ({ dia: p.dia, valor: p.valorX100 })),
    },
  };
}

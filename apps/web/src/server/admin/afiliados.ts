// Painel: rede de afiliados (quem convidou quem, ranking, comissões pagas, rede de um membro) e as taxas do
// programa. Tudo em moedas do jogo. Mudar as taxas fica na auditoria.
import type { AdminAfiliadoLinhaDTO, AdminAfiliadosDTO, AdminRedeDTO, AdminUsuarioDetalheDTO, ConfigAfiliadosDTO } from '@galinheiro/api-contract';
import type { Consulta } from '../db/banco';
import {
  NIVEIS_MAX, SELECT_COMISSAO, contarRede, lerConfigAfiliados, paraComissaoDTO, type LinhaComissao,
} from '../dominio/afiliados';
import { iso } from '../dominio/linhas';
import { ErroDominio } from '../erros';
import { auditar } from './acesso';
import { MEMBRO, diaSql } from './painel';
import { diaBr, somarDias } from './projecoes';
import { exigirSemLucroComComissao } from './intercambio';

const n = (v: unknown): number => Number(v ?? 0);

/** Pares (ancestral, descendente, distância) até NIVEIS_MAX — base do ranking por tamanho de rede. */
const PARES = `
  with recursive pares (anc, des, prof) as (
    select indicado_por, id, 1 from contas where indicado_por is not null
    union all
    select c.indicado_por, p.des, p.prof + 1 from pares p join contas c on c.id = p.anc
     where c.indicado_por is not null and p.prof < ${NIVEIS_MAX}
  )`;

export async function resumoAfiliados(
  c: Consulta, agoraMs: number, dias: number, ordenar: 'rede' | 'diretos' | 'comissoes',
): Promise<AdminAfiliadosDTO> {
  const config = await lerConfigAfiliados(c);
  const atualizado = await c.um<{ atualizado_em: Date }>('select atualizado_em from afiliados_config where id = 1');
  const hoje = diaBr(agoraMs);
  const de = somarDias(hoje, -(dias - 1));
  const desde = new Date(Date.parse(`${de}T03:00:00Z`)); // 00:00 de Brasília do 1º dia
  const t = (await c.um<Record<string, unknown>>(
    `select count(*) filter (where ${MEMBRO}) as membros,
            count(*) filter (where ${MEMBRO} and c.indicado_por is not null) as indicados,
            (select count(distinct i.indicado_por) from contas i where i.indicado_por is not null) as indicadores,
            (select coalesce(sum(valor_x100), 0) from comissoes where criado_em >= $1) as periodo,
            (select coalesce(sum(valor_x100), 0) from comissoes) as total,
            (select count(distinct beneficiario_id) from comissoes where criado_em >= $1) as beneficiarios
       from contas c`,
    [desde],
  ))!;
  const porNivel = await c.q<{ nivel: unknown; valor: unknown; beneficiarios: unknown }>(
    `select nivel, sum(valor_x100) as valor, count(distinct beneficiario_id) as beneficiarios
       from comissoes where criado_em >= $1 group by nivel order by nivel`,
    [desde],
  );
  const serie = await c.q<{ dia: string; cadastros: unknown; indicados: unknown; comissoes: unknown }>(
    `with dias as (select generate_series($1::date, $2::date, interval '1 day')::date as dia)
     select to_char(d.dia, 'YYYY-MM-DD') as dia, coalesce(k.cadastros, 0) as cadastros,
            coalesce(k.indicados, 0) as indicados, coalesce(m.valor, 0) as comissoes
       from dias d
       left join (select ${diaSql('c.criado_em')} as dia, count(*) as cadastros,
                         count(*) filter (where c.indicado_por is not null) as indicados
                    from contas c where ${MEMBRO} group by 1) k on k.dia = d.dia
       left join (select ${diaSql('criado_em')} as dia, sum(valor_x100) as valor from comissoes group by 1) m on m.dia = d.dia
      order by d.dia`,
    [de, hoje],
  );
  const ordem = { rede: 'rede desc, diretos desc', diretos: 'diretos desc, rede desc', comissoes: 'periodo desc, total desc' }[ordenar];
  const ranking = await c.q<{
    id: string; nome: string; email: string; convite_codigo: string | null; diretos: unknown; rede: unknown; periodo: unknown; total: unknown;
  }>(
    `${PARES},
     redes as (select anc as id, count(*) filter (where prof = 1) as diretos, count(*) as rede from pares group by anc),
     ganhos as (select beneficiario_id as id, coalesce(sum(valor_x100) filter (where criado_em >= $1), 0) as periodo,
                       sum(valor_x100) as total
                  from comissoes group by beneficiario_id)
     select c.id, c.nome, c.email, c.convite_codigo, coalesce(r.diretos, 0) as diretos, coalesce(r.rede, 0) as rede,
            coalesce(g.periodo, 0) as periodo, coalesce(g.total, 0) as total
       from contas c
       left join redes r on r.id = c.id
       left join ganhos g on g.id = c.id
      where ${MEMBRO} and (r.id is not null or g.id is not null)
      order by ${ordem}, c.nome
      limit 20`,
    [desde],
  );
  return {
    config,
    configAtualizadaEm: iso(atualizado?.atualizado_em ?? new Date(agoraMs)),
    totais: {
      membros: n(t.membros),
      indicados: n(t.indicados),
      indicadores: n(t.indicadores),
      comissoesPeriodoX100: n(t.periodo),
      comissoesTotalX100: n(t.total),
      beneficiariosPeriodo: n(t.beneficiarios),
    },
    porNivel: porNivel.map((l) => ({ nivel: n(l.nivel), valorX100: n(l.valor), beneficiarios: n(l.beneficiarios) })),
    serie: serie.map((l) => ({ dia: l.dia, cadastros: n(l.cadastros), indicados: n(l.indicados), comissoesX100: n(l.comissoes) })),
    ranking: ranking.map<AdminAfiliadoLinhaDTO>((l) => ({
      id: l.id,
      nome: l.nome,
      email: l.email,
      codigo: l.convite_codigo,
      diretos: n(l.diretos),
      rede: n(l.rede),
      comissoesPeriodoX100: n(l.periodo),
      comissoesTotalX100: n(l.total),
    })),
  };
}

/** Rede de um membro: quem está acima, quantos em cada nível abaixo, os diretos e as comissões. */
export async function redeDoMembro(c: Consulta, id: string): Promise<AdminRedeDTO> {
  const conta = await c.um<{ id: string; nome: string; email: string; convite_codigo: string | null; criado_em: Date; indicado_em: Date | null }>(
    `select c.id, c.nome, c.email, c.convite_codigo, c.criado_em, c.indicado_em from contas c where c.id = $1 and ${MEMBRO}`,
    [id],
  );
  if (!conta) throw new ErroDominio('NAO_ENCONTRADO', undefined, 'Usuário não encontrado.');
  const acima = await c.q<{ id: string; nome: string; nivel: unknown }>(
    `with recursive acima (id, nivel) as (
       select indicado_por, 1 from contas where id = $1 and indicado_por is not null
       union all
       select c.indicado_por, a.nivel + 1 from acima a join contas c on c.id = a.id
        where c.indicado_por is not null and a.nivel < 10
     )
     select a.id, c.nome, a.nivel from acima a join contas c on c.id = a.id order by a.nivel`,
    [id],
  );
  const diretos = await c.q<{
    id: string; nome: string; email: string; criado_em: Date; ultimo_acesso_em: Date | null; bloqueado_em: Date | null; diretos: unknown; rendeu: unknown;
  }>(
    `select c.id, c.nome, c.email, c.criado_em, p.ultimo_acesso_em, c.bloqueado_em,
            (select count(*) from contas f where f.indicado_por = c.id) as diretos,
            (select coalesce(sum(k.valor_x100), 0) from comissoes k where k.beneficiario_id = $1 and k.origem_conta_id = c.id) as rendeu
       from contas c left join players p on p.id = c.id
      where c.indicado_por = $1
      order by c.criado_em desc
      limit 200`,
    [id],
  );
  const k = (await c.um<{ recebidas: unknown; geradas: unknown }>(
    `select (select coalesce(sum(valor_x100), 0) from comissoes where beneficiario_id = $1) as recebidas,
            (select coalesce(sum(valor_x100), 0) from comissoes where origem_conta_id = $1) as geradas`,
    [id],
  ))!;
  const ultimas = await c.q<LinhaComissao>(`${SELECT_COMISSAO} where k.beneficiario_id = $1 order by k.criado_em desc, k.id desc limit 20`, [id]);
  return {
    conta: {
      id: conta.id,
      nome: conta.nome,
      email: conta.email,
      codigo: conta.convite_codigo,
      criadoEm: iso(conta.criado_em),
      indicadoEm: conta.indicado_em ? iso(conta.indicado_em) : null,
    },
    acima: acima.map((l) => ({ id: l.id, nome: l.nome, nivel: n(l.nivel) })),
    niveis: await contarRede(c, id, NIVEIS_MAX),
    diretos: diretos.map((l) => ({
      id: l.id,
      nome: l.nome,
      email: l.email,
      criadoEm: iso(l.criado_em),
      ultimoAcessoEm: l.ultimo_acesso_em ? iso(l.ultimo_acesso_em) : null,
      bloqueado: !!l.bloqueado_em,
      diretos: n(l.diretos),
      rendeuX100: n(l.rendeu),
    })),
    comissoes: { recebidasX100: n(k.recebidas), geradasX100: n(k.geradas) },
    ultimas: ultimas.map(paraComissaoDTO),
  };
}

/** Bloco "Afiliação" da ficha do usuário. */
export async function afiliacaoDe(c: Consulta, id: string): Promise<AdminUsuarioDetalheDTO['afiliacao']> {
  const l = await c.um<{ codigo: string | null; bonus_link: unknown; bonus_geral: unknown; ind_id: string | null; ind_nome: string | null }>(
    `select c.convite_codigo as codigo, c.bonus_link_x100 as bonus_link,
            (select bonus_geral_x100 from afiliados_config where id = 1) as bonus_geral,
            i.id as ind_id, i.nome as ind_nome
       from contas c left join contas i on i.id = c.indicado_por where c.id = $1`,
    [id],
  );
  const rede = await contarRede(c, id, NIVEIS_MAX);
  const k = await c.um<{ s: unknown }>('select coalesce(sum(valor_x100), 0) as s from comissoes where beneficiario_id = $1', [id]);
  return {
    codigo: l?.codigo ?? null,
    indicadoPor: l?.ind_id ? { id: l.ind_id, nome: l.ind_nome ?? 'Membro' } : null,
    diretos: rede[0] ?? 0,
    rede: rede.reduce((s, x) => s + x, 0),
    comissoesRecebidasX100: n(k?.s),
    bonusLinkX100: l?.bonus_link === null || l?.bonus_link === undefined ? null : n(l.bonus_link),
    bonusGeralX100: n(l?.bonus_geral ?? 5_000),
  };
}

/** Bônus dos próximos cadastros que não têm um valor próprio no link. Quem já entrou não muda. */
export async function definirBonusGeral(c: Consulta, adminId: string, bonusX100: number, agoraMs: number): Promise<number> {
  const antes = await c.um<{ n: unknown }>('select bonus_geral_x100 as n from afiliados_config where id = 1');
  await c.q(
    'update afiliados_config set bonus_geral_x100 = $1, atualizado_em = $2, atualizado_por = $3 where id = 1',
    [bonusX100, new Date(agoraMs), adminId],
  );
  await auditar(c, adminId, 'definir_bonus_geral', null, { de: n(antes?.n), para: bonusX100 });
  return bonusX100;
}

/** Taxas e comissões (só valem para as vendas daqui em diante). */
export async function salvarConfigAfiliados(c: Consulta, adminId: string, novo: ConfigAfiliadosDTO, agoraMs: number): Promise<ConfigAfiliadosDTO> {
  const antes = await lerConfigAfiliados(c);
  await exigirSemLucroComComissao(c, novo.ativo ? novo.comissoesBp.reduce((s, bp) => s + bp, 0) : 0);
  await c.q(
    `update afiliados_config set ativo = $1, comissoes_bp = $2::int[], teto_diario_x100 = $3, atualizado_em = $4, atualizado_por = $5
      where id = 1`,
    [novo.ativo, novo.comissoesBp, novo.tetoDiarioX100, new Date(agoraMs), adminId],
  );
  await auditar(c, adminId, 'configurar_afiliados', null, { de: antes, para: novo });
  return lerConfigAfiliados(c);
}

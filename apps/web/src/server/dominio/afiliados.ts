// Convites e afiliação — tudo em MOEDAS DO JOGO: nada é depositado, sacado ou convertido em dinheiro.
// Cada membro tem um código de convite (link /c/CODIGO). Quem se cadastra pelo link fica ligado a quem o
// convidou, e cada venda de ovos dele rende uma comissão para quem está acima na rede: nível 1 (quem
// convidou), nível 2 (quem convidou essa pessoa)… com a % de cada nível definida no painel. Quem paga a
// comissão é o jogo — o vendedor recebe a venda inteira — e cada membro tem um teto diário de comissões.
import { randomInt } from 'node:crypto';
import {
  CODIGO_CONVITE, normalizarConvite,
  type ComissaoDTO, type ConfigAfiliadosDTO, type ConviteValidoDTO, type MeuConviteDTO,
} from '@galinheiro/api-contract';
import { CONFIG, MS_DIA } from '@galinheiro/game-core';
import { MEMBRO } from '../admin/painel';
import { diaBr } from '../admin/projecoes';
import type { Consulta } from '../db/banco';
import { ErroDominio } from '../erros';
import { iso } from './linhas';
import { incrementarVersao, movimentarSaldo } from './repo';

/** Até quantos níveis a rede é percorrida (o painel aceita de 1 a 5 níveis pagos). */
export const NIVEIS_MAX = 5;
/** Teto do bônus de cadastro: R$ 1.000,00. */
export const BONUS_CADASTRO_MAX_X100 = 100_000;
export const CONFIG_PADRAO: ConfigAfiliadosDTO = { ativo: true, comissoesBp: [1000, 400, 200], tetoDiarioX100: 20_000 };

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0 e 1 (fáceis de confundir)
const n = (v: unknown): number => Number(v ?? 0);

export function gerarCodigoConvite(tamanho = 7): string {
  let s = '';
  for (let i = 0; i < tamanho; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}

/** Nome discreto para mostrar a outros membros: "Ana Lima Souza" → "Ana S." */
export function nomeCurto(nome: string | null | undefined): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return 'Membro';
  return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]!.charAt(0).toUpperCase()}.` : partes[0]!;
}

/** 00:00 (horário de Brasília) do dia do instante dado. */
export const inicioDoDia = (agoraMs: number): Date => new Date(Date.parse(`${diaBr(agoraMs)}T03:00:00Z`));

export async function lerConfigAfiliados(c: Consulta): Promise<ConfigAfiliadosDTO> {
  const l = await c.um<{ ativo: boolean; comissoes_bp: unknown; teto_diario_x100: unknown }>(
    'select ativo, comissoes_bp, teto_diario_x100 from afiliados_config where id = 1',
  );
  if (!l) return CONFIG_PADRAO;
  const bp = Array.isArray(l.comissoes_bp) ? l.comissoes_bp : String(l.comissoes_bp ?? '').replace(/[{}]/g, '').split(',').filter(Boolean);
  return { ativo: !!l.ativo, comissoesBp: bp.map(n), tetoDiarioX100: l.teto_diario_x100 === null ? null : n(l.teto_diario_x100) };
}

/** Bônus geral dos cadastros novos (quem entra sem convite, ou por um link sem valor próprio). */
export async function bonusGeralX100(c: Consulta): Promise<number> {
  const l = await c.um<{ n: unknown }>('select bonus_geral_x100 as n from afiliados_config where id = 1');
  const v = Number(l?.n ?? CONFIG.moedasIniciaisX100);
  return Number.isFinite(v) ? Math.min(Math.max(0, Math.floor(v)), BONUS_CADASTRO_MAX_X100) : CONFIG.moedasIniciaisX100;
}

/**
 * Bônus creditado no cadastro deste membro. Se ele entrou pelo link de alguém com valor próprio, usa esse
 * valor. Senão, o bônus geral. Quem já foi creditado não é recalculado.
 */
export async function bonusDeCadastro(c: Consulta, contaId: string): Promise<number> {
  const l = await c.um<{ n: unknown }>(
    `select coalesce(i.bonus_link_x100, (select bonus_geral_x100 from afiliados_config where id = 1)) as n
       from contas eu
       left join contas i on i.id = eu.indicado_por
      where eu.id = $1`,
    [contaId],
  );
  const v = Number(l?.n ?? CONFIG.moedasIniciaisX100);
  return Number.isFinite(v) ? Math.min(Math.max(0, Math.floor(v)), BONUS_CADASTRO_MAX_X100) : CONFIG.moedasIniciaisX100;
}

/** Código de convite do membro (gerado na primeira vez). */
export async function garantirCodigo(c: Consulta, contaId: string): Promise<string> {
  const atual = await c.um<{ convite_codigo: string | null }>('select convite_codigo from contas where id = $1', [contaId]);
  if (atual?.convite_codigo) return atual.convite_codigo;
  for (let tentativa = 0; atual && tentativa < 8; tentativa++) {
    const codigo = gerarCodigoConvite();
    if (await c.um('select 1 from contas where convite_codigo = $1', [codigo])) continue;
    const r = await c.um<{ convite_codigo: string }>(
      'update contas set convite_codigo = coalesce(convite_codigo, $2) where id = $1 returning convite_codigo',
      [contaId, codigo],
    );
    if (r) return r.convite_codigo;
  }
  throw new ErroDominio('NAO_ENCONTRADO', undefined, 'Não foi possível gerar o código de convite.');
}

/** Dono de um código que pode convidar: membro e não bloqueado. */
function donoDoConvite(c: Consulta, codigo: string): Promise<{ id: string; nome: string } | null> {
  return c.um(`select c.id, c.nome from contas c where c.convite_codigo = $1 and ${MEMBRO} and c.bloqueado_em is null`, [codigo]);
}

/** Conferência pública (tela de cadastro): o código vale? De quem é (nome curto)? */
export async function verificarConvite(c: Consulta, bruto: string): Promise<ConviteValidoDTO> {
  const codigo = normalizarConvite(bruto);
  if (!CODIGO_CONVITE.test(codigo)) return { valido: false, indicador: null };
  const dono = await donoDoConvite(c, codigo);
  return dono ? { valido: true, indicador: nomeCurto(dono.nome) } : { valido: false, indicador: null };
}

/** No cadastro: liga o novo membro a quem o convidou (código já normalizado pelo schema). */
export async function vincularIndicacao(c: Consulta, novoId: string, codigo: string, agoraMs: number): Promise<void> {
  const dono = await donoDoConvite(c, codigo);
  if (!dono || dono.id === novoId) {
    throw new ErroDominio('CONVITE_INVALIDO', { issues: [{ caminho: 'convite', mensagem: 'Código de convite inválido.' }] });
  }
  await c.q('update contas set indicado_por = $2, indicado_em = $3 where id = $1 and indicado_por is null', [novoId, dono.id, new Date(agoraMs)]);
}

/**
 * Quem está acima na rede (nível 1 = quem convidou…), até `niveis`. Bloqueados e contas que não são membros
 * ficam de fora (não recebem), mas não quebram a corrente: quem está acima deles continua no seu nível.
 */
async function acimaDe(c: Consulta, contaId: string, niveis: number): Promise<{ id: string; nivel: number }[]> {
  const linhas = await c.q<{ id: string; nivel: unknown }>(
    `with recursive acima (id, nivel) as (
       select indicado_por, 1 from contas where id = $1 and indicado_por is not null
       union all
       select c.indicado_por, a.nivel + 1 from acima a join contas c on c.id = a.id
        where c.indicado_por is not null and a.nivel < $2
     )
     select a.id, a.nivel from acima a join contas c on c.id = a.id
      where ${MEMBRO} and c.bloqueado_em is null
      order by a.nivel`,
    [contaId, niveis],
  );
  return linhas.map((l) => ({ id: l.id, nivel: n(l.nivel) }));
}

/**
 * Comissões de uma venda de ovos: cada nível acima do vendedor recebe a sua % do valor da venda, até o teto
 * do dia. Roda na transação da venda, depois da trava do vendedor, e trava os beneficiários de baixo para
 * cima na rede (a rede não tem ciclos, então duas vendas nunca se travam uma à outra). Devolve o total pago.
 */
export async function pagarComissoesDeVenda(c: Consulta, vendedorId: string, vendaX100: number, agoraMs: number): Promise<number> {
  if (vendaX100 <= 0) return 0;
  const cfg = await lerConfigAfiliados(c);
  if (!cfg.ativo || !cfg.comissoesBp.some((bp) => bp > 0)) return 0;
  const acima = await acimaDe(c, vendedorId, cfg.comissoesBp.length);
  if (!acima.length) return 0;
  const vendedor = await c.um<{ nome: string | null }>('select nome from contas where id = $1', [vendedorId]);
  const desde = inicioDoDia(agoraMs);
  let pago = 0;
  for (const { id, nivel } of acima) {
    let valor = Math.floor((vendaX100 * (cfg.comissoesBp[nivel - 1] ?? 0)) / 10_000);
    if (valor <= 0) continue;
    if (!(await c.um('select id from players where id = $1 for update', [id]))) continue;
    if (cfg.tetoDiarioX100 !== null) {
      const hoje = await c.um<{ s: unknown }>(
        'select coalesce(sum(valor_x100), 0) as s from comissoes where beneficiario_id = $1 and criado_em >= $2',
        [id, desde],
      );
      valor = Math.min(valor, cfg.tetoDiarioX100 - n(hoje?.s));
      if (valor <= 0) continue;
    }
    const { transacaoId } = await movimentarSaldo(
      c, id, valor, 'COMISSAO_INDICACAO', { nivel, origem: nomeCurto(vendedor?.nome), vendaX100 }, agoraMs,
    );
    await c.q(
      `insert into comissoes (beneficiario_id, origem_conta_id, nivel, base_x100, valor_x100, transacao_id, criado_em)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [id, vendedorId, nivel, vendaX100, valor, transacaoId, new Date(agoraMs)],
    );
    await incrementarVersao(c, id, agoraMs); // o app do beneficiário vê o saldo novo
    pago += valor;
  }
  return pago;
}

/** Quantos membros em cada nível abaixo (índice 0 = nível 1). */
export async function contarRede(c: Consulta, contaId: string, niveis = NIVEIS_MAX): Promise<number[]> {
  const linhas = await c.q<{ nivel: unknown; total: unknown }>(
    `with recursive abaixo (id, nivel) as (
       select id, 1 from contas where indicado_por = $1
       union all
       select c.id, a.nivel + 1 from abaixo a join contas c on c.indicado_por = a.id where a.nivel < $2
     )
     select a.nivel, count(*) as total from abaixo a join contas c on c.id = a.id where ${MEMBRO} group by a.nivel`,
    [contaId, niveis],
  );
  const rede = Array.from({ length: niveis }, () => 0);
  for (const l of linhas) rede[n(l.nivel) - 1] = n(l.total);
  return rede;
}

export interface LinhaComissao { id: unknown; nivel: unknown; base_x100: unknown; valor_x100: unknown; criado_em: Date; origem: string | null }
export const SELECT_COMISSAO = `
  select k.id, k.nivel, k.base_x100, k.valor_x100, k.criado_em, o.nome as origem
    from comissoes k left join contas o on o.id = k.origem_conta_id`;
export const paraComissaoDTO = (l: LinhaComissao): ComissaoDTO => ({
  id: n(l.id),
  nivel: n(l.nivel),
  origem: l.origem ? nomeCurto(l.origem) : null,
  baseX100: n(l.base_x100),
  valorX100: n(l.valor_x100),
  criadoEm: iso(l.criado_em),
});

/** Tela "Convide amigos": código, link, taxas, rede por nível, ganhos e indicados diretos (nome curto). */
export async function meuConvite(c: Consulta, contaId: string, agoraMs: number): Promise<MeuConviteDTO> {
  const codigo = await garantirCodigo(c, contaId);
  const config = await lerConfigAfiliados(c);
  const eu = await c.um<{ indicador: string | null }>(
    'select i.nome as indicador from contas c left join contas i on i.id = c.indicado_por where c.id = $1',
    [contaId],
  );
  const g = (await c.um<Record<string, unknown>>(
    `select coalesce(sum(valor_x100) filter (where criado_em >= $2), 0) as hoje,
            coalesce(sum(valor_x100) filter (where criado_em >= $3), 0) as d30,
            coalesce(sum(valor_x100), 0) as total
       from comissoes where beneficiario_id = $1`,
    [contaId, inicioDoDia(agoraMs), new Date(agoraMs - 30 * MS_DIA)],
  ))!;
  const indicados = await c.q<{ nome: string; criado_em: Date; ultimo_acesso_em: Date | null; rendeu: unknown; total: unknown }>(
    `select c.nome, c.criado_em, p.ultimo_acesso_em,
            (select coalesce(sum(k.valor_x100), 0) from comissoes k where k.beneficiario_id = $1 and k.origem_conta_id = c.id) as rendeu,
            count(*) over () as total
       from contas c left join players p on p.id = c.id
      where c.indicado_por = $1 and ${MEMBRO}
      order by c.criado_em desc
      limit 50`,
    [contaId],
  );
  const ultimas = await c.q<LinhaComissao>(`${SELECT_COMISSAO} where k.beneficiario_id = $1 order by k.criado_em desc, k.id desc limit 20`, [contaId]);
  const seteDias = agoraMs - 7 * MS_DIA;
  return {
    codigo,
    caminho: `/c/${codigo}`,
    config,
    indicadoPor: eu?.indicador ? nomeCurto(eu.indicador) : null,
    rede: await contarRede(c, contaId, config.comissoesBp.length),
    ganhos: { hojeX100: n(g.hoje), dias30X100: n(g.d30), totalX100: n(g.total) },
    indicados: indicados.map((l) => ({
      nome: nomeCurto(l.nome),
      desde: iso(l.criado_em),
      ativo7d: !!l.ultimo_acesso_em && new Date(l.ultimo_acesso_em).getTime() >= seteDias,
      rendeuX100: n(l.rendeu),
    })),
    totalIndicados: n(indicados[0]?.total),
    ultimas: ultimas.map(paraComissaoDTO),
  };
}

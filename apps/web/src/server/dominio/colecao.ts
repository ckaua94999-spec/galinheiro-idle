// Leituras: coleção, detalhe do animal, extrato e configuração pública.
import type {
  ConfigPublicaDTO, EntityDetalheDTO, ListaEntidades, ListaTransacoes,
} from '@galinheiro/api-contract';
import {
  ANIMAIS, CONFIG, CONFIG_VERSAO, FAIXAS_ROLETA, TIERS, efeitosDoTier, idadeEmDias, type Tier,
} from '@galinheiro/game-core';
import type { Consulta } from '../db/banco';
import { ErroDominio } from '../erros';
import {
  COLS_ENTIDADE, paraEntityDTO, paraTransacaoDTO, type LinhaEntidade, type LinhaTransacao,
} from './linhas';

const cursorPara = (obj: unknown): string => Buffer.from(JSON.stringify(obj)).toString('base64url');
function cursorDe<T>(cursor: string | undefined): T | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
  } catch {
    throw new ErroDominio('PAYLOAD_INVALIDO', { campo: 'cursor' });
  }
}

export interface FiltroEntidades {
  status: 'ativo' | 'expirado' | 'todos';
  tipo?: string;
  raridade?: string;
  pronto?: 'true' | 'false';
  ordenar: 'slot' | 'raridade' | 'vida' | 'proximoRendimento' | 'nome' | 'chegada';
  limit: number;
  cursor?: string;
}

export async function listarEntidades(c: Consulta, contaId: string, f: FiltroEntidades, agoraMs: number): Promise<ListaEntidades> {
  const params: unknown[] = [contaId];
  const p = (v: unknown): string => {
    params.push(v);
    return `$${params.length}`;
  };
  const onde = ['player_id = $1'];
  if (f.status !== 'todos') onde.push(`status = ${p(f.status)}`);
  if (f.tipo) onde.push(`tipo = ${p(f.tipo)}`);
  if (f.raridade) onde.push(`raridade = ${p(f.raridade)}`);
  if (f.pronto === 'true') onde.push(`status = 'ativo' and proximo_rendimento <= ${p(new Date(agoraMs))}`);
  if (f.pronto === 'false') onde.push(`(status <> 'ativo' or proximo_rendimento > ${p(new Date(agoraMs))})`);
  const paramsOnde = params.slice();

  let ordem: string;
  switch (f.ordenar) {
    case 'raridade': ordem = 'raridade desc, status asc, lower(nome)'; break;
    case 'vida': ordem = `status asc, fn_vida(vida_ancora, vida_ancora_em, fator_decaimento_pct, ${p(new Date(agoraMs))}) asc`; break;
    case 'proximoRendimento': ordem = 'status asc, proximo_rendimento asc'; break;
    case 'nome': ordem = 'lower(nome) asc, nascimento asc'; break;
    case 'chegada': ordem = 'nascimento desc'; break;
    default: ordem = 'status asc, slot_id asc nulls last, expirado_em desc nulls last';
  }
  const offset = cursorDe<{ o: number }>(f.cursor)?.o ?? 0;
  const limite = p(f.limit + 1);
  const desloc = p(offset);
  const linhas = await c.q<LinhaEntidade & { total: number }>(
    `select ${COLS_ENTIDADE}, count(*) over()::int as total
       from entities where ${onde.join(' and ')}
      order by ${ordem}, id
      limit ${limite} offset ${desloc}`,
    params,
  );
  const temMais = linhas.length > f.limit;
  const itens = linhas.slice(0, f.limit).map((l) => paraEntityDTO(l, agoraMs));
  let total = linhas[0]?.total;
  if (total === undefined) {
    total = (await c.um<{ n: number }>(`select count(*)::int as n from entities where ${onde.join(' and ')}`,
      paramsOnde))?.n ?? 0;
  }
  return { itens, total, proximoCursor: temMais ? cursorPara({ o: offset + f.limit }) : null };
}

export async function detalheEntidade(c: Consulta, contaId: string, entityId: string, agoraMs: number): Promise<EntityDetalheDTO> {
  const l = await c.um<LinhaEntidade>(`select ${COLS_ENTIDADE} from entities where id = $1 and player_id = $2`, [entityId, contaId]);
  if (!l) throw new ErroDominio('ENTIDADE_NAO_ENCONTRADA', { entityId });
  const dto = paraEntityDTO(l, agoraMs);
  const referencia = l.status === 'ativo' ? agoraMs : (l.expirado_em?.getTime() ?? agoraMs);
  let efeitos: EntityDetalheDTO['info']['efeitos'] = null;
  if (dto.tier) {
    const { rendimentoPct, chanceTresOvosPct, atrasoH, duracaoCicloH } = efeitosDoTier(dto.tier);
    efeitos = { rendimentoPct, chanceTresOvosPct, atrasoH, duracaoCicloH };
  }
  return {
    ...dto,
    info: {
      idadeDias: idadeEmDias(l.nascimento.getTime(), referencia),
      efeitos,
      mediaOvosPorColeta: l.coletas_total > 0 ? Math.round((l.ovos_total / l.coletas_total) * 100) / 100 : null,
    },
  };
}

export async function extrato(c: Consulta, contaId: string, limit: number, cursor: string | undefined): Promise<ListaTransacoes> {
  const cur = cursorDe<{ t: string; id: string }>(cursor);
  const linhas = await c.q<LinhaTransacao>(
    `select id, tipo, valor_x100, saldo_apos_x100, detalhes, criado_em from transactions
      where player_id = $1 ${cur ? 'and (criado_em, id) < ($3::timestamptz, $4::uuid)' : ''}
      order by criado_em desc, id desc
      limit $2`,
    cur ? [contaId, limit + 1, cur.t, cur.id] : [contaId, limit + 1],
  );
  const temMais = linhas.length > limit;
  const itens = linhas.slice(0, limit).map(paraTransacaoDTO);
  const ultimo = itens[itens.length - 1];
  return { itens, proximoCursor: temMais && ultimo ? cursorPara({ t: ultimo.criadoEm, id: ultimo.id }) : null };
}

export function configPublica(vapidPublicKey: string | null, relogioAjustavel: boolean): ConfigPublicaDTO {
  const tiers = Object.fromEntries(
    (Object.keys(TIERS) as Tier[]).map((t) => [t, { ...TIERS[t], chanceTresOvosPct: efeitosDoTier(t).chanceTresOvosPct }]),
  ) as ConfigPublicaDTO['ciclo']['tiers'];
  return {
    versao: CONFIG_VERSAO,
    galinheiro: { ...CONFIG.galinheiro },
    roleta: {
      custoX100: CONFIG.roleta.custoX100,
      chances: FAIXAS_ROLETA.map((f) => ({
        tipo: f.tipo,
        raridade: ANIMAIS[f.tipo].raridade,
        pct: (f.ate - f.de + 1) / 100,
        grauInicio: f.grauInicio,
        largura: f.largura,
      })),
    },
    animais: { ...ANIMAIS },
    ciclo: { baseH: CONFIG.ciclo.baseH, janelaGracaH: CONFIG.ciclo.janelaGracaH, tiers },
    vida: { vidaUtilDias: CONFIG.vida.vidaUtilMs / 86_400_000 },
    push: { vapidPublicKey },
    dev: { relogioAjustavel },
  };
}

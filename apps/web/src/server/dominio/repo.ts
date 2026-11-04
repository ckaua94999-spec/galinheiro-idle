// Consultas compartilhadas pelos casos de uso. Sempre chamadas dentro de uma transação
// que já travou a linha do jogador (ordem de travas: idempotency_keys -> players -> entities).
import type { EntityDTO } from '@galinheiro/api-contract';
import {
  ANIMAIS, CONFIG, CONFIG_VERSAO, iniciarCiclo, inicioDoProximoCiclo, nomePadrao, primeiraPostura,
  type Inventario, type Item, type Rng, type Tier, type Tipo,
} from '@galinheiro/game-core';
import type { Consulta } from '../db/banco';
import { ErroDominio } from '../erros';
import {
  COLS_ENTIDADE, COLS_JOGADOR, entidadeTempo, iso, paraEntityDTO, paraInventario,
  type LinhaEntidade, type LinhaJogador,
} from './linhas';

export type TipoTransacao =
  | 'BONUS_INICIAL' | 'VENDA_OVOS' | 'GIRO_ROLETA' | 'UPGRADE_NINHO' | 'AJUSTE_SUPORTE' | 'COMISSAO_INDICACAO' | 'COMPRA_TICKET'
  | 'SAQUE' | 'SAQUE_ESTORNO';
export type OrigemEntidade = 'ROLETA' | 'BOAS_VINDAS' | 'SUPORTE' | 'INTERCAMBIO';

const d = (ms: number): Date => new Date(ms);

export function travarJogador(c: Consulta, id: string): Promise<LinhaJogador | null> {
  return c.um<LinhaJogador>(`select ${COLS_JOGADOR} from players where id = $1 for update`, [id]);
}

export async function exigirJogador(c: Consulta, id: string): Promise<LinhaJogador> {
  const j = await travarJogador(c, id);
  if (!j) throw new ErroDominio('JOGADOR_NAO_ENCONTRADO');
  return j;
}

export async function incrementarVersao(c: Consulta, id: string, agoraMs: number): Promise<number> {
  const r = await c.um<{ versao: number }>(
    'update players set versao = versao + 1, atualizado_em = $2 where id = $1 returning versao',
    [id, d(agoraMs)],
  );
  return r?.versao ?? 0;
}

/** Credita (+) ou debita (−) moedas e grava a linha do extrato (G-05). */
export async function movimentarSaldo(
  c: Consulta, id: string, valorX100: number, tipo: TipoTransacao, detalhes: Record<string, unknown>, agoraMs: number,
): Promise<{ transacaoId: string; saldoAposX100: number }> {
  const p = await c.um<{ moedas_x100: number }>(
    'update players set moedas_x100 = moedas_x100 + $2, atualizado_em = $3 where id = $1 returning moedas_x100',
    [id, valorX100, d(agoraMs)],
  );
  if (!p) throw new ErroDominio('JOGADOR_NAO_ENCONTRADO');
  const t = await c.um<{ id: string }>(
    `insert into transactions (player_id, tipo, valor_x100, saldo_apos_x100, detalhes, config_versao, criado_em)
     values ($1, $2, $3, $4, $5::jsonb, $6, $7) returning id`,
    [id, tipo, valorX100, p.moedas_x100, JSON.stringify(detalhes), CONFIG_VERSAO, d(agoraMs)],
  );
  return { transacaoId: t!.id, saldoAposX100: p.moedas_x100 };
}

export async function lerInventario(c: Consulta, id: string): Promise<Inventario> {
  return paraInventario(await c.q<{ item: Item; quantidade: number }>(
    'select item, quantidade from inventory where player_id = $1', [id],
  ));
}

export async function creditarOvos(c: Consulta, id: string, item: Item, qtd: number, agoraMs: number): Promise<void> {
  await c.q(
    `update inventory set quantidade = quantidade + $3, total_coletado = total_coletado + $3, atualizado_em = $4
      where player_id = $1 and item = $2`,
    [id, item, qtd, d(agoraMs)],
  );
}

export async function contarAtivos(c: Consulta, id: string): Promise<number> {
  const r = await c.um<{ n: number }>(
    `select count(*)::int as n from entities where player_id = $1 and status = 'ativo'`, [id],
  );
  return r?.n ?? 0;
}

export async function menorSlotLivre(c: Consulta, id: string): Promise<number | null> {
  const r = await c.um<{ slot: number }>(
    `select n.slot from nests n
      where n.player_id = $1
        and not exists (select 1 from entities e
                         where e.player_id = n.player_id and e.slot_id = n.slot and e.status = 'ativo')
      order by n.slot limit 1`,
    [id],
  );
  return r?.slot ?? null;
}

export async function buscarEntidade(c: Consulta, id: string, entityId: string, travar = false): Promise<LinhaEntidade | null> {
  return c.um<LinhaEntidade>(
    `select ${COLS_ENTIDADE} from entities where id = $1 and player_id = $2${travar ? ' for update' : ''}`,
    [entityId, id],
  );
}

export interface ItemColeta { entityId: string; cicloN: number; tier: Tier; ovos: number; item: Item; prontoEmMs: number }

export async function registrarColeta(
  c: Consulta, id: string, origem: 'INDIVIDUAL' | 'EM_MASSA', agoraMs: number, itens: ItemColeta[],
): Promise<void> {
  if (!itens.length) return;
  const porItem: Partial<Record<Item, number>> = {};
  for (const i of itens) porItem[i.item] = (porItem[i.item] ?? 0) + i.ovos;
  const total = itens.reduce((s, i) => s + i.ovos, 0);
  const detalhes = itens.map((i) => ({ e: i.entityId, c: i.cicloN, t: i.tier, o: i.ovos, p: iso(i.prontoEmMs) }));
  await c.q(
    `insert into collections (player_id, origem, coletado_em, total_ovos, por_item, detalhes)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
    [id, origem, d(agoraMs), total, JSON.stringify(porItem), JSON.stringify(detalhes)],
  );
}

/** Aplica as aposentadorias vencidas (RN-ENT-03) e devolve os animais aposentados agora. */
export async function reconciliar(c: Consulta, id: string, agoraMs: number): Promise<EntityDTO[]> {
  const vencidos = await c.q<{ id: string }>(
    `select id from entities where player_id = $1 and status = 'ativo' and expiracao <= $2 order by slot_id`,
    [id, d(agoraMs)],
  );
  if (!vencidos.length) return [];
  for (const v of vencidos) await c.q('select fn_aposentar($1, $2)', [v.id, d(agoraMs)]);
  const linhas = await c.q<LinhaEntidade>(
    `select ${COLS_ENTIDADE} from entities
      where id in (select (jsonb_array_elements_text($1::jsonb))::uuid) order by expirado_em`,
    [JSON.stringify(vencidos.map((v) => v.id))],
  );
  return linhas.map((l) => paraEntityDTO(l, agoraMs));
}

/** Cria um animal no slot indicado, com nome padrão e primeira postura (RN-ENT-01, RN-REN-06). */
export async function criarAnimal(
  c: Consulta, id: string, tipo: Tipo, slot: number, agoraMs: number, rng: Rng, origem: OrigemEntidade,
): Promise<LinhaEntidade> {
  const emUso = new Set((await c.q<{ nome: string }>(
    `select nome from entities where player_id = $1 and status = 'ativo' and tipo = $2`, [id, tipo],
  )).map((r) => r.nome));
  const nome = nomePadrao(tipo, emUso, rng);
  const cfg = ANIMAIS[tipo];
  const expiracaoMs = agoraMs + CONFIG.vida.vidaUtilMs;
  const base = { vidaAncora: 100, vidaAncoraEmMs: agoraMs, fatorPct: cfg.fatorPct, expiracaoMs };
  const ciclo = CONFIG.primeiraPosturaImediata ? primeiraPostura(agoraMs, rng) : iniciarCiclo(base, agoraMs, rng);
  const linha = await c.um<LinhaEntidade>(
    `insert into entities (player_id, nome, tipo, raridade, origem, status, nascimento, expiracao, vida_ancora,
       vida_ancora_em, fator_decaimento_pct, slot_id, ciclo_n, ciclo_inicio, ciclo_tier, proximo_rendimento,
       ovos_pendentes, criado_em, atualizado_em)
     values ($1, $2, $3, $4, $5, 'ativo', $6, $7, 100, $6, $8, $9, 1, $10, $11, $12, $13, $6, $6)
     returning ${COLS_ENTIDADE}`,
    [id, nome, tipo, cfg.raridade, origem, d(agoraMs), d(expiracaoMs), cfg.fatorPct, slot,
      d(ciclo.inicioMs), ciclo.tier, d(ciclo.prontoEmMs), ciclo.ovos],
  );
  return linha!;
}

/** Coleta o ciclo pronto e abre o próximo (pré-sorteio no servidor, janela de graça). */
export async function avancarCiclo(
  c: Consulta, l: LinhaEntidade, agoraMs: number, rng: Rng,
): Promise<{ linha: LinhaEntidade; ovos: number }> {
  const ovos = l.ovos_pendentes;
  const inicio = inicioDoProximoCiclo(l.proximo_rendimento.getTime(), agoraMs);
  const novo = iniciarCiclo(entidadeTempo(l), inicio, rng);
  const linha = await c.um<LinhaEntidade>(
    `update entities
        set ciclo_n = ciclo_n + 1, ciclo_inicio = $2, ciclo_tier = $3, proximo_rendimento = $4,
            ovos_pendentes = $5, ovos_total = ovos_total + $6, coletas_total = coletas_total + 1, atualizado_em = $7
      where id = $1
      returning ${COLS_ENTIDADE}`,
    [l.id, d(novo.inicioMs), novo.tier, d(novo.prontoEmMs), novo.ovos, ovos, d(agoraMs)],
  );
  return { linha: linha!, ovos };
}

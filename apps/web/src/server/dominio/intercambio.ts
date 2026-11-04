// Intercâmbio (tickets) e cupons — só itens e moedas do jogo, nunca dinheiro real.
// TICKET é um vale do jogo: vem de cupons (códigos da equipe), de ajustes da equipe e, se o painel ligar, da
// compra com moedas. No Intercâmbio ele vira ovos ou animais, pela tabela de ofertas definida no painel.
// Com a compra ligada, nenhuma oferta de ovos pode valer mais do que custa — contando as comissões de
// afiliação que a venda desses ovos geraria —, senão daria para "fabricar" moedas comprando e vendendo.
import type {
  CompraTicketsDTO, ConfigIntercambioDTO, CupomResgatadoDTO, IntercambioDTO, MovimentoTicketDTO, OfertaIntercambioDTO,
  TrocaTicketsDTO,
} from '@galinheiro/api-contract';
import { ANIMAIS, tipoDoItem, type Item, type Rng, type Tipo } from '@galinheiro/game-core';
import type { Consulta } from '../db/banco';
import { ErroDominio } from '../erros';
import { inicioDoDia, lerConfigAfiliados } from './afiliados';
import type { ResultadoCaso } from './jogo';
import { iso, paraEntityDTO } from './linhas';
import {
  contarAtivos, creditarOvos, criarAnimal, exigirJogador, incrementarVersao, lerInventario, menorSlotLivre, movimentarSaldo,
  reconciliar,
} from './repo';

export type MotivoTicket = MovimentoTicketDTO['motivo'];
const n = (v: unknown): number => Number(v ?? 0);

export const CONFIG_INTERCAMBIO_PADRAO: ConfigIntercambioDTO = { ativo: true, compraAtiva: false, precoTicketX100: 1000, limiteCompraDia: null };

export async function lerConfigIntercambio(c: Consulta): Promise<ConfigIntercambioDTO> {
  const l = await c.um<{ ativo: boolean; compra_ativa: boolean; preco_ticket_x100: unknown; limite_compra_dia: unknown }>(
    'select ativo, compra_ativa, preco_ticket_x100, limite_compra_dia from intercambio_config where id = 1',
  );
  if (!l) return CONFIG_INTERCAMBIO_PADRAO;
  return {
    ativo: !!l.ativo,
    compraAtiva: !!l.compra_ativa,
    precoTicketX100: n(l.preco_ticket_x100),
    limiteCompraDia: l.limite_compra_dia === null ? null : n(l.limite_compra_dia),
  };
}

export interface LinhaOferta {
  id: string;
  tipo: 'ovos' | 'animal';
  item: Item | null;
  quantidade: unknown;
  animal: Tipo | null;
  custo_tickets: unknown;
  ativo: boolean;
  ordem: unknown;
}
export const COLS_OFERTA = 'id, tipo, item, quantidade, animal, custo_tickets, ativo, ordem';
export const paraOfertaDTO = (l: LinhaOferta): OfertaIntercambioDTO => ({
  id: l.id,
  tipo: l.tipo,
  item: l.item,
  quantidade: l.quantidade === null ? null : n(l.quantidade),
  animal: l.animal,
  custoTickets: n(l.custo_tickets),
  ativo: !!l.ativo,
});

/** Valor de mercado (moedas × 100) dos ovos de uma oferta; null para animais. */
export const valorMercadoX100 = (o: Pick<OfertaIntercambioDTO, 'tipo' | 'item' | 'quantidade'>): number | null =>
  o.tipo === 'ovos' && o.item && o.quantidade ? o.quantidade * ANIMAIS[tipoDoItem(o.item)].precoOvoX100 : null;

/**
 * Regra "sem lucro" (só vale com a compra ligada): cada oferta de ovos ativa precisa custar, em moedas, pelo
 * menos o que os ovos rendem vendidos MAIS as comissões de afiliação dessa venda. Devolve as que quebram a regra.
 */
export function ofertasLucrativas(
  config: Pick<ConfigIntercambioDTO, 'compraAtiva' | 'precoTicketX100'>,
  ofertas: readonly Pick<OfertaIntercambioDTO, 'id' | 'tipo' | 'item' | 'quantidade' | 'custoTickets' | 'ativo'>[],
  comissaoTotalBp: number,
): { id: string; valorX100: number; custoX100: number }[] {
  if (!config.compraAtiva) return [];
  return ofertas.flatMap((o) => {
    const valor = valorMercadoX100(o);
    if (!o.ativo || valor === null) return [];
    const valorComComissoes = Math.ceil((valor * (10_000 + comissaoTotalBp)) / 10_000);
    const custo = o.custoTickets * config.precoTicketX100;
    return valorComComissoes > custo ? [{ id: o.id, valorX100: valorComComissoes, custoX100: custo }] : [];
  });
}

/** Soma das comissões de afiliação em vigor (pontos-base); 0 com o programa pausado. */
export async function comissaoTotalBp(c: Consulta): Promise<number> {
  const a = await lerConfigAfiliados(c);
  return a.ativo ? a.comissoesBp.reduce((s, bp) => s + bp, 0) : 0;
}

/** Credita (+) ou debita (−) tickets e grava o movimento. Nunca deixa o saldo negativo. */
export async function movimentarTickets(
  c: Consulta, playerId: string, delta: number, motivo: MotivoTicket, detalhes: Record<string, unknown>, agoraMs: number,
): Promise<number> {
  const p = await c.um<{ tickets: unknown }>(
    'update players set tickets = tickets + $2, atualizado_em = $3 where id = $1 and tickets + $2 >= 0 returning tickets',
    [playerId, delta, new Date(agoraMs)],
  );
  if (!p) {
    const atual = await c.um<{ tickets: unknown }>('select tickets from players where id = $1', [playerId]);
    if (!atual) throw new ErroDominio('JOGADOR_NAO_ENCONTRADO');
    throw new ErroDominio('TICKETS_INSUFICIENTES', { tickets: n(atual.tickets), faltam: -delta - n(atual.tickets) });
  }
  const saldo = n(p.tickets);
  await c.q(
    `insert into tickets_movimentos (player_id, motivo, delta, saldo_apos, detalhes, criado_em)
     values ($1, $2, $3, $4, $5::jsonb, $6)`,
    [playerId, motivo, delta, saldo, JSON.stringify(detalhes), new Date(agoraMs)],
  );
  return saldo;
}

interface LinhaMovimento { id: unknown; motivo: MotivoTicket; delta: unknown; saldo_apos: unknown; detalhes: unknown; criado_em: Date }
export async function movimentosDeTickets(c: Consulta, playerId: string, limite = 20): Promise<MovimentoTicketDTO[]> {
  const linhas = await c.q<LinhaMovimento>(
    `select id, motivo, delta, saldo_apos, detalhes, criado_em from tickets_movimentos
      where player_id = $1 order by criado_em desc, id desc limit $2`,
    [playerId, limite],
  );
  return linhas.map((l) => ({
    id: n(l.id),
    motivo: l.motivo,
    delta: n(l.delta),
    saldoApos: n(l.saldo_apos),
    detalhes: (l.detalhes && typeof l.detalhes === 'object' ? l.detalhes : {}) as Record<string, unknown>,
    criadoEm: iso(l.criado_em),
  }));
}

async function compradosHoje(c: Consulta, playerId: string, agoraMs: number): Promise<number> {
  const l = await c.um<{ s: unknown }>(
    `select coalesce(sum(delta), 0) as s from tickets_movimentos where player_id = $1 and motivo = 'compra' and criado_em >= $2`,
    [playerId, inicioDoDia(agoraMs)],
  );
  return n(l?.s);
}

/** Tela do Intercâmbio: saldo de tickets, regras, ofertas ativas e histórico. */
export async function meuIntercambio(c: Consulta, contaId: string, agoraMs: number): Promise<IntercambioDTO> {
  const p = await c.um<{ tickets: unknown }>('select tickets from players where id = $1', [contaId]);
  if (!p) throw new ErroDominio('JOGADOR_NAO_ENCONTRADO');
  const ofertas = await c.q<LinhaOferta>(`select ${COLS_OFERTA} from intercambio_ofertas where ativo order by ordem, criado_em`);
  return {
    tickets: n(p.tickets),
    config: await lerConfigIntercambio(c),
    compradosHoje: await compradosHoje(c, contaId, agoraMs),
    ofertas: ofertas.map(paraOfertaDTO),
    historico: await movimentosDeTickets(c, contaId),
  };
}

/** Compra tickets com moedas do jogo (se o painel ligou a compra), respeitando o limite do dia. */
export async function comprarTickets(c: Consulta, contaId: string, quantidade: number, agoraMs: number): Promise<ResultadoCaso<CompraTicketsDTO>> {
  const cfg = await lerConfigIntercambio(c);
  if (!cfg.ativo) throw new ErroDominio('INTERCAMBIO_FECHADO');
  if (!cfg.compraAtiva) throw new ErroDominio('COMPRA_DESLIGADA');
  const jogador = await exigirJogador(c, contaId);
  if (cfg.limiteCompraDia !== null) {
    const hoje = await compradosHoje(c, contaId, agoraMs);
    if (hoje + quantidade > cfg.limiteCompraDia) {
      throw new ErroDominio('LIMITE_DIARIO', { limite: cfg.limiteCompraDia, compradosHoje: hoje, restam: Math.max(0, cfg.limiteCompraDia - hoje) });
    }
  }
  const custo = quantidade * cfg.precoTicketX100;
  if (jogador.moedas_x100 < custo) {
    throw new ErroDominio('SALDO_INSUFICIENTE', { saldoX100: jogador.moedas_x100, custoX100: custo, faltamX100: custo - jogador.moedas_x100 });
  }
  const { transacaoId, saldoAposX100 } = await movimentarSaldo(
    c, contaId, -custo, 'COMPRA_TICKET', { quantidade, precoTicketX100: cfg.precoTicketX100 }, agoraMs,
  );
  const tickets = await movimentarTickets(c, contaId, quantidade, 'compra', { transacaoId, precoTicketX100: cfg.precoTicketX100 }, agoraMs);
  const versao = await incrementarVersao(c, contaId, agoraMs);
  return { versao, data: { quantidade, custoX100: custo, tickets, saldoX100: saldoAposX100 } };
}

/** Troca tickets por uma oferta: ovos vão para o estoque; o animal vai para o menor ninho livre. */
export async function trocarTickets(c: Consulta, contaId: string, ofertaId: string, agoraMs: number, rng: Rng): Promise<ResultadoCaso<TrocaTicketsDTO>> {
  const cfg = await lerConfigIntercambio(c);
  if (!cfg.ativo) throw new ErroDominio('INTERCAMBIO_FECHADO');
  const l = await c.um<LinhaOferta>(`select ${COLS_OFERTA} from intercambio_ofertas where id = $1 and ativo`, [ofertaId]);
  if (!l) throw new ErroDominio('OFERTA_INDISPONIVEL');
  const oferta = paraOfertaDTO(l);
  const jogador = await exigirJogador(c, contaId);
  if (jogador.tickets < oferta.custoTickets) {
    throw new ErroDominio('TICKETS_INSUFICIENTES', { tickets: jogador.tickets, faltam: oferta.custoTickets - jogador.tickets });
  }
  let entity: TrocaTicketsDTO['entity'] = null;
  if (oferta.tipo === 'animal' && oferta.animal) {
    await reconciliar(c, contaId, agoraMs); // aposentados liberam o ninho antes
    const ocupados = await contarAtivos(c, contaId);
    const slot = ocupados < jogador.capacidade ? await menorSlotLivre(c, contaId) : null;
    if (slot === null) throw new ErroDominio('SEM_NINHO_LIVRE', { ocupados, capacidade: jogador.capacidade });
    entity = paraEntityDTO(await criarAnimal(c, contaId, oferta.animal, slot, agoraMs, rng, 'INTERCAMBIO'), agoraMs);
  } else if (oferta.item && oferta.quantidade) {
    // entram no estoque como recebidos (o estoque sempre bate: quantidade = recebidos − vendidos)
    await creditarOvos(c, contaId, oferta.item, oferta.quantidade, agoraMs);
  }
  const tickets = await movimentarTickets(
    c, contaId, -oferta.custoTickets, 'troca',
    { ofertaId: oferta.id, tipo: oferta.tipo, item: oferta.item, quantidade: oferta.quantidade, animal: oferta.animal, entityId: entity?.id ?? null },
    agoraMs,
  );
  const versao = await incrementarVersao(c, contaId, agoraMs);
  return { versao, data: { oferta, tickets, inventario: await lerInventario(c, contaId), entity } };
}

/** Resgata um cupom (código já normalizado): uma vez por membro, dentro da validade e do limite de usos. */
export async function resgatarCupom(c: Consulta, contaId: string, codigo: string, agoraMs: number): Promise<ResultadoCaso<CupomResgatadoDTO>> {
  await exigirJogador(c, contaId); // trava: jogador → cupom
  const cupom = await c.um<{
    id: string; beneficio: string; tickets: unknown; giros: unknown; usos_max: unknown; usos: unknown; inicio: Date; fim: Date | null; ativo: boolean;
  }>(
    'select id, beneficio, tickets, giros, usos_max, usos, inicio, fim, ativo from cupons where codigo = $1 for update',
    [codigo],
  );
  const agora = new Date(agoraMs);
  if (!cupom || !cupom.ativo || new Date(cupom.inicio) > agora || (cupom.fim && new Date(cupom.fim) <= agora)) {
    throw new ErroDominio('CUPOM_INVALIDO');
  }
  if (await c.um('select 1 from cupons_resgates where cupom_id = $1 and conta_id = $2', [cupom.id, contaId])) {
    throw new ErroDominio('CUPOM_JA_USADO');
  }
  if (cupom.usos_max !== null && n(cupom.usos) >= n(cupom.usos_max)) throw new ErroDominio('CUPOM_ESGOTADO');
  const deGiros = cupom.beneficio === 'giros';
  const tickets = deGiros ? 0 : n(cupom.tickets);
  const giros = deGiros ? n(cupom.giros) : 0;
  await c.q(
    'insert into cupons_resgates (cupom_id, conta_id, tickets, giros, criado_em) values ($1, $2, $3, $4, $5)',
    [cupom.id, contaId, tickets, giros, agora],
  );
  await c.q('update cupons set usos = usos + 1 where id = $1', [cupom.id]);
  const saldoTickets = tickets > 0
    ? await movimentarTickets(c, contaId, tickets, 'cupom', { cupomId: cupom.id, codigo }, agoraMs)
    : n((await c.um<{ tickets: unknown }>('select tickets from players where id = $1', [contaId]))?.tickets);
  const saldoGiros = giros > 0
    ? n((await c.um<{ giros_gratis: unknown }>(
      'update players set giros_gratis = giros_gratis + $2, atualizado_em = $3 where id = $1 returning giros_gratis',
      [contaId, giros, agora],
    ))?.giros_gratis)
    : n((await c.um<{ giros_gratis: unknown }>('select giros_gratis from players where id = $1', [contaId]))?.giros_gratis);
  const versao = await incrementarVersao(c, contaId, agoraMs);
  return { versao, data: { codigo, tickets, saldoTickets, giros, saldoGiros } };
}

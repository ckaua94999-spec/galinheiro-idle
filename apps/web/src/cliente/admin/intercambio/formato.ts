// Contas e textos do Intercâmbio no painel (funções puras): rótulo das ofertas ("7 ovos de galinha", "1 pato"),
// valor de mercado, a regra "sem lucro" (a MESMA conta do servidor), o preço mínimo seguro do ticket, o que
// mudou nas regras (usado também na auditoria) e os textos do extrato de tickets da ficha do membro.
// Tudo em MOEDAS E ITENS DO JOGO: ticket é um vale do jogo (vem de cupons, ajustes ou da compra com moedas do jogo).
import type { ConfigIntercambioDTO, MovimentoTicketDTO, OfertaIntercambioDTO } from '@galinheiro/api-contract';
import { ANIMAIS, NOME_TIPO, tipoDoItem, type Item, type Tipo } from '@galinheiro/game-core';
import { fmt } from '../ui';

/** Regras de fábrica (as mesmas do servidor): aberto, compra desligada, 10,00 por ticket, sem limite. */
export const CONFIG_PADRAO: ConfigIntercambioDTO = { ativo: true, compraAtiva: false, precoTicketX100: 1000, limiteCompraDia: null };

/** Limites do contrato (o servidor confere de novo). */
export const PRECO_MAX_X100 = 100_000_000;
export const LIMITE_DIA_MAX = 100_000;
export const CUSTO_MAX = 100_000;
export const OVOS_MAX = 100_000;

/** "1 ticket" / "12 tickets" */
export const textoTickets = (n: number): string => `${fmt.int(n)} ${Math.abs(n) === 1 ? 'ticket' : 'tickets'}`;

const ehItem = (v: unknown): v is Item => typeof v === 'string' && /^ovo_(galinha|pato|ganso|avestruz)$/.test(v);
const ehTipo = (v: unknown): v is Tipo => v === 'galinha' || v === 'pato' || v === 'ganso' || v === 'avestruz';
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const txt = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

type OfertaBase = Pick<OfertaIntercambioDTO, 'tipo' | 'item' | 'quantidade' | 'animal'>;

/** "7 ovos de galinha" / "1 ovo de pato" / "1 pato" (o mesmo texto que o servidor grava na auditoria). */
export function rotuloOferta(o: OfertaBase): string {
  if (o.tipo === 'animal') return o.animal ? `1 ${NOME_TIPO[o.animal].toLowerCase()}` : '1 animal';
  const q = o.quantidade ?? 0;
  return `${fmt.int(q)} ${q === 1 ? 'ovo' : 'ovos'} de ${o.item ? NOME_TIPO[tipoDoItem(o.item)].toLowerCase() : '?'}`;
}

/** "1 pato por 10 tickets" */
export const ofertaPorTickets = (o: OfertaBase & { custoTickets: number }): string => `${rotuloOferta(o)} por ${textoTickets(o.custoTickets)}`;

/** Preço de venda de um ovo (moedas × 100). */
export const precoOvoX100 = (item: Item): number => ANIMAIS[tipoDoItem(item)].precoOvoX100;

/** Valor de venda dos ovos de uma oferta (moedas × 100); null para animais. */
export function valorMercadoX100(o: Pick<OfertaIntercambioDTO, 'tipo' | 'item' | 'quantidade'>): number | null {
  return o.tipo === 'ovos' && o.item && o.quantidade ? o.quantidade * precoOvoX100(o.item) : null;
}

/** Valor dos ovos somado às comissões de afiliação que a venda deles geraria (arredonda para cima, como o servidor). */
export const comComissoesX100 = (valorX100: number, comissaoBp: number): number => Math.ceil((valorX100 * (10_000 + comissaoBp)) / 10_000);

const PCT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
/** pontos-base → "16%" / "12,5%" */
export const pctBp = (bp: number): string => `${PCT.format(bp / 100)}%`;

// ---------------------------------------------------------------- regra "sem lucro"

type OfertaRegra = Pick<OfertaIntercambioDTO, 'tipo' | 'item' | 'quantidade' | 'custoTickets' | 'ativo'>;

export interface AnaliseOferta {
  /** valor de venda dos ovos (null = animal: fora da regra) */
  valorX100: number | null;
  /** valor + comissões de afiliação da venda (é o que a regra compara) */
  valorComComissoesX100: number | null;
  /** quanto os tickets da troca custam em moedas, ao preço dado */
  custoX100: number;
  /** os ovos rendem mais do que a troca custa (calculado mesmo com a compra desligada, como previsão) */
  lucro: boolean;
  /** o servidor confere esta oferta agora (compra ligada, oferta de ovos ativa) */
  conferida: boolean;
}

/**
 * Regra "sem lucro": com a compra de tickets ligada, cada oferta de ovos ATIVA precisa custar, em moedas, pelo
 * menos o que os ovos rendem vendidos MAIS as comissões de afiliação dessa venda (senão daria para "fabricar"
 * moedas comprando tickets e vendendo os ovos). Animais não entram na conta.
 */
export function analisarOferta(o: OfertaRegra, config: Pick<ConfigIntercambioDTO, 'compraAtiva' | 'precoTicketX100'>, comissaoBp: number): AnaliseOferta {
  const valor = valorMercadoX100(o);
  const comComissoes = valor === null ? null : comComissoesX100(valor, comissaoBp);
  const custo = o.custoTickets * config.precoTicketX100;
  return {
    valorX100: valor,
    valorComComissoesX100: comComissoes,
    custoX100: custo,
    lucro: comComissoes !== null && comComissoes > custo,
    conferida: config.compraAtiva && o.ativo && valor !== null,
  };
}

/** As ofertas que o servidor recusaria com estas regras (vazio com a compra desligada). */
export function ofertasLucrativas<T extends OfertaRegra>(
  config: Pick<ConfigIntercambioDTO, 'compraAtiva' | 'precoTicketX100'>, ofertas: readonly T[], comissaoBp: number,
): T[] {
  if (!config.compraAtiva) return [];
  return ofertas.filter((o) => {
    const a = analisarOferta(o, config, comissaoBp);
    return a.conferida && a.lucro;
  });
}

/**
 * Menor preço do ticket (moedas × 100) com que nenhuma oferta de ovos ativa dá lucro, e a oferta que puxa esse
 * mínimo; null sem ofertas de ovos ativas.
 */
export function precoMinimoSemLucro<T extends OfertaRegra>(ofertas: readonly T[], comissaoBp: number): { precoX100: number; oferta: T } | null {
  let melhor: { precoX100: number; oferta: T } | null = null;
  for (const o of ofertas) {
    const valor = valorMercadoX100(o);
    if (!o.ativo || valor === null || o.custoTickets < 1) continue;
    const preco = Math.ceil(comComissoesX100(valor, comissaoBp) / o.custoTickets);
    if (!melhor || preco > melhor.precoX100) melhor = { precoX100: preco, oferta: o };
  }
  return melhor;
}

/** Como deixar uma oferta de ovos sem lucro: no máximo quantos ovos pelo mesmo custo, ou no mínimo quantos tickets. */
export function ajustesSemLucro(
  o: Pick<OfertaIntercambioDTO, 'tipo' | 'item' | 'quantidade' | 'custoTickets'>, precoTicketX100: number, comissaoBp: number,
): { maxOvos: number; minTickets: number } | null {
  if (o.tipo !== 'ovos' || !o.item || !o.quantidade || precoTicketX100 < 1) return null;
  const p = precoOvoX100(o.item);
  const custo = o.custoTickets * precoTicketX100;
  return {
    maxOvos: Math.floor((custo * 10_000) / (p * (10_000 + comissaoBp))),
    minTickets: Math.ceil(comComissoesX100(o.quantidade * p, comissaoBp) / precoTicketX100),
  };
}

// ---------------------------------------------------------------- regras (o que mudou)

const textoLimite = (l: number | null): string => (l === null ? 'sem limite' : `${fmt.int(l)} por dia`);

/** ["Intercâmbio: aberto → fechado", "compra: desligada → ligada", "preço: 10,00 → 12,00", "limite: sem limite → 5 por dia"] */
export function mudancasRegras(de: ConfigIntercambioDTO, para: ConfigIntercambioDTO): string[] {
  const m: string[] = [];
  if (de.ativo !== para.ativo) m.push(`Intercâmbio: ${de.ativo ? 'aberto' : 'fechado'} → ${para.ativo ? 'aberto' : 'fechado'}`);
  if (de.compraAtiva !== para.compraAtiva) m.push(`compra: ${de.compraAtiva ? 'ligada' : 'desligada'} → ${para.compraAtiva ? 'ligada' : 'desligada'}`);
  if (de.precoTicketX100 !== para.precoTicketX100) m.push(`preço: ${fmt.moedas(de.precoTicketX100)} → ${fmt.moedas(para.precoTicketX100)}`);
  if (de.limiteCompraDia !== para.limiteCompraDia) m.push(`limite: ${textoLimite(de.limiteCompraDia)} → ${textoLimite(para.limiteCompraDia)}`);
  return m;
}

/** "aberto · compra desligada · 10,00 por ticket · sem limite" */
export function resumoRegras(c: ConfigIntercambioDTO): string {
  return [
    c.ativo ? 'aberto' : 'fechado',
    c.compraAtiva ? 'compra ligada' : 'compra desligada',
    `${fmt.moedas(c.precoTicketX100)} por ticket`,
    c.limiteCompraDia === null ? 'sem limite diário' : `até ${textoTickets(c.limiteCompraDia)} por dia`,
  ].join(' · ');
}

/** Regras guardadas na auditoria (detalhes de 'configurar_intercambio'), conferidas campo a campo. */
export function lerRegras(v: unknown): ConfigIntercambioDTO | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const preco = num(o.precoTicketX100);
  const limite = o.limiteCompraDia;
  if (typeof o.ativo !== 'boolean' || typeof o.compraAtiva !== 'boolean' || preco === null) return null;
  if (limite !== null && num(limite) === null) return null;
  return { ativo: o.ativo, compraAtiva: o.compraAtiva, precoTicketX100: preco, limiteCompraDia: limite as number | null };
}

// ---------------------------------------------------------------- extrato de tickets (ficha do membro)

/** Oferta guardada nos detalhes de uma troca ({ tipo, item, quantidade, animal }). */
export function ofertaDosDetalhes(d: Record<string, unknown>): OfertaBase | null {
  if (d.tipo === 'animal' && ehTipo(d.animal)) return { tipo: 'animal', item: null, quantidade: null, animal: d.animal };
  const q = num(d.quantidade);
  if (d.tipo === 'ovos' && ehItem(d.item) && q !== null) return { tipo: 'ovos', item: d.item, quantidade: q, animal: null };
  return null;
}

/** Movimento de tickets em português: "Cupom PASCOA26", "Troca: 1 pato", "Ajuste: motivo", "Compra de tickets". */
export function descreverMovimento(m: MovimentoTicketDTO): { titulo: string; detalhe?: string } {
  const d = m.detalhes ?? {};
  switch (m.motivo) {
    case 'compra': {
      const preco = num(d.precoTicketX100);
      return {
        titulo: 'Compra de tickets',
        detalhe: preco !== null
          ? `${textoTickets(Math.abs(m.delta))} × ${fmt.moedas(preco)} = ${fmt.moedas(Math.abs(m.delta) * preco)} moedas do jogo`
          : 'paga com moedas do jogo',
      };
    }
    case 'cupom': {
      const codigo = txt(d.codigo);
      return { titulo: codigo ? `Cupom ${codigo}` : 'Cupom', detalhe: 'código resgatado no jogo' };
    }
    case 'troca': {
      const o = ofertaDosDetalhes(d);
      return {
        titulo: o ? `Troca: ${rotuloOferta(o)}` : 'Troca no Intercâmbio',
        detalhe: o?.tipo === 'animal' ? 'o animal foi para o ninho livre' : o ? 'os ovos foram para o estoque' : undefined,
      };
    }
    case 'ajuste': {
      const motivo = txt(d.motivo);
      return { titulo: motivo ? `Ajuste: ${motivo}` : 'Ajuste da equipe', detalhe: m.delta > 0 ? 'crédito da equipe' : 'débito da equipe' };
    }
    default:
      return { titulo: 'Movimento de tickets' };
  }
}

// Textos e formatos do Intercâmbio (tickets → ovos ou animais) e do resgate de cupons.
// REGRA DO PRODUTO: TICKET é um vale do jogo. Não existe dinheiro real: nada de "R$", cifrão, "dinheiro", PIX,
// saque ou depósito. Ticket vem de cupons (códigos da equipe), de presentes da equipe e — só se a equipe ligar —
// da compra com MOEDAS DO JOGO.
import type { MovimentoTicketDTO, OfertaIntercambioDTO } from '@galinheiro/api-contract';
import { ANIMAIS, ITENS, NOME_TIPO, NOME_TIPO_PLURAL_OVO, TIPOS, tipoDoItem, type Item, type Tipo } from '@galinheiro/game-core';

/** Frase obrigatória da tela (e do cartão da Loja, quando cabe). */
export const AVISO_TICKETS = 'Tickets são vales do jogo: não se compram com dinheiro.';

const INTEIRO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
/** 1250 → "1.250". */
export const numeroTickets = (n: number): string => INTEIRO.format(n);
/** "1 ticket" / "12 tickets". */
export const tickets = (n: number): string => `${numeroTickets(n)} ${n === 1 ? 'ticket' : 'tickets'}`;
/** "1 ovo" / "7 ovos". */
export const ovos = (n: number): string => `${numeroTickets(n)} ${n === 1 ? 'ovo' : 'ovos'}`;

export const ehItem = (v: unknown): v is Item => typeof v === 'string' && (ITENS as readonly string[]).includes(v);
export const ehTipo = (v: unknown): v is Tipo => typeof v === 'string' && (TIPOS as readonly string[]).includes(v);

/** Oferta já validada para a tela: ovos (item + quantidade) ou animal (espécie). */
export type OfertaTela =
  | { o: OfertaIntercambioDTO; tipo: 'ovos'; item: Item; especie: Tipo; quantidade: number }
  | { o: OfertaIntercambioDTO; tipo: 'animal'; especie: Tipo };

/** Separa as ofertas por tipo (mantendo a ordem do painel) e descarta as incompletas. */
export function separarOfertas(ofertas: OfertaIntercambioDTO[]): { ovos: OfertaTela[]; animais: OfertaTela[] } {
  const ovosL: OfertaTela[] = [];
  const animais: OfertaTela[] = [];
  for (const o of ofertas) {
    if (o.tipo === 'ovos' && ehItem(o.item) && o.quantidade && o.quantidade > 0) {
      ovosL.push({ o, tipo: 'ovos', item: o.item, especie: tipoDoItem(o.item), quantidade: o.quantidade });
    } else if (o.tipo === 'animal' && ehTipo(o.animal)) {
      animais.push({ o, tipo: 'animal', especie: o.animal });
    }
  }
  return { ovos: ovosL, animais };
}

/** "7 ovos de galinha" / "Pato". */
export function nomeOferta(of: OfertaTela): string {
  return of.tipo === 'ovos' ? `${ovos(of.quantidade)} de ${NOME_TIPO_PLURAL_OVO[of.especie]}` : NOME_TIPO[of.especie];
}

/** Quanto os ovos da oferta rendem vendidos (moedas do jogo × 100); para animais, quanto vale cada ovo dele. */
export function valorDaOfertaX100(of: OfertaTela): number {
  const preco = ANIMAIS[of.especie].precoOvoX100;
  return of.tipo === 'ovos' ? of.quantidade * preco : preco;
}

/** O que a troca entrega, numa frase curta para a confirmação e os toasts: "7 ovos de galinha" / "1 pato". */
export function entregaDaOferta(of: OfertaTela): string {
  return of.tipo === 'ovos' ? `${ovos(of.quantidade)} de ${NOME_TIPO_PLURAL_OVO[of.especie]}` : `1 ${NOME_TIPO[of.especie].toLowerCase()}`;
}

// ---------------------------------------------------------------- histórico

export type TipoMovimento = 'compra' | 'cupom' | 'troca-ovos' | 'troca-animal' | 'presente' | 'ajuste';

export interface MovimentoTela {
  tipo: TipoMovimento;
  titulo: string;
  /** espécie do ovo/animal da troca (para o ícone) */
  especie?: Tipo;
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Linha do histórico: "Compra de tickets", "Cupom PASCOA26", "Troca: 1 pato", "Presente da equipe"… */
export function descreverMovimento(m: MovimentoTicketDTO): MovimentoTela {
  const d = m.detalhes ?? {};
  switch (m.motivo) {
    case 'compra':
      return { tipo: 'compra', titulo: 'Compra de tickets' };
    case 'cupom': {
      const codigo = texto(d.codigo);
      return { tipo: 'cupom', titulo: codigo ? `Cupom ${codigo}` : 'Cupom' };
    }
    case 'troca': {
      if (ehTipo(d.animal)) return { tipo: 'troca-animal', titulo: `Troca: 1 ${NOME_TIPO[d.animal].toLowerCase()}`, especie: d.animal };
      if (ehItem(d.item)) {
        const especie = tipoDoItem(d.item);
        const q = numero(d.quantidade);
        return { tipo: 'troca-ovos', titulo: `Troca: ${q ? ovos(q) : 'ovos'} de ${NOME_TIPO_PLURAL_OVO[especie]}`, especie };
      }
      return { tipo: 'troca-ovos', titulo: 'Troca' };
    }
    default:
      // ajuste da equipe: crédito é presente; débito é correção (o motivo interno não aparece para o jogador)
      return m.delta > 0 ? { tipo: 'presente', titulo: 'Presente da equipe' } : { tipo: 'ajuste', titulo: 'Ajuste da equipe' };
  }
}

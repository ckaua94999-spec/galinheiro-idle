import { ANIMAIS, CONFIG, ITENS, type Item, type Tipo } from './config';

export type Inventario = Record<Item, number>;

export const itemDe = (tipo: Tipo): Item => `ovo_${tipo}`;
export const tipoDoItem = (item: Item): Tipo => item.slice(4) as Tipo;

export const inventarioVazio = (): Inventario => ({ ovo_codorna: 0, ovo_galinha: 0, ovo_pato: 0, ovo_ganso: 0, ovo_avestruz: 0 });

export function valorVendaX100(itens: Partial<Inventario>): number {
  let total = 0;
  for (const [item, qtd] of Object.entries(itens) as [Item, number][]) {
    if (!Number.isInteger(qtd) || qtd < 0) throw new RangeError(`quantidade inválida para ${item}`);
    total += qtd * ANIMAIS[tipoDoItem(item)].precoOvoX100;
  }
  return total;
}

export const totalDeOvos = (inv: Inventario): number => ITENS.reduce((s, i) => s + inv[i], 0);

export const capacidade = (nivel: number): number => nivel * CONFIG.galinheiro.ninhosPorNivel;

const FMT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatarMoedas = (x100: number): string => FMT.format(x100 / 100);

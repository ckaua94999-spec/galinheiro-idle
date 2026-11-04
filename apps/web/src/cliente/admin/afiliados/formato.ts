// Formatos e textos do programa de convites no painel (funções puras): % a partir de pontos-base, leitura da %
// digitada, nomes dos níveis, simulação de uma venda e o resumo do que mudou na configuração (usado também na
// auditoria). Tudo em MOEDAS DO JOGO: a comissão é paga pelo jogo e nada sai do jogo.
import type { ConfigAfiliadosDTO } from '@galinheiro/api-contract';
import { fmt } from '../ui';

/** Quantos níveis o programa aceita (o servidor confere de novo). */
export const NIVEIS_MAX = 5;
/** Máximo por nível, em pontos-base (50%). */
export const BP_MAX = 5000;
/** Teto diário máximo: 1.000.000,00 moedas (o mínimo, 1,00, vem com a mensagem do próprio schema). */
export const TETO_MAX_X100 = 100_000_000;
/** Padrão do jogo (o mesmo do servidor). */
export const CONFIG_PADRAO: ConfigAfiliadosDTO = { ativo: true, comissoesBp: [1000, 400, 200], tetoDiarioX100: 20_000 };

const PCT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2, useGrouping: false });

/** pontos-base → "10%", "2,5%", "12,25%" */
export const pct = (bp: number): string => `${PCT.format(bp / 100)}%`;

/** pontos-base → texto do campo ("10", "2,5", "12,25") */
export const bpParaTexto = (bp: number): string => PCT.format(bp / 100);

/**
 * % digitada → pontos-base (1000 = 10%). Aceita "10", "10,5", "10.25", ",5" e "2,5 %". Devolve null se não for
 * um número com até 2 casas decimais. Negativos passam (o servidor recusa com a própria mensagem).
 */
export function lerPercentual(texto: string): number | null {
  const t = texto.trim().replace(/[\s%]/g, '').replace(',', '.');
  if (!/^-?(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** "a, b e c" */
export function juntar(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/** teto em centavos → "200,00" / "sem teto" */
export const textoTeto = (x100: number | null): string => (x100 === null ? 'sem teto' : fmt.moedas(x100));

/** Quem recebe em cada nível, do ponto de vista de uma venda. */
export function quemRecebe(nivel: number): string {
  return nivel === 1 ? 'quem convidou quem vendeu' : `quem convidou o nível ${nivel - 1}`;
}

/** Os níveis abaixo de um membro: 1 = indicados diretos, 2 = convidados pelos diretos… */
export function nomeNivelAbaixo(nivel: number): string {
  if (nivel === 1) return 'indicados diretos';
  if (nivel === 2) return 'convidados pelos diretos';
  return `convidados pelo nível ${nivel - 1}`;
}

// ---------------------------------------------------------------- simulação

export interface LinhaSimulacao {
  nivel: number;
  bp: number;
  valorX100: number;
}

/** O que cada nível recebe numa venda (arredonda para baixo, como o servidor). */
export function simularVenda(comissoesBp: readonly number[], vendaX100: number): { linhas: LinhaSimulacao[]; totalX100: number; totalBp: number } {
  const linhas = comissoesBp.map((bp, i) => ({ nivel: i + 1, bp, valorX100: Math.floor((Math.max(0, vendaX100) * bp) / 10_000) }));
  return {
    linhas,
    totalX100: linhas.reduce((s, l) => s + l.valorX100, 0),
    totalBp: comissoesBp.reduce((s, bp) => s + bp, 0),
  };
}

/** Quanto os indicados precisam vender no dia para quem está no nível dado bater o teto (null sem teto ou sem %). */
export function vendaParaTeto(tetoX100: number | null, bp: number): number | null {
  if (tetoX100 === null || bp <= 0) return null;
  return Math.ceil((tetoX100 * 10_000) / bp);
}

// ---------------------------------------------------------------- o que mudou

/** Configuração guardada na auditoria (detalhes de 'configurar_afiliados'), conferida campo a campo. */
export function lerConfig(v: unknown): ConfigAfiliadosDTO | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const bp = Array.isArray(o.comissoesBp) ? o.comissoesBp : null;
  if (typeof o.ativo !== 'boolean' || !bp || !bp.every((x) => typeof x === 'number' && Number.isFinite(x))) return null;
  const teto = o.tetoDiarioX100;
  if (teto !== null && (typeof teto !== 'number' || !Number.isFinite(teto))) return null;
  return { ativo: o.ativo, comissoesBp: bp as number[], tetoDiarioX100: teto as number | null };
}

/** ["Nível 1: 10% → 12%", "Nível 4: novo, 1%", "teto: 200,00 → sem teto", "pausou"] */
export function mudancasConfig(de: ConfigAfiliadosDTO, para: ConfigAfiliadosDTO): string[] {
  const m: string[] = [];
  const n = Math.max(de.comissoesBp.length, para.comissoesBp.length);
  for (let i = 0; i < n; i++) {
    const a = de.comissoesBp[i];
    const b = para.comissoesBp[i];
    if (a === b) continue;
    if (a === undefined && b !== undefined) m.push(`Nível ${i + 1}: novo, ${pct(b)}`);
    else if (b === undefined && a !== undefined) m.push(`Nível ${i + 1}: removido (era ${pct(a)})`);
    else if (a !== undefined && b !== undefined) m.push(`Nível ${i + 1}: ${pct(a)} → ${pct(b)}`);
  }
  if (de.tetoDiarioX100 !== para.tetoDiarioX100) m.push(`teto: ${textoTeto(de.tetoDiarioX100)} → ${textoTeto(para.tetoDiarioX100)}`);
  if (de.ativo !== para.ativo) m.push(para.ativo ? 'ligou' : 'pausou');
  return m;
}

/** "10% / 4% / 2% · teto 200,00 · ligado" */
export function resumoConfig(c: ConfigAfiliadosDTO): string {
  return [c.comissoesBp.map(pct).join(' / '), c.tetoDiarioX100 === null ? 'sem teto' : `teto ${fmt.moedas(c.tetoDiarioX100)}`, c.ativo ? 'ligado' : 'pausado'].join(' · ');
}

export const mesmaConfig = (a: ConfigAfiliadosDTO, b: ConfigAfiliadosDTO): boolean => mudancasConfig(a, b).length === 0;

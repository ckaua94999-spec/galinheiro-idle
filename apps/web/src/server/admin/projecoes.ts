// Projeções do painel (funções puras, testadas): tendência por regressão linear resistente a picos, com faixa
// de ±1,96·σ dos resíduos, e o POTENCIAL de ovos dos animais ativos (todo ciclo coletado na hora, pelas regras
// do game-core).
// Dias são strings 'AAAA-MM-DD' no horário de Brasília (UTC−3 fixo).
import type { SerieDTO, SerieProjetadaDTO } from '@galinheiro/api-contract';
import { ANIMAIS, CONFIG, MS_DIA, MS_HORA, TIERS, tierDe, vidaEm, type Tipo } from '@galinheiro/game-core';

/** Dia (AAAA-MM-DD) de um instante, no horário de Brasília. */
export const diaBr = (ms: number): string => new Date(ms - 3 * MS_HORA).toISOString().slice(0, 10);

/** Soma `n` dias a um dia AAAA-MM-DD. */
export function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

export interface Regressao {
  /** y = a + b·x, com x = 0, 1, 2… */
  a: number;
  b: number;
  /** desvio-padrão dos resíduos */
  sigma: number;
  r2: number;
}

/** Mínimos quadrados sobre y[0..n-1] (x = índice). */
export function regressaoLinear(ys: readonly number[]): Regressao {
  const n = ys.length;
  if (n === 0) return { a: 0, b: 0, sigma: 0, r2: 0 };
  if (n === 1) return { a: ys[0]!, b: 0, sigma: 0, r2: 0 };
  const mx = (n - 1) / 2;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  ys.forEach((y, x) => {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
  });
  const b = sxx === 0 ? 0 : sxy / sxx;
  const a = my - b * mx;
  let sse = 0;
  let sst = 0;
  ys.forEach((y, x) => {
    sse += (y - (a + b * x)) ** 2;
    sst += (y - my) ** 2;
  });
  return { a, b, sigma: n > 2 ? Math.sqrt(sse / (n - 2)) : 0, r2: sst === 0 ? 1 : 1 - sse / sst };
}

function quantil(xs: readonly number[], q: number): number {
  if (xs.length === 0) return 0;
  const o = [...xs].sort((p, r) => p - r);
  const pos = q * (o.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return o[lo]! + (o[hi]! - o[lo]!) * (pos - lo);
}

/**
 * Regressão resistente a picos (ex.: um ajuste de saldo enorme num dia só, que sozinho entortaria a reta).
 * Uma reta robusta (Theil–Sen: mediana das inclinações entre todos os pares de dias) mede o desvio típico
 * (3º quartil dos resíduos); dias que fogem mais de 4× disso são aparados até esse limite e os mínimos
 * quadrados rodam sobre a série aparada. Sem picos, dá o mesmo que `regressaoLinear`. Se 3/4 dos dias caem
 * exatamente na reta (série constante ou quase só zeros), não há como separar pico de normal: nada é aparado.
 */
export function regressaoResistente(ys: readonly number[]): Regressao {
  const n = ys.length;
  if (n < 4) return regressaoLinear(ys);
  const inclinacoes: number[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) inclinacoes.push((ys[j]! - ys[i]!) / (j - i));
  const b = quantil(inclinacoes, 0.5);
  const a = quantil(ys.map((y, x) => y - b * x), 0.5);
  const limite = 4 * quantil(ys.map((y, x) => Math.abs(y - (a + b * x))), 0.75);
  if (limite === 0) return regressaoLinear(ys);
  return regressaoLinear(ys.map((y, x) => Math.min(Math.max(y, a + b * x - limite), a + b * x + limite)));
}

/**
 * Projeta `dias` dias depois do último ponto da série, pela tendência dos últimos `janela` dias (padrão 28),
 * resistente a picos isolados. Faixa = ±1,96·σ, que cresce de leve com a distância. Nunca negativo.
 */
export function projetarTendencia(serie: readonly SerieDTO[], dias: number, janela = 28): SerieProjetadaDTO[] {
  const ultimo = serie[serie.length - 1];
  if (!ultimo || dias <= 0) return [];
  const base = serie.slice(-janela);
  const { a, b, sigma } = regressaoResistente(base.map((p) => p.valor));
  const n = base.length;
  return Array.from({ length: dias }, (_, i) => {
    const x = n - 1 + (i + 1);
    const valor = Math.max(0, a + b * x);
    const margem = 1.96 * sigma * Math.sqrt(1 + (i + 1) / Math.max(1, n));
    return { dia: somarDias(ultimo.dia, i + 1), valor, min: Math.max(0, valor - margem), max: valor + margem };
  });
}

/** Acumula uma projeção diária sobre um total inicial (ex.: novos membros por dia → total de membros). */
export function acumularProjecao(inicial: number, diaria: readonly SerieProjetadaDTO[]): SerieProjetadaDTO[] {
  let v = inicial;
  let vMin = inicial;
  let vMax = inicial;
  return diaria.map((p) => {
    v += p.valor;
    vMin += p.min;
    vMax += p.max;
    return { dia: p.dia, valor: v, min: vMin, max: vMax };
  });
}

/** Projeção de um saldo: começa no último valor e soma (entradas − saídas) projetadas a cada dia. */
export function projetarSaldo(inicial: number, entradas: readonly SerieProjetadaDTO[], saidas: readonly SerieProjetadaDTO[]): SerieProjetadaDTO[] {
  let v = inicial;
  let vMin = inicial;
  let vMax = inicial;
  return entradas.map((e, i) => {
    const s = saidas[i] ?? { valor: 0, min: 0, max: 0 };
    v += e.valor - s.valor;
    vMin += e.min - s.max;
    vMax += e.max - s.min;
    return { dia: e.dia, valor: Math.max(0, v), min: Math.max(0, vMin), max: Math.max(0, vMax) };
  });
}

export interface AnimalParaProjecao {
  tipo: Tipo;
  vidaAncora: number;
  vidaAncoraEmMs: number;
  fatorPct: number;
  expiracaoMs: number;
  /** fim do ciclo atual */
  proximoRendimentoMs: number;
  /** ovos do ciclo atual (o servidor já sabe) */
  ovosPendentes: number;
}

/** Ovos esperados por coleta num tier: 1 garantido + 2 chances de q = 0,5·mult (E = 1 + 2q). */
export function ovosEsperados(tier: keyof typeof TIERS): number {
  const q = (CONFIG.ciclo.limiarExtraBase * TIERS[tier].multPct) / 100 / 10_000;
  return 1 + 2 * q;
}

/**
 * Potencial de ovos por dia (e o valor deles em moedas, se vendidos) dos animais ATIVOS, de `agoraMs` até
 * `dias` dias à frente, supondo que todo ciclo pronto é coletado na hora e o próximo começa em seguida
 * (sem animais novos). O ciclo atual conta com os ovos já sorteados; os seguintes, com a esperança.
 */
export function potencialDeOvos(animais: readonly AnimalParaProjecao[], agoraMs: number, dias: number): { dia: string; ovos: number; valorX100: number }[] {
  const hoje = diaBr(agoraMs);
  const fim = agoraMs + dias * MS_DIA;
  const porDia = new Map<string, { ovos: number; valorX100: number }>();
  const somar = (ms: number, ovos: number, tipo: Tipo) => {
    const dia = diaBr(Math.max(ms, agoraMs));
    const atual = porDia.get(dia) ?? { ovos: 0, valorX100: 0 };
    atual.ovos += ovos;
    atual.valorX100 += ovos * ANIMAIS[tipo].precoOvoX100;
    porDia.set(dia, atual);
  };
  for (const a of animais) {
    let pronto = Math.max(a.proximoRendimentoMs, agoraMs);
    if (pronto > fim || a.proximoRendimentoMs > a.expiracaoMs) continue;
    somar(pronto, a.ovosPendentes, a.tipo);
    // ciclos seguintes: começam quando o anterior é coletado (na hora)
    for (let guarda = 0; guarda < 200; guarda++) {
      const inicio = pronto;
      if (inicio >= a.expiracaoMs) break;
      const tier = tierDe(vidaEm({ vidaAncora: a.vidaAncora, vidaAncoraEmMs: a.vidaAncoraEmMs, fatorPct: a.fatorPct }, inicio)) ?? 'triste';
      pronto = Math.min(inicio + (CONFIG.ciclo.baseH + TIERS[tier].atrasoH) * MS_HORA, a.expiracaoMs);
      if (pronto > fim) break;
      somar(pronto, ovosEsperados(tier), a.tipo);
    }
  }
  return Array.from({ length: dias + 1 }, (_, i) => {
    const dia = somarDias(hoje, i);
    const v = porDia.get(dia) ?? { ovos: 0, valorX100: 0 };
    return { dia, ovos: v.ovos, valorX100: Math.round(v.valorX100) };
  });
}

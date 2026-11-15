// Chuva de Ovos: caça-níquel de cascata com moedas do jogo (sem dinheiro real).
//
// Grade de 6 colunas × 5 linhas. Paga quando 8 ou mais símbolos iguais aparecem em qualquer lugar da grade. Os
// premiados estouram, os de cima caem e entram novos por cima (cascata), até não haver mais prêmio. Cada cascata
// seguida vale mais: a 2ª paga em dobro, a 3ª em triplo… até ×5. Ovos de ouro ("bombas") trazem um multiplicador:
// no fim da cascata, se houve prêmio, a soma deles multiplica o ganho. Quatro ou mais ninhos dão rodadas grátis (e,
// nelas, três ou mais dão rodadas extras).
//
// O servidor sorteia tudo (jogarChuva) e devolve cada quadro da cascata; o cliente só encena. O retorno médio
// (CONFIG_CHUVA.retornoPct) é medido por simulação no teste e aparece na tela antes da aposta.
import type { Rng } from './ciclo';

export type SimboloChuva =
  | 'pena_azul' | 'pena_vermelha' | 'asa'
  | 'ovo_codorna' | 'ovo_galinha' | 'ovo_pato' | 'ovo_ganso' | 'ovo_avestruz'
  | 'ninho' | 'bomba';

/** Símbolos que pagam por quantidade (do mais comum ao mais valioso). */
export const PAGANTES_CHUVA = [
  'pena_azul', 'pena_vermelha', 'asa', 'ovo_codorna', 'ovo_galinha', 'ovo_pato', 'ovo_ganso', 'ovo_avestruz',
] as const satisfies readonly SimboloChuva[];
export type PaganteChuva = (typeof PAGANTES_CHUVA)[number];

export const NOME_SIMBOLO_CHUVA: Record<SimboloChuva, string> = {
  pena_azul: 'Pena azul', pena_vermelha: 'Pena vermelha', asa: 'Asa',
  ovo_codorna: 'Ovo de codorna', ovo_galinha: 'Ovo de galinha', ovo_pato: 'Ovo de pato', ovo_ganso: 'Ovo de ganso',
  ovo_avestruz: 'Ovo de avestruz', ninho: 'Ninho de ouro', bomba: 'Ovo de ouro',
};

type Pesos = Record<SimboloChuva, number>;

export const CONFIG_CHUVA = {
  colunas: 6,
  linhas: 5,
  minimoIguais: 8,
  apostaMinX100: 100,
  apostaMaxX100: 5_000,
  /** Prêmio máximo de uma jogada (giro + rodadas grátis), em vezes a aposta. */
  tetoVezes: 2_000,
  /** Cascatas por rodada (trava de segurança; na prática acaba muito antes). */
  maxCascatas: 40,
  /** Multiplicador da cascata: a 1ª paga ×1, a 2ª ×2… até este teto. */
  cascataMultMax: 5,
  /** Rodadas grátis numa jogada, no máximo. */
  maxGratis: 50,
  rodadasGratis: { ninhos: 4, rodadas: 10, ninhosExtra: 3, extras: 5 },
  /** Chance relativa de cada símbolo em cada casa. Nas grátis, mais ninhos e ovos de ouro. */
  pesosBase: {
    pena_azul: 170, pena_vermelha: 155, asa: 140, ovo_codorna: 125, ovo_galinha: 110, ovo_pato: 95, ovo_ganso: 80,
    ovo_avestruz: 65, ninho: 24, bomba: 3,
  } satisfies Pesos,
  pesosGratis: {
    pena_azul: 170, pena_vermelha: 155, asa: 140, ovo_codorna: 125, ovo_galinha: 110, ovo_pato: 95, ovo_ganso: 80,
    ovo_avestruz: 65, ninho: 10, bomba: 10,
  } satisfies Pesos,
  /** Pagamento em % da aposta por quantidade: [8–9, 10–11, 12 ou mais] (antes do multiplicador da cascata). */
  pagamentos: {
    pena_azul: [30, 60, 120],
    pena_vermelha: [40, 80, 160],
    asa: [50, 100, 200],
    ovo_codorna: [60, 120, 250],
    ovo_galinha: [80, 160, 320],
    ovo_pato: [100, 200, 500],
    ovo_ganso: [120, 300, 800],
    ovo_avestruz: [200, 600, 1_500],
  } satisfies Record<PaganteChuva, readonly [number, number, number]>,
  /** Ninhos no giro pago também pagam, em % da aposta (4, 5 ou 6+). */
  pagamentoNinhos: [200, 500, 5_000] as const,
  /** Multiplicadores dos ovos de ouro e a chance relativa de cada um. */
  bombas: { valores: [2, 3, 4, 5, 8, 10, 15, 25, 50, 100], pesos: [300, 220, 160, 120, 70, 50, 30, 15, 6, 2] },
  /**
   * Medido por simulação (1,5 milhão de jogadas; o teste confere): de cada 100 moedas apostadas voltam em média 97,
   * 1 em cada 3 giros paga alguma coisa (em 15% dos giros o prêmio passa da aposta) e as rodadas grátis saem a cada
   * ~95 giros.
   */
  retornoPct: 97,
  acertoPct: 34,
  gratisACada: 95,
};

export interface CelulaChuva {
  /** id único na jogada: o cliente anima a queda seguindo o mesmo id */
  i: number;
  s: SimboloChuva;
  /** multiplicador do ovo de ouro */
  x?: number;
}
/** `pagoX100` já vem com o multiplicador da cascata. */
export interface GanhoChuva { s: PaganteChuva; n: number; pagoX100: number }
export interface PassoChuva {
  /** grade[coluna][linha], linha 0 = topo */
  grade: CelulaChuva[][];
  /** multiplicador desta cascata (1 na primeira, 2 na segunda… até cascataMultMax) */
  mult: number;
  ganhos: GanhoChuva[];
  /** ids que estouram neste passo (vazio no último) */
  estouram: number[];
}
export interface RodadaChuva {
  gratis: boolean;
  passos: PassoChuva[];
  ninhos: number;
  /** multiplicadores dos ovos de ouro na grade final */
  bombas: number[];
  /** soma das bombas quando houve prêmio de símbolos; senão 1 */
  multiplicador: number;
  ganhoSimbolosX100: number;
  ganhoNinhosX100: number;
  /** ganho da rodada: símbolos × multiplicador + ninhos */
  ganhoX100: number;
  rodadasGanhas: number;
}
export interface ResultadoChuva {
  apostaX100: number;
  rodadas: RodadaChuva[];
  /** total da jogada (já com o teto) */
  premioX100: number;
  bateuTeto: boolean;
}

function sortearPeso<T>(rng: Rng, itens: readonly T[], pesos: readonly number[]): T {
  const total = pesos.reduce((s, p) => s + p, 0);
  let r = rng.int(total);
  for (let k = 0; k < itens.length; k++) {
    r -= pesos[k]!;
    if (r < 0) return itens[k]!;
  }
  return itens[itens.length - 1]!;
}

const SIMBOLOS = Object.keys(CONFIG_CHUVA.pesosBase) as SimboloChuva[];

/** Multiplicador da k-ésima cascata (k = 0 é a primeira). */
export const multDaCascata = (k: number): number => Math.min(k + 1, CONFIG_CHUVA.cascataMultMax);

/** Pagamento (em % da aposta) de n símbolos iguais; 0 abaixo do mínimo. */
export function pagamentoPct(s: PaganteChuva, n: number): number {
  if (n < CONFIG_CHUVA.minimoIguais) return 0;
  const [a, b, c] = CONFIG_CHUVA.pagamentos[s];
  return n >= 12 ? c : n >= 10 ? b : a;
}

export function pagamentoNinhosPct(n: number): number {
  if (n < CONFIG_CHUVA.rodadasGratis.ninhos) return 0;
  return CONFIG_CHUVA.pagamentoNinhos[Math.min(n, 6) - 4]!;
}

const vezes = (apostaX100: number, pct: number) => Math.floor((apostaX100 * pct) / 100);

/** Uma rodada completa (grade inicial + cascatas). `proximoId` numera as casas da jogada inteira. */
function rodada(apostaX100: number, gratis: boolean, rng: Rng, proximoId: { n: number }): RodadaChuva {
  const { colunas, linhas, maxCascatas, rodadasGratis } = CONFIG_CHUVA;
  const pesos = gratis ? CONFIG_CHUVA.pesosGratis : CONFIG_CHUVA.pesosBase;
  const listaPesos = SIMBOLOS.map((s) => pesos[s]);
  const nova = (): CelulaChuva => {
    const s = sortearPeso(rng, SIMBOLOS, listaPesos);
    const c: CelulaChuva = { i: proximoId.n++, s };
    if (s === 'bomba') c.x = sortearPeso(rng, CONFIG_CHUVA.bombas.valores, CONFIG_CHUVA.bombas.pesos);
    return c;
  };
  let grade: CelulaChuva[][] = Array.from({ length: colunas }, () => Array.from({ length: linhas }, nova));
  const passos: PassoChuva[] = [];
  let ganhoSimbolosX100 = 0;
  for (let k = 0; k < maxCascatas; k++) {
    const contagem = new Map<SimboloChuva, number>();
    for (const col of grade) for (const c of col) contagem.set(c.s, (contagem.get(c.s) ?? 0) + 1);
    const mult = multDaCascata(k);
    const ganhos: GanhoChuva[] = [];
    for (const s of PAGANTES_CHUVA) {
      const n = contagem.get(s) ?? 0;
      const pct = pagamentoPct(s, n);
      if (pct > 0) ganhos.push({ s, n, pagoX100: vezes(apostaX100, pct) * mult });
    }
    if (!ganhos.length) {
      passos.push({ grade, mult, ganhos, estouram: [] });
      break;
    }
    const premiados = new Set<SimboloChuva>(ganhos.map((g) => g.s));
    const estouram = grade.flat().filter((c) => premiados.has(c.s)).map((c) => c.i);
    passos.push({ grade, mult, ganhos, estouram });
    ganhoSimbolosX100 += ganhos.reduce((s, g) => s + g.pagoX100, 0);
    // cascata: em cada coluna, os que ficam descem e os novos entram por cima
    grade = grade.map((col) => {
      const ficam = col.filter((c) => !premiados.has(c.s));
      return [...Array.from({ length: linhas - ficam.length }, nova), ...ficam];
    });
  }
  const final = passos[passos.length - 1]!.grade.flat();
  const ninhos = final.filter((c) => c.s === 'ninho').length;
  const bombas = final.filter((c) => c.s === 'bomba').map((c) => c.x ?? 0);
  const multiplicador = ganhoSimbolosX100 > 0 && bombas.length ? bombas.reduce((s, x) => s + x, 0) : 1;
  const ganhoNinhosX100 = gratis ? 0 : vezes(apostaX100, pagamentoNinhosPct(ninhos));
  const rodadasGanhas = gratis
    ? (ninhos >= rodadasGratis.ninhosExtra ? rodadasGratis.extras : 0)
    : (ninhos >= rodadasGratis.ninhos ? rodadasGratis.rodadas : 0);
  return {
    gratis,
    passos,
    ninhos,
    bombas,
    multiplicador,
    ganhoSimbolosX100,
    ganhoNinhosX100,
    ganhoX100: ganhoSimbolosX100 * multiplicador + ganhoNinhosX100,
    rodadasGanhas,
  };
}

/** Uma jogada: o giro pago e as rodadas grátis que ele (e elas) ganharem. */
export function jogarChuva(apostaX100: number, rng: Rng): ResultadoChuva {
  const proximoId = { n: 1 };
  const rodadas: RodadaChuva[] = [rodada(apostaX100, false, rng, proximoId)];
  let pendentes = rodadas[0]!.rodadasGanhas;
  let feitas = 0;
  while (pendentes > 0 && feitas < CONFIG_CHUVA.maxGratis) {
    const r = rodada(apostaX100, true, rng, proximoId);
    rodadas.push(r);
    pendentes += r.rodadasGanhas - 1;
    feitas++;
  }
  const bruto = rodadas.reduce((s, r) => s + r.ganhoX100, 0);
  const teto = apostaX100 * CONFIG_CHUVA.tetoVezes;
  return { apostaX100, rodadas, premioX100: Math.min(bruto, teto), bateuTeto: bruto > teto };
}

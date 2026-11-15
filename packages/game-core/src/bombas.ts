// Ovos-Bomba: caça-níquel de 5 colunas × 3 linhas com 20 linhas de pagamento e moedas do jogo (sem dinheiro real).
//
// A graça são os ovos-bomba: param com o rolo, ficam PRESOS na casa e contam regressivamente a cada giro, enquanto
// os outros símbolos continuam girando. Quando a contagem zera, o ovo explode nas casas VIZINHAS do padrão dele (em
// pé = cima e baixo, deitado = os dois lados, cruz = os quatro lados, X = as quatro pontas na diagonal) e a casa da
// bomba e as atingidas viram o MESMO símbolo sorteado. Bomba presa atingida por outra explosão detona junto (reação
// em cadeia). Enquanto está presa, a bomba ocupa a casa e interrompe as linhas que passam por ela.
//
// Como as bombas ficam de um giro para o outro, cada valor de aposta tem o próprio tabuleiro (`EstadoBombas`): não
// dá para esperar a bomba com aposta baixa e explodir com aposta alta. O servidor sorteia tudo (girarBombas) e
// devolve o roteiro do giro; o cliente só encena. O retorno médio é medido por simulação no teste.
import type { Rng } from './ciclo';
import { PAGANTES_CHUVA, type PaganteChuva } from './chuva';

export type TipoBomba = 'vertical' | 'horizontal' | 'cruz' | 'xis';
export const TIPOS_BOMBA: readonly TipoBomba[] = ['vertical', 'horizontal', 'cruz', 'xis'];
export const NOME_BOMBA: Record<TipoBomba, string> = {
  vertical: 'Em pé', horizontal: 'Deitado', cruz: 'Em cruz', xis: 'Em X',
};
export const ALCANCE_BOMBA: Record<TipoBomba, string> = {
  vertical: 'a casa de cima e a de baixo',
  horizontal: 'as casas dos dois lados',
  cruz: 'as quatro casas coladas (cima, baixo e lados)',
  xis: 'as quatro casas das pontas, na diagonal',
};

/** Linhas de pagamento: a fileira (0 = de cima) em cada uma das 5 colunas. */
export const LINHAS_BOMBAS: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 0, 0], [2, 2, 1, 2, 2], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [1, 1, 0, 1, 1], [1, 1, 2, 1, 1],
  [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [0, 2, 0, 2, 0], [2, 0, 2, 0, 2], [0, 2, 2, 2, 0],
];

type Pesos = Record<PaganteChuva, number>;

export const CONFIG_BOMBAS = {
  colunas: 5,
  linhas: 3,
  /** Apostas possíveis (cada uma com o próprio tabuleiro de bombas). */
  apostasX100: [100, 200, 500, 1_000, 2_500, 5_000] as readonly number[],
  /** Chance relativa de cada símbolo em cada casa (rolos bem misturados: poucas linhas pagam sem ajuda de bomba). */
  pesos: {
    pena_azul: 170, pena_vermelha: 160, asa: 150, ovo_codorna: 140, ovo_galinha: 130, ovo_pato: 110, ovo_ganso: 80,
    ovo_avestruz: 60,
  } satisfies Pesos,
  /** Chance relativa do símbolo que as explosões deixam nas casas atingidas. */
  pesosMisterio: {
    pena_azul: 200, pena_vermelha: 180, asa: 160, ovo_codorna: 140, ovo_galinha: 120, ovo_pato: 100, ovo_ganso: 60,
    ovo_avestruz: 40,
  } satisfies Pesos,
  /** Pagamento de cada linha, em vezes a aposta da linha (aposta ÷ 20), para 3, 4 e 5 iguais a partir da esquerda. */
  pagamentos: {
    // 3 iguais dos cinco símbolos mais comuns pagam menos que a aposta (20 = a aposta inteira): o prêmio de verdade
    // está em 4 e 5 iguais e nos ovos raros.
    pena_azul: [10, 35, 110],
    pena_vermelha: [12, 45, 135],
    asa: [14, 55, 175],
    ovo_codorna: [16, 85, 250],
    ovo_galinha: [19, 110, 350],
    ovo_pato: [55, 180, 475],
    ovo_ganso: [95, 300, 800],
    ovo_avestruz: [225, 500, 1_000],
  } satisfies Record<PaganteChuva, readonly [number, number, number]>,
  bomba: {
    /** Chance de uma bomba nova parar em cada casa livre, em pontos-base (100 = 1%): uma a cada ~5 giros. */
    chancePorCasaBp: 150,
    /** Com este tanto de bombas presas, não vem bomba nova. */
    maxPresas: 4,
    /** A bomba nova chega com uma contagem sorteada nesta faixa (em giros). */
    contagemMin: 3,
    contagemMax: 9,
    pesosTipo: { vertical: 35, horizontal: 30, cruz: 20, xis: 15 } satisfies Record<TipoBomba, number>,
  },
  /**
   * Medidos por simulação (2,8 milhões de giros; o teste confere): de cada 100 moedas apostadas voltam em média 81,
   * 24% dos giros pagam alguma coisa (em 12% o prêmio passa da aposta), sai uma explosão a cada ~6 giros (uma em
   * cada sete com reação em cadeia) e fica em média 1 bomba presa no tabuleiro (3 ou mais só em 14% dos giros).
   * Metade do retorno vem dos giros com explosão. Prêmio máximo: a tela toda de ovo de avestruz, 1.000× a aposta.
   */
  retornoPct: 81,
  acertoPct: 24,
  explosaoACada: 6,
  premioMaxVezes: 1_000,
};

/** Bomba presa numa casa (coluna c, fileira l), com quantos giros faltam para explodir. */
export interface BombaPresa { id: number; c: number; l: number; tipo: TipoBomba; contagem: number }
/** Tabuleiro que fica de um giro para o outro (um por valor de aposta). */
export interface EstadoBombas { bombas: BombaPresa[]; seq: number }
export const ESTADO_BOMBAS_VAZIO: EstadoBombas = { bombas: [], seq: 1 };

export interface ExplosaoBombas {
  /** id da bomba que explodiu */
  id: number;
  tipo: TipoBomba;
  /** casas atingidas ([coluna, fileira]), a da própria bomba inclusive */
  casas: [number, number][];
  /** id da bomba que a detonou em cadeia; null = a contagem zerou */
  por: number | null;
}
export interface LinhaPremiada { linha: number; s: PaganteChuva; n: number; pagoX100: number }
export interface ResultadoBombas {
  apostaX100: number;
  /** símbolos que caíram: grade[coluna][fileira] (o das casas com bomba fica escondido atrás dela) */
  grade: PaganteChuva[][];
  /** bombas no tabuleiro neste giro, já com a contagem deste giro (0 = explode agora); inclui as novas */
  bombas: BombaPresa[];
  /** ids das bombas que caíram neste giro */
  novas: number[];
  /** explosões na ordem em que acontecem */
  explosoes: ExplosaoBombas[];
  /** símbolo que as casas atingidas viram (null sem explosão) */
  misterio: PaganteChuva | null;
  /** grade depois das explosões; null nas casas com bomba que continua presa */
  final: (PaganteChuva | null)[][];
  linhas: LinhaPremiada[];
  premioX100: number;
  /** tabuleiro para o próximo giro */
  proximo: EstadoBombas;
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

export const ehApostaBombas = (x100: number): boolean => CONFIG_BOMBAS.apostasX100.includes(x100);

/** Vizinhas que cada tipo atinge, como [coluna, fileira] a partir da casa da bomba. */
const VIZINHAS: Record<TipoBomba, readonly (readonly [number, number])[]> = {
  vertical: [[0, -1], [0, 1]],
  horizontal: [[-1, 0], [1, 0]],
  cruz: [[0, -1], [0, 1], [-1, 0], [1, 0]],
  xis: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
};

/** Casas atingidas pela explosão de uma bomba: a própria casa (sempre a 1ª) e as vizinhas do padrão que existem. */
export function casasDaExplosao(b: Pick<BombaPresa, 'c' | 'l' | 'tipo'>): [number, number][] {
  const { colunas, linhas } = CONFIG_BOMBAS;
  const casas: [number, number][] = [[b.c, b.l]];
  for (const [dc, dl] of VIZINHAS[b.tipo]) {
    const c = b.c + dc;
    const l = b.l + dl;
    if (c >= 0 && c < colunas && l >= 0 && l < linhas) casas.push([c, l]);
  }
  return casas;
}

/** Prêmio de uma linha com n iguais (em centavos de moeda), para a aposta total. */
export function pagamentoLinhaX100(apostaX100: number, s: PaganteChuva, n: number): number {
  if (n < 3) return 0;
  return Math.floor((apostaX100 * CONFIG_BOMBAS.pagamentos[s][Math.min(n, 5) - 3]!) / LINHAS_BOMBAS.length);
}

/** Confere as 20 linhas numa grade final (null = casa com bomba presa, que interrompe a linha). */
export function conferirLinhas(apostaX100: number, final: (PaganteChuva | null)[][]): LinhaPremiada[] {
  const premiadas: LinhaPremiada[] = [];
  LINHAS_BOMBAS.forEach((fileiras, linha) => {
    const s = final[0]![fileiras[0]!];
    if (!s) return;
    let n = 1;
    while (n < fileiras.length && final[n]![fileiras[n]!] === s) n++;
    const pagoX100 = pagamentoLinhaX100(apostaX100, s, n);
    if (pagoX100 > 0) premiadas.push({ linha, s, n, pagoX100 });
  });
  return premiadas;
}

/** Um giro: conta as bombas presas, sorteia a grade e as bombas novas, detona, revela o símbolo e confere as linhas. */
export function girarBombas(apostaX100: number, estado: EstadoBombas, rng: Rng): ResultadoBombas {
  const { colunas, linhas, pesos, pesosMisterio, bomba: cfg } = CONFIG_BOMBAS;
  const listaPesos = PAGANTES_CHUVA.map((s) => pesos[s]);
  let seq = estado.seq;

  // 1) as bombas presas contam um giro
  const bombas: BombaPresa[] = estado.bombas.map((b) => ({ ...b, contagem: Math.max(0, b.contagem - 1) }));
  const ocupada = new Set(bombas.map((b) => `${b.c},${b.l}`));

  // 2) a grade cai; em cada casa livre pode vir uma bomba nova (até o limite de bombas presas)
  const grade: PaganteChuva[][] = [];
  const novas: number[] = [];
  for (let c = 0; c < colunas; c++) {
    const col: PaganteChuva[] = [];
    for (let l = 0; l < linhas; l++) {
      col.push(sortearPeso(rng, PAGANTES_CHUVA, listaPesos));
      if (ocupada.has(`${c},${l}`) || bombas.length >= cfg.maxPresas) continue;
      if (rng.int(10_000) < cfg.chancePorCasaBp) {
        const tipo = sortearPeso(rng, TIPOS_BOMBA, TIPOS_BOMBA.map((t) => cfg.pesosTipo[t]));
        const contagem = cfg.contagemMin + rng.int(cfg.contagemMax - cfg.contagemMin + 1);
        const nova: BombaPresa = { id: seq++, c, l, tipo, contagem };
        bombas.push(nova);
        novas.push(nova.id);
        ocupada.add(`${c},${l}`);
      }
    }
    grade.push(col);
  }

  // 3) quem zerou explode; bomba atingida por uma explosão detona junto (reação em cadeia)
  const explosoes: ExplosaoBombas[] = [];
  const explodiu = new Set<number>();
  const fila: { b: BombaPresa; por: number | null }[] = bombas.filter((b) => b.contagem === 0).map((b) => ({ b, por: null }));
  while (fila.length) {
    const { b, por } = fila.shift()!;
    if (explodiu.has(b.id)) continue;
    explodiu.add(b.id);
    const casas = casasDaExplosao(b);
    explosoes.push({ id: b.id, tipo: b.tipo, casas, por });
    const atingidas = new Set(casas.map(([c, l]) => `${c},${l}`));
    for (const outra of bombas) {
      if (!explodiu.has(outra.id) && atingidas.has(`${outra.c},${outra.l}`)) fila.push({ b: outra, por: b.id });
    }
  }

  // 4) todas as casas atingidas viram o mesmo símbolo misterioso
  const misterio = explosoes.length ? sortearPeso(rng, PAGANTES_CHUVA, PAGANTES_CHUVA.map((s) => pesosMisterio[s])) : null;
  const final: (PaganteChuva | null)[][] = grade.map((col) => [...col]);
  const restantes = bombas.filter((b) => !explodiu.has(b.id));
  for (const b of restantes) final[b.c]![b.l] = null;
  if (misterio) for (const e of explosoes) for (const [c, l] of e.casas) final[c]![l] = misterio;

  // 5) confere as linhas
  const linhasPremiadas = conferirLinhas(apostaX100, final);
  return {
    apostaX100,
    grade,
    bombas,
    novas,
    explosoes,
    misterio,
    final,
    linhas: linhasPremiadas,
    premioX100: linhasPremiadas.reduce((s, x) => s + x.pagoX100, 0),
    proximo: { bombas: restantes, seq },
  };
}

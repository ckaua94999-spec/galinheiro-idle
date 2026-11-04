// Sorteio determinístico (LCG) da cena A: a mesma semente gera o mesmo desenho no servidor e no cliente
// (nada de Math.random() no render: a hidratação compara o HTML).
export function sorteio(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Número com 1 casa (SVG e CSS mais curtos, iguais no servidor e no cliente). */
export const r1 = (n: number) => Math.round(n * 10) / 10;

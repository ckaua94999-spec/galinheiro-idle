// Ovos-Bomba: padrões de explosão, linhas de pagamento, contagem das bombas presas e o retorno medido.
import { describe, expect, it } from 'vitest';
import {
  CONFIG_BOMBAS, ESTADO_BOMBAS_VAZIO, LINHAS_BOMBAS, casasDaExplosao, conferirLinhas, ehApostaBombas, girarBombas,
  pagamentoLinhaX100, type EstadoBombas, type PaganteChuva, type Rng,
} from '../src';

const lcg = (semente: number): Rng => {
  let x = semente;
  return { int: (n) => { x = (x * 48271) % 2147483647; return x % n; } };
};
const chave = (casas: [number, number][]) => casas.map(([c, l]) => `${c},${l}`).sort().join(' ');

describe('Ovos-Bomba (caça-níquel de bombas presas, moedas do jogo)', () => {
  it('cada tipo de bomba atinge a própria casa e as vizinhas do seu padrão', () => {
    expect(chave(casasDaExplosao({ c: 2, l: 1, tipo: 'vertical' }))).toBe('2,0 2,1 2,2');
    expect(chave(casasDaExplosao({ c: 2, l: 1, tipo: 'horizontal' }))).toBe('1,1 2,1 3,1');
    expect(chave(casasDaExplosao({ c: 2, l: 1, tipo: 'cruz' }))).toBe('1,1 2,0 2,1 2,2 3,1');
    expect(chave(casasDaExplosao({ c: 2, l: 1, tipo: 'xis' }))).toBe('1,0 1,2 2,1 3,0 3,2');
    // na borda só valem as vizinhas que existem; a 1ª casa é sempre a da bomba
    expect(chave(casasDaExplosao({ c: 0, l: 0, tipo: 'xis' }))).toBe('0,0 1,1');
    expect(chave(casasDaExplosao({ c: 4, l: 2, tipo: 'cruz' }))).toBe('3,2 4,1 4,2');
    expect(casasDaExplosao({ c: 3, l: 0, tipo: 'horizontal' })[0]).toEqual([3, 0]);
  });

  it('20 linhas, 3 a 5 iguais a partir da esquerda; bomba presa interrompe a linha', () => {
    expect(LINHAS_BOMBAS).toHaveLength(20);
    expect(new Set(LINHAS_BOMBAS.map((l) => l.join(''))).size).toBe(20);
    const tudo = (s: PaganteChuva): (PaganteChuva | null)[][] => Array.from({ length: 5 }, () => [s, s, s]);
    // tela cheia do melhor símbolo = prêmio máximo
    const cheia = conferirLinhas(100, tudo('ovo_avestruz'));
    expect(cheia).toHaveLength(20);
    expect(cheia.reduce((s, x) => s + x.pagoX100, 0)).toBe(100 * CONFIG_BOMBAS.premioMaxVezes);
    expect(pagamentoLinhaX100(200, 'pena_azul', 3)).toBe(100); // 10 × a aposta da linha (200 ÷ 20)
    expect(pagamentoLinhaX100(200, 'pena_azul', 2)).toBe(0);
    // uma bomba presa na 1ª coluna mata as linhas que começam nela
    const comBomba = tudo('asa');
    comBomba[0]![1] = null;
    expect(conferirLinhas(100, comBomba).every((x) => LINHAS_BOMBAS[x.linha]![0] !== 1)).toBe(true);
    // uma bomba presa na 4ª coluna corta a linha em 3 iguais
    const corta = tudo('asa');
    corta[3]![1] = null;
    expect(conferirLinhas(100, corta).find((x) => x.linha === 0)).toMatchObject({ n: 3 });
  });

  it('só as apostas da lista valem', () => {
    expect(ehApostaBombas(200)).toBe(true);
    expect(ehApostaBombas(150)).toBe(false);
    for (const a of CONFIG_BOMBAS.apostasX100) expect(a % LINHAS_BOMBAS.length).toBe(0); // divide certo pelas 20 linhas
  });

  it('a bomba presa conta um giro por giro, explode no zero e some do tabuleiro', () => {
    const semBombaNova = { ...CONFIG_BOMBAS.bomba };
    CONFIG_BOMBAS.bomba.chancePorCasaBp = 0;
    try {
      let estado: EstadoBombas = { bombas: [{ id: 1, c: 1, l: 1, tipo: 'horizontal', contagem: 2 }], seq: 2 };
      const rng = lcg(5);
      const g1 = girarBombas(100, estado, rng);
      expect(g1.explosoes).toHaveLength(0);
      expect(g1.bombas[0]!.contagem).toBe(1);
      expect(g1.final[1]![1]).toBeNull(); // a casa da bomba não paga enquanto ela está presa
      estado = g1.proximo;
      const g2 = girarBombas(100, estado, rng);
      expect(g2.explosoes).toEqual([expect.objectContaining({ id: 1, tipo: 'horizontal', por: null })]);
      expect(g2.misterio).not.toBeNull();
      for (let c = 0; c < 3; c++) expect(g2.final[c]![1]).toBe(g2.misterio); // a bomba e as duas vizinhas viram o mesmo símbolo
      expect(g2.final[3]![1]).toBe(g2.grade[3]![1]); // o resto da fileira fica como parou
      const reta = g2.linhas.find((x) => x.linha === 0)!; // 3 iguais a partir da esquerda: a linha do meio paga
      expect(reta.s).toBe(g2.misterio);
      expect(reta.n).toBeGreaterThanOrEqual(3);
      expect(g2.proximo.bombas).toHaveLength(0);
    } finally {
      Object.assign(CONFIG_BOMBAS.bomba, semBombaNova);
    }
  });

  it('reação em cadeia: a bomba atingida detona junto, mesmo com contagem alta', () => {
    const antes = { ...CONFIG_BOMBAS.bomba };
    CONFIG_BOMBAS.bomba.chancePorCasaBp = 0;
    try {
      const estado: EstadoBombas = {
        bombas: [
          { id: 1, c: 0, l: 1, tipo: 'horizontal', contagem: 1 },
          { id: 2, c: 1, l: 1, tipo: 'vertical', contagem: 9 }, // vizinha da 1ª: detona junto
          { id: 3, c: 2, l: 1, tipo: 'vertical', contagem: 9 }, // na mesma fileira, mas a duas casas: continua presa
        ],
        seq: 4,
      };
      const g = girarBombas(100, estado, lcg(9));
      expect(g.explosoes.map((e) => [e.id, e.por])).toEqual([[1, null], [2, 1]]);
      expect(g.final[1]!.every((s) => s === g.misterio)).toBe(true);
      expect(g.final[2]![1]).toBeNull();
      expect(g.proximo.bombas.map((b) => b.id)).toEqual([3]);
      expect(g.proximo.bombas[0]!.contagem).toBe(8);
    } finally {
      Object.assign(CONFIG_BOMBAS.bomba, antes);
    }
  });

  it('cada giro é coerente com o tabuleiro que recebeu', () => {
    const rng = lcg(3);
    let estado = ESTADO_BOMBAS_VAZIO;
    for (let k = 0; k < 20_000; k++) {
      const r = girarBombas(200, estado, rng);
      expect(r.bombas.length).toBeLessThanOrEqual(CONFIG_BOMBAS.bomba.maxPresas);
      expect(new Set(r.bombas.map((b) => `${b.c},${b.l}`)).size).toBe(r.bombas.length); // nunca duas na mesma casa
      for (const b of estado.bombas) expect(r.bombas.find((x) => x.id === b.id)?.contagem).toBe(b.contagem - 1);
      const explodiram = new Set(r.explosoes.map((e) => e.id));
      for (const b of r.bombas) if (b.contagem === 0) expect(explodiram.has(b.id)).toBe(true);
      expect(r.proximo.bombas.map((b) => b.id)).toEqual(r.bombas.filter((b) => !explodiram.has(b.id)).map((b) => b.id));
      expect(r.misterio === null).toBe(r.explosoes.length === 0);
      expect(r.premioX100).toBe(r.linhas.reduce((s, x) => s + x.pagoX100, 0));
      expect(r.linhas).toEqual(conferirLinhas(200, r.final));
      expect(r.premioX100).toBeLessThanOrEqual(200 * CONFIG_BOMBAS.premioMaxVezes);
      estado = r.proximo;
    }
  });

  it(`retorno médio perto do anunciado (${CONFIG_BOMBAS.retornoPct}%) e abaixo de 100%`, () => {
    const rng = lcg(1);
    const N = 400_000;
    let estado = ESTADO_BOMBAS_VAZIO;
    let pago = 0;
    let acertos = 0;
    let explosoes = 0;
    for (let k = 0; k < N; k++) {
      const r = girarBombas(100, estado, rng);
      estado = r.proximo;
      pago += r.premioX100;
      if (r.premioX100 > 0) acertos++;
      if (r.explosoes.length) explosoes++;
    }
    const rtp = pago / (N * 100);
    expect(rtp).toBeGreaterThan(CONFIG_BOMBAS.retornoPct / 100 - 0.025);
    expect(rtp).toBeLessThan(Math.min(1, CONFIG_BOMBAS.retornoPct / 100 + 0.025));
    expect(Math.abs(acertos / N - CONFIG_BOMBAS.acertoPct / 100)).toBeLessThan(0.015);
    expect(Math.abs(N / explosoes - CONFIG_BOMBAS.explosaoACada)).toBeLessThan(0.5);
  }, 60_000);
});

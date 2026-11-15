// Valores de referência do GDD (3.4.5 e Apêndice D).
import { describe, expect, it } from 'vitest';
import {
  CONFIG, MS_DIA, MS_HORA, anguloResultado, capacidade, contemPalavraImpropria, deveAposentar, diasRestantes,
  ehUltimoCiclo, efeitosDoTier, faixaDe, formatarMoedas, formatarTimer, formatarTimerCurto, iniciarCiclo,
  inicioDoProximoCiclo, nomePadrao, rotacaoFinal, setorSobPonteiro, sortearOvos, sortearRoleta, tierDe,
  validarNome, valorVendaX100, vidaEm, vidaExibida, type Rng, type Tier,
  ANIMAIS, FAIXAS_ROLETA, GALOS, lutarRinha, premioRinhaX100, retornoMedioRinhaPct,
  CONFIG_CHUVA, jogarChuva, multDaCascata, pagamentoNinhosPct, pagamentoPct,
} from '../src';

const fixo = (valores: number[]): Rng => {
  let i = 0;
  return { int: () => valores[i++ % valores.length]! };
};
const VIDA_UTIL = CONFIG.vida.vidaUtilMs;

describe('vida (3.4.5)', () => {
  const casos: [string, number, number, number, Tier | null, number | null][] = [
    ['V1', 100, 0, 100, 'feliz', 100],
    ['V2', 100, 1_943_136_000, 75.011111, 'feliz', 76],
    ['V3', 100, 1_944_000_000, 75, 'neutro', 75],
    ['V4', 100, 3_888_000_000, 50, 'cansado', 50],
    ['V5', 100, 5_832_000_000, 25, 'triste', 25],
    ['V6', 100, 7_775_136_000, 0.011111, 'triste', 1],
    ['V7', 100, 7_776_000_000, 0, null, 0],
    ['V8', 90, 7_776_000_000, 10, 'triste', null],
    ['V9', 80, 7_290_000_000, 25, 'triste', 25],
    ['V10', 70, 5_554_285_714, 50.0000000026, 'neutro', 51],
    ['V11', 70, 5_554_285_715, 49.9999999936, 'cansado', 50],
    ['V12', 70, 7_776_000_000, 30, 'cansado', null],
  ];
  it.each(casos)('%s', (_id, fator, idade, vidaEsperada, tierEsperado, exibida) => {
    const v = vidaEm({ vidaAncora: 100, vidaAncoraEmMs: 0, fatorPct: fator }, idade);
    expect(v).toBeCloseTo(vidaEsperada, 5);
    expect(tierDe(v)).toBe(tierEsperado);
    if (exibida !== null) expect(vidaExibida(v)).toBe(exibida);
  });

  it('aposenta por idade mesmo com vida sobrando (raro aos 90 dias)', () => {
    const e = { vidaAncora: 100, vidaAncoraEmMs: 0, fatorPct: 90, expiracaoMs: VIDA_UTIL };
    expect(deveAposentar(e, VIDA_UTIL)).toBe(true);
    expect(deveAposentar(e, VIDA_UTIL - 1)).toBe(false);
  });

  it('vida nunca sobe sem âncora nova', () => {
    const base = { vidaAncora: 100, vidaAncoraEmMs: 0, fatorPct: 100 };
    let anterior = 101;
    for (let t = 0; t <= VIDA_UTIL; t += MS_HORA * 7) {
      const v = vidaEm(base, t);
      expect(v).toBeLessThanOrEqual(anterior);
      anterior = v;
    }
  });

  it('efeitos do tier', () => {
    expect(efeitosDoTier('feliz')).toMatchObject({ rendimentoPct: 100, chanceTresOvosPct: 25, atrasoH: 0, duracaoCicloH: 24 });
    expect(efeitosDoTier('neutro').chanceTresOvosPct).toBe(14.06);
    expect(efeitosDoTier('cansado').chanceTresOvosPct).toBe(6.25);
    expect(efeitosDoTier('triste')).toMatchObject({ chanceTresOvosPct: 1.56, duracaoCicloH: 36 });
  });
});

describe('ciclo (Apêndice D)', () => {
  const ent = (vida: number) => ({ vidaAncora: vida, vidaAncoraEmMs: 0, fatorPct: 100, expiracaoMs: 10_000 * MS_HORA });
  it.each([
    ['C1', 80, 'feliz', 24, 5000],
    ['C2', 60, 'neutro', 26, 3750],
    ['C3', 30, 'cansado', 30, 2500],
    ['C4', 10, 'triste', 36, 1250],
  ] as const)('%s', (_id, vida, tier, horas, limiar) => {
    const c = iniciarCiclo(ent(vida), 0, fixo([limiar - 1, limiar]));
    expect(c).toMatchObject({ tier, prontoEmMs: horas * MS_HORA, ovos: 2 });
    expect(iniciarCiclo(ent(vida), 0, fixo([0, 0])).ovos).toBe(3);
    expect(iniciarCiclo(ent(vida), 0, fixo([9999, 9999])).ovos).toBe(1);
  });

  it('C5: último ciclo encurtado até a expiração', () => {
    const e = { vidaAncora: 100, vidaAncoraEmMs: 0, fatorPct: 100, expiracaoMs: VIDA_UTIL };
    const c = iniciarCiclo(e, VIDA_UTIL - 10 * MS_HORA, fixo([9999]));
    expect(c.prontoEmMs).toBe(VIDA_UTIL);
    expect(c.tier).toBe('triste');
    expect(ehUltimoCiclo(c.prontoEmMs, VIDA_UTIL)).toBe(true);
  });

  it('C6: janela de graça de 4 h', () => {
    const H = MS_HORA;
    expect(inicioDoProximoCiclo(8 * H, 15 * H)).toBe(11 * H);
    expect(inicioDoProximoCiclo(8 * H, 12 * H)).toBe(8 * H);
    expect(inicioDoProximoCiclo(8 * H, 11.5 * H)).toBe(8 * H);
    expect(inicioDoProximoCiclo(8 * H, 32 * H)).toBe(28 * H);
  });

  it('ovos sempre em {1,2,3}', () => {
    let s = 1;
    const prng: Rng = { int: (n) => { s = (s * 16807) % 2147483647; return s % n; } };
    for (const t of ['feliz', 'neutro', 'cansado', 'triste'] as const) {
      for (let i = 0; i < 2000; i++) expect([1, 2, 3]).toContain(sortearOvos(t, prng));
    }
  });
});

describe('roleta (Apêndice D)', () => {
  it.each([
    [0, 'codorna'], [2999, 'codorna'], [3000, 'galinha'], [5999, 'galinha'], [6000, 'pato'], [8499, 'pato'],
    [8500, 'ganso'], [9699, 'ganso'], [9700, 'avestruz'], [9999, 'avestruz'],
  ] as const)('faixa %i → %s', (r, tipo) => expect(faixaDe(r).tipo).toBe(tipo));

  it('ângulos de referência', () => {
    expect(anguloResultado(0)).toBeCloseTo(1.5175, 4);
    expect(anguloResultado(1234)).toBeCloseTo(44.7075, 4);
    expect(anguloResultado(3000)).toBeCloseTo(109.5175, 4);
    expect(anguloResultado(6000)).toBeCloseTo(217.517, 3);
    expect(anguloResultado(9712)).toBeCloseTo(351.025, 3);
    expect(anguloResultado(9999)).toBeCloseTo(358.487, 3);
  });

  it('ângulo sempre dentro do setor, longe das divisórias', () => {
    for (let r = 0; r < 10_000; r++) {
      const a = anguloResultado(r);
      const f = faixaDe(r);
      expect(a).toBeGreaterThan(f.grauInicio + 1.49);
      expect(a).toBeLessThan(f.grauInicio + f.largura - 1.49);
    }
  });

  it('rotação final deixa o ângulo sob o ponteiro', () => {
    expect(rotacaoFinal(0, 100)).toBe(2060);
    const r2 = rotacaoFinal(2060, 351.025);
    expect(r2 - 2060).toBeGreaterThanOrEqual(1800);
    expect((351.025 + r2) % 360).toBeCloseTo(0, 6);
    for (const r of [0, 1234, 6000, 9712, 9999]) {
      const rot = rotacaoFinal(777, anguloResultado(r));
      expect(setorSobPonteiro(rot)).toBe(['codorna', 'galinha', 'pato', 'ganso', 'avestruz'].indexOf(faixaDe(r).tipo));
    }
  });

  it('frequências (400 mil giros) dentro de ±0,2 p.p.', () => {
    const cont = { codorna: 0, galinha: 0, pato: 0, ganso: 0, avestruz: 0 };
    let s = 42;
    const prng: Rng = { int: (n) => { s = (s * 48271) % 2147483647; return s % n; } };
    const N = 400_000;
    for (let i = 0; i < N; i++) cont[sortearRoleta(prng).tipo]++;
    expect(cont.codorna / N).toBeCloseTo(0.3, 2);
    expect(cont.galinha / N).toBeCloseTo(0.3, 2);
    expect(Math.abs(cont.codorna - cont.galinha) / N).toBeLessThan(0.004);
    expect(cont.pato / N).toBeCloseTo(0.25, 2);
    expect(cont.ganso / N).toBeCloseTo(0.12, 2);
    expect(Math.abs(cont.avestruz / N - 0.03)).toBeLessThan(0.002);
  });
});

describe('economia (Apêndice D)', () => {
  it('venda e formatação', () => {
    expect(valorVendaX100({ ovo_galinha: 6, ovo_pato: 2 })).toBe(1080);
    expect(valorVendaX100({ ovo_galinha: 10, ovo_avestruz: 3 })).toBe(2400);
    expect(valorVendaX100({ ovo_galinha: 9, ovo_pato: 2 })).toBe(1440);
    expect(() => valorVendaX100({ ovo_galinha: 1.5 })).toThrow();
    expect(formatarMoedas(123450)).toMatch(/^1\.234,50$/);
    expect(capacidade(32)).toBe(128);
  });
  it('codorna: 0,35 por ovo, é o animal de boas-vindas e sai na roleta com a mesma chance da galinha', () => {
    expect(ANIMAIS.codorna.precoOvoX100).toBe(35);
    expect(valorVendaX100({ ovo_codorna: 4 })).toBe(140);
    expect(CONFIG.animalBoasVindas).toBe('codorna');
    expect(CONFIG.roleta.liberacaoX100).toBe(1_200);
    const chance = (t: string) => FAIXAS_ROLETA.filter((f) => f.tipo === t).reduce((s, f) => s + f.ate - f.de + 1, 0);
    expect(chance('codorna')).toBe(3_000);
    expect(chance('codorna')).toBe(chance('galinha'));
  });
  it('dias restantes', () => {
    expect(diasRestantes(VIDA_UTIL, 0)).toBe(90);
    expect(diasRestantes(VIDA_UTIL, 1)).toBe(90);
    expect(diasRestantes(VIDA_UTIL, MS_DIA + 1)).toBe(89);
  });
});

describe('nomes', () => {
  it.each([['Pipoca', true], ['  Pipoca Turbo ', true], ['Olívia', true], ["D'Ávila-Jr.", true]] as const)('válido: %s', (n, ok) => {
    expect(validarNome(n).ok).toBe(ok);
  });
  it.each([
    ['', 'VAZIO'], ['   ', 'VAZIO'], ['A  B', 'ESPACOS'], ['123', 'SEM_LETRA'],
    ['abcdefghijklmnopqrstu', 'LONGO_DEMAIS'], ['Pipoca 🐔', 'CARACTERE_INVALIDO'],
  ] as const)('inválido: "%s" (%s)', (n, motivo) => {
    const r = validarNome(n);
    expect(r.ok).toBe(false);
    if (!r.ok && r.erro === 'NOME_INVALIDO') expect(r.motivo).toBe(motivo);
  });
  it('filtro de palavras (com leetspeak e repetição) sem falsos positivos óbvios', () => {
    expect(contemPalavraImpropria('p0rr4')).toBe(true);
    expect(contemPalavraImpropria('Poooorra')).toBe(true);
    expect(contemPalavraImpropria('p.o.r.r.a')).toBe(true);
    expect(validarNome('Merda Total')).toMatchObject({ ok: false, erro: 'NOME_IMPROPRIO' });
    for (const ok of ['Cuscuz', 'Pintada', 'Computador', 'Paçoca', 'Bolota', 'Cacau']) {
      expect(contemPalavraImpropria(ok)).toBe(false);
    }
  });
  it('nome padrão evita os que estão em uso', () => {
    const emUso = new Set(['Pipoca', 'Cocó']);
    for (let i = 0; i < 50; i++) expect(emUso.has(nomePadrao('galinha', emUso, { int: (n) => i % n }))).toBe(false);
  });
});

describe('tempo', () => {
  it('formatos de timer', () => {
    expect(formatarTimer(5 * MS_HORA + 12 * 60_000 + 33_000)).toBe('05:12:33');
    expect(formatarTimer(36 * MS_HORA - 1000)).toBe('35:59:59');
    expect(formatarTimer(-5)).toBe('00:00:00');
    expect(formatarTimerCurto(5 * MS_HORA + 12 * 60_000)).toBe('05:12');
    expect(formatarTimerCurto(42 * 60_000 + 10_000)).toBe('42:10');
  });
});

describe('rinha de galo (moedas do jogo)', () => {
  let semente = 7;
  const prng: Rng = { int: (n) => { semente = (semente * 48271) % 2147483647; return semente % n; } };
  it('a casa leva vantagem em todos os galos', () => {
    for (const g of GALOS) expect(retornoMedioRinhaPct(g)).toBeLessThan(100);
    expect(retornoMedioRinhaPct('favorito')).toBe(88);
    expect(premioRinhaX100(1_000, 'brigao')).toBe(2_200);
    expect(premioRinhaX100(333, 'favorito')).toBe(532);
  });
  it('o resultado vem só do sorteio e a luta termina com o perdedor no chão', () => {
    expect(lutarRinha('favorito', fixo([5_499, 0])).venceu).toBe(true);
    expect(lutarRinha('favorito', fixo([5_500, 0])).venceu).toBe(false);
    for (let i = 0; i < 2_000; i++) {
      const g = GALOS[i % GALOS.length]!;
      const r = lutarRinha(g, prng);
      expect(r.venceu).toBe(r.rngValor < CONFIG.rinha.galos[g].chanceBp);
      const fim = r.golpes.at(-1)!;
      expect(r.venceu ? fim.vidaRival : fim.vidaJogador).toBe(0);
      expect(r.venceu ? fim.vidaJogador : fim.vidaRival).toBeGreaterThan(0);
      expect(r.golpes.length).toBeLessThanOrEqual(15);
      for (const x of r.golpes) expect(x.dano).toBeGreaterThanOrEqual(0);
    }
  });
  it('frequência de vitórias bate com a chance anunciada', () => {
    const N = 100_000;
    let v = 0;
    for (let i = 0; i < N; i++) if (lutarRinha('azarao', prng).venceu) v++;
    expect(Math.abs(v / N - 0.15)).toBeLessThan(0.005);
  });
});

describe('Chuva de Ovos (caça-níquel de cascata, moedas do jogo)', () => {
  const lcg = (semente: number): Rng => {
    let x = semente;
    return { int: (n) => { x = (x * 48271) % 2147483647; return x % n; } };
  };
  it('tabela: 8–9, 10–11 e 12+ iguais; ninhos a partir de 4', () => {
    expect(pagamentoPct('pena_azul', 7)).toBe(0);
    expect(pagamentoPct('pena_azul', 8)).toBe(30);
    expect(pagamentoPct('pena_azul', 11)).toBe(60);
    expect(pagamentoPct('ovo_avestruz', 30)).toBe(1_500);
    expect(pagamentoNinhosPct(3)).toBe(0);
    expect(pagamentoNinhosPct(4)).toBe(200);
    expect(pagamentoNinhosPct(9)).toBe(5_000);
    // cada cascata seguida vale mais, até o teto
    expect([0, 1, 2, 3, 4, 5, 9].map(multDaCascata)).toEqual([1, 2, 3, 4, 5, 5, 5]);
  });
  it('cada quadro é coerente: grade 6×5, prêmios com 8+, cascata só troca quem estourou', () => {
    const rng = lcg(3);
    for (let k = 0; k < 3_000; k++) {
      const r = jogarChuva(100, rng);
      let soma = 0;
      for (const rd of r.rodadas) {
        rd.passos.forEach((p, idx) => {
          expect(p.grade).toHaveLength(CONFIG_CHUVA.colunas);
          for (const col of p.grade) expect(col).toHaveLength(CONFIG_CHUVA.linhas);
          expect(p.mult).toBe(multDaCascata(idx));
          for (const g of p.ganhos) {
            expect(p.grade.flat().filter((c) => c.s === g.s)).toHaveLength(g.n);
            // o prêmio do grupo é a tabela × o multiplicador da cascata
            expect(g.pagoX100).toBe(pagamentoPct(g.s, g.n) * p.mult);
          }
          const ultimo = idx === rd.passos.length - 1;
          expect(p.ganhos.length === 0).toBe(ultimo);
          if (!ultimo) {
            const sai = new Set(p.estouram);
            const ficam = p.grade.flat().filter((c) => !sai.has(c.i)).map((c) => c.i).sort((a, b) => a - b);
            const depois = rd.passos[idx + 1]!.grade.flat().map((c) => c.i);
            expect(depois.filter((i) => ficam.includes(i)).sort((a, b) => a - b)).toEqual(ficam);
            for (let col = 0; col < CONFIG_CHUVA.colunas; col++) {
              // quem fica desce na mesma coluna e na mesma ordem
              const antes = p.grade[col]!.filter((c) => !sai.has(c.i)).map((c) => c.i);
              expect(rd.passos[idx + 1]!.grade[col]!.slice(CONFIG_CHUVA.linhas - antes.length).map((c) => c.i)).toEqual(antes);
            }
          }
        });
        expect(rd.multiplicador).toBe(rd.ganhoSimbolosX100 > 0 && rd.bombas.length ? rd.bombas.reduce((a, b) => a + b, 0) : 1);
        expect(rd.ganhoX100).toBe(rd.ganhoSimbolosX100 * rd.multiplicador + rd.ganhoNinhosX100);
        soma += rd.ganhoX100;
      }
      expect(r.premioX100).toBe(Math.min(soma, 100 * CONFIG_CHUVA.tetoVezes));
      expect(r.rodadas.length - 1).toBeLessThanOrEqual(CONFIG_CHUVA.maxGratis);
    }
  });
  it(`retorno médio perto do anunciado (${CONFIG_CHUVA.retornoPct}%) e abaixo de 100%`, () => {
    const rng = lcg(1);
    const N = 300_000;
    let pago = 0;
    let acertos = 0;
    let gratis = 0;
    for (let k = 0; k < N; k++) {
      const r = jogarChuva(100, rng);
      pago += r.premioX100;
      if (r.premioX100 > 0) acertos++;
      if (r.rodadas.length > 1) gratis++;
    }
    const rtp = pago / (N * 100);
    expect(rtp).toBeGreaterThan(CONFIG_CHUVA.retornoPct / 100 - 0.035);
    expect(rtp).toBeLessThan(CONFIG_CHUVA.retornoPct / 100 + 0.035);
    expect(rtp).toBeLessThan(1);
    expect(Math.abs(acertos / N - CONFIG_CHUVA.acertoPct / 100)).toBeLessThan(0.02);
    expect(Math.abs(N / gratis - CONFIG_CHUVA.gratisACada)).toBeLessThan(20);
  }, 60_000);
});

// Projeções do painel administrador (funções puras).
import { describe, expect, it } from 'vitest';
import { MS_DIA, MS_HORA } from '@galinheiro/game-core';
import {
  acumularProjecao, diaBr, ovosEsperados, potencialDeOvos, projetarSaldo, projetarTendencia, regressaoLinear, regressaoResistente,
  somarDias,
} from '@/server/admin/projecoes';

describe('datas no horário de Brasília', () => {
  it('diaBr usa UTC−3 e somarDias atravessa meses', () => {
    expect(diaBr(Date.parse('2026-10-05T02:00:00Z'))).toBe('2026-10-04');
    expect(diaBr(Date.parse('2026-10-05T03:00:00Z'))).toBe('2026-10-05');
    expect(somarDias('2026-10-30', 3)).toBe('2026-11-02');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('tendência', () => {
  it('regressão linear exata numa reta', () => {
    expect(regressaoLinear([1, 3, 5, 7])).toMatchObject({ a: 1, b: 2, sigma: 0, r2: 1 });
    expect(regressaoLinear([])).toMatchObject({ a: 0, b: 0 });
  });

  it('projeta a reta para frente, nunca negativa, com faixa que abraça o valor', () => {
    const serie = [10, 12, 14, 16].map((valor, i) => ({ dia: somarDias('2026-10-01', i), valor }));
    const p = projetarTendencia(serie, 3);
    expect(p.map((x) => x.dia)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
    expect(p.map((x) => x.valor)).toEqual([18, 20, 22]);
    const caindo = [9, 6, 3, 0].map((valor, i) => ({ dia: somarDias('2026-10-01', i), valor }));
    expect(projetarTendencia(caindo, 2).every((x) => x.valor === 0 && x.min === 0)).toBe(true);
    const ruido = [5, 9, 4, 10, 6, 8].map((valor, i) => ({ dia: somarDias('2026-10-01', i), valor }));
    for (const x of projetarTendencia(ruido, 5)) expect(x.min <= x.valor && x.valor <= x.max).toBe(true);
  });

  it('um pico isolado (ex.: ajuste de saldo enorme) não entorta a projeção; série sem pico fica igual', () => {
    const normal = [100, 104, 98, 102, 99, 103, 101, 97, 105, 100, 102, 98, 101, 103, 99, 100, 104, 96, 102, 101];
    const comPico = [...normal.slice(0, -1), 50_000].map((valor, i) => ({ dia: somarDias('2026-10-01', i), valor }));
    for (const x of projetarTendencia(comPico, 30)) {
      expect(x.valor).toBeGreaterThan(80);
      expect(x.valor).toBeLessThan(130);
    }
    expect(regressaoResistente(normal)).toEqual(regressaoLinear(normal));
    // contagens pequenas com muitos zeros (novos membros por dia): nada é aparado, a média se mantém
    const contagens = [0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 3, 0, 1, 0];
    expect(regressaoResistente(contagens)).toEqual(regressaoLinear(contagens));
  });

  it('acumula projeções diárias e projeta saldo (entradas − saídas)', () => {
    const d = (valor: number, i: number) => ({ dia: somarDias('2026-10-01', i), valor, min: valor - 1, max: valor + 1 });
    expect(acumularProjecao(100, [d(5, 0), d(5, 1)]).map((x) => x.valor)).toEqual([105, 110]);
    expect(projetarSaldo(1000, [d(300, 0), d(300, 1)], [d(100, 0), d(100, 1)]).map((x) => x.valor)).toEqual([1200, 1400]);
  });
});

describe('potencial de ovos', () => {
  const agora = Date.parse('2026-10-05T15:00:00Z'); // 12:00 em Brasília

  it('esperança por coleta: 1 + 2q (q = 0,5 · multiplicador do humor)', () => {
    expect(ovosEsperados('feliz')).toBe(2);
    expect(ovosEsperados('neutro')).toBe(1.75);
    expect(ovosEsperados('cansado')).toBe(1.5);
    expect(ovosEsperados('triste')).toBe(1.25);
  });

  it('galinha nova: ovos já sorteados hoje e 2 por dia nos ciclos de 24 h seguintes', () => {
    const p = potencialDeOvos(
      [{ tipo: 'galinha', vidaAncora: 100, vidaAncoraEmMs: agora, fatorPct: 100, expiracaoMs: agora + 90 * MS_DIA, proximoRendimentoMs: agora, ovosPendentes: 3 }],
      agora,
      3,
    );
    expect(p.map((x) => x.ovos)).toEqual([3, 2, 2, 2]);
    expect(p[1]!.valorX100).toBe(240);
  });

  it('animal triste: ciclo de 36 h e 1,25 ovo por coleta; vencido só entrega os ovos pendentes (presente)', () => {
    const triste = { tipo: 'pato' as const, vidaAncora: 10, vidaAncoraEmMs: agora, fatorPct: 90, expiracaoMs: agora + 30 * MS_DIA, proximoRendimentoMs: agora + 6 * MS_HORA, ovosPendentes: 1 };
    const p = potencialDeOvos([triste], agora, 3);
    expect(p.reduce((s, x) => s + x.ovos, 0)).toBeCloseTo(1 + 1.25, 6); // +6 h e +42 h (o de +78 h passa das 72 h)
    const vencido = { ...triste, expiracaoMs: agora - MS_HORA, proximoRendimentoMs: agora - 2 * MS_HORA };
    expect(potencialDeOvos([vencido], agora, 3).map((x) => x.ovos)).toEqual([1, 0, 0, 0]);
  });
});

'use client';

// Poeira dourada na luz do fim de tarde + vaga-lumes perto do capim. Para pesar pouco num celular de
// entrada, a poeira anda em NUVENZINHAS: 5 grupos de 4 grãos, e quem anima é o grupo (sobe devagar,
// deriva para o lado e apaga: 1 animação por grupo, não por grão; os grãos variam de tamanho e brilho
// dentro do grupo). Cada vaga-lume faz o laço e pisca numa animação só. 20 grãos + 6 vaga-lumes = 26
// partículas (com as 2 borboletas e as 2 moedas dos ninhos, 30: orçamento ≤ 40), só transform/opacity,
// brilho por radial-gradient (sem blur). Sorteio fixo: o mesmo no servidor e no cliente.
import type { CSSProperties } from 'react';
import { r1, sorteio } from './aleatorio';

const GRUPOS = (() => {
  const rnd = sorteio(2024);
  return Array.from({ length: 5 }, (_, g) => ({
    x: r1(4 + g * 19 + rnd() * 8),
    y: r1(24 + rnd() * 52),
    dur: r1(9 + rnd() * 6),
    atraso: r1(-rnd() * 14),
    dx: Math.round((rnd() - 0.35) * 70),
    sobe: Math.round(70 + rnd() * 100),
    graos: Array.from({ length: 4 }, () => ({
      x: Math.round(rnd() * 90),
      y: Math.round(rnd() * 120),
      t: r1(3 + rnd() * 6),
      o: r1(0.45 + rnd() * 0.55),
    })),
  }));
})();

const VAGALUMES = (() => {
  const rnd = sorteio(99);
  return Array.from({ length: 6 }, () => ({
    x: r1(4 + rnd() * 92),
    y: r1(52 + rnd() * 24),
    dur: r1(7 + rnd() * 6),
    atraso: r1(-rnd() * 12),
    ax: Math.round(14 + rnd() * 26),
    ay: Math.round(8 + rnd() * 16),
  }));
})();

export function Poeira() {
  return (
    <div className="ca-poeira" aria-hidden>
      {GRUPOS.map((g, i) => (
        <span
          key={i}
          className="ca-poeira-grupo"
          style={{ left: `${g.x}%`, top: `${g.y}%`, '--dur': `${g.dur}s`, '--atraso': `${g.atraso}s`, '--dx': `${g.dx}px`, '--sobe': `${-g.sobe}px` } as CSSProperties}
        >
          {g.graos.map((p, k) => (
            <i key={k} style={{ left: p.x, top: p.y, width: p.t, height: p.t, opacity: p.o }} />
          ))}
        </span>
      ))}
      {VAGALUMES.map((v, i) => (
        <span
          key={`v${i}`}
          className="ca-vagalume"
          style={{ left: `${v.x}%`, top: `${v.y}%`, '--dur': `${v.dur}s`, '--atraso': `${v.atraso}s`, '--ax': `${v.ax}px`, '--ay': `${v.ay}px` } as CSSProperties}
        />
      ))}
    </div>
  );
}

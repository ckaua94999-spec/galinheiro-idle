'use client';

// Efeitos da Chuva de Ovos por cima da grade: estouro de cada casa premiada (clarão, anel, cascas voando com
// gravidade, gema espirrando nos ovos, penas flutuando nas penas/asas, faíscas), o "+N" subindo do grupo e as
// moedas que voam do grupo até o placar. Só transform/opacity; cada efeito se remove sozinho.
import type { SimboloChuva } from '@galinheiro/game-core';
import type { CSSProperties } from 'react';

export interface EfeitoEstouro { id: number; s: SimboloChuva; x: number; y: number; tam: number }
export interface RotuloGanho { id: number; x: number; y: number; texto: string; grande: boolean }
/** Moeda voando de (x, y) até o placar, que fica a (dx, dy) dali. */
export interface MoedaFx { id: number; x: number; y: number; dx: number; dy: number; atrasoMs: number }

const CASCA: Partial<Record<SimboloChuva, string>> = {
  ovo_codorna: '#efe3cf', ovo_galinha: '#f7e5c4', ovo_pato: '#c9e9f5', ovo_ganso: '#f7f5ef', ovo_avestruz: '#f6dea2', bomba: '#ffc93c',
};
const PENA: Partial<Record<SimboloChuva, string>> = { pena_azul: '#7cc4ff', pena_vermelha: '#ff8466', asa: '#fff1dc' };

/** Pseudo-aleatório estável por casa (o mesmo estouro não "pula" entre renders). */
const ruido = (id: number, k: number) => {
  const v = Math.sin(id * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

function Estouro({ e }: { e: EfeitoEstouro }) {
  const casca = CASCA[e.s];
  const pena = PENA[e.s];
  const cacos = casca ? 8 : 0;
  const penas = pena ? 5 : 0;
  const t = e.tam;
  return (
    <span className="chuva-fx" style={{ left: e.x, top: e.y, '--t': `${t}px` } as CSSProperties} aria-hidden>
      <span className="chuva-fx-clarao" />
      <span className="chuva-fx-anel" />
      {casca && <span className="chuva-fx-gema" data-ouro={e.s === 'bomba' ? '' : undefined} />}
      {Array.from({ length: cacos }, (_, k) => {
        const ang = (k / cacos) * Math.PI * 2 + ruido(e.id, k) * 0.8;
        const dist = t * (0.6 + ruido(e.id, k + 9) * 0.6);
        return (
          <i
            key={`c${k}`}
            className="chuva-fx-caco"
            style={{
              background: casca,
              '--dx': `${Math.cos(ang) * dist}px`,
              '--dy': `${Math.sin(ang) * dist - t * 0.4}px`,
              '--cai': `${t * (0.6 + ruido(e.id, k + 3) * 0.5)}px`,
              '--r': `${(ruido(e.id, k + 5) - 0.5) * 720}deg`,
              '--s': 0.6 + ruido(e.id, k + 7) * 0.7,
            } as CSSProperties}
          />
        );
      })}
      {Array.from({ length: penas }, (_, k) => {
        const lado = k % 2 ? 1 : -1;
        return (
          <i
            key={`p${k}`}
            className="chuva-fx-pena"
            style={{
              background: pena,
              '--dx': `${lado * t * (0.3 + ruido(e.id, k) * 0.6)}px`,
              '--dy': `${-t * (0.25 + ruido(e.id, k + 4) * 0.5)}px`,
              '--cai': `${t * (0.6 + ruido(e.id, k + 2) * 0.5)}px`,
              '--r': `${lado * (60 + ruido(e.id, k + 6) * 140)}deg`,
            } as CSSProperties}
          />
        );
      })}
      {Array.from({ length: 5 }, (_, k) => (
        <i
          key={`f${k}`}
          className="chuva-fx-faisca"
          style={{ '--a': `${k * 72 + 20 + ruido(e.id, k + 11) * 30}deg`, '--d': `${t * (0.6 + ruido(e.id, k + 13) * 0.4)}px` } as CSSProperties}
        />
      ))}
    </span>
  );
}

export function CamadaEstouros({ efeitos, rotulos, moedas }: { efeitos: EfeitoEstouro[]; rotulos: RotuloGanho[]; moedas: MoedaFx[] }) {
  return (
    <div className="chuva-camada-fx" aria-hidden>
      {efeitos.map((e) => (
        <Estouro key={e.id} e={e} />
      ))}
      {moedas.map((m) => (
        <i
          key={m.id}
          className="chuva-fx-moeda"
          style={{ left: m.x, top: m.y, '--dx': `${m.dx}px`, '--dy': `${m.dy}px`, animationDelay: `${m.atrasoMs}ms` } as CSSProperties}
        />
      ))}
      {rotulos.map((r) => (
        <span key={r.id} className="chuva-fx-rotulo texto-contorno numeros" data-grande={r.grande ? '' : undefined} style={{ left: r.x, top: r.y }}>
          {r.texto}
        </span>
      ))}
    </div>
  );
}

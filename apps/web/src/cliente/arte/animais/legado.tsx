// Peças do desenho ANTIGO (contorno #2B2118 chapado), usadas só pelas espécies ainda não redesenhadas
// (Pato, Ganso e Avestruz foram portados como estavam). Ao redesenhar uma espécie com o kit novo
// (comum.tsx + modelo da Galinha.tsx), pare de importar daqui; quando ninguém usar, apague o arquivo.
import type { Humor } from './comum';

export const C = '#2B2118';
export const L = { stroke: C, strokeWidth: 2.5, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
export const CORPO = 'M26 94 Q22 66 40 62 Q60 56 80 62 Q98 66 94 94 Z';

export function Olho({ cx, cy, humor, pele, lado, escala = 1 }: { cx: number; cy: number; humor: Humor; pele: string; lado: -1 | 1; escala?: number }) {
  const e = escala;
  switch (humor) {
    case 'feliz':
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={3.4 * e} ry={4.2 * e} fill={C} />
          <circle cx={cx + 1.1 * e} cy={cy - 1.5 * e} r={1.25 * e} fill="#fff" />
        </g>
      );
    case 'neutro':
      return (
        <g>
          <circle cx={cx} cy={cy} r={2.8 * e} fill={C} />
          <circle cx={cx + 0.9 * e} cy={cy - 1 * e} r={0.9 * e} fill="#fff" />
        </g>
      );
    case 'cansado':
      return (
        <g>
          <ellipse cx={cx} cy={cy + 0.5} rx={3.2 * e} ry={3.6 * e} fill={C} />
          <path d={`M${cx - 4.3 * e} ${cy + 0.6} Q${cx} ${cy - 1.4} ${cx + 4.3 * e} ${cy + 0.6} L${cx + 4.3 * e} ${cy - 5.5 * e} L${cx - 4.3 * e} ${cy - 5.5 * e} Z`} fill={pele} />
          <path d={`M${cx - 4.3 * e} ${cy + 0.6} Q${cx} ${cy - 1.4} ${cx + 4.3 * e} ${cy + 0.6}`} fill="none" stroke={C} strokeWidth={1.6} strokeLinecap="round" />
          <path d={`M${cx - 3} ${cy + 5.6 * e} Q${cx} ${cy + 7.2 * e} ${cx + 3} ${cy + 5.6 * e}`} fill="none" stroke="#B9A58C" strokeWidth={1.2} strokeLinecap="round" />
        </g>
      );
    case 'triste':
      return (
        <g>
          <ellipse cx={cx} cy={cy + 1} rx={2.8 * e} ry={3.3 * e} fill={C} />
          <path
            d={lado < 0 ? `M${cx - 4} ${cy - 4.5} L${cx + 3} ${cy - 7.5}` : `M${cx - 3} ${cy - 7.5} L${cx + 4} ${cy - 4.5}`}
            stroke={C}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </g>
      );
    case 'surpresa':
      return (
        <g>
          <circle cx={cx} cy={cy} r={4.6 * e} fill="#fff" stroke={C} strokeWidth={1.6} />
          <circle cx={cx} cy={cy + 0.5} r={2.1 * e} fill={C} />
        </g>
      );
    case 'aposentado':
      return <path d={`M${cx - 3.8} ${cy + 1} Q${cx} ${cy - 4.5} ${cx + 3.8} ${cy + 1}`} fill="none" stroke={C} strokeWidth={2} strokeLinecap="round" />;
  }
}

export function Bochechas({ y, x1, x2 }: { y: number; x1: number; x2: number }) {
  return (
    <g opacity={0.75}>
      <ellipse cx={x1} cy={y} rx={3.8} ry={2.4} fill="#FF9EAA" />
      <ellipse cx={x2} cy={y} rx={3.8} ry={2.4} fill="#FF9EAA" />
    </g>
  );
}

export function Lagrima({ x, y }: { x: number; y: number }) {
  return <path d={`M${x} ${y} q-2.6 4.2 0 5.8 q2.6 -1.6 0 -5.8 z`} fill="#8FD3FF" stroke="#2B6CB0" strokeWidth={0.8} />;
}

export function Asas({ cor }: { cor: string }) {
  return (
    <>
      <path d="M30 79 Q20 86 27 97 Q36 99 41 90 Z" fill={cor} {...L} />
      <path d="M90 79 Q100 86 93 97 Q84 99 79 90 Z" fill={cor} {...L} />
    </>
  );
}

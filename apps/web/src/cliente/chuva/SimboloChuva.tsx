// Símbolos da Chuva de Ovos. Os ovos reaproveitam o ícone do jogo (mesma cor do estoque); penas, asa, ninho de ouro
// e o ovo de ouro (bomba com multiplicador) são desenhados aqui, no mesmo traço: contorno por fora, sombra e realce.
import type { SimboloChuva as Simbolo, Tipo } from '@galinheiro/game-core';
import { Ovo } from '../arte/Icones';

const sil = (cor: string, w = 2.2) =>
  ({ stroke: cor, strokeWidth: w * 2, paintOrder: 'stroke', strokeLinejoin: 'round', strokeLinecap: 'round' }) as const;

const OVO: Partial<Record<Simbolo, Tipo>> = {
  ovo_codorna: 'codorna', ovo_galinha: 'galinha', ovo_pato: 'pato', ovo_ganso: 'ganso', ovo_avestruz: 'avestruz',
};

function Pena({ cor, sombra, contorno }: { cor: string; sombra: string; contorno: string }) {
  return (
    <svg viewBox="0 0 40 48" aria-hidden>
      <path d="M31 3C18 7 8.6 19.4 8 33.6C7.8 38 8.6 41.4 10.2 44.6C12.6 40.6 15.6 37.4 19.6 34.6C28 28.6 34 17.6 31 3Z" fill={cor} {...sil(contorno)} />
      <path d="M30.6 6C33 17 28 27.6 20.4 33.4C17 36 14 38.8 11.6 42.2C14.6 37 18.6 34 22 30.4C27.6 24.6 31 15.6 30.6 6Z" fill={sombra} opacity={0.55} />
      <path d="M10.4 44.4C15 32 21 20 28.6 8.4" fill="none" stroke="#fff6e0" strokeWidth={2} strokeLinecap="round" />
      <path d="M14.6 33.4L20.6 34M16.8 27L23.6 26.8M19.6 21L26.4 19.8M22.6 15.2L28.4 13" fill="none" stroke={contorno} strokeWidth={1.3} strokeLinecap="round" opacity={0.45} />
      <ellipse cx="17.6" cy="22" rx="2.4" ry="6" transform="rotate(32 17.6 22)" fill="#fff" opacity={0.5} />
    </svg>
  );
}

function Asa() {
  return (
    <svg viewBox="0 0 44 44" aria-hidden>
      <path d="M5 29C5 17 15 7 29.4 7C35.6 7 40 10 40 14.4C34 14.4 30 16.4 28 19.6C34.4 19.6 38.6 21.8 38.6 26C32.4 26 28.4 28 26.4 31.2C30.4 32.2 32.4 34.4 31.6 37.4C22 38.6 11.4 37 5 29Z" fill="#fff1dc" {...sil('#8a4a22')} />
      <path d="M38.4 25.6C33 26.4 29 28.2 26.6 31C30.2 32.2 32 34.2 31.4 37C22.8 38.2 12.6 36.8 6.4 30.6C14.6 34.6 24 34.8 28.6 30.6C31 28.4 34.4 26.6 38.4 25.6Z" fill="#edbe96" opacity={0.65} />
      <path d="M12 26Q20 18 30 14.6M14 30.6Q22 25 28.4 20.4M17.6 34Q23 30.6 26.6 27" fill="none" stroke="#c98a5a" strokeWidth={1.6} strokeLinecap="round" />
      <ellipse cx="17" cy="16.6" rx="6.4" ry="3" transform="rotate(-30 17 16.6)" fill="#fff" opacity={0.7} />
    </svg>
  );
}

function NinhoOuro() {
  return (
    <svg viewBox="0 0 44 44" aria-hidden>
      <path d="M22 4L24 10L30 12L24 14L22 20L20 14L14 12L20 10Z" fill="#fff6b0" {...sil('#c27c00', 1)} />
      <ellipse cx="15" cy="23" rx="5" ry="6.4" fill="#ffd23f" {...sil('#7a4a00', 1.6)} />
      <ellipse cx="29" cy="23" rx="5" ry="6.4" fill="#ffd23f" {...sil('#7a4a00', 1.6)} />
      <ellipse cx="22" cy="21" rx="5.4" ry="7" fill="#ffe27a" {...sil('#7a4a00', 1.6)} />
      <ellipse cx="20.4" cy="18" rx="1.4" ry="2.4" fill="#fff" opacity={0.9} />
      <path d="M4 26C6 36 14 40 22 40C30 40 38 36 40 26C34 30 28 31 22 31C16 31 10 30 4 26Z" fill="#e9b949" {...sil('#6b4416', 2.2)} />
      <path d="M7 30Q14 34 22 34Q30 34 37 30M10 35Q16 37.6 22 37.6Q28 37.6 34 35" fill="none" stroke="#9a6424" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M8 28.4Q14 31 20 31.4" fill="none" stroke="#fff3c0" strokeWidth={1.6} strokeLinecap="round" opacity={0.85} />
    </svg>
  );
}

function OvoOuro() {
  return (
    <svg viewBox="0 0 40 48" aria-hidden>
      <circle cx="20" cy="26" r="19" fill="#fff1a8" opacity={0.45} />
      <path d="M20 4C30 4 36.6 18 36.6 28.6C36.6 39.4 29.4 45 20 45C10.6 45 3.4 39.4 3.4 28.6C3.4 18 10 4 20 4Z" fill="#ffc93c" {...sil('#7a4a00', 2.4)} />
      <path d="M34.4 24C35.4 36 29.4 42.6 20 42.6C14.4 42.6 10 40.4 7.8 36.6C12.4 39.2 18.6 39.6 24 37C30 34 33.4 29.4 34.4 24Z" fill="#d48800" opacity={0.6} />
      <path d="M4.6 25L10 28.6L14.4 24L19.4 29L24.4 24.4L29.4 29L35.4 25" fill="none" stroke="#7a4a00" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
      <ellipse cx="12.8" cy="16.6" rx="3.2" ry="6.4" transform="rotate(24 12.8 16.6)" fill="#fff" opacity={0.85} />
      <circle cx="17" cy="9.4" r="1.6" fill="#fff" opacity={0.85} />
    </svg>
  );
}

/** Desenho de um símbolo (preenche a caixa). O multiplicador do ovo de ouro vem por cima, em texto contornado. */
export function SimboloChuva({ s, x }: { s: Simbolo; x?: number }) {
  const ovo = OVO[s];
  return (
    <span className="chuva-simbolo" data-simbolo={s}>
      {ovo ? (
        <Ovo tipo={ovo} />
      ) : s === 'pena_azul' ? (
        <Pena cor="#7cc4ff" sombra="#1f7ae6" contorno="#0b2d66" />
      ) : s === 'pena_vermelha' ? (
        <Pena cor="#ff8466" sombra="#c8321e" contorno="#5c0a05" />
      ) : s === 'asa' ? (
        <Asa />
      ) : s === 'ninho' ? (
        <NinhoOuro />
      ) : (
        <OvoOuro />
      )}
      {s === 'bomba' && x ? <span className="chuva-mult texto-contorno">×{x}</span> : null}
    </span>
  );
}

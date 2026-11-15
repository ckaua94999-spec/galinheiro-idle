// Ovo-bomba: ovo escuro com pavio aceso, uma faixa da cor do tipo e as setas do padrão da explosão pintadas na casca
// (em pé ↕, deitado ↔, cruz +, X ×). A contagem regressiva vem por cima, num selo. Arte própria do jogo.
import type { TipoBomba } from '@galinheiro/game-core';

const COR: Record<TipoBomba, { faixa: string; escura: string }> = {
  vertical: { faixa: '#ff9a3c', escura: '#b85a00' },
  horizontal: { faixa: '#3cc6c0', escura: '#0e7a76' },
  cruz: { faixa: '#ff6fae', escura: '#a8235e' },
  xis: { faixa: '#ff5a48', escura: '#9a160c' },
};

const SETA = 'M0 -9L4 -4H1.6V4H4L0 9L-4 4H-1.6V-4H-4Z';

function Padrao({ tipo }: { tipo: TipoBomba }) {
  const giros = tipo === 'vertical' ? [0] : tipo === 'horizontal' ? [90] : tipo === 'cruz' ? [0, 90] : [45, -45];
  return (
    <g transform="translate(20 29)" fill="#fff" stroke="#2b1a0f" strokeWidth={1.1} strokeLinejoin="round">
      {giros.map((g) => (
        <path key={g} d={SETA} transform={`rotate(${g})`} />
      ))}
    </g>
  );
}

/** Ovo-bomba (preenche a caixa). `contagem` = giros que faltam; com 1 o selo fica vermelho e o ovo treme (CSS). */
export function OvoBomba({ tipo, contagem, className }: { tipo: TipoBomba; contagem?: number; className?: string }) {
  const c = COR[tipo];
  return (
    <span className={`bombas-ovo ${className ?? ''}`} data-tipo={tipo} data-urgente={contagem !== undefined && contagem <= 1 ? '' : undefined}>
      <svg viewBox="0 0 40 48" aria-hidden>
        {/* pavio e faísca */}
        <path d="M20 8Q20 3 25 2.4Q29 2 30.4 5" fill="none" stroke="#2b1a0f" strokeWidth={4} strokeLinecap="round" />
        <path d="M20 8Q20 3 25 2.4Q29 2 30.4 5" fill="none" stroke="#c9a06a" strokeWidth={1.8} strokeLinecap="round" />
        <g className="bombas-faisca" transform="translate(31 5.4)">
          <path d="M0 -5.4L1.4 -1.4L5.4 0L1.4 1.4L0 5.4L-1.4 1.4L-5.4 0L-1.4 -1.4Z" fill="#fff6b0" stroke="#ff8a00" strokeWidth={1} strokeLinejoin="round" />
        </g>
        {/* casca escura */}
        <path d="M20 7C29.6 7 36.4 20 36.4 29.6C36.4 40 29.4 45.4 20 45.4C10.6 45.4 3.6 40 3.6 29.6C3.6 20 10.4 7 20 7Z" fill="#3a3350" stroke="#15101f" strokeWidth={4.4} paintOrder="stroke" strokeLinejoin="round" />
        <path d="M34.4 26C35.4 37 29.4 43 20 43C14.4 43 10 40.8 7.8 37C12.4 39.6 18.6 40 24 37.4C30 34.4 33.4 30 34.4 26Z" fill="#1c1630" opacity={0.7} />
        {/* faixa da cor do tipo, com as setas do padrão */}
        <path d="M4.6 23.6Q20 18.6 35.4 23.6V34.6Q20 39.6 4.6 34.6Z" fill={c.faixa} stroke={c.escura} strokeWidth={1.4} />
        <Padrao tipo={tipo} />
        <ellipse cx="12.6" cy="16.6" rx="2.8" ry="5.4" transform="rotate(24 12.6 16.6)" fill="#fff" opacity={0.55} />
      </svg>
      {contagem !== undefined && (
        <span className="bombas-contagem numeros" key={contagem} aria-label={`explode em ${contagem} ${contagem === 1 ? 'giro' : 'giros'}`}>
          {contagem}
        </span>
      )}
    </span>
  );
}

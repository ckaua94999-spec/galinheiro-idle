// Barra de vida no estilo da barra de progresso das cartas do Clash Royale: trilho escuro, preenchimento
// em gradiente pela cor da vida, "88%" contornado por cima e um coração saindo pela esquerda.
import { EMOJI_TIER, NOME_TIER, corDaBarra, tierDe, vidaExibida } from '@galinheiro/game-core';
import type { CSSProperties } from 'react';
import { cx } from '../util';

export function BarraVida({ vida, compacta = false, className }: { vida: number; compacta?: boolean; className?: string }) {
  const exibida = vidaExibida(vida);
  const tier = tierDe(vida);
  const cor = corDaBarra(vida);
  return (
    <div
      className={cx('barra-vida', compacta && 'barra-vida-compacta', className)}
      role="meter"
      aria-label={`Vida ${exibida}%`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={exibida}
      aria-valuetext={`${exibida}%${tier ? `, ${NOME_TIER[tier]}` : ''}`}
    >
      {/* o preenchimento começa à direita do coração (padding no trilho): com vida baixa a ponta ainda aparece */}
      <span className="barra" data-cor={cor} style={{ '--barra-h': compacta ? '14px' : '20px' } as CSSProperties}>
        <span className="barra-preenchimento" data-anima style={{ '--p': Math.max(3, vida) } as CSSProperties} />
        <span className="barra-texto">{exibida}%</span>
      </span>
      <svg viewBox="0 0 24 22" className="barra-vida-coracao" aria-hidden>
        <path d="M12 21C5 16 1.5 12.2 1.5 7.4 1.5 4 4 1.5 7.1 1.5c2 0 3.8 1 4.9 2.7 1.1-1.7 2.9-2.7 4.9-2.7 3.1 0 5.6 2.5 5.6 5.9 0 4.8-3.5 8.6-10.5 13.6Z" fill="#ff4d5e" stroke="#5c0a14" strokeWidth={2} strokeLinejoin="round" />
        <path d="M12 21c-2-1.4-3.7-2.8-5.1-4.1 4.6 1.6 9.9.2 13.1-4.8-1.7 3-4.2 5.8-8 8.9Z" fill="#c4182e" opacity={0.6} />
        <ellipse cx="6.8" cy="6.6" rx="2.1" ry="2.9" fill="#fff" opacity={0.75} transform="rotate(-25 6.8 6.6)" />
      </svg>
      {!compacta && tier && (
        <span className="barra-vida-humor" title={NOME_TIER[tier]} aria-hidden>
          {EMOJI_TIER[tier]}
        </span>
      )}
    </div>
  );
}

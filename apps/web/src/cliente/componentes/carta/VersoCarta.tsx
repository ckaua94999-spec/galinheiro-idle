// Verso da carta (DIRECAO_DE_ARTE 6.8): moldura dourada, campo azul-real com raios, cantoneiras douradas e o
// emblema do ovo com a galinha em silhueta (crista de 3 bolinhas, bico e cauda em leque). Na completa, a faixa
// "Galinheiro". Usa as mesmas camadas/forma da frente (o lendário mantém a crista), para casar no flip.
import type { Raridade } from '@galinheiro/game-core';
import { cx } from '../../util';

export interface PropsVerso {
  /** Só define a FORMA da moldura (épico chanfrado, lendário com crista), para casar com a frente no flip. */
  raridade?: Raridade;
  className?: string;
  /** Tamanho da grade da Coleção (padrão: completa, 300 px). */
  compacta?: boolean;
}

/** Cantoneira dourada (canto superior esquerdo; as outras são espelhadas no CSS). */
function Cantoneira({ canto }: { canto: 'se' | 'sd' | 'ie' | 'id' }) {
  return (
    <svg viewBox="0 0 24 24" className="carta-verso-canto" data-canto={canto} aria-hidden>
      <path d="M3.5 21V8.5a5 5 0 0 1 5-5H21" fill="none" stroke="#0e1b3a" strokeWidth={5.5} strokeLinecap="round" />
      <path d="M3.5 21V8.5a5 5 0 0 1 5-5H21" fill="none" stroke="url(#gi-cartas-ouro)" strokeWidth={3} strokeLinecap="round" />
      <path d="M10.5 7 14 10.5 10.5 14 7 10.5Z" fill="url(#gi-cartas-ouro)" stroke="#0e1b3a" strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M10.5 8.4 12.4 10.5h-3.8Z" fill="#fff" opacity={0.7} />
    </svg>
  );
}

export function VersoCarta({ raridade = 'comum', className, compacta }: PropsVerso) {
  return (
    <div className={cx('carta carta-verso', className)} data-raridade={raridade} data-tamanho={compacta ? 'compacta' : 'completa'} aria-hidden>
      <div className="carta-corpo">
        <span className="carta-sombra" />
        <div className="carta-contorno">
          <div className="carta-moldura">
            <div className="carta-verso-campo">
              <span className="carta-verso-raios" />
              <Cantoneira canto="se" />
              <Cantoneira canto="sd" />
              <Cantoneira canto="ie" />
              <Cantoneira canto="id" />
              <svg viewBox="0 0 100 100" className="carta-verso-emblema">
                {/* anel de rebites */}
                <circle cx="50" cy="52" r="44" fill="none" stroke="#ffc93c" strokeWidth={2.5} strokeDasharray="0.1 8.5" strokeLinecap="round" opacity={0.85} />
                <circle cx="50" cy="52" r="38" fill="#163f82" stroke="#0e1b3a" strokeWidth={3} />
                <circle cx="50" cy="52" r="38" fill="none" stroke="#2a6bd1" strokeWidth={1.5} transform="translate(0 1.6)" opacity={0.7} />
                {/* ovo dourado */}
                <g transform="translate(30 22)">
                  <path d="M20 4C30 4 38 20 38 32a18 18 0 0 1-36 0C2 20 10 4 20 4Z" fill="#5a3a00" />
                  <path d="M20 2C30 2 38 18 38 30a18 18 0 0 1-36 0C2 18 10 2 20 2Z" fill="url(#gi-cartas-ovo-valor)" stroke="#5a3a00" strokeWidth={2.2} strokeLinejoin="round" />
                  <path d="M35.5 26c1.6 9-4.6 18.6-15.5 19.6 7.6-3 12.6-10.4 11.6-19.4Z" fill="#c27200" opacity={0.45} />
                  {/* galinha em silhueta, virada para a esquerda */}
                  <g fill="#5a3a00">
                    {/* cauda em leque (3 penas) */}
                    <ellipse cx="29.6" cy="23.6" rx="2.5" ry="6.2" transform="rotate(18 29.6 23.6)" />
                    <ellipse cx="32" cy="27" rx="2.3" ry="5.6" transform="rotate(48 32 27)" />
                    <ellipse cx="26.8" cy="22.4" rx="2.2" ry="5.4" transform="rotate(-8 26.8 22.4)" />
                    {/* corpo e cabeça */}
                    <ellipse cx="21" cy="31.4" rx="10.6" ry="7.4" />
                    <circle cx="15" cy="21.4" r="5.2" />
                    <path d="M11 23.5c-.6 3.4.6 6 3.4 7.6l4.6-3.4c-1.6-1.4-2.6-3.4-2.4-5.6Z" />
                    {/* crista de 3 bolinhas */}
                    <circle cx="12.4" cy="16" r="2" />
                    <circle cx="15.3" cy="14.7" r="2.3" />
                    <circle cx="18.3" cy="16" r="2" />
                    {/* bico e barbela */}
                    <path d="M10.6 19.8 6 21.7l4.6 1.9Z" />
                    <circle cx="10.6" cy="25" r="1.5" />
                  </g>
                  {/* olho e asa em dourado claro, para a silhueta não virar uma mancha */}
                  <circle cx="14.1" cy="19.3" r="1.15" fill="#ffe680" />
                  {/* asa em gota com 2 entalhes de pena na borda de trás */}
                  <path
                    d="M15.2 30.6C15.2 27.6 19.2 26.4 23.4 27.4 25.8 28 27.6 29 28.6 30.2L25.6 30.6 26.8 32.2 23.8 32.4 24.6 34C20.4 35.2 15.2 34 15.2 30.6Z"
                    fill="#ffd24a"
                    opacity={0.55}
                  />
                  <ellipse cx="11" cy="11" rx="2.6" ry="4.6" fill="#fff" opacity={0.75} transform="rotate(20 11 11)" />
                </g>
                {/* brilhos de 4 pontas */}
                <path d="M84 20l1.6 4.4L90 26l-4.4 1.6L84 32l-1.6-4.4L78 26l4.4-1.6Z" fill="#fff1a8" />
                <path d="M16 74l1.1 3 3 1.1-3 1.1-1.1 3-1.1-3-3-1.1 3-1.1Z" fill="#fff1a8" />
              </svg>
              {!compacta && (
                <span className="carta-verso-faixa">
                  <span className="texto-contorno-fino">Galinheiro</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

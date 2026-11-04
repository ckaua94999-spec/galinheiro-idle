// Arte das ofertas do Intercâmbio (DIRECAO_DE_ARTE 1 e 6): janelinha com cenário, no molde da arte das cartas.
//  - ovos: cesto de vime no gramado, sob o céu com raios, com 5 ovos da espécie (os mesmos <Ovo/> do HUD) e o
//    "×7" contornado no canto;
//  - animal: o animal no ninho sobre o fundo da raridade (o mesmo das cartas) e as gemas no engaste de baixo.
//    Lendário ganha o sol atrás; raro em diante, o reflexo que passa. O selo da raridade fica no cartão (canto de
//    cima, fora da janelinha), para não cobrir a cabeça do bicho.
// Gradientes compartilhados (DefsIcones: gi-icones-madeira); nada de filter; só transform/opacity animam (CSS).
import { ANIMAIS, GEMAS_RARIDADE } from '@galinheiro/game-core';
import { FiguraAnimal } from '../arte/Animal';
import { Gemas, Ovo } from '../arte/Icones';
import { COR_RARIDADE, cx } from '../util';
import type { OfertaTela } from './texto';
import { numeroTickets } from './texto';

const CONTORNO_MADEIRA = '#3b200c';
// A caixa dos dois desenhos do cesto é a mesma (viewBox 0 −36 100 96): a alça fica atrás dos ovos e o aro e o
// corpo trançado, na frente (os ovos "afundam" no cesto). As posições dos ovos (CSS, em % da caixa) contam com ela.
const CAIXA_CESTO = '0 -36 100 96';
const ALCA = 'M14 16C14 -44 86 -44 86 16';

function CestoTras() {
  return (
    <svg viewBox={CAIXA_CESTO} className="troca-cesto-tras" aria-hidden>
      <path d={ALCA} fill="none" stroke={CONTORNO_MADEIRA} strokeWidth={10} strokeLinecap="round" />
      <path d={ALCA} fill="none" stroke="#c4844a" strokeWidth={5} strokeLinecap="round" />
      <path d="M17.6 2C20.6 -17 33 -27.4 50 -28.4" fill="none" stroke="#ffe0b0" strokeWidth={1.6} strokeLinecap="round" opacity={0.75} />
      {/* boca do cesto: o fundo escuro aparece entre os ovos */}
      <ellipse cx="50" cy="16" rx="40" ry="7" fill="#5a3416" />
    </svg>
  );
}

function CestoFrente() {
  return (
    <svg viewBox={CAIXA_CESTO} className="troca-cesto" aria-hidden>
      {/* corpo trançado */}
      <path
        d="M11 20H89L82 52Q81 57 76 57H24Q19 57 18 52Z"
        fill="url(#gi-icones-madeira)"
        stroke={CONTORNO_MADEIRA}
        strokeWidth={5}
        paintOrder="stroke"
        strokeLinejoin="round"
      />
      <g fill="none" stroke="#7a4a22" strokeLinecap="round" opacity={0.8}>
        <path d="M13.8 31.5H86.2M16.2 43H83.8" strokeWidth={1.6} />
        <path d="M31 21L33 56M50 21V57M69 21L67 56" strokeWidth={1.4} />
      </g>
      {/* sombra "cel" embaixo à direita + filete de luz no alto */}
      <path d="M85.6 30L82 52Q81 57 76 57H52Q72 54 79 45Z" fill="#6b3a12" opacity={0.28} />
      <path d="M15 25H85" stroke="#ffe0b0" strokeWidth={1.8} strokeLinecap="round" opacity={0.55} />
      {/* aro */}
      <rect x="6" y="12" width="88" height="11" rx="5.5" fill="url(#gi-icones-madeira)" stroke={CONTORNO_MADEIRA} strokeWidth={4.4} paintOrder="stroke" />
      <path d="M22 13V22M38 13V22M54 13V22M70 13V22" stroke="#9a5f2e" strokeWidth={1.2} opacity={0.5} />
      <path d="M11 14.6H89" stroke="#ffe0b0" strokeWidth={1.6} strokeLinecap="round" opacity={0.85} />
    </svg>
  );
}

export interface PropsArte {
  of: OfertaTela;
  /** defasagem das animações ociosas (cada cartão um valor) */
  indice?: number;
  /** versão da confirmação (gemas menores) */
  pequena?: boolean;
  className?: string;
}

/** Janelinha com a arte da oferta (ovos no cesto ou o animal no ninho). */
export function ArteOferta({ of, indice = 0, pequena = false, className }: PropsArte) {
  if (of.tipo === 'ovos') {
    return (
      <div className={cx('troca-arte', className)} data-tipo="ovos" data-especie={of.especie} data-pequena={pequena ? '' : undefined} aria-hidden>
        <span className="troca-raios" />
        <span className="troca-morro" />
        <span className="troca-cesto-caixa">
          <CestoTras />
          {/* 2 ovos atrás espiando entre os 3 da frente (o do meio, maior, balança de vez em quando) */}
          <Ovo tipo={of.especie} className="troca-ovo troca-ovo-4" />
          <Ovo tipo={of.especie} className="troca-ovo troca-ovo-5" />
          <Ovo tipo={of.especie} className="troca-ovo troca-ovo-1" />
          <Ovo tipo={of.especie} className="troca-ovo troca-ovo-2" />
          <Ovo tipo={of.especie} className="troca-ovo troca-ovo-3" />
          <CestoFrente />
        </span>
        <span className="troca-qtd texto-contorno numeros">
          <small>×</small>
          {numeroTickets(of.quantidade)}
        </span>
      </div>
    );
  }
  const raridade = ANIMAIS[of.especie].raridade;
  return (
    <div
      className={cx('troca-arte', className)}
      data-tipo="animal"
      data-especie={of.especie}
      data-raridade={raridade}
      data-pequena={pequena ? '' : undefined}
      aria-hidden
    >
      <span className="troca-raios" />
      <FiguraAnimal tipo={of.especie} humor="feliz" detalhe="m" atrasoS={0.7 + indice * 1.37} className="troca-figura" />
      {raridade !== 'comum' && <span className="troca-reflexo" style={{ animationDelay: `${(indice % 4) * 0.6}s` }} />}
      <span className="troca-gemas">
        <Gemas quantidade={GEMAS_RARIDADE[raridade]} cor={COR_RARIDADE[raridade]} tamanho={pequena ? 9 : 11} className="troca-gemas-fila" />
      </span>
    </div>
  );
}

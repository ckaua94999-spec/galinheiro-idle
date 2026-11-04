'use client';

// Cena "clássica" da abertura: raios de sol, nuvens e colinas, logo dourado com a fita "IDLE", Seu Juca
// acenando no centro do elenco com as 4 aves saltitando em sequência. Estilos em app/estilos/telas.css.
import type { Tipo } from '@galinheiro/game-core';
import { motion } from 'motion/react';
import { useId } from 'react';
import { FiguraAnimal } from '../../arte/Animal';
import { Juca } from '../../arte/Juca';
import type { PropsCena } from './tipos';

const SUAVE = [0.22, 1, 0.36, 1] as const;
const ELASTICO = [0.34, 1.56, 0.64, 1] as const;

/* ------------------------------------------------------------------ cenário da abertura */

function Nuvem() {
  return (
    <svg viewBox="0 0 120 46" aria-hidden>
      <path
        d="M10 36Q8 24 22 24Q24 10 42 12Q52 0 68 8Q84 4 88 18Q106 16 108 30Q112 42 98 42H18Q10 42 10 36Z"
        fill="#fff"
        stroke="#a9d6f0"
        strokeWidth="4"
        paintOrder="stroke"
        strokeLinejoin="round"
      />
      <path d="M16 38H100" stroke="#d6eefc" strokeWidth="5" strokeLinecap="round" />
      <path d="M30 22Q36 16 44 17" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// As nuvens nunca passam atrás do logo: uma tira de nuvem aparecendo entre o título e a fita parecia
// sujeira. Cada uma mora numa "raia" ao lado da fita IDLE (no desktop, longe do título) e só vai e volta
// devagar, para fora. Posição, escala e deriva ficam em telas.css (.entrar-nuvem-1…3; a 3ª só no desktop).
// [duração do vaivém s, atraso s (negativo: já começa no meio do caminho)]
const NUVENS: [number, number][] = [
  [9, -3],
  [11, -8],
  [13, -5],
];

function Flor({ x, y, cor }: { x: number; y: number; cor: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={(4.6 * Math.cos((a * Math.PI) / 180)).toFixed(2)} cy={(4.6 * Math.sin((a * Math.PI) / 180)).toFixed(2)} r="3.4" fill={cor} stroke="#3f8f2a" strokeWidth="1" />
      ))}
      <circle r="2.6" fill="#ffd23f" stroke="#c27c00" strokeWidth="1" />
    </g>
  );
}

/** Altura do topo da colina do meio no trecho x ∈ [0, 300] (curva M0 122 Q140 84 300 108). */
function cristaDoMeio(x: number): number {
  const t = (-280 + Math.sqrt(280 * 280 + 80 * x)) / 40;
  return (1 - t) * (1 - t) * 122 + 2 * (1 - t) * t * 84 + t * t * 108;
}
const CERCA_X = [204, 228, 252, 276, 298];

/** Cerca de mourões pontudos com 2 travessas, assentada no horizonte da colina do meio. */
function Cerca() {
  const base = CERCA_X.map((x) => [x, cristaDoMeio(x)] as const);
  const [x0, y0] = base[0]!;
  const [x1, y1] = base[base.length - 1]!;
  const trav = (h: number) => `M${x0} ${(y0 - h).toFixed(1)}L${x1} ${(y1 - h).toFixed(1)}`;
  return (
    <g className="entrar-cerca">
      <g fill="none" strokeLinecap="butt">
        <path d={trav(12) + trav(6)} stroke="#3b200c" strokeWidth="6.4" />
        <path d={trav(12) + trav(6)} stroke="#dca066" strokeWidth="3.4" />
        <path d={trav(13) + trav(7)} stroke="#f7d4a0" strokeWidth="1.2" opacity=".8" />
      </g>
      {base.map(([x, y]) => (
        <g key={x}>
          <path
            d={`M${x - 3.6} ${(y + 4).toFixed(1)}V${(y - 15).toFixed(1)}L${x} ${(y - 19.4).toFixed(1)}L${x + 3.6} ${(y - 15).toFixed(1)}V${(y + 4).toFixed(1)}Z`}
            fill="#dca066"
            stroke="#3b200c"
            strokeWidth="2.6"
            paintOrder="stroke"
            strokeLinejoin="round"
          />
          <path d={`M${x - 1.6} ${(y - 15).toFixed(1)}V${(y - 3).toFixed(1)}`} stroke="#f7d4a0" strokeWidth="1.2" strokeLinecap="round" opacity=".75" />
        </g>
      ))}
    </g>
  );
}

/** Colinas em 3 camadas com celeiro ao longe, árvores, cerca no horizonte e flores. */
function Colinas() {
  const u = `gi-telas-entrar-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg viewBox="0 0 760 520" preserveAspectRatio="xMidYMin slice" aria-hidden>
      <defs>
        <linearGradient id={`${u}-fundo`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d2f7a8" />
          <stop offset=".3" stopColor="#b4ec82" />
          <stop offset="1" stopColor="#93dc62" />
        </linearGradient>
        <linearGradient id={`${u}-meio`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fe46c" />
          <stop offset=".3" stopColor="#82d453" />
          <stop offset="1" stopColor="#6cc644" />
        </linearGradient>
        <linearGradient id={`${u}-frente`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fd450" />
          <stop offset=".4" stopColor="#68c240" />
          <stop offset="1" stopColor="#4fa832" />
        </linearGradient>
        <radialGradient id={`${u}-copa`} cx=".38" cy=".32" r=".75">
          <stop offset="0" stopColor="#a8ec74" />
          <stop offset=".5" stopColor="#5cbd3c" />
          <stop offset="1" stopColor="#2f8a2a" />
        </radialGradient>
      </defs>
      {/* colina do fundo */}
      <path d="M0 70Q120 20 250 52Q380 6 520 46Q640 18 760 50V520H0Z" fill={`url(#${u}-fundo)`} />
      {/* celeiro e árvores na faixa central (x ≈ 190–570): é o que aparece num celular de 360–390 px */}
      {/* celeiro ao longe (some com o formulário aberto: o elenco sobe e ele ficaria atrás do avestruz) */}
      <g className="entrar-celeiro" transform="translate(468 26) scale(.9)">
        <path d="M0 34L22 14L44 34V58H0Z" fill="#e2443a" stroke="#4a1010" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round" />
        <path d="M-4 35L22 10L48 35" fill="none" stroke="#7a2a2a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="14" y="40" width="16" height="18" fill="#a82a2a" stroke="#fff6e0" strokeWidth="2" />
        <path d="M15 41L29 57M29 41L15 57" stroke="#fff6e0" strokeWidth="1.6" />
        <circle cx="22" cy="28" r="4" fill="#ffe58a" stroke="#4a1010" strokeWidth="1.5" />
        <rect x="50" y="20" width="16" height="38" rx="2" fill="#c9d3e2" stroke="#3a4658" strokeWidth="3" paintOrder="stroke" />
        <path d="M50 22Q58 8 66 22Z" fill="#8a9ab3" stroke="#3a4658" strokeWidth="3" paintOrder="stroke" />
        <path d="M53 28V54" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".6" />
      </g>
      {/* árvores (a do meio, x 270, some junto com o celeiro: ficaria atrás da galinha) */}
      {[
        [226, 42, 0.95],
        [270, 52, 0.7],
        [550, 50, 0.72],
      ].map(([x, y, s]) => (
        <g key={x} className={x === 270 ? 'entrar-arvore-meio' : undefined} transform={`translate(${x} ${y}) scale(${s})`}>
          <rect x="-5" y="10" width="10" height="26" rx="3" fill="#9a6230" stroke="#3b200c" strokeWidth="4" paintOrder="stroke" />
          <path d="M-26 8Q-30 -14 -10 -18Q-4 -34 14 -26Q32 -26 28 -6Q34 12 14 16H-16Q-28 16 -26 8Z" fill={`url(#${u}-copa)`} stroke="#1f5a1c" strokeWidth="5" paintOrder="stroke" />
          <path d="M-18 -4Q-16 -14 -6 -15" stroke="#c8f59a" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".8" />
          <circle cx="-8" cy="-12" r="3" fill="#ff5a48" stroke="#7a1a1a" strokeWidth="1.2" />
          <circle cx="10" cy="-4" r="3" fill="#ff5a48" stroke="#7a1a1a" strokeWidth="1.2" />
          <circle cx="16" cy="-16" r="2.6" fill="#ff5a48" stroke="#7a1a1a" strokeWidth="1.2" />
        </g>
      ))}
      {/* cerca no topo da colina do meio, à esquerda (entre as árvores e as aves, longe do chapéu do Juca):
          desenhada ANTES da colina, que esconde o pé dos mourões. Os mourões seguem o perfil do morro e as
          travessas terminam dentro do primeiro e do último mourão (nada de ponta solta no ar). */}
      <Cerca />
      {/* colina do meio */}
      <path d="M0 122Q140 84 300 108Q460 76 620 104Q700 92 760 100V520H0Z" fill={`url(#${u}-meio)`} stroke="#3f8f2a" strokeWidth="3" />
      <path d="M30 116Q150 90 280 106" stroke="#c4f39a" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".7" />
      {/* colina da frente com tufos e flores */}
      <path d="M0 196Q170 150 380 176Q580 146 760 180V520H0Z" fill={`url(#${u}-frente)`} stroke="#3f8f2a" strokeWidth="3" />
      <path d="M20 188Q160 154 330 172" stroke="#b8f27a" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".7" />
      <g fill="none" stroke="#3f8f2a" strokeWidth="3" strokeLinecap="round">
        {[204, 262, 330, 420, 486, 540, 300].map((x, i) => (
          <path key={x} d={`M${x} ${214 + (i % 3) * 30}l-5 -10M${x + 6} ${214 + (i % 3) * 30}l0 -13M${x + 12} ${214 + (i % 3) * 30}l5 -10`} />
        ))}
      </g>
      <Flor x={110} y={200} cor="#fff" />
      <Flor x={214} y={194} cor="#ff8ac0" />
      <Flor x={554} y={192} cor="#ff8ac0" />
      <Flor x={650} y={230} cor="#fff" />
      <Flor x={236} y={226} cor="#ffd23f" />
      <Flor x={530} y={222} cor="#fff" />
    </svg>
  );
}

/* ------------------------------------------------------------------ logo e elenco */

/** Logo da abertura (exportado para a galeria). */
export function LogoAbertura() {
  return (
    <motion.div
      className="entrar-logo"
      initial={{ scale: 0.4, y: -30, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: ELASTICO }}
    >
      <h1 className="entrar-logo-titulo texto-contorno">
        <span className="entrar-logo-texto">Galinheiro</span>
        <span className="entrar-logo-brilho" aria-hidden>
          Galinheiro
        </span>
      </h1>
      <motion.span
        className="faixa entrar-logo-idle"
        aria-hidden
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.36, ease: ELASTICO, delay: 0.25 }}
      >
        IDLE
      </motion.span>
      <span className="sr-only"> Idle</span>
    </motion.div>
  );
}

// Saltitam EM SEQUÊNCIA, da esquerda para a direita (uma "ola" que passa pelo Juca acenando no meio):
// o salto tem 1,6 s e o atraso negativo adianta a fase, então quem tem atraso maior pula primeiro.
const ELENCO: { tipo: Tipo; atraso: number }[] = [
  { tipo: 'galinha', atraso: 0.66 },
  { tipo: 'pato', atraso: 0.48 },
  { tipo: 'ganso', atraso: 0.18 },
  { tipo: 'avestruz', atraso: 0 },
];

function Ave({ tipo, atraso, ordem }: { tipo: Tipo; atraso: number; ordem: number }) {
  return (
    <motion.span
      className="entrar-ave"
      style={{ ['--atraso' as string]: `${-atraso}s` }}
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: ELASTICO, delay: 0.35 + ordem * 0.08 }}
    >
      <span className="entrar-ave-sombra" />
      <span className="entrar-ave-pula">
        <FiguraAnimal tipo={tipo} ninho={false} atrasoS={atraso * 3} />
      </span>
    </motion.span>
  );
}

/** Seu Juca no centro, acenando, com as 4 aves saltitando em sequência (exportado para a galeria). */
export function ElencoAbertura() {
  const [a, b, c, d] = ELENCO;
  return (
    <div className="entrar-elenco" aria-hidden>
      {a && <Ave {...a} ordem={0} />}
      {b && <Ave {...b} ordem={1} />}
      <motion.span
        className="entrar-juca"
        initial={{ y: 30, scale: 0.6, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: ELASTICO, delay: 0.2 }}
      >
        <Juca expressao="piscando" acenando />
      </motion.span>
      {c && <Ave {...c} ordem={2} />}
      {d && <Ave {...d} ordem={3} />}
    </div>
  );
}

/** Fundo completo da abertura (exportado para a galeria). */
export function CenarioAbertura() {
  return (
    <>
      <div className="entrar-raios" aria-hidden />
      {NUVENS.map(([dur, atraso], i) => (
        <span
          key={i}
          className={`entrar-nuvem entrar-nuvem-${i + 1}`}
          aria-hidden
          style={{ ['--dur' as string]: `${dur}s`, ['--atraso' as string]: `${atraso}s` }}
        >
          <Nuvem />
        </span>
      ))}
      <div className="entrar-colinas" aria-hidden>
        <Colinas />
      </div>
    </>
  );
}

export function CenaClassica({ modo, painel, legal }: PropsCena) {
  return (
    // com formulário aberto a cena encolhe para o painel e o rodapé caberem sem rolar
    <div className={modo === 'inicio' ? 'entrar' : `entrar entrar--formulario${modo === 'recuperar' ? ' entrar--recuperar' : ''}`}>
      <CenarioAbertura />
      <div className="entrar-conteudo">
        <LogoAbertura />
        <motion.p
          className="entrar-lema"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: SUAVE, delay: 0.45 }}
        >
          Colete ovos, gire a roleta,
          <br />
          colecione animais.
        </motion.p>
        <div className="entrar-espaco" />
        <ElencoAbertura />
        {painel}
        {legal}
      </div>
    </div>
  );
}

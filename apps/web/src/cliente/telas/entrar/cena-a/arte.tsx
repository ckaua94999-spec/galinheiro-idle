'use client';

// Arte da cena de abertura ("pôr do sol cinematográfico"): nuvens com volume iluminadas por baixo, fardo de
// feno com fibras e barbante, pedra com musgo (pedestal da avestruz), tufos de capim, moinho e celeiro com
// material em contraluz (tábuas, telhas, pedra, luzes acesas), árvores em silhueta, pássaros e borboletas. Mesma linguagem do jogo: contorno colorido escuro ATRÁS do
// preenchimento (paintOrder stroke), volume em 3 tons; aqui a luz vem do sol baixo à ESQUERDA, então o
// "brilho de borda" é dourado e fica nas arestas viradas para ele. Sem filter/blur/máscara (as nuvens usam
// só um clipPath estático, desenhado uma vez).
import { useId } from 'react';
import { r1, sorteio } from './aleatorio';

function useUid(prefixo: string): string {
  return `${prefixo}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/* ------------------------------------------------------------------------------------------ nuvens */

// Cúmulos de VOLUME (não recortes chatos): cada nuvem é a união de gomos redondos sobre uma base reta,
// pintada em 3 tons — topo iluminado em pêssego/creme, corpo rosado e base sombreada em lilás —, com um
// crescente de sombra no pé de cada gomo, um realce no alto e um fio quente na barriga (o sol baixo
// acende a parte de baixo). Só as nuvens do primeiro plano (`perto`) ganham contorno; as distantes são
// macias, sem linha, e mais transparentes (perspectiva atmosférica).

/** [cx, cy, r] de cada gomo; cy + r ≤ base (os das pontas encostam na base e arredondam o canto). */
type Gomo = [number, number, number];
interface FormaNuvem {
  vb: string;
  base: number;
  gomos: Gomo[];
}

const FORMAS_NUVEM: FormaNuvem[] = [
  // cúmulo grande: 4 gomos altos + 2 de apoio nas pontas
  {
    vb: '0 0 204 84',
    base: 80,
    gomos: [
      [20, 66, 14],
      [46, 54, 24],
      [82, 40, 32],
      [122, 36, 34],
      [158, 50, 26],
      [184, 64, 16],
    ],
  },
  // cúmulo médio: 3 gomos com uma torre no meio
  {
    vb: '0 0 144 66',
    base: 62,
    gomos: [
      [16, 50, 12],
      [40, 42, 20],
      [72, 30, 28],
      [106, 40, 22],
      [128, 50, 12],
    ],
  },
  // cúmulo baixo e comprido (distante): gomos pequenos em fila irregular
  {
    vb: '0 0 168 40',
    base: 36,
    gomos: [
      [12, 28, 8],
      [32, 22, 14],
      [58, 19, 16],
      [86, 20, 16],
      [112, 22, 14],
      [136, 26, 10],
      [154, 28, 8],
    ],
  },
];

const circulo = (cx: number, cy: number, r: number) =>
  `M${r1(cx - r)} ${r1(cy)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0Z`;

/** Desenho de cada forma, montado uma vez (strings de path). */
const DESENHO_NUVEM = FORMAS_NUVEM.map(({ base, gomos }) => {
  const prim = gomos[0]!;
  const ult = gomos[gomos.length - 1]!;
  const forma = gomos.map(([x, y, r]) => circulo(x, y, r)).join('') + `M${prim[0]} ${base - 12}H${ult[0]}V${base}H${prim[0]}Z`;
  // sombra: crescente no pé de cada gomo (o círculo deslocado para baixo/direita, recortado pela forma)
  const sombra = gomos.map(([x, y, r]) => circulo(x + r * 0.24, y + r * 0.42, r * 0.82)).join('') + `M0 ${base - 7}H300V${base + 2}H0Z`;
  // realce: calota no alto/esquerda de cada gomo (a luz vem de cima e da esquerda)
  const luz = gomos.map(([x, y, r]) => circulo(x - r * 0.2, y - r * 0.3, r * 0.6)).join('');
  const barriga = `M${prim[0] + 2} ${base - 2}H${ult[0] - 2}`;
  return { forma, sombra, luz, barriga };
});

export function Nuvem({ forma = 0, perto = false, className }: { forma?: number; perto?: boolean; className?: string }) {
  const u = useUid('ca-nuvem');
  const i = FORMAS_NUVEM[forma] ? forma : 0;
  const f = FORMAS_NUVEM[i]!;
  const d = DESENHO_NUVEM[i]!;
  return (
    <svg viewBox={f.vb} className={className} aria-hidden>
      <defs>
        <linearGradient id={`${u}-g`} x1="0" y1="0" x2="0" y2={f.base} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff0d8" />
          <stop offset=".34" stopColor="#ffc8a6" />
          <stop offset=".7" stopColor="#e9a4c2" />
          <stop offset="1" stopColor="#a48cd2" />
        </linearGradient>
        <clipPath id={`${u}-c`}>
          <path d={d.forma} />
        </clipPath>
      </defs>
      {perto && <path d={d.forma} fill="#6d4f9a" stroke="#6d4f9a" strokeWidth="5" strokeLinejoin="round" />}
      <path d={d.forma} fill={`url(#${u}-g)`} />
      <g clipPath={`url(#${u}-c)`}>
        <path d={d.sombra} fill="#8a74c4" opacity=".3" />
        <path d={d.luz} fill="#fff7ea" opacity=".5" />
        <path d={d.barriga} stroke="#ffdca6" strokeWidth="3" strokeLinecap="round" opacity=".75" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------------------------- fardo de feno */

/** Fibras de palha sorteadas uma vez (módulo): clara + escura em 2 <path> por face. */
function fibras(semente: number, n: number, ponto: (a: number, b: number) => [number, number], dir: [number, number], comp: [number, number]) {
  const rnd = sorteio(semente);
  let claras = '';
  let escuras = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = ponto(rnd(), rnd());
    const l = comp[0] + rnd() * (comp[1] - comp[0]);
    const giro = (rnd() - 0.5) * 0.35;
    const dx = dir[0] * Math.cos(giro) - dir[1] * Math.sin(giro);
    const dy = dir[0] * Math.sin(giro) + dir[1] * Math.cos(giro);
    const seg = `M${r1(x)} ${r1(y)}l${r1(dx * l)} ${r1(dy * l)}`;
    if (rnd() < 0.55) claras += seg;
    else escuras += seg;
  }
  return { claras, escuras };
}

// geometria (viewBox 0 0 200 100): topo (14,34)(52,10)(190,10)(152,34); frente até y 94; lado até (190,70)
const FIBRAS_FRENTE = fibras(11, 46, (a, b) => [20 + a * 122, 40 + b * 48], [1, 0], [7, 15]);
const FIBRAS_TOPO = fibras(23, 30, (a, b) => [20 + a * 128 + b * 34, 31 - b * 20], [1, 0], [8, 14]);
const FIBRAS_LADO = fibras(37, 16, (a, b) => [156 + a * 30, 32 - a * 19 + b * 52], [0.85, -0.53], [4, 8]);
// palhas soltas espetadas nas arestas (quebram o "tijolo")
const PALHAS_SOLTAS = 'M24 36l-9 -7M40 26l-6 -9M78 10l-3 -9M128 10l4 -9M168 10l7 -7M190 30l8 -3M186 58l8 4M150 94l4 6M96 94l-2 7M40 94l-6 5M14 70l-8 2';

export function Fardo({ className }: { className?: string }) {
  const u = useUid('ca-fardo');
  return (
    <svg viewBox="-10 -12 220 120" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${u}-topo`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3b8" />
          <stop offset="1" stopColor="#f6d06a" />
        </linearGradient>
        <linearGradient id={`${u}-frente`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6cf63" />
          <stop offset=".55" stopColor="#dda544" />
          <stop offset="1" stopColor="#b97f2c" />
        </linearGradient>
        <linearGradient id={`${u}-lado`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c48d2e" />
          <stop offset="1" stopColor="#8a5520" />
        </linearGradient>
      </defs>
      {/* sombra de contato no chão (violeta, nunca marrom-cinza) */}
      <ellipse cx="104" cy="96" rx="104" ry="9" fill="#3a1f4a" opacity=".38" />
      {/* palhas soltas atrás do contorno */}
      <path d={PALHAS_SOLTAS} stroke="#6b4416" strokeWidth="4.4" strokeLinecap="round" />
      <path d={PALHAS_SOLTAS} stroke="#f2c75c" strokeWidth="2" strokeLinecap="round" />
      {/* silhueta com o contorno de palha (atrás) */}
      <path
        d="M14 36Q14 33 17 31L50 11Q52 10 55 10H187Q190 10 190 13V68Q190 70 188 72L155 93Q153 94 150 94H18Q14 94 14 90Z"
        fill={`url(#${u}-frente)`}
        stroke="#6b4416"
        strokeWidth="8"
        paintOrder="stroke"
        strokeLinejoin="round"
      />
      {/* lado (na sombra) e topo (no sol) */}
      <path d="M152 34L190 10V68Q190 70 188 72L152 94Z" fill={`url(#${u}-lado)`} />
      <path d="M14 36Q14 33 17 31L50 11Q52 10 55 10H190L152 34H14Z" fill={`url(#${u}-topo)`} />
      {/* fibras */}
      <g strokeLinecap="round" fill="none">
        <path d={FIBRAS_FRENTE.escuras} stroke="#a8722a" strokeWidth="1.6" opacity=".75" />
        <path d={FIBRAS_FRENTE.claras} stroke="#ffe9a0" strokeWidth="1.6" opacity=".85" />
        <path d={FIBRAS_TOPO.escuras} stroke="#d9a441" strokeWidth="1.5" opacity=".7" />
        <path d={FIBRAS_TOPO.claras} stroke="#fffbe0" strokeWidth="1.5" opacity=".9" />
        <path d={FIBRAS_LADO.escuras} stroke="#5e3612" strokeWidth="1.5" opacity=".6" />
        <path d={FIBRAS_LADO.claras} stroke="#d9a441" strokeWidth="1.5" opacity=".7" />
      </g>
      {/* aresta entre frente e lado + sombra cel embaixo da frente */}
      <path d="M152 35V93" stroke="#7a4a1a" strokeWidth="2" opacity=".55" />
      <path d="M18 86H150" stroke="#9a6424" strokeWidth="5" strokeLinecap="round" opacity=".45" />
      {/* barbante vermelho (2 voltas): frente + topo */}
      <g fill="none" strokeLinecap="round">
        <path d="M56 34V94M112 34V94M56 34L94 10M112 34L150 10" stroke="#5c1a0c" strokeWidth="5" />
        <path d="M56 34V94M112 34V94M56 34L94 10M112 34L150 10" stroke="#c8462a" strokeWidth="3" />
        <path d="M55 40V88M111 40V88" stroke="#f08a5c" strokeWidth="1" opacity=".8" />
      </g>
      {/* brilho de borda dourado: arestas viradas para o sol (esquerda e topo) */}
      <path d="M15 88V36Q15 34 18 32L51 12Q53 11 56 11H186" fill="none" stroke="#fffbe0" strokeWidth="2.2" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}

/* --------------------------------------------------------------------------- pedra (pedestal da diva) */

export function Pedra({ className }: { className?: string }) {
  const u = useUid('ca-pedra');
  return (
    <svg viewBox="-6 -4 172 92" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${u}-g`} cx=".32" cy=".25" r=".85">
          <stop offset="0" stopColor="#d6ccef" />
          <stop offset=".45" stopColor="#9a8cc4" />
          <stop offset="1" stopColor="#5a4c86" />
        </radialGradient>
        <linearGradient id={`${u}-musgo`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9ee7a" />
          <stop offset=".5" stopColor="#8fce4c" />
          <stop offset="1" stopColor="#4f9e3c" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="80" rx="80" ry="7" fill="#3a1f4a" opacity=".36" />
      <path
        d="M10 78C3 62 12 46 28 38C38 24 64 16 88 17C112 15 138 26 147 44C157 56 157 71 148 78Z"
        fill={`url(#${u}-g)`}
        stroke="#2e2448"
        strokeWidth="7"
        paintOrder="stroke"
        strokeLinejoin="round"
      />
      {/* sombra cel (crescente embaixo à direita) e rachaduras */}
      <path d="M148 78C157 70 156 56 147 45C150 60 140 72 118 78Z" fill="#45386e" opacity=".75" />
      <path d="M60 78C58 68 64 60 62 52M104 78C108 70 104 64 110 56M36 60C42 58 46 62 52 60" fill="none" stroke="#3e3266" strokeWidth="2" strokeLinecap="round" opacity=".6" />
      {/* musgo no topo, onde a avestruz pisa */}
      <path
        d="M30 40C42 26 70 18 96 19C118 18 138 28 142 40C134 36 126 40 118 36C108 40 98 34 88 38C76 34 66 40 56 36C46 42 38 38 30 40Z"
        fill={`url(#${u}-musgo)`}
        stroke="#2c5a24"
        strokeWidth="4"
        paintOrder="stroke"
        strokeLinejoin="round"
      />
      <path d="M44 31C58 23 78 20 96 21" fill="none" stroke="#f6ffc0" strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
      {/* brilho de borda dourado à esquerda */}
      <path d="M12 74C7 62 14 49 28 41" fill="none" stroke="#ffe2a0" strokeWidth="2.6" strokeLinecap="round" opacity=".9" />
      {/* florzinhas no pé da pedra */}
      <g stroke="#7a1a3a" strokeWidth="1">
        <circle cx="14" cy="76" r="4" fill="#ff8ac0" />
        <circle cx="22" cy="80" r="3.4" fill="#fff" />
        <circle cx="146" cy="78" r="3.6" fill="#ffd23f" />
      </g>
    </svg>
  );
}

/* --------------------------------------------------------------------------------------- capim */

const LAMINAS = [
  'M22 48C20 34 14 22 4 14C16 20 24 30 28 48Z',
  'M26 48C26 30 24 14 17 1C30 13 34 30 33 48Z',
  'M31 48C33 32 38 18 49 7C42 22 40 34 38 48Z',
  'M36 48C40 38 48 30 61 26C50 34 44 40 42 48Z',
  'M18 48C14 40 8 36 -1 34C10 33 18 38 23 48Z',
].join('');

export function Tufo({ className, flor }: { className?: string; flor?: string }) {
  const u = useUid('ca-tufo');
  return (
    <svg viewBox="-4 -4 70 54" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${u}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4e47c" />
          <stop offset=".35" stopColor="#9ad24c" />
          <stop offset="1" stopColor="#3a8a2c" />
        </linearGradient>
      </defs>
      <path d={LAMINAS} fill={`url(#${u}-g)`} stroke="#234d1b" strokeWidth="3.6" paintOrder="stroke" strokeLinejoin="round" />
      {flor && (
        <g transform="translate(46 20)">
          <path d="M0 0V24" stroke="#2c5a24" strokeWidth="2" />
          <circle r="5.4" fill={flor} stroke="#6a2a3a" strokeWidth="1.4" />
          <circle r="2.2" fill="#ffd23f" />
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------- construções em contraluz (meio) */
// Moinho e celeiro com MATERIAL (técnica da variante C: tábuas com veio, telhas, pedra, vidro), pintados na
// luz do pôr do sol: a frente fica na sombra quente (vinho/ameixa), o aro dourado acende as arestas
// viradas para o sol (à esquerda) e as luzes de dentro (janela, porta, palheiro) são o ponto mais quente.
// O que se mexe (pás, portas, cata-vento, fumaça, brilho da janela) é peça HTML à parte, animada por CSS.

const CONTORNO_MEIO = '#2a1838';
const COR_ARO = '#ffcf86';

/** Torre do moinho (viewBox 120×210, chão em y≈204); o eixo das pás fica em (60, 56). */
export function MoinhoTorre() {
  const u = useUid('ca-torre');
  let fiadas = '';
  for (let y = 90; y < 186; y += 12) {
    const e = 38 - (y - 76) * 0.125;
    const d = 82 + (y - 76) * 0.125;
    fiadas += `M${r1(e)} ${y}Q60 ${y + 3.5} ${r1(d)} ${y}`;
  }
  return (
    <svg viewBox="0 0 120 210" aria-hidden>
      <defs>
        <linearGradient id={`${u}-madeira`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d48a72" />
          <stop offset=".24" stopColor="#9a5c6c" />
          <stop offset=".7" stopColor="#6a3e60" />
          <stop offset="1" stopColor="#4a2e56" />
        </linearGradient>
        <linearGradient id={`${u}-capuz`} x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" stopColor="#d0646a" />
          <stop offset=".5" stopColor="#8e3a56" />
          <stop offset="1" stopColor="#56244a" />
        </linearGradient>
        <linearGradient id={`${u}-pedra`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b6a2be" />
          <stop offset=".4" stopColor="#7c6a92" />
          <stop offset="1" stopColor="#544870" />
        </linearGradient>
        <radialGradient id={`${u}-luz`} cx=".42" cy=".4" r=".6">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset=".55" stopColor="#ffd56b" />
          <stop offset="1" stopColor="#ff9a3c" />
        </radialGradient>
      </defs>
      <ellipse cx="66" cy="204" rx="52" ry="5" fill={CONTORNO_MEIO} opacity=".35" />
      <path d="M22 204L38 76H82L98 204Z" fill={`url(#${u}-madeira)`} stroke={CONTORNO_MEIO} strokeWidth="4" strokeLinejoin="round" paintOrder="stroke" />
      {/* fiadas de tábua com veio */}
      <path d={fiadas} fill="none" stroke="#3e2848" strokeWidth="1.6" opacity=".55" />
      <path d="M44 100Q47 112 45 124M74 132Q71 146 74 158M52 166Q55 176 53 184" fill="none" stroke="#3e2848" strokeWidth="1" opacity=".4" />
      {/* aro dourado na aresta virada para o sol */}
      <path d="M36.5 86L25.5 198" stroke={COR_ARO} strokeWidth="2.6" strokeLinecap="round" opacity=".95" />
      {/* janela redonda acesa e janelinha */}
      <circle cx="60" cy="122" r="8" fill={`url(#${u}-luz)`} stroke={CONTORNO_MEIO} strokeWidth="6" paintOrder="stroke" />
      <path d="M60 114V130M52 122H68" stroke="#7a3a2a" strokeWidth="1.6" opacity=".7" />
      <path d="M44 160V152Q48 147 52 152V160Z" fill="#ffc86b" stroke={CONTORNO_MEIO} strokeWidth="2.6" paintOrder="stroke" />
      {/* base de pedra e porta em arco com fresta de luz */}
      <path d="M20 204L23 186H97L100 204Z" fill={`url(#${u}-pedra)`} stroke={CONTORNO_MEIO} strokeWidth="2.8" strokeLinejoin="round" paintOrder="stroke" />
      <path d="M32 186V204M46 186V195M76 186V195M88 186V204M23 195H97" stroke="#463a62" strokeWidth="1.3" />
      <path d="M21 202L24 187" stroke={COR_ARO} strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
      <path d="M51 204V184Q60 172 69 184V204Z" fill="#3a2034" stroke={CONTORNO_MEIO} strokeWidth="2.8" strokeLinejoin="round" paintOrder="stroke" />
      <path d="M60 177V204" stroke="#ffb54a" strokeWidth="1.8" opacity=".9" />
      {/* capuz de telhas e varanda */}
      <path d="M33 76Q32 46 60 35Q88 46 87 76Z" fill={`url(#${u}-capuz)`} stroke={CONTORNO_MEIO} strokeWidth="4" strokeLinejoin="round" paintOrder="stroke" />
      <path d="M37 62Q48 58 60 62Q72 58 83 62M35 70Q47 66 60 70Q73 66 85 70M42 52Q51 48 60 52Q69 48 78 52" fill="none" stroke="#4a1a3a" strokeWidth="1.4" opacity=".7" />
      <path d="M36 70Q36 48 56 39" stroke={COR_ARO} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".95" />
      <rect x="27" y="74" width="66" height="8" rx="2" fill="#5e3446" stroke={CONTORNO_MEIO} strokeWidth="3" paintOrder="stroke" />
      <path d="M29 75.5H60" stroke={COR_ARO} strokeWidth="1.4" opacity=".8" />
      <path d="M30 66V74M38 66V74M82 66V74M90 66V74M30 66H40M80 66H90" stroke={CONTORNO_MEIO} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Pás do moinho (viewBox 200×200, eixo no centro): 4 braços com vela de lona em treliça, a lona acesa
 *  por trás pelo sol (pêssego translúcido). */
export function MoinhoPas() {
  const u = useUid('ca-pas');
  const braco = (
    <g>
      <rect x="104" y="12" width="26" height="70" fill={`url(#${u}-vela)`} stroke="#5a3446" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M112.7 12V82M121.3 12V82M104 24H130M104 36H130M104 48H130M104 60H130M104 72H130" stroke="#b07a6a" strokeWidth="1.4" />
      <rect x="96" y="6" width="8" height="94" rx="2" fill="#6a3c4e" stroke={CONTORNO_MEIO} strokeWidth="3" paintOrder="stroke" />
      <path d="M98.5 9V88" stroke="#e0907a" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
  return (
    <svg viewBox="0 0 200 200" aria-hidden>
      <defs>
        <linearGradient id={`${u}-vela`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe6b8" />
          <stop offset=".6" stopColor="#f6b88e" />
          <stop offset="1" stopColor="#d88a7c" />
        </linearGradient>
      </defs>
      {[0, 90, 180, 270].map((a) => (
        <g key={a} transform={`rotate(${a} 100 100)`}>
          {braco}
        </g>
      ))}
      <circle cx="100" cy="100" r="12" fill="#5e3446" stroke={CONTORNO_MEIO} strokeWidth="3.5" paintOrder="stroke" />
      <circle cx="100" cy="100" r="5" fill="#d8a070" stroke={CONTORNO_MEIO} strokeWidth="1.6" />
      <circle cx="96" cy="96" r="2.4" fill="#fff" opacity=".6" />
    </svg>
  );
}

/** Celeiro em contraluz (viewBox 240×160, chão em y 152): rancho com chaminé à esquerda, celeiro de
 *  telhado holandês com tábuas, palheiro com feno e o vão da porta (escuro, com feno lá dentro), e o silo
 *  de metal à direita. As folhas da porta, a luz de dentro, o cata-vento, a fumaça e o brilho da janela são
 *  peças HTML (Paisagem.tsx). */
export function Celeiro() {
  const u = useUid('ca-celeiro');
  let tabuas = '';
  for (let x = 60; x < 166; x += 8) tabuas += `M${x} 74V146`;
  let tabuasRancho = '';
  for (let x = 16; x < 56; x += 8) tabuasRancho += `M${x} ${r1(94 - (x - 8) / 3 + 3)}V148`;
  return (
    <svg viewBox="0 0 240 160" aria-hidden>
      <defs>
        <linearGradient id={`${u}-parede`} x1="0" y1="0" x2=".5" y2="1">
          <stop offset="0" stopColor="#c45a62" />
          <stop offset=".5" stopColor="#933c58" />
          <stop offset="1" stopColor="#6a2a4c" />
        </linearGradient>
        <linearGradient id={`${u}-telhado`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7a4a74" />
          <stop offset="1" stopColor="#3e2448" />
        </linearGradient>
        <linearGradient id={`${u}-metal`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c8b4d8" />
          <stop offset=".3" stopColor="#8c7aae" />
          <stop offset="1" stopColor="#4a3e6a" />
        </linearGradient>
        <linearGradient id={`${u}-vao`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e0e1c" />
          <stop offset="1" stopColor="#4a2a22" />
        </linearGradient>
      </defs>
      <ellipse cx="124" cy="152" rx="122" ry="6" fill={CONTORNO_MEIO} opacity=".35" />
      {/* silo de metal (atrás) */}
      <path d="M170 152V42Q190 12 210 42V152Z" fill={`url(#${u}-metal)`} stroke="#241c3a" strokeWidth="3.5" strokeLinejoin="round" paintOrder="stroke" />
      <path d="M170 64H210M170 88H210M170 112H210M170 136H210" stroke="#3a2e58" strokeWidth="1.6" opacity=".7" />
      <path d="M172 150V44Q180 30 190 24" fill="none" stroke={COR_ARO} strokeWidth="2" strokeLinecap="round" opacity=".9" />
      <path d="M186 22L194 22" stroke="#241c3a" strokeWidth="3" strokeLinecap="round" />
      {/* rancho com chaminé de tijolo */}
      <rect x="18" y="58" width="10" height="30" fill="#7a3a3e" stroke={CONTORNO_MEIO} strokeWidth="2.6" paintOrder="stroke" />
      <path d="M18 66H28M18 74H28M18 82H28M23 58V66M21 66V74M25 74V82" stroke="#4a1e2e" strokeWidth="1" />
      <rect x="15.5" y="53" width="15" height="6" rx="1.5" fill="#4a2232" stroke={CONTORNO_MEIO} strokeWidth="2.2" paintOrder="stroke" />
      <path d="M8 152V94L56 78V152Z" fill={`url(#${u}-parede)`} stroke={CONTORNO_MEIO} strokeWidth="3.5" strokeLinejoin="round" paintOrder="stroke" />
      <path d={tabuasRancho} stroke="#5a1e3c" strokeWidth="1.1" opacity=".55" />
      <path d="M3 97L60 76" stroke={CONTORNO_MEIO} strokeWidth="7" strokeLinecap="round" />
      <path d="M3 97L60 76" stroke="#7a4a74" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M4 95L30 85.5" stroke={COR_ARO} strokeWidth="1.5" strokeLinecap="round" opacity=".9" />
      <path d="M10 150V97" stroke={COR_ARO} strokeWidth="1.8" strokeLinecap="round" opacity=".85" />
      {/* janela do rancho (acesa) */}
      <rect x="20" y="106" width="15" height="12" rx="1.5" fill="#ffd56b" stroke={CONTORNO_MEIO} strokeWidth="4" paintOrder="stroke" />
      <path d="M27.5 106V118M20 112H35" stroke="#8a4a2a" strokeWidth="1.4" />
      <path d="M22 108L26 108L22 111Z" fill="#fffbe0" />
      {/* celeiro: paredes com tábuas */}
      <path d="M50 152V72L64 46L110 24L156 46L170 72V152Z" fill={`url(#${u}-parede)`} stroke={CONTORNO_MEIO} strokeWidth="4" strokeLinejoin="round" paintOrder="stroke" />
      <path d={tabuas} stroke="#5a1e3c" strokeWidth="1.2" opacity=".5" />
      <path d="M72 80Q74 92 72 104M148 86Q146 100 148 112M100 112Q102 124 100 136" fill="none" stroke="#5a1e3c" strokeWidth=".9" opacity=".35" />
      {/* telhado (água de cima com telhas) */}
      <path d="M46 76L62 44L110 20L158 44L174 76L166 74L154 48L110 27L66 48L54 74Z" fill={`url(#${u}-telhado)`} stroke={CONTORNO_MEIO} strokeWidth="2" strokeLinejoin="round" />
      {/* acabamento claro do telhado e das quinas (rosa-pálido na sombra, dourado no lado do sol) */}
      <path d="M46 76L62 43L110 19L158 43L174 76" fill="none" stroke={CONTORNO_MEIO} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M46 76L62 43L110 19L158 43L174 76" fill="none" stroke="#d8aab0" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M47 73L62.5 44L109 21" fill="none" stroke="#fff0c8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M55 78V148M165 78V148" stroke={CONTORNO_MEIO} strokeWidth="7.5" strokeLinecap="round" />
      <path d="M55 78V148M165 78V148" stroke="#c8969e" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M53.6 80V146" stroke={COR_ARO} strokeWidth="1.4" strokeLinecap="round" opacity=".9" />
      {/* palheiro: portinhola com X e feno escapando, luz quente lá dentro */}
      <rect x="99" y="48" width="22" height="20" rx="1.5" fill="#ffb54a" stroke={CONTORNO_MEIO} strokeWidth="7" paintOrder="stroke" />
      <path d="M100 63Q110 58 120 63V67H100Z" fill="#e0a040" />
      <rect x="99" y="48" width="22" height="20" rx="1.5" fill="none" stroke="#d8aab0" strokeWidth="2.8" />
      <path d="M100 69l-2 5M104 69l0 6M109 69l1.5 5.5M114 69l-1 5M119 69l2 4.5" stroke="#f2c75c" strokeWidth="2" strokeLinecap="round" />
      {/* vão da porta: escuro com feno; a luz e as folhas são peças HTML */}
      <rect x="84" y="92" width="52" height="7" rx="2" fill="#c8969e" stroke={CONTORNO_MEIO} strokeWidth="3" paintOrder="stroke" />
      <rect x="88" y="99" width="44" height="53" fill={`url(#${u}-vao)`} />
      <path d="M90 152Q91 134 102 133H120Q130 134 130 152Z" fill="#b07d24" opacity=".7" />
      <path d="M95 145H125M98 139H122" stroke="#e0b048" strokeWidth="1.2" opacity=".55" />
      <rect x="86.5" y="97.5" width="47" height="55" fill="none" stroke={CONTORNO_MEIO} strokeWidth="6" />
      <rect x="86.5" y="97.5" width="47" height="55" fill="none" stroke="#c8969e" strokeWidth="2.6" />
      {/* alicerce de pedra */}
      <path d="M6 148H172V154H6Z" fill="#7c6a92" stroke="#2e2442" strokeWidth="2" strokeLinejoin="round" paintOrder="stroke" />
      <path d="M22 148V154M44 148V154M70 148V154M150 148V154" stroke="#463a62" strokeWidth="1.2" />
    </svg>
  );
}

/** Folha da porta do celeiro (viewBox 22×53): tábuas vinho, moldura clara e X. */
export function FolhaPorta({ lado }: { lado: 'e' | 'd' }) {
  return (
    <svg viewBox="0 0 22 53" preserveAspectRatio="none" aria-hidden>
      <rect x="1.2" y="1.2" width="19.6" height="50.6" fill="#8a3452" stroke={CONTORNO_MEIO} strokeWidth="2.4" />
      <path d="M6.5 2V51M11 2V51M15.5 2V51" stroke="#5a1e3c" strokeWidth="1" />
      <rect x="3.4" y="3.4" width="15.2" height="46.2" fill="none" stroke="#d8aab0" strokeWidth="2.4" />
      <path d="M4.2 4.2L17.8 48.8M17.8 4.2L4.2 48.8" stroke="#d8aab0" strokeWidth="2.2" />
      <circle cx={lado === 'e' ? 17.5 : 4.5} cy="27" r="1.6" fill="#ffd56b" />
    </svg>
  );
}

/** Cata-vento com galo de ferro (viewBox 40×44, de C): gira "em 3D" achatando no eixo X. */
export function CataVento() {
  return (
    <svg viewBox="0 0 40 44" aria-hidden>
      <path d="M20 44V17" stroke={CONTORNO_MEIO} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M5 21H33" stroke={CONTORNO_MEIO} strokeWidth="2" strokeLinecap="round" />
      <path d="M36 21L30 17.5V24.5Z" fill={CONTORNO_MEIO} />
      <path d="M5 21L2 17M5 21L2 25M8 21L5 17M8 21L5 25" stroke={CONTORNO_MEIO} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13 15Q11 9 15 7Q16 2.5 19.5 3.5Q21.5 1 23 4L25.5 5L23.2 6.4Q26.5 9.5 24.5 15Z" fill={CONTORNO_MEIO} />
      <path d="M13.5 14Q7 11 8 4Q11.5 8.5 15 9.5Z" fill={CONTORNO_MEIO} />
      <path d="M14 13Q12.5 9 15.5 7.5" fill="none" stroke={COR_ARO} strokeWidth="1" strokeLinecap="round" opacity=".9" />
      <circle cx="20" cy="17" r="2.2" fill="#ffc93c" stroke="#5a3a00" strokeWidth="1" />
    </svg>
  );
}

const COR_SILHUETA = '#3a2352';

/** Árvore de copa redonda em silhueta (camada do meio). É um <g> (caixa 90×110, pé em y 110) para ir
 *  direto dentro da prancha SVG: um <svg> aninhado sem largura ocuparia a prancha inteira. */
export function Arvore() {
  return (
    <g>
      <path d="M41 110V66L34 54M45 80L56 66" stroke={COR_SILHUETA} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path
        d="M12 62C2 56 4 38 16 34C14 18 30 8 44 14C54 2 76 6 78 24C90 28 92 48 80 56C82 70 64 76 54 68C46 76 26 74 22 64C18 66 14 64 12 62Z"
        fill={COR_SILHUETA}
      />
      <path d="M8 50C6 40 10 34 17 33C15 20 28 10 41 14" fill="none" stroke={COR_ARO} strokeWidth="1.8" strokeLinecap="round" opacity=".8" />
    </g>
  );
}

/** Fardo redondo distante (camada do campo, desktop). Um <g> com o pé em y 0. */
export function FardoRedondo() {
  return (
    <g>
      <ellipse cx="2" cy="0" rx="26" ry="4" fill="#2f5f24" opacity=".35" />
      <path d="M-20 0A20 20 0 1 1 20 0Z" fill="#e2ad4c" stroke="#6b4416" strokeWidth="3" strokeLinejoin="round" />
      <path d="M-14 -4A14 14 0 0 1 10 -16M-8 -2A8 8 0 0 1 6 -9" fill="none" stroke="#fff0b0" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
      <path d="M4 -1A14 14 0 0 0 14 -10" fill="none" stroke="#a8722a" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

/* ------------------------------------------------------------------------------- miudezas animadas */

/** Pássaro distante (silhueta "m"); as asas batem achatando a peça HTML em volta (.ca-bando-asa). */
export function Passaro() {
  return (
    <svg viewBox="-1 -2 26 14" className="ca-passaro" aria-hidden>
      <path d="M0 4Q6 -1 12 5Q18 -1 24 4Q18 2 12 8Q6 2 0 4Z" fill="#3b2050" />
    </svg>
  );
}

/** Borboleta (viewBox 32×26, de C): as asas batem achatando a peça HTML em volta (por CSS). */
export function Borboleta({ cor, escura, pinta }: { cor: string; escura: string; pinta: string }) {
  return (
    <svg viewBox="0 0 32 26" aria-hidden>
      <g fill={cor} stroke={escura} strokeWidth="1.6" strokeLinejoin="round" paintOrder="stroke">
        <path d="M16 13Q7 -1 2.5 5Q0 12 16 14Z" />
        <path d="M16 13Q25 -1 29.5 5Q32 12 16 14Z" />
        <path d="M16 14Q7 24 4.5 20Q4 15 16 14Z" />
        <path d="M16 14Q25 24 27.5 20Q28 15 16 14Z" />
      </g>
      <g fill={pinta}>
        <circle cx="7" cy="7" r="1.8" />
        <circle cx="25" cy="7" r="1.8" />
        <circle cx="8.5" cy="18" r="1.2" />
        <circle cx="23.5" cy="18" r="1.2" />
      </g>
      <ellipse cx="16" cy="14" rx="1.6" ry="6" fill="#3a1a2a" />
      <path d="M15.4 8.5Q13 4 11.5 3.5M16.6 8.5Q19 4 20.5 3.5" stroke="#3a1a2a" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Pena solta (viewBox 12×20, de C) para a rajada do toque. */
export function Pena({ cor, contorno }: { cor: string; contorno: string }) {
  return (
    <svg viewBox="0 0 12 20" aria-hidden>
      <path d="M6 1Q12 7 9.5 14Q8 18 6 19Q4 18 2.5 14Q0 7 6 1Z" fill={cor} stroke={contorno} strokeWidth="1.6" paintOrder="stroke" />
      <path d="M6 4V19" stroke={contorno} strokeWidth="1" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

/** Brilho de 4 pontas (estrelinha). */
export function Estrela({ className, cor = '#fff6c8' }: { className?: string; cor?: string }) {
  return (
    <svg viewBox="-11 -11 22 22" className={className} aria-hidden>
      <path d="M0 -10C1.4 -2.4 2.4 -1.4 10 0C2.4 1.4 1.4 2.4 0 10C-1.4 2.4 -2.4 1.4 -10 0C-2.4 -1.4 -1.4 -2.4 0 -10Z" fill={cor} />
    </svg>
  );
}

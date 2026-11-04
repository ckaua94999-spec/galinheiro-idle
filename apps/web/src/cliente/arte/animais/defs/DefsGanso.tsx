// Gradientes do ganso (ids "gi-animais-ganso-<material>", objectBoundingBox). Montados uma vez por
// DefsAnimais. Penas brancas com sombra VIOLETA (#b9b4d6, o que separa o ganso da galinha creme),
// bico laranja, calombo laranja-queimado, íris azul, o cachecol épico roxo com broche dourado, o pescoço
// (userSpaceOnUse: claro embaixo, no tom da base da cabeça na garganta), o brilho épico (miolo branco + pontas lilás num gradiente só) e a lágrima
// com reflexo embutido. 11 ids.
import { CAIXA_CABECA } from '../Ganso';

// Volume das penas: realce no alto à esquerda → base branca → sombra lilás. Usadas pelas penas
// (objectBoundingBox) e pela pálpebra (userSpaceOnUse na caixa da cabeça): uma fonte só, sem descasar.
const FOCO_PENAS = { cx: '.38', cy: '.32', r: '.75', fx: '.32', fy: '.25' } as const;
const PARADAS_PENAS = [
  ['0', '#ffffff'],
  ['.35', '#fafaf7'],
  ['.78', '#efeef6'],
  ['1', '#c4bfdd'],
] as const;
const [CX, CY, CL, CA] = CAIXA_CABECA;

export function DefsGanso() {
  const paradas = PARADAS_PENAS.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />);
  return (
    <>
      <radialGradient id="gi-animais-ganso-penas" {...FOCO_PENAS}>
        {paradas}
      </radialGradient>
      {/* Pálpebra (piscada e tampas): o MESMO gradiente das penas em userSpaceOnUse sobre a caixa da CABECA
          (CAIXA_CABECA, Ganso.tsx, coordenadas da cabeça) — gradientTransform = caixa, então a pálpebra casa
          pixel a pixel com a cabeça (sem oval de cor chapada). */}
      <radialGradient id="gi-animais-ganso-palpebra" gradientUnits="userSpaceOnUse" gradientTransform={`matrix(${CL} 0 0 ${CA} ${CX} ${CY})`} {...FOCO_PENAS}>
        {paradas}
      </radialGradient>
      {/* Asa e cauda: quase tão brancas quanto o corpo; a sombra lavanda fica só embaixo (a separação
          entre asa e flanco vem do contorno e da sombra cel que a asa projeta). */}
      <radialGradient id="gi-animais-ganso-asa" cx=".35" cy=".25" r=".85" fx=".28" fy=".18">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".38" stopColor="#f1f0f7" />
        <stop offset=".78" stopColor="#ebe8f5" />
        <stop offset="1" stopColor="#bcb6db" />
      </radialGradient>
      <linearGradient id="gi-animais-ganso-bico" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffc07a" />
        <stop offset=".45" stopColor="#ff8a2a" />
        <stop offset="1" stopColor="#d4501a" />
      </linearGradient>
      {/* Calombo do ganso-chinês: laranja-queimado, mais escuro e saturado que o bico (separa as peças). */}
      <linearGradient id="gi-animais-ganso-calombo" x1=".3" y1="0" x2=".6" y2="1">
        <stop offset="0" stopColor="#ff9a3c" />
        <stop offset=".55" stopColor="#e2601e" />
        <stop offset="1" stopColor="#b8400f" />
      </linearGradient>
      <linearGradient id="gi-animais-ganso-iris" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#13284a" />
        <stop offset=".45" stopColor="#2e5a8a" />
        <stop offset="1" stopColor="#7fb4e6" />
      </linearGradient>
      {/* Tricô roxo: lilás claro em cima à esquerda → roxo épico → roxo escuro embaixo. */}
      <radialGradient id="gi-animais-ganso-cachecol" cx=".35" cy=".25" r=".85" fx=".3" fy=".15">
        <stop offset="0" stopColor="#c9b0ff" />
        <stop offset=".4" stopColor="#9a6dfa" />
        <stop offset=".8" stopColor="#7b4cec" />
        <stop offset="1" stopColor="#5b2fc9" />
      </radialGradient>
      <linearGradient id="gi-animais-ganso-estrela" x1=".2" y1="0" x2=".8" y2="1">
        <stop offset="0" stopColor="#fff6c0" />
        <stop offset=".45" stopColor="#ffd23f" />
        <stop offset="1" stopColor="#e09a00" />
      </linearGradient>
      {/* Pescoço em userSpaceOnUse (coordenadas do desenho): a emenda, desenhada no espaço do pescoço,
          pega exatamente as mesmas cores dele — sem degrau na garganta. */}
      <radialGradient id="gi-animais-ganso-pescoco" gradientUnits="userSpaceOnUse" cx="31" cy="58" r="30" fx="29" fy="55">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".4" stopColor="#fafaf7" />
        <stop offset=".72" stopColor="#eeedf5" />
        <stop offset="1" stopColor="#e2e0ee" />
      </radialGradient>
      {/* Brilho épico de 4 pontas: miolo branco (~1/3 do raio) → lilás de brilho → roxo épico nas pontas. */}
      <radialGradient id="gi-animais-ganso-brilho" cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".24" stopColor="#ffffff" />
        <stop offset=".36" stopColor="#d9c6ff" />
        <stop offset=".6" stopColor="#b48cff" />
        <stop offset="1" stopColor="#8b5cf6" />
      </radialGradient>
      {/* Lágrima com o reflexo embutido (foco embaixo à esquerda): uma peça só em vez de gota + reflexo. */}
      <radialGradient id="gi-animais-ganso-lagrima" cx=".5" cy=".66" r=".62" fx=".3" fy=".64">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".16" stopColor="#ffffff" />
        <stop offset=".26" stopColor="#d8f2ff" />
        <stop offset=".62" stopColor="#8cd3ff" />
        <stop offset="1" stopColor="#4f9fe6" />
      </radialGradient>
    </>
  );
}

// Gradientes do pato (ids "gi-animais-pato-<material>", objectBoundingBox). Montados uma vez por DefsAnimais.
// Pato-de-pequim branco: a sombra é FRIA (azul-pervinca), não pêssego como a da galinha — separa as duas
// aves brancas a 72 px e casa com o azul da raridade (lenço). 7 ids.
import { CAIXA_CABECA } from '../Pato';

// Penas: branco-quente no realce → branco → sombra pervinca. Usadas pelas penas (objectBoundingBox) e pela
// pálpebra (userSpaceOnUse na caixa da cabeça): uma fonte só, para as duas nunca descasarem.
const FOCO_PENAS = { cx: '.38', cy: '.32', r: '.75', fx: '.32', fy: '.25' } as const;
const PARADAS_PENAS = [
  ['0', '#ffffff'],
  ['.35', '#fffdf6'],
  ['.78', '#eef1fa'],
  ['1', '#b4c3ea'],
] as const;
const [CX, CY, CL, CA] = CAIXA_CABECA;

export function DefsPato() {
  const paradas = PARADAS_PENAS.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />);
  return (
    <>
      <radialGradient id="gi-animais-pato-penas" {...FOCO_PENAS}>
        {paradas}
      </radialGradient>
      {/* Pálpebra (piscada e tampas do kit): o MESMO gradiente das penas, mas em userSpaceOnUse sobre a caixa
          da CABECA (CAIXA_CABECA, Pato.tsx) — gradientTransform = caixa, então foco e paradas valem igual ao
          objectBoundingBox da cabeça e a pálpebra casa pixel a pixel com ela (cor chapada virava um oval claro
          sobre a sombra azulada). */}
      <radialGradient id="gi-animais-pato-palpebra" gradientUnits="userSpaceOnUse" gradientTransform={`matrix(${CL} 0 0 ${CA} ${CX} ${CY})`} {...FOCO_PENAS}>
        {paradas}
      </radialGradient>
      {/* Asa e cauda: um tom mais frio que o corpo (destaca a asa do flanco). */}
      <radialGradient id="gi-animais-pato-asa" cx=".38" cy=".3" r=".8" fx=".3" fy=".2">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".4" stopColor="#f2f4fc" />
        <stop offset=".8" stopColor="#d6def5" />
        <stop offset="1" stopColor="#a9b9e6" />
      </radialGradient>
      {/* Bico e pés: laranja-gema, claro em cima. */}
      <linearGradient id="gi-animais-pato-bico" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffe48c" />
        <stop offset=".42" stopColor="#ffab2e" />
        <stop offset="1" stopColor="#ec6a10" />
      </linearGradient>
      {/* Pé palmado: no eixo x LOCAL do pé (desenhado de pé); girado no ninho, a metade de baixo da palma
          fica escura — separa o pé do bico e da cauda. */}
      <linearGradient id="gi-animais-pato-pe" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffc95a" />
        <stop offset=".42" stopColor="#ffab2e" />
        <stop offset="1" stopColor="#e0640c" />
      </linearGradient>
      {/* Íris azul (o pequim tem olho azul-acinzentado): reforça a raridade. */}
      <linearGradient id="gi-animais-pato-iris" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#13234a" />
        <stop offset=".45" stopColor="#2d62b8" />
        <stop offset="1" stopColor="#86c0f4" />
      </linearGradient>
      {/* Lenço azul da raridade (rara #3b82f6), com realce claro no alto à esquerda (mais claro que o
          fundo azul da carta rara, para não se fundir com ele). */}
      <radialGradient id="gi-animais-pato-lenco" cx=".34" cy=".25" r=".85" fx=".28" fy=".15">
        <stop offset="0" stopColor="#b8dcff" />
        <stop offset=".32" stopColor="#5aa0ff" />
        <stop offset=".75" stopColor="#3b82f6" />
        <stop offset="1" stopColor="#1d5fd0" />
      </radialGradient>
    </>
  );
}

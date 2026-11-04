// Gradientes/padrões SVG compartilhados da área "cartas". Montados uma única vez na página por <DefsArte />;
// use nos desenhos com fill="url(#gi-cartas-...)". Todo id DEVE começar com "gi-cartas-".
// Todos em objectBoundingBox: servem para o ovo do valor, as gemas, a joia da crista e o emblema do verso.

// Gemas (DIRECAO_DE_ARTE 6.5): clara no alto à esquerda → base → escura.
const GEMAS = {
  comum: ['#ffffff', '#c3cad3', '#6b7480'],
  raro: ['#d6ebff', '#3b82f6', '#173f9a'],
  epico: ['#efe4ff', '#8b5cf6', '#3f1a99'],
  lendario: ['#fffbd6', '#ffc21a', '#b06a00'],
} as const;

export function DefsCartas() {
  return (
    <>
      {/* "gota" do valor: ovo dourado (6.4) */}
      <radialGradient id="gi-cartas-ovo-valor" cx=".35" cy=".3" r=".8" fx=".32" fy=".24">
        <stop offset="0" stopColor="#fff8d6" />
        <stop offset=".55" stopColor="#ffd24a" />
        <stop offset="1" stopColor="#c98a00" />
      </radialGradient>
      {/* ovo do valor "apagado" (carta aposentada): ardósia */}
      <radialGradient id="gi-cartas-ovo-apagado" cx=".35" cy=".3" r=".8" fx=".32" fy=".24">
        <stop offset="0" stopColor="#eef0f3" />
        <stop offset=".55" stopColor="#b8bec8" />
        <stop offset="1" stopColor="#7d8591" />
      </radialGradient>
      {/* sombra cel do ovo (crescente embaixo à direita) */}
      <linearGradient id="gi-cartas-ovo-sombra" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#d07a00" stopOpacity="0" />
        <stop offset="1" stopColor="#a64d00" stopOpacity=".55" />
      </linearGradient>
      {GEMAS_IDS}
      {/* joia da crista (épico e lendário) */}
      <radialGradient id="gi-cartas-joia-lendario" cx=".35" cy=".3" r=".85">
        <stop offset="0" stopColor="#ffd0dc" />
        <stop offset=".45" stopColor="#ff4f7a" />
        <stop offset="1" stopColor="#9e1240" />
      </radialGradient>
      <radialGradient id="gi-cartas-joia-epico" cx=".35" cy=".3" r=".85">
        <stop offset="0" stopColor="#f3eaff" />
        <stop offset=".45" stopColor="#a77bff" />
        <stop offset="1" stopColor="#4a1fb0" />
      </radialGradient>
      {/* engaste dourado da joia */}
      <linearGradient id="gi-cartas-ouro" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff1a8" />
        <stop offset=".5" stopColor="#ffc93c" />
        <stop offset="1" stopColor="#c27c00" />
      </linearGradient>
    </>
  );
}

const GEMAS_IDS = (Object.keys(GEMAS) as (keyof typeof GEMAS)[]).map((r) => (
  <linearGradient key={r} id={`gi-cartas-gema-${r}`} x1=".15" y1="0" x2=".85" y2="1">
    <stop offset="0" stopColor={GEMAS[r][0]} />
    <stop offset=".45" stopColor={GEMAS[r][1]} />
    <stop offset="1" stopColor={GEMAS[r][2]} />
  </linearGradient>
));

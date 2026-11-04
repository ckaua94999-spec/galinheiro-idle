// Gradientes da galinha (ids "gi-animais-galinha-<material>", objectBoundingBox). Molde para as outras
// espécies: radial de volume com a luz em cima à esquerda (cx .38 cy .32 r .75 fx .32 fy .25) e stops
// realce 0 → base .35 → base .78 → sombra 1; bico em linear vertical; íris escura em cima e clara embaixo.
export function DefsGalinha() {
  return (
    <>
      <radialGradient id="gi-animais-galinha-penas" cx=".38" cy=".32" r=".75" fx=".32" fy=".25">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".35" stopColor="#fff4e2" />
        <stop offset=".78" stopColor="#fbe7cc" />
        <stop offset="1" stopColor="#edbe96" />
      </radialGradient>
      <radialGradient id="gi-animais-galinha-asa" cx=".38" cy=".3" r=".8" fx=".3" fy=".2">
        <stop offset="0" stopColor="#fffaf0" />
        <stop offset=".4" stopColor="#fbe6ca" />
        <stop offset=".8" stopColor="#f0cba4" />
        <stop offset="1" stopColor="#e2a985" />
      </radialGradient>
      {/* Cauda: pêssego quente e saturado na base → creme nas pontas (destaca a cauda do corpo creme). */}
      <linearGradient id="gi-animais-galinha-cauda" x1=".05" y1="1" x2=".9" y2="0">
        <stop offset="0" stopColor="#d9824e" />
        <stop offset=".5" stopColor="#f2b27a" />
        <stop offset="1" stopColor="#fff3e0" />
      </linearGradient>
      <radialGradient id="gi-animais-galinha-crista" cx=".38" cy=".32" r=".8" fx=".3" fy=".22">
        <stop offset="0" stopColor="#ff8466" />
        <stop offset=".4" stopColor="#ee4334" />
        <stop offset=".72" stopColor="#e2393a" />
        <stop offset="1" stopColor="#b8233a" />
      </radialGradient>
      <linearGradient id="gi-animais-galinha-bico" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffe07a" />
        <stop offset=".45" stopColor="#ffb52e" />
        <stop offset="1" stopColor="#e2740f" />
      </linearGradient>
      <linearGradient id="gi-animais-galinha-iris" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2a160a" />
        <stop offset=".45" stopColor="#6b3f1f" />
        <stop offset="1" stopColor="#c0874a" />
      </linearGradient>
    </>
  );
}

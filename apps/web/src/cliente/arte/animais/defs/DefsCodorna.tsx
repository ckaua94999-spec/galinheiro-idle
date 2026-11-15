// Gradientes da codorna (ids "gi-animais-codorna-<material>", objectBoundingBox), no molde da galinha.
// A íris é a da galinha (gi-animais-galinha-iris): 5 ids novos.
export function DefsCodorna() {
  return (
    <>
      <radialGradient id="gi-animais-codorna-penas" cx=".38" cy=".32" r=".75" fx=".32" fy=".25">
        <stop offset="0" stopColor="#ffe9c4" />
        <stop offset=".35" stopColor="#e8b77a" />
        <stop offset=".78" stopColor="#cf9255" />
        <stop offset="1" stopColor="#a8693a" />
      </radialGradient>
      <radialGradient id="gi-animais-codorna-asa" cx=".38" cy=".3" r=".8" fx=".3" fy=".2">
        <stop offset="0" stopColor="#e6b27a" />
        <stop offset=".45" stopColor="#b97a42" />
        <stop offset="1" stopColor="#80502a" />
      </radialGradient>
      <linearGradient id="gi-animais-codorna-bico" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a88a72" />
        <stop offset=".5" stopColor="#6e5240" />
        <stop offset="1" stopColor="#3e2a1c" />
      </linearGradient>
      <linearGradient id="gi-animais-codorna-pe" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffc2a6" />
        <stop offset="1" stopColor="#e88a6a" />
      </linearGradient>
    </>
  );
}

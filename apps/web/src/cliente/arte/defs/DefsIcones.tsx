// Gradientes/padrões SVG compartilhados da área "icones". Montados uma única vez na página por <DefsArte />;
// use nos desenhos com fill="url(#gi-icones-...)". Todo id DEVE começar com "gi-icones-".
// Tudo em objectBoundingBox (padrão do SVG): o mesmo gradiente serve para qualquer forma e tamanho.

// Volume em 3 tons: realce no alto à esquerda, base, sombra embaixo à direita (DIRECAO_DE_ARTE 5.1).
function Radial({ id, realce, base, sombra }: { id: string; realce: string; base: string; sombra: string }) {
  return (
    <radialGradient id={id} cx=".38" cy=".32" r=".78" fx=".32" fy=".24">
      <stop offset="0" stopColor={realce} />
      <stop offset=".38" stopColor={base} />
      <stop offset=".8" stopColor={base} />
      <stop offset="1" stopColor={sombra} />
    </radialGradient>
  );
}

function Vertical({ id, cores }: { id: string; cores: [number, string][] }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      {cores.map(([o, c]) => (
        <stop key={o} offset={o} stopColor={c} />
      ))}
    </linearGradient>
  );
}

function Diagonal({ id, claro, base, escuro }: { id: string; claro: string; base: string; escuro: string }) {
  return (
    <linearGradient id={id} x1=".15" y1="0" x2=".85" y2="1">
      <stop offset="0" stopColor={claro} />
      <stop offset=".5" stopColor={base} />
      <stop offset="1" stopColor={escuro} />
    </linearGradient>
  );
}

export function DefsIcones() {
  return (
    <>
      {/* brilho branco genérico (elipses de realce) */}
      <radialGradient id="gi-icones-realce" cx=".45" cy=".4" r=".6">
        <stop offset="0" stopColor="#fff" stopOpacity=".95" />
        <stop offset=".6" stopColor="#fff" stopOpacity=".55" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>

      {/* moeda do jogo */}
      <radialGradient id="gi-icones-moeda-face" cx=".36" cy=".3" r=".8" fx=".3" fy=".22">
        <stop offset="0" stopColor="#fff9c9" />
        <stop offset=".3" stopColor="#ffe066" />
        <stop offset=".72" stopColor="#ffb81f" />
        <stop offset="1" stopColor="#e58f00" />
      </radialGradient>
      <Vertical id="gi-icones-moeda-aro" cores={[[0, '#fff3b0'], [0.42, '#ffcf3f'], [1, '#d48800']]} />
      <Vertical id="gi-icones-moeda-espessura" cores={[[0, '#c27c00'], [1, '#8a4f00']]} />
      <Diagonal id="gi-icones-moeda-relevo" claro="#fff0a0" base="#ffc83a" escuro="#e08a00" />

      {/* ovos por espécie */}
      <Radial id="gi-icones-ovo-galinha" realce="#fffdf6" base="#f7e5c4" sombra="#d9a877" />
      <Radial id="gi-icones-ovo-pato" realce="#f4fcff" base="#c9e9f5" sombra="#80b2d2" />
      <Radial id="gi-icones-ovo-ganso" realce="#ffffff" base="#f7f5ef" sombra="#bcb4dc" />
      <Radial id="gi-icones-ovo-avestruz" realce="#fffbe6" base="#f6dea2" sombra="#cf9a45" />

      {/* ninho de palha */}
      <Vertical id="gi-icones-ninho-palha" cores={[[0, '#ffe58a'], [0.35, '#e9b949'], [0.8, '#c98e34'], [1, '#9a6424']]} />
      <radialGradient id="gi-icones-ninho-fundo" cx=".5" cy=".35" r=".7">
        <stop offset="0" stopColor="#7a4a1c" />
        <stop offset="1" stopColor="#3f230c" />
      </radialGradient>

      {/* gemas de raridade (+ branca para fundo colorido) */}
      <Diagonal id="gi-icones-gema-comum" claro="#ffffff" base="#c3cbd6" escuro="#6f7a89" />
      <Diagonal id="gi-icones-gema-raro" claro="#cfe6ff" base="#3b82f6" escuro="#1a4aa8" />
      <Diagonal id="gi-icones-gema-epico" claro="#ecdfff" base="#8b5cf6" escuro="#4a20ad" />
      <Diagonal id="gi-icones-gema-lendario" claro="#fff7c0" base="#f5b301" escuro="#b06800" />
      <Diagonal id="gi-icones-gema-branca" claro="#ffffff" base="#f3f6fa" escuro="#c4cedb" />

      {/* ícones das abas */}
      <Vertical id="gi-icones-celeiro-parede" cores={[[0, '#ff7a5e'], [0.45, '#e94a3c'], [1, '#a82a2a']]} />
      <Vertical id="gi-icones-celeiro-telhado" cores={[[0, '#9a3a34'], [1, '#5c1414']]} />
      <Vertical id="gi-icones-madeira" cores={[[0, '#f0bb7a'], [0.5, '#c4844a'], [1, '#8a5226']]} />
      <Vertical id="gi-icones-toldo-base" cores={[[0, '#ff7a6a'], [1, '#d42c1e']]} />
      <Diagonal id="gi-icones-carta-raro" claro="#a9d4ff" base="#3b82f6" escuro="#1d5fd0" />
      <Diagonal id="gi-icones-carta-epico" claro="#d9c6ff" base="#8b5cf6" escuro="#5b2fc9" />
      <Diagonal id="gi-icones-carta-lendario" claro="#fff1a8" base="#ffc21a" escuro="#c27c00" />
      <radialGradient id="gi-icones-carta-arte" cx=".5" cy=".35" r=".75">
        <stop offset="0" stopColor="#fffbe6" />
        <stop offset="1" stopColor="#ffd56a" />
      </radialGradient>
      <Vertical id="gi-icones-metal" cores={[[0, '#f2f6fb'], [0.5, '#b9c6d6'], [1, '#7d8ea6']]} />
    </>
  );
}

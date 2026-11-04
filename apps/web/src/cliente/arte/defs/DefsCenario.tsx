// Gradientes/padrões SVG compartilhados da área "cenario". Montados uma única vez na página por <DefsArte />;
// use nos desenhos com fill="url(#gi-cenario-...)". Todo id DEVE começar com "gi-cenario-".
// Quase todos em objectBoundingBox (o padrão do SVG): servem para qualquer forma.

/** Linear vertical com paradas [offset, cor, opacidade?]. */
function Vertical({ id, paradas }: { id: string; paradas: [number, string, number?][] }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      {paradas.map(([o, c, a], i) => (
        <stop key={i} offset={o} stopColor={c} stopOpacity={a ?? 1} />
      ))}
    </linearGradient>
  );
}

/** Linear horizontal (luz vem da esquerda). */
function Horizontal({ id, paradas }: { id: string; paradas: [number, string, number?][] }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      {paradas.map(([o, c, a], i) => (
        <stop key={i} offset={o} stopColor={c} stopOpacity={a ?? 1} />
      ))}
    </linearGradient>
  );
}

/** Radial com o ponto de luz no alto à esquerda (volume em 3 tons). */
function Volume({ id, realce, base, sombra }: { id: string; realce: string; base: string; sombra: string }) {
  return (
    <radialGradient id={id} cx="0.38" cy="0.32" r="0.75" fx="0.32" fy="0.25">
      <stop offset="0" stopColor={realce} />
      <stop offset="0.38" stopColor={base} />
      <stop offset="0.8" stopColor={base} />
      <stop offset="1" stopColor={sombra} />
    </radialGradient>
  );
}

export function DefsCenario() {
  return (
    <>
      {/* Sol: disco, halo e raios (o raio some para fora: a forma é uma estrela única, bbox = círculo) */}
      <radialGradient id="gi-cenario-sol" cx="0.42" cy="0.38" r="0.62">
        <stop offset="0" stopColor="#fff6b0" />
        <stop offset="0.45" stopColor="#ffd23f" />
        <stop offset="1" stopColor="#ffb300" />
      </radialGradient>
      <radialGradient id="gi-cenario-sol-halo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0.45" stopColor="#fff3a0" stopOpacity="0.75" />
        <stop offset="1" stopColor="#fff3a0" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="gi-cenario-raio" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0.25" stopColor="#fffbe0" stopOpacity="0.95" />
        <stop offset="0.6" stopColor="#fff1a0" stopOpacity="0.55" />
        <stop offset="1" stopColor="#fff1a0" stopOpacity="0" />
      </radialGradient>
      {/* Raios dourados atrás do ninho pronto e do jackpot */}
      <radialGradient id="gi-cenario-raio-ouro" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0.2" stopColor="#fff6c0" stopOpacity="0.95" />
        <stop offset="0.55" stopColor="#ffd84d" stopOpacity="0.8" />
        <stop offset="1" stopColor="#ffb300" stopOpacity="0" />
      </radialGradient>

      {/* Nuvem: branca com a barriga azulada */}
      <Vertical id="gi-cenario-nuvem" paradas={[[0, '#ffffff'], [0.55, '#ffffff'], [1, '#cfe9fb']]} />

      {/* Colinas */}
      <Vertical id="gi-cenario-colina-fundo" paradas={[[0, '#d2f7a8'], [0.22, '#b4ec82'], [1, '#93dc62']]} />
      <Vertical id="gi-cenario-colina-meio" paradas={[[0, '#9fe46c'], [0.3, '#82d453'], [1, '#6cc644']]} />
      <Vertical id="gi-cenario-colina-frente" paradas={[[0, '#7fd450'], [0.4, '#68c240'], [1, '#5cb83a']]} />

      {/* Celeiro */}
      <Vertical id="gi-cenario-celeiro-parede" paradas={[[0, '#ff7a5e'], [0.18, '#e64a3c'], [0.75, '#d63e33'], [1, '#a82a2a']]} />
      <Horizontal id="gi-cenario-celeiro-lado" paradas={[[0, '#b8322e'], [1, '#8e2224']]} />
      <Vertical id="gi-cenario-celeiro-telhado" paradas={[[0, '#a8473c'], [0.5, '#8a3530'], [1, '#6a2222']]} />
      <Vertical id="gi-cenario-celeiro-porta" paradas={[[0, '#c13a32'], [1, '#8e2224']]} />
      <Vertical id="gi-cenario-acabamento" paradas={[[0, '#ffffff'], [1, '#f3e2c0']]} />
      <radialGradient id="gi-cenario-janela" cx="0.4" cy="0.35" r="0.65">
        <stop offset="0" stopColor="#fff6c8" />
        <stop offset="0.6" stopColor="#ffe58a" />
        <stop offset="1" stopColor="#e9b949" />
      </radialGradient>

      {/* Silo */}
      <Horizontal id="gi-cenario-silo" paradas={[[0, '#e6edf6'], [0.3, '#c9d3e2'], [0.75, '#a8b5c9'], [1, '#7f8fa8']]} />
      <Volume id="gi-cenario-silo-cupula" realce="#c3cee0" base="#8a9ab3" sombra="#5d6d88" />

      {/* Árvore e arbusto (copa), tronco */}
      <Volume id="gi-cenario-copa" realce="#a8ec74" base="#5cbd3c" sombra="#2f8a2a" />
      <Volume id="gi-cenario-copa-escura" realce="#8fdc5e" base="#4aa834" sombra="#2a7a26" />
      <Horizontal id="gi-cenario-tronco" paradas={[[0, '#c88a52'], [0.55, '#9a6230'], [1, '#6e4220']]} />
      <Volume id="gi-cenario-maca" realce="#ffb0a0" base="#f0453a" sombra="#b8233a" />

      {/* Madeira (moinho, fardo, andaime) */}
      <Vertical id="gi-cenario-madeira" paradas={[[0, '#e8b47a'], [0.45, '#c88a52'], [1, '#9a5f2e']]} />
      <Horizontal id="gi-cenario-madeira-h" paradas={[[0, '#e3a96b'], [0.55, '#b9773f'], [1, '#8a5428']]} />
      <Vertical id="gi-cenario-palha" paradas={[[0, '#ffe58a'], [0.45, '#f2c75c'], [1, '#c9932f']]} />
      <Horizontal id="gi-cenario-moinho" paradas={[[0, '#fffaf0'], [0.6, '#efe2c8'], [1, '#cdb894']]} />

      {/* Cerca em pé: um poste com tampa e as duas travessas pregadas na frente (repete a cada 44 px).
          Altura 40: o pé do poste encosta na base da fileira. */}
      <pattern id="gi-cenario-cerca" patternUnits="userSpaceOnUse" width="44" height="40">
        <path d="M16 41V8Q16 3 22 3Q28 3 28 8V41Z" fill="url(#gi-cenario-madeira-h)" stroke="#3b200c" strokeWidth={2} />
        <path d="M16.9 9Q17 4 22 4Q27 4 27.1 9Z" fill="#9a5f2e" />
        <path d="M16 9.5H28" stroke="#3b200c" strokeWidth={1.4} />
        <path d="M18.6 12V38" stroke="#f0c48e" strokeWidth={1.2} opacity={0.7} />
        <path d="M25 21V24M25.2 35V39" stroke="#7a4a22" strokeWidth={1} opacity={0.6} />
        <rect x={-1} y={11} width={46} height={7} fill="url(#gi-cenario-madeira)" />
        <rect x={-1} y={25} width={46} height={7} fill="url(#gi-cenario-madeira)" />
        <path d="M0 11H44M0 18H44M0 25H44M0 32H44" stroke="#3b200c" strokeWidth={2} />
        <path d="M0 12.8H44M0 26.8H44" stroke="#ffe2b0" strokeWidth={1.1} opacity={0.6} />
        <path d="M3 15.2H11M33 15.6H41M6 29.3H14M30 29.7H37" stroke="#9a5f2e" strokeWidth={1} opacity={0.7} />
        <g fill="#5a3418">
          <circle cx={22} cy={14.5} r={1.7} />
          <circle cx={22} cy={28.5} r={1.7} />
        </g>
        <g fill="#e8c9a0">
          <circle cx={21.5} cy={14} r={0.6} />
          <circle cx={21.5} cy={28} r={0.6} />
        </g>
      </pattern>

      {/* Martelo da obra: cabeça de ferro */}
      <Vertical id="gi-cenario-ferro" paradas={[[0, '#d9e2ee'], [0.45, '#9aa8bc'], [1, '#5d6b80']]} />
      {/* Balão de pronto do ninho */}
      <Vertical id="gi-cenario-balao" paradas={[[0, '#ffffff'], [0.6, '#fffaf0'], [1, '#f3e2c0']]} />
      {/* Ovo dourado */}
      <Volume id="gi-cenario-ouro" realce="#fff6c0" base="#ffc93c" sombra="#d08a00" />
    </>
  );
}

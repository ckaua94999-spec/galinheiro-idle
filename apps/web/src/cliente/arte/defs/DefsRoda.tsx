// Gradientes/padrões SVG compartilhados da área "roda". Montados uma única vez na página por <DefsArte />;
// use nos desenhos com fill="url(#gi-roda-...)". Todo id DEVE começar com "gi-roda-".
// Os gomos e a vinheta usam userSpaceOnUse centrados em (0,0): a roda é sempre desenhada com o eixo na origem.

const R_DISCO = 134;

/** Radial do gomo: -clara no centro → base na borda (DIRECAO_DE_ARTE 7.1). */
function Gomo({ id, paradas }: { id: string; paradas: [number, string][] }) {
  return (
    <radialGradient id={id} gradientUnits="userSpaceOnUse" cx="0" cy="0" r={R_DISCO}>
      {paradas.map(([o, c]) => (
        <stop key={o} offset={o} stopColor={c} />
      ))}
    </radialGradient>
  );
}

export function DefsRoda() {
  return (
    <>
      {/* aro de ouro: luz de cima */}
      <linearGradient id="gi-roda-aro" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff1a8" />
        <stop offset="0.45" stopColor="#ffc93c" />
        <stop offset="1" stopColor="#c27c00" />
      </linearGradient>
      {/* chanfro interno do aro (invertido: escuro em cima, claro embaixo = "afundado") */}
      <linearGradient id="gi-roda-aro-chanfro" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a86400" />
        <stop offset="0.5" stopColor="#e3a21a" />
        <stop offset="1" stopColor="#fff1a8" />
      </linearGradient>
      {/* madeira (anel externo, base) */}
      <linearGradient id="gi-roda-madeira" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e7b47a" />
        <stop offset="0.35" stopColor="#c98a4e" />
        <stop offset="0.75" stopColor="#a8683a" />
        <stop offset="1" stopColor="#8a5226" />
      </linearGradient>
      {/* tábua vista de frente (pernas do cavalete) */}
      <linearGradient id="gi-roda-madeira-h" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#8a5226" />
        <stop offset="0.3" stopColor="#dca066" />
        <stop offset="0.7" stopColor="#b9773f" />
        <stop offset="1" stopColor="#7a4a22" />
      </linearGradient>

      {/* gomos por raridade */}
      <Gomo id="gi-roda-gomo-comum" paradas={[[0, '#eef1f5'], [0.4, '#dfe4ea'], [0.82, '#bcc4cf'], [1, '#a9b2bf']]} />
      <Gomo id="gi-roda-gomo-raro" paradas={[[0, '#eaf4ff'], [0.32, '#c2deff'], [0.78, '#6aa6fa'], [1, '#3b82f6']]} />
      <Gomo id="gi-roda-gomo-epico" paradas={[[0, '#f5f0ff'], [0.32, '#e4d6ff'], [0.78, '#a98af8'], [1, '#7c4cf0']]} />
      <Gomo id="gi-roda-gomo-lendario" paradas={[[0, '#fffbe6'], [0.32, '#fff1a8'], [0.75, '#ffd84d'], [1, '#f5b301']]} />

      {/* vinheta do disco: escurece a borda (volume de "tigela") */}
      <radialGradient id="gi-roda-vinheta" gradientUnits="userSpaceOnUse" cx="0" cy="0" r={R_DISCO}>
        <stop offset="0.55" stopColor="#3b1d0c" stopOpacity="0" />
        <stop offset="0.88" stopColor="#3b1d0c" stopOpacity="0.1" />
        <stop offset="1" stopColor="#3b1d0c" stopOpacity="0.38" />
      </radialGradient>
      {/* brilho de vidro (realce estático no alto à esquerda) */}
      <radialGradient id="gi-roda-brilho" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.7" />
        <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.22" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      {/* destaque do gomo vencedor, por raridade: a cor PROFUNDA da raridade por cima do gomo (o miolo claro do
          gradiente-base vira azul/roxo/ouro de verdade), um toque branco perto do cubo e a borda reforçada.
          Na vitória o gomo fica mais saturado que em repouso, nunca lavado para branco. */}
      {(
        [
          // [raridade, cor profunda, miolo branco, opacidade do meio]: o épico vai mais fundo (roxo de verdade)
          ['comum', '#ffc93c', 0.15, 0.65],
          ['raro', '#2f7cf6', 0.15, 0.65],
          ['epico', '#7c3aed', 0.08, 0.8],
          ['lendario', '#ffb800', 0.15, 0.65],
        ] as const
      ).map(([rar, cor, miolo, meio]) => (
        <radialGradient key={rar} id={`gi-roda-vencedor-${rar}`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r={R_DISCO}>
          <stop offset="0.2" stopColor="#ffffff" stopOpacity={miolo} />
          <stop offset="0.4" stopColor={cor} stopOpacity={meio} />
          <stop offset="0.75" stopColor={cor} stopOpacity={meio * 0.4} />
          <stop offset="0.9" stopColor={cor} stopOpacity={meio * 0.3} />
          <stop offset="1" stopColor={cor} stopOpacity={meio * 0.7} />
        </radialGradient>
      ))}
      {/* fundo do medalhão da vitória (moeda no cubo): a cor PROFUNDA da raridade, clara no alto à esquerda (luz de
          cima-esquerda) e escura na borda. Fundo saturado: a ave branca se destaca (nunca branco sobre branco). */}
      {(
        [
          ['comum', '#d5dbe3', '#8f99a8', '#5a6576'],
          ['raro', '#9ccaff', '#3b82f6', '#1d4fbf'],
          ['epico', '#d2bcff', '#8b5cf6', '#5526c4'],
          ['lendario', '#fff1a8', '#ffc21a', '#cf8500'],
        ] as const
      ).map(([rar, clara, base, escura]) => (
        <radialGradient key={rar} id={`gi-roda-moeda-${rar}`} cx="0.4" cy="0.3" r="0.78">
          <stop offset="0" stopColor={clara} />
          <stop offset="0.55" stopColor={base} />
          <stop offset="1" stopColor={escura} />
        </radialGradient>
      ))}

      {/* rastro do vencedor: mancha de luz onde o retrato estava antes de voar para o cubo (miolo branco quente,
          borda na cor de brilho da raridade, sumindo nas bordas) */}
      {(
        [
          ['comum', '#ffd84d'],
          ['raro', '#6fb6ff'],
          ['epico', '#c3a2ff'],
          ['lendario', '#ffd84d'],
        ] as const
      ).map(([rar, brilho]) => (
        <radialGradient key={rar} id={`gi-roda-rastro-${rar}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.38" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.62" stopColor={brilho} stopOpacity="0.45" />
          <stop offset="1" stopColor={brilho} stopOpacity="0" />
        </radialGradient>
      ))}

      {/* lâmpada acesa "quente" e seu halo */}
      <radialGradient id="gi-roda-lampada" cx="0.42" cy="0.38" r="0.62">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.35" stopColor="#fff3a0" />
        <stop offset="1" stopColor="#ffc62e" />
      </radialGradient>
      <radialGradient id="gi-roda-lampada-halo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0.35" stopColor="#ffffff" stopOpacity="1" />
        <stop offset="0.6" stopColor="#fff3a0" stopOpacity="0.7" />
        <stop offset="1" stopColor="#ffd84d" stopOpacity="0" />
      </radialGradient>
      {/* lâmpada apagada: vidro âmbar desligado (claro o bastante para não ler como furo) */}
      <radialGradient id="gi-roda-lampada-off" cx="0.45" cy="0.42" r="0.6">
        <stop offset="0" stopColor="#e0b45a" />
        <stop offset="1" stopColor="#9a6a1c" />
      </radialGradient>

      {/* metal dourado (cubo, pinos, rebites) */}
      <radialGradient id="gi-roda-ouro" cx="0.38" cy="0.32" r="0.72">
        <stop offset="0" stopColor="#fffbe0" />
        <stop offset="0.35" stopColor="#ffd84d" />
        <stop offset="0.75" stopColor="#f0a800" />
        <stop offset="1" stopColor="#b56f00" />
      </radialGradient>
      {/* ovo dourado do emblema */}
      <radialGradient id="gi-roda-ovo" cx="0.36" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.28" stopColor="#fff1a8" />
        <stop offset="0.65" stopColor="#ffc93c" />
        <stop offset="1" stopColor="#d98a1a" />
      </radialGradient>
      {/* ponteiro vermelho */}
      <linearGradient id="gi-roda-ponteiro" x1="0" y1="0" x2="1" y2="0.6">
        <stop offset="0" stopColor="#ffa294" />
        <stop offset="0.35" stopColor="#ff5a48" />
        <stop offset="0.75" stopColor="#e2321f" />
        <stop offset="1" stopColor="#b01c12" />
      </linearGradient>
    </>
  );
}

// Gradientes comuns a todas as espécies (olho, realce, sombra, bochecha, lágrima, touca, ninho, ovo).
// Todos em objectBoundingBox, para servir a qualquer forma. Ids "gi-animais-<material>".
export function DefsComuns() {
  return (
    <>
      {/* Realce branco-quente (elipse no alto à esquerda das formas). */}
      <radialGradient id="gi-animais-realce" cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#fffdf7" stopOpacity=".95" />
        <stop offset=".55" stopColor="#fffdf7" stopOpacity=".55" />
        <stop offset="1" stopColor="#fffdf7" stopOpacity="0" />
      </radialGradient>
      {/* Esclera SEM contorno: sombra interna quente no alto (a "tampa" projeta) e fundo frio, que
          separam o olho da cabeça creme sem fechar um anel ("óculos"). */}
      <linearGradient id="gi-animais-olho-esclera" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e3cdb8" />
        <stop offset=".22" stopColor="#fffdf8" />
        <stop offset=".6" stopColor="#ffffff" />
        <stop offset="1" stopColor="#d3deec" />
      </linearGradient>
      {/* Sombra de contato no chão e oclusão corpo/palha. */}
      <radialGradient id="gi-animais-sombra" cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#3b2410" stopOpacity=".32" />
        <stop offset=".6" stopColor="#3b2410" stopOpacity=".16" />
        <stop offset="1" stopColor="#3b2410" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="gi-animais-oclusao" cx=".5" cy=".55" r=".5">
        <stop offset="0" stopColor="#3b2410" stopOpacity=".42" />
        <stop offset=".65" stopColor="#3b2410" stopOpacity=".2" />
        <stop offset="1" stopColor="#3b2410" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="gi-animais-bochecha" cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#ff6f86" />
        <stop offset=".55" stopColor="#ff7b8a" stopOpacity=".75" />
        <stop offset="1" stopColor="#ff7b8a" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="gi-animais-lagrima" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e2f6ff" />
        <stop offset=".45" stopColor="#8cd3ff" />
        <stop offset="1" stopColor="#4a9fe6" />
      </linearGradient>
      {/* Touca de dormir do aposentado. */}
      <radialGradient id="gi-animais-touca" cx=".35" cy=".3" r=".8" fx=".3" fy=".22">
        <stop offset="0" stopColor="#c4dbf7" />
        <stop offset=".4" stopColor="#7fa7d9" />
        <stop offset=".8" stopColor="#6189c2" />
        <stop offset="1" stopColor="#4f78b0" />
      </radialGradient>
      {/* Ninho: borda de palha (luz em cima, com a faixa de brilho #fff3c0 colada no topo) e interior escuro. */}
      <linearGradient id="gi-animais-ninho-borda" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff3c0" />
        <stop offset=".07" stopColor="#ffe58a" />
        <stop offset=".35" stopColor="#e9b949" />
        <stop offset=".8" stopColor="#c98e34" />
        <stop offset="1" stopColor="#9a6424" />
      </linearGradient>
      <radialGradient id="gi-animais-ninho-interior" cx=".5" cy=".35" r=".6">
        <stop offset="0" stopColor="#7a4a1c" />
        <stop offset="1" stopColor="#4a2a10" />
      </radialGradient>
      {/* Ovo genérico (espiando no ninho pronto); cada espécie pode ter o seu gi-animais-<especie>-ovo.
          As paradas duras perto do foco (0–.15) desenham o brilho branco nítido: o ovo é UM elemento só. */}
      <radialGradient id="gi-animais-ovo" cx=".4" cy=".34" r=".78" fx=".3" fy=".2">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".13" stopColor="#ffffff" />
        <stop offset=".16" stopColor="#fff5e4" />
        <stop offset=".45" stopColor="#fbe8c8" />
        <stop offset=".82" stopColor="#efd2a6" />
        <stop offset="1" stopColor="#d2a674" />
      </radialGradient>
    </>
  );
}

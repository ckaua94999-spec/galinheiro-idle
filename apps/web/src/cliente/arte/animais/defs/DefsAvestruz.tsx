// Gradientes do avestruz (ids "gi-animais-avestruz-<material>" + a aura "gi-animais-aura-lendaria"), em
// objectBoundingBox e no molde de DefsGalinha: radial de volume com a luz em cima à esquerda, stops
// realce 0 → base → base → sombra 1. 13 ids.
export function DefsAvestruz() {
  return (
    <>
      {/* Plumagem: roxo-ardósia QUENTE, ~18% mais clara que na rodada 2 (realce lilás → base #7a66a2 → #7363a3 →
          sombra #54467a). O foco fica à esquerda (peito, à frente do colar); o MEIO do corpo (o que aparece acima
          da pílula do grid) fica no tom médio, não na sombra. O contorno (#2b2042, Avestruz.tsx) fica bem mais
          escuro que a sombra. */}
      <radialGradient id="gi-animais-avestruz-plumagem" cx=".3" cy=".3" r=".85" fx=".18" fy=".28">
        <stop offset="0" stopColor="#ab98d0" />
        <stop offset=".3" stopColor="#7a66a2" />
        <stop offset=".7" stopColor="#7363a3" />
        <stop offset="1" stopColor="#54467a" />
      </radialGradient>
      {/* Asa: forma própria, FUNDO médio-escuro (as rêmiges) sob a camada clara das coberteiras (#c2b4ec,
          Avestruz.tsx): penas claras sobre fundo escuro leem como penas a 72 px, não como listras. */}
      <linearGradient id="gi-animais-avestruz-asa" x1=".2" y1="0" x2=".45" y2="1">
        <stop offset="0" stopColor="#8f7dc6" />
        <stop offset=".3" stopColor="#6f5ea2" />
        <stop offset="1" stopColor="#4c3d74" />
      </linearGradient>
      {/* Bochecha no rosa-frio da gema (o rosa comum some na pele rosada). */}
      <radialGradient id="gi-animais-avestruz-bochecha" cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#ff4f7a" />
        <stop offset=".55" stopColor="#ff4f7a" stopOpacity=".7" />
        <stop offset="1" stopColor="#ff4f7a" stopOpacity="0" />
      </radialGradient>
      {/* Plumas brancas (colar de trás e topete): branco puro na luz → lavanda nas bordas de sombra. */}
      <linearGradient id="gi-animais-avestruz-pluma" x1=".15" y1="0" x2=".85" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".45" stopColor="#fbf9ff" />
        <stop offset=".8" stopColor="#e6e0f2" />
        <stop offset="1" stopColor="#c9c0de" />
      </linearGradient>
      {/* Plumas da cauda, da asa e o topete (lendário): brancas com as PONTAS douradas (base à esquerda → ponta à
          direita); a base lilás segura a pluma sobre o fundo dourado da carta e da revelação. */}
      <linearGradient id="gi-animais-avestruz-pluma-ouro" x1="0" y1=".9" x2="1" y2=".1">
        <stop offset="0" stopColor="#d6cdee" />
        <stop offset=".28" stopColor="#ffffff" />
        <stop offset=".6" stopColor="#fffaf0" />
        <stop offset=".8" stopColor="#ffe597" />
        <stop offset="1" stopColor="#ffbf1f" />
      </linearGradient>
      {/* Rêmiges da asa: ao longo da pena (base em cima à esquerda → ponta embaixo à direita), lilás até a metade
          (a parte que sai da asa não vira "algodão" sobre a palha), branco e a PONTA dourada. */}
      <linearGradient id="gi-animais-avestruz-remige" x1="0" y1=".2" x2="1" y2=".8">
        <stop offset="0" stopColor="#c9bde8" />
        <stop offset=".5" stopColor="#d9d0f0" />
        <stop offset=".7" stopColor="#ffffff" />
        <stop offset=".86" stopColor="#ffe9a3" />
        <stop offset="1" stopColor="#ffbf1f" />
      </linearGradient>
      {/* Colar da frente: penugem branca; o dourado só no fundo da caixa, então só a ponta dos 3 tufos LONGOS
          (alternados com os curtos) pega o ouro — franja de lendário, não "chantili". */}
      <linearGradient id="gi-animais-avestruz-colar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".6" stopColor="#f6f2ff" />
        <stop offset=".8" stopColor="#efe6f6" />
        <stop offset=".88" stopColor="#ffe08a" />
        <stop offset="1" stopColor="#ffbf1f" />
      </linearGradient>
      {/* Pele rosada (cabeça e pés). */}
      <radialGradient id="gi-animais-avestruz-pele" cx=".38" cy=".32" r=".75" fx=".32" fy=".25">
        <stop offset="0" stopColor="#ffe2d8" />
        <stop offset=".35" stopColor="#f8b3aa" />
        <stop offset=".78" stopColor="#f2a49e" />
        <stop offset="1" stopColor="#d87886" />
      </radialGradient>
      {/* Bico (cunha contornada): laranja-pêssego SATURADO, 2 degraus longe da pele rosada (o foco quente do
          rosto, como o laranja da galinha/pato/ganso, mas puxado para o pêssego), luz no cúlmen e terracota
          embaixo; a sombra cel, a unha e a narina (#c0644e) vêm por cima, no Avestruz.tsx. */}
      <linearGradient id="gi-animais-avestruz-bico" x1=".3" y1="0" x2=".45" y2="1">
        <stop offset="0" stopColor="#ffd9b8" />
        <stop offset=".45" stopColor="#f2a77e" />
        <stop offset="1" stopColor="#d9785e" />
      </linearGradient>
      {/* Íris âmbar: escura em cima, acesa embaixo (luz refletida). */}
      <linearGradient id="gi-animais-avestruz-iris" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5a2a06" />
        <stop offset=".45" stopColor="#c77a1e" />
        <stop offset="1" stopColor="#ffd27a" />
      </linearGradient>
      {/* Ouro da tiara: faixa de luz no alto, ouro vivo, ouro queimado embaixo. */}
      <linearGradient id="gi-animais-avestruz-tiara" x1="0" y1="0" x2=".25" y2="1">
        <stop offset="0" stopColor="#fff6c4" />
        <stop offset=".3" stopColor="#ffd84d" />
        <stop offset=".62" stopColor="#ffc21a" />
        <stop offset="1" stopColor="#d08a00" />
      </linearGradient>
      <radialGradient id="gi-animais-avestruz-gema" cx=".35" cy=".3" r=".75" fx=".3" fy=".22">
        <stop offset="0" stopColor="#ffd0dc" />
        <stop offset=".4" stopColor="#ff4f7a" />
        <stop offset="1" stopColor="#b3164a" />
      </radialGradient>
      {/* Aura lendária (atrás da ave): estática; o CSS só pulsa a opacidade. */}
      <radialGradient id="gi-animais-aura-lendaria" cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#fff8d0" stopOpacity=".95" />
        <stop offset=".42" stopColor="#ffe680" stopOpacity=".65" />
        <stop offset=".75" stopColor="#ffd84d" stopOpacity=".28" />
        <stop offset="1" stopColor="#ffd84d" stopOpacity="0" />
      </radialGradient>
    </>
  );
}

// Vida do campo, enxertada das outras variantes e repintada para o pôr do sol:
//  - NINHOS (de C): o ovo pipoca (antecipa, salta girando, cai com squash) com aura e estrelinhas e, no
//    alto do pulo, solta uma MOEDA que sobe girando e brilhando — o loop do jogo (ovo → moedas) em
//    miniatura. É o único lugar onde moedas aparecem: nada de ovos e moedas soltos no céu sem motivo. No
//    celular os ninhos ocupam a faixa de campo entre o elenco e os botões (somem quando não há espaço);
//    no desktop ficam no pasto do meio, ladeando o topo do painel;
//  - BORBOLETAS em voo sinuoso perto do capim (de C).
// Tudo CSS (transform/opacity), posições em entrar-a.css. As 3 estrelinhas de cada ninho são um grupo só
// (uma animação), não uma por estrela.
import type { Tipo } from '@galinheiro/game-core';
import type { CSSProperties } from 'react';
import { FiguraAnimal } from '../../../arte/Animal';
import { Moeda, Ovo } from '../../../arte/Icones';
import { Borboleta, Estrela } from './arte';

function Ninho({ n, tipo }: { n: number; tipo: Tipo }) {
  return (
    <span className={`ca-ninho ca-ninho-${n}`}>
      <span className="ca-ninho-entra">
        <span className="ca-ovo-aura" />
        <span className="ca-ninho-moeda">
          <span className="ca-ninho-moeda-gira">
            <Moeda />
          </span>
        </span>
        <span className="ca-ovo">
          <Ovo tipo={tipo} />
        </span>
        <FiguraAnimal tipo={null} detalhe="p" className="ca-ninho-fig" />
        <span className="ca-ovo-brilhos">
          <Estrela className="ca-ovo-brilho-1" />
          <Estrela className="ca-ovo-brilho-2" cor="#ffe58a" />
          <Estrela className="ca-ovo-brilho-3" />
        </span>
      </span>
    </span>
  );
}

/** Ninhos e borboletas: moram no mundo (zero na linha do chão), entre o elenco e o capim da frente. */
export function Campo() {
  return (
    <div className="ca-camada ca-c-vida" style={{ '--prof': 38 } as CSSProperties} aria-hidden>
      <Ninho n={1} tipo="galinha" />
      <Ninho n={2} tipo="avestruz" />
      <span className="ca-borboleta ca-borboleta-1">
        <span className="ca-borboleta-voo">
          <span className="ca-borboleta-asas">
            <Borboleta cor="#ffb23f" escura="#7a2e00" pinta="#fff6d0" />
          </span>
        </span>
      </span>
      <span className="ca-borboleta ca-borboleta-2">
        <span className="ca-borboleta-voo">
          <span className="ca-borboleta-asas">
            <Borboleta cor="#c9b4ff" escura="#4a2a8a" pinta="#ffffff" />
          </span>
        </span>
      </span>
    </div>
  );
}

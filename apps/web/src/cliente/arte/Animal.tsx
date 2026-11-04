// Arte dos animais (DIRECAO_DE_ARTE seção 5): este arquivo é só o DESPACHANTE. Monta o <svg> com
// sombra, ninho (trás/frente) e o "rig" animado, e escolhe a espécie. O desenho mora em arte/animais/
// (comum.tsx = rosto e fx compartilhados, Ninho.tsx, uma espécie por arquivo; kit em Galinha.tsx) e as
// animações ociosas em estilos/animais.css (classes ani-*).
import type { Tipo } from '@galinheiro/game-core';
import { memo, type CSSProperties } from 'react';
import { Avestruz } from './animais/Avestruz';
import { SombraContato, type Humor, type PropsEspecie } from './animais/comum';
import { Galinha } from './animais/Galinha';
import { Ganso } from './animais/Ganso';
import { NinhoFrente, NinhoTras, OCLUSAO, OvoPronto } from './animais/Ninho';
import { Pato } from './animais/Pato';

export type { Humor };

const ESPECIES: Record<Tipo, (p: PropsEspecie) => React.ReactNode> = {
  galinha: Galinha,
  pato: Pato,
  ganso: Ganso,
  avestruz: Avestruz,
};

/** Nível de detalhe: p (≤ 56 px: ícones, roda), m (grid, carta compacta), g (> 140 px: carta completa, revelação). */
export type Detalhe = 'p' | 'm' | 'g';

export interface PropsFigura {
  tipo: Tipo | null;
  humor?: Humor;
  /** Desenha o ninho (padrão true). */
  ninho?: boolean;
  className?: string;
  /** Defasagem das animações ociosas, em segundos (cada ninho um valor, para não sincronizarem). */
  atrasoS?: number;
  titulo?: string;
  /** Nível de detalhe (padrão 'm'). */
  detalhe?: Detalhe;
  /** Ninho pronto para coletar: balanço "pronto" e ovo espiando pela borda. */
  pronto?: boolean;
}

// O desenho da espécie só muda com tipo/humor/ninho: memo evita refazer a árvore a cada segundo do grid.
const Especie = memo(function Especie({ tipo, humor, ninho }: { tipo: Tipo; humor: Humor; ninho: boolean }) {
  const Desenho = ESPECIES[tipo];
  return <Desenho humor={humor} ninho={ninho} />;
});

/** Animal (opcionalmente sentado no ninho). Com tipo null, desenha só o ninho vazio. */
export function FiguraAnimal({ tipo, humor = 'feliz', ninho = true, className, atrasoS = 0, titulo, detalhe = 'm', pronto = false }: PropsFigura) {
  const estilo = { '--atraso': `${-atrasoS}s` } as CSSProperties;
  const classes = ['gi-animal', 'overflow-visible', `lod-${detalhe}`, `especie-${tipo ?? 'vazio'}`, `humor-${humor}`, pronto && tipo ? 'pronto' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <svg viewBox="0 0 120 120" className={classes} role={titulo ? 'img' : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true} style={estilo}>
      <SombraContato ninho={ninho} />
      {ninho && <NinhoTras vazio={!tipo} />}
      {tipo && (
        <g className="ani-rig">
          <Especie tipo={tipo} humor={humor} ninho={ninho} />
        </g>
      )}
      {ninho && tipo && pronto && <OvoPronto />}
      {ninho && tipo && OCLUSAO}
      {ninho && <NinhoFrente />}
    </svg>
  );
}

// Esqueleto de carregamento da carta compacta (Coleção): o "encaixe vazio" de uma carta — mesmo tamanho e
// proporção da compacta, no creme/madeira dos painéis do jogo, com as peças (arte, plaqueta, barra, timer) só
// sugeridas e um brilho quente que desliza na diagonal. Nada de verso decorado (parecia "cartas viradas"). Estilos em estilos/cartas.css.
import { cx } from '../../util';

export function EsqueletoCarta({ className, indice = 0 }: { className?: string; /** Defasa o brilho entre os esqueletos. */ indice?: number }) {
  return (
    <div className={cx('carta carta-esqueleto', className)} data-tamanho="compacta" style={{ '--i': indice } as React.CSSProperties} aria-hidden>
      <div className="carta-corpo">
        <div className="carta-esqueleto-moldura">
          <span className="carta-esqueleto-arte">
            {/* silhueta do ninho com um ovo: lê como "aqui vai um animal" */}
            <svg viewBox="0 0 100 64" className="carta-esqueleto-ninho">
              {/* fundo do ninho (miolo) → ovo → frente do ninho por cima da base do ovo → beirada da frente */}
              <ellipse cx="50" cy="36" rx="42" ry="8" className="carta-esqueleto-miolo" />
              <path d="M50 4C61 4 69 18 69 29a19 19 0 0 1-38 0C31 18 39 4 50 4Z" className="carta-esqueleto-ovo" />
              <path d="M8 36c2 16 20 25 42 25s40-9 42-25c-6 5-22 9-42 9S14 41 8 36Z" />
              <path d="M8 36c6 5 22 9 42 9s36-4 42-9" className="carta-esqueleto-borda" />
            </svg>
          </span>
          <span className="carta-esqueleto-placa" />
          <span className="carta-esqueleto-linha" />
          <span className="carta-esqueleto-linha carta-esqueleto-linha-curta" />
        </div>
        <span className="carta-esqueleto-brilho" />
      </div>
    </div>
  );
}

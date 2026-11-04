// Peças desenhadas da carta (DIRECAO_DE_ARTE seção 6): ovo do valor, gemas e joia da crista.
// Gradientes vêm de DefsCartas (gi-cartas-*); nada de filtro.
import type { Raridade } from '@galinheiro/game-core';
import { Moeda } from '../../arte/Icones';
import { moedas } from '../../util';

const CONTORNO_GEMA: Record<Raridade, string> = {
  comum: '#2e3642',
  raro: '#0b2a5e',
  epico: '#2a0f5e',
  lendario: '#4a2c00',
};

/** Valor do ovo para a "gota": "2,50"; de 1.000 moedas para cima, "1,2k". */
export function valorCurto(x100: number): string {
  const v = x100 / 100;
  if (v < 1000) return moedas(x100);
  const k = v / 1000;
  return `${(k >= 100 ? Math.round(k) : Math.floor(k * 10) / 10).toString().replace('.', ',')}k`;
}

/** "Gota" do valor (como o elixir do Clash Royale): ovo dourado com o número e a moeda do jogo.
 *  `apagado` (aposentado): ovo de ardósia, sem a mini-moeda — o animal não bota mais. */
export function OvoValor({ valorX100, apagado = false }: { valorX100: number; apagado?: boolean }) {
  const texto = valorCurto(valorX100);
  return (
    <span className="carta-ovo" data-apagado={apagado || undefined} aria-label={`Ovo vale ${moedas(valorX100)} moedas`} role="img">
      <svg viewBox="-2 -2 44 52" className="carta-ovo-svg" aria-hidden>
        {/* lábio chapado embaixo (sombra sem blur) */}
        <path d="M20 4C30 4 38 20 38 32a18 18 0 0 1-36 0C2 20 10 4 20 4Z" fill={apagado ? '#3a3f48' : '#5a3a00'} />
        <path
          d="M20 2C30 2 38 18 38 30a18 18 0 0 1-36 0C2 18 10 2 20 2Z"
          fill={apagado ? 'url(#gi-cartas-ovo-apagado)' : 'url(#gi-cartas-ovo-valor)'}
          stroke={apagado ? '#3a3f48' : '#5a3a00'}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {/* sombra cel embaixo à direita */}
        <path d="M35.5 26c1.6 9-4.6 18.6-15.5 19.6 7.6-3 12.6-10.4 11.6-19.4Z" fill={apagado ? '#5d6470' : '#c27200'} opacity={0.5} />
        {/* realce */}
        <ellipse cx="13" cy="15" rx="4" ry="7" fill="#fff" opacity={0.75} transform="rotate(20 13 15)" />
        <circle cx="16.5" cy="7.5" r="1.6" fill="#fff" opacity={0.85} />
      </svg>
      {/* data-len: o CSS reduz a fonte quando o número tem 4, 5 ou 6 caracteres, para caber no ovo */}
      <span className="carta-ovo-numero texto-contorno numeros" data-len={Math.min(texto.length, 6)}>
        {texto}
      </span>
      {!apagado && <Moeda className="carta-ovo-moeda" />}
    </span>
  );
}

/** Gemas da raridade (losangos facetados) num engaste escuro. */
export function GemasCarta({ raridade, quantidade }: { raridade: Raridade; quantidade: number }) {
  return (
    <span className="carta-gemas" aria-hidden>
      {Array.from({ length: quantidade }, (_, i) => (
        <svg key={i} viewBox="0 0 12 12" className="carta-gema" style={{ animationDelay: `${i * 0.35}s` }}>
          <path d="M6 .8 11.2 6 6 11.2.8 6Z" fill={`url(#gi-cartas-gema-${raridade})`} stroke={CONTORNO_GEMA[raridade]} strokeWidth={1.2} strokeLinejoin="round" />
          <path d="M6 2.4 8.9 6 6 4.9Z" fill="#fff" opacity={0.7} />
          <path d="M3.1 6 6 9.6 6 7.2Z" fill="#000" opacity={0.15} />
        </svg>
      ))}
    </span>
  );
}

/** Joia no topo da moldura (épico) ou na ponta da crista (lendário). */
export function JoiaCrista({ raridade }: { raridade: 'epico' | 'lendario' }) {
  return (
    <svg viewBox="0 0 28 24" className="carta-joia" aria-hidden>
      {/* engaste dourado com garras */}
      <path d="M3 13 7 5h14l4 8-11 10Z" fill="url(#gi-cartas-ouro)" stroke="#4a2c00" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M8.5 7.5h11l2.6 5.4L14 20.2 5.9 12.9Z" fill={`url(#gi-cartas-joia-${raridade})`} stroke="#4a2c00" strokeWidth={1} strokeLinejoin="round" />
      <path d="M10 8.6h4.6l-3.4 4Z" fill="#fff" opacity={0.75} />
      <circle cx="17.6" cy="10" r="1" fill="#fff" opacity={0.8} />
    </svg>
  );
}

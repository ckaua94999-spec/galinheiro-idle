// Ícones desenhados do jogo: ovos, moeda, ninho, gemas e os ícones ilustrados das abas.
// Nunca usamos símbolos de moedas do mundo real (G-07): a moeda tem um ovo em relevo.
// Gradientes vêm de DefsIcones (ids gi-icones-*); contorno por fora com paintOrder="stroke" (DIRECAO_DE_ARTE 5.1).
import type { Raridade, Tipo } from '@galinheiro/game-core';

/** "Tinta" dos ícones de interface. */
const TINTA = '#2b1a0f';

// Atributos de acessibilidade comuns: decorativo por padrão, imagem nomeada quando recebe título.
function a11y(titulo?: string) {
  return titulo ? { role: 'img' as const, 'aria-label': titulo } : { 'aria-hidden': true as const };
}

/* ------------------------------------------------------------------ ovo */

const OVO_D = 'M20 3C30 3 37 17.5 37 28.5C37 39.5 29.5 45.3 20 45.3C10.5 45.3 3 39.5 3 28.5C3 17.5 10 3 20 3Z';
const OVO_SOMBRA_D = 'M34.6 23.5C35.6 35.5 29.6 42.8 20 42.8C14.2 42.8 9.6 40.4 7.4 36.4C12.2 39.2 18.6 39.6 24 37C30 34 33.6 29 34.6 23.5Z';

const CORES_OVO: Record<Tipo, { sombra: string; contorno: string }> = {
  galinha: { sombra: '#c98a5a', contorno: '#7a4a22' },
  pato: { sombra: '#5f93b8', contorno: '#1f4a63' },
  ganso: { sombra: '#9d93c9', contorno: '#4a4570' },
  avestruz: { sombra: '#b8822f', contorno: '#6b4416' },
};

// Pintas do ovo de avestruz: [cx, cy, r]
const PINTAS: [number, number, number][] = [
  [24, 15, 1.7], [28.5, 24, 1.3], [19.5, 30, 1.6], [11.5, 25, 1.1], [27, 35, 1.4], [15, 37.5, 1], [21.5, 21.5, 0.9], [31, 30.5, 0.8],
];

export function Ovo({ tipo, className, titulo }: { tipo: Tipo; className?: string; titulo?: string }) {
  const c = CORES_OVO[tipo];
  return (
    <svg viewBox="0 0 40 48" className={className} {...a11y(titulo)}>
      <path d={OVO_D} fill={`url(#gi-icones-ovo-${tipo})`} stroke={c.contorno} strokeWidth={5} paintOrder="stroke" strokeLinejoin="round" />
      {tipo === 'avestruz' && (
        <g fill="#a8641c" opacity={0.72}>
          {PINTAS.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
          ))}
        </g>
      )}
      {/* sombra "cel" embaixo à direita + brilho de borda */}
      <path d={OVO_SOMBRA_D} fill={c.sombra} opacity={0.5} />
      <path d="M31.5 37.8C29 40.8 25 42.6 20.5 42.9" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />
      {/* realce no alto à esquerda */}
      <ellipse cx="12.8" cy="17" rx="3.4" ry="6.6" transform="rotate(24 12.8 17)" fill="#fff" opacity={0.88} />
      <circle cx="17" cy="9.2" r="1.6" fill="#fff" opacity={0.8} />
    </svg>
  );
}

/* ------------------------------------------------------------------ moeda */

const OVO_RELEVO_D = 'M20 12.2c3.6 0 6 5.2 6 8.7 0 3.6-2.6 5.7-6 5.7s-6-2.1-6-5.7c0-3.5 2.4-8.7 6-8.7z';

/** Moeda do jogo: disco dourado com espessura, aro, ovo em relevo e brilho. Nunca um símbolo de moeda real. */
export function Moeda({ className, titulo }: { className?: string; titulo?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} {...a11y(titulo)}>
      {/* contorno da face e da espessura */}
      <circle cx="20" cy="19.2" r="18.6" fill="#5a3a00" />
      <circle cx="20" cy="21.2" r="18.6" fill="#5a3a00" />
      {/* espessura (lado da moeda) */}
      <circle cx="20" cy="21.2" r="16.4" fill="url(#gi-icones-moeda-espessura)" />
      {/* aro */}
      <circle cx="20" cy="19.2" r="16.4" fill="url(#gi-icones-moeda-aro)" />
      {/* face rebaixada, com sulco e chanfro claro embaixo à direita */}
      <circle cx="20" cy="19.2" r="12.6" fill="url(#gi-icones-moeda-face)" stroke="#b97400" strokeWidth={1.4} />
      <path d="M33.4 21.6A13.6 13.6 0 0 1 17.6 32.6" fill="none" stroke="#fff6c0" strokeWidth={1.1} strokeLinecap="round" opacity={0.85} />
      {/* ovo em relevo: sombra, luz e face */}
      <path d={OVO_RELEVO_D} transform="translate(0.9 1)" fill="#a86200" opacity={0.75} />
      <path d={OVO_RELEVO_D} transform="translate(-0.7 -0.7)" fill="#fff8cc" opacity={0.9} />
      <path d={OVO_RELEVO_D} fill="url(#gi-icones-moeda-relevo)" />
      <ellipse cx="17.9" cy="16.6" rx="1.2" ry="2.1" transform="rotate(22 17.9 16.6)" fill="#fff" opacity={0.85} />
      {/* brilho do aro e faísca */}
      <path d="M5.9 14.1A15 15 0 0 1 14.9 5.1" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" opacity={0.9} />
      <path d="M31 3.8L31.9 6.6L34.7 7.5L31.9 8.4L31 11.2L30.1 8.4L27.3 7.5L30.1 6.6Z" fill="#fff" />
    </svg>
  );
}

/* ------------------------------------------------------------------ ninho */

const NINHO_FRENTE_D =
  'M2.6 13.2Q4.4 11.8 6.4 13.6Q8.8 15.4 11.2 14.2Q13.8 16.2 16.6 15Q20 16.6 23.4 15Q26.2 16.2 28.8 14.2Q31.2 15.4 33.6 13.6Q35.6 11.8 37.4 13.2Q37.8 21.6 30.6 26.2Q20 31 9.4 26.2Q2.2 21.6 2.6 13.2Z';

export function IconeNinho({ className, titulo }: { className?: string; titulo?: string }) {
  return (
    <svg viewBox="0 0 40 32" className={className} {...a11y(titulo)}>
      <ellipse cx="20" cy="13" rx="16" ry="5.6" fill="url(#gi-icones-ninho-fundo)" stroke="#6b4416" strokeWidth={4.4} paintOrder="stroke" />
      {/* dois ovos no ninho */}
      <ellipse cx="24" cy="10.6" rx="4.3" ry="5.4" fill="url(#gi-icones-ovo-pato)" stroke="#1f4a63" strokeWidth={3} paintOrder="stroke" />
      <ellipse cx="15.8" cy="9.8" rx="4.7" ry="5.9" fill="url(#gi-icones-ovo-galinha)" stroke="#7a4a22" strokeWidth={3} paintOrder="stroke" />
      <ellipse cx="14.2" cy="7.6" rx="1.2" ry="2" transform="rotate(20 14.2 7.6)" fill="#fff" opacity={0.9} />
      <ellipse cx="22.7" cy="8.6" rx="1" ry="1.7" transform="rotate(20 22.7 8.6)" fill="#fff" opacity={0.85} />
      {/* borda de palha da frente */}
      <path d={NINHO_FRENTE_D} fill="url(#gi-icones-ninho-palha)" stroke="#6b4416" strokeWidth={4.4} paintOrder="stroke" strokeLinejoin="round" />
      <g fill="none" strokeLinecap="round" strokeWidth={1.2}>
        <path d="M6 17.4Q12 21 18 19.4M22 19.4Q28 21.4 34 17.4M9.5 23Q15 25.4 21 24" stroke="#fff3c0" opacity={0.85} />
        <path d="M8 20.2Q14 18.6 20 21.4M20.5 21.4Q27 18.6 32 20.4M13 26.4Q20 27.4 27 25.8" stroke="#9a6424" opacity={0.7} />
      </g>
      <path d="M5.2 13.4Q8.6 16.4 11.2 15.2" fill="none" stroke="#fff8d0" strokeWidth={1.3} strokeLinecap="round" opacity={0.8} />
    </svg>
  );
}

/* ------------------------------------------------------------------ gemas */

const RARIDADE_POR_COR: Record<string, Raridade> = {
  '#9AA3AF': 'comum',
  '#3B82F6': 'raro',
  '#8B5CF6': 'epico',
  '#F5B301': 'lendario',
};
const CONTORNO_GEMA: Record<Raridade | 'branca', string> = {
  comum: '#2e3642',
  raro: '#0b2a5e',
  epico: '#2a0f5e',
  lendario: '#4a2c00',
  branca: '#3a2a1c',
};

/**
 * Fileira de gemas (quantidade = GEMAS_RARIDADE). `cor` continua aceito: as cores de raridade e o branco
 * viram gemas lapidadas com gradiente; qualquer outra cor é usada como preenchimento.
 */
export function Gemas({
  quantidade,
  cor,
  raridade,
  tamanho = 12,
  className,
}: {
  quantidade: number;
  cor: string;
  raridade?: Raridade;
  /** lado de cada gema em px (padrão 12) */
  tamanho?: number;
  className?: string;
}) {
  const corMaiuscula = cor.toUpperCase();
  const tom: Raridade | 'branca' | null =
    raridade ?? RARIDADE_POR_COR[corMaiuscula] ?? (corMaiuscula === '#FFF' || corMaiuscula === '#FFFFFF' ? 'branca' : null);
  const preenchimento = tom ? `url(#gi-icones-gema-${tom})` : cor;
  const contorno = tom ? CONTORNO_GEMA[tom] : TINTA;
  return (
    <span className={className ?? 'inline-flex gap-0.5'} aria-hidden>
      {Array.from({ length: quantidade }, (_, i) => (
        <svg key={i} viewBox="0 0 12 12" width={tamanho} height={tamanho} style={{ overflow: 'visible' }}>
          <path d="M6 .9L11.1 6L6 11.1L.9 6Z" fill={preenchimento} stroke={contorno} strokeWidth={2} paintOrder="stroke" strokeLinejoin="round" />
          {/* lapidação: faceta clara em cima à esquerda, escura embaixo à direita, ponto de brilho */}
          <path d="M6 .9L6 6L.9 6Z" fill="#fff" opacity={0.38} />
          <path d="M6 6L11.1 6L6 11.1Z" fill="#000" opacity={0.16} />
          <path d="M6 3.4L8.6 6L6 8.6L3.4 6Z" fill="#fff" opacity={0.22} />
          <path d="M4.3 3.7L5.7 2.4L5.3 4.4Z" fill="#fff" opacity={0.95} />
        </svg>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ ícones ilustrados (abas e HUD) */

type PropsIcone = { className?: string; titulo?: string };
const CONTORNO = { stroke: TINTA, strokeWidth: 5, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const };

/** Celeiro vermelho (aba Galinheiro). */
export function IconeGalinheiro({ className, titulo }: PropsIcone) {
  return (
    <svg viewBox="0 0 32 32" className={className} {...a11y(titulo)}>
      <path d="M6 15.5L16 7.5L26 15.5V27.4H6Z" fill="url(#gi-icones-celeiro-parede)" {...CONTORNO} />
      <path d="M7.7 16.6V26" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" opacity={0.35} />
      {/* porta com X */}
      <rect x="10.4" y="18.6" width="11.2" height="8.8" rx="0.8" fill="#8e2a24" stroke="#fff6e0" strokeWidth={1.7} />
      <path d="M11.2 19.4L20.8 26.6M20.8 19.4L11.2 26.6" stroke="#fff6e0" strokeWidth={1.5} strokeLinecap="round" />
      {/* janela do sótão */}
      <circle cx="16" cy="13.4" r="2.3" fill="#ffe58a" stroke="#4a1010" strokeWidth={1.3} />
      {/* telhado */}
      <path d="M3.2 16.2L16 5L28.8 16.2Q29.4 17.6 28 18L16 8.6L4 18Q2.6 17.6 3.2 16.2Z" fill="url(#gi-icones-celeiro-telhado)" {...CONTORNO} />
      <path d="M5.4 15.6L15.4 6.9" stroke="#d0645a" strokeWidth={1.2} strokeLinecap="round" />
      {/* grama */}
      <path d="M3 27.2Q9 25.8 16 26.6Q23 25.6 29 27.2Q29.6 29.6 27.6 29.6H4.4Q2.4 29.6 3 27.2Z" fill="#6cc644" stroke={TINTA} strokeWidth={4} paintOrder="stroke" strokeLinejoin="round" />
      <path d="M5 27.4Q10 26.6 15 27.2" stroke="#b8f27a" strokeWidth={1.2} strokeLinecap="round" fill="none" />
    </svg>
  );
}

const TOLDO_D =
  'M3 5.8H29V9.8Q29 12.8 26.4 12.8Q23.8 12.8 23.8 9.8Q23.8 12.8 21.2 12.8Q18.6 12.8 18.6 9.8Q18.6 12.8 16 12.8Q13.4 12.8 13.4 9.8Q13.4 12.8 10.8 12.8Q8.2 12.8 8.2 9.8Q8.2 12.8 5.6 12.8Q3 12.8 3 9.8Z';
const TOLDO_LISTRAS_D = 'M8.2 5.8H13.4V9.8Q13.4 12.8 10.8 12.8Q8.2 12.8 8.2 9.8ZM18.6 5.8H23.8V9.8Q23.8 12.8 21.2 12.8Q18.6 12.8 18.6 9.8Z';

/** Barraca com toldo listrado (aba Loja). */
export function IconeLoja({ className, titulo }: PropsIcone) {
  return (
    <svg viewBox="0 0 32 32" className={className} {...a11y(titulo)}>
      {/* postes */}
      <rect x="5.2" y="9" width="2.6" height="12" fill="url(#gi-icones-madeira)" stroke={TINTA} strokeWidth={3} paintOrder="stroke" />
      <rect x="24.2" y="9" width="2.6" height="12" fill="url(#gi-icones-madeira)" stroke={TINTA} strokeWidth={3} paintOrder="stroke" />
      {/* mercadoria: ovos e moeda no balcão */}
      <ellipse cx="18.8" cy="17" rx="2.8" ry="3.5" fill="url(#gi-icones-ovo-pato)" stroke="#1f4a63" strokeWidth={2.6} paintOrder="stroke" />
      <ellipse cx="12.8" cy="16.4" rx="3.1" ry="3.9" fill="url(#gi-icones-ovo-galinha)" stroke="#7a4a22" strokeWidth={2.6} paintOrder="stroke" />
      <circle cx="23.4" cy="18.2" r="2.4" fill="url(#gi-icones-moeda-aro)" stroke="#5a3a00" strokeWidth={2.4} paintOrder="stroke" />
      <ellipse cx="11.8" cy="15" rx="0.8" ry="1.3" fill="#fff" opacity={0.9} />
      {/* balcão */}
      <rect x="4" y="19.6" width="24" height="9" rx="2" fill="url(#gi-icones-madeira)" {...CONTORNO} />
      <path d="M5.4 24.2H26.6" stroke="#7a4a22" strokeWidth={1.1} opacity={0.75} />
      <path d="M5.6 21H26.4" stroke="#fff" strokeWidth={1.2} strokeLinecap="round" opacity={0.4} />
      {/* toldo listrado */}
      <path d={TOLDO_D} fill="url(#gi-icones-toldo-base)" {...CONTORNO} />
      <path d={TOLDO_LISTRAS_D} fill="#fff6e0" />
      <path d="M4.4 7.6H27.6" stroke="#fff" strokeWidth={1.1} opacity={0.35} />
      <rect x="2.6" y="2.6" width="26.8" height="4" rx="2" fill="#c42a1e" {...CONTORNO} />
      <path d="M4.6 3.8H27.4" stroke="#ff9a8a" strokeWidth={1.1} strokeLinecap="round" />
    </svg>
  );
}

// Gomos da mini-roda, calculados uma vez (valores estáveis para o SSR).
const RODA = { cx: 16, cy: 15.2, r: 8.6 };
const CORES_GOMO = ['#c9d1db', '#4f93ff', '#c9d1db', '#9b6cff', '#c9d1db', '#4f93ff', '#c9d1db', '#ffc21a'];
const n2 = (v: number) => Math.round(v * 100) / 100;
const GOMOS = CORES_GOMO.map((cor, i) => {
  const a0 = ((i * 45 - 90 - 22.5) * Math.PI) / 180;
  const a1 = a0 + Math.PI / 4;
  const p = (a: number) => `${n2(RODA.cx + RODA.r * Math.cos(a))} ${n2(RODA.cy + RODA.r * Math.sin(a))}`;
  return { cor, d: `M${RODA.cx} ${RODA.cy}L${p(a0)}A${RODA.r} ${RODA.r} 0 0 1 ${p(a1)}Z` };
});
const LAMPADAS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * 45 * Math.PI) / 180;
  return { x: n2(RODA.cx + 10.2 * Math.cos(a)), y: n2(RODA.cy + 10.2 * Math.sin(a)) };
});

/** Roda da sorte (aba Roleta). */
export function IconeRoleta({ className, titulo }: PropsIcone) {
  return (
    <svg viewBox="0 0 32 32" className={className} {...a11y(titulo)}>
      {/* pé */}
      <path d="M10.6 28.2L14 22H18L21.4 28.2Z" fill="url(#gi-icones-madeira)" {...CONTORNO} />
      <rect x="7.6" y="26.6" width="16.8" height="2.8" rx="1.4" fill="url(#gi-icones-madeira)" stroke={TINTA} strokeWidth={4} paintOrder="stroke" />
      {/* aro dourado e gomos */}
      <circle cx={RODA.cx} cy={RODA.cy} r="11.6" fill="url(#gi-icones-moeda-aro)" {...CONTORNO} />
      {GOMOS.map((g) => (
        <path key={g.d} d={g.d} fill={g.cor} stroke="#fff8e0" strokeWidth={0.9} strokeLinejoin="round" />
      ))}
      <circle cx={RODA.cx} cy={RODA.cy} r={RODA.r} fill="none" stroke="#7a4a00" strokeWidth={1.1} />
      <path d="M9.4 11.2A7.6 7.6 0 0 1 14.4 7.8" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" opacity={0.6} />
      {LAMPADAS.map((l) => (
        <circle key={`${l.x}-${l.y}`} cx={l.x} cy={l.y} r="0.95" fill="#fffbe0" />
      ))}
      <circle cx={RODA.cx} cy={RODA.cy} r="2.5" fill="url(#gi-icones-moeda-aro)" stroke="#5a3a00" strokeWidth={1.3} />
      {/* ponteiro */}
      <path d="M12.4 1.9H19.6L16 7.9Z" fill="#ff5a48" stroke={TINTA} strokeWidth={4} paintOrder="stroke" strokeLinejoin="round" />
      <path d="M13.8 3H17.2" stroke="#ffb3a8" strokeWidth={1.1} strokeLinecap="round" />
    </svg>
  );
}

function MiniCarta({ angulo, x, fundo, frente }: { angulo: number; x: number; fundo: string; frente?: boolean }) {
  return (
    <g transform={`translate(${x} 28.4) rotate(${angulo})`}>
      <rect x="-6.4" y="-19" width="12.8" height="19" rx="2.4" fill={fundo} stroke={TINTA} strokeWidth={4.4} paintOrder="stroke" />
      <rect x="-4.5" y="-17.1" width="9" height="10" rx="1.3" fill={frente ? 'url(#gi-icones-carta-arte)' : '#fff'} opacity={frente ? 1 : 0.4} />
      <path d="M0 -5.6L1.7 -3.9L0 -2.2L-1.7 -3.9Z" fill="#fff" stroke={TINTA} strokeWidth={0.9} strokeLinejoin="round" />
      <path d="M-5 -17.6H1.4" stroke="#fff" strokeWidth={1.1} strokeLinecap="round" opacity={0.55} />
    </g>
  );
}

/** Leque de cartas (aba Coleção). */
export function IconeColecao({ className, titulo }: PropsIcone) {
  return (
    <svg viewBox="0 0 32 32" className={className} {...a11y(titulo)}>
      <MiniCarta angulo={-22} x={14.6} fundo="url(#gi-icones-carta-raro)" />
      <MiniCarta angulo={22} x={17.4} fundo="url(#gi-icones-carta-epico)" />
      <MiniCarta angulo={0} x={16} fundo="url(#gi-icones-carta-lendario)" frente />
      {/* estrela na arte da carta da frente */}
      <path d="M16 12.2L17.1 14.6L19.6 14.9L17.7 16.6L18.2 19.1L16 17.8L13.8 19.1L14.3 16.6L12.4 14.9L14.9 14.6Z" fill="#ffc21a" stroke="#6a4300" strokeWidth={1} strokeLinejoin="round" />
    </svg>
  );
}

// Engrenagem de 8 dentes, calculada uma vez.
const ENGRENAGEM_D = (() => {
  const c = 16;
  const pt = (r: number, graus: number) => {
    const a = (graus * Math.PI) / 180;
    return `${n2(c + r * Math.cos(a))} ${n2(c + r * Math.sin(a))}`;
  };
  let d = '';
  for (let i = 0; i < 8; i++) {
    const m = i * 45 - 90;
    d += `${i === 0 ? 'M' : 'L'}${pt(10, m - 14)}L${pt(13, m - 8.5)}L${pt(13, m + 8.5)}L${pt(10, m + 14)}A10 10 0 0 1 ${pt(10, m + 31)}`;
  }
  return `${d}Z`;
})();

/** Engrenagem de madeira (ajustes). */
export function IconeAjustes({ className, titulo }: PropsIcone) {
  return (
    <svg viewBox="0 0 32 32" className={className} {...a11y(titulo)}>
      <path d={ENGRENAGEM_D} fill="url(#gi-icones-madeira)" {...CONTORNO} />
      <circle cx="16" cy="16" r="7.4" fill="none" stroke="#8a5226" strokeWidth={1.1} opacity={0.7} />
      <path d="M9.2 12.4A7.8 7.8 0 0 1 13 8.8" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />
      <circle cx="16" cy="16" r="4.4" fill="url(#gi-icones-metal)" stroke={TINTA} strokeWidth={3.6} paintOrder="stroke" />
      <circle cx="16" cy="16" r="1.7" fill="#3b200c" />
    </svg>
  );
}

/** Cesto de vime com ovos (botão Coletar Todos). */
export function IconeCesto({ className, titulo }: PropsIcone) {
  return (
    <svg viewBox="0 0 32 32" className={className} {...a11y(titulo)}>
      {/* alça */}
      <path d="M7.4 15.6C7.4 6.6 24.6 6.6 24.6 15.6" fill="none" stroke={TINTA} strokeWidth={5.4} strokeLinecap="round" />
      <path d="M7.4 15.6C7.4 6.6 24.6 6.6 24.6 15.6" fill="none" stroke="#c4844a" strokeWidth={2.4} strokeLinecap="round" />
      {/* ovos */}
      <ellipse cx="20.6" cy="14.4" rx="3.6" ry="4.4" fill="url(#gi-icones-ovo-pato)" stroke="#1f4a63" strokeWidth={2.8} paintOrder="stroke" />
      <ellipse cx="11.6" cy="14.6" rx="3.6" ry="4.4" fill="url(#gi-icones-ovo-avestruz)" stroke="#6b4416" strokeWidth={2.8} paintOrder="stroke" />
      <ellipse cx="16" cy="13" rx="4" ry="5" fill="url(#gi-icones-ovo-galinha)" stroke="#7a4a22" strokeWidth={2.8} paintOrder="stroke" />
      <ellipse cx="14.6" cy="10.8" rx="1" ry="1.7" transform="rotate(20 14.6 10.8)" fill="#fff" opacity={0.9} />
      {/* cesto */}
      <path d="M3.6 16.6H28.4L26 27.2Q25.6 28.8 24 28.8H8Q6.4 28.8 6 27.2Z" fill="url(#gi-icones-madeira)" {...CONTORNO} />
      <g fill="none" stroke="#7a4a22" strokeWidth={1.1} strokeLinecap="round" opacity={0.8}>
        <path d="M5 20.4H27M5.8 24.2H26.2" />
        <path d="M10 17.4L10.8 28M16 17.4V28M22 17.4L21.2 28" />
      </g>
      <path d="M5 17.8H27" stroke="#ffe0b0" strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />
    </svg>
  );
}

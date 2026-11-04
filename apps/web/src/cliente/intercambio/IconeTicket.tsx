// Ícones ilustrados do Intercâmbio, no molde dos ícones das abas (arte/Icones.tsx): viewBox 32, contorno escuro
// por fora (paintOrder="stroke"), volume com sombra "cel" e filete de luz, gradientes compartilhados de DefsIcones.
// O TICKET é um vale do jogo: bilhete rosa com estrela dourada, recortes redondos nas laterais e canhoto picotado.
// Nunca um símbolo de dinheiro (sem cifrão, sem cédula).

const TINTA = '#2b1a0f';

function a11y(titulo?: string) {
  return titulo ? { role: 'img' as const, 'aria-label': titulo } : { 'aria-hidden': true as const };
}

/** Estrela de 5 pontas (centro, raio de fora e de dentro), calculada uma vez. */
function estrela(cx: number, cy: number, fora: number, dentro: number): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? dentro : fora;
    const a = ((-90 + i * 36) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join('L')}Z`;
}

// bilhete 24 × 16 centrado em (16,16), com os recortes redondos no meio das laterais
const CORPO = 'M6.2 8H25.8Q28 8 28 10.2V13.2A2.8 2.8 0 0 0 28 18.8V21.8Q28 24 25.8 24H6.2Q4 24 4 21.8V18.8A2.8 2.8 0 0 0 4 13.2V10.2Q4 8 6.2 8Z';
// canhoto (à direita do picote), um tom mais fundo
const CANHOTO = 'M21.6 8H25.8Q28 8 28 10.2V13.2A2.8 2.8 0 0 0 28 18.8V21.8Q28 24 25.8 24H21.6Z';
// sombra "cel" na faixa de baixo
const SOMBRA = 'M4 20.1Q16 22.3 28 20.1V21.8Q28 24 25.8 24H6.2Q4 24 4 21.8Z';
const ESTRELA = estrela(12.6, 16, 4.7, 2.05);

/** O bilhete desenhado na caixa 32 (sem o <svg>), para compor outros ícones. */
function Bilhete({ transform }: { transform?: string }) {
  return (
    <g transform={transform}>
      <path d={CORPO} fill="#ff7ab0" stroke={TINTA} strokeWidth={4.4} paintOrder="stroke" strokeLinejoin="round" />
      <path d={CANHOTO} fill="#ec4f98" />
      <path d={SOMBRA} fill="#b8306f" opacity={0.42} />
      <path d="M6.6 10.1H19.8" stroke="#fff" strokeWidth={1.3} strokeLinecap="round" opacity={0.75} />
      {/* picote */}
      <path d="M21.6 9.4V22.6" stroke="#ffe3f0" strokeWidth={1.2} strokeDasharray="1.45 1.35" />
      {/* riscos do canhoto */}
      <path d="M24.3 12.6V19.4M26 13.8V18.2" stroke="#ffd0e6" strokeWidth={1} strokeLinecap="round" opacity={0.8} />
      {/* estrela dourada */}
      <path d={ESTRELA} fill="#ffd23f" stroke="#6a4300" strokeWidth={1.6} paintOrder="stroke" strokeLinejoin="round" />
      <path d="M11.6 14.4L12.6 12.2" stroke="#fff6c0" strokeWidth={0.9} strokeLinecap="round" />
    </g>
  );
}

/** Ticket do Intercâmbio (vale do jogo): saldos, preços, histórico, extrato. */
export function IconeTicket({ className, titulo }: { className?: string; titulo?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} {...a11y(titulo)}>
      <Bilhete transform="rotate(-12 16 16)" />
    </svg>
  );
}

// ovo (o de galinha, gradiente compartilhado) na frente, à direita
const OVO = 'M22.4 13C25.8 13 28.7 18 28.7 21.9C28.7 25.8 25.9 28.6 22.4 28.6C18.9 28.6 16.1 25.8 16.1 21.9C16.1 18 19 13 22.4 13Z';
const OVO_CEL = 'M27.7 20.4C28.1 24.8 25.7 27.6 22.4 27.6C20.3 27.6 18.6 26.8 17.6 25.4C19.6 26.5 22.2 26.6 24.3 25.5C26.3 24.4 27.4 22.5 27.7 20.4Z';

/**
 * Intercâmbio (cabeçalho da tela, cartão da Loja): o bilhete inclinado atrás, um ovo na frente e a seta verde
 * do bilhete para o ovo — "ticket vira ovo (ou animal)". Faísca dourada no canto de cima.
 */
export function IconeIntercambio({ className, titulo }: { className?: string; titulo?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} {...a11y(titulo)}>
      <Bilhete transform="translate(12.4 11.2) scale(.8) rotate(-16) translate(-16 -16)" />
      {/* ovo */}
      <path d={OVO} fill="url(#gi-icones-ovo-galinha)" stroke={TINTA} strokeWidth={4.4} paintOrder="stroke" strokeLinejoin="round" />
      <path d={OVO_CEL} fill="#d9a877" opacity={0.55} />
      <ellipse cx="19.7" cy="17.6" rx="1.4" ry="2.6" transform="rotate(24 19.7 17.6)" fill="#fff" opacity={0.92} />
      {/* seta: sai de baixo do bilhete e aponta para o ovo */}
      <path d="M4.4 20.4Q4.6 27.2 12.2 27.3" fill="none" stroke={TINTA} strokeWidth={5.4} strokeLinecap="round" />
      <path d="M11.4 23.7L15.9 27.3L11.6 30.9Z" fill="#6fd13f" stroke={TINTA} strokeWidth={2.4} paintOrder="stroke" strokeLinejoin="round" />
      <path d="M4.4 20.4Q4.6 27.2 12.2 27.3" fill="none" stroke="#6fd13f" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M4.9 22.4Q5.4 25.4 8.4 26.3" fill="none" stroke="#c8f7a0" strokeWidth={0.9} strokeLinecap="round" />
      {/* faísca */}
      <path d="M27.4 2.6L28.3 5.2L30.9 6.1L28.3 7L27.4 9.6L26.5 7L23.9 6.1L26.5 5.2Z" fill="#fff6b8" stroke="#a86a00" strokeWidth={0.9} strokeLinejoin="round" />
    </svg>
  );
}

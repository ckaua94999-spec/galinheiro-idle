// Ícone ilustrado dos convites (cabeçalho da tela /convites, linha dos Ajustes, cartão da Loja e extrato), no
// molde dos ícones das abas (arte/Icones.tsx): viewBox 32, contorno escuro por fora (paintOrder="stroke") e
// gradientes compartilhados de DefsIcones. Um envelope de pergaminho aberto com a carta saindo, e na carta um
// coração vermelho (convite de amigo); a aba aberta fica atrás da carta e o bolso da frente, por cima.

const TINTA = '#2b1a0f';
const CONTORNO = { stroke: TINTA, strokeWidth: 5, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const };

const CORACAO_D = 'M16 17.2C11.6 14.5 10.4 11.5 11.9 9.7C13.1 8.3 15 8.6 16 10.2C17 8.6 18.9 8.3 20.1 9.7C21.6 11.5 20.4 14.5 16 17.2Z';
const BOLSO_D = 'M4.2 13.6L16 21.8L27.8 13.6V26.1Q27.8 28.2 25.7 28.2H6.3Q4.2 28.2 4.2 26.1Z';

export function IconeConvite({ className, titulo }: { className?: string; titulo?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} {...(titulo ? { role: 'img' as const, 'aria-label': titulo } : { 'aria-hidden': true as const })}>
      {/* aba aberta (atrás da carta) */}
      <path d="M4.2 13.6L16 4.4L27.8 13.6Z" fill="#e9c27e" {...CONTORNO} />
      <path d="M8.6 12.4L16 6.8L23.4 12.4" fill="none" stroke="#c9944a" strokeWidth={1.1} strokeLinecap="round" opacity={0.75} />
      {/* carta saindo do envelope */}
      <rect x="7.8" y="6.6" width="16.4" height="17" rx="2.2" fill="#fffdf6" {...CONTORNO} />
      <path d="M9.6 8.4V13.6" stroke="#fff" strokeWidth={1.2} strokeLinecap="round" opacity={0.9} />
      {/* coração vermelho na carta */}
      <path d={CORACAO_D} fill="url(#gi-icones-toldo-base)" stroke="#6e0f08" strokeWidth={2.2} paintOrder="stroke" strokeLinejoin="round" />
      <ellipse cx="13.6" cy="11" rx="0.9" ry="1.3" transform="rotate(-30 13.6 11)" fill="#fff" opacity={0.85} />
      {/* bolso da frente, com as dobras e um filete de luz */}
      <path d={BOLSO_D} fill="url(#gi-icones-ovo-galinha)" {...CONTORNO} />
      <path d="M5.6 27L13.4 20.8M26.4 27L18.6 20.8" fill="none" stroke="#c9a66a" strokeWidth={1.2} strokeLinecap="round" opacity={0.85} />
      <path d="M6.2 16.8V24.2" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" opacity={0.8} />
    </svg>
  );
}

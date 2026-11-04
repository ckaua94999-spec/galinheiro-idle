// Ícone ilustrado do atendimento (cabeçalho da tela /suporte), no molde dos ícones das abas (arte/Icones.tsx):
// viewBox 32, contorno escuro por fora (paintOrder="stroke") e gradientes compartilhados de DefsIcones.
// Dois balões de conversa nas cores do chat: o azul do jogador perguntando ("?") e, na frente, o pergaminho
// da equipe respondendo ("…").

const TINTA = '#2b1a0f';
const CONTORNO = { stroke: TINTA, strokeWidth: 5, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const };

export function IconeAtendimento({ className, titulo }: { className?: string; titulo?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} {...(titulo ? { role: 'img' as const, 'aria-label': titulo } : { 'aria-hidden': true as const })}>
      {/* balão de trás (jogador): azul, cauda para a esquerda */}
      <path
        d="M7.6 2.8H15.2Q20 2.8 20 7.6V10.4Q20 15.2 15.2 15.2H10.6L4.4 19.4L6.4 14.8Q2.6 13.9 2.6 10.4V7.6Q2.6 2.8 7.6 2.8Z"
        fill="url(#gi-icones-carta-raro)"
        {...CONTORNO}
      />
      <path d="M5 7.2Q5.3 5.4 7.3 5.2" fill="none" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" opacity={0.7} />
      {/* "?" branco contornado */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.9 6.9Q9.1 5.6 10.7 5.6Q12.4 5.6 12.4 7Q12.4 8 10.9 8.7V9.4" stroke="#0b2d66" strokeWidth={3.6} />
        <path d="M8.9 6.9Q9.1 5.6 10.7 5.6Q12.4 5.6 12.4 7Q12.4 8 10.9 8.7V9.4" stroke="#fff" strokeWidth={1.7} />
      </g>
      <circle cx="10.9" cy="11.9" r="1.35" fill="#fff" stroke="#0b2d66" strokeWidth={1.5} paintOrder="stroke" />
      {/* balão da frente (equipe): pergaminho, cauda para a direita */}
      <path
        d="M17 12.6H24.6Q29.6 12.6 29.6 17.6V20.4Q29.6 24.6 26.2 25.3L28 29.4L21.4 25.4H17Q12 25.4 12 20.4V17.6Q12 12.6 17 12.6Z"
        fill="url(#gi-icones-ovo-galinha)"
        {...CONTORNO}
      />
      <path d="M14.5 17Q14.8 15.3 16.7 15.1" fill="none" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" opacity={0.95} />
      {/* "…" digitando */}
      <g fill="#8a5226">
        <circle cx="16.8" cy="19.2" r="1.7" />
        <circle cx="20.8" cy="19.2" r="1.7" />
        <circle cx="24.8" cy="19.2" r="1.7" />
      </g>
    </svg>
  );
}

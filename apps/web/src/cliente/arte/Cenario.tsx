// Cenário do galinheiro (DIRECAO_DE_ARTE 8.1): céu com sol e nuvens, colinas em camadas, celeiro com silo,
// moinho, árvores e flores (TopoCenario), mais o cercado de madeira com chão de grama que envolve o grid
// (Cerca) e a placa do galinheiro. Tudo estático e barato: só o sol, as nuvens e as pás do moinho
// animam, e sempre por transform num elemento HTML (composto pela GPU). Gradientes em DefsCenario.
import type { CSSProperties, ReactNode } from 'react';

// ------------------------------------------------------------------ sol
// 12 raios alternando comprimento, num path só (centro 0,0) para o gradiente radial casar com o disco.
const RAIOS_SOL = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  const w = 0.13;
  const fora = i % 2 ? 50 : 60;
  const p = (r: number, ang: number) => `${(Math.cos(ang) * r).toFixed(1)} ${(Math.sin(ang) * r).toFixed(1)}`;
  return `M${p(26, a - w)}L${p(fora, a)}L${p(26, a + w)}Z`;
}).join('');

function Sol() {
  return (
    <div className="cenario-sol">
      <span className="cenario-sol-raios">
        <svg viewBox="-60 -60 120 120" className="h-full w-full">
          <path d={RAIOS_SOL} fill="url(#gi-cenario-raio)" />
        </svg>
      </span>
      <svg viewBox="-60 -60 120 120" className="absolute inset-0 h-full w-full">
        <circle r={46} fill="url(#gi-cenario-sol-halo)" />
        <circle r={27} fill="url(#gi-cenario-sol)" stroke="#e08a00" strokeWidth={4} paintOrder="stroke" />
        {/* brilho de borda embaixo à direita e realce no alto à esquerda */}
        <path d="M19 9A21 21 0 0 1 4 21" fill="none" stroke="#ff9d00" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
        <ellipse cx={-9} cy={-11} rx={9} ry={5.5} fill="#fffef0" opacity={0.8} transform="rotate(-38 -9 -11)" />
        <circle cx={6} cy={-16} r={2.2} fill="#fffef0" opacity={0.7} />
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ nuvem
function Nuvem({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 140 60" className={className} style={style} aria-hidden>
      <path
        d="M24 52C9 52 6 37 18 33C14 20 30 13 42 21C46 7 69 2 78 17C86 8 105 11 107 26C121 24 131 37 123 46C126 52 119 55 111 53L32 54C28 54 26 53 24 52Z"
        fill="url(#gi-cenario-nuvem)"
        stroke="#a9d6f0"
        strokeWidth={4}
        strokeLinejoin="round"
        paintOrder="stroke"
      />
      {/* barriga sombreada e as dobras entre os tufos */}
      <path d="M17 44C42 51 92 51 124 44C122 50 117 54 111 53L32 54C24 54 19 50 17 44Z" fill="#d6eefc" />
      <path d="M40 24C44 28 46 33 45 37M76 18C80 22 81 28 79 33M105 27C102 30 100 34 100 38" fill="none" stroke="#cfe6f8" strokeWidth={2.2} strokeLinecap="round" />
      <ellipse cx={58} cy={17} rx={8} ry={4} fill="#fff" />
    </svg>
  );
}

// ------------------------------------------------------------------ celeiro + silo
/** Tufo de grama (3 folhas), base em y = 8. */
const TUFO = 'M0 8C1 5 1.5 2.5 1 0C3 2 4 4.5 4.2 6.5C4.8 3.5 6.5 1 9 -0.5C7.5 2.5 7 5 7 7C8.2 5 10.2 3.8 12.5 3.8C10.5 5 9.6 6.6 9.6 8Z';

function CeleiroSilo({ className }: { className?: string }) {
  const T = '#4a1010';
  return (
    <svg viewBox="0 -12 160 120" className={className} aria-hidden>
      {/* sombra de contato: larga no chão, mais escura sob o portão e sob o silo */}
      <ellipse cx={80} cy={100} rx={79} ry={6} fill="#2f7a22" opacity={0.45} />
      <ellipse cx={131} cy={100.5} rx={21} ry={3.6} fill="#1f5a14" opacity={0.4} />
      {/* terreiro de terra batida na frente do portão (a metade de cima some atrás da parede) */}
      <ellipse cx={58} cy={102.2} rx={32} ry={6.2} fill="#8a5a24" />
      <ellipse cx={58} cy={101.6} rx={30} ry={5} fill="#c9a066" />
      <ellipse cx={50} cy={102.6} rx={12} ry={1.6} fill="#e0bd85" opacity={0.9} />
      <path d="M70 103.4H78M40 104.2H45" stroke="#9a6424" strokeWidth={1.2} strokeLinecap="round" />
      {/* silo atrás, à direita */}
      <g stroke="#3a4458" strokeLinejoin="round">
        <rect x={115} y={34} width={33} height={66} rx={2} fill="url(#gi-cenario-silo)" strokeWidth={2.5} />
        <path d="M117 48H146M117 62H146M117 76H146M117 90H146" stroke="#7f8fa8" strokeWidth={1.5} />
        <path d="M113 37C113 15 150 15 150 37Z" fill="url(#gi-cenario-silo-cupula)" strokeWidth={2.5} />
        <rect x={128.5} y={13} width={6} height={6} rx={1.5} fill="#7f8fa8" strokeWidth={2} />
        <path d="M139 40V98M145 40V98M139 47H145M139 55H145M139 63H145M139 71H145M139 79H145M139 87H145M139 95H145" stroke="#5d6d88" strokeWidth={1.2} />
      </g>
      <rect x={119} y={38} width={4} height={58} fill="#fff" opacity={0.4} />
      <path d="M119 26C121 21 126 19 131 19" fill="none" stroke="#e4ecf7" strokeWidth={2.4} strokeLinecap="round" />

      {/* frente do celeiro (perfil "gambrel") */}
      <path d="M10 100V54L22 31L58 15L94 31L106 54V100Z" fill="url(#gi-cenario-celeiro-parede)" stroke={T} strokeWidth={3} strokeLinejoin="round" />
      {/* tábuas verticais e a sombra "cel" do lado direito (a luz vem da esquerda) */}
      <path d="M22 40V100M34 33V100M82 33V100M94 40V100" stroke="#a82a2a" strokeWidth={1.6} opacity={0.6} />
      <path d="M90 29L94 31L106 54V100H90Z" fill="#8e2224" opacity={0.35} />
      {/* telhado: faixa grossa com telhas */}
      <path
        d="M3 58L17 27L58 7L99 27L113 58L104 58L92 34L58 18L24 34L12 58Z"
        fill="url(#gi-cenario-celeiro-telhado)"
        stroke={T}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <path d="M8 52L19 30M15 54L24 34M101 30L108 52M92 34L101 54" stroke="#5c1414" strokeWidth={1.2} opacity={0.6} />
      <path d="M18 29L58 10L98 29" fill="none" stroke="#c46a5a" strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
      {/* acabamento branco */}
      <path d="M14 58L26 36L58 21L90 36L102 58" fill="none" stroke="#fff6e0" strokeWidth={2.4} strokeLinejoin="round" />
      <rect x={10} y={56} width={96} height={5} fill="url(#gi-cenario-acabamento)" stroke={T} strokeWidth={1.8} />
      <rect x={10} y={61} width={5} height={39} fill="url(#gi-cenario-acabamento)" stroke={T} strokeWidth={1.8} />
      <rect x={101} y={61} width={5} height={39} fill="url(#gi-cenario-acabamento)" stroke={T} strokeWidth={1.8} />
      {/* janela redonda do sótão com palha escapando */}
      <circle cx={58} cy={38} r={9.5} fill="#fff6e0" stroke={T} strokeWidth={2.2} />
      <circle cx={58} cy={38} r={6.5} fill="url(#gi-cenario-janela)" stroke={T} strokeWidth={1.6} />
      <path d="M58 32V44M52 38H64" stroke="#c98e34" strokeWidth={1.4} />
      <path d="M53 45Q50 50 47 51M58 46Q58 51 56 53M62 45Q66 49 69 50" fill="none" stroke="#f2c75c" strokeWidth={1.8} strokeLinecap="round" />
      {/* portão com X */}
      <rect x={36} y={66} width={44} height={34} fill="url(#gi-cenario-celeiro-porta)" stroke={T} strokeWidth={2.4} />
      <path d="M39 69L56 97M56 69L39 97M60 69L77 97M77 69L60 97" stroke={T} strokeWidth={5.6} strokeLinecap="round" />
      <path d="M39 69L56 97M56 69L39 97M60 69L77 97M77 69L60 97" stroke="#fff6e0" strokeWidth={3} strokeLinecap="round" />
      <rect x={38} y={68} width={40} height={30} fill="none" stroke="#fff6e0" strokeWidth={2.4} />
      <path d="M58 68V98" stroke={T} strokeWidth={2} />
      {/* realce de borda à esquerda */}
      <path d="M14 98V60" stroke="#ff9a80" strokeWidth={1.6} opacity={0.7} />
      <ellipse cx={58} cy={100.5} rx={26} ry={3.4} fill="#1f5a14" opacity={0.45} />
      {/* tufos de grama cobrindo a linha da base (celeiro e silo "brotam" do chão) */}
      <g fill="#6cc644" stroke="#3f8f2a" strokeWidth={1.2} strokeLinejoin="round">
        <path d={TUFO} transform="translate(6 92)" />
        <path d={TUFO} transform="translate(27 93) scale(.8)" />
        <path d={TUFO} transform="translate(84 92.5) scale(.9)" />
        <path d={TUFO} transform="translate(99 93)" />
        <path d={TUFO} transform="translate(113 92.5) scale(.85)" />
        <path d={TUFO} transform="translate(140 93) scale(.9)" />
        {/* tufos na beira do terreiro */}
        <path d={TUFO} transform="translate(22 99.5) scale(.75)" />
        <path d={TUFO} transform="translate(86 100) scale(.7)" />
      </g>
      {/* cata-vento de galo no topo */}
      <path d="M58 7V-4" stroke={T} strokeWidth={1.8} />
      <path d="M52 -4H64" stroke={T} strokeWidth={1.5} />
      <path d="M53 -6C53 -10 56 -12 58 -11L59 -14L61 -11C64 -11 65 -8 63 -6Q58 -4 53 -6Z" fill={T} />
    </svg>
  );
}

// ------------------------------------------------------------------ árvore, arbusto, moinho, fardo, flor
/** Copa feita de bolas (cada uma com o próprio volume) e contorno único: traço grosso de todas antes do preenchimento. */
function Copa({ bolas, grad = 'gi-cenario-copa', contorno = '#1f5a14' }: { bolas: [number, number, number][]; grad?: string; contorno?: string }) {
  return (
    <>
      <g fill={contorno} stroke={contorno} strokeWidth={5}>
        {bolas.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} />
        ))}
      </g>
      <g fill={`url(#${grad})`}>
        {bolas.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} />
        ))}
      </g>
    </>
  );
}

function Arvore({ className, style, macas = true }: { className?: string; style?: CSSProperties; macas?: boolean }) {
  return (
    <svg viewBox="0 0 80 92" className={className} style={style} aria-hidden>
      <ellipse cx={42} cy={89} rx={26} ry={3.5} fill="#2f7a22" opacity={0.4} />
      <path d="M34 89L36 58Q36 52 40 52Q44 52 44 58L46 89Z" fill="url(#gi-cenario-tronco)" stroke="#3b200c" strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M41 66Q48 62 52 56" fill="none" stroke="#3b200c" strokeWidth={4.6} strokeLinecap="round" />
      <path d="M41 66Q48 62 52 56" fill="none" stroke="#9a6230" strokeWidth={2.2} strokeLinecap="round" />
      <Copa bolas={[[22, 46, 15], [58, 46, 15], [40, 36, 22], [27, 25, 14], [53, 24, 15], [40, 52, 14]]} />
      {/* sombra cel embaixo à direita e brilho no alto à esquerda */}
      <path d="M50 58Q66 58 71 46Q70 56 60 60Q52 63 44 62Z" fill="#2a7a26" opacity={0.45} />
      <ellipse cx={30} cy={20} rx={6} ry={3.5} fill="#d4ffae" opacity={0.75} transform="rotate(-30 30 20)" />
      {macas && (
        <g fill="url(#gi-cenario-maca)" stroke="#6e1622" strokeWidth={1}>
          <circle cx={28} cy={42} r={3} />
          <circle cx={52} cy={34} r={3} />
          <circle cx={46} cy={50} r={3} />
          <circle cx={62} cy={46} r={2.6} />
        </g>
      )}
    </svg>
  );
}

function Arbusto({ className, style, flores = '#ff8ac0' }: { className?: string; style?: CSSProperties; flores?: string }) {
  return (
    <svg viewBox="0 0 64 36" className={className} style={style} aria-hidden>
      <ellipse cx={32} cy={33} rx={28} ry={3} fill="#2f7a22" opacity={0.4} />
      <Copa bolas={[[14, 24, 10], [50, 24, 10], [26, 17, 12], [40, 16, 12], [32, 25, 10]]} grad="gi-cenario-copa-escura" />
      <ellipse cx={22} cy={11} rx={4} ry={2.4} fill="#c8ff9a" opacity={0.7} transform="rotate(-25 22 11)" />
      <g fill={flores} stroke="#8a2a5a" strokeWidth={0.8}>
        <circle cx={18} cy={20} r={2.2} />
        <circle cx={36} cy={12} r={2.2} />
        <circle cx={46} cy={24} r={2.2} />
      </g>
      <g fill="#ffe36b">
        <circle cx={18} cy={20} r={0.9} />
        <circle cx={36} cy={12} r={0.9} />
        <circle cx={46} cy={24} r={0.9} />
      </g>
    </svg>
  );
}

// Pá do moinho: treliça de madeira com lona.
const PA = (
  <g>
    <path d="M0 -5V-30" stroke="#5a4630" strokeWidth={3} strokeLinecap="round" />
    <rect x={0} y={-30} width={10} height={22} rx={1.5} fill="#fffaf0" stroke="#5a4630" strokeWidth={1.8} />
    <path d="M0 -24.5H10M0 -19H10M0 -13.5H10M5 -30V-8" stroke="#c9b28a" strokeWidth={1.1} />
  </g>
);

function Moinho({ className }: { className?: string }) {
  return (
    <div className={`cenario-moinho ${className ?? ''}`}>
      <svg viewBox="0 0 60 92" className="absolute inset-0 h-full w-full" aria-hidden>
        <ellipse cx={30} cy={89} rx={16} ry={2.5} fill="#3f8f2a" opacity={0.35} />
        <path d="M21 89L25 38H35L39 89Z" fill="url(#gi-cenario-moinho)" stroke="#5a4630" strokeWidth={2.2} strokeLinejoin="round" />
        <path d="M24 52H36M23 66H37M22 80H38" stroke="#cdb894" strokeWidth={1.4} />
        <path d="M27 89V80Q30 76 33 80V89Z" fill="#8a5428" stroke="#5a4630" strokeWidth={1.6} />
        <path d="M21 40L30 28L39 40Z" fill="#c13a32" stroke="#4a1010" strokeWidth={2} strokeLinejoin="round" />
      </svg>
      <span className="cenario-moinho-pas">
        <svg viewBox="-32 -32 64 64" className="h-full w-full" aria-hidden>
          {PA}
          <g transform="rotate(90)">{PA}</g>
          <g transform="rotate(180)">{PA}</g>
          <g transform="rotate(270)">{PA}</g>
          <circle r={3.6} fill="#8a5428" stroke="#3b200c" strokeWidth={1.6} />
        </svg>
      </span>
    </div>
  );
}

function Fardo({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 54 36" className={className} style={style} aria-hidden>
      <ellipse cx={27} cy={33} rx={24} ry={3} fill="#2f7a22" opacity={0.4} />
      <path d="M12 6H40A11 13.5 0 0 1 40 33H12A11 13.5 0 0 1 12 6Z" fill="url(#gi-cenario-palha)" stroke="#6b4416" strokeWidth={2.2} />
      <path d="M14 12H36M13 19H35M14 26H36" stroke="#c9932f" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M22 6V33M30 6V33" stroke="#c8352b" strokeWidth={2} />
      <ellipse cx={40} cy={19.5} rx={10} ry={12.6} fill="#ffe58a" stroke="#6b4416" strokeWidth={2} />
      <path d="M40 19.5m-6 0a6 7.5 0 1 0 12 0a4 5 0 1 0 -8 0a2 2.5 0 1 0 4 0" fill="none" stroke="#c9932f" strokeWidth={1.3} />
      <path d="M8 10Q10 7 14 7" fill="none" stroke="#fff3c0" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

function Flor({ className, cor = '#fff', style }: { className?: string; cor?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 14 18" className={className} style={style} aria-hidden>
      <path d="M7 17V9" stroke="#2f8a2a" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M7 14Q10 11 12 12Q10 15 7 14Z" fill="#4fae35" />
      <g fill={cor} stroke={cor === '#fff' ? '#9ab0c8' : '#b0577a'} strokeWidth={0.8}>
        <circle cx={7} cy={2.8} r={2.4} />
        <circle cx={10.4} cy={5.3} r={2.4} />
        <circle cx={9.1} cy={9.2} r={2.4} />
        <circle cx={4.9} cy={9.2} r={2.4} />
        <circle cx={3.6} cy={5.3} r={2.4} />
      </g>
      <circle cx={7} cy={6.2} r={2} fill="#ffd23f" stroke="#c27c00" strokeWidth={0.7} />
    </svg>
  );
}

/** Trecho de cerca ao longe (o mesmo padrão do cercado, em meia escala). */
function Cerquinha({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 220 40" className={className} style={style} aria-hidden>
      <rect width={220} height={40} fill="url(#gi-cenario-cerca)" />
    </svg>
  );
}

/** Casinha de galinhas sobre palafitas, com rampa (só em telas bem largas). */
function Casinha({ className, style }: { className?: string; style?: CSSProperties }) {
  const T = '#3b200c';
  return (
    <svg viewBox="0 0 70 62" className={className} style={style} aria-hidden>
      <ellipse cx={35} cy={58} rx={31} ry={3.6} fill="#2f7a22" opacity={0.45} />
      <path d="M14 42V58M52 42V58" stroke={T} strokeWidth={5} strokeLinecap="round" />
      <path d="M14 42V58M52 42V58" stroke="#b9773f" strokeWidth={2.6} strokeLinecap="round" />
      {/* corpo de tábuas e a empena */}
      <path d="M8 46V27L35 12L62 27V46Z" fill="url(#gi-cenario-madeira)" stroke={T} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M17 24V46M26 19V46M44 19V46M53 24V46" stroke="#9a5f2e" strokeWidth={1.2} opacity={0.8} />
      <path d="M50 22L62 27V46H50Z" fill="#7a4a22" opacity={0.3} />
      <circle cx={21} cy={33} r={4} fill="url(#gi-cenario-janela)" stroke={T} strokeWidth={1.6} />
      {/* portinha arredondada e rampa com degraus */}
      <path d="M30 46V36Q35 29 40 36V46Z" fill="#3b200c" />
      <path d="M38 45L57 58L53 60.5L35 47Z" fill="url(#gi-cenario-madeira-h)" stroke={T} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M41 48.6L43 47.2M45.5 51.6L47.5 50.2M50 54.6L52 53.2" stroke={T} strokeWidth={1.3} strokeLinecap="round" />
      {/* telhado vermelho */}
      <path d="M2 30L35 9L68 30L63 33L35 15.5L7 33Z" fill="url(#gi-cenario-celeiro-telhado)" stroke="#4a1010" strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M9 28.5L35 12L61 28.5" fill="none" stroke="#c46a5a" strokeWidth={1.4} strokeLinecap="round" opacity={0.8} />
      <g fill="#6cc644" stroke="#3f8f2a" strokeWidth={1.1} strokeLinejoin="round">
        <path d={TUFO} transform="translate(9 51) scale(.8)" />
        <path d={TUFO} transform="translate(56 51) scale(.8)" />
      </g>
    </svg>
  );
}

/** Dois passarinhos em "v" ao longe. */
function Passaros({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 40 16" className={className} style={style} aria-hidden>
      <g fill="none" stroke="#3c5a78" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 7Q6 2 10 7Q14 2 18 7" />
        <path d="M24 13Q27 9.5 30 13Q33 9.5 36 13" opacity={0.75} />
      </g>
    </svg>
  );
}

/**
 * Posição de um item do cenário: esquerda em % (ou CSS) e base/largura em "u" (1 px no celular; cresce
 * nas telas bem largas junto com as colinas, ver .cenario-topo no cenario.css).
 */
function em(esquerda: number | string, base: number, largura?: number): CSSProperties {
  return {
    left: typeof esquerda === 'number' ? `${esquerda}%` : esquerda,
    bottom: `calc(var(--u) * ${base})`,
    width: largura === undefined ? undefined : `calc(var(--u) * ${largura})`,
  };
}

// Colinas num viewBox largo (1200) recortado no centro e alinhado embaixo ("xMidYMax slice"): as curvas
// não achatam no desktop e o celular vê só o miolo (400–800). Escala vertical = altura/144. A colina da
// frente faz um vale em 524–724: é ali que o celeiro e o silo ficam (em todas as larguras), assentados.
const COLINAS = {
  fundo:
    'M0 74C60 54 130 50 200 62C260 72 330 100 400 86C440 68 482 62 522 72C562 82 594 84 632 68C682 48 732 52 800 72C868 92 920 96 990 80C1060 64 1120 50 1200 60V144H0Z',
  meio:
    'M0 100C60 90 130 88 200 98C270 108 330 120 400 110C452 98 504 94 562 103C612 111 662 111 712 99C752 90 780 92 800 96C830 102 900 110 980 104C1060 98 1130 90 1200 94V144H0Z',
  frente:
    'M0 124C80 118 160 118 240 126C300 132 340 137 400 130C440 125 486 122 524 127C556 131 576 136 612 136C652 136 690 134 724 127C756 121 776 123.2 800 120C860 112 940 112 1010 120C1080 128 1140 130 1200 126V144H0Z',
};

// ------------------------------------------------------------------ topo
/** Faixa de cenário acima do grid: céu, sol, nuvens, colinas, celeiro, moinho, árvores e flores. */
export function TopoCenario() {
  return (
    <div className="cenario-cq" aria-hidden>
      <div className="cenario-topo">
        <Sol />
        <Nuvem className="nuvem w-28" style={{ top: 6, animationDuration: '70s', animationDelay: '-20s', '--x-parado': '8cqw' } as CSSProperties} />
        <Nuvem className="nuvem w-20 opacity-90" style={{ top: 40, animationDuration: '95s', animationDelay: '-55s', '--x-parado': '52cqw' } as CSSProperties} />
        <Nuvem className="nuvem w-36 opacity-95" style={{ top: 14, animationDuration: '120s', animationDelay: '-92s', '--x-parado': '30cqw' } as CSSProperties} />
        <Nuvem className="nuvem cenario-muito-largo w-24 opacity-85" style={{ top: 64, animationDuration: '150s', animationDelay: '-30s', '--x-parado': '70cqw' } as CSSProperties} />
        <Passaros className="cenario-item cenario-largo" style={{ left: '24%', top: 22, width: 30 }} />
        <Passaros className="cenario-item cenario-muito-largo" style={{ left: '66%', top: 46, width: 24 }} />

        {/* colinas do fundo (nada redondo mora nelas) */}
        <svg viewBox="0 0 1200 144" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
          <path d={COLINAS.fundo} fill="url(#gi-cenario-colina-fundo)" />
        </svg>
        <Moinho className="cenario-moinho-pos" />
        <Arvore className="cenario-item" style={em(30, 34, 22)} macas={false} />
        <Arvore className="cenario-item cenario-largo" style={em(84, 38, 20)} macas={false} />
        <Arvore className="cenario-item cenario-largo" style={em(62, 46, 18)} macas={false} />
        <Arvore className="cenario-item cenario-largo" style={em(65, 44, 24)} macas={false} />
        <Arvore className="cenario-item cenario-muito-largo" style={em(8, 44, 20)} macas={false} />
        <svg viewBox="0 0 1200 144" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
          <path d={COLINAS.meio} fill="url(#gi-cenario-colina-meio)" />
          {/* plantações de trigo */}
          <path d="M418 112C452 104 496 101 534 106L542 118C502 114 460 115 412 121Z" fill="url(#gi-cenario-palha)" />
          <path d="M422 115C456 108 498 106 537 110M417 118.5C454 112 498 110 540 114" fill="none" stroke="#c9932f" strokeWidth={1.4} />
          <path d="M418 112C452 104 496 101 534 106" fill="none" stroke="#fff0a8" strokeWidth={1.6} />
          <path d="M884 114C924 108 974 107 1014 111L1020 121C980 118 934 119 878 124Z" fill="url(#gi-cenario-palha)" />
          <path d="M886 117C926 111 974 110 1016 114M881 120.5C924 115 976 114 1018 118" fill="none" stroke="#c9932f" strokeWidth={1.4} />
          <path d="M884 114C924 108 974 107 1014 111" fill="none" stroke="#fff0a8" strokeWidth={1.6} />
        </svg>
        <Casinha className="cenario-item cenario-muito-largo" style={em(31, 12, 58)} />
        <CeleiroSilo className="cenario-item cenario-celeiro" />
        <Arvore className="cenario-item" style={em('-4px', 4, 64)} />
        <Arvore className="cenario-item" style={{ ...em(0, 4, 58), left: 'auto', right: '1%' }} />
        <Arvore className="cenario-item cenario-largo" style={em(20, 6, 50)} />
        <Arvore className="cenario-item cenario-largo" style={em(80, 8, 60)} />
        {/* colina da frente: termina na cor exata do campo (#5cb83a) */}
        <svg viewBox="0 0 1200 144" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
          <path d={COLINAS.frente} fill="url(#gi-cenario-colina-frente)" />
        </svg>
        {/* em cima da colina da frente */}
        <Arbusto className="cenario-item" style={em(13, 4, 42)} />
        <Fardo className="cenario-item" style={em(25, 5, 32)} />
        <Arbusto className="cenario-item cenario-largo" style={em(72, 8, 46)} flores="#fff" />
        <Fardo className="cenario-item cenario-largo" style={em(64, 6, 30)} />
        <Fardo className="cenario-item cenario-largo" style={em(67, 4, 34)} />
        <Cerquinha className="cenario-item cenario-largo" style={em(52, 8, 110)} />
        <Arbusto className="cenario-item cenario-largo" style={em(90, 3, 48)} />
        <Arbusto className="cenario-item cenario-muito-largo" style={em(34, 4, 40)} flores="#ffe36b" />
        <Flor className="cenario-item" style={em(17, 3, 11)} />
        <Flor className="cenario-item" style={em(21, 9, 9)} cor="#ff8ac0" />
        <Flor className="cenario-item" style={em(58, 2, 11)} cor="#ff8ac0" />
        <Flor className="cenario-item" style={em(63, 8, 9)} />
        <Flor className="cenario-item" style={em(88, 2, 10)} cor="#ff8ac0" />
        <Flor className="cenario-item cenario-largo" style={em(44, 5, 10)} />
        <Flor className="cenario-item cenario-muito-largo" style={em(38, 3, 10)} cor="#ff8ac0" />
        <Flor className="cenario-item cenario-muito-largo" style={em(76, 3, 11)} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ cercado
/** Fileira de cerca em pé (postes + 2 travessas), com padrão SVG compartilhado repetido na largura. */
function FileiraCerca({ lado }: { lado: 'fundo' | 'frente' }) {
  return (
    <svg className={`cerca-fileira cerca-fileira-${lado}`} aria-hidden>
      <rect width="100%" height="100%" fill="url(#gi-cenario-cerca)" />
    </svg>
  );
}

/**
 * Cercado de madeira com chão de grama em volta do grid. Os filhos ficam no chão (que é um container de
 * consulta: o grid usa @container para passar de 4 para 8 colunas pela largura do cercado).
 */
export function Cerca({ children, className, ...resto }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`cerca ${className ?? ''}`} {...resto}>
      <div className="cerca-chao grama">{children}</div>
      <span className="cerca-lado cerca-lado-e" aria-hidden />
      <span className="cerca-lado cerca-lado-d" aria-hidden />
      <FileiraCerca lado="fundo" />
      <FileiraCerca lado="frente" />
      <span className="cerca-poste cerca-poste-fundo left-[-3px]" aria-hidden />
      <span className="cerca-poste cerca-poste-fundo right-[-3px]" aria-hidden />
      <span className="cerca-poste cerca-poste-frente left-[-3px]" aria-hidden />
      <span className="cerca-poste cerca-poste-frente right-[-3px]" aria-hidden />
    </div>
  );
}

/** Placa de madeira pregada na cerca da frente ("Galinheiro nível N · M ninhos"). */
export function PlacaGalinheiro({ children }: { children: ReactNode }) {
  return (
    <div className="placa-galinheiro-ancora">
      <p className="placa-galinheiro painel-madeira texto-contorno-fino">{children}</p>
    </div>
  );
}

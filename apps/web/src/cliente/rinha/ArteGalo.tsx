// Galo de briga da rinha (perfil, olhando para a direita). Mesmo traço dos animais (contorno colorido por fora do
// preenchimento, sombra cel, realce), mas cara de poucos amigos: sobrancelha franzida, peito estufado e esporas.
// O rival usa a mesma arte espelhada (CSS) com a pelagem "rival".
import type { Galo } from '@galinheiro/game-core';

export type PelagemGalo = Galo | 'rival';

interface Cores { corpo: string; cel: string; asa: string; gola: string; cauda: string; contorno: string }

const PELAGEM: Record<PelagemGalo, Cores> = {
  favorito: { corpo: '#d8432f', cel: '#a3281c', asa: '#9a2a1e', gola: '#ffb73d', cauda: '#1f4a34', contorno: '#4a120c' },
  brigao: { corpo: '#34344a', cel: '#20202e', asa: '#24243a', gola: '#d6dee6', cauda: '#1c6e57', contorno: '#11111c' },
  azarao: { corpo: '#f7f1e6', cel: '#dccfb8', asa: '#e6dcc8', gola: '#ffe0a0', cauda: '#ece6d8', contorno: '#6a5a40' },
  rival: { corpo: '#8a5a32', cel: '#5e3b1e', asa: '#6a4424', gola: '#e8913a', cauda: '#262626', contorno: '#2e1a0a' },
};

const sil = (cor: string, w = 3) =>
  ({ stroke: cor, strokeWidth: w * 2, paintOrder: 'stroke', strokeLinejoin: 'round', strokeLinecap: 'round' }) as const;

const CAUDA = [
  'M44 60C34 46 24 30 10 22C16 36 22 50 34 64Z',
  'M42 64C30 56 18 46 6 44C14 56 24 64 36 70Z',
  'M42 69C32 66 22 64 12 66C20 74 30 78 40 76Z',
];
const CORPO = 'M38 70C38 56 50 48 64 50C76 51 84 60 84 72C84 86 72 94 58 94C46 94 38 84 38 70Z';
const CORPO_CEL = 'M83.6 75C82 87 71 94 58 94C50 94 44 90 41 84C48 89 58 90 66 87C75 84 81 80 83.6 75Z';
const GOLA = 'M66 52L70 30L76 26L86 30L88 44L84 52L80 58L76 54L72 60L70 54Z';
const ASA = 'M46 68C52 60 66 60 74 66C78 70 76 78 70 80C62 84 50 82 46 76C44 73 44 70 46 68Z';
const ASA_LINHAS = 'M52 74Q60 70 70 72M50 78Q58 76 66 78';
const CABECA = 'M74 26C80 20 90 22 92 30C94 38 88 44 81 43C75 42 71 36 74 26Z';
const CRISTA = 'M73 25C71 19 74 15 77 18C77 12 82 11 83 16C85 11 90 12 89 18C93 16 95 21 91 24C86 22 80 22 73 25Z';
const BARBELA = 'M86 41C84 46 85 52 89 52C92 52 92 46 90 41Z';
const BICO = 'M90 30L101 33.6L90 37.4Z';
const PERNAS = 'M54 92L52 106M66 92L67 106';
const PES = 'M44 108L52 106L58 108M60 108L67 106L74 108';
const ESPORAS = 'M52.6 100L48.6 101.6M66.6 100L62.4 101.4';

/** Galo de perfil (viewBox 0 0 120 120). `espelhado` vira para a esquerda (o rival). */
export function ArteGalo({ pelagem, className, espelhado = false }: { pelagem: PelagemGalo; className?: string; espelhado?: boolean }) {
  const c = PELAGEM[pelagem];
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden style={espelhado ? { scale: '-1 1' } : undefined}>
      <ellipse cx="58" cy="110" rx="26" ry="5" fill="#2b1a0f" opacity=".22" />
      <g className="rinha-galo-pernas">
        <path d={PERNAS} fill="none" stroke="#3b200c" strokeWidth={6.5} strokeLinecap="round" />
        <path d={PERNAS} fill="none" stroke="#ffbf3a" strokeWidth={3.4} strokeLinecap="round" />
        <path d={ESPORAS} fill="none" stroke="#3b200c" strokeWidth={4.6} strokeLinecap="round" />
        <path d={ESPORAS} fill="none" stroke="#fff2cc" strokeWidth={2} strokeLinecap="round" />
        <path d={PES} fill="none" stroke="#3b200c" strokeWidth={5.4} strokeLinecap="round" strokeLinejoin="round" />
        <path d={PES} fill="none" stroke="#ffbf3a" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="rinha-galo-cauda">
        {CAUDA.map((d) => (
          <path key={d} d={d} fill={c.cauda} {...sil(c.contorno, 2.4)} />
        ))}
        <path d="M30 48Q20 36 12 26M26 58Q16 50 8 46" fill="none" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" opacity={0.3} />
      </g>
      <path d={CORPO} fill={c.corpo} {...sil(c.contorno, 3)} />
      <path d={CORPO_CEL} fill={c.cel} opacity={0.6} />
      <ellipse cx="54" cy="60" rx="9" ry="4.6" fill="#fff" opacity=".28" transform="rotate(-20 54 60)" />
      <path d={GOLA} fill={c.gola} {...sil(c.contorno, 2.4)} />
      <path d="M74 32L72 48M80 32L78 50" fill="none" stroke={c.contorno} strokeWidth={1.3} strokeLinecap="round" opacity={0.45} />
      <g className="rinha-galo-asa">
        <path d={ASA} fill={c.asa} {...sil(c.contorno, 2.2)} />
        <path d={ASA_LINHAS} fill="none" stroke="#fff" strokeWidth={1.3} strokeLinecap="round" opacity={0.35} />
      </g>
      <g className="rinha-galo-cabeca">
        <path d={CRISTA} fill="#ee3b32" {...sil('#6e1622', 2.2)} />
        <path d={CABECA} fill={c.gola} {...sil(c.contorno, 2.6)} />
        <path d={BARBELA} fill="#ee3b32" {...sil('#6e1622', 1.6)} />
        <path d={BICO} fill="#ffc23a" {...sil('#7a3a0c', 1.6)} strokeLinejoin="round" />
        <circle cx="85" cy="30.4" r="3.6" fill="#fff" />
        <circle cx="86.2" cy="30.8" r="2" fill="#1e1426" />
        <circle cx="86.8" cy="30.1" r=".7" fill="#fff" />
        {/* sobrancelha franzida: cara de briga */}
        <path d="M80.4 25.6L89.6 28.4" stroke={c.contorno} strokeWidth={2.6} strokeLinecap="round" />
      </g>
    </svg>
  );
}

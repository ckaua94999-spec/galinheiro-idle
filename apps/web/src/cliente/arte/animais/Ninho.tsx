// Ninho de palha (DIRECAO_DE_ARTE 5.5) em duas metades: a de trás (borda do fundo + interior escuro)
// vai antes do animal e a da frente (borda ondulada com palha trançada) vai depois, cobrindo a barriga.
// Tudo é estático e montado uma vez no módulo: os 128 ninhos do grid reaproveitam os mesmos elementos.
import { circ } from './comum';

const CONTORNO = '#6b4416';

// Borda da frente: lombadas de palha da esquerda para a direita, cada uma de um vale ao seguinte
// [x do vale da esquerda, y, x da lombada, y da lombada, x do vale da direita, y].
const LOMBADAS: [number, number, number, number, number, number][] = [
  [12, 92, 18, 87.4, 24.5, 91.4],
  [24.5, 91.4, 32, 87.8, 39.5, 92.6],
  [39.5, 92.6, 49.5, 89.4, 60, 93.6],
  [60, 93.6, 70.5, 89.4, 80.5, 92.6],
  [80.5, 92.6, 88, 87.8, 95.5, 91.4],
  [95.5, 91.4, 102, 87.4, 108, 92],
];

const FRENTE =
  'M12 92Q10.5 106 30 110.8Q60 117.6 90 110.8Q109.5 106 108 92' +
  [...LOMBADAS]
    .reverse()
    .map(([xa, ya, xc, yc]) => `Q${xc} ${yc} ${xa} ${ya}`)
    .join('') +
  'Z';

// Brilho no alto de cada lombada.
const BRILHO_FRENTE = LOMBADAS.map(([, ya, x, yc, , yb]) => {
  const pico = (ya + yb) / 4 + yc / 2;
  return `M${x - 3.6} ${pico + 1.9}Q${x} ${pico + 0.4} ${x + 3.6} ${pico + 1.9}`;
}).join('');

// Palha trançada: 3 fileiras de fios curtos em 3 tons (claro, médio, escuro). Ângulo (±16–32°),
// comprimento, curva e tom variam por fio, e o padrão "quebra" a cada 3–4 fios (dois seguidos no mesmo
// sentido), para ler como palha e não como pão/cesto de plástico. Sorteio determinístico (mesma
// semente sempre): o desenho é fixo e montado uma vez no módulo.
const FIOS = (() => {
  let semente = 7;
  const sorte = () => {
    semente = (semente * 16807) % 2147483647;
    return (semente - 1) / 2147483646;
  };
  const tons: [string, string, string] = ['', '', ''];
  let tomAnterior = -1;
  const fileira = (y: number, x0: number, x1: number, comeca: 1 | -1) => {
    let sentido = comeca;
    let ate = 3 + Math.floor(sorte() * 2);
    for (let x = x0; x <= x1; x += 7.5) {
      const cx = x + (sorte() - 0.5) * 1.8;
      const cy = y + (sorte() - 0.5) * 0.8;
      const ang = ((16 + sorte() * 16) * Math.PI) / 180;
      const meio = 3 + sorte() * 1.3;
      const dx = Math.cos(ang) * meio;
      const dy = Math.sin(ang) * meio * sentido;
      const curva = 0.5 + sorte() * 0.9;
      const r = (n: number) => Math.round(n * 10) / 10;
      let tom = Math.floor(sorte() * 3);
      if (tom === tomAnterior) tom = (tom + 1) % 3;
      tomAnterior = tom;
      tons[tom as 0 | 1 | 2] += `M${r(cx - dx)} ${r(cy + dy)}Q${r(cx + curva * Math.sign(dy || 1))} ${r(cy + curva)} ${r(cx + dx)} ${r(cy - dy)}`;
      // Alterna o sentido; a cada 3–4 fios repete um (quebra o zigue-zague).
      if (--ate === 0) {
        ate = 3 + Math.floor(sorte() * 2);
      } else {
        sentido = (sentido * -1) as 1 | -1;
      }
    }
  };
  fileira(98.4, 19, 101, 1);
  fileira(104.2, 22.75, 97.75, -1);
  fileira(109.4, 34, 86.5, 1);
  return tons;
})();

// Por cima da borda: fios soltos assimétricos (o da esquerda longo e enrolado para cima, o da direita
// curto apontando para baixo) e 3 palhas claras deitadas atravessando as lombadas (sem contorno; a sombra
// fina vai junto com os fios escuros da trama).
// Os fios soltos são FITAS (forma cheia, largura variando e afinando até ZERO na ponta) com contorno no
// próprio traço (paint-order stroke, #8a5a20: mais claro que o CONTORNO, para não pesar): um <path> só.
// O da esquerda é uma palha quase reta que sai da trama e dá uma quebra curta para cima (não um gancho).
type P = [number, number];
const SOLTOS_CURVAS: [P, P, P][] = [
  [[22, 99.4], [13.6, 99.2], [8.6, 95.6]],
  [[8.6, 95.6], [7, 94.2], [6.8, 91.4]],
  [[100.6, 104.6], [107.4, 106], [110.6, 109.8]],
];
function fita(curvas: [P, P, P][], largura: number): string {
  // Amostra cada fio (curvas encadeadas viram um fio só) e desloca ±meia largura na normal.
  const fios: P[][] = [];
  for (const c of curvas) {
    const ultimo = fios[fios.length - 1];
    const pts: P[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const u = 1 - t;
      pts.push([u * u * c[0][0] + 2 * u * t * c[1][0] + t * t * c[2][0], u * u * c[0][1] + 2 * u * t * c[1][1] + t * t * c[2][1]]);
    }
    if (ultimo && ultimo[ultimo.length - 1]![0] === c[0][0] && ultimo[ultimo.length - 1]![1] === c[0][1]) ultimo.push(...pts.slice(1));
    else fios.push(pts);
  }
  const r = (n: number) => Math.round(n * 10) / 10;
  return fios
    .map((pts) => {
      const ida: string[] = [];
      const volta: string[] = [];
      pts.forEach((p, i) => {
        const a = pts[Math.max(0, i - 1)]!;
        const b = pts[Math.min(pts.length - 1, i + 1)]!;
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        // Sai da trama fino (a ponta de trás não fica "cortada"), engorda, tem um "nó" leve no meio e afina até ZERO na ponta.
        const t = i / (pts.length - 1);
        const h = (largura / 2) * (0.3 + 0.7 * Math.sin((Math.PI / 2) * Math.min(1, t * 3))) * (1 + 0.18 * Math.sin(t * Math.PI * 3)) * Math.pow(1 - t, 0.75);
        const nx = (-(b[1] - a[1]) / l) * h;
        const ny = ((b[0] - a[0]) / l) * h;
        ida.push(`${r(p[0] + nx)} ${r(p[1] + ny)}`);
        volta.unshift(`${r(p[0] - nx)} ${r(p[1] - ny)}`);
      });
      return `M${ida.join('L')}L${volta.join('L')}Z`;
    })
    .join('');
}
const SOLTOS = fita(SOLTOS_CURVAS, 1.8);
const PALHAS = 'M26.6 95.4Q31 91.4 36 89.6' + 'M76.4 95.6Q72.4 92.2 66.8 91' + 'M97 97.6Q100.4 94.2 104 92.2';
const PALHAS_SOMBRA = 'M27.4 96.6Q31.6 92.8 36.4 91' + 'M75.6 96.8Q71.8 93.6 66.6 92.4' + 'M97.6 98.8Q100.8 95.6 104.2 93.6';
FIOS[2] += PALHAS_SOMBRA;
// Fios claros + palhas deitadas + brilho do alto das lombadas: o mesmo traço claro, um <path> só.
const CLAROS = FIOS[0] + PALHAS + BRILHO_FRENTE;

/** Metade de trás: borda do fundo, interior escuro e (vazio) ovo-fantasma com palhinhas. */
export function NinhoTras({ vazio }: { vazio: boolean }) {
  return vazio ? TRAS_VAZIO : TRAS;
}

// 3 elementos (eram 4): o brilho do alto da borda de trás passou para o gradiente gi-animais-ninho-borda
// (faixa clara #fff3c0 no topo, que também acende o alto das lombadas da frente).
const BORDA_FUNDO = (
  <>
    <ellipse cx={60} cy={92} rx={47} ry={13} fill="url(#gi-animais-ninho-borda)" stroke={CONTORNO} strokeWidth={7} paintOrder="stroke" className="ani-sil" />
    <path className="ani-linha" d="M24 86.2q5-3.6 10.5-3.4M39.5 82.3q6-1.7 12-1.3M66 80.6q6 0 12 1.3M83 82.4q6.5 1.2 11 3.8" fill="none" stroke="#c9932f" strokeWidth={1.3} strokeLinecap="round" opacity={0.8} />
    <ellipse cx={60} cy={90.6} rx={38.5} ry={8} fill="url(#gi-animais-ninho-interior)" />
  </>
);

const TRAS = <g className="ani-ninho-tras">{BORDA_FUNDO}</g>;

const TRAS_VAZIO = (
  <g className="ani-ninho-tras">
    {BORDA_FUNDO}
    <path d="M37 88.6q6-2.4 12.5-0.4M67 91.6q7-1.8 13 0.8M48 85.4q5 1.4 9-0.6" fill="none" stroke="#a8742c" strokeWidth={1.4} strokeLinecap="round" opacity={0.85} />
    <ellipse cx={60} cy={88.5} rx={6} ry={7.5} fill="#fff8ec" opacity={0.35} />
    <path d={circ(58, 85.6, 1.6)} fill="#fff" opacity={0.3} />
  </g>
);

/** Metade da frente: borda ondulada com gradiente, palha trançada com brilho e, por cima, fios soltos. */
export function NinhoFrente() {
  return FRENTE_JSX;
}

// 5 elementos (eram 7): borda, claros (fios + palhas + brilho), médios, escuros, fios soltos.
const FRENTE_JSX = (
  <g className="ani-ninho-frente">
    <path d={FRENTE} fill="url(#gi-animais-ninho-borda)" stroke={CONTORNO} strokeWidth={7} paintOrder="stroke" strokeLinejoin="round" className="ani-sil" />
    <path d={CLAROS} fill="none" stroke="#fff0a6" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    <path className="ani-linha" d={FIOS[1]} fill="none" stroke="#d9a23e" strokeWidth={1.6} strokeLinecap="round" />
    <path className="ani-linha" d={FIOS[2]} fill="none" stroke="#b57a2c" strokeWidth={1.6} strokeLinecap="round" />
    <path d={SOLTOS} fill="#ffe58a" stroke="#8a5a20" strokeWidth={1.6} paintOrder="stroke" strokeLinejoin="round" />
  </g>
);

/** Faixa de oclusão onde o corpo encontra a palha (vai logo antes da frente). */
export const OCLUSAO = <ellipse className="ani-oclusao" cx={60} cy={90.4} rx={34} ry={5.2} fill="url(#gi-animais-oclusao)" />;

/**
 * Ovo espiando pela borda quando o ninho está pronto (vai antes da frente). UM elemento (+1 no orçamento do
 * "pronto"): o brilho branco nítido do alto à esquerda vem do próprio gradiente gi-animais-ovo (paradas duras
 * perto do foco), não de uma 2ª elipse.
 */
export function OvoPronto({ cor = 'url(#gi-animais-ovo)' }: { cor?: string }) {
  return (
    <g className="ani-ovo-pronto">
      <ellipse cx={84} cy={85.6} rx={7} ry={8.6} fill={cor} stroke="#8a5a2a" strokeWidth={3.4} paintOrder="stroke" transform="rotate(16 84 85.6)" />
    </g>
  );
}

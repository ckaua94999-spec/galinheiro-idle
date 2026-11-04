// Ganso (épico): doméstico, elegante e esnobe. Segue o KIT da Galinha.tsx (camadas, classes ani-*,
// contorno colorido, volume em 3 tons, rosto de comum.tsx); só o que é do ganso está aqui.
//
// Silhueta: peito VOLUMOSO e redondo sentado no ninho, pescoço longo em "S" que afina da base (16) até a
// garganta (8) — barriga do S para a frente embaixo, nuca curvando para trás em cima — e cabeça pequena
// (olhos ×0,9) por cima do peito, com bico laranja empinado e calombo laranja-queimado de ganso-chinês,
// virado para a esquerda (3/4, como a galinha). Penas brancas com sombra VIOLETA (#b9b4d6): separa o ganso
// da galinha creme mesmo de longe.
// Acessório épico: cachecol roxo de tricô ENROLADO NO PESCOÇO (terço de baixo): rolo da frente com
// nervuras, volta de trás na sombra, nó com broche de estrela dourada que reluz, ponta da frente CURTA
// deitada sobre o peito (acima do relógio do ninho no grid) e ponta de trás caindo sobre o ombro. FX: 2
// brilhos de 4 pontas (miolo branco → pontas roxas num gradiente só) que cintilam (somem no lod-p).
//
// Estrutura (o pescoço leva a cabeça junto):
//   <g.ani-corpo> [pés] <g.ani-cauda/> corpo <g.ani-asa-e/>
//     <g.ani-pescoco> cachecol de trás · pescoço · cachecol da frente · broche
//       <g.ani-cabeca> <g pose> cabeça · emenda · rosto · bico · touca
//   <g.ani-fx> brilhos épicos, "!", Zzz
// O pescoço é GERADO (curva de Bézier com largura variável) a partir da posição da cabeça em cada
// humor: a cabeça cai no triste/aposentado e o pescoço acompanha. A "emenda" (só preenchimento, com o
// MESMO gradiente userSpaceOnUse do pescoço) apaga o contorno da cabeça onde o pescoço entra: cabeça e
// pescoço viram uma peça só (nada de "alfinete").
// O neutro tem olhos próprios (OlhosDesdem: pálpebra a meio mastro + 2 cílios) e sobrancelhas cheias
// afiladas; bochecha e lágrima são de uma peça só (orçamento ≤ 72 elementos com o ninho).
// Animação ociosa própria em estilos/animais-ganso.css (ondular o pescoço, olhar de lado com o bico
// empinado, ajeitar o cachecol; no feliz, grasna esticando o pescoço e batendo o bico).
import type { ReactNode } from 'react';
import { Exclamacao, OPACIDADE_BOCHECHA, Olhos, Piscada, Sobrancelhas, Zzz, bordaTampa, circ, elip, linha, sil, tampa, type CoresRosto, type DefOlho, type Humor, type PropsEspecie } from './comum';

const f1 = (n: number) => Math.round(n * 10) / 10;

const CONTORNO = '#4a4570';
const PENAS = 'url(#gi-animais-ganso-penas)';
const ASA = 'url(#gi-animais-ganso-asa)';
const PESCOCO_COR = 'url(#gi-animais-ganso-pescoco)';
const CEL = '#b9b4d6';
const PENUGEM = '#bdb7da';
const BICO = 'url(#gi-animais-ganso-bico)';
const CALOMBO_COR = 'url(#gi-animais-ganso-calombo)';
const BICO_CONTORNO = '#6a2208';
const BORDA_LUZ = '#bfe6ff';
const LA = 'url(#gi-animais-ganso-cachecol)';
const LA_CONTORNO = '#2a0f5e';
const LA_ESCURA = '#5b2fc9';
const LA_CLARA = '#c9b0ff';
const OURO = 'url(#gi-animais-ganso-estrela)';
const OURO_CONTORNO = '#6a4300';
const BRILHO_FX = 'url(#gi-animais-ganso-brilho)';

// A cabeça é desenhada em coordenadas próprias (centro CX, CY) e posta por cima do peito com (HX, HY).
const CX = 63;
const CY = 24;
const HX = -10;
const HY = -3;

const OLHOS: DefOlho[] = [
  { x: 54.8, y: 21.4, lado: -1, e: 0.9 },
  { x: 72, y: 21.4, lado: 1, e: 0.85 },
];
// Susto: a cabeça pequena não comporta as sobrancelhas bem altas do kit; descem 4 para ficarem coladas no topo.
const OLHOS_SUSTO: DefOlho[] = OLHOS.map((o) => ({ ...o, y: o.y + 4 }));
// Pálpebra = o gradiente das penas em userSpaceOnUse na caixa da cabeça (DefsGanso): casa com a cabeça.
const CORES: CoresRosto = { contorno: CONTORNO, palpebra: 'url(#gi-animais-ganso-palpebra)', sombra: '#9a93c4', iris: 'url(#gi-animais-ganso-iris)', cilio: '#2a2448' };

interface Pose {
  /** Deslocamento da cabeça (o pescoço é refeito até ela). */
  dx: number;
  dy: number;
  /** Giro da cabeça em graus (+ = empina o bico). Pivô na base da cabeça. */
  giro: number;
  /** Abertura do bico em graus (o bico de baixo gira na dobradiça). */
  bico: number;
  /** Giro da asa (+ = abre). */
  asa: number;
  /** Giro da cauda (− = levanta). */
  cauda: number;
  /** transform do corpo inteiro (esticar no susto, afundar no aposentado). */
  corpo?: string;
}

const POSES: Record<Humor, Pose> = {
  feliz: { dx: 1, dy: -1.5, giro: 7, bico: 26, asa: 8, cauda: -8 },
  // Esnobe: pescoço esticado e bico empinado ("nariz em pé").
  neutro: { dx: 0, dy: -1, giro: 7, bico: 0, asa: 0, cauda: 0 },
  cansado: { dx: -2.5, dy: 5, giro: -5, bico: 7, asa: -3, cauda: 6 },
  triste: { dx: -4.5, dy: 7.5, giro: -10, bico: 0, asa: -5, cauda: 10 },
  surpresa: { dx: 1.5, dy: -3, giro: 2, bico: 34, asa: 16, cauda: -12, corpo: 'translate(60 104) scale(.97 1.05) translate(-60 -104)' },
  aposentado: { dx: -4, dy: 9, giro: -12, bico: 0, asa: -3, cauda: 8, corpo: 'translate(0 2.5)' },
};

// ----------------------------------------------------------------------------------- pescoço em S

type P = [number, number];

// Base do pescoço (escondida no cachecol) e o "puxão" para a frente que desenha a barriga do S.
const BASE: P = [50, 69];
const PUXA: P = [29, 56];

function bez(a: P, b: P, c: P, d: P, t: number): P {
  const u = 1 - t;
  const [k0, k1, k2, k3] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
  return [k0 * a[0] + k1 * b[0] + k2 * c[0] + k3 * d[0], k0 * a[1] + k1 * b[1] + k2 * c[1] + k3 * d[1]];
}
function bezD(a: P, b: P, c: P, d: P, t: number): P {
  const u = 1 - t;
  const [k0, k1, k2] = [3 * u * u, 6 * u * t, 3 * t * t] as const;
  return [k0 * (b[0] - a[0]) + k1 * (c[0] - b[0]) + k2 * (d[0] - c[0]), k0 * (b[1] - a[1]) + k1 * (c[1] - b[1]) + k2 * (d[1] - c[1])];
}

// Curva suave (Catmull-Rom → cúbicas) por uma lista de pontos; `cmd` = "M" (abre) ou "L" (emenda).
function suave(pts: P[], cmd: 'M' | 'L'): string {
  const em = (i: number): P => pts[Math.min(pts.length - 1, Math.max(0, i))] ?? [0, 0];
  const [x0, y0] = em(0);
  let d = `${cmd}${f1(x0)} ${f1(y0)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [em(i - 1), em(i), em(i + 1), em(i + 2)];
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d;
}

type Lado = number | ((t: number) => number);
/** Faixa de largura variável ao longo de uma curva: `ponto(t)` dá centro e tangente, `meia(t)` a meia largura.
 *  a..b = de que lado a que lado (−1 = esquerda da direção, +1 = direita; número ou função de t), t0..t1 = trecho. */
function faixa(ponto: (t: number) => [P, P], meia: (t: number) => number, a0: Lado, b0: Lado, t0 = 0, t1 = 1, n = 10): string {
  const lado1: P[] = [];
  const lado2: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const [[x, y], [tx, ty]] = ponto(t);
    const l = Math.hypot(tx, ty) || 1;
    const [nx, ny] = [-ty / l, tx / l];
    const m = meia(t);
    const [a, b] = [typeof a0 === 'number' ? a0 : a0(t), typeof b0 === 'number' ? b0 : b0(t)];
    lado1.push([x + nx * m * a, y + ny * m * a]);
    lado2.push([x + nx * m * b, y + ny * m * b]);
  }
  lado2.reverse();
  return `${suave(lado1, 'M')}${suave(lado2, 'L')}Z`;
}

interface Pescoco {
  forma: string;
  /** Ponta do pescoço só com preenchimento: vai por cima do contorno da cabeça e funde as duas peças. */
  emenda: string;
  /** Sombra cel da emenda (a mesma faixa da sombra do pescoço, continuando por cima dela). */
  emendaCel: string;
  cel: string;
  luz: string;
}

// Largura do pescoço ao longo da curva [t, largura]: LARGO na base (sai do peito como um funil, escondido no
// cachecol até t≈0,3), afina bem até a garganta logo abaixo da cabeça (t≈0,8) e abre de novo DENTRO da
// cabeça (a emenda mostra essa abertura: a garganta "funde" na cabeça em vez de espetar nela). O trecho
// visível vai de ~13,4 a ~8 (×1,65): S elegante, não um tubo de largura uniforme.
const LARGURAS: P[] = [
  [0, 16],
  [0.3, 13.4],
  [0.56, 10.2],
  [0.8, 8.6],
  [0.9, 9.6],
  [1, 11],
];
function largura(t: number): number {
  for (let i = 1; i < LARGURAS.length; i++) {
    const [t1, l1] = LARGURAS[i] ?? [1, 9];
    const [t0, l0] = LARGURAS[i - 1] ?? [0, 16];
    if (t <= t1) return l0 + ((l1 - l0) * (t - t0)) / (t1 - t0);
  }
  return 11;
}

/** Afinamento da emenda: 45% da largura em t = 0,72 → inteira a partir de t = 0,84. */
const afina = (t: number) => 0.45 + 0.55 * Math.min(1, Math.max(0, (t - 0.72) / 0.12));

/** Pescoço da base até `topo` (dentro da cabeça), afinando 16 → 8 (ver LARGURAS). Lado de +n = direita (sombra). */
function pescoco(topo: P): Pescoco {
  // c2 atrás e abaixo do topo: a nuca curva para trás antes de entrar na cabeça (o "S").
  const c2: P = [topo[0] + 18, topo[1] + 14];
  const ponto = (t: number): [P, P] => [bez(BASE, PUXA, c2, topo, t), bezD(BASE, PUXA, c2, topo, t)];
  const meia = (t: number) => largura(t) / 2;
  // Brilho (lado esquerdo, iluminado): uma linha a 55% da meia largura.
  const luz: P[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = 0.3 + (0.38 * i) / 6;
    const [[x, y], [tx, ty]] = ponto(t);
    const l = Math.hypot(tx, ty) || 1;
    luz.push([x + (ty / l) * meia(t) * 0.55, y - (tx / l) * meia(t) * 0.55]);
  }
  return {
    forma: faixa(ponto, meia, -1, 1, 0, 1, 14),
    // A emenda afina na ponta de baixo (que fica abaixo do contorno da cabeça): quando a cabeça gira
    // (bicar o cachecol), essa ponta balança DENTRO do pescoço em vez de espetar uma "aba" para fora.
    emenda: faixa(ponto, meia, (t) => -0.94 * afina(t), (t) => 0.94 * afina(t), 0.72, 1, 8),
    emendaCel: faixa(ponto, meia, (t) => Math.min(0.4, 0.94 * afina(t)), (t) => 0.94 * afina(t), 0.72, 1, 8),
    cel: faixa(ponto, meia, 0.4, 1, 0.22, 1, 12),
    luz: suave(luz, 'M'),
  };
}

/** Topo do pescoço (em coordenadas do desenho) para a pose do humor. */
const topoDe = (p: Pose): P => [CX - 1 + HX + p.dx, CY + 11 + HY + p.dy];

const PESCOCOS: Record<Humor, Pescoco> = Object.fromEntries((Object.keys(POSES) as Humor[]).map((h) => [h, pescoco(topoDe(POSES[h]))])) as Record<Humor, Pescoco>;

// Pivô da pose da cabeça (base da cabeça), em coordenadas da cabeça.
const PIVO: P = [CX, CY + 14];
/** Leva um path do desenho para as coordenadas da cabeça no humor (desfaz o translate e o giro da pose). */
function naCabeca(d: string, p: Pose): string {
  const [hx, hy] = [p.dx + HX, p.dy + HY];
  const solto = d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, xs: string, ys: string) => `${f1(Number(xs) - hx)} ${f1(Number(ys) - hy)}`);
  return p.giro ? rodar(solto, -p.giro, PIVO) : solto;
}
// Sombra da emenda já nas coordenadas da cabeça: junta-se à sombra cel da cabeça num <path> só. (A base da
// emenda fica no espaço do pescoço, com `desfaz`, para o gradiente userSpaceOnUse casar com o do pescoço.)
const EMENDAS_CEL: Record<Humor, string> = Object.fromEntries((Object.keys(POSES) as Humor[]).map((h) => [h, naCabeca(PESCOCOS[h].emendaCel, POSES[h])])) as Record<Humor, string>;

// ----------------------------------------------------------------------------------------- formas

// Corpo sentado: peito VOLUMOSO e redondo à frente (sai do cachecol e estufa até a borda do ninho),
// dorso subindo para a cauda à direita.
const CORPO = 'M24.6 82C24 71.6 29.6 63.4 39 60.6C48 58 62.6 60.6 72.4 61.8C84.4 63 93.4 66.6 97.6 73.2C101.6 79.8 100 92.2 91 99.4C81 106.6 42 107 31 100C26.6 96.6 24.8 89.4 24.6 82Z';
// Sombra cel do corpo (embaixo à direita) + a sombra que a asa projeta no flanco (mesma cor: um <path>).
const CORPO_CEL =
  'M97.8 73.8C101.6 82.6 98 94.8 89.6 100.2C79 106.6 47 106.6 36 100.8C52 103.4 76 101 86.4 93C92.8 87.6 96.8 80.8 97.8 73.8Z' +
  'M57.4 78.4C61.6 85.6 69.4 89.4 78 89.6C86 89.8 93.4 88.2 97.8 85.6C95.4 90.6 87.8 92.8 78.8 92.8C69.4 92.8 61 87.6 57.4 78.4Z';
// Penugem do peito e do flanco (escamas; as de baixo só aparecem sem ninho).
const PEITO = 'M30.2 77.4q2.6 2.4 5.2 0M50.6 78.4q2.6 2.4 5.2 0M28.4 85q2.6 2.4 5.2 0q2.6 2.4 5.2 0M45.4 84.6q2.6 2.4 5.2 0q2.6 2.4 5.2 0M55.4 89.4q2.4 2.2 4.8 0q2.4 2.2 4.8 0M84.4 93.4q2.2 2 4.4 0M36.4 91.4q2.4 2.2 4.8 0';
// Luz do peito: arco branco à esquerda, logo abaixo do rolo do cachecol (o volume entre o cachecol e o ninho).
const PEITO_LUZ = 'M31.6 66.2Q27.2 71.6 27.6 79.4';

// Cauda: UM tufo curto e empinado (3 penas bem sobrepostas num <path> só → uma ponta com 2 entalhes).
type Pena = [number, number, number, number, number, number, number];
const PENAS_CAUDA: Pena[] = [
  [88.6, 70, 97, 60.4, 106, 56, 7],
  [89.6, 72.6, 99, 65.4, 108, 61, 6.4],
  [90.6, 75.4, 99.6, 70.6, 107, 66, 5.6],
];
function pena([bx, by, cx, cy, tx, ty, w]: Pena): string {
  const dx = tx - bx;
  const dy = ty - by;
  const l = Math.hypot(dx, dy);
  const nx = (-dy / l) * w;
  const ny = (dx / l) * w;
  return `M${bx} ${by}Q${f1(cx + nx)} ${f1(cy + ny)} ${tx} ${ty}Q${f1(cx - nx)} ${f1(cy - ny)} ${bx} ${by}Z`;
}
const CAUDA = PENAS_CAUDA.map(pena).join('');
// Divisão entre as penas (só os entalhes de dentro) — mesma cor e traço da penugem.
const CAUDA_LINHAS = 'M95.6 66.4Q101 62.2 106.4 60.6M96.6 70.6Q101.4 67.6 105.8 65.8';

// Asa dobrada no flanco: do ombro (atrás do cachecol) até a ponta, perto da cauda; 3 rêmiges recortadas.
const ASA_REMIGES =
  'M58.4 67C68.4 61.6 85 62.8 94.4 70.8C99.4 75 101 81.2 98.6 84.6C96.8 87 93.2 86.6 92 84.6C90.4 87.6 86 88.4 83.8 86C81.6 88.4 76.6 88.6 74.4 86C66 85.8 58.4 81 56 75.4C54.8 72 55.8 68.6 58.4 67Z';
const ASA_COBERTEIRAS = 'M58.4 67C66.6 62.6 79.6 63 86.4 68.6C88.4 71.6 86 74.4 83 73.6C81.4 76.6 77 77.2 75 74.8C72 77 66 76.6 63.6 74C59.4 73.6 55.2 70.2 58.4 67Z';
const ASA_LINHAS = 'M74.4 86C74.2 82 72.8 79 70.4 76.6M83.8 86C83.4 82.2 81.8 79 79.4 76.6M92 84.6C91.6 81.2 90 78.4 87.8 76.4';

// Cabeça: oval pequena, um pouco mais cheia atrás (bochecha) e com a testa descendo para o calombo.
const CABECA = 'M63.4 7C73.6 7 81 14.4 81 24.2C81 33.8 74 41 64.2 41.2C55 41.4 46.2 35.6 45.6 25.4C45 14.6 53.2 7 63.4 7Z';
/** Caixa da CABECA [x, y, largura, altura] (coordenadas da cabeça). Fonte única do gradientTransform da
 *  pálpebra (DefsGanso): mudou a CABECA? Mude a caixa junto, ou a pálpebra volta a ser um oval sobre a cabeça. */
export const CAIXA_CABECA = [45.57, 7, 35.43, 34.21] as const;
const CABECA_CEL = 'M80.6 26.6C79.4 34.8 73 40.8 64.2 41C58.6 41.2 53.4 39.4 50 36.4C55.4 38.4 61.4 38.8 66.6 37.6C73.6 36 78.6 31.8 80.6 26.6Z';

// Bico de ganso-chinês, em 3/4 para a esquerda: calombo redondo (tom próprio, mais escuro) na base +
// bico de cima comprido e rombudo + bico de baixo. A dobradiça (canto da boca) fica atrás, perto da
// bochecha direita. O bico inteiro é desenhado reto e girado BICO_GIRO graus (empinado, "nariz em pé").
const CALOMBO = 'M57 33.2C54.8 26.6 58.6 21.4 64 21.4C69.4 21.4 72.8 26.6 70.6 33.2Z';
const BICO_GIRO = 12;
// Empinado BICO_GIRO graus, 12% mais comprido e 2,5 para a frente: a ponta sai da cabeça (silhueta de ganso).
const BICO_POSE = `translate(-2.5 0) rotate(${BICO_GIRO} 68.4 35.8) translate(68.4 35.8) scale(1.12 1) translate(-68.4 -35.8)`;
const BICO_CIMA = 'M59.4 31.6C63.6 30.6 68.4 31.4 70.2 33.8C69.4 35.8 65.4 37 59.4 37.8C55 38.4 50.2 39.2 47.2 39.2C45.4 39.2 44.8 37.8 46 36.8C49.6 34.6 54.8 32.6 59.4 31.6Z';
const BICO_REALCE = 'M48.6 36.4Q54 33.4 61.4 32.4Q55 34.4 50.2 37.2Z';
const BICO_BAIXO = 'M48 39.2C53.4 39 62.4 37.8 68.4 35.6C67.8 38.4 63.6 40.8 57.6 41.4C53.2 41.8 49.2 41.2 48 39.2Z';
const DOBRA: P = [68.4, 35.8];
// Borda de cima do bico de baixo, da ponta para trás (a mesma curva do BICO_BAIXO).
const BAIXO_TOPO: [P, P, P, P] = [
  [48, 39.2],
  [53.4, 39],
  [62.4, 37.8],
  [68.4, 35.6],
];

function gira([x, y]: P, graus: number): P {
  const a = (graus * Math.PI) / 180;
  const dx = x - DOBRA[0];
  const dy = y - DOBRA[1];
  return [f1(DOBRA[0] + dx * Math.cos(a) - dy * Math.sin(a)), f1(DOBRA[1] + dx * Math.sin(a) + dy * Math.cos(a))];
}

// Traços de susto: 3 riscos curtos irradiando do lado esquerdo da cabeça (o "!" fica à direita).
const TRACOS_SUSTO = [150, 174, 198]
  .map((g) => {
    const a = (g * Math.PI) / 180;
    const [c, s] = [Math.cos(a), -Math.sin(a)];
    const [x, y] = [CX + HX + POSES.surpresa.dx, CY + HY + POSES.surpresa.dy];
    return `M${f1(x + 22 * c)} ${f1(y + 22 * s)}L${f1(x + 27.5 * c)} ${f1(y + 27.5 * s)}`;
  })
  .join('');

// ---------------------------------------------------------------------------------------- cachecol
// Enrolado no terço de baixo do pescoço (o pescoço tem ~14 de largura ali, x 39–53).

// Volta de trás (na sombra): só aparece dos lados do pescoço, acima do rolo da frente.
const LA_TRAS = 'M36.4 58C39.4 52.4 52.4 50.8 57.4 55C58.4 56.4 57.6 58 56.2 58C51 54.6 42.4 55 38.4 59.4C37.2 59.8 36 59.2 36.4 58Z';
// Volta da frente: rolo gordo que abraça o pescoço (o meio cai um pouco, como pano pesado).
const LA_VOLTA = 'M36 57.2C40.4 60.8 51.4 61 56.4 55.4C59 56.2 60.2 59.6 58.4 62.4C53.2 68.8 40.4 69.2 35 63.8C33.2 61.8 33.8 58.4 36 57.2Z';
// Nó: um gomo de lã embaixo do broche, à esquerda do rolo.
const LA_NO = 'M36.2 64C36 60.8 38.8 59 41.6 59.2C44.8 59.4 46.6 61.6 46.2 64.6C45.8 67.6 43 69 40.2 68.4C37.8 67.8 36.4 66.2 36.2 64Z';
/** Gira um path só de comandos absolutos com pares x y (M, L, Q, C, Z) em volta de `c`. */
function rodar(d: string, graus: number, [cx, cy]: P): string {
  const a = (graus * Math.PI) / 180;
  const [co, se] = [Math.cos(a), Math.sin(a)];
  return d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, xs: string, ys: string) => {
    const [dx, dy] = [Number(xs) - cx, Number(ys) - cy];
    return `${f1(cx + dx * co - dy * se)} ${f1(cy + dx * se + dy * co)}`;
  });
}
// Ponta da frente: CURTA (termina em y≈76, acima do relógio do ninho no grid) e deitada 13° para trás,
// encostada no peito. Desenhada pendendo reta do nó e girada no nó.
const NO_CAI: P = [41.4, 65];
const GIRO_CAI = -13;
const LA_CAI = rodar('M37.8 65.4C40 66.4 42.6 66.4 44.8 65.6C44.6 67.6 44.6 69.4 45.2 71C45.6 72 46.2 72.8 46.8 73.6C43.2 74.6 39.2 74.6 35.6 73.4C36.4 72.4 36.8 71.4 37.2 70.4C37.6 68.8 37.6 67 37.8 65.4Z', GIRO_CAI, NO_CAI);

// Ponta de trás: sai de trás do pescoço e cai por cima do ombro, acompanhando a curva do dorso (pano
// pesado, com uma ondinha), e pende no flanco com franja.
const ONDA: P[] = [
  [53.4, 57.2],
  [59.4, 57.4],
  [64.4, 60.4],
  [67, 65.6],
  [68.2, 71.8],
];
/** Ponto e tangente da onda (Catmull-Rom uniforme pelos pontos de ONDA), t de 0 a 1. */
function pontoOnda(t: number): [P, P] {
  const n = ONDA.length - 1;
  const s = Math.min(n - 1e-6, Math.max(0, t * n));
  const i = Math.floor(s);
  const u = s - i;
  const em = (k: number): P => ONDA[Math.min(n, Math.max(0, k))] ?? [0, 0];
  const [p0, p1, p2, p3] = [em(i - 1), em(i), em(i + 1), em(i + 2)];
  const cr = (a: number, b: number, c: number, d: number): [number, number] => [
    0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u),
    0.5 * (c - a + 2 * (2 * a - 5 * b + 4 * c - d) * u + 3 * (3 * b - a - 3 * c + d) * u * u),
  ];
  const [x, dx] = cr(p0[0], p1[0], p2[0], p3[0]);
  const [y, dy] = cr(p0[1], p1[1], p2[1], p3[1]);
  return [
    [x, y],
    [dx, dy],
  ];
}
const meiaOnda = (t: number) => 3 + 0.7 * t;
const LA_PONTA = faixa(pontoOnda, meiaOnda, -1, 1, 0, 1, 16);
// Dobra escura: o lado de dentro da ponta de trás, onde o pano faz a curva sobre o ombro.
const LA_DOBRAS = LA_TRAS + faixa(pontoOnda, meiaOnda, 0.25, 1, 0.3, 1, 8);

/** Risco atravessando a ponta de trás em t (listra do tricô). */
function travessa(t: number, k = 0.85): string {
  const [[x, y], [tx, ty]] = pontoOnda(t);
  const l = Math.hypot(tx, ty) || 1;
  const m = meiaOnda(t) * k;
  return `M${f1(x - (ty / l) * m)} ${f1(y + (tx / l) * m)}L${f1(x + (ty / l) * m)} ${f1(y - (tx / l) * m)}`;
}
/** Franja da ponta de trás: só 2 fiapos curtos e retos (com 3+ fiapos longos a ponta virava "mãozinha"). */
function franjaOnda(): string {
  const [[x, y], [tx, ty]] = pontoOnda(1);
  const l = Math.hypot(tx, ty) || 1;
  const [ux, uy] = [tx / l, ty / l];
  return [-0.45, 0.45]
    .map((k) => {
      const [bx, by] = [x - uy * meiaOnda(1) * k, y + ux * meiaOnda(1) * k];
      return `M${f1(bx)} ${f1(by)}l${f1(ux * 2.4)} ${f1(uy * 2.4)}`;
    })
    .join('');
}

// Nervuras do tricô no rolo + franjas (cor do contorno da lã, um <path>).
const LA_NERVURAS = 'M47.4 61.6q-.2 2.8.2 5.2M51.8 60.6q.2 2.8.6 5M55.6 58.6q.4 2.4 1 4.4';
const LA_FRANJA = rodar('M37 74L36.6 76.6M40.2 74.4L40.1 77M43.4 74.4L43.6 77M46 73.9L46.5 76.4', GIRO_CAI, NO_CAI) + franjaOnda();
// Listras lilás nas pontas (a da frente no meio da ponta) + brilho da lã no alto do rolo (luz de cima).
const LA_LISTRAS = `${rodar('M37.2 70.2Q41.2 71.2 45.2 70.2', GIRO_CAI, NO_CAI)}${travessa(0.74)}${travessa(0.86)}`;
const LA_BRILHO = 'M38.4 60.4Q47 63.2 55.4 58.8';

// Broche: estrela de 5 pontas no nó da frente.
function estrela(cx: number, cy: number, r: number, ri: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = ((-90 + i * 36) * Math.PI) / 180;
    const rr = i % 2 ? ri : r;
    d += `${i ? 'L' : 'M'}${f1(cx + rr * Math.cos(a))} ${f1(cy + rr * Math.sin(a))}`;
  }
  return `${d}Z`;
}
const BROCHE = estrela(41.2, 63.6, 5.4, 2.5);

// Brilho de 4 pontas (fx épico e reflexo do broche): cintura FINA, pontas longas; `ry` = raio vertical
// (o raio de cima/baixo mais comprido dá a cara clássica de "cintilar").
function brilho(cx: number, cy: number, r: number, ry = r): string {
  const k = r * 0.12;
  return `M${cx} ${f1(cy - ry)}Q${f1(cx + k)} ${f1(cy - k)} ${f1(cx + r)} ${cy}Q${f1(cx + k)} ${f1(cy + k)} ${cx} ${f1(cy + ry)}Q${f1(cx - k)} ${f1(cy + k)} ${f1(cx - r)} ${cy}Q${f1(cx - k)} ${f1(cy - k)} ${cx} ${f1(cy - ry)}Z`;
}
// Os 2 brilhos épicos: [x, y, raio]. Um acima do dorso (à direita da cabeça), outro diante do peito.
// Cada um é UM path com gradiente (miolo branco → pontas roxas); raio vertical = 1,35 × horizontal.
const BRILHOS: [number, number, number][] = [
  [92, 35, 8.5],
  [18.5, 47, 7.5],
];

// Touca de dormir (mesma da galinha, reposicionada na cabeça menor).
const TOUCA_CONE = 'M39 36.4C38.6 21 52 11.6 66.8 12.2C80 12.8 92.4 21 96.6 33.6C92.2 30.4 86.6 29.6 81.6 30.6C80.4 32.6 79.6 34.6 78.6 36.4C66 30.2 51.4 30.2 39 36.4Z';
const TOUCA_LISTRAS = 'M51.4 16.6Q59.4 23.4 62.6 32M71.6 14.4Q76.6 21.6 77.4 31';
const TOUCA_ABA = 'M36.6 38C40.4 29 75.6 28.6 80.2 37.6C81 40.2 78.8 41.6 76.6 40.6C70.4 35.2 46.6 35.2 40.6 41C38.4 42 36 40.4 36.6 38Z';

// Pés de pato (sem ninho): canela curta + "remo" de 3 dedos com membrana, os dois num <path> só.
function pe(x: number): string {
  const p = (dx: number, y: number) => `${f1(x + dx)} ${y}`;
  return (
    `M${p(-1.5, 100)}V107.4L${p(-6.8, 111.6)}Q${p(-7.6, 114.2)} ${p(-4.8, 113.8)}Q${p(-3.4, 113.2)} ${p(-2.4, 112.6)}` +
    `Q${p(-1, 115.2)} ${p(1, 113.6)}Q${p(2.4, 115.2)} ${p(3.6, 113.2)}Q${p(7.4, 114.6)} ${p(7.4, 111.6)}L${p(1.5, 107.4)}V100Z`
  );
}
const PES = pe(46) + pe(70);

// ------------------------------------------------------------------------------------------ peças

function Bico({ humor, abre }: { humor: Humor; abre: number }) {
  // Mesma dobradiça da galinha: o bico de cima fica fixo e o de baixo GIRA. Aqui a boca escura fica
  // ATRÁS do bico de baixo: ele só fecha por cima dela, então o "grasnar" do feliz nunca abre fresta.
  // O bico aponta para a esquerda, então abrir = girar no sentido anti-horário.
  const g = -abre;
  // Triste: o bico de cima pende um pouco (cantos para baixo).
  const cai = humor === 'triste' ? 'rotate(-4 66 36)' : undefined;
  const [j0, j1, j2, j3] = [gira(BAIXO_TOPO[0], g), gira(BAIXO_TOPO[1], g), gira(BAIXO_TOPO[2], g), gira(BAIXO_TOPO[3], g)];
  const boca = `M68.6 35.6C64.6 36.8 59.4 37.6 54.6 38.4C51.4 38.9 48.4 39.3 47 39.2L${j0[0]} ${j0[1]}C${j1[0]} ${j1[1]} ${j2[0]} ${j2[1]} ${j3[0]} ${j3[1]}Z`;
  const [ax, ay] = gira([51.4, 39.2], g);
  const [bx, by] = gira([60.4, 38.4], g);
  const silBico = sil(BICO_CONTORNO, 1.6);
  const lingua = `M${ax} ${ay}Q${f1((ax + bx) / 2)} ${f1((ay + by) / 2 - 4)} ${bx} ${by}Q${f1((ax + bx) / 2)} ${f1((ay + by) / 2 + 1.2)} ${ax} ${ay}Z`;
  return (
    <g className="ani-bico" transform={BICO_POSE}>
      {abre > 0 && (
        <>
          <path d={boca} fill="#7a1e2c" stroke={BICO_CONTORNO} strokeWidth={1.1} strokeLinejoin="round" />
          {humor !== 'surpresa' && abre > 15 && <path d={lingua} fill="#ff6f7d" />}
        </>
      )}
      <path
        d={BICO_BAIXO}
        // No feliz o CSS põe o transform-origin na dobradiça, e ele vale também para o atributo: o giro vai sem centro.
        transform={abre > 0 ? (humor === 'feliz' ? `rotate(${g})` : `rotate(${g} ${DOBRA[0]} ${DOBRA[1]})`) : undefined}
        fill={BICO}
        {...silBico}
        className={humor === 'feliz' ? `${silBico.className} gan-mandibula` : silBico.className}
      />
      <path d={BICO_CIMA} transform={cai} fill={BICO} {...sil(BICO_CONTORNO, 1.6)} />
      <path d={BICO_REALCE} transform={cai} fill="#fff" opacity={0.6} />
    </g>
  );
}

/**
 * Olhos do neutro, próprios do ganso: o olhar superior do esnobe. Mesmas medidas e materiais do kit
 * (comum.tsx, neutro), mas com pálpebra pesada "a meio mastro" (cobre ~20%: a borda encosta no alto da íris,
 * olhar de pouco caso — e abre espaço para as sobrancelhas na cabeça pequena) cuja borda é o ÚNICO delineado, e
 * 2 cílios curvos no canto de fora (o kit somaria o delineado dele a esta borda: riscos demais). Borda e
 * cílios levam .ani-cilios (somem na piscada, como o delineado do kit).
 */
function OlhosDesdem() {
  const [ox, oy] = [-0.9, 0];
  let esclera = '';
  let iris = '';
  let pupila = '';
  let b1 = '';
  let b2 = '';
  let tampas = '';
  let borda = '';
  let cilios = '';
  for (const { x, y, lado, e = 1 } of OLHOS) {
    const [rx, ry] = [7.4 * e, 9 * e];
    esclera += elip(x, y, rx, ry);
    const [ix, iy] = [x + ox * e, y + (0.5 + oy) * e];
    iris += circ(ix, iy, 5.9 * e);
    pupila += circ(ix, iy, 3.5 * e);
    b1 += circ(x + (ox * 0.4 - 1.7) * e, y - 1.6 * e, 2 * e);
    b2 += circ(x + 1.9 * e, y + 2.3 * e, e);
    // Corte da pálpebra: um pouco mais baixo no canto de fora (pálpebra pesada).
    const corte = y - ry * 0.6;
    const fora = corte + 0.8 * e;
    const [yE, yD] = lado < 0 ? [fora, corte] : [corte, fora];
    tampas += tampa(x, y, rx, ry, yE, yD, 0.6, 'cima');
    borda += bordaTampa(x, y, rx, ry, yE, yD, 0.6, lado, e, 0.01);
    // Canto de fora da borda e 2 cílios curvos saindo dele, para fora e para cima.
    const fx = x + lado * rx * Math.sqrt(1 - ((fora - y) / ry) ** 2);
    const l = lado * e;
    cilios +=
      `M${f1(fx - l * 0.6)} ${f1(fora)}Q${f1(fx + l * 2.2)} ${f1(fora - 0.1 * e)} ${f1(fx + l * 3.6)} ${f1(fora - 2.6 * e)}` +
      `M${f1(fx - l * 2.6)} ${f1(fora - 0.6 * e)}Q${f1(fx + l * 0.2)} ${f1(fora - 1.6 * e)} ${f1(fx + l * 1.2)} ${f1(fora - 4.6 * e)}`;
  }
  return (
    <g className="ani-olhos">
      <path d={esclera} fill="url(#gi-animais-olho-esclera)" />
      <path d={iris} fill={CORES.iris} />
      <path className="ani-pupila" d={pupila} fill="#1e1426" stroke="#1e1426" strokeWidth={0} />
      <path d={b1} fill="#fff" />
      <path className="ani-brilho2" d={b2} fill="#fff" fillOpacity={0.85} />
      <path d={tampas} fill={CORES.palpebra} />
      {/* Borda e cílios com a classe do kit (.ani-cilios, sem <g> a mais: orçamento): somem enquanto a
          pálpebra de piscar desce, como o delineado de <Olhos/> — sem "tocos" por cima dela. */}
      <path className="ani-cilios" d={borda} fill="none" stroke={CORES.cilio} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <path className="ani-cilios" d={cilios} fill="none" stroke={CORES.cilio} strokeWidth={1.8} strokeLinecap="round" />
    </g>
  );
}

/** Sobrancelhas do neutro: a de dentro reta e baixa, a de fora ARQUEADA e mais alta (desdém). Cada uma é
 *  uma forma CHEIA afilada (grossa no meio, pontas finas), não um traço de largura constante.
 *  A cabeça é pequena e os olhos quase encostam no contorno: as sobrancelhas ficam BAIXAS (sobre a pálpebra
 *  pesada) e curtas, com ≥ 1,5 de penas brancas entre elas e o contorno da cabeça — mais altas, encostavam
 *  nele e viravam manchas coladas na borda. A de fora sobe pelo ARCO (meio), não pelas pontas: a ponta de
 *  fora acompanha a cabeça, que já está descendo ali. */
function SobrancelhasDesdem() {
  // Base: y − ry·e − sobe; meia largura meia·e. [dentro, fora, arco, sobe, meia] por olho.
  const formas: [number, number, number, number, number][] = [
    [0.8, 1, -0.6, 0, 4],
    [0.6, 1.2, -2.6, 0.4, 4],
  ];
  const d = OLHOS.map(({ x, y, lado, e = 1 }, i) => {
    const [dentro, fora, arco, sobe, m] = formas[i] ?? [0, 0, 0, 0, 4];
    const base = y - 9 * e - sobe;
    const meia = m * e;
    const [xd, xf] = [x - lado * meia, x + lado * meia];
    const [yd, yf] = [base + dentro, base + fora];
    const meio = (yd + yf) / 2 + arco;
    // Controle de cima 2,4 acima e o de baixo 2,4 abaixo: ~2,4 de espessura no meio (+ o traço de 1).
    return `M${f1(xf)} ${f1(yf)}Q${f1(x)} ${f1(meio - 2.4)} ${f1(xd)} ${f1(yd)}Q${f1(x)} ${f1(meio + 2.4)} ${f1(xf)} ${f1(yf)}Z`;
  }).join('');
  return (
    <g className="ani-sobrancelhas">
      <path d={d} fill={CONTORNO} stroke={CONTORNO} strokeWidth={1} strokeLinejoin="round" opacity={0.92} />
    </g>
  );
}

/** Bochecha: só a do lado de fora (a de dentro ficava atrás do bico), inteira DENTRO do contorno da cabeça. */
function Bochecha({ humor }: { humor: Humor }) {
  const feliz = humor === 'feliz';
  return (
    <ellipse className="ani-bochechas" cx={74.4} cy={30.8} rx={feliz ? 5.2 : 4.6} ry={feliz ? 3.4 : 3} fill="url(#gi-animais-bochecha)" opacity={OPACIDADE_BOCHECHA[humor]} />
  );
}

/** Lágrima do triste numa peça só: o reflexo vem do gradiente (some no lod-p, como a do kit). */
function Lagrima({ x, y, e }: { x: number; y: number; e: number }) {
  const d = `M${f1(x)} ${f1(y)}C${f1(x - 1.2 * e)} ${f1(y + 3 * e)} ${f1(x - 3 * e)} ${f1(y + 5 * e)} ${f1(x - 3 * e)} ${f1(y + 7 * e)}a${f1(3 * e)} ${f1(3 * e)} 0 0 0 ${f1(6 * e)} 0C${f1(x + 3 * e)} ${f1(y + 5 * e)} ${f1(x + 1.2 * e)} ${f1(y + 3 * e)} ${f1(x)} ${f1(y)}Z`;
  return <path className="ani-lagrima" d={d} fill="url(#gi-animais-ganso-lagrima)" stroke="#2b6cb0" strokeWidth={1.3} strokeLinejoin="round" />;
}

function Touca() {
  return (
    <g className="ani-acessorio" transform={`translate(${CX} ${CY - 6.5}) scale(.78) translate(-58 -44.6)`}>
      <path d={TOUCA_CONE} fill="url(#gi-animais-touca)" {...sil('#1f3a66', 3)} />
      <path className="ani-linha" d={TOUCA_LISTRAS} fill="none" stroke="#c4dbf7" strokeWidth={2.4} strokeLinecap="round" opacity={0.75} />
      <path d={TOUCA_ABA} fill="#f4f7fb" {...sil('#1f3a66', 1.8)} />
      <circle cx={97} cy={36.2} r={4.8} fill="#ffffff" {...sil('#1f3a66', 1.8)} />
      <circle cx={95.4} cy={34.6} r={1.6} fill="#dfe9f7" />
    </g>
  );
}

/** Pose fixa do humor num <g transform> interno (só quando há pose: menos elementos no grid). */
function Pose({ t, children }: { t?: string; children: ReactNode }) {
  return t ? <g transform={t}>{children}</g> : <>{children}</>;
}

/** Ganso sentado (ou de pé, sem ninho) no humor pedido. */
export function Ganso({ humor, ninho = true }: PropsEspecie) {
  const p = POSES[humor];
  const pes = PESCOCOS[humor];
  // A base da emenda é calculada nas coordenadas do pescoço: desfaz a pose da cabeça para ela cair no lugar.
  const desfaz = `${p.giro ? `rotate(${-p.giro} ${PIVO[0]} ${PIVO[1]}) ` : ''}translate(${-p.dx - HX} ${-p.dy - HY})`;
  const [hx, hy] = [p.dx + HX, p.dy + HY];
  const poseCauda = p.cauda ? `rotate(${p.cauda} 90 72)` : undefined;
  const poseAsa = p.asa ? `rotate(${-p.asa} 58 68)` : undefined;
  return (
    <>
      <g className="ani-corpo">
        <Pose t={p.corpo}>
          {!ninho && <path d={PES} fill={BICO} {...sil(BICO_CONTORNO, 1.6)} />}

          {/* cauda e asa: a pose do humor vai no atributo de cada peça (sem <g> extra) */}
          <g className="ani-cauda">
            <path d={CAUDA} transform={poseCauda} fill={ASA} {...sil(CONTORNO, 3)} />
            <path className="ani-linha" d={CAUDA_LINHAS} transform={poseCauda} {...linha(PENUGEM, 1.3, 0.8)} />
          </g>

          <path d={CORPO} fill={PENAS} {...sil(CONTORNO)} />
          <path d={CORPO_CEL} fill={CEL} opacity={0.55} />
          <path className="ani-borda-luz" d="M98.8 78.6Q99.6 85.4 96.8 91.4" {...linha(BORDA_LUZ, 1.6, 1)} opacity={0.5} />
          <path className="ani-linha" d={PEITO} {...linha(PENUGEM, 1.3, 0.8)} />
          <path className="ani-linha" d={PEITO_LUZ} {...linha('#ffffff', 1.6, 1)} />

          <g className="ani-asa-e">
            <path d={ASA_REMIGES} transform={poseAsa} fill={ASA} {...sil(CONTORNO, 2.4)} />
            <path className="ani-linha" d={ASA_LINHAS} transform={poseAsa} {...linha(CONTORNO, 1.4, 0.5)} />
            <path d={ASA_COBERTEIRAS} transform={poseAsa} fill={PENAS} stroke={CONTORNO} strokeWidth={1.75} strokeOpacity={0.85} strokeLinejoin="round" />
          </g>

          <g className="ani-pescoco">
            {/* cachecol de trás: volta na sombra + ponta esvoaçante (o pescoço cobre as raízes) */}
            <path d={LA_TRAS + LA_PONTA} fill={LA} {...sil(LA_CONTORNO, 2.2)} />
            <path d={LA_DOBRAS} fill={LA_ESCURA} opacity={0.8} />
            <path d={pes.forma} fill={PESCOCO_COR} {...sil(CONTORNO, 3)} />
            <path d={pes.cel} fill={CEL} opacity={0.55} />
            <path className="ani-linha" d={pes.luz} {...linha('#ffffff', 2, 0.9)} />
            {/* cachecol da frente */}
            <path d={LA_VOLTA} fill={LA} {...sil(LA_CONTORNO, 2.6)} />
            {/* ponta da frente + nó num <path> só: pendem do nó por cima do rolo */}
            <path d={LA_CAI + LA_NO} fill={LA} {...sil(LA_CONTORNO, 2.2)} />
            <path d={LA_FRANJA + LA_NERVURAS} {...linha(LA_CONTORNO, 1.45, 0.8)} />
            <path className="ani-linha" d={LA_LISTRAS + LA_BRILHO} {...linha(LA_CLARA, 1.8, 0.9)} />
            <path d={BROCHE} fill={OURO} {...sil(OURO_CONTORNO, 1.6)} />
            <path className="gan-reflexo" d={brilho(39.8, 61.6, 3.2)} fill="#fff" />

            <g className="ani-cabeca">
              <g transform={`translate(${hx} ${hy})${p.giro ? ` rotate(${p.giro} ${PIVO[0]} ${PIVO[1]})` : ''}`}>
                <path d={CABECA} fill={PENAS} {...sil(CONTORNO)} />
                <path d={pes.emenda} fill={PESCOCO_COR} transform={desfaz} />
                <path d={CABECA_CEL + EMENDAS_CEL[humor]} fill={CEL} opacity={0.55} />
                <ellipse cx={53.4} cy={13.6} rx={6.4} ry={3.6} fill="url(#gi-animais-realce)" transform="rotate(-30 53.4 13.6)" />
                <path className="ani-borda-luz" d="M80 27.4Q79 33 75.4 36.8" {...linha(BORDA_LUZ, 1.5, 1)} opacity={0.5} />

                <path d={CALOMBO} fill={CALOMBO_COR} {...sil(BICO_CONTORNO, 1.6)} />
                <Bochecha humor={humor} />
                {humor === 'neutro' ? <OlhosDesdem /> : <Olhos olhos={OLHOS} humor={humor} cores={CORES} />}
                <Piscada olhos={OLHOS} humor={humor} cores={CORES} />
                {humor === 'neutro' ? (
                  <SobrancelhasDesdem />
                ) : (
                  humor !== 'aposentado' && <Sobrancelhas olhos={humor === 'surpresa' ? OLHOS_SUSTO : OLHOS} humor={humor} cor={CONTORNO} />
                )}
                <Bico humor={humor} abre={p.bico} />
                {humor === 'triste' && <Lagrima x={79.6} y={25.4} e={0.85} />}
                {humor === 'aposentado' && <Touca />}
              </g>
            </g>
          </g>
        </Pose>
      </g>

      <g className="ani-fx">
        {humor !== 'aposentado' &&
          BRILHOS.map(([x, y, r], i) => (
            <path key={i} className={`gan-brilho${i ? ' gan-brilho-2' : ''}`} d={brilho(x, y, r, r * 1.35)} fill={BRILHO_FX} />
          ))}
        {humor === 'surpresa' && (
          <>
            <path className="ani-tracos" d={TRACOS_SUSTO} fill="none" stroke="#6a4300" strokeWidth={2.4} strokeLinecap="round" />
            <Exclamacao x={82} y={12} />
          </>
        )}
        {humor === 'aposentado' && <Zzz x={84} y={34} />}
      </g>
    </>
  );
}

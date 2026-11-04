// Peças compartilhadas da arte dos animais (DIRECAO_DE_ARTE 5.1 e 5.4): contorno, olhos por humor com
// brilhos, pálpebras, cílios, piscada, sobrancelhas, bochechas, lágrima, "Zzz", "!" e sombra de contato.
// As espécies montam o rosto com estas peças; o kit completo está documentado no topo de Galinha.tsx.
// Regras: nada de filter/máscara/<defs> por instância; formas iguais são juntadas num só <path>
// (menos elementos por animal no grid de até 128).
import type { Tier } from '@galinheiro/game-core';
import type { CSSProperties } from 'react';

export type Humor = Tier | 'surpresa' | 'aposentado';

/** Props que toda espécie recebe. `ninho=false` desenha a parte de baixo (pés), que o ninho esconderia. */
export interface PropsEspecie {
  humor: Humor;
  ninho?: boolean;
}

/**
 * Contorno de silhueta: traço ATRÁS do preenchimento (só a metade de fora aparece = 3,5 visível).
 * Peças pequenas (visível < 3: bico, barbela, pés, asa) recebem 'ani-sil-fino', que no lod-p engrossa
 * menos — senão o contorno vira uma mancha marrom sobre o rosto.
 */
export function sil(cor: string, visivel = 3.5) {
  return {
    stroke: cor,
    strokeWidth: visivel * 2,
    paintOrder: 'stroke',
    strokeLinejoin: 'round',
    strokeLinecap: 'round',
    className: visivel >= 3 ? 'ani-sil' : 'ani-sil-fino',
  } as const;
}

/** Linha interna (asa, pálpebra, divisão do bico): 1,75 a 85%. */
export function linha(cor: string, largura = 1.75, opacidade = 0.85) {
  return { stroke: cor, strokeWidth: largura, strokeOpacity: opacidade, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
}

const f = (n: number) => Math.round(n * 100) / 100;

/** Círculo como subcaminho (para juntar vários círculos iguais num só <path>). */
export function circ(x: number, y: number, r: number): string {
  return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}

/** Elipse como subcaminho. */
export function elip(x: number, y: number, rx: number, ry: number): string {
  return `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
}

// ------------------------------------------------------------------------------ geometria de apoio

type P = [number, number];

const dist = (a: P, b: P) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Ponto da quadrática a→c→b em t. */
function quad(a: P, c: P, b: P, t: number): P {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

/** Tangente (não normalizada) da quadrática em t. */
function quadTan(a: P, c: P, b: P, t: number): P {
  return [2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]), 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1])];
}

function compQuad(a: P, c: P, b: P): number {
  let s = 0;
  let ant = a;
  for (let i = 1; i <= 48; i++) {
    const p = quad(a, c, b, i / 48);
    s += dist(ant, p);
    ant = p;
  }
  return s;
}

/** Comprimento do arco de elipse (centro, raios) entre os ângulos g0 e g1 (graus, y para cima). */
function compArco(cx: number, cy: number, R: number, S: number, g0: number, g1: number): number {
  let s = 0;
  const pt = (g: number): P => [cx + R * Math.cos((g * Math.PI) / 180), cy - S * Math.sin((g * Math.PI) / 180)];
  let ant = pt(g0);
  for (let i = 1; i <= 240; i++) {
    const p = pt(g0 + ((g1 - g0) * i) / 240);
    s += dist(ant, p);
    ant = p;
  }
  return s;
}

const unit = ([x, y]: P): P => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

/**
 * Cílio: lâmina curva e afilada (cheia), da base `b` na direção `d`, com `comp` de comprimento e `larg`
 * de largura na base. `curva` desloca a ponta para o lado `lado2` (vetor), o que dá o "cachinho".
 */
function lamina(b: P, d: P, comp: number, larg: number, curva: number, lado2: P): string {
  const [dx, dy] = unit(d);
  // Normal que aponta para `lado2` (decide para onde a ponta enrola).
  let n: P = [-dy, dx];
  if (n[0] * lado2[0] + n[1] * lado2[1] < 0) n = [dy, -dx];
  // Espinha: sai reta da base (controle no eixo) e enrola só no fim (ponta deslocada de `curva`).
  const ponta: P = [b[0] + dx * comp + n[0] * curva, b[1] + dy * comp + n[1] * curva];
  const k: P = [b[0] + dx * comp * 0.62, b[1] + dy * comp * 0.62];
  const h = larg / 2;
  // Bordas: a de fora da curva é mais cheia (gota afilada, base grossa, ponta fina).
  return (
    `M${f(b[0] + n[0] * h)} ${f(b[1] + n[1] * h)}` +
    `Q${f(k[0] + n[0] * h * 1.1)} ${f(k[1] + n[1] * h * 1.1)} ${f(ponta[0])} ${f(ponta[1])}` +
    `Q${f(k[0] - n[0] * h * 0.5)} ${f(k[1] - n[1] * h * 0.5)} ${f(b[0] - n[0] * h)} ${f(b[1] - n[1] * h)}Z`
  );
}

/** Interseção da reta (esquerda, yE)–(direita, yD) com a elipse do olho; null se a reta não corta o olho. */
export interface Corte {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Controle da borda curva (meio da corda + `curva`). */
  mx: number;
  my: number;
  c: number;
}

/** Interseção da reta (esquerda, yE)–(direita, yD) com a elipse; null se a reta não corta o olho. */
export function corteOlho(cx: number, cy: number, rx: number, ry: number, yE: number, yD: number, curva: number): Corte | null {
  const m = (yD - yE) / (2 * rx);
  const c = (yE + yD) / 2 - cy;
  const A = 1 / (rx * rx) + (m * m) / (ry * ry);
  const B = (2 * m * c) / (ry * ry);
  const C = (c * c) / (ry * ry) - 1;
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return null;
  const r = Math.sqrt(disc);
  const u1 = (-B - r) / (2 * A);
  const u2 = (-B + r) / (2 * A);
  const x1 = cx + u1;
  const y1 = cy + m * u1 + c;
  const x2 = cx + u2;
  const y2 = cy + m * u2 + c;
  return { x1, y1, x2, y2, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 + curva, c };
}

/**
 * Tampa de olho: a parte da elipse acima ('cima') ou abaixo ('baixo') de uma reta que vai de
 * (esquerda, yE) a (direita, yD). `curva` empurra o meio da borda da tampa (+ = para baixo).
 */
export function tampa(cx: number, cy: number, rx: number, ry: number, yE: number, yD: number, curva: number, lado: 'cima' | 'baixo'): string {
  const k = corteOlho(cx, cy, rx, ry, yE, yD, curva);
  if (!k) return '';
  const { x1, y1, x2, y2, mx, my, c } = k;
  if (lado === 'cima') {
    const grande = c > 0 ? 1 : 0;
    return `M${f(x1)} ${f(y1)}A${f(rx)} ${f(ry)} 0 ${grande} 1 ${f(x2)} ${f(y2)}Q${f(mx)} ${f(my)} ${f(x1)} ${f(y1)}Z`;
  }
  const grande = c < 0 ? 1 : 0;
  return `M${f(x2)} ${f(y2)}A${f(rx)} ${f(ry)} 0 ${grande} 1 ${f(x1)} ${f(y1)}Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}Z`;
}

/**
 * Só a BORDA de baixo de uma tampa de cima (o "delineado"), com o rabinho no canto de fora.
 * É a mesma linguagem de todos os olhos abertos: tampa sem traço + esta linha grossa.
 */
export function bordaTampa(cx: number, cy: number, rx: number, ry: number, yE: number, yD: number, curva: number, lado: -1 | 1, e = 1, rabo = 1): string {
  const k = corteOlho(cx, cy, rx, ry, yE, yD, curva);
  if (!k) return '';
  const { x1, y1, x2, y2, mx, my } = k;
  const [fx, fy] = lado < 0 ? [x1, y1] : [x2, y2];
  return `M${f(x1)} ${f(y1)}Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}M${f(fx)} ${f(fy)}l${f(lado * 1.9 * e * rabo)} ${f(-1.5 * e * rabo)}`;
}

// ------------------------------------------------------------------------------------------- olhos

/** Um olho: centro, lado na tela (-1 = esquerda) e escala (pato ×0,95, ganso ×0,9, avestruz ×1,25). */
export interface DefOlho {
  x: number;
  y: number;
  lado: -1 | 1;
  e?: number;
}

export interface CoresRosto {
  /** Contorno da cabeça (esclera, pálpebras, sobrancelhas). */
  contorno: string;
  /** Cor das pálpebras (base da cabeça). */
  palpebra: string;
  /** Cor de sombra da cabeça (olheira do cansado). */
  sombra: string;
  /** Preenchimento da íris: cor ou url(#gi-animais-<especie>-iris). */
  iris: string;
  /** Linha de cílios/pálpebra (mais escura que o contorno). Padrão: contorno. */
  cilio?: string;
}

/** Medidas do olho da galinha num humor (as espécies multiplicam por `e`). */
export interface Medidas {
  rx: number;
  ry: number;
  iris: number;
  pupila: number;
  b1: number;
  b2: number;
}

/** Medidas da galinha (as outras espécies passam `e`). Pupila e brilhos mudam com o humor (5.4). */
export const MEDIDAS: Record<Humor, Medidas> = {
  feliz: { rx: 7.4, ry: 9, iris: 6.1, pupila: 3.9, b1: 2.4, b2: 1.2 },
  neutro: { rx: 7.4, ry: 9, iris: 5.9, pupila: 3.5, b1: 2, b2: 1 },
  cansado: { rx: 7.4, ry: 9, iris: 5.6, pupila: 3, b1: 1.7, b2: 0 },
  triste: { rx: 7.4, ry: 9, iris: 6.1, pupila: 4.1, b1: 2.6, b2: 1.5 },
  surpresa: { rx: 8.5, ry: 10.3, iris: 4.4, pupila: 2.4, b1: 1.5, b2: 0.8 },
  aposentado: { rx: 7.4, ry: 9, iris: 5.9, pupila: 3.5, b1: 2, b2: 1 },
};

/** Para onde o olhar aponta em cada humor (íris e pupila andam, × e; os brilhos não). */
export const OLHAR: Record<Humor, [number, number]> = {
  feliz: [-0.6, -0.3],
  neutro: [-0.9, 0],
  cansado: [-0.5, 1.3],
  triste: [-0.2, 1.2],
  surpresa: [0, 0],
  aposentado: [0, 0],
};

/**
 * Tampa fixa (pálpebra de cima parada): quanto da ALTURA do olho ela cobre no canto de dentro e no de fora
 * (0 = aberto, 1 = fechado). `curva` empurra o meio da borda (+ = para baixo); `rabo` escala o rabinho do
 * delineado (0,01 = sem rabinho). A borda de baixo da tampa vira o delineado (cor `cilio`, 2,4).
 */
export interface TampaOlho {
  dentro: number;
  fora: number;
  curva?: number;
  rabo?: number;
}

// Tampa padrão de cada humor (null = olho aberto, só delineado no topo).
const TAMPAS: Record<Humor, TampaOlho | null> = {
  feliz: null,
  neutro: null,
  // 45% caída, um pouco mais pesada no canto de fora (= 0,9·e a mais).
  cansado: { dentro: 0.45, fora: 0.5, curva: 0.8 },
  // Canto de fora caído: cobre mais do lado de fora.
  triste: { dentro: 0.04, fora: 0.44, curva: 0.4 },
  surpresa: null,
  aposentado: null,
};

/**
 * Cílios longos de espécie (opcional; a galinha não tem). São lâminas curvas afiladas no canto de fora,
 * que acompanham o estado do olho: abertos saem do delineado e enrolam para cima; com tampa saem da borda
 * da tampa, caídos; fechados ("^", "‿" e a piscada) penduram da linha de fechamento. Os abertos ficam no
 * <g.ani-cilios> (junto com o delineado), que some enquanto a pálpebra desce (mesmo ciclo do
 * .ani-palpebras); passe o MESMO objeto para <Olhos/> e <Piscada/>.
 */
export interface CiliosOlho {
  /** Quantos cílios por olho (padrão 3). */
  n?: 2 | 3;
  /** Escala do comprimento (padrão 1 = 5,4·e abertos, 4,8·e nas tampas e fechados). */
  comp?: number;
  /** Cor (padrão `cores.cilio`). */
  cor?: string;
}

// Proporção de cada cílio (de fora para dentro): o de fora é o mais longo.
const PROP_CILIOS = [1, 0.9, 0.76];

/** Cílios abertos: ao longo do delineado do topo, do canto de fora para dentro, enrolando para cima. */
function ciliosAbertos(x: number, y: number, rx: number, ry: number, lado: -1 | 1, e: number, c: CiliosOlho): string {
  const n = c.n ?? 3;
  const angs = n === 2 ? [12, 36] : [6, 26, 47];
  let d = '';
  angs.forEach((g, i) => {
    const a = (g * Math.PI) / 180;
    const b: P = [x + lado * rx * Math.cos(a), y - ry * Math.sin(a)];
    const nrm = unit([(lado * Math.cos(a)) / rx, -Math.sin(a) / ry]);
    const dir: P = [nrm[0] + lado * 0.6, nrm[1] - 0.05];
    const comp = 5.2 * e * (c.comp ?? 1) * PROP_CILIOS[i]!;
    d += lamina(b, dir, comp, 2.2 * e, comp * 0.55, [lado, -1]);
  });
  return d;
}

/**
 * Cílios sobre uma curva (quadrática a→c→b, `a` = canto de fora), na direção `dir`, enrolando para `enrola`.
 * `leque` soma a cada cílio (de fora para dentro) na componente y da direção: abre os cílios em leque.
 */
function ciliosNaCurva(a: P, c: P, b: P, e: number, cc: CiliosOlho, dir: P, enrola: P, passo = 0.13, leque = 0): string {
  const n = cc.n ?? 3;
  let d = '';
  for (let i = 0; i < n; i++) {
    const t = 0.04 + i * passo;
    const comp = 4.8 * e * (cc.comp ?? 1) * PROP_CILIOS[i]!;
    d += lamina(quad(a, c, b, t), [dir[0], dir[1] + i * leque], comp, 2 * e, comp * 0.5, enrola);
  }
  return d;
}

export interface PropsOlhos {
  olhos: DefOlho[];
  humor: Humor;
  cores: CoresRosto;
  /** Cílios longos da espécie (ver CiliosOlho). */
  cilios?: CiliosOlho;
  /** Pula o delineado do topo dos olhos ABERTOS (neutro/surpresa sem tampa). */
  semDelineado?: boolean;
  /**
   * Tampa fixa no lugar da do humor (undefined = a do humor; null = nenhuma). Vale para os humores de olho
   * aberto (neutro, cansado, triste, surpresa); feliz e aposentado são sempre fechados.
   */
  tampa?: TampaOlho | null;
  /** Direção do olhar no lugar da do humor (OLHAR), em unidades × e. */
  olhar?: [number, number];
}

/**
 * Olhos completos para um humor (5.4, revisados a 72 px):
 *  - feliz: FECHADOS em "^" (crescente cheio na cor `cilio`) — o polo oposto do cansado;
 *  - neutro e surpresa: ABERTOS, sem tampa; delineado só no topo (mais grosso no canto de fora);
 *  - cansado (tampa 45% + olheira) e triste (tampa diagonal + marejado): tampa SEM traço + delineado;
 *  - aposentado: fechados em "‿".
 * Esclera SEM contorno (anel em volta do olho = "óculos"): o gradiente gi-animais-olho-esclera já traz
 * a sombra interna no alto e o fundo frio que separa o olho da cabeça creme. Dentro de `.ani-olhos`;
 * a piscada é a peça <Piscada/>, separada. O delineado e os cílios abertos vão num <g.ani-cilios>, que
 * some enquanto a pálpebra de piscar cobre o olho (assim ela não precisa de folga nem "asa"). Opcionais: `cilios`, `semDelineado`, `tampa`, `olhar`.
 */
export function Olhos({ olhos, humor, cores, cilios: cc, semDelineado, tampa: tampaProp, olhar }: PropsOlhos) {
  const cilio = cores.cilio ?? cores.contorno;
  const corCilios = cc?.cor ?? cilio;
  if (humor === 'aposentado') {
    // Fechados, dormindo: arco "‿" com um cílio no canto de fora.
    let d = '';
    let longos = '';
    for (const { x, y, lado, e = 1 } of olhos) {
      const w = 5.6 * e;
      const fora = x + lado * w;
      d += `M${f(x - w)} ${f(y + 0.5)}Q${f(x)} ${f(y + 5 * e)} ${f(x + w)} ${f(y + 0.5)}M${f(fora)} ${f(y + 0.5)}l${f(lado * 1.8 * e)} ${f(-1.4 * e)}`;
      if (cc) longos += ciliosNaCurva([fora, y + 0.5], [x, y + 5 * e], [x - lado * w, y + 0.5], e, cc, [lado * 0.7, 1], [lado, 0], 0.15);
    }
    return (
      <g className="ani-olhos">
        <path d={d} fill="none" stroke={cores.contorno} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        {longos && <path d={longos} fill={corCilios} />}
      </g>
    );
  }
  if (humor === 'feliz') {
    // Fechados de alegria "^ ^": crescente cheio (mais grosso no meio, pontas finas e redondas).
    let d = '';
    for (const { x, y, lado, e = 1 } of olhos) {
      const w = 6.2 * e;
      const b = y + 2.6 * e;
      d += `M${f(x - w)} ${f(b)}Q${f(x)} ${f(y - 8.2 * e)} ${f(x + w)} ${f(b)}Q${f(x)} ${f(y - 3.6 * e)} ${f(x - w)} ${f(b)}Z`;
      // Cílios na borda de cima do "^", perto do canto de fora, para fora e para cima.
      if (cc) {
        const a: P = [x + lado * w, b];
        const c: P = [x, y - 8.2 * e];
        const z: P = [x - lado * w, b];
        for (let i = 0; i < (cc.n ?? 3); i++) {
          // Leque no canto de fora: o 1º sai na horizontal (um pouco para baixo), os outros sobem.
          const t = 0.02 + i * 0.09;
          const p = quad(a, c, z, t);
          const comp = 5 * e * (cc.comp ?? 1) * PROP_CILIOS[i]!;
          const dir: P = [[lado, 0.25], [lado, -0.3], [lado * 0.7, -0.9]][i] as P;
          d += lamina([p[0], p[1] - 0.4 * e], dir, comp, 1.5 * e, comp * 0.38, [lado, -1]);
        }
      }
    }
    return (
      <g className="ani-olhos">
        <path d={d} fill={cilio} stroke={cilio} strokeWidth={1.3} strokeLinejoin="round" />
      </g>
    );
  }

  const m = MEDIDAS[humor];
  const [ox, oy] = olhar ?? OLHAR[humor];
  const tp = tampaProp === undefined ? TAMPAS[humor] : tampaProp;
  let esclera = '';
  let iris = '';
  let pupila = '';
  let brilho1 = '';
  let brilho2 = '';
  let tampas = '';
  let extra = '';
  let delineado = '';
  let longos = '';

  for (const { x, y, lado, e = 1 } of olhos) {
    const rx = m.rx * e;
    const ry = m.ry * e;
    esclera += elip(x, y, rx, ry);
    const ix = x + ox * e;
    const iy = y + (0.5 + oy) * e;
    iris += circ(ix, iy, m.iris * e);
    pupila += circ(ix, iy, m.pupila * e);
    // Brilhos fixos em relação ao olho (não seguem o olhar).
    const bx = x + (ox * 0.4 - 1.7) * e;
    const by = y + (0.5 - 2.1) * e;
    brilho1 += circ(bx, by, m.b1 * e);
    if (m.b2 > 0) brilho2 += circ(x + 1.9 * e, y + 2.3 * e, m.b2 * e);

    const topo = y - ry;
    if (tp) {
      // Tampa fixa: preenchida SEM traço; a borda de baixo vira o delineado (cílio grosso).
      const yDentro = topo + tp.dentro * 2 * ry;
      const yFora = topo + tp.fora * 2 * ry;
      const [yE, yD] = lado < 0 ? [yFora, yDentro] : [yDentro, yFora];
      const curva = tp.curva ?? 0.6;
      tampas += tampa(x, y, rx, ry, yE, yD, curva, 'cima');
      delineado += bordaTampa(x, y, rx, ry, yE, yD, curva, lado, e, tp.rabo ?? 1);
      if (cc) {
        const k = corteOlho(x, y, rx, ry, yE, yD, curva);
        if (k) {
          const pf: P = lado < 0 ? [k.x1, k.y1] : [k.x2, k.y2];
          const pd: P = lado < 0 ? [k.x2, k.y2] : [k.x1, k.y1];
          longos += ciliosNaCurva(pf, [k.mx, k.my], pd, e, cc, [lado, 0.55], [lado, -1], 0.14, -0.4);
        }
      }
    } else {
      // Aberto (neutro, surpresa): delineado só no topo, ASSIMÉTRICO — começa alto do lado de dentro
      // e desce até o canto de fora, onde sai o rabinho. Nunca fecha um anel em volta do olho.
      if (!semDelineado) {
        const dentroY = y - ry * 0.62;
        const dentroX = x - lado * rx * Math.sqrt(1 - 0.62 * 0.62);
        const foraY = y - ry * 0.12;
        const foraX = x + lado * rx * Math.sqrt(1 - 0.12 * 0.12);
        const sweep = lado < 0 ? 0 : 1;
        delineado += `M${f(dentroX)} ${f(dentroY)}A${f(rx)} ${f(ry)} 0 0 ${sweep} ${f(foraX)} ${f(foraY)}l${f(lado * 1.9 * e)} ${f(-1.5 * e)}`;
      }
      if (cc) longos += ciliosAbertos(x, y, rx, ry, lado, e, cc);
    }
    if (humor === 'cansado') {
      // Olheira.
      extra += `M${f(x - rx * 0.75)} ${f(y + ry + 1.4)}Q${f(x)} ${f(y + ry + 3.6 * e)} ${f(x + rx * 0.75)} ${f(y + ry + 1.4)}`;
    }
  }

  // Marejado do triste: linha d'água azul no fundo do olho.
  const agua =
    humor === 'triste'
      ? olhos
          .map(({ x, y, e = 1 }) => {
            const rx = m.rx * e;
            const ry = m.ry * e;
            return `M${f(x - rx * 0.62)} ${f(y + ry * 0.62)}Q${f(x)} ${f(y + ry * 0.98)} ${f(x + rx * 0.62)} ${f(y + ry * 0.62)}`;
          })
          .join('')
      : '';

  return (
    <g className="ani-olhos">
      <path d={esclera} fill="url(#gi-animais-olho-esclera)" />
      <path d={iris} fill={cores.iris} />
      <path className="ani-pupila" d={pupila} fill="#1e1426" stroke="#1e1426" strokeWidth={0} />
      {agua && <path className="ani-linha" d={agua} fill="none" stroke="#8cd3ff" strokeWidth={1.6} strokeLinecap="round" />}
      <path d={brilho1} fill="#fff" />
      {brilho2 && <path className="ani-brilho2" d={brilho2} fill="#fff" fillOpacity={0.85} />}
      {tampas && <path d={tampas} fill={cores.palpebra} />}
      {/* Delineado + cílios abertos: somem enquanto a pálpebra de piscar cobre o olho (.ani-cilios). */}
      {(delineado || longos) && (
        <g className="ani-cilios">
          {delineado && <path d={delineado} fill="none" stroke={cilio} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />}
          {longos && <path d={longos} fill={corCilios} />}
        </g>
      )}
      {extra && <path className="ani-linha" d={extra} {...linha(cores.sombra, 1.7, 0.9)} />}
    </g>
  );
}

/** Folga da pálpebra de piscar em volta do olho: só cobre a borda antisserrilhada da esclera. */
const FOLGA_PISCADA = 0.7;

/**
 * Pálpebra de piscar (.ani-palpebras; o CSS anima scaleY 0 → 1 a partir do topo). UM <path> por animal:
 *  - o preenchimento (cor `palpebra`, SEM contorno em volta — o oval contornado lia "óculos de natação")
 *    é o próprio olho + FOLGA_PISCADA (0,7). Nada de folga grande nem "asa": o delineado e o rabinho NÃO
 *    precisam ser cobertos, porque ficam no <g.ani-cilios> de <Olhos/>, que some (opacity) enquanto a
 *    pálpebra desce. Assim a área de cor chapada é mínima (sem ovais claros sobre o gradiente da cabeça) e
 *    nunca passa por cima do contorno da cabeça (olhos colados na borda, como no ganso).
 *  - o traço (cor `cilio`) só aparece na linha de fechamento "‿" no terço de baixo, com o cílio do canto de
 *    fora: o resto fica no trecho "apagado" do stroke-dasharray. Cada subcaminho (um por olho) COMEÇA na
 *    ponta do cílio (T) e TERMINA voltando por cima dele (Ef → T); o enchimento que iguala os comprimentos
 *    fica no meio, escondido no trecho apagado. Se o comprimento real (do navegador) diferir um pouco do
 *    calculado, a sobra do tracejado cai em cima do próprio cílio: nunca sobra fiapo solto. Funciona tanto
 *    nos navegadores que reiniciam o padrão a cada subcaminho quanto nos que continuam.
 *  - `palpebra` aceita url(#gi-animais-<especie>-palpebra): um gradiente com gradientUnits="userSpaceOnUse"
 *    e as mesmas paradas/coordenadas do gradiente da cabeça casa pixel a pixel (opcional).
 * Com `cilios`, um 2º <path> pendura os cílios longos da linha de fechamento.
 */
export function Piscada({ olhos, humor, cores, cilios: cc }: { olhos: DefOlho[]; humor: Humor; cores: CoresRosto; cilios?: CiliosOlho }) {
  if (humor === 'aposentado' || humor === 'surpresa' || humor === 'feliz') return null;
  const m = MEDIDAS[humor];
  const cilio = cores.cilio ?? cores.contorno;
  const partes: { d: string; fim: string; liga: number; total: number; lado: -1 | 1 }[] = [];
  let longos = '';
  for (const { x, y, lado, e = 1 } of olhos) {
    const rx = m.rx * e;
    const ry = m.ry * e;
    const R = rx + FOLGA_PISCADA;
    const S = ry + FOLGA_PISCADA;
    const pt = (g: number): P => [x + lado * R * Math.cos((g * Math.PI) / 180), y - S * Math.sin((g * Math.PI) / 180)];
    // Borda da pálpebra em 4 quartos, a partir do canto de fora (B), descendo.
    const B = pt(0);
    const Q1 = pt(-90);
    const Q2 = pt(-180);
    const Q3 = pt(-270);
    const varre = lado > 0 ? 1 : 0;
    // Linha de fechamento "‿" (terço de baixo) e o cílio do canto de fora.
    const Ef: P = [x + lado * rx * 0.94, y + ry * 0.12];
    const Ed: P = [x - lado * rx * 0.9, y + ry * 0.06];
    const C: P = [x + lado * rx * 0.05, y + ry * 0.98];
    const T: P = [Ef[0] + lado * 1.8 * e, Ef[1] - 1.4 * e];
    const lq = compQuad(Ef, C, Ed);
    const liga = dist(T, Ef) + lq;
    // Cílio + linha (ida), linha (volta), Ef → B, a borda inteira, B → Ef, Ef → T (por cima do cílio).
    const total = 2 * liga + 2 * dist(Ef, B) + compArco(0, 0, R, S, 0, -360);
    const d =
      `M${f(T[0])} ${f(T[1])}L${f(Ef[0])} ${f(Ef[1])}Q${f(C[0])} ${f(C[1])} ${f(Ed[0])} ${f(Ed[1])}` +
      `Q${f(C[0])} ${f(C[1])} ${f(Ef[0])} ${f(Ef[1])}L${f(B[0])} ${f(B[1])}` +
      `A${f(R)} ${f(S)} 0 0 ${varre} ${f(Q1[0])} ${f(Q1[1])}A${f(R)} ${f(S)} 0 0 ${varre} ${f(Q2[0])} ${f(Q2[1])}` +
      `A${f(R)} ${f(S)} 0 0 ${varre} ${f(Q3[0])} ${f(Q3[1])}A${f(R)} ${f(S)} 0 0 ${varre} ${f(B[0])} ${f(B[1])}`;
    const fim = `L${f(Ef[0])} ${f(Ef[1])}L${f(T[0])} ${f(T[1])}`;
    partes.push({ d, fim, liga, total, lado });
    if (cc) longos += ciliosNaCurva(Ef, C, Ed, e, cc, [lado * 0.7, 1], [lado, 0], 0.14);
  }
  // Mesmo comprimento em todos os subcaminhos: enchimento (vai-e-volta horizontal a partir de B, para
  // dentro do olho, área zero) no meio do trecho apagado. Período com folga de 2, arredondado.
  const periodo = Math.ceil(Math.max(...partes.map((p) => p.total)) + 2);
  const liga = Math.min(...partes.map((p) => p.liga));
  const d = partes.map(({ d: s, fim, total, lado }) => {
    const sobra = (periodo - total) / 2;
    return `${s}l${f(-lado * sobra)} 0l${f(lado * sobra)} 0${fim}`;
  });
  return (
    <g className="ani-palpebras">
      <path
        d={d.join('')}
        fill={cores.palpebra}
        stroke={cilio}
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${f(liga)} ${f(periodo - liga)}`}
      />
      {longos && <path d={longos} fill={cc?.cor ?? cilio} />}
    </g>
  );
}

// ------------------------------------------------------------------------------------ sobrancelhas

interface FormaSobrancelha {
  /** Deslocamento vertical da ponta de dentro e da de fora (− = sobe). */
  dentro: number;
  fora: number;
  /** Arqueamento (− = arco para cima). */
  arco: number;
  opacidade: number;
  /** Meia largura (padrão 4,6). */
  meia?: number;
}

const SOBRANCELHAS: Record<Humor, FormaSobrancelha> = {
  feliz: { dentro: -1.2, fora: -1.6, arco: -2.4, opacidade: 0.9 },
  // Calmo/atento: nivelada, arco suave para CIMA, nunca inclinada para o bico (isso lê "bravo").
  neutro: { dentro: 0.2, fora: 0.2, arco: -2.2, opacidade: 0.9 },
  cansado: { dentro: 0.6, fora: 2.6, arco: -1, opacidade: 0.9 },
  triste: { dentro: -3.4, fora: 0.8, arco: -0.4, opacidade: 1 },
  // Altas e CURTAS: longe do olho, para não "emoldurar" a esclera (óculos).
  surpresa: { dentro: -7.2, fora: -7.4, arco: -1.8, opacidade: 1, meia: 3.4 },
  aposentado: { dentro: 2.2, fora: 2.6, arco: -1.2, opacidade: 0.75 },
};

/** Sobrancelhas (linha grossa na cor do contorno), uma por olho. */
export function Sobrancelhas({ olhos, humor, cor }: { olhos: DefOlho[]; humor: Humor; cor: string }) {
  const s = SOBRANCELHAS[humor];
  const m = MEDIDAS[humor];
  const d = olhos
    .map(({ x, y, lado, e = 1 }) => {
      const base = y - m.ry * e - 3.4;
      const meia = (s.meia ?? 4.6) * e;
      const xd = x - lado * meia;
      const xf = x + lado * meia;
      const yd = base + s.dentro;
      const yf = base + s.fora;
      return `M${f(xf)} ${f(yf)}Q${f(x)} ${f((yd + yf) / 2 + s.arco)} ${f(xd)} ${f(yd)}`;
    })
    .join('');
  return (
    <g className="ani-sobrancelhas">
      <path d={d} fill="none" stroke={cor} strokeWidth={2.3} strokeLinecap="round" opacity={s.opacidade} />
    </g>
  );
}

// ------------------------------------------------------------------------------- bochechas e fx

export const OPACIDADE_BOCHECHA: Record<Humor, number> = { feliz: 0.95, neutro: 0.5, cansado: 0.3, triste: 0.22, surpresa: 0.6, aposentado: 0.4 };

/**
 * Bochechas rosadas (gradiente radial suave, sem blur); maiores no feliz. `fill` troca o gradiente
 * (ex.: url(#gi-animais-<especie>-bochecha) quando o rosa comum some na cor da cabeça).
 */
export function Bochechas({
  pontos,
  humor,
  rx: rx0 = 5.4,
  ry: ry0 = 3.4,
  fill = 'url(#gi-animais-bochecha)',
}: {
  pontos: [number, number][];
  humor: Humor;
  rx?: number;
  ry?: number;
  fill?: string;
}) {
  const rx = humor === 'feliz' ? rx0 + 1 : rx0;
  const ry = humor === 'feliz' ? ry0 + 0.5 : ry0;
  return (
    <g className="ani-bochechas" opacity={OPACIDADE_BOCHECHA[humor]}>
      {pontos.map(([x, y]) => (
        <ellipse key={x} cx={x} cy={y} rx={rx} ry={ry} fill={fill} />
      ))}
    </g>
  );
}

/** Lágrima do triste (some no lod-p). */
export function Lagrima({ x, y, e = 1 }: { x: number; y: number; e?: number }) {
  const d = `M${f(x)} ${f(y)}C${f(x - 1.2 * e)} ${f(y + 3 * e)} ${f(x - 3 * e)} ${f(y + 5 * e)} ${f(x - 3 * e)} ${f(y + 7 * e)}a${f(3 * e)} ${f(3 * e)} 0 0 0 ${f(6 * e)} 0C${f(x + 3 * e)} ${f(y + 5 * e)} ${f(x + 1.2 * e)} ${f(y + 3 * e)} ${f(x)} ${f(y)}Z`;
  return (
    <g className="ani-lagrima">
      <path d={d} fill="url(#gi-animais-lagrima)" stroke="#2b6cb0" strokeWidth={1.3} strokeLinejoin="round" />
      <ellipse cx={x - 1.2 * e} cy={y + 6.4 * e} rx={0.9 * e} ry={1.4 * e} fill="#fff" opacity={0.9} />
    </g>
  );
}

const Z = 'M0 0H7V1.9L2.7 6.1H7V8H0V6.1L4.3 1.9H0Z';
// [dx, dy, escala] de cada "z", do menor (perto da cabeça) ao maior.
const ZS: [number, number, number][] = [
  [0, 0, 0.9],
  [6, -8.5, 1.05],
  [12.5, -17, 1.2],
];

/**
 * Três "z" de sono (desenhados em path, sem fonte), animados por .ani-z no CSS. `sentido` -1 faz a
 * fila subir para a esquerda (cabeça caída para a esquerda). O topo do último z fica ~16 acima de y;
 * com a deriva do CSS (10 para cima) use y ≥ 26 para nada sair da caixa 120×120.
 */
export function Zzz({ x, y, sentido = 1 }: { x: number; y: number; sentido?: -1 | 1 }) {
  const estilo = { '--zzz-dx': `${sentido * 5}px` } as CSSProperties;
  return (
    <g className="ani-fx-zzz" transform={`translate(${x} ${y})`} style={estilo}>
      {ZS.map(([dx, dy, s]) => (
        <g key={dx} transform={`translate(${sentido < 0 ? -dx - 7 * s : dx} ${dy}) scale(${s})`}>
          <path className="ani-z" d={Z} fill="#fff" stroke="#1f3a66" strokeWidth={2.6} paintOrder="stroke" strokeLinejoin="round" />
        </g>
      ))}
    </g>
  );
}

/** "!" amarelo do susto. */
export function Exclamacao({ x, y }: { x: number; y: number }) {
  const d = `M${x - 2.6} ${y}h5.2l-1 11.5h-3.2Z${circ(x, y + 15.2, 2.5)}`;
  return (
    <g className="ani-exclama">
      <path d={d} fill="#ffd23f" stroke="#6a4300" strokeWidth={4.4} paintOrder="stroke" strokeLinejoin="round" />
    </g>
  );
}

/** Sombra de contato no chão (gradiente radial; com ninho fica mais larga). Sem ninho: sob os pés (y≈113). */
export function SombraContato({ ninho }: { ninho: boolean }) {
  return ninho ? (
    <ellipse className="ani-sombra" cx={60} cy={110.5} rx={50} ry={7} fill="url(#gi-animais-sombra)" />
  ) : (
    <ellipse className="ani-sombra" cx={60} cy={112.6} rx={32} ry={4.6} fill="url(#gi-animais-sombra)" />
  );
}

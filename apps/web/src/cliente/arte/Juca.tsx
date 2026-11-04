'use client';

// Seu Juca: o galo fazendeiro que guia o tutorial (GDD 5.2; DIRECAO_DE_ARTE 5.6) e abre o jogo na tela de
// entrada. Mesma família das aves (animais/Galinha.tsx): contorno colorido por material atrás do
// preenchimento (traço 7 = 3,5 visível), volume em 3 tons (gradiente radial + sombra "cel" + realce), olhão
// com brilhos e brilho de borda frio #bfe6ff. Pose 3/4 virada para a DIREITA (o balão do tutorial fica à
// direita).
//
// Leitura da silhueta (o que separa o galo de "um ovo de chapéu"):
//  - cabeça laranja-clara redonda + PESCOÇO fino (capa de penas pontudas caindo no ombro e o lenço amarrado
//    bem justo) + corpo cor de ferrugem: três massas, não uma;
//  - porte de galo: o tronco inteiro inclina 4° para trás (peito à frente, queixo erguido) e assenta em 2
//    canelas curtas e grossas, visíveis entre a barriga recolhida e os pés;
//  - peito estufado com babador CLARO #ffc58a (sombra cel #f6a25a na base) que começa na ponta do lenço e
//    forma a frente do peito, com 2 escamas grandes; costas com "sela" afundada entre o pescoço e a cauda;
//  - asa grande laranja-escura com a borda em leque (4 recortes redondos) no flanco, SEMPRE no flanco, até
//    no aceno (quem acena é a asa de LÁ, que sobe por trás da cabeça, à direita, contra o céu);
//  - cauda de galo: 5 foices longas em arco alternando verde #2fa36b e verde-azulado #1f7f8f, reflexo
//    roxo-azulado perto da ponta e contorno #14513f (não quase preto: a massa não pesa ao lado da galinha).
// A piada visual: a crista (3 lóbulos de altura decrescente, contorno #b51f1f) sai pelo furo da copa do
// chapéu de palha; o lábio de palha da frente do furo cobre a base dela. O raminho de trigo vai enfiado na
// fita do chapéu, ao lado do remendo (no bico ele lia como antena e lotava o rosto a 80 px).
// A cabeça (rosto + chapéu) é desenhada ~9% maior que a forma-base, com pivô no pescoço: a 80 px a expressão
// precisa ler tão bem quanto a da galinha.
//
// Caixa: TUDO cabe no viewBox 0 0 120 120 (sem overflow): o desenho é feito numa prancheta maior e o grupo
// raiz (RAIZ) o encolhe (0,927) com pivô no chão, pondo a sola dos pés em y≈115,8 (96,5%: as sombras do balão
// e do carregamento, em ui.css, contam com ~95%). A crista em repouso fica a ~4,5 do topo e, com o chapéu
// "ajeitando", a ~2; a surpresa (chapéu pulado) a ~1,5; a mão do aceno no pico a ~1 da borda direita.
//
// Camadas animadas (estilos/juca.css), todas com pivô em coordenadas do desenho (espaço local do grupo):
//   .juca-corpo (respira) > [pés] + tronco inclinado > .juca-cauda, .juca-aceno (asa de lá), .juca-asa
//   (gesto), .juca-cabeca > .juca-chapeu > .juca-capim, .juca-barbela, .juca-palpebra, .juca-sobrancelhas,
//   .juca-bico-baixo (fala).
// Aparece 1–2 vezes na tela: defs locais com useId() (não entra no orçamento do grid).
import { useId, type CSSProperties } from 'react';

export type ExpressaoJuca = 'feliz' | 'falando' | 'surpreso' | 'piscando';
/** Nomes da DIRECAO_DE_ARTE 5.6 (aceitos como sinônimos). */
type ExpressaoDoc = 'normal' | 'fala' | 'aprova' | 'surpresa';

const SINONIMO: Record<ExpressaoDoc, ExpressaoJuca> = { normal: 'feliz', fala: 'falando', aprova: 'piscando', surpresa: 'surpreso' };

export interface PropsJuca {
  className?: string;
  /** Rosto e gestos (padrão 'feliz'). 'falando' mexe o bico; 'piscando' dá uma piscadela de aprovação. */
  expressao?: ExpressaoJuca | ExpressaoDoc;
  /** Elipse de sombra no chão, embutida no SVG (padrão true). Use false quando quem usa desenha a sua. */
  sombra?: boolean;
  /** Ergue a asa de lá (atrás da cabeça, à direita) e acena (tela de entrada). A do flanco fica dobrada. */
  acenando?: boolean;
  /** Sem animação ociosa (pose parada), p. ex. em miniaturas. */
  parado?: boolean;
  style?: CSSProperties;
}

const f1 = (n: number) => Math.round(n * 10) / 10;

// ------------------------------------------------------------------------------------------ caixa
/** Prancheta → viewBox: encolhe com pivô no chão (sola em y≈115,8) e centra a figura inclinada. */
const ESCALA = 0.927;
const CHAO: [number, number] = [62, 113.6];
const RAIZ = `translate(${CHAO[0] + 2.5} ${CHAO[1] + 2.2}) scale(${ESCALA}) translate(${-CHAO[0]} ${-CHAO[1]})`;
/** Porte de galo: o tronco (tudo menos os pés) inclina para trás no quadril. */
const TRONCO = 'rotate(-4 64 102)';

// ------------------------------------------------------------------------------------------ cores
const CONT_CORPO = '#5a1a10';
const CONT_CABECA = '#5e1f10';
const CONT_CRISTA = '#b51f1f';
const CONT_BICO = '#7a3a0c';
const CONT_CAUDA = '#14513f';
const CONT_PALHA = '#6b4416';
const CONT_LENCO = '#0b2d66';
const CEL_CORPO = '#8e2e2a';
const CEL_CABECA = '#b4432a';
const PALPEBRA = '#f08236';
const BORDA_LUZ = '#bfe6ff';
/** Sobrancelhas, olhos fechados e cílio. */
const PINCEL = '#5e1f10';
/** Babador: claro chapado, sombra cel na base e escamas. */
const PEITO_COR = '#ffc58a';
const PEITO_CEL_COR = '#f6a25a';
const PEITO_LINHA = '#d9783a';

/** Silhueta: traço atrás do preenchimento (metade de fora aparece). */
function sil(cor: string, visivel = 3.5) {
  return { stroke: cor, strokeWidth: visivel * 2, paintOrder: 'stroke', strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
}
function linha(cor: string, largura = 1.75, opacidade = 0.85) {
  return { stroke: cor, strokeWidth: largura, strokeOpacity: opacidade, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
}
function circ(x: number, y: number, r: number): string {
  return elipse(x, y, r, r);
}
function elipse(x: number, y: number, rx: number, ry: number): string {
  return `M${f1(x - rx)} ${f1(y)}a${rx} ${ry} 0 1 0 ${f1(2 * rx)} 0a${rx} ${ry} 0 1 0 ${f1(-2 * rx)} 0Z`;
}

// ----------------------------------------------------------------------------------------- formas
type P = [number, number];
type Cubica = [P, P, P, P];

const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Trecho final [t, 1] de uma cúbica (de Casteljau). */
function fimDaCubica([p0, p1, p2, p3]: Cubica, t: number): Cubica {
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  return [lerp(d, e, t), e, c, p3];
}

/** Pena em foice: linha central cúbica (base → ponta) engordada por `w` na normal da corda. */
function foice([p0, p1, p2, p3]: Cubica, w: number): string {
  const dx = p3[0] - p0[0];
  const dy = p3[1] - p0[1];
  const l = Math.hypot(dx, dy);
  const nx = (-dy / l) * w;
  const ny = (dx / l) * w;
  return (
    `M${f1(p0[0])} ${f1(p0[1])}C${f1(p1[0] + nx)} ${f1(p1[1] + ny)} ${f1(p2[0] + nx)} ${f1(p2[1] + ny)} ${f1(p3[0])} ${f1(p3[1])}` +
    `C${f1(p2[0] - nx * 0.5)} ${f1(p2[1] - ny * 0.5)} ${f1(p1[0] - nx * 0.5)} ${f1(p1[1] - ny * 0.5)} ${f1(p0[0])} ${f1(p0[1])}Z`
  );
}

// Cauda: 5 foices longas de trás para a frente, subindo do sobre (≈40,78) num arco alto para trás
// (esquerda) e caindo na ponta; a de cima é a mais longa. Tons alternados (verde / verde-azulado).
const FOICES: [Cubica, number][] = [
  [[[43, 74], [38, 38], [13, 24], [5, 46]], 7.6],
  [[[41, 77], [29, 46], [6, 40], [2, 61]], 7],
  [[[40, 81], [25, 59], [4, 62], [5, 79]], 6.4],
  [[[40, 85], [27, 75], [11, 79], [12, 93]], 5.6],
  [[[42, 89], [33, 88], [23, 94], [24, 103]], 4.6],
];
const CAUDA = FOICES.map(([c, w]) => foice(c, w));
// Brilho de dorso (luz de cima) em cada foice: separa as penas entre si.
const CAUDA_BRILHO = FOICES.slice(0, 4)
  .map(([[a, b, c, d], w]) => {
    const dx = d[0] - a[0];
    const dy = d[1] - a[1];
    const l = Math.hypot(dx, dy);
    const k = w * 0.6;
    const [nx, ny] = [(-dy / l) * k, (dx / l) * k];
    return `M${f1(a[0] + (b[0] - a[0]) * 0.55 + nx * 0.5)} ${f1(a[1] + (b[1] - a[1]) * 0.55 + ny * 0.5)}C${f1(b[0] + nx)} ${f1(b[1] + ny)} ${f1(c[0] + nx)} ${f1(c[1] + ny)} ${f1(c[0] + (d[0] - c[0]) * 0.45)} ${f1(c[1] + (d[1] - c[1]) * 0.45)}`;
  })
  .join('');
// Reflexo furta-cor roxo-azulado na metade da ponta de cada foice (lente fina dentro da pena).
const CAUDA_REFLEXO = FOICES.slice(0, 4)
  .map(([c, w]) => foice(fimDaCubica(c, 0.52), w * 0.5))
  .join('');

/** Pena lanceolada (capa do pescoço): folha pontuda da base à ponta, larga `w`, arqueada `cv` na normal. */
function lanca(b: P, t: P, w: number, cv: number): string {
  const dx = t[0] - b[0];
  const dy = t[1] - b[1];
  const l = Math.hypot(dx, dy);
  const [nx, ny] = [-dy / l, dx / l];
  const mx = (b[0] + t[0]) / 2 + nx * cv;
  const my = (b[1] + t[1]) / 2 + ny * cv;
  return `M${b[0]} ${b[1]}Q${f1(mx + nx * w)} ${f1(my + ny * w)} ${t[0]} ${t[1]}Q${f1(mx - nx * w)} ${f1(my - ny * w)} ${b[0]} ${b[1]}Z`;
}

// Penas da sela (dourado) cobrindo a base da cauda: 3 pontas caindo para trás.
const SELA = 'M52 70C45 68 39.4 70.6 36.4 75.4L41.2 75L34.6 80.8L41.4 80L36.4 86.6L43.6 84L42 90.4L50 82Z';

// Corpo: costas afundadas (sela) entre pescoço e cauda, peito estufado para a frente, barriga RECOLHIDA
// (fundo em y≈102,6, deixando as canelas à mostra).
const CORPO =
  'M40 72.4C47 68.6 54 68.4 60 70.6C67 67.4 77 66.6 84.4 69.4C92.6 72.4 96.6 80.6 95.4 89C94.4 96.4 87 102.4 72 102.6' +
  'C60 102.8 49 100.6 43 95.6C37.6 91 34.4 84.4 36 78C36.8 75.6 38 73.8 40 72.4Z';
// Sombra cel: crescente embaixo à direita (barriga e frente do peito).
const CORPO_CEL = 'M95.4 88.4C94.4 96.6 86.8 102.4 72 102.6C60.6 102.8 50 100.8 43.8 96.4C52.6 99 61.6 99.4 70.4 98.6C83 97.4 91.8 94 95.4 88.4Z';
// Babador: lágrima clara que começa na ponta do lenço e enche a frente do peito (afastada ~2 da borda do
// corpo; a asa cobre a ponta de trás). Sombra cel #f6a25a na base e 2 escamas grandes.
const PEITO = 'M65.6 70.8C73 68.4 83.4 69.2 88.6 74.4C92.4 78.4 93.4 85 92 90.4C90.6 95.4 87 98.4 83 99.6C76.2 97.6 70.4 92.6 67.4 86.4C65.6 82.4 65 76.6 65.6 70.8Z';
const PEITO_CEL = 'M92 90.4C90.6 95.4 87 98.4 83 99.6C76.2 97.6 70.4 92.6 67.4 86.4C72.6 91.2 79 94 84.6 94.2C87.8 94.2 90.4 92.8 92 90.4Z';
const PEITO_ESCAMAS = 'M80.2 79.6a4 4 0 0 0 8 0M74.6 88.4a4 4 0 0 0 8 0';

// Asa (flanco): forma grande laranja-escura do ombro até além da traseira (as pontas passam do contorno do
// corpo por cima da cauda: quebra o "ovo"), com a borda de baixo em leque de 4 recortes redondos.
const ASA = 'M64.6 74C58 69.6 46 70.4 38 76C33 79.6 28.6 84.6 26.4 90.4Q29.4 95.4 34.4 92.6Q37.4 98.4 43.2 95.6Q47 100.6 52.8 97Q57.8 100.4 61.6 95.2Q66.4 92.6 67 85.8C67.4 81 66.6 77 64.6 74Z';
const ASA_LINHAS = 'M34.4 92.6Q37.6 88.6 41.6 86.4M43.2 95.6Q46 90.8 50 88.4M52.8 97Q55.4 92.4 58.6 90.2';
const ASA_LUZ = 'M62.4 73.4Q55 70.4 46 72.6Q39.6 74.4 34.6 79';

// Asa de LÁ (só no aceno): erguida por trás da cabeça, à direita, com a "mão" em leque de 4 penas abertas.
// Desenhada em pé (base na origem, ponta para cima) e posta no ombro de lá; o CSS a abana no ombro.
const ACENO_OMBRO: P = [86, 76];
const ACENO_GIRO = 32;
const ASA_ACENO =
  'M-5.4 4C-8.6 -8 -11.2 -20 -11.6 -31Q-12.4 -38.6 -6.4 -38.4Q-5.6 -44.6 -.6 -44.2Q3.6 -46.6 6.2 -41Q11.4 -41.6 11.6 -35.6' +
  'C11.8 -24 9.6 -9.6 5.4 4Z';
const ASA_ACENO_LINHAS = 'M-6.4 -38.4Q-5.4 -33.4 -3.8 -29.6M-.6 -44.2Q-.2 -37 .4 -31.6M6.2 -41Q5.4 -35.4 4 -30.6';
const ASA_ACENO_LUZ = 'M-8.2 -10Q-10.4 -21 -10 -30.6';

// Capa: 4 penas lanceoladas do pescoço caindo para TRÁS sobre o dorso e o ombro da asa (ponta para a esquerda e
// para baixo), no laranja da cabeça: continuação do pescoço, não acessório. Ordem: de trás para a frente.
const CAPA_PENAS = [
  lanca([57, 56], [38.6, 72], 6, -1.6),
  lanca([59, 59], [42.4, 77.4], 6.4, -1.4),
  lanca([62, 61], [48.4, 80.4], 6.4, -1),
  lanca([65.4, 62], [55.8, 80.2], 5.6, -0.6),
];
/** Nervura clara nas duas penas da frente (luz de cima). */
const CAPA_LUZ = 'M57.6 64Q52.4 71.6 49.6 76.4M62 66Q59 72.4 57.2 76.6';

// Lenço xadrez amarrado justo no pescoço (faixa estreita = pescoço fino) + ponta caindo sobre o peito.
const LENCO = 'M53.6 61.4Q66.4 67.8 82.2 60.8L82.6 66.4Q81.4 75.6 74.6 84.6Q69.8 77.6 65 72.4Q58.4 70.8 53.8 67.6Z';
const LENCO_CEL = 'M82.6 66.4Q81.4 75.6 74.6 84.6Q72.4 81 69.8 77.8Q77 75.4 82.6 66.4Z';
const LENCO_DOBRA = 'M55.4 64.6Q67 70.6 82 64';

// Cabeça (redonda; o rosto fica à direita, 3/4).
const CABECA = 'M64 26C74.8 26 83.6 34.4 83.6 45C83.6 55.6 74.8 64.2 64 64.2C53.2 64.2 44.4 55.6 44.4 45C44.4 34.4 53.2 26 64 26Z';
const CABECA_CEL = 'M83.4 47.6C82.2 57.4 74.2 64 64 64C57.4 64 51.8 61.4 48 57C53 60.2 58.2 61.4 63.6 61.2C73.4 60.6 80.6 55.6 83.4 47.6Z';
// Sombra da aba na testa (faixa fina, nítida): assenta o chapéu na cabeça.
const SOMBRA_ABA = 'M45.6 38.4C51 34.6 60 33.4 69 33.6C75 33.8 80 35 82.6 37.2C78 36.6 72 36.6 66 37C58.4 37.6 51.2 38.6 45.6 38.4Z';

// Crista: perfil de pente com 3 lóbulos redondos de altura decrescente da frente (direita) para trás,
// separados por chanfros (o traço atrás do preenchimento enche cada um); os lados descem retos para dentro
// da copa, que é desenhada por cima e esconde a base (nada de "talo" estreito: lia chapéu de cozinheiro).
// Assentada 2,4 mais funda na copa que na rodada anterior: mostra ~9,5 acima do furo (cabe na caixa).
const CRISTA =
  'M56.2 14C55 10.6 54.2 7.4 54.8 5.4C55.6 2.8 59 2.6 59.8 5.8L60.2 8.2C59.2 3.4 60.6 -.4 63.4 -.6C66 -.8 67.2 2 66.6 6.2' +
  'C67 1.2 69.2 -2.4 72 -1.8C74.8 -1.2 75 3.4 73.6 7.2C72.8 9.6 71.8 12 71 14Z';
/** Um brilho rosado pequeno no alto de cada lóbulo (como as gotas da crista da galinha): separa os lóbulos. */
const CRISTA_REALCE = elipse(70, .6, 1.2, 1.6) + elipse(62.4, 1.6, 1, 1.4) + elipse(56.6, 4.6, .8, 1.1);
const CRISTA_POS = 'translate(0 7)';

// Chapéu de palha (desenhado reto; o grupo inclina a aba para trás, deixando o rosto à mostra).
const ABA = 'M35 28C35 22.8 47.6 19 63 19C78.4 19 91 22.8 91 28C91 33.2 78.4 35.2 63 35.2C47.6 35.2 35 33.2 35 28Z';
const ABA_BAIXO = 'M35.4 29.6C39.2 33.6 50 35.2 63 35.2C76 35.2 86.8 33.6 90.6 29.6C87.4 32 76 33 63 33C50 33 38.6 32 35.4 29.6Z';
const ABA_LUZ = 'M38.4 26.2Q42 23.2 48.4 21.8M79.6 21.8Q86.4 23.2 89.6 25.8';
const COPA = 'M47.4 27.4C46.8 20.6 50.8 15.2 57.6 14.2Q63 16.4 68.4 14.2C75.2 15.2 79.2 20.6 78.6 27.4C72 30.2 54 30.2 47.4 27.4Z';
const COPA_CEL = 'M78.6 27.4C79 22.6 77.6 18.6 74.4 16.2C75.6 19.8 75.2 24 72.6 28.8C75 28.6 77 28.2 78.6 27.4Z';
const FITA = 'M47.1 22.6C54.4 25 71.6 25 78.9 22.6L78.9 27.4C72 30.2 54 30.2 47.2 27.4Z';
/** Pose do chapéu (aba para trás); na surpresa ele salta e inclina mais. */
const CHAPEU_POSE = 'translate(-.6 -2.6) rotate(-12 63 28)';
const CHAPEU_SUSTO = 'translate(-.2 -6) rotate(-8 63 28)';

// Pés: CANELA curta e grossa (aparece ~6 entre a barriga e os dedos) + esporão atrás + 3 dedos para a
// frente (direita), os dois pés num <path>. Fora do tronco inclinado: ficam a prumo no chão.
function pe(x: number): string {
  const p = (dx: number, y: number) => `${f1(x + dx)} ${f1(y)}`;
  return (
    `M${p(-2.6, 97)}V103.4L${p(-5.8, 102.8)}L${p(-2.5, 105.8)}V108.6Q${p(-5, 109)} ${p(-5.4, 111.6)}Q${p(-5.4, 113.8)} ${p(-3, 113.6)}` +
    `L${p(2.6, 113.6)}Q${p(4, 115)} ${p(5.8, 113.6)}L${p(8.4, 113.6)}Q${p(10.8, 113.4)} ${p(10.2, 111.2)}Q${p(9.4, 109.4)} ${p(6.4, 109.6)}` +
    `Q${p(3.6, 108.4)} ${p(2.3, 108.2)}V97Z`
  );
}
const PES = pe(56) + pe(73);
const PES_DEDOS = 'M55.4 113.4Q57.6 111.6 60.4 111.4M72.4 113.4Q74.6 111.6 77.4 111.4';
/** Escamas da canela (2 riscos claros por perna) e o realce de cima-esquerda. */
const PES_ESCAMAS = 'M54.4 103.6H57.2M54.4 106.2H57.2M71.4 103.6H74.2M71.4 106.2H74.2';

// Raminho de trigo enfiado na fita do chapéu, ao lado do remendo, inclinado para trás (coordenadas do chapéu,
// antes da inclinação da aba): o talo passa sobre a copa e a espiga sai contra o céu à esquerda da crista.
const TRIGO_S: P = [60.4, 26];
const TRIGO_C: P = [52.6, 15.6];
const TRIGO_T: P = [41.6, 8.4];
function trigo(t: number): { x: number; y: number; a: number } {
  const m = 1 - t;
  const x = m * m * TRIGO_S[0] + 2 * m * t * TRIGO_C[0] + t * t * TRIGO_T[0];
  const y = m * m * TRIGO_S[1] + 2 * m * t * TRIGO_C[1] + t * t * TRIGO_T[1];
  const dx = 2 * m * (TRIGO_C[0] - TRIGO_S[0]) + 2 * t * (TRIGO_T[0] - TRIGO_C[0]);
  const dy = 2 * m * (TRIGO_C[1] - TRIGO_S[1]) + 2 * t * (TRIGO_T[1] - TRIGO_C[1]);
  return { x, y, a: (Math.atan2(dy, dx) * 180) / Math.PI };
}
const CAPIM_TALO = `M${TRIGO_S[0]} ${TRIGO_S[1]}Q${TRIGO_C[0]} ${TRIGO_C[1]} ${TRIGO_T[0]} ${TRIGO_T[1]}`;
type Grao = { x: number; y: number; a: number };
// 4 grãos alternados no terço final + o da ponta (eixo do grão = tangente ± 28°).
const GRAOS: Grao[] = [0.62, 0.72, 0.82, 0.91].map((t, i) => {
  const p = trigo(t);
  const lado = i % 2 === 0 ? 1 : -1;
  const r = ((p.a + 90) * Math.PI) / 180;
  return { x: f1(p.x + Math.cos(r) * 1.7 * lado), y: f1(p.y + Math.sin(r) * 1.7 * lado), a: f1(p.a + 90 + 28 * lado) };
});
const PONTA = trigo(1);
GRAOS.push({ x: f1(PONTA.x - 1), y: f1(PONTA.y - 0.4), a: f1(PONTA.a + 90) });
// barbas (praganas) saindo da ponta
const BARBAS = `M${f1(PONTA.x - 2)} ${f1(PONTA.y - 1.2)}l-4.4 -2.4M${f1(PONTA.x - 1)} ${f1(PONTA.y - 2.2)}l-2.8 -4.2M${f1(PONTA.x + 1.4)} ${f1(PONTA.y - 2)}l-.6 -5`;

// Bico: dobradiça no canto da boca; o de baixo GIRA para abrir (lê a 80 px: ~7 px de abertura na ponta).
const DOBRA: P = [78.6, 59];
// A raiz fica em x ≥ 77.6: ~1 de pele laranja entre o olho de longe e o contorno do bico.
const BICO_CIMA = 'M77.6 52.4C83.4 50.4 91 52.8 96.8 58C91 59.8 84.6 60.2 78.8 59.3C78 57.4 77.6 55 77.6 52.4Z';
/** Realce curto em gota perto da base (não risca o bico inteiro). */
const BICO_CIMA_REALCE = 'M78.6 53Q82 51.6 85.4 52.6Q82.4 54 79.4 54.8Z';
const BICO_BAIXO = 'M78.6 59.2C84 59.6 89.4 59.4 93.8 58.8C91.8 63.8 85.6 66.4 79.8 65.4C78.8 63.6 78.4 61.4 78.6 59.2Z';
// Boca e língua (giram com o bico de baixo): cunha que, fechada, fica escondida sob o bico de cima e,
// aberta, preenche o vão entre os dois bicos.
const BOCA = 'M78.6 59.2L94 58.8L93 56.4L87.6 53.2L80.8 52.8Z';
const LINGUA = 'M80.6 59.2Q85.6 52.8 92.6 58.6Q86 60.8 80.6 59.2Z';
/** Vinco do sorriso no canto do bico (feliz/piscando). */
const VINCO = 'M75.4 60.2q1.8 2.2 4.2 1.4';
// Barbela curta (termina em y≈74): não cobre o topo do babador.
const BARBELA = 'M80.2 62.6C76 65.4 75.4 70.8 78 73.6C80.8 76.2 84.8 73.8 84.8 69.4C84.6 66.6 83.8 64.2 82.4 62.6Z';
const BARBELA_TRAS = 'M78 63C74.8 64.6 73.4 68.2 74.6 70.8C75.8 72.6 78 71.8 78.8 69.6Z';

// --------------------------------------------------------------------------------------- olhos
interface Olho {
  x: number;
  y: number;
  rx: number;
  ry: number;
}
// 3/4: o olho de longe é mais estreito e fica perto do bico.
const OLHO_PERTO: Olho = { x: 57.4, y: 48.8, rx: 7.3, ry: 8.8 };
const OLHO_LONGE: Olho = { x: 70.2, y: 48.4, rx: 5.1, ry: 8.2 };
/** Surpresa: olho oval VERTICAL (mais alto, mesma largura). */
const ALTURA_SUSTO = 1.13;

/** Sobrancelha em pincelada: crescente afilado de 11 de largura, centrado em (0,0), grosso no meio. */
function sobrancelha(arco: number): string {
  return `M-5.5 1.2Q0 ${f1(-1.4 - 2 * arco)} 5.5 1.2Q0 ${f1(1.4 - 2 * arco)} -5.5 1.2Z`;
}

/** Sobrancelha: deslocamento vertical a partir do topo do olho (− = sobe), giro (− = ponta esquerda desce) e arco. */
type Brow = [dy: number, giro: number, arco: number];
interface Rosto {
  brow: [Brow, Brow];
  /** Abertura do bico (graus). */
  bico: number;
}
// Pontas de FORA mais baixas = arco simpático de quem conta história (nunca o "V" bravo). Na surpresa as
// sobrancelhas sobem e se arqueiam LONGE do olho (não dependem do "!" para ler).
const ROSTO: Record<ExpressaoJuca, Rosto> = {
  feliz: { brow: [[-1.2, -5, 1.4], [-1.2, 5, 1.4]], bico: 24 },
  falando: { brow: [[-2.2, -7, 1.9], [-2.2, 7, 1.9]], bico: 0 },
  surpreso: { brow: [[-3, -3, 3.2], [-2.6, 3, 3.2]], bico: 38 },
  piscando: { brow: [[-2.8, -7, 2.1], [0.4, 3, 1.2]], bico: 18 },
};

/** Olho aberto, redondo e vivo (fala) ou arregalado (surpresa: oval alto, pupila miúda, brilho grande). */
function OlhoAberto({ o, k, u, arregalado }: { o: Olho; k: number; u: string; arregalado: boolean }) {
  const ry = o.ry * (arregalado ? ALTURA_SUSTO : 1);
  const ri = (arregalado ? 3.7 : 5) * k;
  const rp = (arregalado ? 1.6 : 3.1) * k;
  const ix = o.x + (arregalado ? 0 : 0.9) * k;
  const iy = o.y + (arregalado ? 0 : 0.7);
  return (
    <g>
      <ellipse cx={o.x} cy={o.y} rx={o.rx} ry={f1(ry)} fill={`url(#${u}-esclera)`} />
      <circle cx={ix} cy={iy} r={ri} fill={`url(#${u}-iris)`} />
      <circle cx={ix} cy={iy} r={rp} fill="#1e1426" />
      {arregalado ? (
        <>
          <circle cx={ix - 1.5 * k} cy={iy - 1.9 * k} r={1.9 * k} fill="#fff" />
          <circle cx={ix + 1.6 * k} cy={iy + 1.7 * k} r={0.8 * k} fill="#fff" opacity={0.9} />
        </>
      ) : (
        <>
          <circle cx={ix - 1.9 * k} cy={iy - 2.4 * k} r={2.2 * k} fill="#fff" />
          <circle cx={ix + 1.8 * k} cy={iy + 2.1 * k} r={1.05 * k} fill="#fff" opacity={0.9} />
        </>
      )}
    </g>
  );
}

/** Olho fechado de alegria/piscadela: "^" em crescente (mais grosso no meio, pontas redondas). */
function OlhoPiscado({ o }: { o: Olho }) {
  const w = o.rx * 0.95;
  const b = o.y + 2.6;
  return (
    <path
      d={`M${f1(o.x - w)} ${f1(b)}Q${o.x} ${f1(o.y - 7.4)} ${f1(o.x + w)} ${f1(b)}Q${o.x} ${f1(o.y - 3.2)} ${f1(o.x - w)} ${f1(b)}Z`}
      fill={PINCEL}
      stroke={PINCEL}
      strokeWidth={1.3}
      strokeLinejoin="round"
    />
  );
}

/** Piscar ocioso: pálpebra (sem contorno) que desce do topo + linha "‿" na borda (CSS .juca-palpebra). */
function Piscada({ o }: { o: Olho }) {
  const w = o.rx * 0.95;
  return (
    <g className="juca-palpebra">
      <ellipse cx={o.x} cy={o.y} rx={o.rx + 0.7} ry={o.ry + 0.7} fill={PALPEBRA} />
      <path d={`M${f1(o.x - w)} ${f1(o.y + 1)}Q${o.x} ${f1(o.y + o.ry * 0.6)} ${f1(o.x + w)} ${f1(o.y + 1)}`} {...linha(PINCEL, 2.2, 1)} />
    </g>
  );
}

/** Brilho de 4 pontas finas e côncavas. */
function estrela(x: number, y: number, r: number): string {
  const c = r * 0.21;
  return `M${x} ${f1(y - r)}Q${f1(x + c)} ${f1(y - c)} ${f1(x + r)} ${y}Q${f1(x + c)} ${f1(y + c)} ${x} ${f1(y + r)}Q${f1(x - c)} ${f1(y + c)} ${f1(x - r)} ${y}Q${f1(x - c)} ${f1(y - c)} ${x} ${f1(y - r)}Z`;
}

// ------------------------------------------------------------------------------------------- defs
function Defs({ u }: { u: string }) {
  return (
    <defs>
      <radialGradient id={`${u}-corpo`} cx=".42" cy=".3" r=".78" fx=".34" fy=".2">
        <stop offset="0" stopColor="#f59a58" />
        <stop offset=".38" stopColor="#de6a32" />
        <stop offset=".78" stopColor="#c9542a" />
        <stop offset="1" stopColor="#9a3428" />
      </radialGradient>
      <radialGradient id={`${u}-cabeca`} cx=".36" cy=".36" r=".72" fx=".28" fy=".3">
        <stop offset="0" stopColor="#ffbe7a" />
        <stop offset=".35" stopColor="#f2873a" />
        <stop offset=".78" stopColor="#e8742f" />
        <stop offset="1" stopColor="#c04c2c" />
      </radialGradient>
      <linearGradient id={`${u}-capa`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fbb85a" />
        <stop offset=".45" stopColor="#f9ad48" />
        <stop offset="1" stopColor="#e07a30" />
      </linearGradient>
      {/* Cauda em 2 tons alternados: brilho no alto do arco, escurecendo para a ponta. */}
      <linearGradient id={`${u}-cauda`} x1=".2" y1="0" x2=".5" y2="1">
        <stop offset="0" stopColor="#7be3aa" />
        <stop offset=".32" stopColor="#2fa36b" />
        <stop offset=".72" stopColor="#23845a" />
        <stop offset="1" stopColor="#1b6648" />
      </linearGradient>
      <linearGradient id={`${u}-cauda2`} x1=".2" y1="0" x2=".5" y2="1">
        <stop offset="0" stopColor="#6fd3d6" />
        <stop offset=".32" stopColor="#1f7f8f" />
        <stop offset=".72" stopColor="#1b6a7a" />
        <stop offset="1" stopColor="#165563" />
      </linearGradient>
      <linearGradient id={`${u}-asa`} x1="0" y1="0" x2=".3" y2="1">
        <stop offset="0" stopColor="#e47634" />
        <stop offset=".5" stopColor="#cc5a2a" />
        <stop offset="1" stopColor="#a8422a" />
      </linearGradient>
      <radialGradient id={`${u}-crista`} cx=".36" cy=".3" r=".8" fx=".3" fy=".2">
        <stop offset="0" stopColor="#ff8a6a" />
        <stop offset=".42" stopColor="#ff4a3a" />
        <stop offset=".8" stopColor="#f03c34" />
        <stop offset="1" stopColor="#d42c30" />
      </radialGradient>
      <linearGradient id={`${u}-bico`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffe58a" />
        <stop offset=".45" stopColor="#ffc23a" />
        <stop offset="1" stopColor="#e0841c" />
      </linearGradient>
      <linearGradient id={`${u}-pe`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffc46a" />
        <stop offset=".5" stopColor="#f2a23a" />
        <stop offset="1" stopColor="#cc6f1e" />
      </linearGradient>
      <radialGradient id={`${u}-copa`} cx=".34" cy=".26" r=".85" fx=".28" fy=".18">
        <stop offset="0" stopColor="#fff3c4" />
        <stop offset=".35" stopColor="#ffe7a6" />
        <stop offset=".72" stopColor="#f2c46b" />
        <stop offset="1" stopColor="#c8913c" />
      </radialGradient>
      <linearGradient id={`${u}-aba`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff0b4" />
        <stop offset=".5" stopColor="#f2c46b" />
        <stop offset="1" stopColor="#d49c45" />
      </linearGradient>
      <linearGradient id={`${u}-fita`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ff6a55" />
        <stop offset=".5" stopColor="#c8352b" />
        <stop offset="1" stopColor="#8e1f1c" />
      </linearGradient>
      <linearGradient id={`${u}-esclera`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ecd2bc" />
        <stop offset=".22" stopColor="#fffdf8" />
        <stop offset=".6" stopColor="#ffffff" />
        <stop offset="1" stopColor="#d3deec" />
      </linearGradient>
      <linearGradient id={`${u}-iris`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2a160a" />
        <stop offset=".45" stopColor="#5a3a1e" />
        <stop offset="1" stopColor="#b8844c" />
      </linearGradient>
      <radialGradient id={`${u}-realce`} cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#fffdf7" stopOpacity=".85" />
        <stop offset=".55" stopColor="#fffdf7" stopOpacity=".4" />
        <stop offset="1" stopColor="#fffdf7" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${u}-bochecha`} cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#ff5f7a" />
        <stop offset=".55" stopColor="#ff6f86" stopOpacity=".7" />
        <stop offset="1" stopColor="#ff7b8a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${u}-sombra`} cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#2b1a0f" stopOpacity=".38" />
        <stop offset=".6" stopColor="#2b1a0f" stopOpacity=".18" />
        <stop offset="1" stopColor="#2b1a0f" stopOpacity="0" />
      </radialGradient>
      {/* Trama da palha: grade girada 45° = losangos. */}
      <pattern id={`${u}-trama`} width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0H3.4M0 0V3.4" stroke="#9a6424" strokeWidth=".8" />
      </pattern>
      {/* Xadrez do lenço (azul) e do remendo (vermelho): base clara + listras translúcidas cruzadas. */}
      <pattern id={`${u}-xadrez`} width="4.4" height="4.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
        <rect width="4.4" height="4.4" fill="#e3efff" />
        <rect width="2.2" height="4.4" fill="#2f7be0" opacity=".6" />
        <rect width="4.4" height="2.2" fill="#2f7be0" opacity=".6" />
      </pattern>
      <pattern id={`${u}-remendo`} width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
        <rect width="2.4" height="2.4" fill="#fff4e2" />
        <rect width="1.2" height="2.4" fill="#d6392c" opacity=".7" />
        <rect width="2.4" height="1.2" fill="#d6392c" opacity=".7" />
      </pattern>
    </defs>
  );
}

// --------------------------------------------------------------------------------------- desenho
export function Juca({ className, expressao = 'feliz', sombra = true, acenando = false, parado = false, style }: PropsJuca) {
  const exp: ExpressaoJuca = expressao in SINONIMO ? SINONIMO[expressao as ExpressaoDoc] : (expressao as ExpressaoJuca);
  // useId traz caracteres (":", "«") que atrapalham url(#…): fica só o que é seguro em id.
  const u = `gi-juca-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const r = ROSTO[exp];
  const feliz = exp === 'feliz';
  const surpreso = exp === 'surpreso';
  const piscando = exp === 'piscando';
  const sorri = feliz || piscando;
  const cls = ['juca', `juca-${exp}`, acenando ? 'juca-acenando' : '', parado ? 'juca-parado' : '', className ?? ''].filter(Boolean).join(' ');
  const gira = (n: number) => `rotate(${n} ${DOBRA[0]} ${DOBRA[1]})`;

  return (
    <svg viewBox="0 0 120 120" className={cls} style={style} aria-hidden>
      <Defs u={u} />
      {/* 1º <ellipse> filho direto do <svg>: ui.css o esconde onde a sombra é desenhada por fora */}
      {sombra && <ellipse className="juca-sombra" cx={66.6} cy={115.6} rx={29} ry={4} fill={`url(#${u}-sombra)`} />}

      <g transform={RAIZ}>
        <g className="juca-corpo">
          {/* pés a prumo: canelas grossas com escamas + dedos */}
          <path d={PES} fill={`url(#${u}-pe)`} {...sil(CONT_BICO, 1.8)} />
          <path d={PES_DEDOS + PES_ESCAMAS} {...linha(CONT_BICO, 1.1, 0.55)} />

          {/* tronco com porte de galo: inclinado para trás no quadril (peito à frente) */}
          <g transform={TRONCO}>
            {/* cauda em foice (2 tons + reflexo furta-cor) + penas da sela */}
            <g className="juca-cauda">
              {CAUDA.map((d, i) => (
                <path key={d} d={d} fill={`url(#${u}-${i % 2 ? 'cauda2' : 'cauda'})`} {...sil(CONT_CAUDA, i === CAUDA.length - 1 ? 3.2 : 2.6)} />
              ))}
              <path d={CAUDA_REFLEXO} fill="#5b6fd6" opacity={0.35} />
              <path d={CAUDA_BRILHO} {...linha('#c4f7dc', 1.5, 0.7)} />
              <path d={SELA} fill={`url(#${u}-capa)`} {...sil(CONT_CORPO, 2.2)} />
            </g>

            {/* asa de lá acenando: atrás do corpo e da cabeça, a "mão" em leque aparece à direita contra o céu */}
            {acenando && (
              <g className="juca-aceno">
                <g transform={`translate(${ACENO_OMBRO[0]} ${ACENO_OMBRO[1]}) rotate(${ACENO_GIRO})`}>
                  <path d={ASA_ACENO} fill={`url(#${u}-asa)`} {...sil(CONT_CORPO, 2.6)} />
                  <path d={ASA_ACENO_LINHAS} {...linha('#6e2216', 1.4, 0.6)} />
                  <path d={ASA_ACENO_LUZ} {...linha('#f59a58', 2, 0.9)} />
                </g>
              </g>
            )}

            {/* corpo ferrugem, babador claro (chapado + cel na base + escamas), sombra cel e brilho de borda frio */}
            <path d={CORPO} fill={`url(#${u}-corpo)`} {...sil(CONT_CORPO)} />
            <path d={PEITO} fill={PEITO_COR} stroke={PEITO_LINHA} strokeWidth={1.4} strokeOpacity={0.55} strokeLinejoin="round" />
            <path d={PEITO_CEL} fill={PEITO_CEL_COR} />
            <ellipse cx={80} cy={74.6} rx={6} ry={2.4} fill="#fff1dc" opacity={0.85} transform="rotate(8 80 74.6)" />
            <path d={PEITO_ESCAMAS} {...linha(PEITO_LINHA, 2.4, 1)} />
            <path d={CORPO_CEL} fill={CEL_CORPO} opacity={0.32} />
            <path d="M94.4 90.6Q92.4 97.6 86.6 100.4" {...linha(BORDA_LUZ, 1.6, 1)} opacity={0.7} />

            {/* asa dobrada em leque no flanco (sempre: o corpo nunca vira um "ovo" liso) */}
            <g className="juca-asa">
              <path d={ASA} fill={`url(#${u}-asa)`} {...sil(CONT_CORPO, 2.6)} />
              <path d={ASA_LINHAS} {...linha('#6e2216', 1.4, 0.55)} />
              <path d={ASA_LUZ} {...linha('#f59a58', 2, 0.9)} />
            </g>

            {/* cabeça (capa, lenço, rosto, chapéu) */}
            <g className="juca-cabeca">
              {CAPA_PENAS.map((d) => (
                <path key={d} d={d} fill={`url(#${u}-capa)`} {...sil(CONT_CABECA, 2)} />
              ))}
              <path d={CAPA_LUZ} {...linha('#ffd08a', 1.3, 0.75)} />

              <path d={LENCO} fill={`url(#${u}-xadrez)`} {...sil(CONT_LENCO, 2.2)} />
              <path d={LENCO_CEL} fill="#123c86" opacity={0.42} />
              <path d={LENCO_DOBRA} {...linha(CONT_LENCO, 1.2, 0.5)} />

              {/* rosto + chapéu ampliados ~9% em volta do pescoço */}
              <g transform="translate(64 63.4) scale(1.09) translate(-64 -62)">
                <path d={CABECA} fill={`url(#${u}-cabeca)`} {...sil(CONT_CABECA)} />
                <path d={CABECA_CEL} fill={CEL_CABECA} opacity={0.45} />
                <path d={SOMBRA_ABA} fill={CEL_CABECA} opacity={0.4} />

                {/* barbela curta (balança atrasada, atrás do bico de baixo) */}
                <g className="juca-barbela">
                  <path d={BARBELA_TRAS} fill={`url(#${u}-crista)`} {...sil(CONT_CRISTA, 1.6)} />
                  <path d={BARBELA} fill={`url(#${u}-crista)`} {...sil(CONT_CRISTA, 1.8)} />
                  <ellipse cx={79.6} cy={66.8} rx={1.1} ry={1.9} fill="#ffb4a0" opacity={0.7} />
                </g>

                {/* bochechas */}
                <ellipse cx={50.4} cy={58} rx={sorri ? 6.2 : 5.6} ry={sorri ? 3.6 : 3.2} fill={`url(#${u}-bochecha)`} opacity={sorri ? 1 : 0.7} />
                <ellipse cx={73.2} cy={58.6} rx={2.8} ry={2} fill={`url(#${u}-bochecha)`} opacity={sorri ? 0.9 : 0.6} />

                {/* olhos: feliz = "^ ^"; piscando = um aberto + piscadela; surpreso = ovais altos */}
                <g className="juca-olhos">
                  {feliz ? (
                    <>
                      <OlhoPiscado o={OLHO_PERTO} />
                      <OlhoPiscado o={OLHO_LONGE} />
                    </>
                  ) : (
                    <>
                      <OlhoAberto o={OLHO_PERTO} k={1} u={u} arregalado={surpreso} />
                      {piscando ? <OlhoPiscado o={OLHO_LONGE} /> : <OlhoAberto o={OLHO_LONGE} k={0.84} u={u} arregalado={surpreso} />}
                    </>
                  )}
                  {!surpreso && !feliz && (
                    <g className="juca-palpebras">
                      <Piscada o={OLHO_PERTO} />
                      {!piscando && <Piscada o={OLHO_LONGE} />}
                    </g>
                  )}
                </g>

                {/* sobrancelhas em pincelada, coladas no topo dos olhos (na surpresa, altas e arqueadas) */}
                <g className="juca-sobrancelhas">
                  {([OLHO_PERTO, OLHO_LONGE] as const).map((o, i) => {
                    const [dy, giro, arco] = r.brow[i === 0 ? 0 : 1];
                    const esc = i === 0 ? 1 : 0.84;
                    const topo = o.y - o.ry * (surpreso ? ALTURA_SUSTO : 1);
                    return (
                      <path
                        key={i}
                        d={sobrancelha(arco)}
                        transform={`translate(${f1(o.x + (i === 0 ? -0.6 : 0.4))} ${f1(topo + dy)}) rotate(${giro}) scale(${esc})`}
                        fill={PINCEL}
                        stroke={PINCEL}
                        strokeWidth={1.1}
                        strokeLinejoin="round"
                      />
                    );
                  })}
                </g>

                {/* bico: o de baixo abre na dobradiça (na surpresa, "O" escuro sem língua) */}
                <g className="juca-bico">
                  <g className="juca-bico-baixo">
                    <g transform={r.bico ? gira(r.bico) : undefined}>
                      <path d={BOCA} fill="#55101a" />
                      {!surpreso && <path d={LINGUA} fill="#ff7a8a" />}
                      <path d={BICO_BAIXO} fill={`url(#${u}-bico)`} {...sil(CONT_BICO, 1.6)} />
                    </g>
                  </g>
                  <path d={BICO_CIMA} fill={`url(#${u}-bico)`} {...sil(CONT_BICO, 1.8)} />
                  <path d={BICO_CIMA_REALCE} fill="#fff" opacity={0.5} />
                  <ellipse cx={86.6} cy={54.2} rx={1} ry={0.6} fill="#b06a10" transform="rotate(14 86.6 54.2)" />
                  {sorri && <path d={VINCO} {...linha(CONT_CABECA, 1.4, 0.8)} />}
                </g>

                {/* chapéu de palha: aba inclinada para trás; a crista fura a copa; trigo enfiado na fita */}
                <g className="juca-chapeu">
                  <g transform={surpreso ? CHAPEU_SUSTO : CHAPEU_POSE}>
                    <path d={ABA} fill={`url(#${u}-aba)`} {...sil(CONT_PALHA)} />
                    <path d={ABA} fill={`url(#${u}-trama)`} opacity={0.3} />
                    <path d={ABA_BAIXO} fill="#b07a34" opacity={0.6} />
                    <path d={ABA_LUZ} {...linha('#fffbe6', 1.6, 0.75)} />
                    {/* crista furando a copa: desenhada ANTES dela, a borda de cima da copa (com o contorno de
                        palha) esconde a base */}
                    <g className="juca-crista" transform={CRISTA_POS}>
                      <path d={CRISTA} fill={`url(#${u}-crista)`} {...sil(CONT_CRISTA, 2.8)} />
                      <path d={CRISTA_REALCE} fill="#ffc0ae" opacity={0.8} />
                    </g>
                    <path d={COPA} fill={`url(#${u}-copa)`} {...sil(CONT_PALHA)} />
                    <path d={COPA} fill={`url(#${u}-trama)`} opacity={0.3} />
                    <path d={COPA_CEL} fill="#a8692c" opacity={0.4} />
                    <ellipse cx={52.6} cy={20} rx={2.4} ry={3.2} fill={`url(#${u}-realce)`} transform="rotate(24 52.6 20)" />
                    {/* raminho de trigo: a fita (desenhada depois) prende o pé do talo */}
                    <g className="juca-capim">
                      <path d={CAPIM_TALO} {...linha(CONT_PALHA, 4, 1)} />
                      <path d={CAPIM_TALO} {...linha('#f2c75c', 1.8, 1)} />
                      <path d={BARBAS} {...linha('#c9932f', 1, 0.9)} />
                      {GRAOS.map(({ x, y, a }) => (
                        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={1.6} ry={2.8} transform={`rotate(${a} ${x} ${y})`} fill="#ffd96a" {...sil(CONT_PALHA, 0.9)} />
                      ))}
                    </g>
                    <path d={FITA} fill={`url(#${u}-fita)`} stroke="#5e0f1a" strokeWidth={1.4} strokeLinejoin="round" />
                    {/* remendo xadrez costurado na fita */}
                    <g transform="rotate(-8 55 25)">
                      <rect x={51.8} y={22.6} width={6.4} height={5.4} rx={0.8} fill={`url(#${u}-remendo)`} stroke="#5e0f1a" strokeWidth={1} />
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>

        {/* efeitos da expressão */}
        {surpreso && (
          <g className="juca-fx">
            <path d={`M104.4 6h5.4l-1 12h-3.4Z${circ(107.1, 22.4, 2.6)}`} fill="#ffd23f" stroke="#6a4300" strokeWidth={4.4} paintOrder="stroke" strokeLinejoin="round" />
          </g>
        )}
        {piscando && (
          <g className="juca-fx">
            <path className="juca-brilho" d={estrela(100, 24, 5)} fill="#ffe066" stroke="#b07800" strokeWidth={1.4} strokeLinejoin="round" />
            <path className="juca-brilho juca-brilho-2" d={estrela(107.6, 15, 3)} fill="#fff6c0" stroke="#b07800" strokeWidth={1} strokeLinejoin="round" />
            <path className="juca-brilho juca-brilho-3" d={estrela(88.4, 40.4, 1.8)} fill="#fff6c0" stroke="#b07800" strokeWidth={0.8} strokeLinejoin="round" />
          </g>
        )}
      </g>
    </svg>
  );
}

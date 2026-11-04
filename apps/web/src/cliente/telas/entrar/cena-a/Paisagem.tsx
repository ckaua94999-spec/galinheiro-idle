// Paisagem da cena de abertura, em camadas de profundidade (perspectiva atmosférica: quanto mais longe, mais
// lilás-azulada, mais clara e com menos contraste). Todas moram no "mundo" (cena-a.tsx), cujo zero é a LINHA
// DO CHÃO onde o elenco pisa: cada camada se posiciona com `bottom` relativo a ela, então o horizonte
// acompanha o elenco quando o formulário abre. Os desenhos de colina usam uma prancha de 3000 px em escala
// 1:1, centrada: o celular vê o miolo, o desktop vê o panorama inteiro (árvores, cercas e nuvens a mais).
// Cada camada tem --prof (parallax do mouse no desktop) e a sua entrada, que é CSS (entrar-a.css): roda já
// no 1º quadro do HTML do servidor, sem esperar a hidratação.
//
// Vida de fazenda (enxertada da variante C, repintada para o pôr do sol): pás de lona do moinho girando,
// portas do celeiro que se abrem e acendem a luz quente do feno, cata-vento de galo, fumaça da chaminé do
// rancho, janela acesa tremeluzindo, galinhas ciscando no terreiro (desktop) e sombras de nuvem deslizando
// pelo campo.
//
// Composição: no celular a avestruz (direita) fica recortada contra o céu dourado, só com as pás finas do
// moinho atrás dela; o celeiro mora num outeiro à esquerda (portas acima da cabeça do ganso) e o sol se
// põe atrás do Seu Juca. No desktop o horizonte fica a ~60% da altura e a paisagem distante cresce com a
// tela (--e-pais), ocupando o terço do meio.
import type { CSSProperties, ReactNode } from 'react';
import { FiguraAnimal } from '../../../arte/Animal';
import { r1, sorteio } from './aleatorio';
import { Arvore, CataVento, Celeiro, FardoRedondo, FolhaPorta, MoinhoPas, MoinhoTorre, Nuvem, Passaro, Tufo } from './arte';

/** Camada com parallax (--prof) e entrada CSS vinda de baixo (--dy px, --atraso s; --some 1 = com fade). */
function Camada({ nome, prof, dy, atraso, some = true, children }: { nome: string; prof: number; dy: number; atraso: number; some?: boolean; children: ReactNode }) {
  return (
    <div className={`ca-camada ${nome}`} style={{ '--prof': prof } as CSSProperties} aria-hidden>
      <div className={some ? 'ca-camada-entra' : 'ca-camada-entra ca-camada-entra-firme'} style={{ '--dy': `${dy}px`, '--atraso': `${atraso}s` } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ céu */

// [forma, x (px do centro), bottom (px acima do chão), largura, duração da deriva s, atraso s, deriva px,
//  perto? (só as do primeiro plano têm contorno; as distantes são macias e mais transparentes)]
const NUVENS: [number, number, number, number, number, number, number, boolean][] = [
  [0, -262, 318, 214, 38, -6, -40, true],
  [1, 236, 372, 132, 31, -20, 34, false],
  [2, 96, 214, 150, 46, -12, 44, false],
  [1, -520, 430, 170, 27, -3, -30, false],
  [0, 560, 300, 250, 44, -30, 50, true],
  [2, -760, 250, 230, 52, -8, 40, false],
  [1, 860, 440, 196, 35, -15, -36, false],
  [0, -980, 360, 260, 48, -22, -44, true],
];

// formação em V (o líder na frente, à direita: voam para a direita)
const V5: [number, number][] = [
  [0, 0],
  [-17, -8],
  [-34, -15],
  [-16, 8],
  [-32, 17],
];
const V3: [number, number][] = [
  [0, 0],
  [-14, -7],
  [-13, 8],
];

function Bando({ classe, formacao }: { classe: string; formacao: [number, number][] }) {
  return (
    <div className={`ca-bando ${classe}`}>
      {formacao.map(([x, y], i) => (
        <span key={i} className="ca-bando-ave" style={{ left: x, top: y, '--i': i } as CSSProperties}>
          <span className="ca-bando-asa">
            <Passaro />
          </span>
        </span>
      ))}
    </div>
  );
}

export function Ceu() {
  return (
    <>
      <div className="ca-ceu" aria-hidden />
      <Camada nome="ca-c-sol" prof={4} dy={70} atraso={0}>
        <div className="ca-sol">
          <span className="ca-sol-halo" />
          <span className="ca-raios ca-raios-1" />
          <span className="ca-raios ca-raios-2" />
          <span className="ca-sol-coroa" />
          <span className="ca-sol-disco" />
        </div>
      </Camada>
      <Camada nome="ca-c-nuvens" prof={9} dy={24} atraso={0.1}>
        {NUVENS.map(([forma, x, y, l, dur, atraso, deriva, perto], i) => (
          <span
            key={i}
            className={perto ? 'ca-nuvem' : 'ca-nuvem ca-nuvem-longe'}
            style={{ left: `calc(50% + ${x - l / 2}px)`, bottom: y, width: l, '--dur': `${dur}s`, '--atraso': `${atraso}s`, '--deriva': `${deriva}px` } as CSSProperties}
          >
            <Nuvem forma={forma} perto={perto} />
          </span>
        ))}
        <Bando classe="ca-bando-1" formacao={V5} />
        <Bando classe="ca-bando-2" formacao={V3} />
      </Camada>
    </>
  );
}

/* ----------------------------------------------------------------------------- longe (montanhas) */

// prancha 3000×700, chão em y 700; vale largo à esquerda do centro (x 1000–1660) onde o sol se põe
const SERRA_1 =
  'M0 700V420C120 400 200 360 300 368C400 376 460 330 560 322C660 314 720 370 800 392C880 414 940 396 1010 420C1080 444 1160 498 1240 506C1320 512 1400 504 1480 500C1560 496 1600 470 1660 444C1730 414 1790 380 1870 372C1950 364 2010 400 2090 404C2170 408 2230 352 2320 340C2410 328 2480 372 2560 384C2650 396 2720 360 2800 356C2880 352 2950 380 3000 392V700Z';
const SERRA_2 =
  'M0 700V520C140 490 260 470 380 486C500 502 560 470 680 466C800 462 880 500 980 530C1080 560 1160 572 1260 574C1360 576 1440 566 1520 556C1600 546 1660 520 1740 500C1820 480 1900 470 1990 482C2080 494 2140 520 2240 516C2340 512 2420 478 2520 470C2620 462 2700 494 2800 500C2880 504 2950 496 3000 492V700Z';
const aberto = (d: string) => d.replace(/^M0 700V/, 'M0 ').replace(/V700Z$/, '');

export function Longe() {
  return (
    <Camada nome="ca-c-longe" prof={14} dy={50} atraso={0.05}>
      <svg className="ca-prancha" viewBox="0 0 3000 700" width="3000" height="700">
        <defs>
          <linearGradient id="ca-serra-1" x1="0" y1="320" x2="0" y2="700" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#b4a0d8" />
            <stop offset=".5" stopColor="#dca6c4" />
            <stop offset="1" stopColor="#ffc6a6" />
          </linearGradient>
          <linearGradient id="ca-serra-2" x1="0" y1="460" x2="0" y2="700" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#9a7cc0" />
            <stop offset=".6" stopColor="#c68eae" />
            <stop offset="1" stopColor="#eea69c" />
          </linearGradient>
          {/* aro de luz no cume: forte perto do sol (esquerda do centro), some nas pontas */}
          <linearGradient id="ca-aro-longe" x1="0" y1="0" x2="3000" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset=".1" stopColor="#ffe6b8" stopOpacity="0" />
            <stop offset=".38" stopColor="#ffe6b8" stopOpacity=".95" />
            <stop offset=".5" stopColor="#ffe6b8" stopOpacity=".6" />
            <stop offset=".75" stopColor="#ffe6b8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={SERRA_1} fill="url(#ca-serra-1)" />
        <path d={aberto(SERRA_1)} fill="none" stroke="url(#ca-aro-longe)" strokeWidth="3" />
        <path d={SERRA_2} fill="url(#ca-serra-2)" />
        <path d={aberto(SERRA_2)} fill="none" stroke="url(#ca-aro-longe)" strokeWidth="2.6" />
      </svg>
      <span className="ca-nevoa ca-nevoa-1" />
    </Camada>
  );
}

/* ------------------------------------------------------------------------- meio (colinas + fazenda) */

const COLINA_MEIO =
  'M0 700V560C120 548 220 556 320 566C420 576 520 560 620 552C720 544 820 560 900 572C980 584 1060 584 1140 580C1190 578 1230 562 1268 544C1300 528 1336 520 1372 520C1410 520 1440 530 1466 550C1490 570 1506 588 1530 594C1580 597 1620 588 1680 582C1760 576 1840 576 1920 580C2000 584 2080 568 2180 558C2280 548 2380 556 2480 566C2580 576 2700 560 2800 552C2880 546 2950 552 3000 556V700Z';

// árvores em silhueta no cume do meio: [x na prancha, escala]; as das pontas só aparecem no desktop. O
// outeiro em x 1268–1466 (à esquerda do centro) é o chão do celeiro no celular.
const ARVORES_MEIO: [number, number][] = [
  [1810, 0.8],
  [1862, 0.62],
  [1010, 0.9],
  [944, 0.66],
  [560, 1],
  [612, 0.72],
  [2300, 0.95],
  [2360, 0.7],
  [2660, 0.85],
  [300, 0.8],
];

/** y do cume do meio (aproximação linear por trechos, só para assentar as árvores). */
function cumeMeio(x: number): number {
  const pts: [number, number][] = [
    [0, 560],
    [320, 566],
    [620, 552],
    [900, 572],
    [1140, 580],
    [1268, 544],
    [1372, 520],
    [1466, 550],
    [1530, 594],
    [1680, 582],
    [1920, 580],
    [2180, 558],
    [2480, 566],
    [2800, 552],
    [3000, 556],
  ];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return 556;
}

/** Moinho: torre com material + pás de lona (peça HTML girando no eixo do capuz). */
function Moinho() {
  return (
    <span className="ca-moinho">
      <MoinhoTorre />
      <span className="ca-moinho-pas">
        <MoinhoPas />
      </span>
    </span>
  );
}

/** Celeiro: portas que se abrem e acendem a luz do feno, cata-vento, fumaça do rancho e janela acesa. */
function CeleiroVivo() {
  return (
    <span className="ca-celeiro">
      <span className="ca-janela-halo" />
      <Celeiro />
      <span className="ca-porta-luz" />
      <span className="ca-porta ca-porta-e">
        <FolhaPorta lado="e" />
      </span>
      <span className="ca-porta ca-porta-d">
        <FolhaPorta lado="d" />
      </span>
      <span className="ca-catavento">
        <CataVento />
      </span>
      <span className="ca-fumaca">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

export function Meio() {
  return (
    <Camada nome="ca-c-meio" prof={22} dy={60} atraso={0.1}>
      <svg className="ca-prancha" viewBox="0 0 3000 700" width="3000" height="700">
        <defs>
          <linearGradient id="ca-meio" x1="0" y1="550" x2="0" y2="700" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#7e5c9e" />
            <stop offset=".45" stopColor="#62488e" />
            <stop offset="1" stopColor="#4a3a7c" />
          </linearGradient>
          <linearGradient id="ca-aro-meio" x1="0" y1="0" x2="3000" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset=".05" stopColor="#ffd08a" stopOpacity=".15" />
            <stop offset=".4" stopColor="#ffd08a" stopOpacity="1" />
            <stop offset=".55" stopColor="#ffd08a" stopOpacity=".55" />
            <stop offset=".9" stopColor="#ffd08a" stopOpacity=".1" />
          </linearGradient>
        </defs>
        {ARVORES_MEIO.map(([x, s]) => (
          <g key={x} transform={`translate(${x - 45 * s} ${r1(cumeMeio(x) - 104 * s)}) scale(${s})`}>
            <Arvore />
          </g>
        ))}
        <path d={COLINA_MEIO} fill="url(#ca-meio)" />
        <path d={aberto(COLINA_MEIO)} fill="none" stroke="url(#ca-aro-meio)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <Moinho />
      <CeleiroVivo />
      <span className="ca-nevoa ca-nevoa-2" />
    </Camada>
  );
}

/* ----------------------------------------------------------------------------- perto (o campo) */

// prancha 3000×1600 com o chão do elenco em y 300 (o resto desce atrás do painel)
const CAMPO = 'M0 1600V200C200 190 380 206 560 214C740 222 900 228 1060 230C1220 232 1360 236 1500 236C1640 236 1780 232 1940 228C2100 224 2260 214 2440 208C2620 202 2800 196 3000 190V1600Z';

// Trilha de terra que desce do alto do morro até o pé do fardo (guia o olho até o elenco e, no desktop,
// até os botões). Bordas como curvas de Bézier (para sortear o capim que invade a terra).
type Bezier = [[number, number], [number, number], [number, number], [number, number]];
const BORDA_E: Bezier[] = [
  [[1652, 238], [1636, 272], [1590, 300], [1520, 330]],
  [[1520, 330], [1452, 360], [1404, 404], [1410, 470]],
];
const BORDA_D: Bezier[] = [
  [[1676, 238], [1716, 268], [1730, 306], [1676, 344]],
  [[1676, 344], [1624, 380], [1600, 420], [1626, 470]],
];
const TRILHA = 'M1652 238C1636 272 1590 300 1520 330C1452 360 1404 404 1410 470L1626 470C1600 420 1624 380 1676 344C1730 306 1716 268 1676 238Z';
// sulcos das rodas (2 riscos escuros com o lábio claro ao lado) e a faixa de capim no meio da trilha
const SULCOS = 'M1658 244C1626 286 1572 316 1508 346C1452 374 1430 418 1440 470M1670 244C1680 290 1640 330 1604 360C1572 390 1558 430 1566 470';
const LABIOS = 'M1662 246C1632 288 1580 318 1518 348C1464 376 1444 420 1454 470M1674 246C1684 292 1646 332 1612 362C1582 392 1570 432 1578 470';
const CAPIM_MEIO = 'M1664 248C1650 290 1606 324 1560 350C1520 378 1500 420 1506 470L1530 470C1526 426 1540 390 1574 364C1618 334 1666 292 1667 248Z';

function bezier([a, b, c, d]: Bezier, t: number): [number, number] {
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
}

/** Tufo de capim PREENCHIDO (3–5 lâminas de altura, largura e inclinação sorteadas): [corpo, realce]. */
function tufoCampo(rnd: () => number, x: number, y: number, s: number): [string, string] {
  const n = 3 + Math.floor(rnd() * 3);
  const i = Math.round;
  let corpo = '';
  let realce = '';
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1) - 0.5;
    const bx = x + t * 7 * s;
    const w = (2.2 + rnd() * 1.4) * s;
    const h = (6 + rnd() * 7) * s * (1 - Math.abs(t) * 0.7);
    const lean = (t * 10 + (rnd() - 0.5) * 5) * s;
    corpo += `M${i(bx - w / 2)} ${i(y)}Q${i(bx + lean * 0.25)} ${i(y - h * 0.55)} ${i(bx + lean)} ${i(y - h)}Q${i(bx + lean * 0.3 + w * 0.3)} ${i(y - h * 0.5)} ${i(bx + w / 2)} ${i(y)}Z`;
    if (k === n >> 1) realce += `M${i(bx)} ${i(y - h * 0.14)}Q${i(bx + lean * 0.22)} ${i(y - h * 0.55)} ${i(bx + lean * 0.86)} ${i(y - h * 0.9)}`;
  }
  return [corpo, realce];
}

/** A posição cai na terra da trilha? (aproximação do meio e da meia-largura, para não plantar capim nela) */
function naTrilha(x: number, y: number): boolean {
  if (y < 236 || y > 476) return false;
  const t = (y - 236) / 240;
  const meio = 1664 - t * 120 - Math.sin(t * Math.PI) * 50;
  const meia = 12 + t * 96;
  return Math.abs(x - meio) < meia;
}

// cores dos tufos: [corpo, realce] — verde-escuro, oliva e verde-azulado (variação de tom do pasto)
const CORES_TUFO: [string, string][] = [
  ['#2f7a2a', '#a6dc5c'],
  ['#5d8a26', '#e2e676'],
  ['#2a6c46', '#86d88e'],
];
const CORES_FLOR = ['#ffffff', '#ff8ac0', '#ffd23f', '#c9a6ff'];

/** Textura do campo (sorteio fixo): o fundo é LISO e mais claro (perspectiva); os tufos crescem e se
 *  adensam para a frente e nas bordas, variam de tamanho, cor e forma, e o capim invade a beira da trilha. */
const TEXTURA = (() => {
  const rnd = sorteio(77);
  const tufos: [string, string][] = CORES_TUFO.map(() => ['', '']);
  const flores = CORES_FLOR.map(() => '');
  let miolos = '';
  let manchas = '';
  let pedrinhas = '';
  const plantar = (x: number, y: number, s: number) => {
    const [c, r] = tufoCampo(rnd, x, y, s);
    const g = tufos[Math.floor(rnd() * tufos.length)]!;
    g[0] += c;
    g[1] += r;
  };
  const escala = (y: number) => 0.32 + (y - 250) / 160;
  // 1) pasto do meio ao primeiro plano (nada antes de y 268: lá o campo é liso)
  for (let i = 0; i < 150; i++) {
    const y = 268 + rnd() ** 0.8 * 560;
    const x = 300 + rnd() * 2400;
    if (naTrilha(x, y)) continue;
    const s = escala(y);
    plantar(x, y, s * (0.75 + rnd() * 0.5));
    if (i % 5 === 0) manchas += `M${Math.round(x - 40 * s)} ${Math.round(y + 3)}a${r1(40 * s)} ${r1(7 * s)} 0 1 0 ${r1(80 * s)} 0a${r1(40 * s)} ${r1(7 * s)} 0 1 0 ${r1(-80 * s)} 0Z`;
  }
  // 2) touceiras nas bordas da tela do celular (x 1305–1380 e 1620–1695), na frente
  for (let i = 0; i < 34; i++) {
    const y = 290 + rnd() * 190;
    const x = i % 2 ? 1300 + rnd() * 80 : 1620 + rnd() * 80;
    if (naTrilha(x, y)) continue;
    plantar(x, y, escala(y) * (0.9 + rnd() * 0.5));
  }
  // 3) capim invadindo a beira da trilha (um pouco para dentro da terra)
  for (const borda of [BORDA_E, BORDA_D]) {
    for (let i = 0; i < 13; i++) {
      const t = (i + rnd() * 0.6) / 13;
      const [x, y] = bezier(borda[t < 0.5 ? 0 : 1]!, t < 0.5 ? t * 2 : t * 2 - 1);
      const dentro = (borda === BORDA_E ? 1 : -1) * (2 + rnd() * 6) * escala(y);
      plantar(x + dentro, y + 1, escala(y) * (0.6 + rnd() * 0.5));
    }
  }
  // flores só no primeiro plano (agrupadas por cor: um <path> por cor)
  for (let i = 0; i < 40; i++) {
    const y = 300 + rnd() * 420;
    const x = 500 + rnd() * 2000;
    if (naTrilha(x, y)) continue;
    const r = 1.4 * escala(y);
    const c = Math.floor(rnd() * CORES_FLOR.length);
    flores[c] += `M${r1(x - r)} ${r1(y)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0Z`;
    if (c !== 2) miolos += `M${r1(x - r * 0.4)} ${r1(y)}a${r1(r * 0.4)} ${r1(r * 0.4)} 0 1 0 ${r1(r * 0.8)} 0a${r1(r * 0.4)} ${r1(r * 0.4)} 0 1 0 ${r1(-r * 0.8)} 0Z`;
  }
  // pedrinhas na beira da trilha
  for (let i = 0; i < 16; i++) {
    const t = rnd();
    const lado = i % 2 ? 1 : -1;
    const y = 250 + t * 210;
    const x = 1640 - t * 160 + lado * (14 + t * 90) + (rnd() - 0.5) * 10;
    const r = 1.5 + t * 4;
    pedrinhas += `M${r1(x - r)} ${r1(y)}a${r1(r)} ${r1(r * 0.7)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r * 0.7)} 0 1 0 ${r1(-2 * r)} 0Z`;
  }
  return { tufos, flores, miolos, manchas, pedrinhas };
})();

/** y do cume do campo (por trechos), para assentar cerca e fardos. */
function cumeCampo(x: number): number {
  const pts: [number, number][] = [
    [0, 200],
    [560, 214],
    [1060, 230],
    [1500, 236],
    [1940, 228],
    [2440, 208],
    [3000, 190],
  ];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return 190;
}

/** Cerca de madeira nas pontas do campo (só o desktop alcança): mourões seguindo o morro + 2 travessas. */
const CERCA = (() => {
  let mouroes = '';
  let travessas = '';
  let luz = '';
  let veio = '';
  for (const [x0, x1] of [
    [380, 1010],
    [1990, 2640],
  ] as const) {
    const ys: [number, number][] = [];
    for (let x = x0; x <= x1; x += 45) ys.push([x, r1(cumeCampo(x) + 22)]);
    for (const [x, y] of ys) {
      mouroes += `M${x - 3.5} ${y + 4}V${r1(y - 26)}L${x} ${r1(y - 30)}L${x + 3.5} ${r1(y - 26)}V${y + 4}Z`;
      luz += `M${x - 1.6} ${r1(y - 25)}V${y}`;
      veio += `M${x + 1} ${r1(y - 18)}l0.6 6`;
    }
    for (const h of [20, 10]) travessas += 'M' + ys.map(([x, y]) => `${x} ${r1(y - h)}`).join('L');
  }
  return { mouroes, travessas, luz, veio };
})();
const FARDOS_LONGE: [number, number][] = [
  [690, 1],
  [742, 0.8],
  [2290, 0.95],
  [2346, 0.75],
];

export function Perto() {
  return (
    <Camada nome="ca-c-perto" prof={30} dy={60} atraso={0.15} some={false}>
      <svg className="ca-prancha ca-prancha-campo" viewBox="0 0 3000 1600" width="3000" height="1600">
        <defs>
          <linearGradient id="ca-campo" x1="0" y1="190" x2="0" y2="760" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#e4dc72" />
            <stop offset=".1" stopColor="#b4d65a" />
            <stop offset=".3" stopColor="#7fc04a" />
            <stop offset=".62" stopColor="#4f9e3c" />
            <stop offset="1" stopColor="#2f7034" />
          </linearGradient>
          <linearGradient id="ca-aro-campo" x1="0" y1="0" x2="3000" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset=".1" stopColor="#fff2a8" stopOpacity=".35" />
            <stop offset=".42" stopColor="#fff2a8" stopOpacity="1" />
            <stop offset=".6" stopColor="#fff2a8" stopOpacity=".7" />
            <stop offset=".9" stopColor="#fff2a8" stopOpacity=".3" />
          </linearGradient>
          <linearGradient id="ca-trilha" x1="0" y1="238" x2="0" y2="470" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#f8deaa" />
            <stop offset=".35" stopColor="#e2b072" />
            <stop offset=".75" stopColor="#c08048" />
            <stop offset="1" stopColor="#9c6034" />
          </linearGradient>
          <linearGradient id="ca-capim-meio" x1="0" y1="248" x2="0" y2="470" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#d6e07a" stopOpacity=".5" />
            <stop offset="1" stopColor="#5fae3e" />
          </linearGradient>
          <linearGradient id="ca-nevoa-campo" x1="0" y1="186" x2="0" y2="316" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff0b8" stopOpacity=".6" />
            <stop offset=".45" stopColor="#fff0b8" stopOpacity=".25" />
            <stop offset="1" stopColor="#fff0b8" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="ca-luz-campo">
            <stop offset="0" stopColor="#ffe9a0" stopOpacity=".7" />
            <stop offset="1" stopColor="#ffe9a0" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={CAMPO} fill="url(#ca-campo)" stroke="#2f5f24" strokeWidth="5" paintOrder="stroke" />
        {/* luz quente do sol varrendo o campo + névoa clara no fundo (o pasto distante é liso e esmaecido) */}
        <ellipse cx="1330" cy="250" rx="520" ry="166" fill="url(#ca-luz-campo)" />
        <rect x="0" y="186" width="3000" height="130" fill="url(#ca-nevoa-campo)" />
        <path d={TEXTURA.manchas} fill="#3f8f2a" opacity=".14" />
        {/* trilha: borda escura macia (sem contorno grosso), terra do claro (perto do sol) ao escuro, sulcos
            das rodas com o lábio claro ao lado e a faixa de capim no meio */}
        <path d={TRILHA} fill="none" stroke="#7a5a2a" strokeWidth="7" strokeLinejoin="round" opacity=".28" />
        <path d={TRILHA} fill="url(#ca-trilha)" />
        <path d={CAPIM_MEIO} fill="url(#ca-capim-meio)" />
        <path d={LABIOS} fill="none" stroke="#f8dcaa" strokeWidth="2.2" strokeLinecap="round" opacity=".7" />
        <path d={SULCOS} fill="none" stroke="#7c4a24" strokeWidth="3.2" strokeLinecap="round" opacity=".5" />
        <path d={TEXTURA.pedrinhas} fill="#d9c7b0" stroke="#7a5a3a" strokeWidth="1.2" />
        {TEXTURA.tufos.map(([corpo, realce], i) => (
          <g key={i}>
            <path d={corpo} fill={CORES_TUFO[i]![0]} />
            <path d={realce} fill="none" stroke={CORES_TUFO[i]![1]} strokeWidth="1.3" strokeLinecap="round" opacity=".85" />
          </g>
        ))}
        {TEXTURA.flores.map((d, i) => (
          <path key={i} d={d} fill={CORES_FLOR[i]} stroke="#2f5f24" strokeWidth=".8" />
        ))}
        <path d={TEXTURA.miolos} fill="#ffcf3a" />
        {/* cerca e fardos redondos nas pontas (panorama do desktop) */}
        <path d={CERCA.travessas} fill="none" stroke="#3b200c" strokeWidth="6" strokeLinejoin="round" />
        <path d={CERCA.travessas} fill="none" stroke="#c98a4e" strokeWidth="3" strokeLinejoin="round" />
        <path d={CERCA.mouroes} fill="#c98a4e" stroke="#3b200c" strokeWidth="2.4" paintOrder="stroke" strokeLinejoin="round" />
        <path d={CERCA.luz} stroke="#ffd9a0" strokeWidth="1.2" opacity=".8" />
        <path d={CERCA.veio} stroke="#7a4a22" strokeWidth="1" opacity=".7" />
        {FARDOS_LONGE.map(([x, e]) => (
          <g key={x} transform={`translate(${x} ${r1(cumeCampo(x) + 34)}) scale(${e})`}>
            <FardoRedondo />
          </g>
        ))}
        {/* aro de luz no cume (contraluz do sol) */}
        <path d="M0 200C200 190 380 206 560 214C740 222 900 228 1060 230C1220 232 1360 236 1500 236C1640 236 1780 232 1940 228C2100 224 2260 214 2440 208C2620 202 2800 196 3000 190" fill="none" stroke="url(#ca-aro-campo)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {/* sombras de nuvem deslizando pelo campo (de C): dão escala e "vento" ao pasto */}
      <span className="ca-sombra-nuvem ca-sombra-nuvem-1" />
      <span className="ca-sombra-nuvem ca-sombra-nuvem-2" />
      {/* terreiro: galinhas pequenas ciscando ao longe, perto da trilha (o desktop alcança) */}
      <span className="ca-terreiro">
        <span className="ca-anda ca-anda-1">
          <span className="ca-anda-vira">
            <FiguraAnimal tipo="galinha" ninho={false} detalhe="p" atrasoS={0.7} />
          </span>
        </span>
        <span className="ca-anda ca-anda-2">
          <span className="ca-anda-vira">
            <FiguraAnimal tipo="galinha" humor="neutro" ninho={false} detalhe="p" atrasoS={3.1} />
          </span>
        </span>
      </span>
    </Camada>
  );
}

/* ------------------------------------------------------------------------- frente (capim ao vento) */

// [x px do centro, bottom, largura, flor?, período do vento s, espelhado?] — capim do horizonte (celular).
// Períodos quase iguais: a onda da rajada continua atravessando a tela em ordem por muitos ciclos.
const TUFOS_FRENTE: [number, number, number, string | undefined, number, boolean][] = [
  [-206, -18, 78, '#ffffff', 8.9, false],
  [196, -20, 84, undefined, 8.9, true],
  [-330, -26, 96, '#ff8ac0', 9.1, true],
  [340, -22, 92, '#ffd23f', 9.1, false],
  [-480, -30, 110, undefined, 9.0, false],
  [500, -32, 116, '#ffffff', 8.9, true],
  [-640, -36, 120, '#ffd23f', 9.1, true],
  [660, -34, 124, undefined, 9.0, false],
];

/** Capim ao vento: balanço e rajada numa animação só por tufo (a rajada atravessa da esquerda para a
 *  direita pelo atraso, proporcional ao x). */
export function Frente() {
  return (
    <Camada nome="ca-c-frente" prof={46} dy={90} atraso={0.2} some={false}>
      {TUFOS_FRENTE.map(([x, y, l, flor, dur, espelho], i) => (
        <span
          key={i}
          className="ca-tufo"
          style={{ left: `calc(50% + ${x - l / 2}px)`, bottom: y, width: l, '--dur': `${dur}s`, '--rajada': `${r1((x + 700) / 700 - 9)}s`, '--esp': espelho ? -1 : 1 } as CSSProperties}
        >
          <span className="ca-tufo-vento">
            <Tufo flor={flor} />
          </span>
        </span>
      ))}
    </Camada>
  );
}

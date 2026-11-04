// Avestruz (lendário) — a diva do galinheiro. Segue o KIT da Galinha.tsx (camadas, classes ani-*, rosto de
// comum.tsx, contorno colorido por material, volume em 3 tons); só o que é da avestruz está aqui.
//
// DESVIOS (rodada 3, acabamento — números finais):
// Silhueta: "cabeçona chibi + PESCOÇO LONGO e fino em S + ovo de plumas". A cabeça é pequena em relação ao
// corpo, mas exagerada como no Hay Day: 30,4×26,4 ×1,3 = 39,5×34,3 (≈ 90% da largura da cabeça da galinha),
// em 3/4 virada para a esquerda, como a galinha e o ganso, e quase toda olho (olhos ×0,76/×0,86 ×1,3 ≈
// 0,99/1,12, cílios longos do kit). A ave inteira SOBE 3,5 (CORPO_DY: a plumagem sai do ninho e aparece acima
// da pílula do grid); para a tiara não sair da caixa, a cabeça fica 10 abaixo do desenho-base (H_DESCE) e a
// tiara assenta 1 mais perto do cocuruto (o pescoço visível encurta, mas continua longo e rosado).
// Bico de avestruz: CUNHA curta (ponta em x ≈ 32,4: ~17% mais curta que na rodada 2) que afina de verdade
// (7,4 de altura na base → 2,8 perto da ponta), num laranja-pêssego SATURADO (o foco quente do rosto, 2 degraus
// longe da pele), contornado no marrom-rosado do material (1,6, como o bico da galinha/pato) no cúlmen, na ponta
// e na mandíbula: a BASE entra na cara (x ≈ 46,5–49) e não tem traço (caminho aberto, ponta "butt"), então o
// bico nasce do rosto. Cúlmen CONVEXO que desce e dobra num gancho suave (a ponta cai ≈ 1 abaixo da comissura),
// mandíbula levemente côncava (+0,4). A sombra cel e o traço de dentro vão num <path> só (preenchimento cel +
// traço do material): lâmina da mandíbula (a borda de cima é a comissura), unha da ponta, narina em fenda e o
// "canto" do humor (ida e volta, área zero), curto e baixo — o sorriso do feliz vem da bochecha e dos olhos.
// Fio de luz no cúlmen. Só a surpresa abre: a mandíbula GIRA na dobradiça e a boca escura vem por cima.
// Contorno da cabeça e do pescoço FINO (2,4, #7e3446): numa cabeça lisa o 3,5 do kit vira "capuz"; quem
// segura a silhueta é o corpo e a cauda (no lod-p, .ave-sil-pele engrossa). Pescoço rosado fino, gerado como
// um tubo em volta de uma Bézier cúbica (S elegante) a partir da posição da cabeça em cada humor; a "emenda"
// (só preenchimento, na cor do pescoço) apaga o contorno da cabeça onde o pescoço entra (nada de alfinete).
// Corpo: plumagem roxo-ardósia QUENTE e clara (realce #ab98d0 → base #7a66a2 → meio #7363a3 → sombra #54467a,
// contorno #2b2042 bem mais escuro): o meio do corpo, que aparece acima da pílula do grid, fica no tom médio.
// Luz forte de cima à esquerda (gradiente + faixa lilás larga nas costas), cel escuro LEVE embaixo (.3); o
// peito, ao lado do colar, abre em 3 tufos pequenos na própria borda (fofa).
// A ASA é uma forma própria (contorno 2,2) no molde da asa da galinha: FUNDO médio-escuro (as rêmiges, com os
// tufos da borda de baixo) e por cima a CAMADA clara das coberteiras (#c2b4ec, traço fino #3e3068) na metade de
// cima, com a borda de baixo em 2 LÓBULOS grandes e redondos (as pontas de 2 penas largas; a da frente some atrás
// do colar). Sombra cel #58478a num <path>: crescente grosso (≈ 1,7) no fundo de cada lóbulo + a fenda que sobe
// de cada encaixe; fio de luz no alto da camada e no ombro de cada lóbulo. Pena clara sobre fundo escuro: a
// 72 px lê como penas, não como fileira de "ᴗ" nem "concha listrada". Da ponta da asa saem 3 RÊMIGES de base
// lilás e pontas douradas (gradiente próprio, ao longo da pena), abrindo para TRÁS e um pouco para baixo
// (pontas em x 94–101, y 79–83): ficam acima da borda do ninho, longe do ovo do "pronto", e separadas da cauda
// por plumagem roxa — o eco do leque da cauda. Cauda: leque de 3 plumas BRANCAS com PONTAS DOURADAS
// (lendário); a de baixo, mais curta e mais alta. A de cima e a de baixo vão num <path> só (não se tocam fora
// do corpo) e a do meio por cima delas. Colar branco de penugem: só a ponta dos 3 tufos LONGOS (alternados)
// pega o dourado. Contorno das plumas mais leve e quente (#5a4a6e; 2,5 atrás, 2,4 a do meio) que o do corpo,
// base lilás (#d6cdee) para não sumir no fundo dourado da carta/revelação.
// Lendário: tiara de ouro com gema rosa ASSENTADA no cocuruto (a faixa abraça a cabeça; aro escuro 2,1 para
// ler sobre o ouro da carta), com a pluma de "fascinator" atrás (longa e fina, 3 ondas rasas, ponta curvada
// para cima), aura dourada, 2 estrelas que cintilam + a estrela de vaidade no periscópio, glitter (estrelinhas
// de 4 pontas fora do talo) nas plumas da cauda. Na surpresa, os traços de susto (30°/8°/−14°) passam por baixo
// da pluma.
// Desânimo (cansado/triste): a cabeça TOMBA (giro) e cai para a DIREITA, longe do selo "!" do canto de cima à
// esquerda do ninho (no triste, 16,6 para a direita e 1,4 para baixo), mas desce pouco: sobra pescoço rosado frouxo acima do
// colar (a marca da espécie).
//
// Estrutura (o pescoço leva a cabeça junto):
//   aura · <g.ani-corpo> [pernas] <g translate(0 CORPO_DY) [EM_PE de pé]> <g.ani-cauda/> corpo <g.ani-asa-e/>
//     <g.ani-pescoco> colar de trás · pescoço · colar da frente
//       <g.ani-cabeca> <g pose> <g escala> topete · cabeça · emenda · bochecha · <Olhos/> <Piscada/> · bico · lágrima · tiara|touca
//   <g.ani-fx> estrelas, "!", Zzz
// Piscada: a do kit (<Olhos cilios>/<Piscada cilios>, o MESMO objeto CILIOS): os cílios abertos somem
// enquanto a pálpebra desce e os cílios fechados descem pendurados na linha de fechamento. O CSS
// (estilos/animais-avestruz.css) troca o keyframe por um piscar DUPLO com "flutter" (--anim-cilios junto) e
// gira o pescoço em volta da BASE dele (balanço + periscópio ±8°).
// Orçamento (lod-m, com ninho): 54 no pior caso (triste pronto) — 1 de folga sob o teto de 55.
import { Exclamacao, Lagrima, OPACIDADE_BOCHECHA, Olhos, Piscada, Zzz, circ, elip, linha, sil, type CiliosOlho, type CoresRosto, type DefOlho, type Humor, type PropsEspecie } from './comum';

const f1 = (n: number) => Math.round(n * 10) / 10;
const rad = (g: number) => (g * Math.PI) / 180;

// Plumagem: contorno MUITO mais escuro que a sombra (a silhueta não some na própria sombra).
const CONTORNO = '#2b2042';
const PLUMAGEM = 'url(#gi-animais-avestruz-plumagem)';
const ASA_COR = 'url(#gi-animais-avestruz-asa)';
const CEL = '#3c2e58';
const FAIXA_LUZ = '#c2b3e8';
// Coberteiras da asa: camada sólida bem mais clara que o fundo da asa, traço fino, cel no fundo de cada
// lóbulo e nas fendas, fio de luz lilás.
const PENA = '#c2b4ec';
const PENA_CEL = '#58478a';
const PENA_LUZ = '#f6f1ff';
const PENA_TRACO = '#3e3068';
const PLUMA = 'url(#gi-animais-avestruz-pluma)';
const PLUMA_OURO = 'url(#gi-animais-avestruz-pluma-ouro)';
const REMIGE = 'url(#gi-animais-avestruz-remige)';
const COLAR = 'url(#gi-animais-avestruz-colar)';
// Plumas: contorno ameixa quente, mais leve que o do corpo (pena macia, não recorte).
const PLUMA_CONTORNO = '#5a4a6e';
const PLUMA_LINHA = '#b3a9cc';
const PELE = 'url(#gi-animais-avestruz-pele)';
const PESCOCO = '#f6aca4';
const PESCOCO_CEL = '#dc7f88';
const PESCOCO_LUZ = '#ffe0d6';
// Pele: contorno colorido-escuro, claro o bastante para não virar "capuz" em volta da cabeça (nunca preto).
const PELE_CONTORNO = '#7e3446';
const PELE_CEL = '#d06f7e';
const BICO = 'url(#gi-animais-avestruz-bico)';
// Material do bico: marrom-rosado escuro (contorno), cel terracota (sombra + unha + narina).
const BICO_CONTORNO = '#7a3a36';
const BICO_CEL = '#e3967a'; // cel CLARO: escuro demais lia como bigode/beicinho (revisão final)
const TIARA = 'url(#gi-animais-avestruz-tiara)';
const OURO_CONTORNO = '#6a4300';
const BORDA_LUZ = '#bfe6ff';
const CILIO = '#3a1020';
const PALPEBRA = '#f6b0a8';

// ------------------------------------------------------------------------------------- geometria

type P = [number, number];
const ponto = (cx: number, cy: number, rx: number, ry: number, g: number, k = 1): P => [cx + rx * k * Math.cos(rad(g)), cy - ry * k * Math.sin(rad(g))];
const pp = ([x, y]: P) => `${f1(x)} ${f1(y)}`;
const unit = ([x, y]: P): P => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

/** Trecho de borda "fofa": de a0 a a1 (graus, decrescendo = horário na tela), `n` tufos empurrados por `bump`. */
type Trecho = [a0: number, a1: number, n: number, bump: number];

/**
 * Elipse "fofa": cada trecho da borda vira tufos (curvas empurradas para fora); o resto fecha liso por baixo.
 * Os trechos vêm em sequência (o a1 de um é o a0 do seguinte).
 */
function fofa(cx: number, cy: number, rx: number, ry: number, trechos: Trecho[]): string {
  const ini = trechos[0]![0];
  const fim = trechos[trechos.length - 1]![1];
  let d = `M${pp(ponto(cx, cy, rx, ry, ini))}`;
  for (const [a0, a1, n, bump] of trechos) {
    for (let i = 0; i < n; i++) {
      const ga = a0 + ((a1 - a0) * i) / n;
      const gb = a0 + ((a1 - a0) * (i + 1)) / n;
      const b = bump + (i % 3 === 1 ? 0.03 : i % 3 === 2 ? -0.015 : 0);
      d += `Q${pp(ponto(cx, cy, rx, ry, (ga + gb) / 2, b))} ${pp(ponto(cx, cy, rx, ry, gb))}`;
    }
  }
  const grande = Math.abs(360 - Math.abs(ini - fim)) > 180 ? 1 : 0;
  return `${d}A${f1(rx)} ${f1(ry)} 0 ${grande} 1 ${pp(ponto(cx, cy, rx, ry, ini))}Z`;
}

/** Crescente colado na borda da elipse, de a0 a a1 (horário), com o miolo em `k` (sombra cel / faixa de luz). */
function crescente(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, k: number): string {
  const meio = (a0 + a1) / 2;
  const grande = Math.abs(a0 - a1) > 180 ? 1 : 0;
  return `M${pp(ponto(cx, cy, rx, ry, a0))}A${f1(rx)} ${f1(ry)} 0 ${grande} 1 ${pp(ponto(cx, cy, rx, ry, a1))}Q${pp(ponto(cx, cy, rx, ry, meio, k))} ${pp(ponto(cx, cy, rx, ry, a0))}Z`;
}

/** Arco de luz por dentro da elipse, de a0 a a1 (horário). */
function arco(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, k = 0.92): string {
  return `M${pp(ponto(cx, cy, rx, ry, a0, k))}A${f1(rx * k)} ${f1(ry * k)} 0 0 1 ${pp(ponto(cx, cy, rx, ry, a1, k))}`;
}

const quad = (a: P, c: P, b: P, s: number): P => [(1 - s) ** 2 * a[0] + 2 * (1 - s) * s * c[0] + s * s * b[0], (1 - s) ** 2 * a[1] + 2 * (1 - s) * s * c[1] + s * s * b[1]];
const dquad = (a: P, c: P, b: P, s: number): P => [2 * (1 - s) * (c[0] - a[0]) + 2 * s * (b[0] - c[0]), 2 * (1 - s) * (c[1] - a[1]) + 2 * s * (b[1] - c[1])];

/**
 * Pluma de avestruz: eixo em curva (base → controle → ponta), larga e macia, com a borda em ondinhas
 * (fofura) e a ponta arredondada. `w` = meia largura máxima; `n` = ondas por lado; `amp` = quanto cada onda
 * estufa (1 = tufo de cauda; menos = pena lisa, como a do fascinator).
 */
function pluma(b: P, c: P, t: P, w: number, n = 5, amp = 1): string {
  const lado = (sinal: 1 | -1) => {
    const pts: { p: P; nrm: P }[] = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const [x, y] = quad(b, c, t, s);
      const [dx, dy] = unit(dquad(b, c, t, s));
      const h = w * (0.22 + 0.78 * Math.sin(Math.PI * Math.min(1, s * 0.92 + 0.04)) ** 0.7) * (s === 1 ? 0.55 : 1);
      const nrm: P = [-dy * sinal, dx * sinal];
      pts.push({ p: [x + nrm[0] * h, y + nrm[1] * h], nrm });
    }
    return pts;
  };
  const e = lado(1);
  const dir = lado(-1);
  const onda = (a: { p: P; nrm: P }, z: { p: P; nrm: P }) => {
    const m: P = [(a.p[0] + z.p[0]) / 2 + (a.nrm[0] + z.nrm[0]) * amp, (a.p[1] + z.p[1]) / 2 + (a.nrm[1] + z.nrm[1]) * amp];
    return `Q${pp(m)} ${pp(z.p)}`;
  };
  let d = `M${pp(e[0]!.p)}`;
  for (let i = 0; i < n; i++) d += onda(e[i]!, e[i + 1]!);
  const [tx, ty] = unit(dquad(b, c, t, 1));
  const ponta: P = [t[0] + tx * w * 0.95, t[1] + ty * w * 0.95];
  d += `Q${pp(ponta)} ${pp(dir[n]!.p)}`;
  for (let i = n; i > 0; i--) d += onda(dir[i]!, dir[i - 1]!);
  return `${d}Z`;
}
/** Ráquis (talo) da pluma, até 70% do comprimento (o glitter fica fora dele, perto da ponta). */
const raquis = (b: P, c: P, t: P) => `M${pp(b)}Q${pp(quad(b, c, t, 0.35))} ${pp(quad(b, c, t, 0.7))}`;

/** Gira o ponto `p` em `g` graus (horário na tela) em volta de `o`. */
function gira([x, y]: P, g: number, [ox, oy]: P): P {
  const c = Math.cos(rad(g));
  const s = Math.sin(rad(g));
  return [ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c];
}

/** Estrela de 4 pontas (brilho dourado). */
function estrela(x: number, y: number, r: number): string {
  const k = r * 0.2;
  return `M${f1(x)} ${f1(y - r)}Q${f1(x + k)} ${f1(y - k)} ${f1(x + r)} ${f1(y)}Q${f1(x + k)} ${f1(y + k)} ${f1(x)} ${f1(y + r)}Q${f1(x - k)} ${f1(y + k)} ${f1(x - r)} ${f1(y)}Q${f1(x - k)} ${f1(y - k)} ${f1(x)} ${f1(y - r)}Z`;
}

// ------------------------------------------------------------------------------- pescoço (tubo)

type Cubica = [P, P, P, P];
const bez = ([a, b, c, d]: Cubica, s: number): P => {
  const u = 1 - s;
  return [u * u * u * a[0] + 3 * u * u * s * b[0] + 3 * u * s * s * c[0] + s * s * s * d[0], u * u * u * a[1] + 3 * u * u * s * b[1] + 3 * u * s * s * c[1] + s * s * s * d[1]];
};
const dbez = ([a, b, c, d]: Cubica, s: number): P => {
  const u = 1 - s;
  return [3 * u * u * (b[0] - a[0]) + 6 * u * s * (c[0] - b[0]) + 3 * s * s * (d[0] - c[0]), 3 * u * u * (b[1] - a[1]) + 6 * u * s * (c[1] - b[1]) + 3 * s * s * (d[1] - c[1])];
};

/** Curva suave pelos pontos (quadráticas com pontas nos meios): `M` só se `inicio`. */
function suave(pts: P[], inicio: boolean): string {
  let d = inicio ? `M${pp(pts[0]!)}` : `L${pp(pts[0]!)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const m: P = [(pts[i]![0] + pts[i + 1]![0]) / 2, (pts[i]![1] + pts[i + 1]![1]) / 2];
    d += `Q${pp(pts[i]!)} ${i === pts.length - 2 ? pp(pts[i + 1]!) : pp(m)}`;
  }
  if (pts.length === 2) d += `L${pp(pts[1]!)}`;
  return d;
}

// Meia largura do pescoço na base (sob o colar) e no topo (dentro da cabeça).
const W_BASE = 4.4;
const W_TOPO = 3.2;
const larg = (s: number) => W_BASE + (W_TOPO - W_BASE) * s ** 0.85;

/**
 * Amostra o eixo de s0 a s1 e devolve os lados (k ∈ [-1, 1] da meia largura; − = esquerda/luz, + = direita/sombra).
 * `mapa` leva o ponto para outro espaço (a emenda vai para as coordenadas da cabeça).
 */
function lado(c: Cubica, s0: number, s1: number, k: number, n: number, mapa?: (p: P) => P): P[] {
  const r: P[] = [];
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    const [x, y] = bez(c, s);
    const [tx, ty] = unit(dbez(c, s));
    const w = larg(s) * k;
    const p: P = [x - ty * w, y + tx * w];
    r.push(mapa ? mapa(p) : p);
  }
  return r;
}

function faixa(c: Cubica, s0: number, s1: number, k0: number, k1: number, n: number, mapa?: (p: P) => P): string {
  return `${suave(lado(c, s0, s1, k0, n, mapa), true)}${suave(lado(c, s0, s1, k1, n, mapa).reverse(), false)}Z`;
}

// Base do pescoço (escondida sob o colar) e o ponto da cabeça onde ele entra (repouso).
const P_BASE: P = [53, 68.4];
const ANCORA: P = [48.6, 31.6];
// Tudo o que está na cabeça cresce ×1,3 em volta da ÂNCORA (o ponto onde o pescoço entra não se mexe): a
// cabeça "chibi" lê a 72 px ao lado da galinha. Para a tiara não sair da caixa, a cabeça inteira fica 3,6 à
// direita e 10 abaixo das coordenadas abaixo (o pescoço visível encurta, mas sobra pescoço rosado; e o selo
// "!" do canto de cima à esquerda do ninho fica longe do rosto); o pescoço acompanha (o topo dele é a âncora
// deslocada).
const H_ESCALA = 1.3;
const H_DESVIO = 3.6;
const H_DESCE = 10;
// A ave inteira SOBE 3,5 (a plumagem sai do ninho e aparece acima da pílula do grid); a tiara e a pluma do
// topo guardam margem no alto da caixa mesmo no periscópio (carta e chip recortam).
const CORPO_DY = -3.5;
const ESCALA_CABECA = `translate(${ANCORA[0]} ${ANCORA[1]}) scale(${H_ESCALA}) translate(${-ANCORA[0]} ${-ANCORA[1]})`;
const desescala = ([x, y]: P): P => [ANCORA[0] + (x - ANCORA[0]) / H_ESCALA, ANCORA[1] + (y - ANCORA[1]) / H_ESCALA];

// Colar de penugem branca na base do pescoço: coroa de tufos que VESTE o pescoço.
const G_CY = 66.4;
const G_RX = 12.6;
const G_RY = 3.5;
/** Metade de trás (tufos para cima): vai ANTES do pescoço. */
const colarTras = (cx: number) => fofa(cx, G_CY, G_RX, G_RY, [[200, -20, 6, 1.55]]);
/**
 * Metade da frente: tufos pendendo embaixo, ALTERNADOS curto/longo (só a ponta dos 3 longos pega o dourado do
 * gradiente) e a borda de cima cruzando o pescoço.
 */
function colarFrente(cx: number): string {
  const [a0, a1, n] = [-2, -178, 6];
  let d = `M${pp(ponto(cx, G_CY, G_RX, G_RY, a0))}`;
  for (let i = 0; i < n; i++) {
    const ga = a0 + ((a1 - a0) * i) / n;
    const gb = a0 + ((a1 - a0) * (i + 1)) / n;
    d += `Q${pp(ponto(cx, G_CY, G_RX, G_RY, (ga + gb) / 2, i % 2 ? 1.84 : 1.36))} ${pp(ponto(cx, G_CY, G_RX, G_RY, gb))}`;
  }
  const [L, R] = [ponto(cx, G_CY, G_RX, G_RY, a1), ponto(cx, G_CY, G_RX, G_RY, a0)];
  const alt = (t: number): P => [L[0] + (R[0] - L[0]) * t, L[1] + (R[1] - L[1]) * t - G_RY * 0.6 * Math.sin(Math.PI * t)];
  const m = 4;
  for (let j = 0; j < m; j++) {
    const a = alt(j / m);
    const z = alt((j + 1) / m);
    d += `Q${f1((a[0] + z[0]) / 2)} ${f1((a[1] + z[1]) / 2 - 2.2)} ${pp(z)}`;
  }
  return `${d}Z`;
}

// -------------------------------------------------------------------------------------- formas

// Corpo: ovo de plumas, centro (69,78): 3 tufos pequenos no PEITO (ao lado do colar, a borda que aparece à
// frente) e 8 na borda de cima/de trás.
const C_CX = 69;
const C_CY = 78;
const C_RX = 31;
const C_RY = 19.5;
const CORPO = fofa(C_CX, C_CY, C_RX, C_RY, [
  [208, 160, 3, 1.075],
  [160, -12, 8, 1.08],
]);
// Cel escuro embaixo, LEVE (opacidade .3 no desenho): a 72 px ele escurecia metade do corpo.
const CORPO_CEL = crescente(C_CX, C_CY, C_RX, C_RY, 8, -128, 0.66);
// Faixa de luz lilás LARGA nas costas e no ombro (miolo em k .66): a luz forte de cima à esquerda.
const CORPO_FAIXA = crescente(C_CX, C_CY, C_RX, C_RY, 176, 30, 0.66);
// Brilho de borda azul-céu embaixo à direita (o lado da sombra).
const CORPO_LUZ = arco(C_CX, C_CY, C_RX, C_RY, 14, -34, 0.93);

// Cauda: leque de 3 plumas brancas de pontas douradas, abrindo para cima/trás, a de cima enrolando (diva). A de
// baixo é curta e alta: deixa ≥ 3 de plumagem roxa entre ela e as rêmiges da asa.
type Eixo = [P, P, P, number];
const EIXOS_CAUDA: Eixo[] = [
  [[86, 68], [92, 36], [105.6, 33.6], 7.6],
  [[89.4, 71], [104, 46], [112.6, 50], 6.8],
  [[90, 72.6], [103.4, 61.4], [110.4, 63.2], 5.2],
];
// A de cima e a de baixo num <path> só (as duas só se tocam por baixo do corpo); a do meio vem por cima.
const pl = ([b, c, t, w]: Eixo) => pluma(b, c, t, w, 7);
const CAUDA_TRAS = pl(EIXOS_CAUDA[0]!) + pl(EIXOS_CAUDA[2]!);
const CAUDA_MEIO = pl(EIXOS_CAUDA[1]!);
const CAUDA_LINHAS = EIXOS_CAUDA.map(([b, c, t]) => raquis(b, c, t)).join('');
// Glitter dourado nas plumas (perto das pontas, FORA do talo): 3 estrelinhas de 4 pontas num <path> —
// brilho, não alfinete espetado.
const GLITTER = estrela(100.6, 37.8, 2) + estrela(107.4, 53.2, 1.7) + estrela(106.2, 66.6, 1.5);

// Asa no flanco: forma PRÓPRIA (gradiente mais claro que o corpo, contorno escuro, borda de baixo em tufos),
// do ombro até x ≈ 95; da ponta dela saem 3 RÊMIGES de base lilás e pontas douradas, abrindo para TRÁS e um
// pouco para baixo (pontas em x 94–101, y 79–83): leque da asa ACIMA da borda do ninho, longe do ovo do
// "pronto" e separado da cauda por plumagem roxa — o eco do leque branco da cauda.
const ASA = 'M56.8 72.2C62.6 64.2 81.6 62.8 91.4 68.4C95.6 70.8 96.2 75.6 92.6 77.8Q89.8 81.6 85.6 79.6Q82 83.2 77.8 80.6Q73.8 83.6 69.8 80.6Q65 81.6 61.8 78.8C57.8 77.6 55.4 75 56.8 72.2Z';
const EIXOS_ASA: Eixo[] = [
  [[82.6, 76.6], [88.4, 81], [94.2, 83], 3.4],
  [[86.2, 75.4], [92.4, 78.8], [98, 81.4], 3.7],
  [[89.6, 73.6], [96, 75.6], [101, 79], 3.3],
];
const ASA_PLUMAS = EIXOS_ASA.map(([b, c, t, w]) => pluma(b, c, t, w, 4)).join('');
// Coberteiras (família da asa da galinha): uma CAMADA clara na metade de cima da asa, do ombro para trás, com
// a borda de baixo em 2 LÓBULOS grandes e redondos (as pontas de 2 penas largas; a da frente some atrás do
// colar). Embaixo dela aparece o fundo escuro da asa (as rêmiges, com os tufos da borda): pena clara sobre fundo
// escuro, que a 72 px lê como 2 penas e não como "concha listrada". Traço fino roxo-escuro; a sombra cel (um
// <path>) é um crescente GROSSO (≈ 1,7) no fundo de cada lóbulo + a fenda que sobe de cada encaixe entre penas
// (a divisa vira forma, não risco); o fio de luz corre no alto da camada, com um toque no ombro de cada lóbulo.
const PENAS = {
  forma:
    'M58.6 70.6C64 65.6 78 64.8 86.6 68.6C90.4 70.4 90.8 74.8 87.8 76.6C85.4 78 82 77.6 80.4 75.6' +
    'C78.8 78 74.2 78.6 71.6 76.4C68.4 77.4 62.4 76.6 59.6 74.4C57.8 73.2 57.4 71.6 58.6 70.6Z',
  cel:
    'M87.8 76.6C85.4 78 82 77.6 80.4 75.6C82.4 75.9 85.6 75.6 87.8 76.6Z' +
    'M80.4 75.6C78.8 78 74.2 78.6 71.6 76.4C74.4 76.2 78.4 76 80.4 75.6Z' +
    'M71.6 76.4C68.4 77.4 62.4 76.6 59.6 74.4C62.6 75.4 68 75.6 71.6 76.4Z' +
    'M80.4 75.6Q78.6 72.6 76.4 70.2Q79.6 72.2 81.6 75.2Z' +
    'M71.6 76.4Q70.6 73.6 68.8 71.4Q71.8 73.2 72.8 76Z',
  luz: 'M62.4 69.4Q72 65.4 84.8 67.8M82.6 73.2Q84.4 71.8 86.8 72.2M73.4 74.2Q75.2 72.6 77.8 73',
};

// Cabeça (centro 45,23; 30,4×26,4 antes da escala ×1,3), em 3/4 para a esquerda.
const H_CX = 45;
const H_CY = 23;
const H_RX = 15.2;
const H_RY = 13.2;
const CABECA = elip(H_CX, H_CY, H_RX, H_RY);
const CABECA_CEL = crescente(H_CX, H_CY, H_RX, H_RY, 4, -112, 0.7);
const CABECA_LUZ = arco(H_CX, H_CY, H_RX, H_RY, -24, -62, 0.9);

// Pluma de "fascinator" presa ATRÁS da tiara, deitada para trás e com a ponta curvando para CIMA (branca de
// ponta dourada, como a cauda): longa e fina, com só 3 ondas rasas (amp .45) — pena de chapéu, não "nuvem".
const TOPETE_PIVO: P = [50.6, 11.4];
const TOPETE = pluma([50.2, 11.8], [60.2, 12.6], [68.4, 7.4], 1.7, 3, 0.45);

// Tiara (coordenadas locais, centro da faixa em 0,0): 3 pontas com pérolas e a gema rosa grande no meio.
const TIARA_FORMA = 'M-10.4 1.6L-10.1-2.4L-7.4-5.4L-3.8-2.6L0-7.2L3.8-2.6L7.4-5.4L10.1-2.4L10.4 1.6Q0-1.6-10.4 1.6Z';
const TIARA_FORMA_PEROLAS = TIARA_FORMA + circ(-7.4, -6.2, 1.5) + circ(0, -8.1, 1.75) + circ(7.4, -6.2, 1.5);
const TIARA_REALCE = 'M-8.6-1.2L-8.3-3.6M-1-3.4L-0.5-6' + circ(-0.9, -3.2, 0.8) + circ(-7.4, -6.2, 1) + circ(0, -8.1, 1.2) + circ(7.4, -6.2, 1);
/** Tiara ASSENTADA no cocuruto (a faixa 2,4 abaixo do alto da cabeça, escala .65); `giro` = tombo do humor. */
const tiaraEm = (giro: number) => `translate(45.2 12.8) rotate(${-5 + giro}) scale(.65)`;

// Bico: CUNHA curta (triângulo arredondado, como o bico da galinha, só que deitado) embaixo da cabeça (o
// queixo), ponta em x ≈ 32,4 (só um pouco além da cabeça: lê como bico, não como régua). Afina de verdade:
// 7,4 de altura na base → 2,8 perto da ponta. Cúlmen CONVEXO (os controles ≈ 1,9 acima da reta) que DESCE
// para a ponta e dobra num gancho suave (a ponta cai ≈ 1 abaixo da comissura), mandíbula levemente CÔNCAVA
// (+0,4 no meio). Caminho ABERTO: o preenchimento fecha a base (x ≈ 46,5–49, dentro da cara) com uma reta e o
// contorno não passa nela — o bico nasce do rosto.
const BICO_FECHADO = 'M49 28.6C44.4 27.9 37.6 29.6 34.4 32.4C32.4 33.6 32.2 35.6 34.2 35.5C38.4 35.1 42.4 35.4 46.5 36';
// Sombra cel + traço, num <path> só (preenchimento cel, traço do material): a lâmina da mandíbula (a borda de
// cima É a comissura, ≈ 3/4 da altura), a unha da ponta (a borda de dentro vira a linha da unha), a narina
// (fenda: ida e volta, área zero) e o "canto" do humor, já na pele (ida e volta também).
const COMISSURA = 'M33.8 34.8C37.4 34.5 41.6 34.9 46.8 35.2';
const BICO_SOMBRA =
  COMISSURA +
  'L46.5 36C42.4 35.4 38.4 35.1 34.2 35.5Q33.7 35.3 33.8 34.8Z' +
  'M35.5 31.6Q34.8 31.9 34.4 32.4C32.4 33.6 32.2 35.6 34.2 35.5Q33.3 33.8 35.5 31.6Z' +
  'M41.4 30.8Q42.6 30.3 43.8 30.5Q42.6 30.3 41.4 30.8Z';
// Fio de luz no cúlmen (por dentro do contorno).
const BICO_REALCE = 'M45.4 29.7Q40.6 29.5 36.6 31.6';
// ABERTO (só a surpresa): a de cima termina na comissura (a unha em gancho por cima); a de baixo (mandíbula,
// lâmina fina) GIRA na dobradiça. Também abertos na base (o contorno não fecha dentro da cara).
const BICO_ABERTO_CIMA = 'M49 28.6C44.4 27.9 37.6 29.6 34.4 32.4C32.6 33.4 32.3 34.9 33.4 35.1C33.9 35.1 34.2 34.8 34.6 34.7C38 34.4 41.6 34.8 46.8 35.1';
const BICO_ABERTO_BAIXO = 'M46.8 35.3C41.6 35 38 34.7 34.8 34.9C33.9 35 33.8 35.5 34.4 35.6C38.4 35.2 42.4 35.4 46.5 36';
const DOBRADICA: P = [46.8, 35.2];
// Canto da comissura (continua o traço dela, já na pele, debaixo do olho de perto): [cx, cy, x, y] relativos
// (uma "q"). Curto e baixo: o sorriso do feliz vem da bochecha e dos olhos, não de um canto de boca torto.
const CANTO: Partial<Record<Humor, [number, number, number, number]>> = {
  feliz: [1.6, 0.3, 2.6, -1.4],
  neutro: [1.5, 0, 2.3, -0.6],
  cansado: [1.6, 0.1, 2.4, 0.8],
  triste: [1.6, 0.3, 2.3, 1.9],
  aposentado: [1.6, 0, 2.4, -0.7],
};
/** O canto como ida e volta (área zero: o preenchimento cel não aparece, só o traço). */
function canto(h: Humor): string {
  const c = CANTO[h];
  if (!c) return '';
  const [a, b, x, y] = c;
  return `M${pp(DOBRADICA)}q${a} ${b} ${x} ${y}q${f1(a - x)} ${f1(b - y)} ${-x} ${-y}`;
}

// Touca de dormir (aposentado), no tamanho da cabeça, com estrelinha dourada bordada.
const TOUCA_CONE = 'M37.8 24.4C37 10.6 47 3.2 58.6 3C70.6 2.8 82.4 9.4 89.4 20.6C86.2 18.8 82.6 18.4 79.4 19.2L77.8 24.4C64.6 19 51 19 37.8 24.4Z';
const TOUCA_LISTRAS = 'M48.6 6.6Q55 13.4 57 21M67.6 4.6Q73.6 11.6 74.6 20.4';
const TOUCA_ABA = 'M35.6 26C39 18.2 73.4 17.4 79 25.2C80 27.6 78 29 76 28.2C69 23.2 46.8 23.2 39.8 28.6C37.6 29.6 35 28.2 35.6 26Z';

// Pernas (só sem ninho): canela FINA e longa (meia largura ≈1,5) com a "junta" dobrada para TRÁS no meio
// (o tornozelo da avestruz) e o pé de 2 dedos (o de dentro bem maior); as duas num <path>, FORA da escala
// EM_PE (o resto da ave encolhe para cima e sobra perna: silhueta de avestruz, não de peru).
function pe(x: number): string {
  return (
    `M${x - 1.5} 86L${x - 1.2} 99Q${x - 1.5} 100.8 ${x - 1.3} 102.4L${x - 1.5} 108.8` +
    `Q${x - 7.2} 109 ${x - 8} 111.6Q${x - 8} 114 ${x - 5.2} 113.8H${x + 3.2}Q${x + 5.4} 113.6 ${x + 4.8} 111.4Q${x + 4.2} 109.4 ${x + 1.5} 108.8` +
    `L${x + 1.6} 102.6Q${x + 3.6} 100.6 ${x + 1.8} 98.4L${x + 1.5} 86Z`
  );
}
// De pé, a ave inteira (menos as pernas) encolhe ×0,92 em volta do alto da caixa: a barriga sobe para y ≈ 92
// e as pernas ficam longas (≈ 22); o alto da tiara só desce.
const EM_PE = 'translate(64 2) scale(.92) translate(-64 -2)';
const PES = pe(59) + pe(77);

// ------------------------------------------------------------------------------------------ rosto

// Olhos ENORMES (chibi): o de longe (esquerda) menor; ×1,3 da escala da cabeça por cima destes valores
// (≈ 0,99 e 1,12 no desenho final).
const OLHOS: DefOlho[] = [
  { x: 38, y: 22.2, lado: -1, e: 0.76 },
  { x: 51.8, y: 21.8, lado: 1, e: 0.86 },
];
// Surpresa: o olho cresce no kit — desce um pouco e encolhe para não estourar a cabeça.
const OLHOS_SUSTO: DefOlho[] = [
  { x: 38.2, y: 22.8, lado: -1, e: 0.72 },
  { x: 51.6, y: 22.4, lado: 1, e: 0.81 },
];
const CORES: CoresRosto = { contorno: PELE_CONTORNO, palpebra: PALPEBRA, sombra: '#b8566a', iris: 'url(#gi-animais-avestruz-iris)', cilio: CILIO };
// Cílios longos da diva (kit): 3 por olho, 35% mais longos. O MESMO objeto vai para <Olhos/> e <Piscada/>.
const CILIOS: CiliosOlho = { n: 3, comp: 1.35 };

// ------------------------------------------------------------------------------------------- poses

interface Pose {
  /** Cabeça: deslocamento [dx, dy] e giro em graus em volta da ÂNCORA (+ = empina o bico). */
  cabeca: [number, number, number];
  /** Controles da cúbica do pescoço (base → c1 → c2 → âncora deslocada): o "S". */
  c1: P;
  c2: P;
  /** Tombo extra da tiara (graus). */
  tiara: number;
  /** Giro do topete (graus). */
  topete: number;
  /** Giro da cauda (− = levanta) e da asa (− = levanta as pontas). */
  cauda: number;
  asa: number;
  corpo?: string;
  /** Abertura do bico em graus (a mandíbula gira na dobradiça). */
  bico: number;
}

// O desânimo (cansado/triste) vem da cabeça TOMBANDO (giro) e indo para a DIREITA do pescoço, nunca para a
// esquerda: o canto de cima à esquerda do ninho é do selo "!" (vida baixa). Ela desce POUCO: o pescoço fica
// frouxo (S aberto, curvado para a frente) e sobram 6–8 de pescoço rosado acima do colar — o pescoço é a marca
// da espécie. Só a surpresa abre o bico: a alegria do feliz é o canto da comissura para cima, a bochecha e os
// olhos.
const POSES: Record<Humor, Pose> = {
  feliz: { cabeca: [-1, -1, 8], c1: [57, 58], c2: [43, 49], tiara: -4, topete: -6, cauda: -8, asa: -6, bico: 26 },
  neutro: { cabeca: [0, 0, 0], c1: [58, 58], c2: [44, 50], tiara: 0, topete: 0, cauda: 0, asa: 0, bico: 0 },
  cansado: { cabeca: [3.4, 0.6, -10], c1: [57, 59], c2: [47, 51], tiara: 12, topete: 14, cauda: 7, asa: 4, bico: 0 },
  triste: { cabeca: [16.6, 1.4, -14], c1: [56, 59], c2: [56, 51], tiara: 8, topete: 22, cauda: 12, asa: 6, bico: 0 },
  surpresa: { cabeca: [1, 0, 3], c1: [56, 58], c2: [48, 48], tiara: 4, topete: 0, cauda: -12, asa: -12, bico: 20, corpo: 'translate(60 104) scale(.98 1.02) translate(-60 -104)' },
  aposentado: { cabeca: [-6, 6, -8], c1: [57, 62], c2: [41, 55], tiara: 0, topete: 0, cauda: 9, asa: 3, bico: 0, corpo: 'translate(0 2)' },
};

/** Centro da cabeça na tela (sem o giro), para os traços de susto. */
function centroCabeca(dx: number, dy: number): P {
  return [ANCORA[0] + (H_CX - ANCORA[0]) * H_ESCALA + dx, ANCORA[1] + (H_CY - ANCORA[1]) * H_ESCALA + dy + CORPO_DY];
}

// ------------------------------------------------------------------------------------------ peças

function Bico({ humor, abre }: { humor: Humor; abre: number }) {
  if (!abre) {
    return (
      <g className="ani-bico">
        <path d={BICO_FECHADO} fill={BICO} {...sil(BICO_CONTORNO, 1.6)} strokeLinecap="butt" />
        <path d={BICO_REALCE} {...linha('#ffffff', 1.2, 0.9)} />
        <path d={BICO_SOMBRA + canto(humor)} fill={BICO_CEL} stroke={BICO_CONTORNO} strokeWidth={1.15} strokeLinejoin="round" strokeLinecap="round" opacity={0.95} />
      </g>
    );
  }
  // Dobradiça: a mandíbula GIRA para baixo (anti-horário: a ponta fica à esquerda); a boca escura vem POR
  // CIMA das duas peças, com traço fino (borda de cima = comissura, de baixo = o topo da mandíbula girada).
  const g = -abre;
  const r = (x: number, y: number) => pp(gira([x, y], g, DOBRADICA));
  const boca = `M${pp(DOBRADICA)}C41.6 34.8 38 34.4 34.6 34.7L${r(34.8, 34.9)}C${r(38, 34.7)} ${r(41.6, 35)} ${pp(DOBRADICA)}Z`;
  return (
    <g className="ani-bico">
      <path d={BICO_ABERTO_BAIXO} transform={`rotate(${g} ${DOBRADICA[0]} ${DOBRADICA[1]})`} fill={BICO} {...sil(BICO_CONTORNO, 1.6)} strokeLinecap="butt" />
      <path d={BICO_ABERTO_CIMA} fill={BICO} {...sil(BICO_CONTORNO, 1.6)} strokeLinecap="butt" />
      <path d={boca} fill="#6a1a28" stroke={BICO_CONTORNO} strokeWidth={1.1} strokeLinejoin="round" />
      <path d={BICO_REALCE} {...linha('#ffffff', 1.2, 0.9)} />
    </g>
  );
}

function Tiara({ giro }: { giro: number }) {
  return (
    <g className="ani-acessorio" transform={tiaraEm(giro)}>
      <path d={TIARA_FORMA_PEROLAS} fill={TIARA} {...sil(OURO_CONTORNO, 2.1)} />
      <ellipse cx={0} cy={-2.2} rx={2.9} ry={3.3} fill="url(#gi-animais-avestruz-gema)" stroke="#7a0f32" strokeWidth={1.2} />
      <path d={TIARA_REALCE} fill="#fff" stroke="#fff" strokeWidth={0.9} strokeLinecap="round" opacity={0.9} />
    </g>
  );
}

function Touca() {
  return (
    <g className="ani-acessorio" transform="translate(45.4 14.6) scale(.72) translate(-57.3 -25)">
      <path d={TOUCA_CONE} fill="url(#gi-animais-touca)" {...sil('#1f3a66', 3.4)} />
      <path className="ani-linha" d={TOUCA_LISTRAS} fill="none" stroke="#c4dbf7" strokeWidth={2.4} strokeLinecap="round" opacity={0.75} />
      <path d={estrela(60.4, 11, 4)} fill="#ffd84d" stroke={OURO_CONTORNO} strokeWidth={1} strokeLinejoin="round" />
      <path d={TOUCA_ABA} fill="#f4f7fb" {...sil('#1f3a66', 2.2)} />
      <circle cx={90} cy={22} r={5} fill="#ffffff" {...sil('#1f3a66', 2.2)} />
    </g>
  );
}

/** Avestruz sentada (ou de pé, sem ninho) no humor pedido. */
export function Avestruz({ humor, ninho = true }: PropsEspecie) {
  const p = POSES[humor];
  const [dx0, dy0, giro] = p.cabeca;
  const dx = dx0 + H_DESVIO;
  const dy = dy0 + H_DESCE;
  const topo: P = [ANCORA[0] + dx, ANCORA[1] + dy];
  const eixo: Cubica = [P_BASE, p.c1, p.c2, topo];
  const pescoco = faixa(eixo, 0, 1, -1, 1, 10);
  const pescocoCel = faixa(eixo, 0, 0.9, 0.22, 1, 8);
  const realce = suave(lado(eixo, 0.18, 0.74, -0.5, 5), true);
  // lod-g: penugem rala do pescoço — 3 tufinhos em "v" curtos e claros no lado de sombra (pelo, não costura).
  const penugem = [0.34, 0.5, 0.66]
    .map((s) => {
      const [a] = lado(eixo, s, s, 0.6, 1);
      const [tx, ty] = unit(dbez(eixo, s));
      const [nx, ny] = [-ty, tx];
      return `M${f1(a![0] - tx * 0.8)} ${f1(a![1] - ty * 0.8)}l${f1(nx * 1.2 + tx * 0.8)} ${f1(ny * 1.2 + ty * 0.8)}l${f1(-nx * 1.2 + tx * 0.8)} ${f1(-ny * 1.2 + ty * 0.8)}`;
    })
    .join('');
  // Emenda (só preenchimento): o topo do pescoço levado para as coordenadas da cabeça (desfaz o deslocamento,
  // o giro e a escala da pose), por cima do contorno dela.
  const paraCabeca = (q: P): P => desescala(gira([q[0] - dx, q[1] - dy], -giro, ANCORA));
  // Ela começa logo depois de os DOIS lados do pescoço cruzarem o contorno da cabeça (elipse + 2,8 de traço):
  // mais para baixo, a cor lisa da emenda apareceria por cima da sombra do pescoço como uma "faixa".
  const fora = (k: number, s: number) => {
    const [x, y] = lado(eixo, s, s, k, 1, paraCabeca)[0]!;
    return ((x - H_CX) / (H_RX + 2.8)) ** 2 + ((y - H_CY) / (H_RY + 2.8)) ** 2 > 1;
  };
  let s0 = 0.96;
  while (s0 > 0.6 && !(fora(-0.92, s0) && fora(0.92, s0))) s0 -= 0.02;
  const emenda = faixa(eixo, s0, 1, -0.92, 0.92, 3, paraCabeca);
  // O colar se centra no eixo do pescoço na altura dele.
  const colarX = bez(eixo, 0.14)[0];
  const cabeca = `translate(${dx} ${dy}) rotate(${giro} ${ANCORA[0]} ${ANCORA[1]})`;
  const brilhos = humor === 'feliz' || humor === 'neutro';
  // Traços de susto: 3 riscos do lado de trás (direita) da cabeça; o "!" fica acima, à direita deles.
  const tracos =
    humor === 'surpresa'
      ? (() => {
          const [hx, hy] = centroCabeca(dx, dy);
          return [30, 8, -14]
            .map((g) => {
              const [c, s] = [Math.cos(rad(g)), -Math.sin(rad(g))];
              return `M${f1(hx + 23.4 * c)} ${f1(hy + 20.4 * s)}L${f1(hx + 28.6 * c)} ${f1(hy + 25 * s)}`;
            })
            .join('');
        })()
      : '';
  return (
    <>
      {/* Aura lendária: estática, só a opacidade pulsa (.ave-aura). */}
      <ellipse className="ave-aura" cx={64} cy={52} rx={58} ry={52} fill="url(#gi-animais-aura-lendaria)" />

      <g className="ani-corpo">
        {!ninho && <path d={PES} fill={PELE} {...sil(PELE_CONTORNO, 1.8)} />}
        <g transform={`${ninho ? '' : `${EM_PE} `}translate(0 ${CORPO_DY})${p.corpo ? ` ${p.corpo}` : ''}`}>

          <g className="ani-cauda">
            {/* De pé (sem ninho) o leque tomba +16° para trás e para baixo: tufo em cascata, não leque de peru. */}
            <g transform={p.cauda || !ninho ? `rotate(${p.cauda + (ninho ? 0 : 16)} 88 74)` : undefined}>
              <path d={CAUDA_TRAS} fill={PLUMA_OURO} {...sil(PLUMA_CONTORNO, 2.5)} className="ave-sil-pluma" />
              <path d={CAUDA_MEIO} fill={PLUMA_OURO} {...sil(PLUMA_CONTORNO, 2.4)} className="ave-sil-pluma" />
              <path className="ani-linha" d={CAUDA_LINHAS} {...linha(PLUMA_LINHA, 1.1, 0.6)} />
              {humor !== 'triste' && <path className="ave-glitter" d={GLITTER} fill="#ffe680" stroke="#c27c00" strokeWidth={0.45} strokeLinejoin="round" />}
            </g>
          </g>

          <path d={CORPO} fill={PLUMAGEM} {...sil(CONTORNO)} />
          <path d={CORPO_CEL} fill={CEL} opacity={0.3} />
          <path d={CORPO_FAIXA} fill={FAIXA_LUZ} opacity={0.62} />
          <path className="ani-borda-luz" d={CORPO_LUZ} {...linha(BORDA_LUZ, 1.6, 1)} opacity={0.7} />

          <g className="ani-asa-e">
            <g transform={p.asa ? `rotate(${p.asa} 58 71)` : undefined}>
              <path d={ASA_PLUMAS} fill={REMIGE} {...sil(PLUMA_CONTORNO, 1.8)} />
              <path d={ASA} fill={ASA_COR} {...sil(CONTORNO, 2.2)} />
              {/* Coberteiras: forma sólida com traço fino, cel embaixo de cada pena, fio de luz em cima. */}
              <path d={PENAS.forma} fill={PENA} stroke={PENA_TRACO} strokeWidth={0.9} strokeLinejoin="round" />
              <path d={PENAS.cel} fill={PENA_CEL} />
              <path className="ani-linha" d={PENAS.luz} {...linha(PENA_LUZ, 1, 0.7)} />
            </g>
          </g>

          <g className="ani-pescoco">
            <path d={colarTras(colarX)} fill={PLUMA} {...sil(PLUMA_CONTORNO, 2.2)} />
            <path d={pescoco} fill={PESCOCO} {...sil(PELE_CONTORNO, 2.4)} className="ave-sil-pele" />
            <path d={pescocoCel} fill={PESCOCO_CEL} opacity={0.6} />
            <path className="ani-linha" d={realce} {...linha(PESCOCO_LUZ, 1.5, 0.9)} />
            <path className="ani-so-g" d={penugem} {...linha('#e99aa2', 0.8, 0.6)} />
            <path d={colarFrente(colarX)} fill={COLAR} {...sil(PLUMA_CONTORNO, 2)} />

            <g className="ani-cabeca">
              <g transform={cabeca}>
                <g transform={ESCALA_CABECA}>
                  {humor !== 'aposentado' && (
                    <g className="ani-crista">
                      <g transform={p.topete ? `rotate(${p.topete} ${TOPETE_PIVO[0]} ${TOPETE_PIVO[1]})` : undefined}>
                        <path d={TOPETE} fill={PLUMA_OURO} {...sil(PLUMA_CONTORNO, 1.3)} />
                      </g>
                    </g>
                  )}
                  <path d={CABECA} fill={PELE} {...sil(PELE_CONTORNO, 2.4)} className="ave-sil-pele" />
                  <path d={CABECA_CEL} fill={PELE_CEL} opacity={0.4} />
                  <path d={emenda} fill={PESCOCO} />
                  <path className="ani-borda-luz" d={CABECA_LUZ} {...linha(BORDA_LUZ, 1.4, 1)} opacity={0.6} />

                  <ellipse
                    className="ani-bochechas"
                    cx={55.8}
                    cy={31.4}
                    rx={humor === 'feliz' ? 4.2 : 3.6}
                    ry={humor === 'feliz' ? 2.6 : 2.2}
                    fill="url(#gi-animais-avestruz-bochecha)"
                    opacity={Math.min(1, OPACIDADE_BOCHECHA[humor] + 0.15)}
                  />
                  <Olhos olhos={humor === 'surpresa' ? OLHOS_SUSTO : OLHOS} humor={humor} cores={CORES} cilios={CILIOS} semDelineado />
                  <Piscada olhos={OLHOS} humor={humor} cores={CORES} cilios={CILIOS} />
                  <Bico humor={humor} abre={p.bico} />
                  {humor === 'triste' && <Lagrima x={57.2} y={27.6} e={0.8} />}
                  {humor === 'aposentado' ? <Touca /> : <Tiara giro={p.tiara} />}
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>

      <g className="ani-fx">
        {brilhos && (
          <>
            <path className="ave-brilho" d={estrela(86, 20, 6.6)} fill="#ffe680" stroke="#c27c00" strokeWidth={0.6} strokeLinejoin="round" />
            <path className="ave-brilho" d={estrela(17, 56, 5.2)} fill="#ffe680" stroke="#c27c00" strokeWidth={0.6} strokeLinejoin="round" />
            <path className="ave-vaidade" d={estrela(75, 9, 4.4)} fill="#fff6c4" stroke="#c27c00" strokeWidth={0.6} strokeLinejoin="round" />
          </>
        )}
        {humor === 'surpresa' && (
          <>
            <path className="ani-tracos" d={tracos} fill="none" stroke="#6a4300" strokeWidth={2.4} strokeLinecap="round" />
            <Exclamacao x={83} y={12} />
          </>
        )}
        {humor === 'aposentado' && <Zzz x={66} y={36} />}
      </g>
    </>
  );
}

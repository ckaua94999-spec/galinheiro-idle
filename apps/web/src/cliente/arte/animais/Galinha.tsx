// Galinha (comum) — a REFERÊNCIA de arte que as outras espécies copiam.
//
// ============================================================== KIT DAS ESPÉCIES (siga este molde)
// Canvas: viewBox 0 0 120 120 (o <svg> é do Animal.tsx). Chão = borda do ninho em y≈90; o ninho cobre
// tudo abaixo disso, então o que importa precisa ficar acima de y≈88. Sem ninho (`ninho=false`) a
// espécie desenha os pés.
//
// Camadas (de trás para frente) e classes estáveis que o CSS anima (estilos/animais.css):
//   <g.ani-corpo>                 respiração com squash & stretch (pivô embaixo); TUDO vai dentro dele,
//     <g.ani-cauda>               para asas, cauda e cabeça acompanharem a respiração
//     <g.ani-asa-d>               (opcional) asa de trás, atrás do corpo; a galinha 3/4 não mostra
//     corpo: silhueta + sombra cel + realce + brilho de borda + penugem
//     <g.ani-asa-e>               asa da frente (camadas: rêmiges embaixo, coberteiras em cima)
//     <g.ani-pescoco>             (pato, ganso, avestruz) — pivô na base
//     <g.ani-cabeca>              ação ociosa (bicar, olhar, cochilar); pivô embaixo
//       <g transform=pose>        postura FIXA do humor (o CSS anima o grupo de fora)
//         <g.ani-crista> cabeça <Olhos/> <Piscada/> <Sobrancelhas/> bico barbela <Bochechas/> acessório
//   <g.ani-fx>                    "!", Zzz (fora da cabeça; ficam dentro da caixa 120×120)
// Cada grupo animado tem um <g transform> por dentro com a pose do humor: o CSS usa as propriedades
// individuais (rotate/translate/scale) no grupo de fora e o atributo transform no de dentro não briga.
//
// Desenho (DIRECAO_DE_ARTE 5.1):
//  - Silhueta: {...sil(corContorno)} = traço 7 com paint-order stroke (3,5 visível, atrás do preenchimento).
//    Contorno COLORIDO por material (penas #8a4a22, crista #6e1622, bico #7a3a0c), nunca preto.
//  - Volume em 3 tons: gradiente radial gi-animais-<especie>-<material> + sombra "cel" (crescente nítido
//    embaixo à direita, opacidade .55) + elipse de realce (gi-animais-realce) no alto à esquerda +
//    brilho de borda #bfe6ff (.ani-borda-luz) embaixo à direita.
//  - Linhas internas/detalhes com className="ani-linha" (somem no lod-p); extras do lod-g com "ani-so-g".
//  - Rosto: <Olhos/>, <Piscada/>, <Sobrancelhas/>, <Bochechas/>, <Lagrima/> de comum.tsx — só passe
//    os centros dos olhos, a escala e as cores (CoresRosto). Humor = variantes desenhadas (switch), sem filter.
//    Opcionais para a espécie NÃO copiar o kit (comum.tsx):
//      <Olhos cilios={{n, comp, cor}}>  cílios longos (lâminas curvas) que acompanham o estado: abertos no
//                                       delineado (no <g.ani-cilios>, que some na piscada), caídos na borda da
//                                       tampa, em leque no "^" do feliz, pendurados no "‿" do aposentado;
//      <Piscada cilios={...}>           o MESMO objeto: cílios pendurados da linha de fechamento;
//      <Olhos semDelineado>             olho aberto sem o delineado do topo;
//      <Olhos tampa={{dentro, fora, curva, rabo}}>  tampa fixa própria (fração da altura coberta no canto de
//                                       dentro/fora; null = sem tampa) — ex.: o "desdém" do ganso;
//      <Olhos olhar={[x, y]}>           direção do olhar própria; <Bochechas fill="url(#...)"> gradiente próprio.
//    Exportados para peças próprias: MEDIDAS, OLHAR, corteOlho, tampa, bordaTampa, TampaOlho, CiliosOlho.
//  - Piscada (<Piscada/>, 1 <path>): pálpebra cheia na cor `palpebra` SEM contorno em volta e do TAMANHO
//    do olho (folga 0,7, sem "asa"): nunca passa por cima do contorno da cabeça nem vira oval claro sobre o
//    gradiente. O delineado (e o rabinho) dos olhos abertos/tampa fica no <g.ani-cilios> de <Olhos/>, que
//    some (opacity) enquanto a pálpebra desce — por isso ela não precisa cobri-lo. O traço (cor `cilio`,
//    2,3) só aparece na linha de fechamento "‿" no terço de baixo + cílio do canto de fora
//    (stroke-dasharray; cada subcaminho começa e termina na ponta do cílio: sem fiapos; ver comum.tsx).
//    `palpebra` aceita url(#gi-animais-<especie>-palpebra) em userSpaceOnUse, igual ao gradiente da cabeça.
//    Espécie com pálpebra/piscada própria que troca o keyframe (ex.: piscar duplo) troca --anim-cilios
//    junto, senão o delineado some fora de hora. Peça própria que desenha cílios/delineado fora de <Olhos/>
//    deve pô-los num <g.ani-cilios> (senão sobram "tocos" por cima da pálpebra). Galeria:
//    /dev/galeria/animais, bloco "piscada congelada" (classe dev .gi-piscada-fechada).
//  - Bico falando: ponha o bico de baixo num <g.ani-mandibula> e ligue --anim-mandibula (ani-tagarelar ou
//    keyframe próprio) no CSS da espécie: só TRANSLATE (--mandibula-abre, padrão 1,4px), nunca scale. Conta
//    como a "1 ação" do orçamento de grupos animados; parado em cansado/triste/aposentado/surpresa.
//  - Juntar formas iguais num só <path> (menos elementos; orçamento lod-m ≤ 55 contando o ninho, que agora
//    gasta 10 com a sombra: sombra 1 + trás 3 + oclusão 1 + frente 5; +1 com o ovo do "pronto", cujo brilho
//    vem do gradiente). A galeria conta os elementos de cada animal no bloco "orçamento", inclusive com o
//    "pronto" (pior caso). Espécie no limite: o ganso (triste pronto = 55).
//  - Personalidade da galinha: fofoqueira e agitada → pose 3/4 virada para a esquerda, bica o chão.
//  - Olhos (todos em <Olhos/>, as espécies herdam): esclera SEM contorno nenhum (anel = "óculos"); a
//    separação da cabeça vem do gradiente gi-animais-olho-esclera (sombra quente no alto, fundo frio).
//    Abertos (neutro, surpresa): delineado só no topo, assimétrico (alto do lado de dentro → rabinho no
//    canto de fora). Cansado/triste: tampa preenchida SEM traço + delineado na borda (cor `cilio`, 2,4).
//    Feliz: FECHADOS em "^" (crescente cheio, cor `cilio`) — polo oposto do cansado, lê a 72 px.
//  - Peças pequenas com contorno (bico, barbela, pés): sil(cor, 1.6) → classe ani-sil-fino (lod-p: 4, não 9).
//  - Bico aberto = dobradiça: o bico de baixo GIRA (graus) e a boca escura vem por cima dos dois bicos
//    com traço fino (senão os contornos grossos engolem a abertura). Ver Bico() abaixo.
//  - Penas soltas (cauda): um <path> por pena, de trás para a frente — o contorno de uma separa da outra.
//  - Fx dentro da caixa 120×120: "!" com y ≥ 12; <Zzz> com y ≥ 26 (sentido -1 sobe para a esquerda),
//    começando logo acima da aba da touca. Susto = "!" + 3 traços curtos (.ani-tracos, #6a4300, 2,4)
//    irradiando da cabeça do lado oposto ao "!" — nada de penas espetadas (liam como chifre/orelha).
//  - Pés (sem ninho): canela + "luva" de 3 dedos num <path> só para os dois pés, ANTES do corpo.
//
// ======================== DESVIOS DA DIRECAO_DE_ARTE (valem MAIS que o documento para as espécies)
// Testados a 72 px; o documento (5.1/5.4) ainda não foi atualizado:
//  - Olho: rx 7,4 / ry 9 (doc: 7 / 8,5); pato/ganso/avestruz escalam por `e` (0,95 / 0,9 / 1,25).
//  - Sobrancelha: traço 2,3 (doc: 1,75), na cor do contorno, forma/opacidade por humor (SOBRANCELHAS em
//    comum). Neutro: nivelada, arco suave para CIMA, opacidade .9 (inclinada para o bico lia "bravo").
//    Surpresa: alta e curta (meia largura 3,4), longe do olho (não emoldura a esclera).
//  - Esclera sem contorno (doc: contorno); tampa sem traço + delineado 2,4 na cor `cilio`.
//  - Neutro SEM tampa (qualquer tampa lia "desconfiado" a 72 px): olho aberto e calmo.
//  - Feliz: olhos fechados "^ ^" (crescente cheio), bochechas +1 de raio e opacidade .95, crista −6.
//  - Aposentado: olhos fechados em "‿" (arco para baixo) com cílio, não U invertido.
//  - Asas, cauda e cabeça ficam DENTRO de .ani-corpo (acompanham a respiração); a pose do humor vai num
//    <g transform> interno de cada grupo animado.
//  - Brilho de borda #bfe6ff (.ani-borda-luz) no corpo E na cabeça, sempre do lado direito/de baixo,
//    colado no contorno e longe do bico (perto do bico parecia baba/risco).
//  - Piscada SEM o oval contornado (lia "óculos de natação"): pálpebra lisa do tamanho do olho + linha de
//    fechamento "‿" com cílio no canto de fora; o delineado some durante a piscada (doc: pálpebra com contorno).
//  - Cílios longos de espécie são opcionais no kit (CiliosOlho); a galinha não usa.
import { Bochechas, Exclamacao, Lagrima, Olhos, Piscada, Sobrancelhas, Zzz, elip, linha, sil, type CoresRosto, type DefOlho, type Humor, type PropsEspecie } from './comum';

const f1 = (n: number) => Math.round(n * 10) / 10;

const CONTORNO = '#8a4a22';
const PENAS = 'url(#gi-animais-galinha-penas)';
const ASA = 'url(#gi-animais-galinha-asa)';
const CEL = '#edb592';
const PENUGEM = '#d9a07a';
const CRISTA = 'url(#gi-animais-galinha-crista)';
const CRISTA_CONTORNO = '#6e1622';
const BICO = 'url(#gi-animais-galinha-bico)';
const BICO_CONTORNO = '#7a3a0c';
const BORDA_LUZ = '#bfe6ff';

const OLHOS: DefOlho[] = [
  { x: 49.4, y: 44.6, lado: -1 },
  { x: 67.6, y: 44.6, lado: 1, e: 0.94 },
];
const CORES: CoresRosto = { contorno: CONTORNO, palpebra: '#fff1dc', sombra: '#b9764e', iris: 'url(#gi-animais-galinha-iris)', cilio: '#4a220c' };

interface Pose {
  /** transform da cabeça (pivô ≈ base em 58,66). */
  cabeca?: string;
  /** Giro extra da crista (+ = murcha para a direita). */
  crista: number;
  /** Giro da cauda (− = levanta). */
  cauda: number;
  /** Giro da asa da frente (+ = abre). */
  asa: number;
  /** transform do corpo inteiro (esticar no susto, afundar no aposentado). */
  corpo?: string;
  /** Abertura do bico em graus (0 = fechado): o bico de baixo gira na dobradiça. */
  bico: number;
}

const POSES: Record<Humor, Pose> = {
  feliz: { cabeca: 'rotate(4 58 66)', crista: -6, cauda: -8, asa: 10, bico: 30 },
  neutro: { crista: 0, cauda: 0, asa: 0, bico: 0 },
  cansado: { cabeca: 'translate(0 4) rotate(-3 58 66)', crista: 15, cauda: 7, asa: -4, bico: 9 },
  triste: { cabeca: 'translate(0 3) rotate(-6 58 66)', crista: 24, cauda: 12, asa: -6, bico: 0 },
  surpresa: { cabeca: 'translate(0 -4)', crista: -5, cauda: -12, asa: 22, bico: 48, corpo: 'translate(60 104) scale(.97 1.06) translate(-60 -104)' },
  aposentado: { cabeca: 'translate(0 5) rotate(-10 58 66)', crista: 0, cauda: 9, asa: -3, bico: 0, corpo: 'translate(0 3)' },
};

// ----------------------------------------------------------------------------------------- formas

const CORPO = 'M30 80C27.6 68.6 33.4 60.4 42.4 57.6C47 56.2 52.6 56 58.6 56.4C75 56.2 87.6 60 93.6 69.4C98.8 77.6 97.2 92.4 87 100.2C77 107.4 45 107.6 34.4 100.4C27 95 27.6 87 30 80Z';
const CORPO_CEL = 'M93.6 69.6C99 79.6 96 94.6 86.4 100.6C75.4 107.4 46.4 107.2 35.8 100.6C51.6 103 74.4 100 84.4 90.6C90.4 84.8 93.2 77.6 93.6 69.6Z';
const PEITO = 'M38.6 72.6q2.7 2.6 5.4 0q2.7 2.6 5.4 0M35.4 79.4q2.7 2.6 5.4 0q2.7 2.6 5.4 0q2.7 2.6 5.4 0M43 86q2.7 2.4 5.4 0q2.7 2.4 5.4 0';
const PEITO_G = 'M53 70q2.4 2.2 4.8 0M56.6 78.6q2.4 2.2 4.8 0M60.4 86q2.4 2.2 4.8 0';

// Cauda: leque FECHADO de 3 penas em foice (pontudas, curvas para cima e para trás), sobrepostas
// (bases juntas, ~21° de abertura total), a de cima a mais longa. Cada pena é um <path> próprio: o
// contorno da de baixo separa as penas; as de trás têm contorno mais fino (3,4) para quebrar a
// uniformidade. [base, controle, ponta, largura]; o grupo todo leva escala .85 em torno de (88,74).
type Pena = [number, number, number, number, number, number, number];
const PENAS_CAUDA: Pena[] = [
  [84, 71, 87, 48, 106, 39, 10],
  [85.6, 72.6, 95, 53, 108.9, 49.3, 9],
  [87, 76.6, 98.5, 64.6, 110.1, 60.7, 8],
];
function pena([bx, by, cx, cy, tx, ty, w]: Pena): string {
  const dx = tx - bx;
  const dy = ty - by;
  const l = Math.hypot(dx, dy);
  const nx = (-dy / l) * w;
  const ny = (dx / l) * w;
  return `M${bx} ${by}Q${f1(cx + nx)} ${f1(cy + ny)} ${tx} ${ty}Q${f1(cx - nx)} ${f1(cy - ny)} ${bx} ${by}Z`;
}
const CAUDA = PENAS_CAUDA.map(pena);
// Ráquis (o "talo" de cada pena), até 80% do comprimento.
const CAUDA_LINHAS = PENAS_CAUDA.map(([bx, by, cx, cy, tx, ty]) => `M${bx} ${by}Q${cx} ${cy} ${f1(cx + (tx - cx) * 0.75)} ${f1(cy + (ty - cy) * 0.75)}`).join('');
const CAUDA_ESCALA = 'translate(88 74) scale(.85) translate(-88 -74)';

// Asa da frente no flanco, do ombro (58,66, logo atrás da cabeça) para trás, pontas para a cauda.
const ASA_REMIGES = 'M58 65.4C67.4 61 80.4 63 87.6 70.4C92.2 75 93.6 81.4 90.6 84.8C88.6 87 85.2 86.4 84 84.2C82.4 87.4 77.8 88.2 75.6 85.6C69.4 85.6 59.6 80.6 56.6 74.4C55.2 71 55.8 67.2 58 65.4Z';
const ASA_COBERTEIRAS = 'M58 65.4C65.6 61.8 76.6 62.6 82.4 68.2C84 71.2 81.6 73.8 78.6 72.8C77.2 76 72.6 76.6 70.6 74C67.6 76.2 61.6 75.4 59.6 72.8C56.8 71 56 67.4 58 65.4Z';
const ASA_LINHAS = 'M75.6 85.6C75.2 81.6 73.8 78.6 71.6 76.2M84 84.2C83.6 80.4 82 77.2 79.6 74.8';

const CABECA = 'M58 23C70.4 23 80 32.2 80 44.6C80 56.4 70.8 65.6 58.6 65.6C52.6 65.6 47.6 63.8 44 60.6Q40.4 62.6 39.2 59.8Q36.6 59.2 38.2 55.6C37 52.2 36.4 48.6 36.4 44.6C36.4 32.2 45.8 23 58 23Z';
const CABECA_CEL = 'M79.6 47C78.4 57.6 70 65.2 58.6 65.4C52.4 65.4 47.8 63.6 44.6 60.8C49.6 62.6 54.4 63.2 59.4 62.6C69.4 61.6 76.6 55.6 79.6 47Z';

const CRISTA_FORMA = 'M47.5 30C43.4 25.4 44 18 49.6 17C50.6 11.6 56.4 8.4 61.2 11.6C64.8 8.2 71.6 10 71.2 16.2C75.6 18.4 75.2 25.2 70.2 29.2Z';
const CRISTA_REALCE = elip(50.8, 20.6, 1.5, 2.3) + elip(59.4, 15.4, 1.7, 2.3) + elip(68.6, 18.2, 1.3, 1.9);
const CRISTA_LINHAS = 'M55.2 27.4Q54.8 20 57.2 14.6M64.4 27.4Q65.2 21.2 67.8 17';
// Traços de susto: 3 riscos curtos irradiando do lado esquerdo da cabeça (o "!" fica à direita).
// Raios a partir do centro da cabeça já erguida (58, 40.6), de r 27 a 32, em 150°/172°/194° ("10 h" a "8 h", longe da crista).
const TRACOS_SUSTO = [150, 172, 194]
  .map((g) => {
    const a = (g * Math.PI) / 180;
    const [c, sn] = [Math.cos(a), -Math.sin(a)];
    return `M${f1(58 + 27 * c)} ${f1(40.6 + 27 * sn)}L${f1(58 + 32.5 * c)} ${f1(40.6 + 32.5 * sn)}`;
  })
  .join('');

const BARBELA = 'M54.6 57.6C50.8 60 51 66.6 54.6 67C57.8 67.4 58.8 62.2 57.6 58.4ZM59.6 58.2C58.6 62.4 59.6 67.8 62.8 67.4C66 67 65.4 60.6 61.8 57.8Z';
const BICO_CIMA = 'M52.6 50.2C55.6 47.6 62 47.4 65 50C63.4 53.6 59.4 57 56 57.6C53.8 56.2 52.2 53.4 52.6 50.2Z';
const BICO_BAIXO = 'M55.4 56.6C58.4 56 61.6 54.4 63.4 52.6C63.6 55.8 60.6 59 57.2 59.4C56.2 58.8 55.6 57.8 55.4 56.6Z';
const BICO_REALCE = 'M54.2 50.6Q57.4 48.6 61 49.2Q57.6 50.2 55.4 53Z';

const TOUCA_CONE = 'M39 36.4C38.6 21 52 11.6 66.8 12.2C80 12.8 92.4 21 96.6 33.6C92.2 30.4 86.6 29.6 81.6 30.6C80.4 32.6 79.6 34.6 78.6 36.4C66 30.2 51.4 30.2 39 36.4Z';
const TOUCA_LISTRAS = 'M51.4 16.6Q59.4 23.4 62.6 32M71.6 14.4Q76.6 21.6 77.4 31';
const TOUCA_ABA = 'M36.6 38C40.4 29 75.6 28.6 80.2 37.6C81 40.2 78.8 41.6 76.6 40.6C70.4 35.2 46.6 35.2 40.6 41C38.4 42 36 40.4 36.6 38Z';

// Pés (só sem ninho): canela curta saindo de trás do corpo + "luva" de 3 dedos redondos, os dois
// num <path> só. Desenhados ANTES do corpo, que cobre o topo da canela.
function pe(x: number): string {
  // Canela (2,8 de largura) desce de dentro do corpo até 108,2; 3 dedos com reentrâncias marcadas
  // (o contorno enche a reentrância e desenha o "V" entre os dedos); o do meio é o mais comprido.
  const p = (dx: number, y: number) => `${f1(x + dx)} ${y}`;
  return (
    `M${p(-1.4, 100)}V108.2Q${p(-5.8, 108.4)} ${p(-5.7, 111.6)}Q${p(-5.6, 114.2)} ${p(-3.2, 113.8)}` +
    `Q${p(-2.2, 113.6)} ${p(-1.6, 112.6)}Q${p(0, 115.6)} ${p(1.6, 112.6)}Q${p(2.2, 113.6)} ${p(3.2, 113.8)}` +
    `Q${p(5.6, 114.2)} ${p(5.7, 111.6)}Q${p(5.8, 108.4)} ${p(1.4, 108.2)}V100Z`
  );
}
const PES = pe(47) + pe(69);

// ------------------------------------------------------------------------------------------ peças

// Dobradiça do bico (canto da boca, atrás, perto da bochecha): o bico de baixo GIRA aqui, não desce.
const DOBRA: [number, number] = [54.4, 55.6];

function gira([x, y]: [number, number], graus: number): [number, number] {
  const a = (graus * Math.PI) / 180;
  const dx = x - DOBRA[0];
  const dy = y - DOBRA[1];
  return [f1(DOBRA[0] + dx * Math.cos(a) - dy * Math.sin(a)), f1(DOBRA[1] + dx * Math.sin(a) + dy * Math.cos(a))];
}

// Borda de cima do bico de baixo (da ponta para trás), a mesma curva do BICO_BAIXO.
type Ponto = [number, number];
const BAIXO_TOPO: [Ponto, Ponto, Ponto, Ponto] = [
  [55.4, 56.6],
  [58.4, 56],
  [61.6, 54.4],
  [63.4, 52.6],
];

function Bico({ humor, abre }: { humor: Humor; abre: number }) {
  // Aberto = dobradiça: o bico de cima fica fixo e o de baixo GIRA `abre` graus no canto da boca.
  // A boca escura vem POR CIMA dos dois bicos, com traço fino: assim o contorno grosso das peças não
  // engole a abertura. Borda de cima = a mesma curva do bico de cima; de baixo = a do bico de baixo girada.
  const g = abre;
  const j0 = gira(BAIXO_TOPO[0], g);
  const j1 = gira(BAIXO_TOPO[1], g);
  const j2 = gira(BAIXO_TOPO[2], g);
  const j3 = gira(BAIXO_TOPO[3], g);
  const boca = `M56 57.6C59.4 57 63.4 53.6 65 50L${j3[0]} ${j3[1]}C${j2[0]} ${j2[1]} ${j1[0]} ${j1[1]} ${j0[0]} ${j0[1]}Z`;
  // Língua deitada no fundo da boca (sobre a borda do bico de baixo), arqueada para cima.
  const [ax, ay] = gira([58.2, 56.2], g);
  const [bx, by] = gira([63.6, 53], g);
  const lingua = `M${ax} ${ay}Q${f1((ax + bx) / 2 - 0.4)} ${f1((ay + by) / 2 - 4.4)} ${bx} ${by}Q${f1((ax + bx) / 2 + 0.6)} ${f1((ay + by) / 2 + 1)} ${ax} ${ay}Z`;
  return (
    <g className="ani-bico" transform="translate(58.6 52) scale(1.07) translate(-58.6 -52)">
      <path d={BICO_BAIXO} transform={abre > 0 ? `rotate(${g} ${DOBRA[0]} ${DOBRA[1]})` : undefined} fill={BICO} {...sil(BICO_CONTORNO, 1.6)} />
      <g transform={humor === 'triste' ? 'rotate(4 58 50)' : undefined}>
        <path d={BICO_CIMA} fill={BICO} {...sil(BICO_CONTORNO, 1.6)} />
        <path d={BICO_REALCE} fill="#fff" opacity={0.65} />
      </g>
      {abre > 0 && (
        <>
          <path d={boca} fill="#7a1e2c" stroke={BICO_CONTORNO} strokeWidth={1.1} strokeLinejoin="round" />
          {humor !== 'surpresa' && abre > 15 && <path d={lingua} fill="#ff6f7d" />}
        </>
      )}
    </g>
  );
}

function Touca() {
  return (
    <g className="ani-acessorio">
      <path d={TOUCA_CONE} fill="url(#gi-animais-touca)" {...sil('#1f3a66', 3)} />
      <path className="ani-linha" d={TOUCA_LISTRAS} fill="none" stroke="#c4dbf7" strokeWidth={2.4} strokeLinecap="round" opacity={0.75} />
      <path d={TOUCA_ABA} fill="#f4f7fb" {...sil('#1f3a66', 1.8)} />
      <circle cx={97} cy={36.2} r={4.8} fill="#ffffff" {...sil('#1f3a66', 1.8)} />
      <circle cx={95.4} cy={34.6} r={1.6} fill="#dfe9f7" />
    </g>
  );
}

/** Galinha sentada (ou de pé, sem ninho) no humor pedido. */
export function Galinha({ humor, ninho = true }: PropsEspecie) {
  const p = POSES[humor];
  return (
    <>
      <g className="ani-corpo">
        <g transform={p.corpo}>
          {!ninho && <path d={PES} fill={BICO} {...sil(BICO_CONTORNO, 1.6)} />}

          <g className="ani-cauda">
            <g transform={(p.cauda ? `rotate(${p.cauda} 88 74) ` : '') + CAUDA_ESCALA}>
              {CAUDA.map((d, i) => (
                <path key={d} d={d} fill="url(#gi-animais-galinha-cauda)" {...sil(CONTORNO, i === CAUDA.length - 1 ? 4.1 : 3.4)} />
              ))}
              <path className="ani-linha" d={CAUDA_LINHAS} {...linha(PENUGEM, 1.4, 0.8)} />
            </g>
          </g>

          <path d={CORPO} fill={PENAS} {...sil(CONTORNO)} />
          <path d={CORPO_CEL} fill={CEL} opacity={0.55} />
          <ellipse cx={44} cy={67} rx={10} ry={5.4} fill="url(#gi-animais-realce)" transform="rotate(-22 44 67)" />
          <path className="ani-borda-luz" d="M94.4 74.4Q95.6 81 93.6 87.4" {...linha(BORDA_LUZ, 1.6, 1)} opacity={0.45} />
          <path className="ani-linha" d={PEITO} {...linha(PENUGEM, 1.3, 0.75)} />
          <path className="ani-so-g" d={PEITO_G} {...linha(PENUGEM, 1.1, 0.6)} />

          <g className="ani-asa-e">
            <g transform={p.asa ? `rotate(${-p.asa} 58 66)` : undefined}>
              <path d={ASA_REMIGES} fill={ASA} {...sil(CONTORNO, 2.4)} />
              <path className="ani-linha" d={ASA_LINHAS} {...linha(CONTORNO, 1.4, 0.55)} />
              <path d={ASA_COBERTEIRAS} fill={PENAS} stroke={CONTORNO} strokeWidth={1.75} strokeOpacity={0.85} strokeLinejoin="round" />
            </g>
          </g>

          <g className="ani-cabeca">
            <g transform={p.cabeca}>
              {humor !== 'aposentado' && (
                <g className="ani-crista">
                  <g transform={`rotate(${6 + p.crista} 59 29)`}>
                    <path d={CRISTA_FORMA} fill={CRISTA} {...sil(CRISTA_CONTORNO)} />
                    <path className="ani-linha" d={CRISTA_LINHAS} {...linha(CRISTA_CONTORNO, 1.2, 0.45)} />
                    <path d={CRISTA_REALCE} fill="#ffc4b0" opacity={0.7} />
                  </g>
                </g>
              )}

              <path d={CABECA} fill={PENAS} {...sil(CONTORNO)} />
              <path d={CABECA_CEL} fill={CEL} opacity={0.55} />
              <ellipse cx={48} cy={31.4} rx={8.4} ry={4.8} fill="url(#gi-animais-realce)" transform="rotate(-28 48 31.4)" />
              <path className="ani-borda-luz" d="M78.8 45Q78.6 50.6 75.2 55" {...linha(BORDA_LUZ, 1.5, 1)} opacity={0.5} />

              <path d={BARBELA} fill={CRISTA} {...sil(CRISTA_CONTORNO, 1.6)} />
              <Bochechas pontos={[[44.2, 55.6], [73.4, 55]]} humor={humor} />
              <Olhos olhos={OLHOS} humor={humor} cores={CORES} />
              <Piscada olhos={OLHOS} humor={humor} cores={CORES} />
              {humor !== 'aposentado' && <Sobrancelhas olhos={OLHOS} humor={humor} cor={CONTORNO} />}
              <Bico humor={humor} abre={p.bico} />
              {humor === 'triste' && <Lagrima x={43.6} y={50.4} />}
              {humor === 'aposentado' && <Touca />}
            </g>
          </g>
        </g>
      </g>

      {(humor === 'surpresa' || humor === 'aposentado') && (
        <g className="ani-fx">
          {humor === 'surpresa' && (
            <>
              <path className="ani-tracos" d={TRACOS_SUSTO} fill="none" stroke="#6a4300" strokeWidth={2.4} strokeLinecap="round" />
              <Exclamacao x={93} y={12} />
            </>
          )}
          {humor === 'aposentado' && <Zzz x={36} y={36} sentido={-1} />}
        </g>
      )}
    </>
  );
}

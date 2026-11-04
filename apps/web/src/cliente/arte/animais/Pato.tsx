// Pato (raro) — pato-de-pequim branco de quintal, no kit da Galinha.tsx (camadas, classes ani-*,
// contorno colorido, luz em 3 tons, olhos de comum.tsx). Leia o cabeçalho de Galinha.tsx antes de mexer.
//
// Personalidade: alegre e desajeitado. Leitura pela silhueta: "gota deitada" com a ponta da cauda
// arrebitada (cachinho), topete encaracolado no alto da cabeça e o bico de COLHER largo saindo para a
// esquerda. Um pé palmado laranja fica para fora do ninho (largado, à direita) — a piada do desenho.
//
// Diferenças em relação à galinha:
//  - Sombra FRIA (pervinca) e contorno índigo #34407a: as duas aves brancas não se confundem, e o branco
//    frio casa com o azul da raridade. Íris azul.
//  - Bico de frente (colher larga, ~70% da cabeça, com narinas). Abrir = a MANDÍBULA (bico de baixo fino
//    + língua, grupo .pato-mandibula) desce por translate, nunca por scale (não engrossa o contorno). A boca
//    é fixa e vai até a borda de baixo da mandíbula: no "quack" do feliz ela só se revela.
//  - Raridade (raro, azul): lenço de bolinhas amarrado no pescoço (nó atrás), mais
//    um brilho fixo de 4 pontas no lenço. Nada de fx animado (o orçamento reserva isso para épico/lendário).
//  - Ações (animais-pato.css): neutro = cabeça curiosa + rebolado da cauda; feliz = "quack" (mandíbula)
//    + bater de asa. Sempre ≤ 4 grupos animados (no feliz não há pálpebra de piscar).
import { Bochechas, Exclamacao, Lagrima, Olhos, Piscada, Sobrancelhas, Zzz, circ, elip, linha, sil, type CoresRosto, type DefOlho, type Humor, type PropsEspecie } from './comum';

const f1 = (n: number) => Math.round(n * 10) / 10;

const CONTORNO = '#34407a';
const PENAS = 'url(#gi-animais-pato-penas)';
const ASA = 'url(#gi-animais-pato-asa)';
const CEL = '#bccbf0';
const PENUGEM = '#8e9fd2';
const BICO = 'url(#gi-animais-pato-bico)';
const PE_COR = 'url(#gi-animais-pato-pe)';
const BICO_CONTORNO = '#8a3508';
const NARINA = '#b4500e';
const LENCO = 'url(#gi-animais-pato-lenco)';
const LENCO_CONTORNO = '#0b2a5e';
const BORDA_LUZ = '#bfe6ff';
const TOPETE = '#fffdf6';

const OLHOS: DefOlho[] = [
  { x: 45.6, y: 35.4, lado: -1, e: 0.95 },
  { x: 63.8, y: 35.4, lado: 1, e: 0.9 },
];
// Pálpebra = o gradiente das penas em userSpaceOnUse na caixa da cabeça (DefsPato): some na cabeça sombreada.
const CORES: CoresRosto = { contorno: CONTORNO, palpebra: 'url(#gi-animais-pato-palpebra)', sombra: '#8597cf', iris: 'url(#gi-animais-pato-iris)', cilio: '#1c2452' };

interface Pose {
  /** transform da cabeça (pivô na base do pescoço, 55,62). */
  cabeca?: string;
  /** Giro extra do topete (+ = murcha para a direita). */
  topete: number;
  /** Giro da cauda (− = arrebita). */
  cauda: number;
  /** Giro da asa (+ = abre). */
  asa: number;
  /** transform do corpo inteiro (esticar no susto, afundar no aposentado). */
  corpo?: string;
  /** Abertura do bico: quanto a mandíbula desce (0 = fechado). Os contornos (por fora) comem ~3 de
   *  fresta: até ~3 o bico ainda parece fechado. */
  bico: number;
}

const POSES: Record<Humor, Pose> = {
  feliz: { cabeca: 'rotate(6 55 62)', topete: -8, cauda: -10, asa: 12, bico: 4.2 },
  neutro: { topete: 0, cauda: 0, asa: 0, bico: 0 },
  cansado: { cabeca: 'translate(0 4) rotate(-4 55 62)', topete: 18, cauda: 8, asa: -4, bico: 1.6 },
  triste: { cabeca: 'translate(0 3) rotate(-7 55 62)', topete: 28, cauda: 14, asa: -6, bico: 0 },
  surpresa: { cabeca: 'translate(0 -4)', topete: -10, cauda: -14, asa: 24, bico: 8, corpo: 'translate(60 104) scale(.97 1.06) translate(-60 -104)' },
  aposentado: { cabeca: 'translate(0 5) rotate(-10 55 62)', topete: 0, cauda: 10, asa: -3, bico: 0, corpo: 'translate(0 3)' },
};

// ----------------------------------------------------------------------------------------- formas

// Corpo: gota deitada — peito redondo à esquerda, dorso subindo até a ponta arrebitada da cauda (102,55).
const CORPO =
  'M31 82C29 71 35 63.4 45 61C53 59.2 63 59.6 72 61.4C80 63 87 63.6 93 61.6C97 60.2 99.6 57 101.6 54.6' +
  'C104.8 55.6 105.8 60.2 104.6 65C103.2 71 100.8 76 99.2 80C97.8 90 93 99 85 102.6C74 107.6 45 107.6 36 101.4C30.4 97 29.6 89 31 82Z';
const CORPO_CEL = 'M104.6 65C103.2 71 100.8 76 99.2 80C97.8 90 93 99 85 102.6C74 107.6 45 107.6 36 101.4C53 104 76 101.6 86 94.4C93.4 88.6 98.6 77.6 104.6 65Z';
// Penugem: escamas de pena soltas em "U" (poucas: o peito branco precisa respirar).
const PEITO = 'M33.4 75.4q2.2 2.4 4.4 0M35.2 83q2.2 2.4 4.4 0M39.6 89.6q2.2 2.4 4.4 0';
const PEITO_G = 'M71.6 86.6q2.2 2.4 4.4 0M77.4 92.2q2.2 2.4 4.4 0';

// Cauda: tufo pontudo arrebitado + cachinho (o "rabinho" encaracolado do macho), pivô na base.
const CAUDA = 'M92.6 62.8C98 60.4 102.8 56.2 107.2 49.2C109 55.6 107.4 62.2 103.4 66.6C100 67.8 95.4 66.6 92.6 62.8Z';
const CAUDA_LINHA = 'M96.4 63.4Q101.6 60.4 105.2 54.4';
// Cel na borda de baixo da cauda (o mesmo do corpo): dá volume e destaca a cauda no creme da carta.
const CAUDA_CEL = 'M107.2 49.2C109 55.6 107.4 62.2 103.4 66.6C100 67.8 95.4 66.6 92.6 62.8C96.4 64.4 100.4 64 103 61.4C105.6 58.6 107 54.2 107.2 49.2Z';
// Cachinho da cauda: ~25% menor e mais fino que o topete (o topete é o herói da cabeça).
const CACHO = 'M106.7 50.3C107.3 46.2 110.9 44.3 112.7 46.6C114 48.4 112.2 50.6 110.4 49.4';

// Asa no flanco, do ombro (63,66) para trás; rêmiges com 3 pontas viradas para a cauda.
const ASA_REMIGES =
  'M63.6 66.2C71.6 62.2 85.6 62.8 93.6 68.4C98.6 71.8 101 76.4 98.6 78.8C97 80.4 94.2 79.8 93 78.2C92 81.2 88 82.2 85.8 79.8' +
  'C84.2 82.8 79.6 83.2 77.2 80.8C69.6 81.2 62 77.4 60.2 72.2C59.4 69.4 61.2 67.4 63.6 66.2Z';
const ASA_COBERTEIRAS =
  'M63.6 66.2C70.2 63.2 80.6 63.2 86.6 67.4C88.2 70.2 86 72.6 83 71.8C81.6 74.8 77 75.4 75.2 73C72 75.2 66.2 74.4 64 72C61.4 70.4 61.2 67.6 63.6 66.2Z';
const ASA_LINHAS = 'M77.2 80.8C76.8 77.6 75.6 75.6 73.8 74M85.8 79.8C85.4 76.6 84 74.2 81.8 72.6M93 78.2C92.8 75.4 91.6 72.8 89.6 71';

// Lenço: faixa em volta do pescoço + triângulo caindo no peito (um path só). O nó fica atrás do pescoço
// (na frente da asa virava uma mancha azul a 72 px).
const LENCO_FORMA =
  'M35.6 57.8C46 64.4 64 64.6 74.4 57.2L75.6 62.4C70.6 66 67.6 66.8 64.8 67.2C62.6 72.4 58.2 77.6 53.4 80.6' +
  'C48.8 77.6 44.2 72.4 42 66.8C39.4 66 37.2 64.8 35.4 63.2Z';
const LENCO_CEL = 'M64.8 67.2C62.6 72.4 58.2 77.6 53.4 80.6C55 76.4 57.4 71.6 58.4 67.4C61 67.6 63 67.4 64.8 67.2Z';
// Bainha clara no alto do triângulo (crescente fino, preenchido — vai no mesmo path das bolinhas):
// separa o lenço do fundo azul da carta rara.
const LENCO_BAINHA = 'M44.6 66.4Q53.4 68.8 62.4 66.4L62 67.4Q53.4 70.4 45 67.4Z';
// Bolinhas brancas + brilho de 4 pontas (fixo) na ponta esquerda da faixa.
const ESTRELA = (x: number, y: number, r: number) =>
  `M${x} ${f1(y - r)}Q${f1(x + r * 0.16)} ${f1(y - r * 0.16)} ${f1(x + r)} ${y}Q${f1(x + r * 0.16)} ${f1(y + r * 0.16)} ${x} ${f1(y + r)}Q${f1(x - r * 0.16)} ${f1(y + r * 0.16)} ${f1(x - r)} ${y}Q${f1(x - r * 0.16)} ${f1(y - r * 0.16)} ${x} ${f1(y - r)}Z`;
const BOLINHAS = circ(48.6, 71.2, 1.35) + circ(57, 71.4, 1.35) + circ(53, 76, 1.2) + circ(66.6, 62.2, 1.2);
const BRILHO_LENCO = ESTRELA(40.4, 62, 4.2);

// Cabeça redonda (um pouco larga), com o cel embaixo à direita.
const CABECA = 'M55 18.4C68.4 18.4 79 28 79.4 41C79.8 53.4 69.4 62.2 55.6 62.2C42 62.2 30.6 53.6 30.6 41C30.6 28 41.6 18.4 55 18.4Z';
/** Caixa da CABECA [x, y, largura, altura]. Fonte única do gradientTransform da pálpebra (DefsPato): mudou a
 *  CABECA? Mude a caixa junto, ou a pálpebra volta a ser um oval de outra cor sobre a cabeça. */
export const CAIXA_CABECA = [30.6, 18.4, 48.81, 43.8] as const;
const CABECA_CEL = 'M79 44C77.4 54.6 68 62 55.6 62C49 62 43.4 59.8 39.2 56.2C44.8 58.8 50.4 59.8 56 59.4C66.8 58.6 75.2 52.6 79 44Z';

// Topete: 3 cachos de pena brotando do alto (traço grosso de contorno + traço branco por cima).
// Um pouco maior (×1,1, a partir da base): a marca do pato contra o ganso a 72 px.
const TOPETE_ESCALA = 'translate(55 20) scale(1.1) translate(-55 -20)';
const TOPETE_CACHOS =
  'M54.6 19.4C51.8 12.2 56.4 6.6 61 8.6C64.4 10.2 63.4 15 60 14.6' +
  'M58.6 19.2C60.4 14.6 65.6 13.4 68.4 16.2' +
  'M51 20.4C47.4 17.4 46.6 12.6 49.4 10.6';

// Bico de colher (de frente, um pouco para a esquerda): base estreita entre os olhos, ponta larga.
const BICO_CIMA = 'M44.4 45.6C48.4 44.2 57 44.2 61 45.6C64.6 47 68.6 49.6 68.6 52.6C68.8 56 62 58.2 53 58.2C44 58.2 36.6 56 36.8 52.6C37 49.6 40.8 47 44.4 45.6Z';
const BICO_REALCE = 'M40.4 51.4Q44.6 46.8 51.6 46.4Q45.6 48.6 42.4 52.8Z';
const NARINAS = elip(49.2, 48.4, 1.3, 0.8) + elip(56.8, 48.4, 1.3, 0.8);
// Bico de baixo = "queixo": mais estreito (46–60) e redondo (fundo em U) que o de cima. Largo como o de
// cima, com a boca no meio, lia como hambúrguer/lábios. O topo curva MAIS que a borda do bico de cima:
// aberto, a fresta escura fica em forma de sorriso (larga no meio, some nos cantos).
const BICO_BAIXO = 'M46 56C49.4 60.4 56.6 60.4 60 56C59.8 60 56.8 62.4 53 62.4C49.2 62.4 46.2 60 46 56Z';

// Traços de susto: 3 riscos do lado esquerdo da cabeça erguida (centro 55,36); o "!" fica à direita.
const TRACOS_SUSTO = [146, 166, 186]
  .map((g) => {
    const a = (g * Math.PI) / 180;
    const [c, sn] = [Math.cos(a), -Math.sin(a)];
    return `M${f1(55 + 27 * c)} ${f1(32 + 27 * sn)}L${f1(55 + 32.5 * c)} ${f1(32 + 32.5 * sn)}`;
  })
  .join('');

// Touca de dormir (aposentado): a mesma da galinha, ajustada à cabeça do pato.
const TOUCA_CONE = 'M36 31.4C35.6 16 49 6.6 63.8 7.2C77 7.8 89.4 16 93.6 28.6C89.2 25.4 83.6 24.6 78.6 25.6C77.4 27.6 76.6 29.6 75.6 31.4C63 25.2 48.4 25.2 36 31.4Z';
const TOUCA_LISTRAS = 'M48.4 11.6Q56.4 18.4 59.6 27M68.6 9.4Q73.6 16.6 74.4 26';
const TOUCA_ABA = 'M33.6 33C37.4 24 72.6 23.6 77.2 32.6C78 35.2 75.8 36.6 73.6 35.6C67.4 30.2 43.6 30.2 37.6 36C35.4 37 33 35.4 33.6 33Z';

// Pé palmado: 3 dedos de ponta redonda com membrana em "M" entre eles; desenhado de pé (dedos para cima,
// calcanhar em 0,0). Gradiente próprio (gi-animais-pato-pe) no eixo x local do pé.
const pe = (canela: number) =>
  `M-2.3 ${canela}V-3.4C-5.4 -4.8 -8 -8 -7.9 -11.2A1.6 1.6 0 0 1 -5 -12.6Q-4 -10.6 -3.2 -10.6Q-2 -10.8 -1.6 -13.2` +
  `A1.6 1.6 0 0 1 1.6 -13.2Q2 -10.8 3.2 -10.6Q4 -10.6 5 -12.6A1.6 1.6 0 0 1 7.9 -11.2C8 -8 5.4 -4.8 2.3 -3.4V${canela}Z`;
// Só 2 dobras curtas saindo dos vales da membrana (3 riscos em leque liam como nervuras de folha).
const PE_DEDOS = 'M-3.2 -10.4L-1.8 -5.6M3.2 -10.4L1.8 -5.6';

// No ninho: a piada do "pé pra cima, relaxado" — canela curta saindo de baixo da asa e a palma virada
// para quem olha, toda ACIMA da borda (nada cortado pelo ninho), dedos para cima e para a direita.
// A ponta da canela fica sobre o contorno do flanco (x ~98), à direita do ovo-pronto (que vai até x ~93).
const PE_FORA = 'translate(103.2 84.2) rotate(62) scale(1.2)';
const PE_CANELA = 5;
// Sem ninho: os dois pés no chão, virados para fora e achatados (perspectiva).
const PES_CHAO = ['translate(45 103.6) rotate(180) scale(1.22 .82) rotate(16)', 'translate(69 103.6) rotate(180) scale(1.22 .82) rotate(-16)'];

// ------------------------------------------------------------------------------------------ peças

function Pe({ t, canela = 1 }: { t: string; canela?: number }) {
  return (
    <g transform={t}>
      <path d={pe(canela)} fill={PE_COR} {...sil(BICO_CONTORNO, 1.6)} />
      <path className="ani-linha" d={PE_DEDOS} {...linha('#c4560c', 1.3, 0.9)} />
    </g>
  );
}

function Bico({ humor, abre }: { humor: Humor; abre: number }) {
  // A mandíbula (língua + bico de baixo) desce `abre`; o bico de cima vem por último e cobre o topo da
  // boca. Fechado sem "quack" (só o feliz anima), a boca nem é desenhada.
  // Boca = CAVIDADE, não faixa: cantos escondidos sob o bico de cima (x 42/64, dentro da borda dele, para
  // não aparecer ponta escura dos lados), lados afunilando até o queixo e fundo seguindo o U da
  // mandíbula, por trás dela. Quando o CSS baixa a mandíbula no quack, a boca se revela sem scale.
  const d = abre;
  const temBoca = abre > 0 || humor === 'feliz';
  const canto = humor === 'surpresa' ? 52.6 : 51.4;
  const y = (n: number) => f1(n + d);
  const boca =
    `M42 ${canto}L46 ${y(56)}C46.2 ${y(60)} 49.2 ${y(62.4)} 53 ${y(62.4)}` +
    `C56.8 ${y(62.4)} 59.8 ${y(60)} 60 ${y(56)}L64 ${canto}Z`;
  // Língua com a ponta acima do topo da mandíbula: aparece no meio da fresta.
  const lingua = `M48.4 ${y(59.4)}Q53 ${y(54.2)} 57.6 ${y(59.4)}Q53 ${y(61.4)} 48.4 ${y(59.4)}Z`;
  return (
    <g className="ani-bico" transform={humor === 'triste' ? 'rotate(-3 53 52)' : undefined}>
      {temBoca && <path d={boca} fill="#7a1e2c" stroke={BICO_CONTORNO} strokeWidth={1.1} strokeLinejoin="round" />}
      <g className="pato-mandibula">
        {temBoca && humor !== 'surpresa' && <path d={lingua} fill="#ff6f7d" />}
        <path d={BICO_BAIXO} transform={d ? `translate(0 ${d})` : undefined} fill={BICO} {...sil(BICO_CONTORNO, 1.3)} />
      </g>
      <path d={BICO_CIMA} fill={BICO} {...sil(BICO_CONTORNO, 1.8)} />
      <path d={BICO_REALCE} fill="#fff" opacity={0.6} />
      <path className="ani-linha" d={NARINAS} fill={NARINA} />
    </g>
  );
}

function Lenco() {
  return (
    <g className="ani-acessorio">
      <path d={LENCO_FORMA} fill={LENCO} {...sil(LENCO_CONTORNO, 2.4)} />
      <path className="ani-linha" d={LENCO_CEL} fill="#1d5fd0" opacity={0.5} />
      <path className="ani-linha" d={LENCO_BAINHA + BOLINHAS + BRILHO_LENCO} fill="#fff" opacity={0.92} />
    </g>
  );
}

function Touca() {
  return (
    <g className="ani-acessorio">
      <path d={TOUCA_CONE} fill="url(#gi-animais-touca)" {...sil('#1f3a66', 3)} />
      <path className="ani-linha" d={TOUCA_LISTRAS} fill="none" stroke="#c4dbf7" strokeWidth={2.4} strokeLinecap="round" opacity={0.75} />
      <path d={TOUCA_ABA} fill="#f4f7fb" {...sil('#1f3a66', 1.8)} />
      <circle cx={94} cy={31.2} r={4.8} fill="#ffffff" {...sil('#1f3a66', 1.8)} />
      <circle cx={92.4} cy={29.6} r={1.6} fill="#dfe9f7" />
    </g>
  );
}

/** Pato sentado (ou de pé, sem ninho) no humor pedido. */
export function Pato({ humor, ninho = true }: PropsEspecie) {
  const p = POSES[humor];
  return (
    <>
      <g className="ani-corpo">
        <g transform={p.corpo}>
          {!ninho && PES_CHAO.map((t) => <Pe key={t} t={t} />)}

          <g className="ani-cauda">
            <g transform={p.cauda ? `rotate(${p.cauda} 96 64)` : undefined}>
              <path d={CAUDA} fill={ASA} {...sil(CONTORNO, 3)} />
              <path className="ani-linha" d={CAUDA_CEL} fill={CEL} opacity={0.55} />
              <path d={CACHO} fill="none" stroke={CONTORNO} strokeWidth={5} strokeLinecap="round" className="ani-sil-fino" />
              <path d={CACHO} fill="none" stroke={TOPETE} strokeWidth={2.2} strokeLinecap="round" />
              <path className="ani-linha" d={CAUDA_LINHA} {...linha(PENUGEM, 1.3, 1)} />
            </g>
          </g>

          <path d={CORPO} fill={PENAS} {...sil(CONTORNO)} />
          <path d={CORPO_CEL} fill={CEL} opacity={0.55} />
          <ellipse cx={41} cy={69} rx={9} ry={5} fill="url(#gi-animais-realce)" transform="rotate(-24 41 69)" />
          <path className="ani-borda-luz" d="M103.2 66.6Q102.2 72.6 99.6 78" {...linha(BORDA_LUZ, 1.6, 1)} opacity={0.45} />
          <path className="ani-linha" d={PEITO} {...linha(PENUGEM, 1.3, 0.55)} />
          <path className="ani-so-g" d={PEITO_G} {...linha(PENUGEM, 1.1, 0.55)} />

          {ninho && <Pe t={PE_FORA} canela={PE_CANELA} />}

          <g className="ani-asa-e">
            <g transform={p.asa ? `rotate(${-p.asa} 63 67)` : undefined}>
              <path d={ASA_REMIGES} fill={ASA} {...sil(CONTORNO, 2.4)} />
              <path className="ani-linha" d={ASA_LINHAS} {...linha(CONTORNO, 1.4, 0.5)} />
              <path d={ASA_COBERTEIRAS} fill={PENAS} stroke={CONTORNO} strokeWidth={1.75} strokeOpacity={0.85} strokeLinejoin="round" />
            </g>
          </g>

          <Lenco />

          <g className="ani-cabeca">
            <g transform={p.cabeca}>
              {humor !== 'aposentado' && (
                <g className="ani-crista">
                  <g transform={`${p.topete ? `rotate(${p.topete} 55 20) ` : ''}${TOPETE_ESCALA}`}>
                    <path d={TOPETE_CACHOS} fill="none" stroke={CONTORNO} strokeWidth={6.4} strokeLinecap="round" className="ani-sil-fino" />
                    <path d={TOPETE_CACHOS} fill="none" stroke={TOPETE} strokeWidth={2.8} strokeLinecap="round" />
                  </g>
                </g>
              )}

              <path d={CABECA} fill={PENAS} {...sil(CONTORNO)} />
              <path d={CABECA_CEL} fill={CEL} opacity={0.55} />
              <ellipse cx={44.6} cy={26.4} rx={8.4} ry={4.6} fill="url(#gi-animais-realce)" transform="rotate(-30 44.6 26.4)" />
              <path className="ani-borda-luz" d="M76.6 42Q76.2 47.6 73 52.4" {...linha(BORDA_LUZ, 1.5, 1)} opacity={0.5} />

              <Bochechas pontos={[[35.6, 46.4], [72.8, 45.6]]} humor={humor} rx={5} ry={3.2} />
              <Olhos olhos={OLHOS} humor={humor} cores={CORES} />
              <Piscada olhos={OLHOS} humor={humor} cores={CORES} />
              {humor !== 'aposentado' && <Sobrancelhas olhos={OLHOS} humor={humor} cor={CONTORNO} />}
              <Bico humor={humor} abre={p.bico} />
              {humor === 'triste' && <Lagrima x={38.6} y={41.4} e={0.95} />}
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
              <Exclamacao x={92} y={12} />
            </>
          )}
          {humor === 'aposentado' && <Zzz x={33} y={30} sentido={-1} />}
        </g>
      )}
    </>
  );
}

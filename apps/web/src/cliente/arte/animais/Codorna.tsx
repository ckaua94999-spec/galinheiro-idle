// Codorna (animal de boas-vindas) — segue o KIT DAS ESPÉCIES descrito em Galinha.tsx.
//
// Personalidade: miúda, redonda e curiosa → corpo de "ovo deitado" mais baixo que o da galinha, cabeça
// pequena quase sem pescoço, penacho em gota caindo para a frente e listra creme acima do olho (a marca da
// espécie). Penas marrons pintadas de creme; peito claro; cauda curtinha. Ação: a mesma bicada da galinha,
// mais rápida (estilos/animais-codorna.css).
import { Bochechas, Exclamacao, Lagrima, Olhos, Piscada, Sobrancelhas, Zzz, elip, linha, sil, type CoresRosto, type DefOlho, type Humor, type PropsEspecie } from './comum';

const f1 = (n: number) => Math.round(n * 10) / 10;

const CONTORNO = '#5c3a1e';
const PENAS = 'url(#gi-animais-codorna-penas)';
const ASA = 'url(#gi-animais-codorna-asa)';
const CEL = '#b77d47';
const PINTAS = '#fff1d2';
const BARRAS = '#6e4424';
const BICO = 'url(#gi-animais-codorna-bico)';
const BICO_CONTORNO = '#3e2614';
const BORDA_LUZ = '#bfe6ff';

const OLHOS: DefOlho[] = [
  { x: 50.6, y: 49.4, lado: -1, e: 0.8 },
  { x: 64.4, y: 49.4, lado: 1, e: 0.76 },
];
const CORES: CoresRosto = { contorno: CONTORNO, palpebra: '#f3d3a6', sombra: '#9c6232', iris: 'url(#gi-animais-galinha-iris)', cilio: '#3a2210' };

interface Pose {
  /** transform da cabeça (pivô ≈ base em 57,68). */
  cabeca?: string;
  /** Giro extra do penacho (+ = cai para a frente). */
  penacho: number;
  /** Giro da cauda (− = levanta). */
  cauda: number;
  /** Giro da asa (+ = abre). */
  asa: number;
  corpo?: string;
  /** Abertura do bico em graus. */
  bico: number;
}

const POSES: Record<Humor, Pose> = {
  feliz: { cabeca: 'rotate(4 57 68)', penacho: -8, cauda: -10, asa: 10, bico: 28 },
  neutro: { penacho: 0, cauda: 0, asa: 0, bico: 0 },
  cansado: { cabeca: 'translate(0 3) rotate(-3 57 68)', penacho: 14, cauda: 6, asa: -4, bico: 8 },
  triste: { cabeca: 'translate(0 3) rotate(-6 57 68)', penacho: 24, cauda: 10, asa: -6, bico: 0 },
  surpresa: { cabeca: 'translate(0 -4)', penacho: -14, cauda: -14, asa: 24, bico: 44, corpo: 'translate(60 104) scale(.97 1.06) translate(-60 -104)' },
  aposentado: { cabeca: 'translate(0 5) rotate(-10 57 68)', penacho: 30, cauda: 8, asa: -3, bico: 0, corpo: 'translate(0 3)' },
};

// ----------------------------------------------------------------------------------------- formas

// Corpo: "ovo deitado", mais baixo e mais redondo que o da galinha (a codorna cabe inteira no ninho).
const CORPO = 'M33.4 84.6C31.4 73 38.6 64.2 49.6 61.6C55.6 60.2 62.4 60.2 68.6 61C82.6 62.8 92.2 70.6 93 82.4C93.8 94.6 84.6 103.6 70.4 105.2C59 106.4 46 105.6 39.4 100.2C35 96.6 34 90.6 33.4 84.6Z';
const CORPO_CEL = 'M92.8 79.4C94.6 92.6 86 103 71.2 104.8C60.4 106 48.6 105.6 41.4 101.6C55.4 102.8 73.4 100.8 82.8 93.4C88.4 89 91.8 84.6 92.8 79.4Z';
const PEITO = 'M36.6 86.6C35.6 78.6 40 72 47.2 69.4C49.8 76.6 50.6 86.4 47.4 97.4C41.4 96.4 37.4 92.6 36.6 86.6Z';
// Pintas creme em "v" (escamas) espalhadas pelo corpo: um <path> só.
const PINTAS_CORPO = [
  [56, 72], [64, 70], [72, 72.6], [80, 75.4], [60, 80.4], [68, 79], [76, 82.4], [85, 82], [57, 89.6], [65, 88], [73, 91], [81, 90.6],
]
  .map(([x, y]) => `M${x! - 2.2} ${y! - 1}Q${x} ${y! + 1.8} ${x! + 2.2} ${y! - 1}`)
  .join('');
const PINTAS_G = 'M50 94q1.8 1.8 3.6 0M62 97q1.8 1.8 3.6 0M74 98q1.8 1.8 3.6 0';

// Cauda curta: duas penas largas e arredondadas apontando para trás e um pouco para cima.
const CAUDA = [
  'M86 73.2C91.4 68.4 98.2 66.6 103.4 68.2C102.6 72.8 97.2 77.4 89.2 78.4Z',
  'M87.4 77.4C93.4 75 99.8 75.4 104 78.2C101.8 82.4 95.4 84.6 88.4 83.2Z',
];
const CAUDA_LINHAS = 'M88 75.2Q95 71.6 100.6 69.6M89 80.4Q96 79.2 101.4 79.2';

// Asa no flanco, com barras escuras (a pintura típica de codorna).
const ASA_FORMA = 'M57.4 70.4C66.6 65.4 79.4 66.6 86.4 73.6C90.6 77.8 91.4 83.8 88.4 87.2C85.6 90.2 80.2 89.8 77.4 87.6C70 89.2 60.6 85.2 56.6 79.2C54.8 76.2 55 72.2 57.4 70.4Z';
const ASA_BARRAS = 'M64 70.6Q67 76.4 66 83.4M72 70.2Q75.6 76.6 74.6 85.6M80 72.4Q83.4 78.6 82.6 87.4';

// Cabeça pequena, quase sem pescoço, presa ao corpo.
const CABECA = 'M57 32.6C67.8 32.6 75.4 40.8 75.4 51C75.4 61.4 67.4 68.8 57.2 68.8C47 68.8 38.8 61.4 38.8 51C38.8 40.8 46.4 32.6 57 32.6Z';
const CABECA_CEL = 'M75 53.6C73.6 62.6 66.4 68.6 57.2 68.6C51.6 68.6 47.2 66.8 44.2 64C48.4 65.4 52.4 65.8 56.6 65.2C65 64 71.6 59.8 75 53.6Z';
// Boné escuro no alto da cabeça e a listra creme acima dos olhos (supercílio).
const BONE = 'M40.4 44.2C42.6 37 49 32.6 57 32.6C65.2 32.6 71.6 37.2 73.8 44.4C68.8 41 63.2 39.6 57 39.6C50.8 39.6 45.2 41 40.4 44.2Z';
const LISTRA = 'M40.6 46.6C45.6 42.4 51.6 41 57.2 41.2C62.8 41 68.8 42.4 73.6 46.6';

// Penacho em gota: haste saindo do topo da cabeça e a "gota" caindo para a frente (esquerda).
const PENACHO = 'M57.4 33.6C57 28.4 55.4 24.2 52.4 21.8C50 19.8 46.4 20.2 45.6 23C44.8 26 47.4 28.6 50.4 28.2C52.6 28 54 26.8 54.8 25.4C56.2 27.6 56.6 30.4 56.4 33.6Z';
const PENACHO_REALCE = elip(48.4, 23.4, 1.4, 1.1);

const TRACOS_SUSTO = [150, 172, 194]
  .map((g) => {
    const a = (g * Math.PI) / 180;
    const [c, sn] = [Math.cos(a), -Math.sin(a)];
    return `M${f1(57 + 22 * c)} ${f1(47 + 22 * sn)}L${f1(57 + 27.5 * c)} ${f1(47 + 27.5 * sn)}`;
  })
  .join('');

// Bico curtinho e escuro (a codorna tem bico pequeno e grosso).
const BICO_CIMA = 'M53.2 55.4C55.2 53.8 59.2 53.8 61.2 55.4C60.2 58 58.2 59.8 57.2 60.2C55.6 59.6 53.6 57.8 53.2 55.4Z';
const BICO_BAIXO = 'M54.8 59.2C56.6 59.4 58.6 58.6 60 57.4C60 59.6 58.6 61.4 57.2 61.6C56 61.2 55.2 60.4 54.8 59.2Z';
const BICO_REALCE = 'M54.6 55.6Q57 54.4 59.4 55Q57.2 55.6 55.8 57.4Z';
const DOBRA: [number, number] = [54.8, 58.4];

function pe(x: number): string {
  const p = (dx: number, y: number) => `${f1(x + dx)} ${y}`;
  return (
    `M${p(-1.2, 101)}V108.4Q${p(-4.8, 108.6)} ${p(-4.7, 111.2)}Q${p(-4.6, 113.4)} ${p(-2.6, 113)}` +
    `Q${p(-1.8, 112.8)} ${p(-1.3, 112)}Q${p(0, 114.6)} ${p(1.3, 112)}Q${p(1.8, 112.8)} ${p(2.6, 113)}` +
    `Q${p(4.6, 113.4)} ${p(4.7, 111.2)}Q${p(4.8, 108.6)} ${p(1.2, 108.4)}V101Z`
  );
}
const PES = pe(52) + pe(70);

// ------------------------------------------------------------------------------------------ peças

function Bico({ humor, abre }: { humor: Humor; abre: number }) {
  const boca = 'M54.2 58.6C56.4 59.4 59 58.4 61 55.6L60.4 59.6C58.6 61.6 56 61.6 54.2 58.6Z';
  return (
    <g className="ani-bico">
      <path d={BICO_BAIXO} transform={abre > 0 ? `rotate(${abre} ${DOBRA[0]} ${DOBRA[1]})` : undefined} fill={BICO} {...sil(BICO_CONTORNO, 1.6)} />
      {abre > 0 && <path d={boca} transform={`rotate(${abre / 2} ${DOBRA[0]} ${DOBRA[1]})`} fill="#7a1e2c" stroke={BICO_CONTORNO} strokeWidth={1} strokeLinejoin="round" />}
      <g transform={humor === 'triste' ? 'rotate(4 57 55)' : undefined}>
        <path d={BICO_CIMA} fill={BICO} {...sil(BICO_CONTORNO, 1.6)} />
        <path d={BICO_REALCE} fill="#fff" opacity={0.5} />
      </g>
    </g>
  );
}

/** Codorna sentada (ou de pé, sem ninho) no humor pedido. */
export function Codorna({ humor, ninho = true }: PropsEspecie) {
  const p = POSES[humor];
  return (
    <>
      <g className="ani-corpo">
        <g transform={p.corpo}>
          {!ninho && <path d={PES} fill="url(#gi-animais-codorna-pe)" {...sil('#7a3a2a', 1.6)} />}

          <g className="ani-cauda">
            <g transform={p.cauda ? `rotate(${p.cauda} 88 76)` : undefined}>
              {CAUDA.map((d) => (
                <path key={d} d={d} fill={ASA} {...sil(CONTORNO, 3.2)} />
              ))}
              <path className="ani-linha" d={CAUDA_LINHAS} {...linha(BARRAS, 1.3, 0.8)} />
            </g>
          </g>

          <path d={CORPO} fill={PENAS} {...sil(CONTORNO)} />
          <path d={CORPO_CEL} fill={CEL} opacity={0.55} />
          <path d={PEITO} fill="#f7dcb0" opacity={0.85} />
          <ellipse cx={45} cy={73} rx={8.6} ry={4.6} fill="url(#gi-animais-realce)" transform="rotate(-24 45 73)" />
          <path className="ani-borda-luz" d="M93 82Q93.4 88.6 90.4 93.6" {...linha(BORDA_LUZ, 1.6, 1)} opacity={0.45} />
          <path className="ani-linha" d={PINTAS_CORPO} {...linha(PINTAS, 1.5, 0.9)} />
          <path className="ani-so-g" d={PINTAS_G} {...linha(PINTAS, 1.2, 0.7)} />

          <g className="ani-asa-e">
            <g transform={p.asa ? `rotate(${-p.asa} 57 71)` : undefined}>
              <path d={ASA_FORMA} fill={ASA} {...sil(CONTORNO, 2.4)} />
              <path className="ani-linha" d={ASA_BARRAS} {...linha(BARRAS, 1.6, 0.75)} />
            </g>
          </g>

          <g className="ani-cabeca">
            <g transform={p.cabeca}>
              <g className="ani-crista">
                <g transform={p.penacho ? `rotate(${p.penacho} 57 33)` : undefined}>
                  <path d={PENACHO} fill="#4a2c14" {...sil(CONTORNO, 1.8)} />
                  <path d={PENACHO_REALCE} fill="#fff" opacity={0.45} />
                </g>
              </g>

              <path d={CABECA} fill={PENAS} {...sil(CONTORNO)} />
              <path d={BONE} fill="#7a4b26" opacity={0.9} />
              <path d={CABECA_CEL} fill={CEL} opacity={0.55} />
              <ellipse cx={47} cy={40} rx={6} ry={3.4} fill="url(#gi-animais-realce)" transform="rotate(-26 47 40)" />
              <path className="ani-linha" d={LISTRA} fill="none" stroke={PINTAS} strokeWidth={2.4} strokeLinecap="round" opacity={0.95} />
              <path className="ani-borda-luz" d="M74.4 52Q74 57.6 70.8 61.4" {...linha(BORDA_LUZ, 1.4, 1)} opacity={0.5} />

              <Bochechas pontos={[[45.2, 58.4], [69.4, 58]]} humor={humor} />
              <Olhos olhos={OLHOS} humor={humor} cores={CORES} />
              <Piscada olhos={OLHOS} humor={humor} cores={CORES} />
              {humor !== 'aposentado' && <Sobrancelhas olhos={OLHOS} humor={humor} cor={CONTORNO} />}
              <Bico humor={humor} abre={p.bico} />
              {humor === 'triste' && <Lagrima x={45} y={55} />}
            </g>
          </g>
        </g>
      </g>

      {(humor === 'surpresa' || humor === 'aposentado') && (
        <g className="ani-fx">
          {humor === 'surpresa' && (
            <>
              <path className="ani-tracos" d={TRACOS_SUSTO} fill="none" stroke="#6a4300" strokeWidth={2.4} strokeLinecap="round" />
              <Exclamacao x={88} y={18} />
            </>
          )}
          {humor === 'aposentado' && <Zzz x={38} y={34} sentido={-1} />}
        </g>
      )}
    </>
  );
}

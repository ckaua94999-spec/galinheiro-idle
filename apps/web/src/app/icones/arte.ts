// Arte dos ícones do PWA (DIRECAO_DE_ARTE 1 e 5): a galinha nova sentada no ninho, com um ovo
// na borda, sobre um céu com raios de sol e um morro de grama — "ícone de jogo mobile".
// Tudo é SVG AUTOCONTIDO em string: o ImageResponse desenha via <img src=data:svg>, então os
// gradientes ficam dentro do próprio SVG (ids locais "ic-*"), sem CSS, sem fontes e sem #ids de fora.
// A galinha é uma cópia estática de arte/animais/Galinha.tsx + Ninho.tsx (pose "feliz", ninho
// "pronto"), com os olhos ABERTOS e brilhantes (no ícone o olhar para quem vê vende mais que o "^ ^").
// Se a galinha do jogo mudar, atualize as formas aqui.

const f = (n: number) => Math.round(n * 100) / 100;
const circ = (x: number, y: number, r: number) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const elip = (x: number, y: number, rx: number, ry: number) =>
  `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;

/** Estrela de 4 pontas (brilho), lados côncavos. */
const estrela = (x: number, y: number, r: number) => {
  const k = r * 0.2;
  return `M${f(x)} ${f(y - r)}Q${f(x + k)} ${f(y - k)} ${f(x + r)} ${f(y)}Q${f(x + k)} ${f(y + k)} ${f(x)} ${f(y + r)}Q${f(x - k)} ${f(y + k)} ${f(x - r)} ${f(y)}Q${f(x - k)} ${f(y - k)} ${f(x)} ${f(y - r)}Z`;
};

/** Contorno de silhueta igual ao do jogo: traço atrás do preenchimento (só a metade de fora aparece). */
const sil = (cor: string, visivel = 3.5) =>
  `stroke="${cor}" stroke-width="${visivel * 2}" paint-order="stroke" stroke-linejoin="round" stroke-linecap="round"`;

// ------------------------------------------------------------------------------ gradientes da arte
// Mesmos valores de DefsGalinha/DefsComuns (luz em cima à esquerda, sombra pêssego/quente).
const DEFS_GALINHA = `
  <radialGradient id="ic-penas" cx=".38" cy=".32" r=".75" fx=".32" fy=".25">
    <stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#fff4e2"/><stop offset=".78" stop-color="#fbe7cc"/><stop offset="1" stop-color="#edbe96"/>
  </radialGradient>
  <radialGradient id="ic-asa" cx=".38" cy=".3" r=".8" fx=".3" fy=".2">
    <stop offset="0" stop-color="#fffaf0"/><stop offset=".4" stop-color="#fbe6ca"/><stop offset=".8" stop-color="#f0cba4"/><stop offset="1" stop-color="#e2a985"/>
  </radialGradient>
  <linearGradient id="ic-cauda" x1=".05" y1="1" x2=".9" y2="0">
    <stop offset="0" stop-color="#d9824e"/><stop offset=".5" stop-color="#f2b27a"/><stop offset="1" stop-color="#fff3e0"/>
  </linearGradient>
  <radialGradient id="ic-crista" cx=".38" cy=".32" r=".8" fx=".3" fy=".22">
    <stop offset="0" stop-color="#ff8466"/><stop offset=".4" stop-color="#ee4334"/><stop offset=".72" stop-color="#e2393a"/><stop offset="1" stop-color="#b8233a"/>
  </radialGradient>
  <linearGradient id="ic-bico" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffe07a"/><stop offset=".45" stop-color="#ffb52e"/><stop offset="1" stop-color="#e2740f"/>
  </linearGradient>
  <linearGradient id="ic-iris" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2a160a"/><stop offset=".45" stop-color="#6b3f1f"/><stop offset="1" stop-color="#c0874a"/>
  </linearGradient>
  <linearGradient id="ic-esclera" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#e3cdb8"/><stop offset=".22" stop-color="#fffdf8"/><stop offset=".6" stop-color="#ffffff"/><stop offset="1" stop-color="#d3deec"/>
  </linearGradient>
  <radialGradient id="ic-realce" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#fffdf7" stop-opacity=".95"/><stop offset=".55" stop-color="#fffdf7" stop-opacity=".55"/><stop offset="1" stop-color="#fffdf7" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="ic-bochecha" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#ff6f86"/><stop offset=".55" stop-color="#ff7b8a" stop-opacity=".75"/><stop offset="1" stop-color="#ff7b8a" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="ic-ninho" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffe58a"/><stop offset=".35" stop-color="#e9b949"/><stop offset=".8" stop-color="#c98e34"/><stop offset="1" stop-color="#9a6424"/>
  </linearGradient>
  <radialGradient id="ic-ninho-dentro" cx=".5" cy=".35" r=".6">
    <stop offset="0" stop-color="#7a4a1c"/><stop offset="1" stop-color="#4a2a10"/>
  </radialGradient>
  <radialGradient id="ic-ovo" cx=".38" cy=".3" r=".8" fx=".32" fy=".22">
    <stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#fffaf0"/><stop offset=".78" stop-color="#f8ead6"/><stop offset="1" stop-color="#f1dcc0"/>
  </radialGradient>
  <radialGradient id="ic-oclusao" cx=".5" cy=".55" r=".5">
    <stop offset="0" stop-color="#3b2410" stop-opacity=".42"/><stop offset=".65" stop-color="#3b2410" stop-opacity=".2"/><stop offset="1" stop-color="#3b2410" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="ic-sombra" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#1d4d12" stop-opacity=".55"/><stop offset=".6" stop-color="#1d4d12" stop-opacity=".28"/><stop offset="1" stop-color="#1d4d12" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="ic-ouro" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff8d0"/><stop offset=".45" stop-color="#ffe066"/><stop offset="1" stop-color="#ffb21a"/>
  </linearGradient>`;

// ------------------------------------------------------------------------------- rosto do ícone
// Olhos abertos com pupila grande e brilhos de "feliz" (medidas do <Olhos/> do jogo), olhando quase
// de frente; delineado só no topo, com rabinho no canto de fora.
const OLHOS = [
  { x: 49.4, y: 44.6, lado: -1, e: 1 },
  { x: 67.6, y: 44.6, lado: 1, e: 0.94 },
] as const;

function rosto(): string {
  let esclera = '';
  let iris = '';
  let pupila = '';
  let b1 = '';
  let b2 = '';
  let cilios = '';
  const ox = -0.3;
  for (const { x, y, lado, e } of OLHOS) {
    const rx = 7.4 * e;
    const ry = 9 * e;
    esclera += elip(x, y, rx, ry);
    const ix = x + ox * e;
    const iy = y + 0.6 * e;
    iris += circ(ix, iy, 6.1 * e);
    pupila += circ(ix, iy, 4 * e);
    b1 += circ(x + (ox * 0.4 - 1.7) * e, y - 1.7 * e, 2.5 * e);
    b2 += circ(x + 1.9 * e, y + 2.4 * e, 1.25 * e);
    const dentroY = y - ry * 0.62;
    const dentroX = x - lado * rx * Math.sqrt(1 - 0.62 * 0.62);
    const foraY = y - ry * 0.12;
    const foraX = x + lado * rx * Math.sqrt(1 - 0.12 * 0.12);
    cilios += `M${f(dentroX)} ${f(dentroY)}A${f(rx)} ${f(ry)} 0 0 ${lado < 0 ? 0 : 1} ${f(foraX)} ${f(foraY)}l${f(lado * 1.9 * e)} ${f(-1.5 * e)}`;
  }
  return `
      <ellipse cx="44.2" cy="55.6" rx="6.6" ry="4" fill="url(#ic-bochecha)"/>
      <ellipse cx="73.4" cy="55" rx="6.6" ry="4" fill="url(#ic-bochecha)"/>
      <path d="${esclera}" fill="url(#ic-esclera)"/>
      <path d="${iris}" fill="url(#ic-iris)"/>
      <path d="${pupila}" fill="#1e1426"/>
      <path d="${b1}" fill="#fff"/>
      <path d="${b2}" fill="#fff" fill-opacity=".85"/>
      <path d="${cilios}" fill="none" stroke="#4a220c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M44.8 31Q49.4 28.4 54 31M71.92 31.54Q67.6 28.94 63.28 31.54" fill="none" stroke="#8a4a22" stroke-width="2.3" stroke-linecap="round" opacity=".9"/>`;
}

// ------------------------------------------------------------------- galinha no ninho (120×120)
const CONTORNO = '#8a4a22';
const PALHA_CONTORNO = '#6b4416';

const GALINHA = `
  <g>
    <ellipse cx="60" cy="92" rx="47" ry="13" fill="url(#ic-ninho)" ${sil(PALHA_CONTORNO)}/>
    <path d="M24 86.2q5-3.6 10.5-3.4M39.5 82.3q6-1.7 12-1.3M66 80.6q6 0 12 1.3M83 82.4q6.5 1.2 11 3.8" fill="none" stroke="#c9932f" stroke-width="1.3" stroke-linecap="round" opacity=".8"/>
    <path d="M28 83.4Q60 76.2 92 83.4" fill="none" stroke="#fff3c0" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>
    <ellipse cx="60" cy="90.6" rx="38.5" ry="8" fill="url(#ic-ninho-dentro)"/>
  </g>
  <g transform="rotate(-8 88 74) translate(88 74) scale(.85) translate(-88 -74)">
    <path d="M84 71Q95.2 53.7 106 39Q78.8 42.3 84 71Z" fill="url(#ic-cauda)" ${sil(CONTORNO, 3.4)}/>
    <path d="M85.6 72.6Q101.4 59.4 108.9 49.3Q88.6 46.6 85.6 72.6Z" fill="url(#ic-cauda)" ${sil(CONTORNO, 3.4)}/>
    <path d="M87 76.6Q103 71.2 110.1 60.7Q94 58 87 76.6Z" fill="url(#ic-cauda)" ${sil(CONTORNO, 4.1)}/>
    <path d="M84 71Q87 48 101.3 41.3M85.6 72.6Q95 53 105.4 50.2M87 76.6Q98.5 64.6 107.2 61.7" fill="none" stroke="#d9a07a" stroke-width="1.4" stroke-opacity=".8" stroke-linecap="round"/>
  </g>
  <path d="M30 80C27.6 68.6 33.4 60.4 42.4 57.6C47 56.2 52.6 56 58.6 56.4C75 56.2 87.6 60 93.6 69.4C98.8 77.6 97.2 92.4 87 100.2C77 107.4 45 107.6 34.4 100.4C27 95 27.6 87 30 80Z" fill="url(#ic-penas)" ${sil(CONTORNO)}/>
  <path d="M93.6 69.6C99 79.6 96 94.6 86.4 100.6C75.4 107.4 46.4 107.2 35.8 100.6C51.6 103 74.4 100 84.4 90.6C90.4 84.8 93.2 77.6 93.6 69.6Z" fill="#edb592" opacity=".55"/>
  <ellipse cx="44" cy="67" rx="10" ry="5.4" fill="url(#ic-realce)" transform="rotate(-22 44 67)"/>
  <path d="M94.4 74.4Q95.6 81 93.6 87.4" fill="none" stroke="#bfe6ff" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>
  <path d="M38.6 72.6q2.7 2.6 5.4 0q2.7 2.6 5.4 0M35.4 79.4q2.7 2.6 5.4 0q2.7 2.6 5.4 0q2.7 2.6 5.4 0M43 86q2.7 2.4 5.4 0q2.7 2.4 5.4 0" fill="none" stroke="#d9a07a" stroke-width="1.3" stroke-opacity=".75" stroke-linecap="round"/>
  <path d="M53 70q2.4 2.2 4.8 0M56.6 78.6q2.4 2.2 4.8 0M60.4 86q2.4 2.2 4.8 0" fill="none" stroke="#d9a07a" stroke-width="1.1" stroke-opacity=".6" stroke-linecap="round"/>
  <g transform="rotate(-10 58 66)">
    <path d="M58 65.4C67.4 61 80.4 63 87.6 70.4C92.2 75 93.6 81.4 90.6 84.8C88.6 87 85.2 86.4 84 84.2C82.4 87.4 77.8 88.2 75.6 85.6C69.4 85.6 59.6 80.6 56.6 74.4C55.2 71 55.8 67.2 58 65.4Z" fill="url(#ic-asa)" ${sil(CONTORNO, 2.4)}/>
    <path d="M75.6 85.6C75.2 81.6 73.8 78.6 71.6 76.2M84 84.2C83.6 80.4 82 77.2 79.6 74.8" fill="none" stroke="${CONTORNO}" stroke-width="1.4" stroke-opacity=".55" stroke-linecap="round"/>
    <path d="M58 65.4C65.6 61.8 76.6 62.6 82.4 68.2C84 71.2 81.6 73.8 78.6 72.8C77.2 76 72.6 76.6 70.6 74C67.6 76.2 61.6 75.4 59.6 72.8C56.8 71 56 67.4 58 65.4Z" fill="url(#ic-penas)" stroke="${CONTORNO}" stroke-width="1.75" stroke-opacity=".85" stroke-linejoin="round"/>
  </g>
  <g transform="rotate(4 58 66)">
    <g transform="rotate(-2 59 29)">
      <path d="M47.5 30C43.4 25.4 44 18 49.6 17C50.6 11.6 56.4 8.4 61.2 11.6C64.8 8.2 71.6 10 71.2 16.2C75.6 18.4 75.2 25.2 70.2 29.2Z" fill="url(#ic-crista)" ${sil('#6e1622')}/>
      <path d="M55.2 27.4Q54.8 20 57.2 14.6M64.4 27.4Q65.2 21.2 67.8 17" fill="none" stroke="#6e1622" stroke-width="1.2" stroke-opacity=".45" stroke-linecap="round"/>
      <path d="${elip(50.8, 20.6, 1.5, 2.3)}${elip(59.4, 15.4, 1.7, 2.3)}${elip(68.6, 18.2, 1.3, 1.9)}" fill="#ffc4b0" opacity=".75"/>
    </g>
    <path d="M58 23C70.4 23 80 32.2 80 44.6C80 56.4 70.8 65.6 58.6 65.6C52.6 65.6 47.6 63.8 44 60.6Q40.4 62.6 39.2 59.8Q36.6 59.2 38.2 55.6C37 52.2 36.4 48.6 36.4 44.6C36.4 32.2 45.8 23 58 23Z" fill="url(#ic-penas)" ${sil(CONTORNO)}/>
    <path d="M79.6 47C78.4 57.6 70 65.2 58.6 65.4C52.4 65.4 47.8 63.6 44.6 60.8C49.6 62.6 54.4 63.2 59.4 62.6C69.4 61.6 76.6 55.6 79.6 47Z" fill="#edb592" opacity=".55"/>
    <ellipse cx="48" cy="31.4" rx="8.4" ry="4.8" fill="url(#ic-realce)" transform="rotate(-28 48 31.4)"/>
    <path d="M78.8 45Q78.6 50.6 75.2 55" fill="none" stroke="#bfe6ff" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>
    <path d="M54.6 57.6C50.8 60 51 66.6 54.6 67C57.8 67.4 58.8 62.2 57.6 58.4ZM59.6 58.2C58.6 62.4 59.6 67.8 62.8 67.4C66 67 65.4 60.6 61.8 57.8Z" fill="url(#ic-crista)" ${sil('#6e1622', 1.6)}/>
    ${rosto()}
    <g transform="translate(58.6 52) scale(1.07) translate(-58.6 -52)">
      <path d="M55.4 56.6C58.4 56 61.6 54.4 63.4 52.6C63.6 55.8 60.6 59 57.2 59.4C56.2 58.8 55.6 57.8 55.4 56.6Z" transform="rotate(30 54.4 55.6)" fill="url(#ic-bico)" ${sil('#7a3a0c', 1.6)}/>
      <path d="M52.6 50.2C55.6 47.6 62 47.4 65 50C63.4 53.6 59.4 57 56 57.6C53.8 56.2 52.2 53.4 52.6 50.2Z" fill="url(#ic-bico)" ${sil('#7a3a0c', 1.6)}/>
      <path d="M54.2 50.6Q57.4 48.6 61 49.2Q57.6 50.2 55.4 53Z" fill="#fff" opacity=".65"/>
      <path d="M56 57.6C59.4 57 63.4 53.6 65 50L63.7 57.5C61.2 58.2 57.7 57.9 54.8 57Z" fill="#7a1e2c" stroke="#7a3a0c" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M57.4 58Q60.2 53.6 63.7 57.9Q61.2 59 57.4 58Z" fill="#ff6f7d"/>
    </g>
  </g>
  <ellipse cx="60" cy="90.4" rx="34" ry="5.2" fill="url(#ic-oclusao)"/>
  <path d="M12 92Q10.5 106 30 110.8Q60 117.6 90 110.8Q109.5 106 108 92Q102 87.4 95.5 91.4Q88 87.8 80.5 92.6Q70.5 89.4 60 93.6Q49.5 89.4 39.5 92.6Q32 87.8 24.5 91.4Q18 87.4 12 92Z" fill="url(#ic-ninho)" ${sil(PALHA_CONTORNO)}/>
  <path d="M16 99.5Q20.7 99.2 23.5 96.9M30.1 100.1Q34.1 98.8 37 96.5M53.9 99.3Q58 99.2 60.3 97.2M26.2 105.6Q31.3 105.4 33.7 102.5M41.3 105.4Q45.8 105.3 48.2 103.2M56.5 103.1Q58.3 105.1 62.2 104.9M87.5 105.1Q91.6 105 93.7 102.9M39.3 108.1Q41.7 110.5 45.5 111.4M60.4 107.8Q62.4 111.1 66.9 111.8M83.5 107.8Q85.4 110.6 89.7 111" fill="none" stroke="#ffe58a" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M45.7 96.3Q48.4 99.3 52.9 100.6M61.4 100.1Q64.8 99.3 66.8 97M75.6 100.4Q79.4 99.2 81.9 96.7M91.4 96.5Q93.7 99.4 98.1 100.3M49.8 106.6Q54.6 105.7 57.1 102.4M65.2 105.7Q69.5 105.5 71.1 102.7M80.7 102.2Q82.1 105.2 86.3 105.5M95 102.7Q97.7 104.9 101.5 106M46.4 110.5Q51 110.6 53 108.1M76.4 108.2Q79.2 110 83.2 110.6" fill="none" stroke="#d9a23e" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M23.4 97Q25.9 99.7 30.5 100.2M38.8 99.8Q43.6 100 45.7 97.5M67.6 97Q71 98.9 75.5 99.7M82.9 97Q85.1 99.3 89.3 99.6M19.5 103.1Q22.4 105.3 26.7 106M35.4 102.6Q37.8 104.4 41.3 105.1M71.6 103.4Q74.5 105 78.5 105.6M30.7 111.1Q34.6 110.8 36 108M53.2 107.9Q55.1 110.6 59.3 111.1M67.5 110.7Q72 110.5 74.4 108.4M27.4 96.6Q31.6 92.8 36.4 91M75.6 96.8Q71.8 93.6 66.6 92.4M97.6 98.8Q100.8 95.6 104.2 93.6" fill="none" stroke="#b57a2c" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M14.4 91.45Q18 89.95 21.6 91.45M28.4 91.8Q32 90.3 35.6 91.8M45.9 93.15Q49.5 91.65 53.1 93.15M66.9 93.15Q70.5 91.65 74.1 93.15M84.4 91.8Q88 90.3 91.6 91.8M98.4 91.45Q102 89.95 105.6 91.45" fill="none" stroke="#fff3c0" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>
  <path d="M26.6 95.4Q31 91.4 36 89.6M76.4 95.6Q72.4 92.2 66.8 91M97 97.6Q100.4 94.2 104 92.2" fill="none" stroke="#ffe58a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M12.8 95.4Q11.4 92.6 13.2 91.6Q10.8 91.2 8.4 90Q10.2 93.6 12.8 95.4ZM16.6 105.4Q14 105.2 13 103.6Q12.8 106 11 107.6Q14.4 107.4 16.6 105.4ZM107.2 95Q108.6 92.4 106.8 91.4Q109.2 91 111.6 89.8Q109.8 93.4 107.2 95Z" fill="#c9932f" ${sil(PALHA_CONTORNO, 1.1)}/>
  <ellipse cx="79.4" cy="95.6" rx="7.6" ry="2.2" fill="#5a3410" opacity=".4"/>
  <g transform="rotate(-12 80 87.4)">
    <path d="M80 77.6C84.6 77.6 87.8 83 87.8 88.4C87.8 93.4 84.4 96.4 80 96.4C75.6 96.4 72.2 93.4 72.2 88.4C72.2 83 75.4 77.6 80 77.6Z" fill="url(#ic-ovo)" ${sil('#8a6a3a', 1.4)}/>
    <path d="M86.6 89.6C86 93.4 83.4 95.4 80 95.4C77.6 95.4 75.4 94.4 74.2 92.6C76.2 93.6 78.6 93.8 81 93.2C83.6 92.6 85.6 91.2 86.6 89.6Z" fill="#e8c9a0" opacity=".7"/>
    <ellipse cx="77" cy="82.8" rx="1.9" ry="3" fill="#fff" transform="rotate(14 77 82.8)"/>
    <ellipse cx="76.4" cy="87.6" rx=".9" ry="1.1" fill="#fff" opacity=".8"/>
  </g>`;

/** A galinha no ninho (viewBox 0 0 120 120), com os gradientes que ela usa. Serve também à página offline. */
export function svgGalinhaNinho(): { defs: string; arte: string } {
  return { defs: DEFS_GALINHA, arte: GALINHA };
}

// ------------------------------------------------------------------------------------- cenário

/** Leque de raios de sol a partir de (cx, cy), alternando faixas (uma a cada 360/n graus). */
function raios(cx: number, cy: number, n: number, r: number): string {
  let d = '';
  const passo = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const a0 = i * passo - Math.PI / 2;
    const a1 = a0 + passo * 0.5;
    d += `M${f(cx)} ${f(cy)}L${f(cx + Math.cos(a0) * r)} ${f(cy + Math.sin(a0) * r)}L${f(cx + Math.cos(a1) * r)} ${f(cy + Math.sin(a1) * r)}Z`;
  }
  return d;
}

/** Nuvem fofa (3 bolas + base reta arredondada) centrada em (x, y) com largura ~ 2·r·2,4. */
function nuvem(x: number, y: number, r: number): string {
  // Mesma forma duas vezes: a de baixo azulada, a de cima branca e um pouco mais alta (barriga sombreada).
  const forma = (dy: number) =>
    circ(x - r * 1.1, y + r * 0.25 + dy, r * 0.8) + circ(x, y - r * 0.15 + dy, r) + circ(x + r * 1.15, y + r * 0.3 + dy, r * 0.72) + elip(x, y + r * 0.6 + dy * 0.5, r * 1.9, r * 0.45);
  return `
    <g>
      <path d="${forma(0)}" fill="#bfe3ff"/>
      <path d="${forma(-r * 0.16)}" fill="#ffffff"/>
    </g>`;
}

interface Layout {
  /** Lado do canvas. */
  t: number;
  /** Raio dos cantos (0 = sangria total, o sistema recorta). */
  raio: number;
  /** Escala da galinha (unidades do viewBox 120 → px) e posição do centro do conteúdo. */
  s: number;
  cx: number;
  cy: number;
  /** Centro dos raios de sol. */
  sol: [number, number];
  /** Topo do morro no meio. */
  morro: number;
  /** Brilhos [x, y, r]. */
  brilhos: [number, number, number][];
  /** Nuvens [x, y, r]. */
  nuvens: [number, number, number][];
}

// Centro visual da galinha no ninho no viewBox 120 (da crista em y≈8 ao fundo do ninho em y≈117).
const CENTRO: [number, number] = [58.5, 63];

function cena(l: Layout): string {
  const { t, raio, s, cx, cy } = l;
  const tx = f(cx - CENTRO[0] * s);
  const ty = f(cy - CENTRO[1] * s);
  const [sx, sy] = l.sol;
  const m = l.morro;
  // Morro principal (frente) e um morro mais claro atrás, à esquerda, para dar profundidade.
  const morroTras = `M0 ${f(m + t * 0.02)}Q${f(t * 0.2)} ${f(m - t * 0.07)} ${f(t * 0.48)} ${f(m + t * 0.03)}L${t} ${f(m + t * 0.12)}V${t}H0Z`;
  const morroFrente = `M0 ${f(m + t * 0.1)}Q${f(t * 0.5)} ${f(m - t * 0.06)} ${t} ${f(m + t * 0.08)}V${t}H0Z`;
  const bordaMorro = `M0 ${f(m + t * 0.1)}Q${f(t * 0.5)} ${f(m - t * 0.06)} ${t} ${f(m + t * 0.08)}`;
  // Tufos de capim sobre a crista do morro (dos dois lados do ninho).
  // Folha afilada: base larga em (x, y), ponta em (x+dx, y-h), curvando.
  const folha = (x: number, y: number, dx: number, h: number, w: number) =>
    `M${f(x - w)} ${f(y)}Q${f(x - w * 0.4 + dx * 0.2)} ${f(y - h * 0.6)} ${f(x + dx)} ${f(y - h)}Q${f(x + w * 0.6 + dx * 0.3)} ${f(y - h * 0.5)} ${f(x + w)} ${f(y)}Z`;
  const tufo = (x: number, y: number, k: number) =>
    folha(x - 7 * k, y, -9 * k, 20 * k, 3.6 * k) + folha(x + 7 * k, y, 9 * k, 22 * k, 3.6 * k) + folha(x, y, 2 * k, 30 * k, 4.4 * k);
  const margarida = (x: number, y: number, r: number) => {
    let p = '';
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + 0.3;
      p += elip(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62 * 0.8, r * 0.42, r * 0.42);
    }
    return `<path d="${p}" fill="#ffffff" stroke="#2f7a1e" stroke-width="${f(r * 0.32)}" paint-order="stroke"/><path d="${circ(x, y, r * 0.36)}" fill="#ffc93c" stroke="#a85f00" stroke-width="${f(r * 0.18)}" paint-order="stroke"/>`;
  };
  const k = t / 512;
  const tufos = tufo(t * 0.07, m + t * 0.09, k * 1.3) + tufo(t * 0.93, m + t * 0.075, k * 1.15);
  const flores = margarida(t * 0.085, m + t * 0.155, 16 * k) + margarida(t * 0.915, m + t * 0.15, 13 * k);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" width="${t}" height="${t}">
  <defs>
    <radialGradient id="ic-ceu" cx="${f(sx / t)}" cy="${f(sy / t)}" r=".85">
      <stop offset="0" stop-color="#fff2b8"/><stop offset=".2" stop-color="#a6e2ff"/><stop offset=".52" stop-color="#43b0ff"/><stop offset="1" stop-color="#1263c9"/>
    </radialGradient>
    <radialGradient id="ic-raios" cx="${f(sx / t)}" cy="${f(sy / t)}" r=".7">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".7"/><stop offset=".55" stop-color="#ffffff" stop-opacity=".22"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ic-halo" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#fff6c8" stop-opacity=".9"/><stop offset=".5" stop-color="#fff6c8" stop-opacity=".35"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ic-grama" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9be36a"/><stop offset=".3" stop-color="#6cc644"/><stop offset="1" stop-color="#2f7a1e"/>
    </linearGradient>
    <linearGradient id="ic-grama-tras" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b8ef8a"/><stop offset="1" stop-color="#6fbf4a"/>
    </linearGradient>
    <radialGradient id="ic-vinheta" cx=".5" cy=".45" r=".75">
      <stop offset=".62" stop-color="#0b2d66" stop-opacity="0"/><stop offset="1" stop-color="#0b2d66" stop-opacity=".38"/>
    </radialGradient>
    <linearGradient id="ic-aro" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".75"/><stop offset=".35" stop-color="#ffffff" stop-opacity=".12"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="ic-forma"><rect width="${t}" height="${t}" rx="${raio}"/></clipPath>
    ${DEFS_GALINHA}
  </defs>
  <g clip-path="url(#ic-forma)">
    <rect width="${t}" height="${t}" fill="url(#ic-ceu)"/>
    <path d="${raios(sx, sy, 18, t * 1.2)}" fill="url(#ic-raios)"/>
    <circle cx="${sx}" cy="${sy}" r="${f(t * 0.24)}" fill="url(#ic-halo)"/>
    ${l.nuvens.map(([x, y, r]) => nuvem(x, y, r)).join('')}
    <path d="${morroTras}" fill="url(#ic-grama-tras)"/>
    <path d="${morroFrente}" fill="url(#ic-grama)"/>
    <path d="${bordaMorro}" fill="none" stroke="#d4ff9e" stroke-width="${f(5 * k)}" stroke-linecap="round" opacity=".8"/>
    <path d="${tufos}" fill="url(#ic-grama)" stroke="#2f7a1e" stroke-width="${f(6 * k)}" paint-order="stroke" stroke-linejoin="round"/>
    ${flores}
    <ellipse cx="${cx}" cy="${f(cy + (110.5 - CENTRO[1]) * s)}" rx="${f(56 * s)}" ry="${f(9 * s)}" fill="url(#ic-sombra)"/>
    <g transform="translate(${tx} ${ty}) scale(${f(s)})">${GALINHA}</g>
    <path d="${l.brilhos.map(([x, y, r]) => estrela(x, y, r)).join('')}" fill="url(#ic-ouro)" stroke="#a85f00" stroke-width="${f(7 * k)}" paint-order="stroke" stroke-linejoin="round"/>
    <path d="${l.brilhos.map(([x, y, r]) => circ(x - r * 0.12, y - r * 0.18, r * 0.12)).join('')}" fill="#fff"/>
    <rect width="${t}" height="${t}" fill="url(#ic-vinheta)"/>
  </g>
  ${raio > 0 ? `<rect x="${f(5 * k)}" y="${f(5 * k)}" width="${f(t - 10 * k)}" height="${f(t - 10 * k)}" rx="${f(raio - 5 * k)}" fill="none" stroke="url(#ic-aro)" stroke-width="${f(6 * k)}"/>` : ''}
</svg>`;
}

// Composições (canvas 512). "any": galinha grande, cantos arredondados. "maskable": sangria total e
// tudo que importa dentro do círculo central de 80 % (raio 204,8 em torno de 256,256). "sangria":
// a composição grande sem cantos (o iOS recorta os cantos do apple-touch-icon sozinho).
const GRANDE: Omit<Layout, 'raio'> = {
  t: 512,
  s: 3.78,
  cx: 256,
  cy: 276,
  sol: [256, 196],
  morro: 372,
  brilhos: [
    [96, 214, 30],
    [428, 340, 20],
    [140, 120, 15],
  ],
  nuvens: [
    [84, 104, 32],
    [444, 82, 27],
  ],
};

const MASCARAVEL: Layout = {
  t: 512,
  raio: 0,
  s: 3.1,
  cx: 256,
  cy: 262,
  sol: [256, 200],
  morro: 360,
  brilhos: [
    [126, 222, 24],
    [392, 318, 16],
    [160, 150, 12],
  ],
  nuvens: [
    [96, 112, 26],
    [418, 104, 22],
  ],
};

/** SVG 512×512. `mascaravel`: fundo sem cantos e arte dentro da zona segura (80 %). `sangria`: sem cantos, arte grande. */
export function svgIcone(mascaravel = false, opcoes: { sangria?: boolean } = {}): string {
  if (mascaravel) return cena(MASCARAVEL);
  return cena({ ...GRANDE, raio: opcoes.sangria ? 0 : 112 });
}

// ------------------------------------------------------------------------------------------ selo

/**
 * Selo monocromático para a barra de notificações do Android: só o alfa conta, então é a silhueta
 * BRANCA da galinha no ninho, em 3/4 virada para a esquerda, com recortes transparentes. O que faz
 * ler "galinha" a 18–24 px: bico saliente, crista de 3 lóbulos, barbela, um olho redondo e a cauda
 * em leque. Todo recorte tem 4 unidades ou mais (canvas de 120) para não sumir no tamanho pequeno.
 */
export function svgSelo(): string {
  // Corpo (peito sobe para o pescoço à esquerda, costas descem para a cauda à direita).
  const corpo = 'M30 82C28 70 32 62 38 58L56 56C72 54 88 60 94 70C99 79 97 92 88 100C78 107 46 108 35 101C28 96 28 88 30 82Z';
  const cabeca = circ(43, 41, 17);
  // Bico triangular saindo ~12 unidades para fora do contorno da cabeça (cabeça vai até x=26).
  const bico = 'M28.4 35.6L13.4 42.6Q12.6 43.4 13.6 44L28.4 48.4Z';
  // Barbela em gota logo abaixo do bico.
  const barbela = 'M25.4 50.4C21.4 53.6 21.6 60.6 25.6 61C29.4 61.4 31 55.6 29.4 50.6Z';
  // Crista: 3 lóbulos (do menor, na frente, ao maior, no alto, e o de trás).
  const crista = circ(32.6, 25.4, 5.6) + circ(41.8, 19.6, 7.2) + circ(52.4, 22, 6.2) + 'M28.4 31L33 25L50 23.4L58 30Z';
  // Cauda: 3 penas em gota (finas na base, redondas na ponta) abertas em leque.
  const pena = (bx: number, by: number, ang: number, comp: number, larg: number) => {
    const r = (ang * Math.PI) / 180;
    const [ux, uy] = [Math.sin(r), -Math.cos(r)];
    const [nx, ny] = [-uy, ux];
    const tx = bx + ux * comp;
    const ty = by + uy * comp;
    const m = (k: number, l: number) => `${f(bx + ux * comp * k + nx * l)} ${f(by + uy * comp * k + ny * l)}`;
    return `M${m(0, -larg * 0.35)}Q${m(0.55, -larg * 1.05)} ${m(0.86, -larg)}Q${f(tx)} ${f(ty)} ${m(0.86, larg * 0.6)}Q${m(0.55, larg * 0.9)} ${m(0, larg * 0.35)}Z`;
  };
  const cauda = pena(84, 74, 16, 37, 8.4) + pena(86, 76, 46, 34, 8.2) + pena(88, 79, 75, 28, 7.4);
  // Vãos entre as penas (só perto das pontas, para o leque não virar "dedos").
  const vao = (bx: number, by: number, ang: number, de: number, ate: number) => {
    const r = (ang * Math.PI) / 180;
    return `M${f(bx + Math.sin(r) * de)} ${f(by - Math.cos(r) * de)}L${f(bx + Math.sin(r) * ate)} ${f(by + -Math.cos(r) * ate)}`;
  };
  const vaos = vao(85, 75, 31, 22, 42) + vao(87, 77.5, 61, 19, 38);
  const ninho =
    'M8 92Q6.5 108 28 113.4Q60 120.6 92 113.4Q113.5 108 112 92Q102 85.4 95.5 89.4Q88 85.8 80.5 90.6Q70.5 87.4 60 91.6Q49.5 87.4 39.5 90.6Q32 85.8 24.5 89.4Q18 85.4 8 92Z';
  const topoNinho = 'M8 92Q18 85.4 24.5 89.4Q32 85.8 39.5 90.6Q49.5 87.4 60 91.6Q70.5 87.4 80.5 90.6Q88 85.8 95.5 89.4Q102 85.4 112 92';
  // Recortes: o olho, os 2 entalhes em V da crista, a linha da asa e o vão entre penas da cauda.
  const olho = circ(37.6, 38.6, 4);
  const entalhes = 'M34.6 17.6L39.4 16.2L37.8 24.4ZM47.4 13.8L52 15.4L49.2 22.2Z';
  const asa = 'M56 67Q72 61 86 70Q92 76 90 85';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <defs>
    <mask id="selo-recorte" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
      <rect width="120" height="120" fill="#fff"/>
      <path d="${olho}" fill="#000"/>
      <path d="${entalhes}" fill="#000" stroke="#000" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="${asa}" fill="none" stroke="#000" stroke-width="4.2" stroke-linecap="round"/>
      <path d="${vaos}" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round"/>
      <path d="${topoNinho}" fill="none" stroke="#000" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
    </mask>
    <mask id="selo-palha" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
      <rect width="120" height="120" fill="#fff"/>
      <path d="M22 101l10 4M44 104l11 2M66 106l11 -2M88 104l10 -4" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round"/>
    </mask>
  </defs>
  <g transform="translate(-1.2 -2.6) scale(.818)">
    <g mask="url(#selo-recorte)" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round">
      <path d="${cauda}"/>
      <path d="${corpo}"/>
      <path d="${crista}"/>
      <path d="${cabeca}"/>
      <path d="${bico}"/>
      <path d="${barbela}"/>
    </g>
    <path d="${ninho}" mask="url(#selo-palha)" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
  </g>
</svg>`;
}

export const dataUri = (svg: string): string => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

'use client';

// Loja (GDD 6.8): upgrade de ninho e vitrine "Em breve".
// Visual (DIRECAO_DE_ARTE 11): vitrine em painel com faixa, diorama do galinheiro crescendo (obra com martelo
// e ninhos novos surgindo), medalhas de nível atual → próximo, trilha 1–32 e botão de compra azul com preço.
import type { CobrancaRoletaDTO } from '@galinheiro/api-contract';
import { CONFIG } from '@galinheiro/game-core';
import { ChevronsRight, Hammer, Hourglass, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { chamar } from '../api';
import { FiguraAnimal } from '../arte/Animal';
import { IconeLoja, IconeNinho } from '../arte/Icones';
import { Modal } from '../componentes/Modal';
import { copiarTexto } from '../convites/texto';
import { CartaoConvite } from '../convites/CartaoConvite';
import { useEstado } from '../estado';
import { CartaoIntercambio } from '../intercambio/CartaoIntercambio';
import { toast } from '../ui';
import { useAcoes } from '../useAcoes';
import { ConteudoCobranca, tituloCobranca } from './cobranca';
import { mensagemDeErro, moedas } from '../util';

/** id seguro para url(#…) (o useId traz ":" e "«"). */
function useIdSvg(prefixo: string): string {
  return `gi-telas-${prefixo}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

// Contorno por fora do preenchimento (só metade do traço aparece), como nos personagens.
const sil = (cor: string, visivel = 3) =>
  ({ stroke: cor, strokeWidth: visivel * 2, paintOrder: 'stroke', strokeLinejoin: 'round', strokeLinecap: 'round' }) as const;

/* ------------------------------------------------------------------ diorama do galinheiro */

/** Galinheiro de madeira com telhado vermelho, cata-vento de galo e uma galinha espiando pela janela. */
function DesenhoGalinheiro({ nivel, noMaximo }: { nivel: number; noMaximo: boolean }) {
  const u = useIdSvg('loja');
  // cresce um pouco com o nível (0,86 no nível 1 → 1,0 no máximo), com a base fixa no chão
  const escala = 0.86 + (0.14 * Math.min(nivel, CONFIG.galinheiro.nivelMax)) / CONFIG.galinheiro.nivelMax;
  return (
    <svg viewBox="0 0 320 196" className="loja-galinheiro" aria-hidden>
      <defs>
        <linearGradient id={`${u}-madeira`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0bb7a" />
          <stop offset=".5" stopColor="#c88a52" />
          <stop offset="1" stopColor="#9a5f2e" />
        </linearGradient>
        <linearGradient id={`${u}-telhado`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7a5e" />
          <stop offset=".45" stopColor="#e2443a" />
          <stop offset="1" stopColor="#a82a2a" />
        </linearGradient>
        <linearGradient id={`${u}-oitao`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffdf6" />
          <stop offset="1" stopColor="#efdcb6" />
        </linearGradient>
        <linearGradient id={`${u}-colina-fundo`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c4f39a" />
          <stop offset="1" stopColor="#8fd65e" />
        </linearGradient>
        <linearGradient id={`${u}-colina`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fe060" />
          <stop offset=".35" stopColor="#6cc644" />
          <stop offset="1" stopColor="#4fa832" />
        </linearGradient>
        <radialGradient id={`${u}-sol`} cx=".42" cy=".38" r=".62">
          <stop offset="0" stopColor="#fff6b0" />
          <stop offset=".55" stopColor="#ffd23f" />
          <stop offset="1" stopColor="#ffb300" />
        </radialGradient>
        <radialGradient id={`${u}-janela`} cx=".4" cy=".35" r=".7">
          <stop offset="0" stopColor="#fff6c0" />
          <stop offset="1" stopColor="#ffc93c" />
        </radialGradient>
        <linearGradient id={`${u}-feno`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe58a" />
          <stop offset=".5" stopColor="#f2c75c" />
          <stop offset="1" stopColor="#c9932f" />
        </linearGradient>
      </defs>

      {/* sol e nuvens */}
      <circle cx="286" cy="32" r="17" fill={`url(#${u}-sol)`} {...sil('#e08a00', 1.5)} />
      <ellipse cx="281" cy="26" rx="5" ry="3.4" fill="#fff" opacity=".7" />
      <g fill="#fff" {...sil('#a9d6f0', 1.2)}>
        <path d="M192 40Q192 30 203 31Q208 22 219 27Q228 23 232 32Q242 33 240 41Q238 46 230 45H198Q192 45 192 40Z" />
        <path d="M30 70Q30 63 38 64Q42 58 49 61Q56 59 58 65Q65 66 63 71Q61 74 56 74H35Q30 74 30 70Z" />
      </g>

      {/* colina do fundo com cerquinha. As colinas continuam 400 unidades para cada lado (o SVG tem
          overflow visível e o palco corta): num palco mais largo que a cena (desktop, celular baixo com
          a cena encolhida) o gramado vai de borda a borda, sem céu embaixo do horizonte nem cerca no ar.
          As emendas em x −4 e 324 seguem a tangente da curva original (sem quina). */}
      <path
        d="M-404 116Q-290 98 -170 122Q-56 160 -4 132Q48 104 112 116Q170 98 230 112Q286 100 324 120Q362 140 430 126Q560 100 724 118V196H-404Z"
        fill={`url(#${u}-colina-fundo)`}
      />
      <g {...sil('#3b200c', 1.5)} fill="#dca066">
        {[14, 36, 58, 262, 284, 306].map((x) => (
          <rect key={x} x={x - 3} y={x < 160 ? 108 + (x % 7) : 104 + (x % 5)} width="6" height="22" rx="2" />
        ))}
        <rect x="6" y="114" width="60" height="4" rx="2" />
        <rect x="254" y="110" width="60" height="4" rx="2" />
      </g>

      {/* galinheiro (cresce com o nível) */}
      <g transform={`translate(160 142) scale(${escala.toFixed(3)}) translate(-160 -142)`}>
        <ellipse cx="160" cy="142" rx="66" ry="7" fill="#2f7a20" opacity=".28" />
        {/* pés */}
        <g fill="#8a5226" {...sil('#3b200c', 2.5)}>
          <rect x="116" y="118" width="9" height="24" rx="2" />
          <rect x="195" y="118" width="9" height="24" rx="2" />
        </g>
        {/* fardo de feno */}
        <g>
          <rect x="70" y="122" width="34" height="22" rx="5" fill={`url(#${u}-feno)`} {...sil('#6b4416', 2.5)} />
          <path d="M80 123V143M94 123V143" stroke="#9a6424" strokeWidth="2.2" />
          <path d="M74 128Q87 125 100 128" stroke="#fff3c0" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".8" />
        </g>
        {/* corpo de tábuas */}
        <rect x="108" y="58" width="104" height="66" rx="4" fill={`url(#${u}-madeira)`} {...sil('#3b200c', 3)} />
        <g stroke="#8a5226" strokeWidth="1.5" opacity=".55">
          {[121, 134, 147, 173, 186, 199].map((x) => (
            <path key={x} d={`M${x} 62V121`} />
          ))}
        </g>
        <path d="M186 60H210V122H186Z" fill="#6a2f3a" opacity=".2" />
        <path d="M111 64V118" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".35" />
        {/* janelas laterais com luz */}
        {[120, 184].map((x) => (
          <g key={x}>
            <rect x={x} y="76" width="18" height="16" rx="3" fill={`url(#${u}-janela)`} {...sil('#3b200c', 2)} />
            <path d={`M${x + 9} 77V91M${x + 1} 84H${x + 17}`} stroke="#8a5226" strokeWidth="2" />
            <rect x={x - 2} y="92" width="22" height="4" rx="2" fill="#f0bb7a" {...sil('#3b200c', 1.5)} />
          </g>
        ))}
        {/* porta em arco */}
        <path d="M146 124V104Q146 92 160 92Q174 92 174 104V124Z" fill="#4a2a10" {...sil('#3b200c', 2.5)} />
        <path d="M148 121Q160 116 172 121" stroke="#e9b949" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M150 104Q151 96 158 95" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".25" />
        {/* plaquinha com ovo dourado */}
        <rect x="148" y="74" width="24" height="14" rx="3" fill="#dca066" {...sil('#3b200c', 1.8)} />
        <ellipse cx="160" cy="81" rx="4" ry="5" fill="#ffd24a" {...sil('#5a3a00', 1.2)} />
        <ellipse cx="158.6" cy="79" rx="1.1" ry="1.8" fill="#fff" opacity=".9" />
        {/* oitão claro com janela redonda e uma galinha espiando */}
        <path d="M112 62L160 30L208 62Z" fill={`url(#${u}-oitao)`} {...sil('#3b200c', 2)} />
        <circle cx="160" cy="50" r="10" fill="#4a2a10" stroke="#fff6e0" strokeWidth="3" />
        <circle cx="160" cy="50" r="11.5" fill="none" stroke="#3b200c" strokeWidth="1.6" />
        <g>
          <circle cx="155.6" cy="43.6" r="2.2" fill="#ee4334" />
          <circle cx="159" cy="42.2" r="2.5" fill="#ee4334" />
          <circle cx="162.4" cy="43.8" r="2.1" fill="#ee4334" />
          <circle cx="159" cy="51" r="6.4" fill="#fff4e2" stroke="#8a4a22" strokeWidth="1.2" />
          <circle cx="161" cy="49.6" r="1.5" fill="#1e1426" />
          <circle cx="161.5" cy="49" r=".5" fill="#fff" />
          <path d="M164.6 51.4L168.6 52.6L164.6 54Z" fill="#ffb52e" stroke="#7a3a0c" strokeWidth=".8" strokeLinejoin="round" />
        </g>
        {/* telhado */}
        <path d="M86 72L160 18L234 72L225 82L160 36L95 82Z" fill={`url(#${u}-telhado)`} {...sil('#4a1010', 3)} />
        <g stroke="#9a2a24" strokeWidth="1.6" fill="none" opacity=".7" strokeLinecap="round">
          <path d="M112 60Q116 63 120 60Q124 63 128 60M126 50Q130 53 134 50Q138 53 142 50M140 40Q144 43 148 40" />
          <path d="M172 40Q176 43 180 40M186 50Q190 53 194 50Q198 53 202 50M200 60Q204 63 208 60Q212 63 216 60" />
        </g>
        <path d="M92 72L158 24" stroke="#ffb3a0" strokeWidth="2" strokeLinecap="round" opacity=".75" />
        {/* cata-vento de galo */}
        <path d="M160 18V4" stroke="#3b200c" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M151 9H169" stroke="#3b200c" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M154 4Q154 -2 159 -2Q161 -6 164 -3Q168 -3 167 1Q170 3 167 6H156Q153 6 154 4Z" fill="#ffc93c" {...sil('#5a3a00', 1.2)} />
        <circle cx="160" cy="18" r="3" fill="#ffc93c" {...sil('#5a3a00', 1.2)} />
      </g>

      {/* colina da frente (estendida como a do fundo) */}
      <path
        d="M-404 150Q-270 132 -150 152Q-78 170 -4 152Q70 134 150 144Q230 132 324 150Q418 168 500 158Q610 144 724 152V196H-404Z"
        fill={`url(#${u}-colina)`}
        {...sil('#3f8f2a', 1.5)}
      />
      <path d="M8 150Q60 138 120 142" stroke="#c4f39a" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".8" />
      {/* flores */}
      {[
        [26, 166, '#fff'],
        [292, 170, '#ff8ac0'],
        [44, 182, '#ff8ac0'],
        [276, 186, '#fff'],
      ].map(([x, y, cor]) => (
        <g key={`${x}`} transform={`translate(${x} ${y})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={(3.4 * Math.cos((a * Math.PI) / 180)).toFixed(2)} cy={(3.4 * Math.sin((a * Math.PI) / 180)).toFixed(2)} r="2.6" fill={cor as string} stroke="#3f8f2a" strokeWidth=".8" />
          ))}
          <circle r="2" fill="#ffd23f" stroke="#c27c00" strokeWidth=".8" />
        </g>
      ))}

      {noMaximo && (
        <g fill="#fff6b8" {...sil('#c27c00', 1)}>
          {[
            [70, 66, 0.8],
            [100, 30, 0.6],
            [236, 92, 0.7],
          ].map(([x, y, s]) => (
            <path key={`${x}`} transform={`translate(${x} ${y}) scale(${s})`} d="M0 -9L2.6 -2.6L9 0L2.6 2.6L0 9L-2.6 2.6L-9 0L-2.6 -2.6Z" />
          ))}
        </g>
      )}
    </svg>
  );
}

/** Selo dourado de "nível máximo": disco com troféu cheio (pulsa no canto da cena). */
function SeloMaximo() {
  const u = useIdSvg('selo');
  return (
    <svg viewBox="0 0 64 64" className="loja-selo-max" aria-hidden>
      <defs>
        <radialGradient id={`${u}-disco`} cx=".4" cy=".32" r=".75">
          <stop offset="0" stopColor="#fff6b8" />
          <stop offset=".5" stopColor="#ffc93c" />
          <stop offset="1" stopColor="#d08a00" />
        </radialGradient>
        <linearGradient id={`${u}-taca`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ffe9a8" />
        </linearGradient>
      </defs>
      {/* serrilhado de medalha */}
      <path
        d="M32 2L37 7L44 4L46 11L53 11L52 18L59 21L55 27L60 32L55 37L59 43L52 46L53 53L46 53L44 60L37 57L32 62L27 57L20 60L18 53L11 53L12 46L5 43L9 37L4 32L9 27L5 21L12 18L11 11L18 11L20 4L27 7Z"
        fill="#e9a400"
        {...sil('#5a3a00', 2)}
      />
      <circle cx="32" cy="32" r="21" fill={`url(#${u}-disco)`} {...sil('#5a3a00', 1.5)} />
      <circle cx="32" cy="32" r="17" fill="none" stroke="#fff6c0" strokeWidth="1.6" opacity=".7" />
      {/* troféu cheio */}
      <path d="M22 20H42V26Q42 37 32 39Q22 37 22 26Z" fill={`url(#${u}-taca)`} {...sil('#5a3a00', 1.6)} />
      <path d="M22 23Q15 23 16 29Q17 33 23 33M42 23Q49 23 48 29Q47 33 41 33" fill="none" stroke="#5a3a00" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M29 39H35V43H29Z" fill="#fff1c4" {...sil('#5a3a00', 1.4)} />
      <rect x="24" y="43" width="16" height="5" rx="1.6" fill="#c4844a" {...sil('#3b200c', 1.4)} />
      <path d="M26 23V28Q26 32 29 34" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".9" />
      <path d="M32 24L33.4 27L36.6 27.3L34.2 29.4L35 32.6L32 31L29 32.6L29.8 29.4L27.4 27.3L30.6 27Z" fill="#ffc93c" stroke="#a86a00" strokeWidth=".9" strokeLinejoin="round" />
    </svg>
  );
}

/** Martelo de madeira com cabeça de ferro (gira no cabo: obra em andamento). */
function Martelo() {
  return (
    <svg viewBox="0 0 44 44" className="loja-martelo" style={{ right: 56, bottom: 15 }} aria-hidden>
      <path d="M34 38L16 16" stroke="#3b200c" strokeWidth="8" strokeLinecap="round" />
      <path d="M34 38L16 16" stroke="#dca066" strokeWidth="4" strokeLinecap="round" />
      <path d="M33 36L18 18" stroke="#fff3c0" strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
      <path d="M6 15L17 4L26 13L15 24Z" fill="#b9c6d6" {...sil('#2e3642', 2.5)} />
      <path d="M8 15L17 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".8" />
      <path d="M15 24L26 13L24 11L13 22Z" fill="#7d8ea6" />
    </svg>
  );
}

function CenaGalinheiro({ nivel, noMaximo }: { nivel: number; noMaximo: boolean }) {
  const novos = CONFIG.galinheiro.ninhosPorNivel;
  return (
    <div className="loja-palco">
      <div className="loja-raios" aria-hidden />
      <div className="loja-cena" aria-hidden>
        <DesenhoGalinheiro nivel={nivel} noMaximo={noMaximo} />
        <span className="loja-figurante" style={{ left: 16, bottom: 30 }}>
          <FiguraAnimal tipo="galinha" ninho={false} atrasoS={0.4} />
        </span>
        <span className="loja-figurante" style={{ right: 18, bottom: 66, width: 46, height: 46 }}>
          <FiguraAnimal tipo="pato" ninho={false} atrasoS={1.3} />
        </span>
        {noMaximo ? (
          <>
            <span className="loja-figurante" style={{ left: 131, bottom: 2 }}>
              <FiguraAnimal tipo="avestruz" ninho={false} atrasoS={0.8} />
            </span>
            <SeloMaximo />
          </>
        ) : (
          <>
            <div className="loja-novos">
              {Array.from({ length: novos }, (_, i) => (
                <span key={i}>
                  <FiguraAnimal tipo={null} />
                </span>
              ))}
            </div>
            <span className="loja-poeira" style={{ right: 80, bottom: 20 }}>
              <i />
              <i />
              <i />
            </span>
            <Martelo />
            <span className="loja-mais">
              <span className="pilula">
                <Plus strokeWidth={4} /> {novos} ninhos
              </span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ medalhas de nível */

function MedalhaNivel({ nivel, proximo, maximo }: { nivel: number; proximo?: boolean; maximo?: boolean }) {
  const u = useIdSvg('medalha');
  const ouro = proximo || maximo;
  const [claro, base, escuro, contorno] = ouro ? ['#fff1a8', '#ffc93c', '#c27c00', '#5a3a00'] : ['#a8dcff', '#46a8ff', '#1868d0', '#0b2d66'];
  const escudo = 'M33 4L59 12.5Q62 13.5 62 16.5V36C62 53 49.5 64 33 70C16.5 64 4 53 4 36V16.5Q4 13.5 7 12.5Z';
  return (
    <div className="medalha-nivel" data-proximo={proximo ? '' : undefined} data-maximo={maximo ? '' : undefined}>
      <svg viewBox="0 0 66 74" aria-hidden>
        <defs>
          <linearGradient id={`${u}-face`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={claro} />
            <stop offset=".5" stopColor={base} />
            <stop offset="1" stopColor={escuro} />
          </linearGradient>
        </defs>
        <path d={escudo} fill={`url(#${u}-face)`} {...sil(contorno, 3)} />
        <path d={escudo} fill="none" stroke="#fff" strokeWidth="2.4" opacity=".45" transform="translate(33 37) scale(.8) translate(-33 -37)" />
        <path d="M12 18Q33 10 54 18V30Q33 22 12 30Z" fill="#fff" opacity=".28" />
        {maximo && (
          <g>
            <path d="M15 8L13 -8L23 0L33 -12L43 0L53 -8L51 8Z" fill="#ffd23f" {...sil('#5a3a00', 1.8)} />
            <path d="M17 4H49" stroke="#fff6c0" strokeWidth="2" strokeLinecap="round" opacity=".8" />
            <circle cx="33" cy="-12" r="3" fill="#ff5a48" {...sil('#5c0a05', 1)} />
            <circle cx="13" cy="-8" r="2.4" fill="#46a8ff" {...sil('#0b2d66', 1)} />
            <circle cx="53" cy="-8" r="2.4" fill="#46a8ff" {...sil('#0b2d66', 1)} />
          </g>
        )}
        {proximo && (
          <path
            d="M33 -4L36.2 3L43.8 3.6L38 8.6L39.8 16L33 12L26.2 16L28 8.6L22.2 3.6L29.8 3Z"
            fill="#fff6b8"
            {...sil('#5a3a00', 1.6)}
          />
        )}
      </svg>
      <span className="medalha-numero texto-contorno" style={{ ['--contorno-cor' as string]: contorno }}>
        {nivel}
      </span>
      <span className="medalha-rotulo texto-contorno texto-contorno-fino" style={{ ['--contorno-cor' as string]: contorno }}>
        {maximo ? 'Máximo' : proximo ? 'Próximo' : 'Nível'}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ vitrine */

export interface PropsVitrine {
  nivel: number;
  capacidade: number;
  ampliando?: boolean;
  aoAmpliar?: () => void;
}

/** Card "Ampliar galinheiro" (exportado para a galeria de desenvolvimento). */
export function VitrineAmpliacao({ nivel, capacidade, ampliando = false, aoAmpliar }: PropsVitrine) {
  const { nivelMax, ninhosPorNivel, custoUpgradeX100: custo } = CONFIG.galinheiro;
  const noMaximo = nivel >= nivelMax;
  const pctNivel = (nivel / nivelMax) * 100;

  return (
    <section className="painel painel-com-faixa loja-vitrine" aria-labelledby="loja-ampliar">
      <h2 id="loja-ampliar" className="faixa">
        Ampliar galinheiro
      </h2>
      <CenaGalinheiro nivel={nivel} noMaximo={noMaximo} />

      {noMaximo ? (
        <>
          <div className="loja-maximo">
            <MedalhaNivel nivel={nivelMax} maximo />
            <p className="loja-maximo-texto">
              <span className="texto-contorno">Galinheiro no máximo!</span>
              <span className="loja-maximo-ninhos numeros">
                <IconeNinho className="icone-ninho" />
                {nivelMax * ninhosPorNivel} ninhos
              </span>
            </p>
          </div>
          <div className="loja-trilha">
            <div
              className="barra"
              data-cor="ouro"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={nivelMax}
              aria-valuenow={nivelMax}
              aria-label={`Nível ${nivelMax} de ${nivelMax}`}
            >
              <span className="barra-preenchimento" style={{ ['--p' as string]: 100 }} />
              <span className="barra-texto" style={{ ['--contorno-cor' as string]: '#5a3a00' }}>
                Nível {nivelMax} de {nivelMax}
              </span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="loja-niveis numeros">
            <MedalhaNivel nivel={nivel} />
            <span className="loja-seta" aria-hidden>
              {[0, 1, 2].map((i) => (
                <svg key={i} viewBox="0 0 22 28">
                  <path d="M5 4L17 14L5 24" fill="none" stroke="#3b200c" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 4L17 14L5 24" fill="none" stroke="#ffc93c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ))}
            </span>
            <MedalhaNivel nivel={nivel + 1} proximo />
          </div>
          <p className="loja-ninhos numeros">
            <IconeNinho className="icone-ninho" />
            <span className="sr-only">
              Nível {nivel} → {nivel + 1} ·{' '}
            </span>
            <span>{capacidade}</span>
            <ChevronsRight className="loja-ninhos-seta" strokeWidth={3} aria-hidden />
            <span className="texto-contorno loja-ninhos-novo">{capacidade + ninhosPorNivel}</span>
            <span>ninhos</span>
          </p>

          <div className="loja-trilha">
            <div
              className="barra"
              data-cor="azul"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={nivelMax}
              aria-valuenow={nivel}
              aria-label={`Nível ${nivel} de ${nivelMax}`}
            >
              <span className="barra-preenchimento" data-anima style={{ ['--p' as string]: pctNivel }} />
              <span className="barra-texto">
                Nível {nivel} de {nivelMax}
              </span>
            </div>
            <div className="loja-trilha-marcas" aria-hidden>
              <span>Nível 1</span>
              <b>Nível {nivelMax}</b>
            </div>
          </div>

          <button
            type="button"
            className="botao botao-compra botao-g botao-brilho loja-acao w-full"
            onClick={aoAmpliar}
            disabled={ampliando}
            data-tut="ampliar"
          >
            <span className="icone-contorno" aria-hidden>
              <Hammer />
              <Hammer />
            </span>
            {ampliando ? 'Gerando cobrança…' : 'Ampliar'}
            <span className="sr-only">por</span>
            <span className="botao-preco">R$ {moedas(custo)}</span>
          </button>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ em breve */

function IlustracaoDecoracoes() {
  return (
    <svg viewBox="0 0 84 84" className="breve-ilustracao" aria-hidden>
      {/* bandeirolas */}
      <path d="M4 14Q42 34 80 14" fill="none" stroke="#3b200c" strokeWidth="2.4" />
      {[
        [12, 18, '#ff5a48'],
        [26, 24, '#ffc93c'],
        [42, 26, '#46a8ff'],
        [58, 24, '#6fd13f'],
        [72, 18, '#ff7ab0'],
      ].map(([x, y, cor]) => (
        <path key={`${x}`} d={`M${Number(x) - 6} ${y}L${Number(x) + 6} ${y}L${x} ${Number(y) + 13}Z`} fill={cor as string} {...sil('#3b200c', 1.4)} />
      ))}
      {/* vaso de flor */}
      <path d="M28 58H56L52 78H32Z" fill="#e06a3a" {...sil('#5c1f0a', 2)} />
      <rect x="25" y="54" width="34" height="8" rx="3" fill="#ff8a5a" {...sil('#5c1f0a', 2)} />
      <path d="M42 54V40" stroke="#2f9a1c" strokeWidth="3" strokeLinecap="round" />
      <path d="M42 48Q34 44 33 38Q40 39 42 46Z" fill="#6fd13f" {...sil('#174d0b', 1.2)} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle key={a} cx={(42 + 6 * Math.cos((a * Math.PI) / 180)).toFixed(2)} cy={(34 + 6 * Math.sin((a * Math.PI) / 180)).toFixed(2)} r="4.4" fill="#ff8ac0" {...sil('#7a1a4a', 1.2)} />
      ))}
      <circle cx="42" cy="34" r="3.6" fill="#ffd23f" {...sil('#c27c00', 1)} />
    </svg>
  );
}

function IlustracaoVitamina() {
  return (
    <svg viewBox="0 0 84 84" className="breve-ilustracao" aria-hidden>
      <rect x="34" y="8" width="16" height="10" rx="3" fill="#ff5a48" {...sil('#5c0a05', 2)} />
      <path d="M30 18H54V26Q64 32 64 46V70Q64 78 56 78H28Q20 78 20 70V46Q20 32 30 26Z" fill="#a8f0d0" {...sil('#174d3b', 2.5)} />
      <path d="M22 50H62V70Q62 76 56 76H28Q22 76 22 70Z" fill="#46c98a" />
      <rect x="27" y="44" width="30" height="20" rx="4" fill="#fffdf6" {...sil('#174d3b', 1.5)} />
      <path d="M42 48V60M36 54H48" stroke="#ff5a48" strokeWidth="4" strokeLinecap="round" />
      <path d="M26 34Q28 28 33 26" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}

/** Cadeado dourado de baú. */
function Cadeado() {
  return (
    <svg viewBox="0 0 46 54" className="breve-cadeado" aria-hidden>
      <path d="M12 24V16Q12 5 23 5Q34 5 34 16V24" fill="none" stroke="#3b200c" strokeWidth="11" strokeLinecap="round" />
      <path d="M12 24V16Q12 5 23 5Q34 5 34 16V24" fill="none" stroke="#c9d3e2" strokeWidth="5" strokeLinecap="round" />
      <path d="M14 15Q15 8 21 7" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="5" y="22" width="36" height="28" rx="8" fill="#ffc93c" {...sil('#5a3a00', 3)} />
      <rect x="5" y="22" width="36" height="11" rx="6" fill="#fff1a8" opacity=".55" />
      <path d="M36 34V44Q36 47 33 47" stroke="#c27c00" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".7" />
      <circle cx="23" cy="34" r="4.2" fill="#5a3a00" />
      <path d="M21 36H25L26 43H20Z" fill="#5a3a00" />
    </svg>
  );
}

const EM_BREVE = [
  { titulo: 'Decorações', texto: 'Enfeites para o galinheiro', Arte: IlustracaoDecoracoes },
  { titulo: 'Vitamina', texto: 'Devolve o ânimo dos animais', Arte: IlustracaoVitamina },
];

export function VitrineEmBreve() {
  return (
    <section aria-labelledby="loja-breve">
      <h2 id="loja-breve" className="placa-secao">
        <span className="tile-icone" data-cor="azul" aria-hidden>
          <span className="icone-contorno">
            <Hourglass />
            <Hourglass />
          </span>
        </span>
        Em breve
      </h2>
      <div className="breve-grade">
        {EM_BREVE.map(({ titulo, texto, Arte }) => (
          <div key={titulo} className="painel breve-carta" aria-disabled>
            <div className="breve-arte">
              <Arte />
              <span className="breve-veu" />
              <Cadeado />
            </div>
            <span className="pilula">EM BREVE</span>
            <p className="breve-titulo">{titulo}</p>
            <p className="breve-texto">{texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TelaLoja() {
  const { data: estado } = useEstado();
  const router = useRouter();
  const { ampliar, ampliando } = useAcoes();
  const [pix, setPix] = useState<CobrancaRoletaDTO | null>(null);
  const [gerandoPix, setGerandoPix] = useState(false);
  const aoPago = useRef<(id: string) => void>(() => {});

  useEffect(() => {
    if (!pix || pix.status !== 'aguardando') return;
    let parado = false;
    const consultar = async () => {
      try {
        const r = await chamar<CobrancaRoletaDTO>('GET', `/upgrade-nest/pix?id=${pix.id}`);
        if (parado) return;
        if (r.data.status === 'pago') aoPago.current(r.data.id);
        else if (r.data.status === 'expirado' || r.data.status === 'falhou') {
          setPix(null);
          toast(r.data.status === 'expirado'
            ? (pix.meio === 'usdt' ? 'Essa cobrança em USDT expirou. Toque em Ampliar para gerar outra.' : 'Esse PIX expirou. Toque em Ampliar para gerar outro.')
            : (pix.meio === 'usdt' ? 'A cobrança em USDT não foi concluída. Tente de novo.' : 'O PIX não foi concluído. Tente de novo.'), 'erro');
        }
      } catch {
        // a próxima consulta tenta de novo; o galinheiro não cresce sem confirmação
      }
    };
    const timer = setInterval(() => void consultar(), 3000);
    return () => {
      parado = true;
      clearInterval(timer);
    };
  }, [pix]);

  const custo = CONFIG.galinheiro.custoUpgradeX100;

  const confirmar = async (id: string) => {
    setPix(null);
    const slots = await ampliar(id);
    if (slots) router.push('/galinheiro');
  };
  aoPago.current = (id) => {
    void confirmar(id);
  };

  const abrirPix = async () => {
    if (gerandoPix || pix || ampliando) return;
    setGerandoPix(true);
    try {
      const r = await chamar<CobrancaRoletaDTO>('POST', '/upgrade-nest/pix', { idempotente: true });
      if (r.data.status === 'pago') {
        void confirmar(r.data.id);
        return;
      }
      if (r.data.status !== 'aguardando' || !r.data.copiaCola) {
        toast('Não foi possível gerar a cobrança. Tente de novo.', 'erro');
        return;
      }
      setPix(r.data);
    } catch (erro) {
      toast(mensagemDeErro(erro), 'erro');
    } finally {
      setGerandoPix(false);
    }
  };

  const copiarPix = async () => {
    if (!pix?.copiaCola) return;
    if (await copiarTexto(pix.copiaCola)) toast(pix.meio === 'usdt' ? 'Endereço USDT copiado.' : 'Código PIX copiado.', 'sucesso');
    else toast('Não consegui copiar. Selecione o código e copie.', 'erro');
  };

  if (!estado) return null;

  const { nivelGalinheiro, capacidade } = estado.player;

  return (
    <div className="tela loja-tela">
      <div className="tela-cabeca">
        <IconeLoja className="tela-cabeca-icone" />
        <h1 className="titulo-tela">Loja</h1>
      </div>
      <VitrineAmpliacao nivel={nivelGalinheiro} capacidade={capacidade} ampliando={gerandoPix || ampliando} aoAmpliar={() => void abrirPix()} />
      <Modal aberto={!!pix} aoFechar={() => setPix(null)} titulo={tituloCobranca(pix?.meio, 'ampliar')}>
        <ConteudoCobranca cobranca={pix} custoX100={custo} depois="Os 4 ninhos novos entram" />
        <div className="mt-4 flex gap-2">
          <button type="button" className="botao botao-primario flex-1" onClick={() => void copiarPix()}>
            {pix?.meio === 'usdt' ? 'Copiar endereço' : 'Copiar código'}
          </button>
          <button type="button" className="botao botao-secundario flex-1" onClick={() => setPix(null)}>
            Fechar
          </button>
        </div>
      </Modal>
      <CartaoIntercambio />
      <CartaoConvite />
      <VitrineEmBreve />
    </div>
  );
}

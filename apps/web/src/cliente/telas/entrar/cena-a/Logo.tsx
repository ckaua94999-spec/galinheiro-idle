'use client';

// Logo da abertura: "Galinheiro" em ARCO, em ouro com acabamento de splash de jogo. Construção em 3 camadas
// (técnica da variante C): 3 cópias da palavra empilhadas, então o contorno grosso de uma letra nunca cobre
// a face da vizinha (peso e linha de base iguais em todas as letras):
//   1. contorno marrom-queimado grosso + extrusão para baixo (a espessura do ouro) + sombra no céu;
//   2. filete de bisel laranja com a "lateral" do ouro aparecendo embaixo;
//   3. face de ouro com verniz no alto (estática).
// O REFLEXO é uma faixa que só anda com `transform` (compositor, sem repintar o texto): uma janela inclinada
// com overflow:hidden atravessa a palavra e, dentro dela, uma 4ª cópia das letras em branco anda ao
// contrário na mesma medida, então fica parada sobre a face e só aparece onde a janela passa — o brilho
// fica recortado na forma exata das letras (antes eram 10 letras animando background-position).
// Embaixo, o selo "PIX" em esmalte verde com aro de ouro, ladeado pelas 4 gemas de raridade (de B).
// Entrada (CSS, roda antes da hidratação): as letras caem uma a uma com squash ao tocar o arco, o clarão
// abre, o selo estoura e as gemas acendem do comum ao lendário. Vida: o logo flutua, o reflexo passa a
// cada ~5 s, o selo cintila e as gemas brilham em sequência. Cada letra é UM span (arco em translate/rotate,
// queda e pulo em transform), nas 4 camadas.
// Toque: o logo "quica" (squash & stretch), as letras pulam em cascata e soltam estalinhos (de C).
import { useAnimate } from 'motion/react';
import { useCallback, useState, type CSSProperties } from 'react';
import type { Raridade } from '@galinheiro/game-core';
import { Gemas } from '../../../arte/Icones';
import { useReduzirMovimento } from '../../../Provedores';
import { desbloquearAudio, som } from '../../../som';
import { Estrela } from './arte';

const LETRAS = 'Galinheiro'.split('');
const N = LETRAS.length;
const MEIO = (N - 1) / 2;
const CAMADAS = ['base', 'bisel', 'face'] as const;

function Letras() {
  return (
    <>
      {LETRAS.map((l, i) => {
        const d = (i - MEIO) / MEIO;
        return (
          <span key={i} className="ca-letra" style={{ '--i': i, '--arco-y': `${(d * d * 0.17).toFixed(3)}em`, '--arco-r': `${(d * 7).toFixed(1)}deg` } as CSSProperties}>
            {l}
          </span>
        );
      })}
    </>
  );
}
const GEMAS_ESQ: Raridade[] = ['comum', 'raro'];
const GEMAS_DIR: Raridade[] = ['epico', 'lendario'];

// estalinhos do toque: [ângulo em graus, distância px, escala]
const ESTALOS: [number, number, number][] = [
  [-165, 130, 0.9],
  [-125, 104, 1.1],
  [-75, 116, 0.8],
  [-20, 128, 1],
  [15, 104, 0.7],
  [170, 112, 0.8],
];

function Gema({ r, n }: { r: Raridade; n: number }) {
  return (
    <span className={`ca-gema ca-gema-${r}`} style={{ '--n': n } as CSSProperties}>
      <Gemas quantidade={1} cor="" raridade={r} tamanho={14} className="ca-gema-svg" />
    </span>
  );
}

export function LogoA() {
  const reduzir = useReduzirMovimento();
  const [escopo, animar] = useAnimate<HTMLDivElement>();
  const [rajada, setRajada] = useState(0);

  const quicar = useCallback(() => {
    desbloquearAudio();
    som.pop(2);
    window.setTimeout(() => som.pop(7), 110);
    if (reduzir || !escopo.current) return;
    setRajada((r) => r + 1);
    const corpo = escopo.current.querySelector('.ca-logo-corpo');
    if (corpo)
      void animar(
        corpo,
        { scaleY: [1, 0.72, 1.14, 0.95, 1.03, 1], scaleX: [1, 1.15, 0.92, 1.04, 0.99, 1], y: [0, 8, -22, 0, -4, 0] },
        { duration: 0.7, times: [0, 0.14, 0.4, 0.64, 0.82, 1], ease: 'easeOut' },
      );
    escopo.current.querySelectorAll('.ca-letra').forEach((el, k) => {
      const i = k % N;
      void animar(el, { y: [0, -14, 0], rotate: [0, i % 2 ? 6 : -6, 0] }, { duration: 0.42, delay: 0.12 + i * 0.035, ease: 'easeOut' });
    });
    const selo = escopo.current.querySelector('.ca-selo');
    if (selo) void animar(selo, { scale: [1, 1.18, 0.96, 1], rotate: [-3, 4, -5, -3] }, { duration: 0.5, delay: 0.18, ease: 'easeOut' });
  }, [animar, escopo, reduzir]);

  return (
    <div ref={escopo} className="ca-logo" onPointerDown={quicar}>
      {/* clarão do impacto (abre quando a última letra assenta) */}
      <span className="ca-logo-clarao" aria-hidden />
      <span className="ca-logo-halo" aria-hidden />
      <div className="ca-logo-flutua">
        <div className="ca-logo-corpo">
          <h1 className="ca-titulo">
            <span className="sr-only">Galinheiro PIX</span>
            <span className="ca-palavra" aria-hidden>
              {CAMADAS.map((c) => (
                <span key={c} className={`ca-palavra-camada ca-l-${c}`}>
                  <Letras />
                </span>
              ))}
              <span className="ca-brilho-janela">
                <span className="ca-l-brilho">
                  <Letras />
                </span>
              </span>
            </span>
          </h1>
          <div className="ca-selo-caixa" aria-hidden>
            <span className="ca-gemas ca-gemas-esq">
              {GEMAS_ESQ.map((r, n) => (
                <Gema key={r} r={r} n={n} />
              ))}
            </span>
            <span className="ca-selo">
              <span className="ca-selo-aro">
                <span className="ca-selo-esmalte">
                  <span className="ca-selo-texto">PIX</span>
                  <span className="ca-selo-reflexo" />
                </span>
              </span>
            </span>
            <span className="ca-gemas ca-gemas-dir">
              {GEMAS_DIR.map((r, n) => (
                <Gema key={r} r={r} n={n + 2} />
              ))}
            </span>
            <span className="ca-selo-cintila ca-selo-cintila-1">
              <Estrela />
            </span>
            <span className="ca-selo-cintila ca-selo-cintila-2">
              <Estrela cor="#ffe27a" />
            </span>
          </div>
        </div>
      </div>
      {rajada > 0 && (
        <span key={rajada} className="ca-estalos" aria-hidden>
          {ESTALOS.map(([a, d, s], i) => (
            <span
              key={i}
              className="ca-estalo"
              style={
                {
                  '--dx': `${(Math.cos((a * Math.PI) / 180) * d).toFixed(1)}px`,
                  '--dy': `${(Math.sin((a * Math.PI) / 180) * d * 0.6).toFixed(1)}px`,
                  '--s': s,
                } as CSSProperties
              }
            >
              <Estrela cor={i % 2 ? '#ffe58a' : '#fffbe0'} />
            </span>
          ))}
        </span>
      )}
      {/* o lema fica fora da caixa medida (absoluto, logo abaixo do selo), numa pílula translúcida (de C);
          some em telas baixas e com o formulário aberto (CSS) */}
      <p className="ca-lema">
        <span className="ca-lema-pilula">Colete ovos, gire a roleta, colecione animais.</span>
      </p>
    </div>
  );
}

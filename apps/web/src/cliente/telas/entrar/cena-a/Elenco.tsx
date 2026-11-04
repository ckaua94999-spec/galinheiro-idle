'use client';

// Elenco da abertura. No celular, composição em pirâmide (não em fila): Seu Juca no alto do fardo de feno,
// a avestruz lendária num pedestal de pedra à direita com aura dourada e facho de luz, o ganso mais ao fundo
// à esquerda, galinha e pato na frente. No desktop (≥ 1024 px) o elenco abre em DUAS ALAS dos lados do
// painel (ideia da variante C), em primeiro plano: Juca no fardo com o ganso e a galinha à esquerda, a
// avestruz no pedestal com o pato à direita (o pato do lado de dentro, longe da pedra).
// Cada ala é um contêiner (.ca-ala): no celular é `display: contents` (as posições --x-e/--b-e/--t-e são em
// cqw do palco inteiro); no desktop vira uma caixa com container-type própria, do tamanho
// min(espaço ao lado do painel, ~52% da altura), e as posições --x-l/--b-l/--t-l são em cqw DA ALA — o
// elenco escala com min(largura, altura) e nunca encosta no painel nem sai pelo pé da tela.
//
// Entrada (CSS, roda já no HTML do servidor): o fardo cai, o Juca salta para ele e as aves brotam do capim
// em ESCALADA DE RARIDADE (ideia da variante B): comum → raro → épico → lendário, cada uma com um clarão na
// cor da raridade; a avestruz, por último, solta uma onda de choque dourada.
// Vida (CSS, ritmos primos entre si): galinha CISCA (com poeirinha), pato REBOLA e grasna (ondinhas de som,
// de C), ganso faz a POSE altiva com grasnado, avestruz se PAVONEIA (empina o peito, dá passinhos e
// pulinhos, sem espelhar o desenho: a luz continua vindo da esquerda) com a aura acendendo; o Juca balança
// no fardo, sorri de vez em quando e FALA sozinho num balão (de B) a cada ~10 s.
// Toque: pulo com squash & stretch próprio da espécie, cara de susto, voz (som.voz), onomatopeia que salta
// ("Cocó!", "Quack!", "Honk!", "Bum-bum!", de B), penas da cor da espécie (de C) e estrelinhas na cor da
// raridade; o Juca responde num balão.
import type { Tipo } from '@galinheiro/game-core';
import { useAnimate } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FiguraAnimal, type Humor } from '../../../arte/Animal';
import { Juca, type ExpressaoJuca } from '../../../arte/Juca';
import { useReduzirMovimento } from '../../../Provedores';
import { desbloquearAudio, som } from '../../../som';
import { Estrela, Fardo, Pedra, Pena, Tufo } from './arte';

type IdAtor = 'juca' | Tipo;

/** [centro horizontal (% do palco), base (cqw), lado da caixa (cqw)] */
type Ponto = [number, number, number];

// e = celular (% e cqw do palco); l = desktop (% e cqw da ala: esquerda = ganso/Juca/galinha, direita =
// pato/avestruz). No desktop o Juca pisa no fardo (fardo: base 1, largura 54 → topo ≈ 1 + 0,35 × 54) e a
// avestruz no pedestal (base 1, largura 50 → topo ≈ 1 + 0,34 × 50).
const LUGAR: Record<IdAtor, { e: Ponto; l: Ponto; z: number }> = {
  ganso: { e: [17, 10, 29], l: [21, 6, 40], z: 1 },
  avestruz: { e: [81, 10.2, 36], l: [63, 18, 58], z: 1 },
  juca: { e: [49, 14, 44], l: [53, 19.6, 56], z: 3 },
  galinha: { e: [28, -4, 27], l: [84, 0, 32], z: 4 },
  pato: { e: [68.5, -5, 26], l: [19, 0, 32], z: 4 },
};

// cores da raridade (clarão da entrada e estrelinhas do toque); o Juca, laranja
const COR: Record<IdAtor, [string, string]> = {
  galinha: ['#fff6e0', '#e8dccb'],
  pato: ['#c2deff', '#46a8ff'],
  ganso: ['#e4d6ff', '#a27dff'],
  avestruz: ['#fff1a8', '#ffc93c'],
  juca: ['#ffd36b', '#ff7a3a'],
};

// penas da cor da espécie (de C): [preenchimento, contorno]
const PENAS: Record<IdAtor, [string, string]> = {
  galinha: ['#fff6e8', '#8a6a4a'],
  pato: ['#eef7ff', '#1d5fd0'],
  ganso: ['#f4efff', '#5b2fc9'],
  avestruz: ['#f4ecff', '#5a3a8a'],
  juca: ['#ffb27a', '#5a1a10'],
};

// entrada: o Juca salta para o fardo, depois as aves brotam em escalada de raridade (a diva por último)
const ENTRADA: Record<IdAtor, number> = { juca: 0.4, galinha: 0.62, pato: 0.76, ganso: 0.9, avestruz: 1.02 };

/** Onomatopeia do toque (de B). */
const GRITO: Record<Tipo, string> = { galinha: 'Cocó!', pato: 'Quack!', ganso: 'Honk!', avestruz: 'Bum-bum!' };

// pulo do toque por espécie (tween: a mola só aceita 2 quadros)
type Pulo = { y: number[]; scaleX: number[]; scaleY: number[]; rotate: number[] };
const PULO: Record<IdAtor, Pulo> = {
  galinha: { y: [0, 3, -44, 0, -7, 0], scaleX: [1, 1.18, 0.9, 1.12, 0.98, 1], scaleY: [1, 0.78, 1.14, 0.86, 1.04, 1], rotate: [0, 0, -6, 4, 0, 0] },
  pato: { y: [0, 2, -30, 0, -5, 0], scaleX: [1, 1.14, 0.94, 1.1, 1, 1], scaleY: [1, 0.82, 1.08, 0.9, 1.02, 1], rotate: [0, -8, 10, -10, 6, 0] },
  ganso: { y: [0, 3, -26, 0, -4, 0], scaleX: [1, 1.12, 0.84, 1.08, 0.98, 1], scaleY: [1, 0.84, 1.26, 0.9, 1.05, 1], rotate: [0, 0, -4, 2, 0, 0] },
  avestruz: { y: [0, 5, -58, 0, -10, 0], scaleX: [1, 1.14, 0.9, 1.12, 0.98, 1], scaleY: [1, 0.8, 1.12, 0.86, 1.04, 1], rotate: [0, 2, -7, 5, -2, 0] },
  juca: { y: [0, 3, -40, 0, -6, 0], scaleX: [1, 1.14, 0.92, 1.1, 0.98, 1], scaleY: [1, 0.82, 1.1, 0.88, 1.03, 1], rotate: [0, -3, 4, -2, 0, 0] },
};
const TEMPO_PULO = { duration: 0.78, times: [0, 0.13, 0.42, 0.66, 0.82, 1], ease: 'easeOut' as const };

const estilo = (id: IdAtor): CSSProperties => {
  const { e, l, z } = LUGAR[id];
  return {
    '--x-e': `${e[0]}%`,
    '--b-e': `${e[1]}cqw`,
    '--t-e': `${e[2]}cqw`,
    '--x-l': `${l[0]}%`,
    '--b-l': `${l[1]}cqw`,
    '--t-l': `${l[2]}cqw`,
    '--entra': `${ENTRADA[id]}s`,
    '--cor-rar': COR[id][1],
    zIndex: z,
  } as CSSProperties;
};

/** Estouro do toque: 8 estrelinhas + 6 penas da espécie, em leque; some sozinho. */
function Estouro({ id }: { id: IdAtor }) {
  const cores = COR[id];
  const [pena, contornoPena] = PENAS[id];
  return (
    <span className="ca-estouro" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="ca-faisca" style={{ '--ang': `${i * 45 - 80}deg`, '--dist': `${46 + (i % 3) * 12}px` } as CSSProperties}>
          <Estrela cor={cores[i % 2]} />
        </span>
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={`p${i}`}
          className="ca-pena"
          style={{ '--ang': `${i * 60 - 150}deg`, '--dist': `${40 + (i % 2) * 18}px`, '--giro': `${i % 2 ? 200 : -180}deg`, '--d': `${(i * 0.03).toFixed(2)}s` } as CSSProperties}
        >
          <Pena cor={pena} contorno={contornoPena} />
        </span>
      ))}
    </span>
  );
}

function useTemporizador() {
  const lista = useRef<number[]>([]);
  useEffect(() => () => lista.current.forEach((t) => window.clearTimeout(t)), []);
  return useCallback((fn: () => void, ms: number) => {
    lista.current.push(window.setTimeout(fn, ms));
  }, []);
}

/** Um ator tocável: entrada (CSS), ação contínua da espécie (CSS), reação ao toque (motion) e sombra própria. */
function Ator({ id, children, extraTras, extraFrente, aoTocar }: { id: IdAtor; children: ReactNode; extraTras?: ReactNode; extraFrente?: ReactNode; aoTocar: () => void }) {
  const reduzir = useReduzirMovimento();
  const [escopo, animar] = useAnimate<HTMLSpanElement>();
  const [estouros, setEstouros] = useState<number[]>([]);
  const prox = useRef(0);
  const depois = useTemporizador();

  const tocar = useCallback(() => {
    aoTocar();
    if (reduzir || !escopo.current) return;
    const n = ++prox.current;
    setEstouros((e) => [...e.slice(-1), n]);
    depois(() => setEstouros((e) => e.filter((x) => x !== n)), 1100);
    const corpo = escopo.current.querySelector('.ca-ator-reage');
    const sombra = escopo.current.querySelector('.ca-ator-sombra-reage');
    if (corpo) void animar(corpo, PULO[id], TEMPO_PULO);
    if (sombra) void animar(sombra, { scale: [1, 1.12, 0.55, 1.1, 0.92, 1], opacity: [1, 1, 0.45, 1, 0.85, 1] }, TEMPO_PULO);
  }, [aoTocar, animar, depois, escopo, id, reduzir]);

  return (
    <span ref={escopo} className={`ca-ator ca-ator-${id}`} style={estilo(id)}>
      {id !== 'juca' && <span className="ca-ator-clarao" aria-hidden />}
      <span className="ca-ator-entra">
        {extraTras}
        <span className="ca-ator-sombra">
          <span className="ca-ator-sombra-reage" />
        </span>
        <span className="ca-ator-acao">
          <span className="ca-ator-reage" onPointerDown={tocar}>
            {children}
          </span>
        </span>
        {extraFrente}
        {estouros.map((n) => (
          <Estouro key={n} id={id} />
        ))}
      </span>
    </span>
  );
}

/** Ave com humor que vira "surpresa" por um instante quando tocada, e a onomatopeia que salta. */
function Ave({ tipo, atrasoS, extraTras, extraFrente }: { tipo: Tipo; atrasoS: number; extraTras?: ReactNode; extraFrente?: ReactNode }) {
  const [humor, setHumor] = useState<Humor>('feliz');
  const [grito, setGrito] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const aoTocar = useCallback(() => {
    desbloquearAudio();
    som.voz(tipo);
    setHumor('surpresa');
    setGrito((g) => g + 1);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHumor('feliz'), 1000);
  }, [tipo]);
  return (
    <Ator
      id={tipo}
      aoTocar={aoTocar}
      extraTras={extraTras}
      extraFrente={
        <>
          {extraFrente}
          {grito > 0 && (
            <span key={grito} className="ca-grito" aria-hidden>
              {GRITO[tipo]}
            </span>
          )}
        </>
      }
    >
      <FiguraAnimal tipo={tipo} humor={humor} ninho={false} detalhe="g" atrasoS={atrasoS} />
    </Ator>
  );
}

/** Cocoricó do galo, montado com os tons que som.ts oferece (lá não há um som.galo(); a voz da galinha
 *  ficaria igual à da galinha do elenco): "co-co" curtos, "ri" subindo e o "cóóó" longo descendo. */
function cocorico() {
  som.toque();
  window.setTimeout(() => som.toque(), 120);
  window.setTimeout(() => som.abrir(), 250);
  window.setTimeout(() => som.girar(), 340);
  window.setTimeout(() => som.parar(), 640);
}

// falas do Seu Juca: sozinho (de B) e ao ser tocado (de C, ajustadas para o fim de tarde)
const FALAS = ['Bem-vindo ao meu galinheiro!', 'Qual raridade vai ser a sua?', 'Olha que belezura de coleção!', 'Tem até avestruz lendária!'];
const FALAS_TOQUE = ['Cocoricó!', 'Boa tarde!', 'Bora jogar?', 'Que pôr do sol!'];

function SeuJuca() {
  const [expressao, setExpressao] = useState<ExpressaoJuca>('piscando');
  const [fala, setFala] = useState<{ n: number; texto: string } | null>(null);
  const contador = useRef(0);
  const toque = useRef(0);
  const ocupado = useRef(false);
  const depois = useTemporizador();

  // vida no rosto e na voz: fala sozinho num balão, depois sorri de olhinhos fechados, e repete (~10 s)
  useEffect(() => {
    let vivo = true;
    let t = 0;
    let i = 0;
    const passo = (fn: () => void, ms: number) => {
      t = window.setTimeout(() => vivo && fn(), ms);
    };
    const falar = () => {
      if (ocupado.current) return passo(falar, 2400);
      const n = contador.current++;
      setFala({ n, texto: FALAS[i++ % FALAS.length]! });
      setExpressao('falando');
      passo(() => {
        if (!ocupado.current) {
          setFala((f) => (f && f.n === n ? null : f));
          setExpressao('piscando');
        }
        passo(() => {
          if (!ocupado.current) setExpressao('feliz');
          passo(() => {
            if (!ocupado.current) setExpressao('piscando');
            passo(falar, 2700);
          }, 1500);
        }, 3000);
      }, 2900);
    };
    passo(falar, 2300);
    return () => {
      vivo = false;
      window.clearTimeout(t);
    };
  }, []);

  const aoTocar = useCallback(() => {
    desbloquearAudio();
    cocorico();
    ocupado.current = true;
    const marca = ++toque.current;
    const n = contador.current++;
    setExpressao('surpreso');
    setFala({ n, texto: FALAS_TOQUE[marca % FALAS_TOQUE.length]! });
    depois(() => toque.current === marca && setExpressao('falando'), 420);
    depois(() => {
      if (toque.current !== marca) return;
      setExpressao('piscando');
      setFala((f) => (f && f.n === n ? null : f));
      ocupado.current = false;
    }, 2100);
  }, [depois]);

  return (
    <Ator
      id="juca"
      aoTocar={aoTocar}
      extraFrente={
        fala && (
          <span key={fala.n} className="ca-balao" aria-hidden>
            {fala.texto}
          </span>
        )
      }
    >
      <Juca expressao={expressao} acenando sombra />
    </Ator>
  );
}

/** Aura da lendária: brilho que pulsa, raios girando, facho de luz de cima e 2 cintilas defasadas. */
function AuraLendaria() {
  return (
    <span className="ca-aura" aria-hidden>
      <span className="ca-aura-facho" />
      <span className="ca-aura-luz" />
      <span className="ca-aura-raios" />
      {[0, 1].map((i) => (
        <span key={i} className={`ca-aura-cintila ca-aura-cintila-${i}`}>
          <Estrela cor={i % 2 ? '#fff1a8' : '#ffd84d'} />
        </span>
      ))}
    </span>
  );
}

/** Risquinhos do grasnado do ganso (aparecem na pose altiva). */
function Grasnado() {
  return (
    <svg className="ca-grasnado" viewBox="0 0 30 30" aria-hidden>
      <path d="M22 6L28 1M22 14H30M22 22L28 27" stroke="#4a4570" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Ondinhas de som saindo do bico do pato (de C): as 3 ondas são fixas e o grupo anima (1 animação). */
function Quack() {
  return (
    <span className="ca-quack" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

/** Poeirinha que sobe do chão quando a galinha cisca (o grupo anima, não cada nuvenzinha). */
function Poeirinha() {
  return (
    <span className="ca-poeirinha" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

export function Elenco() {
  return (
    <div className="ca-elenco" aria-hidden>
      <div className="ca-ala ca-ala-e">
        <Ave tipo="ganso" atrasoS={1.3} extraFrente={<Grasnado />} />
        <span className="ca-fardo">
          <Fardo />
        </span>
        <SeuJuca />
        <Ave tipo="galinha" atrasoS={2.2} extraTras={<Poeirinha />} />
        {/* capim na frente dos pés (o elenco "pisa" no campo, não flutua sobre ele) */}
        <span className="ca-capim-pe ca-capim-pe-1">
          <Tufo />
        </span>
        <span className="ca-capim-pe ca-capim-pe-3">
          <Tufo flor="#ff8ac0" />
        </span>
        <span className="ca-capim-pe ca-capim-pe-5">
          <Tufo flor="#c9a6ff" />
        </span>
      </div>
      <div className="ca-ala ca-ala-d">
        <span className="ca-pedestal">
          <Pedra />
        </span>
        <Ave tipo="avestruz" atrasoS={0.4} extraTras={<AuraLendaria />} extraFrente={<span className="ca-onda-choque" />} />
        <Ave tipo="pato" atrasoS={0.9} extraFrente={<Quack />} />
        <span className="ca-capim-pe ca-capim-pe-2">
          <Tufo flor="#ffffff" />
        </span>
        <span className="ca-capim-pe ca-capim-pe-4">
          <Tufo flor="#ffd23f" />
        </span>
        <span className="ca-capim-pe ca-capim-pe-6">
          <Tufo />
        </span>
      </div>
    </div>
  );
}

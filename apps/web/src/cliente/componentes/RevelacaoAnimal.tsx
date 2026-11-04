'use client';

// Revelação do animal sorteado (DIRECAO_DE_ARTE 7.3), no estilo da abertura de baú do Clash Royale:
// o fundo escurece com raios na cor da raridade → o verso da carta chega e quica → treme em pancadas
// crescentes (rachaduras de luz; o lendário ainda ronca e solta faíscas) → explode em luz → vira mostrando a
// Carta → o selo da raridade entra com impacto → partículas/confete → campo de nome e botões.
// Tocar na tela (ou Enter/Esc) pula para o fim. Reduzir movimento: fade curto direto para a carta virada.
// Só transform/opacity; partículas em CSS (variáveis por item, ≤ 40 ao mesmo tempo); nada de filter.
import type { EntityDTO } from '@galinheiro/api-contract';
import { CONFIG, NOME_RARIDADE, NOME_TIPO, type Raridade } from '@galinheiro/game-core';
import { animate, AnimatePresence, motion, type AnimationPlaybackControls, type DOMKeyframesDefinition, type AnimationOptions } from 'motion/react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useReduzirMovimento } from '../Provedores';
import { som } from '../som';
import { cx } from '../util';
import { vibracao } from '../vibracao';
import { Carta, VersoCarta } from './Carta';

type Curva = [number, number, number, number];
const EASE_SUAVE: Curva = [0.22, 1, 0.36, 1];
const EASE_EXPLOSAO: Curva = [0.16, 1, 0.3, 1];
const EASE_FLIP: Curva = [0.5, 0, 0.2, 1];
const EASE_CHEGADA: Curva = [0.2, 0.85, 0.35, 1];

type Fase = 'chegada' | 'tremor' | 'explosao' | 'revelada' | 'fim';
const ORDEM: Record<Fase, number> = { chegada: 0, tremor: 1, explosao: 2, revelada: 3, fim: 4 };

/** Intensidade por raridade: quanto mais rara, mais suspense, luz e festa. */
interface Ritmo {
  pancadas: number;
  /** amplitude da última pancada, em graus */
  amp: number;
  /** pausa depois de cada pancada (encurta: o suspense acelera) */
  intervalos: number[];
  /** tremedeira contínua antes de estourar (ms; só lendário) */
  ronco: number;
  /** pausa entre a chegada e a 1ª pancada */
  pausa: number;
  flip: number;
  raios: number;
  /** partículas no estouro / no fim do flip / confete / faíscas por pancada */
  estouro: number;
  virada: number;
  confete: number;
  faiscas: number;
  /** faíscas em volta do selo quando ele pousa */
  selo: number;
  clarao: number;
  tremida: number;
  /** quanto o selo fica sozinho antes do formulário */
  antesDoFim: number;
}

const RITMO: Record<Raridade, Ritmo> = {
  comum: { pancadas: 1, amp: 5, intervalos: [120], ronco: 0, pausa: 80, flip: 0.42, raios: 0.5, estouro: 10, virada: 8, confete: 8, faiscas: 0, selo: 4, clarao: 0.6, tremida: 3, antesDoFim: 200 },
  raro: { pancadas: 2, amp: 7, intervalos: [160, 120], ronco: 0, pausa: 100, flip: 0.45, raios: 0.65, estouro: 14, virada: 10, confete: 12, faiscas: 0, selo: 6, clarao: 0.75, tremida: 4, antesDoFim: 240 },
  epico: { pancadas: 3, amp: 10, intervalos: [180, 140, 100], ronco: 0, pausa: 120, flip: 0.5, raios: 0.8, estouro: 16, virada: 10, confete: 18, faiscas: 4, selo: 8, clarao: 0.85, tremida: 5, antesDoFim: 280 },
  lendario: { pancadas: 3, amp: 14, intervalos: [160, 120, 80], ronco: 360, pausa: 140, flip: 0.6, raios: 0.9, estouro: 16, virada: 8, confete: 24, faiscas: 6, selo: 6, clarao: 0.92, tremida: 7, antesDoFim: 300 },
};
/** Opacidade dos raios no fim (mais festa enquanto o jogador dá o nome). */
const raiosFim = (r: Ritmo) => Math.min(1, r.raios + 0.15);

/** Teto de partículas vivas ao mesmo tempo (orçamento de desempenho). */
const TETO_PARTICULAS = 40;
/** Vida máxima de cada tipo de partícula (duração + atraso máximos, em ms). */
const VIDA: Record<TipoRajada, number> = { faisca: 760, estouro: 900, virada: 1120, selo: 900, confete: 2600 };

const SELO: Record<Raridade, string> = { comum: 'COMUM', raro: 'RARO!', epico: 'ÉPICO!!', lendario: 'LENDÁRIO!!!' };

const CORES_CONFETE: Record<Raridade, string[]> = {
  comum: ['#ffffff', '#dfe5ec', '#fff1a8', '#c9d1db'],
  raro: ['#6fb6ff', '#c2deff', '#ffffff', '#46a8ff'],
  epico: ['#b48cff', '#e4d6ff', '#ff8ad8', '#ffffff', '#8b5cf6'],
  lendario: ['#ffd23f', '#ff8ad8', '#8ad8ff', '#9dffb0', '#fff1a8', '#f5b301'],
};

// Rachaduras no verso (viewBox da carta: 100 × 132). Fissuras curtas que irradiam do ovo do emblema (centro
// ~50,63; o anel do emblema tem raio ~23 e a faixa "Galinheiro" começa em y ≈ 87, que elas nunca cruzam).
// Uma por pancada, cada uma mais longa; o ronco do lendário abre as 2 últimas (as mais compridas).
type Ponto = [number, number];
interface DesenhoRacha {
  tronco: Ponto[];
  ramos: Ponto[][];
  /** lascas de luz nas junções: [x, y, tamanho, ângulo] */
  lascas: [number, number, number, number][];
}
const DESENHO_RACHAS: DesenhoRacha[] = [
  // 1ª pancada: curta, para cima-esquerda
  { tronco: [[48, 59], [45, 54.5], [46.2, 50.6], [42, 46]], ramos: [[[45, 54.5], [41.2, 53.4]]], lascas: [[46.2, 50.6, 1.4, 30]] },
  // 2ª: para a direita, descendo
  {
    tronco: [[54, 64.2], [58.8, 62.6], [61.6, 66.8], [67.4, 67.6], [71.2, 72]],
    ramos: [[[61.6, 66.8], [63, 71.4]]],
    lascas: [[58.8, 62.6, 1.3, -20], [67.4, 67.6, 1.6, 50]],
  },
  // 3ª: para cima-direita, a mais longa das pancadas
  {
    tronco: [[52.8, 58.6], [56.4, 53.6], [55.2, 49.2], [60, 44.6], [62.6, 38.4]],
    ramos: [[[55.2, 49.2], [51.6, 45.6]], [[60, 44.6], [64.6, 44.8]]],
    lascas: [[56.4, 53.6, 1.5, 10], [60, 44.6, 1.2, -60]],
  },
  // ronco do lendário: para a esquerda, escapando do anel
  {
    tronco: [[46, 65.6], [41.2, 67], [38.6, 63.8], [32.2, 66.4], [27.4, 63.8], [21.6, 66.6]],
    ramos: [[[32.2, 66.4], [30.4, 71]], [[38.6, 63.8], [36.8, 59.6]]],
    lascas: [[41.2, 67, 1.5, 70], [32.2, 66.4, 1.7, -30]],
  },
  // ronco do lendário: para baixo-esquerda, parando antes da faixa
  {
    tronco: [[48.6, 68.2], [45.6, 73.2], [47.4, 76.8], [42.8, 80.2], [38.4, 82.6]],
    ramos: [[[47.4, 76.8], [51.4, 80.6]]],
    lascas: [[45.6, 73.2, 1.3, 15], [42.8, 80.2, 1.5, -45]],
  },
];

/** Faixa afunilada ao longo de uma polilinha (largura w0 → w1), como path preenchido: racha de verdade, não traço de caneta. */
function faixa(pts: Ponto[], w0: number, w1: number): string {
  const n = pts.length;
  const acum = [0];
  for (let i = 1; i < n; i++) acum.push(acum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const total = acum[n - 1] || 1;
  const esq: string[] = [];
  const dir: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(n - 1, i + 1)]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    const w = (w0 + (w1 - w0) * (acum[i]! / total)) / 2;
    const [x, y] = pts[i]!;
    esq.push(`${(x + nx * w).toFixed(2)} ${(y + ny * w).toFixed(2)}`);
    dir.push(`${(x - nx * w).toFixed(2)} ${(y - ny * w).toFixed(2)}`);
  }
  return `M${esq.join(' L')} L${dir.reverse().join(' L')}Z`;
}

/** Triângulo de luz (lasca) centrado em x,y. */
function lasca([x, y, t, ang]: [number, number, number, number]): string {
  const r = (ang * Math.PI) / 180;
  const p = [0, 2.1, 4.2].map((k) => {
    const a = r + k + (k ? 0.35 : 0);
    const d = k ? t * 0.7 : t;
    return `${(x + Math.cos(a) * d).toFixed(2)} ${(y + Math.sin(a) * d).toFixed(2)}`;
  });
  return `M${p.join(' L')}Z`;
}

// Camadas por racha: aura suave de luz vazando, borda escura (o "corte"), luz na cor da raridade e miolo branco; ramos mais finos.
const RACHAS = DESENHO_RACHAS.map(({ tronco, ramos, lascas }) => {
  const camada = (w0: number, w1: number) => [faixa(tronco, w0, w1), ...ramos.map((r) => faixa(r, w0 * 0.6, w1))].join(' ');
  return { aura: camada(5.2, 1.4), borda: camada(2.6, 0.5), luz: camada(1.7, 0.3), miolo: camada(0.7, 0.08), lascas: lascas.map(lasca).join(' ') };
});

// ---------------------------------------------------------------- partículas

/** Sorteio estável (mesma carta → mesmas partículas, sem pular entre renders). */
function aleatorio(semente: string) {
  let h = 2166136261;
  for (let i = 0; i < semente.length; i++) h = Math.imul(h ^ semente.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type TipoRajada = 'faisca' | 'estouro' | 'virada' | 'confete' | 'selo';
interface Rajada {
  id: number;
  tipo: TipoRajada;
  n: number;
  /** performance.now() do disparo (para saber quem ainda está vivo) */
  nasceu: number;
}

/** Estilo de cada partícula de uma rajada (variáveis lidas pelos keyframes em revelacao.css). */
function particulas(r: Rajada, raridade: Raridade): { estilo: CSSProperties; forma: string }[] {
  const rnd = aleatorio(`${r.tipo}-${r.id}`);
  const cores = CORES_CONFETE[raridade];
  return Array.from({ length: r.n }, (_, i) => {
    const giro = (i / r.n) * Math.PI * 2 + (rnd() - 0.5) * 0.6;
    if (r.tipo === 'confete') {
      // sai da borda de cima da carta (não do meio da arte), sobe e cai por cima de tudo
      const x0 = (rnd() - 0.5) * 220;
      const dx = (rnd() - 0.5) * 300;
      return {
        forma: 'confete',
        estilo: {
          '--x0': `${x0.toFixed(0)}px`,
          '--y0': `${(-185 - rnd() * 20).toFixed(0)}px`,
          '--dx': `${dx.toFixed(0)}px`,
          '--sobe': `${(-110 - rnd() * 150).toFixed(0)}px`,
          '--desce': `${(560 + rnd() * 260).toFixed(0)}px`,
          '--rot': `${((rnd() - 0.5) * 900).toFixed(0)}deg`,
          '--dur': `${(1500 + rnd() * 900).toFixed(0)}ms`,
          '--atraso': `${(rnd() * 180).toFixed(0)}ms`,
          '--c': cores[i % cores.length],
          '--l': `${(6 + rnd() * 4).toFixed(1)}px`,
        } as CSSProperties,
      };
    }
    // faísca: escapa das rachaduras; estouro: anel grande; selo: em volta do título;
    // virada: nasce na BORDA da carta (atrás dela) e se afasta, como luz vazando por trás
    const cos = Math.cos(giro);
    const sen = Math.sin(giro);
    let x0 = 0;
    let y0 = 0;
    if (r.tipo === 'virada') {
      const t = Math.min(150 / Math.max(Math.abs(cos), 1e-3), 200 / Math.max(Math.abs(sen), 1e-3)) * 0.94;
      x0 = cos * t;
      y0 = sen * t;
    } else if (r.tipo === 'estouro') {
      const t = 20 + rnd() * 50;
      x0 = cos * t;
      y0 = sen * t;
    }
    const raio = { faisca: 90, estouro: 230, virada: 90, selo: 120 }[r.tipo];
    const dist = raio * (0.55 + rnd() * 0.6);
    const tam = r.tipo === 'faisca' ? 8 + rnd() * 6 : r.tipo === 'selo' ? 9 + rnd() * 8 : r.tipo === 'virada' ? 15 + rnd() * 12 : 12 + rnd() * 14;
    return {
      // faíscas e estouro: riscos de luz (alongados na direção do voo) + estrelas; virada/selo: bolinhas e estrelas
      forma: i % 3 === 0 || (r.tipo === 'virada' && i % 2 === 0) ? 'estrela' : (r.tipo === 'faisca' || r.tipo === 'estouro') && i % 3 === 1 ? 'risco' : 'bola',
      estilo: {
        '--x0': `${x0.toFixed(0)}px`,
        '--y0': `${y0.toFixed(0)}px`,
        '--dx': `${(cos * dist * (r.tipo === 'virada' ? 0.6 : 1)).toFixed(0)}px`,
        '--dy': `${(sen * dist * (r.tipo === 'selo' ? 0.45 : 0.9) - (r.tipo === 'selo' || r.tipo === 'virada' ? 0 : 20)).toFixed(0)}px`,
        '--s': `${tam.toFixed(1)}px`,
        '--rot': `${((rnd() - 0.5) * 360).toFixed(0)}deg`,
        '--ang': `${((giro * 180) / Math.PI).toFixed(0)}deg`,
        '--dur': `${(r.tipo === 'faisca' ? 380 : r.tipo === 'virada' ? 700 : 520) + Math.round(rnd() * (r.tipo === 'virada' ? 360 : 320))}ms`,
        '--atraso': `${Math.round(rnd() * 60)}ms`,
      } as CSSProperties,
    };
  });
}

/** Em qual camada cada tipo aparece: atrás da carta (virada), na frente dela (centro) ou em volta do selo. */
const CAMADA: Record<TipoRajada, 'tras' | 'centro' | 'selo'> = { faisca: 'centro', estouro: 'centro', confete: 'centro', virada: 'tras', selo: 'selo' };

function Rajadas({ rajadas, raridade, tipo }: { rajadas: Rajada[]; raridade: Raridade; tipo: 'tras' | 'centro' | 'selo' }) {
  return (
    <div className="rev-fx" data-camada={tipo} aria-hidden>
      {rajadas
        .filter((r) => CAMADA[r.tipo] === tipo)
        .map((r) =>
          particulas(r, raridade).map((p, i) => (
            <span key={`${r.id}-${i}`} className={p.forma === 'confete' ? 'rev-confete' : 'rev-p'} data-forma={p.forma} style={p.estilo} />
          )),
        )}
    </div>
  );
}

// ---------------------------------------------------------------- selo da raridade

/** "RARO!" em tipografia contornada: camada de trás (traço + sombra chapada) e de frente (preenchimento metálico). */
function SeloRaridade({ raridade, curto, id }: { raridade: Raridade; curto: boolean; id: string }) {
  const texto = SELO[raridade];
  return (
    <motion.div
      className="rev-selo"
      initial={curto ? { opacity: 0 } : { opacity: 0, scale: 2.6, rotate: -14 }}
      animate={curto ? { opacity: 1 } : { opacity: [0, 1, 1], scale: [2.6, 0.9, 1], rotate: [-14, -2, -4] }}
      transition={curto ? { duration: 0.25 } : { duration: 0.42, times: [0, 0.6, 1], ease: ['easeIn', 'easeOut'] }}
    >
      {(raridade === 'epico' || raridade === 'lendario') && (
        <span className="rev-selo-estrelas" aria-hidden>
          <span />
          <span />
        </span>
      )}
      <h2 id={id} className="rev-selo-texto" aria-label={NOME_RARIDADE[raridade]}>
        <span className="rev-selo-traco" aria-hidden>
          {texto}
        </span>
        <span className="rev-selo-tinta" aria-hidden>
          {texto}
        </span>
      </h2>
    </motion.div>
  );
}

// ---------------------------------------------------------------- formulário do fim (nome e botões)

export interface PropsFormNome {
  nome: string;
  aoMudarNome: (nome: string) => void;
  erro: string | null;
  salvando?: boolean;
  /** destino '/galinheiro' = "Ver no galinheiro"; sem destino = "Continuar girando". */
  aoConfirmar: (destino?: string) => void;
}

/** Painel do fim da revelação: "Que tal dar um nome?" + "Ver no galinheiro" / "Continuar girando". */
export function FormNomeRevelacao({ nome, aoMudarNome, erro, salvando, aoConfirmar }: PropsFormNome) {
  return (
    <div className="painel rev-painel">
      <label className="rev-rotulo" htmlFor="nome-novo" data-rev-item style={{ '--i': 0 } as CSSProperties}>
        Que tal dar um nome?
      </label>
      <input
        id="nome-novo"
        className="campo rev-campo"
        data-rev-item
        style={{ '--i': 1 } as CSSProperties}
        value={nome}
        maxLength={CONFIG.nome.max + 5}
        onChange={(e) => aoMudarNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') aoConfirmar('/galinheiro');
        }}
        aria-invalid={!!erro}
        aria-describedby={erro ? 'nome-novo-erro' : undefined}
        autoComplete="off"
        data-autofoco
      />
      {erro && (
        <p id="nome-novo-erro" className="rev-erro" role="alert">
          {erro}
        </p>
      )}
      <div className="rev-botoes" data-rev-item style={{ '--i': 2 } as CSSProperties}>
        <button type="button" className="botao botao-primario" onClick={() => aoConfirmar('/galinheiro')} disabled={salvando}>
          {/* abaixo de 360 px o rótulo longo quebraria em 2 linhas: o CSS troca pelo curto (só um fica visível) */}
          <span className="rev-botao-longo">Ver no galinheiro</span>
          <span className="rev-botao-curto">Ver no ninho</span>
        </button>
        <button type="button" className="botao botao-secundario" onClick={() => aoConfirmar()} disabled={salvando}>
          <span className="rev-botao-longo">Continuar girando</span>
          <span className="rev-botao-curto">Girar de novo</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- revelação

export interface PropsRevelacao {
  /** Animal sorteado; null fecha (com fade). Um id novo recomeça a sequência. */
  entidade: EntityDTO | null;
  agora: number;
  /** Conteúdo do fim (campo de nome e botões); entra quando a carta termina de virar. */
  children?: ReactNode;
  /** Esc depois de revelado (o ModalResultado valida o nome e fecha). */
  aoEsc?: () => void;
  /** Força a versão curta (galeria). Padrão: preferência do jogador/sistema. */
  reduzir?: boolean;
  /** Rótulo para leitores de tela enquanto a carta vira (ex.: troca do Intercâmbio). */
  rotulo?: string;
}

export function RevelacaoAnimal({ entidade, agora, children, aoEsc, reduzir, rotulo = 'Revelando o animal sorteado' }: PropsRevelacao) {
  const reduzirPref = useReduzirMovimento();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;
  return createPortal(
    <AnimatePresence>
      {entidade && (
        <Sequencia key={entidade.id} e={entidade} agora={agora} aoEsc={aoEsc} curto={reduzir ?? reduzirPref} rotulo={rotulo}>
          {children}
        </Sequencia>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** A carta completa foi desenhada para 300 px: em telas baixas/estreitas ela encolhe inteira (zoom), sem espremer a arte. */
function useEscalaCarta(): number {
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const medir = () => {
      // altura livre = tela − (selo 88 + formulário ~200 + respiros ~52); a carta ocupa ~404 px de altura
      const s = Math.min(1, (window.innerWidth - 56) / 300, (window.innerHeight - 340) / 404);
      setEscala(Math.max(0.6, Math.round(s * 100) / 100));
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);
  return escala;
}

const FOCAVEIS = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function Sequencia({ e, agora, children, aoEsc, curto, rotulo }: {
  e: EntityDTO; agora: number; children?: ReactNode; aoEsc?: () => void; curto: boolean; rotulo: string;
}) {
  const { raridade } = e;
  const r = RITMO[raridade];
  const idTitulo = useId();
  const [fase, setFase] = useState<Fase>(curto ? 'fim' : 'chegada');
  const [pancadas, setPancadas] = useState(0);
  const [rajadas, setRajadas] = useState<Rajada[]>([]);
  const [entrada, setEntrada] = useState(curto);
  const escala = useEscalaCarta();

  const raiz = useRef<HTMLDivElement>(null);
  const sobe = useRef<HTMLDivElement>(null);
  const treme = useRef<HTMLDivElement>(null);
  const voo = useRef<HTMLDivElement>(null);
  const giro = useRef<HTMLDivElement>(null);
  const brilho = useRef<HTMLDivElement>(null);
  const halo = useRef<HTMLDivElement>(null);
  const raios = useRef<HTMLDivElement>(null);
  const anel = useRef<HTMLDivElement>(null);
  const clarao = useRef<HTMLDivElement>(null);
  const acoes = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLDivElement>(null);

  const controles = useRef(new Set<AnimationPlaybackControls>());
  const cancelado = useRef(false);
  const proxRajada = useRef(0);
  const vivas = useRef<Rajada[]>([]);

  /** Dispara uma rajada respeitando o teto: tira as mortas, descarta as mais antigas (não confete) e, se ainda faltar, corta n. */
  const rajada = useCallback((tipo: TipoRajada, n: number) => {
    if (n <= 0) return;
    const agoraMs = performance.now();
    const lista = vivas.current.filter((x) => agoraMs < x.nasceu + VIDA[x.tipo]);
    let soma = lista.reduce((s, x) => s + x.n, 0);
    while (soma + n > TETO_PARTICULAS) {
      const i = lista.findIndex((x) => x.tipo !== 'confete');
      if (i < 0) break;
      soma -= lista[i]!.n;
      lista.splice(i, 1);
    }
    const cabe = Math.min(n, TETO_PARTICULAS - soma);
    if (cabe > 0) lista.push({ id: ++proxRajada.current, tipo, n: cabe, nasceu: agoraMs });
    vivas.current = lista;
    setRajadas(lista.slice());
  }, []);

  /** Anima um elemento e registra o controle (para o "pular" parar tudo). */
  const anim = useCallback((el: HTMLElement | null, kf: DOMKeyframesDefinition, op: AnimationOptions) => {
    if (!el) return Promise.resolve();
    const c = animate(el, kf, op);
    controles.current.add(c);
    return c.then(() => {
      controles.current.delete(c);
    });
  }, []);

  const tremer = useCallback(
    (px: number, dur = 0.26) =>
      anim(treme.current, { x: [0, -px, px * 0.8, -px * 0.5, px * 0.3, 0], y: [0, px * 0.5, -px * 0.6, px * 0.3, 0, 0] }, { duration: dur, ease: 'linear' }),
    [anim],
  );

  // Desce o conjunto (selo + carta) para a carta ficar no centro da tela enquanto o formulário não aparece.
  const deslocamento = () => {
    const a = acoes.current;
    const t = titulo.current;
    return a && t ? Math.round((a.offsetHeight + 16 - t.offsetHeight) / 2) : 0;
  };

  // ---- linha do tempo
  useEffect(() => {
    if (curto) return;
    cancelado.current = false;
    let vivo = true;
    let tRonco: ReturnType<typeof setTimeout> | undefined;
    const ok = () => vivo && !cancelado.current;
    const desce = deslocamento();
    if (sobe.current) sobe.current.style.transform = `translateY(${desce}px)`;

    void (async () => {
      // 1. chegada: o verso sobe do pé da tela girando, pousa e quica (squash & stretch)
      void anim(raios.current, { opacity: [0, r.raios] }, { duration: 0.5, ease: 'easeOut' });
      void anim(halo.current, { opacity: [0, 0.4], scale: [0.6, 1] }, { duration: 0.5, ease: EASE_SUAVE });
      await anim(voo.current, { y: [620, 0], rotate: [-18, 0], scale: [0.45, 1] }, { duration: 0.38, ease: EASE_CHEGADA });
      if (!ok()) return;
      som.pop(-8);
      void tremer(3);
      await anim(
        voo.current,
        { scaleX: [1, 1.14, 0.95, 1], scaleY: [1, 0.84, 1.06, 1], y: [0, 8, -16, 0] },
        { duration: 0.32, times: [0, 0.22, 0.58, 1], ease: 'easeOut' },
      );
      if (!ok()) return;
      await esperar(r.pausa);
      if (!ok()) return;

      // 2. pancadas: cada uma mais forte, abre uma rachadura e a luz de dentro aumenta
      setFase('tremor');
      for (let i = 0; i < r.pancadas; i++) {
        const f = (i + 1) / r.pancadas;
        const amp = r.amp * (0.5 + 0.5 * f);
        const lado = i % 2 ? -1 : 1;
        setPancadas(i + 1);
        som.pop(i * 3);
        rajada('faisca', r.faiscas);
        void anim(brilho.current, { opacity: 0.18 + 0.42 * f }, { duration: 0.12 });
        void anim(halo.current, { scale: [1 + 0.08 * i, 1.22 + 0.1 * i, 1.06 + 0.08 * i], opacity: 0.45 + 0.3 * f }, { duration: 0.3, times: [0, 0.3, 1] });
        void tremer(1.5 + r.tremida * 0.4 * f, 0.22);
        await anim(
          voo.current,
          { rotate: [0, -amp * lado, amp * 0.7 * lado, -amp * 0.35 * lado, 0], scale: [1, 1.06 + 0.04 * f, 0.97, 1.01, 1] },
          { duration: 0.24, times: [0, 0.18, 0.45, 0.72, 1], ease: 'easeOut' },
        );
        if (!ok()) return;
        await esperar(r.intervalos[i] ?? 160);
        if (!ok()) return;
      }

      // 2b. ronco do lendário: vibra sem parar, abre mais rachaduras e solta faíscas
      if (r.ronco) {
        setPancadas(RACHAS.length);
        const passos = 14;
        const xs = Array.from({ length: passos + 1 }, (_, k) => (k === 0 || k === passos ? 0 : (k % 2 ? -1 : 1) * (2 + (k / passos) * 4)));
        const rs = xs.map((x) => x * 0.6);
        rajada('faisca', r.faiscas);
        tRonco = setTimeout(() => {
          if (ok()) rajada('faisca', r.faiscas);
        }, r.ronco / 2);
        void anim(brilho.current, { opacity: 0.88 }, { duration: r.ronco / 1000 });
        void anim(halo.current, { scale: 1.45, opacity: 0.95 }, { duration: r.ronco / 1000, ease: 'easeIn' });
        void anim(treme.current, { x: xs.map((x) => x * 0.5), y: xs.map((x) => -x * 0.3) }, { duration: r.ronco / 1000, ease: 'linear' });
        som.pop(9);
        await anim(voo.current, { x: xs, rotate: rs, scale: [1, 1.08] }, { duration: r.ronco / 1000, ease: 'linear' });
        if (!ok()) return;
      }

      // 3. explosão de luz: incha, clarão, onda de choque, estouro de partículas, e vira
      setFase('explosao');
      void anim(brilho.current, { opacity: 1 }, { duration: 0.12 });
      await anim(voo.current, { scale: 1.16, rotate: 0, x: 0 }, { duration: 0.1, ease: 'easeIn' });
      if (!ok()) return;
      som.pop(14);
      if (raridade === 'epico' || raridade === 'lendario') vibracao.jackpot();
      void anim(clarao.current, { opacity: [0, r.clarao, 0] }, { duration: 0.38, times: [0, 0.16, 1], ease: 'easeOut' });
      void anim(anel.current, { scale: [0.3, 3.2], opacity: [1, 0] }, { duration: 0.6, ease: EASE_EXPLOSAO });
      void anim(halo.current, { scale: 1.3, opacity: 0.85 }, { duration: 0.3, ease: EASE_SUAVE });
      rajada('estouro', r.estouro);
      void tremer(r.tremida, 0.32);
      await Promise.all([
        anim(giro.current, { rotateY: [-180, 0] }, { duration: r.flip, ease: EASE_FLIP }),
        anim(voo.current, { scale: [1.16, 1.26, 1] }, { duration: r.flip, times: [0, 0.5, 1], ease: 'easeInOut' }),
      ]);
      if (!ok()) return;

      // 4. revelada: bump, partículas, confete, voz do bicho e selo com impacto
      setFase('revelada');
      setEntrada(true);
      rajada('virada', r.virada);
      rajada('confete', r.confete);
      som.voz(e.tipo);
      if (raridade === 'lendario') som.jackpot();
      void anim(voo.current, { scale: [1, 1.08, 1] }, { duration: 0.24, times: [0, 0.35, 1], ease: 'easeOut' });
      void anim(halo.current, { scale: 1.12, opacity: 0.75 }, { duration: 0.5, ease: EASE_SUAVE });
      await esperar(220);
      if (!ok()) return;
      // o selo "pousa" (fim do pop de 420 ms): tremida e faíscas em volta
      som.abrir();
      void tremer(Math.max(3, r.tremida - 2));
      rajada('selo', r.selo);
      await esperar(r.antesDoFim);
      if (!ok()) return;

      // 5. fim: a carta sobe abrindo espaço para o nome e os botões; os raios ganham força
      setFase('fim');
      void anim(sobe.current, { y: [desce, 0] }, { type: 'spring', visualDuration: 0.4, bounce: 0.18 });
      void anim(raios.current, { opacity: raiosFim(r) }, { duration: 0.6, ease: 'easeOut' });
    })();

    return () => {
      vivo = false;
      clearTimeout(tRonco);
      controles.current.forEach((c) => c.stop());
      controles.current.clear();
    };
    // a sequência roda uma vez por carta (a Sequencia é recriada quando o id muda)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Tocar na tela: para tudo e pula direto para a carta virada. */
  const pular = useCallback(() => {
    if (curto || ORDEM[fase] >= ORDEM.fim || cancelado.current) return;
    cancelado.current = true;
    controles.current.forEach((c) => c.stop());
    controles.current.clear();
    const zera = (el: HTMLElement | null, kf: DOMKeyframesDefinition) => el && animate(el, kf, { duration: 0 });
    zera(voo.current, { x: 0, y: 0, rotate: 0, scale: 1, scaleX: 1, scaleY: 1 });
    zera(giro.current, { rotateY: 0 });
    zera(treme.current, { x: 0, y: 0 });
    zera(clarao.current, { opacity: 0 });
    zera(anel.current, { opacity: 0 });
    zera(halo.current, { opacity: 0.75, scale: 1.12 });
    zera(raios.current, { opacity: raiosFim(r) });
    vivas.current = [];
    setRajadas([]);
    setPancadas(0);
    setEntrada(true);
    if (ORDEM[fase] < ORDEM.revelada) {
      som.voz(e.tipo);
      rajada('confete', r.confete);
    }
    setFase('fim');
    const de = new DOMMatrixReadOnly(getComputedStyle(sobe.current ?? document.body).transform).m42;
    if (sobe.current) void animate(sobe.current, { y: [de, 0] }, { duration: 0.3, ease: EASE_SUAVE });
  }, [curto, fase, r, e.tipo, rajada]);

  // ---- foco: o diálogo ao abrir; o campo de nome quando o formulário aparece; devolve ao sair
  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    raiz.current?.focus({ preventScroll: true });
    return () => {
      if (anterior?.isConnected) anterior.focus({ preventScroll: true });
    };
  }, []);
  const fim = fase === 'fim';
  useEffect(() => {
    if (!fim) return;
    const t = setTimeout(() => {
      const alvo = acoes.current?.querySelector<HTMLElement>('[data-autofoco]') ?? raiz.current;
      alvo?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    }, curto ? 60 : 280);
    return () => clearTimeout(t);
  }, [fim, curto]);

  const tecla = (ev: React.KeyboardEvent) => {
    if (!fim) {
      if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        pular();
      }
      return;
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      aoEsc?.();
      return;
    }
    if (ev.key !== 'Tab' || !raiz.current) return;
    // foco preso no diálogo
    const lista = [...raiz.current.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => el.getClientRects().length > 0);
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    if (!primeiro || !ultimo) return;
    if (ev.shiftKey && (document.activeElement === primeiro || document.activeElement === raiz.current)) {
      ev.preventDefault();
      ultimo.focus();
    } else if (!ev.shiftKey && document.activeElement === ultimo) {
      ev.preventDefault();
      primeiro.focus();
    }
  };

  const revelada = ORDEM[fase] >= ORDEM.revelada;
  // estilos iniciais constantes (o motion assume depois; não podem mudar entre renders)
  const inicial = useMemo(
    () =>
      curto
        ? { voo: undefined, giro: undefined, opaco: undefined, raios: { opacity: raiosFim(RITMO[raridade]) } as CSSProperties, halo: { opacity: 0.75 } as CSSProperties }
        : {
            voo: { transform: 'translateY(620px) scale(0.45)' } as CSSProperties,
            giro: { transform: 'rotateY(-180deg)' } as CSSProperties,
            opaco: { opacity: 0 } as CSSProperties,
            raios: { opacity: 0 } as CSSProperties,
            halo: { opacity: 0 } as CSSProperties,
          },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <motion.div
      ref={raiz}
      className="rev"
      data-raridade={raridade}
      data-fase={fase}
      data-curto={curto ? '' : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={revelada ? idTitulo : undefined}
      aria-label={revelada ? undefined : rotulo}
      tabIndex={-1}
      onPointerDown={pular}
      onKeyDown={tecla}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: curto ? 0.25 : 0.2 } }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
    >
      <div className="rev-fundo" aria-hidden />
      <p className="sr-only" aria-live="assertive">
        {revelada ? `Você ganhou ${e.nome}: ${NOME_TIPO[e.tipo]}, ${NOME_RARIDADE[raridade]}!` : ''}
      </p>

      <div className="rev-cena">
        <div ref={sobe} className="rev-sobe">
          <div ref={treme} className="rev-treme">
            <div ref={titulo} className="rev-titulo">
              {revelada && <SeloRaridade raridade={raridade} curto={curto} id={idTitulo} />}
              {!curto && <Rajadas rajadas={rajadas} raridade={raridade} tipo="selo" />}
            </div>

            <div className="rev-carta" style={escala < 1 ? { zoom: escala } : undefined}>
              <div ref={raios} className="rev-raios" style={inicial.raios} aria-hidden>
                <span />
                {(raridade === 'epico' || raridade === 'lendario') && <span className="rev-raios-2" />}
              </div>
              <div ref={halo} className="rev-halo" style={inicial.halo} aria-hidden />
              {!curto && <div ref={anel} className="rev-anel" style={inicial.opaco} aria-hidden />}
              {!curto && <Rajadas rajadas={rajadas} raridade={raridade} tipo="tras" />}

              <div ref={voo} className="rev-voo" style={inicial.voo}>
                <div ref={giro} className="rev-giro" style={inicial.giro}>
                  <div className="rev-face rev-frente" aria-hidden={!revelada}>
                    {/* animal novo chega "pronto", mas a carta da revelação mostra só a raridade: sem anel verde nem selo */}
                    <Carta e={e} agora={agora} entrada={entrada} semSelo semAnel />
                  </div>
                  {!curto && (
                    <div className="rev-face rev-verso" aria-hidden>
                      <VersoCarta raridade={raridade} />
                      <div ref={brilho} className="rev-brilho" data-raridade={raridade} style={inicial.opaco} />
                      <svg className="rev-rachas" viewBox="0 0 100 132" aria-hidden>
                        {RACHAS.slice(0, pancadas).map((k, i) => (
                          <g key={i} className="rev-racha">
                            <path d={k.aura} className="rev-racha-aura" />
                            <path d={k.borda} className="rev-racha-borda" />
                            <path d={k.luz} className="rev-racha-luz" />
                            <path d={k.miolo} className="rev-racha-miolo" />
                            <path d={k.lascas} className="rev-racha-lasca" />
                          </g>
                        ))}
                      </svg>
                    </div>
                  )}
                </div>
              </div>
              {!curto && <Rajadas rajadas={rajadas} raridade={raridade} tipo="centro" />}
            </div>
          </div>
        </div>

        <div ref={acoes} className="rev-acoes" data-visivel={fim ? '' : undefined} aria-hidden={!fim} inert={!fim}>
          {children}
        </div>
      </div>

      {!curto && <div ref={clarao} className="rev-clarao" style={inicial.opaco} aria-hidden />}
      {!fim && !curto && (
        <p className={cx('rev-dica painel-escuro')} aria-hidden>
          Toque para pular
        </p>
      )}
    </motion.div>
  );
}

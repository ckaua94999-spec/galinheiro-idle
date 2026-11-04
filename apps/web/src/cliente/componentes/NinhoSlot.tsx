'use client';

// Um ninho do grid (GDD 3.1.5, DIRECAO_DE_ARTE 8.2): camadas combináveis (humor + pronto + vida baixa +
// último ciclo + obra). O toque faz squash & stretch; o salto dos ovos, o "+N" e as faíscas da coleta
// moram na CamadaEfeitos (camada fixa por cima de tudo). Animação contínua aqui é só CSS (pausa com
// .pausado); motion só nas reações curtas (toque, antecipação, erro, estreia).
// Montagem: tudo (animal, halo, balão, alertas, timer) aparece junto, sem fade. Só quando o estado muda
// com a tela aberta (ficou pronto / foi coletado) as peças novas entram com um pop (.entra, em CSS).
import type { EntityDTO } from '@galinheiro/api-contract';
import { NOME_TIPO, formatarDuracao, vidaExibida } from '@galinheiro/game-core';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { FiguraAnimal, type Detalhe } from '../arte/Animal';
import { Ovo } from '../arte/Icones';
import { estaProntoAgora, humorDe, vidaDe } from '../derivados';
import { useUi } from '../ui';
import { cx } from '../util';

const EASE_SUAVE = [0.22, 1, 0.36, 1] as const;
const EASE_ELASTICO = [0.34, 1.56, 0.64, 1] as const;
const MEIA_HORA = 30 * 60_000;

// Um único IntersectionObserver para todos os ninhos: pausa as animações de quem está fora da tela.
const visiveis = new WeakMap<Element, (v: boolean) => void>();
let observador: IntersectionObserver | null = null;
function observar(el: Element, cb: (v: boolean) => void): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  observador ??= new IntersectionObserver((entradas) => {
    for (const e of entradas) visiveis.get(e.target)?.(e.isIntersecting);
  }, { rootMargin: '120px' });
  visiveis.set(el, cb);
  observador.observe(el);
  return () => {
    observador?.unobserve(el);
    visiveis.delete(el);
  };
}

// Um único ResizeObserver para todos os ninhos: escolhe o nível de detalhe do desenho pelo tamanho do slot
// (DIRECAO_DE_ARTE: p ≤ 56 px, g > 140 px; no grid quase sempre "m").
const medidas = new WeakMap<Element, (largura: number) => void>();
let medidor: ResizeObserver | null = null;
function medir(el: Element, cb: (largura: number) => void): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};
  medidor ??= new ResizeObserver((entradas) => {
    for (const e of entradas) medidas.get(e.target)?.(e.contentRect.width);
  });
  medidas.set(el, cb);
  medidor.observe(el);
  return () => {
    medidor?.unobserve(el);
    medidas.delete(el);
  };
}
const detalhePara = (largura: number): Detalhe => (largura <= 56 ? 'p' : largura > 140 ? 'g' : 'm');

const reduzido = (): boolean => document.documentElement.classList.contains('reduzir-movimento');

/** Texto do chip: "23h59" acima de 1 h e "23:44" (min:s) abaixo, para não confundir horas com minutos. */
function textoTimer(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** O "h" sai um pouco menor que os números (lê melhor como unidade). */
function TextoTimer({ ms }: { ms: number }) {
  const [h, resto] = textoTimer(ms).split('h');
  return (
    <span className="ninho-timer-texto">
      {resto === undefined ? (
        h
      ) : (
        <>
          {h}
          <span className="ninho-timer-h">h</span>
          {resto}
        </>
      )}
    </span>
  );
}

/** Leitura falada do tempo restante ("23 h 59 min", "menos de 1 min"). */
const falaTimer = (ms: number): string => (ms < 60_000 ? 'menos de 1 min' : formatarDuracao(ms));

// ------------------------------------------------------------------ peças desenhadas (estáticas, no módulo)
// Raios do brilho de "pronto": 12 pontas num path só, centro (0,0), para casar com o gradiente radial.
const RAIOS_HALO = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  const p = (r: number, ang: number) => `${(Math.cos(ang) * r).toFixed(1)} ${(Math.sin(ang) * r).toFixed(1)}`;
  return `M${p(14, a - 0.2)}L${p(58, a)}L${p(14, a + 0.2)}Z`;
}).join('');

const HALO = (
  <svg viewBox="-60 -60 120 120">
    <path d={RAIOS_HALO} fill="url(#gi-cenario-raio-ouro)" />
    <circle r={40} fill="url(#gi-cenario-sol-halo)" />
  </svg>
);

// Balão de pronto: bolha branca com rabicho apontando para o animal (o ovo da espécie vai por cima).
const BALAO = (
  <svg viewBox="0 0 32 32" aria-hidden>
    <path
      d="M18 1.8A12.4 12.4 0 1 1 12.4 25.3L4.2 30.2L8.6 22.4A12.4 12.4 0 0 1 18 1.8Z"
      fill="url(#gi-cenario-balao)"
      stroke="#6b4416"
      strokeWidth={4.4}
      strokeLinejoin="round"
      paintOrder="stroke"
    />
    <path d="M9.6 9.2A10 10 0 0 1 15 4.6" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
    <path d="M27.6 6.2l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="#ffc93c" stroke="#c27c00" strokeWidth={0.6} />
  </svg>
);

const RELOGIO = (
  <svg viewBox="0 0 16 16" aria-hidden>
    <circle cx={8} cy={8.6} r={6.2} fill="#fff6e0" stroke="#2b1a0f" strokeWidth={1.8} />
    <path d="M8 5.4V8.8L10.2 10" fill="none" stroke="#2b1a0f" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.4 1.6H9.6" stroke="#2b1a0f" strokeWidth={1.8} strokeLinecap="round" />
  </svg>
);

const PRESENTE = (
  <svg viewBox="0 0 20 20" aria-hidden>
    <path d="M10 6.2C8.6 2.6 5 2.8 5.4 5C5.7 6.4 8 6.6 10 6.2ZM10 6.2C11.4 2.6 15 2.8 14.6 5C14.3 6.4 12 6.6 10 6.2Z" fill="#ff4f7a" stroke="#7a1a4a" strokeWidth={1.4} strokeLinejoin="round" />
    <rect x={4} y={10} width={12} height={8} rx={1.2} fill="#fff" stroke="#7a1a4a" strokeWidth={1.5} />
    <rect x={3} y={6.6} width={14} height={4} rx={1.2} fill="#fff" stroke="#7a1a4a" strokeWidth={1.5} />
    <path d="M10 6.8V17.6" stroke="#ff4f7a" strokeWidth={2.6} />
    <path d="M4.6 12.4H15.4" stroke="#ffd6e8" strokeWidth={1.2} />
  </svg>
);

// Obra da ampliação: andaime, monte de palha, placa listrada; martelo, estalo e poeira animam em CSS.
const POEIRA: [string, string][] = [
  ['-24cqw', '-6cqw'],
  ['-16cqw', '-18cqw'],
  ['-2cqw', '-24cqw'],
  ['14cqw', '-18cqw'],
  ['24cqw', '-6cqw'],
  ['-30cqw', '2cqw'],
];

const OBRA = (
  <span className="obra" aria-hidden>
    <svg viewBox="0 0 120 120" className="obra-andaime">
      <ellipse cx={60} cy={110} rx={44} ry={6} fill="#2f7a22" opacity={0.3} />
      {/* postes e travessas em X */}
      <path d="M25 46L95 88M25 88L95 46" stroke="#3b200c" strokeWidth={5.4} strokeLinecap="round" />
      <path d="M25 46L95 88M25 88L95 46" stroke="#c88a52" strokeWidth={2.8} strokeLinecap="round" />
      <rect x={18} y={30} width={8} height={80} rx={2} fill="url(#gi-cenario-madeira-h)" stroke="#3b200c" strokeWidth={2} />
      <rect x={94} y={30} width={8} height={80} rx={2} fill="url(#gi-cenario-madeira-h)" stroke="#3b200c" strokeWidth={2} />
      <rect x={11} y={34} width={98} height={9} rx={2.5} fill="url(#gi-cenario-madeira)" stroke="#3b200c" strokeWidth={2} />
      <path d="M15 36.8H105" stroke="#ffe2b0" strokeWidth={1.2} opacity={0.7} />
      <g fill="#5a3418">
        <circle cx={22} cy={38.5} r={1.6} />
        <circle cx={98} cy={38.5} r={1.6} />
      </g>
      {/* placa listrada de obra */}
      <rect x={34} y={56} width={52} height={15} rx={3} fill="#ffd23f" />
      <path d="M44 56H50L42 71H36ZM56 56H62L54 71H48ZM68 56H74L66 71H60ZM80 56H85L78 71H72Z" fill="#3b200c" />
      <rect x={34} y={56} width={52} height={15} rx={3} fill="none" stroke="#3b200c" strokeWidth={2.2} />
      {/* monte de palha e tábuas no chão, onde o ninho vai nascer */}
      <path d="M26 104Q30 90 60 88Q90 90 94 104Q60 112 26 104Z" fill="url(#gi-cenario-palha)" stroke="#6b4416" strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M38 96Q46 92 52 95M62 93Q70 90 78 95M44 102Q56 98 66 101" fill="none" stroke="#c9932f" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M52 90Q54 85 58 84M70 91Q74 87 79 88" fill="none" stroke="#ffe58a" strokeWidth={1.5} strokeLinecap="round" />
      <rect x={6} y={100} width={30} height={6} rx={2} fill="url(#gi-cenario-madeira)" stroke="#3b200c" strokeWidth={1.8} transform="rotate(-8 21 103)" />
      <rect x={86} y={101} width={28} height={6} rx={2} fill="url(#gi-cenario-madeira)" stroke="#3b200c" strokeWidth={1.8} transform="rotate(10 100 104)" />
    </svg>
    <span className="obra-estalo" />
    <span className="obra-poeira">
      {POEIRA.map(([dx, dy], i) => (
        <i key={i} style={{ '--dx': dx, '--dy': dy, animationDelay: `calc(var(--atraso-obra, 0ms) + ${i * 12}ms)` } as CSSProperties} />
      ))}
    </span>
    <span className="obra-martelo">
      <svg viewBox="0 0 40 40">
        <rect x={12} y={27.5} width={27} height={5} rx={2.5} fill="url(#gi-cenario-madeira)" stroke="#3b200c" strokeWidth={1.8} />
        <rect x={31} y={26.8} width={7.5} height={6.4} rx={2} fill="#c8352b" stroke="#3b200c" strokeWidth={1.5} />
        <rect x={3} y={19} width={12} height={21} rx={2.5} fill="url(#gi-cenario-ferro)" stroke="#2b1a0f" strokeWidth={2} />
        <path d="M6 22V37" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
      </svg>
    </span>
  </span>
);

// Faíscas douradas da estreia do ninho novo (depois da obra).
const FAISCAS_ESTREIA = Array.from({ length: 6 }, (_, i) => {
  const a = ((i * 60 - 90 + 15) * Math.PI) / 180;
  return {
    '--dx': `${(Math.cos(a) * 34).toFixed(1)}cqw`,
    '--dy': `${(Math.sin(a) * 30).toFixed(1)}cqw`,
    '--s': '1.1',
    '--vida': '560ms',
    '--atraso': '140ms',
  } as CSSProperties;
});

// ------------------------------------------------------------------ slot
interface Props {
  slot: number;
  entidade: EntityDTO | null;
  agora: number;
  emObra: boolean;
  aoTocar: (slot: number, e: EntityDTO | null, longo: boolean) => void;
  /** atraso da obra deste slot (stagger de 90 ms entre os slots novos da ampliação) */
  atrasoObraMs?: number;
}

function NinhoSlotBase({ slot, entidade: e, agora, emObra, aoTocar, atrasoObraMs = 0 }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [corpo, animarCorpo] = useAnimate<HTMLSpanElement>();
  const [visivel, setVisivel] = useState(true);
  const animacao = useUi((s) => (e ? s.animacoes[e.id] : undefined));
  const revelacao = useUi((s) => (e ? s.revelacoes[e.id] : undefined));
  const timerLongo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const foiLongo = useRef(false);

  const [detalhe, setDetalhe] = useState<Detalhe>('m');

  useEffect(() => (ref.current ? observar(ref.current, setVisivel) : undefined), []);
  useEffect(() => (ref.current ? medir(ref.current, (l) => setDetalhe(detalhePara(l))) : undefined), []);

  // Na coleta o animal fica "surpresa" por ~600 ms (os ovos saltam na CamadaEfeitos).
  const [revelando, setRevelando] = useState(false);
  useEffect(() => {
    if (!revelacao) return;
    setRevelando(true);
    const t = setTimeout(() => setRevelando(false), 650);
    return () => clearTimeout(t);
  }, [revelacao]);

  // Estreia: o ninho que acabou de sair da obra nasce com pop e faíscas. (O ninho só monta depois da saída
  // da obra, 180 ms, então a estreia já está ligada quando ele aparece.)
  const obraVista = useRef(false);
  const [estreia, setEstreia] = useState(false);
  useEffect(() => {
    if (emObra) {
      obraVista.current = true;
      return;
    }
    if (!obraVista.current) return;
    obraVista.current = false;
    setEstreia(true);
    const t = setTimeout(() => setEstreia(false), 900);
    return () => clearTimeout(t);
  }, [emObra]);

  const pronto = e ? estaProntoAgora(e, agora) : false;
  const humorBase = e ? humorDe(e, agora) : 'feliz';
  const humor = animacao === 'antecipando' || revelando ? 'surpresa' : humorBase;
  const vida = e ? vidaDe(e, agora) : 100;
  const triste = e ? humorBase === 'triste' : false;
  const falta = e ? Date.parse(e.proximoRendimento) - agora : 0;

  // Pop de entrada só para o que muda com a tela aberta: na montagem o "pronto" é o de partida e nada anima;
  // a partir da 1ª virada (ficou pronto, foi coletado) halo/balão/timer/presente nascem com .entra.
  const [prontoInicial] = useState(pronto);
  const [prontoMudou, setProntoMudou] = useState(false);
  if (!prontoMudou && pronto !== prontoInicial) setProntoMudou(true);
  const entra = prontoMudou && 'entra';

  const rotulo = e
    ? `Ninho ${slot}: ${e.nome}, ${NOME_TIPO[e.tipo].toLowerCase()}, vida ${vidaExibida(vida)}%, ${pronto ? 'pronto para coletar' : `próximos ovos em ${falaTimer(falta)}`}`
    : `Ninho ${slot}: vazio`;

  // Squash & stretch do toque: achata, estica para cima e assenta numa mola.
  const squash = () => {
    const el = corpo.current;
    if (!el || reduzido()) return;
    void (async () => {
      await animarCorpo(el, { scaleX: [1, 1.12, 0.92], scaleY: [1, 0.86, 1.1], y: [0, 0, -6] }, { duration: 0.2, times: [0, 0.45, 1], ease: EASE_SUAVE });
      await animarCorpo(el, { scaleX: 1, scaleY: 1, y: 0 }, { type: 'spring', stiffness: 600, damping: 14 });
    })();
  };

  const iniciarToque = () => {
    foiLongo.current = false;
    timerLongo.current = setTimeout(() => {
      foiLongo.current = true;
      squash();
      aoTocar(slot, e, true);
    }, 500);
  };
  const cancelarToque = () => {
    if (timerLongo.current) clearTimeout(timerLongo.current);
  };

  const animarNinho =
    animacao === 'antecipando'
      ? { y: [0, -14, 0, -6, 0], scaleY: [1, 1.05, 0.92, 1, 1], opacity: 1, scale: 1 }
      : animacao === 'erro'
        ? { x: [0, -6, 6, -6, 6, 0], opacity: 1, scale: 1 }
        : estreia
          ? { scale: [0, 1.12, 1], y: 0, x: 0, scaleY: 1, opacity: 1 }
          : { y: 0, x: 0, scaleY: 1, opacity: 1, scale: 1 };
  const transicao =
    animacao === 'antecipando'
      ? { duration: 0.6, repeat: Infinity }
      : estreia
        ? { duration: 0.32, times: [0, 0.7, 1], ease: EASE_ELASTICO }
        : { duration: 0.3 };

  return (
    <button
      ref={ref}
      type="button"
      data-slot={slot}
      data-tut={`ninho-${slot}`}
      data-especie={e?.tipo}
      aria-label={rotulo}
      title={e ? e.nome : 'Ninho vazio'}
      className={cx('ninho-slot', !visivel && 'pausado')}
      onPointerDown={iniciarToque}
      onPointerUp={cancelarToque}
      onPointerLeave={cancelarToque}
      onPointerCancel={cancelarToque}
      onContextMenu={(ev) => ev.preventDefault()}
      onClick={() => {
        if (foiLongo.current) return;
        squash();
        aoTocar(slot, e, false);
      }}
    >
      {pronto && !emObra && (
        <span className={cx('halo-pronto', entra)} aria-hidden>
          {HALO}
        </span>
      )}

      <span ref={corpo} className="ninho-corpo">
        {/* initial={false}: o que já está lá na montagem (SSR incluso) aparece pronto, sem fade */}
        <AnimatePresence mode="wait" initial={false}>
          {emObra ? (
            <motion.span
              key="obra"
              style={{ '--atraso-obra': `${atrasoObraMs}ms` } as CSSProperties}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: atrasoObraMs / 1000, duration: 0.3, ease: EASE_ELASTICO }}
              exit={{ scale: 1.15, opacity: 0, transition: { duration: 0.18, delay: atrasoObraMs / 1000 } }}
            >
              {OBRA}
            </motion.span>
          ) : (
            // Sem fade de entrada: o ninho aparece junto com balão/timer (inclusive no SSR, antes da hidratação).
            // Só a estreia depois da obra nasce do zero (scale 0 → 1,12 → 1).
            <motion.span key="ninho" initial={estreia ? { scale: 0 } : false} animate={animarNinho} transition={transicao}>
              <FiguraAnimal
                tipo={e?.tipo ?? null}
                humor={humor}
                pronto={pronto}
                detalhe={detalhe}
                className="h-full w-full"
                atrasoS={(slot * 0.73) % 3}
              />
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      {!e && !emObra && (
        <span className="ninho-mais" aria-hidden>
          <span className="texto-contorno">+</span>
        </span>
      )}

      {pronto && !emObra && (
        <span className={cx('selo-pronto', entra)} aria-hidden>
          {BALAO}
          {e && <Ovo tipo={e.tipo} className="selo-pronto-ovo absolute" />}
        </span>
      )}
      {e && triste && !emObra && (
        <span className="selo-alerta" aria-hidden>
          <span className="texto-contorno">!</span>
        </span>
      )}
      {e && e.ultimoCiclo && !pronto && !emObra && (
        <span className={cx('selo-presente', entra)} aria-hidden>
          {PRESENTE}
        </span>
      )}
      {e && !pronto && !emObra && (
        <span className={cx('ninho-timer pilula pilula-timer', entra)} data-quase={falta < MEIA_HORA ? '' : undefined} aria-hidden>
          {RELOGIO}
          <TextoTimer ms={falta} />
        </span>
      )}

      {estreia && (
        <span className="fx-ponto" style={{ left: '50%', top: '66%' }} aria-hidden>
          {FAISCAS_ESTREIA.map((st, i) => (
            <i key={i} className="faisca" style={st} />
          ))}
        </span>
      )}
    </button>
  );
}

export const NinhoSlot = memo(NinhoSlotBase, (a, b) => {
  if (a.slot !== b.slot || a.entidade !== b.entidade || a.emObra !== b.emObra || a.aoTocar !== b.aoTocar || a.atrasoObraMs !== b.atrasoObraMs) return false;
  if (!a.entidade) return true;
  // Re-renderiza a cada segundo só na última hora do timer ou quando muda o minuto.
  const prox = Date.parse(a.entidade.proximoRendimento);
  const fa = prox - a.agora;
  const fb = prox - b.agora;
  if ((fa <= 0) !== (fb <= 0)) return false;
  if (fb < 3_600_000) return Math.ceil(fa / 1000) === Math.ceil(fb / 1000);
  return Math.floor(a.agora / 60_000) === Math.floor(b.agora / 60_000);
});

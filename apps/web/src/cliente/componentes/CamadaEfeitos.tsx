'use client';

// Camada única de efeitos (.fx-camada, DIRECAO_DE_ARTE 8.3): ovos saltando do ninho em arco e voando até o
// contador do HUD (ANI-05), fonte de moedas da venda indo para o saldo (ANI-11) e rajadas pontuais ("+N",
// faíscas, anel, jackpot). Voos por MotionValue (nada de setState por quadro); partículas em CSS, com teto.
import { tipoDoItem } from '@galinheiro/game-core';
import { animate, motion, useMotionValue, type MotionValue } from 'motion/react';
import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Moeda, Ovo } from '../arte/Icones';
import { useUi, type MoedaVoando, type OvoVoando, type Rajada } from '../ui';
import { medidaUauCurto, medidaUauGrande } from '../useAcoes';
import { cx, moedas } from '../util';

// Curvas da seção 9 (as mesmas dos tokens --ease-* do CSS).
const EASE = {
  suave: [0.22, 1, 0.36, 1],
  explosao: [0.16, 1, 0.3, 1],
  elastico: [0.34, 1.56, 0.64, 1],
  sugar: [0.32, 0, 0.67, 0],
} as const;

type Ponto = { x: number; y: number };
type Controle = { stop: () => void };

const reduzido = (): boolean => document.documentElement.classList.contains('reduzir-movimento');
const bez = (a: number, b: number, c: number, t: number): number => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
const centro = (r: DOMRect): Ponto => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/** Desvio horizontal (px) que mantém um rótulo de meia-largura `meia` inteiro na tela (8 px de folga). */
function dentroDaTela(x: number, meia: number): number {
  const w = typeof window === 'undefined' ? 9999 : window.innerWidth;
  return Math.min(w - meia - 8, Math.max(meia + 8, x)) - x;
}

/** Meia-largura de uma moeda voando (o centro fica a ≥ 16 px + isso das bordas). */
const MEIA_MOEDA = 14;

/**
 * Área útil da fonte de moedas (centro x): dentro da tela (a ≥ 16 px da borda) e à esquerda de qualquer controle da linha de contadores
 * do HUD que fique ACIMA do botão e à direita do meio dele (no celular, a engrenagem): as moedas sobem até o topo
 * da tela e não passam por cima dela. No desktop a linha dos contadores fica ao lado (não acima) e nada limita.
 */
function areaFonte(de: DOMRect): [number, number] {
  let max = window.innerWidth - 16 - MEIA_MOEDA;
  const min = 16 + MEIA_MOEDA;
  const meio = de.left + de.width / 2;
  for (const el of document.querySelectorAll<HTMLElement>('.hud-contadores > *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.bottom <= de.top + 4 && r.left > meio) max = Math.min(max, r.left - MEIA_MOEDA - 4);
  }
  return [min, Math.max(min, max)];
}

/**
 * Onde nasce o "+N moedas" da venda (estilo Hay Day): colado embaixo do chip do saldo (#hud-moedas), no instante
 * em que a primeira moeda chega e o número começa a contar; é o único aviso com o valor (o toast da venda só diz
 * quantos ovos foram vendidos). `meia`: meia-largura estimada da pílula; ela nunca encosta na borda (≥ 12 px).
 * Sem chip (tela sem HUD): logo abaixo do botão Vender (âncora data-hud-vender; fallback [data-tut="vender"]).
 */
const MARGEM_GANHO = 12;
function pontoGanho(meia: number): Ponto | null {
  const w = window.innerWidth;
  const limitar = (x: number) => Math.min(w - MARGEM_GANHO - meia, Math.max(MARGEM_GANHO + meia, x));
  const chip = document.getElementById('hud-moedas')?.getBoundingClientRect();
  if (chip && chip.width > 0) {
    const x = limitar(chip.left + chip.width / 2);
    // botão logo abaixo do chip (celular: Coletar Todos): a pílula desce 7 px e pousa inteira na face do botão, em
    // vez de montar no chanfro de cima dele
    const abaixo = document.elementFromPoint(x, chip.bottom + 10)?.closest('button');
    return { x, y: abaixo && !abaixo.contains(document.getElementById('hud-moedas')) ? chip.bottom + 4 : chip.bottom - 3 };
  }
  const vender = document.querySelector<HTMLElement>('[data-hud-vender]') ?? document.querySelector<HTMLElement>('[data-tut="vender"]');
  const rv = vender?.getBoundingClientRect();
  if (rv && rv.width > 0) return { x: limitar(rv.left + rv.width / 2), y: rv.bottom + 4 };
  return null;
}

/** Meia-largura estimada da pílula "+N 🪙" (16 px de fonte numérica, moeda e respiro). */
const meiaLarguraGanho = (texto: string): number => (texto.length * 9.5 + 38) / 2;

/** Centro do alvo no HUD; mira no ícone do chip quando houver (o ovo "entra" no ovo do contador). */
function alvo(id: string): Ponto {
  const el = document.getElementById(id);
  if (!el) return { x: window.innerWidth / 2, y: 30 };
  const icone = el.querySelector('.chip-icone') ?? el.querySelector('svg');
  return centro((icone ?? el).getBoundingClientRect());
}

// ------------------------------------------------------------------ pool de partículas
// Teto de partículas simultâneas (seção 10). Se o pool esgota, as novas são descartadas.
const LIMITE = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 4) > 4 ? 60 : 40;
let ativas = 0;

/** Reserva até `quer` partículas do pool enquanto o componente vive e gera os estilos de cada uma. */
function useParticulas<T>(quer: number, gerar: (i: number, k: number) => T): T[] {
  const [lista, setLista] = useState<T[]>([]);
  useEffect(() => {
    const k = Math.max(0, Math.min(quer, LIMITE - ativas));
    ativas += k;
    setLista(Array.from({ length: k }, (_, i) => gerar(i, k)));
    return () => {
      ativas -= k;
    };
    // gera uma vez só por rajada
  }, []);
  return lista;
}

const sorteio = (a: number, b: number): number => a + Math.random() * (b - a);

interface OpcoesFaisca {
  raio: [number, number];
  /** ângulo central (graus, 0 = para cima) e abertura total do leque */
  direcao?: number;
  abertura?: number;
  tamanho?: [number, number];
  vida?: [number, number];
  atraso?: number;
  cores?: string[];
}

function estiloFaisca(i: number, k: number, o: OpcoesFaisca): CSSProperties {
  const abertura = o.abertura ?? 360;
  const base = (o.direcao ?? 0) - abertura / 2 + (abertura * (i + 0.5)) / k + sorteio(-12, 12);
  const ang = ((base - 90) * Math.PI) / 180;
  const r = sorteio(o.raio[0], o.raio[1]);
  const [s0, s1] = o.tamanho ?? [0.7, 1.2];
  const [v0, v1] = o.vida ?? [380, 620];
  return {
    '--dx': `${(Math.cos(ang) * r).toFixed(1)}px`,
    '--dy': `${(Math.sin(ang) * r).toFixed(1)}px`,
    '--s': sorteio(s0, s1).toFixed(2),
    '--vida': `${Math.round(sorteio(v0, v1))}ms`,
    '--atraso': `${o.atraso ?? 0}ms`,
    '--cor': o.cores ? o.cores[i % o.cores.length] : undefined,
  } as CSSProperties;
}

function Faiscas({ n, estrela, ...o }: OpcoesFaisca & { n: number; estrela?: boolean }) {
  const lista = useParticulas(n, (i, k) => estiloFaisca(i, k, o));
  return (
    <>
      {lista.map((st, i) => (
        <i key={i} className={estrela ? 'faisca faisca-estrela' : 'faisca'} style={st} />
      ))}
    </>
  );
}

const CORES_CONFETE = ['#ffd23f', '#ff8ad8', '#8ad8ff', '#9dffb0'];

function Confetes({ n, atrasoBase = 0 }: { n: number; atrasoBase?: number }) {
  const lista = useParticulas(n, (i, k) => {
    const ang = ((-80 + (160 * (i + 0.5)) / k + sorteio(-8, 8)) * Math.PI) / 180;
    const r = sorteio(70, 150);
    return {
      '--dx': `${(Math.sin(ang) * r).toFixed(1)}px`,
      '--dy': `${(-Math.cos(ang) * r * 0.9 - 30).toFixed(1)}px`,
      '--r': `${Math.round(sorteio(-540, 540))}deg`,
      '--vida': `${Math.round(sorteio(1200, 1500))}ms`,
      '--atraso': `${atrasoBase + Math.round(sorteio(0, 90))}ms`,
      '--cor': CORES_CONFETE[i % CORES_CONFETE.length],
    } as CSSProperties;
  });
  return (
    <>
      {lista.map((st, i) => (
        <i key={i} className="confete" style={st} />
      ))}
    </>
  );
}

// Estrela de raios (a mesma forma dos raios do sol), para o clarão do jackpot.
const RAIOS = Array.from({ length: 14 }, (_, i) => {
  const a = (i * Math.PI * 2) / 14;
  const p = (r: number, ang: number) => `${(Math.cos(ang) * r).toFixed(1)} ${(Math.sin(ang) * r).toFixed(1)}`;
  return `M${p(10, a - 0.16)}L${p(i % 2 ? 48 : 60, a)}L${p(10, a + 0.16)}Z`;
}).join('');

// ------------------------------------------------------------------ rajadas
const DURACAO: Record<Rajada['tipo'], number> = {
  coleta: 1000,
  jackpot: 1700,
  'chegada-ovo': 650,
  'chegada-moeda': 600,
  'ganho-moedas': 1150,
  faiscas: 800,
  'fonte-moedas': 700,
};
/** Duração do rótulo: "+N" (mais-n-coleta, 900 ms) e "UAU!" (mais-n-longo, 1400 ms), com folga. */
const DURACAO_MAIS_N = 950;
const DURACAO_UAU = 1450;
/** O confete cai por ~1,5 s depois de sair. */
const DURACAO_CONFETE = 1600;

/**
 * "UAU! +N" de todo jackpot, por cima dos ovos que saltam e com contorno mais grosso. Curto (há ninho acima): uma
 * linha só, no alto do próprio ninho, com a fonte medida pela largura do ninho (medidaUauCurto). Senão, "UAU!"
 * pequeno em cima do "+N" grande, também medido pelo ninho (medidaUauGrande). `medio`: jackpot escalonado do
 * Coletar Todos, um pouco menor que o principal (hierarquia: principal ≥ escalonado ≥ dentro do ninho).
 */
function RotuloUau({ r, top, medio, estilo }: { r: Rajada; top: number; medio?: boolean; estilo: CSSProperties }) {
  const dx = r.dx ?? 0;
  if (r.curto) {
    const { fonte, meia } = medidaUauCurto(r.largura ?? 72, medio);
    return (
      <span
        className="mais-n mais-n-uau mais-n-uau-linha mais-n-longo mais-n-curto texto-contorno texto-ouro so-opacidade"
        style={{ ...estilo, top, fontSize: fonte, left: dentroDaTela(r.x + dx, meia) + dx }}
      >
        <span className="mais-n-rotulo texto-contorno">UAU!</span>+{r.n ?? 3}
      </span>
    );
  }
  const { fonte, meia } = medidaUauGrande(r.largura ?? 72, medio);
  return (
    <span
      className={cx('mais-n mais-n-uau mais-n-longo texto-contorno texto-ouro so-opacidade', medio ? 'mais-n-medio' : 'mais-n-grande')}
      style={{ ...estilo, top, fontSize: fonte, left: dentroDaTela(r.x + dx, meia) + dx }}
    >
      <span className="mais-n-rotulo texto-contorno">UAU!</span>+{r.n ?? 3}
    </span>
  );
}

/**
 * Rajada com `atrasoFxMs`: só monta (e só reserva partículas do pool) quando chega a hora; os atrasos de rótulo
 * (`atrasoMs`) passam a contar dali.
 */
const RajadaFx = memo(function RajadaFx({ r }: { r: Rajada }) {
  const espera = r.atrasoFxMs ?? 0;
  const [pronta, setPronta] = useState(espera <= 0);
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setPronta(true), espera);
    return () => clearTimeout(t);
  }, [espera]);
  const agora = useMemo(() => (espera > 0 ? { ...r, atrasoMs: Math.max(0, (r.atrasoMs ?? 0) - espera) } : r), [r, espera]);
  return pronta ? <RajadaFxAgora r={agora} /> : null;
});

const RajadaFxAgora = memo(function RajadaFxAgora({ r }: { r: Rajada }) {
  useEffect(() => {
    // o rótulo pode sair bem depois do resto (Coletar Todos escalona os "+N" vizinhos); o confete cai ~1,5 s
    const rotulo = r.semRotulo ? 0 : (r.atrasoRotuloMs ?? 0) + (r.tipo === 'jackpot' || r.confete ? DURACAO_UAU : DURACAO_MAIS_N);
    const confete = r.confete ? DURACAO_CONFETE : 0;
    const dura = Math.max(DURACAO[r.tipo], rotulo, confete);
    const t = setTimeout(() => useUi.getState().removerRajada(r.id), dura + (r.atrasoMs ?? 0));
    if (r.tipo === 'jackpot' && !reduzido()) {
      // tremida curta do cercado inteiro (só transform)
      const grid = document.querySelector<HTMLElement>('[data-tut="grid"]');
      grid?.animate(
        [
          { transform: 'translate(0, 0)' },
          { transform: 'translate(-6px, 2px)' },
          { transform: 'translate(5px, -2px)' },
          { transform: 'translate(-4px, 1px)' },
          { transform: 'translate(3px, 0)' },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 360, easing: 'linear' },
      );
    }
    return () => clearTimeout(t);
  }, [r.id, r.tipo, r.atrasoMs, r.confete, r.atrasoRotuloMs, r.semRotulo]);

  // o rótulo pode sair depois do resto (Coletar Todos escalona rótulos vizinhos) e nunca sai cortado na borda
  const atrasoRotulo = (r.atrasoMs ?? 0) + (r.atrasoRotuloMs ?? 0);
  const atraso = { '--atraso': `${atrasoRotulo}ms` } as CSSProperties;
  const rotulo = !r.semRotulo;
  // anel e faíscas da coleta ficam no meio do ninho; o "+N" nasce na borda de cima (r.y)
  const dyFx = r.yFx === undefined ? 10 : r.yFx - r.y;
  // jackpot: sem yFx é tudo centrado no ninho, rótulo 16 px acima dos raios; com yFx (sempre, vindo de
  // lancarRajadaNinho) o rótulo nasce em r.y (posicaoRotulo) e os raios no meio do ninho
  const dyRaios = r.yFx === undefined ? 8 : r.yFx - r.y;
  const dyUau = r.yFx === undefined ? -8 : 0;
  return (
    <div className="fx-ponto" style={{ left: r.x, top: r.y }}>
      {r.tipo === 'coleta' && (
        <>
          <i className="anel-fx" style={{ '--tam': '56px', '--cor': '#fff3a0', top: dyFx } as CSSProperties} />
          <span className="fx-ponto" style={{ top: dyFx }}>
            <Faiscas n={r.pequeno ? 4 : 6} raio={[30, 54]} direcao={0} abertura={220} />
          </span>
          {r.confete && (
            <>
              {/* jackpot escalonado (outro levou o "UAU!" grande): raios curtos e confete menor; a rajada inteira
                  (ovos inclusive) já vem escalonada em atrasoMs, então tudo sai junto */}
              <span className="raios-fx raios-fx-p" style={{ top: dyFx }}>
                <svg viewBox="-60 -60 120 120">
                  <path d={RAIOS} fill="url(#gi-cenario-raio-ouro)" />
                </svg>
              </span>
              <span className="fx-ponto" style={{ top: dyFx }}>
                <Confetes n={8} />
              </span>
              {rotulo && <RotuloUau r={r} top={0} medio estilo={atraso} />}
            </>
          )}
          {rotulo && !r.confete && (
            <span
              className={cx('mais-n mais-n-coleta texto-contorno texto-ouro so-opacidade', r.pequeno && 'mais-n-pequeno', r.curto && 'mais-n-curto')}
              style={{ ...atraso, left: dentroDaTela(r.x + (r.dx ?? 0), 30) + (r.dx ?? 0) }}
            >
              +{r.n ?? 1}
            </span>
          )}
        </>
      )}
      {r.tipo === 'fonte-moedas' && (
        <>
          <i className="clarao-fx clarao-fx-p" />
          <i className="anel-fx" style={{ '--tam': '60px', '--cor': '#ffd84d', '--vida': '420ms' } as CSSProperties} />
          <Faiscas n={6} estrela raio={[34, 58]} direcao={0} abertura={200} tamanho={[0.7, 1.1]} vida={[360, 520]} cores={['#ffd84d', '#fff3a0']} />
        </>
      )}
      {r.tipo === 'jackpot' && (
        <>
          <span className="raios-fx" style={{ top: dyRaios }}>
            <svg viewBox="-60 -60 120 120">
              <path d={RAIOS} fill="url(#gi-cenario-raio-ouro)" />
            </svg>
          </span>
          <i className="clarao-fx" style={{ top: dyRaios }} />
          <i className="anel-fx" style={{ '--tam': '80px', '--cor': '#ffd84d', '--vida': '560ms', top: dyRaios } as CSSProperties} />
          <i className="anel-fx" style={{ '--tam': '80px', '--cor': '#ff8ad8', '--vida': '640ms', '--atraso': '120ms', top: dyRaios } as CSSProperties} />
          <span className="fx-ponto" style={{ top: dyRaios }}>
            <Faiscas n={12} estrela raio={[50, 96]} tamanho={[0.9, 1.5]} vida={[520, 820]} cores={['#ffd84d', '#ff8ad8', '#8ad8ff', '#9dffb0']} />
            <Confetes n={14} />
          </span>
          {rotulo && <RotuloUau r={r} top={dyUau} estilo={atraso} />}
        </>
      )}
      {r.tipo === 'chegada-ovo' && (
        <>
          <i className="anel-fx" style={{ '--tam': '34px', '--cor': '#fff', '--vida': '360ms' } as CSSProperties} />
          <Faiscas n={3} raio={[16, 28]} tamanho={[0.6, 0.9]} vida={[260, 420]} />
        </>
      )}
      {r.tipo === 'chegada-moeda' && (
        <>
          <i className="anel-fx" style={{ '--tam': '30px', '--cor': '#ffd84d', '--vida': '320ms' } as CSSProperties} />
          <Faiscas n={2} raio={[14, 24]} tamanho={[0.5, 0.8]} vida={[240, 380]} />
        </>
      )}
      {r.tipo === 'ganho-moedas' && (
        <span className="mais-n mais-n-desce texto-contorno texto-ouro so-opacidade" style={{ left: dentroDaTela(r.x, meiaLarguraGanho(moedas(r.n ?? 0)) + 4) }}>
          +{moedas(r.n ?? 0)}
          <Moeda />
        </span>
      )}
      {r.tipo === 'faiscas' && <Faiscas n={r.n ?? 8} raio={[24, 60]} estrela />}
    </div>
  );
});

// ------------------------------------------------------------------ voos
/** Rastro: 2 "fantasmas" que seguem o mesmo caminho um pouco atrás (progresso − 0,06 / − 0,12). */
interface Fantasma {
  x: MotionValue<number>;
  y: MotionValue<number>;
  op: MotionValue<number>;
}

const OvoEmVoo = memo(function OvoEmVoo({ o }: { o: OvoVoando }) {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const s = useMotionValue(0);
  const r = useMotionValue(0);
  const op = useMotionValue(0);
  const f1: Fantasma = { x: useMotionValue(-200), y: useMotionValue(-200), op: useMotionValue(0) };
  const f2: Fantasma = { x: useMotionValue(-200), y: useMotionValue(-200), op: useMotionValue(0) };
  const tipo = tipoDoItem(o.item);

  useEffect(() => {
    const de = o.de;
    const x0 = de.left + de.width / 2;
    const y0 = de.top + de.height * 0.66;
    const n = o.total ?? 1;
    const i = o.indice ?? 0;
    // -1 … 1: abre o leque dos ovos que saem juntos
    // (1 ovo sempre para a direita: o "+1" desvia para a esquerda, ver useAcoes)
    const lado = n === 1 ? 0.45 : (i / (n - 1)) * 2 - 1;
    // o ovo acompanha o tamanho do ninho (~0,32 da largura): no celular o pico não cobre os vizinhos
    const k = Math.min(1, Math.max(0.65, (0.32 * de.width) / 28));
    const sentido = lado >= 0 ? 1 : -1;
    const subida = 50 + (n > 1 && Math.abs(lado) < 0.5 ? 16 : 0);
    const controles: Controle[] = [];
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const chegar = (p: Ponto) => {
      if (!vivo) return;
      const ui = useUi.getState();
      ui.removerOvo(o.id);
      ui.pulsarOvos();
      if (!reduzido()) ui.lancarRajada({ tipo: 'chegada-ovo', x: p.x, y: p.y });
    };

    x.set(x0);
    y.set(y0);
    if (reduzido()) {
      // reduzir movimento: o ovo aparece no ninho e some em 150 ms
      s.set(1);
      op.set(1);
      timer = setTimeout(() => controles.push(animate(op, 0, { duration: 0.15, onComplete: () => chegar(alvo('hud-ovos')) })), o.atrasoMs);
      return () => {
        vivo = false;
        clearTimeout(timer);
        controles.forEach((c) => c.stop());
      };
    }

    const atraso = o.atrasoMs / 1000;
    const tPop = 0.34;
    // 1) salto do ninho em arco, girando (scale 0 → 1,15 → 1 com mola de ida)
    controles.push(
      animate(op, 1, { duration: 0.06, delay: atraso }),
      animate(x, x0 + lado * 38, { duration: tPop, delay: atraso, ease: EASE.suave }),
      animate(y, [y0, y0 - subida - 24, y0 - subida], { duration: tPop, delay: atraso, times: [0, 0.62, 1], ease: ['easeOut', 'easeInOut'] }),
      animate(s, [0, 1.15 * k, k], { duration: tPop, delay: atraso, times: [0, 0.6, 1], ease: EASE.elastico }),
      animate(r, sentido * 200, { duration: tPop + 0.15, delay: atraso, ease: EASE.suave }),
    );
    // 2) pausa de 150 ms e voo em Bézier até o HUD: sugado (acelera no fim), encolhe e deixa rastro
    timer = setTimeout(() => {
      if (!vivo) return;
      const p0 = { x: x.get(), y: y.get() };
      const p2 = alvo('hud-ovos');
      const p1 = { x: p0.x + sentido * 60, y: p0.y - 120 };
      const r0 = r.get();
      const fantasma = (f: Fantasma, q: number, a: number) => {
        if (q <= 0) return;
        f.x.set(bez(p0.x, p1.x, p2.x, q));
        f.y.set(bez(p0.y, p1.y, p2.y, q));
        f.op.set(a);
      };
      controles.push(
        animate(0, 1, {
          duration: 0.65,
          ease: EASE.sugar,
          onUpdate: (p) => {
            x.set(bez(p0.x, p1.x, p2.x, p));
            y.set(bez(p0.y, p1.y, p2.y, p));
            s.set(k * (1 - 0.4 * p));
            r.set(r0 + sentido * 320 * p);
            fantasma(f1, p - 0.06, 0.45);
            fantasma(f2, p - 0.12, 0.2);
          },
          onComplete: () => chegar(p2),
        }),
      );
    }, (atraso + tPop + 0.15) * 1000);

    return () => {
      vivo = false;
      clearTimeout(timer);
      controles.forEach((c) => c.stop());
    };
    // o voo é disparado uma vez por ovo
  }, []);

  const desenho = <Ovo tipo={tipo} className="absolute left-[-14px] top-[-17px] h-[34px] w-[28px]" />;
  return (
    <>
      <motion.div className="voo-item" style={{ x: f2.x, y: f2.y, scale: s, rotate: r, opacity: f2.op }}>
        {desenho}
      </motion.div>
      <motion.div className="voo-item" style={{ x: f1.x, y: f1.y, scale: s, rotate: r, opacity: f1.op }}>
        {desenho}
      </motion.div>
      <motion.div className="voo-item" style={{ x, y, scale: s, rotate: r, opacity: op }}>
        <span className="voo-brilho" />
        {desenho}
      </motion.div>
    </>
  );
});

const MoedaEmVoo = memo(function MoedaEmVoo({ m }: { m: MoedaVoando }) {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const s = useMotionValue(0);
  const op = useMotionValue(0);
  const f: Fantasma = { x: useMotionValue(-200), y: useMotionValue(-200), op: useMotionValue(0) };

  useEffect(() => {
    const { x: xBotao, y: y0 } = centro(m.de);
    const [xMin, xMax] = areaFonte(m.de);
    const limitar = (x: number) => Math.min(xMax, Math.max(xMin, x));
    const x0 = limitar(xBotao);
    const n = m.total ?? 8;
    const i = m.indice ?? m.id % 8;
    const ultima = m.total === undefined || i === n - 1;
    const controles: Controle[] = [];
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const chegar = (p: Ponto) => {
      if (!vivo) return;
      const ui = useUi.getState();
      ui.removerMoeda(m.id);
      // bump do saldo na primeira, a cada 4 e na última (o HUD segura o ritmo)
      if (i === 0 || i % 4 === 0 || ultima) ui.pulsarContador();
      if (!reduzido()) ui.lancarRajada({ tipo: 'chegada-moeda', x: p.x, y: p.y });
    };
    // "+N" do ganho: a moeda que leva o valor (a última) solta o rótulo no instante em que a PRIMEIRA chega ao
    // saldo (todas montam juntas; a primeira chega em 0,45 + 0,2 + 0,65 s, ou 150 ms em reduzir movimento),
    // que é quando o HUD começa a contar
    const ganho = m.ganhoX100;
    const timerGanho = ganho
      ? setTimeout(() => {
          if (!vivo) return;
          const g = pontoGanho(meiaLarguraGanho(moedas(ganho)));
          if (g) useUi.getState().lancarRajada({ tipo: 'ganho-moedas', x: g.x, y: Math.max(8, g.y), n: ganho });
        }, reduzido() ? 150 : 1300)
      : undefined;

    x.set(x0);
    y.set(y0);
    if (reduzido()) {
      s.set(1);
      op.set(1);
      timer = setTimeout(() => controles.push(animate(op, 0, { duration: 0.15, onComplete: () => chegar(alvo('hud-moedas')) })), m.atrasoMs);
      return () => {
        vivo = false;
        clearTimeout(timer);
        clearTimeout(timerGanho);
        controles.forEach((c) => c.stop());
      };
    }

    // 1) fonte: leque inclinado para o lado do saldo (o jorro já "mira" para onde as moedas vão), quica no "chão"
    //    (30 px abaixo) e para. Metade esquerda (lado do saldo): 70° e longa, sempre cheia. Metade direita (lado da
    //    engrenagem): 70°, ou 50° e mais curta na tela estreita (< 360 px), e comprimida até caber na área útil. O
    //    leque fica assimétrico e cheio, não vira uma coluna fina.
    const estreita = window.innerWidth < 360;
    const abreLado = (lado: number) => (lado > 0 && estreita ? 50 : 70);
    const distLado = (lado: number) => (lado > 0 && estreita ? 80 : 110);
    const saldo = alvo('hud-moedas');
    const inclina = Math.max(-30, Math.min(30, ((Math.atan2(saldo.x - x0, Math.max(1, y0 - saldo.y)) * 180) / Math.PI) * 0.35));
    // nem a partida, nem o pouso, nem o arco até o saldo saem da área útil (tela e engrenagem): cada metade do leque
    // é comprimida até caber (sem amontoar moedas na borda, como faria um corte simples)
    const alcance = (lado: number) =>
      Math.max(1, Math.sin((Math.min(90, Math.abs(inclina + lado * (abreLado(lado) + 6))) * Math.PI) / 180) * distLado(lado));
    const kDir = Math.min(1, (xMax - x0) / alcance(1));
    const kEsq = Math.min(1, (x0 - xMin) / alcance(-1));
    // a metade apertada recebe menos moedas (até 25% a menos): não vira uma coluna de moedas empilhadas
    const corte = 0.5 + 0.25 * (kEsq - kDir);
    const frac = n > 1 ? i / (n - 1) : 0.5;
    const ladoMoeda = frac >= corte ? 1 : -1;
    const graus = inclina + abreLado(ladoMoeda) * (ladoMoeda > 0 ? (frac - corte) / (1 - corte) : frac / corte - 1) + sorteio(-6, 6);
    const ang = (graus * Math.PI) / 180;
    const distMax = distLado(ladoMoeda);
    const dist = sorteio(distMax * 0.55, distMax);
    const dx = Math.sin(ang) * dist;
    const k = dx >= 0 ? kDir : kEsq;
    const xFim = limitar(x0 + dx * Math.max(0, k));
    // a fonte não passa do topo da tela (no celular o Vender do HUD fica lá em cima)
    const pico = Math.max(24, Math.min(70 + Math.cos(ang) * 70, y0 - 18));
    const atraso = m.atrasoMs / 1000;
    controles.push(
      animate(op, 1, { duration: 0.06, delay: atraso }),
      animate(s, [0.3, 1.1, 1], { duration: 0.3, delay: atraso, times: [0, 0.5, 1], ease: EASE.elastico }),
      animate(x, xFim, { duration: 0.45, delay: atraso, ease: EASE.suave }),
      animate(y, [y0, y0 - pico, y0 + 30, y0 + 30 - pico * 0.2, y0 + 30], {
        duration: 0.45,
        delay: atraso,
        times: [0, 0.35, 0.7, 0.85, 1],
        ease: ['easeOut', 'easeIn', 'easeOut', 'easeIn'],
      }),
    );
    // 2) parada de 200 ms e voo até o saldo
    timer = setTimeout(() => {
      if (!vivo) return;
      const p0 = { x: x.get(), y: y.get() };
      const p2 = alvo('hud-moedas');
      // a Bézier fica dentro do triângulo p0-p1-p2: com p1 limitado, o arco inteiro fica na tela
      const p1 = { x: limitar(p0.x + (Math.sin(ang) >= 0 ? 60 : -60)), y: p0.y - 120 };
      controles.push(
        animate(0, 1, {
          duration: 0.65,
          ease: EASE.sugar,
          onUpdate: (p) => {
            x.set(bez(p0.x, p1.x, p2.x, p));
            y.set(bez(p0.y, p1.y, p2.y, p));
            s.set(1 - 0.4 * p);
            const q = p - 0.07;
            if (q > 0) {
              f.x.set(bez(p0.x, p1.x, p2.x, q));
              f.y.set(bez(p0.y, p1.y, p2.y, q));
              f.op.set(0.35);
            }
          },
          onComplete: () => chegar(p2),
        }),
      );
    }, (atraso + 0.45 + 0.2) * 1000);

    return () => {
      vivo = false;
      clearTimeout(timer);
      clearTimeout(timerGanho);
      controles.forEach((c) => c.stop());
    };
  }, []);

  return (
    <>
      <motion.div className="voo-item" style={{ x: f.x, y: f.y, scale: s, opacity: f.op }}>
        <Moeda className="absolute left-[-13px] top-[-13px] h-[26px] w-[26px]" />
      </motion.div>
      <motion.div className="voo-item" style={{ x, y, scale: s, opacity: op }}>
        <span className="voo-brilho" />
        <span className="moeda-gira absolute left-[-14px] top-[-14px] h-7 w-7" style={{ animationDelay: `${-(m.id % 5) * 70}ms` }}>
          <Moeda className="h-7 w-7" />
        </span>
      </motion.div>
    </>
  );
});

export function CamadaEfeitos() {
  const ovos = useUi((s) => s.ovosVoando);
  const moedasVoando = useUi((s) => s.moedasVoando);
  const rajadas = useUi((s) => s.rajadas);
  return (
    <div className="fx-camada" aria-hidden>
      {rajadas.map((r) => (
        <RajadaFx key={r.id} r={r} />
      ))}
      {ovos.map((o) => (
        <OvoEmVoo key={o.id} o={o} />
      ))}
      {moedasVoando.map((m) => (
        <MoedaEmVoo key={m.id} m={m} />
      ))}
    </div>
  );
}

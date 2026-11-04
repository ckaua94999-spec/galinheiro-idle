'use client';

// Roda da roleta (GDD 3.6.2; DIRECAO_DE_ARTE 7.1). Setores proporcionais às chances (FAIXAS_ROLETA), ponteiro
// fixo no topo. A roda só ENCENA: quem gira é o MotionValue `rotacao` (graus, sentido horário) da tela.
// Tudo que muda por quadro (giro do disco, retratos sempre em pé, rastro de velocidade, mola do ponteiro) é
// escrito direto no DOM a partir dos MotionValues, sem re-render do React. Lâmpadas, destaque e confete são CSS
// (estilos/roleta.css), então respeitam html.reduzir-movimento sozinhos.
import { ANIMAIS, FAIXAS_ROLETA, NOME_TIPO, type Raridade, type Tipo } from '@galinheiro/game-core';
import { animate, useMotionValue, type AnimationPlaybackControls, type MotionValue } from 'motion/react';
import { memo, useEffect, useRef, type CSSProperties } from 'react';
import { FiguraAnimal } from './Animal';

const R_DISCO = 134;
const R_LAMPADA = 144;
const PIVO_Y = -163; // eixo do ponteiro
const PINO = 15; // um pino a cada 15° (24 por volta), o mesmo passo do som.tique()
const MOLA_PONTEIRO = { type: 'spring', stiffness: 900, damping: 18, velocity: 0 } as const;
const PONTEIRO_MAX = 34; // rede de segurança: o pino nunca passa disso

const GOMO: Record<Raridade, string> = {
  comum: 'url(#gi-roda-gomo-comum)',
  raro: 'url(#gi-roda-gomo-raro)',
  epico: 'url(#gi-roda-gomo-epico)',
  lendario: 'url(#gi-roda-gomo-lendario)',
};
const CONTORNO: Record<Raridade, string> = { comum: '#2e3642', raro: '#0b2a5e', epico: '#2a0f5e', lendario: '#4a2c00' };
const BRILHO: Record<Raridade, string> = { comum: '#ffd84d', raro: '#6fb6ff', epico: '#c3a2ff', lendario: '#ffd84d' };

function ponto(graus: number, r: number): [number, number] {
  const a = (graus * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
}

const f2 = (n: number) => n.toFixed(2);

function setor(a1: number, a2: number, r: number): string {
  const [x1, y1] = ponto(a1, r);
  const [x2, y2] = ponto(a2, r);
  return `M0 0 L${f2(x1)} ${f2(y1)} A${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${f2(x2)} ${f2(y2)} Z`;
}

function arco(a1: number, a2: number, r: number): string {
  const [x1, y1] = ponto(a1, r);
  const [x2, y2] = ponto(a2, r);
  return `M${f2(x1)} ${f2(y1)} A${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${f2(x2)} ${f2(y2)}`;
}

const pctFaixa = (i: number) => (FAIXAS_ROLETA[i]!.ate - FAIXAS_ROLETA[i]!.de + 1) / 100;

/** Raridade da faixa i (para a tela e a galeria colorirem o palco). */
export function raridadeDaFaixa(i: number): Raridade {
  return ANIMAIS[FAIXAS_ROLETA[i]!.tipo].raridade;
}

// ---------------------------------------------------------------- layout dos gomos (calculado uma vez)
/** Item "de roda-gigante": sempre em pé (contra-gira dentro do disco). Ou um retrato do animal, ou a chance escrita. */
interface Item {
  faixa: number;
  tipo: Tipo;
  x: number;
  y: number;
  raridade: Raridade;
  /** Largura do retrato (sem retrato: só a chance escrita, centrada no ponto). */
  tam?: number;
  /** Brilho branco atrás do retrato (só nos gomos claros: nos coloridos a ave branca já se destaca). */
  halo?: boolean;
  /** Retrato principal do gomo: na vitória ele salta e voa para o cubo, virando o medalhão. */
  principal?: boolean;
  pct?: string;
  fonte?: number;
}

// Todos os retratos são o bicho de CORPO INTEIRO, em pé com os pés no chão (FiguraAnimal ninho={false} desenha
// os pés e a sombra de contato), como figurinhas: nada de busto recortado. Na vitória uma CÓPIA do retrato principal
// do gomo vencedor salta e voa para o cubo, onde vira o medalhão, enquanto o original (que nunca some) desliza com
// brilho para um lugar livre (lugarDoVencedor): o pino nunca esconde o vencedor e o gomo premiado nunca fica vazio. A chance escrita mora
// num item próprio, recuada do aro: o texto fica sempre em pé, então o pior caso é a meia-diagonal dele apontando
// para fora, e mesmo assim sobram ~10 unidades até os pinos (r 133) e o anel de lâmpadas.
const ITENS: Item[] = FAIXAS_ROLETA.flatMap((f, i): Item[] => {
  const raridade = ANIMAIS[f.tipo].raridade;
  const meio = f.grauInicio + f.largura / 2;
  const em = (ang: number, r: number, extra: Partial<Item>): Item => {
    const [x, y] = ponto(ang, r);
    return { faixa: i, tipo: f.tipo, x: +f2(x), y: +f2(y), raridade, ...extra };
  };
  const pct = `${pctFaixa(i)}%`;
  if (f.largura > 150) {
    // gomo enorme (galinha): retrato grande, dois "figurantes" e a chance longe do cubo
    return [
      em(f.grauInicio + f.largura * 0.2, 93, { tam: 50, halo: true }),
      em(f.grauInicio + f.largura * 0.8, 93, { tam: 50, halo: true }),
      em(meio, 75, { tam: 62, halo: true, principal: true }),
      em(f.grauInicio + f.largura * 0.66, 102, { pct, fonte: 24 }),
    ];
  }
  // pato: a chance fica no canto do gomo, longe do retrato (~50 unidades entre os centros) e da divisória
  if (f.largura > 60) return [em(meio, 76, { tam: 56, principal: true }), em(f.grauInicio + f.largura * 0.84, 98, { pct, fonte: 20 })];
  // ganso: gomo de 43°, retrato e chance empilhados no meio
  if (f.largura > 25) return [em(meio, 71, { tam: 43, principal: true }), em(meio, 111, { pct, fonte: 14 })];
  return []; // gomo estreito (avestruz): só a estrela dourada (ESTREITOS)
});
const RETRATOS = ITENS.filter((it) => it.tam);
const ROTULOS = ITENS.filter((it) => it.pct);

// Recorte do desenho do animal (canvas 120×120 com folga para o ninho): o retrato fica maior no mesmo espaço.
const RECORTE = '12 6 96 106';
const alturaRetrato = (tam: number) => (tam * 106) / 96;

/** Onde o item está NA TELA (o disco girado de `v` graus): é para lá que o retrato vencedor aponta ao voar ao cubo. */
function naTela(it: Item, v: number): [number, number] {
  const a = (v * Math.PI) / 180;
  return [it.x * Math.cos(a) - it.y * Math.sin(a), it.x * Math.sin(a) + it.y * Math.cos(a)];
}

/** Estrela de raios atrás do retrato do vencedor (12 pontas, raio externo r, interno 0,64·r). */
function estrelaDoVencedor(r: number): string {
  let d = '';
  for (let i = 0; i < 24; i++) {
    const [x, y] = ponto(i * 15, i % 2 ? r * 0.64 : r);
    d += `${i ? 'L' : 'M'}${f2(x)} ${f2(y)}`;
  }
  return `${d}Z`;
}

/**
 * Raio que o retrato do vencedor não invade: o medalhão (r 46) e a cabeça do bicho que fura a borda dele (~r 50). De
 * lado vale a caixa inteira (54); bem acima do cubo, a faixa de baixo da caixa é só a sombra sob os pés (~7 unidades
 * vazias), então ela pode descer até 48 e o premiado ganha ~10% de escala sem os pés tocarem a cabeça do medalhão.
 */
const livreDentro = (uy: number) => 54 - 6 * Math.max(0, Math.min(1, (-uy - 0.7) / 0.3));

/**
 * Onde o retrato principal do vencedor volta a ficar depois que a cópia voa para o cubo: na mesma direção (vista
 * na TELA), afastado do medalhão e com folga até a ponta do ponteiro (r 114) e o aro. O retrato é uma caixa em pé,
 * então o quanto ele "ocupa" na direção u é (largura·|ux| + altura·|uy|) / 2; a escala sai do espaço que sobra
 * (até 1,08: o premiado pode crescer um pouco). Devolve o deslocamento a partir do lugar original e a escala.
 */
function lugarDoVencedor(it: Item, sx: number, sy: number): { dx: number; dy: number; s: number } {
  const d = Math.hypot(sx, sy) || 1;
  const ux = sx / d;
  const uy = sy / d;
  const desvio = (Math.acos(Math.max(-1, Math.min(1, -uy))) * 180) / Math.PI; // 0° = bem embaixo do ponteiro
  const fora = 108 + 16 * Math.min(1, desvio / 30);
  const tam = it.tam ?? 0;
  const meia = (tam / 2) * Math.abs(ux) + (alturaRetrato(tam) / 2) * Math.abs(uy);
  const livre = livreDentro(uy);
  const s = Math.min(1.08, (fora - livre) / (2 * meia || 1));
  const alvo = livre + meia * s;
  return { dx: ux * alvo - sx, dy: uy * alvo - sy, s };
}

// Gomo estreito (lendário): estrela dourada grande, dois brilhinhos e um filete de ouro na borda.
const ESTREITOS = FAIXAS_ROLETA.flatMap((f) => {
  if (f.largura > 25) return [];
  const meio = f.grauInicio + f.largura / 2;
  return [
    {
      estrela: ponto(meio, 106),
      brilhos: [ponto(meio - f.largura * 0.26, 128), ponto(meio + f.largura * 0.24, 84)],
      filete: arco(f.grauInicio + 0.8, f.grauInicio + f.largura - 0.8, R_DISCO - 3),
    },
  ];
});
const LOSANGO = 'M0 -3.4 L1.3 0 L0 3.4 L-1.3 0 Z';

// Rastro do vencedor: quando a moeda estoura, o gomo premiado se enche de raios de luz saindo do cubo e duas
// cintilações piscam nos cantos de fora (longe do retrato, que volta para o meio do gomo, e da ponta do ponteiro),
// tudo pulsando junto com a borda.
const CINTILA_4 = 'M0 -10 C1.2 -2.6 2.6 -1.2 10 0 C2.6 1.2 1.2 2.6 0 10 C-1.2 2.6 -2.6 1.2 -10 0 C-2.6 -1.2 -1.2 -2.6 0 -10 Z';
const RASTRO_VENCE = FAIXAS_ROLETA.map((f) => {
  if (f.largura <= 25) return null; // gomo estreito: a estrela não voa, o gomo nunca fica vazio
  const meio = f.grauInicio + f.largura / 2;
  const passo = 12;
  const n = Math.floor((f.largura / 2 - 3.6) / passo);
  let raios = '';
  for (let k = -n; k <= n; k++) {
    const a = meio + k * passo;
    const [x1, y1] = ponto(a - 0.7, 44);
    const [x2, y2] = ponto(a + 0.7, 44);
    const [x3, y3] = ponto(a + 2.6, R_DISCO - 2);
    const [x4, y4] = ponto(a - 2.6, R_DISCO - 2);
    raios += `M${f2(x1)} ${f2(y1)}L${f2(x4)} ${f2(y4)}L${f2(x3)} ${f2(y3)}L${f2(x2)} ${f2(y2)}Z`;
  }
  const d = Math.min(f.largura * 0.34, 30);
  const cintilas: [number, number, number][] = [
    [...ponto(meio - d, 120), 0.95],
    [...ponto(meio + d, 114), 0.7],
  ];
  return { raios, cintilas };
});

// Textura de leque: cunhas finas alternadas (o gomo comum, mais claro, leva um leque mais forte).
function leque(a1: number, a2: number): string {
  let d = '';
  for (let a = Math.ceil(a1 / 6) * 6; a + 3 <= a2; a += 6) {
    const [x1, y1] = ponto(a, R_DISCO);
    const [x2, y2] = ponto(a + 3, R_DISCO);
    d += `M0 0L${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}Z`;
  }
  return d;
}
const fimComum = FAIXAS_ROLETA[0]!.grauInicio + FAIXAS_ROLETA[0]!.largura;
const LEQUE_COMUM = leque(0, fimComum);
const LEQUE_RESTO = leque(fimComum, 360);

const CINTILA = 'M0 -11 L1.3 -1.3 L11 0 L1.3 1.3 L0 11 L-1.3 1.3 L-11 0 L-1.3 -1.3 Z';
const LAMPADAS = Array.from({ length: 24 }, (_, i) => ponto(i * 15 + 7.5, R_LAMPADA));
const REBITES = Array.from({ length: 8 }, (_, i) => ponto(i * 45 + 22.5, 160));
const PINOS = Array.from({ length: 24 }, (_, i) => ponto(i * PINO, 135.5));
// tampas de ouro onde as divisórias encontram o aro (a de 0° coincide com um pino)
const TAMPAS = FAIXAS_ROLETA.filter((f) => f.grauInicio % PINO !== 0).map((f) => ponto(f.grauInicio, 135.5));

// Linhas de velocidade: só na faixa externa, perto do aro (nenhuma abaixo de r 112), longe do ponteiro.
const RASTRO: [string, number][] = (
  [
    [28, 74, 124, 6],
    [96, 128, 113, 5],
    [146, 196, 127, 6],
    [212, 246, 115, 5],
    [258, 302, 125, 6],
    [312, 338, 117, 5],
    [62, 88, 112, 4],
    [176, 204, 119, 4],
  ] as const
).map(([a1, a2, r, w]) => [arco(a1, a2, r), w]);
const REBITES_CUBO = Array.from({ length: 8 }, (_, i) => ponto(i * 45 + 22.5, 32));

// ---------------------------------------------------------------- confete (dois bursts, dentro do teto de partículas)
const CORES_CONFETE = ['#ffd23f', '#ff8ad8', '#8ad8ff', '#9dffb0', '#ffffff', '#ff7a5e'];
const CORES_OURO = ['#ffd23f', '#fff1a8', '#ffb800', '#ffffff', '#f5b301'];
/** Peças por burst [ponteiro, medalhão]: comum/raro 26, épico 36, lendário 40 (o teto do mobile). */
const QTD_CONFETE: Record<Raridade, [number, number]> = { comum: [14, 12], raro: [14, 12], epico: [18, 18], lendario: [20, 20] };

interface Peca {
  dx: number;
  dy: number;
  rot: number;
  cor: number;
  forma: number;
  atraso: number;
}

/** Leque para cima (do ponteiro) ou 360° (do medalhão). Valores "aleatórios" fixos, iguais em todo render. */
function burst(n: number, leque360: boolean, atraso0: number): Peca[] {
  return Array.from({ length: n }, (_, i) => {
    const ang = leque360 ? (i / n) * 360 + ((i * 47) % 19) - 9 : -170 + (i / (n - 1)) * 160 + ((i * 37) % 11) - 5;
    const dist = leque360 ? 92 + ((i * 53) % 70) : 96 + ((i * 53) % 84);
    const a = (ang * Math.PI) / 180;
    return {
      dx: Math.round(Math.cos(a) * dist * (leque360 ? 1.15 : 1.3)),
      dy: Math.round(Math.sin(a) * dist),
      rot: ((i * 97) % 540) - 270,
      cor: i,
      forma: i % 3,
      atraso: atraso0 + (i % 5) * 22,
    };
  });
}
const CONFETE: Record<Raridade, { ponteiro: Peca[]; medalhao: Peca[] }> = Object.fromEntries(
  (Object.keys(QTD_CONFETE) as Raridade[]).map((r) => [r, { ponteiro: burst(QTD_CONFETE[r][0], false, 0), medalhao: burst(QTD_CONFETE[r][1], true, 340) }]),
) as Record<Raridade, { ponteiro: Peca[]; medalhao: Peca[] }>;

const ESTRELA_5 = 'M0 -10 L2.6 -3.2 L9.6 -3.1 L4.1 1.3 L6 8.3 L0 4.3 L-6 8.3 L-4.1 1.3 L-9.6 -3.1 L-2.6 -3.2 Z';

function Confete({ pecas, raridade, x, y }: { pecas: Peca[]; raridade: Raridade; x: number; y: number }) {
  const cores = raridade === 'lendario' ? CORES_OURO : CORES_CONFETE;
  return (
    <g className="roda-confete" transform={`translate(${x} ${y})`}>
      {pecas.map((c, i) => {
        const cor = cores[c.cor % cores.length]!;
        return (
          <g key={i} style={{ '--dx': `${c.dx}px`, '--dy': `${c.dy}px`, '--rot': `${c.rot}deg`, animationDelay: `${c.atraso}ms` } as CSSProperties}>
            {c.forma === 0 ? (
              <rect x={-5} y={-9} width={10} height={18} rx={2.5} fill={cor} stroke="#2b1a0f" strokeWidth={1.6} />
            ) : c.forma === 1 ? (
              <circle r={6.2} fill={cor} stroke="#2b1a0f" strokeWidth={1.6} />
            ) : (
              <path d={ESTRELA_5} fill={cor} stroke="#2b1a0f" strokeWidth={1.8} strokeLinejoin="round" />
            )}
          </g>
        );
      })}
    </g>
  );
}

// Explosão de raios atrás do ponteiro (16 pontas, r 62). Ela gira, então não dá para tirar só as pontas de baixo: o
// recorte FORA_DO_DISCO corta tudo o que entra no disco (r < 138). Assim a explosão moldura o ponteiro sobre o aro e as
// lâmpadas, sem nunca cruzar o retrato do vencedor (que fica logo abaixo do ponteiro) nem as chances dos vizinhos.
const EXPLOSAO = (() => {
  let d = '';
  for (let i = 0; i < 32; i++) {
    const [x, y] = ponto(i * 11.25, i % 2 ? 22 : 62);
    d += `${i ? 'L' : 'M'}${f2(x)} ${f2(y)}`;
  }
  return `${d}Z`;
})();

const R_RECORTE = 138;
const FORA_DO_DISCO = `M-420 -420H420V420H-420Z M0 ${-R_RECORTE}A${R_RECORTE} ${R_RECORTE} 0 1 1 0 ${R_RECORTE}A${R_RECORTE} ${R_RECORTE} 0 1 1 0 ${-R_RECORTE}Z`;

const ROTULO = `Roleta: ${FAIXAS_ROLETA.map((f, i) => `${NOME_TIPO[f.tipo].toLowerCase()} ${pctFaixa(i)}%`).join(', ')}`;

export interface PropsRoda {
  /** Rotação do disco em graus (sentido horário). */
  rotacao: MotionValue<number>;
  /** Índice da faixa vencedora em destaque (ou null). */
  destaque: number | null;
  /** Lâmpadas piscando rápido enquanto gira. */
  girando: boolean;
  className?: string;
}

// memo: re-renders da tela (botão afundado, fase) não refazem os ~10 desenhos de animal no meio do giro
export const Roda = memo(function Roda({ rotacao, destaque, girando, className = 'w-full' }: PropsRoda) {
  const disco = useRef<SVGGElement>(null);
  const itens = useRef<(SVGGElement | null)[]>([]);
  const fantasma1 = useRef<SVGGElement>(null);
  const fantasma2 = useRef<SVGGElement>(null);
  const rastro = useRef<SVGGElement>(null);
  const conteudo = useRef<SVGGElement>(null);
  const ponteiroG = useRef<SVGGElement>(null);
  const ponteiro = useMotionValue(0);

  useEffect(() => {
    let ultimoV = rotacao.get();
    let ultimoT = performance.now();
    let pino = Math.floor(ultimoV / PINO);
    let vel = 0;
    let suave = 0;
    let mola: AnimationPlaybackControls | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // s = 0 (parada) … 1 (velocidade máxima): a cor continua viva; a velocidade fica nos traços e nos fantasmas.
    const borrao = (s: number) => {
      const lag = s * 14;
      rastro.current?.setAttribute('opacity', s < 0.1 ? '0' : f2(s));
      conteudo.current?.setAttribute('opacity', f2(1 - 0.25 * s));
      fantasma1.current?.setAttribute('transform', `rotate(${f2(-lag)})`);
      fantasma1.current?.setAttribute('opacity', f2(0.28 * s));
      fantasma2.current?.setAttribute('transform', `rotate(${f2(-lag * 2)})`);
      fantasma2.current?.setAttribute('opacity', f2(0.14 * s));
    };
    const aplicar = (v: number) => {
      disco.current?.setAttribute('transform', `rotate(${f2(v)})`);
      // itens "de roda-gigante": sempre em pé, contra-girando dentro do disco
      ITENS.forEach((it, j) => itens.current[j]?.setAttribute('transform', `translate(${it.x} ${it.y}) rotate(${f2(-v)})`));
    };
    aplicar(ultimoV);

    const desligaRoda = rotacao.on('change', (v) => {
      const t = performance.now();
      const dt = t - ultimoT;
      const d = v - ultimoV;
      ultimoV = v;
      ultimoT = t;
      aplicar(v);
      // salto (set direto, crossfade do reduzir movimento) não é giro: sem borrão nem chute no ponteiro
      const salto = dt > 140 || Math.abs(d) > 120;
      if (salto) vel = 0;
      else if (dt > 0) vel = d / (dt / 1000);
      suave += (Math.min(1, Math.abs(vel) / 1300) - suave) * 0.35;
      borrao(suave);
      clearTimeout(timer);
      timer = setTimeout(() => {
        suave = 0;
        vel = 0;
        borrao(0);
      }, 120);
      const p = Math.floor(v / PINO);
      if (p !== pino) {
        pino = p;
        if (!salto && d !== 0) {
          // chute do pino: o ponteiro é empurrado no sentido do giro e volta na mola. jump() zera a velocidade
          // do MotionValue (um set() seria lido como velocidade gigante e a mola daria voltas inteiras).
          const amp = Math.min(28, 8 + Math.abs(vel) / 60);
          mola?.stop();
          ponteiro.jump(-Math.sign(d) * amp);
          mola = animate(ponteiro, 0, MOLA_PONTEIRO);
        }
      }
    });
    const desligaPonteiro = ponteiro.on('change', (a) => {
      const a2 = Math.max(-PONTEIRO_MAX, Math.min(PONTEIRO_MAX, a));
      ponteiroG.current?.setAttribute('transform', `rotate(${f2(a2)} 0 ${PIVO_Y})`);
    });
    return () => {
      desligaRoda();
      desligaPonteiro();
      clearTimeout(timer);
      mola?.stop();
    };
  }, [rotacao, ponteiro]);

  const v0 = rotacao.get();
  const vencedora = destaque !== null ? FAIXAS_ROLETA[destaque] : undefined;
  const rarVence = destaque !== null ? raridadeDaFaixa(destaque) : null;
  const classes = ['roda select-none overflow-visible', girando && 'roda-girando', vencedora && 'roda-vitoria', className].filter(Boolean).join(' ');
  const setorVence = vencedora ? (r: number) => setor(vencedora.grauInicio, vencedora.grauInicio + vencedora.largura, r) : null;
  const rastroVence = destaque !== null ? RASTRO_VENCE[destaque] : null;

  return (
    <svg viewBox="-176 -190 352 396" className={classes} role="img" aria-label={ROTULO} data-raridade={rarVence ?? undefined}>
      {/* ------------------------------------------------ cavalete e base (atrás) */}
      <ellipse cx="0" cy="200" rx="134" ry="7" fill="#2a1840" opacity="0.2" />
      <g stroke="#3b200c" strokeWidth={7} paintOrder="stroke" strokeLinejoin="round">
        <path d="M-30 10 L-8 10 L-60 184 L-92 184 Z" fill="url(#gi-roda-madeira-h)" />
        <path d="M30 10 L8 10 L60 184 L92 184 Z" fill="url(#gi-roda-madeira-h)" />
        <rect x="-122" y="176" width="244" height="24" rx="10" fill="url(#gi-roda-madeira)" />
      </g>
      <path d="M-112 180.5 H112" stroke="#ffe2b0" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      <path d="M-60 188 H-20 M10 193 H70 M-100 193 H-76" stroke="#7a4a22" strokeWidth={1.4} strokeLinecap="round" opacity={0.55} />
      {[-110, 110].map((x) => (
        <circle key={x} cx={x} cy={188} r={2.6} fill="#8a5a22" stroke="#4a2c00" strokeWidth={1.2} />
      ))}

      {/* ------------------------------------------------ moldura: madeira + aro de ouro */}
      <circle cx="0" cy="7" r="167" fill="#2a1030" opacity="0.28" />
      <circle r="166" fill="url(#gi-roda-madeira)" stroke="#3b200c" strokeWidth={7} paintOrder="stroke" />
      <circle r="160" fill="none" stroke="#7a4a22" strokeWidth={1} opacity={0.45} />
      {/* rebites de bronze escuro: discretos, para as lâmpadas serem o único anel brilhante */}
      {REBITES.map(([x, y], i) => (
        <g key={i}>
          <circle cx={f2(x)} cy={f2(y)} r={2.4} fill="#8a5a22" stroke="#3b200c" strokeWidth={1} />
          <circle cx={f2(x - 0.7)} cy={f2(y - 0.8)} r={0.7} fill="#e7b47a" />
        </g>
      ))}
      <circle r="153" fill="url(#gi-roda-aro)" stroke="#4a2c00" strokeWidth={3} />
      <circle r="150.5" fill="none" stroke="#fff8d0" strokeWidth={1.5} opacity={0.85} />
      <circle r="137.5" fill="none" stroke="url(#gi-roda-aro-chanfro)" strokeWidth={4} />

      {/* ------------------------------------------------ lâmpadas (CSS: sequência em repouso, pisca ao girar) */}
      {LAMPADAS.map(([x, y], i) => (
        <g key={i} transform={`translate(${f2(x)} ${f2(y)})`}>
          <circle r={6} fill="url(#gi-roda-lampada-off)" stroke="#4a2c00" strokeWidth={1.5} />
          <circle cx={-1.5} cy={-1.5} r={1.6} fill="#fff" opacity={0.5} />
          <g className="roda-lampada-acesa" style={{ '--i': i, '--par': i % 2 } as CSSProperties}>
            <circle r={15} fill="url(#gi-roda-lampada-halo)" />
            <circle r={6} fill="url(#gi-roda-lampada)" stroke="#6a4300" strokeWidth={1.5} />
            {/* cintilação em cruz: lê como "luz" mesmo sobre o aro dourado */}
            <path d={CINTILA} fill="#fff" opacity={0.95} />
            <circle cx={-1.9} cy={-2.1} r={1.7} fill="#fff" />
          </g>
        </g>
      ))}

      {/* ------------------------------------------------ disco (gira) */}
      <g ref={disco} data-disco="" transform={`rotate(${f2(v0)})`}>
        {FAIXAS_ROLETA.map((f, i) => (
          <path key={f.tipo} d={setor(f.grauInicio, f.grauInicio + f.largura, R_DISCO)} fill={GOMO[raridadeDaFaixa(i)]} />
        ))}
        <path d={LEQUE_COMUM} fill="#ffffff" opacity={0.18} />
        <path d={LEQUE_RESTO} fill="#ffffff" opacity={0.13} />
        {/* fantasmas do borrão de movimento (opacidade e atraso escritos por quadro) */}
        {[fantasma1, fantasma2].map((ref, k) => (
          <g key={k} ref={ref} opacity={0}>
            {FAIXAS_ROLETA.map((f, i) => (
              <path key={f.tipo} d={setor(f.grauInicio, f.grauInicio + f.largura, R_DISCO)} fill={GOMO[raridadeDaFaixa(i)]} />
            ))}
          </g>
        ))}
        {/* brilho do gomo vencedor (embaixo dos retratos): cor da raridade, mais saturado, nunca lavado */}
        {setorVence && rarVence && <path key={`v${destaque}`} className="roda-vencedor" d={setorVence(R_DISCO)} fill={`url(#gi-roda-vencedor-${rarVence})`} />}
        {/* raios do cubo para fora no gomo premiado (entram quando a moeda estoura) */}
        {rastroVence && rarVence && (
          <g key={`r${destaque}`} className="roda-rastro" pointerEvents="none">
            <path d={rastroVence.raios} fill="#ffffff" opacity={0.36} />
          </g>
        )}
        {/* gomo estreito: filete de ouro na borda */}
        {ESTREITOS.map((e, i) => (
          <g key={i} fill="none" strokeLinecap="round">
            <path d={e.filete} stroke="#6a4300" strokeWidth={6.5} />
            <path d={e.filete} stroke="#ffd84d" strokeWidth={3.5} />
          </g>
        ))}
        {/* divisórias */}
        <g strokeLinecap="round">
          {FAIXAS_ROLETA.map((f) => {
            const [x1, y1] = ponto(f.grauInicio, 36);
            const [x2, y2] = ponto(f.grauInicio, R_DISCO);
            const d = `M${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}`;
            return (
              <g key={f.tipo}>
                <path d={d} stroke="#4a2c00" strokeWidth={6} />
                <path d={d} stroke="#fff8e0" strokeWidth={3} />
              </g>
            );
          })}
        </g>
        {/* pinos que batem no ponteiro: cravados na borda interna do aro, meio sobre o ouro */}
        {PINOS.map(([x, y], i) => (
          <g key={i}>
            <circle cx={f2(x)} cy={f2(y)} r={2.6} fill="url(#gi-roda-ouro)" stroke="#4a2c00" strokeWidth={1.1} />
            <circle cx={f2(x - 0.8)} cy={f2(y - 0.8)} r={0.8} fill="#fff" opacity={0.7} />
          </g>
        ))}
        {TAMPAS.map(([x, y], i) => (
          <g key={i}>
            <circle cx={f2(x)} cy={f2(y)} r={3.4} fill="url(#gi-roda-ouro)" stroke="#4a2c00" strokeWidth={1.2} />
            <circle cx={f2(x - 1)} cy={f2(y - 1)} r={1} fill="#fff" opacity={0.75} />
          </g>
        ))}
        {/* retratos, chances e a estrela do lendário */}
        <g ref={conteudo}>
          {ESTREITOS.map((e, i) => (
            <g key={i}>
              <path
                d={ESTRELA_5}
                transform={`translate(${f2(e.estrela[0])} ${f2(e.estrela[1])}) scale(0.9)`}
                fill="url(#gi-roda-ouro)"
                stroke="#4a2c00"
                strokeWidth={3.4}
                paintOrder="stroke"
                strokeLinejoin="round"
              />
              {e.brilhos.map(([x, y], k) => (
                <path key={k} d={LOSANGO} transform={`translate(${f2(x)} ${f2(y)})`} fill="#fff" stroke="#6a4300" strokeWidth={0.8} />
              ))}
            </g>
          ))}
          {RETRATOS.map((it) => {
            const j = ITENS.indexOf(it);
            const tam = it.tam!;
            const alt = alturaRetrato(tam);
            const voa = it.principal && destaque === it.faixa;
            // os outros retratos do gomo premiado (os figurantes da galinha) não ficam sob o véu: encolhem e
            // esmaecem, para o vencedor ser o único bicho em destaque
            const figurante = !it.principal && destaque === it.faixa;
            // o retrato fica no referencial da TELA (contra-gira dentro do disco): o caminho até o cubo é só
            // "menos a posição dele na tela", calculada com a rotação final (a tela fixa o ângulo antes do destaque)
            const [sx, sy] = voa ? naTela(it, v0) : [0, 0];
            const volta = voa ? lugarDoVencedor(it, sx, sy) : null;
            const figura = (
              // svg aninhado dá o tamanho e recorta a margem do desenho (o <svg> do animal ocupa 100% dele)
              <svg x={-tam / 2} y={-alt / 2} width={tam} height={alt} viewBox={RECORTE} overflow="visible">
                <FiguraAnimal tipo={it.tipo} ninho={false} detalhe="p" humor="feliz" className="roda-retrato" atrasoS={j * 0.7} />
              </svg>
            );
            return (
              <g
                key={j}
                ref={(el) => {
                  itens.current[j] = el;
                }}
                transform={`translate(${it.x} ${it.y}) rotate(${f2(-v0)})`}
              >
                {/* o vencedor que FICA: nunca some. Está no lugar desde o primeiro quadro (por baixo da cópia que salta),
                    desliza para o lugar livre quando a cópia decola, ganha estrela de raios girando + luz na cor da
                    raridade + anel que se abre, e saltita no compasso da borda: o bicho mais vistoso da roda */}
                {volta && (
                  <g
                    key={`fica${destaque}`}
                    className="roda-retrato-fica"
                    style={{ '--fx': `${f2(volta.dx)}px`, '--fy': `${f2(volta.dy)}px`, '--fs': f2(volta.s) } as CSSProperties}
                  >
                    <path
                      className="roda-retrato-raios"
                      d={estrelaDoVencedor(alt * 0.7)}
                      fill={BRILHO[it.raridade]}
                      stroke="#ffffff"
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                      opacity={0.9}
                    />
                    <circle className="roda-retrato-luz" r={alt * 0.62} fill={`url(#gi-roda-rastro-${it.raridade})`} />
                    <circle className="roda-retrato-anel" r={alt * 0.56} fill="none" stroke="#ffffff" strokeWidth={4} />
                    <g className="roda-retrato-pula" style={{ transformOrigin: `0px ${f2(alt / 2)}px` }}>
                      {figura}
                    </g>
                  </g>
                )}
                {/* a cópia que voa para o cubo (ou o retrato de sempre) */}
                <g
                  key={voa ? 'voa' : figurante ? 'figurante' : 'quieto'}
                  className={voa ? 'roda-retrato-voa' : figurante ? 'roda-figurante' : undefined}
                  style={voa ? ({ '--vx': `${f2(-sx)}px`, '--vy': `${f2(-sy)}px` } as CSSProperties) : undefined}
                >
                  {it.halo && <circle r={tam * 0.6} fill="url(#gi-roda-brilho)" />}
                  {figura}
                </g>
              </g>
            );
          })}
        </g>
        {/* chances escritas: não esmaecem com a velocidade */}
        <g>
          {ROTULOS.map((it) => {
            const j = ITENS.indexOf(it);
            const fonte = it.fonte ?? 16;
            const yTexto = fonte * 0.36;
            // na vitória a chance do vencedor some (ela fica sob o ponteiro): o medalhão já diz o resultado
            const apagado = destaque === it.faixa;
            return (
              <g
                key={j}
                ref={(el) => {
                  itens.current[j] = el;
                }}
                transform={`translate(${it.x} ${it.y}) rotate(${f2(-v0)})`}
              >
                <g
                  className={apagado ? 'roda-rotulo roda-rotulo-apagado' : 'roda-rotulo'}
                  fontFamily="var(--font-titulo)"
                  fontSize={fonte}
                  textAnchor="middle"
                  strokeLinejoin="round"
                >
                  <text y={yTexto + fonte * 0.12} fill={CONTORNO[it.raridade]} stroke={CONTORNO[it.raridade]} strokeWidth={fonte * 0.32}>
                    {it.pct}
                  </text>
                  <text y={yTexto} fill="#fff" stroke={CONTORNO[it.raridade]} strokeWidth={fonte * 0.32} paintOrder="stroke">
                    {it.pct}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
        {/* cintilações do rastro: sempre em pé (o disco está parado na vitória), piscando em tempos diferentes */}
        {rastroVence && rarVence && (
          <g key={`ci${destaque}`} className="roda-rastro-cintilas" pointerEvents="none">
            {rastroVence.cintilas.map(([x, y, s], k) => (
              <g key={k} transform={`translate(${f2(x)} ${f2(y)}) rotate(${f2(-v0)}) scale(${s})`}>
                <path
                  className="roda-cintila"
                  style={{ animationDelay: `${k * 360}ms` }}
                  d={CINTILA_4}
                  fill="#ffffff"
                  stroke={CONTORNO[rarVence]}
                  strokeWidth={2.2}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                />
              </g>
            ))}
          </g>
        )}
        {/* destaque: véu azul-noite nos perdedores ("holofote") e borda pulsante na cor da raridade */}
        {vencedora &&
          FAIXAS_ROLETA.map((f, i) =>
            i === destaque ? null : (
              <path key={`veu${f.tipo}`} className="roda-veu" d={setor(f.grauInicio, f.grauInicio + f.largura, R_DISCO)} fill="#0d1026" />
            ),
          )}
        {setorVence && rarVence && (
          <g key={`b${destaque}`} className="roda-vencedor-borda" fill="none" strokeLinejoin="round">
            <path d={setorVence(R_DISCO - 3.5)} stroke={CONTORNO[rarVence]} strokeWidth={9} />
            <path d={setorVence(R_DISCO - 3.5)} stroke={BRILHO[rarVence]} strokeWidth={6} />
            <path d={setorVence(R_DISCO - 3.5)} stroke="#fff" strokeWidth={1.8} />
          </g>
        )}
        {/* anel do cubo (gira junto: denuncia o giro mesmo com o emblema parado) */}
        <circle r="38" fill="url(#gi-roda-aro)" stroke="#4a2c00" strokeWidth={3} />
        {REBITES_CUBO.map(([x, y], i) => (
          <circle key={i} cx={f2(x)} cy={f2(y)} r={2.2} fill="#8a5a22" stroke="#4a2c00" strokeWidth={1} />
        ))}
      </g>

      {/* ------------------------------------------------ volume estático por cima do disco */}
      <circle r={R_DISCO} fill="url(#gi-roda-vinheta)" pointerEvents="none" />
      <path d="M-118 -62 A134 134 0 0 1 62 -119" fill="none" stroke="#3b1d0c" strokeWidth={7} strokeLinecap="round" opacity={0.16} />
      <ellipse cx="-52" cy="-64" rx="66" ry="30" transform="rotate(-38 -52 -64)" fill="url(#gi-roda-brilho)" opacity={0.42} />
      {/* linhas de velocidade (opacidade pela velocidade): traço branco com miolo amarelo-claro */}
      <g ref={rastro} opacity={0} fill="none" strokeLinecap="round">
        {RASTRO.map(([d, w], i) => (
          <g key={i}>
            <path d={d} stroke="#ffffff" strokeOpacity={0.9} strokeWidth={w} />
            <path d={d} stroke="#fff3a0" strokeWidth={2} />
          </g>
        ))}
      </g>

      {/* ------------------------------------------------ emblema central (parado): ovo dourado */}
      <circle cx="0" cy="3" r="27" fill="#3b1d0c" opacity={0.3} />
      <circle r="26" fill="url(#gi-roda-ouro)" stroke="#4a2c00" strokeWidth={7} paintOrder="stroke" />
      <circle r="20.5" fill="none" stroke="#c27c00" strokeWidth={2} />
      <circle r="24.2" fill="none" stroke="#fff8d0" strokeWidth={1.1} opacity={0.8} />
      <path
        d="M0 -15 C7.5 -15 11.5 -4.5 11.5 2.5 C11.5 9.5 6.5 14 0 14 C-6.5 14 -11.5 9.5 -11.5 2.5 C-11.5 -4.5 -7.5 -15 0 -15 Z"
        fill="url(#gi-roda-ovo)"
        stroke="#6a4300"
        strokeWidth={2.2}
      />
      <ellipse cx="-4" cy="-6" rx="2.3" ry="4" transform="rotate(22 -4 -6)" fill="#fff" opacity={0.85} />
      <path d="M4.4 4.6 l1.1 2.3 2.5.3-1.9 1.7.5 2.5-2.2-1.2-2.2 1.2.5-2.5-1.9-1.7 2.5-.3z" fill="#fff" opacity={0.9} />

      {/* ------------------------------------------------ vitória: ondas + medalhão do animal sorteado saltando do cubo */}
      {vencedora && rarVence && (
        <g key={`m${destaque}`}>
          {(rarVence === 'lendario' ? [0, 1] : [0]).map((k) => (
            <circle
              key={k}
              className="roda-onda"
              r="46"
              fill="none"
              stroke={BRILHO[rarVence]}
              strokeWidth={6}
              style={{ animationDelay: `${320 + k * 220}ms` }}
            />
          ))}
          {/* moeda de ouro com o fundo na cor PROFUNDA da raridade: a ave branca se destaca (nada de branco no
              branco). O bicho fica de corpo inteiro, pés no chão da moeda, e a cabeça "fura" a borda de cima. */}
          <g className="roda-medalhao">
            {/* 1,2× (≈ 92 de diâmetro): cobre o cubo inteiro e é o herói da vitória */}
            <g transform="scale(1.2)">
              <circle r="39" cy="3" fill="#2a1030" opacity={0.3} />
              <circle r="38" fill="url(#gi-roda-aro)" stroke="#4a2c00" strokeWidth={3} />
              <circle r="35.6" fill="none" stroke="#fff8d0" strokeWidth={1.2} opacity={0.85} />
              <circle r="32" fill={`url(#gi-roda-moeda-${rarVence})`} stroke={CONTORNO[rarVence]} strokeWidth={2.5} />
              <path d="M-24 -14 A28 28 0 0 1 4 -28.6" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" opacity={0.45} />
              <ellipse cy="23" rx="21" ry="5" fill={CONTORNO[rarVence]} opacity={0.35} />
              <svg x={-32} y={23 - (64 * 106.6) / 96} width={64} height={(64 * 106) / 96} viewBox={RECORTE} overflow="visible">
                <FiguraAnimal tipo={vencedora.tipo} ninho={false} detalhe="m" humor="feliz" className="roda-retrato" />
              </svg>
            </g>
          </g>
        </g>
      )}

      {/* ------------------------------------------------ vitória: explosão de raios atrás do ponteiro */}
      {vencedora && rarVence && (
        <g key={`e${destaque}`}>
          <defs>
            <clipPath id="gi-roda-fora-do-disco">
              <path d={FORA_DO_DISCO} clipRule="evenodd" />
            </clipPath>
          </defs>
          <g clipPath="url(#gi-roda-fora-do-disco)">
            <g transform="translate(0 -150)">
              {rarVence === 'lendario' && (
                <path className="roda-explosao roda-explosao-2" d={EXPLOSAO} fill="#fff1a8" stroke="#ffffff" strokeWidth={2} strokeLinejoin="round" />
              )}
              <path className="roda-explosao" d={EXPLOSAO} fill={BRILHO[rarVence]} stroke="#fff8d0" strokeWidth={2.5} strokeLinejoin="round" />
            </g>
          </g>
        </g>
      )}

      {/* ------------------------------------------------ ponteiro (mola a cada pino) */}
      {/* suporte do ponteiro: peça de ouro com bisel e dois rebites, no mesmo estilo do aro */}
      <g>
        <rect x={-24} y={-184} width={48} height={24} rx={6} fill="#3b200c" opacity={0.28} transform="translate(0 2.5)" />
        <rect x={-24} y={-184} width={48} height={24} rx={6} fill="url(#gi-roda-aro)" stroke="#4a2c00" strokeWidth={3} />
        <path d="M-18.5 -181.2 H18.5" stroke="#fff8d0" strokeWidth={1.5} strokeLinecap="round" />
        <path d="M-19 -163.6 H19" stroke="#a86400" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
        {[-16.5, 16.5].map((x) => (
          <g key={x}>
            <circle cx={x} cy={-172} r={2.4} fill="#8a5a22" stroke="#3b200c" strokeWidth={1} />
            <circle cx={x - 0.7} cy={-172.8} r={0.7} fill="#e7b47a" />
          </g>
        ))}
      </g>
      <g ref={ponteiroG}>
        <path d="M0 -114 C-5 -124 -18 -140 -18 -156 A18 18 0 1 1 18 -156 C18 -140 5 -124 0 -114 Z" transform="translate(3 5)" fill="#2a1030" opacity={0.28} />
        <path
          d="M0 -114 C-5 -124 -18 -140 -18 -156 A18 18 0 1 1 18 -156 C18 -140 5 -124 0 -114 Z"
          fill="url(#gi-roda-ponteiro)"
          stroke="#5c0a05"
          strokeWidth={7}
          paintOrder="stroke"
          strokeLinejoin="round"
        />
        <path d="M-11 -150 C-11 -140 -5 -130 -1.5 -123" fill="none" stroke="#ffd0c8" strokeWidth={2.4} strokeLinecap="round" opacity={0.7} />
        <ellipse cx="-8" cy="-164" rx="4" ry="6" transform="rotate(30 -8 -164)" fill="#fff" opacity={0.7} />
        <circle cx="0" cy={PIVO_Y} r={7} fill="url(#gi-roda-ouro)" stroke="#4a2c00" strokeWidth={2} />
        <circle cx="-2" cy={PIVO_Y - 2.2} r={2} fill="#fff" />
      </g>

      {/* ------------------------------------------------ confete: leque do ponteiro + anel do medalhão */}
      {vencedora && rarVence && (
        <g key={`c${destaque}`}>
          <Confete pecas={CONFETE[rarVence].ponteiro} raridade={rarVence} x={0} y={-128} />
          <Confete pecas={CONFETE[rarVence].medalhao} raridade={rarVence} x={0} y={0} />
        </g>
      )}
    </svg>
  );
});

// ---------------------------------------------------------------- palco (roda + raios de sol + legenda)

export interface PropsPalco extends PropsRoda {
  /** Sobreposição (ex.: "toque para pular"), posicionada sobre a base da roda. */
  children?: React.ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  palcoClassName?: string;
}

/** Roda montada no palco: raios de sol girando atrás e a plaquinha com a chance do gomo estreito. */
export function PalcoRoda({ children, onClick, style, palcoClassName, ...roda }: PropsPalco) {
  const rar = roda.destaque !== null ? raridadeDaFaixa(roda.destaque) : undefined;
  const estreitos = FAIXAS_ROLETA.map((f, i) => ({ f, i })).filter(({ f }) => f.largura <= 25);
  return (
    <div className={['roleta-palco', palcoClassName].filter(Boolean).join(' ')} style={style} onClick={onClick} role="presentation">
      {/* a janela redonda NÃO gira: os raios giram dentro dela, então a página nunca ganha rolagem lateral */}
      <div className="roleta-raios-janela" aria-hidden>
        <div className="roleta-raios" data-raridade={rar} />
      </div>
      <div className="roleta-halo" aria-hidden />
      <Roda {...roda} />
      {estreitos.length > 0 && (
        <div className="roleta-legenda" aria-hidden>
          {estreitos.map(({ f, i }) => (
            <span key={f.tipo} className="pilula" data-raridade={raridadeDaFaixa(i)}>
              <svg viewBox="-11 -11 22 22">
                <path d={ESTRELA_5} fill="#fff1a8" stroke="#4a2c00" strokeWidth={2} strokeLinejoin="round" />
              </svg>
              {NOME_TIPO[f.tipo]} {pctFaixa(i)}%
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

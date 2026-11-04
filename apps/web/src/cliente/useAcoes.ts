'use client';

// Ações do jogador com toda a "encenação": antecipação, revelação, sons, vibração, toasts e
// avanço do tutorial. As regras de verdade ficam no servidor; aqui só a experiência (GDD 3.3 e 3.8).
import type { EntityDTO, Inventario } from '@galinheiro/api-contract';
import { NOME_TIPO_PLURAL_OVO, tipoDoItem, type Item } from '@galinheiro/game-core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { ErroApi } from './api';
import {
  CHAVE_ESTADO, useAmpliar, useAvancarTutorial, useColetar, useColetarTodos, useVender, type Estado,
} from './estado';
import { som } from './som';
import { toast, useUi } from './ui';
import { mensagemDeErro, moedas } from './util';
import { vibracao } from './vibracao';

/** Etapas do tutorial (GDD 5.2). */
export const ETAPA = {
  BOAS_VINDAS: 0,
  CONHECER: 1,
  PRIMEIRA_COLETA: 2,
  PRIMEIRA_VENDA: 3,
  PRIMEIRO_GIRO: 4,
  NOMEAR: 5,
  COLETAR_NOVO: 6,
  RITMO: 7,
  CONCLUIDO: 8,
} as const;

const elementoNinho = (slot: number | null): HTMLElement | null =>
  slot === null ? null : document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);

/** Ninho visível na tela (os de fora não emitem ovos no Coletar Todos). */
const naTela = (r: DOMRect): boolean => r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;

// Coreografia (DIRECAO_DE_ARTE 8.3): os ovos saltam do ninho com 60 ms entre si; no Coletar Todos os
// ninhos disparam com 40 ms entre si e no máximo 12 ovos voam ao todo.
const PASSO_OVO_MS = 60;
const PASSO_NINHO_MS = 40;
const MAX_OVOS_VOANDO = 12;
const MAX_MAIS_N = 16;
/** No Coletar Todos os "+N" ganham 60 ms a mais entre si (não nascem todos colados). */
const PASSO_MAIS_N_EXTRA_MS = 60;
/** Atraso entre a saída dos ovos e o "+N" (o rótulo nasce quando o ovo já saltou). */
const ATRASO_MAIS_N_MS = 450;

// ------------------------------------------------------------------ rótulos do Coletar Todos
// Os "+N"/"UAU!" de ninhos vizinhos não podem se sobrepor nem cobrir as cabeças: cada rótulo ocupa uma caixa
// (meia-largura × meia-altura, já contando a subida) durante a parte legível da animação; um rótulo que bate
// noutro espera ele começar a sumir. No máximo 4 rótulos legíveis ao mesmo tempo; um "+N" comum que esperaria
// demais (> 1,2 s) sai sem rótulo (o toast já soma tudo). Jackpot NUNCA fica sem rótulo nem vira "+N" comum:
// todo jackpot leva o "UAU!" e, se o lugar estiver ocupado, espera a vez (até 1,8 s; no limite sai mesmo assim).
// Nada de desviar para o lado: o rótulo fora do próprio ninho parecia ser do vizinho.
const MAX_ROTULOS_JUNTOS = 4;
const ESPERA_MAX_ROTULO_MS = 1200;
const ESPERA_MAX_JACKPOT_MS = 1800;
/** Parte legível do "+N" (mais-n-coleta: segura até 55% de 900 ms) e do "UAU!" (mais-n-longo: 72% de 1400 ms). */
const LEGIVEL_MAIS_N_MS = 560;
const LEGIVEL_UAU_MS = 1000;
/** Duração inteira do "UAU!" (mais-n-longo, 1400 ms): enquanto ele vive, o "!" do ninho se esconde. */
const DURACAO_UAU_MS = 1400;
/** Duração inteira do "+N" (mais-n-coleta / mais-n-curto, 900 ms). */
const DURACAO_MAIS_N_MS = 900;
const CAIXA_MAIS_N = { mw: 28, mh: 24 };
/** Rótulo "curto" (dentro do próprio ninho, sobe no máximo 12 px): caixa mais baixa. */
const CAIXA_MAIS_N_CURTO = { mw: 26, mh: 17 };
/**
 * O "UAU!" sai 120 ms depois do clarão: no pico do salto (~300 ms) os ovos ainda pairam sobre o ninho e
 * passariam por cima das letras; assim ele estoura quando os ovos já partem para o HUD (e fica por cima deles).
 */
const ATRASO_UAU_EXTRA_MS = 120;
/**
 * Jackpots vizinhos (em qualquer direção, inclusive em cima/embaixo e na diagonal) não estouram juntos: o
 * segundo sai pelo menos 220 ms depois do primeiro (ovos, clarão, raios, confete e "UAU!" juntos), senão os
 * clarões viram uma mancha só sobre 2–3 ninhos e não dá para ver quem ganhou.
 */
const PASSO_JACKPOT_VIZINHO_MS = 220;

/**
 * Fonte (px do "+N") do "UAU! +N" curto, em uma linha no alto do próprio ninho, e a meia-largura dele: cabe na
 * largura do ninho (no 320 px, ninho de 61 px, fica com 18 px; no celular comum, 23 px; no desktop, 32 px).
 * `medio` (jackpot escalonado, outro levou o "UAU!" grande): 10% menor, nunca abaixo de 18 px.
 */
export function medidaUauCurto(largura: number, medio = false): { fonte: number; meia: number } {
  const base = Math.round(Math.min(32, Math.max(18, largura * 0.3)));
  const fonte = medio ? Math.max(18, Math.round(base * 0.9)) : base;
  return { fonte, meia: Math.round(fonte * 1.72) };
}

/**
 * Fonte (px do "+N") e meia-largura do "UAU! +N" em duas linhas ("UAU!" pequeno sobre o "+N"), o da 1ª fileira e
 * o da coleta individual: acompanha a largura do ninho (34 px no celular, ~41 px no desktop). `medio`: jackpot
 * escalonado (84%). Hierarquia: o primeiro jackpot ≥ os escalonados ≥ os de dentro do ninho (medidaUauCurto,
 * no máximo 32 px).
 */
export function medidaUauGrande(largura: number, medio = false): { fonte: number; meia: number } {
  const base = Math.round(Math.min(42, Math.max(34, largura * 0.34)));
  const fonte = medio ? Math.round(base * 0.84) : base;
  return { fonte, meia: Math.round(fonte * 1.53) };
}

interface RotuloNaTela {
  x: number;
  y: number;
  mw: number;
  mh: number;
  ini: number;
  fim: number;
}

/** Reserva lugar e hora para um rótulo; devolve a espera extra (ms) ou null (sai sem rótulo; nunca para jackpot). */
function agendarRotulo(lista: RotuloNaTela[], caixa: Omit<RotuloNaTela, 'ini' | 'fim'>, ini: number, legivel: number, jackpot = false): number | null {
  const esperaMax = jackpot ? ESPERA_MAX_JACKPOT_MS : ESPERA_MAX_ROTULO_MS;
  let t = ini;
  for (let tentativa = 0; tentativa < 12; tentativa++) {
    const juntos = lista.filter((a) => a.ini < t + legivel && t < a.fim);
    const batem = juntos.filter((a) => Math.abs(a.x - caixa.x) < a.mw + caixa.mw && Math.abs(a.y - caixa.y) < a.mh + caixa.mh);
    if (juntos.length < MAX_ROTULOS_JUNTOS && !batem.length) {
      lista.push({ ...caixa, ini: t, fim: t + legivel });
      return t - ini;
    }
    const proximo = Math.min(...(batem.length ? batem : juntos).map((a) => a.fim));
    if (proximo - ini > esperaMax) {
      if (!jackpot) return null;
      break;
    }
    t = proximo;
  }
  // jackpot sem vaga: sai no último horário tentado (a celebração não some)
  lista.push({ ...caixa, ini: t, fim: t + legivel });
  return t - ini;
}

/**
 * Há um ninho logo acima (na grade), ocupado, vazio ou em obra? Então o rótulo não sobe por cima dele (cobriria
 * a cabeça/timer/"+" do vizinho e o jogador leria que o ovo saiu de lá): nasce dentro do próprio ninho e sobe
 * pouco (curto). Só a 1ª fileira (cerca em cima) solta o rótulo para fora do ninho.
 */
function ninhoAcima(r: DOMRect): boolean {
  if (typeof document === 'undefined') return false;
  const meioX = r.left + r.width / 2;
  for (const el of document.querySelectorAll<HTMLElement>('[data-slot]')) {
    const o = el.getBoundingClientRect();
    if (o.width > 0 && o.left < meioX && meioX < o.right && o.bottom <= r.top + 6 && o.bottom > r.top - r.height * 0.5 && o.bottom > 0) return true;
  }
  return false;
}

/** O ninho (botão [data-slot]) que ocupa este retângulo da tela, se ainda estiver lá. */
function ninhoNoRect(r: DOMRect): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (const el of document.querySelectorAll<HTMLElement>('[data-slot]')) {
    const o = el.getBoundingClientRect();
    if (o.width > 0 && Math.abs(o.left + o.width / 2 - cx) < 4 && Math.abs(o.top + o.height / 2 - cy) < 4) return el;
  }
  return null;
}

/**
 * Animais altos (cabeça encostada no topo do ninho): o "UAU! +N" de uma linha nasce rente à borda de cima (sobre
 * a coroa/topete), não a 20% da altura, onde ficam os olhos. Pode passar ~8 px para o vão, sobre a base do timer do
 * ninho de cima, por 1 s (melhor que tapar o rosto do animal que acabou de ganhar).
 */
const ESPECIE_ALTA = new Set(['avestruz', 'ganso']);

/**
 * Altura (tela) onde nasce o rótulo do ninho. 1ª fileira (nada acima): na borda de cima ("+N" e "UAU!" do Coletar
 * Todos) ou, no jackpot da coleta individual, o "UAU!" no alto do ninho (o "+3" sai do rosto do animal
 * logo na subida). Com ninho acima: dentro do próprio ninho (curto): o "+N" no alto, sobre a crista; o "UAU! +N"
 * em uma linha, no alto do ninho, acima dos olhos do animal (rente à borda nos animais altos).
 */
export function posicaoRotulo(r: DOMRect, jackpot: boolean, pequeno: boolean): { y: number; curto: boolean } {
  if (ninhoAcima(r)) {
    if (!jackpot) return { y: r.top + r.height * 0.18, curto: true };
    const especie = ninhoNoRect(r)?.dataset.especie;
    return { y: r.top + (especie && ESPECIE_ALTA.has(especie) ? Math.max(4, r.height * 0.08) : r.height * 0.2), curto: true };
  }
  if (jackpot && !pequeno) return { y: r.top + r.height * 0.2 - 8, curto: false };
  return { y: r.top + (jackpot ? 2 : 6), curto: false };
}

/**
 * Enquanto o rótulo vive, o "!" de vida baixa do ninho (.selo-alerta, canto de cima) some com fade
 * (data-rotulo-vivo): o "UAU!" não fica com uma bolinha vermelha espiando por trás. Atributo fora do React (ele
 * não mexe em atributos que não renderiza); um contador aguenta dois rótulos seguidos no mesmo ninho.
 */
function esconderAlertaDuranteRotulo(r: DOMRect, iniMs: number, duracaoMs: number): void {
  const el = ninhoNoRect(r);
  if (!el?.querySelector('.selo-alerta')) return;
  setTimeout(() => {
    el.dataset.rotuloVivo = String(Number(el.dataset.rotuloVivo ?? 0) + 1);
  }, Math.max(0, iniMs - 60));
  setTimeout(() => {
    const n = Number(el.dataset.rotuloVivo ?? 1) - 1;
    if (n > 0) el.dataset.rotuloVivo = String(n);
    else delete el.dataset.rotuloVivo;
  }, iniMs + duracaoMs);
}

/** Dois ninhos vizinhos na grade, em qualquer direção (lado, cima/baixo ou diagonal)? */
const vizinhos = (a: DOMRect, b: DOMRect): boolean =>
  Math.abs(a.left + a.width / 2 - (b.left + b.width / 2)) < a.width * 1.6 && Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)) < a.height * 1.6;

/** Botão Vender do HUD: a fonte de moedas sai dele (o modal que vendeu fecha no mesmo instante). */
const botaoVenderHud = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-hud-vender]') ?? document.querySelector<HTMLElement>('[data-tut="vender"]');

/** Plano do rótulo de um ninho no Coletar Todos: quando a rajada sai, espera extra do rótulo, desvio x e se é o "UAU!". */
export interface PlanoRotulo {
  atrasoMs: number;
  espera: number | null;
  uau: boolean;
  /** desvio horizontal do rótulo (px); hoje sempre 0 (o rótulo fica no próprio ninho) */
  dx?: number;
  /**
   * Quando os ovos deste ninho saltam (ms desde o lançamento): o estouro (anel, faíscas, raios, confete) nasce
   * junto. Jackpot escalonado (vizinho de outro jackpot ou esperando a vez do rótulo) sai inteiro mais tarde, ovos
   * inclusive: pop, raios, confete e "UAU!" acontecem juntos.
   */
  atrasoPopMs?: number;
}

/**
 * Coreografia dos rótulos do Coletar Todos (também usada pela galeria). `ninhos` na ordem da grade (só os
 * visíveis). O primeiro jackpot leva o "UAU!" grande e é agendado antes de todos, depois os outros jackpots (com
 * "UAU!" também, escalonados: esperam a vez em vez de sumir) e só então os "+N" comuns, que esperam por eles; a
 * partir do 16º ninho não há rajada (null). Jackpot escalonado não separa causa e efeito: a rajada inteira
 * (ovos inclusive) anda junto com o rótulo dele, e vizinho de outro jackpot (qualquer direção) sai ≥ 220 ms depois.
 */
export function planejarColetarTodos(ninhos: { rect: DOMRect; ovos: number; jackpot: boolean }[]): (PlanoRotulo | null)[] {
  const grande = ninhos.findIndex((n) => n.jackpot);
  const ordem = ninhos
    .map((_, i) => i)
    .sort((a, b) => Number(b === grande) - Number(a === grande) || Number(ninhos[b]!.jackpot) - Number(ninhos[a]!.jackpot) || a - b);
  const rotulos: RotuloNaTela[] = [];
  const jackpots: { rect: DOMRect; pop: number }[] = [];
  const plano: (PlanoRotulo | null)[] = ninhos.map(() => null);
  for (const i of ordem) {
    if (i >= MAX_MAIS_N) continue;
    const { rect, ovos, jackpot } = ninhos[i]!;
    const base = i * (PASSO_NINHO_MS + PASSO_MAIS_N_EXTRA_MS) + ATRASO_MAIS_N_MS;
    const { y, curto } = posicaoRotulo(rect, jackpot, true);
    const x = rect.left + rect.width / 2 + (!jackpot && ovos === 1 ? -12 : 0);
    if (!jackpot) {
      // centro da caixa na parte legível: o rótulo comum sobe 14 px, o curto ~6 px
      const caixa = curto ? CAIXA_MAIS_N_CURTO : CAIXA_MAIS_N;
      const espera = agendarRotulo(rotulos, { x, y: y - (curto ? 6 : 14), ...caixa }, base, LEGIVEL_MAIS_N_MS);
      plano[i] = { atrasoMs: base, espera, uau: false, dx: 0, atrasoPopMs: i * PASSO_NINHO_MS };
      continue;
    }
    // o "UAU! +N" curto é uma linha da largura do ninho (+4 px de respiro: dois vizinhos não ficam colados); o de
    // duas linhas mede pela largura do ninho também. A caixa usa sempre o tamanho cheio (mesmo no escalonado, que
    // sai 10–16% menor): dois "UAU!" lado a lado nunca saem juntos, senão viram uma faixa só "UAU!+3 UAU!+3"
    const caixa = curto
      ? (({ fonte, meia }) => ({ mw: meia + 4, mh: Math.round(fonte * 0.6) + 6 }))(medidaUauCurto(rect.width))
      : (({ fonte, meia }) => ({ mw: meia, mh: Math.round(fonte * 1.06) }))(medidaUauGrande(rect.width));
    // o estouro (pop dos ovos) sai ≥ 220 ms depois do de qualquer jackpot vizinho já planejado; se o rótulo ainda
    // precisar esperar a vez, a rajada inteira espera com ele
    const pop0 = i * PASSO_NINHO_MS;
    let pop = pop0;
    for (const j of jackpots) if (vizinhos(rect, j.rect)) pop = Math.max(pop, j.pop + PASSO_JACKPOT_VIZINHO_MS);
    const espera = agendarRotulo(rotulos, { x, y: y - (curto ? 6 : 14), ...caixa }, base + pop - pop0 + ATRASO_UAU_EXTRA_MS, LEGIVEL_UAU_MS, true) ?? 0;
    const extra = pop - pop0 + espera;
    jackpots.push({ rect, pop: pop0 + extra });
    plano[i] = { atrasoMs: base + extra, espera: 0, uau: i === grande, dx: 0, atrasoPopMs: pop0 + extra };
  }
  return plano;
}

/**
 * Rajada da coleta num ninho: anel e faíscas no centro; o "+N" nasce na borda de cima do ninho (1ª fileira)
 * ou dentro dele, subindo pouco, quando há ninho acima (posicaoRotulo). Com 1 ovo o ovo salta para a direita e
 * o "+N" desvia 12 px para a esquerda (não se cobrem). O jackpot da coleta individual fica centrado no ninho (é
 * o momento grande); no Coletar Todos (`pequeno`) o "UAU!" segue a mesma regra dos "+N". `rebaixado` (outro
 * jackpot já levou o "UAU!" grande): rajada de coleta com confete e raios curtos, mas com o "UAU! +3" legível
 * (a rajada inteira já vem escalonada em `atrasoMs`). O "UAU!" sempre sai ATRASO_UAU_EXTRA_MS depois do clarão e,
 * enquanto vive, esconde o "!" do ninho. `esperaRotulo`:
 * atraso extra do rótulo (null = sem rótulo) e `dxRotulo`: desvio horizontal, vindos de planejarColetarTodos.
 */
export function lancarRajadaNinho(
  r: DOMRect,
  ovos: number,
  jackpot: boolean,
  atrasoMs = 0,
  pequeno = false,
  rebaixado = false,
  esperaRotulo: number | null = 0,
  dxRotulo = 0,
  atrasoFxMs = 0,
): void {
  const x = r.left + r.width / 2;
  const meio = r.top + r.height * 0.42;
  const grande = jackpot && !rebaixado;
  const { y, curto } = posicaoRotulo(r, jackpot, pequeno);
  const rotulo = {
    atrasoRotuloMs: (esperaRotulo ?? 0) + (jackpot ? ATRASO_UAU_EXTRA_MS : 0),
    semRotulo: esperaRotulo === null,
    curto,
    largura: r.width,
  };
  if (!rotulo.semRotulo) esconderAlertaDuranteRotulo(r, atrasoMs + rotulo.atrasoRotuloMs, jackpot ? DURACAO_UAU_MS : DURACAO_MAIS_N_MS);
  useUi.getState().lancarRajada(
    grande
      ? { tipo: 'jackpot', x, y, yFx: pequeno ? meio : meio + 8, n: ovos, atrasoMs, atrasoFxMs, pequeno, dx: dxRotulo, ...rotulo }
      : { tipo: 'coleta', x, y, yFx: meio, n: ovos, atrasoMs, atrasoFxMs, pequeno, dx: (!jackpot && ovos === 1 ? -12 : 0) + dxRotulo, confete: jackpot, ...rotulo },
  );
}

export function useAcoes() {
  const qc = useQueryClient();
  const coletar = useColetar();
  const coletarTodosM = useColetarTodos();
  const venderM = useVender();
  const ampliarM = useAmpliar();
  const tutorial = useAvancarTutorial();

  const etapa = useCallback(() => qc.getQueryData<Estado>(CHAVE_ESTADO)?.player.tutorialEtapa ?? ETAPA.CONCLUIDO, [qc]);
  const avancarSe = useCallback(
    (de: number, para: number) => {
      if (etapa() === de) tutorial.mutate(para);
    },
    [etapa, tutorial],
  );

  const lancarOvosDe = useCallback((el: HTMLElement | null, item: Item, quantidade: number, atrasoBase = 0) => {
    const rect = el?.getBoundingClientRect();
    if (!rect || quantidade <= 0) return;
    useUi.getState().lancarOvos(
      Array.from({ length: quantidade }, (_, i) => ({ item, de: rect, atrasoMs: atrasoBase + i * PASSO_OVO_MS, indice: i, total: quantidade })),
    );
  }, []);

  const rajadaNinho = useCallback((el: HTMLElement | null, ovos: number, jackpot: boolean, atrasoMs = 0) => {
    const r = el?.getBoundingClientRect();
    if (r) lancarRajadaNinho(r, ovos, jackpot, atrasoMs);
  }, []);

  const coletarAnimal = useCallback(
    async (e: EntityDTO): Promise<void> => {
      const ui = useUi.getState();
      if (ui.animacoes[e.id] === 'antecipando') return; // toque duplo (E-01)
      ui.animar(e.id, 'antecipando');
      som.voz(e.tipo);
      vibracao.coleta();
      try {
        const r = await coletar.mutateAsync(e.id);
        const { ovos, item, jackpot } = r.data.coleta;
        useUi.getState().animar(e.id, undefined);
        useUi.getState().revelar(e.id, ovos, item);
        const ninho = elementoNinho(e.slotId);
        lancarOvosDe(ninho, item, ovos);
        rajadaNinho(ninho, ovos, jackpot, ATRASO_MAIS_N_MS);
        for (let i = 0; i < ovos; i++) setTimeout(() => som.pop(i), 40 + i * PASSO_OVO_MS * 1.5);
        const especie = NOME_TIPO_PLURAL_OVO[tipoDoItem(item)];
        if (jackpot) {
          som.jackpot();
          vibracao.jackpot();
          toast(`UAU! +3 ovos de ${especie}! 🎉`, 'sucesso', { duracaoMs: 2600 });
        } else {
          toast(`+${ovos} ${ovos === 1 ? 'ovo' : 'ovos'} de ${especie}`);
        }
        avancarSe(ETAPA.PRIMEIRA_COLETA, ETAPA.PRIMEIRA_VENDA);
        avancarSe(ETAPA.COLETAR_NOVO, ETAPA.RITMO);
      } catch (erro) {
        useUi.getState().animar(e.id, 'erro');
        setTimeout(() => useUi.getState().animar(e.id, undefined), 450);
        if (erro instanceof ErroApi && erro.codigo === 'RENDIMENTO_NAO_PRONTO') {
          const falta = Number(erro.detalhes?.faltaMs ?? 0);
          if (falta > 0 && falta <= 2000) {
            setTimeout(() => void coletarAnimal(e), falta + 150); // relógio do aparelho 1 s adiantado (E-04)
            return;
          }
          return; // já foi coletado em outra aba: o estado se atualiza sozinho
        }
        som.erro();
        vibracao.erro();
        toast(mensagemDeErro(erro), 'erro');
        if (erro instanceof ErroApi && erro.codigo === 'ENTIDADE_EXPIRADA') void qc.invalidateQueries({ queryKey: CHAVE_ESTADO });
      }
    },
    [coletar, lancarOvosDe, rajadaNinho, avancarSe, qc],
  );

  const coletarTudo = useCallback(async (): Promise<void> => {
    try {
      const r = await coletarTodosM.mutateAsync();
      const { coletas, totalOvos } = r.data;
      if (!coletas.length) {
        toast('Nada pronto ainda. Volte daqui a pouco!');
        return;
      }
      // Todos os animais fazem "surpresa"; só os ninhos na tela emitem ovos (teto de 12) e "+N".
      let voando = 0;
      // rótulos escalonados (planejarColetarTodos): vizinhos não colidem e o "UAU!" não cobre cabeças
      const naGrade = coletas
        .map((c) => {
          const ent = r.data.entidades.find((x) => x.id === c.entityId);
          const el = elementoNinho(ent?.slotId ?? null);
          const rect = el?.getBoundingClientRect();
          return el && rect && naTela(rect) ? { c, el, rect, ovos: c.ovos, jackpot: c.jackpot } : null;
        })
        .filter((v) => v !== null);
      const plano = planejarColetarTodos(naGrade);
      // "surpresa" do animal junto com a saída dos ovos dele (o jackpot escalonado reage na vez dele)
      for (const c of coletas) {
        const i = naGrade.findIndex((n) => n.c === c);
        const atraso = i >= 0 ? (plano[i]?.atrasoPopMs ?? 0) - i * PASSO_NINHO_MS : 0;
        if (atraso > 0) setTimeout(() => useUi.getState().revelar(c.entityId, c.ovos, c.item), atraso);
        else useUi.getState().revelar(c.entityId, c.ovos, c.item);
      }
      // o "UAU!" sai primeiro na fila dos ovos também (o teto de 12 não corta o jackpot)
      const ordem = naGrade.map((_, i) => i).sort((a, b) => Number(plano[b]?.uau) - Number(plano[a]?.uau) || a - b);
      for (const i of ordem) {
        const { c, el, rect } = naGrade[i]!;
        const qtd = Math.min(c.ovos, MAX_OVOS_VOANDO - voando);
        const p = plano[i];
        lancarOvosDe(el, c.item, qtd, p?.atrasoPopMs ?? i * PASSO_NINHO_MS);
        voando += qtd;
        if (p) lancarRajadaNinho(rect, c.ovos, c.jackpot, p.atrasoMs, true, c.jackpot && !p.uau, p.espera, p.dx, p.atrasoPopMs);
      }
      for (let i = 0; i < Math.min(totalOvos, 6); i++) setTimeout(() => som.pop(i % 5), 150 + i * 110);
      if (coletas.some((c) => c.jackpot)) setTimeout(() => som.jackpot(), 400);
      vibracao.coleta();
      const resumo = Object.entries(r.data.totais)
        .map(([item, qtd]) => `${NOME_TIPO_PLURAL_OVO[tipoDoItem(item as Item)]} ×${qtd}`)
        .join(' · ');
      toast(`+${totalOvos} ovos · ${resumo}`, 'sucesso', { duracaoMs: 3000 });
      avancarSe(ETAPA.PRIMEIRA_COLETA, ETAPA.PRIMEIRA_VENDA);
      avancarSe(ETAPA.COLETAR_NOVO, ETAPA.RITMO);
    } catch (erro) {
      som.erro();
      toast(mensagemDeErro(erro), 'erro');
    }
  }, [coletarTodosM, lancarOvosDe, avancarSe]);

  const venderOvos = useCallback(
    async (corpo: { tudo: true } | { itens: Partial<Inventario> }, origem: HTMLElement | null): Promise<boolean> => {
      try {
        const r = await venderM.mutateAsync(corpo);
        // Fonte de moedas no botão Vender do HUD (ou, sem ele, no botão que vendeu): clamp(10, log2(valor) * 2,
        // 18) moedas; uma "boca" (anel + estrelas) marca a saída e o saldo pulsa quando elas chegam.
        const hud = botaoVenderHud()?.getBoundingClientRect();
        const rect = hud && hud.width > 0 ? hud : origem?.getBoundingClientRect();
        const credito = r.data.venda.creditoX100;
        const quantidade = Math.round(Math.min(18, Math.max(10, Math.log2(Math.max(1, credito / 100)) * 2)));
        if (rect && rect.width > 0) {
          useUi.getState().lancarRajada({ tipo: 'fonte-moedas', x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
          useUi.getState().lancarChuvaMoedas(rect, quantidade, credito);
        } else useUi.getState().pulsarContador();
        som.moedas();
        // o valor aparece uma vez só: no "+N" colado ao saldo (CamadaEfeitos). O toast conta os ovos vendidos;
        // sem a fonte (nada para animar) ele leva o valor.
        const vendidos = Object.values(r.data.venda.itens).reduce((a, q) => a + (q ?? 0), 0);
        toast(
          rect && rect.width > 0
            ? `${vendidos} ${vendidos === 1 ? 'ovo vendido' : 'ovos vendidos'}!`
            : `+${moedas(r.data.venda.creditoX100)} moedas`,
          'sucesso',
        );
        avancarSe(ETAPA.PRIMEIRA_VENDA, ETAPA.PRIMEIRO_GIRO);
        return true;
      } catch (erro) {
        som.erro();
        toast(mensagemDeErro(erro), 'erro');
        return false;
      }
    },
    [venderM, avancarSe],
  );

  const ampliar = useCallback(async (cobrancaId: string): Promise<number[] | null> => {
    try {
      const r = await ampliarM.mutateAsync(cobrancaId);
      som.obra();
      useUi.getState().definirObra(r.data.novosSlots);
      toast(`+4 ninhos! Galinheiro nível ${r.data.nivelGalinheiro}`, 'sucesso', { duracaoMs: 2600 });
      return r.data.novosSlots;
    } catch (erro) {
      som.erro();
      toast(mensagemDeErro(erro), 'erro');
      return null;
    }
  }, [ampliarM]);

  return {
    coletarAnimal,
    coletarTudo,
    venderOvos,
    ampliar,
    avancarSe,
    avancarTutorial: tutorial.mutate,
    coletandoTudo: coletarTodosM.isPending,
    vendendo: venderM.isPending,
    ampliando: ampliarM.isPending,
  };
}

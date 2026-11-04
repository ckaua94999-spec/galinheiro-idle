// Estado de interface (modais, toasts, animações em andamento). Estado do jogo fica no React Query.
import { PREFERENCIAS_PADRAO, type Preferencias } from '@galinheiro/api-contract';
import type { Item, Raridade, Tipo } from '@galinheiro/game-core';
import { create } from 'zustand';

export interface Toast {
  id: number;
  texto: string;
  tipo: 'info' | 'sucesso' | 'erro';
  acao?: { rotulo: string; fn: () => void };
  duracaoMs: number;
}

/** Ovo voando do ninho até o contador do HUD. `indice`/`total`: posição no grupo (abre o leque do salto). */
export interface OvoVoando { id: number; item: Item; de: DOMRect; atrasoMs: number; indice?: number; total?: number }
/** Moeda indo para o saldo. `indice`/`total` abrem o leque da fonte; a última leva o `ganhoX100` ("+N" no HUD). */
export interface MoedaVoando { id: number; de: DOMRect; atrasoMs: number; indice?: number; total?: number; ganhoX100?: number }

/** Rajada de efeito num ponto da tela (CamadaEfeitos): "+N", faíscas, anel, jackpot, chegada no HUD. */
export type TipoRajada = 'coleta' | 'jackpot' | 'chegada-ovo' | 'chegada-moeda' | 'ganho-moedas' | 'faiscas' | 'fonte-moedas';
/**
 * `yFx`: altura (tela) do anel/faíscas quando o "+N" nasce em outro ponto; `pequeno`: "+N" menor (Coletar Todos);
 * `dx`: desvio horizontal do "+N" (px; foge do arco do ovo); `confete`: coleta com confete (jackpot "rebaixado"
 * no Coletar Todos, quando outro jackpot já levou o "UAU!").
 * `atrasoRotuloMs`: atraso extra só do rótulo ("+N"/"UAU!"), além de `atrasoMs` (o Coletar Todos escalona os
 * rótulos vizinhos para não colidirem); `semRotulo`: rajada sem rótulo (teto de rótulos simultâneos);
 * `curto`: o rótulo nasce dentro do próprio ninho e sobe pouco (há ninho ocupado logo acima).
 * `largura`: largura do ninho (px): o "UAU! +N" curto (uma linha, no alto do ninho) mede a fonte por ela.
 * `atrasoFxMs`: a rajada inteira (anel, faíscas, clarão, raios, confete, tremida) só nasce depois disso; `atrasoMs`
 * continua contando do lançamento (o Coletar Todos sincroniza o estouro com o pop dos ovos de cada ninho).
 */
export interface Rajada {
  id: number;
  tipo: TipoRajada;
  x: number;
  y: number;
  n?: number;
  atrasoMs?: number;
  yFx?: number;
  pequeno?: boolean;
  dx?: number;
  confete?: boolean;
  atrasoRotuloMs?: number;
  semRotulo?: boolean;
  curto?: boolean;
  largura?: number;
  atrasoFxMs?: number;
}

export type AnimacaoNinho = 'antecipando' | 'erro';

export interface ResultadoGiro {
  entityId: string;
  tipo: Tipo;
  raridade: Raridade;
  slotId: number | null;
  nome: string;
}

interface EstadoUi {
  preferencias: Preferencias;
  cartaId: string | null;
  infoId: string | null;
  vendaAberta: boolean;
  chancesAbertas: boolean;
  toasts: Toast[];
  ovosVoando: OvoVoando[];
  moedasVoando: MoedaVoando[];
  animacoes: Record<string, AnimacaoNinho | undefined>;
  /** ovos revelados recentemente por entidade (para o "pop" no ninho) */
  revelacoes: Record<string, { ovos: number; item: Item; em: number } | undefined>;
  obraSlots: number[];
  ultimoGiro: ResultadoGiro | null;
  resultadoGiroAberto: boolean;
  pulsoContador: number;
  pulsoOvos: number;
  /** efeitos pontuais em andamento na CamadaEfeitos */
  rajadas: Rajada[];

  definirPreferencias: (p: Preferencias) => void;
  abrirCarta: (id: string | null) => void;
  abrirInfo: (id: string | null) => void;
  abrirVenda: (aberta: boolean) => void;
  abrirChances: (aberta: boolean) => void;
  toast: (texto: string, tipo?: Toast['tipo'], extra?: { acao?: Toast['acao']; duracaoMs?: number }) => void;
  removerToast: (id: number) => void;
  lancarOvos: (ovos: Omit<OvoVoando, 'id'>[]) => void;
  removerOvo: (id: number) => void;
  lancarMoedas: (de: DOMRect, quantidade: number) => void;
  removerMoeda: (id: number) => void;
  animar: (entityId: string, a: AnimacaoNinho | undefined) => void;
  revelar: (entityId: string, ovos: number, item: Item) => void;
  definirObra: (slots: number[]) => void;
  definirUltimoGiro: (g: ResultadoGiro | null) => void;
  abrirResultadoGiro: (aberto: boolean) => void;
  pulsarContador: () => void;
  pulsarOvos: () => void;
  lancarRajada: (r: Omit<Rajada, 'id'>) => void;
  removerRajada: (id: number) => void;
  /** Fonte de moedas (venda): leque, stagger de 35 ms e "+N" no saldo quando a última chega. */
  lancarChuvaMoedas: (de: DOMRect, quantidade: number, ganhoX100?: number) => void;
}

let sequencia = 1;

export const useUi = create<EstadoUi>((set) => ({
  preferencias: PREFERENCIAS_PADRAO,
  cartaId: null,
  infoId: null,
  vendaAberta: false,
  chancesAbertas: false,
  toasts: [],
  ovosVoando: [],
  moedasVoando: [],
  animacoes: {},
  revelacoes: {},
  obraSlots: [],
  ultimoGiro: null,
  resultadoGiroAberto: false,
  pulsoContador: 0,
  pulsoOvos: 0,
  rajadas: [],

  definirPreferencias: (preferencias) => set({ preferencias }),
  abrirCarta: (cartaId) => set({ cartaId }),
  abrirInfo: (infoId) => set({ infoId }),
  abrirVenda: (vendaAberta) => set({ vendaAberta }),
  abrirChances: (chancesAbertas) => set({ chancesAbertas }),
  toast: (texto, tipo = 'info', extra = {}) => {
    const t: Toast = { id: sequencia++, texto, tipo, acao: extra.acao, duracaoMs: extra.duracaoMs ?? (tipo === 'erro' ? 3200 : 2400) };
    set((s) => ({ toasts: [...s.toasts.slice(-2), t] }));
  },
  removerToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  lancarOvos: (ovos) => set((s) => ({ ovosVoando: [...s.ovosVoando, ...ovos.map((o) => ({ ...o, id: sequencia++ }))].slice(-60) })),
  removerOvo: (id) => set((s) => ({ ovosVoando: s.ovosVoando.filter((o) => o.id !== id) })),
  lancarMoedas: (de, quantidade) =>
    set((s) => ({
      moedasVoando: [
        ...s.moedasVoando,
        ...Array.from({ length: quantidade }, (_, i) => ({ id: sequencia++, de, atrasoMs: i * 60 })),
      ].slice(-30),
    })),
  removerMoeda: (id) => set((s) => ({ moedasVoando: s.moedasVoando.filter((m) => m.id !== id) })),
  animar: (entityId, a) => set((s) => ({ animacoes: { ...s.animacoes, [entityId]: a } })),
  revelar: (entityId, ovos, item) =>
    set((s) => ({ revelacoes: { ...s.revelacoes, [entityId]: { ovos, item, em: Date.now() } } })),
  definirObra: (obraSlots) => set({ obraSlots }),
  definirUltimoGiro: (ultimoGiro) => set({ ultimoGiro }),
  abrirResultadoGiro: (resultadoGiroAberto) => set({ resultadoGiroAberto }),
  pulsarContador: () => set((s) => ({ pulsoContador: s.pulsoContador + 1 })),
  pulsarOvos: () => set((s) => ({ pulsoOvos: s.pulsoOvos + 1 })),
  lancarRajada: (r) => set((s) => ({ rajadas: [...s.rajadas, { ...r, id: sequencia++ }].slice(-40) })),
  removerRajada: (id) => set((s) => ({ rajadas: s.rajadas.filter((r) => r.id !== id) })),
  lancarChuvaMoedas: (de, quantidade, ganhoX100) =>
    set((s) => ({
      moedasVoando: [
        ...s.moedasVoando,
        ...Array.from({ length: quantidade }, (_, i) => ({
          id: sequencia++,
          de,
          atrasoMs: i * 35,
          indice: i,
          total: quantidade,
          ganhoX100: i === quantidade - 1 ? ganhoX100 : undefined,
        })),
      ].slice(-30),
    })),
}));

export const toast = (...args: Parameters<EstadoUi['toast']>): void => useUi.getState().toast(...args);

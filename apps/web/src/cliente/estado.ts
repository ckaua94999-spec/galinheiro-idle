// Estado do jogo no cliente: GET /state em cache (React Query + localStorage para abrir offline)
// e mutações que aplicam no cache exatamente o que o servidor devolveu (GDD 7.11).
'use client';

import type {
  AmpliarResposta, ColetarResposta, ColetarTodosResposta, EntityDTO, GirarResposta, PlayerDTO, Preferencias,
  StateDTO, VenderResposta,
} from '@galinheiro/api-contract';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { chamar, type RespostaApi } from './api';

export type Estado = StateDTO & { _versao: number };

export const CHAVE_ESTADO = ['estado'] as const;
const CHAVE_CACHE = 'gi:estado:v1';

export function lerCacheEstado(): Estado | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const texto = window.localStorage.getItem(CHAVE_CACHE);
    return texto ? (JSON.parse(texto) as Estado) : undefined;
  } catch {
    return undefined;
  }
}

function salvarCacheEstado(e: Estado): void {
  try {
    window.localStorage.setItem(CHAVE_CACHE, JSON.stringify(e));
  } catch {
    // modo privado / sem espaço: só perde o cache offline
  }
}

export function limparCacheEstado(): void {
  try {
    window.localStorage.removeItem(CHAVE_CACHE);
  } catch {
    // ignora
  }
}

export async function buscarEstado(): Promise<Estado> {
  const r = await chamar<StateDTO>('GET', '/state');
  const e: Estado = { ...r.data, _versao: r.stateVersion ?? 0 };
  salvarCacheEstado(e);
  return e;
}

export function useEstado() {
  return useQuery({
    queryKey: CHAVE_ESTADO,
    queryFn: buscarEstado,
    initialData: lerCacheEstado,
    initialDataUpdatedAt: 0,
    staleTime: 10_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

/** Aplica uma alteração no cache; se a versão do servidor pulou (outra aba/aparelho), recarrega tudo. */
export function aplicarNoEstado(qc: QueryClient, resposta: RespostaApi<unknown> | null, fn: (e: Estado) => Estado): void {
  const atual = qc.getQueryData<Estado>(CHAVE_ESTADO);
  if (!atual) {
    void qc.invalidateQueries({ queryKey: CHAVE_ESTADO });
    return;
  }
  const novo = fn(atual);
  const versao = resposta?.stateVersion;
  if (versao !== undefined) {
    if (versao > atual._versao + 1) void qc.invalidateQueries({ queryKey: CHAVE_ESTADO });
    novo._versao = Math.max(versao, atual._versao);
  }
  qc.setQueryData(CHAVE_ESTADO, novo);
  salvarCacheEstado(novo);
}

const substituir = (lista: EntityDTO[], ...novas: EntityDTO[]): EntityDTO[] => {
  const mapa = new Map(novas.map((e) => [e.id, e]));
  return lista.map((e) => mapa.get(e.id) ?? e);
};

function comAposentadorias(qc: QueryClient, eventos: { aposentadorias: EntityDTO[] } | undefined): void {
  if (eventos?.aposentadorias.length) void qc.invalidateQueries({ queryKey: CHAVE_ESTADO });
}

// ---------------------------------------------------------------- mutações
export function useColetar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entityId: string) =>
      chamar<ColetarResposta>('POST', '/collect', { corpo: { entityId }, idempotente: true }),
    onSuccess: (r) => {
      aplicarNoEstado(qc, r, (e) => ({ ...e, inventario: r.data.inventario, entidades: substituir(e.entidades, r.data.entity) }));
      comAposentadorias(qc, r.data.eventos);
      void qc.invalidateQueries({ queryKey: ['entidades'] });
    },
  });
}

export function useColetarTodos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => chamar<ColetarTodosResposta>('POST', '/collect-all', { idempotente: true }),
    onSuccess: (r) => {
      aplicarNoEstado(qc, r, (e) => ({ ...e, inventario: r.data.inventario, entidades: substituir(e.entidades, ...r.data.entidades) }));
      comAposentadorias(qc, r.data.eventos);
      void qc.invalidateQueries({ queryKey: ['entidades'] });
    },
  });
}

export function useVender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (corpo: { tudo: true } | { itens: Partial<StateDTO['inventario']> }) =>
      chamar<VenderResposta>('POST', '/sell', { corpo, idempotente: true }),
    onSuccess: (r) => {
      aplicarNoEstado(qc, r, (e) => ({
        ...e,
        inventario: r.data.inventario,
        player: { ...e.player, moedasX100: r.data.saldoX100 },
      }));
      void qc.invalidateQueries({ queryKey: ['extrato'] });
    },
  });
}

export function useGirar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cobrancaId?: string) =>
      chamar<GirarResposta>('POST', '/spin', { corpo: cobrancaId ? { cobrancaId } : {}, idempotente: true }),
    onSuccess: (r) => {
      const nova = r.data.entity;
      aplicarNoEstado(qc, r, (e) => ({
        ...e,
        player: {
          ...e.player,
          moedasX100: r.data.saldoX100,
          ocupados: r.data.capacidade.ocupados,
          girosGratis: r.data.girosGratis,
        },
        entidades: [...e.entidades.filter((x) => x.id !== nova.id), nova].sort((a, b) => (a.slotId ?? 0) - (b.slotId ?? 0)),
        ninhos: e.ninhos.map((n) => (n.slot === nova.slotId ? { ...n, entityId: nova.id } : n)),
      }));
      comAposentadorias(qc, r.data.eventos);
      void qc.invalidateQueries({ queryKey: ['entidades'] });
      void qc.invalidateQueries({ queryKey: ['extrato'] });
    },
  });
}

export function useAmpliar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cobrancaId: string) => chamar<AmpliarResposta>('POST', '/upgrade-nest', { corpo: { cobrancaId }, idempotente: true }),
    onSuccess: (r) => {
      aplicarNoEstado(qc, r, (e) => ({
        ...e,
        player: { ...e.player, moedasX100: r.data.saldoX100, nivelGalinheiro: r.data.nivelGalinheiro, capacidade: r.data.capacidade },
        ninhos: [...e.ninhos, ...r.data.novosSlots.map((slot) => ({ slot, entityId: null }))],
      }));
      void qc.invalidateQueries({ queryKey: ['extrato'] });
    },
  });
}

export function useRenomear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string }) =>
      chamar<EntityDTO>('PATCH', `/entities/${id}`, { corpo: { nome }, idempotente: true }),
    onSuccess: (r) => {
      aplicarNoEstado(qc, r, (e) => ({
        ...e,
        entidades: substituir(e.entidades, r.data),
        aposentadoriasNaoVistas: substituir(e.aposentadoriasNaoVistas, r.data),
      }));
      void qc.invalidateQueries({ queryKey: ['entidades'] });
      void qc.invalidateQueries({ queryKey: ['entidade', r.data.id] });
    },
  });
}

export function useMarcarAposentadorias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ate: string) =>
      chamar<{ aposentadoriasVistasAte: string }>('POST', '/retirements/ack', { corpo: { ate }, idempotente: true }),
    onSuccess: (r) => {
      aplicarNoEstado(qc, r, (e) => ({
        ...e,
        player: { ...e.player, aposentadoriasVistasAte: r.data.aposentadoriasVistasAte },
        aposentadoriasNaoVistas: e.aposentadoriasNaoVistas.filter((a) => (a.expiradoEm ?? '') > r.data.aposentadoriasVistasAte),
      }));
    },
  });
}

export function useAvancarTutorial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (etapa: number) => chamar<{ tutorialEtapa: number }>('POST', '/tutorial', { corpo: { etapa }, idempotente: true }),
    onMutate: (etapa) => {
      // otimista: o tutorial avança na hora (o servidor só registra)
      aplicarNoEstado(qc, null, (e) => ({ ...e, player: { ...e.player, tutorialEtapa: Math.max(e.player.tutorialEtapa, etapa) } }));
    },
    onSuccess: (r) => aplicarNoEstado(qc, r, (e) => ({ ...e, player: { ...e.player, tutorialEtapa: r.data.tutorialEtapa } })),
  });
}

export function useAtualizarPerfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (corpo: { apelido?: string | null; preferencias?: Partial<Preferencias> }) =>
      chamar<PlayerDTO>('PATCH', '/me', { corpo, idempotente: true }),
    onSuccess: (r) => aplicarNoEstado(qc, r, (e) => ({ ...e, player: { ...e.player, ...r.data } })),
  });
}

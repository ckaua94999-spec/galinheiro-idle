'use client';

// Intercâmbio no lado do jogador: GET /intercambio (saldo, regras, ofertas e histórico) e as três ações
// (resgatar cupom, trocar tickets, comprar tickets com moedas do jogo). Toda ação aplica NA HORA, no cache do
// estado do jogo, exatamente o que o servidor devolveu (tickets, moedas, estoque de ovos, animal novo no ninho),
// como vender/girar/ampliar fazem em estado.ts — o HUD, a Loja e o galinheiro ficam certos sem esperar a próxima
// consulta. A tela /intercambio e o cartão da Loja usam a MESMA chave (quem passa pela Loja já deixa a tela pronta).
import type { CompraTicketsDTO, CupomResgatadoDTO, EntityDTO, IntercambioDTO, TrocaTicketsDTO } from '@galinheiro/api-contract';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { chamar } from '../api';
import { aplicarNoEstado, CHAVE_ESTADO, type Estado } from '../estado';

export const CHAVE_INTERCAMBIO = ['intercambio'] as const;

/** O GET /intercambio também traz o saldo de tickets: se o estado em cache estiver atrasado (presente da equipe
 *  chegou depois da última consulta do /state), acerta só o saldo, sem mexer na versão. */
function acertarTickets(qc: QueryClient, tickets: number): void {
  const atual = qc.getQueryData<Estado>(CHAVE_ESTADO);
  if (atual && atual.player.tickets !== tickets) {
    aplicarNoEstado(qc, null, (e) => ({ ...e, player: { ...e.player, tickets } }));
  }
}

/** Dados do Intercâmbio do membro logado (precisa de sessão: use só dentro da casca do jogo). */
export function useIntercambio() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: CHAVE_INTERCAMBIO,
    queryFn: async () => {
      const d = (await chamar<IntercambioDTO>('GET', '/intercambio')).data;
      acertarTickets(qc, d.tickets);
      return d;
    },
    staleTime: 15_000,
    // o cliente HTTP já repete GET com espera; a tela mostra o erro com "Tentar de novo"
    retry: false,
  });
}

/** Saldo novo de tickets no cache da tela (o histórico chega na consulta seguinte). */
function novoSaldo(qc: QueryClient, tickets: number, extra: Partial<IntercambioDTO> = {}): void {
  qc.setQueryData<IntercambioDTO>(CHAVE_INTERCAMBIO, (d) => (d ? { ...d, ...extra, tickets } : d));
  void qc.invalidateQueries({ queryKey: CHAVE_INTERCAMBIO });
}

/** POST /cupons/resgatar: o código já vai normalizado (maiúsculas, sem espaço nem traço). */
export function useResgatarCupom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (codigo: string) => chamar<CupomResgatadoDTO>('POST', '/cupons/resgatar', { corpo: { codigo }, idempotente: true }),
    onSuccess: (r) => {
      aplicarNoEstado(qc, r, (e) => ({
        ...e,
        player: { ...e.player, tickets: r.data.saldoTickets, girosGratis: r.data.saldoGiros },
      }));
      novoSaldo(qc, r.data.saldoTickets);
    },
  });
}

/** Põe o animal recebido no ninho dele (mesma conta do giro da roleta). */
function comAnimalNovo(e: Estado, nova: EntityDTO): Estado {
  const entidades = [...e.entidades.filter((x) => x.id !== nova.id), nova].sort((a, b) => (a.slotId ?? 0) - (b.slotId ?? 0));
  return {
    ...e,
    entidades,
    ninhos: e.ninhos.map((n) => (n.slot === nova.slotId ? { ...n, entityId: nova.id } : n)),
    player: { ...e.player, ocupados: entidades.length },
  };
}

/** POST /intercambio/trocar: ovos vão para o estoque; o animal, para o menor ninho livre. */
export function useTrocarTickets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ofertaId: string) => chamar<TrocaTicketsDTO>('POST', '/intercambio/trocar', { corpo: { ofertaId }, idempotente: true }),
    onSuccess: (r) => {
      const { tickets, inventario, entity } = r.data;
      aplicarNoEstado(qc, r, (e) => {
        const base: Estado = { ...e, inventario, player: { ...e.player, tickets } };
        return entity ? comAnimalNovo(base, entity) : base;
      });
      novoSaldo(qc, tickets);
      if (entity) void qc.invalidateQueries({ queryKey: ['entidades'] });
    },
  });
}

/** POST /intercambio/comprar: gasta moedas do jogo, respeitando o limite do dia. */
export function useComprarTickets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quantidade: number) => chamar<CompraTicketsDTO>('POST', '/intercambio/comprar', { corpo: { quantidade }, idempotente: true }),
    onSuccess: (r) => {
      aplicarNoEstado(qc, r, (e) => ({ ...e, player: { ...e.player, moedasX100: r.data.saldoX100, tickets: r.data.tickets } }));
      const atual = qc.getQueryData<IntercambioDTO>(CHAVE_INTERCAMBIO);
      novoSaldo(qc, r.data.tickets, atual ? { compradosHoje: atual.compradosHoje + r.data.quantidade } : {});
      void qc.invalidateQueries({ queryKey: ['extrato'] });
    },
  });
}

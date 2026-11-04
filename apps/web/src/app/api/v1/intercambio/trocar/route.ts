import { IntercambioTrocarBody } from '@galinheiro/api-contract';
import { trocarTickets } from '@/server/dominio/intercambio';
import { rota } from '@/server/http/rota';

/** Troca tickets por uma oferta do Intercâmbio (ovos no estoque ou um animal no ninho livre). */
export const POST = rota(
  { nome: 'intercambio.trocar', limite: 30, idempotente: true, corpo: IntercambioTrocarBody },
  async ({ c, contaId, corpo, agoraMs, rng }) => {
    const r = await trocarTickets(c, contaId, corpo.ofertaId, agoraMs, rng);
    return { data: r.data, stateVersion: r.versao };
  },
);

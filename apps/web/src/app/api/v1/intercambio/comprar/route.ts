import { IntercambioComprarBody } from '@galinheiro/api-contract';
import { comprarTickets } from '@/server/dominio/intercambio';
import { rota } from '@/server/http/rota';

/** Compra tickets com moedas do jogo (só se o painel ligou a compra). */
export const POST = rota(
  { nome: 'intercambio.comprar', limite: 30, idempotente: true, corpo: IntercambioComprarBody },
  async ({ c, contaId, corpo, agoraMs }) => {
    const r = await comprarTickets(c, contaId, corpo.quantidade, agoraMs);
    return { data: r.data, stateVersion: r.versao };
  },
);

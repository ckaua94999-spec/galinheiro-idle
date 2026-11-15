import { liberarRoleta } from '@/server/dominio/jogo';
import { rota } from '@/server/http/rota';

/** Liberação da roleta do membro novo: paga com as moedas da codorna e ganha o primeiro giro. */
export const POST = rota({ nome: 'roleta.liberar', limite: 20, idempotente: true }, async ({ c, contaId, agoraMs }) => {
  const r = await liberarRoleta(c, contaId, agoraMs);
  return { data: r.data, stateVersion: r.versao };
});

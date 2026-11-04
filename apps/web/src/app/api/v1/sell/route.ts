import { SellBody } from '@galinheiro/api-contract';
import { vender } from '@/server/dominio/jogo';
import { rota } from '@/server/http/rota';

export const POST = rota({ nome: 'sell', limite: 30, idempotente: true, corpo: SellBody }, async ({ c, contaId, corpo, agoraMs }) => {
  const r = await vender(c, contaId, corpo, agoraMs);
  return { data: r.data, stateVersion: r.versao };
});

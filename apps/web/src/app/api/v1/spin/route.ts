import { SpinBody } from '@galinheiro/api-contract';
import { girar } from '@/server/dominio/jogo';
import { rota } from '@/server/http/rota';

export const POST = rota({ nome: 'spin', limite: 30, idempotente: true, corpo: SpinBody }, async ({ c, contaId, agoraMs, rng }) => {
  const r = await girar(c, contaId, agoraMs, rng);
  return { data: r.data, stateVersion: r.versao };
});

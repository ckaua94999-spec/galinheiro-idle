import { coletarTodos } from '@/server/dominio/jogo';
import { rota } from '@/server/http/rota';

export const POST = rota({ nome: 'collect-all', limite: 20, idempotente: true }, async ({ c, contaId, agoraMs, rng }) => {
  const r = await coletarTodos(c, contaId, agoraMs, rng);
  return { data: r.data, stateVersion: r.versao };
});

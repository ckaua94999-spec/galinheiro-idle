import { estado } from '@/server/dominio/jogo';
import { rota } from '@/server/http/rota';

export const GET = rota({ nome: 'state', limite: 30 }, async ({ c, contaId, agoraMs, rng }) => {
  const r = await estado(c, contaId, agoraMs, rng);
  return { data: r.data, stateVersion: r.versao, headers: { ETag: `"v${r.versao}"` } };
});

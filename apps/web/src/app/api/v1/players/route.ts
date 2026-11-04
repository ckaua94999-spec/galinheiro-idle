import { criarJogador, estado } from '@/server/dominio/jogo';
import { rota } from '@/server/http/rota';

/** Bootstrap idempotente do galinheiro (GDD 9.4.2). */
export const POST = rota({ nome: 'players', limite: 20 }, async ({ c, contaId, agoraMs, rng }) => {
  const criado = await criarJogador(c, contaId, agoraMs, rng);
  const r = await estado(c, contaId, agoraMs, rng);
  return { status: criado ? 201 : 200, data: r.data, stateVersion: r.versao };
});

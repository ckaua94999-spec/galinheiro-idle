import { RinhaBody } from '@galinheiro/api-contract';
import { historicoRinha, lutar } from '@/server/dominio/rinha';
import { rota } from '@/server/http/rota';

/** Últimas lutas do membro. */
export const GET = rota({ nome: 'rinha.historico', limite: 60 }, async ({ c, contaId }) => ({
  data: await historicoRinha(c, contaId),
}));

/** Uma luta: aposta moedas do jogo num galo; o servidor sorteia e devolve o resultado com os golpes. */
export const POST = rota(
  { nome: 'rinha', limite: 40, idempotente: true, corpo: RinhaBody },
  async ({ c, contaId, corpo, agoraMs, rng }) => {
    const r = await lutar(c, contaId, corpo, agoraMs, rng);
    return { data: r.data, stateVersion: r.versao };
  },
);

import { BombasBody } from '@galinheiro/api-contract';
import { girarOvosBomba, tabuleirosBombas } from '@/server/dominio/bombas';
import { rota } from '@/server/http/rota';

/** Bombas presas em cada tabuleiro do jogador (um por valor de aposta). */
export const GET = rota({ nome: 'bombas.estado', limite: 60 }, async ({ c, contaId }) => ({
  data: await tabuleirosBombas(c, contaId),
}));

/** Um giro dos Ovos-Bomba: aposta moedas do jogo; o servidor sorteia o giro e devolve o roteiro. */
export const POST = rota(
  { nome: 'bombas', limite: 90, idempotente: true, corpo: BombasBody },
  async ({ c, contaId, corpo, agoraMs, rng }) => {
    const r = await girarOvosBomba(c, contaId, corpo.apostaX100, agoraMs, rng);
    return { data: r.data, stateVersion: r.versao };
  },
);

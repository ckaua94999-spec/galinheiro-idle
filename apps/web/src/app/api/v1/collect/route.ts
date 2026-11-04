import { CollectBody } from '@galinheiro/api-contract';
import { coletar } from '@/server/dominio/jogo';
import { rota } from '@/server/http/rota';

export const POST = rota(
  { nome: 'collect', limite: 120, idempotente: true, corpo: CollectBody },
  async ({ c, contaId, corpo, agoraMs, rng }) => {
    const r = await coletar(c, contaId, corpo.entityId, agoraMs, rng);
    return { data: r.data, stateVersion: r.versao };
  },
);

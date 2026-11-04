import { RetirementsAckBody } from '@galinheiro/api-contract';
import { marcarAposentadoriasVistas } from '@/server/dominio/jogo';
import { rota } from '@/server/http/rota';

export const POST = rota(
  { nome: 'retirements.ack', limite: 30, idempotente: true, corpo: RetirementsAckBody },
  async ({ c, contaId, corpo, agoraMs }) => {
    const r = await marcarAposentadoriasVistas(c, contaId, corpo.ate, agoraMs);
    return { data: r.data, stateVersion: r.versao };
  },
);

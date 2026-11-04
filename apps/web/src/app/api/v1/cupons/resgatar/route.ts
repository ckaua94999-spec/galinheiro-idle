import { CupomResgatarBody } from '@galinheiro/api-contract';
import { resgatarCupom } from '@/server/dominio/intercambio';
import { rota } from '@/server/http/rota';

/** Resgata um cupom (dá tickets). Limite baixo contra tentativas em série. */
export const POST = rota(
  { nome: 'cupons.resgatar', limite: 10, idempotente: true, corpo: CupomResgatarBody },
  async ({ c, contaId, corpo, agoraMs }) => {
    const r = await resgatarCupom(c, contaId, corpo.codigo, agoraMs);
    return { data: r.data, stateVersion: r.versao };
  },
);

import { ChuvaBody } from '@galinheiro/api-contract';
import { girarChuva } from '@/server/dominio/chuva';
import { rota } from '@/server/http/rota';

/** Uma jogada da Chuva de Ovos: aposta moedas do jogo; o servidor sorteia a cascata inteira e devolve os quadros. */
export const POST = rota(
  { nome: 'chuva', limite: 60, idempotente: true, corpo: ChuvaBody },
  async ({ c, contaId, corpo, agoraMs, rng }) => {
    const r = await girarChuva(c, contaId, corpo.apostaX100, agoraMs, rng);
    return { data: r.data, stateVersion: r.versao };
  },
);

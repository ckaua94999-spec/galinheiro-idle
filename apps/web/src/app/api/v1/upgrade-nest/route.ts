import { AmpliarBody } from '@galinheiro/api-contract';
import { ampliar } from '@/server/dominio/jogo';
import { rota } from '@/server/http/rota';

export const POST = rota({ nome: 'upgrade-nest', limite: 30, idempotente: true, corpo: AmpliarBody }, async ({ c, contaId, agoraMs }) => {
  const r = await ampliar(c, contaId, agoraMs);
  return { data: r.data, stateVersion: r.versao };
});

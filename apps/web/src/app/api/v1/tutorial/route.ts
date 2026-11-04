import { TutorialBody } from '@galinheiro/api-contract';
import { avancarTutorial } from '@/server/dominio/jogo';
import { rota } from '@/server/http/rota';

export const POST = rota({ nome: 'tutorial', limite: 30, idempotente: true, corpo: TutorialBody }, async ({ c, contaId, corpo }) => {
  const r = await avancarTutorial(c, contaId, corpo.etapa);
  return { data: r.data, stateVersion: r.versao };
});

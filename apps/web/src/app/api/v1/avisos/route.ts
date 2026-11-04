import { avisosDoJogador } from '@/server/admin/popups';
import { rota } from '@/server/http/rota';

/** Popups que o membro deve ver agora + mensagens do suporte não lidas (o jogo consulta a cada ~45 s). */
export const GET = rota({ nome: 'avisos', limite: 120 }, async ({ c, contaId, agoraMs }) => ({
  data: await avisosDoJogador(c, contaId, agoraMs),
}));

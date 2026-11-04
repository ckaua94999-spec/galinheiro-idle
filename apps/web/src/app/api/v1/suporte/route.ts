import { MensagemSuporteBody } from '@galinheiro/api-contract';
import { conversaDoJogador, enviarMensagemJogador } from '@/server/admin/suporte';
import { rota } from '@/server/http/rota';

/** Conversa do membro com o suporte (abrir marca as respostas como lidas). */
export const GET = rota({ nome: 'suporte', limite: 120 }, async ({ c, contaId }) => ({ data: await conversaDoJogador(c, contaId) }));

export const POST = rota({ nome: 'suporte.enviar', limite: 20, corpo: MensagemSuporteBody }, async ({ c, contaId, corpo, agoraMs }) => ({
  data: await enviarMensagemJogador(c, contaId, corpo.texto, agoraMs),
}));

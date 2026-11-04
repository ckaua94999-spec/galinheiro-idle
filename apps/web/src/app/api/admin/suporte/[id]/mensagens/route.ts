import { MensagemSuporteBody } from '@galinheiro/api-contract';
import { responder } from '@/server/admin/suporte';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

export const POST = rota({ nome: 'admin.responder', admin: true, limite: 120, corpo: MensagemSuporteBody }, async ({ c, params, corpo, contaId, agoraMs }) => ({
  data: await responder(c, contaId, exigirUuid(params.id, 'Conversa não encontrada.'), corpo.texto, agoraMs),
}));

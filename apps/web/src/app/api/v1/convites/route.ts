import { meuConvite } from '@/server/dominio/afiliados';
import { rota } from '@/server/http/rota';

/** Tela "Convide amigos": código e link do membro, taxas, rede por nível, ganhos e indicados. */
export const GET = rota({ nome: 'convites', limite: 60 }, async ({ c, contaId, agoraMs }) => ({
  data: await meuConvite(c, contaId, agoraMs),
}));

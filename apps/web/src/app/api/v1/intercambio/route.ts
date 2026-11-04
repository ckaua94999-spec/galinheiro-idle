import { meuIntercambio } from '@/server/dominio/intercambio';
import { rota } from '@/server/http/rota';

/** Tela do Intercâmbio: tickets, regras, ofertas (ovos ou animais) e histórico. */
export const GET = rota({ nome: 'intercambio', limite: 60 }, async ({ c, contaId, agoraMs }) => ({
  data: await meuIntercambio(c, contaId, agoraMs),
}));

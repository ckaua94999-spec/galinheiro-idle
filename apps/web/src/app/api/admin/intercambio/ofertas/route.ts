import { AdminOfertaBody } from '@galinheiro/api-contract';
import { criarOferta } from '@/server/admin/intercambio';
import { rota } from '@/server/http/rota';

export const POST = rota({ nome: 'admin.intercambio.ofertas.criar', admin: true, limite: 60, corpo: AdminOfertaBody }, async ({ c, contaId, corpo, agoraMs }) => ({
  status: 201,
  data: await criarOferta(c, contaId, corpo, agoraMs),
}));

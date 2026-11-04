import { AdminOfertaPatchBody } from '@galinheiro/api-contract';
import { editarOferta, excluirOferta } from '@/server/admin/intercambio';
import { rota } from '@/server/http/rota';
import { exigirUuid } from '@/server/http/params';

export const PATCH = rota({ nome: 'admin.intercambio.ofertas.editar', admin: true, limite: 60, corpo: AdminOfertaPatchBody }, async ({ c, contaId, params, corpo, agoraMs }) => ({
  data: await editarOferta(c, contaId, exigirUuid(params.id, 'Oferta não encontrada.'), corpo, agoraMs),
}));

export const DELETE = rota({ nome: 'admin.intercambio.ofertas.excluir', admin: true, limite: 30 }, async ({ c, contaId, params }) => {
  await excluirOferta(c, contaId, exigirUuid(params.id, 'Oferta não encontrada.'));
  return { data: { ok: true } };
});

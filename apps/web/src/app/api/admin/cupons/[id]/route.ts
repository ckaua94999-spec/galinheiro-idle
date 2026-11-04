import { AdminCupomPatchBody } from '@galinheiro/api-contract';
import { detalheCupom, editarCupom, excluirCupom } from '@/server/admin/intercambio';
import { rota } from '@/server/http/rota';
import { exigirUuid } from '@/server/http/params';

/** Cupom e quem já resgatou. */
export const GET = rota({ nome: 'admin.cupons.detalhe', admin: true, limite: 120 }, async ({ c, params }) => ({
  data: await detalheCupom(c, exigirUuid(params.id, 'Cupom não encontrado.')),
}));

export const PATCH = rota({ nome: 'admin.cupons.editar', admin: true, limite: 60, corpo: AdminCupomPatchBody }, async ({ c, contaId, params, corpo, agoraMs }) => ({
  data: await editarCupom(c, contaId, exigirUuid(params.id, 'Cupom não encontrado.'), corpo, agoraMs),
}));

export const DELETE = rota({ nome: 'admin.cupons.excluir', admin: true, limite: 30 }, async ({ c, contaId, params }) => {
  await excluirCupom(c, contaId, exigirUuid(params.id, 'Cupom não encontrado.'));
  return { data: { ok: true } };
});

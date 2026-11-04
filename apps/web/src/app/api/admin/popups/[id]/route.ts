import { AdminPopupPatchBody } from '@galinheiro/api-contract';
import { editarPopup, excluirPopup } from '@/server/admin/popups';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

const id = (p: Record<string, string>) => exigirUuid(p.id, 'Aviso não encontrado.');

export const PATCH = rota({ nome: 'admin.popups.editar', admin: true, limite: 60, corpo: AdminPopupPatchBody }, async ({ c, params, corpo, contaId }) => ({
  data: await editarPopup(c, contaId, id(params), corpo),
}));

export const DELETE = rota({ nome: 'admin.popups.excluir', admin: true, limite: 30 }, async ({ c, params, contaId }) => {
  await excluirPopup(c, contaId, id(params));
  return { data: { excluido: true } };
});

import { AdminEditarUsuarioBody, AdminExcluirUsuarioBody } from '@galinheiro/api-contract';
import { detalheUsuario, editarUsuario, excluirUsuario } from '@/server/admin/usuarios';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

const id = (p: Record<string, string>) => exigirUuid(p.id, 'Usuário não encontrado.');

/** Ficha completa do membro. */
export const GET = rota({ nome: 'admin.usuario', admin: true, limite: 240 }, async ({ c, params, agoraMs }) => ({
  data: await detalheUsuario(c, id(params), agoraMs),
}));

/** Edita nome, telefone, e-mail e papel (admin/jogador). */
export const PATCH = rota({ nome: 'admin.usuario.editar', admin: true, corpo: AdminEditarUsuarioBody }, async ({ c, params, corpo, contaId }) => ({
  data: await editarUsuario(c, contaId, id(params), corpo),
}));

/** Exclui a conta e todos os dados do membro (LGPD). */
export const DELETE = rota({ nome: 'admin.usuario.excluir', admin: true, limite: 10, corpo: AdminExcluirUsuarioBody }, async ({ c, params, corpo, contaId }) => {
  await excluirUsuario(c, contaId, id(params), corpo.motivo);
  return { data: { excluido: true } };
});

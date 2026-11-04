import { desbloquearUsuario } from '@/server/admin/usuarios';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

export const POST = rota({ nome: 'admin.desbloquear', admin: true }, async ({ c, params, contaId }) => {
  await desbloquearUsuario(c, contaId, exigirUuid(params.id, 'Usuário não encontrado.'));
  return { data: { bloqueado: false } };
});

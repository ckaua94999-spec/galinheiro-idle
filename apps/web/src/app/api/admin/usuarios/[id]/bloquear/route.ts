import { AdminBloquearBody } from '@galinheiro/api-contract';
import { bloquearUsuario } from '@/server/admin/usuarios';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

/** Bloqueia: derruba as sessões e impede novos logins (o membro vê o motivo ao tentar entrar). */
export const POST = rota({ nome: 'admin.bloquear', admin: true, corpo: AdminBloquearBody }, async ({ c, params, corpo, contaId, agoraMs }) => {
  await bloquearUsuario(c, contaId, exigirUuid(params.id, 'Usuário não encontrado.'), corpo.motivo, agoraMs);
  return { data: { bloqueado: true } };
});

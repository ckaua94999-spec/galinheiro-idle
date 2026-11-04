import { encerrarSessoes } from '@/server/admin/usuarios';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

/** Encerra todas as sessões abertas do membro (ele precisa entrar de novo). */
export const POST = rota({ nome: 'admin.sessoes', admin: true }, async ({ c, params, contaId }) => {
  await encerrarSessoes(c, contaId, exigirUuid(params.id, 'Usuário não encontrado.'));
  return { data: { encerradas: true } };
});

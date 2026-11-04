import { auditar } from '@/server/admin/acesso';
import { ErroDominio } from '@/server/erros';
import { rota } from '@/server/http/rota';

/** Só em desenvolvimento: transforma a conta logada em administradora (para testar o /admin). */
export const POST = rota({ nome: 'dev.admin', limite: 10 }, async ({ c, contaId }) => {
  if (process.env.NODE_ENV === 'production') throw new ErroDominio('NAO_ENCONTRADO');
  await c.q(`update contas set papel = 'admin', atualizado_em = now() where id = $1`, [contaId]);
  await auditar(c, contaId, 'virar_admin_dev', contaId);
  return { data: { admin: true } };
});

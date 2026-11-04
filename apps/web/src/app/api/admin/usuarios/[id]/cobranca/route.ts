import { AdminCobrancaBody } from '@galinheiro/api-contract';
import { definirCobranca } from '@/server/admin/usuarios';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

/** Define se as próximas cobranças deste membro nascem em PIX ou em USDT. */
export const POST = rota({ nome: 'admin.cobranca', admin: true, idempotente: true, corpo: AdminCobrancaBody }, async ({ c, params, corpo, contaId }) => ({
  data: { meio: await definirCobranca(c, contaId, exigirUuid(params.id, 'Usuário não encontrado.'), corpo.meio) },
}));

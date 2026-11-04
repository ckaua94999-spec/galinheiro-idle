import { AdminBonusLinkBody } from '@galinheiro/api-contract';
import { definirBonusLink } from '@/server/admin/usuarios';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

/** Bônus de quem se cadastrar pelo link deste membro. Null volta ao bônus geral. */
export const POST = rota({ nome: 'admin.bonus-link', admin: true, idempotente: true, corpo: AdminBonusLinkBody }, async ({ c, params, corpo, contaId }) => ({
  data: { bonusX100: await definirBonusLink(c, contaId, exigirUuid(params.id, 'Usuário não encontrado.'), corpo.bonusX100) },
}));

import { AdminBonusGeralBody } from '@galinheiro/api-contract';
import { definirBonusGeral } from '@/server/admin/afiliados';
import { rota } from '@/server/http/rota';

/** Bônus dos próximos cadastros que não têm um valor próprio no link. */
export const POST = rota({ nome: 'admin.bonus-geral', admin: true, idempotente: true, corpo: AdminBonusGeralBody }, async ({ c, corpo, contaId, agoraMs }) => ({
  data: { bonusX100: await definirBonusGeral(c, contaId, corpo.bonusX100, agoraMs) },
}));

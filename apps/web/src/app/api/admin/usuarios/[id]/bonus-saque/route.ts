import { AdminBonusSaqueBody } from '@galinheiro/api-contract';
import { definirBonusSaque } from '@/server/admin/usuarios';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

/** Libera ou volta a exigir a roleta para o bônus inicial entrar no saque. */
export const POST = rota({ nome: 'admin.bonus-saque', admin: true, idempotente: true, corpo: AdminBonusSaqueBody }, async ({ c, params, corpo, contaId }) => ({
  data: { liberado: await definirBonusSaque(c, contaId, exigirUuid(params.id, 'Usuário não encontrado.'), corpo.liberado) },
}));

import { AdminConfirmarUsdtBody } from '@galinheiro/api-contract';
import { confirmarCobrancaUsdt } from '@/server/admin/usuarios';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

/** Confirma que o USDT dessa cobrança chegou. O membro gira ou amplia no próximo toque. */
export const POST = rota({ nome: 'admin.cobranca.usdt', admin: true, idempotente: true, corpo: AdminConfirmarUsdtBody }, async ({ c, params, corpo, contaId, agoraMs }) => {
  await confirmarCobrancaUsdt(c, contaId, exigirUuid(params.id, 'Usuário não encontrado.'), corpo.cobrancaId, corpo.tipo, agoraMs);
  return { data: { ok: true } };
});

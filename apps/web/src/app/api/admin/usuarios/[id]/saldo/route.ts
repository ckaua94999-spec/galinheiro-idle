import { AdminAjusteSaldoBody } from '@galinheiro/api-contract';
import { ajustarSaldo } from '@/server/admin/usuarios';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

/** Credita (+) ou debita (−) moedas do jogo, com motivo. Idempotente: um duplo clique não credita 2 vezes. */
export const POST = rota({ nome: 'admin.saldo', admin: true, idempotente: true, corpo: AdminAjusteSaldoBody }, async ({ c, params, corpo, contaId, agoraMs }) => ({
  data: { saldoX100: await ajustarSaldo(c, contaId, exigirUuid(params.id, 'Usuário não encontrado.'), corpo.valorX100, corpo.motivo, agoraMs) },
}));

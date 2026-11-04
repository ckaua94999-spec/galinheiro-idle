import { AdminAjusteOvosBody } from '@galinheiro/api-contract';
import { ajustarOvos } from '@/server/admin/usuarios';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

/** Dá (+) ou tira (−) ovos do estoque do membro, com motivo. */
export const POST = rota({ nome: 'admin.ovos', admin: true, idempotente: true, corpo: AdminAjusteOvosBody }, async ({ c, params, corpo, contaId, agoraMs }) => {
  await ajustarOvos(c, contaId, exigirUuid(params.id, 'Usuário não encontrado.'), corpo.item, corpo.quantidade, corpo.motivo, agoraMs);
  return { data: { ok: true } };
});

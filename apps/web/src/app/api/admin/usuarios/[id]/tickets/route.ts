import { AdminAjusteTicketsBody } from '@galinheiro/api-contract';
import { ajustarTickets } from '@/server/admin/intercambio';
import { rota } from '@/server/http/rota';
import { exigirUuid } from '@/server/http/params';

/** Credita (+) ou debita (−) tickets de um membro, com motivo (auditado). */
export const POST = rota(
  { nome: 'admin.usuarios.tickets', admin: true, limite: 60, idempotente: true, corpo: AdminAjusteTicketsBody },
  async ({ c, contaId, params, corpo, agoraMs }) => ({
    data: { tickets: await ajustarTickets(c, contaId, exigirUuid(params.id, 'Usuário não encontrado.'), corpo.quantidade, corpo.motivo, agoraMs) },
  }),
);

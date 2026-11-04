import { AdminIntercambioConfigBody } from '@galinheiro/api-contract';
import { painelIntercambio, salvarConfigIntercambio } from '@/server/admin/intercambio';
import { rota } from '@/server/http/rota';

export const GET = rota({ nome: 'admin.intercambio', admin: true, limite: 120 }, async ({ c, agoraMs }) => ({
  data: await painelIntercambio(c, agoraMs),
}));

/** Regras do Intercâmbio (aberto, compra de tickets, preço e limite diário). Fica na auditoria. */
export const PUT = rota(
  { nome: 'admin.intercambio.salvar', admin: true, limite: 30, corpo: AdminIntercambioConfigBody },
  async ({ c, contaId, corpo, agoraMs }) => ({ data: await salvarConfigIntercambio(c, contaId, corpo, agoraMs) }),
);

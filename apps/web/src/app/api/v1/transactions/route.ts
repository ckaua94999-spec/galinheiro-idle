import { TransactionsQuery } from '@galinheiro/api-contract';
import { extrato } from '@/server/dominio/colecao';
import { rota } from '@/server/http/rota';

export const GET = rota({ nome: 'transactions', limite: 60, consulta: TransactionsQuery }, async ({ c, contaId, consulta }) => ({
  data: await extrato(c, contaId, consulta.limit, consulta.cursor),
}));

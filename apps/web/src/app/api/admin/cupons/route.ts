import { AdminCupomBody } from '@galinheiro/api-contract';
import { criarCupom, listarCupons } from '@/server/admin/intercambio';
import { rota } from '@/server/http/rota';

export const GET = rota({ nome: 'admin.cupons', admin: true, limite: 120 }, async ({ c }) => ({ data: await listarCupons(c) }));

export const POST = rota({ nome: 'admin.cupons.criar', admin: true, limite: 60, corpo: AdminCupomBody }, async ({ c, contaId, corpo, agoraMs }) => ({
  status: 201,
  data: await criarCupom(c, contaId, corpo, agoraMs),
}));

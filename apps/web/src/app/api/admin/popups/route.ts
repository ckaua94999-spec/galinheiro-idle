import { AdminPopupBody } from '@galinheiro/api-contract';
import { criarPopup, listarPopups } from '@/server/admin/popups';
import { rota } from '@/server/http/rota';

export const GET = rota({ nome: 'admin.popups', admin: true, limite: 120 }, async ({ c }) => ({ data: await listarPopups(c) }));

export const POST = rota({ nome: 'admin.popups.criar', admin: true, limite: 30, corpo: AdminPopupBody }, async ({ c, corpo, contaId, agoraMs }) => ({
  status: 201,
  data: await criarPopup(c, contaId, corpo, agoraMs),
}));

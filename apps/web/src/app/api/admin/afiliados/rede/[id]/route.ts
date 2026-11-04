import { redeDoMembro } from '@/server/admin/afiliados';
import { rota } from '@/server/http/rota';
import { exigirUuid } from '@/server/http/params';

export const GET = rota({ nome: 'admin.afiliados.rede', admin: true, limite: 240 }, async ({ c, params }) => ({
  data: await redeDoMembro(c, exigirUuid(params.id, 'Usuário não encontrado.')),
}));

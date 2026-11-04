import { resumo } from '@/server/admin/painel';
import { rota } from '@/server/http/rota';

export const GET = rota({ nome: 'admin.resumo', admin: true, limite: 120 }, async ({ c, agoraMs }) => ({ data: await resumo(c, agoraMs) }));

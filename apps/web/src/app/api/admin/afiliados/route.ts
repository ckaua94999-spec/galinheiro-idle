import { AdminAfiliadosQuery } from '@galinheiro/api-contract';
import { resumoAfiliados } from '@/server/admin/afiliados';
import { rota } from '@/server/http/rota';

export const GET = rota({ nome: 'admin.afiliados', admin: true, limite: 120, consulta: AdminAfiliadosQuery }, async ({ c, consulta, agoraMs }) => ({
  data: await resumoAfiliados(c, agoraMs, consulta.dias, consulta.ordenar),
}));

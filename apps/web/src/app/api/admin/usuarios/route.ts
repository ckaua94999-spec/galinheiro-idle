import { AdminUsuariosQuery } from '@galinheiro/api-contract';
import { listarUsuarios } from '@/server/admin/usuarios';
import { rota } from '@/server/http/rota';

export const GET = rota({ nome: 'admin.usuarios', admin: true, limite: 240, consulta: AdminUsuariosQuery }, async ({ c, consulta, agoraMs }) => ({
  data: await listarUsuarios(c, consulta, agoraMs),
}));

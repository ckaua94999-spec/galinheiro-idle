import { AdminAuditoriaQuery } from '@galinheiro/api-contract';
import { listarAuditoria } from '@/server/admin/usuarios';
import { rota } from '@/server/http/rota';

export const GET = rota({ nome: 'admin.auditoria', admin: true, limite: 120, consulta: AdminAuditoriaQuery }, async ({ c, consulta }) => ({
  data: await listarAuditoria(c, consulta.pagina, consulta.porPagina),
}));

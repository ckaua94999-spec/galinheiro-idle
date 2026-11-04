import { AdminConfigAfiliadosBody } from '@galinheiro/api-contract';
import { salvarConfigAfiliados } from '@/server/admin/afiliados';
import { lerConfigAfiliados } from '@/server/dominio/afiliados';
import { rota } from '@/server/http/rota';

export const GET = rota({ nome: 'admin.afiliados.config', admin: true, limite: 120 }, async ({ c }) => ({
  data: await lerConfigAfiliados(c),
}));

/** Taxas e comissões: valem para as vendas daqui em diante (fica na auditoria). */
export const PUT = rota(
  { nome: 'admin.afiliados.config.salvar', admin: true, limite: 30, corpo: AdminConfigAfiliadosBody },
  async ({ c, contaId, corpo, agoraMs }) => ({ data: await salvarConfigAfiliados(c, contaId, corpo, agoraMs) }),
);

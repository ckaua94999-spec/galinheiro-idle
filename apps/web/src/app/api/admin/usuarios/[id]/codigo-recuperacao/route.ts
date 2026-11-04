import type { AdminCodigoRecuperacaoDTO } from '@galinheiro/api-contract';
import { novoCodigoRecuperacao } from '@/server/admin/usuarios';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

/** Gera um código de recuperação novo (o antigo deixa de valer) para a equipe passar ao membro. */
export const POST = rota({ nome: 'admin.codigo', admin: true, limite: 20 }, async ({ c, params, contaId }) => {
  const data: AdminCodigoRecuperacaoDTO = { codigoRecuperacao: await novoCodigoRecuperacao(c, contaId, exigirUuid(params.id, 'Usuário não encontrado.')) };
  return { data };
});

import { AdminNivelBody } from '@galinheiro/api-contract';
import { definirNivel } from '@/server/admin/usuarios';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

/** Define o nível do galinheiro (1–32; não deixa sumir ninho ocupado). */
export const POST = rota({ nome: 'admin.nivel', admin: true, corpo: AdminNivelBody }, async ({ c, params, corpo, contaId, agoraMs }) => {
  await definirNivel(c, contaId, exigirUuid(params.id, 'Usuário não encontrado.'), corpo.nivel, corpo.motivo, agoraMs);
  return { data: { nivel: corpo.nivel } };
});

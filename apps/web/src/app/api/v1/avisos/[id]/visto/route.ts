import { registrarVisto } from '@/server/admin/popups';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

export const POST = rota({ nome: 'avisos.visto', limite: 60 }, async ({ c, contaId, params, agoraMs }) => {
  await registrarVisto(c, contaId, exigirUuid(params.id, 'Aviso não encontrado.'), agoraMs);
  return { data: { ok: true } };
});

import { AdminDarAnimalBody } from '@galinheiro/api-contract';
import { darAnimal } from '@/server/admin/usuarios';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

/** Dá um animal ao membro (no primeiro ninho livre, origem SUPORTE). */
export const POST = rota({ nome: 'admin.animal', admin: true, idempotente: true, corpo: AdminDarAnimalBody }, async ({ c, params, corpo, contaId, agoraMs, rng }) => ({
  data: { entityId: await darAnimal(c, contaId, exigirUuid(params.id, 'Usuário não encontrado.'), corpo.tipo, corpo.motivo, agoraMs, rng) },
}));

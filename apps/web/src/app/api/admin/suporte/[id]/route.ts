import { AdminConversaPatchBody } from '@galinheiro/api-contract';
import { conversaAdmin, mudarStatusConversa } from '@/server/admin/suporte';
import { exigirUuid } from '@/server/http/params';
import { rota } from '@/server/http/rota';

const id = (p: Record<string, string>) => exigirUuid(p.id, 'Conversa não encontrada.');

export const GET = rota({ nome: 'admin.conversa', admin: true, limite: 240 }, async ({ c, params }) => ({ data: await conversaAdmin(c, id(params)) }));

/** Marca como resolvida ou reabre. */
export const PATCH = rota({ nome: 'admin.conversa.status', admin: true, corpo: AdminConversaPatchBody }, async ({ c, params, corpo, contaId }) => ({
  data: await mudarStatusConversa(c, contaId, id(params), corpo.status),
}));

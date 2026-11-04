import { AdminConversasQuery, AdminNovaConversaBody } from '@galinheiro/api-contract';
import { iniciarConversa, listarConversas } from '@/server/admin/suporte';
import { rota } from '@/server/http/rota';

/** Fila de atendimento (não lidas primeiro). */
export const GET = rota({ nome: 'admin.suporte', admin: true, limite: 240, consulta: AdminConversasQuery }, async ({ c, consulta }) => ({
  data: await listarConversas(c, consulta),
}));

/** A equipe inicia (ou continua) a conversa com um membro. */
export const POST = rota({ nome: 'admin.suporte.iniciar', admin: true, limite: 60, corpo: AdminNovaConversaBody }, async ({ c, corpo, contaId, agoraMs }) => ({
  data: await iniciarConversa(c, contaId, corpo.contaId, corpo.texto, agoraMs),
}));

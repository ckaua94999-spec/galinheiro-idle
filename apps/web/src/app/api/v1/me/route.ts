import { DeleteMeBody, PatchMeBody } from '@galinheiro/api-contract';
import { excluirConta } from '@/server/auth/contas';
import { conexaoSegura, cookiesDeSaida } from '@/server/auth/sessao';
import { atualizarPerfil } from '@/server/dominio/jogo';
import { rota } from '@/server/http/rota';

export const PATCH = rota({ nome: 'me', limite: 30, idempotente: true, corpo: PatchMeBody }, async ({ c, contaId, corpo, agoraMs }) => {
  const r = await atualizarPerfil(c, contaId, corpo, agoraMs);
  return { data: r.data, stateVersion: r.versao };
});

/** Exclusão de conta (LGPD): apaga tudo em cascata e encerra a sessão. */
export const DELETE = rota({ nome: 'me.delete', limite: 5, corpo: DeleteMeBody }, async ({ req, c, contaId }) => {
  await excluirConta(c, contaId);
  return { data: { excluido: true }, cookies: cookiesDeSaida(conexaoSegura(req)) };
});

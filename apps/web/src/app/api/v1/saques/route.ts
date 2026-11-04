import { SaqueBody } from '@galinheiro/api-contract';
import { listarSaques, solicitarSaque } from '@/server/dominio/saque';
import { rota } from '@/server/http/rota';

export const GET = rota({ nome: 'saques', limite: 60 }, async ({ c, contaId, agoraMs }) => {
  return { data: await listarSaques(c, contaId, agoraMs) };
});

export const POST = rota({ nome: 'saques', limite: 10, idempotente: true, corpo: SaqueBody }, async ({ c, contaId, corpo, agoraMs, req }) => {
  const chave = req.headers.get('idempotency-key') ?? '';
  const r = await solicitarSaque(c, contaId, corpo, agoraMs, chave);
  return { data: r.data, stateVersion: r.versao };
});

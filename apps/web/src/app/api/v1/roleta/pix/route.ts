import { ConsultaCobrancaRoleta } from '@galinheiro/api-contract';
import { abrirCobrancaRoleta, atualizarCobrancaRoleta } from '@/server/dominio/roleta-pix';
import { rota } from '@/server/http/rota';

export const POST = rota({ nome: 'roleta-pix', limite: 10, idempotente: true }, async ({ c, contaId, agoraMs, req }) => {
  const chave = req.headers.get('idempotency-key') ?? '';
  return { data: await abrirCobrancaRoleta(c, contaId, agoraMs, chave) };
});

export const GET = rota({ nome: 'roleta-pix-status', limite: 40, consulta: ConsultaCobrancaRoleta }, async ({ c, contaId, agoraMs, consulta }) => {
  return { data: await atualizarCobrancaRoleta(c, contaId, consulta.id, agoraMs) };
});

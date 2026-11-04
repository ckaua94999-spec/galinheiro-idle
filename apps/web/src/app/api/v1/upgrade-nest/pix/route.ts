import { ConsultaCobrancaRoleta } from '@galinheiro/api-contract';
import { abrirCobrancaAmpliacao, atualizarCobrancaAmpliacao } from '@/server/dominio/ampliacao-pix';
import { rota } from '@/server/http/rota';

export const POST = rota({ nome: 'ampliacao-pix', limite: 10, idempotente: true }, async ({ c, contaId, agoraMs, req }) => {
  const chave = req.headers.get('idempotency-key') ?? '';
  return { data: await abrirCobrancaAmpliacao(c, contaId, agoraMs, chave) };
});

export const GET = rota({ nome: 'ampliacao-pix-status', limite: 40, consulta: ConsultaCobrancaRoleta }, async ({ c, contaId, agoraMs, consulta }) => {
  return { data: await atualizarCobrancaAmpliacao(c, contaId, consulta.id, agoraMs) };
});

import { AceitarTermosBody } from '@galinheiro/api-contract';
import { aceitarTermos } from '@/server/auth/contas';
import { rota } from '@/server/http/rota';

/** Aceite dos termos de uso por quem já tem conta (o cadastro novo já aceita no formulário). */
export const POST = rota(
  { nome: 'termos', limite: 20, idempotente: true, corpo: AceitarTermosBody },
  async ({ c, contaId, corpo, agoraMs }) => ({ data: await aceitarTermos(c, contaId, corpo.versao, agoraMs) }),
);

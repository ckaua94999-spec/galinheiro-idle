import { PushAssinaturaBody, PushRemoverBody } from '@galinheiro/api-contract';
import { rota } from '@/server/http/rota';
import { removerAssinatura, salvarAssinatura } from '@/server/push/push';

export const POST = rota({ nome: 'push.assinar', limite: 10, corpo: PushAssinaturaBody }, async ({ c, contaId, corpo }) => {
  await salvarAssinatura(c, contaId, corpo);
  return { status: 201, data: { assinado: true } };
});

export const DELETE = rota({ nome: 'push.remover', limite: 10, corpo: PushRemoverBody }, async ({ c, contaId, corpo }) => {
  await removerAssinatura(c, contaId, corpo.endpoint);
  return { data: { assinado: false } };
});

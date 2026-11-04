import { lerConta } from '@/server/auth/contas';
import { sessaoValida } from '@/server/auth/sessao';
import { rota } from '@/server/http/rota';

export const GET = rota({ nome: 'auth.sessao', autenticado: false, limite: 120, transacao: false }, async ({ banco, sessao }) => {
  if (!sessao || !(await sessaoValida(banco, sessao))) return { data: { autenticado: false, conta: null } };
  return { data: { autenticado: true, conta: await lerConta(banco, sessao.contaId) } };
});

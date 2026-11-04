import { EntrarEmailBody } from '@galinheiro/api-contract';
import { entrarComEmail, lerConta } from '@/server/auth/contas';
import { conexaoSegura, cookieDeSessao, emitirToken } from '@/server/auth/sessao';
import { rota } from '@/server/http/rota';

export const POST = rota(
  { nome: 'auth.entrar', autenticado: false, limite: 10, transacao: false, corpo: EntrarEmailBody },
  async ({ req, banco, corpo }) => {
    const { contaId, versao } = await entrarComEmail(banco, corpo.email, corpo.senha);
    return {
      data: { autenticado: true, conta: await lerConta(banco, contaId) },
      cookies: [cookieDeSessao(await emitirToken(contaId, versao), conexaoSegura(req))],
    };
  },
);

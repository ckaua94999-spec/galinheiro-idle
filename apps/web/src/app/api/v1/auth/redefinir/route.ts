import { RedefinirSenhaBody } from '@galinheiro/api-contract';
import { lerConta, redefinirSenha } from '@/server/auth/contas';
import { conexaoSegura, cookieDeSessao, emitirToken } from '@/server/auth/sessao';
import { rota } from '@/server/http/rota';

export const POST = rota(
  { nome: 'auth.redefinir', autenticado: false, limite: 5, transacao: false, corpo: RedefinirSenhaBody },
  async ({ req, banco, corpo }) => {
    const r = await redefinirSenha(banco, corpo.email, corpo.codigoRecuperacao, corpo.novaSenha);
    return {
      data: { conta: await lerConta(banco, r.contaId), codigoRecuperacao: r.codigoRecuperacao },
      cookies: [cookieDeSessao(await emitirToken(r.contaId, r.versao), conexaoSegura(req))],
    };
  },
);

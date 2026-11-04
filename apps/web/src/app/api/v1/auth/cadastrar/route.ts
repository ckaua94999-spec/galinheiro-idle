import { CadastrarBody } from '@galinheiro/api-contract';
import { cadastrarMembro } from '@/server/auth/contas';
import { conexaoSegura, cookieDeSessao, emitirToken } from '@/server/auth/sessao';
import { rota } from '@/server/http/rota';

/**
 * Cadastro de membro (nome, telefone, e-mail e senha): cria a conta já com o galinheiro e entra. Devolve o
 * código de recuperação, mostrado uma única vez. Não há mais conta de convidado.
 */
export const POST = rota(
  { nome: 'auth.cadastrar', autenticado: false, limite: 6, transacao: false, corpo: CadastrarBody },
  async ({ req, banco, corpo, agoraMs, rng }) => {
    const r = await cadastrarMembro(banco, corpo, agoraMs, rng);
    return {
      status: 201,
      data: { conta: r.conta, codigoRecuperacao: r.codigoRecuperacao },
      cookies: [cookieDeSessao(await emitirToken(r.contaId, r.versao), conexaoSegura(req))],
    };
  },
);

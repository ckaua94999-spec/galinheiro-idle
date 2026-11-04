import { AdminEntrarBody } from '@galinheiro/api-contract';
import { cookieDoPainel, entrarNoPainel } from '@/server/admin/login';
import { conexaoSegura } from '@/server/auth/sessao';
import { rota } from '@/server/http/rota';

/** Login do painel (usuário e senha do ambiente). Limite baixo por IP contra tentativas em série. */
export const POST = rota(
  { nome: 'admin.auth.entrar', autenticado: false, limite: 5, transacao: false, corpo: AdminEntrarBody },
  async ({ req, banco, corpo }) => ({
    data: { ok: true },
    cookies: [cookieDoPainel(await entrarNoPainel(banco, corpo.usuario, corpo.senha), conexaoSegura(req))],
  }),
);

import { conexaoSegura, cookiesDeSaida } from '@/server/auth/sessao';
import { rota } from '@/server/http/rota';

export const POST = rota({ nome: 'auth.sair', autenticado: false, limite: 30, transacao: false }, async ({ req }) => ({
  data: { autenticado: false },
  cookies: cookiesDeSaida(conexaoSegura(req)),
}));

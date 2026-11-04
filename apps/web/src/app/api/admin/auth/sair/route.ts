import { cookiesDeSaidaDoPainel } from '@/server/admin/login';
import { conexaoSegura } from '@/server/auth/sessao';
import { rota } from '@/server/http/rota';

export const POST = rota({ nome: 'admin.auth.sair', autenticado: false, limite: 30 }, async ({ req }) => ({
  data: { ok: true },
  cookies: cookiesDeSaidaDoPainel(conexaoSegura(req)),
}));

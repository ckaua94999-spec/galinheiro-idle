import type { AdminSessaoDTO } from '@galinheiro/api-contract';
import { ehAdmin } from '@/server/admin/acesso';
import { credenciaisPainel, lerSessaoPainel, sessaoPainelValida } from '@/server/admin/login';
import { lerSessaoDaRequisicao, sessaoValida } from '@/server/auth/sessao';
import { rota } from '@/server/http/rota';

/** Quem está no painel: o login do painel ou, sem ele, a conta do jogo com papel de admin. Nunca dá 401. */
export const GET = rota({ nome: 'admin.auth.sessao', autenticado: false, limite: 240 }, async ({ c, req }) => {
  const configurado = !!credenciaisPainel();
  const painel = await lerSessaoPainel(req);
  if (painel && (await sessaoPainelValida(c, painel))) {
    const op = await c.um<{ nome: string | null; usuario: string | null }>('select nome, usuario from contas where id = $1', [painel.contaId]);
    const data: AdminSessaoDTO = { autenticado: true, configurado, via: 'painel', nome: op?.nome ?? null, usuario: op?.usuario ?? null };
    return { data };
  }
  const membro = await lerSessaoDaRequisicao(req);
  if (membro && (await sessaoValida(c, membro))) {
    const l = await c.um<{ papel: string; email: string | null; nome: string | null }>('select papel, email, nome from contas where id = $1', [membro.contaId]);
    if (l && ehAdmin(l)) {
      const data: AdminSessaoDTO = { autenticado: true, configurado, via: 'jogo', nome: l.nome, usuario: null };
      return { data };
    }
  }
  const data: AdminSessaoDTO = { autenticado: false, configurado, via: null, nome: null, usuario: null };
  return { data };
});

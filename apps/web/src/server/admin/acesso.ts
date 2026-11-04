// Quem é administrador: papel 'admin' na conta OU e-mail listado em ADMIN_EMAILS (é assim que se cria o
// primeiro admin em produção; depois, um admin promove outros pelo painel). Toda ação do painel é auditada.
import type { Consulta } from '../db/banco';
import { ErroDominio } from '../erros';
import { agoraMs } from '../relogio';

export function emailsAdmin(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const ehAdmin = (l: { papel?: string | null; email: string | null }): boolean =>
  l.papel === 'admin' || (!!l.email && emailsAdmin().has(l.email.toLowerCase()));

export async function exigirAdmin(c: Consulta, contaId: string): Promise<void> {
  const l = await c.um<{ papel: string; email: string | null }>('select papel, email from contas where id = $1', [contaId]);
  if (!l || !ehAdmin(l)) throw new ErroDominio('ACESSO_NEGADO');
}

/** Registra uma ação do painel (quem fez, o quê, em quem e com quais dados). */
export async function auditar(
  c: Consulta, adminId: string, acao: string, alvoContaId: string | null, detalhes: Record<string, unknown> = {},
): Promise<void> {
  // hora do relógio do jogo, como as demais datas (em dev, o relógio ajustável)
  await c.q('insert into admin_acoes (admin_id, acao, alvo_conta_id, detalhes, criado_em) values ($1, $2, $3, $4::jsonb, $5)', [
    adminId,
    acao,
    alvoContaId,
    JSON.stringify(detalhes),
    new Date(agoraMs()),
  ]);
}

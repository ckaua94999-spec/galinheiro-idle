// Login próprio do painel administrador, separado da conta do jogo: usuário e senha definidos no ambiente
// (ADMIN_USUARIO e ADMIN_SENHA_HASH — só o hash scrypt, nunca a senha). A sessão do painel é um cookie próprio
// (12 h, SameSite=Strict) e cai sozinha quando a senha ou o usuário mudam no ambiente. Quem assina as ações do
// painel é a conta "operador" desse usuário: não é membro nem jogador, então não entra em nenhuma estatística.
import { createHash } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import type { Banco, Consulta } from '../db/banco';
import { ErroDominio } from '../erros';
import { segredoSessao } from '../auth/segredos';
import { conferirHash } from '../auth/senha';

const PRODUCAO = process.env.NODE_ENV === 'production';
const COOKIE_PAINEL_HTTP = 'gi_painel';
const COOKIE_PAINEL_SEGURO = '__Host-gi_painel';
export const COOKIE_PAINEL = PRODUCAO ? COOKIE_PAINEL_SEGURO : COOKIE_PAINEL_HTTP;
const VALIDADE_S = 12 * 60 * 60;

export interface CredenciaisPainel { usuario: string; hash: string; nome: string }

/** Usuário e hash do ambiente. O hash pode vir com ":" no lugar de "$" (o .env expandiria "$16384…"). */
export function credenciaisPainel(): CredenciaisPainel | null {
  const usuario = process.env.ADMIN_USUARIO?.trim().toLowerCase();
  const hash = process.env.ADMIN_SENHA_HASH?.trim().replace(/:/g, '$');
  if (!usuario || !hash) return null;
  return { usuario, hash, nome: process.env.ADMIN_NOME?.trim() || 'Equipe Galinheiro' };
}

/** Impressão digital de usuário + hash: trocar qualquer um dos dois derruba as sessões abertas do painel. */
const impressao = (c: CredenciaisPainel): string =>
  createHash('sha256').update(`${c.usuario}\n${c.hash}`).digest('base64url').slice(0, 16);

/** Confere usuário e senha e devolve o token da sessão do painel. Tempo constante mesmo com usuário errado. */
export async function entrarNoPainel(banco: Banco, usuario: string, senha: string): Promise<string> {
  const cfg = credenciaisPainel();
  const usuarioOk = !!cfg && usuario.trim().toLowerCase() === cfg.usuario;
  const senhaOk = await conferirHash(senha, usuarioOk ? cfg.hash : null);
  if (!cfg || !usuarioOk || !senhaOk) throw new ErroDominio('CREDENCIAIS_INVALIDAS', undefined, 'Usuário ou senha incorretos.');
  const conta = (await banco.um<{ id: string; sessao_versao: number }>(
    `insert into contas (tipo, usuario, nome, papel) values ('operador', $1, $2, 'admin')
     on conflict (usuario) do update set nome = excluded.nome, papel = 'admin', atualizado_em = now()
     returning id, sessao_versao`,
    [cfg.usuario, cfg.nome],
  ))!;
  return new SignJWT({ v: conta.sessao_versao, h: impressao(cfg), esc: 'painel' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(conta.id)
    .setIssuedAt()
    .setExpirationTime(`${VALIDADE_S}s`)
    .sign(segredoSessao());
}

export interface SessaoPainel { contaId: string; versao: number; emitidoEm: number; impressao: string }

function nomeDoPainel(seguro: boolean): string {
  return seguro ? COOKIE_PAINEL_SEGURO : COOKIE_PAINEL_HTTP;
}

export async function lerSessaoPainel(req: NextRequest): Promise<SessaoPainel | null> {
  const token = req.cookies.get(COOKIE_PAINEL_SEGURO)?.value ?? req.cookies.get(COOKIE_PAINEL_HTTP)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredoSessao(), { algorithms: ['HS256'] });
    if (payload.esc !== 'painel' || typeof payload.sub !== 'string' || typeof payload.v !== 'number' || typeof payload.h !== 'string') {
      return null;
    }
    return { contaId: payload.sub, versao: payload.v, emitidoEm: payload.iat ?? 0, impressao: payload.h };
  } catch {
    return null;
  }
}

/** A sessão do painel vale se o usuário e a senha do ambiente são os mesmos de quando ela foi aberta. */
export async function sessaoPainelValida(c: Consulta, s: SessaoPainel): Promise<boolean> {
  const cfg = credenciaisPainel();
  if (!cfg || s.impressao !== impressao(cfg)) return false;
  const r = await c.um<{ sessao_versao: number; tipo: string; usuario: string | null }>(
    'select sessao_versao, tipo, usuario from contas where id = $1',
    [s.contaId],
  );
  return !!r && r.tipo === 'operador' && r.usuario === cfg.usuario && r.sessao_versao === s.versao;
}

export const cookieDoPainel = (token: string, seguro = PRODUCAO): string =>
  `${nomeDoPainel(seguro)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${VALIDADE_S}${seguro ? '; Secure' : ''}`;
export const cookieDeSaidaDoPainel = (seguro = PRODUCAO): string =>
  `${nomeDoPainel(seguro)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${seguro ? '; Secure' : ''}`;
export const cookiesDeSaidaDoPainel = (seguro = PRODUCAO): string[] => [cookieDeSaidaDoPainel(seguro), cookieDeSaidaDoPainel(!seguro)];

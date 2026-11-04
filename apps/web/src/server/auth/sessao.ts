// Sessão em cookie httpOnly com JWT (HS256). `v` = sessao_versao da conta: muda ao redefinir a senha,
// o que derruba as sessões abertas em outros aparelhos.
import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import type { Consulta } from '../db/banco';
import { segredoSessao } from './segredos';

const PRODUCAO = process.env.NODE_ENV === 'production';
// Em HTTPS o prefixo __Host- obriga Secure + Path=/ e proíbe Domain: subdomínios não conseguem
// injetar nem sobrescrever a sessão. Em HTTP (acesso direto pelo IP, sem TLS) o navegador recusa
// cookie Secure e o prefixo __Host-, então a sessão usa o nome simples.
const COOKIE_SESSAO_HTTP = 'gi_sessao';
const COOKIE_SESSAO_SEGURO = '__Host-gi_sessao';
export const COOKIE_SESSAO = PRODUCAO ? COOKIE_SESSAO_SEGURO : COOKIE_SESSAO_HTTP;

/** A resposta vai por HTTPS (direto ou atrás de proxy que manda X-Forwarded-Proto). */
export function conexaoSegura(req: { headers: { get(name: string): string | null }; nextUrl: { protocol: string } }): boolean {
  if (!PRODUCAO) return false;
  const encaminhado = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (encaminhado === 'https') return true;
  if (encaminhado === 'http') return false;
  return req.nextUrl.protocol === 'https:';
}
const VALIDADE_S = 400 * 24 * 60 * 60; // limite prático dos navegadores para cookies
const RENOVAR_APOS_S = 30 * 24 * 60 * 60;

export interface Sessao { contaId: string; versao: number; emitidoEm: number }

export async function emitirToken(contaId: string, versao: number): Promise<string> {
  return new SignJWT({ v: versao })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(contaId)
    .setIssuedAt()
    .setExpirationTime(`${VALIDADE_S}s`)
    .sign(segredoSessao());
}

export async function lerToken(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredoSessao(), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.v !== 'number') return null;
    return { contaId: payload.sub, versao: payload.v, emitidoEm: payload.iat ?? 0 };
  } catch {
    return null;
  }
}

export function lerSessaoDaRequisicao(req: NextRequest): Promise<Sessao | null> {
  const token = req.cookies.get(COOKIE_SESSAO_SEGURO)?.value ?? req.cookies.get(COOKIE_SESSAO_HTTP)?.value;
  return lerToken(token);
}

export function temCookieDeSessao(jar: { has(nome: string): boolean }): boolean {
  return jar.has(COOKIE_SESSAO_SEGURO) || jar.has(COOKIE_SESSAO_HTTP);
}

/**
 * Confere no banco se a sessão ainda vale: conta existe, versão bate e é MEMBRO completo (nome + telefone +
 * e-mail) e NÃO bloqueado. Sessões de contas antigas (convidado, ou e-mail sem telefone) deixam de valer.
 */
export async function sessaoValida(c: Consulta, s: Sessao): Promise<boolean> {
  const r = await c.um<{ sessao_versao: number; tipo: string; nome: string | null; telefone: string | null; bloqueado_em: Date | null }>(
    'select sessao_versao, tipo, nome, telefone, bloqueado_em from contas where id = $1',
    [s.contaId],
  );
  return r !== null && r.sessao_versao === s.versao && r.tipo === 'email' && !!r.nome && !!r.telefone && !r.bloqueado_em;
}

export const precisaRenovar = (s: Sessao): boolean => Date.now() / 1000 - s.emitidoEm > RENOVAR_APOS_S;

function nomeDaSessao(seguro: boolean): string {
  return seguro ? COOKIE_SESSAO_SEGURO : COOKIE_SESSAO_HTTP;
}

export function cookieDeSessao(token: string, seguro = PRODUCAO): string {
  return `${nomeDaSessao(seguro)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${VALIDADE_S}${seguro ? '; Secure' : ''}`;
}

export function cookieDeSaida(seguro = PRODUCAO): string {
  return `${nomeDaSessao(seguro)}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${seguro ? '; Secure' : ''}`;
}

/** Apaga a sessão no protocolo atual e no outro (HTTP e HTTPS usam nomes diferentes). */
export function cookiesDeSaida(seguro = PRODUCAO): string[] {
  return [cookieDeSaida(seguro), cookieDeSaida(!seguro)];
}

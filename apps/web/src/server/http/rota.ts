// Envoltório comum das rotas /api/v1: sessão, limite, validação (zod), idempotência, transação,
// envelope de resposta e tratamento de erros (GDD 9.1 e 9.6).
import { randomUUID } from 'node:crypto';
import type { CodigoErro } from '@galinheiro/api-contract';
import type { NextRequest } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import type { Rng } from '@galinheiro/game-core';
import { CONFIG_VERSAO } from '@galinheiro/game-core';
import { obterBanco, type Banco, type Consulta } from '../db/banco';
import { ErroDominio, MENSAGENS, STATUS_HTTP } from '../erros';
import { agoraMs } from '../relogio';
import { rngServidor } from '../rng';
import { garantirAgendador } from '../jobs/agendador';
import {
  conexaoSegura, cookieDeSessao, emitirToken, lerSessaoDaRequisicao, precisaRenovar, sessaoValida, type Sessao,
} from '../auth/sessao';
import { exigirAdmin } from '../admin/acesso';
import { lerSessaoPainel, sessaoPainelValida } from '../admin/login';
import { gravarResposta, hashDaRequisicao, reservarChave } from './idempotencia';
import { verificarLimite } from './limite';

export interface ContextoRota<B, Q> {
  req: NextRequest;
  banco: Banco;
  /** Transação aberta pela rota (null quando `transacao: false`). */
  c: Consulta;
  sessao: Sessao | null;
  contaId: string;
  corpo: B;
  consulta: Q;
  params: Record<string, string>;
  agoraMs: number;
  rng: Rng;
}

export interface ResultadoRota {
  data: unknown;
  stateVersion?: number;
  status?: number;
  headers?: Record<string, string>;
  cookies?: string[];
}

export interface OpcoesRota<B, Q> {
  /** Nome curto do endpoint (limites e idempotência). */
  nome: string;
  autenticado?: boolean;
  corpo?: ZodType<B>;
  consulta?: ZodType<Q>;
  idempotente?: boolean;
  /** Requisições por minuto por conta (ou por IP quando não autenticado). */
  limite?: number;
  /** false = o caso de uso abre as próprias transações (ex.: hash de senha fora da trava). */
  transacao?: boolean;
  /** Só administradores (papel 'admin' ou e-mail em ADMIN_EMAILS); senão 403 ACESSO_NEGADO. */
  admin?: boolean;
}

interface Envelope { ok: boolean; data?: unknown; error?: unknown; serverTime: string; stateVersion?: number }

function ipDe(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}

function respostaJson(corpo: unknown, status: number, extras: { headers?: Record<string, string>; cookies?: string[] } = {}): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Config-Version': CONFIG_VERSAO,
    ...extras.headers,
  });
  for (const ck of extras.cookies ?? []) headers.append('Set-Cookie', ck);
  return new Response(JSON.stringify(corpo), { status, headers });
}

export function respostaErro(codigo: CodigoErro, detalhes?: Record<string, unknown>, mensagem?: string, headers?: Record<string, string>): Response {
  const env: Envelope = {
    ok: false,
    error: { code: codigo, message: mensagem ?? MENSAGENS[codigo], ...(detalhes ? { details: detalhes } : {}) },
    serverTime: new Date(agoraMs()).toISOString(),
  };
  return respostaJson(env, STATUS_HTTP[codigo], { headers });
}

async function lerCorpo<B>(req: NextRequest, schema: ZodType<B>): Promise<B> {
  let bruto: unknown = {};
  const texto = await req.text();
  if (texto.trim()) {
    try {
      bruto = JSON.parse(texto);
    } catch {
      throw new ErroDominio('PAYLOAD_INVALIDO', { motivo: 'JSON inválido' });
    }
  }
  return schema.parse(bruto);
}

export function rota<B = undefined, Q = undefined>(
  opcoes: OpcoesRota<B, Q>,
  fn: (ctx: ContextoRota<B, Q>) => Promise<ResultadoRota>,
) {
  return async (req: NextRequest, ctxNext?: { params?: Promise<Record<string, string>> }): Promise<Response> => {
    const requestId = randomUUID();
    try {
      garantirAgendador();
      const autenticado = opcoes.autenticado !== false;
      // nas rotas do painel vale primeiro o login do painel; sem ele, a conta do jogo com papel de admin
      const painel = opcoes.admin ? await lerSessaoPainel(req) : null;
      const sessao: Sessao | null = painel ?? (await lerSessaoDaRequisicao(req));
      if (autenticado && !sessao) throw new ErroDominio('NAO_AUTENTICADO');

      const limite = verificarLimite(`${opcoes.nome}:${sessao?.contaId ?? ipDe(req)}`, opcoes.limite ?? 60);
      if (!limite.ok) {
        return respostaErro('RATE_LIMITED', { retryAfterS: limite.retryAfterS }, undefined, { 'Retry-After': String(limite.retryAfterS) });
      }

      const corpo = (opcoes.corpo ? await lerCorpo(req, opcoes.corpo) : undefined) as B;
      const consulta = (opcoes.consulta
        ? opcoes.consulta.parse(Object.fromEntries(req.nextUrl.searchParams.entries()))
        : undefined) as Q;
      const params = (await ctxNext?.params) ?? {};
      const chave = opcoes.idempotente ? req.headers.get('idempotency-key') : null;
      if (opcoes.idempotente && (!chave || chave.length < 8 || chave.length > 64)) {
        throw new ErroDominio('IDEMPOTENCY_KEY_AUSENTE');
      }

      const banco = await obterBanco();
      const agora = agoraMs();
      const base = { req, banco, sessao, contaId: sessao?.contaId ?? '', corpo, consulta, params, agoraMs: agora, rng: rngServidor };

      const executar = async (c: Consulta): Promise<{ replay?: { status: number; corpo: unknown }; r?: ResultadoRota }> => {
        if (painel) {
          if (!(await sessaoPainelValida(c, painel))) throw new ErroDominio('NAO_AUTENTICADO');
        } else {
          if (sessao && autenticado && !(await sessaoValida(c, sessao))) throw new ErroDominio('NAO_AUTENTICADO');
          if (opcoes.admin) {
            if (!sessao) throw new ErroDominio('NAO_AUTENTICADO');
            await exigirAdmin(c, sessao.contaId);
          }
        }
        if (chave && sessao) {
          const hash = hashDaRequisicao(req.method, req.nextUrl.pathname, corpo);
          const replay = await reservarChave(c, sessao.contaId, chave, opcoes.nome, hash);
          if (replay) return { replay };
          const r = await fn({ ...base, c });
          await gravarResposta(c, sessao.contaId, chave, { status: r.status ?? 200, corpo: montarEnvelope(r, agora) });
          return { r };
        }
        return { r: await fn({ ...base, c }) };
      };

      const saida = opcoes.transacao === false
        ? await executar(banco)
        : await banco.tx(executar);

      if (saida.replay) {
        return respostaJson(saida.replay.corpo, saida.replay.status, { headers: { 'Idempotent-Replayed': 'true' } });
      }
      const r = saida.r!;
      const cookies = [...(r.cookies ?? [])];
      if (sessao && !painel && autenticado && precisaRenovar(sessao) && !cookies.length) {
        cookies.push(cookieDeSessao(await emitirToken(sessao.contaId, sessao.versao), conexaoSegura(req)));
      }
      return respostaJson(montarEnvelope(r, agora), r.status ?? 200, { headers: r.headers, cookies });
    } catch (erro) {
      if (erro instanceof ErroDominio) return respostaErro(erro.codigo, erro.detalhes, erro.message);
      if (erro instanceof ZodError) {
        return respostaErro('PAYLOAD_INVALIDO', {
          issues: erro.issues.map((i) => ({ caminho: i.path.join('.'), mensagem: i.message })),
        });
      }
      console.error(`[api] ${opcoes.nome} falhou (requestId=${requestId})`, erro);
      return respostaErro('ERRO_INTERNO', { requestId });
    }
  };
}

function montarEnvelope(r: ResultadoRota, agora: number): Envelope {
  return {
    ok: true,
    data: r.data,
    serverTime: new Date(agora).toISOString(),
    ...(r.stateVersion !== undefined ? { stateVersion: r.stateVersion } : {}),
  };
}

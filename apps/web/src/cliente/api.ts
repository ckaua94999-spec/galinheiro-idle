// Cliente da API /api/v1: envelope, erros tipados, Idempotency-Key, repetição segura e sincronia do relógio.
import type { CodigoErro } from '@galinheiro/api-contract';
import { marcarOffline, marcarOnline } from './conexao';
import { sincronizarRelogio } from './relogio';

export class ErroApi extends Error {
  constructor(
    readonly codigo: CodigoErro | 'REDE',
    mensagem: string,
    readonly status: number,
    readonly detalhes?: Record<string, unknown>,
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

export interface RespostaApi<T> { data: T; stateVersion?: number; serverTime: string }

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Opcoes {
  corpo?: unknown;
  /** Gera uma Idempotency-Key (uma por intenção do usuário, reaproveitada nas repetições). */
  idempotente?: boolean;
  sinal?: AbortSignal;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const EVENTO_SESSAO_PERDIDA = 'gi:sessao-perdida';

/**
 * UUID v4 para a Idempotency-Key.
 * `crypto.randomUUID` só existe em contexto seguro (https ou localhost). Em HTTP a função não está
 * disponível e a chamada quebra a ação do jogador; `getRandomValues` funciona nos dois casos.
 */
export function gerarChaveIdempotencia(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function chamar<T>(metodo: Metodo, caminho: string, op: Opcoes = {}): Promise<RespostaApi<T>> {
  const chave = op.idempotente ? gerarChaveIdempotencia() : undefined;
  // GET e mutações idempotentes podem ser repetidas com segurança (mesma chave = mesmo resultado).
  const tentativas = metodo === 'GET' || op.idempotente ? 3 : 1;
  let ultimoErro: ErroApi = new ErroApi('REDE', 'Ops, a conexão falhou. Tente de novo.', 0);

  for (let i = 0; i < tentativas; i++) {
    if (i > 0) await esperar(400 * 2 ** (i - 1));
    const inicio = performance.now();
    let resp: Response;
    try {
      resp = await fetch(caminho.startsWith('/api/') ? caminho : `/api/v1${caminho}`, {
        method: metodo,
        headers: {
          ...(op.corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(chave ? { 'Idempotency-Key': chave } : {}),
          'X-Client-Version': '1.0.0',
        },
        body: op.corpo !== undefined ? JSON.stringify(op.corpo) : undefined,
        credentials: 'same-origin',
        cache: 'no-store',
        signal: op.sinal,
      });
    } catch (erro) {
      if ((erro as Error)?.name === 'AbortError') throw erro;
      marcarOffline();
      ultimoErro = new ErroApi('REDE', 'Sem conexão. Tente de novo.', 0);
      continue;
    }
    marcarOnline();
    const rtt = performance.now() - inicio;
    const json = (await resp.json().catch(() => null)) as
      | { ok: true; data: T; stateVersion?: number; serverTime: string }
      | { ok: false; error: { code: CodigoErro; message: string; details?: Record<string, unknown> }; serverTime: string }
      | null;
    if (json?.serverTime) sincronizarRelogio(json.serverTime, rtt);

    if (resp.ok && json?.ok) return { data: json.data, stateVersion: json.stateVersion, serverTime: json.serverTime };

    if (json && json.ok === false) {
      ultimoErro = new ErroApi(json.error.code, json.error.message, resp.status, json.error.details);
      if (json.error.code === 'NAO_AUTENTICADO' && typeof window !== 'undefined') {
        window.dispatchEvent(new Event(EVENTO_SESSAO_PERDIDA));
      }
    } else {
      ultimoErro = new ErroApi('ERRO_INTERNO', 'Ops! Tente de novo.', resp.status);
    }
    if (resp.status >= 500 || resp.status === 429) continue;
    throw ultimoErro;
  }
  throw ultimoErro;
}

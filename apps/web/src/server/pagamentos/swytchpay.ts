// Cliente da SwytchPay (https://api.go.swytchpay.app/v1). As chaves ficam só no servidor.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ErroDominio } from '../erros';
import type { CobrancaPixCriada, StatusPixRemoto } from './lofypay';
import type { PedidoSaqueProvedor, ProvedorSaque, SaqueAceito } from './provedor';

const URL_PADRAO = 'https://api.go.swytchpay.app/v1';

export function urlSwytchpay(): string {
  return (process.env.SWYTCHPAY_API_URL || URL_PADRAO).replace(/\/$/, '');
}

export function chaveSwytchpay(): boolean {
  return !!(process.env.SWYTCHPAY_API_KEY?.trim() && process.env.SWYTCHPAY_API_SECRET?.trim());
}

function cabecalhos(): Record<string, string> | null {
  const chave = process.env.SWYTCHPAY_API_KEY?.trim();
  const segredo = process.env.SWYTCHPAY_API_SECRET?.trim();
  if (!chave || !segredo) return null;
  return { 'x-api-key': chave, 'x-api-secret': segredo, 'Content-Type': 'application/json' };
}

interface CorpoDeposito {
  id?: string;
  status?: string;
  pix?: { emv?: string };
  charge?: { emv?: string };
}

function lerErro(corpo: unknown): { codigo: string; mensagem: string } {
  if (!corpo || typeof corpo !== 'object') return { codigo: '', mensagem: 'sem-corpo' };
  const c = corpo as { error?: { code?: string; message?: string } | string; message?: string };
  if (typeof c.error === 'string') return { codigo: '', mensagem: c.error };
  if (c.error && typeof c.error === 'object') return { codigo: c.error.code ?? '', mensagem: c.error.message ?? '' };
  return { codigo: '', mensagem: c.message ?? 'sem-corpo' };
}

function semSaldo(status: number, codigo: string, mensagem: string): boolean {
  const texto = `${codigo} ${mensagem}`.toLowerCase();
  return status === 402 || (status === 422 && /saldo|balance|insufficient/.test(texto));
}

/** POST /v1/deposits. O external_id é o id da cobrança no jogo. */
export async function criarCobrancaSwytchpay(pedido: {
  centavos: number;
  idempotencia: string;
  referencia: string;
  nome: string;
  email: string | null;
  descricao: string;
}): Promise<CobrancaPixCriada> {
  const headers = cabecalhos();
  if (!headers) throw new ErroDominio('PIX_INDISPONIVEL');
  let resp: Response;
  try {
    resp = await fetch(`${urlSwytchpay()}/deposits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        external_id: pedido.referencia,
        amount_cents: pedido.centavos,
        currency: 'BRL',
        method: 'PIX',
        payer: {
          name: pedido.nome,
          ...(pedido.email ? { email: pedido.email } : {}),
        },
        metadata: { descricao: pedido.descricao, idempotencia: pedido.idempotencia },
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (erro) {
    console.error('[swytchpay] pix sem resposta', erro instanceof Error ? erro.message : erro);
    throw new ErroDominio('PIX_INDISPONIVEL');
  }
  const corpo = (await resp.json().catch(() => null)) as CorpoDeposito | null;
  const emv = corpo?.pix?.emv || corpo?.charge?.emv;
  if ((resp.status === 200 || resp.status === 201) && corpo?.id && emv) {
    return { idTransacao: corpo.id, copiaCola: emv, qrBase64: null };
  }
  const erro = lerErro(corpo);
  console.error(`[swytchpay] pix recusado status=${resp.status} code=${erro.codigo || 'sem-codigo'} msg=${erro.mensagem || 'sem-corpo'}`);
  if (resp.status === 429) throw new ErroDominio('RATE_LIMITED');
  throw new ErroDominio('PIX_INDISPONIVEL');
}

/** GET /v1/deposits/{id}. */
export async function consultarStatusSwytchpay(idTransacao: string): Promise<StatusPixRemoto> {
  const headers = cabecalhos();
  if (!headers) return 'desconhecido';
  let resp: Response;
  try {
    resp = await fetch(`${urlSwytchpay()}/deposits/${encodeURIComponent(idTransacao)}`, {
      headers,
      signal: AbortSignal.timeout(8_000),
    });
  } catch (erro) {
    console.error('[swytchpay] status sem resposta', erro instanceof Error ? erro.message : erro);
    return 'desconhecido';
  }
  const corpo = (await resp.json().catch(() => null)) as CorpoDeposito | null;
  if (!resp.ok || !corpo) return 'desconhecido';
  const s = String(corpo.status ?? '').toLowerCase();
  if (s === 'paid') return 'pago';
  if (s === 'pending') return 'aguardando';
  if (s === 'expired') return 'expirado';
  if (s === 'canceled' || s === 'cancelled' || s === 'failed') return 'falhou';
  return 'desconhecido';
}

function statusDoSaque(status: string): SaqueAceito['status'] | 'recusado' {
  const s = status.toLowerCase();
  if (s === 'paid') return 'pago';
  if (s === 'failed' || s === 'rejected' || s === 'canceled' || s === 'cancelled') return 'recusado';
  return 'processando';
}

/** POST /v1/payouts. O valor é o líquido que cai na chave PIX (CPF). */
export async function criarSaqueSwytchpay(pedido: PedidoSaqueProvedor): Promise<SaqueAceito> {
  const headers = cabecalhos();
  if (!headers) throw new ErroDominio('SAQUE_INDISPONIVEL');
  let resp: Response;
  try {
    resp = await fetch(`${urlSwytchpay()}/payouts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        external_id: pedido.idempotencia,
        amount_cents: pedido.centavos,
        currency: 'BRL',
        pix_key: pedido.cpf,
        pix_key_type: 'cpf',
        recipient: { name: pedido.nome, document: pedido.cpf },
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (erro) {
    console.error('[swytchpay] saque sem resposta', erro instanceof Error ? erro.message : erro);
    throw new ErroDominio('SAQUE_INDISPONIVEL');
  }
  const corpo = (await resp.json().catch(() => null)) as { id?: string; status?: string } | null;
  if ((resp.status === 200 || resp.status === 201) && corpo?.id) {
    let status = statusDoSaque(String(corpo.status ?? ''));
    if (String(corpo.status ?? '').toLowerCase() === 'pending_approval') {
      status = await aprovarSaqueSwytchpay(corpo.id);
    }
    if (status === 'recusado') throw new ErroDominio('SAQUE_INDISPONIVEL', undefined, 'A conta de pagamentos recusou este saque.');
    return { idExterno: corpo.id, status };
  }
  const erro = lerErro(corpo);
  console.error(`[swytchpay] saque recusado status=${resp.status} code=${erro.codigo || 'sem-codigo'} msg=${erro.mensagem || 'sem-corpo'}`);
  if (semSaldo(resp.status, erro.codigo, erro.mensagem)) {
    throw new ErroDominio('SAQUE_INDISPONIVEL', undefined, 'A conta de pagamentos não tem saldo para este saque.');
  }
  if (resp.status === 409) throw new ErroDominio('SAQUE_EM_ANDAMENTO');
  if (resp.status === 429) throw new ErroDominio('RATE_LIMITED');
  throw new ErroDominio('SAQUE_INDISPONIVEL');
}

/** Se a conta exige aprovação, a mesma chave tenta liberar. Sem permissão, o saque segue em processamento. */
async function aprovarSaqueSwytchpay(id: string): Promise<SaqueAceito['status'] | 'recusado'> {
  const headers = cabecalhos();
  if (!headers) return 'processando';
  try {
    const resp = await fetch(`${urlSwytchpay()}/payouts/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(12_000),
    });
    const corpo = (await resp.json().catch(() => null)) as { status?: string } | null;
    if (resp.ok) return statusDoSaque(String(corpo?.status ?? ''));
    console.error(`[swytchpay] aprovação recusada status=${resp.status} msg=${lerErro(corpo).mensagem || 'sem-corpo'}`);
  } catch (erro) {
    console.error('[swytchpay] aprovação sem resposta', erro instanceof Error ? erro.message : erro);
  }
  return 'processando';
}

export const swytchpaySaque: ProvedorSaque = { nome: 'swytchpay', criarSaque: criarSaqueSwytchpay };

/**
 * HMAC do webhook: cabeçalho X-Swytch-Signature `sha256=<hex>` sobre `${timestamp}.${corpoBruto}`,
 * com o segredo do webhook. O instante vem em X-Swytch-Timestamp. Janela de 5 minutos.
 */
export function verificarAssinaturaSwytchpay(
  corpoBruto: string, assinatura: string | null, timestamp: string | null, agoraMs = Date.now(),
): boolean {
  const segredo = process.env.SWYTCHPAY_WEBHOOK_SECRET?.trim();
  if (!segredo || !assinatura || !timestamp) return false;
  const ts = Number(timestamp);
  const dado = assinatura.replace(/^sha256=/i, '').trim().toLowerCase();
  if (!Number.isFinite(ts) || !/^[0-9a-f]+$/.test(dado) || Math.abs(agoraMs / 1000 - ts) > 300) return false;
  const esperado = createHmac('sha256', segredo).update(`${ts}.${corpoBruto}`).digest('hex');
  if (esperado.length !== dado.length) return false;
  return timingSafeEqual(Buffer.from(esperado), Buffer.from(dado));
}

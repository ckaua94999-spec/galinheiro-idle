// Cliente da KavroPay (https://api.kavropay.online/v1). A chave fica só no servidor.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ErroDominio } from '../erros';
import type { CobrancaPixCriada, StatusPixRemoto } from './lofypay';
import type { PedidoSaqueProvedor, ProvedorSaque, SaqueAceito } from './provedor';

const URL_PADRAO = 'https://api.kavropay.online/v1';

export function urlKavropay(): string {
  return (process.env.KAVROPAY_API_URL || URL_PADRAO).replace(/\/$/, '');
}

export function chaveKavropay(): string | null {
  const chave = process.env.KAVROPAY_SECRET_KEY?.trim();
  return chave ? chave : null;
}

interface RespostaCobranca {
  id?: string;
  status?: string;
  paid?: boolean;
  message?: string;
  error?: string;
  pix_copy_paste?: string;
  qr_code_base64?: string;
}

function mensagem(corpo: RespostaCobranca | null): string {
  return corpo?.message || corpo?.error || corpo?.status || 'sem-corpo';
}

/** POST /v1/charges. Valor em centavos, descrição obrigatória, validade de 15 minutos. */
export async function criarCobrancaKavropay(pedido: {
  centavos: number;
  idempotencia: string;
  referencia: string;
  nome: string;
  email: string | null;
  descricao: string;
}): Promise<CobrancaPixCriada> {
  const chave = chaveKavropay();
  if (!chave) throw new ErroDominio('PIX_INDISPONIVEL');

  const aviso = process.env.KAVROPAY_WEBHOOK_URL?.trim();
  let resp: Response;
  try {
    resp = await fetch(`${urlKavropay()}/charges`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': pedido.idempotencia,
      },
      body: JSON.stringify({
        amountCents: pedido.centavos,
        description: pedido.descricao,
        externalId: pedido.referencia,
        expiresInMinutes: 15,
        customer: {
          name: pedido.nome,
          ...(pedido.email ? { email: pedido.email } : {}),
        },
        ...(aviso ? { notification_url: aviso } : {}),
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (erro) {
    console.error('[kavropay] pix sem resposta', erro instanceof Error ? erro.message : erro);
    throw new ErroDominio('PIX_INDISPONIVEL');
  }

  const corpo = (await resp.json().catch(() => null)) as RespostaCobranca | null;
  if (resp.ok && corpo?.id && corpo.pix_copy_paste) {
    return { idTransacao: corpo.id, copiaCola: corpo.pix_copy_paste, qrBase64: corpo.qr_code_base64 ?? null };
  }
  console.error(`[kavropay] pix recusado status=${resp.status} msg=${mensagem(corpo)}`);
  if (resp.status === 429) throw new ErroDominio('RATE_LIMITED');
  throw new ErroDominio('PIX_INDISPONIVEL');
}

/** GET /v1/charges/{id}/status. */
export async function consultarStatusKavropay(idTransacao: string): Promise<StatusPixRemoto> {
  const chave = chaveKavropay();
  if (!chave) return 'desconhecido';
  let resp: Response;
  try {
    resp = await fetch(`${urlKavropay()}/charges/${encodeURIComponent(idTransacao)}/status`, {
      headers: { Authorization: `Bearer ${chave}` },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (erro) {
    console.error('[kavropay] status sem resposta', erro instanceof Error ? erro.message : erro);
    return 'desconhecido';
  }
  const corpo = (await resp.json().catch(() => null)) as RespostaCobranca | null;
  if (!resp.ok || !corpo) return 'desconhecido';
  if (corpo.paid === true) return 'pago';
  const s = String(corpo.status ?? '').toLowerCase();
  if (s === 'paid') return 'pago';
  if (s === 'waiting_payment' || s === 'pending') return 'aguardando';
  if (s === 'expired') return 'expirado';
  if (s === 'cancelled' || s === 'canceled' || s === 'refunded' || s === 'failed') return 'falhou';
  return 'desconhecido';
}

/** POST /v1/withdrawals. O valor é o líquido que cai na chave PIX (CPF). */
export async function criarSaqueKavropay(pedido: PedidoSaqueProvedor): Promise<SaqueAceito> {
  const chave = chaveKavropay();
  if (!chave) throw new ErroDominio('SAQUE_INDISPONIVEL');

  let resp: Response;
  try {
    resp = await fetch(`${urlKavropay()}/withdrawals`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': pedido.idempotencia,
      },
      body: JSON.stringify({
        amountCents: pedido.centavos,
        pix_key: pedido.cpf,
        pix_key_type: 'CPF',
        description: 'Saque do galinheiro',
        externalId: pedido.idempotencia,
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (erro) {
    console.error('[kavropay] saque sem resposta', erro instanceof Error ? erro.message : erro);
    throw new ErroDominio('SAQUE_INDISPONIVEL');
  }

  const corpo = (await resp.json().catch(() => null)) as { id?: string; status?: string; message?: string; error?: string } | null;
  const id = corpo?.id ? String(corpo.id) : '';
  if ((resp.status === 200 || resp.status === 201) && id) {
    const status = String(corpo?.status ?? '').toLowerCase();
    return { idExterno: id, status: status === 'paid_out' || status === 'paid' || status === 'completed' ? 'pago' : 'processando' };
  }
  console.error(`[kavropay] saque recusado status=${resp.status} msg=${corpo?.message || corpo?.error || corpo?.status || 'sem-corpo'}`);
  if (resp.status === 402) throw new ErroDominio('SAQUE_INDISPONIVEL', undefined, 'A conta de pagamentos não tem saldo para este saque.');
  if (resp.status === 409) throw new ErroDominio('SAQUE_EM_ANDAMENTO');
  if (resp.status === 429) throw new ErroDominio('RATE_LIMITED');
  throw new ErroDominio('SAQUE_INDISPONIVEL');
}

export const kavropaySaque: ProvedorSaque = { nome: 'kavropay', criarSaque: criarSaqueKavropay };

/**
 * HMAC do webhook: `t=<unix>,v1=<hex>` sobre `${t}.${corpoBruto}`, com o segredo de assinatura
 * (não é a chave kvk_). Janela de 5 minutos. Cabeçalhos X-Kavro-Signature ou x-kavropay-signature.
 */
export function verificarAssinaturaKavropay(corpoBruto: string, cabecalho: string | null, agoraMs = Date.now()): boolean {
  const segredo = process.env.KAVROPAY_WEBHOOK_SECRET?.trim();
  if (!segredo || !cabecalho) return false;
  const partes = Object.fromEntries(cabecalho.split(',').map((p) => {
    const i = p.indexOf('=');
    return i === -1 ? [p, ''] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
  }));
  const ts = Number(partes.t);
  const dado = partes.v1?.toLowerCase();
  if (!Number.isFinite(ts) || !dado || Math.abs(agoraMs / 1000 - ts) > 300) return false;
  const esperado = createHmac('sha256', segredo).update(`${ts}.${corpoBruto}`).digest('hex');
  if (esperado.length !== dado.length) return false;
  return timingSafeEqual(Buffer.from(esperado), Buffer.from(dado));
}

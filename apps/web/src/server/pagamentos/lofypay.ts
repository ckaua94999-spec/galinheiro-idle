// Cliente da LofyPay (https://app.lofypay.com/api/v1). A chave fica só no servidor.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ErroDominio } from '../erros';
import type { PedidoSaqueProvedor, ProvedorSaque, SaqueAceito } from './provedor';

const URL_PADRAO = 'https://app.lofypay.com/api/v1';

export function urlLofypay(): string {
  return (process.env.LOFYPAY_API_URL || URL_PADRAO).replace(/\/$/, '');
}

export function chaveLofypay(): string | null {
  const chave = process.env.LOFYPAY_SECRET_KEY?.trim();
  return chave ? chave : null;
}

interface RespostaCashout {
  success?: boolean;
  code?: string;
  message?: string;
  status?: string;
  withdrawalId?: number | string;
  id?: number | string;
  retryable?: boolean;
}

function reais(centavos: number): number {
  return Number((centavos / 100).toFixed(2));
}

function idExterno(corpo: RespostaCashout): string {
  const id = corpo.withdrawalId ?? corpo.id;
  return id === undefined || id === null ? '' : String(id);
}

/** POST /cashout. CPF é o documento e a chave PIX. */
export async function criarSaqueLofypay(pedido: PedidoSaqueProvedor): Promise<SaqueAceito> {
  const chave = chaveLofypay();
  if (!chave) throw new ErroDominio('SAQUE_INDISPONIVEL');

  let resp: Response;
  try {
    resp = await fetch(`${urlLofypay()}/cashout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': pedido.idempotencia,
      },
      body: JSON.stringify({
        amount: reais(pedido.centavos),
        name: pedido.nome,
        cpf: pedido.cpf,
        keypix: pedido.cpf,
        tipo_chave: 'CPF',
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (erro) {
    console.error('[lofypay] cashout sem resposta', erro instanceof Error ? erro.message : erro);
    throw new ErroDominio('SAQUE_INDISPONIVEL');
  }

  const corpo = (await resp.json().catch(() => null)) as RespostaCashout | null;
  const codigo = corpo?.code ?? '';
  if (resp.ok && corpo?.success !== false && idExterno(corpo ?? {})) {
    const status = String(corpo?.status ?? '').toUpperCase();
    return { idExterno: idExterno(corpo ?? {}), status: status === 'COMPLETED' ? 'pago' : 'processando' };
  }

  console.error(`[lofypay] cashout recusado status=${resp.status} code=${codigo || 'sem-codigo'}`);
  if (codigo === 'CASHOUT_IN_PROGRESS' || resp.status === 409) throw new ErroDominio('SAQUE_EM_ANDAMENTO');
  if (codigo === 'CASHOUT_COOLDOWN' || resp.status === 429) throw new ErroDominio('RATE_LIMITED');
  if (codigo === 'INVALID_AMOUNT') throw new ErroDominio('PAYLOAD_INVALIDO', undefined, 'Esse valor não pode ser sacado.');
  throw new ErroDominio('SAQUE_INDISPONIVEL');
}

export const lofypay: ProvedorSaque = { nome: 'lofypay', criarSaque: criarSaqueLofypay };

export interface CobrancaPixCriada {
  idTransacao: string;
  copiaCola: string;
  qrBase64: string | null;
}

interface RespostaGateway {
  status?: string;
  message?: string;
  paymentCode?: string;
  idTransaction?: string;
  paymentCodeBase64?: string;
}

/** POST /gateway. Cobrança PIX do giro. A mesma Idempotency-Key devolve a cobrança original. */
export async function criarCobrancaPix(pedido: {
  centavos: number;
  idempotencia: string;
  referencia: string;
  nome: string;
  email: string | null;
}): Promise<CobrancaPixCriada> {
  const chave = chaveLofypay();
  if (!chave) throw new ErroDominio('PIX_INDISPONIVEL');

  let resp: Response;
  try {
    resp = await fetch(`${urlLofypay()}/gateway`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': pedido.idempotencia,
      },
      body: JSON.stringify({
        amount: reais(pedido.centavos),
        method: 'pix',
        external_reference: pedido.referencia,
        expiration: 900,
        client: {
          name: pedido.nome,
          ...(pedido.email ? { email: pedido.email } : {}),
        },
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (erro) {
    console.error('[lofypay] pix sem resposta', erro instanceof Error ? erro.message : erro);
    throw new ErroDominio('PIX_INDISPONIVEL');
  }

  const corpo = (await resp.json().catch(() => null)) as RespostaGateway | null;
  const status = String(corpo?.status ?? '').toLowerCase();
  const ok = (status === 'success' || status === 'ok') && corpo?.idTransaction && corpo.paymentCode;
  if (resp.ok && ok && corpo) {
    return {
      idTransacao: corpo.idTransaction!,
      copiaCola: corpo.paymentCode!,
      qrBase64: corpo.paymentCodeBase64 ?? null,
    };
  }
  console.error(`[lofypay] pix recusado status=${resp.status} msg=${corpo?.message ?? (status || 'sem-corpo')}`);
  if (resp.status === 429) throw new ErroDominio('RATE_LIMITED');
  throw new ErroDominio('PIX_INDISPONIVEL');
}

export type StatusPixRemoto = 'pago' | 'aguardando' | 'expirado' | 'falhou' | 'desconhecido';

/** POST /status. Pagamento confirmado é PAID_OUT (o webhook às vezes manda PAID). */
export async function consultarStatusPix(idTransacao: string): Promise<StatusPixRemoto> {
  const chave = chaveLofypay();
  if (!chave) return 'desconhecido';
  let resp: Response;
  try {
    resp = await fetch(`${urlLofypay()}/status`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ idtransaction: idTransacao }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (erro) {
    console.error('[lofypay] status sem resposta', erro instanceof Error ? erro.message : erro);
    return 'desconhecido';
  }
  const corpo = (await resp.json().catch(() => null)) as { status?: string } | null;
  if (!resp.ok || !corpo?.status) return 'desconhecido';
  const s = corpo.status.toUpperCase();
  if (s === 'PAID_OUT' || s === 'PAID' || s === 'COMPLETED') return 'pago';
  if (s === 'WAITING_FOR_APPROVAL' || s === 'PENDING') return 'aguardando';
  if (s === 'EXPIRED') return 'expirado';
  if (s === 'FAILED' || s === 'REFUNDED') return 'falhou';
  return 'desconhecido';
}

/**
 * HMAC do webhook registrado (canal 2): `t=<unix>,v1=<hex>` sobre `${t}.${corpoBruto}`.
 * Janela de 5 minutos, como a documentação pede.
 */
export function verificarAssinaturaLofypay(corpoBruto: string, cabecalho: string | null, agoraMs = Date.now()): boolean {
  const segredo = process.env.LOFYPAY_WEBHOOK_SECRET?.trim();
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

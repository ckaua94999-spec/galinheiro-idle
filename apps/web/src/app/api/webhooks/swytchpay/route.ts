// Webhook da SwytchPay (deposit.* e payout.*). Sem sessão: a prova é o HMAC.
import { obterBanco } from '@/server/db/banco';
import { aplicarEventoPix } from '@/server/dominio/roleta-pix';
import { aplicarEventoSaque } from '@/server/dominio/saque';
import { agoraMs } from '@/server/relogio';
import { verificarAssinaturaSwytchpay } from '@/server/pagamentos/swytchpay';

export async function POST(req: Request): Promise<Response> {
  const bruto = await req.text();
  if (!verificarAssinaturaSwytchpay(bruto, req.headers.get('x-swytch-signature'), req.headers.get('x-swytch-timestamp'))) {
    return new Response(null, { status: 401 });
  }
  let corpo: Record<string, unknown>;
  try {
    const json = JSON.parse(bruto) as unknown;
    if (!json || typeof json !== 'object') return new Response(null, { status: 400 });
    corpo = json as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 400 });
  }
  const nome = typeof corpo.event === 'string' ? corpo.event.toLowerCase() : '';
  const data = corpo.data && typeof corpo.data === 'object' ? corpo.data as Record<string, unknown> : {};
  try {
    const banco = await obterBanco();
    if (nome.startsWith('payout.')) {
      const event = nome === 'payout.paid' ? 'saque.paid' : nome === 'payout.returned' ? 'saque.devolvido' : nome === 'payout.failed' || nome === 'payout.canceled' ? 'saque.failed' : '';
      if (!event) return new Response(null, { status: 200 });
      await aplicarEventoSaque(banco, {
        event,
        data: { id: data.id, external_id: data.external_id, reason: data.failure_reason ?? data.return_reason ?? data.reason },
      }, agoraMs(), 'swytchpay');
      return new Response(null, { status: 200 });
    }
    if (nome === 'deposit.paid' || nome === 'deposit.expired' || nome === 'deposit.canceled') {
      await aplicarEventoPix(banco, {
        event: nome === 'deposit.paid' ? 'payment.paid' : nome === 'deposit.expired' ? 'payment.expired' : 'payment.failed',
        data: { id: data.id, external_id: data.external_id },
      }, agoraMs());
    }
  } catch (erro) {
    console.error('[swytchpay] webhook falhou', erro instanceof Error ? erro.message : erro);
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 200 });
}

// Webhook da KavroPay (payment.paid, payment.confirmed, payment.expired, payment.refunded). Sem sessão: a prova é o HMAC.
import { obterBanco } from '@/server/db/banco';
import { aplicarEventoPix } from '@/server/dominio/roleta-pix';
import { aplicarEventoSaque } from '@/server/dominio/saque';
import { agoraMs } from '@/server/relogio';
import { verificarAssinaturaKavropay } from '@/server/pagamentos/kavropay';

export async function POST(req: Request): Promise<Response> {
  const bruto = await req.text();
  const assinatura = req.headers.get('x-kavro-signature') ?? req.headers.get('x-kavropay-signature');
  if (!verificarAssinaturaKavropay(bruto, assinatura)) {
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
  const nome = typeof corpo.event === 'string' ? corpo.event : '';
  const aninhado = corpo.data && typeof corpo.data === 'object' ? corpo.data as Record<string, unknown> : corpo;
  try {
    const banco = await obterBanco();
    if (nome === 'withdrawal.completed' || nome === 'withdrawal.failed') {
      await aplicarEventoSaque(banco, {
        event: nome === 'withdrawal.completed' ? 'saque.paid' : 'saque.failed',
        data: {
          id: aninhado.id,
          externalId: aninhado.externalId ?? aninhado.external_reference ?? aninhado.externalReference,
          reason: aninhado.reason ?? aninhado.message ?? aninhado.failure_reason,
        },
      }, agoraMs(), 'kavropay');
      return new Response(null, { status: 200 });
    }
    await aplicarEventoPix(banco, {
      event: nome,
      data: {
        id: aninhado.id,
        external_reference: aninhado.external_reference ?? aninhado.externalId ?? aninhado.externalReference,
      },
    }, agoraMs());
  } catch (erro) {
    console.error('[kavropay] webhook falhou', erro instanceof Error ? erro.message : erro);
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 200 });
}

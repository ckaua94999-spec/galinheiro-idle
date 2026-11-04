// Webhook assinado da LofyPay (saque.paid / saque.failed e pix.paid / payment.approved). Sem sessão: a prova é o HMAC.
import { obterBanco } from '@/server/db/banco';
import { aplicarEventoPix } from '@/server/dominio/roleta-pix';
import { aplicarEventoSaque, type EventoSaqueLofypay } from '@/server/dominio/saque';
import { agoraMs } from '@/server/relogio';
import { verificarAssinaturaLofypay } from '@/server/pagamentos/lofypay';

export async function POST(req: Request): Promise<Response> {
  const bruto = await req.text();
  if (!verificarAssinaturaLofypay(bruto, req.headers.get('x-lofypay-signature'))) {
    return new Response(null, { status: 401 });
  }
  let evento: EventoSaqueLofypay;
  try {
    evento = JSON.parse(bruto) as EventoSaqueLofypay;
  } catch {
    return new Response(null, { status: 400 });
  }
  try {
    const banco = await obterBanco();
    const nome = evento.event ?? '';
    if (nome === 'saque.paid' || nome === 'saque.failed') await aplicarEventoSaque(banco, evento, agoraMs());
    else await aplicarEventoPix(banco, evento, agoraMs());
  } catch (erro) {
    console.error('[lofypay] webhook falhou', erro instanceof Error ? erro.message : erro);
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 200 });
}

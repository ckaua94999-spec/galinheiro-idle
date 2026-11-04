// Link curto de convite: /c/CODIGO → tela de cadastro com o convite preenchido (código inválido vai sem ele).
import { CODIGO_CONVITE, normalizarConvite } from '@galinheiro/api-contract';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const codigo = normalizarConvite(decodeURIComponent((await params).codigo ?? ''));
  const destino = CODIGO_CONVITE.test(codigo) ? `/entrar?convite=${codigo}` : '/entrar';
  return new Response(null, { status: 307, headers: { Location: destino, 'Cache-Control': 'no-store' } });
}

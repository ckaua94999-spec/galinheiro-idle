import type { NextRequest } from 'next/server';
import { respostaErro } from '@/server/http/rota';
import { executarTick } from '@/server/jobs/tick';

/** Tarefas periódicas para hospedagem serverless (ex.: Vercel Cron a cada 15 min). */
async function handler(req: NextRequest): Promise<Response> {
  const segredo = process.env.CRON_SECRET;
  const autorizado = segredo
    ? req.headers.get('authorization') === `Bearer ${segredo}`
    : process.env.NODE_ENV !== 'production';
  if (!autorizado) return respostaErro('NAO_AUTENTICADO');
  const resultado = await executarTick();
  return Response.json({ ok: true, data: resultado, serverTime: new Date().toISOString() });
}

export const GET = handler;
export const POST = handler;

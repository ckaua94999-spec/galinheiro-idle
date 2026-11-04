import { DevRelogioBody } from '@galinheiro/api-contract';
import { ErroDominio } from '@/server/erros';
import { rota } from '@/server/http/rota';
import { ajustarRelogio, offsetRelogioMs, relogioAjustavel } from '@/server/relogio';

/** Ferramenta de desenvolvimento: adianta o relógio do servidor (nunca disponível em produção). */
export const GET = rota({ nome: 'dev.relogio', limite: 60, transacao: false }, async () => {
  if (!relogioAjustavel()) throw new ErroDominio('NAO_ENCONTRADO');
  return { data: { offsetMs: offsetRelogioMs() } };
});

export const POST = rota({ nome: 'dev.relogio', limite: 60, transacao: false, corpo: DevRelogioBody }, async ({ corpo }) => {
  if (!relogioAjustavel()) throw new ErroDominio('NAO_ENCONTRADO');
  return { data: { offsetMs: ajustarRelogio(corpo.horas) } };
});

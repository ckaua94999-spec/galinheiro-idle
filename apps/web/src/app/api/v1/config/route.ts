import { configPublica } from '@/server/dominio/colecao';
import { rota } from '@/server/http/rota';
import { configurarVapid } from '@/server/push/push';
import { relogioAjustavel } from '@/server/relogio';

export const GET = rota({ nome: 'config', autenticado: false, limite: 120, transacao: false }, async () => ({
  data: configPublica(configurarVapid()?.publica ?? null, relogioAjustavel()),
}));

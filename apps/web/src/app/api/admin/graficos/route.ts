import { AdminGraficosQuery } from '@galinheiro/api-contract';
import { graficos } from '@/server/admin/painel';
import { rota } from '@/server/http/rota';

/** Séries diárias (pessoas, ovos, moedas) + projeções. */
export const GET = rota({ nome: 'admin.graficos', admin: true, limite: 60, consulta: AdminGraficosQuery }, async ({ c, agoraMs, consulta }) => ({
  data: await graficos(c, agoraMs, consulta.dias, consulta.projecao),
}));

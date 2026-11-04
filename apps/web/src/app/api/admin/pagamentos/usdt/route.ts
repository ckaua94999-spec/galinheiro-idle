import { AdminUsdtConfigBody } from '@galinheiro/api-contract';
import { salvarConfigUsdt } from '@/server/pagamentos/usdt';
import { rota } from '@/server/http/rota';

/** Carteira, rede e cotação usadas por quem está marcado para pagar em USDT. */
export const POST = rota({ nome: 'admin.pagamentos.usdt', admin: true, corpo: AdminUsdtConfigBody }, async ({ c, corpo }) => ({
  data: await salvarConfigUsdt(c, { rede: corpo.rede, endereco: corpo.endereco, cotacaoCentavos: corpo.cotacaoCentavos }),
}));

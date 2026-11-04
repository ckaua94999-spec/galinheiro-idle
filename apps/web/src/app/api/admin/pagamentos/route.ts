import { z } from 'zod';
import { rota } from '@/server/http/rota';
import { chaveKavropay } from '@/server/pagamentos/kavropay';
import { chaveLofypay } from '@/server/pagamentos/lofypay';
import { chaveSwytchpay } from '@/server/pagamentos/swytchpay';
import {
  definirGateway, definirSaqueGateway, gatewayAtiva, saqueGatewayAtiva,
} from '@/server/pagamentos/gateway';
import { lerConfigUsdt } from '@/server/pagamentos/usdt';

const Corpo = z.object({
  uso: z.enum(['pix', 'saque']),
  gateway: z.enum(['lofypay', 'kavropay', 'swytchpay']),
});

function chaves() {
  return {
    lofypayConfigurada: !!chaveLofypay(),
    kavropayConfigurada: !!chaveKavropay(),
    swytchpayConfigurada: chaveSwytchpay(),
  };
}

async function estado(c: Parameters<typeof gatewayAtiva>[0]) {
  const usdt = await lerConfigUsdt(c);
  return { pix: await gatewayAtiva(c), saque: await saqueGatewayAtiva(c), usdt, ...chaves() };
}

export const GET = rota({ nome: 'admin.pagamentos', admin: true, limite: 60 }, async ({ c }) => ({
  data: await estado(c),
}));

/** Um clique troca quem cria o próximo PIX ou quem paga o próximo saque. */
export const PUT = rota(
  { nome: 'admin.pagamentos.salvar', admin: true, limite: 30, corpo: Corpo },
  async ({ c, corpo }) => {
    if (corpo.uso === 'saque') await definirSaqueGateway(c, corpo.gateway);
    else await definirGateway(c, corpo.gateway);
    return { data: await estado(c) };
  },
);

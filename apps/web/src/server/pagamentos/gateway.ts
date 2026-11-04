// Qual provedor gera o próximo PIX da roleta. A escolha fica no banco e vale no próximo clique, sem reiniciar.
import type { Consulta } from '../db/banco';
import { ErroDominio } from '../erros';
import { chaveKavropay, consultarStatusKavropay, criarCobrancaKavropay, kavropaySaque } from './kavropay';
import {
  chaveLofypay, consultarStatusPix, criarCobrancaPix, lofypay, type CobrancaPixCriada, type StatusPixRemoto,
} from './lofypay';
import { chaveSwytchpay, consultarStatusSwytchpay, criarCobrancaSwytchpay, swytchpaySaque } from './swytchpay';
import type { ProvedorSaque } from './provedor';

export type GatewayPix = 'lofypay' | 'kavropay' | 'swytchpay';

const NOMES: Record<GatewayPix, string> = { lofypay: 'LofyPay', kavropay: 'KavroPay', swytchpay: 'SwytchPay' };

export function chaveConfigurada(gateway: GatewayPix): boolean {
  if (gateway === 'kavropay') return !!chaveKavropay();
  if (gateway === 'swytchpay') return chaveSwytchpay();
  return !!chaveLofypay();
}

export async function gatewayAtiva(c: Consulta): Promise<GatewayPix> {
  const linha = await c.um<{ gateway: string }>('select gateway from pagamentos_config where id = 1');
  if (linha?.gateway === 'lofypay' || linha?.gateway === 'swytchpay' || linha?.gateway === 'kavropay') return linha.gateway;
  return 'swytchpay';
}

export async function definirGateway(c: Consulta, gateway: GatewayPix): Promise<void> {
  if (!chaveConfigurada(gateway)) {
    throw new ErroDominio('PAYLOAD_INVALIDO', undefined, `A ${NOMES[gateway]} não tem chave no servidor.`);
  }
  await c.q(
    `insert into pagamentos_config (id, gateway, atualizado_em) values (1, $1, now())
     on conflict (id) do update set gateway = excluded.gateway, atualizado_em = now()`,
    [gateway],
  );
}

const PROVEDORES_SAQUE: Record<GatewayPix, ProvedorSaque> = {
  lofypay,
  kavropay: kavropaySaque,
  swytchpay: swytchpaySaque,
};

export async function saqueGatewayAtiva(c: Consulta): Promise<GatewayPix> {
  const linha = await c.um<{ saque_gateway: string }>('select saque_gateway from pagamentos_config where id = 1');
  if (linha?.saque_gateway === 'lofypay' || linha?.saque_gateway === 'kavropay' || linha?.saque_gateway === 'swytchpay') {
    return linha.saque_gateway;
  }
  return 'swytchpay';
}

/** Próximo saque sai pela gateway escolhida no painel. */
export async function provedorSaqueAtivo(c: Consulta): Promise<ProvedorSaque> {
  return PROVEDORES_SAQUE[await saqueGatewayAtiva(c)];
}

export async function definirSaqueGateway(c: Consulta, gateway: GatewayPix): Promise<void> {
  if (!chaveConfigurada(gateway)) {
    throw new ErroDominio('PAYLOAD_INVALIDO', undefined, `A ${NOMES[gateway]} não tem chave no servidor.`);
  }
  await c.q(
    `insert into pagamentos_config (id, gateway, saque_gateway, atualizado_em) values (1, 'swytchpay', $1, now())
     on conflict (id) do update set saque_gateway = excluded.saque_gateway, atualizado_em = now()`,
    [gateway],
  );
}

export async function criarCobrancaDaGateway(
  c: Consulta,
  pedido: { centavos: number; idempotencia: string; referencia: string; nome: string; email: string | null; descricao: string },
): Promise<CobrancaPixCriada & { provedor: GatewayPix }> {
  const provedor = await gatewayAtiva(c);
  const criada = provedor === 'swytchpay'
    ? await criarCobrancaSwytchpay(pedido)
    : provedor === 'kavropay'
      ? await criarCobrancaKavropay(pedido)
      : await criarCobrancaPix(pedido);
  return { ...criada, provedor };
}

/** Cobrança aberta continua na gateway que a criou, mesmo depois de uma troca. */
export async function consultarStatusDaGateway(provedor: string, idTransacao: string): Promise<StatusPixRemoto> {
  if (provedor === 'swytchpay') return consultarStatusSwytchpay(idTransacao);
  if (provedor === 'kavropay') return consultarStatusKavropay(idTransacao);
  return consultarStatusPix(idTransacao);
}

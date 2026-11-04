// Cobrança em USDT: a carteira é uma só (Painel → Pagamentos). O membro marcado na ficha deixa de ver PIX
// na roleta e na ampliação e passa a ver rede, valor, endereço e QR. A equipe confirma quando o valor chega.
import { toDataURL } from 'qrcode';
import { valorUsdtX100, type AdminCobrancaUsdtDTO } from '@galinheiro/api-contract';
import type { Consulta } from '../db/banco';
import { ErroDominio } from '../erros';
import { iso } from '../dominio/linhas';

export const VALIDADE_USDT_MS = 24 * 60 * 60 * 1000;
export type RedeUsdt = 'TRC20' | 'ERC20' | 'BEP20';

export interface ConfigUsdt {
  rede: RedeUsdt;
  endereco: string;
  cotacaoCentavos: number;
}

const REDES = new Set<string>(['TRC20', 'ERC20', 'BEP20']);

export async function lerConfigUsdt(c: Consulta): Promise<ConfigUsdt> {
  const l = await c.um<{ rede: string; endereco: string; cotacao: unknown }>(
    'select usdt_rede as rede, usdt_endereco as endereco, usdt_cotacao_centavos as cotacao from pagamentos_config where id = 1',
  );
  const rede = REDES.has(l?.rede ?? '') ? (l!.rede as RedeUsdt) : 'TRC20';
  return { rede, endereco: (l?.endereco ?? '').trim(), cotacaoCentavos: Number(l?.cotacao ?? 550) };
}

export async function salvarConfigUsdt(c: Consulta, config: ConfigUsdt): Promise<ConfigUsdt> {
  await c.q(
    `update pagamentos_config
        set usdt_rede = $1, usdt_endereco = $2, usdt_cotacao_centavos = $3, atualizado_em = now()
      where id = 1`,
    [config.rede, config.endereco, config.cotacaoCentavos],
  );
  return lerConfigUsdt(c);
}

export async function meioDoJogador(c: Consulta, contaId: string): Promise<'pix' | 'usdt'> {
  const l = await c.um<{ cobranca: string }>('select cobranca from contas where id = $1', [contaId]);
  return l?.cobranca === 'usdt' ? 'usdt' : 'pix';
}

/** Endereço, rede, valor e QR. Falha se a carteira ainda não foi configurada. */
export async function dadosCobrancaUsdt(c: Consulta, centavos: number): Promise<{ endereco: string; rede: string; usdtX100: number; qr: string }> {
  const cfg = await lerConfigUsdt(c);
  if (!cfg.endereco) throw new ErroDominio('USDT_INDISPONIVEL');
  const usdtX100 = valorUsdtX100(centavos, cfg.cotacaoCentavos);
  const qr = await toDataURL(cfg.endereco, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
  return { endereco: cfg.endereco, rede: cfg.rede, usdtX100, qr };
}

export async function cobrancasUsdtAbertas(c: Consulta, contaId: string): Promise<AdminCobrancaUsdtDTO[]> {
  const linhas = await c.q<{ id: string; tipo: 'roleta' | 'ampliacao'; centavos: number; usdt_x100: unknown; usdt_rede: string | null; criado_em: Date }>(
    `select id, 'roleta' as tipo, centavos, usdt_x100, usdt_rede, criado_em
       from roleta_pix
      where player_id = $1 and status = 'aguardando' and meio = 'usdt'
      union all
     select id, 'ampliacao' as tipo, centavos, usdt_x100, usdt_rede, criado_em
       from ampliacao_pix
      where player_id = $1 and status = 'aguardando' and meio = 'usdt'
      order by criado_em desc`,
    [contaId],
  );
  return linhas.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    centavos: Number(l.centavos),
    valorUsdtX100: Number(l.usdt_x100 ?? 0),
    rede: l.usdt_rede ?? 'TRC20',
    criadoEm: iso(l.criado_em),
  }));
}

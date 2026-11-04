import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Rng } from '@galinheiro/game-core';
import { criarBancoEmMemoria, type Banco } from '@/server/db/banco';
import { cadastrarMembro } from '@/server/auth/contas';
import { abrirCobrancaRoleta, aplicarEventoPix, atualizarCobrancaRoleta } from '@/server/dominio/roleta-pix';
import { confirmarCobrancaUsdt } from '@/server/admin/usuarios';
import { estado, girar } from '@/server/dominio/jogo';
import { ErroDominio } from '@/server/erros';

let banco: Banco;
let contaId = '';
const rng: Rng = { int: (n) => Math.floor(n / 2) };
const T0 = Date.parse('2026-10-04T12:00:00.000Z');
let chamadas = 0;

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
}

beforeAll(async () => {
  process.env.LOFYPAY_SECRET_KEY = 'sk_test_roleta';
  banco = await criarBancoEmMemoria();
  const m = await cadastrarMembro(
    banco,
    { nome: 'Lia PIX', telefone: '+5511988887777', email: 'lia-pix@exemplo.com', senha: 'senha-forte-123' },
    T0,
    rng,
  );
  contaId = m.contaId;
  await banco.q(`update pagamentos_config set gateway = 'lofypay' where id = 1`);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url);
    if (u.endsWith('/charges')) {
      chamadas++;
      return resposta(201, { id: `PAY${chamadas}`, status: 'waiting_payment', pix_copy_paste: `00020126580014br.gov.bcb.pix${chamadas}` });
    }
    if (u.endsWith('/gateway')) {
      chamadas++;
      return resposta(200, { status: 'OK', paymentCode: `00020126580014br.gov.bcb.pix${chamadas}`, idTransaction: `tx-pix-${chamadas}` });
    }
    if (u.endsWith('/status')) {
      if (u.includes('/charges/')) return resposta(200, { status: 'paid', paid: true });
      return resposta(200, { status: 'PAID_OUT' });
    }
    return resposta(404, {});
  }));
});

afterAll(async () => {
  vi.unstubAllGlobals();
  delete process.env.LOFYPAY_SECRET_KEY;
  delete process.env.KAVROPAY_SECRET_KEY;
  await banco.fechar();
});

describe('roleta paga com PIX', () => {
  it('sem chave da LofyPay não gera cobrança', async () => {
    delete process.env.LOFYPAY_SECRET_KEY;
    const codigo = await banco.tx((c) => abrirCobrancaRoleta(c, contaId, T0, 'idem-sem-chave')).then(
      () => 'SEM_ERRO',
      (e) => (e instanceof ErroDominio ? e.codigo : 'OUTRO'),
    );
    expect(codigo).toBe('PIX_INDISPONIVEL');
    process.env.LOFYPAY_SECRET_KEY = 'sk_test_roleta';
  });

  it('gera o QR, reaproveita a cobrança aberta e só gira depois do pagamento', async () => {
    const antes = (await banco.tx((c) => estado(c, contaId, T0, rng))).data.player.moedasX100;
    const a = await banco.tx((c) => abrirCobrancaRoleta(c, contaId, T0, 'idem-giro-1'));
    const b = await banco.tx((c) => abrirCobrancaRoleta(c, contaId, T0 + 1000, 'idem-giro-2'));
    expect(b.id).toBe(a.id);
    expect(a.status).toBe('aguardando');
    expect(a.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(a.copiaCola.startsWith('000201')).toBe(true);
    expect(chamadas).toBe(1);

    const pago = await banco.tx((c) => atualizarCobrancaRoleta(c, contaId, a.id, T0 + 2000));
    expect(pago.status).toBe('pago');
    const giro = await banco.tx((c) => girar(c, contaId, T0 + 3000, rng, a.id));
    expect(giro.data.saldoX100).toBe(antes);
    expect(giro.data.entity.origem).toBe('ROLETA');

    const outro = await banco.tx((c) => abrirCobrancaRoleta(c, contaId, T0 + 4000, 'idem-giro-3'));
    expect(outro.id).not.toBe(a.id);
    await aplicarEventoPix(banco, { event: 'pix.paid', data: { idTransaction: `tx-pix-${chamadas}` } }, T0 + 5000);
    const segundo = await banco.tx((c) => girar(c, contaId, T0 + 6000, rng, outro.id));
    expect(segundo.data.giro.id).not.toBe(giro.data.giro.id);
    const semPagamento = await banco.tx((c) => girar(c, contaId, T0 + 7000, rng)).then(
      () => 'SEM_ERRO',
      (e) => (e instanceof ErroDominio ? e.codigo : 'OUTRO'),
    );
    expect(semPagamento).toBe('PAGAMENTO_PENDENTE');
  });

  it('com a KavroPay ativa, a cobrança sai em /v1/charges', async () => {
    process.env.KAVROPAY_SECRET_KEY = 'kvk_test_roleta';
    await banco.q(`update pagamentos_config set gateway = 'kavropay' where id = 1`);
    const antes = chamadas;
    const cobranca = await banco.tx((c) => abrirCobrancaRoleta(c, contaId, T0 + 9000, 'idem-kavro'));
    expect(chamadas).toBe(antes + 1);
    expect(cobranca.status).toBe('aguardando');
    expect(cobranca.copiaCola.startsWith('000201')).toBe(true);
    const pago = await banco.tx((c) => atualizarCobrancaRoleta(c, contaId, cobranca.id, T0 + 9500));
    expect(pago.status).toBe('pago');
    await banco.q(`update pagamentos_config set gateway = 'lofypay' where id = 1`);
    delete process.env.KAVROPAY_SECRET_KEY;
  });

  it('membro em USDT recebe endereço e QR, e só gira depois que a equipe confirma', async () => {
    const endereco = 'TXYZabcdefghijklmnopqrstuvwxyz123456';
    const m = await cadastrarMembro(
      banco,
      { nome: 'Otto USDT', telefone: '+5511977776666', email: 'otto-usdt@exemplo.com', senha: 'senha-forte-123' },
      T0,
      rng,
    );
    await banco.q(`update contas set cobranca = 'usdt' where id = $1`, [m.contaId]);
    const semCarteira = await banco.tx((c) => abrirCobrancaRoleta(c, m.contaId, T0, 'idem-usdt-sem')).then(
      () => 'SEM_ERRO',
      (e) => (e instanceof ErroDominio ? e.codigo : 'OUTRO'),
    );
    expect(semCarteira).toBe('USDT_INDISPONIVEL');

    await banco.q(
      `update pagamentos_config set usdt_endereco = $1, usdt_rede = 'TRC20', usdt_cotacao_centavos = 550 where id = 1`,
      [endereco],
    );
    const antes = chamadas;
    const a = await banco.tx((c) => abrirCobrancaRoleta(c, m.contaId, T0 + 1000, 'idem-usdt-1'));
    expect(chamadas).toBe(antes);
    expect(a).toMatchObject({ meio: 'usdt', status: 'aguardando', copiaCola: endereco, rede: 'TRC20', valorUsdtX100: 1000, centavos: 5500 });
    expect(a.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    const ainda = await banco.tx((c) => atualizarCobrancaRoleta(c, m.contaId, a.id, T0 + 2000));
    expect(ainda.status).toBe('aguardando');
    expect(chamadas).toBe(antes);

    await banco.tx((c) => confirmarCobrancaUsdt(c, m.contaId, m.contaId, a.id, 'roleta', T0 + 3000));
    const giro = await banco.tx((c) => girar(c, m.contaId, T0 + 4000, rng, a.id));
    expect(giro.data.entity.origem).toBe('ROLETA');
    await banco.q(`update pagamentos_config set usdt_endereco = '' where id = 1`);
  });
});

import { createHmac } from 'node:crypto';
import { cpfValido, formatarCpf } from '@galinheiro/api-contract';
import type { Rng } from '@galinheiro/game-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarJogador } from '@/server/dominio/jogo';
import { aplicarEventoSaque, solicitarSaque } from '@/server/dominio/saque';
import { ErroDominio } from '@/server/erros';
import { verificarAssinaturaLofypay } from '@/server/pagamentos/lofypay';
import type { ProvedorSaque } from '@/server/pagamentos/provedor';
import { criarBancoEmMemoria, type Banco } from '@/server/db/banco';

const rng: Rng = { int: (n) => Math.floor(Math.random() * n) };
const CPF = '52998224725';

const enviados: number[] = [];

function provedorOk(): ProvedorSaque {
  return {
    nome: 'lofypay',
    criarSaque: async (pedido) => {
      enviados.push(pedido.centavos);
      return { idExterno: '4321', status: 'processando' };
    },
  };
}

describe('saque PIX', () => {
  let banco: Banco;
  let contaId = '';

  beforeAll(async () => {
    banco = await criarBancoEmMemoria();
    const agora = new Date();
    contaId = await banco.tx(async (c) => {
      const conta = await c.um<{ id: string }>(
        `insert into contas (tipo, email, senha_hash, nome, telefone, criado_em, atualizado_em)
         values ('email', 'saque@exemplo.com', 'x', 'Maria da Silva', '+5531999887766', $1, $1) returning id`,
        [agora],
      );
      await criarJogador(c, conta!.id, agora.getTime(), rng);
      return conta!.id;
    });
  });

  afterAll(() => banco.fechar());

  it('aceita CPF válido e mascara na digitação', () => {
    expect(cpfValido(CPF)).toBe(true);
    expect(cpfValido('11111111111')).toBe(false);
    expect(formatarCpf(CPF)).toBe('529.982.247-25');
  });

  it('segura o bônus inicial até existir um plano e cobra R$ 5 + 4% no PIX', async () => {
    await expect(
      banco.tx((c) => solicitarSaque(c, contaId, { centavos: 1000, cpf: CPF, nome: 'Maria da Silva' }, Date.now(), 'chave-bloqueado', provedorOk())),
    ).rejects.toMatchObject({ codigo: 'SALDO_INSUFICIENTE' });

    const quando = new Date();
    await banco.q(
      `insert into roleta_pix (player_id, centavos, status, id_transacao, copia_cola, qr_data_url, idempotencia, criado_em, atualizado_em, expira_em)
       values ($1, 5500, 'pago', 'tx-plano', '000201', '', 'idem-plano', $2, $2, $3)`,
      [contaId, quando, new Date(quando.getTime() + 3_600_000)],
    );
    enviados.length = 0;
    const r = await banco.tx((c) => solicitarSaque(c, contaId, { centavos: 1000, cpf: CPF, nome: 'Maria da Silva' }, Date.now(), 'chave-1', provedorOk()));
    expect(r.data.saldoX100).toBe(4000);
    expect(r.data.saque).toMatchObject({ status: 'processando', centavos: 1000, taxaCentavos: 540, liquidoCentavos: 460, cpfMascarado: '***.982.247-**' });
    expect(enviados).toEqual([460]);
    const saldo = await banco.um<{ moedas_x100: number }>('select moedas_x100 from players where id = $1', [contaId]);
    expect(Number(saldo?.moedas_x100)).toBe(4000);
  });

  it('libera o bônus inicial para saque quando a equipe marca na ficha, sem PIX e sem giro', async () => {
    const agora = new Date();
    const id = await banco.tx(async (c) => {
      const conta = await c.um<{ id: string }>(
        `insert into contas (tipo, email, senha_hash, nome, telefone, criado_em, atualizado_em)
         values ('email', 'bonus-equipe@exemplo.com', 'x', 'João Bônus', '+5531988776655', $1, $1) returning id`,
        [agora],
      );
      await criarJogador(c, conta!.id, agora.getTime(), rng);
      await c.q('update players set bonus_saque_liberado = true where id = $1', [conta!.id]);
      return conta!.id;
    });
    enviados.length = 0;
    const r = await banco.tx((c) => solicitarSaque(c, id, { centavos: 1000, cpf: CPF, nome: 'João Bônus' }, Date.now(), 'chave-bonus-equipe', provedorOk()));
    expect(r.data.saldoX100).toBe(4000);
    expect(r.data.saque).toMatchObject({ status: 'processando', centavos: 1000, taxaCentavos: 540, liquidoCentavos: 460 });
    expect(enviados).toEqual([460]);
  });

  it('só libera o bônus enquanto o rendimento das galinhas não completa 24 h', async () => {
    const agora = new Date();
    const id = await banco.tx(async (c) => {
      const conta = await c.um<{ id: string }>(
        `insert into contas (tipo, email, senha_hash, nome, telefone, criado_em, atualizado_em)
         values ('email', 'rendimento-24h@exemplo.com', 'x', 'Ana Rendimento', '+5531977665544', $1, $1) returning id`,
        [agora],
      );
      await criarJogador(c, conta!.id, agora.getTime(), rng);
      await c.q('update players set moedas_x100 = 7000, bonus_saque_liberado = true where id = $1', [conta!.id]);
      await c.q(
        `insert into transactions (player_id, tipo, valor_x100, saldo_apos_x100, config_versao, criado_em)
         values ($1, 'VENDA_OVOS', 2000, 7000, 'teste', $2)`,
        [conta!.id, agora],
      );
      return conta!.id;
    });
    await expect(
      banco.tx((c) => solicitarSaque(c, id, { centavos: 6000, cpf: CPF, nome: 'Ana Rendimento' }, Date.now(), 'chave-rendimento-cedo', provedorOk())),
    ).rejects.toMatchObject({ codigo: 'SALDO_INSUFICIENTE' });
    enviados.length = 0;
    const r = await banco.tx((c) => solicitarSaque(c, id, { centavos: 5000, cpf: CPF, nome: 'Ana Rendimento' }, Date.now(), 'chave-rendimento-bonus', provedorOk()));
    expect(r.data.saldoX100).toBe(2000);
    expect(r.data.saque).toMatchObject({ centavos: 5000, taxaCentavos: 700, liquidoCentavos: 4300 });
    expect(enviados).toEqual([4300]);
    await banco.q(`update saques set status = 'pago' where player_id = $1`, [id]);
    await banco.q(
      `update transactions set criado_em = $2 where player_id = $1 and tipo = 'VENDA_OVOS'`,
      [id, new Date(Date.now() - 25 * 60 * 60 * 1000)],
    );
    const depois = await banco.tx((c) => solicitarSaque(c, id, { centavos: 2000, cpf: CPF, nome: 'Ana Rendimento' }, Date.now(), 'chave-rendimento-24h', provedorOk()));
    expect(depois.data.saldoX100).toBe(0);
    expect(depois.data.saque.liquidoCentavos).toBe(1420);
  });

  it('depois de 3 dias o rendimento das galinhas entra no saque na hora', async () => {
    const agora = new Date();
    const id = await banco.tx(async (c) => {
      const conta = await c.um<{ id: string }>(
        `insert into contas (tipo, email, senha_hash, nome, telefone, criado_em, atualizado_em)
         values ('email', 'conta-antiga@exemplo.com', 'x', 'Carlos Antigo', '+5531966554433', $1, $1) returning id`,
        [new Date(agora.getTime() - 4 * 24 * 60 * 60 * 1000)],
      );
      await criarJogador(c, conta!.id, agora.getTime(), rng);
      await c.q('update players set moedas_x100 = 7000, bonus_saque_liberado = true where id = $1', [conta!.id]);
      await c.q(
        `insert into transactions (player_id, tipo, valor_x100, saldo_apos_x100, config_versao, criado_em)
         values ($1, 'VENDA_OVOS', 2000, 7000, 'teste', $2)`,
        [conta!.id, agora],
      );
      return conta!.id;
    });
    enviados.length = 0;
    const r = await banco.tx((c) => solicitarSaque(c, id, { centavos: 6000, cpf: CPF, nome: 'Carlos Antigo' }, Date.now(), 'chave-conta-antiga', provedorOk()));
    expect(r.data.saldoX100).toBe(1000);
    expect(r.data.saque).toMatchObject({ centavos: 6000, taxaCentavos: 740, liquidoCentavos: 5260 });
    expect(enviados).toEqual([5260]);
  });

  it('não deixa um segundo saque enquanto o primeiro processa', async () => {
    await expect(
      banco.tx((c) => solicitarSaque(c, contaId, { centavos: 1000, cpf: CPF, nome: 'Maria da Silva' }, Date.now(), 'chave-2', provedorOk())),
    ).rejects.toMatchObject({ codigo: 'SAQUE_EM_ANDAMENTO' });
  });

  it('desfaz o débito se a LofyPay recusa', async () => {
    const antes = await banco.um<{ moedas_x100: number }>('select moedas_x100 from players where id = $1', [contaId]);
    const recusa: ProvedorSaque = {
      nome: 'lofypay',
      criarSaque: async () => {
        throw new ErroDominio('SAQUE_INDISPONIVEL');
      },
    };
    await banco.tx(async (c) => {
      await c.q(`update saques set status = 'pago' where player_id = $1`, [contaId]);
    });
    await expect(
      banco.tx((c) => solicitarSaque(c, contaId, { centavos: 2000, cpf: '529.982.247-25', nome: 'Maria da Silva' }, Date.now(), 'chave-3', recusa)),
    ).rejects.toMatchObject({ codigo: 'SAQUE_INDISPONIVEL' });
    const saldo = await banco.um<{ moedas_x100: number }>('select moedas_x100 from players where id = $1', [contaId]);
    expect(saldo?.moedas_x100).toBe(antes?.moedas_x100);
  });

  it('devolve as moedas quando o webhook diz que o saque falhou', async () => {
    await banco.tx(async (c) => {
      await c.q(`update saques set status = 'processando', id_externo = '4321' where idempotencia = 'chave-1'`);
    });
    const antes = await banco.um<{ moedas_x100: number }>('select moedas_x100 from players where id = $1', [contaId]);
    await aplicarEventoSaque(banco, { event: 'saque.failed', data: { withdrawalId: 4321, reason: 'recusado' } }, Date.now());
    await aplicarEventoSaque(banco, { event: 'saque.failed', data: { withdrawalId: '4321' } }, Date.now());
    const saldo = await banco.um<{ moedas_x100: number }>('select moedas_x100 from players where id = $1', [contaId]);
    expect(saldo?.moedas_x100).toBe((antes?.moedas_x100 ?? 0) + 1000);
    const status = await banco.um<{ status: string }>(`select status from saques where idempotencia = 'chave-1'`);
    expect(status?.status).toBe('falhou');
  });

  it('envia o saque pela KavroPay e devolve as moedas se o webhook falhar', async () => {
    const kavro: ProvedorSaque = {
      nome: 'kavropay',
      criarSaque: async (pedido) => {
        expect(pedido.centavos).toBe(460);
        return { idExterno: 'WTH1', status: 'processando' };
      },
    };
    const antes = Number((await banco.um<{ moedas_x100: number }>('select moedas_x100 from players where id = $1', [contaId]))?.moedas_x100);
    const r = await banco.tx((c) => solicitarSaque(c, contaId, { centavos: 1000, cpf: CPF, nome: 'Maria da Silva' }, Date.now(), 'chave-kavro', kavro));
    expect(r.data.saque.liquidoCentavos).toBe(460);
    const gravado = await banco.um<{ provedor: string }>('select provedor from saques where idempotencia = $1', ['chave-kavro']);
    expect(gravado?.provedor).toBe('kavropay');
    await aplicarEventoSaque(banco, { event: 'saque.failed', data: { id: 'WTH1', reason: 'recusado' } }, Date.now(), 'kavropay');
    const saldo = await banco.um<{ moedas_x100: number }>('select moedas_x100 from players where id = $1', [contaId]);
    expect(Number(saldo?.moedas_x100)).toBe(antes);
  });

  it('trava no saque só o bônus que a pessoa recebeu', async () => {
    const agora = new Date();
    const id = await banco.tx(async (c) => {
      const conta = await c.um<{ id: string }>(
        `insert into contas (tipo, email, senha_hash, nome, telefone, criado_em, atualizado_em)
         values ('email', 'bonus-40@exemplo.com', 'x', 'Lia Quarenta', '+5531955443322', $1, $1) returning id`,
        [agora],
      );
      await criarJogador(c, conta!.id, agora.getTime(), rng);
      await c.q(`update transactions set valor_x100 = 4000 where player_id = $1 and tipo = 'BONUS_INICIAL'`, [conta!.id]);
      await c.q('update players set moedas_x100 = 6000, bonus_saque_liberado = true where id = $1', [conta!.id]);
      await c.q(
        `insert into transactions (player_id, tipo, valor_x100, saldo_apos_x100, config_versao, criado_em)
         values ($1, 'VENDA_OVOS', 2000, 6000, 'teste', $2)`,
        [conta!.id, agora],
      );
      return conta!.id;
    });
    await expect(
      banco.tx((c) => solicitarSaque(c, id, { centavos: 5000, cpf: CPF, nome: 'Lia Quarenta' }, Date.now(), 'chave-bonus-40-cedo', provedorOk())),
    ).rejects.toBeInstanceOf(ErroDominio);
    const r = await banco.tx((c) => solicitarSaque(c, id, { centavos: 4000, cpf: CPF, nome: 'Lia Quarenta' }, Date.now(), 'chave-bonus-40', provedorOk()));
    expect(r.data.saldoX100).toBe(2000);
    expect(r.data.saque).toMatchObject({ centavos: 4000, taxaCentavos: 660, liquidoCentavos: 3340 });
  });

  it('confere a assinatura do webhook', () => {
    process.env.LOFYPAY_WEBHOOK_SECRET = 'segredo-de-teste';
    const corpo = '{"event":"saque.paid"}';
    const ts = 1_700_000_000;
    const v1 = createHmac('sha256', 'segredo-de-teste').update(`${ts}.${corpo}`).digest('hex');
    expect(verificarAssinaturaLofypay(corpo, `t=${ts},v1=${v1}`, ts * 1000)).toBe(true);
    expect(verificarAssinaturaLofypay(corpo, `t=${ts},v1=${'ab'.repeat(32)}`, ts * 1000)).toBe(false);
    expect(verificarAssinaturaLofypay(corpo, `t=${ts},v1=${v1}`, (ts + 600) * 1000)).toBe(false);
  });
});

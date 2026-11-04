// Testes de integração dos casos de uso contra um PostgreSQL real (PGlite em memória).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CONFIG, FAIXAS_ROLETA, MS_DIA, MS_HORA, faixaDe, valorVendaX100, vidaEm, type Rng,
} from '@galinheiro/game-core';
import { criarBancoEmMemoria, type Banco } from '@/server/db/banco';
import { cadastrarMembro, entrarComEmail, redefinirSenha } from '@/server/auth/contas';
import { gerarHash } from '@/server/auth/senha';
import { sessaoValida } from '@/server/auth/sessao';
import {
  ampliar, coletar, coletarTodos, estado, girar, marcarAposentadoriasVistas, renomear, vender,
} from '@/server/dominio/jogo';
import { extrato, listarEntidades } from '@/server/dominio/colecao';
import { resgatarCupom } from '@/server/dominio/intercambio';
import { ErroDominio } from '@/server/erros';

let banco: Banco;
let semente = 7;
const rng: Rng = { int: (n) => { semente = (semente * 48271) % 2147483647; return semente % n; } };
const T0 = Date.parse('2026-10-04T12:00:00.000Z');

async function codigoDoErro(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'SEM_ERRO';
  } catch (e) {
    if (e instanceof ErroDominio) return e.codigo;
    throw e;
  }
}

let seq = 0;
let pixSeq = 0;
/** Marca um PIX da ampliação como pago, sem chamar a gateway. */
async function pixAmpliacao(contaId: string) {
  pixSeq++;
  const quando = new Date(T0 + pixSeq * 1000);
  await banco.q(
    `insert into ampliacao_pix (player_id, centavos, status, id_transacao, copia_cola, qr_data_url, idempotencia, criado_em, atualizado_em, expira_em)
     values ($1, 2500, 'pago', $2, '000201', '', $3, $4, $4, $5)`,
    [contaId, `tx-amp-${pixSeq}`, `idem-amp-${pixSeq}`, quando, new Date(quando.getTime() + 3_600_000)],
  );
}

/** Marca um PIX do giro como pago, sem chamar a LofyPay. */
async function pixPago(contaId: string, n = 1) {
  for (let i = 0; i < n; i++) {
    pixSeq++;
    const quando = new Date(T0 + pixSeq * 1000);
    await banco.q(
      `insert into roleta_pix (player_id, centavos, status, id_transacao, copia_cola, qr_data_url, idempotencia, criado_em, atualizado_em, expira_em)
       values ($1, 5500, 'pago', $2, '000201', '', $3, $4, $4, $5)`,
      [contaId, `tx-${pixSeq}`, `idem-${pixSeq}`, quando, new Date(quando.getTime() + 3_600_000)],
    );
  }
}

/** Membro novo com e-mail e telefone únicos (o cadastro é a única forma de ter conta). */
function novoMembro(agoraMs = T0, dados: Partial<{ nome: string; telefone: string; email: string; senha: string }> = {}) {
  seq++;
  return cadastrarMembro(
    banco,
    {
      nome: 'Ana Teste',
      telefone: `+55119${String(10_000_000 + seq).padStart(8, '0')}`,
      email: `jogador${seq}@exemplo.com`,
      senha: 'senha-forte-123',
      ...dados,
    },
    agoraMs,
    rng,
  );
}

beforeAll(async () => {
  banco = await criarBancoEmMemoria();
});
afterAll(async () => {
  await banco.fechar();
});

describe('fluxo principal do jogo', () => {
  let contaId = '';

  it('membro novo nasce com 50 moedas, 4 ninhos e a galinha de boas-vindas pronta', async () => {
    const m = await novoMembro(T0, { nome: 'Maria Clara', telefone: '+5521998765432', email: 'maria@exemplo.com' });
    contaId = m.contaId;
    const { data } = await banco.tx((c) => estado(c, contaId, T0, rng));
    expect(data.player.moedasX100).toBe(5000);
    expect(data.player.capacidade).toBe(4);
    expect(data.ninhos).toHaveLength(4);
    expect(data.entidades).toHaveLength(1);
    const galinha = data.entidades[0]!;
    expect(galinha).toMatchObject({ tipo: 'galinha', raridade: 'comum', slotId: 1, pronto: true, origem: 'BOAS_VINDAS', diasRestantes: 90 });
    expect(data.resumo.prontos).toBe(1);
    expect(data.conta).toEqual({ nome: 'Maria Clara', telefone: '+5521998765432', email: 'maria@exemplo.com', admin: false });
  });

  it('coleta, abre ciclo de 24 h e recusa coletar de novo antes da hora', async () => {
    const ent = (await banco.tx((c) => estado(c, contaId, T0, rng))).data.entidades[0]!;
    const r = await banco.tx((c) => coletar(c, contaId, ent.id, T0 + 1000, rng));
    expect([1, 2, 3]).toContain(r.data.coleta.ovos);
    expect(r.data.inventario.ovo_galinha).toBe(r.data.coleta.ovos);
    expect(Date.parse(r.data.entity.proximoRendimento)).toBe(T0 + 24 * MS_HORA); // janela de graça ancora no "pronto"
    expect(await codigoDoErro(banco.tx((c) => coletar(c, contaId, ent.id, T0 + 2000, rng)))).toBe('RENDIMENTO_NAO_PRONTO');
  });

  it('vende tudo pelo preço exato e registra no extrato', async () => {
    const antes = (await banco.tx((c) => estado(c, contaId, T0 + 3000, rng))).data;
    const r = await banco.tx((c) => vender(c, contaId, { tudo: true }, T0 + 3000));
    expect(r.data.venda.creditoX100).toBe(valorVendaX100(antes.inventario));
    expect(r.data.saldoX100).toBe(antes.player.moedasX100 + r.data.venda.creditoX100);
    expect(r.data.inventario.ovo_galinha).toBe(0);
    expect(await codigoDoErro(banco.tx((c) => vender(c, contaId, { tudo: true }, T0 + 3000)))).toBe('VENDA_VAZIA');
    expect(await codigoDoErro(banco.tx((c) => vender(c, contaId, { itens: { ovo_pato: 3 } }, T0 + 3000)))).toBe('ESTOQUE_INSUFICIENTE');
  });

  it('gira a roleta com PIX pago: não debita moedas, cria animal no menor ninho livre e o ângulo cai no setor certo', async () => {
    const saldoAntes = (await banco.tx((c) => estado(c, contaId, T0 + 4000, rng))).data.player.moedasX100;
    await pixPago(contaId);
    const r = await banco.tx((c) => girar(c, contaId, T0 + 4000, rng));
    expect(r.data.saldoX100).toBe(saldoAntes);
    expect(r.data.entity.slotId).toBe(2);
    expect(r.data.entity.pronto).toBe(true); // primeira postura imediata
    const f = faixaDe(r.data.giro.rngValor);
    expect(f.tipo).toBe(r.data.giro.tipo);
    expect(r.data.giro.anguloResultado).toBeGreaterThan(f.grauInicio);
    expect(r.data.giro.anguloResultado).toBeLessThan(f.grauInicio + f.largura);
  });

  it('sem PIX pago: PAGAMENTO_PENDENTE; galinheiro cheio: SEM_NINHO_LIVRE; ampliar cria 4 ninhos', async () => {
    expect(await codigoDoErro(banco.tx((c) => girar(c, contaId, T0 + 5000, rng)))).toBe('PAGAMENTO_PENDENTE');
    await pixPago(contaId, 3);
    await banco.tx((c) => girar(c, contaId, T0 + 6000, rng));
    await banco.tx((c) => girar(c, contaId, T0 + 7000, rng));
    expect(await codigoDoErro(banco.tx((c) => girar(c, contaId, T0 + 8000, rng)))).toBe('SEM_NINHO_LIVRE');
    expect(await codigoDoErro(banco.tx((c) => ampliar(c, contaId, T0 + 8500)))).toBe('PAGAMENTO_PENDENTE');
    const saldoAntes = (await banco.tx((c) => estado(c, contaId, T0 + 8600, rng))).data.player.moedasX100;
    await pixAmpliacao(contaId);
    const a = await banco.tx((c) => ampliar(c, contaId, T0 + 9000));
    expect(a.data.saldoX100).toBe(saldoAntes);
    expect(a.data).toMatchObject({ nivelGalinheiro: 2, capacidade: 8, novosSlots: [5, 6, 7, 8] });
    const g = await banco.tx((c) => girar(c, contaId, T0 + 10_000, rng));
    expect(g.data.entity.slotId).toBe(5);
  });

  it('coletar todos pega só os prontos, numa transação', async () => {
    const r = await banco.tx((c) => coletarTodos(c, contaId, T0 + 11_000, rng));
    expect(r.data.coletas.length).toBe(4); // os 4 animais vindos da roleta chegaram prontos
    expect(r.data.totalOvos).toBe(r.data.coletas.reduce((s, x) => s + x.ovos, 0));
    const vazio = await banco.tx((c) => coletarTodos(c, contaId, T0 + 12_000, rng));
    expect(vazio.data.coletas).toHaveLength(0);
  });

  it('cupom de giros gira na hora, sem PIX e sem debitar moedas', async () => {
    const saldoAntes = (await banco.tx((c) => estado(c, contaId, T0 + 12_500, rng))).data.player.moedasX100;
    await banco.q(
      `insert into cupons (codigo, beneficio, tickets, giros, inicio, ativo, criado_em, atualizado_em)
       values ('GIROGRATIS', 'giros', 0, 2, $1, true, $1, $1)`,
      [new Date(T0)],
    );
    const resgate = await banco.tx((c) => resgatarCupom(c, contaId, 'GIROGRATIS', T0 + 12_600));
    expect(resgate.data).toMatchObject({ codigo: 'GIROGRATIS', tickets: 0, giros: 2, saldoGiros: 2 });
    const g1 = await banco.tx((c) => girar(c, contaId, T0 + 12_700, rng));
    expect(g1.data.giro.custoX100).toBe(0);
    expect(g1.data.girosGratis).toBe(1);
    expect(g1.data.saldoX100).toBe(saldoAntes);
    const g2 = await banco.tx((c) => girar(c, contaId, T0 + 12_800, rng));
    expect(g2.data.girosGratis).toBe(0);
    expect(await codigoDoErro(banco.tx((c) => girar(c, contaId, T0 + 12_900, rng)))).toBe('PAGAMENTO_PENDENTE');
  });

  it('renomeia validando o nome', async () => {
    const ent = (await banco.tx((c) => estado(c, contaId, T0 + 13_000, rng))).data.entidades[0]!;
    const r = await banco.tx((c) => renomear(c, contaId, ent.id, '  Pipoca Turbo ', T0 + 13_000));
    expect(r.data.nome).toBe('Pipoca Turbo');
    expect(await codigoDoErro(banco.tx((c) => renomear(c, contaId, ent.id, '', T0)))).toBe('NOME_INVALIDO');
    expect(await codigoDoErro(banco.tx((c) => renomear(c, contaId, ent.id, 'p0rr4', T0)))).toBe('NOME_IMPROPRIO');
  });

  it('aposenta aos 90 dias com presente de despedida e mostra no estado até marcar como visto', async () => {
    const depois = T0 + 91 * MS_DIA;
    const antes = (await banco.tx((c) => estado(c, contaId, T0 + 14_000, rng))).data;
    const ovosPendentes = await banco.q<{ s: number }>(
      `select coalesce(sum(ovos_pendentes), 0)::int as s from entities where player_id = $1 and status = 'ativo' and tipo = 'galinha'`, [contaId]);
    const r = await banco.tx((c) => estado(c, contaId, depois, rng));
    expect(r.data.entidades).toHaveLength(0);
    expect(r.data.aposentadoriasNaoVistas).toHaveLength(antes.entidades.length);
    expect(r.data.aposentadoriasNaoVistas.every((e) => e.status === 'expirado' && e.slotId === null)).toBe(true);
    expect(r.data.inventario.ovo_galinha).toBe(antes.inventario.ovo_galinha + ovosPendentes[0]!.s);
    const ack = await banco.tx((c) => marcarAposentadoriasVistas(c, contaId, new Date(depois).toISOString(), depois));
    expect(Date.parse(ack.data.aposentadoriasVistasAte)).toBe(depois);
    expect((await banco.tx((c) => estado(c, contaId, depois + 1000, rng))).data.aposentadoriasNaoVistas).toHaveLength(0);
  });

  it('extrato pagina por cursor e coleção filtra aposentados', async () => {
    const p1 = await banco.tx((c) => extrato(c, contaId, 1, undefined));
    expect(p1.itens).toHaveLength(1);
    expect(p1.proximoCursor).not.toBeNull();
    const p2 = await banco.tx((c) => extrato(c, contaId, 1, p1.proximoCursor!));
    expect(p2.itens[0]!.id).not.toBe(p1.itens[0]!.id);
    const lista = await banco.tx((c) => listarEntidades(c, contaId, { status: 'expirado', ordenar: 'raridade', limit: 2 }, T0 + 92 * MS_DIA));
    expect(lista.total).toBeGreaterThanOrEqual(5);
    expect(lista.itens).toHaveLength(2);
    expect(lista.proximoCursor).not.toBeNull();
  });

  it('invariantes de integridade continuam válidas (saldo = extrato, capacidade)', async () => {
    const n = await banco.um<{ n: number }>('select job_checar_integridade() as n');
    expect(n?.n).toBe(0);
  });
});

describe('ciclos e vida no banco', () => {
  it('fn_vida (SQL) e vidaEm (game-core) concordam', async () => {
    for (const [fator, idadeMs] of [[100, 1_944_000_000], [90, 3_000_000_000], [80, 7_290_000_000], [70, 5_554_285_714]] as const) {
      const sql = await banco.um<{ v: number }>(
        `select fn_vida(100, to_timestamp(0), $1, to_timestamp($2::double precision / 1000)) as v`, [fator, idadeMs]);
      expect(sql!.v).toBeCloseTo(vidaEm({ vidaAncora: 100, vidaAncoraEmMs: 0, fatorPct: fator }, idadeMs), 6);
    }
  });

  it('janela de graça: coleta 7 h atrasada perde só 3 h', async () => {
    const { contaId } = await novoMembro();
    const ent = (await banco.tx((c) => estado(c, contaId, T0, rng))).data.entidades[0]!;
    await banco.tx((c) => coletar(c, contaId, ent.id, T0, rng)); // próximo: T0 + 24 h
    const r = await banco.tx((c) => coletar(c, contaId, ent.id, T0 + 31 * MS_HORA, rng));
    expect(Date.parse(r.data.entity.cicloInicio)).toBe(T0 + 27 * MS_HORA);
    expect(Date.parse(r.data.entity.proximoRendimento)).toBe(T0 + 51 * MS_HORA);
  });
});

describe('contas (só membros cadastrados)', () => {
  it('cadastra membro, entra, recusa e-mail/telefone repetidos e redefine a senha com o código', async () => {
    const m = await novoMembro(T0, { nome: 'Ana Souza', telefone: '+5511987654321', email: 'ana@exemplo.com' });
    expect(m.conta).toEqual({ nome: 'Ana Souza', telefone: '+5511987654321', email: 'ana@exemplo.com', admin: false });
    expect(m.codigoRecuperacao).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(await sessaoValida(banco, { contaId: m.contaId, versao: m.versao, emitidoEm: 0 })).toBe(true);
    expect((await entrarComEmail(banco, 'ana@exemplo.com', 'senha-forte-123')).contaId).toBe(m.contaId);
    expect(await codigoDoErro(entrarComEmail(banco, 'ana@exemplo.com', 'errada'))).toBe('CREDENCIAIS_INVALIDAS');
    expect(await codigoDoErro(novoMembro(T0, { email: 'ana@exemplo.com' }))).toBe('EMAIL_EM_USO');
    expect(await codigoDoErro(novoMembro(T0, { telefone: '+5511987654321' }))).toBe('TELEFONE_EM_USO');
    const r = await redefinirSenha(banco, 'ana@exemplo.com', m.codigoRecuperacao.toLowerCase(), 'nova-senha-456');
    expect(r.versao).toBe(2);
    expect((await entrarComEmail(banco, 'ana@exemplo.com', 'nova-senha-456')).versao).toBe(2);
    expect(await codigoDoErro(redefinirSenha(banco, 'ana@exemplo.com', m.codigoRecuperacao, 'x-senha-789'))).toBe('CODIGO_INVALIDO');
  });

  it('contas antigas (convidado, ou e-mail sem telefone) não abrem sessão nem entram', async () => {
    const convidado = (await banco.um<{ id: string }>(`insert into contas (tipo) values ('convidado') returning id`))!;
    expect(await sessaoValida(banco, { contaId: convidado.id, versao: 1, emitidoEm: 0 })).toBe(false);
    await banco.q(`insert into contas (tipo, email, senha_hash) values ('email', 'antiga@exemplo.com', $1)`, [await gerarHash('senha-antiga-1')]);
    expect(await codigoDoErro(entrarComEmail(banco, 'antiga@exemplo.com', 'senha-antiga-1'))).toBe('CADASTRO_INCOMPLETO');
  });
});

describe('sanidade da configuração', () => {
  it('faixas da roleta cobrem 0..9999 sem buracos', () => {
    let esperado = 0;
    for (const f of FAIXAS_ROLETA) {
      expect(f.de).toBe(esperado);
      esperado = f.ate + 1;
    }
    expect(esperado).toBe(10_000);
    expect(CONFIG.galinheiro.nivelMax * CONFIG.galinheiro.ninhosPorNivel).toBe(128);
  });
});

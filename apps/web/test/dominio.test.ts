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
  ampliar, coletar, coletarTodos, estado, girar, liberarRoleta, marcarAposentadoriasVistas, renomear, vender,
} from '@/server/dominio/jogo';
import { aceitarTermos } from '@/server/auth/contas';
import { movimentarSaldo } from '@/server/dominio/repo';
import { lutar } from '@/server/dominio/rinha';
import { extrato, listarEntidades } from '@/server/dominio/colecao';
import { resgatarCupom } from '@/server/dominio/intercambio';
import { ErroDominio } from '@/server/erros';
import { TERMOS_VERSAO } from '@galinheiro/api-contract';

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

/** Crédito da equipe (AJUSTE_SUPORTE): atalho para testar preços sem esperar a codorna botar. */
async function darMoedas(contaId: string, valorX100: number, agoraMs = T0) {
  if (valorX100 === 0) return;
  await banco.tx(async (c) => {
    await c.q('select id from players where id = $1 for update', [contaId]);
    await movimentarSaldo(c, contaId, valorX100, 'AJUSTE_SUPORTE', { motivo: 'teste' }, agoraMs);
  });
}
const saldoDe = async (contaId: string, agoraMs = T0) => (await banco.tx((c) => estado(c, contaId, agoraMs, rng))).data.player.moedasX100;

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
      aceitouTermos: true,
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

  it('membro novo nasce sem moedas, com 4 ninhos, a codorna de boas-vindas pronta e a roleta trancada', async () => {
    const m = await novoMembro(T0, { nome: 'Maria Clara', telefone: '+5521998765432', email: 'maria@exemplo.com' });
    contaId = m.contaId;
    const { data } = await banco.tx((c) => estado(c, contaId, T0, rng));
    expect(data.player.moedasX100).toBe(0);
    expect(data.player.roletaLiberada).toBe(false);
    expect(data.player.capacidade).toBe(4);
    expect(data.ninhos).toHaveLength(4);
    expect(data.entidades).toHaveLength(1);
    const codorna = data.entidades[0]!;
    expect(codorna).toMatchObject({ tipo: 'codorna', raridade: 'comum', slotId: 1, pronto: true, origem: 'BOAS_VINDAS', diasRestantes: 90, valorOvoX100: 35 });
    expect(data.resumo.prontos).toBe(1);
    expect(data.conta).toEqual({ nome: 'Maria Clara', telefone: '+5521998765432', email: 'maria@exemplo.com', admin: false, termosPendentes: false });
  });

  it('coleta, abre ciclo de 24 h e recusa coletar de novo antes da hora', async () => {
    const ent = (await banco.tx((c) => estado(c, contaId, T0, rng))).data.entidades[0]!;
    const r = await banco.tx((c) => coletar(c, contaId, ent.id, T0 + 1000, rng));
    expect([1, 2, 3]).toContain(r.data.coleta.ovos);
    expect(r.data.inventario.ovo_codorna).toBe(r.data.coleta.ovos);
    expect(Date.parse(r.data.entity.proximoRendimento)).toBe(T0 + 24 * MS_HORA); // janela de graça ancora no "pronto"
    expect(await codigoDoErro(banco.tx((c) => coletar(c, contaId, ent.id, T0 + 2000, rng)))).toBe('RENDIMENTO_NAO_PRONTO');
  });

  it('vende os ovos da codorna a 0,35 cada e registra no extrato', async () => {
    const antes = (await banco.tx((c) => estado(c, contaId, T0 + 3000, rng))).data;
    const r = await banco.tx((c) => vender(c, contaId, { tudo: true }, T0 + 3000));
    expect(r.data.venda.creditoX100).toBe(antes.inventario.ovo_codorna * 35);
    expect(r.data.venda.creditoX100).toBe(valorVendaX100(antes.inventario));
    expect(r.data.saldoX100).toBe(antes.player.moedasX100 + r.data.venda.creditoX100);
    expect(r.data.inventario.ovo_codorna).toBe(0);
    expect(await codigoDoErro(banco.tx((c) => vender(c, contaId, { tudo: true }, T0 + 3000)))).toBe('VENDA_VAZIA');
    expect(await codigoDoErro(banco.tx((c) => vender(c, contaId, { itens: { ovo_pato: 3 } }, T0 + 3000)))).toBe('ESTOQUE_INSUFICIENTE');
  });

  it('roleta trancada: só gira depois da liberação de 12 moedas, que já dá o primeiro giro', async () => {
    expect(await codigoDoErro(banco.tx((c) => girar(c, contaId, T0 + 3500, rng)))).toBe('ROLETA_BLOQUEADA');
    expect(await codigoDoErro(banco.tx((c) => liberarRoleta(c, contaId, T0 + 3500)))).toBe('SALDO_INSUFICIENTE');
    await darMoedas(contaId, CONFIG.roleta.liberacaoX100 - (await saldoDe(contaId)), T0 + 3600);
    const l = await banco.tx((c) => liberarRoleta(c, contaId, T0 + 3700));
    expect(l.data).toMatchObject({ saldoX100: 0, girosGratis: 1 });
    expect((await banco.tx((c) => estado(c, contaId, T0 + 3800, rng))).data.player.roletaLiberada).toBe(true);
    expect(await codigoDoErro(banco.tx((c) => liberarRoleta(c, contaId, T0 + 3800)))).toBe('ROLETA_JA_LIBERADA');

    const r = await banco.tx((c) => girar(c, contaId, T0 + 4000, rng));
    expect(r.data.giro.custoX100).toBe(0);
    expect(r.data.girosGratis).toBe(0);
    expect(r.data.saldoX100).toBe(0);
    expect(r.data.entity.slotId).toBe(2);
    expect(r.data.entity.tipo).not.toBe('codorna');
    expect(r.data.entity.pronto).toBe(true); // primeira postura imediata
    const f = faixaDe(r.data.giro.rngValor);
    expect(f.tipo).toBe(r.data.giro.tipo);
    expect(r.data.giro.anguloResultado).toBeGreaterThan(f.grauInicio);
    expect(r.data.giro.anguloResultado).toBeLessThan(f.grauInicio + f.largura);
  });

  it('giro e ampliação cobram moedas do jogo; sem moedas: SALDO_INSUFICIENTE; cheio: SEM_NINHO_LIVRE', async () => {
    expect(await codigoDoErro(banco.tx((c) => girar(c, contaId, T0 + 5000, rng)))).toBe('SALDO_INSUFICIENTE');
    await darMoedas(contaId, 2 * CONFIG.roleta.custoX100, T0 + 5500);
    const g1 = await banco.tx((c) => girar(c, contaId, T0 + 6000, rng));
    expect(g1.data.giro.custoX100).toBe(CONFIG.roleta.custoX100);
    expect(g1.data.saldoX100).toBe(CONFIG.roleta.custoX100);
    await banco.tx((c) => girar(c, contaId, T0 + 7000, rng));
    expect(await codigoDoErro(banco.tx((c) => girar(c, contaId, T0 + 8000, rng)))).toBe('SEM_NINHO_LIVRE');
    expect(await codigoDoErro(banco.tx((c) => ampliar(c, contaId, T0 + 8500)))).toBe('SALDO_INSUFICIENTE');
    await darMoedas(contaId, CONFIG.galinheiro.custoUpgradeX100 + CONFIG.roleta.custoX100, T0 + 8600);
    const a = await banco.tx((c) => ampliar(c, contaId, T0 + 9000));
    expect(a.data.saldoX100).toBe(CONFIG.roleta.custoX100);
    expect(a.data).toMatchObject({ nivelGalinheiro: 2, capacidade: 8, novosSlots: [5, 6, 7, 8] });
    const g = await banco.tx((c) => girar(c, contaId, T0 + 10_000, rng));
    expect(g.data.entity.slotId).toBe(5);
    expect(g.data.saldoX100).toBe(0);
  });

  it('coletar todos pega só os prontos, numa transação', async () => {
    const r = await banco.tx((c) => coletarTodos(c, contaId, T0 + 11_000, rng));
    expect(r.data.coletas.length).toBe(4); // os 4 animais vindos da roleta chegaram prontos; a codorna ainda não
    expect(r.data.totalOvos).toBe(r.data.coletas.reduce((s, x) => s + x.ovos, 0));
    const vazio = await banco.tx((c) => coletarTodos(c, contaId, T0 + 12_000, rng));
    expect(vazio.data.coletas).toHaveLength(0);
  });

  it('cupom de giros gira na hora, sem debitar moedas', async () => {
    const saldoAntes = await saldoDe(contaId, T0 + 12_500);
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
    expect(await codigoDoErro(banco.tx((c) => girar(c, contaId, T0 + 12_900, rng)))).toBe('SALDO_INSUFICIENTE');
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
    expect(m.conta).toEqual({ nome: 'Ana Souza', telefone: '+5511987654321', email: 'ana@exemplo.com', admin: false, termosPendentes: false });
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

describe('rinha de galo (moedas do jogo)', () => {
  it('fecha até liberar a roleta, pede os termos, cobra a aposta e paga o prêmio pela tabela', async () => {
    const { contaId } = await novoMembro();
    const aposta = { galo: 'favorito' as const, apostaX100: 100 };
    expect(await codigoDoErro(banco.tx((c) => lutar(c, contaId, aposta, T0, rng)))).toBe('RINHA_BLOQUEADA');
    await darMoedas(contaId, CONFIG.roleta.liberacaoX100);
    await banco.tx((c) => liberarRoleta(c, contaId, T0));
    expect(await codigoDoErro(banco.tx((c) => lutar(c, contaId, aposta, T0, rng)))).toBe('SALDO_INSUFICIENTE');

    await banco.q('update contas set termos_versao = null, termos_aceitos_em = null where id = $1', [contaId]);
    await darMoedas(contaId, 10_000);
    expect(await codigoDoErro(banco.tx((c) => lutar(c, contaId, aposta, T0, rng)))).toBe('TERMOS_PENDENTES');
    expect((await banco.tx((c) => estado(c, contaId, T0, rng))).data.conta.termosPendentes).toBe(true);
    expect(await codigoDoErro(banco.tx((c) => aceitarTermos(c, contaId, '2000-01-01', T0)))).toBe('TERMOS_PENDENTES');
    await banco.tx((c) => aceitarTermos(c, contaId, TERMOS_VERSAO, T0));
    expect((await banco.tx((c) => estado(c, contaId, T0, rng))).data.conta.termosPendentes).toBe(false);

    let esperado = 10_000;
    let vitorias = 0;
    for (let i = 0; i < 40; i++) {
      const r = await banco.tx((c) => lutar(c, contaId, aposta, T0 + i, rng));
      const { rinha } = r.data;
      expect(rinha.venceu).toBe(rinha.rngValor < CONFIG.rinha.galos.favorito.chanceBp);
      expect(rinha.premioX100).toBe(rinha.venceu ? 160 : 0);
      expect(rinha.golpes.at(-1)![rinha.venceu ? 'vidaRival' : 'vidaJogador']).toBe(0);
      esperado += rinha.premioX100 - rinha.apostaX100;
      if (rinha.venceu) vitorias++;
      expect(r.data.saldoX100).toBe(esperado);
    }
    expect(vitorias).toBeGreaterThan(0);
    expect(vitorias).toBeLessThan(40);
    expect(await codigoDoErro(banco.tx((c) => lutar(c, contaId, { galo: 'azarao', apostaX100: 99_999 }, T0, rng)))).toBe('PAYLOAD_INVALIDO');
    const n = await banco.um<{ n: number }>('select job_checar_integridade() as n');
    expect(n?.n).toBe(0);
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

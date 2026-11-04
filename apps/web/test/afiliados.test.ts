// Convites e afiliação: código e link, cadastro com convite, comissões multinível nas vendas de ovos (moedas
// do jogo, pagas pelo jogo), teto diário, bloqueio, programa pausado e o painel (taxas, ranking, rede, ficha).
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Rng } from '@galinheiro/game-core';
import { criarBancoEmMemoria, usarBancoNosTestes, type Banco } from '@/server/db/banco';
import { cadastrarMembro } from '@/server/auth/contas';
import { COOKIE_SESSAO, emitirToken } from '@/server/auth/sessao';
import { creditarOvos } from '@/server/dominio/repo';
import { POST as postCadastrar } from '@/app/api/v1/auth/cadastrar/route';
import { POST as postSell } from '@/app/api/v1/sell/route';
import { GET as getConvites } from '@/app/api/v1/convites/route';
import { GET as getConvite } from '@/app/api/v1/convites/[codigo]/route';
import { GET as getLink } from '@/app/c/[codigo]/route';
import { GET as getAfiliados } from '@/app/api/admin/afiliados/route';
import { GET as getConfig, PUT as putConfig } from '@/app/api/admin/afiliados/config/route';
import { GET as getRede } from '@/app/api/admin/afiliados/rede/[id]/route';
import { GET as getUsuario } from '@/app/api/admin/usuarios/[id]/route';
import { POST as postBonusLink } from '@/app/api/admin/usuarios/[id]/bonus-link/route';
import { POST as postBonusGeral } from '@/app/api/admin/afiliados/bonus-geral/route';

let banco: Banco;
const rng: Rng = { int: (n) => Math.floor(Math.random() * n) };
interface Membro { id: string; cookie: string; codigo: string }

let seq = 0;
async function membro(nome: string, convite?: string): Promise<Membro> {
  seq++;
  const m = await cadastrarMembro(
    banco,
    { nome, telefone: `+55319${String(80_000_000 + seq).padStart(8, '0')}`, email: `afiliado${seq}@exemplo.com`, senha: 'senha-forte-123', convite },
    Date.now(),
    rng,
  );
  const l = await banco.um<{ convite_codigo: string }>('select convite_codigo from contas where id = $1', [m.contaId]);
  return { id: m.contaId, cookie: `${COOKIE_SESSAO}=${await emitirToken(m.contaId, m.versao)}`, codigo: l!.convite_codigo };
}

function req(quem: Membro | null, metodo: string, caminho: string, opcoes: { corpo?: unknown; chave?: string } = {}): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (quem) headers.set('cookie', quem.cookie);
  if (opcoes.chave) headers.set('idempotency-key', opcoes.chave);
  return new NextRequest(`http://localhost${caminho}`, {
    method: metodo,
    headers,
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });
}
const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });
const json = async (r: Response) => (await r.json()) as { ok: boolean; data: any; error?: { code: string; message: string } };
const saldo = async (m: Membro) => Number((await banco.um<{ s: unknown }>('select moedas_x100 as s from players where id = $1', [m.id]))!.s);

/** Põe `ovos` de galinha no estoque e vende (10 ovos = 12,00 moedas). */
async function vender(m: Membro, ovos: number) {
  await banco.tx((c) => creditarOvos(c, m.id, 'ovo_galinha', ovos, Date.now()));
  const r = await postSell(req(m, 'POST', '/api/v1/sell', { corpo: { itens: { ovo_galinha: ovos } }, chave: crypto.randomUUID() }));
  if (r.status !== 200) throw new Error(`venda falhou: ${r.status} ${JSON.stringify(await r.json())}`);
}

beforeAll(async () => {
  banco = await criarBancoEmMemoria();
  usarBancoNosTestes(banco);
});
afterAll(async () => {
  await banco.fechar();
});

describe('convites', () => {
  it('todo membro ganha um código; o link curto leva ao cadastro; a conferência pública mostra só o nome curto', async () => {
    const ana = await membro('Ana Maria Lima');
    expect(ana.codigo).toMatch(/^[A-HJ-NP-Z2-9]{7}$/);
    const minusculo = ana.codigo.toLowerCase();
    const link = await getLink(new Request(`http://localhost/c/${minusculo}`), { params: Promise.resolve({ codigo: minusculo }) });
    expect(link.status).toBe(307);
    expect(link.headers.get('location')).toBe(`/entrar?convite=${ana.codigo}`);
    const ok = await json(await getConvite(req(null, 'GET', `/api/v1/convites/${ana.codigo}`), params({ codigo: ana.codigo })));
    expect(ok.data).toEqual({ valido: true, indicador: 'Ana L.' });
    const ruim = await json(await getConvite(req(null, 'GET', '/api/v1/convites/ZZZZZZZ'), params({ codigo: 'ZZZZZZZ' })));
    expect(ruim.data).toEqual({ valido: false, indicador: null });
  });

  it('cadastro com convite liga a quem convidou; convite inválido é recusado e a conta não é criada', async () => {
    const ana = await membro('Ana Souza');
    const corpo = (i: number, convite: string) => ({
      nome: 'Novo Membro', telefone: `(31) 9${70_000_000 + i}`, email: `novo${i}@exemplo.com`, senha: 'senha-forte-123', convite,
    });
    const ruim = await postCadastrar(req(null, 'POST', '/api/v1/auth/cadastrar', { corpo: corpo(1, 'ZZZZZZZ') }));
    expect(ruim.status).toBe(400);
    expect((await json(ruim)).error?.code).toBe('CONVITE_INVALIDO');
    expect(await banco.um(`select 1 from contas where email = 'novo1@exemplo.com'`)).toBeNull();
    // o código digitado em minúsculas e com traço também vale
    const digitado = `${ana.codigo.slice(0, 3)}-${ana.codigo.slice(3)}`.toLowerCase();
    const bom = await postCadastrar(req(null, 'POST', '/api/v1/auth/cadastrar', { corpo: corpo(2, digitado) }));
    expect(bom.status).toBe(201);
    const novo = await banco.um<{ indicado_por: string; convite_codigo: string }>(`select indicado_por, convite_codigo from contas where email = 'novo2@exemplo.com'`);
    expect(novo).toMatchObject({ indicado_por: ana.id });
    expect(novo!.convite_codigo).toMatch(/^[A-HJ-NP-Z2-9]{7}$/);
  });
});

describe('comissões nas vendas de ovos', () => {
  it('pagam 10% / 4% / 2% a três níveis acima; o vendedor recebe a venda inteira e saldo = extrato', async () => {
    const avo = await membro('Avó Rede');
    const bento = await membro('Bento Rede', avo.codigo);
    const cora = await membro('Cora Rede', bento.codigo);
    const davi = await membro('Davi Rede', cora.codigo);
    const edu = await membro('Edu Rede', davi.codigo); // acima de Edu: Davi (1), Cora (2), Bento (3), Avó (4, não paga)
    const antes = await Promise.all([avo, bento, cora, davi, edu].map(saldo));
    await vender(edu, 10);
    const depois = await Promise.all([avo, bento, cora, davi, edu].map(saldo));
    expect(depois.map((s, i) => s - antes[i]!)).toEqual([0, 24, 48, 120, 1200]);

    const t = await banco.um<{ tipo: string; detalhes: Record<string, unknown> }>(
      'select tipo, detalhes from transactions where player_id = $1 order by criado_em desc limit 1',
      [davi.id],
    );
    expect(t).toMatchObject({ tipo: 'COMISSAO_INDICACAO', detalhes: { nivel: 1, origem: 'Edu R.', vendaX100: 1200 } });
    for (const m of [bento, cora, davi]) {
      const r = await banco.um<{ saldo: unknown; extrato: unknown }>(
        'select p.moedas_x100 as saldo, (select sum(valor_x100) from transactions where player_id = p.id) as extrato from players p where p.id = $1',
        [m.id],
      );
      expect(Number(r!.saldo)).toBe(Number(r!.extrato));
    }

    const doDavi = await json(await getConvites(req(davi, 'GET', '/api/v1/convites')));
    expect(doDavi.data).toMatchObject({ codigo: davi.codigo, caminho: `/c/${davi.codigo}`, indicadoPor: 'Cora R.', rede: [1, 0, 0], totalIndicados: 1 });
    expect(doDavi.data.ganhos).toMatchObject({ hojeX100: 120, totalX100: 120 });
    expect(doDavi.data.indicados[0]).toMatchObject({ nome: 'Edu R.', rendeuX100: 120 });
    expect(doDavi.data.ultimas[0]).toMatchObject({ nivel: 1, origem: 'Edu R.', baseX100: 1200, valorX100: 120 });
    expect((await json(await getConvites(req(bento, 'GET', '/api/v1/convites')))).data.rede).toEqual([1, 1, 1]);
  });

  it('bloqueado não recebe mas não quebra a corrente; teto diário; programa pausado não paga', async () => {
    const topo = await membro('Topo Teste');
    const meio = await membro('Meio Teste', topo.codigo);
    const base = await membro('Base Teste', meio.codigo);

    await banco.q(`update contas set bloqueado_em = now(), bloqueio_motivo = 'teste' where id = $1`, [meio.id]);
    const t0 = await saldo(topo);
    await vender(base, 10);
    expect((await saldo(topo)) - t0).toBe(48); // o nível 2 continua recebendo
    expect(await banco.um('select 1 from comissoes where beneficiario_id = $1', [meio.id])).toBeNull();
    await banco.q('update contas set bloqueado_em = null, bloqueio_motivo = null where id = $1', [meio.id]);

    await banco.q('update afiliados_config set teto_diario_x100 = 100 where id = 1'); // 1,00 moeda por dia
    const m0 = await saldo(meio);
    await vender(base, 10); // 10% de 12,00 = 1,20 → só 1,00
    await vender(base, 10); // teto do dia já batido
    expect((await saldo(meio)) - m0).toBe(100);

    await banco.q('update afiliados_config set ativo = false, teto_diario_x100 = 20000 where id = 1');
    const t1 = await saldo(topo);
    await vender(base, 10);
    expect(await saldo(topo)).toBe(t1);
    await banco.q('update afiliados_config set ativo = true where id = 1');
  });
});

describe('painel: rede de afiliados e taxas', () => {
  it('só admin; muda as taxas (auditado); ranking, rede do membro e afiliação na ficha', async () => {
    const chefe = await membro('Chefe Afiliados');
    await banco.q(`update contas set papel = 'admin' where id = $1`, [chefe.id]);
    const jogador = await membro('Jogador Comum');
    expect((await getAfiliados(req(jogador, 'GET', '/api/admin/afiliados'))).status).toBe(403);
    expect((await putConfig(req(jogador, 'PUT', '/api/admin/afiliados/config', { corpo: { ativo: false, comissoesBp: [0], tetoDiarioX100: null } }))).status).toBe(403);

    const ruim = await putConfig(req(chefe, 'PUT', '/api/admin/afiliados/config', { corpo: { ativo: true, comissoesBp: [6000], tetoDiarioX100: null } }));
    expect(ruim.status).toBe(400);
    const salvo = await json(await putConfig(req(chefe, 'PUT', '/api/admin/afiliados/config', { corpo: { ativo: true, comissoesBp: [500, 250], tetoDiarioX100: null } })));
    expect(salvo.data).toEqual({ ativo: true, comissoesBp: [500, 250], tetoDiarioX100: null });
    expect((await json(await getConfig(req(chefe, 'GET', '/api/admin/afiliados/config')))).data.comissoesBp).toEqual([500, 250]);
    const aud = await banco.um<{ acao: string; detalhes: Record<string, unknown> }>('select acao, detalhes from admin_acoes order by id desc limit 1');
    expect(aud).toMatchObject({ acao: 'configurar_afiliados', detalhes: { de: { comissoesBp: [1000, 400, 200] }, para: { comissoesBp: [500, 250] } } });

    // chefe → Xavier → Yara: a venda da Yara paga 5% ao Xavier e 2,5% ao chefe
    const xavier = await membro('Xavier Rede', chefe.codigo);
    const yara = await membro('Yara Rede', xavier.codigo);
    const c0 = await saldo(chefe);
    await vender(yara, 10);
    expect((await saldo(chefe)) - c0).toBe(30);

    const resumo = await json(await getAfiliados(req(chefe, 'GET', '/api/admin/afiliados?dias=7&ordenar=comissoes')));
    expect(resumo.data.config.comissoesBp).toEqual([500, 250]);
    expect(resumo.data.serie).toHaveLength(7);
    expect(resumo.data.totais.indicados).toBeGreaterThanOrEqual(2);
    expect(resumo.data.ranking.find((l: { id: string }) => l.id === chefe.id)).toMatchObject({ diretos: 1, rede: 2, comissoesPeriodoX100: 30 });

    const rede = await json(await getRede(req(chefe, 'GET', `/api/admin/afiliados/rede/${xavier.id}`), params({ id: xavier.id })));
    expect(rede.data.acima).toEqual([{ id: chefe.id, nome: 'Chefe Afiliados', nivel: 1 }]);
    expect(rede.data.niveis.slice(0, 2)).toEqual([1, 0]);
    expect(rede.data.diretos[0]).toMatchObject({ id: yara.id, rendeuX100: 60 });
    expect(rede.data.comissoes).toEqual({ recebidasX100: 60, geradasX100: 0 });
    expect((await getRede(req(chefe, 'GET', '/api/admin/afiliados/rede/xyz'), params({ id: 'xyz' }))).status).toBe(404);

    const ficha = await json(await getUsuario(req(chefe, 'GET', `/api/admin/usuarios/${chefe.id}`), params({ id: chefe.id })));
    expect(ficha.data.afiliacao).toEqual({
      codigo: chefe.codigo, indicadoPor: null, diretos: 1, rede: 2, comissoesRecebidasX100: 30,
      bonusLinkX100: null, bonusGeralX100: 5000,
    });

    await banco.q(`update afiliados_config set ativo = true, comissoes_bp = '{1000,400,200}', teto_diario_x100 = 20000 where id = 1`);
  });

  it('quem entra pelo link recebe o bônus da ficha; os outros recebem o bônus geral', async () => {
    const admin = await membro('Admin Bonus');
    await banco.q(`update contas set papel = 'admin' where id = $1`, [admin.id]);
    const fulano1 = await membro('Fulano Um');
    const fulano2 = await membro('Fulano Dois');
    const link1 = await postBonusLink(req(admin, 'POST', `/api/admin/usuarios/${fulano1.id}/bonus-link`, { corpo: { bonusX100: 4000 }, chave: 'bonus-link-1' }), params({ id: fulano1.id }));
    const link2 = await postBonusLink(req(admin, 'POST', `/api/admin/usuarios/${fulano2.id}/bonus-link`, { corpo: { bonusX100: 5000 }, chave: 'bonus-link-2' }), params({ id: fulano2.id }));
    const geral = await postBonusGeral(req(admin, 'POST', '/api/admin/afiliados/bonus-geral', { corpo: { bonusX100: 4500 }, chave: 'bonus-geral-1' }));
    expect(link1.status).toBe(200);
    expect(link2.status).toBe(200);
    expect(geral.status).toBe(200);

    const pelo1 = await membro('Entrou Pelo Um', fulano1.codigo);
    const pelo2 = await membro('Entrou Pelo Dois', fulano2.codigo);
    const sem = await membro('Entrou Sem Convite');
    expect(await saldo(pelo1)).toBe(4000);
    expect(await saldo(pelo2)).toBe(5000);
    expect(await saldo(sem)).toBe(4500);

    const deNovo = await postBonusGeral(req(admin, 'POST', '/api/admin/afiliados/bonus-geral', { corpo: { bonusX100: 5000 }, chave: 'bonus-geral-2' }));
    expect(deNovo.status).toBe(200);
    expect(await saldo(sem)).toBe(4500);
    const depois = await membro('Entrou Depois');
    expect(await saldo(depois)).toBe(5000);

    const ficha = await json(await getUsuario(req(admin, 'GET', `/api/admin/usuarios/${fulano1.id}`), params({ id: fulano1.id })));
    expect(ficha.data.afiliacao.bonusLinkX100).toBe(4000);
    expect(ficha.data.afiliacao.bonusGeralX100).toBe(5000);
    expect(ficha.data.bonusSaque.recebidoX100).toBe(5000);

    const alto = await postBonusLink(req(admin, 'POST', `/api/admin/usuarios/${fulano1.id}/bonus-link`, { corpo: { bonusX100: 200_000 }, chave: 'bonus-link-alto' }), params({ id: fulano1.id }));
    expect(alto.status).toBe(400);
  });
});

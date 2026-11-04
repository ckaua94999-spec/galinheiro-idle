// Painel administrador: acesso, gestão de usuários, atendimento, popups e gráficos (rotas chamadas direto).
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Rng } from '@galinheiro/game-core';
import { criarBancoEmMemoria, usarBancoNosTestes, type Banco } from '@/server/db/banco';
import { cadastrarMembro } from '@/server/auth/contas';
import { COOKIE_SESSAO, emitirToken } from '@/server/auth/sessao';
import { GET as getState } from '@/app/api/v1/state/route';
import { POST as postEntrar } from '@/app/api/v1/auth/entrar/route';
import { GET as getAvisos } from '@/app/api/v1/avisos/route';
import { POST as postVisto } from '@/app/api/v1/avisos/[id]/visto/route';
import { POST as postClique } from '@/app/api/v1/avisos/[id]/clique/route';
import { GET as getSuporte, POST as postSuporte } from '@/app/api/v1/suporte/route';
import { GET as getResumo } from '@/app/api/admin/resumo/route';
import { GET as getGraficos } from '@/app/api/admin/graficos/route';
import { GET as getUsuarios } from '@/app/api/admin/usuarios/route';
import { GET as getUsuario, PATCH as patchUsuario } from '@/app/api/admin/usuarios/[id]/route';
import { POST as postBloquear } from '@/app/api/admin/usuarios/[id]/bloquear/route';
import { POST as postDesbloquear } from '@/app/api/admin/usuarios/[id]/desbloquear/route';
import { POST as postSaldo } from '@/app/api/admin/usuarios/[id]/saldo/route';
import { POST as postAnimal } from '@/app/api/admin/usuarios/[id]/animais/route';
import { GET as getConversas } from '@/app/api/admin/suporte/route';
import { GET as getConversa } from '@/app/api/admin/suporte/[id]/route';
import { POST as postResposta } from '@/app/api/admin/suporte/[id]/mensagens/route';
import { GET as getPopups, POST as postPopup } from '@/app/api/admin/popups/route';
import { GET as getAuditoria } from '@/app/api/admin/auditoria/route';

let banco: Banco;
const rng: Rng = { int: (n) => Math.floor(Math.random() * n) };
interface Membro { id: string; cookie: string; email: string }
let admin: Membro;
let ana: Membro;
let bia: Membro;

let seq = 0;
async function membro(nome: string): Promise<Membro> {
  seq++;
  const email = `${nome.toLowerCase().replace(/\s/g, '')}${seq}@exemplo.com`;
  const m = await cadastrarMembro(
    banco,
    { nome, telefone: `+55219${String(70_000_000 + seq).padStart(8, '0')}`, email, senha: 'senha-forte-123' },
    Date.now(),
    rng,
  );
  return { id: m.contaId, cookie: `${COOKIE_SESSAO}=${await emitirToken(m.contaId, m.versao)}`, email };
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

beforeAll(async () => {
  banco = await criarBancoEmMemoria();
  usarBancoNosTestes(banco);
  admin = await membro('Chefe Admin');
  ana = await membro('Ana Lima');
  bia = await membro('Bia Rocha');
  await banco.q(`update contas set papel = 'admin' where id = $1`, [admin.id]);
});
afterAll(async () => {
  await banco.fechar();
});

describe('acesso ao painel', () => {
  it('jogador comum recebe 403; admin recebe o resumo; ADMIN_EMAILS também libera', async () => {
    expect((await getResumo(req(ana, 'GET', '/api/admin/resumo'))).status).toBe(403);
    expect((await getResumo(req(null, 'GET', '/api/admin/resumo'))).status).toBe(401);
    const r = await json(await getResumo(req(admin, 'GET', '/api/admin/resumo')));
    expect(r.data.pessoas.membros).toBe(3);
    expect(r.data.economia.animaisAtivos.galinha).toBe(3);
    process.env.ADMIN_EMAILS = ` ${bia.email.toUpperCase()} `;
    try {
      expect((await getResumo(req(bia, 'GET', '/api/admin/resumo'))).status).toBe(200);
      const estado = await json(await getState(req(bia, 'GET', '/api/v1/state')));
      expect(estado.data.conta.admin).toBe(true);
    } finally {
      delete process.env.ADMIN_EMAILS;
    }
  });
});

describe('gestão de usuários', () => {
  it('busca por nome e telefone, abre a ficha e edita', async () => {
    const lista = await json(await getUsuarios(req(admin, 'GET', '/api/admin/usuarios?q=ana')));
    expect(lista.data.itens.map((u: { nome: string }) => u.nome)).toEqual(['Ana Lima']);
    const tel = await json(await getUsuarios(req(admin, 'GET', `/api/admin/usuarios?q=${encodeURIComponent('(21) 9')}`)));
    expect(tel.data.total).toBe(3);
    // vários de uma vez, por id (nomes dos membros escolhidos num popup); id inválido é recusado
    const porIds = await json(await getUsuarios(req(admin, 'GET', `/api/admin/usuarios?ids=${ana.id},${bia.id}&ordenar=nome`)));
    expect(porIds.data.itens.map((u: { id: string }) => u.id)).toEqual([ana.id, bia.id]);
    expect((await getUsuarios(req(admin, 'GET', '/api/admin/usuarios?ids=abc'))).status).toBe(400);
    const ficha = await json(await getUsuario(req(admin, 'GET', `/api/admin/usuarios/${ana.id}`), params({ id: ana.id })));
    expect(ficha.data.usuario).toMatchObject({ nome: 'Ana Lima', papel: 'jogador', bloqueado: false, nivel: 1, animaisAtivos: 1 });
    expect(ficha.data.jogo.entidades).toHaveLength(1);
    const ed = await json(await patchUsuario(req(admin, 'PATCH', `/api/admin/usuarios/${ana.id}`, { corpo: { nome: 'Ana Lima Souza' } }), params({ id: ana.id })));
    expect(ed.data.nome).toBe('Ana Lima Souza');
    const repetido = await patchUsuario(req(admin, 'PATCH', `/api/admin/usuarios/${ana.id}`, { corpo: { email: bia.email } }), params({ id: ana.id }));
    expect((await json(repetido)).error?.code).toBe('EMAIL_EM_USO');
    const naoExiste = await getUsuario(req(admin, 'GET', '/api/admin/usuarios/xyz'), params({ id: 'xyz' }));
    expect(naoExiste.status).toBe(404);
  });

  it('ajuste de saldo é idempotente e não deixa o saldo negativo', async () => {
    const corpo = { valorX100: 10_000, motivo: 'Compensação de teste' };
    const a = await json(await postSaldo(req(admin, 'POST', `/api/admin/usuarios/${ana.id}/saldo`, { corpo, chave: 'ajuste-0001' }), params({ id: ana.id })));
    const b = await json(await postSaldo(req(admin, 'POST', `/api/admin/usuarios/${ana.id}/saldo`, { corpo, chave: 'ajuste-0001' }), params({ id: ana.id })));
    expect(a.data.saldoX100).toBe(15_000);
    expect(b.data.saldoX100).toBe(15_000);
    const negativo = await postSaldo(
      req(admin, 'POST', `/api/admin/usuarios/${ana.id}/saldo`, { corpo: { valorX100: -999_999, motivo: 'Teste' }, chave: 'ajuste-0002' }),
      params({ id: ana.id }),
    );
    expect((await json(negativo)).error?.code).toBe('SALDO_INSUFICIENTE');
    const animal = await json(
      await postAnimal(req(admin, 'POST', `/api/admin/usuarios/${ana.id}/animais`, { corpo: { tipo: 'avestruz', motivo: 'Prêmio' }, chave: 'animal-0001' }), params({ id: ana.id })),
    );
    expect(typeof animal.data.entityId).toBe('string');
    const aud = await json(await getAuditoria(req(admin, 'GET', '/api/admin/auditoria')));
    expect(aud.data.itens.map((x: { acao: string }) => x.acao)).toEqual(expect.arrayContaining(['ajustar_saldo', 'dar_animal', 'editar_usuario']));
  });

  it('bloquear derruba a sessão e o login mostra o motivo; desbloquear devolve o acesso', async () => {
    const r = await postBloquear(req(admin, 'POST', `/api/admin/usuarios/${bia.id}/bloquear`, { corpo: { motivo: 'Comportamento abusivo' } }), params({ id: bia.id }));
    expect(r.status).toBe(200);
    expect((await getState(req(bia, 'GET', '/api/v1/state'))).status).toBe(401);
    const login = await json(await postEntrar(req(null, 'POST', '/api/v1/auth/entrar', { corpo: { email: bia.email, senha: 'senha-forte-123' } })));
    expect(login.error).toMatchObject({ code: 'CONTA_BLOQUEADA', message: 'Sua conta está bloqueada: Comportamento abusivo' });
    const proprio = await postBloquear(req(admin, 'POST', `/api/admin/usuarios/${admin.id}/bloquear`, { corpo: { motivo: 'teste' } }), params({ id: admin.id }));
    expect((await json(proprio)).error?.code).toBe('ACESSO_NEGADO');
    await postDesbloquear(req(admin, 'POST', `/api/admin/usuarios/${bia.id}/desbloquear`), params({ id: bia.id }));
    const de = await postEntrar(req(null, 'POST', '/api/v1/auth/entrar', { corpo: { email: bia.email, senha: 'senha-forte-123' } }));
    expect(de.status).toBe(200);
    // o bloqueio derrubou a sessão antiga: segue com o cookie do novo login
    bia.cookie = de.headers.get('set-cookie')!.split(';')[0]!;
    expect((await getState(req(bia, 'GET', '/api/v1/state'))).status).toBe(200);
  });
});

describe('atendimento', () => {
  it('jogador escreve, equipe lê e responde, jogador vê a resposta e o contador zera', async () => {
    const enviado = await json(await postSuporte(req(ana, 'POST', '/api/v1/suporte', { corpo: { texto: 'Meus ovos sumiram!' } })));
    expect(enviado.data.mensagens.map((m: { autor: string }) => m.autor)).toEqual(['jogador', 'sistema']);
    const fila = await json(await getConversas(req(admin, 'GET', '/api/admin/suporte')));
    expect(fila.data.naoLidasTotal).toBe(1);
    const conversaId = fila.data.itens[0].id as string;
    expect(fila.data.itens[0]).toMatchObject({ nome: 'Ana Lima Souza', naoLidas: 1, ultimaMensagem: expect.any(String) });
    await getConversa(req(admin, 'GET', `/api/admin/suporte/${conversaId}`), params({ id: conversaId }));
    expect((await json(await getConversas(req(admin, 'GET', '/api/admin/suporte')))).data.naoLidasTotal).toBe(0);
    await postResposta(req(admin, 'POST', `/api/admin/suporte/${conversaId}/mensagens`, { corpo: { texto: 'Já devolvemos, confira!' } }), params({ id: conversaId }));
    expect((await json(await getAvisos(req(ana, 'GET', '/api/v1/avisos')))).data.suporteNaoLidas).toBe(1);
    const conversa = await json(await getSuporte(req(ana, 'GET', '/api/v1/suporte')));
    expect(conversa.data.mensagens.at(-1)).toMatchObject({ autor: 'admin', texto: 'Já devolvemos, confira!', adminNome: 'Chefe Admin' });
    expect((await json(await getAvisos(req(ana, 'GET', '/api/v1/avisos')))).data.suporteNaoLidas).toBe(0);
    const outro = await getConversa(req(ana, 'GET', `/api/admin/suporte/${conversaId}`), params({ id: conversaId }));
    expect(outro.status).toBe(403);
  });
});

describe('popups', () => {
  it('"uma vez" aparece até ser visto; público por contas só para quem foi escolhido; cliques entram na estatística', async () => {
    const todos = await json(await postPopup(req(admin, 'POST', '/api/admin/popups', {
      corpo: { titulo: 'Festa da colheita', mensagem: 'Ovos valem mais hoje!', botaoTexto: 'Ver loja', link: '/loja' },
    })));
    expect(todos.data).toMatchObject({ publico: 'todos', frequencia: 'uma_vez', ativo: true, link: '/loja' });
    const soAna = await json(await postPopup(req(admin, 'POST', '/api/admin/popups', {
      corpo: { titulo: 'Só para você', mensagem: 'Presente especial', publico: 'contas', contas: [ana.id], link: 'https://exemplo.com/promo' },
    })));
    const linkRuim = await postPopup(req(admin, 'POST', '/api/admin/popups', { corpo: { titulo: 'x', mensagem: 'y', link: 'javascript:alert(1)' } }));
    expect(linkRuim.status).toBe(400);

    const titulosAna = (await json(await getAvisos(req(ana, 'GET', '/api/v1/avisos')))).data.popups.map((p: { titulo: string }) => p.titulo);
    expect(titulosAna).toEqual(expect.arrayContaining(['Festa da colheita', 'Só para você']));
    const titulosBia = (await json(await getAvisos(req(bia, 'GET', '/api/v1/avisos')))).data.popups.map((p: { titulo: string }) => p.titulo);
    expect(titulosBia).toEqual(['Festa da colheita']);

    const id = todos.data.id as string;
    await postVisto(req(ana, 'POST', `/api/v1/avisos/${id}/visto`), params({ id }));
    await postClique(req(ana, 'POST', `/api/v1/avisos/${id}/clique`), params({ id }));
    const depois = (await json(await getAvisos(req(ana, 'GET', '/api/v1/avisos')))).data.popups.map((p: { id: string }) => p.id);
    expect(depois).toEqual([soAna.data.id]);
    const lista = await json(await getPopups(req(admin, 'GET', '/api/admin/popups')));
    expect(lista.data.find((p: { id: string }) => p.id === id).estatisticas).toEqual({ pessoas: 1, exibicoes: 1, cliques: 1 });
  });
});

describe('gráficos e projeções', () => {
  it('séries diárias completas e projeções do tamanho pedido', async () => {
    const g = await json(await getGraficos(req(admin, 'GET', '/api/admin/graficos?dias=14&projecao=10')));
    expect(g.data.pessoas.novos).toHaveLength(14);
    expect(g.data.pessoas.total.at(-1).valor).toBe(3);
    expect(g.data.pessoas.projecaoTotal).toHaveLength(10);
    expect(g.data.ovos.projecaoPotencial).toHaveLength(10);
    expect(g.data.ovos.projecaoPotencial.reduce((s: number, p: { valor: number }) => s + p.valor, 0)).toBeGreaterThan(0);
    expect(g.data.moedas.circulacaoX100.at(-1).valor).toBe(5_000 * 3 + 10_000);
    expect(g.data.moedas.projecaoCirculacaoX100).toHaveLength(10);
  });
});

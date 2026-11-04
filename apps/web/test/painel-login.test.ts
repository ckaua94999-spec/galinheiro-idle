// Login próprio do painel: usuário e senha do ambiente (só o hash), cookie próprio, sessão que cai quando a senha
// muda, ações do painel assinadas pela conta "operador" e a conta do jogo com papel de admin ainda valendo.
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Rng } from '@galinheiro/game-core';
import { criarBancoEmMemoria, usarBancoNosTestes, type Banco } from '@/server/db/banco';
import { cadastrarMembro } from '@/server/auth/contas';
import { COOKIE_SESSAO, emitirToken } from '@/server/auth/sessao';
import { gerarHash } from '@/server/auth/senha';
import { COOKIE_PAINEL } from '@/server/admin/login';
import { POST as postEntrar } from '@/app/api/admin/auth/entrar/route';
import { POST as postSair } from '@/app/api/admin/auth/sair/route';
import { GET as getSessao } from '@/app/api/admin/auth/sessao/route';
import { GET as getResumo } from '@/app/api/admin/resumo/route';
import { POST as postSaldo } from '@/app/api/admin/usuarios/[id]/saldo/route';
import { POST as postResposta } from '@/app/api/admin/suporte/[id]/mensagens/route';
import { GET as getSuporte, POST as postSuporte } from '@/app/api/v1/suporte/route';
import { GET as getState } from '@/app/api/v1/state/route';

let banco: Banco;
const rng: Rng = { int: (n) => Math.floor(Math.random() * n) };
let jogador: { id: string; cookie: string };
let painel = '';

function req(cookie: string | null, metodo: string, caminho: string, opcoes: { corpo?: unknown; chave?: boolean } = {}): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (cookie) headers.set('cookie', cookie);
  if (opcoes.chave) headers.set('idempotency-key', crypto.randomUUID());
  return new NextRequest(`http://localhost${caminho}`, {
    method: metodo,
    headers,
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });
}
const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });
const json = async (r: Response) => (await r.json()) as { ok: boolean; data: any; error?: { code: string; message: string } };
const entrar = (usuario: string, senha: string) => postEntrar(req(null, 'POST', '/api/admin/auth/entrar', { corpo: { usuario, senha } }));

beforeAll(async () => {
  banco = await criarBancoEmMemoria();
  usarBancoNosTestes(banco);
  process.env.ADMIN_USUARIO = 'Chefe.Painel';
  // com ":" no lugar de "$", como sai do script senha-admin (o .env expandiria "$")
  process.env.ADMIN_SENHA_HASH = (await gerarHash('senha-do-painel-123')).replace(/\$/g, ':');
  const m = await cadastrarMembro(
    banco,
    { nome: 'Jogador Painel', telefone: '+5551987650001', email: 'jogador.painel@exemplo.com', senha: 'senha-forte-123' },
    Date.now(),
    rng,
  );
  jogador = { id: m.contaId, cookie: `${COOKIE_SESSAO}=${await emitirToken(m.contaId, m.versao)}` };
});
afterAll(async () => {
  delete process.env.ADMIN_USUARIO;
  delete process.env.ADMIN_SENHA_HASH;
  await banco.fechar();
});

describe('login do painel', () => {
  it('confere usuário e senha do ambiente e abre a sessão do painel (cookie próprio, Strict, 12 h)', async () => {
    expect((await json(await getSessao(req(null, 'GET', '/api/admin/auth/sessao')))).data).toEqual({
      autenticado: false, configurado: true, via: null, nome: null, usuario: null,
    });
    const errada = await entrar('chefe.painel', 'senha-errada-1');
    expect(errada.status).toBe(401);
    expect((await json(errada)).error).toMatchObject({ code: 'CREDENCIAIS_INVALIDAS', message: 'Usuário ou senha incorretos.' });
    expect((await entrar('outro.usuario', 'senha-do-painel-123')).status).toBe(401);

    const ok = await entrar(' CHEFE.painel ', 'senha-do-painel-123');
    expect(ok.status).toBe(200);
    const setCookie = ok.headers.get('set-cookie') ?? '';
    expect(setCookie.startsWith(`${COOKIE_PAINEL}=`)).toBe(true);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    expect(setCookie).toMatch(/Max-Age=43200/);
    painel = setCookie.split(';')[0]!;

    expect((await json(await getSessao(req(painel, 'GET', '/api/admin/auth/sessao')))).data).toMatchObject({
      autenticado: true, via: 'painel', usuario: 'chefe.painel', nome: 'Equipe Galinheiro',
    });
    const resumo = await json(await getResumo(req(painel, 'GET', '/api/admin/resumo')));
    expect(resumo.data.pessoas.membros).toBe(1); // o operador não é membro
    // o token do painel não abre o jogo (nem posto no cookie do jogo)
    expect((await getState(req(`${COOKIE_SESSAO}=${painel.split('=')[1]}`, 'GET', '/api/v1/state'))).status).toBe(401);
  });

  it('assina as ações do painel: auditoria, idempotência e atendimento com o nome da equipe', async () => {
    const saldo = await postSaldo(
      req(painel, 'POST', `/api/admin/usuarios/${jogador.id}/saldo`, { corpo: { valorX100: 500, motivo: 'teste do login do painel' }, chave: true }),
      params({ id: jogador.id }),
    );
    expect(saldo.status).toBe(200);
    const aud = await banco.um<{ tipo: string; usuario: string }>(
      'select c.tipo, c.usuario from admin_acoes a join contas c on c.id = a.admin_id order by a.id desc limit 1',
    );
    expect(aud).toEqual({ tipo: 'operador', usuario: 'chefe.painel' });

    await postSuporte(req(jogador.cookie, 'POST', '/api/v1/suporte', { corpo: { texto: 'Olá, equipe!' } }));
    const conversa = await banco.um<{ id: string }>('select id from suporte_conversas where conta_id = $1', [jogador.id]);
    expect((await postResposta(req(painel, 'POST', `/api/admin/suporte/${conversa!.id}/mensagens`, { corpo: { texto: 'Oi! Aqui é a equipe.' } }), params({ id: conversa!.id }))).status).toBe(200);
    const vista = await json(await getSuporte(req(jogador.cookie, 'GET', '/api/v1/suporte')));
    expect(vista.data.mensagens.at(-1)).toMatchObject({ autor: 'admin', texto: 'Oi! Aqui é a equipe.', adminNome: 'Equipe Galinheiro' });
  });

  it('a sessão cai quando a senha muda no ambiente e volta com a senha antiga; sair apaga o cookie', async () => {
    const hash = process.env.ADMIN_SENHA_HASH;
    process.env.ADMIN_SENHA_HASH = (await gerarHash('outra-senha-456')).replace(/\$/g, ':');
    expect((await getResumo(req(painel, 'GET', '/api/admin/resumo'))).status).toBe(401);
    process.env.ADMIN_SENHA_HASH = hash;
    expect((await getResumo(req(painel, 'GET', '/api/admin/resumo'))).status).toBe(200);
    const saida = await postSair(req(painel, 'POST', '/api/admin/auth/sair'));
    expect(saida.headers.get('set-cookie')).toMatch(new RegExp(`^${COOKIE_PAINEL}=;.*Max-Age=0`));
  });

  it('sem o login do painel: jogador comum 403, sem sessão 401; a conta do jogo com papel de admin continua entrando', async () => {
    expect((await getResumo(req(jogador.cookie, 'GET', '/api/admin/resumo'))).status).toBe(403);
    expect((await getResumo(req(null, 'GET', '/api/admin/resumo'))).status).toBe(401);
    await banco.q(`update contas set papel = 'admin' where id = $1`, [jogador.id]);
    expect((await getResumo(req(jogador.cookie, 'GET', '/api/admin/resumo'))).status).toBe(200);
    expect((await json(await getSessao(req(jogador.cookie, 'GET', '/api/admin/auth/sessao')))).data).toMatchObject({ autenticado: true, via: 'jogo' });
  });
});

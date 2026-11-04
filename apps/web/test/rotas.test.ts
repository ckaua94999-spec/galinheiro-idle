// Testes da camada HTTP chamando os handlers das rotas diretamente.
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Rng } from '@galinheiro/game-core';
import { criarBancoEmMemoria, usarBancoNosTestes, type Banco } from '@/server/db/banco';
import { cadastrarMembro } from '@/server/auth/contas';
import { COOKIE_SESSAO, emitirToken } from '@/server/auth/sessao';
import { GET as getState } from '@/app/api/v1/state/route';
import { POST as postCollect } from '@/app/api/v1/collect/route';
import { POST as postSpin } from '@/app/api/v1/spin/route';
import { POST as postCadastrar } from '@/app/api/v1/auth/cadastrar/route';
import { GET as getEntity, PATCH as patchEntity } from '@/app/api/v1/entities/[id]/route';
import { GET as getConfig } from '@/app/api/v1/config/route';

let banco: Banco;
let cookie = '';
const rng: Rng = { int: (n) => Math.floor(Math.random() * n) };

function req(metodo: string, caminho: string, opcoes: { corpo?: unknown; chave?: string; semCookie?: boolean } = {}): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (!opcoes.semCookie) headers.set('cookie', cookie);
  if (opcoes.chave) headers.set('idempotency-key', opcoes.chave);
  return new NextRequest(`http://localhost${caminho}`, {
    method: metodo,
    headers,
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });
}
const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });

beforeAll(async () => {
  banco = await criarBancoEmMemoria();
  usarBancoNosTestes(banco);
  const { contaId, versao } = await cadastrarMembro(
    banco,
    { nome: 'Rita Teste', telefone: '+5531991234567', email: 'rita@exemplo.com', senha: 'senha-forte-123' },
    Date.now(),
    rng,
  );
  cookie = `${COOKIE_SESSAO}=${await emitirToken(contaId, versao)}`;
});
afterAll(async () => {
  await banco.fechar();
});

describe('rotas /api/v1', () => {
  it('sem sessão: 401 com envelope de erro', async () => {
    const r = await getState(req('GET', '/api/v1/state', { semCookie: true }));
    expect(r.status).toBe(401);
    const corpo = await r.json();
    expect(corpo).toMatchObject({ ok: false, error: { code: 'NAO_AUTENTICADO' } });
    expect(typeof corpo.serverTime).toBe('string');
  });

  it('GET /state devolve envelope, ETag e versão de config', async () => {
    const r = await getState(req('GET', '/api/v1/state'));
    expect(r.status).toBe(200);
    expect(r.headers.get('etag')).toMatch(/^"v\d+"$/);
    expect(r.headers.get('x-config-version')).toBe('1.0.3');
    const corpo = await r.json();
    expect(corpo.ok).toBe(true);
    expect(corpo.data.entidades).toHaveLength(1);
    expect(corpo.data.entidades[0]).not.toHaveProperty('ovosPendentes'); // segredo até a coleta
  });

  it('mutação sem Idempotency-Key: 400', async () => {
    const r = await postSpin(req('POST', '/api/v1/spin'));
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('IDEMPOTENCY_KEY_AUSENTE');
  });

  it('repetir a mesma chave devolve a resposta original (sem girar 2x)', async () => {
    const jogador = await banco.um<{ id: string }>('select id from players limit 1');
    await banco.q(
      `insert into roleta_pix (player_id, centavos, status, id_transacao, copia_cola, qr_data_url, idempotencia, criado_em, atualizado_em, expira_em)
       values ($1, 5500, 'pago', 'tx-rota-1', '000201', '', 'idem-rota-1', now(), now(), now() + interval '1 hour')`,
      [jogador!.id],
    );
    const r1 = await postSpin(req('POST', '/api/v1/spin', { chave: 'giro-chave-0001' }));
    const r2 = await postSpin(req('POST', '/api/v1/spin', { chave: 'giro-chave-0001' }));
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r2.headers.get('idempotent-replayed')).toBe('true');
    const [c1, c2] = [await r1.json(), await r2.json()];
    expect(c2.data.giro.id).toBe(c1.data.giro.id);
    const giros = await banco.um<{ n: number }>('select count(*)::int as n from spins');
    expect(giros?.n).toBe(1);
  });

  it('mesma chave com corpo diferente: 409 IDEMPOTENCY_CONFLITO', async () => {
    const estado = await (await getState(req('GET', '/api/v1/state'))).json();
    const [a, b] = estado.data.entidades;
    await postCollect(req('POST', '/api/v1/collect', { chave: 'coleta-chave-01', corpo: { entityId: a.id } }));
    const r = await postCollect(req('POST', '/api/v1/collect', { chave: 'coleta-chave-01', corpo: { entityId: b.id } }));
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe('IDEMPOTENCY_CONFLITO');
  });

  it('coletas concorrentes do mesmo animal: só uma credita', async () => {
    const estado = await (await getState(req('GET', '/api/v1/state'))).json();
    const pronto = estado.data.entidades.find((e: { pronto: boolean }) => e.pronto);
    expect(pronto).toBeTruthy();
    const respostas = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        postCollect(req('POST', '/api/v1/collect', { chave: `concorrente-${i}-xx`, corpo: { entityId: pronto.id } }))),
    );
    const status = respostas.map((r) => r.status).sort();
    expect(status).toEqual([200, 409, 409, 409, 409]);
    const codigos = await Promise.all(respostas.filter((r) => r.status === 409).map(async (r) => (await r.json()).error.code));
    expect(new Set(codigos)).toEqual(new Set(['RENDIMENTO_NAO_PRONTO']));
  });

  it('payload inválido: 400 PAYLOAD_INVALIDO com os campos', async () => {
    const r = await postCollect(req('POST', '/api/v1/collect', { chave: 'invalido-0001', corpo: { entityId: 'nao-e-uuid' } }));
    expect(r.status).toBe(400);
    const corpo = await r.json();
    expect(corpo.error.code).toBe('PAYLOAD_INVALIDO');
    expect(corpo.error.details.issues[0].caminho).toBe('entityId');
  });

  it('GET e PATCH /entities/[id]', async () => {
    const estado = await (await getState(req('GET', '/api/v1/state'))).json();
    const id = estado.data.entidades[0].id;
    const det = await (await getEntity(req('GET', `/api/v1/entities/${id}`), params({ id }))).json();
    expect(det.data.info.idadeDias).toBe(0);
    const ren = await patchEntity(req('PATCH', `/api/v1/entities/${id}`, { chave: 'renomear-0001', corpo: { nome: 'Galinácea' } }), params({ id }));
    expect((await ren.json()).data.nome).toBe('Galinácea');
    const naoAchou = await getEntity(req('GET', '/api/v1/entities/xyz'), params({ id: 'xyz' }));
    expect(naoAchou.status).toBe(404);
  });

  it('cadastro: cria membro com cookie httpOnly e código de recuperação; recusa telefone repetido ou inválido', async () => {
    const corpo = { nome: '  João   da Silva ', telefone: '(41) 99876-5432', email: 'Joao@Exemplo.com', senha: 'senha-forte-123' };
    const nova = await postCadastrar(req('POST', '/api/v1/auth/cadastrar', { semCookie: true, corpo }));
    expect(nova.status).toBe(201);
    expect(nova.headers.get('set-cookie')).toMatch(/gi_sessao=.+HttpOnly/);
    const dados = (await nova.json()).data;
    expect(dados.conta).toEqual({ nome: 'João da Silva', telefone: '+5541998765432', email: 'joao@exemplo.com', admin: false });
    expect(dados.codigoRecuperacao).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const repetido = await postCadastrar(req('POST', '/api/v1/auth/cadastrar', { semCookie: true, corpo: { ...corpo, email: 'outro@exemplo.com' } }));
    expect(repetido.status).toBe(409);
    expect((await repetido.json()).error.code).toBe('TELEFONE_EM_USO');

    const invalido = await postCadastrar(req('POST', '/api/v1/auth/cadastrar', { semCookie: true, corpo: { ...corpo, telefone: '12345' } }));
    expect(invalido.status).toBe(400);
    const erro = (await invalido.json()).error;
    expect(erro.code).toBe('PAYLOAD_INVALIDO');
    expect(erro.details.issues[0]).toMatchObject({ caminho: 'telefone', mensagem: expect.stringContaining('Telefone inválido') });
  });

  it('sessão de convidado antiga não vale mais (401)', async () => {
    const antiga = (await banco.um<{ id: string; sessao_versao: number }>(`insert into contas (tipo) values ('convidado') returning id, sessao_versao`))!;
    const r = await getState(
      new NextRequest('http://localhost/api/v1/state', { headers: { cookie: `${COOKIE_SESSAO}=${await emitirToken(antiga.id, antiga.sessao_versao)}` } }),
    );
    expect(r.status).toBe(401);
  });

  it('config pública traz chances e chave VAPID', async () => {
    const corpo = await (await getConfig(req('GET', '/api/v1/config', { semCookie: true }))).json();
    expect(corpo.data.roleta.chances.map((c: { pct: number }) => c.pct)).toEqual([60, 25, 12, 3]);
    expect(typeof corpo.data.push.vapidPublicKey).toBe('string');
  });
});

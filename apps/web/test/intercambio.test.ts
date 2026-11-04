// Intercâmbio (tickets → ovos ou animais) e cupons: resgate, trocas, compra com moedas do jogo e a regra
// "sem lucro", limite diário, painel (ofertas, cupons, ajuste na ficha) e o extrato dos tickets.
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Rng } from '@galinheiro/game-core';
import { criarBancoEmMemoria, usarBancoNosTestes, type Banco } from '@/server/db/banco';
import { cadastrarMembro } from '@/server/auth/contas';
import { COOKIE_SESSAO, emitirToken } from '@/server/auth/sessao';
import { GET as getIntercambio } from '@/app/api/v1/intercambio/route';
import { POST as postComprar } from '@/app/api/v1/intercambio/comprar/route';
import { POST as postTrocar } from '@/app/api/v1/intercambio/trocar/route';
import { POST as postResgatar } from '@/app/api/v1/cupons/resgatar/route';
import { GET as getPainel, PUT as putPainel } from '@/app/api/admin/intercambio/route';
import { POST as postOferta } from '@/app/api/admin/intercambio/ofertas/route';
import { DELETE as deleteOferta, PATCH as patchOferta } from '@/app/api/admin/intercambio/ofertas/[id]/route';
import { GET as getCupons, POST as postCupom } from '@/app/api/admin/cupons/route';
import { GET as getCupom, PATCH as patchCupom } from '@/app/api/admin/cupons/[id]/route';
import { POST as postAjusteTickets } from '@/app/api/admin/usuarios/[id]/tickets/route';
import { GET as getUsuario } from '@/app/api/admin/usuarios/[id]/route';
import { PUT as putAfiliados } from '@/app/api/admin/afiliados/config/route';

let banco: Banco;
const rng: Rng = { int: (n) => Math.floor(Math.random() * n) };
interface Membro { id: string; cookie: string }
let admin: Membro;

let seq = 0;
async function membro(nome: string): Promise<Membro> {
  seq++;
  const m = await cadastrarMembro(
    banco,
    { nome, telefone: `+55419${String(60_000_000 + seq).padStart(8, '0')}`, email: `troca${seq}@exemplo.com`, senha: 'senha-forte-123' },
    Date.now(),
    rng,
  );
  return { id: m.contaId, cookie: `${COOKIE_SESSAO}=${await emitirToken(m.contaId, m.versao)}` };
}

function req(quem: Membro | null, metodo: string, caminho: string, opcoes: { corpo?: unknown; chave?: boolean } = {}): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (quem) headers.set('cookie', quem.cookie);
  if (opcoes.chave) headers.set('idempotency-key', crypto.randomUUID());
  return new NextRequest(`http://localhost${caminho}`, {
    method: metodo,
    headers,
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });
}
const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });
const json = async (r: Response) => (await r.json()) as { ok: boolean; data: any; error?: { code: string; message: string } };
const erro = async (r: Response) => (await json(r)).error?.code;
const resgatar = (m: Membro, codigo: string) => postResgatar(req(m, 'POST', '/api/v1/cupons/resgatar', { corpo: { codigo }, chave: true }));
const trocar = (m: Membro, ofertaId: string) => postTrocar(req(m, 'POST', '/api/v1/intercambio/trocar', { corpo: { ofertaId }, chave: true }));
const comprar = (m: Membro, quantidade: number) => postComprar(req(m, 'POST', '/api/v1/intercambio/comprar', { corpo: { quantidade }, chave: true }));
const config = (corpo: Record<string, unknown>) =>
  putPainel(req(admin, 'PUT', '/api/admin/intercambio', { corpo: { ativo: true, compraAtiva: false, precoTicketX100: 1000, limiteCompraDia: null, ...corpo } }));
const tickets = async (m: Membro) => Number((await banco.um<{ t: unknown }>('select tickets as t from players where id = $1', [m.id]))!.t);
/** saldo de tickets = soma do extrato de tickets */
async function extratoBate(m: Membro) {
  const r = await banco.um<{ saldo: unknown; soma: unknown }>(
    'select p.tickets as saldo, (select coalesce(sum(delta), 0) from tickets_movimentos where player_id = p.id) as soma from players p where p.id = $1',
    [m.id],
  );
  expect(Number(r!.saldo)).toBe(Number(r!.soma));
}

beforeAll(async () => {
  banco = await criarBancoEmMemoria();
  usarBancoNosTestes(banco);
  admin = await membro('Chefe Trocas');
  await banco.q(`update contas set papel = 'admin' where id = $1`, [admin.id]);
});
afterAll(async () => {
  await banco.fechar();
});

describe('cupons', () => {
  it('dão tickets uma vez por membro, dentro da validade e do limite de usos', async () => {
    const jogador = await membro('Jogador Cupom');
    expect((await postCupom(req(jogador, 'POST', '/api/admin/cupons', { corpo: { codigo: 'PASCOA26', tickets: 10 } }))).status).toBe(403);
    const criado = await json(await postCupom(req(admin, 'POST', '/api/admin/cupons', { corpo: { codigo: 'pascoa-26', tickets: 10, usosMax: 2 } })));
    expect(criado.data).toMatchObject({ codigo: 'PASCOA26', tickets: 10, usosMax: 2, usos: 0, ativo: true });
    expect(await erro(await postCupom(req(admin, 'POST', '/api/admin/cupons', { corpo: { codigo: 'PASCOA26', tickets: 1 } })))).toBe('PAYLOAD_INVALIDO');

    const ana = await membro('Ana Cupom');
    const bia = await membro('Bia Cupom');
    const caio = await membro('Caio Cupom');
    const ok = await json(await resgatar(ana, 'pascoa 26'));
    expect(ok.data).toEqual({ codigo: 'PASCOA26', tickets: 10, saldoTickets: 10, giros: 0, saldoGiros: 0 });
    expect(await erro(await resgatar(ana, 'PASCOA26'))).toBe('CUPOM_JA_USADO');
    expect((await resgatar(bia, 'PASCOA26')).status).toBe(200);
    expect(await erro(await resgatar(caio, 'PASCOA26'))).toBe('CUPOM_ESGOTADO');
    expect(await erro(await resgatar(caio, 'NAOEXISTE'))).toBe('CUPOM_INVALIDO');

    // pausado e vencido não valem
    const outro = await json(await postCupom(req(admin, 'POST', '/api/admin/cupons', { corpo: { codigo: 'VERAO', tickets: 3 } })));
    await patchCupom(req(admin, 'PATCH', `/api/admin/cupons/${outro.data.id}`, { corpo: { ativo: false } }), params({ id: outro.data.id }));
    expect(await erro(await resgatar(caio, 'VERAO'))).toBe('CUPOM_INVALIDO');
    const ontem = new Date(Date.now() - 86_400_000).toISOString();
    await patchCupom(req(admin, 'PATCH', `/api/admin/cupons/${outro.data.id}`, { corpo: { ativo: true, inicio: new Date(Date.now() - 2 * 86_400_000).toISOString(), fim: ontem } }), params({ id: outro.data.id }));
    expect(await erro(await resgatar(caio, 'VERAO'))).toBe('CUPOM_INVALIDO');

    const detalhe = await json(await getCupom(req(admin, 'GET', `/api/admin/cupons/${criado.data.id}`), params({ id: criado.data.id })));
    expect(detalhe.data.cupom.usos).toBe(2);
    expect(detalhe.data.resgates.map((r: { contaId: string }) => r.contaId).sort()).toEqual([ana.id, bia.id].sort());
    expect((await json(await getCupons(req(admin, 'GET', '/api/admin/cupons')))).data.length).toBe(2);
    await extratoBate(ana);
  });
});

describe('trocas', () => {
  it('tickets viram ovos no estoque ou um animal no ninho livre; sem tickets ou sem ninho, não troca', async () => {
    const m = await membro('Dona Trocas');
    const tela = await json(await getIntercambio(req(m, 'GET', '/api/v1/intercambio')));
    expect(tela.data).toMatchObject({ tickets: 0, config: { ativo: true, compraAtiva: false }, compradosHoje: 0 });
    const ofertas = tela.data.ofertas as { id: string; tipo: string; item: string | null; quantidade: number | null; animal: string | null; custoTickets: number }[];
    expect(ofertas).toHaveLength(8);
    const ovos = ofertas.find((o) => o.item === 'ovo_galinha')!;
    const galinha = ofertas.find((o) => o.animal === 'galinha')!;
    expect(ovos).toMatchObject({ tipo: 'ovos', quantidade: 7, custoTickets: 1 });
    expect(await erro(await trocar(m, ovos.id))).toBe('TICKETS_INSUFICIENTES');

    expect((await json(await postAjusteTickets(req(admin, 'POST', `/api/admin/usuarios/${m.id}/tickets`, { corpo: { quantidade: 30, motivo: 'teste de trocas' }, chave: true }), params({ id: m.id })))).data).toEqual({ tickets: 30 });
    const r1 = await json(await trocar(m, ovos.id));
    expect(r1.data).toMatchObject({ tickets: 29, entity: null });
    expect(r1.data.inventario.ovo_galinha).toBe(7);

    // nível 1 = 4 ninhos, já com a galinha de boas-vindas: cabem mais 3
    for (let i = 0; i < 3; i++) {
      const r = await json(await trocar(m, galinha.id));
      expect(r.data.entity).toMatchObject({ tipo: 'galinha', origem: 'INTERCAMBIO' });
    }
    expect(await tickets(m)).toBe(14);
    expect(await erro(await trocar(m, galinha.id))).toBe('SEM_NINHO_LIVRE');
    expect(await tickets(m)).toBe(14);
    await extratoBate(m);

    const ficha = await json(await getUsuario(req(admin, 'GET', `/api/admin/usuarios/${m.id}`), params({ id: m.id })));
    expect(ficha.data.tickets.saldo).toBe(14);
    expect(ficha.data.tickets.movimentos.map((x: { motivo: string }) => x.motivo)).toEqual(['troca', 'troca', 'troca', 'troca', 'ajuste']);

    // oferta pausada some da tela e não troca
    await patchOferta(req(admin, 'PATCH', `/api/admin/intercambio/ofertas/${ovos.id}`, { corpo: { ativo: false } }), params({ id: ovos.id }));
    expect((await json(await getIntercambio(req(m, 'GET', '/api/v1/intercambio')))).data.ofertas.some((o: { id: string }) => o.id === ovos.id)).toBe(false);
    expect(await erro(await trocar(m, ovos.id))).toBe('OFERTA_INDISPONIVEL');
    await patchOferta(req(admin, 'PATCH', `/api/admin/intercambio/ofertas/${ovos.id}`, { corpo: { ativo: true } }), params({ id: ovos.id }));

    // intercâmbio fechado
    await config({ ativo: false });
    expect(await erro(await trocar(m, galinha.id))).toBe('INTERCAMBIO_FECHADO');
    await config({ ativo: true });
  });
});

describe('compra de tickets com moedas do jogo', () => {
  it('só com a compra ligada; respeita saldo e limite diário; a regra "sem lucro" vale para ofertas, preço e comissões', async () => {
    const m = await membro('Seu Comprador');
    expect(await erro(await comprar(m, 1))).toBe('COMPRA_DESLIGADA');

    // 9,00 moedas por ticket deixaria "7 ovos de galinha" (8,40 + comissões de 16% = 9,75) lucrativo
    const barrado = await config({ compraAtiva: true, precoTicketX100: 900 });
    expect(barrado.status).toBe(400);
    expect((await json(barrado)).error?.message).toMatch(/nenhuma troca de ovos pode valer mais/);
    expect((await config({ compraAtiva: true, precoTicketX100: 1000, limiteCompraDia: 4 })).status).toBe(200);

    const c1 = await json(await comprar(m, 3));
    expect(c1.data).toMatchObject({ quantidade: 3, custoX100: 3000, tickets: 3, saldoX100: 2000 });
    const t = await banco.um<{ tipo: string; valor_x100: unknown }>(
      `select tipo, valor_x100 from transactions where player_id = $1 order by criado_em desc limit 1`,
      [m.id],
    );
    expect(t).toMatchObject({ tipo: 'COMPRA_TICKET' });
    expect(Number(t!.valor_x100)).toBe(-3000);
    expect(await erro(await comprar(m, 2))).toBe('LIMITE_DIARIO'); // 3 + 2 > 4
    expect((await json(await getIntercambio(req(m, 'GET', '/api/v1/intercambio')))).data.compradosHoje).toBe(3);
    await config({ compraAtiva: true, precoTicketX100: 1000, limiteCompraDia: null });
    expect(await erro(await comprar(m, 3))).toBe('SALDO_INSUFICIENTE'); // sobraram 20,00
    await extratoBate(m);

    // com a compra ligada: oferta nova lucrativa é barrada, e comissões maiores também
    const lucrativa = await postOferta(req(admin, 'POST', '/api/admin/intercambio/ofertas', { corpo: { tipo: 'ovos', item: 'ovo_galinha', quantidade: 9, custoTickets: 1 } }));
    expect(lucrativa.status).toBe(400);
    const ok = await json(await postOferta(req(admin, 'POST', '/api/admin/intercambio/ofertas', { corpo: { tipo: 'animal', animal: 'pato', custoTickets: 7, ativo: false } })));
    expect(ok.data).toMatchObject({ tipo: 'animal', animal: 'pato', custoTickets: 7, ativo: false });
    const afiliados = await putAfiliados(req(admin, 'PUT', '/api/admin/afiliados/config', { corpo: { ativo: true, comissoesBp: [3000], tetoDiarioX100: null } }));
    expect(afiliados.status).toBe(400);
    expect((await deleteOferta(req(admin, 'DELETE', `/api/admin/intercambio/ofertas/${ok.data.id}`), params({ id: ok.data.id }))).status).toBe(200);

    const painel = await json(await getPainel(req(admin, 'GET', '/api/admin/intercambio')));
    expect(painel.data).toMatchObject({ comissaoTotalBp: 1600, config: { compraAtiva: true, precoTicketX100: 1000 } });
    expect(painel.data.estatisticas).toMatchObject({ comprados30d: 3, moedasCompra30dX100: 3000 });
    expect(painel.data.ofertas.find((o: { item: string | null }) => o.item === 'ovo_galinha')).toMatchObject({ valorMercadoX100: 840 });

    const acoes = (await banco.q<{ acao: string }>('select acao from admin_acoes')).map((a) => a.acao);
    for (const a of ['criar_cupom', 'editar_cupom', 'configurar_intercambio', 'criar_oferta', 'editar_oferta', 'excluir_oferta', 'ajustar_tickets']) {
      expect(acoes).toContain(a);
    }
    await config({ compraAtiva: false });
  });
});

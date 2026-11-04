// Painel: Intercâmbio (regras e tabela de ofertas: o que um ticket vale em ovos ou animais) e Cupons (códigos
// que dão tickets). Tudo auditado. Com a compra de tickets ligada, a regra "sem lucro" barra ofertas de ovos que
// valham mais do que custam (contando as comissões de afiliação da venda) — veja ofertasLucrativas().
import type {
  AdminCupomDTO, AdminCupomDetalheDTO, AdminIntercambioDTO, AdminOfertaDTO, ConfigIntercambioDTO, OfertaIntercambioDTO,
} from '@galinheiro/api-contract';
import { NOME_TIPO, tipoDoItem, type Item, type Tipo } from '@galinheiro/game-core';
import type { Consulta } from '../db/banco';
import {
  COLS_OFERTA, comissaoTotalBp, lerConfigIntercambio, movimentarTickets, ofertasLucrativas, paraOfertaDTO, valorMercadoX100,
  type LinhaOferta,
} from '../dominio/intercambio';
import { iso } from '../dominio/linhas';
import { exigirJogador, incrementarVersao } from '../dominio/repo';
import { ErroDominio, ehViolacaoUnica } from '../erros';
import { auditar } from './acesso';
import { MEMBRO } from './painel';

const n = (v: unknown): number => Number(v ?? 0);
const fmtMoedas = (x100: number) => (x100 / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const rotuloOferta = (o: Pick<OfertaIntercambioDTO, 'tipo' | 'item' | 'quantidade' | 'animal'>): string =>
  o.tipo === 'animal' && o.animal
    ? `1 ${NOME_TIPO[o.animal].toLowerCase()}`
    : `${o.quantidade} ${o.quantidade === 1 ? 'ovo' : 'ovos'} de ${o.item ? NOME_TIPO[tipoDoItem(o.item)].toLowerCase() : '?'}`;

/** Barra a mudança se ela deixar alguma oferta de ovos lucrativa (compra ligada). */
async function exigirSemLucro(
  c: Consulta, config: ConfigIntercambioDTO, ofertas: readonly OfertaIntercambioDTO[], comissaoBp?: number,
): Promise<void> {
  const ruins = ofertasLucrativas(config, ofertas, comissaoBp ?? (await comissaoTotalBp(c)));
  if (!ruins.length) return;
  const nomes = ruins.map((r) => {
    const o = ofertas.find((x) => x.id === r.id)!;
    return `${rotuloOferta(o)} (${o.custoTickets} ${o.custoTickets === 1 ? 'ticket' : 'tickets'} = ${fmtMoedas(r.custoX100)} moedas; os ovos rendem ${fmtMoedas(r.valorX100)} com as comissões)`;
  });
  throw new ErroDominio(
    'PAYLOAD_INVALIDO',
    { issues: [{ caminho: 'ofertas', mensagem: `Com a compra ligada, estas trocas dariam lucro: ${nomes.join('; ')}.` }], ofertas: ruins },
    'Com a compra de tickets ligada, nenhuma troca de ovos pode valer mais do que custa. Aumente o custo em tickets ou o preço do ticket, ou diminua a quantidade de ovos.',
  );
}

async function todasOfertas(c: Consulta): Promise<OfertaIntercambioDTO[]> {
  return (await c.q<LinhaOferta>(`select ${COLS_OFERTA} from intercambio_ofertas order by ordem, criado_em`)).map(paraOfertaDTO);
}

/** Regra cruzada para o painel de afiliados: mudar as comissões não pode deixar trocas lucrativas. */
export async function exigirSemLucroComComissao(c: Consulta, comissaoBp: number): Promise<void> {
  await exigirSemLucro(c, await lerConfigIntercambio(c), await todasOfertas(c), comissaoBp);
}

export async function painelIntercambio(c: Consulta, agoraMs: number): Promise<AdminIntercambioDTO> {
  const desde = new Date(agoraMs - 30 * 86_400_000);
  const atualizado = await c.um<{ atualizado_em: Date }>('select atualizado_em from intercambio_config where id = 1');
  const linhas = await c.q<LinhaOferta & { total: unknown; d30: unknown }>(
    `select ${COLS_OFERTA.split(', ').map((col) => `o.${col}`).join(', ')},
            (select count(*) from tickets_movimentos m where m.motivo = 'troca' and m.detalhes ->> 'ofertaId' = o.id::text) as total,
            (select count(*) from tickets_movimentos m
              where m.motivo = 'troca' and m.detalhes ->> 'ofertaId' = o.id::text and m.criado_em >= $1) as d30
       from intercambio_ofertas o order by o.ordem, o.criado_em`,
    [desde],
  );
  const e = (await c.um<Record<string, unknown>>(
    `select (select coalesce(sum(p.tickets), 0) from players p join contas c on c.id = p.id where ${MEMBRO}) as circulacao,
            coalesce(sum(delta) filter (where motivo = 'compra'), 0) as comprados,
            coalesce(sum(delta) filter (where motivo = 'cupom'), 0) as cupons,
            coalesce(sum(delta) filter (where motivo = 'ajuste'), 0) as ajustes,
            coalesce(-sum(delta) filter (where motivo = 'troca'), 0) as trocados,
            (select coalesce(-sum(valor_x100), 0) from transactions where tipo = 'COMPRA_TICKET' and criado_em >= $1) as moedas
       from tickets_movimentos where criado_em >= $1`,
    [desde],
  ))!;
  return {
    config: await lerConfigIntercambio(c),
    configAtualizadaEm: iso(atualizado?.atualizado_em ?? new Date(agoraMs)),
    comissaoTotalBp: await comissaoTotalBp(c),
    ofertas: linhas.map<AdminOfertaDTO>((l) => {
      const o = paraOfertaDTO(l);
      return { ...o, ordem: n(l.ordem), valorMercadoX100: valorMercadoX100(o), trocasTotal: n(l.total), trocas30d: n(l.d30) };
    }),
    estatisticas: {
      ticketsCirculacao: n(e.circulacao),
      comprados30d: n(e.comprados),
      cupons30d: n(e.cupons),
      ajustes30d: n(e.ajustes),
      trocados30d: n(e.trocados),
      moedasCompra30dX100: n(e.moedas),
    },
  };
}

export async function salvarConfigIntercambio(c: Consulta, adminId: string, novo: ConfigIntercambioDTO, agoraMs: number): Promise<ConfigIntercambioDTO> {
  const antes = await lerConfigIntercambio(c);
  await exigirSemLucro(c, novo, await todasOfertas(c));
  await c.q(
    `update intercambio_config set ativo = $1, compra_ativa = $2, preco_ticket_x100 = $3, limite_compra_dia = $4,
            atualizado_em = $5, atualizado_por = $6
      where id = 1`,
    [novo.ativo, novo.compraAtiva, novo.precoTicketX100, novo.limiteCompraDia, new Date(agoraMs), adminId],
  );
  await auditar(c, adminId, 'configurar_intercambio', null, { de: antes, para: novo });
  return lerConfigIntercambio(c);
}

type DadosOferta =
  | { tipo: 'ovos'; item: Item; quantidade: number; custoTickets: number; ativo: boolean }
  | { tipo: 'animal'; animal: Tipo; custoTickets: number; ativo: boolean };

export async function criarOferta(c: Consulta, adminId: string, d: DadosOferta, agoraMs: number): Promise<OfertaIntercambioDTO> {
  const ordem = n((await c.um<{ m: unknown }>('select coalesce(max(ordem), 0) + 1 as m from intercambio_ofertas'))?.m);
  const nova: OfertaIntercambioDTO = {
    id: '(nova)',
    tipo: d.tipo,
    item: d.tipo === 'ovos' ? d.item : null,
    quantidade: d.tipo === 'ovos' ? d.quantidade : null,
    animal: d.tipo === 'animal' ? d.animal : null,
    custoTickets: d.custoTickets,
    ativo: d.ativo,
  };
  await exigirSemLucro(c, await lerConfigIntercambio(c), [...(await todasOfertas(c)), nova]);
  const l = (await c.um<LinhaOferta>(
    `insert into intercambio_ofertas (tipo, item, quantidade, animal, custo_tickets, ativo, ordem, criado_em, atualizado_em)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $8) returning ${COLS_OFERTA}`,
    [nova.tipo, nova.item, nova.quantidade, nova.animal, nova.custoTickets, nova.ativo, ordem, new Date(agoraMs)],
  ))!;
  const criada = paraOfertaDTO(l);
  await auditar(c, adminId, 'criar_oferta', null, { ofertaId: criada.id, oferta: rotuloOferta(criada), custoTickets: criada.custoTickets });
  return criada;
}

export async function editarOferta(
  c: Consulta, adminId: string, id: string,
  d: { item?: Item; quantidade?: number; animal?: Tipo; custoTickets?: number; ativo?: boolean; ordem?: number },
  agoraMs: number,
): Promise<OfertaIntercambioDTO> {
  const l = await c.um<LinhaOferta>(`select ${COLS_OFERTA} from intercambio_ofertas where id = $1 for update`, [id]);
  if (!l) throw new ErroDominio('NAO_ENCONTRADO', undefined, 'Oferta não encontrada.');
  const atual = paraOfertaDTO(l);
  if (atual.tipo === 'ovos' && d.animal) throw new ErroDominio('PAYLOAD_INVALIDO', undefined, 'Esta oferta é de ovos.');
  if (atual.tipo === 'animal' && (d.item || d.quantidade)) throw new ErroDominio('PAYLOAD_INVALIDO', undefined, 'Esta oferta é de animal.');
  const nova: OfertaIntercambioDTO = {
    ...atual,
    item: d.item ?? atual.item,
    quantidade: d.quantidade ?? atual.quantidade,
    animal: d.animal ?? atual.animal,
    custoTickets: d.custoTickets ?? atual.custoTickets,
    ativo: d.ativo ?? atual.ativo,
  };
  await exigirSemLucro(c, await lerConfigIntercambio(c), (await todasOfertas(c)).map((o) => (o.id === id ? nova : o)));
  await c.q(
    `update intercambio_ofertas set item = $2, quantidade = $3, animal = $4, custo_tickets = $5, ativo = $6,
            ordem = coalesce($7, ordem), atualizado_em = $8
      where id = $1`,
    [id, nova.item, nova.quantidade, nova.animal, nova.custoTickets, nova.ativo, d.ordem ?? null, new Date(agoraMs)],
  );
  await auditar(c, adminId, 'editar_oferta', null, {
    ofertaId: id,
    oferta: rotuloOferta(nova),
    campos: Object.keys(d).filter((k) => d[k as keyof typeof d] !== undefined),
    ...(d.custoTickets !== undefined && d.custoTickets !== atual.custoTickets ? { custo: { de: atual.custoTickets, para: d.custoTickets } } : {}),
    ...(d.ativo !== undefined && d.ativo !== atual.ativo ? { ativo: d.ativo } : {}),
  });
  return nova;
}

export async function excluirOferta(c: Consulta, adminId: string, id: string): Promise<void> {
  const l = await c.um<LinhaOferta>(`delete from intercambio_ofertas where id = $1 returning ${COLS_OFERTA}`, [id]);
  if (!l) throw new ErroDominio('NAO_ENCONTRADO', undefined, 'Oferta não encontrada.');
  await auditar(c, adminId, 'excluir_oferta', null, { ofertaId: id, oferta: rotuloOferta(paraOfertaDTO(l)) });
}

// ---------------------------------------------------------------- cupons

interface LinhaCupom {
  id: string; codigo: string; descricao: string | null; beneficio: string; tickets: unknown; giros: unknown;
  usos_max: unknown; usos: unknown;
  inicio: Date; fim: Date | null; ativo: boolean; criado_em: Date; criado_por_nome: string | null;
}
const SELECT_CUPOM = `
  select k.id, k.codigo, k.descricao, k.beneficio, k.tickets, k.giros, k.usos_max, k.usos, k.inicio, k.fim, k.ativo, k.criado_em, a.nome as criado_por_nome
    from cupons k left join contas a on a.id = k.criado_por`;
const paraCupomDTO = (l: LinhaCupom): AdminCupomDTO => ({
  id: l.id,
  codigo: l.codigo,
  descricao: l.descricao,
  beneficio: l.beneficio === 'giros' ? 'giros' : 'tickets',
  tickets: n(l.tickets),
  giros: n(l.giros),
  usosMax: l.usos_max === null ? null : n(l.usos_max),
  usos: n(l.usos),
  inicio: iso(l.inicio),
  fim: l.fim ? iso(l.fim) : null,
  ativo: !!l.ativo,
  criadoEm: iso(l.criado_em),
  criadoPor: l.criado_por_nome,
});

export async function listarCupons(c: Consulta): Promise<AdminCupomDTO[]> {
  return (await c.q<LinhaCupom>(`${SELECT_CUPOM} order by k.criado_em desc`)).map(paraCupomDTO);
}

async function cupom(c: Consulta, id: string): Promise<AdminCupomDTO> {
  const l = await c.um<LinhaCupom>(`${SELECT_CUPOM} where k.id = $1`, [id]);
  if (!l) throw new ErroDominio('NAO_ENCONTRADO', undefined, 'Cupom não encontrado.');
  return paraCupomDTO(l);
}

export async function detalheCupom(c: Consulta, id: string): Promise<AdminCupomDetalheDTO> {
  const resgates = await c.q<{ conta_id: string; nome: string; email: string; tickets: unknown; giros: unknown; criado_em: Date }>(
    `select r.conta_id, c.nome, c.email, r.tickets, r.giros, r.criado_em
       from cupons_resgates r join contas c on c.id = r.conta_id
      where r.cupom_id = $1 order by r.criado_em desc limit 500`,
    [id],
  );
  return {
    cupom: await cupom(c, id),
    resgates: resgates.map((r) => ({
      contaId: r.conta_id, nome: r.nome, email: r.email, tickets: n(r.tickets), giros: n(r.giros), criadoEm: iso(r.criado_em),
    })),
  };
}

function conferirBeneficio(beneficio: string, tickets: number, giros: number) {
  const ok = beneficio === 'giros' ? giros >= 1 && tickets === 0 : tickets >= 1 && giros === 0;
  if (!ok) {
    throw new ErroDominio(
      'PAYLOAD_INVALIDO',
      { issues: [{ caminho: 'tickets', mensagem: beneficio === 'giros' ? 'Pelo menos 1 giro.' : 'Pelo menos 1 ticket.' }] },
      beneficio === 'giros' ? 'Pelo menos 1 giro.' : 'Pelo menos 1 ticket.',
    );
  }
}

function validarPeriodo(inicio: string | Date, fim: string | Date | null) {
  if (fim && new Date(fim) <= new Date(inicio)) {
    throw new ErroDominio('PAYLOAD_INVALIDO', { issues: [{ caminho: 'fim', mensagem: 'O fim precisa ser depois do início.' }] }, 'O fim precisa ser depois do início.');
  }
}

export async function criarCupom(
  c: Consulta, adminId: string,
  d: { codigo: string; descricao: string | null; beneficio: 'tickets' | 'giros'; tickets: number; giros: number; usosMax: number | null; inicio?: string; fim: string | null; ativo: boolean },
  agoraMs: number,
): Promise<AdminCupomDTO> {
  const inicio = d.inicio ? new Date(d.inicio) : new Date(agoraMs);
  validarPeriodo(inicio, d.fim);
  const beneficio = d.beneficio === 'giros' ? 'giros' : 'tickets';
  const tickets = beneficio === 'giros' ? 0 : d.tickets;
  const giros = beneficio === 'giros' ? d.giros : 0;
  conferirBeneficio(beneficio, tickets, giros);
  if (await c.um('select 1 from cupons where codigo = $1', [d.codigo])) {
    throw new ErroDominio('PAYLOAD_INVALIDO', { issues: [{ caminho: 'codigo', mensagem: 'Já existe um cupom com esse código.' }] }, 'Já existe um cupom com esse código.');
  }
  let l: { id: string };
  try {
    l = (await c.um<{ id: string }>(
      `insert into cupons (codigo, descricao, beneficio, tickets, giros, usos_max, inicio, fim, ativo, criado_por, criado_em, atualizado_em)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11) returning id`,
      [d.codigo, d.descricao, beneficio, tickets, giros, d.usosMax, inicio, d.fim ? new Date(d.fim) : null, d.ativo, adminId, new Date(agoraMs)],
    ))!;
  } catch (erro) {
    if (ehViolacaoUnica(erro)) throw new ErroDominio('PAYLOAD_INVALIDO', { issues: [{ caminho: 'codigo', mensagem: 'Já existe um cupom com esse código.' }] }, 'Já existe um cupom com esse código.');
    throw erro;
  }
  await auditar(c, adminId, 'criar_cupom', null, { cupomId: l.id, codigo: d.codigo, beneficio, tickets, giros, usosMax: d.usosMax });
  return cupom(c, l.id);
}

export async function editarCupom(
  c: Consulta, adminId: string, id: string,
  d: { descricao?: string | null; beneficio?: 'tickets' | 'giros'; tickets?: number; giros?: number; usosMax?: number | null; inicio?: string; fim?: string | null; ativo?: boolean },
  agoraMs: number,
): Promise<AdminCupomDTO> {
  const atual = await cupom(c, id);
  validarPeriodo(d.inicio ?? atual.inicio, d.fim === undefined ? atual.fim : d.fim);
  const beneficio = d.beneficio ?? atual.beneficio;
  const tickets = beneficio === 'giros' ? 0 : (d.tickets ?? atual.tickets);
  const giros = beneficio === 'giros' ? (d.giros ?? atual.giros) : 0;
  if (d.beneficio !== undefined || d.tickets !== undefined || d.giros !== undefined) conferirBeneficio(beneficio, tickets, giros);
  if (beneficio === 'giros') {
    d.tickets = 0;
    d.giros = giros;
    d.beneficio = 'giros';
  } else if (d.beneficio === 'tickets' || d.tickets !== undefined) {
    d.beneficio = 'tickets';
    d.tickets = tickets;
    d.giros = 0;
  }
  if (d.usosMax !== undefined && d.usosMax !== null && d.usosMax < atual.usos) {
    throw new ErroDominio('PAYLOAD_INVALIDO', { issues: [{ caminho: 'usosMax', mensagem: `Já houve ${atual.usos} resgates.` }] }, `O limite não pode ser menor que os ${atual.usos} resgates já feitos.`);
  }
  const colunas: Record<string, string> = {
    descricao: 'descricao', beneficio: 'beneficio', tickets: 'tickets', giros: 'giros', usosMax: 'usos_max', inicio: 'inicio', fim: 'fim', ativo: 'ativo',
  };
  const sets: string[] = [];
  const params: unknown[] = [id];
  for (const [chave, valor] of Object.entries(d)) {
    if (valor === undefined || !colunas[chave]) continue;
    params.push(chave === 'inicio' || chave === 'fim' ? (valor ? new Date(valor as string) : null) : valor);
    sets.push(`${colunas[chave]} = $${params.length}`);
  }
  if (sets.length) {
    params.push(new Date(agoraMs));
    await c.q(`update cupons set ${sets.join(', ')}, atualizado_em = $${params.length} where id = $1`, params);
  }
  await auditar(c, adminId, 'editar_cupom', null, {
    cupomId: id,
    codigo: atual.codigo,
    campos: Object.keys(d).filter((k) => d[k as keyof typeof d] !== undefined),
    ...(d.ativo !== undefined && d.ativo !== atual.ativo ? { ativo: d.ativo } : {}),
  });
  return cupom(c, id);
}

export async function excluirCupom(c: Consulta, adminId: string, id: string): Promise<void> {
  const atual = await cupom(c, id);
  await c.q('delete from cupons where id = $1', [id]);
  await auditar(c, adminId, 'excluir_cupom', null, { cupomId: id, codigo: atual.codigo, usos: atual.usos });
}

// ---------------------------------------------------------------- ajuste manual (ficha do usuário)

export async function ajustarTickets(c: Consulta, adminId: string, id: string, quantidade: number, motivo: string, agoraMs: number): Promise<number> {
  await exigirJogador(c, id);
  const saldo = await movimentarTickets(c, id, quantidade, 'ajuste', { motivo, adminId }, agoraMs);
  await incrementarVersao(c, id, agoraMs);
  await auditar(c, adminId, 'ajustar_tickets', id, { quantidade, saldoApos: saldo, motivo });
  return saldo;
}

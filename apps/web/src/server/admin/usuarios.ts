// Gestão de membros pelo painel: lista com busca/filtros, ficha completa e ações (todas auditadas).
import type {
  AdminAcaoDTO, AdminListaAcoesDTO, AdminListaUsuariosDTO, AdminUsuarioDetalheDTO, AdminUsuarioLinhaDTO,
} from '@galinheiro/api-contract';
import { CONFIG, type Item, type Rng, type Tipo } from '@galinheiro/game-core';
import { excluirConta } from '../auth/contas';
import { gerarCodigoRecuperacao, gerarHash, normalizarCodigo } from '../auth/senha';
import type { Consulta } from '../db/banco';
import { extrato } from '../dominio/colecao';
import { situacaoBonusSaque } from '../dominio/saque';
import { COLS_ENTIDADE, iso, paraEntityDTO, type LinhaEntidade } from '../dominio/linhas';
import { criarAnimal, incrementarVersao, lerInventario, menorSlotLivre, movimentarSaldo, travarJogador } from '../dominio/repo';
import { ErroDominio, ehViolacaoUnica } from '../erros';
import { auditar, ehAdmin, emailsAdmin } from './acesso';
import { MEMBRO, diaSql } from './painel';
import { diaBr, somarDias } from './projecoes';
import { afiliacaoDe } from './afiliados';
import { cobrancasUsdtAbertas, lerConfigUsdt } from '../pagamentos/usdt';
import { movimentosDeTickets } from '../dominio/intercambio';

const n = (v: unknown): number => Number(v ?? 0);

interface LinhaUsuario {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  papel: string;
  bloqueado_em: Date | null;
  bloqueio_motivo: string | null;
  criado_em: Date;
  ultimo_acesso_em: Date | null;
  moedas_x100: unknown;
  nivel_galinheiro: unknown;
  animais: unknown;
  ovos: unknown;
  nao_lidas: unknown;
  total?: unknown;
}

const SELECT_USUARIO = `
  select c.id, c.nome, c.email, c.telefone, c.papel, c.bloqueado_em, c.bloqueio_motivo, c.criado_em,
         p.ultimo_acesso_em, p.moedas_x100, p.nivel_galinheiro,
         (select count(*) from entities e where e.player_id = c.id and e.status = 'ativo') as animais,
         (select coalesce(sum(i.quantidade), 0) from inventory i where i.player_id = c.id) as ovos,
         coalesce(sc.nao_lidas_admin, 0) as nao_lidas
    from contas c
    left join players p on p.id = c.id
    left join suporte_conversas sc on sc.conta_id = c.id`;

function paraLinha(l: LinhaUsuario): AdminUsuarioLinhaDTO {
  return {
    id: l.id,
    nome: l.nome,
    email: l.email,
    telefone: l.telefone,
    papel: ehAdmin({ papel: l.papel, email: l.email }) ? 'admin' : 'jogador',
    bloqueado: !!l.bloqueado_em,
    bloqueioMotivo: l.bloqueio_motivo,
    bloqueadoEm: l.bloqueado_em ? iso(l.bloqueado_em) : null,
    criadoEm: iso(l.criado_em),
    ultimoAcessoEm: l.ultimo_acesso_em ? iso(l.ultimo_acesso_em) : null,
    moedasX100: n(l.moedas_x100),
    nivel: n(l.nivel_galinheiro) || 1,
    animaisAtivos: n(l.animais),
    ovosEstoque: n(l.ovos),
    suporteNaoLidas: n(l.nao_lidas),
  };
}

export async function listarUsuarios(
  c: Consulta,
  q: { q?: string; filtro: string; ordenar: string; pagina: number; porPagina: number; ids?: string[] },
  agoraMs: number,
): Promise<AdminListaUsuariosDTO> {
  const params: unknown[] = [];
  const onde: string[] = [MEMBRO];
  const busca = q.q?.trim();
  if (busca) {
    params.push(`%${busca}%`);
    const i = params.length;
    // também acha pelo código de convite (ex.: "K7Q2MZ4")
    params.push(busca.toUpperCase().replace(/[\s-]/g, ''));
    const codigo = params.length;
    const digitos = busca.replace(/\D/g, '');
    if (digitos.length >= 3) {
      params.push(`%${digitos}%`);
      onde.push(`(c.nome ilike $${i} or c.email ilike $${i} or c.convite_codigo = $${codigo} or c.telefone like $${params.length})`);
    } else {
      onde.push(`(c.nome ilike $${i} or c.email ilike $${i} or c.convite_codigo = $${codigo})`);
    }
  }
  if (q.ids) {
    params.push(q.ids);
    onde.push(`c.id = any($${params.length}::uuid[])`);
  }
  const seteDias = new Date(agoraMs - 7 * 86_400_000);
  if (q.filtro === 'ativos7d') {
    params.push(seteDias);
    onde.push(`p.ultimo_acesso_em >= $${params.length}`);
  } else if (q.filtro === 'inativos7d') {
    params.push(seteDias);
    onde.push(`(p.ultimo_acesso_em is null or p.ultimo_acesso_em < $${params.length})`);
  } else if (q.filtro === 'bloqueados') {
    onde.push('c.bloqueado_em is not null');
  } else if (q.filtro === 'admins') {
    params.push([...emailsAdmin()]);
    onde.push(`(c.papel = 'admin' or c.email = any($${params.length}::text[]))`);
  }
  const ordem = {
    recentes: 'c.criado_em desc',
    acesso: 'p.ultimo_acesso_em desc nulls last',
    moedas: 'p.moedas_x100 desc nulls last',
    nome: 'c.nome asc',
  }[q.ordenar] ?? 'c.criado_em desc';
  params.push(q.porPagina, (q.pagina - 1) * q.porPagina);
  const linhas = await c.q<LinhaUsuario>(
    `${SELECT_USUARIO.replace('coalesce(sc.nao_lidas_admin, 0) as nao_lidas', 'coalesce(sc.nao_lidas_admin, 0) as nao_lidas, count(*) over () as total')}
      where ${onde.join(' and ')}
      order by ${ordem}, c.id
      limit $${params.length - 1} offset $${params.length}`,
    params,
  );
  let total = n(linhas[0]?.total);
  if (!linhas.length && q.pagina > 1) {
    const t = await c.um<{ n: unknown }>(`select count(*) as n from contas c left join players p on p.id = c.id where ${onde.join(' and ')}`, params.slice(0, -2));
    total = n(t?.n);
  }
  return { itens: linhas.map(paraLinha), total, pagina: q.pagina, porPagina: q.porPagina };
}

async function linhaUsuario(c: Consulta, id: string): Promise<LinhaUsuario> {
  const l = await c.um<LinhaUsuario>(`${SELECT_USUARIO} where c.id = $1 and ${MEMBRO}`, [id]);
  if (!l) throw new ErroDominio('NAO_ENCONTRADO', undefined, 'Usuário não encontrado.');
  return l;
}

async function acoesSobre(c: Consulta, onde: string, params: unknown[], limite: number, offset = 0): Promise<AdminAcaoDTO[]> {
  const linhas = await c.q<{
    id: unknown; admin_id: string | null; admin_nome: string | null; acao: string; alvo_conta_id: string | null; alvo_nome: string | null;
    detalhes: Record<string, unknown>; criado_em: Date;
  }>(
    `select a.id, a.admin_id, ad.nome as admin_nome, a.acao, a.alvo_conta_id, al.nome as alvo_nome, a.detalhes, a.criado_em
       from admin_acoes a
       left join contas ad on ad.id = a.admin_id
       left join contas al on al.id = a.alvo_conta_id
      ${onde}
      order by a.criado_em desc, a.id desc
      limit ${limite} offset ${offset}`,
    params,
  );
  return linhas.map((l) => ({
    id: n(l.id),
    adminId: l.admin_id,
    adminNome: l.admin_nome,
    acao: l.acao,
    alvoContaId: l.alvo_conta_id,
    alvoNome: l.alvo_nome ?? (typeof l.detalhes?.nome === 'string' ? l.detalhes.nome : null),
    detalhes: l.detalhes ?? {},
    criadoEm: iso(l.criado_em),
  }));
}

export async function detalheUsuario(c: Consulta, id: string, agoraMs: number): Promise<AdminUsuarioDetalheDTO> {
  const l = await linhaUsuario(c, id);
  const p = await c.um<{ tutorial_etapa: number; capacidade: number }>('select tutorial_etapa, capacidade from players where id = $1', [id]);
  const ativos = await c.q<LinhaEntidade>(`select ${COLS_ENTIDADE} from entities where player_id = $1 and status = 'ativo' order by slot_id`, [id]);
  const ap = await c.um<{ n: unknown }>(`select count(*) as n from entities where player_id = $1 and status = 'expirado'`, [id]);
  const est = (await c.um<Record<string, unknown>>(
    `select (select count(*) from collections where player_id = $1) as coletas,
            (select coalesce(sum(total_ovos), 0) from collections where player_id = $1) as ovos_coletados,
            (select coalesce(sum(total_vendido), 0) from inventory where player_id = $1) as ovos_vendidos,
            (select count(*) from spins where player_id = $1) as giros,
            (select coalesce(sum(valor_x100), 0) from transactions where player_id = $1 and valor_x100 > 0) as ganhas,
            (select coalesce(sum(-valor_x100), 0) from transactions where player_id = $1 and valor_x100 < 0) as gastas,
            (select count(*) from atividade_diaria where conta_id = $1 and dia >= $2::date) as dias_ativos`,
    [id, somarDias(diaBr(agoraMs), -29)],
  ))!;
  const conversa = await c.um<{ id: string; status: 'aberta' | 'resolvida'; nao_lidas_admin: number; ultima_mensagem_em: Date | null }>(
    'select id, status, nao_lidas_admin, ultima_mensagem_em from suporte_conversas where conta_id = $1',
    [id],
  );
  return {
    usuario: paraLinha(l),
    jogo: {
      tutorialEtapa: p?.tutorial_etapa ?? 0,
      capacidade: n(p?.capacidade) || CONFIG.galinheiro.ninhosPorNivel,
      inventario: await lerInventario(c, id),
      entidades: ativos.map((e) => paraEntityDTO(e, agoraMs)),
      aposentados: n(ap?.n),
    },
    estatisticas: {
      coletas: n(est.coletas),
      ovosColetados: n(est.ovos_coletados),
      ovosVendidos: n(est.ovos_vendidos),
      giros: n(est.giros),
      moedasGanhasX100: n(est.ganhas),
      moedasGastasX100: n(est.gastas),
      diasAtivos30: n(est.dias_ativos),
    },
    transacoes: (await extrato(c, id, 30, undefined)).itens,
    suporte: {
      conversaId: conversa?.id ?? null,
      status: conversa?.status ?? null,
      naoLidas: n(conversa?.nao_lidas_admin),
      ultimaMensagemEm: conversa?.ultima_mensagem_em ? iso(conversa.ultima_mensagem_em) : null,
    },
    auditoria: await acoesSobre(c, 'where a.alvo_conta_id = $1', [id], 30),
    tickets: { saldo: n((await c.um<{ t: unknown }>('select tickets as t from players where id = $1', [id]))?.t), movimentos: await movimentosDeTickets(c, id) },
    afiliacao: await afiliacaoDe(c, id),
    bonusSaque: await situacaoBonusSaque(c, id),
    cobranca: {
      meio: (await c.um<{ cobranca: string }>('select cobranca from contas where id = $1', [id]))?.cobranca === 'usdt' ? 'usdt' : 'pix',
      carteiraPronta: !!(await lerConfigUsdt(c)).endereco,
      abertas: await cobrancasUsdtAbertas(c, id),
    },
  };
}

export async function listarAuditoria(c: Consulta, pagina: number, porPagina: number): Promise<AdminListaAcoesDTO> {
  const t = (await c.um<{ n: unknown }>('select count(*) as n from admin_acoes'))!;
  return { itens: await acoesSobre(c, '', [], porPagina, (pagina - 1) * porPagina), total: n(t.n), pagina, porPagina };
}

// ---------------------------------------------------------------- ações

function naoEmSi(adminId: string, alvo: string, mensagem: string) {
  if (adminId === alvo) throw new ErroDominio('ACESSO_NEGADO', undefined, mensagem);
}

export async function editarUsuario(
  c: Consulta, adminId: string, id: string, dados: { nome?: string; telefone?: string; email?: string; papel?: 'jogador' | 'admin' },
): Promise<AdminUsuarioLinhaDTO> {
  const antes = await linhaUsuario(c, id);
  if (dados.papel === 'jogador') naoEmSi(adminId, id, 'Você não pode tirar o seu próprio acesso de administrador.');
  const sets: string[] = [];
  const params: unknown[] = [id];
  for (const [col, v] of [['nome', dados.nome], ['telefone', dados.telefone], ['email', dados.email], ['papel', dados.papel]] as const) {
    if (v === undefined) continue;
    params.push(v);
    sets.push(`${col} = $${params.length}`);
  }
  try {
    await c.q(`update contas set ${sets.join(', ')}, atualizado_em = now() where id = $1`, params);
  } catch (erro) {
    if (ehViolacaoUnica(erro)) {
      throw new ErroDominio(String((erro as { message?: unknown }).message ?? '').includes('telefone') ? 'TELEFONE_EM_USO' : 'EMAIL_EM_USO');
    }
    throw erro;
  }
  const mudou = Object.fromEntries(
    Object.entries(dados).filter(([, v]) => v !== undefined).map(([k, v]) => [k, { de: (antes as unknown as Record<string, unknown>)[k], para: v }]),
  );
  await auditar(c, adminId, 'editar_usuario', id, mudou);
  return paraLinha(await linhaUsuario(c, id));
}

export async function bloquearUsuario(c: Consulta, adminId: string, id: string, motivo: string, agoraMs: number): Promise<void> {
  naoEmSi(adminId, id, 'Você não pode bloquear a sua própria conta.');
  await linhaUsuario(c, id);
  // derruba as sessões abertas (sessao_versao) e impede novas (bloqueado_em)
  await c.q('update contas set bloqueado_em = $2, bloqueio_motivo = $3, sessao_versao = sessao_versao + 1, atualizado_em = $2 where id = $1', [
    id, new Date(agoraMs), motivo,
  ]);
  await auditar(c, adminId, 'bloquear', id, { motivo });
}

export async function desbloquearUsuario(c: Consulta, adminId: string, id: string): Promise<void> {
  await linhaUsuario(c, id);
  await c.q('update contas set bloqueado_em = null, bloqueio_motivo = null, atualizado_em = now() where id = $1', [id]);
  await auditar(c, adminId, 'desbloquear', id);
}

export async function encerrarSessoes(c: Consulta, adminId: string, id: string): Promise<void> {
  await linhaUsuario(c, id);
  await c.q('update contas set sessao_versao = sessao_versao + 1, atualizado_em = now() where id = $1', [id]);
  await auditar(c, adminId, 'encerrar_sessoes', id);
}

/** Gera um código de recuperação novo (o antigo deixa de valer) para o admin passar ao membro. */
export async function novoCodigoRecuperacao(c: Consulta, adminId: string, id: string): Promise<string> {
  await linhaUsuario(c, id);
  const codigo = gerarCodigoRecuperacao();
  await c.q('update contas set codigo_recuperacao_hash = $2, atualizado_em = now() where id = $1', [id, await gerarHash(normalizarCodigo(codigo))]);
  await auditar(c, adminId, 'novo_codigo_recuperacao', id);
  return codigo;
}

/** Libera ou trava de novo o bônus inicial no saque, sem exigir PIX da roleta. */
export async function definirBonusSaque(c: Consulta, adminId: string, id: string, liberado: boolean): Promise<boolean> {
  const j = await travarJogador(c, id);
  if (!j) throw new ErroDominio('JOGADOR_NAO_ENCONTRADO');
  await c.q('update players set bonus_saque_liberado = $2, atualizado_em = now() where id = $1', [id, liberado]);
  await auditar(c, adminId, liberado ? 'liberar_bonus_saque' : 'bloquear_bonus_saque', id, { liberado });
  return liberado;
}

/** PIX ou USDT nas próximas cobranças de roleta e ampliação deste membro. */
export async function definirCobranca(c: Consulta, adminId: string, id: string, meio: 'pix' | 'usdt'): Promise<'pix' | 'usdt'> {
  await linhaUsuario(c, id);
  const antes = await c.um<{ cobranca: string }>('select cobranca from contas where id = $1', [id]);
  await c.q('update contas set cobranca = $2, atualizado_em = now() where id = $1', [id, meio]);
  await auditar(c, adminId, 'definir_cobranca', id, { de: antes?.cobranca ?? 'pix', para: meio });
  return meio;
}

const TABELA_COBRANCA = { roleta: 'roleta_pix', ampliacao: 'ampliacao_pix' } as const;

/** Marca uma cobrança USDT como paga. A roleta ou a ampliação segue no próximo toque do membro. */
export async function confirmarCobrancaUsdt(
  c: Consulta, adminId: string, id: string, cobrancaId: string, tipo: 'roleta' | 'ampliacao', agoraMs: number,
): Promise<void> {
  await linhaUsuario(c, id);
  const tabela = TABELA_COBRANCA[tipo];
  const linha = await c.um<{ id: string; status: string; provedor: string; centavos: number; usdt_x100: unknown }>(
    `select id, status, provedor, centavos, usdt_x100 from ${tabela} where id = $1 and player_id = $2 for update`,
    [cobrancaId, id],
  );
  if (!linha) throw new ErroDominio('NAO_ENCONTRADO', undefined, 'Cobrança não encontrada.');
  if (linha.provedor !== 'usdt') throw new ErroDominio('PAYLOAD_INVALIDO', undefined, 'Esta cobrança não é em USDT.');
  if (linha.status !== 'aguardando') return;
  await c.q(`update ${tabela} set status = 'pago', atualizado_em = $2 where id = $1`, [cobrancaId, new Date(agoraMs)]);
  await auditar(c, adminId, 'confirmar_usdt', id, {
    tipo, cobrancaId, centavos: Number(linha.centavos), valorUsdtX100: Number(linha.usdt_x100 ?? 0),
  });
}

/** Valor que os próximos cadastros pelo link deste membro recebem. Null volta a seguir o bônus geral. */
export async function definirBonusLink(c: Consulta, adminId: string, id: string, bonusX100: number | null): Promise<number | null> {
  await linhaUsuario(c, id);
  const antes = await c.um<{ n: unknown }>('select bonus_link_x100 as n from contas where id = $1', [id]);
  await c.q('update contas set bonus_link_x100 = $2, atualizado_em = now() where id = $1', [id, bonusX100]);
  await auditar(c, adminId, 'definir_bonus_link', id, { de: antes?.n === null || antes?.n === undefined ? null : n(antes.n), para: bonusX100 });
  return bonusX100;
}

export async function ajustarSaldo(c: Consulta, adminId: string, id: string, valorX100: number, motivo: string, agoraMs: number): Promise<number> {
  const j = await travarJogador(c, id);
  if (!j) throw new ErroDominio('JOGADOR_NAO_ENCONTRADO');
  if (n(j.moedas_x100) + valorX100 < 0) {
    throw new ErroDominio('SALDO_INSUFICIENTE', { saldoX100: n(j.moedas_x100) }, 'O saldo ficaria negativo.');
  }
  const { saldoAposX100 } = await movimentarSaldo(c, id, valorX100, 'AJUSTE_SUPORTE', { motivo, adminId }, agoraMs);
  await incrementarVersao(c, id, agoraMs);
  await auditar(c, adminId, 'ajustar_saldo', id, { valorX100, motivo, saldoAposX100 });
  return saldoAposX100;
}

export async function ajustarOvos(c: Consulta, adminId: string, id: string, item: Item, quantidade: number, motivo: string, agoraMs: number): Promise<void> {
  const j = await travarJogador(c, id);
  if (!j) throw new ErroDominio('JOGADOR_NAO_ENCONTRADO');
  const atual = await c.um<{ quantidade: number }>('select quantidade from inventory where player_id = $1 and item = $2', [id, item]);
  if (n(atual?.quantidade) + quantidade < 0) throw new ErroDominio('ESTOQUE_INSUFICIENTE', undefined, 'O estoque ficaria negativo.');
  await c.q(
    `update inventory set quantidade = quantidade + $3, total_coletado = total_coletado + $3, atualizado_em = $4
      where player_id = $1 and item = $2`,
    [id, item, quantidade, new Date(agoraMs)],
  );
  await incrementarVersao(c, id, agoraMs);
  await auditar(c, adminId, 'ajustar_ovos', id, { item, quantidade, motivo });
}

export async function darAnimal(c: Consulta, adminId: string, id: string, tipo: Tipo, motivo: string, agoraMs: number, rng: Rng): Promise<string> {
  const j = await travarJogador(c, id);
  if (!j) throw new ErroDominio('JOGADOR_NAO_ENCONTRADO');
  const slot = await menorSlotLivre(c, id);
  if (slot === null) throw new ErroDominio('SEM_NINHO_LIVRE', undefined, 'O galinheiro deste membro está cheio.');
  const e = await criarAnimal(c, id, tipo, slot, agoraMs, rng, 'SUPORTE');
  await incrementarVersao(c, id, agoraMs);
  await auditar(c, adminId, 'dar_animal', id, { tipo, slot, nome: e.nome, motivo });
  return e.id;
}

export async function definirNivel(c: Consulta, adminId: string, id: string, nivel: number, motivo: string, agoraMs: number): Promise<void> {
  const j = await travarJogador(c, id);
  if (!j) throw new ErroDominio('JOGADOR_NAO_ENCONTRADO');
  const novaCapacidade = nivel * CONFIG.galinheiro.ninhosPorNivel;
  const acima = await c.um<{ n: unknown }>(`select count(*) as n from entities where player_id = $1 and status = 'ativo' and slot_id > $2`, [id, novaCapacidade]);
  if (n(acima?.n) > 0) throw new ErroDominio('CONFIRMACAO_INVALIDA', undefined, 'Há animais em ninhos acima do novo nível.');
  await c.q('delete from nests where player_id = $1 and slot > $2', [id, novaCapacidade]);
  await c.q(
    `insert into nests (player_id, slot, criado_em) select $1, g, $3 from generate_series(1, $2::int) g on conflict do nothing`,
    [id, novaCapacidade, new Date(agoraMs)],
  );
  await c.q('update players set nivel_galinheiro = $2, atualizado_em = $3 where id = $1', [id, nivel, new Date(agoraMs)]);
  await incrementarVersao(c, id, agoraMs);
  await auditar(c, adminId, 'definir_nivel', id, { de: n(j.nivel_galinheiro), para: nivel, motivo });
}

export async function excluirUsuario(c: Consulta, adminId: string, id: string, motivo: string): Promise<void> {
  naoEmSi(adminId, id, 'Você não pode excluir a sua própria conta pelo painel.');
  const l = await linhaUsuario(c, id);
  await excluirConta(c, id);
  await auditar(c, adminId, 'excluir_usuario', id, { nome: l.nome, email: l.email, telefone: l.telefone, motivo });
}

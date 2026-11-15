// Casos de uso do jogo (GDD 7.6). Cada função roda dentro de uma transação aberta pela camada HTTP.
import { randomUUID } from 'node:crypto';
import type {
  AmpliarResposta, ColetaDTO, ColetarResposta, ColetarTodosResposta, EntityDTO, GirarResposta, LiberarRoletaResposta,
  PlayerDTO, Preferencias, StateDTO, VenderResposta,
} from '@galinheiro/api-contract';
import { PREFERENCIAS_PADRAO, PreferenciasSchema } from '@galinheiro/api-contract';
import {
  ANIMAIS, CONFIG, CONFIG_VERSAO, ITENS, anguloResultado, itemDe, sortearRoleta, tipoDoItem, validarNome,
  valorVendaX100, type Inventario, type Item, type Rng,
} from '@galinheiro/game-core';
import type { Consulta } from '../db/banco';
import { ErroDominio } from '../erros';
import {
  COLS_ENTIDADE, COLS_JOGADOR, iso, paraContaDTO, paraEntityDTO, paraPlayerDTO,
  type LinhaContaDTO, type LinhaEntidade, type LinhaJogador,
} from './linhas';
import {
  avancarCiclo, buscarEntidade, contarAtivos, creditarOvos, criarAnimal, exigirJogador, incrementarVersao,
  lerInventario, menorSlotLivre, movimentarSaldo, reconciliar, registrarColeta, travarJogador,
  type ItemColeta,
} from './repo';
import { bonusDeCadastro, pagarComissoesDeVenda } from './afiliados';

export interface ResultadoCaso<T> { data: T; versao: number }

const d = (ms: number): Date => new Date(ms);

// ---------------------------------------------------------------- bootstrap
/** Cria o galinheiro do jogador (idempotente). Devolve true se criou agora. */
export async function criarJogador(c: Consulta, contaId: string, agoraMs: number, rng: Rng): Promise<boolean> {
  const novo = await c.um<{ id: string }>(
    `insert into players (id, aposentadorias_vistas_ate, config_versao, criado_em, atualizado_em)
     values ($1, $2, $3, $2, $2) on conflict (id) do nothing returning id`,
    [contaId, d(agoraMs), CONFIG_VERSAO],
  );
  if (!novo) return false;
  const bonus = await bonusDeCadastro(c, contaId);
  if (bonus > 0) await movimentarSaldo(c, contaId, bonus, 'BONUS_INICIAL', { motivo: 'cadastro' }, agoraMs);
  await c.q(
    'insert into nests (player_id, slot, criado_em) select $1, g, $2 from generate_series(1, $3::int) g',
    [contaId, d(agoraMs), CONFIG.galinheiro.ninhosPorNivel],
  );
  await c.q(
    'insert into inventory (player_id, item, atualizado_em) select $1, i, $2 from unnest(enum_range(null::item_tipo)) i',
    [contaId, d(agoraMs)],
  );
  if (CONFIG.animalBoasVindas) {
    await criarAnimal(c, contaId, CONFIG.animalBoasVindas, 1, agoraMs, rng, 'BOAS_VINDAS');
  }
  await incrementarVersao(c, contaId, agoraMs);
  return true;
}

// ---------------------------------------------------------------- estado
export async function estado(c: Consulta, contaId: string, agoraMs: number, rng: Rng): Promise<ResultadoCaso<StateDTO>> {
  if (!(await travarJogador(c, contaId))) {
    await criarJogador(c, contaId, agoraMs, rng);
  }
  await reconciliar(c, contaId, agoraMs);
  await c.q('update players set ultimo_acesso_em = $2 where id = $1', [contaId, d(agoraMs)]);

  const jogador = (await c.um<LinhaJogador>(`select ${COLS_JOGADOR} from players where id = $1`, [contaId]))!;
  const inventario = await lerInventario(c, contaId);
  const slots = await c.q<{ slot: number }>('select slot from nests where player_id = $1 order by slot', [contaId]);
  const ativos = await c.q<LinhaEntidade>(
    `select ${COLS_ENTIDADE} from entities where player_id = $1 and status = 'ativo' order by slot_id`, [contaId],
  );
  const naoVistos = await c.q<LinhaEntidade>(
    `select ${COLS_ENTIDADE} from entities
      where player_id = $1 and status = 'expirado' and expirado_em > $2 order by expirado_em`,
    [contaId, jogador.aposentadorias_vistas_ate],
  );
  const conta = await c.um<LinhaContaDTO>('select email, nome, telefone, papel, termos_versao from contas where id = $1', [contaId]);
  // atividade do dia no horário de Brasília (UTC−3): base do DAU/WAU/MAU e da projeção de pessoas
  await c.q(
    `insert into atividade_diaria (conta_id, dia) values ($1, (($2::timestamptz at time zone 'UTC') - interval '3 hours')::date)
     on conflict do nothing`,
    [contaId, d(agoraMs)],
  );

  const entidades = ativos.map((l) => paraEntityDTO(l, agoraMs));
  const porSlot = new Map(entidades.map((e) => [e.slotId, e.id]));
  const naoProntos = entidades.filter((e) => !e.pronto).map((e) => Date.parse(e.proximoRendimento));

  return {
    versao: jogador.versao,
    data: {
      player: paraPlayerDTO(jogador, entidades.length),
      inventario,
      ninhos: slots.map(({ slot }) => ({ slot, entityId: porSlot.get(slot) ?? null })),
      entidades,
      aposentadoriasNaoVistas: naoVistos.map((l) => paraEntityDTO(l, agoraMs)),
      resumo: {
        prontos: entidades.filter((e) => e.pronto).length,
        proximoProntoEm: naoProntos.length ? iso(Math.min(...naoProntos)) : null,
        valorInventarioX100: valorVendaX100(inventario),
      },
      config: { versao: CONFIG_VERSAO },
      conta: paraContaDTO(conta ?? { email: null, nome: null, telefone: null, papel: null }),
    },
  };
}

// ---------------------------------------------------------------- coleta
function paraColetaDTO(l: LinhaEntidade, ovos: number): ColetaDTO {
  return { entityId: l.id, nome: l.nome, ovos, item: itemDe(l.tipo), tier: l.ciclo_tier, cicloN: l.ciclo_n, jackpot: ovos === 3 };
}

export async function coletar(
  c: Consulta, contaId: string, entityId: string, agoraMs: number, rng: Rng,
): Promise<ResultadoCaso<ColetarResposta>> {
  await exigirJogador(c, contaId);
  const aposentadorias = await reconciliar(c, contaId, agoraMs);
  const l = await buscarEntidade(c, contaId, entityId, true);
  if (!l) throw new ErroDominio('ENTIDADE_NAO_ENCONTRADA', { entityId });
  if (l.status !== 'ativo') {
    throw new ErroDominio('ENTIDADE_EXPIRADA', { entityId, expiradoEm: l.expirado_em ? iso(l.expirado_em) : null },
      `${l.nome} já se aposentou.`);
  }
  const prontoEmMs = l.proximo_rendimento.getTime();
  if (agoraMs < prontoEmMs) {
    throw new ErroDominio('RENDIMENTO_NAO_PRONTO', { faltaMs: prontoEmMs - agoraMs, prontoEm: iso(prontoEmMs) });
  }
  const { linha, ovos } = await avancarCiclo(c, l, agoraMs, rng);
  const item = itemDe(l.tipo);
  await creditarOvos(c, contaId, item, ovos, agoraMs);
  await registrarColeta(c, contaId, 'INDIVIDUAL', agoraMs, [
    { entityId: l.id, cicloN: l.ciclo_n, tier: l.ciclo_tier, ovos, item, prontoEmMs },
  ]);
  const inventario = await lerInventario(c, contaId);
  const versao = await incrementarVersao(c, contaId, agoraMs);
  return {
    versao,
    data: { coleta: paraColetaDTO(l, ovos), entity: paraEntityDTO(linha, agoraMs), inventario, eventos: { aposentadorias } },
  };
}

export async function coletarTodos(
  c: Consulta, contaId: string, agoraMs: number, rng: Rng,
): Promise<ResultadoCaso<ColetarTodosResposta>> {
  await exigirJogador(c, contaId);
  const aposentadorias = await reconciliar(c, contaId, agoraMs);
  const prontos = await c.q<LinhaEntidade>(
    `select ${COLS_ENTIDADE} from entities
      where player_id = $1 and status = 'ativo' and proximo_rendimento <= $2
      order by slot_id for update`,
    [contaId, d(agoraMs)],
  );
  const coletas: ColetaDTO[] = [];
  const entidades: EntityDTO[] = [];
  const registros: ItemColeta[] = [];
  const totais: Partial<Inventario> = {};
  for (const l of prontos) {
    const { linha, ovos } = await avancarCiclo(c, l, agoraMs, rng);
    const item = itemDe(l.tipo);
    totais[item] = (totais[item] ?? 0) + ovos;
    coletas.push(paraColetaDTO(l, ovos));
    entidades.push(paraEntityDTO(linha, agoraMs));
    registros.push({ entityId: l.id, cicloN: l.ciclo_n, tier: l.ciclo_tier, ovos, item, prontoEmMs: l.proximo_rendimento.getTime() });
  }
  for (const [item, qtd] of Object.entries(totais) as [Item, number][]) {
    await creditarOvos(c, contaId, item, qtd, agoraMs);
  }
  await registrarColeta(c, contaId, 'EM_MASSA', agoraMs, registros);
  const inventario = await lerInventario(c, contaId);
  const versao = coletas.length ? await incrementarVersao(c, contaId, agoraMs) : await versaoAtual(c, contaId);
  return {
    versao,
    data: {
      coletas,
      totais,
      totalOvos: coletas.reduce((s, x) => s + x.ovos, 0),
      entidades,
      inventario,
      eventos: { aposentadorias },
    },
  };
}

async function versaoAtual(c: Consulta, contaId: string): Promise<number> {
  return (await c.um<{ versao: number }>('select versao from players where id = $1', [contaId]))?.versao ?? 0;
}

// ---------------------------------------------------------------- venda
export async function vender(
  c: Consulta, contaId: string, corpo: { tudo: true } | { itens: Partial<Record<Item, number>> }, agoraMs: number,
): Promise<ResultadoCaso<VenderResposta>> {
  await exigirJogador(c, contaId);
  const estoque = await lerInventario(c, contaId);
  const pedido: Partial<Inventario> = {};
  if ('tudo' in corpo) {
    for (const i of ITENS) if (estoque[i] > 0) pedido[i] = estoque[i];
  } else {
    for (const [i, q] of Object.entries(corpo.itens) as [Item, number][]) if (q > 0) pedido[i] = q;
  }
  const itens = Object.entries(pedido) as [Item, number][];
  if (!itens.length) throw new ErroDominio('VENDA_VAZIA');
  for (const [item, qtd] of itens) {
    if (qtd > estoque[item]) {
      throw new ErroDominio('ESTOQUE_INSUFICIENTE', { item, pedido: qtd, disponivel: estoque[item] });
    }
  }
  const total = valorVendaX100(pedido);
  for (const [item, qtd] of itens) {
    await c.q(
      `update inventory set quantidade = quantidade - $3, total_vendido = total_vendido + $3, atualizado_em = $4
        where player_id = $1 and item = $2`,
      [contaId, item, qtd, d(agoraMs)],
    );
  }
  const precosX100 = Object.fromEntries(itens.map(([i]) => [i, ANIMAIS[tipoDoItem(i)].precoOvoX100]));
  const { transacaoId, saldoAposX100 } = await movimentarSaldo(
    c, contaId, total, 'VENDA_OVOS', { itens: pedido, precosX100 }, agoraMs,
  );
  // comissões de afiliação (moedas do jogo, pagas pelo jogo) para quem está acima na rede do vendedor
  await pagarComissoesDeVenda(c, contaId, total, agoraMs);
  const inventario = await lerInventario(c, contaId);
  const versao = await incrementarVersao(c, contaId, agoraMs);
  return { versao, data: { venda: { itens: pedido, creditoX100: total, transacaoId }, saldoX100: saldoAposX100, inventario } };
}

// ---------------------------------------------------------------- roleta
/**
 * Liberação da roleta (membro novo): paga uma vez `CONFIG.roleta.liberacaoX100` com as moedas da codorna e já
 * ganha o primeiro giro. Quem jogava antes desta regra começou com a roleta aberta (migration 0022).
 */
export async function liberarRoleta(c: Consulta, contaId: string, agoraMs: number): Promise<ResultadoCaso<LiberarRoletaResposta>> {
  const jogador = await exigirJogador(c, contaId);
  if (jogador.roleta_liberada_em) throw new ErroDominio('ROLETA_JA_LIBERADA');
  const custo = CONFIG.roleta.liberacaoX100;
  if (jogador.moedas_x100 < custo) {
    throw new ErroDominio('SALDO_INSUFICIENTE', { faltamX100: custo - jogador.moedas_x100 });
  }
  const { transacaoId, saldoAposX100 } = await movimentarSaldo(c, contaId, -custo, 'LIBERACAO_ROLETA', { girosGratis: 1 }, agoraMs);
  const p = (await c.um<{ giros_gratis: number }>(
    `update players set roleta_liberada_em = $2, giros_gratis = giros_gratis + 1, atualizado_em = $2
      where id = $1 returning giros_gratis`,
    [contaId, d(agoraMs)],
  ))!;
  const versao = await incrementarVersao(c, contaId, agoraMs);
  return { versao, data: { saldoX100: saldoAposX100, girosGratis: p.giros_gratis, transacaoId } };
}

/** Giro da roleta: usa um giro grátis se houver, senão cobra `CONFIG.roleta.custoX100` moedas do jogo. */
export async function girar(c: Consulta, contaId: string, agoraMs: number, rng: Rng): Promise<ResultadoCaso<GirarResposta>> {
  const jogador = await exigirJogador(c, contaId);
  if (!jogador.roleta_liberada_em) {
    throw new ErroDominio('ROLETA_BLOQUEADA', { liberacaoX100: CONFIG.roleta.liberacaoX100 });
  }
  const aposentadorias = await reconciliar(c, contaId, agoraMs);
  const ocupados = await contarAtivos(c, contaId);
  if (ocupados >= jogador.capacidade) {
    throw new ErroDominio('SEM_NINHO_LIVRE', { ocupados, capacidade: jogador.capacidade });
  }
  const custo = CONFIG.roleta.custoX100;
  const agora = d(agoraMs);
  let girosGratis = jogador.giros_gratis ?? 0;
  const gratis = girosGratis > 0;
  if (!gratis && jogador.moedas_x100 < custo) {
    throw new ErroDominio('SALDO_INSUFICIENTE', { faltamX100: custo - jogador.moedas_x100 });
  }
  const slot = await menorSlotLivre(c, contaId);
  if (slot === null) throw new ErroDominio('SEM_NINHO_LIVRE', { ocupados, capacidade: jogador.capacidade });

  const spinId = randomUUID();
  const { rngValor, tipo, raridade } = sortearRoleta(rng);
  let transacaoId: string | null = null;
  let saldoAposX100 = jogador.moedas_x100;
  if (gratis) {
    girosGratis = (await c.um<{ giros_gratis: number }>(
      'update players set giros_gratis = giros_gratis - 1, atualizado_em = $2 where id = $1 returning giros_gratis',
      [contaId, agora],
    ))!.giros_gratis;
  } else {
    ({ transacaoId, saldoAposX100 } = await movimentarSaldo(c, contaId, -custo, 'GIRO_ROLETA', { spinId, tipo }, agoraMs));
  }
  const linha = await criarAnimal(c, contaId, tipo, slot, agoraMs, rng, 'ROLETA');
  const angulo = Math.round(anguloResultado(rngValor) * 1000) / 1000;
  await c.q(
    `insert into spins (id, player_id, transacao_id, entity_id, custo_x100, rng_valor, tipo, raridade, angulo_graus,
       config_versao, criado_em, giro_gratis)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [spinId, contaId, transacaoId, linha.id, custo, rngValor, tipo, raridade, angulo, CONFIG_VERSAO, agora, gratis],
  );
  const versao = await incrementarVersao(c, contaId, agoraMs);
  return {
    versao,
    data: {
      giro: { id: spinId, rngValor, anguloResultado: angulo, tipo, raridade, custoX100: gratis ? 0 : custo },
      entity: paraEntityDTO(linha, agoraMs),
      saldoX100: saldoAposX100,
      girosGratis,
      capacidade: { ocupados: ocupados + 1, total: jogador.capacidade },
      eventos: { aposentadorias },
    },
  };
}

// ---------------------------------------------------------------- loja
export async function ampliar(c: Consulta, contaId: string, agoraMs: number): Promise<ResultadoCaso<AmpliarResposta>> {
  const jogador = await exigirJogador(c, contaId);
  if (jogador.nivel_galinheiro >= CONFIG.galinheiro.nivelMax) {
    throw new ErroDominio('GALINHEIRO_NO_MAXIMO', { nivel: jogador.nivel_galinheiro });
  }
  const custo = CONFIG.galinheiro.custoUpgradeX100;
  if (jogador.moedas_x100 < custo) {
    throw new ErroDominio('SALDO_INSUFICIENTE', { faltamX100: custo - jogador.moedas_x100 });
  }
  const { transacaoId, saldoAposX100 } = await movimentarSaldo(
    c, contaId, -custo, 'UPGRADE_NINHO', { nivelDe: jogador.nivel_galinheiro, nivelPara: jogador.nivel_galinheiro + 1 }, agoraMs,
  );
  const p = (await c.um<{ nivel_galinheiro: number; capacidade: number }>(
    'update players set nivel_galinheiro = nivel_galinheiro + 1 where id = $1 returning nivel_galinheiro, capacidade',
    [contaId],
  ))!;
  const de = p.capacidade - CONFIG.galinheiro.ninhosPorNivel + 1;
  await c.q(
    'insert into nests (player_id, slot, criado_em) select $1, g, $2 from generate_series($3::int, $4::int) g',
    [contaId, d(agoraMs), de, p.capacidade],
  );
  const versao = await incrementarVersao(c, contaId, agoraMs);
  const novosSlots = Array.from({ length: CONFIG.galinheiro.ninhosPorNivel }, (_, i) => de + i);
  return {
    versao,
    data: { nivelGalinheiro: p.nivel_galinheiro, capacidade: p.capacidade, novosSlots, saldoX100: saldoAposX100, transacaoId },
  };
}

// ---------------------------------------------------------------- nome
export async function renomear(
  c: Consulta, contaId: string, entityId: string, nomeBruto: string, agoraMs: number,
): Promise<ResultadoCaso<EntityDTO>> {
  const r = validarNome(nomeBruto);
  if (!r.ok) {
    throw r.erro === 'NOME_IMPROPRIO' ? new ErroDominio('NOME_IMPROPRIO') : new ErroDominio('NOME_INVALIDO', { motivo: r.motivo });
  }
  await exigirJogador(c, contaId);
  const l = await c.um<LinhaEntidade>(
    `update entities set nome = $3, atualizado_em = $4 where id = $1 and player_id = $2 returning ${COLS_ENTIDADE}`,
    [entityId, contaId, r.nome, d(agoraMs)],
  );
  if (!l) throw new ErroDominio('ENTIDADE_NAO_ENCONTRADA', { entityId });
  const versao = await incrementarVersao(c, contaId, agoraMs);
  return { versao, data: paraEntityDTO(l, agoraMs) };
}

// ---------------------------------------------------------------- aposentadorias vistas, tutorial, perfil
export async function marcarAposentadoriasVistas(
  c: Consulta, contaId: string, ateIso: string, agoraMs: number,
): Promise<ResultadoCaso<{ aposentadoriasVistasAte: string }>> {
  await exigirJogador(c, contaId);
  const r = (await c.um<{ aposentadorias_vistas_ate: Date; versao: number }>(
    `update players
        set aposentadorias_vistas_ate = greatest(aposentadorias_vistas_ate, least($2::timestamptz, $3::timestamptz)),
            versao = versao + 1
      where id = $1
      returning aposentadorias_vistas_ate, versao`,
    [contaId, d(Date.parse(ateIso)), d(agoraMs)],
  ))!;
  return { versao: r.versao, data: { aposentadoriasVistasAte: iso(r.aposentadorias_vistas_ate) } };
}

export async function avancarTutorial(c: Consulta, contaId: string, etapa: number): Promise<ResultadoCaso<{ tutorialEtapa: number }>> {
  const jogador = await exigirJogador(c, contaId);
  if (etapa < jogador.tutorial_etapa || etapa > CONFIG.tutorial.etapaFinal) {
    throw new ErroDominio('TUTORIAL_ETAPA_INVALIDA', { etapaAtual: jogador.tutorial_etapa });
  }
  if (etapa === jogador.tutorial_etapa) return { versao: jogador.versao, data: { tutorialEtapa: etapa } };
  const r = (await c.um<{ versao: number }>(
    'update players set tutorial_etapa = $2, versao = versao + 1 where id = $1 returning versao', [contaId, etapa],
  ))!;
  return { versao: r.versao, data: { tutorialEtapa: etapa } };
}

export async function atualizarPerfil(
  c: Consulta, contaId: string, corpo: { apelido?: string | null; preferencias?: Partial<Preferencias> }, agoraMs: number,
): Promise<ResultadoCaso<PlayerDTO>> {
  const jogador = await exigirJogador(c, contaId);
  const atuais = PreferenciasSchema.parse({ ...PREFERENCIAS_PADRAO, ...(jogador.preferencias as object) });
  const preferencias = { ...atuais, ...(corpo.preferencias ?? {}) };
  const apelido = corpo.apelido === undefined ? jogador.apelido : corpo.apelido;
  await c.q(
    `update players set preferencias = $2::jsonb, apelido = $3, versao = versao + 1, atualizado_em = $4 where id = $1`,
    [contaId, JSON.stringify(preferencias), apelido, d(agoraMs)],
  );
  const l = (await c.um<LinhaJogador>(`select ${COLS_JOGADOR} from players where id = $1`, [contaId]))!;
  return { versao: l.versao, data: paraPlayerDTO(l, await contarAtivos(c, contaId)) };
}

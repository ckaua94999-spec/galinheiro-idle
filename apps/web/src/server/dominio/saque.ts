// Saque PIX: 1,00 moeda do jogo = R$ 1,00. O CPF informado é a chave PIX.
// O débito e a chamada à gateway de saque acontecem na mesma transação da rota: se ela recusar, o débito desfaz.
// A liquidação (pago ou devolvido) chega pelo webhook.
import { cpfValido, digitosCpf, mascararCpf, type ListaSaquesDTO, type SaqueCriadoDTO, type SaqueDTO, type StatusSaque } from '@galinheiro/api-contract';
import { CONFIG, formatarMoedas, liquidoSaqueCentavos, minimoBrutoSaqueCentavos, taxaSaqueCentavos } from '@galinheiro/game-core';
import type { Banco, Consulta } from '../db/banco';
import { ErroDominio } from '../erros';
import { provedorSaqueAtivo } from '../pagamentos/gateway';
import type { ProvedorSaque } from '../pagamentos/provedor';
import { exigirJogador, incrementarVersao, movimentarSaldo, travarJogador } from './repo';

const MINIMO_LIQUIDO_PADRAO = 100;
/** O rendimento da galinha só entra no saque 24 h depois de a colheita virar moeda. */
const ESPERA_RENDIMENTO_MS = 24 * 60 * 60 * 1000;
/** Essa espera vale só nos 3 primeiros dias da conta. */
const CARENCIA_CONTA_MS = 3 * ESPERA_RENDIMENTO_MS;

/** Mínimo que precisa cair no PIX. A taxa sai por cima, do saldo. */
export function minimoLiquidoCentavos(): number {
  const n = Number(process.env.SAQUE_MINIMO_CENTAVOS ?? MINIMO_LIQUIDO_PADRAO);
  return Number.isInteger(n) && n >= MINIMO_LIQUIDO_PADRAO ? n : MINIMO_LIQUIDO_PADRAO;
}

interface LinhaSaque {
  id: string;
  centavos: number;
  taxa_centavos: number;
  liquido_centavos: number;
  cpf: string;
  status: StatusSaque;
  criado_em: Date | string;
  player_id: string;
}

const paraDto = (l: LinhaSaque): SaqueDTO => ({
  id: l.id,
  centavos: l.centavos,
  taxaCentavos: l.taxa_centavos,
  liquidoCentavos: l.liquido_centavos,
  cpfMascarado: mascararCpf(l.cpf),
  status: l.status,
  criadoEm: new Date(l.criado_em).toISOString(),
});

/** Bônus inicial no saque: a equipe libera na ficha, ou um PIX da roleta pago (ainda sem giro, ou com o animal vivo). */
export async function situacaoBonusSaque(c: Consulta, contaId: string): Promise<{ liberadoPelaEquipe: boolean; liberadoPeloPlano: boolean; recebidoX100: number }> {
  const flag = await c.um<{ bonus_saque_liberado: boolean }>(
    'select bonus_saque_liberado from players where id = $1',
    [contaId],
  );
  const plano = await c.um<{ ok: boolean }>(
    `select exists (
       select 1 from roleta_pix where player_id = $1 and status = 'pago'
       union all
       select 1 from entities e
         join spins s on s.entity_id = e.id
        where e.player_id = $1 and e.status = 'ativo' and s.cobranca_id is not null and s.giro_gratis = false
     ) as ok`,
    [contaId],
  );
  const recebido = await c.um<{ n: unknown }>(
    `select valor_x100 as n from transactions where player_id = $1 and tipo = 'BONUS_INICIAL'`,
    [contaId],
  );
  return {
    liberadoPelaEquipe: flag?.bonus_saque_liberado === true,
    liberadoPeloPlano: plano?.ok === true,
    recebidoX100: Number(recebido?.n ?? 0),
  };
}

async function emCarenciaDeRendimento(c: Consulta, contaId: string, agoraMs: number): Promise<boolean> {
  const conta = await c.um<{ criado_em: Date | string }>('select criado_em from contas where id = $1', [contaId]);
  if (!conta) return false;
  return agoraMs - new Date(conta.criado_em).getTime() < CARENCIA_CONTA_MS;
}

async function rendimentosRecentesCentavos(c: Consulta, contaId: string, agoraMs: number): Promise<number> {
  if (!(await emCarenciaDeRendimento(c, contaId, agoraMs))) return 0;
  const desde = new Date(agoraMs - ESPERA_RENDIMENTO_MS);
  const linha = await c.um<{ n: unknown }>(
    `select coalesce(sum(valor_x100), 0) as n
       from transactions
      where player_id = $1 and tipo = 'VENDA_OVOS' and criado_em > $2`,
    [contaId, desde],
  );
  return Number(linha?.n ?? 0);
}

function resumoSaldo(saldo: number, planoAtivo: boolean, rendimentosRecentes: number, carenciaRendimento: boolean, bonus: number) {
  const bonusBloqueadoCentavos = planoAtivo ? 0 : Math.min(bonus, Math.max(0, saldo));
  // O bônus liberado não é comido pela espera. A trava de 24 h pega só o que está acima dele.
  const baseProtegida = planoAtivo ? Math.min(bonus, Math.max(0, saldo)) : bonusBloqueadoCentavos;
  const rendimentosBloqueadosCentavos = Math.min(Math.max(0, rendimentosRecentes), Math.max(0, saldo - baseProtegida));
  return {
    planoAtivo,
    bonusBloqueadoCentavos,
    rendimentosBloqueadosCentavos,
    carenciaRendimento,
    disponivelCentavos: Math.max(0, saldo - bonusBloqueadoCentavos - rendimentosBloqueadosCentavos),
    minimoCentavos: minimoBrutoSaqueCentavos(minimoLiquidoCentavos()),
    taxaFixaCentavos: CONFIG.saque.taxaFixaX100,
    taxaPercentualBp: CONFIG.saque.taxaPercentualBp,
    bonusCentavos: bonus,
  };
}

async function quadroSaque(c: Consulta, contaId: string, saldo: number, agoraMs: number) {
  const carencia = await emCarenciaDeRendimento(c, contaId, agoraMs);
  const recentes = carencia ? await rendimentosRecentesCentavos(c, contaId, agoraMs) : 0;
  const situacao = await situacaoBonusSaque(c, contaId);
  const plano = situacao.liberadoPelaEquipe || situacao.liberadoPeloPlano;
  return resumoSaldo(saldo, plano, recentes, carencia, situacao.recebidoX100);
}

export async function listarSaques(c: Consulta, contaId: string, agoraMs: number): Promise<ListaSaquesDTO> {
  const itens = await c.q<LinhaSaque>(
    `select id, centavos, taxa_centavos, liquido_centavos, cpf, status, criado_em, player_id
       from saques where player_id = $1 order by criado_em desc limit 20`,
    [contaId],
  );
  const jogador = await c.um<{ moedas_x100: number }>('select moedas_x100 from players where id = $1', [contaId]);
  const saldo = Number(jogador?.moedas_x100 ?? 0);
  return { itens: itens.map(paraDto), ...(await quadroSaque(c, contaId, saldo, agoraMs)) };
}

export async function solicitarSaque(
  c: Consulta,
  contaId: string,
  entrada: { centavos: number; cpf: string; nome: string },
  agoraMs: number,
  idempotencia: string,
  provedor?: ProvedorSaque,
): Promise<{ data: SaqueCriadoDTO; versao: number }> {
  const ativo = provedor ?? await provedorSaqueAtivo(c);
  const cpf = digitosCpf(entrada.cpf);
  if (!cpfValido(cpf)) throw new ErroDominio('CPF_INVALIDO');
  const nome = entrada.nome.trim().replace(/\s+/g, ' ');
  if (nome.length < 3 || nome.length > 80) throw new ErroDominio('PAYLOAD_INVALIDO', undefined, 'Informe o nome completo de quem vai receber.');
  const liquido = liquidoSaqueCentavos(entrada.centavos);
  const taxa = taxaSaqueCentavos(entrada.centavos);
  const minimo = minimoBrutoSaqueCentavos(minimoLiquidoCentavos());
  if (liquido < minimoLiquidoCentavos()) {
    throw new ErroDominio('PAYLOAD_INVALIDO', undefined, `O mínimo para sacar é R$ ${formatarMoedas(minimo)}. A taxa de R$ ${formatarMoedas(CONFIG.saque.taxaFixaX100)} + ${CONFIG.saque.taxaPercentualBp / 100}% sai desse valor.`);
  }

  const jogador = await exigirJogador(c, contaId);
  const aberto = await c.um<{ id: string }>(
    `select id from saques where player_id = $1 and status = 'processando' limit 1`,
    [contaId],
  );
  if (aberto) throw new ErroDominio('SAQUE_EM_ANDAMENTO');
  const saldoAtual = Number(jogador.moedas_x100);
  const quadro = await quadroSaque(c, contaId, saldoAtual, agoraMs);
  if (entrada.centavos > saldoAtual) {
    throw new ErroDominio('SALDO_INSUFICIENTE', undefined, 'Saldo insuficiente para este valor.');
  }
  if (entrada.centavos > quadro.disponivelCentavos) {
    const bonus = formatarMoedas(quadro.bonusCentavos);
    if (quadro.rendimentosBloqueadosCentavos > 0 && entrada.centavos <= saldoAtual - quadro.bonusBloqueadoCentavos) {
      throw new ErroDominio(
        'SALDO_INSUFICIENTE',
        { rendimentosBloqueadosCentavos: quadro.rendimentosBloqueadosCentavos },
        `Nos 3 primeiros dias, só o bônus de R$ ${bonus} está liberado para saque. A taxa é calculada em cima desse valor. O rendimento das galinhas entra 24 horas depois de a colheita virar moeda.`,
      );
    }
    throw new ErroDominio(
      'SALDO_INSUFICIENTE',
      { bonusBloqueadoCentavos: quadro.bonusBloqueadoCentavos },
      `O bônus inicial de R$ ${bonus} só pode ser sacado com um plano ativo: um animal comprado na roleta.`,
    );
  }

  const agora = new Date(agoraMs);
  const saldo = await movimentarSaldo(
    c, contaId, -entrada.centavos, 'SAQUE',
    { provedor: ativo.nome, cpf: mascararCpf(cpf), taxaCentavos: taxa, liquidoCentavos: liquido },
    agoraMs,
  );
  const linha = await c.um<LinhaSaque>(
    `insert into saques (player_id, centavos, taxa_centavos, liquido_centavos, cpf, nome, status, provedor, idempotencia, criado_em, atualizado_em)
     values ($1, $2, $3, $4, $5, $6, 'processando', $7, $8, $9, $9)
     returning id, centavos, taxa_centavos, liquido_centavos, cpf, status, criado_em, player_id`,
    [contaId, entrada.centavos, taxa, liquido, cpf, nome, ativo.nome, idempotencia, agora],
  );
  if (!linha) throw new ErroDominio('ERRO_INTERNO');

  const aceito = await ativo.criarSaque({ idempotencia, centavos: liquido, nome, cpf });
  await c.q(
    `update saques set id_externo = $2, status = $3, atualizado_em = $4 where id = $1`,
    [linha.id, aceito.idExterno, aceito.status, agora],
  );
  const versao = await incrementarVersao(c, contaId, agoraMs);
  return {
    data: { saque: { ...paraDto(linha), status: aceito.status }, saldoX100: saldo.saldoAposX100 },
    versao,
  };
}

export interface EventoSaqueLofypay {
  event?: string;
  data?: Record<string, unknown>;
}

function texto(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
}

/** saque.paid fecha; saque.failed devolve as moedas. Reentrega do mesmo evento não debita nem credita de novo. */
export async function aplicarEventoSaque(
  banco: Banco, evento: EventoSaqueLofypay, agoraMs: number, provedor: 'lofypay' | 'kavropay' | 'swytchpay' = 'lofypay',
): Promise<void> {
  if (evento.event !== 'saque.paid' && evento.event !== 'saque.failed' && evento.event !== 'saque.devolvido') return;
  const data = evento.data ?? {};
  const idExterno = texto(data.withdrawalId ?? data.id);
  const idempotencia = texto(data.idempotencyKey ?? data.externalReference ?? data.external_reference ?? data.externalId ?? data.external_id);
  if (!idExterno && !idempotencia) return;

  await banco.tx(async (c) => {
    const achado = await c.um<{ id: string; player_id: string }>(
      `select id, player_id from saques
        where provedor = $3 and (($1 <> '' and id_externo = $1) or ($2 <> '' and idempotencia = $2))
        limit 1`,
      [idExterno, idempotencia, provedor],
    );
    if (!achado) return;
    await travarJogador(c, achado.player_id);
    const saque = await c.um<LinhaSaque>(
      `select id, centavos, taxa_centavos, liquido_centavos, cpf, status, criado_em, player_id from saques where id = $1 for update`,
      [achado.id],
    );
    if (!saque) return;
    const devolvePago = evento.event === 'saque.devolvido' && saque.status === 'pago';
    if (saque.status !== 'processando' && !devolvePago) return;
    const agora = new Date(agoraMs);
    if (evento.event === 'saque.paid') {
      await c.q(`update saques set status = 'pago', atualizado_em = $2 where id = $1`, [saque.id, agora]);
      return;
    }
    const motivo = texto(data.reason).slice(0, 300) || null;
    await c.q(`update saques set status = 'falhou', motivo = $2, atualizado_em = $3 where id = $1`, [saque.id, motivo, agora]);
    await movimentarSaldo(c, saque.player_id, saque.centavos, 'SAQUE_ESTORNO', { saqueId: saque.id }, agoraMs);
    await incrementarVersao(c, saque.player_id, agoraMs);
  });
}

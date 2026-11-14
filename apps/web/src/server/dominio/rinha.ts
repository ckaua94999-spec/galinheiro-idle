// Rinha de galo: aposta com moedas do jogo (nada se compra nem se saca). Um sorteio decide a luta; a chance, o
// prêmio e o retorno médio de cada galo aparecem na tela antes da aposta (CONFIG.rinha).
import { randomUUID } from 'node:crypto';
import { TERMOS_VERSAO, type Galo, type HistoricoRinhaDTO, type RinhaDTO, type RinhaResposta } from '@galinheiro/api-contract';
import { CONFIG, CONFIG_VERSAO, lutarRinha, premioRinhaX100, type Golpe, type Rng } from '@galinheiro/game-core';
import type { Consulta } from '../db/banco';
import { ErroDominio } from '../erros';
import type { ResultadoCaso } from './jogo';
import { iso } from './linhas';
import { exigirJogador, incrementarVersao, movimentarSaldo } from './repo';

const HISTORICO = 10;

interface LinhaRinha {
  id: string;
  galo: Galo;
  aposta_x100: number;
  premio_x100: number;
  venceu: boolean;
  rng_valor: number;
  golpes: Golpe[];
  criado_em: Date;
}

const paraDto = (l: LinhaRinha): RinhaDTO => ({
  id: l.id,
  galo: l.galo,
  apostaX100: Number(l.aposta_x100),
  premioX100: Number(l.premio_x100),
  venceu: l.venceu,
  rngValor: l.rng_valor,
  golpes: l.golpes,
  criadoEm: iso(l.criado_em),
});

export async function lutar(
  c: Consulta, contaId: string, entrada: { galo: Galo; apostaX100: number }, agoraMs: number, rng: Rng,
): Promise<ResultadoCaso<RinhaResposta>> {
  const jogador = await exigirJogador(c, contaId);
  if (!jogador.roleta_liberada_em) throw new ErroDominio('RINHA_BLOQUEADA');
  const conta = await c.um<{ termos_versao: string | null }>('select termos_versao from contas where id = $1', [contaId]);
  if (conta?.termos_versao !== TERMOS_VERSAO) throw new ErroDominio('TERMOS_PENDENTES');

  const { galo, apostaX100 } = entrada;
  const { apostaMinX100, apostaMaxX100, galos } = CONFIG.rinha;
  if (!Number.isInteger(apostaX100) || apostaX100 < apostaMinX100 || apostaX100 > apostaMaxX100) {
    throw new ErroDominio('PAYLOAD_INVALIDO', { apostaMinX100, apostaMaxX100 });
  }
  if (jogador.moedas_x100 < apostaX100) {
    throw new ErroDominio('SALDO_INSUFICIENTE', { faltamX100: apostaX100 - jogador.moedas_x100 });
  }

  const id = randomUUID();
  const cfg = galos[galo];
  const luta = lutarRinha(galo, rng);
  const aposta = await movimentarSaldo(c, contaId, -apostaX100, 'APOSTA_RINHA', { rinhaId: id, galo }, agoraMs);
  let saldoX100 = aposta.saldoAposX100;
  let premioX100 = 0;
  let premioTransacaoId: string | null = null;
  if (luta.venceu) {
    premioX100 = premioRinhaX100(apostaX100, galo);
    // 1 ms depois da aposta: no extrato o prêmio aparece logo acima dela
    const credito = await movimentarSaldo(c, contaId, premioX100, 'PREMIO_RINHA', { rinhaId: id, galo, apostaX100 }, agoraMs + 1);
    saldoX100 = credito.saldoAposX100;
    premioTransacaoId = credito.transacaoId;
  }
  const linha = (await c.um<LinhaRinha>(
    `insert into rinhas (id, player_id, galo, aposta_x100, premio_x100, venceu, rng_valor, chance_bp, premio_pct, golpes,
       aposta_transacao_id, premio_transacao_id, config_versao, criado_em)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14)
     returning id, galo, aposta_x100, premio_x100, venceu, rng_valor, golpes, criado_em`,
    [id, contaId, galo, apostaX100, premioX100, luta.venceu, luta.rngValor, cfg.chanceBp, cfg.premioPct,
      JSON.stringify(luta.golpes), aposta.transacaoId, premioTransacaoId, CONFIG_VERSAO, new Date(agoraMs)],
  ))!;
  const versao = await incrementarVersao(c, contaId, agoraMs);
  return { versao, data: { rinha: paraDto(linha), saldoX100 } };
}

export async function historicoRinha(c: Consulta, contaId: string): Promise<HistoricoRinhaDTO> {
  const linhas = await c.q<LinhaRinha>(
    `select id, galo, aposta_x100, premio_x100, venceu, rng_valor, '[]'::jsonb as golpes, criado_em
       from rinhas where player_id = $1 order by criado_em desc limit $2`,
    [contaId, HISTORICO],
  );
  const itens = linhas.map((l) => {
    const { golpes: _golpes, ...resto } = paraDto(l);
    return resto;
  });
  return {
    itens,
    apostadoX100: itens.reduce((s, x) => s + x.apostaX100, 0),
    ganhoX100: itens.reduce((s, x) => s + x.premioX100, 0),
  };
}

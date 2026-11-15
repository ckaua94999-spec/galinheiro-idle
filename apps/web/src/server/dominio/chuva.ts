// Chuva de Ovos: caça-níquel de cascata com moedas do jogo (nada se compra nem se saca). O sorteio inteiro
// (giro pago + rodadas grátis) acontece aqui, numa transação: a aposta sai, o prêmio entra e o resumo fica em
// chuva_jogadas. Os quadros da cascata só vão na resposta, para o cliente encenar.
import { randomUUID } from 'node:crypto';
import { TERMOS_VERSAO, type ChuvaResposta } from '@galinheiro/api-contract';
import { CONFIG_CHUVA, CONFIG_VERSAO, jogarChuva, type Rng } from '@galinheiro/game-core';
import type { Consulta } from '../db/banco';
import { ErroDominio } from '../erros';
import type { ResultadoCaso } from './jogo';
import { exigirJogador, incrementarVersao, movimentarSaldo } from './repo';

export async function girarChuva(
  c: Consulta, contaId: string, apostaX100: number, agoraMs: number, rng: Rng,
): Promise<ResultadoCaso<ChuvaResposta>> {
  const jogador = await exigirJogador(c, contaId);
  if (!jogador.roleta_liberada_em) throw new ErroDominio('CHUVA_BLOQUEADA');
  const conta = await c.um<{ termos_versao: string | null }>('select termos_versao from contas where id = $1', [contaId]);
  if (conta?.termos_versao !== TERMOS_VERSAO) throw new ErroDominio('TERMOS_PENDENTES');
  const { apostaMinX100, apostaMaxX100 } = CONFIG_CHUVA;
  if (!Number.isInteger(apostaX100) || apostaX100 < apostaMinX100 || apostaX100 > apostaMaxX100) {
    throw new ErroDominio('PAYLOAD_INVALIDO', { apostaMinX100, apostaMaxX100 });
  }
  if (jogador.moedas_x100 < apostaX100) {
    throw new ErroDominio('SALDO_INSUFICIENTE', { faltamX100: apostaX100 - jogador.moedas_x100 });
  }

  const id = randomUUID();
  const resultado = jogarChuva(apostaX100, rng);
  const gratis = resultado.rodadas.length - 1;
  const aposta = await movimentarSaldo(c, contaId, -apostaX100, 'APOSTA_CHUVA', { chuvaId: id }, agoraMs);
  let saldoX100 = aposta.saldoAposX100;
  let premioTransacaoId: string | null = null;
  if (resultado.premioX100 > 0) {
    // 1 ms depois da aposta: no extrato o prêmio aparece logo acima dela
    const credito = await movimentarSaldo(
      c, contaId, resultado.premioX100, 'PREMIO_CHUVA', { chuvaId: id, apostaX100, rodadasGratis: gratis }, agoraMs + 1,
    );
    saldoX100 = credito.saldoAposX100;
    premioTransacaoId = credito.transacaoId;
  }
  await c.q(
    `insert into chuva_jogadas (id, player_id, aposta_x100, premio_x100, rodadas_gratis, maior_multiplicador, bateu_teto,
       aposta_transacao_id, premio_transacao_id, config_versao, criado_em)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, contaId, apostaX100, resultado.premioX100, gratis, Math.max(...resultado.rodadas.map((r) => r.multiplicador)),
      resultado.bateuTeto, aposta.transacaoId, premioTransacaoId, CONFIG_VERSAO, new Date(agoraMs)],
  );
  const versao = await incrementarVersao(c, contaId, agoraMs);
  return { versao, data: { id, resultado, saldoX100 } };
}

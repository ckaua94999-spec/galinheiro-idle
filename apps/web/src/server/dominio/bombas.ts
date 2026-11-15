// Ovos-Bomba: caça-níquel de bombas presas, com moedas do jogo (nada se compra nem se saca). As bombas ficam de um
// giro para o outro, então cada jogador tem um tabuleiro por valor de aposta (bombas_estado): quem troca de aposta
// troca de tabuleiro, e não dá para esperar a bomba com aposta baixa e explodir com aposta alta. O giro inteiro é
// sorteado aqui, numa transação: lê o tabuleiro, sorteia, debita a aposta, credita o prêmio e grava o tabuleiro novo.
import { randomUUID } from 'node:crypto';
import { TERMOS_VERSAO, type BombasEstadoDTO, type BombasResposta } from '@galinheiro/api-contract';
import { CONFIG_BOMBAS, CONFIG_VERSAO, ehApostaBombas, girarBombas, type BombaPresa, type EstadoBombas, type Rng } from '@galinheiro/game-core';
import type { Consulta } from '../db/banco';
import { ErroDominio } from '../erros';
import type { ResultadoCaso } from './jogo';
import { exigirJogador, incrementarVersao, movimentarSaldo } from './repo';

interface LinhaEstado { aposta_x100: unknown; bombas: BombaPresa[] | string; seq: number }

const bombasDe = (l: LinhaEstado): BombaPresa[] => (typeof l.bombas === 'string' ? (JSON.parse(l.bombas) as BombaPresa[]) : l.bombas);

/** Bombas presas em cada tabuleiro do jogador (a tela mostra o da aposta escolhida). */
export async function tabuleirosBombas(c: Consulta, contaId: string): Promise<BombasEstadoDTO> {
  const linhas = await c.q<LinhaEstado>('select aposta_x100, bombas, seq from bombas_estado where player_id = $1', [contaId]);
  const tabuleiros: BombasEstadoDTO['tabuleiros'] = {};
  for (const a of CONFIG_BOMBAS.apostasX100) tabuleiros[String(a)] = [];
  for (const l of linhas) tabuleiros[String(Number(l.aposta_x100))] = bombasDe(l);
  return { tabuleiros };
}

export async function girarOvosBomba(
  c: Consulta, contaId: string, apostaX100: number, agoraMs: number, rng: Rng,
): Promise<ResultadoCaso<BombasResposta>> {
  const jogador = await exigirJogador(c, contaId);
  if (!jogador.roleta_liberada_em) throw new ErroDominio('BOMBAS_BLOQUEADA');
  const conta = await c.um<{ termos_versao: string | null }>('select termos_versao from contas where id = $1', [contaId]);
  if (conta?.termos_versao !== TERMOS_VERSAO) throw new ErroDominio('TERMOS_PENDENTES');
  if (!ehApostaBombas(apostaX100)) throw new ErroDominio('PAYLOAD_INVALIDO', { apostasX100: CONFIG_BOMBAS.apostasX100 });
  if (jogador.moedas_x100 < apostaX100) {
    throw new ErroDominio('SALDO_INSUFICIENTE', { faltamX100: apostaX100 - jogador.moedas_x100 });
  }

  // a linha do jogador já está travada (exigirJogador): dois giros do mesmo jogador não leem o mesmo tabuleiro
  const linha = await c.um<LinhaEstado>(
    'select aposta_x100, bombas, seq from bombas_estado where player_id = $1 and aposta_x100 = $2 for update',
    [contaId, apostaX100],
  );
  const estado: EstadoBombas = linha ? { bombas: bombasDe(linha), seq: linha.seq } : { bombas: [], seq: 1 };

  const id = randomUUID();
  const resultado = girarBombas(apostaX100, estado, rng);
  const aposta = await movimentarSaldo(c, contaId, -apostaX100, 'APOSTA_BOMBAS', { bombasId: id }, agoraMs);
  let saldoX100 = aposta.saldoAposX100;
  let premioTransacaoId: string | null = null;
  if (resultado.premioX100 > 0) {
    // 1 ms depois da aposta: no extrato o prêmio aparece logo acima dela
    const credito = await movimentarSaldo(
      c, contaId, resultado.premioX100, 'PREMIO_BOMBAS', { bombasId: id, apostaX100, explosoes: resultado.explosoes.length }, agoraMs + 1,
    );
    saldoX100 = credito.saldoAposX100;
    premioTransacaoId = credito.transacaoId;
  }
  const agora = new Date(agoraMs);
  await c.q(
    `insert into bombas_estado (player_id, aposta_x100, bombas, seq, atualizado_em)
     values ($1, $2, $3::jsonb, $4, $5)
     on conflict (player_id, aposta_x100) do update set bombas = excluded.bombas, seq = excluded.seq, atualizado_em = excluded.atualizado_em`,
    [contaId, apostaX100, JSON.stringify(resultado.proximo.bombas), resultado.proximo.seq, agora],
  );
  await c.q(
    `insert into bombas_jogadas (id, player_id, aposta_x100, premio_x100, explosoes, aposta_transacao_id, premio_transacao_id,
       config_versao, criado_em)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, contaId, apostaX100, resultado.premioX100, resultado.explosoes.length, aposta.transacaoId, premioTransacaoId, CONFIG_VERSAO, agora],
  );
  const versao = await incrementarVersao(c, contaId, agoraMs);
  return { versao, data: { id, resultado, saldoX100 } };
}

// Idempotência (GDD 7.9): a chave é reservada dentro da MESMA transação do caso de uso.
// Requisições concorrentes com a mesma chave esperam a primeira terminar e recebem a resposta gravada.
import { createHash } from 'node:crypto';
import type { Consulta } from '../db/banco';
import { ErroDominio } from '../erros';

export interface RespostaGravada { status: number; corpo: unknown }

export const hashDaRequisicao = (metodo: string, caminho: string, corpo: unknown): string =>
  createHash('sha256').update(`${metodo} ${caminho} ${JSON.stringify(corpo ?? null)}`).digest('hex');

/** Reserva a chave. Se ela já foi usada, devolve a resposta original (replay). */
export async function reservarChave(
  c: Consulta, playerId: string, chave: string, endpoint: string, hash: string,
): Promise<RespostaGravada | null> {
  const nova = await c.um<{ chave: string }>(
    `insert into idempotency_keys (player_id, chave, endpoint, request_hash)
     values ($1, $2, $3, $4) on conflict (player_id, chave) do nothing returning chave`,
    [playerId, chave, endpoint, hash],
  );
  if (nova) return null;
  const existente = await c.um<{ request_hash: string; status_http: number; resposta: unknown }>(
    'select request_hash, status_http, resposta from idempotency_keys where player_id = $1 and chave = $2',
    [playerId, chave],
  );
  if (!existente || existente.request_hash !== hash) throw new ErroDominio('IDEMPOTENCY_CONFLITO');
  return { status: existente.status_http, corpo: existente.resposta };
}

export async function gravarResposta(c: Consulta, playerId: string, chave: string, resposta: RespostaGravada): Promise<void> {
  await c.q(
    'update idempotency_keys set status_http = $3, resposta = $4::jsonb where player_id = $1 and chave = $2',
    [playerId, chave, resposta.status, JSON.stringify(resposta.corpo)],
  );
}

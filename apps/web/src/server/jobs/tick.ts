// Tarefas periódicas (substituem o pg_cron do GDD 8.5): aposentadorias de quem está offline,
// notificações push e, a cada 6 h, limpeza e checagem de integridade.
import { obterBanco } from '../db/banco';
import { enviarNotificacoesProntas } from '../push/push';
import { agoraMs } from '../relogio';

const CHAVE = Symbol.for('galinheiro.tick.manutencao');
type GlobalComTick = typeof globalThis & { [CHAVE]?: number };

export interface ResultadoTick { aposentados: number; notificacoes: number; alertasIntegridade: number | null }

export async function executarTick(agora = agoraMs()): Promise<ResultadoTick> {
  const banco = await obterBanco();
  const r = await banco.um<{ n: number }>('select job_aposentar_vencidos(1000, $1) as n', [new Date(agora)]);
  const notificacoes = await enviarNotificacoesProntas(banco, agora);

  let alertasIntegridade: number | null = null;
  const g = globalThis as GlobalComTick;
  if (!g[CHAVE] || Date.now() - g[CHAVE] > 6 * 3_600_000) {
    g[CHAVE] = Date.now();
    await banco.q(`delete from idempotency_keys where criado_em < now() - interval '24 hours'`);
    await banco.q(`delete from collections where coletado_em < $1`, [new Date(agora - 180 * 86_400_000)]);
    alertasIntegridade = (await banco.um<{ n: number }>('select job_checar_integridade() as n'))?.n ?? 0;
    if (alertasIntegridade > 0) console.warn(`[integridade] ${alertasIntegridade} alerta(s) em integridade_alertas`);
  }
  return { aposentados: r?.n ?? 0, notificacoes, alertasIntegridade };
}

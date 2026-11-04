// Agendador interno: roda o tick a cada 60 s enquanto o servidor Node estiver de pé (dev e `next start`).
// Em hospedagem serverless, desligue (JOBS_INTERNOS=0) e chame /api/cron/tick por um cron externo.
const CHAVE = Symbol.for('galinheiro.agendador');
type GlobalComAgendador = typeof globalThis & { [CHAVE]?: ReturnType<typeof setInterval> };

export function garantirAgendador(): void {
  if (process.env.JOBS_INTERNOS === '0' || process.env.VITEST) return;
  const g = globalThis as GlobalComAgendador;
  if (g[CHAVE]) return;
  const rodar = (): void => {
    import('./tick')
      .then((m) => m.executarTick())
      .catch((erro: unknown) => console.error('[agendador] tick falhou', erro));
  };
  g[CHAVE] = setInterval(rodar, 60_000);
  g[CHAVE].unref?.();
  setTimeout(rodar, 5_000).unref?.();
}

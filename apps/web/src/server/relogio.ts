// Relógio do servidor: fonte única de "agora" para todas as regras (GDD 7.7).
// Fora de produção dá para adiantar o relógio (DEV_RELOGIO, ligado por padrão em desenvolvimento)
// e testar ciclos, cansaço e aposentadorias sem esperar dias.
import { MS_HORA } from '@galinheiro/game-core';

const CHAVE = Symbol.for('galinheiro.relogio.offsetMs');
type GlobalComRelogio = typeof globalThis & { [CHAVE]?: number };

export const relogioAjustavel = (): boolean =>
  process.env.NODE_ENV !== 'production' && process.env.DEV_RELOGIO !== '0';

export function offsetRelogioMs(): number {
  return relogioAjustavel() ? ((globalThis as GlobalComRelogio)[CHAVE] ?? 0) : 0;
}

export function agoraMs(): number {
  return Date.now() + offsetRelogioMs();
}

export function ajustarRelogio(horas: number): number {
  if (!relogioAjustavel()) throw new Error('Relógio ajustável desligado');
  const g = globalThis as GlobalComRelogio;
  g[CHAVE] = horas === 0 ? 0 : (g[CHAVE] ?? 0) + horas * MS_HORA;
  return g[CHAVE];
}

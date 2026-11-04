// Vibração (GDD 3.8.4). Usa navigator.vibrate quando existe (Android) e respeita a preferência do jogador.
import type { Raridade } from '@galinheiro/game-core';
import { useUi } from './ui';

function vibrar(padrao: number | number[]): void {
  if (!useUi.getState().preferencias.vibracao) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(padrao);
    } catch {
      // alguns navegadores bloqueiam sem gesto do usuário
    }
  }
}

export const vibracao = {
  coleta: () => vibrar(10),
  jackpot: () => vibrar([20, 40, 20]),
  erro: () => vibrar(40),
  roleta: (r: Raridade) =>
    vibrar({ comum: [15], raro: [20, 30, 20], epico: [30, 40, 30], lendario: [30, 50, 30, 50, 80] }[r]),
};

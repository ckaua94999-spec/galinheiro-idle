import { randomInt } from 'node:crypto';
import type { Rng } from '@galinheiro/game-core';

/** Gerador criptograficamente seguro (GDD 7.8). O cliente nunca sorteia nada que afete o jogo. */
export const rngServidor: Rng = { int: (maxExclusivo) => randomInt(0, maxExclusivo) };

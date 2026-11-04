import { CONFIG, MS_DIA, MS_HORA, TIERS, type Tier } from './config';
import { tierDe, vidaEm, type VidaBase } from './vida';

/** Inteiro uniforme em [0, maxExclusivo). Servidor: crypto.randomInt. Testes: PRNG com semente. */
export interface Rng { int(maxExclusivo: number): number }

export interface Ciclo { inicioMs: number; prontoEmMs: number; tier: Tier; ovos: 1 | 2 | 3 }
export type EntidadeTempo = VidaBase & { expiracaoMs: number };

/** 1º ovo garantido; cada ovo extra sai com chance q = 0,5 × MULT[tier] (GDD D-03). */
export function sortearOvos(tier: Tier, rng: Rng): 1 | 2 | 3 {
  const limiar = (CONFIG.ciclo.limiarExtraBase * TIERS[tier].multPct) / 100; // 5000 · 3750 · 2500 · 1250
  let ovos = 1;
  if (rng.int(10_000) < limiar) ovos++;
  if (rng.int(10_000) < limiar) ovos++;
  return ovos as 1 | 2 | 3;
}

/** Pré-condição (garantida pelo chamador): inicioMs < expiracaoMs. */
export function iniciarCiclo(e: EntidadeTempo, inicioMs: number, rng: Rng): Ciclo {
  const tier = tierDe(vidaEm(e, inicioMs)) ?? 'triste';
  const duracaoMs = (CONFIG.ciclo.baseH + TIERS[tier].atrasoH) * MS_HORA;
  const prontoEmMs = Math.min(inicioMs + duracaoMs, e.expiracaoMs); // RN-REN-07: último ciclo encurtado
  return { inicioMs, prontoEmMs, tier, ovos: sortearOvos(tier, rng) };
}

/** RN-REN-06: o animal novo já chega com ovos prontos. */
export function primeiraPostura(nascimentoMs: number, rng: Rng): Ciclo {
  return { inicioMs: nascimentoMs, prontoEmMs: nascimentoMs, tier: 'feliz', ovos: sortearOvos('feliz', rng) };
}

/** RN-REN-05: janela de graça. */
export function inicioDoProximoCiclo(prontoEmMs: number, coletadoEmMs: number): number {
  return Math.max(prontoEmMs, coletadoEmMs - CONFIG.ciclo.janelaGracaH * MS_HORA);
}

export const estaPronto = (prontoEmMs: number, agoraMs: number): boolean => agoraMs >= prontoEmMs;

export const deveAposentar = (e: EntidadeTempo, agoraMs: number): boolean =>
  agoraMs >= e.expiracaoMs || vidaEm(e, agoraMs) <= 0;

export const ehUltimoCiclo = (prontoEmMs: number, expiracaoMs: number): boolean => prontoEmMs === expiracaoMs;

export const diasRestantes = (expiracaoMs: number, agoraMs: number): number =>
  Math.max(0, Math.ceil((expiracaoMs - agoraMs) / MS_DIA));

export const idadeEmDias = (nascimentoMs: number, agoraMs: number): number =>
  Math.max(0, Math.floor((agoraMs - nascimentoMs) / MS_DIA));

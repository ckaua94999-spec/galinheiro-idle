import { CONFIG, TIERS, type Tier } from './config';

/** Base do cálculo da vida (GDD 3.4.1). A vida nunca é gravada: é derivada do tempo. */
export interface VidaBase { vidaAncora: number; vidaAncoraEmMs: number; fatorPct: number }

/** Vida (0–100) no instante t. Uma única divisão: os limites dos tiers caem exatamente onde devem. */
export function vidaEm(e: VidaBase, tMs: number): number {
  const v = e.vidaAncora - (e.fatorPct * (tMs - e.vidaAncoraEmMs)) / CONFIG.vida.vidaUtilMs;
  return Math.min(100, Math.max(0, v));
}

/** null = sem vida (aposentado). */
export function tierDe(vida: number): Tier | null {
  if (vida > TIERS.feliz.acimaDe) return 'feliz';
  if (vida > TIERS.neutro.acimaDe) return 'neutro';
  if (vida > TIERS.cansado.acimaDe) return 'cansado';
  if (vida > TIERS.triste.acimaDe) return 'triste';
  return null;
}

/** Porcentagem exibida: ceil garante que "76 %" ou mais equivale a vida > 75 (feliz). */
export const vidaExibida = (vida: number): number => Math.ceil(vida);

export type CorBarra = 'verde' | 'amarela' | 'vermelha';
export const corDaBarra = (vida: number): CorBarra =>
  vida > 50 ? 'verde' : vida > 25 ? 'amarela' : 'vermelha';

/** Efeitos do tier, para a tela de Info. */
export function efeitosDoTier(tier: Tier) {
  const cfg = TIERS[tier];
  const q = (CONFIG.ciclo.limiarExtraBase * cfg.multPct) / 100 / 10_000;
  return {
    rendimentoPct: cfg.multPct,
    chanceTresOvosPct: Math.round(q * q * 10_000) / 100,
    atrasoH: cfg.atrasoH,
    duracaoCicloH: CONFIG.ciclo.baseH + cfg.atrasoH,
    ovosEsperados: 1 + 2 * q,
  };
}

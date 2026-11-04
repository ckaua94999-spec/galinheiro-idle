// Valores derivados do tempo, calculados no cliente com o relógio sincronizado (só exibição).
import type { EntityDTO } from '@galinheiro/api-contract';
import { tierDe, vidaEm } from '@galinheiro/game-core';
import type { Humor } from './arte/Animal';

export function vidaDe(e: EntityDTO, agora: number): number {
  const t = e.status === 'ativo' ? agora : Date.parse(e.expiradoEm ?? e.expiracao);
  return vidaEm({ vidaAncora: e.vida.ancora, vidaAncoraEmMs: Date.parse(e.vida.ancoraEm), fatorPct: e.vida.fatorPct }, t);
}

export function humorDe(e: EntityDTO, agora: number): Humor {
  if (e.status !== 'ativo') return 'aposentado';
  return tierDe(vidaDe(e, agora)) ?? 'triste';
}

export const estaProntoAgora = (e: EntityDTO, agora: number): boolean =>
  e.status === 'ativo' && agora >= Date.parse(e.proximoRendimento);

export const contarProntos = (lista: EntityDTO[], agora: number): number =>
  lista.reduce((n, e) => n + (estaProntoAgora(e, agora) ? 1 : 0), 0);

export function proximoPronto(lista: EntityDTO[], agora: number): number | null {
  let menor: number | null = null;
  for (const e of lista) {
    const t = Date.parse(e.proximoRendimento);
    if (e.status === 'ativo' && t > agora && (menor === null || t < menor)) menor = t;
  }
  return menor;
}

export const diasRestantesAgora = (e: EntityDTO, agora: number): number =>
  e.status === 'ativo' ? Math.max(0, Math.ceil((Date.parse(e.expiracao) - agora) / 86_400_000)) : 0;

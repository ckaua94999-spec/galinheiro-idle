// Rinha de galo: minijogo de aposta com moedas do jogo (sem dinheiro real).
// O servidor decide o resultado com um único sorteio (rngValor < chanceBp = vitória). A sequência de golpes
// só encena esse resultado: é gerada depois, com o vencedor já definido, e não muda nada no prêmio.
import type { Rng } from './ciclo';
import { CONFIG, GALOS, type Galo } from './config';

export type LadoRinha = 'jogador' | 'rival';
export type TipoGolpe = 'bicada' | 'esporada' | 'voadora' | 'asa';
export interface Golpe {
  atacante: LadoRinha;
  golpe: TipoGolpe;
  /** 0 = o outro galo desviou */
  dano: number;
  critico: boolean;
  /** vida (0–100) de cada galo depois do golpe */
  vidaJogador: number;
  vidaRival: number;
}
export interface ResultadoRinha { rngValor: number; venceu: boolean; golpes: Golpe[] }

const TIPOS_GOLPE: readonly TipoGolpe[] = ['bicada', 'esporada', 'voadora', 'asa'];
const MAX_GOLPES = 14;
const outro = (l: LadoRinha): LadoRinha => (l === 'jogador' ? 'rival' : 'jogador');

export const ehGalo = (v: unknown): v is Galo => typeof v === 'string' && (GALOS as readonly string[]).includes(v);

/** Prêmio bruto de uma vitória (já inclui a aposta de volta), arredondado para baixo. */
export function premioRinhaX100(apostaX100: number, galo: Galo): number {
  return Math.floor((apostaX100 * CONFIG.rinha.galos[galo].premioPct) / 100);
}

/** Chance de vitória em % (ex.: 55). */
export const chanceRinhaPct = (galo: Galo): number => CONFIG.rinha.galos[galo].chanceBp / 100;

/** Retorno médio de cada moeda apostada, em % (chance × prêmio). Abaixo de 100: a casa leva vantagem. */
export const retornoMedioRinhaPct = (galo: Galo): number =>
  Math.round((CONFIG.rinha.galos[galo].chanceBp * CONFIG.rinha.galos[galo].premioPct) / 1_000) / 10;

/** Sorteia a luta. O vencedor ataca mais, os golpes ficam mais fortes a cada troca e quem vence nunca chega a 0. */
export function lutarRinha(galo: Galo, rng: Rng): ResultadoRinha {
  const rngValor = rng.int(10_000);
  const venceu = rngValor < CONFIG.rinha.galos[galo].chanceBp;
  const vencedor: LadoRinha = venceu ? 'jogador' : 'rival';
  const perdedor = outro(vencedor);
  const vida: Record<LadoRinha, number> = { jogador: 100, rival: 100 };
  const golpes: Golpe[] = [];
  const registrar = (atacante: LadoRinha, golpe: TipoGolpe, dano: number, critico: boolean) => {
    vida[outro(atacante)] -= dano;
    golpes.push({ atacante, golpe, dano, critico, vidaJogador: vida.jogador, vidaRival: vida.rival });
  };

  for (let i = 0; i < MAX_GOLPES && vida[perdedor] > 0; i++) {
    const atacante = rng.int(100) < 58 ? vencedor : perdedor;
    const alvo = outro(atacante);
    const critico = rng.int(100) < 20;
    const golpe = TIPOS_GOLPE[rng.int(TIPOS_GOLPE.length)]!;
    let dano = Math.round((9 + rng.int(13) + i * 2) * (critico ? 1.6 : 1));
    // quem vence apanha, mas fica de pé; quem perde cai no golpe que zera a vida
    dano = alvo === vencedor ? Math.max(0, Math.min(dano, vida[alvo] - 4)) : Math.min(dano, vida[alvo]);
    registrar(atacante, golpe, dano, critico && dano > 0);
  }
  if (vida[perdedor] > 0) registrar(vencedor, 'voadora', vida[perdedor], true);
  return { rngValor, venceu, golpes };
}

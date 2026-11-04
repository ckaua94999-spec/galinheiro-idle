import { ANIMAIS, CONFIG, FAIXAS_ROLETA, type FaixaRoleta, type Raridade, type Tipo } from './config';
import type { Rng } from './ciclo';

export function faixaDe(rngValor: number): FaixaRoleta {
  const f = FAIXAS_ROLETA.find((x) => rngValor >= x.de && rngValor <= x.ate);
  if (!f) throw new RangeError(`rngValor fora de 0..9999: ${rngValor}`);
  return f;
}

export function sortearRoleta(rng: Rng): { rngValor: number; tipo: Tipo; raridade: Raridade } {
  const rngValor = rng.int(10_000);
  const { tipo } = faixaDe(rngValor);
  return { rngValor, tipo, raridade: ANIMAIS[tipo].raridade };
}

/** Ângulo (graus, horário a partir do topo) onde a roda deve parar. Nunca cai numa divisória. */
export function anguloResultado(rngValor: number): number {
  const f = faixaDe(rngValor);
  const u = (rngValor - f.de + 0.5) / (f.ate - f.de + 1);
  const m = CONFIG.roleta.margemGraus;
  return f.grauInicio + m + u * (f.largura - 2 * m);
}

/** Rotação absoluta final da roda (CSS rotate, sentido horário) para o ângulo ficar sob o ponteiro. */
export function rotacaoFinal(rotAtualGraus: number, angulo: number, voltasExtras = 0): number {
  const voltas = CONFIG.roleta.voltasMin + voltasExtras;
  return Math.ceil((rotAtualGraus + voltas * 360 + angulo) / 360) * 360 - angulo;
}

/** Setor que está sob o ponteiro para uma rotação qualquer (usado para o "tique" da roda). */
export function setorSobPonteiro(rotacaoGraus: number): number {
  const angulo = (((-rotacaoGraus) % 360) + 360) % 360;
  return FAIXAS_ROLETA.findIndex((f) => angulo >= f.grauInicio && angulo < f.grauInicio + f.largura);
}

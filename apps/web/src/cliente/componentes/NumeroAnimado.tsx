'use client';

import { animate, motion, useMotionValue, useReducedMotionConfig, useTransform } from 'motion/react';
import { useEffect } from 'react';
import { cx } from '../util';

/**
 * Número que "conta" até o novo valor (GDD ANI-05 / ANI-11; DIRECAO_DE_ARTE 9: 700 ms, ease suave).
 * Usa MotionValue: nenhum setState por quadro. Em "reduzir movimento" aplica o valor direto.
 */
export function NumeroAnimado({
  valor,
  formatar,
  duracao = 0.7,
  className,
}: {
  valor: number;
  formatar: (n: number) => string;
  /** segundos da contagem (padrão 0,7) */
  duracao?: number;
  className?: string;
}) {
  const mv = useMotionValue(valor);
  const reduzir = useReducedMotionConfig();
  const texto = useTransform(mv, (v) => formatar(Math.round(v)));
  useEffect(() => {
    if (reduzir) {
      mv.set(valor);
      return;
    }
    const controle = animate(mv, valor, { duration: duracao, ease: [0.22, 1, 0.36, 1] });
    return () => controle.stop();
  }, [valor, mv, reduzir, duracao]);
  return <motion.span className={cx('numeros', className)}>{texto}</motion.span>;
}

import Link from 'next/link';
import { cx } from '../util';

/** Tábua de madeira com raios, o mesmo desenho do botão de saque. */
export function BotaoSaque({ className, children = 'Sacar' }: { className?: string; children?: string }) {
  return (
    <Link href="/saque" className={cx('botao botao-saque', className)}>
      {children}
    </Link>
  );
}

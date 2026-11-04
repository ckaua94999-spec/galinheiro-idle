// Avatar redondo com as iniciais e uma cor estável por pessoa (fila, conversa e escolha de membros).
import { cx } from '../../util';
import { corAvatar, iniciais } from './util';

export function Avatar({ nome, semente, tamanho = 'm', className }: { nome: string; semente: string; tamanho?: 'p' | 'm' | 'g'; className?: string }) {
  return (
    <span className={cx('atd-avatar', className)} data-tamanho={tamanho} style={{ background: corAvatar(semente) }} aria-hidden>
      {iniciais(nome)}
    </span>
  );
}

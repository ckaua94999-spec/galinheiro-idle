import { notFound } from 'next/navigation';

/** Ferramentas de desenvolvimento (galeria visual). Não existem em produção. */
export default function LayoutDev({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return children;
}

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TelaColecao } from '@/cliente/telas/TelaColecao';

export const metadata: Metadata = { title: 'Coleção' };

export default function Pagina() {
  return (
    <Suspense>
      <TelaColecao />
    </Suspense>
  );
}

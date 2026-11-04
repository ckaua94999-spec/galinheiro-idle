import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TelaEntrar } from '@/cliente/telas/TelaEntrar';

export const metadata: Metadata = { title: 'Entrar' };

export default function Pagina() {
  return (
    <Suspense>
      <TelaEntrar />
    </Suspense>
  );
}

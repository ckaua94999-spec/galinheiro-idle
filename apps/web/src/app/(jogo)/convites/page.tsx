import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TelaConvites } from '@/cliente/telas/TelaConvites';

export const metadata: Metadata = { title: 'Convide amigos' };

// Suspense: a tela lê ?de=loja (para onde o "voltar" leva) com useSearchParams.
export default function Pagina() {
  return (
    <Suspense>
      <TelaConvites />
    </Suspense>
  );
}

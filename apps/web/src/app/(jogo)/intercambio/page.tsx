import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TelaIntercambio } from '@/cliente/telas/TelaIntercambio';

export const metadata: Metadata = { title: 'Intercâmbio' };

// Suspense: a tela lê ?cupom=1 (foca o campo do cupom) e ?de=ajustes (para onde o "voltar" leva) com useSearchParams.
export default function Pagina() {
  return (
    <Suspense>
      <TelaIntercambio />
    </Suspense>
  );
}

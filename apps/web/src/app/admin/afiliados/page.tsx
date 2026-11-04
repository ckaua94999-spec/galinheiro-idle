import { Suspense } from 'react';
import { TelaAfiliados } from '@/cliente/admin/afiliados/TelaAfiliados';

export default function Pagina() {
  return (
    <Suspense>
      <TelaAfiliados />
    </Suspense>
  );
}

import { Suspense } from 'react';
import { TelaAtendimento } from '@/cliente/admin/atendimento/TelaAtendimento';

export default function Pagina() {
  return (
    <Suspense>
      <TelaAtendimento />
    </Suspense>
  );
}

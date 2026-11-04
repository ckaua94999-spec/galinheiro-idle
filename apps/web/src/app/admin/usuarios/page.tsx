import { Suspense } from 'react';
import { TelaUsuarios } from '@/cliente/admin/usuarios/TelaUsuarios';

export default function Pagina() {
  return (
    <Suspense>
      <TelaUsuarios />
    </Suspense>
  );
}

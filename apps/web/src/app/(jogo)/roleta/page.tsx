import type { Metadata } from 'next';
import { TelaRoleta } from '@/cliente/telas/TelaRoleta';

export const metadata: Metadata = { title: 'Roleta' };

export default function Pagina() {
  return <TelaRoleta />;
}

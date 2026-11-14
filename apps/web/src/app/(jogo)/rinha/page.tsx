import type { Metadata } from 'next';
import { TelaRinha } from '@/cliente/telas/TelaRinha';

export const metadata: Metadata = { title: 'Rinha de galo' };

export default function Pagina() {
  return <TelaRinha />;
}

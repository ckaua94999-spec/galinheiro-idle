import type { Metadata } from 'next';
import { TelaSaque } from '@/cliente/telas/TelaSaque';

export const metadata: Metadata = { title: 'Sacar' };

export default function Pagina() {
  return <TelaSaque />;
}

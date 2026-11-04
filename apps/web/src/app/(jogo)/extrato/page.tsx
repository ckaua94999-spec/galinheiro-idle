import type { Metadata } from 'next';
import { TelaExtrato } from '@/cliente/telas/TelaExtrato';

export const metadata: Metadata = { title: 'Extrato' };

export default function Pagina() {
  return <TelaExtrato />;
}

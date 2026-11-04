import type { Metadata } from 'next';
import { TelaLoja } from '@/cliente/telas/TelaLoja';

export const metadata: Metadata = { title: 'Loja' };

export default function Pagina() {
  return <TelaLoja />;
}

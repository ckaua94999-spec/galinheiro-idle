import type { Metadata } from 'next';
import { TelaGalinheiro } from '@/cliente/telas/TelaGalinheiro';

export const metadata: Metadata = { title: 'Galinheiro' };

export default function Pagina() {
  return <TelaGalinheiro />;
}

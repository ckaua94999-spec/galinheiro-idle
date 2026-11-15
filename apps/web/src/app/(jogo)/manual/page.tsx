import type { Metadata } from 'next';
import { TelaManual } from '@/cliente/telas/TelaManual';

export const metadata: Metadata = { title: 'Manual' };

export default function Pagina() {
  return <TelaManual />;
}

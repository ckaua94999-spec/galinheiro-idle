import type { Metadata } from 'next';
import { TelaAjustes } from '@/cliente/telas/TelaAjustes';

export const metadata: Metadata = { title: 'Configurações' };

export default function Pagina() {
  return <TelaAjustes />;
}

import type { Metadata } from 'next';
import { TelaSuporte } from '@/cliente/telas/TelaSuporte';

export const metadata: Metadata = { title: 'Atendimento' };

export default function Pagina() {
  return <TelaSuporte />;
}

import type { Metadata } from 'next';
import { TelaBombas } from '@/cliente/telas/TelaBombas';

export const metadata: Metadata = { title: 'Ovos-Bomba' };

export default function Pagina() {
  return <TelaBombas />;
}

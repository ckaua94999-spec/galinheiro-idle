import type { Metadata } from 'next';
import { TelaChuva } from '@/cliente/telas/TelaChuva';

export const metadata: Metadata = { title: 'Chuva de Ovos' };

export default function Pagina() {
  return <TelaChuva />;
}

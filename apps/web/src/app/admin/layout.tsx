import type { Metadata } from 'next';
import { ShellAdmin } from '@/cliente/admin/ShellAdmin';

export const metadata: Metadata = { title: 'Administração', robots: { index: false, follow: false } };

export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  return <ShellAdmin>{children}</ShellAdmin>;
}

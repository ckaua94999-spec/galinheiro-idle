import { TelaUsuario } from '@/cliente/admin/usuarios/TelaUsuario';

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TelaUsuario id={id} />;
}

import { TelaRede } from '@/cliente/admin/afiliados/TelaRede';

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TelaRede id={id} />;
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { TextoTermos } from '@/cliente/termos/TextoTermos';

export const metadata: Metadata = { title: 'Termos de uso' };

// Pública: o formulário de cadastro abre esta página antes de a conta existir.
export default function Pagina() {
  return (
    <main className="tela" style={{ paddingTop: 20 }}>
      <div className="tela-cabeca">
        <h1 className="titulo-tela">Termos de uso</h1>
      </div>
      <section className="painel" style={{ padding: 16 }}>
        <TextoTermos />
      </section>
      <p className="mt-4 text-center">
        <Link href="/entrar" className="botao botao-secundario">
          Voltar
        </Link>
      </p>
    </main>
  );
}

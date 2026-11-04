'use client';

// Moldura comum das páginas da galeria: título, links entre seções e um bloco por exemplo.
import Link from 'next/link';

export const SECOES = ['animais', 'juca', 'cartas', 'roleta', 'cenario', 'ui', 'telas'] as const;

export function Moldura({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh p-4">
      <nav className="mb-3 flex flex-wrap gap-2 text-sm font-semibold" data-galeria-nav>
        {SECOES.map((s) => (
          <Link key={s} href={`/dev/galeria/${s}`} className="rounded-full bg-white/70 px-3 py-1">
            {s}
          </Link>
        ))}
      </nav>
      <h1 className="mb-4 font-titulo text-3xl font-bold">{titulo}</h1>
      <div className="space-y-8">{children}</div>
    </div>
  );
}

export function Exemplo({ titulo, children, className }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section data-exemplo={titulo}>
      <h2 className="mb-2 font-titulo text-lg font-bold text-texto-suave">{titulo}</h2>
      <div className={className}>{children}</div>
    </section>
  );
}

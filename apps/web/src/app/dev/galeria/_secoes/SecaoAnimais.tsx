'use client';

// Galeria da área "animais" (dev): espécies × humores, com e sem ninho, tamanhos 32/72/110/144/220,
// fundo claro e grama, níveis de detalhe, teste de silhueta, uma grade de 16 ninhos animados, a piscada
// congelada no quadro de olho FECHADO, a demo dos cílios do kit e o orçamento de elementos por animal.
// Capturas focadas: ?tipo=galinha&humor=feliz (filtra tudo; o destaque mostra o par em tamanho grande).
// Âncoras para capturas: [data-destaque], [data-especies], [data-humores-72], [data-piscada],
// [data-kit-cilios], [data-orcamento], [data-grade].
import type { Tipo } from '@galinheiro/game-core';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type CSSProperties } from 'react';
import { FiguraAnimal, type Detalhe, type Humor } from '@/cliente/arte/Animal';
import { Olhos, Piscada, Sobrancelhas, type CiliosOlho, type CoresRosto, type DefOlho } from '@/cliente/arte/animais/comum';
import { Exemplo, Moldura } from '../_Moldura';

const TIPOS: Tipo[] = ['galinha', 'pato', 'ganso', 'avestruz'];
const HUMORES: Humor[] = ['feliz', 'neutro', 'cansado', 'triste', 'surpresa', 'aposentado'];
const TAMANHOS = [32, 72, 110, 144, 220] as const;

const CLARO: CSSProperties = { background: 'linear-gradient(180deg, #fffcf3, #fbedcc)', boxShadow: 'inset 0 0 0 2px #e6c88e' };
const GRAMA: CSSProperties = {
  backgroundColor: '#6cc644',
  backgroundImage:
    'radial-gradient(circle at 20% 30%, rgb(155 227 106 / .5) 0 10%, transparent 11%), radial-gradient(circle at 70% 60%, rgb(155 227 106 / .5) 0 8%, transparent 9%), radial-gradient(circle at 45% 85%, rgb(63 143 42 / .35) 0 9%, transparent 10%)',
  backgroundSize: '52px 52px, 68px 68px, 44px 44px',
  boxShadow: 'inset 0 8px 0 rgb(63 143 42 / .35)',
};

const detalhePara = (px: number): Detalhe => (px <= 56 ? 'p' : px > 140 ? 'g' : 'm');

// Demo do kit do rosto (comum.tsx): cabeça lisa + <Olhos/>/<Piscada/> com e sem `cilios`.
const KIT_OLHOS: DefOlho[] = [
  { x: 47, y: 58, lado: -1, e: 1.15 },
  { x: 73, y: 58, lado: 1, e: 1.15 },
];
const KIT_CORES: CoresRosto = { contorno: '#6a2a3a', palpebra: '#f6c4b8', sombra: '#b8566a', iris: '#5a3a8a', cilio: '#3a1020' };
const KIT_CILIOS: CiliosOlho = { n: 3 };

function RostoKit({ humor, cilios, fechado }: { humor: Humor; cilios?: CiliosOlho; fechado?: boolean }) {
  return (
    <div className={fechado ? 'gi-piscada-fechada' : undefined}>
      <svg viewBox="0 0 120 120" className={`gi-animal overflow-visible lod-g humor-${humor} h-[110px] w-[110px]`} role="img" aria-label={`rosto do kit ${humor}${cilios ? ' com cílios' : ''}`}>
        <circle cx={60} cy={62} r={40} fill="#f6c4b8" stroke="#6a2a3a" strokeWidth={3.5} />
        <Olhos olhos={KIT_OLHOS} humor={humor} cores={KIT_CORES} cilios={cilios} />
        <Piscada olhos={KIT_OLHOS} humor={humor} cores={KIT_CORES} cilios={cilios} />
        {humor !== 'aposentado' && <Sobrancelhas olhos={KIT_OLHOS} humor={humor} cor="#6a2a3a" />}
      </svg>
    </div>
  );
}

/** Elemento desenhado: nem ele nem nenhum ancestral (até o <svg>) com display:none. */
function desenhado(el: Element, svg: SVGSVGElement): boolean {
  for (let n: Element | null = el; n && n !== svg; n = n.parentElement) {
    if (getComputedStyle(n).display === 'none') return false;
  }
  return true;
}

/**
 * Conta os elementos desenhados de cada animal (lod-m, com ninho): os do bloco "espécies × humores" e uma
 * fileira própria com TODOS os humores no estado "pronto" (ovo na borda, o pior caso do orçamento).
 */
function Orcamento({ tipos, humores }: { tipos: Tipo[]; humores: Humor[] }) {
  const [linhas, setLinhas] = useState<[string, number][]>([]);
  useEffect(() => {
    // Recontado a cada 1,5 s (página dev): pega o hot reload e o redesenho depois da hidratação.
    const contar = () => {
      const r: [string, number][] = [];
      document.querySelectorAll<SVGSVGElement>('[data-especies] svg.gi-animal, [data-orcamento-pronto] svg.gi-animal').forEach((svg) => {
        const n = [...svg.querySelectorAll('path, ellipse, circle, rect, polygon, line')].filter((el) => desenhado(el, svg)).length;
        r.push([svg.getAttribute('aria-label') ?? '?', n]);
      });
      setLinhas(r);
    };
    contar();
    const id = window.setInterval(contar, 1500);
    return () => window.clearInterval(id);
  }, []);
  const acima = linhas.filter(([, n]) => n > 55).length;
  return (
    <div className="space-y-2 rounded-2xl p-3" style={CLARO} data-orcamento>
      <div className="flex flex-wrap gap-1" data-orcamento-pronto>
        {tipos.flatMap((t) =>
          humores.map((h) => <FiguraAnimal key={`${t}${h}`} tipo={t} humor={h} pronto className="h-12 w-12 shrink-0" titulo={`${t} ${h} pronto`} />),
        )}
      </div>
      {linhas.length === 0 ? (
        <p className="text-xs font-bold text-texto-suave">(aguardando hidratação…)</p>
      ) : (
        <>
          <p className={`text-xs font-bold ${acima ? 'text-red-700' : 'text-texto-suave'}`} data-orcamento-resumo>
            {linhas.length} animais contados; maior: {Math.max(...linhas.map(([, n]) => n))}; acima de 55: {acima}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs font-bold sm:grid-cols-4">
            {linhas.map(([nome, n]) => (
              <span key={nome} className={n > 55 ? 'text-red-700' : 'text-texto-suave'}>
                {nome}: {n}
                {n > 55 ? ' (acima de 55)' : ''}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Filtros({ tipo, humor }: { tipo: Tipo | null; humor: Humor | null }) {
  const link = (t: Tipo | null, h: Humor | null) => {
    const q = new URLSearchParams();
    if (t) q.set('tipo', t);
    if (h) q.set('humor', h);
    const s = q.toString();
    return s ? `?${s}` : '?';
  };
  const chip = (ativo: boolean) => `rounded-full px-3 py-1 text-xs font-bold ${ativo ? 'bg-texto text-white' : 'bg-white/70'}`;
  return (
    <div className="flex flex-wrap gap-1.5" data-filtros>
      <a href={link(null, humor)} className={chip(!tipo)}>
        todas
      </a>
      {TIPOS.map((t) => (
        <a key={t} href={link(t, humor)} className={chip(tipo === t)}>
          {t}
        </a>
      ))}
      <span className="w-2" />
      <a href={link(tipo, null)} className={chip(!humor)}>
        todos
      </a>
      {HUMORES.map((h) => (
        <a key={h} href={link(tipo, h)} className={chip(humor === h)}>
          {h}
        </a>
      ))}
    </div>
  );
}

// 16 ninhos variados para avaliar o conjunto (espécies, humores, prontos e vazios).
const GRADE: { tipo: Tipo | null; humor: Humor; pronto?: boolean }[] = [
  { tipo: 'galinha', humor: 'feliz', pronto: true },
  { tipo: 'galinha', humor: 'neutro' },
  { tipo: 'pato', humor: 'feliz' },
  { tipo: 'galinha', humor: 'cansado' },
  { tipo: 'ganso', humor: 'neutro', pronto: true },
  { tipo: 'galinha', humor: 'feliz' },
  { tipo: 'galinha', humor: 'triste' },
  { tipo: null, humor: 'feliz' },
  { tipo: 'avestruz', humor: 'feliz' },
  { tipo: 'galinha', humor: 'neutro', pronto: true },
  { tipo: 'pato', humor: 'cansado' },
  { tipo: 'galinha', humor: 'surpresa' },
  { tipo: 'galinha', humor: 'feliz' },
  { tipo: 'ganso', humor: 'triste' },
  { tipo: 'galinha', humor: 'aposentado' },
  { tipo: null, humor: 'feliz' },
];

function Conteudo() {
  const busca = useSearchParams();
  const pTipo = busca.get('tipo');
  const pHumor = busca.get('humor');
  const tipo = TIPOS.includes(pTipo as Tipo) ? (pTipo as Tipo) : null;
  const humor = HUMORES.includes(pHumor as Humor) ? (pHumor as Humor) : null;
  const tipos = tipo ? [tipo] : TIPOS;
  const humores = humor ? [humor] : HUMORES;
  const humorTamanhos: Humor = humor ?? 'feliz';

  return (
    <Moldura titulo="Animais">
      <Filtros tipo={tipo} humor={humor} />

      {tipo && humor && (
        <Exemplo titulo={`destaque: ${tipo} ${humor}`} className="flex flex-wrap items-end gap-4 rounded-2xl p-3" >
          <div className="flex flex-wrap items-end gap-4 rounded-2xl p-3" style={CLARO} data-destaque>
            <FiguraAnimal tipo={tipo} humor={humor} detalhe="g" className="h-[220px] w-[220px]" />
            <FiguraAnimal tipo={tipo} humor={humor} className="h-[110px] w-[110px]" />
            <FiguraAnimal tipo={tipo} humor={humor} className="h-[72px] w-[72px]" />
          </div>
        </Exemplo>
      )}

      <Exemplo titulo="espécies × humores (110 px, com ninho)">
        <div className="space-y-3" data-especies>
        {tipos.map((t) => (
          <div key={t} className="rounded-2xl p-2" style={CLARO}>
            <p className="mb-1 font-titulo text-sm text-texto-suave">{t}</p>
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
              {humores.map((h) => (
                <figure key={h} className="text-center text-[11px] font-bold text-texto-suave">
                  <FiguraAnimal tipo={t} humor={h} className="mx-auto h-[110px] w-[110px]" titulo={`${t} ${h}`} />
                  <figcaption>{h}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
        </div>
      </Exemplo>

      <Exemplo titulo="orçamento: elementos desenhados por animal com ninho (lod-m, máx. 55), inclusive pronto">
        <Orcamento tipos={tipos} humores={humores} />
      </Exemplo>

      <Exemplo titulo="piscada congelada no quadro de olho FECHADO (144 px lod-g e 72 px)" className="space-y-2">
        <div className="gi-piscada-fechada space-y-2" data-piscada>
          {tipos.map((t) => (
            <div key={t} className="flex flex-wrap items-end gap-2 rounded-2xl p-2" style={CLARO}>
              {(['neutro', 'cansado', 'triste'] as const).map((h) => (
                <FiguraAnimal key={h} tipo={t} humor={h} detalhe="g" className="h-36 w-36 shrink-0" titulo={`${t} ${h} piscando`} />
              ))}
              {(['neutro', 'cansado', 'triste'] as const).map((h) => (
                <FiguraAnimal key={`m${h}`} tipo={t} humor={h} className="h-[72px] w-[72px] shrink-0" />
              ))}
            </div>
          ))}
        </div>
      </Exemplo>

      <Exemplo titulo="kit do rosto: <Olhos cilios> e <Piscada cilios> (linha 1 sem, 2 com cílios, 3 com cílios piscando)" className="space-y-1 rounded-2xl p-2">
        <div className="space-y-1 rounded-2xl p-2" style={CLARO} data-kit-cilios>
          {[undefined, KIT_CILIOS, 'fechado' as const].map((v, i) => (
            <div key={i} className="flex flex-wrap gap-1">
              {humores.map((h) => (
                <RostoKit key={h} humor={h} cilios={v ? KIT_CILIOS : undefined} fechado={v === 'fechado'} />
              ))}
            </div>
          ))}
        </div>
      </Exemplo>

      <Exemplo titulo="humores a 72 px (tamanho do grid) sobre grama" className="rounded-2xl p-2">
        <div className="space-y-1 rounded-2xl p-2" style={GRAMA} data-humores-72>
          {tipos.map((t) => (
            <div key={t} className="flex flex-wrap items-end gap-1">
              {humores.map((h) => (
                <FiguraAnimal key={h} tipo={t} humor={h} className="h-[72px] w-[72px] shrink-0" titulo={`${t} ${h}`} />
              ))}
            </div>
          ))}
        </div>
      </Exemplo>

      <Exemplo titulo="sem ninho (110 px e ícone 32 px)" className="rounded-2xl p-2" >
        <div className="rounded-2xl p-2" style={CLARO}>
          {tipos.map((t) => (
            <div key={t} className="flex flex-wrap items-end gap-1">
              {humores.map((h) => (
                <FiguraAnimal key={h} tipo={t} humor={h} ninho={false} className="h-[110px] w-[110px]" />
              ))}
              {humores.map((h) => (
                <FiguraAnimal key={`p${h}`} tipo={t} humor={h} ninho={false} detalhe="p" className="h-8 w-8" />
              ))}
            </div>
          ))}
        </div>
      </Exemplo>

      {(['claro', 'grama'] as const).map((fundo) => (
        <Exemplo key={fundo} titulo={`tamanhos ${TAMANHOS.join('/')} px sobre ${fundo} (${humorTamanhos})`} className="space-y-2">
          {tipos.map((t) => (
            <div key={t} className="flex flex-wrap items-end gap-2 rounded-2xl p-2" style={fundo === 'claro' ? CLARO : GRAMA}>
              {TAMANHOS.map((px) => (
                <FiguraAnimal key={px} tipo={t} humor={humorTamanhos} detalhe={detalhePara(px)} {...tamanho(px)} />
              ))}
            </div>
          ))}
        </Exemplo>
      ))}

      <Exemplo titulo="níveis de detalhe p / m / g (144 px)" className="flex flex-wrap gap-2 rounded-2xl p-2">
        {(['p', 'm', 'g'] as const).map((d) => (
          <figure key={d} className="rounded-2xl p-1 text-center text-xs font-bold" style={CLARO}>
            <FiguraAnimal tipo={tipo ?? 'galinha'} humor={humorTamanhos} detalhe={d} className="h-36 w-36" />
            <figcaption>lod-{d}</figcaption>
          </figure>
        ))}
      </Exemplo>

      <Exemplo titulo="pronto, vazio (56 px da loja) e aposentado" className="flex flex-wrap items-end gap-2 rounded-2xl p-2">
        <div className="flex flex-wrap items-end gap-2 rounded-2xl p-2" style={GRAMA}>
          {tipos.map((t) => (
            <FiguraAnimal key={t} tipo={t} humor={humor ?? 'feliz'} pronto className="h-[110px] w-[110px]" />
          ))}
          <FiguraAnimal tipo={null} className="h-[110px] w-[110px]" />
          <FiguraAnimal tipo={null} className="h-14 w-14" />
        </div>
      </Exemplo>

      <Exemplo titulo="silhueta a 32 px (precisa distinguir as espécies)" className="flex gap-3 rounded-2xl p-2">
        <div className="gi-silhueta flex gap-3 rounded-2xl p-2" style={CLARO}>
          {TIPOS.map((t) => (
            <FiguraAnimal key={t} tipo={t} humor="neutro" ninho={false} detalhe="p" className="h-8 w-8" />
          ))}
        </div>
      </Exemplo>

      <Exemplo titulo="grade de 16 ninhos animados (como no galinheiro)" className="rounded-2xl p-3">
        <div className="grid grid-cols-4 gap-1 rounded-2xl p-2" style={GRAMA} data-grade>
          {GRADE.map((n, i) => (
            <FiguraAnimal key={i} tipo={tipo && n.tipo ? tipo : n.tipo} humor={humor ?? n.humor} pronto={n.pronto} atrasoS={(i * 0.73) % 3} className="aspect-square w-full" />
          ))}
        </div>
      </Exemplo>
    </Moldura>
  );
}

// Tamanho fixo em px (classes arbitrárias do Tailwind não funcionam com valores calculados).
function tamanho(px: number): { className: string } {
  const classes: Record<number, string> = { 32: 'h-8 w-8', 72: 'h-[72px] w-[72px]', 110: 'h-[110px] w-[110px]', 144: 'h-36 w-36', 220: 'h-[220px] w-[220px]' };
  return { className: `shrink-0 ${classes[px] ?? ''}` };
}

export function SecaoAnimais() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}

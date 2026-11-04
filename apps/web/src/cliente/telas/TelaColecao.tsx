'use client';

// Coleção (GDD 3.7.3 e 6.11): cartas de ativos e aposentados, com filtros, ordenação e paginação.
import type { ListaEntidades } from '@galinheiro/api-contract';
import { ANIMAIS, GEMAS_RARIDADE, NOME_RARIDADE, NOME_TIPO, RARIDADES, TIPOS } from '@galinheiro/game-core';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowDownUp, ChevronDown, Funnel } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { chamar } from '../api';
import { FiguraAnimal } from '../arte/Animal';
import { IconeColecao } from '../arte/Icones';
import { Carta, EsqueletoCarta } from '../componentes/Carta';
import { GemasCarta } from '../componentes/carta/pecas';
import { useAgora } from '../relogio';
import { useUi } from '../ui';
import { cx } from '../util';

type Status = 'ativo' | 'expirado' | 'todos';
type Ordem = 'slot' | 'raridade' | 'vida' | 'proximoRendimento' | 'nome' | 'chegada';

const ROTULO_ORDEM: Record<Ordem, string> = {
  slot: 'Ninho',
  raridade: 'Raridade',
  vida: 'Menos vida',
  proximoRendimento: 'Próximos ovos',
  nome: 'Nome',
  chegada: 'Chegada',
};

/** Select com cara de botão do jogo: ícone, rótulo pequeno + valor, seta em chip escuro.
 *  O <select> nativo fica transparente por cima (teclado, leitor de tela e a lista do sistema continuam). */
function SelectJogo({ icone, rotulo, valor, raridade, children }: { icone: ReactNode; rotulo: string; valor: string; raridade?: string; children: ReactNode }) {
  return (
    <label className="colecao-select" data-raridade={raridade || undefined}>
      <span className="colecao-select-icone" aria-hidden>
        {icone}
      </span>
      <span className="colecao-select-texto" aria-hidden>
        <span className="colecao-select-rotulo">{rotulo}</span>
        <span className="colecao-select-valor">{valor}</span>
      </span>
      <span className="colecao-select-seta" aria-hidden>
        <ChevronDown strokeWidth={3.5} />
      </span>
      {children}
    </label>
  );
}

export function TelaColecao() {
  const params = useSearchParams();
  const inicial = params?.get('status');
  const [status, setStatus] = useState<Status>(inicial === 'expirado' || inicial === 'todos' ? inicial : 'ativo');
  const [tipo, setTipo] = useState('');
  const [raridade, setRaridade] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('slot');
  const agora = useAgora();
  const abrirCarta = useUi((s) => s.abrirCarta);

  const q = useInfiniteQuery({
    queryKey: ['entidades', status, tipo, raridade, ordem],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const busca = new URLSearchParams({ status, ordenar: ordem, limit: '24' });
      if (tipo) busca.set('tipo', tipo);
      if (raridade) busca.set('raridade', raridade);
      if (pageParam) busca.set('cursor', pageParam);
      return (await chamar<ListaEntidades>('GET', `/entities?${busca}`)).data;
    },
    getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined,
  });

  const itens = q.data?.pages.flatMap((p) => p.itens) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;

  return (
    // mesmo respiro da .tela (4px 16px 28px), mas mais larga: a grade chega a 4 colunas no tablet e 5 no desktop
    <div className="colecao-tela mx-auto w-full px-4 pb-7 pt-1">
      {/* cabeçalho padrão das telas (Loja, Ajustes): ícone da aba + título contornado; contador à direita */}
      <div className="tela-cabeca">
        <IconeColecao className="tela-cabeca-icone" />
        <h1 className="titulo-tela">Coleção</h1>
        {!q.isLoading && itens.length > 0 && (
          <div className="tela-cabeca-acao">
            <span className="pilula numeros">
              {total} {total === 1 ? 'carta' : 'cartas'}
            </span>
          </div>
        )}
      </div>
      {/* controles: no celular empilhados (abas, espécies, selects); no desktop abas e selects dividem a 1ª linha */}
      <div className="colecao-controles">
        <div className="colecao-abas" role="tablist" aria-label="Situação">
          {(['ativo', 'expirado', 'todos'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={status === s}
              className={cx('botao botao-p', status === s ? 'botao-compra' : 'botao-secundario')}
              onClick={() => setStatus(s)}
            >
              {s === 'ativo' ? 'Ativos' : s === 'expirado' ? 'Aposentados' : 'Todos'}
            </button>
          ))}
        </div>
        <div className="colecao-especies" role="group" aria-label="Filtrar por espécie">
          <button type="button" className="colecao-especie" aria-pressed={tipo === ''} onClick={() => setTipo('')}>
            <span className="colecao-especie-todas">Todas</span>
          </button>
          {TIPOS.map((t) => {
            const r = ANIMAIS[t].raridade;
            return (
              <button
                key={t}
                type="button"
                className="colecao-especie"
                data-raridade={r}
                aria-pressed={tipo === t}
                aria-label={NOME_TIPO[t]}
                title={NOME_TIPO[t]}
                onClick={() => setTipo(tipo === t ? '' : t)}
              >
                <FiguraAnimal tipo={t} ninho={false} detalhe="p" />
                {/* nome só aparece no desktop (chip deitado: retrato + nome + gemas) */}
                <span className="colecao-especie-nome" aria-hidden>
                  {NOME_TIPO[t]}
                </span>
                <GemasCarta raridade={r} quantidade={GEMAS_RARIDADE[r]} />
              </button>
            );
          })}
        </div>
        <div className="colecao-filtros">
          <SelectJogo icone={<Funnel strokeWidth={3} />} rotulo="Raridade" raridade={raridade} valor={raridade ? NOME_RARIDADE[raridade as keyof typeof NOME_RARIDADE] : 'Todas'}>
            <select value={raridade} onChange={(e) => setRaridade(e.target.value)} aria-label="Filtrar por raridade">
              <option value="">Raridade: todas</option>
              {RARIDADES.map((r) => (
                <option key={r} value={r}>
                  {NOME_RARIDADE[r]}
                </option>
              ))}
            </select>
          </SelectJogo>
          <SelectJogo icone={<ArrowDownUp strokeWidth={3} />} rotulo="Ordem" valor={ROTULO_ORDEM[ordem]}>
            <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} aria-label="Ordenar">
              {(Object.keys(ROTULO_ORDEM) as Ordem[]).map((o) => (
                <option key={o} value={o}>
                  {ROTULO_ORDEM[o]}
                </option>
              ))}
            </select>
          </SelectJogo>
        </div>
      </div>

      {q.isLoading ? (
        <div className="colecao-grade" role="status" aria-busy="true">
          <span className="sr-only">Carregando cartas…</span>
          {Array.from({ length: 6 }, (_, i) => (
            <EsqueletoCarta key={i} indice={i} />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <div className="colecao-vazio painel mt-2 flex flex-col items-center px-6 pb-6 pt-4 text-center">
          <FiguraAnimal tipo={status === 'expirado' ? 'galinha' : null} humor="aposentado" detalhe="g" />
          <p className="mt-1 font-titulo text-xl text-texto">{status === 'expirado' ? 'Ninguém se aposentou ainda. 🌄' : 'Nenhum animal por aqui. Que tal girar a roleta?'}</p>
          {status !== 'expirado' && (
            <Link href="/roleta" className="botao botao-compra mt-4">
              Ir para a roleta
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="colecao-grade">
            {itens.map((e, i) => (
              <button
                key={e.id}
                type="button"
                className="colecao-item"
                style={{ '--i': i % 24 } as CSSProperties}
                onClick={() => abrirCarta(e.id)}
              >
                <Carta e={e} agora={agora} compacta />
              </button>
            ))}
          </div>
          {q.hasNextPage && (
            <div className="mt-5 text-center">
              <button type="button" className="botao botao-secundario" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                {q.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

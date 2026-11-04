'use client';

// Fila do atendimento: filtro (abertas, resolvidas, todas), busca por nome ou e-mail e a lista de conversas
// (não lidas primeiro). Cada linha mostra a prévia da última mensagem, quem falou por último, há quanto tempo e
// o contador de não lidas. Atualiza sozinha a cada 10 s.
import type { AdminConversaLinhaDTO, AdminListaConversasDTO } from '@galinheiro/api-contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Inbox, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { chamar } from '../../api';
import { cx } from '../../util';
import { BotaoAdm, Carregando, fmt, mensagemAdmin, Selo, Vazio } from '../ui';
import { Avatar } from './Avatar';
import { useAgoraLento } from './util';

export type FiltroFila = 'aberta' | 'resolvida' | 'todas';

const FILTROS: { valor: FiltroFila; rotulo: string }[] = [
  { valor: 'aberta', rotulo: 'Abertas' },
  { valor: 'resolvida', rotulo: 'Resolvidas' },
  { valor: 'todas', rotulo: 'Todas' },
];

export const chaveFila = (status: FiltroFila, q: string) => ['admin', 'suporte', 'fila', status, q] as const;

/** Valor que só muda depois de `ms` sem alterações (busca enquanto digita). */
function useAtrasado<T>(valor: T, ms: number): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = window.setTimeout(() => setAtrasado(valor), ms);
    return () => window.clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}

/** Prefixo de quem falou por último ("Equipe:", "Automática:"); a fala do membro vai sem prefixo. */
function prefixoAutor(autor: AdminConversaLinhaDTO['ultimoAutor']): string | null {
  if (autor === 'admin') return 'Equipe';
  if (autor === 'sistema') return 'Automática';
  return null;
}

function LinhaConversa({ c, ativa, agora, aoEscolher }: { c: AdminConversaLinhaDTO; ativa: boolean; agora: number; aoEscolher: (id: string) => void }) {
  // a conversa aberta ao lado já está sendo lida: o contador dela some na hora
  const naoLidas = ativa ? 0 : c.naoLidas;
  const prefixo = prefixoAutor(c.ultimoAutor);
  // o membro falou por último (ou só a resposta automática respondeu): ainda espera a equipe
  const aguardando = c.status === 'aberta' && c.ultimoAutor !== 'admin' && c.ultimoAutor !== null;
  const nome = c.nome || 'Membro sem nome';
  return (
    <li>
      <button
        type="button"
        className={cx('atd-linha', ativa && 'atd-linha-ativa')}
        data-nao-lida={naoLidas > 0 || undefined}
        aria-current={ativa ? 'true' : undefined}
        onClick={() => aoEscolher(c.id)}
      >
        <Avatar nome={nome} semente={c.contaId} />
        <span className="atd-linha-miolo">
          <span className="atd-linha-topo">
            <span className="atd-linha-nome">{nome}</span>
            <time className="atd-linha-tempo" dateTime={c.ultimaMensagemEm ?? undefined} title={c.ultimaMensagemEm ? fmt.dataHora(c.ultimaMensagemEm) : undefined}>
              {fmt.relativo(c.ultimaMensagemEm, agora)}
            </time>
          </span>
          <span className="atd-linha-base">
            <span className="atd-linha-previa">
              {prefixo && <span className="atd-linha-autor">{prefixo}: </span>}
              {c.ultimaMensagem ?? 'Sem mensagens ainda'}
            </span>
            {naoLidas > 0 ? (
              <span className="atd-linha-contador" aria-label={`${naoLidas} ${naoLidas === 1 ? 'mensagem não lida' : 'mensagens não lidas'}`}>
                {naoLidas > 99 ? '99+' : naoLidas}
              </span>
            ) : c.status === 'resolvida' ? (
              <Selo>Resolvida</Selo>
            ) : aguardando ? (
              <span className="atd-linha-aguardando" title="O membro espera uma resposta da equipe">
                Aguardando
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}

export function FilaConversas({ selecionada, aoEscolher, aoResumo }: {
  selecionada: string | null;
  aoEscolher: (id: string) => void;
  /** totais da fila (abertas e não lidas) para o cabeçalho da página */
  aoResumo: (r: { abertas: number; naoLidas: number }) => void;
}) {
  const [status, setStatus] = useState<FiltroFila>('aberta');
  const [busca, setBusca] = useState('');
  const q = useAtrasado(busca.trim(), 300);
  const agora = useAgoraLento();
  const fila = useQuery({
    queryKey: chaveFila(status, q),
    queryFn: async ({ signal }) => {
      const p = new URLSearchParams({ status });
      if (q) p.set('q', q);
      return (await chamar<AdminListaConversasDTO>('GET', `/api/admin/suporte?${p}`, { sinal: signal })).data;
    },
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
  });

  const abertas = fila.data?.abertas;
  const naoLidasTotal = fila.data?.naoLidasTotal;
  useEffect(() => {
    if (abertas !== undefined && naoLidasTotal !== undefined) aoResumo({ abertas, naoLidas: naoLidasTotal });
  }, [abertas, naoLidasTotal, aoResumo]);

  const itens = fila.data?.itens ?? [];
  const buscando = q.length > 0;

  return (
    <section className="adm-cartao atd-fila" aria-label="Fila de conversas">
      <div className="atd-fila-topo">
        <div className="atd-segmentos" role="group" aria-label="Filtrar conversas">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              className="atd-segmento"
              aria-pressed={status === f.valor}
              onClick={() => setStatus(f.valor)}
            >
              {f.rotulo}
              {f.valor === 'aberta' && abertas !== undefined && <span className="atd-segmento-num">{abertas}</span>}
            </button>
          ))}
        </div>
        <div className="atd-busca">
          <Search className="atd-busca-icone" aria-hidden />
          <input
            type="search"
            className="adm-input"
            placeholder="Nome ou e-mail"
            aria-label="Buscar conversa por nome ou e-mail"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            maxLength={100}
          />
          {busca && (
            <button type="button" className="atd-busca-limpar" onClick={() => setBusca('')} aria-label="Limpar busca">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="atd-fila-lista" aria-busy={fila.isFetching && !fila.data}>
        {fila.isPending ? (
          <Carregando texto="Carregando a fila…" />
        ) : fila.isError && !fila.data ? (
          <Vazio titulo="Não deu para carregar a fila">
            <p>{mensagemAdmin(fila.error)}</p>
            <BotaoAdm tamanho="p" className="mt-3" onClick={() => void fila.refetch()}>
              Tentar de novo
            </BotaoAdm>
          </Vazio>
        ) : itens.length === 0 ? (
          <div className="atd-fila-vazia">
            <Inbox className="h-8 w-8" aria-hidden />
            {buscando ? (
              <Vazio titulo="Nada encontrado">Nenhuma conversa com “{q}” neste filtro.</Vazio>
            ) : status === 'aberta' ? (
              <Vazio titulo="Nenhuma conversa aberta">Tudo em dia! Quando um membro escrever pelo jogo, a conversa aparece aqui.</Vazio>
            ) : status === 'resolvida' ? (
              <Vazio titulo="Nenhuma conversa resolvida">As conversas marcadas como resolvidas ficam guardadas aqui.</Vazio>
            ) : (
              <Vazio titulo="Nenhuma conversa ainda">Quando um membro escrever pelo jogo, a conversa aparece aqui.</Vazio>
            )}
          </div>
        ) : (
          <ul className="atd-linhas">
            {itens.map((c) => (
              <LinhaConversa key={c.id} c={c} ativa={c.id === selecionada} agora={agora} aoEscolher={aoEscolher} />
            ))}
          </ul>
        )}
      </div>
      {fila.isError && fila.data && (
        <p className="atd-fila-aviso" role="status">
          Sem conexão com o servidor — mostrando a última lista.
        </p>
      )}
    </section>
  );
}

'use client';

// Escolha dos membros que verão o popup: busca por nome, e-mail ou telefone (lista de usuários do painel) e os
// escolhidos em "chips" removíveis. Ao editar um popup, os nomes dos já escolhidos vêm numa consulta só (por ids).
import { formatarTelefone, type AdminListaUsuariosDTO } from '@galinheiro/api-contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Check, Plus, Search, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { chamar } from '../../api';
import { Avatar } from '../atendimento/Avatar';
import { mensagemAdmin } from '../ui';

export interface MembroResumo {
  id: string;
  nome: string;
  email: string;
  telefone: string;
}

/** Valor que só muda depois de `ms` sem alterações (busca enquanto digita). */
export function useAtrasado<T>(valor: T, ms: number): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = window.setTimeout(() => setAtrasado(valor), ms);
    return () => window.clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}

/** Ao editar, os nomes são buscados até este tanto de uma vez (o limite da lista de usuários). */
const MAX_NOMES = 100;

export function EscolherMembros({ ids, aoMudar, erro, idCampo }: {
  ids: string[];
  aoMudar: (ids: string[]) => void;
  erro?: string | null;
  idCampo: string;
}) {
  const [busca, setBusca] = useState('');
  const q = useAtrasado(busca.trim(), 300);
  const [conhecidos, setConhecidos] = useState<Record<string, MembroResumo>>({});
  const idResultados = useId();

  const resultados = useQuery({
    queryKey: ['admin', 'popups', 'busca-membros', q],
    queryFn: async ({ signal }) =>
      (await chamar<AdminListaUsuariosDTO>('GET', `/api/admin/usuarios?q=${encodeURIComponent(q)}&porPagina=8&ordenar=nome`, { sinal: signal })).data,
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const faltam = ids.filter((id) => !conhecidos[id]).slice(0, MAX_NOMES);
  const lote = useQuery({
    queryKey: ['admin', 'popups', 'membros', faltam],
    queryFn: async ({ signal }) =>
      (await chamar<AdminListaUsuariosDTO>('GET', `/api/admin/usuarios?ids=${faltam.join(',')}&porPagina=${MAX_NOMES}`, { sinal: signal })).data.itens,
    enabled: faltam.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const doLote = new Map((lote.data ?? []).map((u) => [u.id, u]));

  const escolhidos = new Set(ids);
  const alternar = (m: MembroResumo) => {
    if (escolhidos.has(m.id)) {
      aoMudar(ids.filter((id) => id !== m.id));
    } else {
      setConhecidos((c) => ({ ...c, [m.id]: m }));
      aoMudar([...ids, m.id]);
    }
  };
  const remover = (id: string) => aoMudar(ids.filter((x) => x !== id));

  const rotuloChip = (id: string): { nome: string; detalhe?: string; removido?: boolean } => {
    const m = conhecidos[id] ?? doLote.get(id);
    if (m) return { nome: m.nome, detalhe: m.email };
    if (!faltam.includes(id)) return { nome: `Membro ${id.slice(0, 8)}` };
    if (lote.isError) return { nome: 'Membro escolhido' };
    if (lote.isFetching || lote.isPending) return { nome: 'Carregando…' };
    // a lista não trouxe: a conta foi excluída (ou deixou de ser membro)
    return { nome: 'Membro removido', removido: true };
  };

  const lista = resultados.data?.itens ?? [];
  const buscando = q.length >= 2;

  return (
    <div className="pop-membros">
      <div className="pop-membros-busca">
        <Search className="pop-membros-lupa" aria-hidden />
        <input
          id={idCampo}
          type="search"
          className="adm-input"
          placeholder="Nome, e-mail ou telefone"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            // Enter aqui não envia o formulário: escolhe o 1º resultado ainda não escolhido
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const primeiro = lista.find((u) => !escolhidos.has(u.id));
            if (primeiro) alternar(primeiro);
          }}
          maxLength={100}
          autoComplete="off"
          aria-controls={idResultados}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${idCampo}-erro` : undefined}
        />
      </div>

      <div id={idResultados} className="pop-membros-resultados" aria-live="polite">
        {!buscando ? (
          busca.trim().length === 1 && <p className="pop-membros-dica">Digite pelo menos 2 letras.</p>
        ) : resultados.isPending ? (
          <p className="pop-membros-dica">Buscando…</p>
        ) : resultados.isError ? (
          <p className="pop-membros-dica pop-membros-erro">{mensagemAdmin(resultados.error)}</p>
        ) : lista.length === 0 ? (
          <p className="pop-membros-dica">Ninguém encontrado com “{q}”.</p>
        ) : (
          <ul className="pop-resultados">
            {lista.map((u) => {
              const escolhido = escolhidos.has(u.id);
              return (
                <li key={u.id}>
                  <button type="button" className="pop-resultado" aria-pressed={escolhido} onClick={() => alternar(u)}>
                    <Avatar nome={u.nome} semente={u.id} tamanho="p" />
                    <span className="pop-resultado-quem">
                      <span className="pop-resultado-nome">{u.nome}</span>
                      <span className="pop-resultado-sub">
                        {u.email} · {formatarTelefone(u.telefone)}
                      </span>
                    </span>
                    <span className="pop-resultado-acao">
                      {escolhido ? <Check className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                      {escolhido ? 'Escolhido' : 'Adicionar'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="pop-escolhidos">
        <div className="pop-escolhidos-topo">
          <span>
            {ids.length === 0 ? 'Ninguém escolhido ainda' : ids.length === 1 ? '1 membro escolhido' : `${ids.length} membros escolhidos`}
          </span>
          {ids.length > 2 && (
            <button type="button" className="pop-link" onClick={() => aoMudar([])}>
              Limpar todos
            </button>
          )}
        </div>
        {ids.length > 0 && (
          <ul className="pop-chips" aria-label="Membros escolhidos">
            {ids.map((id) => {
              const r = rotuloChip(id);
              return (
                <li key={id} className="pop-chip" data-removido={r.removido || undefined} title={r.detalhe}>
                  <Avatar nome={r.nome} semente={id} tamanho="p" className="pop-chip-avatar" />
                  <span className="pop-chip-nome">{r.nome}</span>
                  <button type="button" className="pop-chip-remover" onClick={() => remover(id)} aria-label={`Remover ${r.nome}`}>
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {erro && (
        <p id={`${idCampo}-erro`} className="adm-campo-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}

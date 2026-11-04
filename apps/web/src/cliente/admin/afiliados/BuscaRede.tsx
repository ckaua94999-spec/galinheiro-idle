'use client';

// Busca de membro para abrir a rede de qualquer um (/admin/afiliados/[id]): campo com espera de digitação
// (nome, e-mail ou telefone, pela mesma busca da lista de usuários) e lista de sugestões navegável pelo teclado
// (↑ ↓ Enter Esc). Ctrl/⌘ + clique abre em outra aba.
import type { AdminListaUsuariosDTO } from '@galinheiro/api-contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Ban, ChevronRight, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { chamar } from '../../api';
import { Selo, mensagemAdmin } from '../ui';
import { Avatar } from '../usuarios/comum';

const MAX_SUGESTOES = 8;

export function BuscaRede() {
  const router = useRouter();
  const id = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState('');
  const [termo, setTermo] = useState('');
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(-1);

  // espera a pessoa parar de digitar
  useEffect(() => {
    const t = window.setTimeout(() => setTermo(texto.trim()), 300);
    return () => window.clearTimeout(t);
  }, [texto]);
  useEffect(() => setAtivo(-1), [termo]);

  const busca = useQuery({
    queryKey: ['admin', 'usuarios', 'lista', { q: termo, porPagina: MAX_SUGESTOES, origem: 'afiliados' }],
    queryFn: async ({ signal }) =>
      (
        await chamar<AdminListaUsuariosDTO>('GET', `/api/admin/usuarios?q=${encodeURIComponent(termo)}&porPagina=${MAX_SUGESTOES}&ordenar=nome`, {
          sinal: signal,
        })
      ).data,
    enabled: termo.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // fecha ao clicar fora
  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberta(false);
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberta]);

  const itens = termo.length >= 2 ? (busca.data?.itens ?? []) : [];
  const total = busca.data?.total ?? 0;
  const mostrar = aberta && texto.trim().length >= 2;
  const listaId = `${id}-lista`;
  const opcaoId = (i: number) => `${id}-op-${i}`;

  const abrir = (contaId: string, e?: { ctrlKey: boolean; metaKey: boolean }) => {
    const destino = `/admin/afiliados/${contaId}`;
    if (e && (e.ctrlKey || e.metaKey)) {
      window.open(destino, '_blank');
      return;
    }
    setAberta(false);
    router.push(destino);
  };

  const tecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!itens.length) return;
      e.preventDefault();
      setAberta(true);
      const passo = e.key === 'ArrowDown' ? 1 : -1;
      setAtivo((a) => (a + passo + itens.length) % itens.length);
    } else if (e.key === 'Enter') {
      const alvo = itens[ativo] ?? (itens.length === 1 ? itens[0] : undefined);
      if (alvo) {
        e.preventDefault();
        abrir(alvo.id, e);
      }
    } else if (e.key === 'Escape') {
      if (mostrar) {
        e.preventDefault();
        setAberta(false);
      } else if (texto) {
        setTexto('');
      }
    }
  };

  let estado: string | null = null;
  if (mostrar) {
    if (termo !== texto.trim() || (busca.isFetching && !busca.data)) estado = 'Buscando…';
    else if (busca.isError) estado = mensagemAdmin(busca.error);
    else if (!itens.length) estado = `Ninguém com “${termo}” no nome, e-mail ou telefone.`;
  }

  return (
    <div ref={caixa} className="afi-busca">
      <label className="adm-us-busca afi-busca-campo">
        <Search className="adm-us-busca-icone" aria-hidden />
        <span className="sr-only">Buscar membro para abrir a rede</span>
        <input
          ref={campo}
          type="search"
          className="adm-input"
          placeholder="Nome, e-mail ou telefone"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAberta(true);
          }}
          onFocus={() => setAberta(true)}
          onKeyDown={tecla}
          maxLength={100}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={mostrar && itens.length > 0}
          aria-controls={listaId}
          aria-activedescendant={mostrar && ativo >= 0 ? opcaoId(ativo) : undefined}
        />
        {texto && (
          <button
            type="button"
            className="adm-us-busca-limpar"
            onClick={() => {
              setTexto('');
              campo.current?.focus();
            }}
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </label>

      {mostrar && (
        <div className="afi-busca-painel">
          {itens.length > 0 && (
            <ul id={listaId} role="listbox" aria-label="Membros encontrados" className="afi-busca-lista">
              {itens.map((u, i) => (
                <li
                  key={u.id}
                  id={opcaoId(i)}
                  role="option"
                  aria-selected={i === ativo}
                  className="afi-busca-item"
                  onPointerMove={() => setAtivo(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => abrir(u.id, e)}
                >
                  <Avatar id={u.id} nome={u.nome} tamanho="p" />
                  <span className="min-w-0 flex-1">
                    <span className="afi-busca-nome">
                      {u.nome}
                      {u.bloqueado && (
                        <Selo tom="vermelho">
                          <Ban className="h-3 w-3" aria-hidden /> Bloqueado
                        </Selo>
                      )}
                    </span>
                    <span className="afi-busca-email">{u.email}</span>
                  </span>
                  <span className="afi-busca-ir" aria-hidden>
                    Ver rede <ChevronRight className="h-4 w-4" />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {(estado || total > itens.length) && (
            <p className="afi-busca-estado" role="status">
              {estado ?? `Mostrando ${itens.length} de ${total}. Digite mais para afinar a busca.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

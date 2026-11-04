'use client';

// Usuários do painel: busca (nome, e-mail ou telefone) com espera de digitação, filtros, ordenação e página
// refletidos na URL (dá para compartilhar o link), tabela no desktop e cartões no celular. Cada linha abre a
// ficha do membro (/admin/usuarios/[id]), onde ficam as ações.
import { formatarTelefone, type AdminListaUsuariosDTO, type AdminUsuarioLinhaDTO } from '@galinheiro/api-contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Ban, ChevronLeft, ChevronRight, MessagesSquare, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { chamar } from '../../api';
import { Moeda } from '../../arte/Icones';
import { cx } from '../../util';
import { CabecalhoAdm } from '../ShellAdmin';
import { BotaoAdm, Cartao, Carregando, Selo, Vazio, fmt, mensagemAdmin } from '../ui';
import { Avatar, UltimoAcesso, lembrarLista, plural, useAgoraLento } from './comum';

type Filtro = 'todos' | 'ativos7d' | 'inativos7d' | 'bloqueados' | 'admins';
type Ordem = 'recentes' | 'acesso' | 'moedas' | 'nome';
interface Busca { q: string; filtro: Filtro; ordenar: Ordem; pagina: number; porPagina: number }

const FILTROS: { valor: Filtro; rotulo: string; dica: string }[] = [
  { valor: 'todos', rotulo: 'Todos', dica: 'Todos os membros' },
  { valor: 'ativos7d', rotulo: 'Ativos', dica: 'Entraram nos últimos 7 dias' },
  { valor: 'inativos7d', rotulo: 'Inativos', dica: 'Sem entrar há mais de 7 dias' },
  { valor: 'bloqueados', rotulo: 'Bloqueados', dica: 'Contas bloqueadas pela equipe' },
  { valor: 'admins', rotulo: 'Administradores', dica: 'Quem tem acesso a este painel' },
];
const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: 'recentes', rotulo: 'Cadastro mais recente' },
  { valor: 'acesso', rotulo: 'Último acesso' },
  { valor: 'moedas', rotulo: 'Mais moedas' },
  { valor: 'nome', rotulo: 'Nome (A–Z)' },
];
const POR_PAGINA = [25, 50, 100] as const;
const PADRAO: Busca = { q: '', filtro: 'todos', ordenar: 'recentes', pagina: 1, porPagina: 25 };

function lerBusca(p: { get(chave: string): string | null }): Busca {
  const filtro = p.get('filtro');
  const ordenar = p.get('ordenar');
  const porPagina = Number(p.get('porPagina'));
  return {
    q: (p.get('q') ?? '').trim().slice(0, 100),
    filtro: FILTROS.some((f) => f.valor === filtro) ? (filtro as Filtro) : 'todos',
    ordenar: ORDENS.some((o) => o.valor === ordenar) ? (ordenar as Ordem) : 'recentes',
    pagina: Math.min(100_000, Math.max(1, Math.floor(Number(p.get('pagina'))) || 1)),
    porPagina: (POR_PAGINA as readonly number[]).includes(porPagina) ? porPagina : 25,
  };
}

/** Busca → querystring da API (sempre completa) ou da página (só o que difere do padrão). */
function paraQuery(b: Busca, completa: boolean): string {
  const p = new URLSearchParams();
  if (b.q) p.set('q', b.q);
  for (const chave of ['filtro', 'ordenar', 'pagina', 'porPagina'] as const) {
    if (completa || b[chave] !== PADRAO[chave]) p.set(chave, String(b[chave]));
  }
  return p.toString();
}

async function buscarLista(b: Busca, sinal?: AbortSignal): Promise<AdminListaUsuariosDTO> {
  return (await chamar<AdminListaUsuariosDTO>('GET', `/api/admin/usuarios?${paraQuery(b, true)}`, { sinal })).data;
}

/** Números das páginas com reticências: 1 … 4 5 6 … 12 */
function paginasVisiveis(atual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const conjunto = new Set([1, total, atual - 1, atual, atual + 1]);
  if (atual <= 3) [2, 3, 4].forEach((n) => conjunto.add(n));
  if (atual >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => conjunto.add(n));
  const lista = [...conjunto].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const saida: (number | '…')[] = [];
  lista.forEach((n, i) => {
    const anterior = lista[i - 1];
    if (anterior !== undefined && n - anterior > 1) saida.push('…');
    saida.push(n);
  });
  return saida;
}

// ---------------------------------------------------------------- peças da linha

function SelosMembro({ u }: { u: AdminUsuarioLinhaDTO }) {
  return (
    <>
      {u.papel === 'admin' && (
        <Selo tom="roxo">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Admin
        </Selo>
      )}
      {u.bloqueado && (
        <span title={u.bloqueioMotivo ? `Motivo: ${u.bloqueioMotivo}` : undefined}>
          <Selo tom="vermelho">
            <Ban className="h-3.5 w-3.5" aria-hidden />
            Bloqueado
          </Selo>
        </span>
      )}
    </>
  );
}

function NaoLidas({ n }: { n: number }) {
  if (n <= 0) return <span className="adm-us-traco">—</span>;
  return (
    <span className="adm-us-naolidas" title={`${plural(n, 'mensagem não lida', 'mensagens não lidas')} no atendimento`}>
      <MessagesSquare className="h-3.5 w-3.5" aria-hidden />
      {n > 99 ? '99+' : n}
      <span className="sr-only"> não lidas</span>
    </span>
  );
}

function CabecalhoOrdenavel({ rotulo, ordem, atual, aoOrdenar, alinhar }: {
  rotulo: string;
  ordem: Ordem;
  atual: Ordem;
  aoOrdenar: (o: Ordem) => void;
  alinhar?: 'direita';
}) {
  const ativo = atual === ordem;
  const Seta = ordem === 'nome' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      className={cx('adm-us-th-ordenar', alinhar === 'direita' && 'justify-end')}
      data-ativo={ativo || undefined}
      onClick={() => aoOrdenar(ativo ? 'recentes' : ordem)}
      title={ativo ? 'Voltar à ordem por cadastro' : `Ordenar por ${rotulo.toLowerCase()}`}
    >
      {rotulo}
      <Seta className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

// ---------------------------------------------------------------- paginação

function Paginacao({ pagina, total, porPagina, aoIr, aoMudarTamanho }: {
  pagina: number;
  total: number;
  porPagina: number;
  aoIr: (p: number) => void;
  aoMudarTamanho: (n: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const de = total ? (pagina - 1) * porPagina + 1 : 0;
  const ate = Math.min(total, pagina * porPagina);
  return (
    <nav className="adm-us-paginacao" aria-label="Paginação da lista de membros">
      <p className="adm-us-paginacao-info">
        <strong>
          {fmt.int(de)}–{fmt.int(ate)}
        </strong>{' '}
        de {fmt.int(total)}
      </p>
      {paginas > 1 && (
        <div className="adm-us-paginas">
          <button type="button" className="adm-us-pagina" disabled={pagina <= 1} onClick={() => aoIr(pagina - 1)} aria-label="Página anterior">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          {paginasVisiveis(pagina, paginas).map((n, i) =>
            n === '…' ? (
              <span key={`r${i}`} className="adm-us-reticencias" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                className="adm-us-pagina"
                aria-current={n === pagina ? 'page' : undefined}
                aria-label={`Página ${n}`}
                onClick={() => aoIr(n)}
              >
                {n}
              </button>
            ),
          )}
          <button type="button" className="adm-us-pagina" disabled={pagina >= paginas} onClick={() => aoIr(pagina + 1)} aria-label="Próxima página">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      <select
        className="adm-input adm-us-por-pagina"
        value={porPagina}
        onChange={(e) => aoMudarTamanho(Number(e.target.value))}
        aria-label="Membros por página"
      >
        {POR_PAGINA.map((n) => (
          <option key={n} value={n}>
            {n} por página
          </option>
        ))}
      </select>
    </nav>
  );
}

// ---------------------------------------------------------------- tela

export function TelaUsuarios() {
  const params = useSearchParams();
  const router = useRouter();
  const agora = useAgoraLento();
  const busca = lerBusca(params);
  const { q, filtro, ordenar, pagina, porPagina } = busca;
  const textoUrl = params.toString();

  // Atualiza a URL sem recarregar a página (o Next sincroniza o useSearchParams com o history nativo).
  const mudar = useCallback(
    (novo: Partial<Busca>) => {
      const atual = lerBusca(new URLSearchParams(window.location.search));
      // mudar busca, filtro, ordem ou tamanho volta para a página 1
      const proxima: Busca = { ...atual, pagina: 1, ...novo };
      const s = paraQuery(proxima, false);
      // estado null: com o estado do próprio Next, ele acha que a chamada é dele e não sincroniza os parâmetros
      window.history.replaceState(null, '', s ? `/admin/usuarios?${s}` : '/admin/usuarios');
    },
    [],
  );

  // --- busca com espera de digitação; o campo acompanha a URL quando ela muda por fora (voltar/link)
  const [texto, setTexto] = useState(q);
  const enviado = useRef(q);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (q !== enviado.current) {
      enviado.current = q;
      setTexto(q);
    }
  }, [q]);
  useEffect(() => {
    const alvo = texto.trim();
    if (alvo === enviado.current) return;
    const t = window.setTimeout(() => {
      enviado.current = alvo;
      mudar({ q: alvo });
    }, 350);
    return () => window.clearTimeout(t);
  }, [texto, mudar]);
  const aplicarJa = (valor: string) => {
    setTexto(valor);
    enviado.current = valor.trim();
    mudar({ q: valor.trim() });
  };

  // "/" foca a busca (como em outras ferramentas internas)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (e.key !== '/' || e.ctrlKey || e.metaKey || alvo?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      campo.current?.focus();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  useEffect(() => lembrarLista(textoUrl), [textoUrl]);

  const lista = useQuery({
    queryKey: ['admin', 'usuarios', 'lista', { q, filtro, ordenar, pagina, porPagina }],
    queryFn: ({ signal }) => buscarLista({ q, filtro, ordenar, pagina, porPagina }, signal),
    placeholderData: keepPreviousData,
  });
  const contagens = useQuery({
    queryKey: ['admin', 'usuarios', 'contagens', q],
    queryFn: async ({ signal }) => {
      const total = async (f: Filtro) => (await buscarLista({ ...PADRAO, q, filtro: f, porPagina: 5 }, signal)).total;
      const [todos, ativos7d, bloqueados, admins] = await Promise.all([total('todos'), total('ativos7d'), total('bloqueados'), total('admins')]);
      return { todos, ativos7d, inativos7d: Math.max(0, todos - ativos7d), bloqueados, admins } satisfies Record<Filtro, number>;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // página além da última (ex.: depois de excluir alguém): volta para a última que existe
  const dados = lista.data;
  useEffect(() => {
    if (dados && !lista.isPlaceholderData && !dados.itens.length && dados.total > 0 && pagina > 1) {
      mudar({ pagina: Math.ceil(dados.total / porPagina) });
    }
  }, [dados, lista.isPlaceholderData, pagina, porPagina, mudar]);

  const abrir = (e: MouseEvent, id: string) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    if (window.getSelection()?.toString()) return; // estava selecionando texto (ex.: copiar o e-mail)
    if (e.ctrlKey || e.metaKey) window.open(`/admin/usuarios/${id}`, '_blank');
    else router.push(`/admin/usuarios/${id}`);
  };

  const filtrando = !!q || filtro !== 'todos';
  const atualizando = lista.isFetching || contagens.isFetching;
  const nomeFiltro = FILTROS.find((f) => f.valor === filtro)?.rotulo.toLowerCase();

  const resumo = !dados
    ? null
    : q
      ? `${plural(dados.total, 'resultado', 'resultados')} para “${q}”${filtro !== 'todos' ? ` em ${nomeFiltro}` : ''}`
      : filtro !== 'todos'
        ? `${plural(dados.total, 'membro', 'membros')} · ${FILTROS.find((f) => f.valor === filtro)?.dica.toLowerCase()}`
        : `${plural(dados.total, 'membro cadastrado', 'membros cadastrados')}`;

  return (
    <div className="adm-us">
      <CabecalhoAdm
        titulo="Usuários"
        descricao="Encontre um membro e abra a ficha para ver tudo e agir: saldo, ovos, animais, acesso e atendimento."
        acoes={
          <BotaoAdm
            className="adm-us-so-largo"
            onClick={() => {
              void lista.refetch();
              void contagens.refetch();
            }}
            disabled={atualizando}
            title="Atualizar a lista"
          >
            <RefreshCw className={cx('h-4 w-4', atualizando && 'adm-us-girando')} aria-hidden />
            Atualizar
          </BotaoAdm>
        }
      />

      <Cartao className="adm-us-lista">
        <form
          className="adm-us-barra"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            aplicarJa(texto);
          }}
        >
          <label className="adm-us-busca">
            <Search className="adm-us-busca-icone" aria-hidden />
            <span className="sr-only">Buscar membro</span>
            <input
              ref={campo}
              type="search"
              className="adm-input"
              placeholder="Buscar por nome, e-mail ou telefone"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={100}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
            />
            {texto && (
              <button type="button" className="adm-us-busca-limpar" onClick={() => aplicarJa('')} aria-label="Limpar busca">
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
            {!texto && (
              <kbd className="adm-us-atalho" aria-hidden>
                /
              </kbd>
            )}
          </label>
          <label className="adm-us-ordem">
            <span className="adm-us-ordem-rotulo">Ordenar</span>
            <select className="adm-input" value={ordenar} onChange={(e) => mudar({ ordenar: e.target.value as Ordem })}>
              {ORDENS.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </label>
        </form>

        <div className="adm-us-filtros" role="group" aria-label="Filtrar membros">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              className="adm-us-chip"
              data-filtro={f.valor}
              aria-pressed={filtro === f.valor}
              title={f.dica}
              onClick={() => mudar({ filtro: f.valor })}
            >
              {f.rotulo}
              {contagens.data && <span className="adm-us-chip-n">{fmt.int(contagens.data[f.valor])}</span>}
            </button>
          ))}
        </div>

        <div className="adm-us-resultado" aria-live="polite">
          <span>{resumo ?? ' '}</span>
          {lista.isFetching && dados && <span className="adm-spinner adm-us-spinner-p" aria-label="Atualizando" />}
        </div>

        {lista.isPending ? (
          <Carregando texto="Carregando membros…" />
        ) : !dados ? (
          <Vazio titulo="Não deu para carregar os membros">
            <p>{mensagemAdmin(lista.error)}</p>
            <BotaoAdm className="mt-3" onClick={() => void lista.refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Tentar de novo
            </BotaoAdm>
          </Vazio>
        ) : (
          <>
            {lista.isError && (
              <p className="adm-us-erro" role="alert">
                {mensagemAdmin(lista.error)} Mostrando o último resultado carregado.
              </p>
            )}
            {!dados.itens.length ? (
              filtrando ? (
                <Vazio titulo="Ninguém encontrado">
                  <p>
                    {q ? <>Nenhum membro com “{q}” no nome, e-mail ou telefone</> : <>Nenhum membro</>}
                    {filtro !== 'todos' && <> no filtro {nomeFiltro}</>}.
                  </p>
                  <BotaoAdm
                    className="mt-3"
                    onClick={() => {
                      setTexto('');
                      enviado.current = '';
                      mudar({ q: '', filtro: 'todos' });
                    }}
                  >
                    Limpar busca e filtros
                  </BotaoAdm>
                </Vazio>
              ) : (
                <Vazio titulo="Nenhum membro cadastrado ainda">Quando alguém criar uma conta no jogo, aparece aqui.</Vazio>
              )
            ) : (
              <div className={cx('adm-us-resultados', lista.isPlaceholderData && 'adm-us-esmaecido')}>
                {/* desktop: tabela */}
                <div className="adm-us-tabela-caixa">
                  <div className="adm-tabela-rolagem">
                    <table className="adm-tabela adm-us-tabela">
                      <thead>
                        <tr>
                          <th>
                            <CabecalhoOrdenavel rotulo="Membro" ordem="nome" atual={ordenar} aoOrdenar={(o) => mudar({ ordenar: o })} />
                          </th>
                          <th className="adm-us-col-tel">Telefone</th>
                          <th className="num">
                            <CabecalhoOrdenavel rotulo="Moedas" ordem="moedas" atual={ordenar} aoOrdenar={(o) => mudar({ ordenar: o })} alinhar="direita" />
                          </th>
                          <th className="num">Nível</th>
                          <th className="num">Animais</th>
                          <th className="num">Ovos</th>
                          <th>
                            <CabecalhoOrdenavel rotulo="Último acesso" ordem="acesso" atual={ordenar} aoOrdenar={(o) => mudar({ ordenar: o })} />
                          </th>
                          <th className="text-center" title="Mensagens não lidas no atendimento">
                            Suporte
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.itens.map((u) => (
                          <tr key={u.id} className="adm-us-linha" data-bloqueado={u.bloqueado || undefined} onClick={(e) => abrir(e, u.id)}>
                            <td>
                              <div className="adm-us-membro">
                                <Avatar id={u.id} nome={u.nome} tamanho="p" />
                                <div className="min-w-0">
                                  <div className="adm-us-membro-linha">
                                    <Link href={`/admin/usuarios/${u.id}`} className="adm-us-nome">
                                      {u.nome}
                                    </Link>
                                    <SelosMembro u={u} />
                                  </div>
                                  <p className="adm-us-email">{u.email}</p>
                                  <p className="adm-us-tel adm-us-tel-mini">{formatarTelefone(u.telefone)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="adm-us-col-tel adm-us-tel">{formatarTelefone(u.telefone)}</td>
                            <td className="num">
                              <span className="adm-us-moedas">
                                <Moeda className="h-4 w-4" />
                                {fmt.moedas(u.moedasX100)}
                              </span>
                            </td>
                            <td className="num">{u.nivel}</td>
                            <td className="num">{fmt.int(u.animaisAtivos)}</td>
                            <td className="num">{fmt.int(u.ovosEstoque)}</td>
                            <td>
                              <UltimoAcesso iso={u.ultimoAcessoEm} agora={agora} />
                            </td>
                            <td className="text-center">
                              <NaoLidas n={u.suporteNaoLidas} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* celular: cartões */}
                <ul className="adm-us-cartoes">
                  {dados.itens.map((u) => (
                    <li key={u.id}>
                      <Link href={`/admin/usuarios/${u.id}`} className="adm-us-cartao-membro" data-bloqueado={u.bloqueado || undefined}>
                        <div className="adm-us-membro">
                          <Avatar id={u.id} nome={u.nome} />
                          <div className="min-w-0 flex-1">
                            <div className="adm-us-membro-linha">
                              <span className="adm-us-nome">{u.nome}</span>
                              <SelosMembro u={u} />
                            </div>
                            <p className="adm-us-email">{u.email}</p>
                            <p className="adm-us-tel">{formatarTelefone(u.telefone)}</p>
                          </div>
                          {u.suporteNaoLidas > 0 && <NaoLidas n={u.suporteNaoLidas} />}
                        </div>
                        <dl className="adm-us-cartao-numeros">
                          <div>
                            <dt>Moedas</dt>
                            <dd>
                              <Moeda className="h-4 w-4" />
                              {fmt.moedas(u.moedasX100)}
                            </dd>
                          </div>
                          <div>
                            <dt>Nível</dt>
                            <dd>{u.nivel}</dd>
                          </div>
                          <div>
                            <dt>Animais</dt>
                            <dd>{fmt.int(u.animaisAtivos)}</dd>
                          </div>
                          <div>
                            <dt>Ovos</dt>
                            <dd>{fmt.int(u.ovosEstoque)}</dd>
                          </div>
                        </dl>
                        <p className="adm-us-cartao-rodape">
                          <UltimoAcesso iso={u.ultimoAcessoEm} agora={agora} />
                          <span>membro desde {new Date(u.criadoEm).toLocaleDateString('pt-BR')}</span>
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dados.total > 0 && (
              <Paginacao
                pagina={pagina}
                total={dados.total}
                porPagina={porPagina}
                aoIr={(p) => {
                  mudar({ pagina: p });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                aoMudarTamanho={(n) => mudar({ porPagina: n })}
              />
            )}
          </>
        )}
      </Cartao>
    </div>
  );
}

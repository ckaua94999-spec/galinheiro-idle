'use client';

// Popups do painel (/admin/popups): avisos que aparecem na tela do jogo. Lista com status calculado (ativo,
// agendado, encerrado, pausado), público, frequência, período e estatísticas (pessoas, exibições, cliques e taxa
// de clique), com editar, pausar/ativar, duplicar e excluir. Criar/editar abre o formulário com prévia ao vivo.
import type { AdminPopupDTO } from '@galinheiro/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Copy, ExternalLink, Gamepad2, Link2Off, Megaphone, Pause, Pencil, Play, Plus, Repeat, Trash2, Users, UsersRound } from 'lucide-react';
import { useCallback, useState } from 'react';
import { chamar } from '../../api';
import { toast } from '../../ui';
import { useAgoraLento } from '../atendimento/util';
import { CabecalhoAdm } from '../ShellAdmin';
import { BotaoAdm, Carregando, fmt, mensagemAdmin, ModalAdm, Selo, Vazio } from '../ui';
import { CHAVE_POPUPS, ModalFormPopup, type ModoForm } from './FormPopup';
import { dataCurta, descreverLink, emQuanto, INFO_STATUS, rotuloFrequencia, statusDoPopup, taxaClique, type StatusPopup } from './util';

type Filtro = StatusPopup | 'todos';
const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'ativo', rotulo: 'Ativos' },
  { valor: 'agendado', rotulo: 'Agendados' },
  { valor: 'pausado', rotulo: 'Pausados' },
  { valor: 'encerrado', rotulo: 'Encerrados' },
];

function Miniatura({ p }: { p: AdminPopupDTO }) {
  const [falhou, setFalhou] = useState(false);
  if (p.imagemUrl && !falhou) {
    return (
      // imagem informada pela equipe (https); sem otimização do Next de propósito (domínio livre)
      // eslint-disable-next-line @next/next/no-img-element
      <img className="pop-item-thumb" src={p.imagemUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFalhou(true)} />
    );
  }
  return (
    <span className="pop-item-thumb pop-item-thumb-icone" aria-hidden>
      <Megaphone />
    </span>
  );
}

function Periodo({ p, status, agora }: { p: AdminPopupDTO; status: StatusPopup; agora: number }) {
  const inicio = Date.parse(p.inicio);
  const fim = p.fim ? Date.parse(p.fim) : null;
  const dica =
    status === 'agendado'
      ? `começa ${emQuanto(inicio - agora)}`
      : status === 'encerrado' && p.fim
        ? `terminou ${fmt.relativo(p.fim, agora)}`
        : status === 'ativo' && fim
          ? `termina ${emQuanto(fim - agora)}`
          : null;
  return (
    <>
      {dataCurta(p.inicio, agora)} → {p.fim ? dataCurta(p.fim, agora) : 'sem fim'}
      {dica && <span className="pop-item-dica"> · {dica}</span>}
    </>
  );
}

function CartaoPopup({ p, agora, ocupado, aoEditar, aoAlternar, aoDuplicar, aoExcluir }: {
  p: AdminPopupDTO;
  agora: number;
  ocupado: boolean;
  aoEditar: () => void;
  aoAlternar: () => void;
  aoDuplicar: () => void;
  aoExcluir: () => void;
}) {
  const status = statusDoPopup(p, agora);
  const info = INFO_STATUS[status];
  const link = descreverLink(p.link);
  const IconeLink = link.tipo === 'jogo' ? Gamepad2 : link.tipo === 'externo' ? ExternalLink : Link2Off;
  const taxa = taxaClique(p);
  const { pessoas, exibicoes, cliques } = p.estatisticas;
  return (
    <li className="pop-item" data-status={status}>
      <Miniatura p={p} />
      <div className="pop-item-info">
        <div className="pop-item-cabeca">
          <h2 className="pop-item-titulo">{p.titulo}</h2>
          <span title={info.ajuda}>
            <Selo tom={info.tom}>{info.rotulo}</Selo>
          </span>
        </div>
        <p className="pop-item-mensagem">{p.mensagem}</p>
        <ul className="pop-item-meta">
          <li>
            {p.publico === 'todos' ? <UsersRound aria-hidden /> : <Users aria-hidden />}
            {p.publico === 'todos' ? 'Todos os membros' : `${fmt.int(p.contas.length)} ${p.contas.length === 1 ? 'membro escolhido' : 'membros escolhidos'}`}
          </li>
          <li>
            <Repeat aria-hidden />
            {rotuloFrequencia(p.frequencia)}
          </li>
          <li>
            <IconeLink aria-hidden />
            {link.rotulo}
          </li>
          <li>
            <CalendarClock aria-hidden />
            <span>
              <Periodo p={p} status={status} agora={agora} />
            </span>
          </li>
        </ul>
      </div>
      <dl className="pop-item-numeros">
        <div title="Membros diferentes que viram o aviso">
          <dt>Pessoas</dt>
          <dd>{fmt.int(pessoas)}</dd>
        </div>
        <div title="Total de vezes que o aviso apareceu">
          <dt>Exibições</dt>
          <dd>{fmt.int(exibicoes)}</dd>
        </div>
        <div title={p.link ? 'Membros que tocaram no botão' : 'Sem link: o botão só fecha'}>
          <dt>Cliques</dt>
          <dd>{p.link ? fmt.int(cliques) : '—'}</dd>
        </div>
        <div title={p.link ? 'Dos que viram, quantos tocaram no botão' : 'Sem link: o botão só fecha'}>
          <dt>Taxa de clique</dt>
          <dd>{taxa === null ? '—' : `${fmt.dec(taxa)}%`}</dd>
        </div>
      </dl>
      <div className="pop-item-acoes">
        <BotaoAdm tamanho="p" onClick={aoEditar}>
          <Pencil className="h-4 w-4" aria-hidden /> Editar
        </BotaoAdm>
        <BotaoAdm tamanho="p" onClick={aoAlternar} disabled={ocupado} title={p.ativo ? 'Tirar do ar (não apaga)' : 'Colocar no ar'}>
          {p.ativo ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          {p.ativo ? 'Pausar' : 'Ativar'}
        </BotaoAdm>
        <BotaoAdm tamanho="p" variante="fantasma" onClick={aoDuplicar} title="Duplicar" aria-label={`Duplicar “${p.titulo}”`}>
          <Copy className="h-4 w-4" aria-hidden />
        </BotaoAdm>
        <BotaoAdm tamanho="p" variante="fantasma" className="pop-excluir" onClick={aoExcluir} title="Excluir" aria-label={`Excluir “${p.titulo}”`}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </BotaoAdm>
      </div>
    </li>
  );
}

export function TelaPopups() {
  const qc = useQueryClient();
  const agora = useAgoraLento(30_000);
  const lista = useQuery({
    queryKey: CHAVE_POPUPS,
    queryFn: async ({ signal }) => (await chamar<AdminPopupDTO[]>('GET', '/api/admin/popups', { sinal: signal })).data,
    refetchInterval: 30_000,
  });
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [form, setForm] = useState<ModoForm | null>(null);
  const [excluindo, setExcluindo] = useState<AdminPopupDTO | null>(null);
  const fecharForm = useCallback(() => setForm(null), []);
  const fecharExcluir = useCallback(() => setExcluindo(null), []);

  const trocarNaLista = (p: AdminPopupDTO) =>
    qc.setQueryData<AdminPopupDTO[]>(CHAVE_POPUPS, (atual) => atual?.map((x) => (x.id === p.id ? p : x)));

  const alternar = useMutation({
    mutationFn: async (p: AdminPopupDTO) => (await chamar<AdminPopupDTO>('PATCH', `/api/admin/popups/${p.id}`, { corpo: { ativo: !p.ativo } })).data,
    onSuccess: (p) => {
      trocarNaLista(p);
      void qc.invalidateQueries({ queryKey: CHAVE_POPUPS });
      const status = statusDoPopup(p, agora);
      if (!p.ativo) toast('Popup pausado: não aparece para ninguém.', 'sucesso');
      else if (status === 'encerrado') toast('Popup ligado, mas o período já terminou. Edite a data de fim para ele voltar.', 'info', { duracaoMs: 5000 });
      else if (status === 'agendado') toast('Popup ligado: aparece quando chegar a data de início.', 'sucesso');
      else toast('Popup ativado: já aparece no jogo.', 'sucesso');
    },
    onError: (e) => toast(mensagemAdmin(e), 'erro'),
  });

  const excluir = useMutation({
    mutationFn: async (p: AdminPopupDTO) => {
      await chamar('DELETE', `/api/admin/popups/${p.id}`);
      return p;
    },
    onSuccess: (p) => {
      qc.setQueryData<AdminPopupDTO[]>(CHAVE_POPUPS, (atual) => atual?.filter((x) => x.id !== p.id));
      void qc.invalidateQueries({ queryKey: CHAVE_POPUPS });
      setExcluindo(null);
      toast('Popup excluído.', 'sucesso');
    },
    onError: (e) => toast(mensagemAdmin(e), 'erro'),
  });

  const popups = lista.data ?? [];
  const contagem = popups.reduce<Record<Filtro, number>>(
    (acc, p) => {
      acc[statusDoPopup(p, agora)] += 1;
      return acc;
    },
    { todos: popups.length, ativo: 0, agendado: 0, pausado: 0, encerrado: 0 },
  );
  const visiveis = filtro === 'todos' ? popups : popups.filter((p) => statusDoPopup(p, agora) === filtro);

  return (
    <>
      <CabecalhoAdm
        titulo="Popups"
        descricao="Avisos que aparecem na tela do jogo — para todos ou só para os membros escolhidos."
        acoes={
          <BotaoAdm variante="primario" onClick={() => setForm({ tipo: 'novo' })}>
            <Plus className="h-4 w-4" aria-hidden /> Novo popup
          </BotaoAdm>
        }
      />

      {lista.isPending ? (
        <div className="adm-cartao">
          <Carregando texto="Carregando os popups…" />
        </div>
      ) : lista.isError && !lista.data ? (
        <div className="adm-cartao">
          <Vazio titulo="Não deu para carregar os popups">
            <p>{mensagemAdmin(lista.error)}</p>
            <BotaoAdm tamanho="p" className="mt-3" onClick={() => void lista.refetch()}>
              Tentar de novo
            </BotaoAdm>
          </Vazio>
        </div>
      ) : popups.length === 0 ? (
        <div className="adm-cartao pop-vazio">
          <span className="pop-vazio-icone" aria-hidden>
            <Megaphone />
          </span>
          <Vazio titulo="Nenhum popup ainda">
            <p>Crie um aviso para aparecer na tela do jogo: um evento na roleta, uma novidade da loja ou um recado para alguns membros.</p>
            <BotaoAdm variante="primario" className="mt-4" onClick={() => setForm({ tipo: 'novo' })}>
              <Plus className="h-4 w-4" aria-hidden /> Criar o primeiro popup
            </BotaoAdm>
          </Vazio>
        </div>
      ) : (
        <>
          <div className="pop-filtros" role="group" aria-label="Filtrar por situação">
            {FILTROS.map((f) => (
              <button key={f.valor} type="button" className="pop-filtro" aria-pressed={filtro === f.valor} onClick={() => setFiltro(f.valor)}>
                {f.rotulo}
                <span className="pop-filtro-num">{contagem[f.valor]}</span>
              </button>
            ))}
          </div>
          {visiveis.length === 0 ? (
            <div className="adm-cartao">
              <Vazio titulo={`Nenhum popup ${FILTROS.find((f) => f.valor === filtro)?.rotulo.toLowerCase() ?? ''}`}>
                <button type="button" className="pop-link" onClick={() => setFiltro('todos')}>
                  Ver todos
                </button>
              </Vazio>
            </div>
          ) : (
            <ul className="pop-lista">
              {visiveis.map((p) => (
                <CartaoPopup
                  key={p.id}
                  p={p}
                  agora={agora}
                  ocupado={alternar.isPending && alternar.variables?.id === p.id}
                  aoEditar={() => setForm({ tipo: 'editar', popup: p })}
                  aoAlternar={() => alternar.mutate(p)}
                  aoDuplicar={() => setForm({ tipo: 'duplicar', popup: p })}
                  aoExcluir={() => setExcluindo(p)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <ModalFormPopup modo={form} aoFechar={fecharForm} />

      <ModalAdm aberto={!!excluindo} titulo="Excluir popup" aoFechar={fecharExcluir}>
        {excluindo && (
          <div className="pop-confirmar">
            <p>
              Excluir <strong>“{excluindo.titulo}”</strong>? Ele some da tela de todos e as estatísticas ({fmt.int(excluindo.estatisticas.pessoas)}{' '}
              {excluindo.estatisticas.pessoas === 1 ? 'pessoa' : 'pessoas'}, {fmt.int(excluindo.estatisticas.exibicoes)}{' '}
              {excluindo.estatisticas.exibicoes === 1 ? 'exibição' : 'exibições'}) são apagadas. Não dá para desfazer.
            </p>
            {excluindo.ativo && <p className="pop-confirmar-dica">Se a ideia é só tirar do ar, use “Pausar”.</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <BotaoAdm onClick={fecharExcluir}>Cancelar</BotaoAdm>
              <BotaoAdm variante="perigo" disabled={excluir.isPending} onClick={() => excluir.mutate(excluindo)}>
                <Trash2 className="h-4 w-4" aria-hidden /> {excluir.isPending ? 'Excluindo…' : 'Excluir'}
              </BotaoAdm>
            </div>
          </div>
        )}
      </ModalAdm>
    </>
  );
}

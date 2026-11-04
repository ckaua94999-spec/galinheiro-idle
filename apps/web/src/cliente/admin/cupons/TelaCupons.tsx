'use client';

// Cupons do painel (/admin/cupons): códigos que dão TICKETS (vales do jogo) aos membros, um resgate por membro.
// Lista com o código (copiar), tickets, usos/limite com barra, validade, status calculado (ativo, agendado,
// pausado, esgotado, encerrado) e descrição interna; filtros por situação e busca; criar/editar (o código não
// muda), pausar/ativar, ver quem resgatou e excluir com confirmação (os tickets resgatados ficam com os membros).
import type { AdminCupomDTO } from '@galinheiro/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, CalendarClock, Infinity as SemLimite, Pause, Pencil, Play, Plus, Search, Trash2, UserRound, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { chamar } from '../../api';
import { toast } from '../../ui';
import { AvisoTickets, ChipTickets, IconeTicket, repetir } from '../intercambio/comum';
import { textoTickets } from '../intercambio/formato';
import { dataCurta, emQuanto } from '../popups/util';
import { CabecalhoAdm } from '../ShellAdmin';
import { BotaoAdm, Carregando, ModalAdm, Selo, Vazio, fmt, mensagemAdmin } from '../ui';
import { AcoesModal, Alerta, BotaoCopiar, ErroModal, useAgoraLento } from '../usuarios/comum';
import { ModalDetalheCupom } from './DetalheCupom';
import { ModalFormCupom, type ModoCupom } from './FormCupom';
import { CHAVE_CUPONS, INFO_STATUS, restantes, statusDoCupom, type StatusCupom } from './util';

type Filtro = StatusCupom | 'todos';
const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'ativo', rotulo: 'Ativos' },
  { valor: 'agendado', rotulo: 'Agendados' },
  { valor: 'pausado', rotulo: 'Pausados' },
  { valor: 'esgotado', rotulo: 'Esgotados' },
  { valor: 'encerrado', rotulo: 'Encerrados' },
];

function Validade({ c, status, agora }: { c: AdminCupomDTO; status: StatusCupom; agora: number }) {
  const inicio = Date.parse(c.inicio);
  const fim = c.fim ? Date.parse(c.fim) : null;
  const dica =
    status === 'agendado'
      ? `começa ${emQuanto(inicio - agora)}`
      : status === 'encerrado' && c.fim
        ? `terminou ${fmt.relativo(c.fim, agora)}`
        : (status === 'ativo' || status === 'pausado') && fim
          ? `termina ${emQuanto(fim - agora)}`
          : null;
  return (
    <>
      {dataCurta(c.inicio, agora)} → {c.fim ? dataCurta(c.fim, agora) : 'sem fim'}
      {dica && <span className="cup-item-dica"> · {dica}</span>}
    </>
  );
}

function Uso({ c }: { c: AdminCupomDTO }) {
  const sobra = restantes(c);
  const pct = c.usosMax ? Math.min(100, (c.usos / c.usosMax) * 100) : 0;
  return (
    <div className="cup-uso">
      <p className="cup-uso-num">
        <strong>{fmt.int(c.usos)}</strong>
        {c.usosMax !== null && <span className="cup-uso-de"> de {fmt.int(c.usosMax)}</span>}
        <span className="cup-uso-rotulo"> {c.usos === 1 && c.usosMax === null ? 'resgate' : 'resgates'}</span>
      </p>
      {c.usosMax !== null ? (
        <>
          <span className="cup-barra" data-cheia={sobra === 0 || undefined} role="img" aria-label={`${Math.round(pct)}% dos usos resgatados`}>
            <span style={{ width: `${pct}%` }} />
          </span>
          <p className="cup-uso-sub">{sobra === 0 ? 'nenhum uso restante' : `${fmt.int(sobra ?? 0)} ${sobra === 1 ? 'restante' : 'restantes'}`}</p>
        </>
      ) : (
        <p className="cup-uso-sub">
          <SemLimite className="h-3.5 w-3.5" aria-hidden /> sem limite de usos
        </p>
      )}
    </div>
  );
}

function CartaoCupom({ c, agora, ocupado, aoDetalhe, aoEditar, aoAlternar, aoExcluir }: {
  c: AdminCupomDTO;
  agora: number;
  ocupado: boolean;
  aoDetalhe: () => void;
  aoEditar: () => void;
  aoAlternar: () => void;
  aoExcluir: () => void;
}) {
  const status = statusDoCupom(c, agora);
  const info = INFO_STATUS[status];
  return (
    <li className="cup-item" data-status={status}>
      <div className="cup-vale" data-status={status}>
        <span className="cup-vale-rotulo">Código</span>
        <span className="cup-codigo-texto">{c.codigo}</span>
        <BotaoCopiar texto={c.codigo} rotulo="código" />
      </div>
      <div className="cup-item-info">
        <div className="cup-item-cabeca">
          <span title={info.ajuda}>
            <Selo tom={info.tom}>{info.rotulo}</Selo>
          </span>
          <span className="cup-item-vale">
            {c.beneficio === 'giros' ? <span>{c.giros} {c.giros === 1 ? 'giro' : 'giros'} na roleta</span> : <><ChipTickets n={c.tickets} tamanho="p" /> <span>por membro</span></>}
          </span>
        </div>
        {c.descricao ? <p className="cup-item-descricao">{c.descricao}</p> : <p className="cup-item-descricao cup-item-sem">Sem descrição</p>}
        <ul className="cup-item-meta">
          <li>
            <CalendarClock aria-hidden />
            <span>
              <Validade c={c} status={status} agora={agora} />
            </span>
          </li>
          <li>
            <UserRound aria-hidden />
            <span>
              criado por {c.criadoPor ?? 'admin removido'} · <span title={fmt.dataHora(c.criadoEm)}>{fmt.relativo(c.criadoEm, agora)}</span>
            </span>
          </li>
        </ul>
      </div>
      <Uso c={c} />
      <div className="cup-item-acoes">
        <BotaoAdm tamanho="p" onClick={aoDetalhe} title="Ver quem resgatou">
          <UsersRound className="h-4 w-4" aria-hidden /> Quem resgatou
          {c.usos > 0 && <span className="cup-contador">{fmt.compacto(c.usos)}</span>}
        </BotaoAdm>
        <BotaoAdm tamanho="p" onClick={aoEditar}>
          <Pencil className="h-4 w-4" aria-hidden /> Editar
        </BotaoAdm>
        <BotaoAdm tamanho="p" onClick={aoAlternar} disabled={ocupado} title={c.ativo ? 'Tirar do ar (não apaga)' : 'Voltar a valer'}>
          {c.ativo ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          {ocupado ? '…' : c.ativo ? 'Pausar' : 'Ativar'}
        </BotaoAdm>
        <BotaoAdm tamanho="p" variante="fantasma" className="itc-excluir" onClick={aoExcluir} title="Excluir" aria-label={`Excluir o cupom ${c.codigo}`}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </BotaoAdm>
      </div>
    </li>
  );
}

export function TelaCupons() {
  const qc = useQueryClient();
  const agora = useAgoraLento(30_000);
  const lista = useQuery({
    queryKey: CHAVE_CUPONS,
    queryFn: async ({ signal }) => (await chamar<AdminCupomDTO[]>('GET', '/api/admin/cupons', { sinal: signal })).data,
    // os usos mudam enquanto a tela está aberta
    refetchInterval: 30_000,
    retry: repetir,
  });
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<ModoCupom | null>(null);
  const [detalhe, setDetalhe] = useState<AdminCupomDTO | null>(null);
  const [excluindo, setExcluindo] = useState<AdminCupomDTO | null>(null);
  const fecharForm = useCallback(() => setForm(null), []);
  const fecharDetalhe = useCallback(() => setDetalhe(null), []);
  const fecharExcluir = useCallback(() => setExcluindo(null), []);

  const recarregar = () =>
    Promise.all([qc.invalidateQueries({ queryKey: CHAVE_CUPONS }), qc.invalidateQueries({ queryKey: ['admin', 'auditoria'] })]);

  const alternar = useMutation({
    mutationFn: async (c: AdminCupomDTO) => (await chamar<AdminCupomDTO>('PATCH', `/api/admin/cupons/${c.id}`, { corpo: { ativo: !c.ativo } })).data,
    onSuccess: async (c) => {
      qc.setQueryData<AdminCupomDTO[]>(CHAVE_CUPONS, (atual) => atual?.map((x) => (x.id === c.id ? c : x)));
      const status = statusDoCupom(c, agora);
      if (!c.ativo) toast(`Cupom ${c.codigo} pausado: ninguém consegue resgatar.`, 'sucesso');
      else if (status === 'encerrado') toast(`Cupom ${c.codigo} ligado, mas a validade já terminou. Edite a data de fim para ele voltar.`, 'info', { duracaoMs: 5000 });
      else if (status === 'esgotado') toast(`Cupom ${c.codigo} ligado, mas está esgotado. Aumente o limite de usos para ele voltar.`, 'info', { duracaoMs: 5000 });
      else if (status === 'agendado') toast(`Cupom ${c.codigo} ligado: vale a partir da data de início.`, 'sucesso');
      else toast(`Cupom ${c.codigo} ativado: já dá para resgatar.`, 'sucesso');
      await recarregar();
    },
    onError: (e) => toast(mensagemAdmin(e), 'erro'),
  });

  const excluir = useMutation({
    mutationFn: async (c: AdminCupomDTO) => {
      await chamar('DELETE', `/api/admin/cupons/${c.id}`);
      return c;
    },
    onSuccess: async (c) => {
      qc.setQueryData<AdminCupomDTO[]>(CHAVE_CUPONS, (atual) => atual?.filter((x) => x.id !== c.id));
      setExcluindo(null);
      toast(
        c.beneficio === 'giros'
          ? `Cupom ${c.codigo} excluído. Os giros já resgatados continuam com os membros.`
          : `Cupom ${c.codigo} excluído. Os tickets já resgatados continuam com os membros.`,
        'sucesso',
        { duracaoMs: 4500 },
      );
      await recarregar();
    },
  });

  const cupons = lista.data ?? [];
  const contagem = cupons.reduce<Record<Filtro, number>>(
    (acc, c) => {
      acc[statusDoCupom(c, agora)] += 1;
      return acc;
    },
    { todos: cupons.length, ativo: 0, agendado: 0, pausado: 0, esgotado: 0, encerrado: 0 },
  );
  const termo = busca.trim().toLowerCase();
  const visiveis = cupons.filter(
    (c) =>
      (filtro === 'todos' || statusDoCupom(c, agora) === filtro) &&
      (!termo || c.codigo.toLowerCase().includes(termo.replace(/[\s-]/g, '')) || (c.descricao ?? '').toLowerCase().includes(termo)),
  );
  const resgatesTotal = cupons.reduce((s, c) => s + c.usos, 0);
  const novo = () => setForm({ tipo: 'novo' });

  return (
    <div className="cup">
      <CabecalhoAdm
        titulo="Cupons"
        descricao={
          <>
            Códigos que dão tickets ou giros da roleta — cada membro resgata um cupom uma vez.
            {cupons.length > 0 && ` ${fmt.int(resgatesTotal)} ${resgatesTotal === 1 ? 'resgate' : 'resgates'} no total.`}
          </>
        }
        acoes={
          <>
            <Link href="/admin/intercambio" className="adm-botao">
              <ArrowLeftRight className="h-4 w-4" aria-hidden /> Intercâmbio
            </Link>
            <BotaoAdm variante="primario" onClick={novo}>
              <Plus className="h-4 w-4" aria-hidden /> Novo cupom
            </BotaoAdm>
          </>
        }
      />
      <AvisoTickets />

      {lista.isPending ? (
        <div className="adm-cartao">
          <Carregando texto="Carregando os cupons…" />
        </div>
      ) : lista.isError && !lista.data ? (
        <div className="adm-cartao">
          <Vazio titulo="Não deu para carregar os cupons">
            <p>{mensagemAdmin(lista.error)}</p>
            <BotaoAdm tamanho="p" className="mt-3" onClick={() => void lista.refetch()}>
              Tentar de novo
            </BotaoAdm>
          </Vazio>
        </div>
      ) : cupons.length === 0 ? (
        <div className="adm-cartao cup-vazio">
          <IconeTicket className="cup-vazio-ticket" />
          <Vazio titulo="Nenhum cupom ainda">
            <p>Crie um código para dar tickets ou giros da roleta — numa live, num evento ou numa campanha. Cada membro resgata uma vez.</p>
            <BotaoAdm variante="primario" className="mt-4" onClick={novo}>
              <Plus className="h-4 w-4" aria-hidden /> Criar o primeiro cupom
            </BotaoAdm>
          </Vazio>
        </div>
      ) : (
        <>
          <div className="cup-barra-filtros">
            <div className="pop-filtros cup-filtros" role="group" aria-label="Filtrar por situação">
              {FILTROS.map((f) => (
                <button key={f.valor} type="button" className="pop-filtro" aria-pressed={filtro === f.valor} onClick={() => setFiltro(f.valor)}>
                  {f.rotulo}
                  <span className="pop-filtro-num">{contagem[f.valor]}</span>
                </button>
              ))}
            </div>
            <label className="cup-busca">
              <Search className="cup-busca-lupa" aria-hidden />
              <span className="sr-only">Buscar cupom por código ou descrição</span>
              <input type="search" className="adm-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código ou descrição" />
            </label>
          </div>
          {visiveis.length === 0 ? (
            <div className="adm-cartao">
              <Vazio titulo={termo ? 'Nenhum cupom com essa busca' : `Nenhum cupom ${FILTROS.find((f) => f.valor === filtro)?.rotulo.toLowerCase() ?? ''}`}>
                <button
                  type="button"
                  className="pop-link"
                  onClick={() => {
                    setFiltro('todos');
                    setBusca('');
                  }}
                >
                  Ver todos
                </button>
              </Vazio>
            </div>
          ) : (
            // .cup-lista-caixa é o contêiner das consultas de largura; os modais ficam fora dele (position: fixed)
            <div className="cup-lista-caixa">
              <ul className="cup-lista">
                {visiveis.map((c) => (
                  <CartaoCupom
                    key={c.id}
                    c={c}
                    agora={agora}
                    ocupado={alternar.isPending && alternar.variables?.id === c.id}
                    aoDetalhe={() => setDetalhe(c)}
                    aoEditar={() => setForm({ tipo: 'editar', cupom: c })}
                    aoAlternar={() => alternar.mutate(c)}
                    aoExcluir={() => {
                      excluir.reset();
                      setExcluindo(c);
                    }}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <ModalFormCupom modo={form} existentes={cupons} aoFechar={fecharForm} />

      {detalhe && (
        <ModalDetalheCupom
          cupom={detalhe}
          agora={agora}
          aoFechar={fecharDetalhe}
          aoEditar={(c) => {
            setDetalhe(null);
            setForm({ tipo: 'editar', cupom: c });
          }}
        />
      )}

      <ModalAdm aberto={!!excluindo} titulo="Excluir cupom" aoFechar={fecharExcluir}>
        {excluindo && (
          <div className="adm-us-form">
            <div className="cup-excluir-topo">
              <div className="cup-vale" data-status={statusDoCupom(excluindo, agora)}>
                <span className="cup-vale-rotulo">Código</span>
                <span className="cup-codigo-texto">{excluindo.codigo}</span>
              </div>
              {excluindo.beneficio === 'giros'
                ? <span>{excluindo.giros} {excluindo.giros === 1 ? 'giro' : 'giros'} na roleta</span>
                : <ChipTickets n={excluindo.tickets} tamanho="p" />}
            </div>
            <p className="adm-us-texto">
              Excluir o cupom <strong>{excluindo.codigo}</strong>? O código para de funcionar na hora.
            </p>
            <ul className="adm-us-efeitos">
              <li>
                {excluindo.usos > 0 ? (
                  <>
                    {excluindo.beneficio === 'giros' ? 'Os giros' : 'Os tickets'} já resgatados <strong>continuam com os membros</strong> ({fmt.int(excluindo.usos)}{' '}
                    {excluindo.usos === 1 ? 'resgate' : 'resgates'} de {excluindo.beneficio === 'giros' ? `${fmt.int(excluindo.giros)} ${excluindo.giros === 1 ? 'giro' : 'giros'}` : textoTickets(excluindo.tickets)}): ninguém perde nada.
                  </>
                ) : (
                  'Ninguém resgatou este cupom ainda.'
                )}
              </li>
              {excluindo.usos > 0 && (
                <>
                  <li>
                    A lista de quem resgatou é apagada junto
                    {excluindo.beneficio === 'giros'
                      ? '; os giros que já entraram na roleta continuam lá.'
                      : '; o extrato de tickets de cada membro continua mostrando o cupom.'}
                  </li>
                  <li>Se um cupom novo usar o mesmo código, quem resgatou este poderá resgatar o novo também.</li>
                </>
              )}
              <li>Não dá para desfazer.</li>
            </ul>
            {excluindo.ativo && (
              <Alerta tom="azul" icone={<Pause className="h-4 w-4" />}>
                <p>
                  Se a ideia é só tirar do ar, pause:{' '}
                  {excluindo.usos > 0 ? 'o cupom e a lista de quem resgatou ficam guardados.' : 'o cupom fica guardado para ligar de novo.'}
                </p>
                <BotaoAdm
                  tamanho="p"
                  className="mt-2"
                  disabled={alternar.isPending}
                  onClick={() => {
                    alternar.mutate(excluindo);
                    setExcluindo(null);
                  }}
                >
                  <Pause className="h-4 w-4" aria-hidden /> Pausar em vez de excluir
                </BotaoAdm>
              </Alerta>
            )}
            <ErroModal texto={excluir.isError ? mensagemAdmin(excluir.error) : null} />
            <AcoesModal>
              <BotaoAdm onClick={fecharExcluir}>Cancelar</BotaoAdm>
              <BotaoAdm variante="perigo" disabled={excluir.isPending} onClick={() => excluir.mutate(excluindo)}>
                <Trash2 className="h-4 w-4" aria-hidden /> {excluir.isPending ? 'Excluindo…' : 'Excluir cupom'}
              </BotaoAdm>
            </AcoesModal>
          </div>
        )}
      </ModalAdm>
    </div>
  );
}

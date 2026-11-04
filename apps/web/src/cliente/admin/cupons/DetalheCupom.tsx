'use client';

// Detalhe de um cupom (modal): o vale com o código (copiar), a situação, os usos e a validade, e a lista de quem
// resgatou — nome (link para a ficha), e-mail, tickets recebidos e quando —, com busca quando a lista é grande.
import type { AdminCupomDetalheDTO, AdminCupomDTO } from '@galinheiro/api-contract';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, CalendarClock, Pencil, Search, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { chamar } from '../../api';
import { ChipTickets, repetir } from '../intercambio/comum';
import { textoTickets } from '../intercambio/formato';
import { dataCurta } from '../popups/util';
import { BotaoAdm, Carregando, ModalAdm, Selo, Vazio, fmt, mensagemAdmin } from '../ui';
import { Avatar, BotaoCopiar } from '../usuarios/comum';
import { CHAVE_CUPONS, INFO_STATUS, restantes, statusDoCupom } from './util';

const LIMITE_LISTA = 500;

export function ModalDetalheCupom({ cupom: inicial, agora, aoFechar, aoEditar }: {
  cupom: AdminCupomDTO;
  agora: number;
  /** estável (useCallback) */
  aoFechar: () => void;
  aoEditar: (c: AdminCupomDTO) => void;
}) {
  const detalhe = useQuery({
    queryKey: [...CHAVE_CUPONS, 'detalhe', inicial.id],
    queryFn: async ({ signal }) => (await chamar<AdminCupomDetalheDTO>('GET', `/api/admin/cupons/${inicial.id}`, { sinal: signal })).data,
    retry: repetir,
  });
  const [busca, setBusca] = useState('');
  const c = detalhe.data?.cupom ?? inicial;
  const resgates = detalhe.data?.resgates ?? [];
  const status = statusDoCupom(c, agora);
  const info = INFO_STATUS[status];
  const sobra = restantes(c);
  const termo = busca.trim().toLowerCase();
  const visiveis = termo ? resgates.filter((r) => r.nome.toLowerCase().includes(termo) || r.email.toLowerCase().includes(termo)) : resgates;
  const entregues = resgates.reduce((s, r) => s + (c.beneficio === 'giros' ? r.giros : r.tickets), 0);

  return (
    <ModalAdm aberto titulo={`Cupom ${c.codigo}`} aoFechar={aoFechar} largura="g">
      <div className="cup-detalhe">
        <div className="cup-detalhe-topo">
          <div className="cup-vale" data-status={status}>
            <span className="cup-vale-rotulo">Código</span>
            <span className="cup-codigo-texto">{c.codigo}</span>
            <BotaoCopiar texto={c.codigo} rotulo="código" />
          </div>
          <dl className="cup-detalhe-dados">
            <div>
              <dt>Situação</dt>
              <dd>
                <span title={info.ajuda}>
                  <Selo tom={info.tom}>{info.rotulo}</Selo>
                </span>
              </dd>
            </div>
            <div>
              <dt>Vale</dt>
              <dd>
                {c.beneficio === 'giros'
                  ? <span>{c.giros} {c.giros === 1 ? 'giro' : 'giros'} na roleta</span>
                  : <><ChipTickets n={c.tickets} tamanho="p" /> <span className="itc-texto-suave">por membro</span></>}
              </dd>
            </div>
            <div>
              <dt>Usos</dt>
              <dd>
                <strong>{fmt.int(c.usos)}</strong>
                {c.usosMax !== null ? ` de ${fmt.int(c.usosMax)}` : ''} <span className="itc-texto-suave">{c.usosMax === null ? '· sem limite' : `· ${fmt.int(sobra ?? 0)} restantes`}</span>
              </dd>
            </div>
            <div>
              <dt>Validade</dt>
              <dd>
                <CalendarClock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                {dataCurta(c.inicio, agora)} → {c.fim ? dataCurta(c.fim, agora) : 'sem fim'}
              </dd>
            </div>
          </dl>
        </div>
        {c.descricao && <p className="cup-detalhe-descricao">“{c.descricao}”</p>}

        <div className="cup-detalhe-cabeca">
          <h3>
            <UsersRound className="h-4 w-4" aria-hidden /> Quem resgatou
            <span>
              · {fmt.int(c.usos)} {c.usos === 1 ? 'membro' : 'membros'}
              {entregues > 0 && ` · ${c.beneficio === 'giros' ? `${fmt.int(entregues)} ${entregues === 1 ? 'giro' : 'giros'}` : textoTickets(entregues)} entregues`}
            </span>
          </h3>
          {resgates.length > 8 && (
            <label className="cup-busca">
              <Search className="cup-busca-lupa" aria-hidden />
              <span className="sr-only">Buscar por nome ou e-mail</span>
              <input type="search" className="adm-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou e-mail" />
            </label>
          )}
        </div>

        {detalhe.isPending ? (
          <Carregando texto="Carregando quem resgatou…" />
        ) : detalhe.isError ? (
          <Vazio titulo="Não deu para carregar os resgates">
            <p>{mensagemAdmin(detalhe.error)}</p>
            <BotaoAdm tamanho="p" className="mt-3" onClick={() => void detalhe.refetch()}>
              Tentar de novo
            </BotaoAdm>
          </Vazio>
        ) : resgates.length === 0 ? (
          <Vazio titulo="Ninguém resgatou ainda">
            {status === 'ativo' ? 'Assim que um membro digitar o código no jogo, ele aparece aqui.' : `O cupom está ${info.rotulo.toLowerCase()}: ${info.ajuda.charAt(0).toLowerCase()}${info.ajuda.slice(1)}`}
          </Vazio>
        ) : visiveis.length === 0 ? (
          <Vazio titulo="Ninguém com esse nome ou e-mail" />
        ) : (
          <ol className="cup-resgates">
            {visiveis.map((r) => (
              <li key={r.contaId} className="cup-resgate">
                <Avatar id={r.contaId} nome={r.nome} tamanho="p" />
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/usuarios/${r.contaId}`} className="cup-resgate-nome" title={`Abrir a ficha de ${r.nome}`}>
                    <span className="truncate">{r.nome}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </Link>
                  <p className="cup-resgate-email">{r.email}</p>
                </div>
                {r.giros > 0
                  ? <span className="cup-resgate-tickets">{r.giros} {r.giros === 1 ? 'giro' : 'giros'}</span>
                  : <ChipTickets n={r.tickets} tamanho="p" className="cup-resgate-tickets" />}
                <time className="cup-resgate-quando" dateTime={r.criadoEm} title={fmt.dataHora(r.criadoEm)}>
                  <span>{fmt.dataHora(r.criadoEm)}</span>
                  <span className="cup-resgate-rel">{fmt.relativo(r.criadoEm, agora)}</span>
                </time>
              </li>
            ))}
          </ol>
        )}
        {resgates.length >= LIMITE_LISTA && <p className="itc-texto-suave">Mostrando os {fmt.int(LIMITE_LISTA)} resgates mais recentes.</p>}

        <div className="adm-us-modal-acoes">
          <BotaoAdm onClick={() => aoEditar(c)}>
            <Pencil className="h-4 w-4" aria-hidden /> Editar cupom
          </BotaoAdm>
          <BotaoAdm variante="primario" onClick={aoFechar}>
            Fechar
          </BotaoAdm>
        </div>
      </div>
    </ModalAdm>
  );
}

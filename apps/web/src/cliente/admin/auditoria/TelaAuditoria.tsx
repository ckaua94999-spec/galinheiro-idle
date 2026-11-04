'use client';

// Auditoria do painel (/admin/auditoria): tudo o que a equipe fez pelo painel, do mais recente ao mais antigo,
// com quem fez, o quê (em português), em quem (link para a ficha) e os detalhes resumidos. Tabela no desktop,
// cartões no celular; paginada.
import type { AdminAcaoDTO, AdminListaAcoesDTO, AdminPopupDTO } from '@galinheiro/api-contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Megaphone, RefreshCw, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { chamar } from '../../api';
import { cx } from '../../util';
import { useAgoraLento } from '../atendimento/util';
import { CabecalhoAdm } from '../ShellAdmin';
import { BotaoAdm, Cartao, Carregando, fmt, mensagemAdmin, Vazio } from '../ui';
import { descreverAcao, type DescricaoAcao } from './descrever';

const POR_PAGINA = 30;

/** Mesma chave da tela de popups: os títulos servem para nomear os popups editados. */
const CHAVE_POPUPS = ['admin', 'popups', 'lista'] as const;

function Alvo({ a, desc, popupsAtuais }: { a: AdminAcaoDTO; desc: DescricaoAcao; popupsAtuais: ReadonlySet<string> | null }) {
  if (desc.popup) {
    const { id, titulo } = desc.popup;
    const nome = titulo ? `“${titulo}”` : 'Popup';
    // popup que ainda existe: leva para a lista; excluído: só o nome (que fica guardado na auditoria)
    if (popupsAtuais && (!id || !popupsAtuais.has(id))) {
      return (
        <span className="aud-alvo aud-alvo-popup" title={titulo ?? undefined}>
          <Megaphone className="h-3.5 w-3.5 flex-none" aria-hidden />
          <span className="aud-alvo-texto">
            {nome} <span className="aud-alvo-nota">excluído</span>
          </span>
        </span>
      );
    }
    return (
      <Link href="/admin/popups" className="aud-alvo aud-alvo-popup" title={titulo ? `${titulo} — abrir os popups` : 'Abrir os popups'}>
        <Megaphone className="h-3.5 w-3.5 flex-none" aria-hidden />
        <span className="aud-alvo-texto">{nome}</span>
      </Link>
    );
  }
  if (!a.alvoContaId) return <span className="aud-suave">—</span>;
  if (a.acao === 'excluir_usuario') {
    return (
      <span className="aud-alvo">
        <span className="aud-alvo-texto">
          {a.alvoNome ?? 'Membro'} <span className="aud-alvo-nota">conta excluída</span>
        </span>
      </span>
    );
  }
  // sem nome = a conta não existe mais (o registro da auditoria fica)
  if (!a.alvoNome) return <span className="aud-suave">Conta removida</span>;
  return (
    <Link href={`/admin/usuarios/${a.alvoContaId}`} className="aud-alvo" title={`Ver a ficha de ${a.alvoNome}`}>
      <span className="aud-alvo-texto">{a.alvoNome}</span>
    </Link>
  );
}

function Detalhes({ desc }: { desc: DescricaoAcao }) {
  if (!desc.resumo && !desc.extra && !desc.motivo) return <span className="aud-suave">—</span>;
  return (
    <span className="aud-detalhes">
      {(desc.resumo || desc.extra) && (
        <span className="aud-detalhes-linha">
          {desc.resumo && <strong className="aud-detalhes-resumo">{desc.resumo}</strong>}
          {desc.resumo && desc.extra && ' · '}
          {desc.extra && <span>{desc.extra}</span>}
        </span>
      )}
      {desc.motivo && (
        <span className="aud-detalhes-motivo">
          Motivo: <q>{desc.motivo}</q>
        </span>
      )}
    </span>
  );
}

function SeloAcao({ desc }: { desc: DescricaoAcao }) {
  const { Icone } = desc;
  return (
    <span className="aud-acao" data-tom={desc.tom}>
      <span className="aud-acao-icone" aria-hidden>
        <Icone />
      </span>
      {desc.rotulo}
    </span>
  );
}

function Quando({ iso, agora }: { iso: string; agora: number }) {
  return (
    <time dateTime={iso} className="aud-quando" title={fmt.dataHora(iso)}>
      <span className="aud-quando-data">{fmt.dataHora(iso)}</span>
      <span className="aud-quando-rel">{fmt.relativo(iso, agora)}</span>
    </time>
  );
}

export function TelaAuditoria() {
  const [pagina, setPagina] = useState(1);
  const agora = useAgoraLento();
  const consulta = useQuery({
    queryKey: ['admin', 'auditoria', pagina, POR_PAGINA],
    queryFn: async ({ signal }) =>
      (await chamar<AdminListaAcoesDTO>('GET', `/api/admin/auditoria?pagina=${pagina}&porPagina=${POR_PAGINA}`, { sinal: signal })).data,
    placeholderData: keepPreviousData,
  });
  const popups = useQuery({
    queryKey: CHAVE_POPUPS,
    queryFn: async ({ signal }) => (await chamar<AdminPopupDTO[]>('GET', '/api/admin/popups', { sinal: signal })).data,
    staleTime: 60_000,
  });
  const dados = consulta.data;
  // nome de cada popup: o título atual (se ainda existe) ou o guardado na auditoria ao criar/excluir
  const titulos = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of dados?.itens ?? []) {
      const { popupId, titulo } = a.detalhes ?? {};
      if (typeof popupId === 'string' && typeof titulo === 'string' && !m.has(popupId)) m.set(popupId, titulo);
    }
    for (const p of popups.data ?? []) m.set(p.id, p.titulo);
    return m;
  }, [dados, popups.data]);
  const popupsAtuais = useMemo(() => (popups.data ? new Set(popups.data.map((p) => p.id)) : null), [popups.data]);

  const total = dados?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const linhas = (dados?.itens ?? []).map((a) => ({ a, desc: descreverAcao(a, titulos) }));
  const primeiro = total ? (pagina - 1) * POR_PAGINA + 1 : 0;
  const ultimo = Math.min(total, pagina * POR_PAGINA);

  const irPara = (p: number) => {
    setPagina(Math.min(Math.max(1, p), paginas));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <CabecalhoAdm
        titulo="Auditoria"
        descricao="Tudo o que a equipe fez pelo painel, do mais recente ao mais antigo."
        acoes={
          <BotaoAdm tamanho="p" onClick={() => void consulta.refetch()} disabled={consulta.isFetching}>
            <RefreshCw className={cx('h-4 w-4', consulta.isFetching && 'animate-spin')} aria-hidden /> Atualizar
          </BotaoAdm>
        }
      />
      <Cartao
        className="aud-cartao"
        titulo={
          <span className="flex items-center gap-2">
            <ScrollText className="h-[18px] w-[18px] text-slate-400" aria-hidden />
            Registro de ações
          </span>
        }
        acoes={total > 0 ? <span className="aud-total">{fmt.int(total)} {total === 1 ? 'ação registrada' : 'ações registradas'}</span> : undefined}
      >
        {consulta.isPending ? (
          <Carregando texto="Carregando a auditoria…" />
        ) : consulta.isError && !dados ? (
          <Vazio titulo="Não deu para carregar a auditoria">
            <p>{mensagemAdmin(consulta.error)}</p>
            <BotaoAdm tamanho="p" className="mt-3" onClick={() => void consulta.refetch()}>
              Tentar de novo
            </BotaoAdm>
          </Vazio>
        ) : linhas.length === 0 ? (
          <Vazio titulo="Nenhuma ação registrada ainda">
            Ajustes de saldo, bloqueios, popups e atendimentos feitos pelo painel aparecem aqui, com quem fez e quando.
          </Vazio>
        ) : (
          <div className={cx('aud-conteudo', consulta.isPlaceholderData && 'aud-trocando')} aria-busy={consulta.isPlaceholderData}>
            {/* desktop: tabela */}
            <div className="adm-tabela-rolagem aud-tabela-caixa">
              <table className="adm-tabela aud-tabela">
                <caption className="sr-only">
                  Ações do painel, página {pagina} de {paginas}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Quando</th>
                    <th scope="col">Quem</th>
                    <th scope="col">Ação</th>
                    <th scope="col">Alvo</th>
                    <th scope="col">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(({ a, desc }) => (
                    <tr key={a.id}>
                      <td>
                        <Quando iso={a.criadoEm} agora={agora} />
                      </td>
                      <td className="aud-quem">{a.adminNome ?? <span className="aud-suave">Admin removido</span>}</td>
                      <td>
                        <SeloAcao desc={desc} />
                      </td>
                      <td className="aud-col-alvo">
                        <Alvo a={a} desc={desc} popupsAtuais={popupsAtuais} />
                      </td>
                      <td>
                        <Detalhes desc={desc} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* celular: cartões */}
            <ul className="aud-cartoes">
              {linhas.map(({ a, desc }) => (
                <li key={a.id} className="aud-item">
                  <div className="aud-item-topo">
                    <SeloAcao desc={desc} />
                    <time dateTime={a.criadoEm} className="aud-item-tempo" title={fmt.dataHora(a.criadoEm)}>
                      {fmt.relativo(a.criadoEm, agora)}
                    </time>
                  </div>
                  <p className="aud-item-quem">
                    <span className="aud-suave">por</span> <strong>{a.adminNome ?? 'admin removido'}</strong>
                    {(desc.popup || a.alvoContaId) && (
                      <>
                        {' '}
                        <span className="aud-suave">→</span> <Alvo a={a} desc={desc} popupsAtuais={popupsAtuais} />
                      </>
                    )}
                  </p>
                  {(desc.resumo || desc.extra || desc.motivo) && (
                    <div className="aud-item-detalhes">
                      <Detalhes desc={desc} />
                    </div>
                  )}
                  <p className="aud-item-data">{fmt.dataHora(a.criadoEm)}</p>
                </li>
              ))}
            </ul>

            <nav className="aud-paginacao" aria-label="Páginas da auditoria">
              <p className="aud-paginacao-info">
                {fmt.int(primeiro)}–{fmt.int(ultimo)} de {fmt.int(total)}
              </p>
              <div className="flex items-center gap-2">
                <BotaoAdm tamanho="p" onClick={() => irPara(pagina - 1)} disabled={pagina <= 1 || consulta.isFetching} aria-label="Página anterior">
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  <span className="aud-paginacao-rotulo">Anterior</span>
                </BotaoAdm>
                <span className="aud-paginacao-pagina">
                  Página {pagina} de {paginas}
                </span>
                <BotaoAdm tamanho="p" onClick={() => irPara(pagina + 1)} disabled={pagina >= paginas || consulta.isFetching} aria-label="Próxima página">
                  <span className="aud-paginacao-rotulo">Próxima</span>
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </BotaoAdm>
              </div>
            </nav>
          </div>
        )}
      </Cartao>
    </>
  );
}

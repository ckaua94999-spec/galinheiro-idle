'use client';

// Visão geral do painel (/admin): números de agora (atualizados a cada minuto) e tendências com projeção de
// pessoas, ovos e moedas. O período do histórico e o horizonte da projeção ficam guardados neste navegador.
import type { AdminGraficosDTO, AdminResumoDTO } from '@galinheiro/api-contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { chamar } from '../../api';
import { cx } from '../../util';
import { CabecalhoAdm } from '../ShellAdmin';
import { BotaoAdm, Carregando, Cartao, mensagemAdmin } from '../ui';
import { GradeKpis } from './Kpis';
import { CartoesProjecao } from './Projecoes';
import { SecaoMoedas, SecaoOvos, SecaoPessoas } from './Secoes';
import { diaExtenso } from './series';

const HISTORICO = [7, 30, 90] as const;
const HORIZONTE = [30, 60, 90] as const;
const CHAVE_PERIODO = 'gi:admin:visao:periodo';

interface Periodo {
  dias: number;
  projecao: number;
}

const PADRAO: Periodo = { dias: 30, projecao: 30 };

function lerPeriodo(): Periodo {
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE_PERIODO) ?? 'null') as Partial<Periodo> | null;
    const dias = HISTORICO.find((d) => d === p?.dias) ?? PADRAO.dias;
    const projecao = HORIZONTE.find((d) => d === p?.projecao) ?? PADRAO.projecao;
    return { dias, projecao };
  } catch {
    return PADRAO;
  }
}

const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Controle segmentado (rádios nativos: setas do teclado já navegam). */
function Segmentado({ rotulo, opcoes, valor, aoMudar }: {
  rotulo: string;
  opcoes: readonly number[];
  valor: number;
  aoMudar: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="vg-seg-grupo">
      <span id={id} className="vg-seg-rotulo">
        {rotulo}
      </span>
      <div className="vg-seg" role="radiogroup" aria-labelledby={id}>
        {opcoes.map((o) => (
          <label key={o} className="vg-seg-opcao">
            <input type="radio" name={id} value={o} checked={valor === o} onChange={() => aoMudar(o)} />
            <span>{o} dias</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Falha({ erro, tentar }: { erro: unknown; tentar: () => void }) {
  return (
    <Cartao>
      <div className="vg-falha" role="alert">
        <TriangleAlert className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">Não deu para carregar.</p>
          <p className="text-sm text-slate-500">{mensagemAdmin(erro)}</p>
        </div>
        <BotaoAdm tamanho="p" onClick={tentar}>
          Tentar de novo
        </BotaoAdm>
      </div>
    </Cartao>
  );
}

export function TelaVisaoGeral() {
  // só monta no navegador (a casca espera a sessão), então dá para ler a preferência já na criação
  const [periodo, setPeriodo] = useState<Periodo>(() => (typeof window === 'undefined' ? PADRAO : lerPeriodo()));
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_PERIODO, JSON.stringify(periodo));
    } catch {
      // sem armazenamento (aba privada etc.): só não lembra a escolha
    }
  }, [periodo]);

  const resumo = useQuery({
    queryKey: ['admin', 'resumo'],
    queryFn: async () => (await chamar<AdminResumoDTO>('GET', '/api/admin/resumo')).data,
    refetchInterval: 60_000,
  });
  const graficos = useQuery({
    queryKey: ['admin', 'graficos', periodo.dias, periodo.projecao],
    queryFn: async () =>
      (await chamar<AdminGraficosDTO>('GET', `/api/admin/graficos?dias=${periodo.dias}&projecao=${periodo.projecao}`)).data,
    // ao trocar o período, o gráfico anterior fica na tela (esmaecido) até o novo chegar
    placeholderData: keepPreviousData,
    refetchInterval: 5 * 60_000,
  });

  const atualizando = resumo.isFetching || graficos.isFetching;
  const atualizar = () => {
    void resumo.refetch();
    void graficos.refetch();
  };

  return (
    <>
      <CabecalhoAdm
        titulo="Visão geral"
        descricao={
          resumo.data ? (
            <>
              Hoje é {diaExtenso(resumo.data.hoje)} (horário de Brasília) · números de {HORA.format(resumo.dataUpdatedAt)}, atualizados a
              cada minuto
            </>
          ) : (
            'Números de agora e tendências do jogo.'
          )
        }
        acoes={
          <BotaoAdm onClick={atualizar} aria-label="Atualizar números e gráficos">
            <RefreshCw className={cx('h-4 w-4', atualizando && 'animate-spin')} aria-hidden />
            Atualizar
          </BotaoAdm>
        }
      />

      <div className="vg">
        <section aria-labelledby="vg-agora">
          <h2 id="vg-agora" className="sr-only">
            Números de agora
          </h2>
          {resumo.data ? (
            <GradeKpis r={resumo.data} />
          ) : resumo.isError ? (
            <Falha erro={resumo.error} tentar={() => void resumo.refetch()} />
          ) : (
            <Cartao>
              <Carregando texto="Carregando os números de hoje…" />
            </Cartao>
          )}
        </section>

        <section className="vg-tendencias" aria-labelledby="vg-tendencias" aria-busy={graficos.isFetching}>
          <div className="vg-filtros">
            <div className="min-w-0">
              <h2 id="vg-tendencias" className="vg-titulo">
                Tendências e projeções
              </h2>
              <p className="vg-descricao">
                Histórico por dia e o que esperar se o ritmo atual continuar. Hoje ainda está em andamento (barras mais claras); a área
                sombreada à direita é a projeção. Toque na legenda de um gráfico para esconder ou mostrar uma série.
              </p>
            </div>
            <div className="vg-filtros-controles">
              <Segmentado rotulo="Histórico" opcoes={HISTORICO} valor={periodo.dias} aoMudar={(dias) => setPeriodo((p) => ({ ...p, dias }))} />
              <Segmentado
                rotulo="Projeção"
                opcoes={HORIZONTE}
                valor={periodo.projecao}
                aoMudar={(projecao) => setPeriodo((p) => ({ ...p, projecao }))}
              />
            </div>
          </div>

          {graficos.data ? (
            <div className="vg-conteudo" data-recarregando={graficos.isPlaceholderData || undefined}>
              {graficos.isPlaceholderData && (
                <p className="vg-recarregando" role="status">
                  <span className="adm-spinner" aria-hidden /> Atualizando para o novo período…
                </p>
              )}
              {graficos.isError && !graficos.isPlaceholderData && (
                <p className="vg-aviso" role="alert">
                  Não deu para atualizar os gráficos ({mensagemAdmin(graficos.error)}). Mostrando os últimos dados.
                </p>
              )}
              <CartoesProjecao g={graficos.data} />
              <SecaoPessoas g={graficos.data} />
              <SecaoOvos g={graficos.data} />
              <SecaoMoedas g={graficos.data} />
            </div>
          ) : graficos.isError ? (
            <Falha erro={graficos.error} tentar={() => void graficos.refetch()} />
          ) : (
            <Cartao>
              <Carregando texto="Montando os gráficos…" />
            </Cartao>
          )}
        </section>
      </div>
    </>
  );
}

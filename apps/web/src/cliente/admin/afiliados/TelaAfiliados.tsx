'use client';

// Rede de afiliados do painel (/admin/afiliados): as taxas em vigor (com atalho para editar), a busca para abrir a
// rede de qualquer membro, os números da rede, cadastros × convites e comissões pagas por dia, comissões por
// nível e o ranking com link para a rede de cada um. Período (7/30/90 dias) e ordem do ranking ficam na URL.
// Tudo em MOEDAS DO JOGO: as comissões são pagas pelo jogo; nada é sacado ou convertido.
import type { AdminAfiliadosDTO } from '@galinheiro/api-contract';
import { ArrowRight, Coins, HandCoins, Network, Percent, PiggyBank, RefreshCw, Search, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { cx } from '../../util';
import { CabecalhoAdm } from '../ShellAdmin';
import { BotaoAdm, Carregando, Cartao, Kpi, fmt } from '../ui';
import { useAgoraLento } from '../usuarios/comum';
import { BuscaRede } from './BuscaRede';
import {
  FichasNiveis, Falha, ORDENS, PERIODOS, Segmentado, SeloPrograma, TextoTeto, TituloSecao, lembrarPainel, useResumoAfiliados, type Ordem,
} from './comum';
import { pct } from './formato';
import { GraficoBarras, type DiaBarras, type SerieBarra } from './GraficoBarras';
import { ComissoesPorNivel, Ranking } from './Ranking';

const PADRAO = { dias: 30, ordenar: 'rede' as Ordem };
const ICONE = 'h-[18px] w-[18px]';

/**
 * Cores das séries (validadas no fundo branco: contraste ≥ 3:1 e separação para daltonismo entre as duas da
 * pilha). Azul = cadastros, como "novos por dia" na visão geral; violeta = convites; âmbar = moedas.
 */
const COR = { convite: '#4a3aa7', semConvite: '#2a78d6', comissoes: '#d97706' } as const;
const SERIES_CADASTROS: SerieBarra[] = [
  { chave: 'convite', nome: 'Por convite', cor: COR.convite },
  { chave: 'semConvite', nome: 'Sem convite', cor: COR.semConvite },
];
const SERIES_COMISSOES: SerieBarra[] = [{ chave: 'comissoes', nome: 'Comissões pagas', cor: COR.comissoes }];

function lerBusca(p: { get(chave: string): string | null }): { dias: number; ordenar: Ordem } {
  const dias = Number(p.get('dias'));
  const ordenar = p.get('ordenar');
  return {
    dias: (PERIODOS as readonly number[]).includes(dias) ? dias : PADRAO.dias,
    ordenar: ORDENS.some((o) => o.valor === ordenar) ? (ordenar as Ordem) : PADRAO.ordenar,
  };
}

/** % sem casas quando inteira ("18%"), senão uma ("2,5%") */
const porcento = (parte: number, todo: number): string => (todo > 0 ? `${fmt.dec((parte / todo) * 100)}%` : '0%');
/** rótulo curto do eixo: inteiro até 999, depois compacto ("1,2 mil") */
const curto = (n: number) => (Math.abs(n) < 1000 ? fmt.int(n) : fmt.compacto(n));
/** moedas em centavos → rótulo curto do eixo ("0,5", "12", "1,2 mil") */
const moedasCurto = (x100: number) => (Math.abs(x100) < 100_000 ? fmt.dec(x100 / 100) : fmt.compacto(x100 / 100));

// ---------------------------------------------------------------- taxas em vigor

function CartaoTaxas({ r, agora }: { r: AdminAfiliadosDTO; agora: number }) {
  const c = r.config;
  const soma = c.comissoesBp.reduce((s, bp) => s + bp, 0);
  return (
    <Cartao
      className="afi-taxas-atuais"
      titulo={<TituloSecao Icone={Percent} texto="Taxas em vigor" tom="roxo" />}
      acoes={
        <Link href="/admin/afiliados/taxas" className="adm-botao" data-tamanho="p">
          Editar taxas <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      }
    >
      <div className="afi-taxas-linha">
        <SeloPrograma ativo={c.ativo} />
        <FichasNiveis comissoesBp={c.comissoesBp} pausado={!c.ativo} />
      </div>
      <p className="afi-taxas-meta">
        {c.ativo ? (
          <>
            O jogo paga até <strong>{pct(soma)}</strong> a mais sobre cada venda de ovos dos indicados.
          </>
        ) : (
          <strong className="afi-pausado">Pausado: nenhuma comissão está sendo paga.</strong>
        )}
      </p>
      <p className="afi-taxas-alterado">
        {c.tetoDiarioX100 === null ? (
          'Sem teto diário'
        ) : (
          <>
            Teto: <TextoTeto tetoX100={c.tetoDiarioX100} />
          </>
        )}{' '}
        · alterado {fmt.relativo(r.configAtualizadaEm, agora)} ({fmt.dataHora(r.configAtualizadaEm)})
      </p>
    </Cartao>
  );
}

// ---------------------------------------------------------------- números

function KpisAfiliados({ r, dias }: { r: AdminAfiliadosDTO; dias: number }) {
  const t = r.totais;
  const novos = r.serie.reduce((s, d) => s + d.cadastros, 0);
  const novosConvite = r.serie.reduce((s, d) => s + d.indicados, 0);
  return (
    <div className="afi-kpis">
      <Kpi
        rotulo="Membros"
        valor={fmt.int(t.membros)}
        tom="verde"
        icone={<Users className={ICONE} />}
        detalhe={
          <>
            <span className="vg-kpi-linha">
              <strong>+{fmt.int(novos)}</strong> nos últimos {dias} dias
            </span>
          </>
        }
      />
      <Kpi
        rotulo="Por convite"
        valor={fmt.int(t.indicados)}
        tom="roxo"
        icone={<UserPlus className={ICONE} />}
        detalhe={
          <>
            <span className="vg-kpi-linha">
              <strong>{porcento(t.indicados, t.membros)}</strong> dos membros entraram assim
            </span>
            <span className="vg-kpi-linha">
              <strong>+{fmt.int(novosConvite)}</strong> nos últimos {dias} dias
            </span>
          </>
        }
      />
      <Kpi
        rotulo="Indicadores"
        valor={fmt.int(t.indicadores)}
        tom="azul"
        icone={<Network className={ICONE} />}
        detalhe={
          <>
            <span className="vg-kpi-linha">membros que trouxeram alguém</span>
            {t.indicadores > 0 && (
              <span className="vg-kpi-linha">
                <strong>{fmt.dec(t.indicados / t.indicadores)}</strong> convidados cada
              </span>
            )}
          </>
        }
      />
      <Kpi
        rotulo="Comissões"
        valor={fmt.moedas(t.comissoesPeriodoX100)}
        tom="ambar"
        icone={<Coins className={ICONE} />}
        detalhe={
          <>
            <span className="vg-kpi-linha">moedas pagas pelo jogo</span>
            <span className="vg-kpi-linha">nos últimos {dias} dias</span>
          </>
        }
      />
      <Kpi
        rotulo="Total pago"
        valor={fmt.moedas(t.comissoesTotalX100)}
        tom="ambar"
        icone={<PiggyBank className={ICONE} />}
        detalhe={
          <>
            <span className="vg-kpi-linha">moedas em comissões</span>
            <span className="vg-kpi-linha">desde o início</span>
          </>
        }
      />
      <Kpi
        rotulo="Beneficiários"
        valor={fmt.int(t.beneficiariosPeriodo)}
        tom="verde"
        icone={<HandCoins className={ICONE} />}
        detalhe={
          <>
            <span className="vg-kpi-linha">receberam comissão no período</span>
            {t.beneficiariosPeriodo > 0 && (
              <span className="vg-kpi-linha">
                média de <strong>{fmt.moedas(t.comissoesPeriodoX100 / t.beneficiariosPeriodo)}</strong> cada
              </span>
            )}
          </>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------- por dia

function GraficosDia({ r, dias }: { r: AdminAfiliadosDTO; dias: number }) {
  const linhas = useMemo<DiaBarras[]>(
    () =>
      r.serie.map((d) => ({
        dia: d.dia,
        valores: { convite: d.indicados, semConvite: Math.max(0, d.cadastros - d.indicados), comissoes: d.comissoesX100 },
      })),
    [r.serie],
  );
  const cadastros = r.serie.reduce((s, d) => s + d.cadastros, 0);
  const convite = r.serie.reduce((s, d) => s + d.indicados, 0);
  const comissoes = r.serie.reduce((s, d) => s + d.comissoesX100, 0);
  const diasComissao = r.serie.filter((d) => d.comissoesX100 > 0).length;
  return (
    <Cartao className="vg-secao" titulo={<TituloSecao Icone={UserPlus} texto="Por dia" tom="azul" sub={`últimos ${dias} dias`} />}>
      <div className="vg-graficos" data-colunas="2">
        <GraficoBarras
          titulo="Cadastros por dia"
          subtitulo={
            <>
              <strong>{fmt.int(cadastros)}</strong> novos membros · <strong>{fmt.int(convite)}</strong> por convite ({porcento(convite, cadastros)})
            </>
          }
          dias={linhas}
          series={SERIES_CADASTROS}
          formato={fmt.int}
          formatoEixo={curto}
          resumo={`Nos últimos ${dias} dias: ${fmt.int(cadastros)} cadastros, ${fmt.int(convite)} por convite (${porcento(convite, cadastros)}).`}
          rodapeDica={(d) => {
            const total = (d.valores.convite ?? 0) + (d.valores.semConvite ?? 0);
            return total ? (
              <>
                <strong>{fmt.int(total)}</strong> {total === 1 ? 'cadastro' : 'cadastros'} · {porcento(d.valores.convite ?? 0, total)} por convite
              </>
            ) : (
              'Nenhum cadastro'
            );
          }}
          total={{ nome: 'Total', formato: (d) => fmt.int((d.valores.convite ?? 0) + (d.valores.semConvite ?? 0)) }}
          vazio="Nenhum cadastro no período"
        />
        <GraficoBarras
          titulo="Comissões pagas por dia"
          subtitulo={
            <>
              <strong>{fmt.moedas(comissoes)}</strong> moedas em {diasComissao} {diasComissao === 1 ? 'dia' : 'dias'} · pagas pelo jogo
            </>
          }
          dias={linhas}
          series={SERIES_COMISSOES}
          formato={fmt.moedas}
          formatoEixo={moedasCurto}
          passoMin={100}
          resumo={`Nos últimos ${dias} dias o jogo pagou ${fmt.moedas(comissoes)} moedas em comissões.`}
          vazio="Nenhuma comissão no período"
        />
      </div>
    </Cartao>
  );
}

// ---------------------------------------------------------------- tela

export function TelaAfiliados() {
  const params = useSearchParams();
  const { dias, ordenar } = lerBusca(params);
  const agora = useAgoraLento();
  const textoUrl = params.toString();
  useEffect(() => lembrarPainel(textoUrl), [textoUrl]);

  // atualiza a URL sem recarregar (o Next sincroniza o useSearchParams com o history nativo)
  const mudar = useCallback((novo: Partial<{ dias: number; ordenar: Ordem }>) => {
    const atual = lerBusca(new URLSearchParams(window.location.search));
    const prox = { ...atual, ...novo };
    const p = new URLSearchParams();
    if (prox.dias !== PADRAO.dias) p.set('dias', String(prox.dias));
    if (prox.ordenar !== PADRAO.ordenar) p.set('ordenar', prox.ordenar);
    const s = p.toString();
    window.history.replaceState(null, '', s ? `/admin/afiliados?${s}` : '/admin/afiliados');
  }, []);

  const resumo = useResumoAfiliados(dias, ordenar);
  const r = resumo.data;
  const trocando = resumo.isPlaceholderData;

  return (
    <div className="afi">
      <CabecalhoAdm
        titulo="Rede de afiliados"
        descricao="Quem convidou quem, como a rede cresce e as comissões que o jogo paga em moedas do jogo."
        acoes={
          <BotaoAdm onClick={() => void resumo.refetch()} disabled={resumo.isFetching} aria-label="Atualizar os números da rede">
            <RefreshCw className={cx('h-4 w-4', resumo.isFetching && 'animate-spin')} aria-hidden />
            Atualizar
          </BotaoAdm>
        }
      />

      <div className="afi-topo">
        {r ? (
          <CartaoTaxas r={r} agora={agora} />
        ) : resumo.isError ? null : (
          <Cartao className="afi-taxas-atuais">
            <Carregando texto="Carregando as taxas…" />
          </Cartao>
        )}
        <Cartao
          className="afi-busca-cartao"
          titulo={<TituloSecao Icone={Search} texto="Abrir a rede de um membro" tom="azul" />}
        >
          <p className="afi-texto-suave">Quem convidou, quem a pessoa trouxe (até o 5º nível) e as comissões de qualquer membro.</p>
          <BuscaRede />
        </Cartao>
      </div>

      <section className="afi-periodo" aria-labelledby="afi-desempenho" aria-busy={resumo.isFetching}>
        <div className="vg-filtros">
          <div className="min-w-0">
            <h2 id="afi-desempenho" className="vg-titulo">
              Desempenho
            </h2>
            <p className="vg-descricao">
              Comissões, beneficiários e gráficos seguem o período escolhido; membros, convites e tamanho das redes contam desde o
              início.
            </p>
          </div>
          <Segmentado
            rotulo="Período"
            opcoes={PERIODOS.map((d) => ({ valor: d, rotulo: `${d} dias` }))}
            valor={dias}
            aoMudar={(d) => mudar({ dias: d })}
          />
        </div>

        {r ? (
          <div className="vg-conteudo" data-recarregando={trocando || undefined}>
            {trocando && (
              <p className="vg-recarregando" role="status">
                <span className="adm-spinner" aria-hidden /> Atualizando…
              </p>
            )}
            {resumo.isError && !trocando && (
              <p className="vg-aviso" role="alert">
                Não deu para atualizar. Mostrando os últimos números carregados.
              </p>
            )}
            <div className="afi-numeros">
              <div className="afi-numeros-kpis">
                <KpisAfiliados r={r} dias={dias} />
              </div>
              <ComissoesPorNivel r={r} dias={dias} />
            </div>
            <GraficosDia r={r} dias={dias} />
            <Ranking r={r} ordenar={ordenar} aoOrdenar={(o) => mudar({ ordenar: o })} dias={dias} />
          </div>
        ) : resumo.isError ? (
          <Falha erro={resumo.error} tentar={() => void resumo.refetch()} titulo="Não deu para carregar a rede de afiliados." />
        ) : (
          <Cartao>
            <Carregando texto="Montando a rede…" />
          </Cartao>
        )}
      </section>
    </div>
  );
}

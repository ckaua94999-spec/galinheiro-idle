'use client';

// Seções de gráficos da visão geral (Pessoas, Ovos e Moedas): histórico por dia + projeção no mesmo eixo.
import type { AdminGraficosDTO, SerieDTO } from '@galinheiro/api-contract';
import { Coins, Egg, Users, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Cartao, fmt } from '../ui';
import { GraficoDias, type Painel } from './GraficoDias';
import { linhasMoedas, linhasOvos, linhasPessoas } from './series';

/**
 * Cores das séries, fixas por papel em todos os gráficos. Paleta validada (fundo branco): contraste ≥ 3:1 e
 * separação para daltonismo entre as cores que dividem um gráfico (azul × laranja × violeta; verde × azul).
 */
const COR = {
  entrada: '#2a78d6', // novos, produzidos, emitidas
  saida: '#eb6834', // vendidos, gastas
  total: '#16a34a', // totais e ativos (verde do painel)
  potencial: '#4a3aa7', // teto dos animais ativos hoje
} as const;

const MEMBROS: Painel[] = [
  { series: [{ chave: 'total', nome: 'Total de membros', cor: COR.total, forma: 'linha', proj: 'totalProj' }] },
  { tipo: 'faixa', series: [{ chave: 'novos', nome: 'Novos por dia', cor: COR.entrada, forma: 'barra', proj: 'novosProj' }] },
];
const ATIVOS: Painel[] = [{ series: [{ chave: 'ativos', nome: 'Ativos no dia', cor: COR.total, forma: 'linha', proj: 'ativosProj' }] }];
const OVOS: Painel[] = [
  {
    series: [
      { chave: 'produzidos', nome: 'Produzidos ↑', cor: COR.entrada, forma: 'barra', proj: 'tendencia' },
      { chave: 'vendidos', nome: 'Vendidos ↓', cor: COR.saida, forma: 'barra', lado: -1 },
      { chave: 'potencial', nome: 'Potencial dos animais atuais', cor: COR.potencial, forma: 'teto' },
    ],
  },
];
const MOEDAS_DIA: Painel[] = [
  {
    series: [
      { chave: 'emitidas', nome: 'Emitidas ↑', cor: COR.entrada, forma: 'barra', proj: 'emitidasProj' },
      { chave: 'gastas', nome: 'Gastas ↓', cor: COR.saida, forma: 'barra', lado: -1, proj: 'gastasProj' },
      { chave: 'potencialEmissao', nome: 'Potencial de emissão', cor: COR.potencial, forma: 'teto' },
    ],
  },
];
const CIRCULACAO: Painel[] = [
  { series: [{ chave: 'circulacao', nome: 'Em circulação', cor: COR.total, forma: 'linha', proj: 'circulacaoProj' }] },
];

const soma = (s: readonly SerieDTO[]) => s.reduce((t, p) => t + p.valor, 0);
/** rótulo curto do eixo: inteiro até 999, depois compacto ("1,2 mil", "3 mi") */
const curto = (n: number) => (Math.abs(n) < 1000 ? fmt.int(n) : fmt.compacto(n));
/** moedas do jogo em centavos → rótulo curto */
const moedasCurto = (x100: number) => curto(x100 / 100);

function TituloSecao({ Icone, texto, tom }: { Icone: LucideIcon; texto: string; tom: string }) {
  return (
    <span className="vg-secao-nome">
      <span className="vg-secao-icone" data-tom={tom} aria-hidden>
        <Icone className="h-4 w-4" />
      </span>
      {texto}
    </span>
  );
}

export function SecaoPessoas({ g }: { g: AdminGraficosDTO }) {
  const p = g.pessoas;
  const linhas = useMemo(() => linhasPessoas(p), [p]);
  const total = p.total.at(-1)?.valor ?? 0;
  const fim = p.projecaoTotal.at(-1);
  const ativos = p.ativos.at(-1)?.valor ?? 0;
  const fimAtivos = p.projecaoAtivos.at(-1);
  const novos = soma(p.novos);
  return (
    <Cartao titulo={<TituloSecao Icone={Users} texto="Pessoas" tom="verde" />} className="vg-secao">
      <div className="vg-graficos" data-colunas="2">
        <GraficoDias
          titulo="Membros"
          subtitulo={<>Total acumulado e novos cadastros por dia · <strong>+{fmt.int(novos)}</strong> no período</>}
          linhas={linhas}
          paineis={MEMBROS}
          formato={fmt.int}
          formatoEixo={curto}
          resumo={
            `Total de membros hoje: ${fmt.int(total)}; ${fmt.int(novos)} novos cadastros no período.` +
            (fim ? ` Projeção para ${fmt.diaCurto(fim.dia)}: cerca de ${fmt.int(fim.valor)} (faixa de ${fmt.int(fim.min)} a ${fmt.int(fim.max)}).` : '')
          }
        />
        <GraficoDias
          titulo="Ativos por dia"
          subtitulo="Contas que abriram o jogo no dia"
          linhas={linhas}
          paineis={ATIVOS}
          formato={fmt.int}
          formatoEixo={curto}
          resumo={
            `Ativos hoje: ${fmt.int(ativos)}.` +
            (fimAtivos ? ` Projeção para ${fmt.diaCurto(fimAtivos.dia)}: cerca de ${fmt.int(fimAtivos.valor)} por dia (faixa de ${fmt.int(fimAtivos.min)} a ${fmt.int(fimAtivos.max)}).` : '')
          }
        />
      </div>
    </Cartao>
  );
}

export function SecaoOvos({ g }: { g: AdminGraficosDTO }) {
  const o = g.ovos;
  const linhas = useMemo(() => linhasOvos(o), [o]);
  const produzidos = soma(o.produzidos);
  const vendidos = soma(o.vendidos);
  const fim = o.projecaoTendencia.at(-1);
  const potencial = o.projecaoPotencial.at(-1);
  return (
    <Cartao titulo={<TituloSecao Icone={Egg} texto="Ovos" tom="ambar" />} className="vg-secao">
      <GraficoDias
        titulo="Ovos por dia"
        subtitulo={
          <>
            Produzidos (coletados) sobem, vendidos descem · no período: <strong>{fmt.int(produzidos)}</strong> produzidos e{' '}
            <strong>{fmt.int(vendidos)}</strong> vendidos
          </>
        }
        linhas={linhas}
        paineis={OVOS}
        formato={fmt.int}
        formatoEixo={curto}
        resumo={
          `No período: ${fmt.int(produzidos)} ovos produzidos e ${fmt.int(vendidos)} vendidos.` +
          (fim ? ` Tendência para ${fmt.diaCurto(fim.dia)}: cerca de ${fmt.int(fim.valor)} ovos por dia.` : '') +
          (potencial ? ` Potencial dos animais atuais nesse dia: ${fmt.int(potencial.valor)} ovos.` : '')
        }
        nota="Potencial = o que os animais ativos hoje botariam se cada ciclo fosse coletado na hora (sem animais novos)."
      />
    </Cartao>
  );
}

export function SecaoMoedas({ g }: { g: AdminGraficosDTO }) {
  const m = g.moedas;
  const linhas = useMemo(() => linhasMoedas(m), [m]);
  const emitidas = soma(m.emitidasX100);
  const gastas = soma(m.gastasX100);
  const hoje = m.circulacaoX100.at(-1)?.valor ?? 0;
  const fim = m.projecaoCirculacaoX100.at(-1);
  return (
    <Cartao titulo={<TituloSecao Icone={Coins} texto="Moedas" tom="azul" />} className="vg-secao">
      <div className="vg-graficos" data-colunas="2">
        <GraficoDias
          titulo="Moedas por dia"
          subtitulo={
            <>
              Emitidas sobem, gastas descem · no período: <strong>+{fmt.moedas(emitidas)}</strong> e <strong>−{fmt.moedas(gastas)}</strong>
            </>
          }
          linhas={linhas}
          paineis={MOEDAS_DIA}
          formato={fmt.moedas}
          formatoEixo={moedasCurto}
          passoMin={100}
          resumo={`No período: ${fmt.moedas(emitidas)} moedas emitidas e ${fmt.moedas(gastas)} gastas.`}
          nota="Potencial de emissão = moedas que entrariam se todos os ovos possíveis dos animais atuais fossem vendidos."
        />
        <GraficoDias
          titulo="Moedas em circulação"
          subtitulo="Soma dos saldos de todos os jogadores"
          linhas={linhas}
          paineis={CIRCULACAO}
          formato={fmt.moedas}
          formatoEixo={moedasCurto}
          passoMin={100}
          resumo={
            `Em circulação hoje: ${fmt.moedas(hoje)} moedas.` +
            (fim ? ` Projeção para ${fmt.diaCurto(fim.dia)}: cerca de ${fmt.moedas(fim.valor)} (faixa de ${fmt.moedas(fim.min)} a ${fmt.moedas(fim.max)}).` : '')
          }
        />
      </div>
    </Cartao>
  );
}

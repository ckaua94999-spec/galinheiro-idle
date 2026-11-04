'use client';

// Gráfico de barras por dia das telas de afiliados (recharts), no visual da visão geral: barras finas com ponta
// arredondada, partes empilhadas com 2 px de respiro, a barra de hoje mais clara (o dia ainda está em andamento),
// dica (tooltip) em pt-BR, legenda que liga/desliga séries e a visão em tabela — o equivalente acessível.
// Um eixo só por gráfico: medidas de escalas diferentes (cadastros × moedas) ficam em gráficos separados.
import { ChartColumn, Table2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type BarShapeProps } from 'recharts';
import { BotaoAdm, Selo, fmt } from '../ui';
import { Chave } from '../visao/GraficoDias';
import { diaLongo, diaSemana } from '../visao/series';

export interface SerieBarra {
  chave: string;
  nome: string;
  cor: string;
}

export interface DiaBarras {
  /** AAAA-MM-DD (horário de Brasília) */
  dia: string;
  valores: Record<string, number>;
}

// cromo do gráfico (recessivo), o mesmo da visão geral
const COR_GRADE = '#e8ecf2';
const COR_EIXO = '#64708a';
const TICK = { fontSize: 11, fill: COR_EIXO, fontWeight: 600 };
/** px de respiro entre as partes de uma barra empilhada */
const RESPIRO = 2;
/** opacidade da barra de hoje (dia parcial) */
const PARCIAL = 0.55;

interface LinhaGrafico {
  dia: string;
  hoje: boolean;
  /** série mais alta e mais baixa com valor no dia (arredondamento e respiro) */
  topo?: string;
  base?: string;
  [chave: string]: string | number | boolean | undefined;
}

/** Eixo Y com passo redondo (1; 2; 2,5; 5 × 10ⁿ), até 4 divisões; contagens só com passos inteiros. */
function eixoY(max: number, passoMin: number): { topo: number; ticks: number[] } {
  const alvo = Math.max(max, passoMin) / 4;
  let ordem = 10 ** Math.floor(Math.log10(alvo));
  let passo = passoMin;
  busca: for (let i = 0; i < 12; i++, ordem *= 10) {
    for (const m of [1, 2, 2.5, 5]) {
      const p = m * ordem;
      if (p < passoMin || (passoMin === 1 && !Number.isInteger(p))) continue;
      if (p >= alvo) {
        passo = p;
        break busca;
      }
    }
  }
  const topo = Math.max(passo, Math.ceil(max / passo) * passo);
  const ticks: number[] = [];
  for (let k = 0; k * passo <= topo + 1e-9; k++) ticks.push(k * passo);
  return { topo, ticks };
}

/** Barra com ponta arredondada só no alto da pilha e respiro em cima da parte de baixo. */
function formaBarra(chave: string, ativa = false) {
  return function FormaBarra(p: BarShapeProps): ReactElement {
    const { x, y, width: w, height: h, fill } = p;
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return <g />;
    const linha = p.payload as LinhaGrafico | undefined;
    const alt = linha?.base && linha.base !== chave ? h - RESPIRO : h;
    if (alt < 0.75) return <g />;
    const r = linha?.topo === chave ? Math.min(4, w / 2, alt) : 0;
    const base = y + alt;
    const d = `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
    return (
      <path
        d={d}
        fill={fill}
        opacity={linha?.hoje ? PARCIAL : 1}
        style={ativa ? { filter: 'brightness(0.88)' } : undefined}
      />
    );
  };
}

function Dica({ linha, hoje, series, formato, rodape }: {
  linha: DiaBarras | undefined;
  /** a linha é o dia de hoje (ainda em andamento) */
  hoje: boolean;
  series: SerieBarra[];
  formato: (v: number) => string;
  rodape?: (d: DiaBarras) => ReactNode;
}) {
  if (!linha) return null;
  return (
    <div className="vg-dica">
      <p className="vg-dica-dia">
        {diaLongo(linha.dia)}
        {hoje && <span className="vg-dica-fase">hoje · parcial</span>}
      </p>
      <ul>
        {[...series].reverse().map((s) => (
          <li key={s.chave} className="vg-dica-item">
            <Chave forma="barra" cor={s.cor} />
            <span className="vg-dica-valor">{formato(linha.valores[s.chave] ?? 0)}</span>
            <span className="vg-dica-nome">{s.nome}</span>
          </li>
        ))}
      </ul>
      {rodape && <div className="afi-dica-rodape">{rodape(linha)}</div>}
    </div>
  );
}

function Tabela({ titulo, dias, series, formato, total }: {
  titulo: string;
  dias: DiaBarras[];
  series: SerieBarra[];
  formato: (v: number) => string;
  total?: { nome: string; formato: (d: DiaBarras) => string };
}) {
  const caixa = useRef<HTMLDivElement>(null);
  // abre já no fim (os dias mais recentes)
  useEffect(() => {
    const el = caixa.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  const ultimo = dias.at(-1)?.dia;
  return (
    <div ref={caixa} className="vg-tabela" tabIndex={0} role="region" aria-label={`Tabela: ${titulo}`}>
      <table className="adm-tabela">
        <caption className="sr-only">{titulo} por dia.</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            {series.map((s) => (
              <th key={s.chave} scope="col" className="num">
                {s.nome}
              </th>
            ))}
            {total && (
              <th scope="col" className="num">
                {total.nome}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {dias.map((d) => (
            <tr key={d.dia} data-fase={d.dia === ultimo ? 'hoje' : 'passado'}>
              <th scope="row">
                {fmt.diaCurto(d.dia)} <span className="vg-tab-semana">{diaSemana(d.dia)}</span>
                {d.dia === ultimo && <Selo tom="verde">hoje</Selo>}
              </th>
              {series.map((s) => (
                <td key={s.chave} className="num">
                  {formato(d.valores[s.chave] ?? 0)}
                </td>
              ))}
              {total && <td className="num afi-tab-total">{total.formato(d)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Figura com título, legenda (liga/desliga séries quando há mais de uma), o gráfico e a opção de tabela.
 * `series` na ordem da pilha (a primeira fica embaixo). `formato` = valor exato (dica e tabela); `formatoEixo` =
 * rótulo curto do eixo; `passoMin` = menor passo do eixo (1 para contagens; 100 para moedas em centavos).
 */
export function GraficoBarras({
  titulo, subtitulo, dias, series, formato, formatoEixo, passoMin = 1, resumo, rodapeDica, total, vazio,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  dias: DiaBarras[];
  series: SerieBarra[];
  formato: (v: number) => string;
  formatoEixo: (v: number) => string;
  passoMin?: number;
  /** frase para leitores de tela (o que o gráfico mostra) */
  resumo: string;
  /** linha extra na dica (ex.: total do dia) */
  rodapeDica?: (d: DiaBarras) => ReactNode;
  /** coluna de total na tabela */
  total?: { nome: string; formato: (d: DiaBarras) => string };
  /** aviso sobre o gráfico quando o período não tem nada */
  vazio?: string;
}) {
  const id = useId();
  const [ocultas, setOcultas] = useState<ReadonlySet<string>>(() => new Set());
  const [tabela, setTabela] = useState(false);
  const visiveis = series.filter((s) => !ocultas.has(s.chave));
  // o último dia da série é hoje (ainda em andamento)
  const hoje = dias.at(-1)?.dia ?? '';

  const { linhas, max } = useMemo(() => {
    let max = 0;
    const linhas = dias.map((d) => {
      const l: LinhaGrafico = { dia: d.dia, hoje: d.dia === hoje };
      let soma = 0;
      for (const s of series) {
        if (ocultas.has(s.chave)) continue;
        const v = Math.max(0, d.valores[s.chave] ?? 0);
        l[s.chave] = v;
        soma += v;
        if (v > 0) {
          l.base ??= s.chave;
          l.topo = s.chave;
        }
      }
      max = Math.max(max, soma);
      return l;
    });
    return { linhas, max };
  }, [dias, ocultas, series, hoje]);
  const porDia = useMemo(() => new Map(dias.map((d) => [d.dia, d])), [dias]);
  const eixo = eixoY(max, passoMin);
  const maiorRotulo = Math.max(...eixo.ticks.map((t) => formatoEixo(t).length));
  const larguraY = Math.min(76, Math.max(28, 12 + 6.4 * maiorRotulo));
  const nada = max === 0;

  const alternar = (chave: string) =>
    setOcultas((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      // ao menos uma série fica visível
      else if (series.length - novo.size > 1) novo.add(chave);
      return novo;
    });

  return (
    <figure className="vg-fig" aria-labelledby={`${id}-t`}>
      <div className="vg-fig-cabeca">
        <div className="min-w-0">
          <h3 id={`${id}-t`} className="vg-fig-titulo">
            {titulo}
          </h3>
          {subtitulo && <p className="vg-fig-sub">{subtitulo}</p>}
        </div>
        <BotaoAdm variante="fantasma" tamanho="p" className="vg-fig-botao" aria-pressed={tabela} onClick={() => setTabela((t) => !t)}>
          {tabela ? <ChartColumn className="h-4 w-4" aria-hidden /> : <Table2 className="h-4 w-4" aria-hidden />}
          {tabela ? 'Gráfico' : 'Tabela'}
        </BotaoAdm>
      </div>

      <ul className="vg-legenda" aria-label={series.length > 1 ? 'Séries (toque para mostrar ou esconder)' : 'Legenda'}>
        {series.length > 1 ? (
          series.map((s) => (
            <li key={s.chave}>
              <button
                type="button"
                className="vg-leg"
                aria-pressed={!ocultas.has(s.chave)}
                title={ocultas.has(s.chave) ? 'Mostrar esta série' : 'Esconder esta série'}
                onClick={() => alternar(s.chave)}
              >
                <Chave forma="barra" cor={s.cor} />
                {s.nome}
              </button>
            </li>
          ))
        ) : (
          <li className="vg-leg-fixo afi-leg-unica">
            <Chave forma="barra" cor={series[0]?.cor ?? COR_EIXO} />
            {series[0]?.nome}
          </li>
        )}
        <li className="vg-leg-fixo">
          <span style={{ opacity: PARCIAL }}>
            <Chave forma="barra" cor={series[0]?.cor ?? COR_EIXO} />
          </span>
          hoje (em andamento)
        </li>
      </ul>

      <p id={`${id}-r`} className="sr-only">
        {resumo}
      </p>
      {tabela ? (
        <Tabela titulo={titulo} dias={dias} series={series} formato={formato} total={total} />
      ) : (
        <div className="vg-plot afi-plot" role="group" aria-label={`Gráfico: ${titulo}`} aria-describedby={`${id}-r`}>
          <ResponsiveContainer width="100%" height="100%" debounce={120} initialDimension={{ width: 480, height: 240 }}>
            <BarChart
              data={linhas}
              barCategoryGap="18%"
              margin={{ top: 12, right: 6, bottom: 0, left: 0 }}
              accessibilityLayer
              title={titulo}
              desc={resumo}
            >
              <CartesianGrid vertical={false} stroke={COR_GRADE} />
              <XAxis
                dataKey="dia"
                tickFormatter={(dia: string) => (dia === hoje ? 'hoje' : fmt.diaCurto(dia))}
                tick={TICK}
                tickLine={false}
                axisLine={{ stroke: '#d5dbe5' }}
                interval="preserveEnd"
                minTickGap={14}
                tickMargin={6}
                height={24}
              />
              <YAxis
                width={larguraY}
                domain={[0, eixo.topo]}
                ticks={eixo.ticks}
                allowDataOverflow
                interval={0}
                tickFormatter={(v: number) => formatoEixo(v)}
                tick={TICK}
                tickLine={false}
                axisLine={false}
              />
              {visiveis.map((s) => (
                <Bar
                  key={s.chave}
                  dataKey={s.chave}
                  name={s.nome}
                  stackId="pilha"
                  fill={s.cor}
                  maxBarSize={22}
                  shape={formaBarra(s.chave)}
                  activeBar={formaBarra(s.chave, true)}
                  isAnimationActive={false}
                />
              ))}
              <Tooltip
                content={(p) => (
                  <Dica
                    linha={porDia.get(String(p.label))}
                    hoje={String(p.label) === hoje}
                    series={visiveis}
                    formato={formato}
                    rodape={rodapeDica}
                  />
                )}
                cursor={{ fill: '#eef2f7', fillOpacity: 0.7 }}
                isAnimationActive={false}
                wrapperStyle={{ zIndex: 5, outline: 'none' }}
              />
            </BarChart>
          </ResponsiveContainer>
          {nada && vazio && (
            <p className="afi-plot-vazio" aria-hidden>
              {vazio}
            </p>
          )}
        </div>
      )}
    </figure>
  );
}

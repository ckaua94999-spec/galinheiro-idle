'use client';

// Gráfico diário da visão geral (recharts): histórico e projeção no mesmo eixo de dias. A projeção é tracejada,
// com faixa sombreada (mín–máx) e fundo próprio depois da linha "hoje"; saídas (lado −1) descem do zero.
// A legenda liga/desliga séries (a escala se reajusta) e picos muito acima do resto viram barras cortadas.
// Dica (tooltip) em pt-BR e visão em tabela, o equivalente acessível do gráfico.
import { ChartColumn, Scissors, Table2 } from 'lucide-react';
import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type BarShapeProps, type DotItemDotProps,
} from 'recharts';
import { BotaoAdm, Selo, fmt } from '../ui';
import { diaLongo, diaSemana, faixaDe, num, type Linha } from './series';

export type Forma = 'barra' | 'linha' | 'teto';

export interface DefSerie {
  /** campo da Linha com o valor real (no 'teto', o valor projetado) */
  chave: string;
  nome: string;
  cor: string;
  /** teto = potencial (linha pontilhada, só no futuro) */
  forma: Forma;
  /** −1 desenha para baixo do zero (saídas) */
  lado?: 1 | -1;
  /** campo do centro da projeção; a faixa fica em `${proj}Faixa` */
  proj?: string;
}

export interface Painel {
  series: DefSerie[];
  /** faixa = painel baixo e sincronizado (ex.: novos por dia sob o total de membros) */
  tipo?: 'principal' | 'faixa';
}

// cromo do gráfico (recessivo): grade, eixos, "hoje" e o fundo da projeção
const COR_GRADE = '#e8ecf2';
const COR_EIXO = '#64708a';
const COR_HOJE = '#94a3b8';
const FUNDO_PROJECAO = '#f3f6fa';
const TICK = { fontSize: 11, fill: COR_EIXO, fontWeight: 600 };

// ---------------------------------------------------------------- dados de exibição

interface PainelPronto {
  dados: Linha[];
  espelho: boolean;
  /** maior valor exibido acima e abaixo do zero */
  cima: number;
  baixo: number;
}

/**
 * Prepara as linhas de um painel com as séries visíveis: x_<campo> = valor com sinal do lado (saídas negativas),
 * faixas espelhadas e barras cortadas (c_<chave> = 1) quando um pico passa muito do resto e das outras séries
 * do mesmo lado — o valor real continua na dica e na tabela.
 */
function prepararPainel(linhas: Linha[], series: DefSerie[]): PainelPronto {
  const limites = new Map<string, number>();
  for (const s of series) {
    if (s.forma !== 'barra') continue;
    const lado = s.lado ?? 1;
    const vals = linhas
      .map((l) => num(l, s.chave))
      .filter((v): v is number => v !== undefined && v > 0)
      .sort((a, b) => a - b);
    if (vals.length < 5) continue;
    const p90 = vals[Math.floor(0.9 * (vals.length - 1))] ?? 0;
    let outros = 0;
    for (const o of series) {
      if ((o.lado ?? 1) !== lado) continue;
      for (const l of linhas) {
        if (o !== s) outros = Math.max(outros, num(l, o.chave) ?? 0);
        if (o.proj) outros = Math.max(outros, num(l, o.proj) ?? 0, faixaDe(l, `${o.proj}Faixa`)?.[1] ?? 0);
      }
    }
    const limite = Math.max(p90 * 4, outros);
    if ((vals.at(-1) ?? 0) > limite * 1.2) limites.set(s.chave, limite);
  }

  const max = { cima: 0, baixo: 0 };
  const medir = (lado: 1 | -1, v: number) => {
    if (lado > 0) max.cima = Math.max(max.cima, v);
    else max.baixo = Math.max(max.baixo, v);
  };
  const dados = linhas.map((l) => {
    const d: Linha = { dia: l.dia, fase: l.fase };
    for (const s of series) {
      const lado = s.lado ?? 1;
      const v = num(l, s.chave);
      if (v !== undefined) {
        const limite = limites.get(s.chave);
        const exibido = limite !== undefined && v > limite ? limite : v;
        d[`x_${s.chave}`] = lado * exibido;
        if (exibido !== v) d[`c_${s.chave}`] = 1;
        medir(lado, exibido);
      }
      if (s.proj) {
        const c = num(l, s.proj);
        const f = faixaDe(l, `${s.proj}Faixa`);
        if (c !== undefined) {
          d[`x_${s.proj}`] = lado * c;
          medir(lado, c);
        }
        if (f) {
          d[`x_${s.proj}Faixa`] = lado > 0 ? f : [-f[1], -f[0]];
          medir(lado, f[1]);
        }
      }
    }
    return d;
  });
  return { dados, espelho: series.some((s) => s.lado === -1), ...max };
}

interface Eixo {
  dominio: [number, number];
  ticks: number[];
}

/**
 * Eixo Y com passo redondo (1; 2; 2,5; 5 × 10ⁿ) e no máximo `intervalos` divisões. O zero sempre aparece; abaixo
 * dele (saídas) o eixo vai só até o maior valor, com marcas apenas onde couberem — sem sobra vazia.
 */
function eixoY(cima: number, baixo: number, intervalos: number, passoMin: number): Eixo {
  const alcance = Math.max(cima + baixo, passoMin);
  let ordem = 10 ** Math.floor(Math.log10(alcance / (intervalos * 4)));
  let passo = passoMin;
  busca: for (let i = 0; i < 30; i++, ordem *= 10) {
    for (const m of [1, 2, 2.5, 5]) {
      passo = Math.max(passoMin, m * ordem);
      if (Math.max(1, Math.ceil((cima * 1.02) / passo)) + (baixo * 1.1) / passo <= intervalos + 0.25) break busca;
    }
  }
  const topo = Math.max(1, Math.ceil((cima * 1.02) / passo)) * passo;
  const ticks: number[] = [];
  for (let k = 0; k * passo <= topo; k++) ticks.push(k * passo);
  for (let k = 1; k * passo <= baixo * 1.1; k++) ticks.unshift(-k * passo);
  return { dominio: [baixo > 0 ? -baixo * 1.1 : 0, topo], ticks };
}

// ---------------------------------------------------------------- marcas

/** Barra com ponta arredondada (base reta no zero), mais clara hoje (dia parcial) e quebrada se cortada. */
function formaBarra(lado: 1 | -1, chave: string, ativa = false) {
  return function FormaBarra(p: BarShapeProps): ReactElement {
    const { x, y, width: w, height: h, fill } = p;
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h === 0) return <g />;
    const linha = p.payload as Linha | undefined;
    const topo = Math.min(y, y + h);
    const alt = Math.abs(h);
    const r = Math.min(4, w / 2, alt);
    const base = topo + alt;
    const d =
      lado > 0
        ? `M${x},${base}V${topo + r}Q${x},${topo} ${x + r},${topo}H${x + w - r}Q${x + w},${topo} ${x + w},${topo + r}V${base}Z`
        : `M${x},${topo}V${base - r}Q${x},${base} ${x + r},${base}H${x + w - r}Q${x + w},${base} ${x + w},${base - r}V${topo}Z`;
    const cortada = num(linha, `c_${chave}`) === 1 && alt > 9;
    const recuo = Math.min(7, alt / 3);
    const yq = lado > 0 ? topo + recuo : base - recuo - 6;
    return (
      <g opacity={linha?.fase === 'hoje' ? 0.55 : 1} style={ativa ? { filter: 'brightness(0.88)' } : undefined}>
        <path d={d} fill={fill} />
        {cortada && <path d={`M${x - 1},${yq + 3}L${x + w + 1},${yq}V${yq + 3}L${x - 1},${yq + 6}Z`} fill="#fff" />}
      </g>
    );
  };
}

/** Ponto de hoje (fim do histórico), com anel da cor do fundo. */
function pontoHoje(cor: string) {
  return function PontoHoje(p: DotItemDotProps): ReactNode {
    const l = p.payload as Linha | undefined;
    if (l?.fase !== 'hoje' || p.cx == null || p.cy == null) return null;
    return <circle cx={p.cx} cy={p.cy} r={4.5} fill={cor} stroke="#fff" strokeWidth={2} />;
  };
}

/** Fim da projeção: ponto vazado e o valor aproximado ao lado. */
function fimProjecao(cor: string, rotulo: (v: number) => string) {
  return function FimProjecao(p: DotItemDotProps): ReactNode {
    if (p.index !== p.points.length - 1 || p.cx == null || p.cy == null || typeof p.value !== 'number') return null;
    return (
      <g>
        <circle cx={p.cx} cy={p.cy} r={3.5} fill="#fff" stroke={cor} strokeWidth={2} />
        <text x={p.cx - 7} y={p.cy - 9} textAnchor="end" className="vg-rotulo-fim">
          ~{rotulo(Math.abs(p.value))}
        </text>
      </g>
    );
  };
}

/** Rótulos acima da linha "hoje": "hoje" à esquerda e "projeção" à direita. */
function RotuloHoje(props: { viewBox?: { x?: number; y?: number } }): ReactElement {
  const { x, y } = props.viewBox ?? {};
  if (x == null || y == null) return <g />;
  return (
    <g className="vg-rotulo-hoje">
      <text x={x - 5} y={y - 10} textAnchor="end">
        hoje
      </text>
      <text x={x + 5} y={y - 10} textAnchor="start" className="vg-rotulo-proj">
        projeção →
      </text>
    </g>
  );
}

/** Amostra da legenda/dica: retângulo (barra), traço (linha), tracejado (projeção), pontos (potencial), faixa. */
export function Chave({ forma, cor }: { forma: Forma | 'proj' | 'faixa'; cor: string }) {
  return (
    <svg className="vg-chave" width="16" height="10" viewBox="0 0 16 10" aria-hidden>
      {forma === 'barra' && <rect x="3" y="0.5" width="10" height="9" rx="2" fill={cor} />}
      {forma === 'linha' && <line x1="1" y1="5" x2="15" y2="5" stroke={cor} strokeWidth="2.5" strokeLinecap="round" />}
      {forma === 'proj' && <line x1="0" y1="5" x2="16" y2="5" stroke={cor} strokeWidth="2" strokeDasharray="4.5 2.5" />}
      {forma === 'teto' && <line x1="2" y1="5" x2="15" y2="5" stroke={cor} strokeWidth="2.6" strokeDasharray="0.1 4.2" strokeLinecap="round" />}
      {forma === 'faixa' && <rect x="0.5" y="1" width="15" height="8" rx="2" fill={cor} fillOpacity="0.22" />}
    </svg>
  );
}

// ---------------------------------------------------------------- dica e tabela

interface ItemDica {
  s: DefSerie;
  forma: Forma | 'proj';
  valor: string;
  faixa?: string;
}

function itensDoDia(l: Linha, series: DefSerie[], formato: (v: number) => string): ItemDica[] {
  const itens: ItemDica[] = [];
  for (const s of series) {
    if (s.forma === 'teto' || l.fase !== 'futuro') {
      const v = num(l, s.chave);
      if (v !== undefined) itens.push({ s, forma: s.forma, valor: formato(v) });
    } else if (s.proj) {
      const v = num(l, s.proj);
      const f = faixaDe(l, `${s.proj}Faixa`);
      if (v !== undefined) {
        itens.push({ s, forma: 'proj', valor: `~${formato(v)}`, faixa: f ? `${formato(f[0])} a ${formato(f[1])}` : undefined });
      }
    }
  }
  return itens;
}

function Dica({ linha, series, formato, cortes }: {
  linha: Linha | undefined;
  series: DefSerie[];
  formato: (v: number) => string;
  /** "dia|chave" das barras cortadas */
  cortes: ReadonlySet<string>;
}) {
  if (!linha) return null;
  const itens = itensDoDia(linha, series, formato);
  if (!itens.length) return null;
  return (
    <div className="vg-dica">
      <p className="vg-dica-dia">
        {diaLongo(linha.dia)}
        {linha.fase !== 'passado' && <span className="vg-dica-fase">{linha.fase === 'hoje' ? 'hoje · parcial' : 'projeção'}</span>}
      </p>
      <ul>
        {itens.map(({ s, forma, valor, faixa }) => (
          <li key={s.chave} className="vg-dica-item">
            <Chave forma={forma} cor={s.cor} />
            <span className="vg-dica-valor">{valor}</span>
            <span className="vg-dica-nome">
              {s.nome}
              {faixa && <span className="vg-dica-faixa">faixa provável {faixa}</span>}
              {cortes.has(`${linha.dia}|${s.chave}`) && <span className="vg-dica-faixa">barra cortada: passa da escala</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabelaDias({ titulo, linhas, series, formato }: { titulo: string; linhas: Linha[]; series: DefSerie[]; formato: (v: number) => string }) {
  const caixa = useRef<HTMLDivElement>(null);
  // abre já mostrando hoje (com dois dias antes) em vez do começo do histórico
  useEffect(() => {
    const el = caixa.current;
    const hoje = el?.querySelector<HTMLElement>('tr[data-fase="hoje"]');
    const cabeca = el?.querySelector<HTMLElement>('thead');
    if (el && hoje) el.scrollTop = Math.max(0, hoje.offsetTop - (cabeca?.offsetHeight ?? 0) - hoje.offsetHeight * 2);
  }, []);
  return (
    <div ref={caixa} className="vg-tabela" tabIndex={0} role="region" aria-label={`Tabela: ${titulo}`}>
      <table className="adm-tabela">
        <caption className="sr-only">{titulo} por dia. Valores com ~ são projeções.</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            {series.map((s) => (
              <th key={s.chave} scope="col" className="num">
                {s.nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const itens = new Map(itensDoDia(l, series, formato).map((i) => [i.s.chave, i]));
            return (
              <tr key={l.dia} data-fase={l.fase}>
                <th scope="row">
                  {fmt.diaCurto(l.dia)} <span className="vg-tab-semana">{diaSemana(l.dia)}</span>
                  {l.fase === 'hoje' && <Selo tom="verde">hoje</Selo>}
                </th>
                {series.map((s) => {
                  const i = itens.get(s.chave);
                  return (
                    <td key={s.chave} className="num">
                      {i ? i.valor : '—'}
                      {i?.faixa && <span className="vg-tab-faixa">{i.faixa}</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- gráfico

/** Um painel do gráfico. O primeiro leva a dica, os rótulos de "hoje" e o foco do teclado; os outros só o cursor. */
function PainelGrafico({
  sync, titulo, resumo, series, faixa, pronto, eixo, larguraY, hoje, ultimo, primeiro, ultimoPainel, conteudoDica, formatoEixo, rotuloFim,
}: {
  sync: string;
  titulo: string;
  resumo: string;
  /** séries visíveis deste painel */
  series: DefSerie[];
  faixa: boolean;
  pronto: PainelPronto;
  eixo: Eixo;
  larguraY: number;
  hoje: string | undefined;
  ultimo: string | undefined;
  primeiro: boolean;
  ultimoPainel: boolean;
  conteudoDica: (label: unknown) => ReactNode;
  formatoEixo: (v: number) => string;
  rotuloFim: (v: number) => string;
}) {
  return (
    <div className="vg-plot" data-painel={faixa ? 'faixa' : 'principal'}>
      <ResponsiveContainer width="100%" height="100%" debounce={120} initialDimension={{ width: 480, height: faixa ? 84 : 240 }}>
        <ComposedChart
          data={pronto.dados}
          syncId={sync}
          stackOffset="sign"
          barCategoryGap="16%"
          margin={{ top: faixa ? 10 : 24, right: 10, bottom: 0, left: 0 }}
          accessibilityLayer={primeiro}
          title={primeiro ? titulo : undefined}
          desc={primeiro ? resumo : undefined}
        >
          {hoje && ultimo && hoje !== ultimo && (
            <ReferenceArea x1={hoje} x2={ultimo} fill={FUNDO_PROJECAO} fillOpacity={1} stroke="none" zIndex={-150} />
          )}
          <CartesianGrid vertical={false} stroke={COR_GRADE} />
          <XAxis
            dataKey="dia"
            hide={!ultimoPainel}
            tickFormatter={fmt.diaCurto}
            tick={TICK}
            tickLine={false}
            axisLine={{ stroke: '#d5dbe5' }}
            minTickGap={16}
            tickMargin={6}
            height={24}
          />
          <YAxis
            width={larguraY}
            domain={eixo.dominio}
            ticks={eixo.ticks}
            allowDataOverflow
            interval={0}
            // com faixa logo abaixo, o "0" do painel de cima encostaria no rótulo do topo da faixa
            tickFormatter={(v: number) => (v === 0 && !ultimoPainel ? '' : formatoEixo(Math.abs(v)))}
            tick={TICK}
            tickLine={false}
            axisLine={false}
          />
          {pronto.espelho && <ReferenceLine y={0} stroke="#a7b1c2" />}
          {hoje && <ReferenceLine x={hoje} stroke={COR_HOJE} label={primeiro ? RotuloHoje : undefined} />}
          {series.map((s) => {
            const lado = s.lado ?? 1;
            return (
              <Fragment key={s.chave}>
                {s.proj && (
                  <Area
                    dataKey={`x_${s.proj}Faixa`}
                    fill={s.cor}
                    fillOpacity={0.13}
                    stroke="none"
                    activeDot={false}
                    tooltipType="none"
                    isAnimationActive={false}
                  />
                )}
                {s.proj && (
                  <Line
                    dataKey={`x_${s.proj}`}
                    stroke={s.cor}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={s.forma === 'linha' ? fimProjecao(s.cor, rotuloFim) : false}
                    activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                )}
                {s.forma === 'barra' && (
                  <Bar
                    dataKey={`x_${s.chave}`}
                    stackId="barras"
                    fill={s.cor}
                    maxBarSize={24}
                    shape={formaBarra(lado, s.chave)}
                    activeBar={formaBarra(lado, s.chave, true)}
                    isAnimationActive={false}
                  />
                )}
                {s.forma === 'linha' && (
                  <Line
                    dataKey={`x_${s.chave}`}
                    stroke={s.cor}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    dot={pontoHoje(s.cor)}
                    activeDot={{ r: 4.5, stroke: '#fff', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                )}
                {s.forma === 'teto' && (
                  <Line
                    dataKey={`x_${s.chave}`}
                    stroke={s.cor}
                    strokeWidth={2.6}
                    strokeDasharray="0.1 5"
                    strokeLinecap="round"
                    dot={false}
                    activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                )}
              </Fragment>
            );
          })}
          <Tooltip
            content={(p) => (primeiro ? conteudoDica(p.label) : null)}
            cursor={{ stroke: COR_EIXO, strokeOpacity: 0.45, strokeWidth: 1 }}
            isAnimationActive={false}
            wrapperStyle={{ zIndex: 5, outline: 'none' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Figura com título, legenda (liga/desliga séries), um ou mais painéis sincronizados e a opção de tabela.
 * `formato` = valor exato (dica e tabela); `formatoEixo` = rótulo curto (eixo e fim da projeção);
 * `passoMin` = menor passo do eixo Y (1 para contagens; 100 para moedas em centavos).
 */
export function GraficoDias({
  titulo, subtitulo, linhas, paineis, formato, formatoEixo, passoMin = 1, resumo, nota,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  linhas: Linha[];
  paineis: Painel[];
  formato: (v: number) => string;
  formatoEixo: (v: number) => string;
  passoMin?: number;
  /** frase para leitores de tela (o que o gráfico mostra) */
  resumo: string;
  nota?: ReactNode;
}) {
  const id = useId();
  const [ocultas, setOcultas] = useState<ReadonlySet<string>>(() => new Set());
  const [tabela, setTabela] = useState(false);

  const todas = useMemo(() => paineis.flatMap((p) => p.series), [paineis]);
  const visiveis = todas.filter((s) => !ocultas.has(s.chave));
  const prontos = useMemo(
    () => paineis.map((p) => prepararPainel(linhas, p.series.filter((s) => !ocultas.has(s.chave)))),
    [linhas, paineis, ocultas],
  );
  const eixos = prontos.map((p, i) => eixoY(p.cima, p.baixo, paineis[i]?.tipo === 'faixa' ? 2 : 5, passoMin));
  const porDia = useMemo(() => new Map(linhas.map((l) => [l.dia, l])), [linhas]);
  const hoje = linhas.find((l) => l.fase === 'hoje')?.dia;
  const ultimo = linhas.at(-1)?.dia;
  // mesma largura de eixo em todos os painéis (alinha os dias), pelo maior rótulo
  const maiorRotulo = Math.max(...eixos.flatMap((e) => e.ticks.map((t) => formatoEixo(Math.abs(t)).length)));
  const larguraY = Math.min(76, Math.max(28, 12 + 6.4 * maiorRotulo));
  // barras cortadas: marcadas na dica e listadas na nota (com o valor real)
  const cortadas = useMemo(() => {
    const lista: { s: DefSerie; dia: string }[] = [];
    prontos.forEach((p, i) => {
      for (const d of p.dados) for (const s of paineis[i]?.series ?? []) if (num(d, `c_${s.chave}`) === 1) lista.push({ s, dia: d.dia });
    });
    return lista;
  }, [prontos, paineis]);
  const cortes = useMemo(() => new Set(cortadas.map((c) => `${c.dia}|${c.s.chave}`)), [cortadas]);
  // rótulo do fim da projeção: valor exato se for curto ("1.042"), senão o compacto do eixo ("1,6 mi")
  const rotuloFim = (v: number) => (formato(v).length <= 6 ? formato(v) : formatoEixo(v));
  const temProjecao = visiveis.some((s) => s.proj);

  const alternar = (chave: string) =>
    setOcultas((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  const conteudoDica = (label: unknown) => (
    <Dica linha={porDia.get(String(label))} series={visiveis} formato={formato} cortes={cortes} />
  );

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

      <ul className="vg-legenda" aria-label="Séries (toque para mostrar ou esconder)">
        {todas.map((s) => (
          <li key={s.chave}>
            <button
              type="button"
              className="vg-leg"
              aria-pressed={!ocultas.has(s.chave)}
              title={ocultas.has(s.chave) ? 'Mostrar esta série' : 'Esconder esta série'}
              onClick={() => alternar(s.chave)}
            >
              <Chave forma={s.forma} cor={s.cor} />
              {s.nome}
            </button>
          </li>
        ))}
        {temProjecao && (
          <li className="vg-leg-fixo">
            <Chave forma="proj" cor={COR_EIXO} />
            projeção
          </li>
        )}
        {temProjecao && (
          <li className="vg-leg-fixo">
            <Chave forma="faixa" cor={COR_EIXO} />
            faixa provável
          </li>
        )}
      </ul>

      <p id={`${id}-r`} className="sr-only">
        {resumo}
      </p>
      {tabela ? (
        <TabelaDias titulo={titulo} linhas={linhas} series={visiveis} formato={formato} />
      ) : (
        <div className="vg-paineis" role="group" aria-label={`Gráfico: ${titulo}`} aria-describedby={`${id}-r`}>
          {paineis.map((p, i) => (
            <PainelGrafico
              key={i}
              sync={id}
              titulo={titulo}
              resumo={resumo}
              series={p.series.filter((s) => !ocultas.has(s.chave))}
              faixa={p.tipo === 'faixa'}
              pronto={prontos[i]!}
              eixo={eixos[i]!}
              larguraY={larguraY}
              hoje={hoje}
              ultimo={ultimo}
              primeiro={i === 0}
              ultimoPainel={i === paineis.length - 1}
              conteudoDica={conteudoDica}
              formatoEixo={formatoEixo}
              rotuloFim={rotuloFim}
            />
          ))}
        </div>
      )}

      {((cortadas.length > 0 && !tabela) || nota) && (
        <figcaption className="vg-fig-nota">
          {cortadas.length > 0 && !tabela && (
            <span className="vg-fig-nota-item">
              <Scissors className="h-3.5 w-3.5" aria-hidden />
              <span>
                {cortadas.length === 1 ? 'Barra cortada' : 'Barras cortadas'} para caber na escala:{' '}
                {cortadas
                  .slice(0, 4)
                  .map(({ s, dia }) => `${s.nome.replace(/\s*[↑↓]$/, '')} em ${fmt.diaCurto(dia)} (${formato(num(porDia.get(dia), s.chave) ?? 0)})`)
                  .join('; ')}
                {cortadas.length > 4 ? '…' : '.'}
              </span>
            </span>
          )}
          {nota && <span className="vg-fig-nota-item">{nota}</span>}
        </figcaption>
      )}
    </figure>
  );
}

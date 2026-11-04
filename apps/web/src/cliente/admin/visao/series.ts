// Séries da visão geral: junta histórico e projeção num eixo único de dias (uma linha por dia, AAAA-MM-DD no
// horário de Brasília) e resume as projeções em números para os cartões. Funções puras.
import type { AdminGraficosDTO, SerieDTO, SerieProjetadaDTO } from '@galinheiro/api-contract';

export type Faixa = [number, number];
export type Fase = 'passado' | 'hoje' | 'futuro';

/**
 * Uma linha por dia. Campos numéricos por série: o valor real (histórico), o centro da projeção e a faixa
 * `${chave}Faixa` = [mín, máx]. "hoje" é o último dia do histórico (ainda em andamento).
 */
export interface Linha {
  dia: string;
  fase: Fase;
  [campo: string]: string | number | Faixa | undefined;
}

export const num = (l: Linha | undefined, campo: string): number | undefined => {
  const v = l?.[campo];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
};

export const faixaDe = (l: Linha | undefined, campo: string): Faixa | undefined => {
  const v = l?.[campo];
  return Array.isArray(v) ? v : undefined;
};

interface Projecao {
  chave: string;
  serie: readonly (SerieProjetadaDTO | SerieDTO)[];
  /** série do histórico que esta projeção continua: a linha tracejada sai do valor de hoje */
  continua?: string;
}

/** Junta séries do histórico (mesmos dias) e projeções (dias seguintes) num eixo único de dias. */
export function montarLinhas(historico: Record<string, readonly SerieDTO[]>, projecoes: readonly Projecao[]): Linha[] {
  const porDia = new Map<string, Linha>();
  const linha = (dia: string, fase: Fase): Linha => {
    let l = porDia.get(dia);
    if (!l) {
      l = { dia, fase };
      porDia.set(dia, l);
    }
    return l;
  };
  for (const [chave, serie] of Object.entries(historico)) {
    for (const p of serie) linha(p.dia, 'passado')[chave] = p.valor;
  }
  const hoje = [...porDia.keys()].sort().at(-1);
  const linhaHoje = hoje ? porDia.get(hoje) : undefined;
  if (linhaHoje) linhaHoje.fase = 'hoje';

  for (const pr of projecoes) {
    let temFaixa = false;
    for (const p of pr.serie) {
      if (hoje && p.dia <= hoje) continue;
      const l = linha(p.dia, 'futuro');
      l[pr.chave] = p.valor;
      if ('min' in p) {
        l[`${pr.chave}Faixa`] = [p.min, p.max];
        temFaixa = true;
      }
    }
    // âncora em hoje: a projeção começa no último valor real, com faixa de largura zero
    const ancora = pr.continua ? num(linhaHoje, pr.continua) : undefined;
    if (linhaHoje && ancora !== undefined) {
      linhaHoje[pr.chave] = ancora;
      if (temFaixa) linhaHoje[`${pr.chave}Faixa`] = [ancora, ancora];
    }
  }
  return [...porDia.values()].sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0));
}

export const linhasPessoas = (g: AdminGraficosDTO['pessoas']): Linha[] =>
  montarLinhas({ novos: g.novos, total: g.total, ativos: g.ativos }, [
    { chave: 'novosProj', serie: g.projecaoNovos },
    { chave: 'totalProj', serie: g.projecaoTotal, continua: 'total' },
    { chave: 'ativosProj', serie: g.projecaoAtivos, continua: 'ativos' },
  ]);

export const linhasOvos = (g: AdminGraficosDTO['ovos']): Linha[] =>
  montarLinhas({ produzidos: g.produzidos, vendidos: g.vendidos }, [
    { chave: 'tendencia', serie: g.projecaoTendencia },
    { chave: 'potencial', serie: g.projecaoPotencial },
  ]);

export const linhasMoedas = (g: AdminGraficosDTO['moedas']): Linha[] =>
  montarLinhas({ emitidas: g.emitidasX100, gastas: g.gastasX100, circulacao: g.circulacaoX100 }, [
    { chave: 'emitidasProj', serie: g.projecaoEmitidasX100 },
    { chave: 'gastasProj', serie: g.projecaoGastasX100 },
    { chave: 'circulacaoProj', serie: g.projecaoCirculacaoX100, continua: 'circulacao' },
    { chave: 'potencialEmissao', serie: g.potencialEmissaoX100 },
  ]);

// ---------------------------------------------------------------- resumo das projeções (cartões)

const media = (v: readonly number[]): number => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0);
const soma = (v: readonly number[]): number => v.reduce((s, x) => s + x, 0);
const valores = (s: readonly SerieDTO[]): number[] => s.map((p) => p.valor);

export interface ResumoProjecoes {
  /** último dia projetado */
  ate: string | null;
  pessoas: { hoje: number; fim: SerieProjetadaDTO | null; ativosHoje: number; ativosFim: SerieProjetadaDTO | null };
  ovos: {
    fim: SerieProjetadaDTO | null;
    potencialFim: number | null;
    somaTendencia: number;
    somaPotencial: number;
    /** média dos últimos 7 dias ÷ potencial médio da próxima semana (null sem potencial) */
    aproveitamento: number | null;
  };
  moedas: { hoje: number; fim: SerieProjetadaDTO | null; potencialSemanaX100: number };
}

export function resumirProjecoes(g: AdminGraficosDTO): ResumoProjecoes {
  const { pessoas, ovos, moedas } = g;
  const potencialSemana = media(valores(ovos.projecaoPotencial.slice(0, 7)));
  return {
    ate: pessoas.projecaoTotal.at(-1)?.dia ?? null,
    pessoas: {
      hoje: pessoas.total.at(-1)?.valor ?? 0,
      fim: pessoas.projecaoTotal.at(-1) ?? null,
      ativosHoje: pessoas.ativos.at(-1)?.valor ?? 0,
      ativosFim: pessoas.projecaoAtivos.at(-1) ?? null,
    },
    ovos: {
      fim: ovos.projecaoTendencia.at(-1) ?? null,
      potencialFim: ovos.projecaoPotencial.at(-1)?.valor ?? null,
      somaTendencia: soma(valores(ovos.projecaoTendencia)),
      somaPotencial: soma(valores(ovos.projecaoPotencial)),
      aproveitamento: potencialSemana > 0 ? media(valores(ovos.produzidos.slice(-7))) / potencialSemana : null,
    },
    moedas: {
      hoje: moedas.circulacaoX100.at(-1)?.valor ?? 0,
      fim: moedas.projecaoCirculacaoX100.at(-1) ?? null,
      potencialSemanaX100: media(valores(moedas.potencialEmissaoX100.slice(0, 7))),
    },
  };
}

// ---------------------------------------------------------------- datas

const DIA_LONGO = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const DIA_SEMANA = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const DIA_EXTENSO = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

// o dia vem como AAAA-MM-DD (Brasília); meio-dia UTC evita virar o dia em qualquer fuso
const data = (dia: string) => new Date(`${dia}T12:00:00Z`);

/** "Seg., 05/10/2026" */
export const diaLongo = (dia: string): string => {
  const t = DIA_LONGO.format(data(dia));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
/** "seg." */
export const diaSemana = (dia: string): string => DIA_SEMANA.format(data(dia));
/** "segunda-feira, 5 de outubro" */
export const diaExtenso = (dia: string): string => DIA_EXTENSO.format(data(dia));

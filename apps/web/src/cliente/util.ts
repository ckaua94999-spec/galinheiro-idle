import { formatarMoedas, type Raridade, type Tier } from '@galinheiro/game-core';

/** Junta classes CSS ignorando valores falsos. */
export const cx = (...classes: (string | false | null | undefined)[]): string => classes.filter(Boolean).join(' ');

export const moedas = (x100: number): string => formatarMoedas(x100);

const DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const DIA_HORA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const formatarData = (iso: string): string => DATA.format(new Date(iso));
export const formatarDataHora = (iso: string): string => DATA_HORA.format(new Date(iso));
export const formatarDiaHora = (iso: string): string => DIA_HORA.format(new Date(iso));

export const COR_RARIDADE: Record<Raridade, string> = {
  comum: '#9AA3AF',
  raro: '#3B82F6',
  epico: '#8B5CF6',
  lendario: '#F5B301',
};

/** Cor base de cada faixa de humor (paleta de vida, DIRECAO_DE_ARTE 2.2). */
export const COR_TIER: Record<Tier, string> = {
  feliz: '#43bf2a', // --color-vida-verde
  neutro: '#8ccf2a',
  cansado: '#f2b705', // --color-vida-amarela
  triste: '#e5382b', // --color-vida-vermelha
};

/** Tom claro do humor (topo do gradiente de barras e selos). */
export const COR_TIER_CLARA: Record<Tier, string> = {
  feliz: '#9ef36a', // --color-vida-verde-clara
  neutro: '#c9f06a',
  cansado: '#ffe766', // --color-vida-amarela-clara
  triste: '#ff8a7a', // --color-vida-vermelha-clara
};

/** Valor de data-cor da .barra para cada humor (ui.css: verde, amarela, vermelha). */
export const COR_BARRA_TIER: Record<Tier, 'verde' | 'amarela' | 'vermelha'> = {
  feliz: 'verde',
  neutro: 'verde',
  cansado: 'amarela',
  triste: 'vermelha',
};

export function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error && erro.message ? erro.message : 'Ops! Tente de novo.';
}

// Parâmetros de balanceamento (GDD seção 4.1). Toda mudança de número gera nova CONFIG_VERSAO.
export const CONFIG_VERSAO = '1.0.3';

export type Tipo = 'galinha' | 'pato' | 'ganso' | 'avestruz';
export type Raridade = 'comum' | 'raro' | 'epico' | 'lendario';
export type Tier = 'feliz' | 'neutro' | 'cansado' | 'triste';
export type Item = `ovo_${Tipo}`;

export const TIPOS: readonly Tipo[] = ['galinha', 'pato', 'ganso', 'avestruz'];
export const RARIDADES: readonly Raridade[] = ['comum', 'raro', 'epico', 'lendario'];
export const ITENS: readonly Item[] = ['ovo_galinha', 'ovo_pato', 'ovo_ganso', 'ovo_avestruz'];

export const MS_SEGUNDO = 1_000;
export const MS_MINUTO = 60 * MS_SEGUNDO;
export const MS_HORA = 60 * MS_MINUTO;
export const MS_DIA = 24 * MS_HORA;

export interface TierCfg { acimaDe: number; multPct: number; atrasoH: number }
export interface AnimalCfg { raridade: Raridade; precoOvoX100: number; fatorPct: number }
export interface FaixaRoleta { tipo: Tipo; de: number; ate: number; grauInicio: number; largura: number }

export const TIERS: Record<Tier, TierCfg> = {
  feliz:   { acimaDe: 75, multPct: 100, atrasoH: 0 },
  neutro:  { acimaDe: 50, multPct: 75,  atrasoH: 2 },
  cansado: { acimaDe: 25, multPct: 50,  atrasoH: 6 },
  triste:  { acimaDe: 0,  multPct: 25,  atrasoH: 12 },
};

export const ANIMAIS: Record<Tipo, AnimalCfg> = {
  galinha:  { raridade: 'comum',    precoOvoX100: 120, fatorPct: 100 },
  pato:     { raridade: 'raro',     precoOvoX100: 180, fatorPct: 90 },
  ganso:    { raridade: 'epico',    precoOvoX100: 250, fatorPct: 80 },
  avestruz: { raridade: 'lendario', precoOvoX100: 400, fatorPct: 70 },
};

// Ordem = ordem dos setores na roda, no sentido horário a partir do topo (ponteiro).
export const FAIXAS_ROLETA: readonly FaixaRoleta[] = [
  { tipo: 'galinha',  de: 0,     ate: 5_999, grauInicio: 0,     largura: 216 },
  { tipo: 'pato',     de: 6_000, ate: 8_499, grauInicio: 216,   largura: 90 },
  { tipo: 'ganso',    de: 8_500, ate: 9_699, grauInicio: 306,   largura: 43.2 },
  { tipo: 'avestruz', de: 9_700, ate: 9_999, grauInicio: 349.2, largura: 10.8 },
];

export const CONFIG = {
  moedasIniciaisX100: 5_000,
  animalBoasVindas: 'galinha' as Tipo | null,
  primeiraPosturaImediata: true,
  galinheiro: { nivelMax: 32, ninhosPorNivel: 4, custoUpgradeX100: 2_500 }, // R$ 25,00 no PIX
  vida: { vidaUtilMs: 90 * MS_DIA }, // 7.776.000.000 ms
  ciclo: { baseH: 24, janelaGracaH: 4, limiarExtraBase: 5_000 }, // q_base = 0,50 (base 10.000)
  roleta: { custoX100: 5_500, margemGraus: 1.5, voltasMin: 5 },
  saque: { taxaFixaX100: 500, taxaPercentualBp: 400 }, // R$ 5,00 + 4% do valor debitado
  nome: { min: 1, max: 20 },
  tutorial: { etapaFinal: 8 },
};

// Rótulos de exibição (pt-BR)
export const NOME_TIPO: Record<Tipo, string> = {
  galinha: 'Galinha', pato: 'Pato', ganso: 'Ganso', avestruz: 'Avestruz',
};
export const NOME_TIPO_PLURAL_OVO: Record<Tipo, string> = {
  galinha: 'galinha', pato: 'pato', ganso: 'ganso', avestruz: 'avestruz',
};
export const NOME_RARIDADE: Record<Raridade, string> = {
  comum: 'Comum', raro: 'Raro', epico: 'Épico', lendario: 'Lendário',
};
export const GEMAS_RARIDADE: Record<Raridade, number> = { comum: 1, raro: 2, epico: 3, lendario: 4 };
export const NOME_TIER: Record<Tier, string> = {
  feliz: 'Feliz', neutro: 'Neutro', cansado: 'Cansado', triste: 'Triste',
};
export const EMOJI_TIER: Record<Tier, string> = { feliz: '😄', neutro: '😐', cansado: '😩', triste: '😢' };

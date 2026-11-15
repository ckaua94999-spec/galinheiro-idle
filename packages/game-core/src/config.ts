// Parâmetros de balanceamento (GDD seção 4.1). Toda mudança de número gera nova CONFIG_VERSAO.
export const CONFIG_VERSAO = '1.5.0';

export type Tipo = 'codorna' | 'galinha' | 'pato' | 'ganso' | 'avestruz';
export type Raridade = 'comum' | 'raro' | 'epico' | 'lendario';
export type Tier = 'feliz' | 'neutro' | 'cansado' | 'triste';
export type Item = `ovo_${Tipo}`;

export const TIPOS: readonly Tipo[] = ['codorna', 'galinha', 'pato', 'ganso', 'avestruz'];
export const RARIDADES: readonly Raridade[] = ['comum', 'raro', 'epico', 'lendario'];
export const ITENS: readonly Item[] = ['ovo_codorna', 'ovo_galinha', 'ovo_pato', 'ovo_ganso', 'ovo_avestruz'];

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
  // animal de boas-vindas (e também da roleta, com a mesma chance da galinha); rende pouco: o membro novo junta a liberação
  codorna:  { raridade: 'comum',    precoOvoX100: 35,  fatorPct: 100 },
  galinha:  { raridade: 'comum',    precoOvoX100: 120, fatorPct: 100 },
  pato:     { raridade: 'raro',     precoOvoX100: 180, fatorPct: 90 },
  ganso:    { raridade: 'epico',    precoOvoX100: 250, fatorPct: 80 },
  avestruz: { raridade: 'lendario', precoOvoX100: 400, fatorPct: 70 },
};

// Ordem = ordem dos setores na roda, no sentido horário a partir do topo (ponteiro).
export const FAIXAS_ROLETA: readonly FaixaRoleta[] = [
  // codorna e galinha dividem o antigo gomo da galinha (60%): 30% cada; os raros continuam com as mesmas chances
  { tipo: 'codorna',  de: 0,     ate: 2_999, grauInicio: 0,     largura: 108 },
  { tipo: 'galinha',  de: 3_000, ate: 5_999, grauInicio: 108,   largura: 108 },
  { tipo: 'pato',     de: 6_000, ate: 8_499, grauInicio: 216,   largura: 90 },
  { tipo: 'ganso',    de: 8_500, ate: 9_699, grauInicio: 306,   largura: 43.2 },
  { tipo: 'avestruz', de: 9_700, ate: 9_999, grauInicio: 349.2, largura: 10.8 },
];

/** Galos da rinha. Tudo em moedas do jogo; a chance e o prêmio aparecem para o jogador antes da aposta. */
export type Galo = 'favorito' | 'brigao' | 'azarao';
export interface GaloCfg { nome: string; chanceBp: number; premioPct: number }
export const GALOS: readonly Galo[] = ['favorito', 'brigao', 'azarao'];

export const CONFIG = {
  /** Bônus de cadastro padrão (a equipe muda no painel). Zero: o membro novo junta as moedas com a codorna. */
  moedasIniciaisX100: 0,
  animalBoasVindas: 'codorna' as Tipo | null,
  primeiraPosturaImediata: true,
  galinheiro: { nivelMax: 32, ninhosPorNivel: 4, custoUpgradeX100: 2_500 },
  vida: { vidaUtilMs: 90 * MS_DIA }, // 7.776.000.000 ms
  ciclo: { baseH: 24, janelaGracaH: 4, limiarExtraBase: 5_000 }, // q_base = 0,50 (base 10.000)
  /** A roleta começa trancada: o membro paga `liberacaoX100` uma vez e ganha o primeiro giro. */
  roleta: { custoX100: 5_500, liberacaoX100: 1_200, margemGraus: 1.5, voltasMin: 5 },
  /**
   * Rinha de galo, só com moedas do jogo. A casa leva vantagem: o retorno médio de cada galo
   * (chance × prêmio) fica abaixo de 100%, e a tela mostra esses números antes da aposta.
   */
  rinha: {
    apostaMinX100: 100,
    apostaMaxX100: 5_000,
    galos: {
      favorito: { nome: 'Favorito', chanceBp: 5_500, premioPct: 160 },
      brigao:   { nome: 'Brigão',   chanceBp: 4_000, premioPct: 220 },
      azarao:   { nome: 'Azarão',   chanceBp: 1_500, premioPct: 500 },
    } satisfies Record<Galo, GaloCfg>,
  },
  nome: { min: 1, max: 20 },
  tutorial: { etapaFinal: 8 },
};

// Rótulos de exibição (pt-BR)
export const NOME_TIPO: Record<Tipo, string> = {
  codorna: 'Codorna', galinha: 'Galinha', pato: 'Pato', ganso: 'Ganso', avestruz: 'Avestruz',
};
export const NOME_TIPO_PLURAL_OVO: Record<Tipo, string> = {
  codorna: 'codorna', galinha: 'galinha', pato: 'pato', ganso: 'ganso', avestruz: 'avestruz',
};
export const NOME_RARIDADE: Record<Raridade, string> = {
  comum: 'Comum', raro: 'Raro', epico: 'Épico', lendario: 'Lendário',
};
export const GEMAS_RARIDADE: Record<Raridade, number> = { comum: 1, raro: 2, epico: 3, lendario: 4 };
export const NOME_TIER: Record<Tier, string> = {
  feliz: 'Feliz', neutro: 'Neutro', cansado: 'Cansado', triste: 'Triste',
};
export const EMOJI_TIER: Record<Tier, string> = { feliz: '😄', neutro: '😐', cansado: '😩', triste: '😢' };

// Linhas do banco -> DTOs da API.
import type { ContaDTO, EntityDTO, PlayerDTO, TransacaoDTO } from '@galinheiro/api-contract';
import {
  ANIMAIS, ITENS, diasRestantes, inventarioVazio, tierDe, vidaEm,
  type Inventario, type Item, type Raridade, type Tier, type Tipo,
} from '@galinheiro/game-core';
import { PREFERENCIAS_PADRAO, PreferenciasSchema } from '@galinheiro/api-contract';
import { ehAdmin } from '../admin/acesso';

export const iso = (d: Date | number): string => new Date(d).toISOString();

export const COLS_ENTIDADE = `id, player_id, nome, tipo, raridade, origem, status, nascimento, expiracao,
  vida_ancora, vida_ancora_em, fator_decaimento_pct, slot_id, ciclo_n, ciclo_inicio, ciclo_tier,
  proximo_rendimento, ovos_pendentes, ovos_total, coletas_total, expirado_em, presente_ovos`;

export interface LinhaEntidade {
  id: string;
  player_id: string;
  nome: string;
  tipo: Tipo;
  raridade: Raridade;
  origem: 'ROLETA' | 'BOAS_VINDAS' | 'SUPORTE';
  status: 'ativo' | 'expirado';
  nascimento: Date;
  expiracao: Date;
  vida_ancora: number;
  vida_ancora_em: Date;
  fator_decaimento_pct: number;
  slot_id: number | null;
  ciclo_n: number;
  ciclo_inicio: Date;
  ciclo_tier: Tier;
  proximo_rendimento: Date;
  ovos_pendentes: number;
  ovos_total: number;
  coletas_total: number;
  expirado_em: Date | null;
  presente_ovos: number;
}

export const COLS_JOGADOR = `id, apelido, moedas_x100, nivel_galinheiro, capacidade, tutorial_etapa,
  aposentadorias_vistas_ate, preferencias, versao, criado_em, tickets, giros_gratis`;

export interface LinhaJogador {
  id: string;
  apelido: string | null;
  moedas_x100: number;
  nivel_galinheiro: number;
  capacidade: number;
  tutorial_etapa: number;
  aposentadorias_vistas_ate: Date;
  preferencias: unknown;
  versao: number;
  criado_em: Date;
  tickets: number;
  giros_gratis: number;
}

export interface LinhaTransacao {
  id: string;
  tipo: TransacaoDTO['tipo'];
  valor_x100: number;
  saldo_apos_x100: number;
  detalhes: Record<string, unknown>;
  criado_em: Date;
}

export function baseDeVida(l: LinhaEntidade) {
  return { vidaAncora: l.vida_ancora, vidaAncoraEmMs: l.vida_ancora_em.getTime(), fatorPct: l.fator_decaimento_pct };
}

export function entidadeTempo(l: LinhaEntidade) {
  return { ...baseDeVida(l), expiracaoMs: l.expiracao.getTime() };
}

export function paraEntityDTO(l: LinhaEntidade, agoraMs: number): EntityDTO {
  const ativo = l.status === 'ativo';
  const tVida = ativo ? agoraMs : (l.expirado_em?.getTime() ?? agoraMs);
  const vida = vidaEm(baseDeVida(l), tVida);
  const prox = l.proximo_rendimento.getTime();
  const exp = l.expiracao.getTime();
  return {
    id: l.id,
    nome: l.nome,
    tipo: l.tipo,
    raridade: l.raridade,
    status: l.status,
    origem: l.origem,
    nascimento: iso(l.nascimento),
    expiracao: iso(l.expiracao),
    expiradoEm: l.expirado_em ? iso(l.expirado_em) : null,
    vidaAtual: Math.round(vida * 100) / 100,
    vida: { ancora: l.vida_ancora, ancoraEm: iso(l.vida_ancora_em), fatorPct: l.fator_decaimento_pct },
    tier: ativo ? tierDe(vida) : null,
    cicloN: l.ciclo_n,
    cicloInicio: iso(l.ciclo_inicio),
    cicloTier: l.ciclo_tier,
    proximoRendimento: iso(prox),
    pronto: ativo && agoraMs >= prox,
    ultimoCiclo: ativo && prox === exp,
    slotId: l.slot_id,
    diasRestantes: ativo ? diasRestantes(exp, agoraMs) : 0,
    valorOvoX100: ANIMAIS[l.tipo].precoOvoX100,
    stats: { ovosTotal: l.ovos_total, coletasTotal: l.coletas_total },
    presenteOvos: l.presente_ovos ?? 0,
  };
}

export function paraPlayerDTO(l: LinhaJogador, ocupados: number): PlayerDTO {
  const prefs = PreferenciasSchema.safeParse({ ...PREFERENCIAS_PADRAO, ...(l.preferencias as object) });
  return {
    id: l.id,
    apelido: l.apelido,
    moedasX100: l.moedas_x100,
    nivelGalinheiro: l.nivel_galinheiro,
    capacidade: l.capacidade,
    ocupados,
    tutorialEtapa: l.tutorial_etapa,
    aposentadoriasVistasAte: iso(l.aposentadorias_vistas_ate),
    preferencias: prefs.success ? prefs.data : PREFERENCIAS_PADRAO,
    criadoEm: iso(l.criado_em),
    tickets: Number(l.tickets ?? 0),
    girosGratis: Number(l.giros_gratis ?? 0),
  };
}

export function paraTransacaoDTO(l: LinhaTransacao): TransacaoDTO {
  return {
    id: l.id,
    tipo: l.tipo,
    valorX100: l.valor_x100,
    saldoAposX100: l.saldo_apos_x100,
    detalhes: l.detalhes ?? {},
    criadoEm: iso(l.criado_em),
  };
}

export function paraInventario(linhas: { item: Item; quantidade: number }[]): Inventario {
  const inv = inventarioVazio();
  for (const l of linhas) if (ITENS.includes(l.item)) inv[l.item] = l.quantidade;
  return inv;
}

export interface LinhaContaDTO { email: string | null; nome: string | null; telefone: string | null; papel?: string | null }

export function paraContaDTO(l: LinhaContaDTO): ContaDTO {
  return { email: l.email ?? '', nome: l.nome ?? '', telefone: l.telefone ?? '', admin: ehAdmin({ papel: l.papel, email: l.email }) };
}

// Dados fictícios para a galeria visual (/dev/galeria/*). Só desenvolvimento.
import type { EntityDTO, StateDTO } from '@galinheiro/api-contract';
import { PREFERENCIAS_PADRAO } from '@galinheiro/api-contract';
import { ANIMAIS, tierDe, type Tier, type Tipo } from '@galinheiro/game-core';

/** Instante fixo para as capturas serem estáveis (os componentes recebem `agora` por prop). */
export const AGORA_FICTICIO = Date.parse('2026-10-05T12:00:00Z');
const H = 3_600_000;
const D = 24 * H;

const NOMES: Record<Tipo, string> = { galinha: 'Jujuba', pato: 'Patolino', ganso: 'Duquesa', avestruz: 'Estrela' };
const VIDA_POR_TIER: Record<Tier, number> = { feliz: 92, neutro: 63, cansado: 38, triste: 12 };

export interface OpcoesEntidade {
  tipo?: Tipo;
  /** Humor desejado (define a vida) — ignorado se `vida` vier. */
  tier?: Tier;
  vida?: number;
  /** Pronto para coletar agora? */
  pronto?: boolean;
  /** Horas até o próximo rendimento (quando não está pronto). */
  faltaH?: number;
  ultimoCiclo?: boolean;
  aposentado?: boolean;
  slot?: number;
  nome?: string;
  id?: string;
}

export function entidadeFicticia(o: OpcoesEntidade = {}): EntityDTO {
  const tipo = o.tipo ?? 'galinha';
  const cfg = ANIMAIS[tipo];
  const vida = o.vida ?? VIDA_POR_TIER[o.tier ?? 'feliz'];
  const idadeD = Math.round((100 - vida) * 0.9);
  const nascimento = AGORA_FICTICIO - idadeD * D;
  const expiracao = nascimento + 90 * D;
  const aposentado = !!o.aposentado;
  const proximo = o.pronto ? AGORA_FICTICIO - 5 * 60_000 : AGORA_FICTICIO + (o.faltaH ?? 7.5) * H;
  const tier = aposentado ? null : tierDe(vida);
  return {
    id: o.id ?? `ficticio-${tipo}-${o.slot ?? 0}-${Math.round(vida)}`,
    nome: o.nome ?? NOMES[tipo],
    tipo,
    raridade: cfg.raridade,
    status: aposentado ? 'expirado' : 'ativo',
    origem: 'ROLETA',
    nascimento: new Date(nascimento).toISOString(),
    expiracao: new Date(expiracao).toISOString(),
    expiradoEm: aposentado ? new Date(AGORA_FICTICIO - 2 * D).toISOString() : null,
    vidaAtual: aposentado ? 0 : vida,
    vida: { ancora: aposentado ? 0 : vida, ancoraEm: new Date(AGORA_FICTICIO).toISOString(), fatorPct: cfg.fatorPct },
    tier,
    cicloN: idadeD + 1,
    cicloInicio: new Date(proximo - 24 * H).toISOString(),
    cicloTier: tier ?? 'triste',
    proximoRendimento: new Date(proximo).toISOString(),
    pronto: !!o.pronto,
    ultimoCiclo: !!o.ultimoCiclo,
    slotId: aposentado ? null : (o.slot ?? 1),
    diasRestantes: aposentado ? 0 : Math.max(1, 90 - idadeD),
    valorOvoX100: cfg.precoOvoX100,
    stats: { ovosTotal: idadeD * 2 + 3, coletasTotal: idadeD + 1 },
    presenteOvos: aposentado ? 2 : 0,
  };
}

/** Estado completo fictício (HUD, abas, telas). */
export function estadoFicticio(parcial: { moedasX100?: number; nivel?: number; tutorialEtapa?: number; entidades?: EntityDTO[] } = {}): StateDTO & { _versao: number } {
  const nivel = parcial.nivel ?? 2;
  const capacidade = nivel * 4;
  const entidades = parcial.entidades ?? [
    entidadeFicticia({ tipo: 'galinha', slot: 1, pronto: true }),
    entidadeFicticia({ tipo: 'pato', slot: 2, tier: 'neutro', faltaH: 3.2 }),
    entidadeFicticia({ tipo: 'ganso', slot: 3, tier: 'cansado', faltaH: 12 }),
    entidadeFicticia({ tipo: 'avestruz', slot: 5, pronto: true }),
    entidadeFicticia({ tipo: 'galinha', slot: 6, tier: 'triste', faltaH: 20, nome: 'Cocó' }),
  ];
  return {
    _versao: 1,
    player: {
      id: 'ficticio',
      apelido: null,
      moedasX100: parcial.moedasX100 ?? 12_340,
      nivelGalinheiro: nivel,
      capacidade,
      ocupados: entidades.length,
      tutorialEtapa: parcial.tutorialEtapa ?? 8,
      aposentadoriasVistasAte: new Date(AGORA_FICTICIO).toISOString(),
      preferencias: PREFERENCIAS_PADRAO,
      criadoEm: new Date(AGORA_FICTICIO - 30 * D).toISOString(),
      tickets: 6,
      girosGratis: 0,
    },
    inventario: { ovo_galinha: 14, ovo_pato: 5, ovo_ganso: 2, ovo_avestruz: 1 },
    ninhos: Array.from({ length: capacidade }, (_, i) => ({ slot: i + 1, entityId: entidades.find((e) => e.slotId === i + 1)?.id ?? null })),
    entidades,
    aposentadoriasNaoVistas: [],
    resumo: { prontos: entidades.filter((e) => e.pronto).length, proximoProntoEm: null, valorInventarioX100: 14 * 120 + 5 * 180 + 2 * 250 + 400 },
    config: { versao: 'galeria' },
    conta: { email: 'ana@exemplo.com', nome: 'Ana Souza', telefone: '+5511987654321', admin: false },
  };
}

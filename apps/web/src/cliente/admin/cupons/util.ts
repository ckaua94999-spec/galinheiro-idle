// Regras de exibição dos cupons no painel: status calculado (ativo, agendado, pausado, esgotado, encerrado), o
// código digitado (maiúsculas, sem acento, só letras e números) e o gerador de códigos fáceis de ditar numa live.
// Datas: as mesmas funções dos popups (campo datetime-local ↔ ISO com o fuso do navegador).
import type { AdminCupomDTO } from '@galinheiro/api-contract';

/** Raiz das consultas de cupons (invalidar isto atualiza a lista e os detalhes). */
export const CHAVE_CUPONS = ['admin', 'cupons'] as const;

export type StatusCupom = 'ativo' | 'agendado' | 'pausado' | 'esgotado' | 'encerrado';

/** Encerrado (a validade acabou) e esgotado (todos os usos) vencem; depois pausado; depois agendado. */
export function statusDoCupom(c: Pick<AdminCupomDTO, 'ativo' | 'inicio' | 'fim' | 'usos' | 'usosMax'>, agora: number): StatusCupom {
  if (c.fim && Date.parse(c.fim) <= agora) return 'encerrado';
  if (c.usosMax !== null && c.usos >= c.usosMax) return 'esgotado';
  if (!c.ativo) return 'pausado';
  if (Date.parse(c.inicio) > agora) return 'agendado';
  return 'ativo';
}

export const INFO_STATUS: Record<StatusCupom, { rotulo: string; tom: 'verde' | 'azul' | 'ambar' | 'vermelho' | 'neutro'; ajuda: string }> = {
  ativo: { rotulo: 'Ativo', tom: 'verde', ajuda: 'Valendo: os membros já podem resgatar.' },
  agendado: { rotulo: 'Agendado', tom: 'azul', ajuda: 'Começa a valer na data de início.' },
  pausado: { rotulo: 'Pausado', tom: 'ambar', ajuda: 'Desligado: ninguém consegue resgatar.' },
  esgotado: { rotulo: 'Esgotado', tom: 'vermelho', ajuda: 'Todos os usos já foram resgatados. Aumente o limite para voltar a valer.' },
  encerrado: { rotulo: 'Encerrado', tom: 'neutro', ajuda: 'A validade terminou. Mude a data de fim para voltar a valer.' },
};

/** Texto digitado → código: maiúsculas, sem acento, só letras e números, até 20 (o membro pode digitar com espaço ou traço). */
export function limparCodigo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
}

const PALAVRAS = ['OVO', 'GEMA', 'NINHO', 'PINTINHO', 'GALINHA', 'PATO', 'GANSO', 'FAZENDA', 'COCORICO', 'MILHO', 'CHOCADEIRA'];
// sem 0/O e 1/I/L, que se confundem ao ditar ou ler
const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Código novo e fácil de ditar: uma palavra do jogo + 4 letras/números ("NINHO7K2Q"). */
export function gerarCodigo(): string {
  const sorte = new Uint32Array(5);
  crypto.getRandomValues(sorte);
  const palavra = PALAVRAS[(sorte[0] ?? 0) % PALAVRAS.length] ?? 'OVO';
  let fim = '';
  for (let i = 1; i < 5; i++) fim += LETRAS[(sorte[i] ?? 0) % LETRAS.length];
  return `${palavra}${fim}`;
}

/** Quantos usos ainda cabem (null = sem limite). */
export const restantes = (c: Pick<AdminCupomDTO, 'usos' | 'usosMax'>): number | null => (c.usosMax === null ? null : Math.max(0, c.usosMax - c.usos));

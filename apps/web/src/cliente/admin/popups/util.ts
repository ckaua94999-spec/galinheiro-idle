// Regras de exibição dos popups no painel: status calculado (ativo, agendado, encerrado, pausado), rótulos de
// frequência e de link, telas do jogo que o botão pode abrir e a conversão entre o campo datetime-local
// (horário do navegador) e o ISO com fuso que a API espera.
import type { AdminPopupDTO } from '@galinheiro/api-contract';

export type StatusPopup = 'ativo' | 'agendado' | 'encerrado' | 'pausado';
export type Frequencia = AdminPopupDTO['frequencia'];

/** Encerrado vence tudo (o período acabou); depois pausado; depois agendado (ainda não começou). */
export function statusDoPopup(p: Pick<AdminPopupDTO, 'ativo' | 'inicio' | 'fim'>, agora: number): StatusPopup {
  if (p.fim && Date.parse(p.fim) <= agora) return 'encerrado';
  if (!p.ativo) return 'pausado';
  if (Date.parse(p.inicio) > agora) return 'agendado';
  return 'ativo';
}

export const INFO_STATUS: Record<StatusPopup, { rotulo: string; tom: 'verde' | 'azul' | 'neutro' | 'ambar'; ajuda: string }> = {
  ativo: { rotulo: 'Ativo', tom: 'verde', ajuda: 'No ar: aparece para o público escolhido.' },
  agendado: { rotulo: 'Agendado', tom: 'azul', ajuda: 'Começa a aparecer na data de início.' },
  pausado: { rotulo: 'Pausado', tom: 'ambar', ajuda: 'Desligado: não aparece para ninguém.' },
  encerrado: { rotulo: 'Encerrado', tom: 'neutro', ajuda: 'O período terminou: não aparece mais.' },
};

export const FREQUENCIAS: readonly { valor: Frequencia; rotulo: string; explicacao: string }[] = [
  { valor: 'uma_vez', rotulo: 'Uma vez', explicacao: 'Cada membro vê este aviso uma única vez.' },
  { valor: 'diaria', rotulo: 'Uma vez por dia', explicacao: 'Volta a aparecer no dia seguinte (no máximo uma vez por dia) enquanto estiver no ar.' },
  { valor: 'sempre', rotulo: 'Sempre que abrir o jogo', explicacao: 'Aparece toda vez que o membro abrir o jogo. Bom para avisos urgentes — use com moderação.' },
];
export const rotuloFrequencia = (f: Frequencia): string => FREQUENCIAS.find((x) => x.valor === f)?.rotulo ?? f;

/** Telas do jogo que o botão do popup pode abrir. */
export const TELAS_JOGO: readonly { caminho: string; rotulo: string }[] = [
  { caminho: '/galinheiro', rotulo: 'Galinheiro' },
  { caminho: '/loja', rotulo: 'Loja' },
  { caminho: '/roleta', rotulo: 'Roleta' },
  { caminho: '/colecao', rotulo: 'Coleção' },
  { caminho: '/ajustes', rotulo: 'Ajustes' },
  { caminho: '/suporte', rotulo: 'Suporte (chat com a equipe)' },
];

/** Endereço https:// que o navegador consegue abrir (a prévia mostra o domínio; um endereço quebrado não pode chegar lá). */
export function ehHttps(v: string): boolean {
  if (!/^https:\/\/[^\s]+$/.test(v)) return false;
  try {
    return !!new URL(v).hostname;
  } catch {
    return false;
  }
}

export function descreverLink(link: string | null): { tipo: 'nenhum' | 'jogo' | 'externo'; rotulo: string } {
  if (!link) return { tipo: 'nenhum', rotulo: 'Sem link — o botão só fecha' };
  if (link.startsWith('/')) {
    const tela = TELAS_JOGO.find((t) => t.caminho === link);
    return { tipo: 'jogo', rotulo: tela ? `Abre ${tela.rotulo.replace(/ \(.*\)$/, '')} (${link})` : `Abre ${link}` };
  }
  try {
    return { tipo: 'externo', rotulo: `Abre ${new URL(link).hostname}` };
  } catch {
    return { tipo: 'externo', rotulo: link };
  }
}

// ---------------------------------------------------------------- datas

const pad = (n: number): string => String(n).padStart(2, '0');

/** Valor do <input type="datetime-local"> (horário do navegador, sem segundos). */
export function paraCampoData(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "2026-10-05T14:30" (horário local) → epoch ms; vazio ou inválido → null. */
export function campoParaMs(v: string): number | null {
  if (!v) return null;
  const ms = new Date(v).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** "2026-10-05T14:30" → "2026-10-05T14:30:00-03:00" (ISO com o fuso do navegador). */
export function campoParaIso(v: string): string | null {
  const ms = campoParaMs(v);
  if (ms === null) return null;
  const d = new Date(ms);
  const deslocamento = -d.getTimezoneOffset();
  const abs = Math.abs(deslocamento);
  return `${paraCampoData(ms)}:00${deslocamento >= 0 ? '+' : '-'}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** "UTC−03:00 · America/Sao_Paulo" (para a dica dos campos de data). */
export function rotuloFuso(): string {
  const deslocamento = -new Date().getTimezoneOffset();
  const abs = Math.abs(deslocamento);
  const utc = `UTC${deslocamento >= 0 ? '+' : '−'}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  let zona = '';
  try {
    zona = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    zona = '';
  }
  return zona === 'America/Sao_Paulo' ? `horário de Brasília (${utc})` : `horário deste aparelho (${utc}${zona ? ` · ${zona}` : ''})`;
}

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const DATA_HORA_ANO = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** "05/10, 14:30" (com o ano quando não é o ano corrente). */
export function dataCurta(iso: string, agora: number): string {
  const d = new Date(iso);
  return (d.getFullYear() === new Date(agora).getFullYear() ? DATA_HORA : DATA_HORA_ANO).format(d);
}

/** Distância até um instante futuro: "em 5 min", "em 3 h", "em 2 dias". */
export function emQuanto(ms: number): string {
  const s = Math.max(0, ms / 1000);
  if (s < 60) return 'em instantes';
  if (s < 3600) return `em ${Math.round(s / 60)} min`;
  if (s < 86_400) return `em ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86_400);
  return `em ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

/** Taxa de clique (% de quem viu e tocou no botão com link), com 1 casa. */
export function taxaClique(p: AdminPopupDTO): number | null {
  if (!p.link || p.estatisticas.pessoas === 0) return null;
  return (p.estatisticas.cliques / p.estatisticas.pessoas) * 100;
}

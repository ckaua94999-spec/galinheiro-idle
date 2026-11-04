import { CONFIG, type Tipo } from './config';
import type { Rng } from './ciclo';

const RE_NOME = /^(?! )(?!.* {2})[\p{L}\p{N} '.\-]{1,20}(?<! )$/u;
const SEGMENTADOR = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });

export type MotivoNomeInvalido = 'VAZIO' | 'LONGO_DEMAIS' | 'CARACTERE_INVALIDO' | 'ESPACOS' | 'SEM_LETRA';

export type ResultadoNome =
  | { ok: true; nome: string }
  | { ok: false; erro: 'NOME_INVALIDO'; motivo: MotivoNomeInvalido }
  | { ok: false; erro: 'NOME_IMPROPRIO' };

/** Valida e normaliza um nome (GDD 3.2.5). */
export function validarNome(bruto: string): ResultadoNome {
  const nome = bruto.normalize('NFC').trim();
  const grafemas = [...SEGMENTADOR.segment(nome)].length;
  if (grafemas < CONFIG.nome.min) return { ok: false, erro: 'NOME_INVALIDO', motivo: 'VAZIO' };
  if (grafemas > CONFIG.nome.max) return { ok: false, erro: 'NOME_INVALIDO', motivo: 'LONGO_DEMAIS' };
  if (/ {2}/.test(nome)) return { ok: false, erro: 'NOME_INVALIDO', motivo: 'ESPACOS' };
  if (!RE_NOME.test(nome)) return { ok: false, erro: 'NOME_INVALIDO', motivo: 'CARACTERE_INVALIDO' };
  if (!/\p{L}/u.test(nome)) return { ok: false, erro: 'NOME_INVALIDO', motivo: 'SEM_LETRA' };
  if (contemPalavraImpropria(nome)) return { ok: false, erro: 'NOME_IMPROPRIO' };
  return { ok: true, nome };
}

// ---------------------------------------------------------------- filtro de palavras impróprias
// Comparação feita depois de: minúsculas, sem acento, leetspeak desfeito e letras repetidas colapsadas.
const PALAVRAS_INTEIRAS = [
  'cu', 'fdp', 'vsf', 'tnc', 'pqp', 'krl', 'crl', 'puta', 'puto', 'porra', 'merda', 'bosta', 'foda',
  'foder', 'fodase', 'caralho', 'buceta', 'viado', 'piroca', 'xota', 'xoxota', 'arrombado', 'arrombada',
  'vagabunda', 'vagabundo', 'cacete', 'otario', 'otaria', 'babaca', 'corno', 'nazista', 'hitler',
];
const PREFIXOS = [
  'caralh', 'porr', 'merd', 'fodid', 'fodend', 'putinh', 'putari', 'arromb', 'bucet', 'xoxot', 'pirocud',
  'viadinh', 'cuzao', 'cuzinh',
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's' };

/** Minúsculas, sem acento e com leetspeak desfeito. */
const base = (texto: string): string =>
  texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[0134578@$]/g, (c) => LEET[c] ?? c);
const soLetras = (s: string): string => s.replace(/[^a-z]/g, '');
const colapsar = (s: string): string => s.replace(/(.)\1+/g, '$1'); // "poooorra" -> "pora"

const INTEIRAS = new Set(PALAVRAS_INTEIRAS.map((p) => colapsar(soLetras(base(p)))));
// Prefixos sem letra dobrada também podem ser comparados com a palavra colapsada ("meeerda" -> "merda").
const PREFIXOS_SEM_DOBRO = PREFIXOS.filter((p) => colapsar(p) === p);

function ehImpropria(palavraBase: string): boolean {
  const limpa = soLetras(palavraBase);
  if (!limpa) return false;
  const col = colapsar(limpa);
  return INTEIRAS.has(col) || PREFIXOS.some((p) => limpa.startsWith(p)) || PREFIXOS_SEM_DOBRO.some((p) => col.startsWith(p));
}

export function contemPalavraImpropria(nome: string): boolean {
  const b = base(nome);
  if (b.split(/\s+/).some(ehImpropria)) return true;
  return ehImpropria(b); // nome inteiro junto: "p o r r a", "p.o.r.r.a"
}

// ---------------------------------------------------------------- nomes padrão (GDD Apêndice C)
export const NOMES_PADRAO: Record<Tipo, readonly string[]> = {
  galinha: ['Pipoca', 'Cocó', 'Penélope', 'Chiquinha', 'Paçoca', 'Quindim', 'Cocada', 'Jujuba', 'Pamonha',
    'Canjica', 'Farofa', 'Tapioca', 'Rapadura', 'Cuscuz', 'Bolinha', 'Pintada'],
  pato: ['Dado', 'Quaquá', 'Bolota', 'Pingo', 'Marola', 'Biscoito', 'Remo', 'Nado', 'Bote', 'Lagoa', 'Galocha', 'Bolacha'],
  ganso: ['Gaspar', 'Gina', 'Godofredo', 'Gertrudes', 'Honório', 'Buzina', 'Almirante', 'Cachecol', 'Guarda', 'Barão'],
  avestruz: ['Olívia', 'Estrela', 'Duquesa', 'Avelina', 'Zuzu', 'Dona Plumas', 'Madame Pluma', 'Imperatriz', 'Jade', 'Safira'],
};

/** Sorteia um nome ainda não usado pelos animais ativos; se todos estiverem em uso, permite repetir. */
export function nomePadrao(tipo: Tipo, emUso: ReadonlySet<string>, rng: Rng): string {
  const lista = NOMES_PADRAO[tipo];
  const livres = lista.filter((n) => !emUso.has(n));
  const opcoes = livres.length > 0 ? livres : lista;
  return opcoes[rng.int(opcoes.length)] ?? lista[0]!;
}

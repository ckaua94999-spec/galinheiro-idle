// Utilitários do atendimento: avatar (iniciais e cor), relógio "lento" para os tempos relativos, separadores
// por dia das mensagens, links de contato (telefone e WhatsApp) e as respostas rápidas da equipe.
import { useRelogio } from '../../relogio';

const CORES_AVATAR = ['#16a34a', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#dc2626', '#0d9488', '#9333ea'];

/** "Tiago Pereira" → "TP"; "ana" → "A". */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}

/** Cor estável por pessoa (a mesma em todo lugar do painel). */
export function corAvatar(semente: string): string {
  let h = 0;
  for (let i = 0; i < semente.length; i++) h = (h * 31 + semente.charCodeAt(i)) >>> 0;
  return CORES_AVATAR[h % CORES_AVATAR.length] ?? '#64708a';
}

export const primeiroNome = (nome: string): string => nome.trim().split(/\s+/)[0] ?? '';

/**
 * "Agora" do servidor (relógio sincronizado do jogo), mas só re-renderiza a cada `passoMs`: bom para listas com
 * "há 5 min" sem redesenhar tudo a cada segundo.
 */
export function useAgoraLento(passoMs = 30_000): number {
  const passo = useRelogio((s) => Math.floor(s.agora / passoMs));
  return passo * passoMs;
}

// ---------------------------------------------------------------- datas das mensagens

const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const DIA_SEMANA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });
const DIA_MES = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });
const DIA_MES_ANO = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
const COMPLETA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' });

export const hora = (iso: string): string => HORA.format(new Date(iso));
export const dataCompleta = (iso: string): string => COMPLETA.format(new Date(iso));

/** "2026-10-05" no fuso do navegador. */
export function chaveDia(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const capitalizar = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

/** Separador do chat: "Hoje", "Ontem", "Sexta-feira" (até 6 dias), "3 de outubro" ou "3 de outubro de 2025". */
export function rotuloDia(iso: string, agora: number): string {
  const ms = Date.parse(iso);
  const dia = chaveDia(ms);
  if (dia === chaveDia(agora)) return 'Hoje';
  if (dia === chaveDia(agora - 86_400_000)) return 'Ontem';
  if (agora - ms < 6 * 86_400_000) return capitalizar(DIA_SEMANA.format(ms));
  const d = new Date(ms);
  return (d.getFullYear() === new Date(agora).getFullYear() ? DIA_MES : DIA_MES_ANO).format(d);
}

// ---------------------------------------------------------------- contato

/** tel:+5511987654321 */
export const linkTelefone = (e164: string): string => `tel:${e164.replace(/[^\d+]/g, '')}`;
/** https://wa.me/5511987654321 (só dígitos, com o 55). */
export const linkWhatsApp = (e164: string): string => `https://wa.me/${e164.replace(/\D/g, '')}`;

// ---------------------------------------------------------------- respostas rápidas

/** {nome} vira o primeiro nome do membro. */
export const RESPOSTAS_RAPIDAS: readonly { titulo: string; texto: string }[] = [
  { titulo: 'Saudação', texto: 'Oi, {nome}! Tudo bem? Já estou vendo o seu caso, só um instante.' },
  {
    titulo: 'Estamos verificando',
    texto: 'Estamos verificando o que aconteceu com a sua conta. Assim que tivermos uma resposta, avisamos por aqui.',
  },
  {
    titulo: 'Pedir detalhes',
    texto: 'Pode me contar com mais detalhes o que aconteceu? Se lembrar, diga também o horário aproximado.',
  },
  {
    titulo: 'Resolvido',
    texto: 'Prontinho, {nome}! Já está resolvido. Confira no jogo e, se precisar de mais alguma coisa, é só chamar por aqui.',
  },
  {
    titulo: 'Encerrar',
    texto: 'Obrigado pela paciência! Vou encerrar este atendimento, mas pode escrever de novo sempre que precisar.',
  },
];

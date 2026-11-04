'use client';

// Avisos da equipe no lado do jogador: GET /avisos (popups a mostrar + mensagens do suporte não lidas) e a
// conversa do atendimento (GET /suporte). Quem BUSCA os avisos é só a casca do jogo (CamadaAvisos, com sessão);
// HUD e Ajustes apenas leem o contador do cache, assim a galeria de dev (sem sessão) nunca dispara a consulta.
// Também guarda, na sessionStorage, o que já foi mostrado nesta sessão do app (popups e o toast do suporte).
import type { AvisosDTO } from '@galinheiro/api-contract';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { chamar } from '../api';
import { agoraServidor } from '../relogio';

export const CHAVE_AVISOS = ['avisos'] as const;
export const CHAVE_SUPORTE = ['suporte'] as const;

/** O jogo consulta os avisos a cada 45 s (contrato da API), ao voltar para a aba e ao focar a janela. */
const INTERVALO_AVISOS_MS = 45_000;
/** Foco da janela logo depois de uma consulta não consulta de novo. */
const FRESCOR_MS = 10_000;

const buscarAvisos = async (): Promise<AvisosDTO> => (await chamar<AvisosDTO>('GET', '/avisos')).data;

/** Consulta ativa dos avisos. Use só dentro da casca do jogo (precisa de sessão). */
export function useAvisos() {
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: CHAVE_AVISOS,
    queryFn: buscarAvisos,
    refetchInterval: INTERVALO_AVISOS_MS,
    // o React Query reconsulta no "visibilitychange" (voltar para a aba)
    refetchOnWindowFocus: true,
    staleTime: FRESCOR_MS,
    // o cliente HTTP já repete GET com espera; a próxima rodada vem em 45 s
    retry: false,
  });

  // ...e focar a janela (outra janela na frente, aba continua visível) também consulta.
  useEffect(() => {
    const focar = () => {
      const estado = qc.getQueryState(CHAVE_AVISOS);
      if (estado?.fetchStatus === 'fetching') return;
      if (estado && Date.now() - estado.dataUpdatedAt < FRESCOR_MS) return;
      void qc.refetchQueries({ queryKey: CHAVE_AVISOS, type: 'active' }, { cancelRefetch: false });
    };
    window.addEventListener('focus', focar);
    return () => window.removeEventListener('focus', focar);
  }, [qc]);

  return consulta;
}

/** Mensagens do suporte ainda não lidas, lidas do cache (não consulta: quem busca é a CamadaAvisos). */
export function useNaoLidasSuporte(): number {
  const { data } = useQuery({ queryKey: CHAVE_AVISOS, queryFn: buscarAvisos, enabled: false, select: (a) => a.suporteNaoLidas });
  return data ?? 0;
}

/** Abrir a conversa zera as não lidas no servidor: espelha no cache dos avisos (badge e contador somem na hora). */
export function zerarNaoLidasNoCache(qc: QueryClient): void {
  qc.setQueryData<AvisosDTO>(CHAVE_AVISOS, (a) => (a && a.suporteNaoLidas > 0 ? { ...a, suporteNaoLidas: 0 } : a));
}

// ---------------------------------------------------------------- memória da sessão do app (sessionStorage)

const CHAVE_MOSTRADOS = 'gi:avisos:mostrados:v1';
const CHAVE_AVISADO = 'gi:suporte:avisado:v1';

/** Dia no fuso do servidor (UTC−3), o mesmo da regra dos popups "diários". */
const diaBr = (ms: number): string => new Date(ms - 3 * 3_600_000).toISOString().slice(0, 10);

// Reserva em memória: sem sessionStorage (modo privado, bloqueado) o popup ainda não se repete nesta página.
const mostradosMemoria = new Map<string, string>();

function lerMostrados(): Record<string, string> {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_MOSTRADOS);
    const obj: unknown = bruto ? JSON.parse(bruto) : null;
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? (obj as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * O popup já apareceu hoje nesta sessão do app? Os de frequência "sempre" voltam do servidor a cada consulta;
 * sem esta memória reapareceriam a cada 45 s. A marca vale pelo dia: um popup "diário" volta no dia seguinte
 * mesmo com o app aberto desde ontem.
 */
export function popupJaMostrado(id: string): boolean {
  const hoje = diaBr(agoraServidor());
  return (mostradosMemoria.get(id) ?? lerMostrados()[id]) === hoje;
}

export function marcarPopupMostrado(id: string): void {
  const hoje = diaBr(agoraServidor());
  mostradosMemoria.set(id, hoje);
  try {
    // guarda só as marcas de hoje (a lista não cresce para sempre)
    const atuais = Object.fromEntries(Object.entries(lerMostrados()).filter(([, dia]) => dia === hoje));
    window.sessionStorage.setItem(CHAVE_MOSTRADOS, JSON.stringify({ ...atuais, [id]: hoje }));
  } catch {
    // sem sessionStorage: fica a memória da página
  }
}

let avisadoMemoria: number | null = null;

/** Quantas não lidas do suporte o jogador já foi avisado (toast) nesta sessão do app. */
export function lerSuporteAvisado(): number {
  if (avisadoMemoria !== null) return avisadoMemoria;
  try {
    const n = Number(window.sessionStorage.getItem(CHAVE_AVISADO));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function salvarSuporteAvisado(n: number): void {
  avisadoMemoria = n;
  try {
    window.sessionStorage.setItem(CHAVE_AVISADO, String(n));
  } catch {
    // sem sessionStorage: fica a memória da página
  }
}

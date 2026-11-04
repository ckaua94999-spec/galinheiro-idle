'use client';

// Camada de avisos da casca do jogo (montada no ShellJogo, só com sessão):
//  - popups da equipe: fila do que o servidor mandou, UM por vez, ~1,5 s depois de abrir o jogo, sem atrapalhar o
//    tutorial nem outro modal, giro ou digitação. Exibir registra "visto"; o botão registra "clique" e navega
//    (rota do jogo no app; https em outra aba); fechar só fecha.
//  - toast "Nova mensagem do suporte" quando o contador de não lidas sobe fora da tela de atendimento.
import type { PopupDTO } from '@galinheiro/api-contract';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { chamar } from '../api';
import { PopupAviso, linkExterno } from '../componentes/PopupAviso';
import type { Estado } from '../estado';
import { toast, useUi } from '../ui';
import { ETAPA } from '../useAcoes';
import { lerSuporteAvisado, marcarPopupMostrado, popupJaMostrado, salvarSuporteAvisado, useAvisos } from './consultas';

/** Respiro depois de abrir o jogo antes do 1º popup. */
const ATRASO_INICIAL_MS = 1500;
/** Enquanto a tela estiver ocupada, reavalia neste ritmo. */
const VERIFICAR_MS = 800;
/** Do fechar de um popup até o próximo da fila (a saída do modal leva ~200 ms). */
const PAUSA_ENTRE_MS = 700;

/** Algo na frente do jogador agora? (outro modal/folha/revelação, tutorial, giro em andamento, ovos voando, digitação) */
function telaOcupada(): boolean {
  if (document.visibilityState !== 'visible') return true;
  const ui = useUi.getState();
  if (ui.cartaId || ui.infoId || ui.vendaAberta || ui.chancesAbertas || ui.resultadoGiroAberto) return true;
  if (ui.ovosVoando.length > 0 || ui.moedasVoando.length > 0) return true;
  // todos os diálogos do jogo (Modal, Folha, revelação da roleta, aposentadorias) são role="dialog" aria-modal;
  // aria-busy marca ação em andamento (ex.: a roda girando, mensagem sendo enviada)
  if (document.querySelector('[role="dialog"][aria-modal="true"], .tut-veu, [aria-busy="true"]')) return true;
  const ativo = document.activeElement;
  if (ativo instanceof HTMLTextAreaElement || (ativo instanceof HTMLElement && ativo.isContentEditable)) return true;
  return ativo instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button', 'submit'].includes(ativo.type);
}

const rotaDoJogo = (link: string): boolean => /^\/(?!\/)/.test(link);

export function CamadaAvisos({ estado }: { estado: Estado }) {
  const router = useRouter();
  const caminho = usePathname() ?? '';
  const { data } = useAvisos();
  const [liberado, setLiberado] = useState(false);
  const [atual, setAtual] = useState<PopupDTO | null>(null);
  const [aberto, setAberto] = useState(false);
  const tutorialConcluido = estado.player.tutorialEtapa >= ETAPA.CONCLUIDO;

  // a fila vem sempre da consulta mais recente (um popup editado/pausado no painel some da fila)
  const popups = useRef<PopupDTO[]>([]);
  const proximoId = (data?.popups ?? []).find((p) => !popupJaMostrado(p.id))?.id ?? null;
  useEffect(() => {
    popups.current = data?.popups ?? [];
  }, [data]);

  useEffect(() => {
    const t = window.setTimeout(() => setLiberado(true), ATRASO_INICIAL_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!liberado || !tutorialConcluido || atual || !proximoId) return;
    const tentar = (): boolean => {
      if (telaOcupada()) return false;
      const p = popups.current.find((x) => x.id === proximoId);
      if (!p || popupJaMostrado(p.id)) return true; // saiu da fila nesse meio-tempo
      marcarPopupMostrado(p.id);
      setAtual(p);
      setAberto(true);
      // exibição registrada: "uma vez" e "diária" deixam de vir do servidor
      chamar('POST', `/avisos/${encodeURIComponent(p.id)}/visto`).catch(() => {});
      return true;
    };
    if (tentar()) return;
    const id = window.setInterval(() => {
      if (tentar()) window.clearInterval(id);
    }, VERIFICAR_MS);
    return () => window.clearInterval(id);
  }, [liberado, tutorialConcluido, atual, proximoId]);

  // Fecha e mantém o conteúdo durante a saída do modal; o próximo da fila só depois da pausa.
  const fechar = useCallback(() => {
    setAberto(false);
    window.setTimeout(() => setAtual(null), PAUSA_ENTRE_MS);
  }, []);

  const clicar = useCallback(() => {
    const p = atual;
    if (p?.link) {
      // registra o clique (sem esperar) e navega; window.open precisa ficar no mesmo gesto do toque
      chamar('POST', `/avisos/${encodeURIComponent(p.id)}/clique`).catch(() => {});
      if (linkExterno(p.link)) window.open(p.link, '_blank', 'noopener,noreferrer');
      else if (rotaDoJogo(p.link)) router.push(p.link);
    }
    fechar();
  }, [atual, router, fechar]);

  // "Nova mensagem do suporte": um toast por aumento do contador, fora da tela de atendimento.
  const naoLidas = data?.suporteNaoLidas;
  const naSuporte = caminho.startsWith('/suporte');
  const anterior = useRef<number | null>(null);
  useEffect(() => {
    if (naoLidas === undefined) return;
    const antes = anterior.current ?? lerSuporteAvisado();
    anterior.current = naoLidas;
    salvarSuporteAvisado(naoLidas);
    if (naoLidas > antes && !naSuporte) {
      toast('Nova mensagem do suporte', 'info', { acao: { rotulo: 'Ver', fn: () => router.push('/suporte') }, duracaoMs: 6000 });
    }
  }, [naoLidas, naSuporte, router]);

  return <PopupAviso popup={atual} aberto={aberto} aoFechar={fechar} aoClicar={clicar} />;
}

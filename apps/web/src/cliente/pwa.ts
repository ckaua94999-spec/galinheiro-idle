// Recursos de PWA: service worker (cache + atualização), instalação e notificações push.
'use client';

import { create } from 'zustand';
import { chamar } from './api';

interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface EstadoPwa {
  eventoInstalar: EventoInstalacao | null;
  instalado: boolean;
  atualizacao: ServiceWorker | null;
  swAtivo: boolean;
}

export const usePwa = create<EstadoPwa>(() => ({ eventoInstalar: null, instalado: false, atualizacao: null, swAtivo: false }));

export const swHabilitado = (): boolean =>
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SW_DEV === '1');

/** Identifica o build (definida no next.config); versiona o service worker e os caches dele. */
export const VERSAO_APP = process.env.NEXT_PUBLIC_VERSAO_APP ?? 'dev';

export async function registrarServiceWorker(): Promise<void> {
  if (!swHabilitado()) return;
  try {
    const controladaAoAbrir = !!navigator.serviceWorker.controller;
    const reg = await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(VERSAO_APP)}`, {
      scope: '/',
      updateViaCache: 'none',
    });
    usePwa.setState({ swAtivo: true });
    const avisar = (sw: ServiceWorker | null) => {
      if (sw && navigator.serviceWorker.controller) usePwa.setState({ atualizacao: sw });
    };
    avisar(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const novo = reg.installing;
      novo?.addEventListener('statechange', () => {
        if (novo.state === 'installed') avisar(novo);
      });
    });
    let recarregando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Na primeira instalação o SW assume a página (clients.claim) sem nada a atualizar: não recarrega.
      if (!controladaAoAbrir || recarregando) return;
      recarregando = true;
      window.location.reload();
    });
    setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000);
  } catch (erro) {
    console.warn('[pwa] falha ao registrar o service worker', erro);
  }
}

export function aplicarAtualizacao(): void {
  usePwa.getState().atualizacao?.postMessage({ tipo: 'PULAR_ESPERA' });
}

export function capturarInstalacao(): () => void {
  const aoPedir = (e: Event) => {
    e.preventDefault();
    usePwa.setState({ eventoInstalar: e as EventoInstalacao });
  };
  const aoInstalar = () => usePwa.setState({ eventoInstalar: null, instalado: true });
  window.addEventListener('beforeinstallprompt', aoPedir);
  window.addEventListener('appinstalled', aoInstalar);
  usePwa.setState({ instalado: rodandoInstalado() });
  return () => {
    window.removeEventListener('beforeinstallprompt', aoPedir);
    window.removeEventListener('appinstalled', aoInstalar);
  };
}

export const ehIOS = (): boolean =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const rodandoInstalado = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

export async function instalarApp(): Promise<boolean> {
  const ev = usePwa.getState().eventoInstalar;
  if (!ev) return false;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  usePwa.setState({ eventoInstalar: null, instalado: outcome === 'accepted' });
  return outcome === 'accepted';
}

// ---------------------------------------------------------------- push
export const pushSuportado = (): boolean =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function chaveParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const bruto = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

async function registroAtivo(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSuportado() || !usePwa.getState().swAtivo) return null;
  return (await navigator.serviceWorker.getRegistration('/')) ?? null;
}

export async function notificacoesAtivas(): Promise<boolean> {
  const reg = await registroAtivo();
  if (!reg || Notification.permission !== 'granted') return false;
  return (await reg.pushManager.getSubscription()) !== null;
}

export type ResultadoPush = 'ok' | 'negado' | 'indisponivel';

export async function ativarNotificacoes(vapidPublica: string | null): Promise<ResultadoPush> {
  const reg = await registroAtivo();
  if (!reg || !vapidPublica) return 'indisponivel';
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') return 'negado';
  const assinatura =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(vapidPublica) }));
  const json = assinatura.toJSON();
  await chamar('POST', '/push/assinaturas', {
    corpo: { endpoint: json.endpoint, keys: json.keys, fusoMin: -new Date().getTimezoneOffset() },
  });
  return 'ok';
}

export async function desativarNotificacoes(): Promise<void> {
  const reg = await registroAtivo();
  const assinatura = await reg?.pushManager.getSubscription();
  if (!assinatura) return;
  await chamar('DELETE', '/push/assinaturas', { corpo: { endpoint: assinatura.endpoint } }).catch(() => {});
  await assinatura.unsubscribe();
}

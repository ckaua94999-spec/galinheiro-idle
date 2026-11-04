'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { EVENTO_SESSAO_PERDIDA } from './api';
import { DefsArte } from './arte/Defs';
import { marcarOffline, marcarOnline } from './conexao';
import { limparCacheEstado } from './estado';
import { capturarInstalacao, registrarServiceWorker } from './pwa';
import { iniciarTique } from './relogio';
import { aoMudarVisibilidade, configurarSom, desbloquearAudio } from './som';
import { useUi } from './ui';

function assinarMovimentoReduzido(cb: () => void): () => void {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
const sistemaPedeMenosMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** true quando o jogador (ou o sistema) pediu menos animação. */
export function useReduzirMovimento(): boolean {
  const pref = useUi((s) => s.preferencias.reduzirAnimacoes);
  const sistema = useSyncExternalStore(assinarMovimentoReduzido, sistemaPedeMenosMovimento, () => false);
  return pref === 'ligado' || (pref === 'sistema' && sistema);
}

export function Provedores({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnReconnect: true, networkMode: 'always' },
          mutations: { retry: 0, networkMode: 'always' },
        },
      }),
  );
  const preferencias = useUi((s) => s.preferencias);
  const reduzir = useReduzirMovimento();

  useEffect(() => iniciarTique(), []);

  useEffect(() => {
    const destravar = () => desbloquearAudio();
    window.addEventListener('pointerdown', destravar, { once: true });
    window.addEventListener('keydown', destravar, { once: true });
    const visibilidade = () => aoMudarVisibilidade(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', visibilidade);
    return () => {
      window.removeEventListener('pointerdown', destravar);
      window.removeEventListener('keydown', destravar);
      document.removeEventListener('visibilitychange', visibilidade);
    };
  }, []);

  useEffect(() => {
    void registrarServiceWorker();
    return capturarInstalacao();
  }, []);

  useEffect(() => {
    const perdida = () => {
      limparCacheEstado();
      qc.clear();
      router.replace('/entrar');
    };
    window.addEventListener(EVENTO_SESSAO_PERDIDA, perdida);
    window.addEventListener('online', marcarOnline);
    window.addEventListener('offline', marcarOffline);
    return () => {
      window.removeEventListener(EVENTO_SESSAO_PERDIDA, perdida);
      window.removeEventListener('online', marcarOnline);
      window.removeEventListener('offline', marcarOffline);
    };
  }, [qc, router]);

  useEffect(() => {
    configurarSom({ efeitosVolume: preferencias.efeitosVolume, somAmbiente: preferencias.somAmbiente });
  }, [preferencias.efeitosVolume, preferencias.somAmbiente]);

  useEffect(() => {
    document.documentElement.classList.toggle('reduzir-movimento', reduzir);
  }, [reduzir]);

  return (
    <QueryClientProvider client={qc}>
      <MotionConfig reducedMotion={reduzir ? 'always' : 'never'}>
        <DefsArte />
        {children}
      </MotionConfig>
    </QueryClientProvider>
  );
}

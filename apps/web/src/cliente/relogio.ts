// Relógio sincronizado com o servidor (GDD 7.7): agora = Date.now() + offset.
// Um único tique por segundo alimenta todos os timers e barras de vida.
import { create } from 'zustand';

interface EstadoRelogio {
  offsetMs: number;
  agora: number;
  amostras: number[];
}

export const useRelogio = create<EstadoRelogio>(() => ({ offsetMs: 0, agora: Date.now(), amostras: [] }));

export function sincronizarRelogio(serverTimeIso: string, rttMs: number): void {
  const servidor = Date.parse(serverTimeIso);
  if (Number.isNaN(servidor)) return;
  const amostra = servidor + rttMs / 2 - Date.now();
  const { amostras, offsetMs } = useRelogio.getState();
  // Saltos grandes (relógio do aparelho mudou, relógio de testes adiantado): recomeça as amostras.
  const novas = Math.abs(amostra - offsetMs) > 60_000 ? [amostra] : [...amostras, amostra].slice(-5);
  const ordenadas = [...novas].sort((a, b) => a - b);
  const mediana = ordenadas[Math.floor(ordenadas.length / 2)] ?? 0;
  useRelogio.setState({ offsetMs: mediana, amostras: novas, agora: Date.now() + mediana });
}

export const agoraServidor = (): number => Date.now() + useRelogio.getState().offsetMs;

export function iniciarTique(): () => void {
  const id = setInterval(() => {
    useRelogio.setState({ agora: Date.now() + useRelogio.getState().offsetMs });
  }, 1000);
  return () => clearInterval(id);
}

export const useAgora = (): number => useRelogio((s) => s.agora);

import { MS_HORA, MS_MINUTO, MS_SEGUNDO } from './config';

const dois = (n: number): string => String(n).padStart(2, '0');

/** HH:MM:SS (HH pode passar de 24). Valores ≤ 0 viram 00:00:00. */
export function formatarTimer(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / MS_SEGUNDO));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${dois(h)}:${dois(m)}:${dois(s % 60)}`;
}

/** Mini-timer do ninho: HH:MM, ou MM:SS na última hora. */
export function formatarTimerCurto(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / MS_SEGUNDO));
  if (ms >= MS_HORA) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${dois(h)}:${dois(m)}`;
  }
  return `${dois(Math.floor(s / 60))}:${dois(s % 60)}`;
}

/** "5 min", "2 h 10 min" etc., para textos corridos. */
export function formatarDuracao(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / MS_MINUTO));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

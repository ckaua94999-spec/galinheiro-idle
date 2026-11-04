// Efeitos sonoros sintetizados com Web Audio (sem arquivos de áudio). Catálogo: GDD 3.8.2.
// O áudio só começa depois do primeiro toque do usuário (política de autoplay dos navegadores).
import type { Raridade, Tipo } from '@galinheiro/game-core';

let ctx: AudioContext | null = null;
let mestre: GainNode | null = null;
let busAmbiente: GainNode | null = null;
let volumeEfeitos = 0.8;
// ambiente = só um vento suave (sem piados de bicho), e desligado por padrão (preferência "Som ambiente")
let ambienteLigado = false;
let ventoFonte: AudioBufferSourceNode | null = null;
let ultimoPronto = 0;
let ultimoTique = 0;

export function configurarSom(op: { efeitosVolume: number; somAmbiente: boolean }): void {
  volumeEfeitos = Math.max(0, Math.min(1, op.efeitosVolume / 100));
  if (busAmbiente) busAmbiente.gain.value = 0.25 * volumeEfeitos;
  const mudouAmbiente = ambienteLigado !== op.somAmbiente;
  ambienteLigado = op.somAmbiente;
  if (mudouAmbiente) (ambienteLigado ? iniciarAmbiente() : pararAmbiente());
}

export function desbloquearAudio(): void {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    mestre = ctx.createGain();
    mestre.gain.value = 1;
    mestre.connect(ctx.destination);
    busAmbiente = ctx.createGain();
    busAmbiente.gain.value = 0.25;
    busAmbiente.connect(mestre);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  iniciarAmbiente();
}

/** Pausa tudo quando a aba vai para segundo plano. */
export function aoMudarVisibilidade(visivel: boolean): void {
  if (!ctx) return;
  if (visivel) {
    void ctx.resume();
    iniciarAmbiente();
  } else {
    pararAmbiente();
    void ctx.suspend();
  }
}

interface Tom {
  freq: number;
  freqFinal?: number;
  tipo?: OscillatorType;
  dur?: number;
  vol?: number;
  ataque?: number;
  atraso?: number;
  destino?: AudioNode | null;
}

function tom({ freq, freqFinal, tipo = 'sine', dur = 0.15, vol = 0.3, ataque = 0.006, atraso = 0, destino }: Tom): void {
  if (!ctx || !mestre || volumeEfeitos <= 0) return;
  const t = ctx.currentTime + atraso;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, t);
  if (freqFinal) o.frequency.exponentialRampToValueAtTime(freqFinal, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * volumeEfeitos), t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(destino ?? mestre);
  o.start(t);
  o.stop(t + dur + 0.03);
}

let bufferRuido: AudioBuffer | null = null;
function ruido(dur: number, vol: number, freqFiltro: number, atraso = 0, q = 1, destino?: AudioNode | null): AudioBufferSourceNode | null {
  if (!ctx || !mestre) return null;
  if (!bufferRuido) {
    bufferRuido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const dados = bufferRuido.getChannelData(0);
    for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + atraso;
  const fonte = ctx.createBufferSource();
  fonte.buffer = bufferRuido;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = freqFiltro;
  filtro.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * (destino ? 1 : volumeEfeitos)), t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  fonte.connect(filtro).connect(g).connect(destino ?? mestre);
  fonte.start(t);
  fonte.stop(t + dur + 0.05);
  return fonte;
}

const semitom = (base: number, s: number): number => base * 2 ** (s / 12);

export const som = {
  toque: () => tom({ freq: 660, dur: 0.06, vol: 0.12, tipo: 'triangle' }),
  abrir: () => tom({ freq: 880, freqFinal: 1100, dur: 0.1, vol: 0.08, tipo: 'sine' }),
  pop: (indice = 0) => tom({ freq: semitom(520, indice), freqFinal: semitom(900, indice), dur: 0.13, vol: 0.32 }),
  jackpot: () => [0, 4, 7, 12].forEach((s, i) => tom({ freq: semitom(784, s), dur: 0.22, vol: 0.22, tipo: 'triangle', atraso: 0.25 + i * 0.08 })),
  pronto: () => {
    const agora = Date.now();
    if (agora - ultimoPronto < 3000) return; // agrupa vários "prontos" (GDD 3.8.3)
    ultimoPronto = agora;
    tom({ freq: 1318.5, dur: 0.45, vol: 0.14 });
    tom({ freq: 1975.5, dur: 0.55, vol: 0.08, atraso: 0.07 });
  },
  moedas: () => [0, 0.05, 0.11, 0.18, 0.26].forEach((a, i) => tom({ freq: 1760 + i * 140, dur: 0.07, vol: 0.09, tipo: 'square', atraso: a })),
  obra: () => {
    [0, 0.32, 0.64].forEach((a) => {
      ruido(0.08, 0.5, 900, a, 2);
      tom({ freq: 180, freqFinal: 90, dur: 0.12, vol: 0.25, atraso: a });
    });
    ruido(0.5, 0.18, 2500, 1.0, 0.7);
  },
  tique: () => {
    const agora = performance.now();
    if (agora - ultimoTique < 40) return; // no máximo 25 por segundo
    ultimoTique = agora;
    tom({ freq: 1500, dur: 0.02, vol: 0.08, tipo: 'square' });
  },
  girar: () => tom({ freq: 220, freqFinal: 520, dur: 0.35, vol: 0.12, tipo: 'sawtooth' }),
  parar: () => tom({ freq: 520, freqFinal: 360, dur: 0.25, vol: 0.16 }),
  vitoria: (raridade: Raridade) => {
    const notas: Record<Raridade, number[]> = {
      comum: [0, 4, 7],
      raro: [0, 4, 7, 12],
      epico: [0, 4, 7, 12, 16],
      lendario: [0, 4, 7, 12, 16, 19, 24],
    };
    notas[raridade].forEach((s, i) => tom({ freq: semitom(523.25, s), dur: 0.28, vol: 0.18, tipo: 'triangle', atraso: i * 0.11 }));
    if (raridade === 'lendario') [0, 4, 7].forEach((s) => tom({ freq: semitom(1046.5, s), dur: 1.2, vol: 0.07, atraso: 0.8 }));
  },
  erro: () => tom({ freq: 240, freqFinal: 150, dur: 0.24, vol: 0.2, tipo: 'triangle' }),
  aposentadoria: () => [7, 4, 0, 4, 7, 12].forEach((s, i) => tom({ freq: semitom(392, s), dur: 0.35, vol: 0.1, tipo: 'sine', atraso: i * 0.18 })),
  voz: (tipo: Tipo) => {
    switch (tipo) {
      case 'galinha': // "cocó"
        tom({ freq: 900, freqFinal: 650, dur: 0.09, vol: 0.13, tipo: 'square' });
        tom({ freq: 1100, freqFinal: 700, dur: 0.12, vol: 0.13, tipo: 'square', atraso: 0.12 });
        break;
      case 'pato': // "quack"
        tom({ freq: 520, freqFinal: 330, dur: 0.2, vol: 0.16, tipo: 'sawtooth' });
        ruido(0.18, 0.12, 1200, 0, 3);
        break;
      case 'ganso': // "honk"
        tom({ freq: 330, freqFinal: 290, dur: 0.26, vol: 0.16, tipo: 'square' });
        tom({ freq: 660, freqFinal: 580, dur: 0.26, vol: 0.05, tipo: 'sawtooth' });
        break;
      case 'avestruz': // "bum-bum" grave
        tom({ freq: 110, freqFinal: 70, dur: 0.25, vol: 0.35 });
        tom({ freq: 100, freqFinal: 62, dur: 0.3, vol: 0.32, atraso: 0.22 });
        break;
    }
  },
};

// ---------------------------------------------------------------- ambiente: só vento suave
// Os piados aleatórios de passarinho (a cada 2,5–8 s) foram retirados: soavam como bicho cacarejando no fundo o
// tempo todo. As vozes dos animais tocam só quando o jogador interage com eles.
function ventoContinuo(): AudioBufferSourceNode | null {
  if (!ctx || !busAmbiente) return null;
  ruido(0.01, 0.0001, 400); // garante o buffer de ruído
  const fonte = ctx.createBufferSource();
  fonte.buffer = bufferRuido;
  fonte.loop = true;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 480;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  fonte.connect(filtro).connect(g).connect(busAmbiente);
  fonte.start();
  return fonte;
}

function iniciarAmbiente(): void {
  if (!ctx || !busAmbiente || !ambienteLigado || ventoFonte) return;
  busAmbiente.gain.value = 0.25 * volumeEfeitos;
  ventoFonte = ventoContinuo();
}

function pararAmbiente(): void {
  try {
    ventoFonte?.stop();
  } catch {
    // já parado
  }
  ventoFonte = null;
}

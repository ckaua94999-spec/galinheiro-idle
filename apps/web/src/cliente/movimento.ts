// Curvas, molas e tempos do jogo (DIRECAO_DE_ARTE, seção 9) — a versão JS dos tokens --ease-* e --t-*
// de globals.css. Use daqui em vez de repetir números soltos nos componentes:
//   motion:  transition={{ duration: DUR.entra, ease: EASE.suave }}   ou   transition={MOLA.modal}
//   WAAPI:   el.animate(quadros, { duration: 180, easing: CSS_EASE.suave })
// Lembrete: em motion, `type: 'spring'` aceita só 2 keyframes; para 3+ pontos use tween com `times`.

/** Curvas cúbicas (os mesmos valores dos tokens --ease-* do @theme). */
export const EASE = {
  /** out-quint: entradas, listas, troca de tela */
  suave: [0.22, 1, 0.36, 1],
  /** out-expo: partículas, flash */
  explosao: [0.16, 1, 0.3, 1],
  /** out-back: pop com overshoot (faixa do modal, selos) */
  elastico: [0.34, 1.56, 0.64, 1],
  /** in-cubic: voo até o HUD e saídas */
  sugar: [0.32, 0, 0.67, 0],
  /** idle, respiração, balanço */
  senoide: [0.37, 0, 0.63, 1],
  /** back-in: recua antes de ir */
  antecipa: [0.36, 0, 0.66, -0.56],
  /** desaceleração longa da roda */
  giro: [0.15, 0.6, 0.12, 1],
} as const;

export type NomeEase = keyof typeof EASE;

/** As mesmas curvas como string CSS (Web Animations API, style.transition). */
export const CSS_EASE = Object.fromEntries(
  Object.entries(EASE).map(([nome, [a, b, c, d]]) => [nome, `cubic-bezier(${a}, ${b}, ${c}, ${d})`]),
) as Record<NomeEase, string>;

/** Molas (motion). */
export const MOLA = {
  /** caixa do modal central */
  modal: { type: 'spring', visualDuration: 0.32, bounce: 0.28 },
  /** bottom sheet */
  folha: { type: 'spring', visualDuration: 0.38, bounce: 0.12 },
  /** assentar depois do squash do ninho */
  assenta: { type: 'spring', stiffness: 600, damping: 14 },
  /** cápsula da aba ativa e indicadores que deslizam (segmentado) */
  aba: { type: 'spring', stiffness: 500, damping: 38 },
  ponteiro: { type: 'spring', stiffness: 900, damping: 18 },
  roda: { type: 'spring', stiffness: 200, damping: 12 },
  /** toasts e avisos (banner de conexão, nova versão) */
  aviso: { type: 'spring', visualDuration: 0.3, bounce: 0.3 },
  /** popovers pequenos (detalhe dos ovos do HUD) */
  popover: { type: 'spring', visualDuration: 0.26, bounce: 0.3 },
} as const;

/** Tempos em segundos (espelham --t-* de :root). */
export const DUR = {
  press: 0.09,
  solta: 0.22,
  pop: 0.32,
  voo: 0.65,
  bump: 0.18,
  entra: 0.24,
  sai: 0.16,
} as const;

/** Saída padrão (ease-in curto): modais, toasts, popovers. */
export const SAIDA = { duration: DUR.sai, ease: EASE.sugar } as const;

/** Item de lista que entra (seção 9: y 12 → 0 em 200 ms, stagger de 35 ms). */
export const entradaDeLista = (i: number, atrasoBase = 0) =>
  ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2, ease: EASE.suave, delay: atrasoBase + Math.min(i, 8) * 0.035 },
  }) as const;

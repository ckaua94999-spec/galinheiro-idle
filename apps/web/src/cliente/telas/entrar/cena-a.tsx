'use client';

// Cena de abertura oficial — "PÔR DO SOL CINEMATOGRÁFICO" (vencedora do concurso; /entrar?cena=a).
// Splash na hora dourada: céu dourado → coral → violeta-azulado, sol grande e baixo num vale da serra com
// raios girando, montanhas lilases com névoa (perspectiva atmosférica), colinas em contraluz com o moinho de
// pás de lona e o celeiro de portas que se abrem (luz do feno, fumaça do rancho, cata-vento), campo dourado
// com trilha, ninhos com ovo pipocando, borboletas, pássaros em V, poeira dourada e vaga-lumes. Elenco em
// pirâmide no celular (Seu Juca no fardo, a avestruz lendária no pedestal com aura) e em duas alas dos lados
// do painel no desktop. Ideias enxertadas das variantes B e C estão anotadas em cada arquivo de cena-a/.
//
// Como a cena se encaixa (tudo em transform/opacity, por variáveis CSS na raiz):
//  - o "mundo" (céu, sol, colinas, elenco, capim) tem o zero na LINHA DO CHÃO (--chao), logo acima do
//    painel. O CSS já traz uma estimativa por altura de tela, então o HTML do servidor pinta a cena inteira
//    (e a coreografia de entrada, que é CSS, roda) antes da hidratação. Depois, um ResizeObserver mede o
//    painel+legal (que mudam de altura quando o formulário abre) e refina --chao, a escala do elenco
//    (--e-palco, pivô nos pés) e do logo (--e-logo, pivô no topo); o elenco some se não sobrar espaço
//    (recuperação em 360×640) e, em tela alta, o campo que sobra na frente dos pés vira --ergue (ninhos);
//  - no DESKTOP o horizonte fica ancorado a ~60% da altura (não colado no painel): a paisagem distante
//    (sol, serra, colinas, moinho, celeiro) cresce com a altura da tela (--e-pais, pivô no horizonte) e
//    ocupa o terço do meio; o painel cresce junto (--e-base) e as alas do elenco escalam por
//    min(largura, altura) no CSS; --campo é a faixa de pasto entre o horizonte e o painel (ninhos);
//  - no desktop o mouse move as camadas em profundidades diferentes (--mx/--my → `translate`, entrar-a.css);
//  - desempenho: com o formulário aberto (depois da entrada) o elenco, as partículas e o capim PAUSAM
//    (.ca-calmo; o céu e a fazenda seguem vivos), e com a aba escondida tudo pausa (.ca-oculta).
// Arte em cena-a/ (arte, Paisagem, Elenco, Logo, Vida, Poeira); estilos em app/estilos/entrar-a.css.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useReduzirMovimento } from '../../Provedores';
import { Elenco } from './cena-a/Elenco';
import { LogoA } from './cena-a/Logo';
import { Ceu, Frente, Longe, Meio, Perto } from './cena-a/Paisagem';
import { Poeira } from './cena-a/Poeira';
import { Campo } from './cena-a/Vida';
import type { ModoEntrar, PropsCena } from './tipos';

/** Folga entre os pés do elenco e o topo do painel (as sombras ficam acima da borda). */
const FOLGA_PE = 6;
/** Mesmo corte do CSS: desktop com altura de sobra → elenco em duas alas dos lados do painel. */
const LARGO = '(min-width: 1024px) and (min-height: 601px)';
/**
 * Mesmo corte do CSS: tela DEITADA ou baixa (celular deitado, janela baixa, painel lateral do app) → duas
 * colunas: a cena (logo + elenco) à esquerda e o painel à direita, centrado na vertical.
 */
const DEITADA = '(min-aspect-ratio: 5/4) and (max-width: 1023px), (min-aspect-ratio: 5/4) and (max-height: 600px)';
/** Desktop: altura do horizonte (fração da tela) e escalas da paisagem e do painel pela altura. */
const HORIZONTE = 0.6;
/** Fim da coreografia de entrada (CSS ≤ 1,6 s): só depois disso o elenco pode pausar. */
const FIM_ENTRADA_MS = 1800;

const limitar = (min: number, max: number, v: number) => Math.max(min, Math.min(max, v));

export function CenaA({ modo, painel, legal }: PropsCena) {
  const reduzir = useReduzirMovimento();
  const raiz = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const logo = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const modoRef = useRef<ModoEntrar>(modo);
  const medidoRef = useRef(false);
  /** 1ª medição aplicada: só então as variáveis passam a ter transição (a 1ª correção é seca) */
  const [medido, setMedido] = useState(false);
  /** elenco oculto por falta de espaço: também deixa de receber toques */
  const [semElenco, setSemElenco] = useState(false);
  /** a entrada terminou (a partir daí dá para pausar o elenco com o formulário aberto) */
  const [entrou, setEntrou] = useState(false);
  /** aba escondida: tudo pausa */
  const [oculta, setOculta] = useState(false);

  const encaixar = useCallback(() => {
    const r = raiz.current;
    const b = base.current;
    const l = logo.current;
    const p = palco.current;
    if (!r || !b || !l || !p) return;
    const deitada = window.matchMedia(DEITADA).matches;
    const largo = !deitada && window.matchMedia(LARGO).matches;
    const form = modoRef.current !== 'inicio';
    const H = r.clientHeight;
    const temLema = !deitada && !form && H >= 700;
    let eLogo = form ? (H >= 760 ? 0.64 : 0.52) : H >= 760 ? 1 : H >= 660 ? 0.86 : 0.74;
    let fimLogo = l.offsetTop + l.offsetHeight * eLogo + (temLema ? 36 : 0);
    let vChao: number;
    let ePalco = 1;
    let vOp = 1;
    let ergue = 0;
    if (deitada) {
      // duas colunas: a cena vai até onde o painel começa (o painel não muda de lado com o formulário, então
      // o elenco fica no lugar e só pausa). Logo no alto da coluna e elenco embaixo, no maior tamanho que
      // couber na largura e na altura
      const colCena = Math.max(0, b.getBoundingClientRect().left - r.getBoundingClientRect().left - 8);
      const logoW = (l.firstElementChild as HTMLElement | null)?.offsetWidth || l.offsetWidth;
      eLogo = limitar(0.36, 0.82, Math.min((H * 0.34) / l.offsetHeight, (colCena - 16) / logoW));
      fimLogo = l.offsetTop + l.offsetHeight * eLogo;
      const alvo = H - 10 - p.offsetWidth * 0.04;
      const cabe = Math.min((alvo - fimLogo - 6) / p.offsetHeight, (colCena - 8) / p.offsetWidth);
      ePalco = limitar(0.3, 1, cabe);
      vOp = cabe < 0.3 ? 0 : 1;
      vChao = alvo;
    } else if (largo) {
      // horizonte ancorado a ~60% da altura; paisagem e painel crescem com a tela alta; as alas (CSS) ficam
      // no primeiro plano, presas ao pé da tela
      const eBase = limitar(1, H / 880, 1.25);
      const ePais = limitar(1, H / 760, 1.45);
      vChao = Math.max(Math.round(H * HORIZONTE), fimLogo + 120);
      const campo = Math.max(0, H - vChao - b.offsetHeight * eBase);
      r.style.setProperty('--e-base', eBase.toFixed(3));
      r.style.setProperty('--e-pais', ePais.toFixed(3));
      r.style.setProperty('--campo', `${Math.round(campo)}px`);
      r.style.setProperty('--op-ninho', campo > 44 ? '1' : '0');
    } else {
      // galinha e pato pisam um pouco À FRENTE da linha do chão (até ~6,5% da largura do palco abaixo dela)
      const naFrente = p.offsetWidth * 0.065;
      // formulário aberto: a fita do título do cartão sobe 28 px acima dele; o fardo pode ficar atrás dela
      // (o elenco desce um pouco e cresce, sem faixa de pasto vazia entre ele e o cartão)
      const fita = form ? 22 : 0;
      const alvo = H - b.offsetHeight - FOLGA_PE - naFrente + fita;
      const livre = alvo - fimLogo - 4;
      const cabe = livre / p.offsetHeight;
      ePalco = limitar(0.42, 1.06, cabe);
      // tela alta (início): parte do que sobra entre o logo e o elenco vira campo NA FRENTE dos pés (onde
      // ficam os ninhos), o resto fica de céu (sol e raios aparecem entre o logo e o Juca)
      const sobra = livre - p.offsetHeight * ePalco;
      ergue = form ? 0 : limitar(0, 76, sobra * 0.5);
      // sem espaço para o elenco (recuperação em tela baixa): o horizonte fica abaixo do logo, com o moinho e
      // o celeiro inteiros entre o logo e o painel (o painel cobre o resto do campo)
      vChao = Math.max(alvo - ergue, fimLogo + (cabe < 0.42 ? 186 : 96));
      vOp = cabe < 0.42 ? 0 : 1;
    }
    r.style.setProperty('--chao', `${Math.round(vChao)}px`);
    r.style.setProperty('--e-logo', String(eLogo));
    r.style.setProperty('--e-palco', ePalco.toFixed(3));
    r.style.setProperty('--op-palco', String(vOp));
    r.style.setProperty('--ergue', String(Math.round(ergue)));
    setSemElenco(vOp === 0);
    if (!medidoRef.current) {
      medidoRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => setMedido(true)));
    }
  }, []);

  useLayoutEffect(() => {
    modoRef.current = modo;
    encaixar();
  }, [modo, encaixar]);

  useEffect(() => {
    const t = window.setTimeout(() => setEntrou(true), FIM_ENTRADA_MS);
    const ver = () => setOculta(document.hidden);
    document.addEventListener('visibilitychange', ver);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', ver);
    };
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(() => encaixar());
    if (raiz.current) ro.observe(raiz.current);
    if (base.current) ro.observe(base.current);
    if (logo.current) ro.observe(logo.current);
    return () => ro.disconnect();
  }, [encaixar]);

  // parallax do mouse (só com ponteiro fino e sem "reduzir movimento"): uma escrita por quadro
  useEffect(() => {
    const r = raiz.current;
    if (!r || reduzir || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let quadro = 0;
    let nx = 0;
    let ny = 0;
    const mover = (e: PointerEvent) => {
      const caixa = r.getBoundingClientRect();
      nx = ((e.clientX - caixa.left) / caixa.width) * 2 - 1;
      ny = ((e.clientY - caixa.top) / caixa.height) * 2 - 1;
      if (quadro) return;
      quadro = requestAnimationFrame(() => {
        quadro = 0;
        r.style.setProperty('--mx', nx.toFixed(3));
        r.style.setProperty('--my', ny.toFixed(3));
      });
    };
    const sair = () => {
      r.style.setProperty('--mx', '0');
      r.style.setProperty('--my', '0');
    };
    r.addEventListener('pointermove', mover);
    r.addEventListener('pointerleave', sair);
    return () => {
      cancelAnimationFrame(quadro);
      r.removeEventListener('pointermove', mover);
      r.removeEventListener('pointerleave', sair);
    };
  }, [reduzir]);

  // so-opacidade: no "reduzir movimento" a raiz ainda faz o fade curto de entrada (o resto fica parado)
  const classes = [
    'cena-a',
    'so-opacidade',
    medido && 'ca-medido',
    semElenco && 'ca-sem-elenco',
    modo !== 'inicio' && 'cena-a--form',
    modo === 'recuperar' && 'cena-a--recuperar',
    entrou && modo !== 'inicio' && 'ca-calmo',
    oculta && 'ca-oculta',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={raiz} className={classes}>
      <div className="ca-mundo">
        <Ceu />
        <Longe />
        <Meio />
        <Perto />
        <div className="ca-camada ca-c-palco" style={{ '--prof': 36 } as CSSProperties}>
          <div ref={palco} className="ca-palco">
            <Elenco />
          </div>
        </div>
        <Campo />
        <Frente />
      </div>
      <Poeira />
      <div className="ca-vinheta" aria-hidden />
      <div ref={logo} className="ca-logo-caixa">
        <LogoA />
      </div>
      {/* o "nascer da luz" (cortina dourada que clareia de baixo para cima) cobre só o mundo: o logo e o
          painel ficam acima dela. Painel e cortina entram por CSS: rodam já no 1º quadro, antes da
          hidratação, então os botões aparecem e respondem desde o início mesmo num celular lento */}
      <div className="ca-cortina" aria-hidden />
      <div ref={base} className="ca-base">
        {painel}
        {legal}
      </div>
    </div>
  );
}

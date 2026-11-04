'use client';

// Tutorial guiado pelo Seu Juca (GDD 5.2): destaca o elemento da etapa e bloqueia o resto da tela.
// Visual: véu escuro, anel dourado pulsando, seta quicando e balão de fala com o Juca (DIRECAO_DE_ARTE 11).
import { totalDeOvos } from '@galinheiro/game-core';
import { AnimatePresence, motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Juca, type ExpressaoJuca } from '../arte/Juca';
import { estaProntoAgora } from '../derivados';
import type { Estado } from '../estado';
import { agoraServidor } from '../relogio';
import { useUi } from '../ui';
import { ETAPA, useAcoes } from '../useAcoes';

interface Passo {
  alvo: string | null;
  texto: string;
  botao?: string;
}

function usarRetangulo(seletor: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!seletor) {
      setRect(null);
      return;
    }
    let quadro = 0;
    let rolou = false;
    const medir = () => {
      const el = document.querySelector(seletor);
      if (el) {
        if (!rolou) {
          rolou = true;
          const r = el.getBoundingClientRect();
          if (r.top < 120 || r.bottom > window.innerHeight - 120) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        const r = el.getBoundingClientRect();
        setRect((ant) => (ant && ant.x === r.x && ant.y === r.y && ant.width === r.width && ant.height === r.height ? ant : r));
      } else {
        setRect(null);
      }
      quadro = requestAnimationFrame(medir);
    };
    medir();
    return () => cancelAnimationFrame(quadro);
  }, [seletor]);
  return rect;
}

/** Seta dourada que quica apontando para o alvo do tutorial. */
export function SetaTutorial() {
  return (
    <svg viewBox="0 0 40 46">
      <path d="M13 3.5H27V20H35.5L20 41.5L4.5 20H13Z" fill="url(#gi-ui-seta)" stroke="#6a4300" strokeWidth={5} paintOrder="stroke" strokeLinejoin="round" />
      <path d="M16 6.5V21" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
    </svg>
  );
}

/** Tempo "falando" de um texto do balão: ~60 ms por letra (ritmo de leitura), entre 2,2 e 6 s. */
const tempoDeFala = (texto: string) => Math.min(6000, Math.max(2200, texto.length * 60));

/** Seu Juca com o balão de fala (só visual; quem usa decide o que os botões fazem). Ele fala (bico
 *  mexendo) enquanto "diz" o texto e depois fica com `depois` (padrão 'feliz') esperando o jogador. */
export function BalaoJuca({
  texto,
  botao,
  depois = 'feliz',
  aoPular,
  aoAvancar,
}: {
  texto: string;
  botao?: string;
  /** Expressão depois que ele termina de falar. */
  depois?: ExpressaoJuca;
  aoPular: () => void;
  aoAvancar: () => void;
}) {
  // Guarda QUAL texto já terminou de ser falado: texto novo = volta a falar sem efeito extra.
  const [falado, setFalado] = useState<string | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setFalado(texto), tempoDeFala(texto));
    return () => window.clearTimeout(t);
  }, [texto]);
  const expressao: ExpressaoJuca = falado === texto ? depois : 'falando';
  return (
    <>
      {/* Juca pula para dentro e o balão "estoura" a partir da boca dele */}
      <motion.div
        className="balao-juca-figura"
        style={{ transformOrigin: '50% 100%' }}
        initial={{ scale: 0.4, y: 24 }}
        animate={{ scale: 1, y: 0, transition: { type: 'spring', visualDuration: 0.34, bounce: 0.45 } }}
      >
        <Juca expressao={expressao} sombra={false} />
      </motion.div>
      <motion.div
        className="painel balao pointer-events-auto"
        style={{ transformOrigin: '0% 85%' }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, transition: { delay: 0.1, duration: 0.32, ease: [0.34, 1.56, 0.64, 1] } }}
      >
        <span className="pilula pilula-aviso balao-nome">Seu Juca</span>
        <p className="balao-texto">{texto}</p>
        <div className="balao-acoes">
          <button type="button" className="balao-pular" onClick={aoPular}>
            Pular tutorial
          </button>
          {botao && (
            <button type="button" className="botao botao-primario botao-p" onClick={aoAvancar} data-autofoco>
              {botao}
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}

/**
 * Onde o balão fica: logo ABAIXO do alvo se couber, senão logo ACIMA, senão no lado com mais espaço (rodapé ou
 * topo). Desconta a seta (56 px) do lado em que ela está. Sem alvo: acima da barra de abas.
 */
function posicionarBalao(rect: DOMRect | null, folga: number, setaAbaixo: boolean, setaAcima: boolean, altura: number): CSSProperties {
  if (!rect) return { bottom: 'calc(var(--altura-abas) + var(--seguro-base) + 12px)' };
  const H = window.innerHeight;
  const margem = 8;
  const inicioAbaixo = rect.bottom + folga + (setaAbaixo ? 56 : 0) + margem;
  const fimAcima = rect.top - folga - (setaAcima ? 56 : 0) - margem;
  if (H - margem - inicioAbaixo >= altura) return { top: inicioAbaixo };
  if (fimAcima - margem >= altura) return { top: fimAcima - altura };
  return H - rect.bottom > rect.top
    ? { bottom: 'calc(var(--seguro-base) + 8px)' }
    : { top: 'calc(var(--seguro-topo) + 8px)' };
}

export function Tutorial({ estado }: { estado: Estado }) {
  const caminho = usePathname() ?? '';
  const { avancarTutorial } = useAcoes();
  const modalAberto = useUi((s) => !!s.cartaId || s.vendaAberta || !!s.infoId || s.chancesAbertas || s.resultadoGiroAberto);
  const ultimoGiro = useUi((s) => s.ultimoGiro);
  const etapa = estado.player.tutorialEtapa;
  const primeiroNome = estado.conta.nome.split(' ')[0] ?? '';

  const prontos = estado.entidades.filter((e) => estaProntoAgora(e, agoraServidor()));
  const primeiroPronto = prontos[0] ?? null;

  // Pula etapas que não fazem mais sentido (ex.: os ovos já foram coletados em outra sessão).
  useEffect(() => {
    if (etapa === ETAPA.PRIMEIRA_COLETA && prontos.length === 0) avancarTutorial(ETAPA.PRIMEIRA_VENDA);
    if (etapa === ETAPA.PRIMEIRA_VENDA && totalDeOvos(estado.inventario) === 0 && !modalAberto) avancarTutorial(ETAPA.PRIMEIRO_GIRO);
    if (etapa === ETAPA.COLETAR_NOVO && prontos.length === 0 && !modalAberto) avancarTutorial(ETAPA.RITMO);
  }, [etapa, prontos.length, estado.inventario, estado.player.moedasX100, modalAberto, avancarTutorial]);

  let passo: Passo | null = null;
  switch (etapa) {
    case ETAPA.BOAS_VINDAS:
      passo = {
        alvo: null,
        texto: `Bem-vindo(a) ao seu galinheiro${primeiroNome ? `, ${primeiroNome}` : ''}! Eu sou o Seu Juca e vou te mostrar tudo.`,
        botao: 'Vamos lá!',
      };
      break;
    case ETAPA.CONHECER:
      passo = caminho.startsWith('/galinheiro')
        ? { alvo: '[data-tut="grid"]', texto: 'Aqui ficam os ninhos. Você começa com 4, e dá pra chegar a 128!', botao: 'Continuar' }
        : { alvo: '[data-tut="aba-galinheiro"]', texto: 'Vamos ao galinheiro! Toque na aba Galinheiro.' };
      break;
    case ETAPA.PRIMEIRA_COLETA:
      passo = caminho.startsWith('/galinheiro')
        ? {
            alvo: primeiroPronto?.slotId ? `[data-tut="ninho-${primeiroPronto.slotId}"]` : null,
            texto: `${primeiroPronto ? `${primeiroPronto.nome} já botou!` : 'Seu animal já botou!'} Toque no ninho para ver quantos ovos saíram.`,
          }
        : { alvo: '[data-tut="aba-galinheiro"]', texto: 'Tem ovo pronto no galinheiro! Toque na aba Galinheiro.' };
      break;
    case ETAPA.PRIMEIRA_VENDA:
      passo = { alvo: '[data-tut="vender"]', texto: 'Ovo vira moeda. Toque em Vender e venda tudo!' };
      break;
    case ETAPA.PRIMEIRO_GIRO:
      passo = caminho.startsWith('/roleta')
        ? { alvo: '[data-tut="girar"]', texto: 'Com 40 moedas você ganha um animal novo. Toque em Girar e boa sorte!' }
        : { alvo: '[data-tut="aba-roleta"]', texto: 'Agora vamos à roleta! Toque na aba Roleta.' };
      break;
    case ETAPA.NOMEAR:
      passo = null; // acontece dentro do resultado do giro
      break;
    case ETAPA.COLETAR_NOVO:
      passo = caminho.startsWith('/galinheiro')
        ? {
            alvo: ultimoGiro?.slotId ? `[data-tut="ninho-${ultimoGiro.slotId}"]` : primeiroPronto?.slotId ? `[data-tut="ninho-${primeiroPronto.slotId}"]` : null,
            texto: 'Olha só, chegou botando! Colete os ovos do animal novo.',
          }
        : { alvo: '[data-tut="aba-galinheiro"]', texto: 'Seu animal novo já botou! Volte ao galinheiro.' };
      break;
    case ETAPA.RITMO:
      passo = {
        alvo: null,
        texto: 'Cada animal bota de novo em ~24 h e vive 90 dias. Com o tempo ele cansa e bota menos. Volte amanhã!',
        botao: 'Entendi!',
      };
      break;
    default:
      passo = null;
  }

  const ativo = !!passo && !modalAberto && etapa < ETAPA.CONCLUIDO;
  const rect = usarRetangulo(ativo ? (passo?.alvo ?? null) : null);
  // altura real do balão (Juca + painel), para posicioná-lo sem cobrir o alvo
  const caixaBalao = useRef<HTMLDivElement>(null);
  const [alturaBalao, setAlturaBalao] = useState(150);
  useEffect(() => {
    const el = caixaBalao.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAlturaBalao(el.offsetHeight || 150));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ativo, etapa]);

  if (!ativo || !passo) return null;
  const folga = 8;
  const proxima = etapa === ETAPA.BOAS_VINDAS ? ETAPA.CONHECER : etapa === ETAPA.CONHECER ? ETAPA.PRIMEIRA_COLETA : ETAPA.CONCLUIDO;
  // A seta fica acima do alvo; sem espaço (alvo colado no HUD), vai para baixo apontando para cima.
  const setaEmBaixo = rect ? rect.top - folga - 56 < 0 : false;
  const alvoGrande = rect ? rect.height > window.innerHeight * 0.4 : false;
  const posicaoBalao = posicionarBalao(rect, folga, setaEmBaixo && !alvoGrande, !setaEmBaixo && !alvoGrande, alturaBalao);

  return (
    <div className="pointer-events-none fixed inset-0 z-[45]" aria-live="polite">
      {rect ? (
        <>
          <div className="tut-veu pointer-events-auto fixed left-0 right-0 top-0" style={{ height: Math.max(0, rect.top - folga) }} />
          <div className="tut-veu pointer-events-auto fixed left-0 right-0 bottom-0" style={{ top: rect.bottom + folga }} />
          <div className="tut-veu pointer-events-auto fixed left-0" style={{ top: rect.top - folga, height: rect.height + folga * 2, width: Math.max(0, rect.left - folga) }} />
          <div className="tut-veu pointer-events-auto fixed right-0" style={{ top: rect.top - folga, height: rect.height + folga * 2, left: rect.right + folga }} />
          <div
            className="tut-anel pointer-events-none fixed"
            style={{ left: rect.left - folga, top: rect.top - folga, width: rect.width + folga * 2, height: rect.height + folga * 2 }}
          />
          {!alvoGrande && (
            <div
              className="tut-seta pointer-events-none"
              data-lado={setaEmBaixo ? 'baixo' : undefined}
              style={{ left: rect.left + rect.width / 2, top: setaEmBaixo ? rect.bottom + folga + 6 : rect.top - folga - 52 }}
              aria-hidden
            >
              <SetaTutorial />
            </div>
          )}
        </>
      ) : (
        <div className="tut-veu pointer-events-auto fixed inset-0" />
      )}
      <AnimatePresence>
        {/* o contêiner (largura inteira) não recebe toques: só o painel do balão; assim o alvo destacado
            nunca fica bloqueado por um vão transparente */}
        <motion.div
          key={etapa}
          ref={caixaBalao}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="balao-juca pointer-events-none fixed inset-x-3 mx-auto max-w-md"
          style={posicaoBalao}
        >
          <BalaoJuca
            texto={passo.texto}
            botao={passo.botao}
            depois={etapa === ETAPA.RITMO ? 'piscando' : 'feliz'}
            aoPular={() => avancarTutorial(ETAPA.CONCLUIDO)}
            aoAvancar={() => avancarTutorial(proxima)}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

'use client';

// "Casca" do jogo: HUD, conteúdo, abas e camadas globais (modais, tutorial, efeitos, toasts, avisos).
// Renderiza só no cliente (estado depende do relógio e do cache local), evitando divergência de hidratação.
// Visual: carregamento animado, avisos em painel escuro e transição curta entre telas (DIRECAO_DE_ARTE 9 e 11).
import { RefreshCw, WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Ovo } from '../arte/Icones';
import { Juca } from '../arte/Juca';
import { CamadaAvisos } from '../avisos/CamadaAvisos';
import { useConexao } from '../conexao';
import { useEstado } from '../estado';
import { DUR, EASE, MOLA, SAIDA } from '../movimento';
import { aplicarAtualizacao, usePwa } from '../pwa';
import { useUi } from '../ui';
import { ETAPA } from '../useAcoes';
import { cx } from '../util';
import { Abas } from './Abas';
import { CamadaEfeitos } from './CamadaEfeitos';
import { FolhaCarta, ModalInfo } from './FolhaCarta';
import { Hud } from './Hud';
import { ModalAposentadorias } from './ModalAposentadorias';
import { ModalVender } from './ModalVender';
import { Toasts } from './Toasts';
import { Tutorial } from './Tutorial';

const nada = () => () => {};
export const useMontado = (): boolean => useSyncExternalStore(nada, () => true, () => false);

/** Tela de carregamento: logo, Seu Juca pulando sobre raios de sol e ovos quicando. */
export function TelaCarregando({ texto = 'Abrindo o galinheiro…', className }: { texto?: string; className?: string }) {
  return (
    <div className={cx('carregando', className)} role="status" aria-live="polite">
      <div className="carregando-raios" aria-hidden />
      <div className="relative flex flex-col items-center gap-4">
        <div className="carregando-logo" aria-hidden>
          <span className="texto-contorno carregando-titulo">Galinheiro</span>
          <span className="faixa faixa-verde carregando-idle">PIX</span>
        </div>
        <div className="mt-2 flex flex-col items-center" aria-hidden>
          <div className="carregando-juca">
            <Juca />
          </div>
          <div className="carregando-sombra" />
        </div>
        <div className="carregando-ovos" aria-hidden>
          <Ovo tipo="galinha" />
          <Ovo tipo="pato" />
          <Ovo tipo="avestruz" />
        </div>
        <p className="texto-contorno carregando-texto">{texto}</p>
      </div>
    </div>
  );
}

function BannerConexao() {
  const online = useConexao((s) => s.online);
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ y: -40, opacity: 0, scale: 0.92 }}
          animate={{ y: 0, opacity: 1, scale: 1, transition: MOLA.aviso }}
          exit={{ y: -30, opacity: 0, transition: SAIDA }}
          className="painel-escuro aviso fixed inset-x-3 z-[58] mx-auto max-w-md"
          style={{ top: 'calc(var(--altura-hud) + var(--seguro-topo) + 8px)' }}
          role="status"
        >
          <span className="toast-icone" aria-hidden>
            <span className="icone-contorno">
              <WifiOff />
              <WifiOff />
            </span>
          </span>
          <span className="flex-1">Sem conexão. Seus animais continuam botando! As ações voltam quando a internet voltar.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Durante o tutorial o aviso fica guardado (ocuparia o lugar do balão do Seu Juca); a versão nova
// segue esperando e é aplicada depois.
function AvisoAtualizacao({ oculto }: { oculto: boolean }) {
  const atualizacao = usePwa((s) => s.atualizacao);
  return (
    <AnimatePresence>
      {atualizacao && !oculto && (
        <motion.div
          initial={{ y: 60, opacity: 0, scale: 0.92 }}
          animate={{ y: 0, opacity: 1, scale: 1, transition: MOLA.aviso }}
          exit={{ y: 60, opacity: 0, transition: SAIDA }}
          className="painel-escuro aviso fixed inset-x-3 z-[58] mx-auto max-w-md"
          data-tipo="sucesso"
          style={{ bottom: 'calc(var(--altura-abas) + var(--seguro-base) + 14px)' }}
        >
          <span className="toast-icone" aria-hidden>
            <span className="icone-contorno">
              <RefreshCw />
              <RefreshCw />
            </span>
          </span>
          <p className="flex-1">Nova versão do Galinheiro disponível!</p>
          <button type="button" className="botao botao-primario botao-p shrink-0" onClick={aplicarAtualizacao}>
            Atualizar
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Ordem das telas para a direção do deslize na troca de aba.
const ORDEM_TELAS = ['/galinheiro', '/loja', '/intercambio', '/roleta', '/colecao', '/extrato', '/ajustes', '/convites', '/suporte'];
const indiceDaTela = (caminho: string) => {
  const i = ORDEM_TELAS.findIndex((t) => caminho.startsWith(t));
  return i < 0 ? 0 : i;
};

/** Troca de tela (seção 9): o conteúdo novo entra deslizando 24 px do lado da aba escolhida, com fade
 *  (220 ms, EASE.suave). A direção vem da tela anterior guardada num ref (atualizado depois do commit,
 *  sem setState no render). O <main> recorta o eixo X (overflow-x: clip): o deslize nunca alarga a
 *  página nem cria rolagem lateral (scrollWidth do documento = largura da tela durante toda a troca).
 *  No fim o motion devolve transform "none", então modais position: fixed das telas não ficam presos. */
function TransicaoTela({ children }: { children: React.ReactNode }) {
  const caminho = usePathname() ?? '';
  const anterior = useRef(caminho);
  const direcao = Math.sign(indiceDaTela(caminho) - indiceDaTela(anterior.current));
  useEffect(() => {
    anterior.current = caminho;
  }, [caminho]);
  return (
    <motion.div key={caminho} initial={{ opacity: 0, x: direcao * 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: DUR.solta, ease: EASE.suave }}>
      {children}
    </motion.div>
  );
}

export function ShellJogo({ children }: { children: React.ReactNode }) {
  const montado = useMontado();
  const { data: estado, error, refetch, isFetching } = useEstado();
  const definirPreferencias = useUi((s) => s.definirPreferencias);
  const prefs = estado?.player.preferencias;

  useEffect(() => {
    if (prefs) definirPreferencias(prefs);
  }, [prefs, definirPreferencias]);

  if (!montado) return <TelaCarregando />;
  if (!estado) {
    if (error) {
      return (
        <div className="carregando">
          <div className="carregando-raios" aria-hidden />
          <div className="painel painel-com-faixa relative w-full max-w-sm px-5 pb-5 pt-11 text-center">
            <h2 className="faixa">Ops!</h2>
            <Juca className="mx-auto h-24 w-24" />
            <p className="mt-2 font-titulo text-[20px] leading-6 text-texto">Não consegui abrir o galinheiro.</p>
            <p className="mt-1 text-sm text-texto-suave">{error.message}</p>
            <button type="button" className="botao botao-primario botao-g mt-5 w-full" onClick={() => void refetch()} disabled={isFetching}>
              Tentar de novo
            </button>
          </div>
        </div>
      );
    }
    return <TelaCarregando />;
  }

  return (
    <>
      <Hud estado={estado} />
      <main
        className="min-h-dvh overflow-x-clip"
        style={{
          paddingTop: 'calc(var(--altura-hud) + var(--seguro-topo) + 8px)',
          paddingBottom: 'calc(var(--altura-abas) + var(--seguro-base) + 20px)',
        }}
      >
        <TransicaoTela>{children}</TransicaoTela>
      </main>
      <Abas estado={estado} />
      <FolhaCarta estado={estado} />
      <ModalInfo />
      <ModalVender estado={estado} />
      <ModalAposentadorias estado={estado} />
      <CamadaAvisos estado={estado} />
      <Tutorial estado={estado} />
      <CamadaEfeitos />
      <Toasts />
      <BannerConexao />
      <AvisoAtualizacao oculto={estado.player.tutorialEtapa < ETAPA.CONCLUIDO} />
    </>
  );
}

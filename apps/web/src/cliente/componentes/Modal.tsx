'use client';

// Modal central e bottom sheet (GDD 3.7.5), com Esc, clique fora, arrastar para fechar, foco inicial e
// foco preso no diálogo (Tab circula dentro; ao fechar, o foco volta para quem abriu).
// Visual (DIRECAO_DE_ARTE 4.3 e 11): painel pergaminho, título em faixa sobreposta e "X" redondo vermelho.
// Os ganchos de foco (useFocoInicial, useArmadilhaFoco) são exportados para outros diálogos próprios
// (ex.: a revelação da roleta) usarem a mesma pilha: só o diálogo do topo prende o Tab.
import { X } from 'lucide-react';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { useEffect, useId, useRef } from 'react';
import { EASE, MOLA } from '../movimento';
import { som } from '../som';
import { cx } from '../util';

/** Cor da faixa do título. 'perigo' = vermelha (ações destrutivas, ex.: excluir conta). */
export type VarianteModal = 'padrao' | 'perigo' | 'azul' | 'verde';

const CLASSE_FAIXA: Record<VarianteModal, string | false> = {
  padrao: false,
  perigo: 'faixa-perigo',
  azul: 'faixa-azul',
  verde: 'faixa-verde',
};

interface PropsBase {
  aberto: boolean;
  aoFechar: () => void;
  titulo?: string;
  children: React.ReactNode;
  className?: string;
  /** Impede fechar por fora/Esc (ex.: etapa obrigatória). */
  travado?: boolean;
  /** Cor da faixa do título (padrão: laranja). */
  variante?: VarianteModal;
}

interface PropsModal extends PropsBase {
  /** Rodapé fixo (fora da rolagem): CTA principal sempre visível, mesmo em 320×568. */
  rodape?: React.ReactNode;
  /** Classe extra do rodapé (ex.: contêiner de container query). */
  classeRodape?: string;
}

function useFecharComEsc(aberto: boolean, aoFechar: () => void, travado?: boolean) {
  useEffect(() => {
    if (!aberto || travado) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberto, aoFechar, travado]);
}

/**
 * Foco inicial: um [data-autofoco] se houver; senão o próprio diálogo (sem acender o anel no X).
 * Toca o som de abrir (desligue com `{ som: false }` quando o diálogo tiver som próprio).
 * Devolve o ref que vai no elemento do diálogo (precisa de tabIndex={-1}).
 */
export function useFocoInicial<T extends HTMLElement = HTMLDivElement>(aberto: boolean, opcoes: { som?: boolean } = {}) {
  const ref = useRef<T>(null);
  const comSom = opcoes.som ?? true;
  useEffect(() => {
    if (!aberto) return;
    if (comSom) som.abrir();
    const t = setTimeout(() => {
      const alvo = ref.current?.querySelector<HTMLElement>('[data-autofoco]') ?? ref.current;
      alvo?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    }, 60);
    return () => clearTimeout(t);
  }, [aberto, comSom]);
  return ref;
}

const FOCAVEIS = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Diálogos abertos, do mais antigo ao mais novo: só o do topo prende o Tab (ex.: Info aberto sobre a carta).
const pilhaDialogos: React.RefObject<HTMLElement | null>[] = [];

/** Prende o Tab dentro do diálogo do topo e, ao fechar, devolve o foco ao elemento que estava ativo. */
export function useArmadilhaFoco(ref: React.RefObject<HTMLElement | null>, aberto: boolean) {
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pilhaDialogos.push(ref);
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || pilhaDialogos[pilhaDialogos.length - 1] !== ref) return;
      const caixa = ref.current;
      if (!caixa) return;
      const lista = [...caixa.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => el.getClientRects().length > 0);
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      if (!primeiro || !ultimo) {
        e.preventDefault();
        caixa.focus();
        return;
      }
      const atual = document.activeElement;
      const dentro = atual instanceof Node && caixa.contains(atual);
      if (e.shiftKey && (atual === primeiro || atual === caixa || !dentro)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (atual === ultimo || !dentro)) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('keydown', tecla);
      const i = pilhaDialogos.lastIndexOf(ref);
      if (i >= 0) pilhaDialogos.splice(i, 1);
      if (anterior?.isConnected) anterior.focus({ preventScroll: true });
    };
  }, [aberto, ref]);
}

/** Título longo encolhe na faixa (e, no limite, quebra em 2 linhas). O valor vai para --faixa-fs: abaixo
 *  de 360 px o CSS (.faixa-modal em ui.css) ainda o reduz a 88 %, porque a faixa útil cai para ~180 px. */
function tamanhoDaFaixa(titulo: string): number {
  const n = titulo.length;
  return n <= 14 ? 22 : n <= 20 ? 20 : n <= 26 ? 18 : 16;
}

function BotaoFechar({ aoFechar, className }: { aoFechar: () => void; className: string }) {
  return (
    <button type="button" onClick={aoFechar} className={cx('botao botao-icone botao-perigo', className)} aria-label="Fechar">
      <span className="icone-contorno" aria-hidden>
        <X />
        <X />
      </span>
    </button>
  );
}

export function Modal({ aberto, aoFechar, titulo, children, className, travado, variante = 'padrao', rodape, classeRodape }: PropsModal) {
  useFecharComEsc(aberto, aoFechar, travado);
  const ref = useFocoInicial(aberto);
  useArmadilhaFoco(ref, aberto);
  const idTitulo = useId();
  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          className="modal-fundo"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2 } }}
          exit={{ opacity: 0, transition: { duration: 0.16, delay: 0.04 } }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget && !travado) aoFechar();
          }}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titulo ? idTitulo : undefined}
            tabIndex={-1}
            className={cx('painel modal-caixa outline-none', titulo && 'painel-com-faixa')}
            data-variante={variante === 'padrao' ? undefined : variante}
            initial={{ scale: 0.85, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1, transition: MOLA.modal }}
            exit={{ scale: 0.9, y: 12, opacity: 0, transition: { duration: 0.15, ease: EASE.sugar } }}
          >
            {titulo && (
              // a faixa entra 80 ms depois, com pop elástico; o invólucro isola as pontas da fita
              <motion.div
                className="absolute inset-x-0 top-0 isolate"
                style={{ transformOrigin: '50% 0' }}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, transition: { delay: 0.08, duration: 0.32, ease: EASE.elastico } }}
              >
                <h2 id={idTitulo} className={cx('faixa faixa-modal', CLASSE_FAIXA[variante])} style={{ ['--faixa-fs' as string]: `${tamanhoDaFaixa(titulo)}px` }}>
                  {titulo}
                </h2>
              </motion.div>
            )}
            {!travado && <BotaoFechar aoFechar={aoFechar} className="modal-fechar" />}
            <div data-corpo className={cx('modal-corpo', className)}>
              {children}
            </div>
            {rodape && <div className={cx('modal-rodape', classeRodape)}>{rodape}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Folha({ aberto, aoFechar, titulo, children, className }: PropsBase) {
  useFecharComEsc(aberto, aoFechar);
  const ref = useFocoInicial(aberto);
  useArmadilhaFoco(ref, aberto);
  const idTitulo = useId();
  // Só a cabeça (alça + título) arrasta a folha; o corpo rola com o dedo normalmente.
  const controles = useDragControls();
  const arrastar = (e: React.PointerEvent) => controles.start(e);
  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          className="folha-fundo"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2 } }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) aoFechar();
          }}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titulo ? idTitulo : undefined}
            tabIndex={-1}
            className={cx('painel folha outline-none', className)}
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: MOLA.folha }}
            exit={{ y: '100%', transition: { duration: 0.22, ease: EASE.sugar } }}
            drag="y"
            dragControls={controles}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) aoFechar();
            }}
          >
            <div className="folha-cabeca" onPointerDown={arrastar} style={{ touchAction: 'none' }}>
              <div className="folha-alca" aria-hidden />
              {titulo && (
                <h2 id={idTitulo} className="folha-titulo titulo">
                  {titulo}
                </h2>
              )}
            </div>
            <BotaoFechar aoFechar={aoFechar} className="folha-fechar" />
            <div data-corpo className="folha-corpo">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

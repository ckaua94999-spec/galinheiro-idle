'use client';

// Toasts no topo (abaixo do HUD): painel escuro com medalhão colorido por tipo (DIRECAO_DE_ARTE 11).
// Tocar ou arrastar para cima dispensa o toast. Ganho de moedas mostra a moeda do jogo (o reforço do loop).
import { Check, Sparkles, TriangleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { Moeda, Ovo } from '../arte/Icones';
import { MOLA, SAIDA } from '../movimento';
import { useUi, type Toast } from '../ui';

const ICONE = { sucesso: Check, erro: TriangleAlert, info: Sparkles } as const;

/** Ícone de recompensa: ganho de moedas mostra a moeda do jogo; "+N ovos" mostra o ovo. */
function iconeDeRecompensa(t: Toast): 'moeda' | 'ovo' | undefined {
  if (t.tipo === 'erro') return undefined;
  if (t.tipo === 'sucesso' && /\bmoedas?\b/i.test(t.texto)) return 'moeda';
  if (/\+\d+\s+ovos?\b/i.test(t.texto)) return 'ovo';
  return undefined;
}

function ItemToast({ t }: { t: Toast }) {
  const remover = useUi((s) => s.removerToast);
  useEffect(() => {
    const id = setTimeout(() => remover(t.id), t.duracaoMs);
    return () => clearTimeout(id);
  }, [t.id, t.duracaoMs, remover]);
  const Icone = ICONE[t.tipo];
  const recompensa = iconeDeRecompensa(t);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: MOLA.aviso }}
      exit={{ opacity: 0, y: -16, scale: 0.94, transition: SAIDA }}
      className="painel-escuro toast"
      data-tipo={t.tipo}
      data-icone={recompensa}
      role={t.tipo === 'erro' ? 'alert' : 'status'}
      // tocar dispensa; arrastar para cima também
      onClick={() => remover(t.id)}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.7, bottom: 0.1 }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -30 || info.velocity.y < -400) remover(t.id);
      }}
    >
      {/* o medalhão estoura logo depois do painel chegar (moeda e ovo chegam girando meia volta) */}
      <motion.span
        className="toast-icone"
        initial={recompensa ? { scale: 0, rotateY: 180 } : { scale: 0, rotate: -30 }}
        animate={
          recompensa
            ? { scale: 1, rotateY: 0, transition: { delay: 0.08, type: 'spring', visualDuration: 0.4, bounce: 0.45 } }
            : { scale: 1, rotate: 0, transition: { delay: 0.08, type: 'spring', visualDuration: 0.3, bounce: 0.5 } }
        }
        aria-hidden
      >
        {recompensa === 'moeda' ? (
          <Moeda className="h-full w-full" />
        ) : recompensa === 'ovo' ? (
          <Ovo tipo="galinha" className="h-[86%] w-[86%]" />
        ) : (
          <span className="icone-contorno">
            <Icone />
            <Icone />
          </span>
        )}
      </motion.span>
      <span className="toast-texto">{t.texto}</span>
      {t.acao && (
        <button
          type="button"
          className="botao botao-primario botao-p shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            t.acao?.fn();
            remover(t.id);
          }}
        >
          {t.acao.rotulo}
        </button>
      )}
    </motion.div>
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-3"
      style={{ top: 'calc(var(--altura-hud) + var(--seguro-topo) + 8px)' }}
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ItemToast key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

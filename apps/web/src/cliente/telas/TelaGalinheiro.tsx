'use client';

// Galinheiro (GDD 3.1 e 6.2): cenário + cercado de madeira com o grid responsivo (4 colunas no celular,
// 8 quando o cercado passa de ~520 px) sobre um campo de grama que vai até o fim da página.
import type { EntityDTO } from '@galinheiro/api-contract';
import { ArrowUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cerca, PlacaGalinheiro, TopoCenario } from '../arte/Cenario';
import { Juca } from '../arte/Juca';
import { NinhoSlot } from '../componentes/NinhoSlot';
import { estaProntoAgora } from '../derivados';
import { useEstado } from '../estado';
import { agoraServidor, useAgora } from '../relogio';
import { som } from '../som';
import { toast, useUi } from '../ui';
import { useAcoes } from '../useAcoes';

/** Stagger entre os slots novos da ampliação (DIRECAO_DE_ARTE 8.3). */
const PASSO_OBRA_MS = 90;

interface PropsGrade {
  ninhos: { slot: number }[];
  porSlot: Map<number, EntityDTO>;
  agora: number;
  obraSlots: number[];
  aoTocar: (slot: number, e: EntityDTO | null, longo: boolean) => void;
}

/** O cercado com os ninhos (também usado pela galeria de desenvolvimento). */
export function GradeNinhos({ ninhos, porSlot, agora, obraSlots, aoTocar }: PropsGrade) {
  return (
    <Cerca data-tut="grid">
      <div className="grid grid-cols-4 gap-1.5 @min-[520px]:grid-cols-8 @min-[520px]:gap-2">
        {ninhos.map((n) => (
          <NinhoSlot
            key={n.slot}
            slot={n.slot}
            entidade={porSlot.get(n.slot) ?? null}
            agora={agora}
            emObra={obraSlots.includes(n.slot)}
            atrasoObraMs={Math.max(0, obraSlots.indexOf(n.slot)) * PASSO_OBRA_MS}
            aoTocar={aoTocar}
          />
        ))}
      </div>
    </Cerca>
  );
}

export function TelaGalinheiro() {
  const { data: estado } = useEstado();
  const agora = useAgora();
  const router = useRouter();
  const { coletarAnimal } = useAcoes();
  const obraSlots = useUi((s) => s.obraSlots);
  const definirObra = useUi((s) => s.definirObra);
  const abrirCarta = useUi((s) => s.abrirCarta);
  const [mostrarTopo, setMostrarTopo] = useState(false);
  const prontosAnteriores = useRef<Set<string> | null>(null);

  const porSlot = useMemo(() => {
    const m = new Map<number, EntityDTO>();
    for (const e of estado?.entidades ?? []) if (e.slotId !== null) m.set(e.slotId, e);
    return m;
  }, [estado?.entidades]);

  const aoTocar = useCallback(
    (slot: number, e: EntityDTO | null, longo: boolean) => {
      if (!e) {
        som.toque();
        if ((estado?.player.moedasX100 ?? 0) >= 4000) router.push('/roleta');
        else toast('Gire a roleta para ganhar um animal (40 moedas).');
        return;
      }
      if (!longo && estaProntoAgora(e, agoraServidor())) {
        void coletarAnimal(e);
        return;
      }
      som.voz(e.tipo);
      abrirCarta(e.id);
    },
    [estado?.player.moedasX100, router, coletarAnimal, abrirCarta],
  );

  // Som de "pronto" quando um ciclo termina com o app aberto (agrupado, GDD 3.8.3).
  useEffect(() => {
    if (!estado) return;
    const atuais = new Set(estado.entidades.filter((e) => estaProntoAgora(e, agora)).map((e) => e.id));
    const antes = prontosAnteriores.current;
    if (antes && document.visibilityState === 'visible') {
      for (const id of atuais) {
        if (!antes.has(id)) {
          som.pronto();
          break;
        }
      }
    }
    prontosAnteriores.current = atuais;
  }, [estado, agora]);

  // Obra do upgrade: rola até a fileira nova e encerra a animação depois de ~2 s (ANI-09). Cada slot novo
  // começa a obra 90 ms depois do anterior (atrasoObraMs no NinhoSlot); o prazo cresce junto.
  useEffect(() => {
    if (!obraSlots.length) return;
    const primeiro = document.querySelector(`[data-slot="${obraSlots[0]}"]`);
    primeiro?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => definirObra([]), 2000 + (obraSlots.length - 1) * PASSO_OBRA_MS);
    return () => clearTimeout(t);
  }, [obraSlots, definirObra]);

  useEffect(() => {
    const rolar = () => setMostrarTopo(window.scrollY > window.innerHeight * 2);
    window.addEventListener('scroll', rolar, { passive: true });
    return () => window.removeEventListener('scroll', rolar);
  }, []);

  if (!estado) return null;
  const vazio = estado.entidades.length === 0;

  return (
    <div className="tela-galinheiro">
      <TopoCenario />
      <div className="pasto">
        <div className="mx-auto max-w-[1100px] px-2 pt-1 sm:px-4">
          {vazio && (
            <div className="painel mx-auto mb-4 flex max-w-md items-center gap-3 p-4">
              <Juca className="h-20 w-20 shrink-0" />
              <div className="text-left">
                <p className="font-titulo text-lg leading-tight">Seu galinheiro está esperando moradores!</p>
                <Link href="/roleta" className="botao botao-primario botao-p mt-2">
                  Ir à Roleta
                </Link>
              </div>
            </div>
          )}
          <GradeNinhos ninhos={estado.ninhos} porSlot={porSlot} agora={agora} obraSlots={obraSlots} aoTocar={aoTocar} />
          <PlacaGalinheiro>
            Galinheiro nível {estado.player.nivelGalinheiro} · {estado.ninhos.length} ninhos
          </PlacaGalinheiro>
          <p className="dica-galinheiro">Toque e segure um animal para ver a carta</p>
        </div>
      </div>
      <AnimatePresence>
        {mostrarTopo && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="botao botao-icone fixed right-4 z-30"
            style={{ bottom: 'calc(var(--altura-abas) + var(--seguro-base) + 16px)' }}
            aria-label="Voltar ao topo"
          >
            <ArrowUp />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

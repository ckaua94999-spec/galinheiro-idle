'use client';

// Tickets voando (celebração de cupom e compra): saltam do botão abrindo em leque e voam em arco até o número do
// bilhete do saldo, sugados no fim e encolhendo (a mesma coreografia dos ovos indo ao HUD, DIRECAO_DE_ARTE 8.3).
// Camada própria (portal, fixa, sem toque), no máximo 10 tickets por vez; tudo por transform/opacity escritos
// direto no elemento (nada de setState por quadro). Com "reduzir movimento" quem chama nem lança (o número muda
// direto).
import { animate } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EASE } from '../movimento';
import { IconeTicket } from './IconeTicket';

interface Voo {
  id: number;
  de: DOMRect;
  para: DOMRect;
  atrasoMs: number;
  indice: number;
  total: number;
  aoChegar: (indice: number) => void;
}

export interface PedidoVoo {
  de: DOMRect;
  para: DOMRect;
  quantidade: number;
  /** cada ticket que pousa (o 1º solta o número e faz o "bump") */
  aoChegar: (indice: number) => void;
}

const MAX_VOANDO = 10;
let sequencia = 1;

type Controle = { stop: () => void };

function TicketEmVoo({ v, aoFim }: { v: Voo; aoFim: (id: number) => void }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const x0 = v.de.left + v.de.width / 2;
    const y0 = v.de.top + v.de.height / 2;
    const x2 = v.para.left + v.para.width / 2;
    const y2 = v.para.top + v.para.height / 2;
    // −1 … 1: abre o leque dos tickets que saem juntos
    const lado = v.total === 1 ? 0 : (v.indice / (v.total - 1)) * 2 - 1;
    const x1 = x0 + lado * 58;
    const y1 = y0 - 44 - (1 - Math.abs(lado)) * 20;
    // ponto de controle do arco: acima dos dois pontos, puxado para o lado do leque
    const cxB = (x1 + x2) / 2 + lado * 36;
    const cyB = Math.min(y1, y2) - 80;
    const giro0 = lado * 26;
    const sentido = lado >= 0 ? 1 : -1;
    const pos = (x: number, y: number, s: number, r: number, o: number) => {
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) rotate(${r.toFixed(1)}deg) scale(${s.toFixed(3)})`;
      el.style.opacity = String(o);
    };
    pos(x0, y0, 0, 0, 0);
    const controles: Controle[] = [];
    let vivo = true;
    const t = setTimeout(() => {
      // 1) salta do botão em leque, com um "pop" (0 → 1,15 → 1)
      controles.push(
        animate(0, 1, {
          duration: 0.3,
          ease: EASE.suave,
          onUpdate: (p) => {
            const s = p < 0.6 ? (p / 0.6) * 1.15 : 1.15 - ((p - 0.6) / 0.4) * 0.15;
            pos(x0 + (x1 - x0) * p, y0 + (y1 - y0) * p, s, giro0 * p, Math.min(1, p * 4));
          },
          onComplete: () => {
            if (!vivo) return;
            // 2) voa em arco até o número do bilhete: sugado no fim, encolhe e gira
            controles.push(
              animate(0, 1, {
                duration: 0.6,
                delay: 0.08,
                ease: EASE.sugar,
                onUpdate: (p) => {
                  const q = 1 - p;
                  pos(
                    q * q * x1 + 2 * q * p * cxB + p * p * x2,
                    q * q * y1 + 2 * q * p * cyB + p * p * y2,
                    1 - 0.45 * p,
                    giro0 + sentido * 240 * p,
                    1,
                  );
                },
                onComplete: () => {
                  if (!vivo) return;
                  v.aoChegar(v.indice);
                  aoFim(v.id);
                },
              }),
            );
          },
        }),
      );
    }, v.atrasoMs);
    return () => {
      vivo = false;
      clearTimeout(t);
      controles.forEach((c) => c.stop());
    };
    // o voo é disparado uma vez por ticket
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span ref={ref} className="intercambio-voo" style={{ opacity: 0 }}>
      <IconeTicket />
    </span>
  );
}

/** Camada dos tickets voando + `lancar`. A camada vai no fim da tela (portal no <body>). */
export function useVooTickets() {
  const [voos, setVoos] = useState<Voo[]>([]);

  const lancar = useCallback((p: PedidoVoo) => {
    const total = Math.max(1, Math.min(MAX_VOANDO, p.quantidade));
    const novos: Voo[] = Array.from({ length: total }, (_, i) => ({
      id: sequencia++,
      de: p.de,
      para: p.para,
      atrasoMs: i * 55,
      indice: i,
      total,
      aoChegar: p.aoChegar,
    }));
    setVoos((v) => [...v, ...novos].slice(-MAX_VOANDO * 2));
  }, []);

  const remover = useCallback((id: number) => setVoos((v) => v.filter((x) => x.id !== id)), []);

  const camada =
    typeof document === 'undefined' || voos.length === 0
      ? null
      : createPortal(
          <div className="intercambio-voos" aria-hidden>
            {voos.map((v) => (
              <TicketEmVoo key={v.id} v={v} aoFim={remover} />
            ))}
          </div>,
          document.body,
        );

  return { lancar, camada };
}

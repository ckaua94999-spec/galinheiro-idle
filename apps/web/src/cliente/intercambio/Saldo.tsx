'use client';

// Saldo de tickets em destaque: um bilhete rosa de verdade (recortes redondos nas laterais, picote e canhoto com
// o ticket ilustrado sobre raios), o número contado por MotionValue e um "+60"/"−5" que sobe e some quando o
// saldo muda. Logo abaixo, a regra do produto: tickets são vales do jogo.
// `useFestaTickets` cuida da celebração: segura o número enquanto os tickets voam (causa e efeito, como o HUD
// com os ovos), solta quando o 1º pousa, dá o "bump" no bilhete e faz faíscas.
import { ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { NumeroAnimado } from '../componentes/NumeroAnimado';
import { CSS_EASE } from '../movimento';
import { useReduzirMovimento } from '../Provedores';
import { som } from '../som';
import { useUi } from '../ui';
import { IconeTicket } from './IconeTicket';
import { AVISO_TICKETS, numeroTickets, tickets as textoTickets } from './texto';
import { useVooTickets } from './VooTickets';

let sequenciaDelta = 1;

export interface FestaTickets {
  /** valor mostrado no bilhete (fica "segurado" enquanto os tickets voam) */
  exibido: number;
  delta: { id: number; n: number } | null;
  alvo: RefObject<HTMLSpanElement | null>;
  bilhete: RefObject<HTMLDivElement | null>;
  /** guarda o valor atual antes de um ganho (o número só sobe quando o 1º ticket pousa) */
  segurar: () => void;
  soltar: () => void;
  /** ganhou tickets: voam de `origem` até o bilhete. Devolve se o jogador viu os tickets pousarem no bilhete
   *  (bilhete na tela); com o bilhete acima da tela (rolou até a compra) eles sobem e saem por cima. */
  ganhar: (n: number, origem: HTMLElement | null) => boolean;
  /** gastou tickets: "−N" e bump */
  gastar: (n: number) => void;
  camada: ReactNode;
}

export function useFestaTickets(real: number): FestaTickets {
  const reduzir = useReduzirMovimento();
  const [segurado, setSegurado] = useState<number | null>(null);
  const [delta, setDelta] = useState<{ id: number; n: number } | null>(null);
  const alvo = useRef<HTMLSpanElement>(null);
  const bilhete = useRef<HTMLDivElement>(null);
  const atual = useRef(real);
  const seguranca = useRef<number | undefined>(undefined);
  const { lancar, camada } = useVooTickets();

  useEffect(() => {
    atual.current = real;
  }, [real]);
  useEffect(() => () => window.clearTimeout(seguranca.current), []);

  const soltar = useCallback(() => {
    window.clearTimeout(seguranca.current);
    setSegurado(null);
  }, []);
  const segurar = useCallback(() => setSegurado(atual.current), []);

  const bump = useCallback(() => {
    const el = bilhete.current;
    if (!el || document.documentElement.classList.contains('reduzir-movimento')) return;
    el.animate(
      [{ transform: 'scale(1) rotate(0deg)' }, { transform: 'scale(1.05) rotate(-1.2deg)', offset: 0.35 }, { transform: 'scale(1) rotate(0deg)' }],
      { duration: 320, easing: CSS_EASE.suave },
    );
  }, []);

  const faiscas = useCallback(() => {
    const r = alvo.current?.getBoundingClientRect();
    if (r && r.width > 0) useUi.getState().lancarRajada({ tipo: 'faiscas', x: r.left + r.width / 2, y: r.top + r.height / 2, n: 10 });
  }, []);

  const ganhar = useCallback(
    (n: number, origem: HTMLElement | null) => {
      const de = origem?.getBoundingClientRect();
      const para = alvo.current?.getBoundingClientRect();
      // o bilhete fica no alto da tela: visível, ou acima dela (aí os tickets sobem e saem por cima)
      const alcanca = !!para && para.width > 0 && para.top < window.innerHeight;
      const visivel = alcanca && !!para && para.bottom > 0;
      if (!reduzir && de && de.width > 0 && de.bottom > 0 && de.top < window.innerHeight && para && alcanca) {
        let pousou = false;
        lancar({
          de,
          para,
          quantidade: Math.min(10, Math.max(4, n)),
          aoChegar: (i) => {
            som.pop(Math.min(i, 9));
            if (pousou) return;
            pousou = true;
            soltar();
            bump();
            faiscas();
            setDelta({ id: sequenciaDelta++, n });
          },
        });
        // se nada pousar (aba em segundo plano, tela trocada), o número sobe sozinho
        window.clearTimeout(seguranca.current);
        seguranca.current = window.setTimeout(soltar, 1800);
        return visivel;
      }
      soltar();
      bump();
      setDelta({ id: sequenciaDelta++, n });
      return visivel;
    },
    [reduzir, lancar, soltar, bump, faiscas],
  );

  const gastar = useCallback(
    (n: number) => {
      bump();
      setDelta({ id: sequenciaDelta++, n: -n });
    },
    [bump],
  );

  return { exibido: segurado ?? real, delta, alvo, bilhete, segurar, soltar, ganhar, gastar, camada };
}

/** O bilhete do saldo (o número conta até o valor novo; o real vai para o leitor de tela). */
export function BilheteSaldo({ festa, real, fechado = false }: { festa: FestaTickets; real: number; fechado?: boolean }) {
  const { exibido, delta } = festa;
  return (
    <section className="intercambio-saldo" aria-labelledby="intercambio-saldo-titulo">
      <div ref={festa.bilhete} className="intercambio-bilhete">
        <span className="intercambio-bilhete-sombra" aria-hidden />
        <span className="intercambio-bilhete-contorno" aria-hidden />
        <div className="intercambio-bilhete-corpo">
          <span className="intercambio-bilhete-brilho" aria-hidden />
          <div className="intercambio-bilhete-info">
            <h2 id="intercambio-saldo-titulo" className="intercambio-bilhete-rotulo">
              Seus tickets
            </h2>
            <p className="intercambio-bilhete-numero">
              <span ref={festa.alvo} className="intercambio-bilhete-valor texto-contorno" aria-hidden>
                <span className="intercambio-bilhete-fantasma numeros">{numeroTickets(Math.max(exibido, real))}</span>
                <NumeroAnimado valor={exibido} formatar={numeroTickets} className="intercambio-bilhete-conta" />
                {/* "+60" / "−5" nasce ao lado do número, sobe e some */}
                {delta && (
                  <span key={delta.id} className="intercambio-bilhete-delta texto-contorno numeros" data-sinal={delta.n > 0 ? 'mais' : 'menos'}>
                    {delta.n > 0 ? '+' : '−'}
                    {numeroTickets(Math.abs(delta.n))}
                  </span>
                )}
              </span>
              <span className="sr-only" aria-live="polite">
                Você tem {textoTickets(real)}.
              </span>
            </p>
            <p className="intercambio-bilhete-desc">{fechado ? 'Guardados até as trocas voltarem' : 'Troque por ovos e animais'}</p>
          </div>
          <span className="intercambio-bilhete-picote" aria-hidden />
          <span className="intercambio-bilhete-canhoto" aria-hidden>
            <span className="intercambio-bilhete-raios" />
            <IconeTicket className="intercambio-bilhete-icone" />
          </span>
        </div>
      </div>
      <p className="intercambio-nota">
        <span className="intercambio-nota-icone" aria-hidden>
          <ShieldCheck strokeWidth={2.75} />
        </span>
        {AVISO_TICKETS}
      </p>
    </section>
  );
}

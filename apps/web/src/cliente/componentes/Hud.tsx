'use client';

// HUD superior fixo (GDD 3.7.2): saldo, ovos, capacidade, configurações, "Coletar Todos" e "Vender".
// Visual (DIRECAO_DE_ARTE 11): faixa do céu, pílulas escuras com o ícone saltando para fora e bump nos contadores.
import {
  ITENS, NOME_TIPO, ANIMAIS, formatarTimer, tipoDoItem, totalDeOvos, valorVendaX100,
} from '@galinheiro/game-core';
import { ChevronDown, Timer } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotionConfig } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { IconeAjustes, IconeCesto, IconeNinho, Moeda, Ovo } from '../arte/Icones';
import { useNaoLidasSuporte } from '../avisos/consultas';
import { contarProntos, proximoPronto } from '../derivados';
import { CSS_EASE, MOLA, SAIDA } from '../movimento';
import type { Estado } from '../estado';
import { useAgora } from '../relogio';
import { useAcoes } from '../useAcoes';
import { useUi } from '../ui';
import { cx, moedas } from '../util';
import { NumeroAnimado } from './NumeroAnimado';

/** Bump do contador (seção 9): número `scale [1,1.18,1]` em 180 ms e ícone balançando em 250 ms. Throttle de 60 ms. */
function useBump() {
  const numero = useRef<HTMLSpanElement>(null);
  const icone = useRef<HTMLSpanElement>(null);
  const ultimo = useRef(0);
  const bump = () => {
    const agora = performance.now();
    if (agora - ultimo.current < 60) return;
    ultimo.current = agora;
    if (document.documentElement.classList.contains('reduzir-movimento')) return;
    numero.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: 0.35 }, { transform: 'scale(1)' }], {
      duration: 180,
      easing: CSS_EASE.suave,
    });
    icone.current?.animate(
      [
        { transform: 'rotate(0deg) scale(1)' },
        { transform: 'rotate(-12deg) scale(1.16)', offset: 0.3 },
        { transform: 'rotate(8deg) scale(1.04)', offset: 0.65 },
        { transform: 'rotate(0deg) scale(1)' },
      ],
      { duration: 250, easing: 'ease-out' },
    );
  };
  return { numero, icone, bump };
}

/** Dispara o bump quando o valor muda e marca "gastou" (número avermelhado) quando ele cai. */
function useReagirAoValor(valor: number, bump: () => void) {
  const anterior = useRef(valor);
  const [gastou, setGastou] = useState(false);
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = valor;
    if (valor === antes) return;
    bump();
    if (valor < antes) {
      setGastou(true);
      const t = setTimeout(() => setGastou(false), 700);
      return () => clearTimeout(t);
    }
    setGastou(false);
    // bump é recriado a cada render; só o valor importa aqui
  }, [valor]);
  return gastou;
}

/**
 * Valor exibido no contador: quando SOBE, espera a primeira moeda/ovo voador encostar no chip (pulso)
 * para começar a contar — causa e efeito (DIRECAO_DE_ARTE 8.3). Quando cai (gasto), aplica na hora.
 * Se nenhum pulso chegar (ex.: nada voou), aplica sozinho depois de 1,5 s.
 */
function useValorSegurado(valor: number, pulso: number, reduzir: boolean) {
  const [exibido, setExibido] = useState(valor);
  const atual = useRef(valor);
  const alvo = useRef<number | null>(null);
  const seguranca = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aplicar = (v: number) => {
    alvo.current = null;
    if (seguranca.current) clearTimeout(seguranca.current);
    seguranca.current = null;
    atual.current = v;
    setExibido(v);
  };
  useEffect(() => {
    if (reduzir || valor <= atual.current) {
      aplicar(valor);
      return;
    }
    alvo.current = valor;
    // não rearma: chegadas seguidas não podem segurar o número para sempre
    seguranca.current ??= setTimeout(() => {
      if (alvo.current !== null) aplicar(alvo.current);
    }, 1500);
    // aplicar só mexe em refs e no setState estável
  }, [valor, reduzir]);
  useEffect(() => {
    if (pulso && alvo.current !== null) aplicar(alvo.current);
  }, [pulso]);
  useEffect(
    () => () => {
      if (seguranca.current) clearTimeout(seguranca.current);
    },
    [],
  );
  return exibido;
}

/** Número do chip com "fantasma": a pílula já nasce com a largura do valor final e não treme durante a contagem. */
function NumeroChip({ valor, formatar }: { valor: number; formatar: (n: number) => string }) {
  return (
    <>
      <span className="chip-numero-fantasma" aria-hidden>
        {formatar(valor)}
      </span>
      <NumeroAnimado valor={valor} formatar={formatar} duracao={0.6} />
    </>
  );
}

const textoOvos = (n: number) => String(n);

function PopoverOvos({ estado, aoFechar }: { estado: Estado; aoFechar: () => void }) {
  const valor = valorVendaX100(estado.inventario);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0, transition: MOLA.popover }}
      exit={{ opacity: 0, scale: 0.92, y: -4, transition: SAIDA }}
      className="painel hud-popover"
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') aoFechar();
      }}
    >
      <ul className="space-y-1">
        {ITENS.map((item) => {
          const tipo = tipoDoItem(item);
          return (
            <li key={item} className="flex min-h-9 items-center gap-2.5 text-sm font-extrabold">
              <Ovo tipo={tipo} className="h-7 w-6 shrink-0" />
              <span className="flex-1">{NOME_TIPO[tipo]}</span>
              <span className="numeros font-titulo text-[17px] text-texto">{estado.inventario[item]}</span>
              <span className="numeros flex w-[72px] items-center justify-end gap-1 text-texto-suave">
                × {moedas(ANIMAIS[tipo].precoOvoX100)}
                <Moeda className="h-4 w-4 shrink-0" />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex items-center justify-end gap-1.5 border-t-2 border-dashed border-creme-escuro pt-2 text-sm font-extrabold">
        Total: <span className="numeros font-titulo text-[17px]">{moedas(valor)}</span> moedas
        <Moeda className="h-5 w-5" />
      </p>
    </motion.div>
  );
}

export function Hud({ estado }: { estado: Estado }) {
  const agora = useAgora();
  const router = useRouter();
  const caminho = usePathname() ?? '';
  const naAjustes = caminho.startsWith('/ajustes');
  const { coletarTudo, coletandoTudo } = useAcoes();
  const abrirVenda = useUi((s) => s.abrirVenda);
  const pulso = useUi((s) => s.pulsoContador);
  const pulsoOvos = useUi((s) => s.pulsoOvos);
  const [ovosAberto, setOvosAberto] = useState(false);
  const refCaixaOvos = useRef<HTMLDivElement>(null);
  const saldo = useBump();
  const ovos = useBump();
  const reduzir = !!useReducedMotionConfig();
  // mensagens novas do suporte: só lê o cache (a casca do jogo é quem consulta /avisos)
  const naoLidasSuporte = useNaoLidasSuporte();

  const prontos = contarProntos(estado.entidades, agora);
  const proximo = proximoPronto(estado.entidades, agora);
  const totalOvos = totalDeOvos(estado.inventario);
  const valor = valorVendaX100(estado.inventario);
  const { ocupados, capacidade, moedasX100 } = estado.player;
  const cheio = estado.entidades.length >= capacidade;

  const exibidoMoedas = useValorSegurado(moedasX100, pulso, reduzir);
  const exibidoOvos = useValorSegurado(totalOvos, pulsoOvos, reduzir);
  const gastou = useReagirAoValor(exibidoMoedas, saldo.bump);
  useReagirAoValor(exibidoOvos, ovos.bump);
  useEffect(() => {
    if (pulso) saldo.bump();
  }, [pulso]);
  useEffect(() => {
    if (pulsoOvos) ovos.bump();
  }, [pulsoOvos]);

  // Fecha o detalhe dos ovos ao tocar fora ou com Esc.
  useEffect(() => {
    if (!ovosAberto) return;
    const fora = (e: PointerEvent) => {
      if (!refCaixaOvos.current?.contains(e.target as Node)) setOvosAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOvosAberto(false);
    };
    document.addEventListener('pointerdown', fora);
    window.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fora);
      window.removeEventListener('keydown', tecla);
    };
  }, [ovosAberto]);

  const irAoPrimeiroVazio = () => {
    const vazio = estado.ninhos.find((n) => !n.entityId);
    if (vazio) {
      router.push('/galinheiro');
      setTimeout(() => document.querySelector(`[data-slot="${vazio.slot}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    } else {
      router.push('/loja');
    }
  };

  return (
    <header className="hud">
      {/* no desktop o HUD tem sempre a largura do cercado (1100 px, px-4): contadores à esquerda, sobre
          o mourão, e ações à direita, como a barra de um jogo. A largura é a mesma em todas as telas,
          então nada se desloca na troca de aba (antes: 1100 no galinheiro, 920 nas telas de coluna) */}
      <div className="mx-auto flex max-w-5xl flex-col gap-1.5 px-2 pb-2.5 pt-1.5 lg:max-w-[1100px] lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:px-4 lg:py-[9px]">
        {/* contadores: no celular, distribuídos com o mesmo ar entre a borda de um chip e o ícone saltado
            do seguinte, até a engrenagem (ui.css, .hud-contadores) */}
        <div className="hud-linha hud-contadores">
          <Link
            href="/extrato"
            id="hud-moedas"
            aria-label={`Saldo: ${moedas(moedasX100)} moedas. Abrir extrato`}
            className="chip chip-hud"
            data-gastou={gastou ? '' : undefined}
          >
            <span ref={saldo.icone} className="chip-icone" data-alvo-voo>
              <Moeda />
            </span>
            <span ref={saldo.numero} className="chip-numero">
              <NumeroChip valor={exibidoMoedas} formatar={moedas} />
            </span>
          </Link>
          <div ref={refCaixaOvos} className="relative">
            <button
              type="button"
              id="hud-ovos"
              onClick={() => setOvosAberto((v) => !v)}
              aria-label={`Ovos: ${totalOvos}. Ver detalhes`}
              aria-expanded={ovosAberto}
              className="chip chip-hud"
            >
              <span ref={ovos.icone} className="chip-icone" data-alvo-voo>
                <Ovo tipo="galinha" className="!h-[95%] !w-[80%]" />
              </span>
              <span ref={ovos.numero} className="chip-numero">
                <NumeroChip valor={exibidoOvos} formatar={textoOvos} />
              </span>
              <span className="chip-seta" aria-hidden>
                <ChevronDown />
              </span>
            </button>
            <AnimatePresence>{ovosAberto && <PopoverOvos estado={estado} aoFechar={() => setOvosAberto(false)} />}</AnimatePresence>
          </div>
          <button
            type="button"
            onClick={irAoPrimeiroVazio}
            aria-label={`Ninhos ocupados: ${ocupados} de ${capacidade}`}
            className="chip chip-hud chip-hud-ninhos"
            data-cheio={cheio ? '' : undefined}
          >
            <span className="chip-icone">
              <IconeNinho className="!h-[78%] !w-[97%]" />
            </span>
            <span className="chip-numero numeros">
              {estado.entidades.length}/{capacidade}
            </span>
          </button>
          <Link
            href="/ajustes"
            aria-label={
              naoLidasSuporte > 0
                ? `Configurações (${naoLidasSuporte} ${naoLidasSuporte === 1 ? 'mensagem nova' : 'mensagens novas'} do suporte)`
                : 'Configurações'
            }
            aria-current={naAjustes ? 'page' : undefined}
            className="botao botao-icone hud-ajustes lg:ml-1"
          >
            <IconeAjustes className="!h-[26px] !w-[26px] lg:!h-[30px] lg:!w-[30px]" />
            {naoLidasSuporte > 0 && (
              <span className="badge hud-ajustes-badge" aria-hidden>
                {naoLidasSuporte > 9 ? '9+' : naoLidasSuporte}
              </span>
            )}
          </Link>
        </div>
        <div className="hud-linha gap-2.5 lg:ml-auto">
          <button
            type="button"
            className={cx(
              'botao botao-primario botao-compacto flex-1 lg:flex-none lg:px-5',
              prontos > 0 && 'botao-brilho',
              prontos === 0 && 'botao-espera',
            )}
            onClick={() => void coletarTudo()}
            disabled={prontos === 0 || coletandoTudo}
            data-pressionado={coletandoTudo ? '' : undefined}
            data-tut="coletar-todos"
          >
            {prontos > 0 ? (
              <>
                <IconeCesto className="botao-arte" />
                Coletar Todos
                <span className="botao-preco numeros">{prontos}</span>
              </>
            ) : (
              // estado de espera: "cronômetro" com o relógio num medalhão dourado
              <>
                <span className="toast-icone espera-relogio" aria-hidden>
                  <span className="icone-contorno">
                    <Timer />
                    <Timer />
                  </span>
                </span>
                {proximo ? (
                  <span className="espera-texto">
                    <span className="espera-rotulo">Próximos em</span>
                    <span className="espera-tempo numeros">{formatarTimer(proximo - agora)}</span>
                  </span>
                ) : (
                  <span>Nada para coletar</span>
                )}
              </>
            )}
          </button>
          <button
            type="button"
            className="botao botao-confirmar botao-compacto flex-1 lg:flex-none lg:px-5"
            onClick={() => abrirVenda(true)}
            disabled={totalOvos === 0}
            data-tut="vender"
            data-hud-vender
            aria-label={totalOvos > 0 ? `Vender (${moedas(valor)} moedas)` : 'Vender'}
          >
            Vender
            {totalOvos > 0 && (
              <span className="botao-preco numeros">
                {moedas(valor)}
                <Moeda className="h-[1.2em] w-[1.2em]" />
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

'use client';

// Galeria da área "cenario" (dev): o galinheiro completo com todos os estados de ninho, um HUD de mentira
// (alvos #hud-moedas / #hud-ovos) e botões que disparam os efeitos. ?efeito=coleta|jackpot|venda|todos|todos2|todos3|obra
// dispara sozinho ~1 s depois de abrir (para a captura automática).
import type { EntityDTO } from '@galinheiro/api-contract';
import type { Item } from '@galinheiro/game-core';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { TopoCenario, PlacaGalinheiro } from '@/cliente/arte/Cenario';
import { Moeda, Ovo } from '@/cliente/arte/Icones';
import { CamadaEfeitos } from '@/cliente/componentes/CamadaEfeitos';
import { GradeNinhos } from '@/cliente/telas/TelaGalinheiro';
import { useUi } from '@/cliente/ui';
import { lancarRajadaNinho, planejarColetarTodos } from '@/cliente/useAcoes';
import { Exemplo, Moldura } from '../_Moldura';
import { AGORA_FICTICIO, entidadeFicticia } from '../_mock';

const ITEM: Record<EntityDTO['tipo'], Item> = { galinha: 'ovo_galinha', pato: 'ovo_pato', ganso: 'ovo_ganso', avestruz: 'ovo_avestruz' };
// Ninhos sempre em obra na galeria (para ver o andaime parado na captura).
const OBRA_FIXA = [15, 16];

/** Um ninho de cada estado: pronto, timer, quase pronto, vida baixa, presente, vazio e obra. */
function entidadesGaleria(): EntityDTO[] {
  return [
    entidadeFicticia({ tipo: 'galinha', slot: 1, pronto: true }),
    entidadeFicticia({ tipo: 'pato', slot: 2, pronto: true, tier: 'neutro' }),
    entidadeFicticia({ tipo: 'ganso', slot: 3, tier: 'neutro', faltaH: 5.2 }),
    entidadeFicticia({ tipo: 'avestruz', slot: 4, pronto: true }),
    entidadeFicticia({ tipo: 'galinha', slot: 5, tier: 'cansado', faltaH: 0.3, nome: 'Pipoca' }),
    entidadeFicticia({ tipo: 'pato', slot: 6, tier: 'triste', faltaH: 14 }),
    entidadeFicticia({ tipo: 'ganso', slot: 7, pronto: true, ultimoCiclo: true, tier: 'triste' }),
    entidadeFicticia({ tipo: 'galinha', slot: 8, ultimoCiclo: true, faltaH: 9, tier: 'cansado', nome: 'Vovó' }),
    entidadeFicticia({ tipo: 'avestruz', slot: 9, tier: 'neutro', faltaH: 2 }),
    entidadeFicticia({ tipo: 'galinha', slot: 10, tier: 'triste', pronto: true, nome: 'Cocó' }),
    entidadeFicticia({ tipo: 'pato', slot: 11, faltaH: 0.05 }),
    entidadeFicticia({ tipo: 'galinha', slot: 14, faltaH: 20, nome: 'Jujuba' }),
  ];
}

/** HUD de mentira: só os alvos dos voos, com o "bump" quando algo chega. */
function HudFicticio() {
  const pulso = useUi((s) => s.pulsoContador);
  const pulsoOvos = useUi((s) => s.pulsoOvos);
  const refMoedas = useRef<HTMLSpanElement>(null);
  const refOvos = useRef<HTMLSpanElement>(null);
  const bump = (el: HTMLElement | null) =>
    el?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' });
  useEffect(() => void (pulso && bump(refMoedas.current)), [pulso]);
  useEffect(() => void (pulsoOvos && bump(refOvos.current)), [pulsoOvos]);
  return (
    <div className="sticky top-0 z-10 flex gap-3 bg-[#fff6e0] px-3 py-2" style={{ borderBottom: '3px solid #c99a55' }}>
      <span ref={refMoedas} id="hud-moedas" className="chip">
        <span className="chip-icone">
          <Moeda />
        </span>
        <span className="numero-jogo">1.284</span>
      </span>
      <span ref={refOvos} id="hud-ovos" className="chip">
        <span className="chip-icone">
          <Ovo tipo="galinha" />
        </span>
        <span className="numero-jogo">40</span>
      </span>
    </div>
  );
}

function Galinheiro({ largura, comHud }: { largura: number; comHud?: boolean }) {
  const obraSlots = useUi((s) => s.obraSlots);
  const entidades = useMemo(entidadesGaleria, []);
  const porSlot = useMemo(() => new Map(entidades.map((e) => [e.slotId ?? 0, e])), [entidades]);
  const ninhos = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ slot: i + 1 })), []);
  const obra = useMemo(() => [...OBRA_FIXA, ...obraSlots], [obraSlots]);
  const aoTocar = useCallback((slot: number, e: EntityDTO | null) => {
    if (e?.pronto) coletarFicticio(slot, slot === 4 ? 3 : 1 + (slot % 2));
  }, []);
  return (
    <div className="tela-galinheiro overflow-hidden rounded-2xl" style={{ width: largura, margin: 0, background: 'linear-gradient(180deg, #49b8ff 0%, #8fd6ff 40%, #c4ecff 100%)' }}>
      {comHud && <HudFicticio />}
      <TopoCenario />
      <div className="pasto" style={{ minHeight: 0, paddingBottom: 24 }}>
        <div className="px-2 pt-1">
          <GradeNinhos ninhos={ninhos} porSlot={porSlot} agora={AGORA_FICTICIO} obraSlots={obra} aoTocar={aoTocar} />
          <PlacaGalinheiro>Galinheiro nível 4 · 16 ninhos</PlacaGalinheiro>
          <p className="dica-galinheiro">Toque e segure um animal para ver a carta</p>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ disparadores (o que o useAcoes faz)
function ninho(slot: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-galeria-principal] [data-slot="${slot}"]`);
}

/** Ovos voando de um ninho fictício (o "surpresa" do animal vem do revelar). */
function ovosFicticios(slot: number, ovos: number, atrasoMs = 0): DOMRect | null {
  const el = ninho(slot);
  const e = entidadesGaleria().find((x) => x.slotId === slot);
  if (!el || !e) return null;
  const r = el.getBoundingClientRect();
  const ui = useUi.getState();
  const item = ITEM[e.tipo];
  // "surpresa" do animal na hora em que os ovos dele saltam
  if (atrasoMs > 120) setTimeout(() => useUi.getState().revelar(e.id, ovos, item), atrasoMs);
  else ui.revelar(e.id, ovos, item);
  ui.lancarOvos(Array.from({ length: ovos }, (_, i) => ({ item, de: r, atrasoMs: atrasoMs + i * 60, indice: i, total: ovos })));
  return r;
}

/** Coleta individual: mesma rajada do useAcoes (3 ovos = jackpot centrado no ninho). */
function coletarFicticio(slot: number, ovos: number) {
  const r = ovosFicticios(slot, ovos);
  if (r) lancarRajadaNinho(r, ovos, ovos === 3, 450);
}

/**
 * Coletar Todos com o mesmo plano do useAcoes. Padrão: dois jackpots vizinhos na 1ª fileira (slots 1 e 2), como
 * acontece na conta demo. `fileira2`: o único jackpot é o ganso do slot 7 (2ª fileira, com ninho ocupado acima).
 * `vizinhos2`: dois jackpots lado a lado na 2ª fileira (slots 6 e 7): o segundo "UAU!" espera a vez, sem sumir.
 */
function coletarTodosFicticio(caso: 'padrao' | 'fileira2' | 'vizinhos2' = 'padrao') {
  const OVOS: Record<typeof caso, Record<number, number>> = {
    padrao: { 1: 3, 2: 3, 4: 2, 7: 1, 10: 1 },
    fileira2: { 1: 1, 2: 2, 4: 1, 7: 3, 10: 2 },
    vizinhos2: { 1: 1, 2: 2, 4: 1, 6: 3, 7: 3, 10: 2 },
  };
  const ovos = OVOS[caso];
  const slots = Object.keys(ovos).map(Number);
  const naGrade = slots.flatMap((s) => {
    const rect = ninho(s)?.getBoundingClientRect();
    return rect ? [{ s, rect, ovos: ovos[s] ?? 1, jackpot: ovos[s] === 3 }] : [];
  });
  // ovos e estouro de cada ninho saem juntos (atrasoPopMs): o jackpot escalonado sai inteiro na vez dele
  planejarColetarTodos(naGrade).forEach((p, i) => {
    const n = naGrade[i]!;
    const pop = p?.atrasoPopMs ?? i * 40;
    ovosFicticios(n.s, n.ovos, pop);
    if (p) lancarRajadaNinho(n.rect, n.ovos, n.jackpot, p.atrasoMs, true, n.jackpot && !p.uau, p.espera, p.dx, pop);
  });
}

function venderFicticio() {
  const botao = document.querySelector<HTMLElement>('[data-galeria-vender]');
  if (!botao) return;
  const r = botao.getBoundingClientRect();
  useUi.getState().lancarRajada({ tipo: 'fonte-moedas', x: r.left + r.width / 2, y: r.top + r.height / 2 });
  useUi.getState().lancarChuvaMoedas(r, 14, 5890);
}

function obraFicticia() {
  useUi.getState().definirObra([12, 13]);
  setTimeout(() => useUi.getState().definirObra([]), 2000 + 90);
}

const EFEITOS: Record<string, () => void> = {
  coleta: () => coletarFicticio(1, 2),
  jackpot: () => coletarFicticio(4, 3),
  venda: venderFicticio,
  todos: () => coletarTodosFicticio(),
  todos2: () => coletarTodosFicticio('fileira2'),
  todos3: () => coletarTodosFicticio('vizinhos2'),
  obra: obraFicticia,
};

export function SecaoCenario() {
  useEffect(() => {
    const efeito = new URLSearchParams(window.location.search).get('efeito');
    const fn = efeito ? EFEITOS[efeito] : undefined;
    if (!fn) return;
    const t = setTimeout(fn, 1000);
    return () => clearTimeout(t);
  }, []);

  return (
    <Moldura titulo="Cenario">
      <CamadaEfeitos />
      <Exemplo titulo="efeitos (toque num ninho pronto também coleta)" className="flex flex-wrap gap-2">
        <button type="button" className="botao botao-primario botao-p" onClick={EFEITOS.coleta}>
          Coleta
        </button>
        <button type="button" className="botao botao-primario botao-p" onClick={EFEITOS.jackpot}>
          Jackpot
        </button>
        <button type="button" className="botao botao-primario botao-p" onClick={EFEITOS.todos}>
          Coletar Todos
        </button>
        <button type="button" className="botao botao-primario botao-p" onClick={EFEITOS.todos2}>
          Coletar Todos (jackpot na 2ª fileira)
        </button>
        <button type="button" className="botao botao-primario botao-p" onClick={EFEITOS.todos3}>
          Coletar Todos (2 jackpots lado a lado)
        </button>
        <button type="button" className="botao botao-confirmar botao-p" onClick={EFEITOS.venda} data-galeria-vender>
          Vender
        </button>
        <button type="button" className="botao botao-compra botao-p" onClick={EFEITOS.obra}>
          Obra
        </button>
        <button type="button" className="botao botao-p" onClick={() => document.documentElement.classList.toggle('reduzir-movimento')}>
          Reduzir movimento
        </button>
      </Exemplo>

      <Exemplo titulo="galinheiro no celular (390 px): pronto, timer, quase, vida baixa, presente, vazio e obra">
        <div data-galeria-principal>
          <Galinheiro largura={358} comHud />
        </div>
      </Exemplo>

      <Exemplo titulo="galinheiro largo (8 colunas)" className="overflow-x-auto">
        <Galinheiro largura={1040} />
      </Exemplo>
    </Moldura>
  );
}

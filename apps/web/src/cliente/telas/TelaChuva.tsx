'use client';

// Chuva de Ovos: caça-níquel de cascata com moedas do jogo (nada se compra nem se saca).
// O servidor sorteia a jogada inteira; aqui é só a encenação, em ritmo rápido (um giro sem prêmio dura ~0,6 s):
//  - a grade antiga despenca e a nova cai do céu, coluna por coluna, com quique e "tique" por coluna;
//  - os premiados tremem um instante, estouram (clarão, anel, cascas, gema, penas, faíscas), o "+N" sobe do grupo
//    e as moedas voam para o placar, que conta e pulsa;
//  - os de cima descem com mola e entram novos por cima; cada cascata seguida vale mais (×2, ×3… até ×5): sobe a
//    nota, acende o selo "CASCATA ×N" e esquenta o fundo (raios mais fortes e mais rápidos);
//  - no fim, os ovos de ouro acendem um a um e o multiplicador estoura no meio com clarão e tremor;
//  - ganho grande vira faixa ("GRANDE GANHO!") e as moedas voam para o saldo.
// Os controles ficam sempre na tela: acabou, é só girar de novo. O retorno médio aparece antes da aposta.
import {
  CONFIG_CHUVA, NOME_SIMBOLO_CHUVA, PAGANTES_CHUVA, formatarMoedas, jogarChuva,
  type CelulaChuva, type PassoChuva, type ResultadoChuva, type RodadaChuva,
} from '@galinheiro/game-core';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Info, Lock, Minus, Plus } from 'lucide-react';
import { AnimatePresence, motion, useAnimate, type Variants } from 'motion/react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Moeda } from '../arte/Icones';
import { CamadaEstouros, type EfeitoEstouro, type MoedaFx, type RotuloGanho } from '../chuva/Estouros';
import { SimboloChuva } from '../chuva/SimboloChuva';
import { Modal } from '../componentes/Modal';
import { NumeroAnimado } from '../componentes/NumeroAnimado';
import { concluirChuva, useEstado, useGirarChuva } from '../estado';
import { useReduzirMovimento } from '../Provedores';
import { som } from '../som';
import { toast, useUi } from '../ui';
import { mensagemDeErro, moedas } from '../util';
import { vibracao } from '../vibracao';

const { apostaMinX100, apostaMaxX100, colunas, linhas } = CONFIG_CHUVA;
const FICHAS = [100, 200, 500, 1_000, 2_500, 5_000].filter((v) => v >= apostaMinX100 && v <= apostaMaxX100);
const valor = (x100: number) => moedas(x100).replace(/,00$/, '');
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const vezes = (pct: number) => `${(pct / 100).toLocaleString('pt-BR')}×`;

/** Ritmo da encenação (ms). */
const T = { queda: 540, treme: 210, cascata: 440, bomba: 160, multiplicador: 700, gratis: 1050, faixa: 1700 };

type Fase = 'pronto' | 'jogando' | 'fim';
/** Como as casas saem da grade: estourando (prêmio) ou despencando (grade nova). */
type ModoSaida = 'estouro' | 'troca';
interface Placar {
  ganhoX100: number;
  gratis: { atual: number; total: number } | null;
  aviso: string | null;
  multiplicador: number | null;
  cascata: number;
}
interface Faixa { id: number; titulo: string; sub?: string }

/** Elogio rápido para ganho de verdade (prêmio acima da aposta) que ainda não chega à faixa de ganho grande. */
function elogioDeGanho(premio: number, aposta: number): string | null {
  const v = premio / aposta;
  if (v >= 5) return 'ÓTIMO!';
  if (v >= 2) return 'BOA!';
  if (v > 1) return 'GANHOU!';
  return null;
}

/** Faixa de ganho grande, por vezes a aposta. */
function faixaDeGanho(premio: number, aposta: number): string | null {
  const v = premio / aposta;
  if (v >= 50) return 'CHUVA DE OURO!';
  if (v >= 25) return 'MEGA GANHO!';
  if (v >= 10) return 'GRANDE GANHO!';
  return null;
}

/** Grade de enfeite antes do primeiro giro (sorteada no aparelho, só para a tela não começar vazia). */
function gradeDeEnfeite(): CelulaChuva[][] {
  let x = 20_261_114;
  return jogarChuva(100, { int: (n) => { x = (x * 48271) % 2147483647; return x % n; } }).rodadas[0]!.passos.at(-1)!.grade;
}

const VARIANTES: Variants = {
  saida: (modo: ModoSaida) =>
    modo === 'estouro'
      ? { scale: [1, 1.5, 0], rotate: [0, -16, 10], opacity: [1, 1, 0], transition: { duration: 0.2, times: [0, 0.4, 1] } }
      : { y: '620%', rotate: 22, opacity: 0, transition: { duration: 0.26, ease: [0.55, 0, 1, 0.45] } },
};

function Grade({ grade, estourando, ativa, modo, rapido }: {
  grade: CelulaChuva[][];
  estourando: Set<number>;
  /** ovo de ouro acendendo agora */
  ativa: number | null;
  modo: ModoSaida;
  rapido: boolean;
}) {
  // na cascata os novos entram quase juntos; na grade nova, coluna por coluna
  const passoColuna = modo === 'estouro' ? 0.012 : 0.032;
  const passoLinha = modo === 'estouro' ? 0.012 : 0.022;
  return (
    <div className="chuva-grade" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${linhas}, minmax(0, 1fr))` }}>
      <AnimatePresence mode="popLayout" initial={false} custom={modo}>
        {grade.flatMap((col, ci) =>
          col.map((cel, li) => {
            const atraso = rapido ? 0 : ci * passoColuna + (linhas - 1 - li) * passoLinha;
            return (
              <motion.div
                key={cel.i}
                data-cel={cel.i}
                layout={!rapido}
                custom={modo}
                variants={VARIANTES}
                className="chuva-celula"
                data-simbolo={cel.s}
                data-estoura={estourando.has(cel.i) ? '' : undefined}
                data-ativa={ativa === cel.i ? '' : undefined}
                style={{ gridColumn: ci + 1, gridRow: li + 1 }}
                // cai de cima da grade (fora da vista), as de baixo primeiro, e quica ao pousar
                initial={rapido ? false : { y: `-${(li + 1) * 118 + 60}%`, opacity: 1, rotate: (ci % 2 ? 1 : -1) * 10, scaleY: 1.15 }}
                animate={{ y: 0, opacity: 1, rotate: 0, scale: 1, scaleY: 1 }}
                exit={rapido ? { opacity: 0, transition: { duration: 0 } } : 'saida'}
                transition={{
                  y: { type: 'spring', stiffness: 620, damping: 23, mass: 0.8, delay: atraso },
                  rotate: { type: 'spring', stiffness: 500, damping: 16, delay: atraso },
                  scaleY: { type: 'spring', stiffness: 700, damping: 14, delay: atraso + 0.1 },
                  layout: { type: 'spring', stiffness: 760, damping: 26, mass: 0.8 },
                }}
              >
                <SimboloChuva s={cel.s} x={cel.x} />
              </motion.div>
            );
          }),
        )}
      </AnimatePresence>
    </div>
  );
}

function TabelaChuva({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  return (
    <Modal aberto={aberta} aoFechar={aoFechar} titulo="Como funciona">
      <div className="chuva-tabela-texto">
        <p>
          Junte <b>{CONFIG_CHUVA.minimoIguais} ou mais</b> símbolos iguais em qualquer lugar da grade. Eles estouram, os de cima caem e novos entram: a
          cascata continua enquanto houver prêmio.
        </p>
        <table className="manual-tabela">
          <thead>
            <tr>
              <th>Símbolo</th>
              <th>8–9</th>
              <th>10–11</th>
              <th>12+</th>
            </tr>
          </thead>
          <tbody>
            {[...PAGANTES_CHUVA].reverse().map((s) => (
              <tr key={s}>
                <td>
                  <span className="chuva-tabela-simbolo">
                    <SimboloChuva s={s} />
                    {NOME_SIMBOLO_CHUVA[s]}
                  </span>
                </td>
                {CONFIG_CHUVA.pagamentos[s].map((p, k) => (
                  <td key={k}>{vezes(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="chuva-tabela-nota">Os valores são em vezes a aposta, na primeira cascata.</p>
        <ul>
          <li>
            <b>Cascata:</b> cada cascata seguida vale mais. A 2ª paga em dobro (×2), a 3ª em triplo (×3) e assim por diante, até ×
            {CONFIG_CHUVA.cascataMultMax}.
          </li>
          <li>
            <b>Ovo de ouro:</b> traz um multiplicador de ×{CONFIG_CHUVA.bombas.valores[0]} a ×{CONFIG_CHUVA.bombas.valores.at(-1)}. No fim da cascata, se houve
            prêmio, a soma dos ovos de ouro na grade multiplica o ganho.
          </li>
          <li>
            <b>Ninho de ouro:</b> {CONFIG_CHUVA.rodadasGratis.ninhos} ou mais dão {CONFIG_CHUVA.rodadasGratis.rodadas} rodadas grátis (e pagam{' '}
            {CONFIG_CHUVA.pagamentoNinhos.map(vezes).join(', ')} com 4, 5 ou 6+). Nas rodadas grátis, {CONFIG_CHUVA.rodadasGratis.ninhosExtra} ninhos dão mais{' '}
            {CONFIG_CHUVA.rodadasGratis.extras} rodadas, e os ovos de ouro aparecem mais.
          </li>
          <li>Uma jogada paga no máximo {CONFIG_CHUVA.tetoVezes.toLocaleString('pt-BR')}× a aposta.</li>
          <li>
            <b>A casa leva vantagem:</b> de cada 100 moedas apostadas, voltam em média {CONFIG_CHUVA.retornoPct}. Cerca de 1 em cada{' '}
            {Math.round(100 / CONFIG_CHUVA.acertoPct)} giros paga alguma coisa, e as rodadas grátis saem a cada ~{CONFIG_CHUVA.gratisACada} giros.
          </li>
          <li>Tudo é sorteado no servidor antes da animação. Só moedas do jogo: nada se compra nem se saca.</li>
        </ul>
      </div>
    </Modal>
  );
}

const PLACAR_ZERO: Placar = { ganhoX100: 0, gratis: null, aviso: null, multiplicador: null, cascata: 0 };
let seqFx = 1;

export function TelaChuva() {
  const { data: estado } = useEstado();
  const liberada = estado?.player.roletaLiberada ?? false;
  const girarM = useGirarChuva();
  const qc = useQueryClient();
  const reduzir = useReduzirMovimento();
  const enfeite = useMemo(gradeDeEnfeite, []);
  const [aposta, setAposta] = useState(200);
  const [fase, setFase] = useState<Fase>('pronto');
  const [grade, setGrade] = useState<CelulaChuva[][]>(enfeite);
  const [modo, setModo] = useState<ModoSaida>('troca');
  const [estourando, setEstourando] = useState<Set<number>>(new Set());
  const [ativa, setAtiva] = useState<number | null>(null);
  const [efeitos, setEfeitos] = useState<EfeitoEstouro[]>([]);
  const [rotulos, setRotulos] = useState<RotuloGanho[]>([]);
  const [moedasFx, setMoedasFx] = useState<MoedaFx[]>([]);
  const [faixa, setFaixa] = useState<Faixa | null>(null);
  const [elogio, setElogio] = useState<{ id: number; texto: string } | null>(null);
  const [tremor, setTremor] = useState(0);
  const [clarao, setClarao] = useState(0);
  const [placar, setPlacar] = useState<Placar>(PLACAR_ZERO);
  /** resultado da última jogada, para a linha de resumo embaixo da grade */
  const [resumo, setResumo] = useState<{ texto: string; tom: 'ganho' | 'parte' | 'nada' } | null>(null);
  const [tabela, setTabela] = useState(false);
  const viva = useRef(true);
  const [palco, animarPalco] = useAnimate<HTMLDivElement>();
  const letreiro = useRef<HTMLDivElement>(null);
  useEffect(() => {
    viva.current = true;
    return () => {
      viva.current = false;
    };
  }, []);
  // tremor do palco (estouro grande, ovos de ouro, ganho grande) sem remontar a grade
  useEffect(() => {
    if (!tremor || reduzir || !palco.current) return;
    void animarPalco(palco.current, { x: [0, -9, 8, -5, 3, 0], y: [0, 5, -4, 2, 0, 0], scale: [1, 1.025, 1] }, { duration: 0.34 });
  }, [tremor, reduzir, palco, animarPalco]);

  if (!estado) return null;
  const saldo = estado.player.moedasX100;
  const valida = aposta >= apostaMinX100 && aposta <= Math.min(apostaMaxX100, saldo);
  const ajustar = (delta: number) => setAposta((a) => Math.min(apostaMaxX100, Math.max(apostaMinX100, a + delta)));

  /** Centro (no palco) de cada casa, medido antes de ela sair. */
  const medir = (ids: number[]) => {
    const base = palco.current?.getBoundingClientRect();
    if (!base) return [];
    return ids.flatMap((id) => {
      const el = palco.current?.querySelector<HTMLElement>(`[data-cel="${id}"]`);
      if (!el) return [];
      const r = el.getBoundingClientRect();
      return [{ id, x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2, tam: r.width }];
    });
  };

  /** Estouro de um passo: efeitos em cada casa premiada, o "+N" de cada grupo e as moedas indo para o placar. */
  const estourar = (p: PassoChuva, cascata: number) => {
    const porId = new Map(p.grade.flat().map((c) => [c.i, c]));
    const pontos = medir(p.estouram);
    const base = palco.current?.getBoundingClientRect();
    const alvo = letreiro.current?.getBoundingClientRect();
    const novos: EfeitoEstouro[] = pontos.map((pt) => ({ id: seqFx++, s: porId.get(pt.id)!.s, x: pt.x, y: pt.y, tam: pt.tam }));
    const rot: RotuloGanho[] = [];
    const voam: MoedaFx[] = [];
    for (const g of p.ganhos) {
      const dele = pontos.filter((pt) => porId.get(pt.id)?.s === g.s);
      const x = dele.reduce((s, pt) => s + pt.x, 0) / Math.max(1, dele.length);
      const y = dele.reduce((s, pt) => s + pt.y, 0) / Math.max(1, dele.length);
      rot.push({ id: seqFx++, x, y, texto: `+${moedas(g.pagoX100)}`, grande: g.pagoX100 >= aposta * 2 });
      if (base && alvo) {
        // algumas casas do grupo soltam uma moeda que voa até o número do placar
        dele.slice(0, 6).forEach((pt, i) => {
          voam.push({ id: seqFx++, x: pt.x, y: pt.y, dx: alvo.left - base.left + 34 - pt.x, dy: alvo.top - base.top + alvo.height / 2 - pt.y, atrasoMs: 60 + i * 35 });
        });
      }
    }
    setEfeitos((e) => [...e, ...novos].slice(-90));
    setRotulos((r) => [...r, ...rot].slice(-12));
    setMoedasFx((m) => [...m, ...voam].slice(-40));
    const ids = new Set([...novos, ...rot, ...voam].map((n) => n.id));
    setTimeout(() => {
      setEfeitos((e) => e.filter((x) => !ids.has(x.id)));
      setRotulos((r) => r.filter((x) => !ids.has(x.id)));
      setMoedasFx((m) => m.filter((x) => !ids.has(x.id)));
    }, 1000);
    som.sobe(cascata);
    p.estouram.slice(0, 5).forEach((_, i) => setTimeout(() => som.estouro(cascata * 2 + (i % 3)), i * 28));
    vibracao.coleta();
  };

  const mostrarFaixa = async (titulo: string, sub: string | undefined, ms: number) => {
    const id = seqFx++;
    setFaixa({ id, titulo, sub });
    await esperar(ms);
    setFaixa((f) => (f?.id === id ? null : f));
  };

  /** Encena uma rodada; devolve false se a tela fechou no meio. */
  const encenarRodada = async (r: RodadaChuva, base: number): Promise<boolean> => {
    let acumulado = base;
    setModo('troca');
    setEstourando(new Set());
    setGrade(r.passos[0]!.grade);
    for (let c = 0; c < colunas; c++) setTimeout(() => som.tique(), 170 + c * 45);
    setTimeout(() => som.queda(), 330);
    // cada ninho de ouro que pousa toca um sininho (mais agudo a cada um)
    const ninhosNaQueda = r.passos[0]!.grade.flat().filter((c) => c.s === 'ninho').length;
    for (let n = 0; n < Math.min(ninhosNaQueda, 6); n++) setTimeout(() => som.sobe(2 + n), 380 + n * 70);
    await esperar(T.queda);
    for (let k = 0; k < r.passos.length; k++) {
      if (!viva.current) return false;
      const p = r.passos[k]!;
      if (!p.ganhos.length) break;
      // 1) os premiados tremem e brilham
      setEstourando(new Set(p.estouram));
      setPlacar((pl) => ({ ...pl, aviso: p.ganhos.map((g) => `${g.n}× ${NOME_SIMBOLO_CHUVA[g.s]}`).join(' · ') }));
      await esperar(T.treme);
      if (!viva.current) return false;
      // 2) estouram e os de cima despencam
      estourar(p, k);
      acumulado += p.ganhos.reduce((s, g) => s + g.pagoX100, 0);
      setModo('estouro');
      setEstourando(new Set());
      setGrade(r.passos[k + 1]!.grade);
      setPlacar((pl) => ({ ...pl, ganhoX100: acumulado, cascata: k + 1 }));
      if (p.estouram.length >= 11 || k >= 2) {
        setTremor((t) => t + 1);
        setClarao((c) => c + 1);
      }
      await esperar(T.cascata);
    }
    const final = r.passos.at(-1)!.grade.flat();
    if (r.multiplicador > 1) {
      // 3) ovos de ouro acendem um a um e o multiplicador estoura no meio
      const bombas = final.filter((c) => c.s === 'bomba');
      for (let k = 0; k < bombas.length; k++) {
        if (!viva.current) return false;
        setAtiva(bombas[k]!.i);
        som.sobe(3 + k);
        setPlacar((pl) => ({ ...pl, multiplicador: bombas.slice(0, k + 1).reduce((s, c) => s + (c.x ?? 0), 0) }));
        await esperar(T.bomba);
      }
      setAtiva(null);
      som.jackpot();
      vibracao.jackpot();
      setTremor((t) => t + 1);
      setClarao((c) => c + 1);
      acumulado = base + r.ganhoSimbolosX100 * r.multiplicador;
      setPlacar((pl) => ({ ...pl, aviso: `Ovos de ouro: ×${r.multiplicador}!`, ganhoX100: acumulado }));
      await esperar(T.multiplicador);
      setPlacar((pl) => ({ ...pl, multiplicador: null }));
    }
    setPlacar((pl) => ({ ...pl, cascata: 0 }));
    if (r.ganhoNinhosX100 > 0) {
      acumulado += r.ganhoNinhosX100;
      setPlacar((pl) => ({ ...pl, ganhoX100: acumulado }));
    }
    if (r.rodadasGanhas > 0) {
      som.vitoria('lendario');
      vibracao.jackpot();
      setClarao((c) => c + 1);
      await mostrarFaixa(r.gratis ? `+${r.rodadasGanhas} RODADAS!` : `${r.rodadasGanhas} RODADAS GRÁTIS!`, `${r.ninhos} ninhos de ouro`, T.gratis);
    }
    return true;
  };

  const encenar = async (res: ResultadoChuva, saldoFinalX100: number) => {
    setFase('jogando');
    setResumo(null);
    setPlacar(PLACAR_ZERO);
    const totalGratis = res.rodadas.length - 1;
    let base = 0;
    let completo = !reduzir;
    for (let k = 0; completo && k < res.rodadas.length; k++) {
      const r = res.rodadas[k]!;
      if (r.gratis) setPlacar((pl) => ({ ...pl, gratis: { atual: k, total: totalGratis }, aviso: null }));
      completo = await encenarRodada(r, base);
      base += r.ganhoX100;
    }
    if (!viva.current) return concluirChuva(qc, saldoFinalX100);
    if (reduzir) {
      // animação reduzida: direto ao quadro final
      setModo('troca');
      setGrade(res.rodadas.at(-1)!.passos.at(-1)!.grade);
    }
    setEstourando(new Set());
    setAtiva(null);
    setPlacar({ ...PLACAR_ZERO, ganhoX100: res.premioX100, gratis: totalGratis ? { atual: totalGratis, total: totalGratis } : null });
    const lucro = res.premioX100 - res.apostaX100;
    setResumo(
      lucro > 0
        ? { texto: `Ganhou ${moedas(res.premioX100)}${res.bateuTeto ? ' (prêmio máximo)' : ''}!`, tom: 'ganho' }
        : res.premioX100 > 0
          ? { texto: `Voltou ${moedas(res.premioX100)} de ${moedas(res.apostaX100)}`, tom: 'parte' }
          : { texto: 'Não foi dessa vez', tom: 'nada' },
    );
    const titulo = faixaDeGanho(res.premioX100, res.apostaX100);
    if (titulo && !reduzir) {
      som.premio(2);
      vibracao.jackpot();
      setTremor((t) => t + 1);
      setClarao((c) => c + 1);
      void mostrarFaixa(titulo, `+${moedas(res.premioX100)} moedas`, T.faixa);
    } else if (lucro > 0) {
      som.premio(res.premioX100 >= res.apostaX100 * 3 ? 1 : 0);
      const texto = elogioDeGanho(res.premioX100, res.apostaX100);
      if (texto && !reduzir) {
        const id = seqFx++;
        setElogio({ id, texto });
        setClarao((c) => c + 1);
        setTimeout(() => setElogio((e) => (e?.id === id ? null : e)), 900);
      }
    }
    // as moedas do prêmio voam do placar para o saldo
    const r = letreiro.current?.getBoundingClientRect();
    if (res.premioX100 > 0 && r && !reduzir) {
      useUi.getState().lancarRajada({ tipo: 'fonte-moedas', x: r.left + r.width / 2, y: r.top + r.height / 2 });
      useUi.getState().lancarChuvaMoedas(r, Math.round(Math.min(18, Math.max(8, Math.log2(Math.max(1, res.premioX100 / 100)) * 3))), res.premioX100);
      som.moedas();
    }
    concluirChuva(qc, saldoFinalX100);
    setFase('fim');
  };

  const girar = async () => {
    if (girarM.isPending || fase === 'jogando') return;
    if (!valida) {
      som.erro();
      toast(saldo < apostaMinX100 ? 'Você não tem moedas para apostar. Venda ovos primeiro.' : `Aposte entre ${valor(apostaMinX100)} e ${valor(Math.min(apostaMaxX100, saldo))} moedas.`, 'erro');
      return;
    }
    try {
      som.girar();
      vibracao.coleta();
      // limpa a jogada anterior já no toque
      setFase('jogando');
      setResumo(null);
      setElogio(null);
      setPlacar(PLACAR_ZERO);
      const r = await girarM.mutateAsync(aposta);
      await encenar(r.data.resultado, r.data.saldoX100);
    } catch (erro) {
      setFase('pronto');
      som.erro();
      toast(mensagemDeErro(erro), 'erro');
    }
  };

  const cabeca = (
    <div className="tela-cabeca">
      <Link href="/loja" className="botao botao-icone botao-secundario tela-cabeca-voltar" aria-label="Voltar à Loja">
        <ChevronLeft strokeWidth={3} />
      </Link>
      <h1 className="titulo-tela">Chuva de Ovos</h1>
      <div className="tela-cabeca-acao">
        <button type="button" className="botao botao-p" onClick={() => setTabela(true)} aria-label="Como funciona">
          <Info className="h-4 w-4" aria-hidden /> Prêmios
        </button>
      </div>
    </div>
  );

  if (!liberada) {
    return (
      <div className="tela chuva-tela">
        {cabeca}
        <section className="painel rinha-trancada">
          <Lock className="rinha-trancada-icone" strokeWidth={3} aria-hidden />
          <h2 className="rinha-trancada-titulo">A Chuva de Ovos ainda está fechada</h2>
          <p>Ela abre depois que você libera a roleta com as moedas da sua codorna.</p>
          <Link href="/roleta" className="botao botao-primario mt-3">
            Ir à roleta
          </Link>
        </section>
        <TabelaChuva aberta={tabela} aoFechar={() => setTabela(false)} />
      </div>
    );
  }

  const jogando = fase === 'jogando';
  return (
    <div className="tela chuva-tela">
      {cabeca}
      <div
        className="chuva-maquina"
        data-gratis={placar.gratis ? '' : undefined}
        data-jogando={jogando ? '' : undefined}
        data-quente={placar.cascata > 0 || placar.multiplicador ? '' : undefined}
      >
        <div className="chuva-luzes" aria-hidden>
          {Array.from({ length: 14 }, (_, k) => (
            <i key={k} style={{ animationDelay: `${k * -0.1}s` }} />
          ))}
        </div>
        <div className="chuva-letreiro" ref={letreiro} aria-live="polite">
          <span className="chuva-letreiro-rotulo">GANHO</span>
          <motion.span
            key={placar.ganhoX100}
            className="chuva-letreiro-ganho"
            initial={placar.ganhoX100 > 0 && !reduzir ? { scale: 1.35 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 12 }}
          >
            <Moeda className="h-7 w-7" />
            <NumeroAnimado valor={placar.ganhoX100} formatar={moedas} duracao={0.35} />
          </motion.span>
          {placar.gratis && (
            <span className="chuva-letreiro-gratis">
              Grátis {placar.gratis.atual}/{placar.gratis.total}
            </span>
          )}
        </div>
        <div ref={palco} className="chuva-palco">
          <span className="chuva-raios" aria-hidden />
          <Grade grade={grade} estourando={estourando} ativa={ativa} modo={modo} rapido={reduzir} />
          <CamadaEstouros efeitos={efeitos} rotulos={rotulos} moedas={moedasFx} />
          {clarao > 0 && !reduzir && <span key={clarao} className="chuva-clarao" aria-hidden />}
          <AnimatePresence>
            {placar.cascata >= 2 && (
              <motion.span
                key={`cascata-${placar.cascata}`}
                className="chuva-combo texto-contorno"
                data-nivel={Math.min(placar.cascata, 5)}
                initial={{ scale: 0.2, rotate: -24, opacity: 0 }}
                animate={{ scale: 1, rotate: -8, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0, transition: { duration: 0.12 } }}
                transition={{ type: 'spring', stiffness: 700, damping: 14 }}
              >
                CASCATA ×{Math.min(placar.cascata, CONFIG_CHUVA.cascataMultMax)}
              </motion.span>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {elogio && (
              <motion.span
                key={elogio.id}
                className="chuva-elogio texto-contorno"
                initial={{ scale: 0.2, rotate: -14, opacity: 0 }}
                animate={{ scale: [1.4, 1], rotate: [-6, 0], opacity: 1 }}
                exit={{ scale: 1.6, opacity: 0, transition: { duration: 0.18 } }}
                transition={{ duration: 0.26, ease: [0.34, 1.56, 0.64, 1] }}
              >
                {elogio.texto}
              </motion.span>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {placar.multiplicador && (
              <motion.span
                key={`mult-${placar.multiplicador}`}
                className="chuva-mult-grande texto-contorno"
                initial={{ scale: 0.3, opacity: 0, rotate: -14 }}
                animate={{ scale: [1.5, 1], opacity: 1, rotate: 0 }}
                exit={{ scale: 2.2, opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.2 }}
              >
                ×{placar.multiplicador}
              </motion.span>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {faixa && (
              <motion.div key={faixa.id} className="chuva-faixa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <span className="chuva-faixa-raios" aria-hidden />
                <span className="chuva-faixa-confete" aria-hidden>
                  {Array.from({ length: 16 }, (_, k) => (
                    <i key={k} />
                  ))}
                </span>
                <motion.span
                  className="chuva-faixa-titulo texto-contorno"
                  initial={{ scale: 0.2, rotate: -12 }}
                  animate={{ scale: [1.35, 1], rotate: [-5, 0] }}
                  transition={{ duration: 0.36, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  {faixa.titulo}
                </motion.span>
                {faixa.sub && <span className="chuva-faixa-sub texto-contorno-fino numeros">{faixa.sub}</span>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p className="chuva-aviso" data-tom={resumo?.tom} aria-live="polite">
          {resumo?.texto ?? placar.aviso ?? (fase === 'pronto' ? 'Junte 8 ou mais iguais em qualquer lugar.' : ' ')}
        </p>
      </div>

      <div className="chuva-controles" data-travado={jogando ? '' : undefined}>
        <div className="chuva-aposta">
          <button type="button" className="botao botao-secundario botao-icone" onClick={() => ajustar(-100)} aria-label="Menos 1 moeda" disabled={jogando || aposta <= apostaMinX100}>
            <Minus />
          </button>
          <span className="chuva-aposta-valor numeros" aria-live="polite" aria-label={`Aposta: ${valor(aposta)} moedas`}>
            <small>Aposta</small>
            <span>
              <Moeda className="h-6 w-6" />
              {valor(aposta)}
            </span>
          </span>
          <button type="button" className="botao botao-secundario botao-icone" onClick={() => ajustar(100)} aria-label="Mais 1 moeda" disabled={jogando || aposta >= apostaMaxX100}>
            <Plus />
          </button>
        </div>
        <div className="rinha-fichas">
          {FICHAS.map((f) => (
            <button key={f} type="button" className="rinha-ficha numeros" aria-pressed={aposta === f} onClick={() => setAposta(f)} disabled={jogando || f > saldo}>
              {valor(f)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="botao botao-compra botao-g botao-brilho chuva-girar w-full"
          onClick={() => void girar()}
          aria-disabled={!valida || undefined}
          disabled={jogando || girarM.isPending}
        >
          {jogando ? 'Girando…' : fase === 'fim' ? 'Girar de novo' : 'Girar'}
          <span className="botao-preco">
            <Moeda className="h-[1.2em] w-[1.2em]" />
            {valor(aposta)}
          </span>
        </button>
      </div>

      <p className="rinha-aviso">
        A casa leva vantagem: de cada 100 moedas apostadas, voltam em média {CONFIG_CHUVA.retornoPct}. Prêmio máximo de{' '}
        {CONFIG_CHUVA.tetoVezes.toLocaleString('pt-BR')}× a aposta ({formatarMoedas(aposta * CONFIG_CHUVA.tetoVezes)} moedas). Tudo aqui é moeda do jogo: não se
        compra nem se saca.
      </p>
      <TabelaChuva aberta={tabela} aoFechar={() => setTabela(false)} />
    </div>
  );
}

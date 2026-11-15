'use client';

// Ovos-Bomba: caça-níquel de 5 × 3 com 20 linhas e moedas do jogo (nada se compra nem se saca).
// Os ovos-bomba param com o rolo, ficam PRESOS na casa e contam regressivamente a cada giro; no zero explodem nas
// casas vizinhas do padrão deles e todas viram o mesmo símbolo. O servidor sorteia o giro inteiro; aqui é só a
// encenação, rápida:
//  - os 5 rolos giram (já enquanto o servidor responde) e param um a um, da esquerda para a direita; as bombas
//    presas ficam paradas por cima do rolo e o número da contagem pula na hora do toque;
//  - no zero o pavio acende, sai o raio do padrão (cima/baixo, lados, cruz ou X), as casas estouram e viram o
//    símbolo sorteado; bomba vizinha atingida detona logo em seguida (reação em cadeia), com tremor e clarão;
//  - as linhas premiadas acendem por cima da grade, o placar conta e as moedas voam para o saldo.
// Cada valor de aposta tem o próprio tabuleiro de bombas. O retorno médio aparece antes da aposta.
import {
  ALCANCE_BOMBA, CONFIG_BOMBAS, LINHAS_BOMBAS, NOME_BOMBA, NOME_SIMBOLO_CHUVA, PAGANTES_CHUVA, TIPOS_BOMBA, casasDaExplosao,
  girarBombas, ESTADO_BOMBAS_VAZIO,
  type BombaPresa, type ExplosaoBombas, type LinhaPremiada, type PaganteChuva, type ResultadoBombas, type TipoBomba,
} from '@galinheiro/game-core';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Info, Lock } from 'lucide-react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Moeda } from '../arte/Icones';
import { OvoBomba } from '../bombas/OvoBomba';
import { CamadaEstouros, type EfeitoEstouro } from '../chuva/Estouros';
import { SimboloChuva } from '../chuva/SimboloChuva';
import { Modal } from '../componentes/Modal';
import { NumeroAnimado } from '../componentes/NumeroAnimado';
import { concluirChuva, useEstado, useGirarBombas, useTabuleirosBombas } from '../estado';
import { useReduzirMovimento } from '../Provedores';
import { som } from '../som';
import { toast, useUi } from '../ui';
import { mensagemDeErro, moedas } from '../util';
import { vibracao } from '../vibracao';

const { colunas, linhas, apostasX100 } = CONFIG_BOMBAS;
const valor = (x100: number) => moedas(x100).replace(/,00$/, '');
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Pagamento de uma linha em vezes a aposta total (a tabela é em vezes a aposta da linha). */
const vezes = (mult: number) => `${(mult / LINHAS_BOMBAS.length).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}×`;
const CORES_LINHA = ['#ffe066', '#7cc4ff', '#ff7ab0', '#8fe060', '#ffb03a', '#c9a0ff'];

/** Ritmo da encenação (ms). */
const T = { giroMin: 360, parada: 90, assenta: 150, pavio: 170, explosao: 260, linhas: 520 };
const TODOS_PARADOS: boolean[] = Array.from({ length: colunas }, () => false);
const TODOS_GIRANDO: boolean[] = Array.from({ length: colunas }, () => true);

type Fase = 'pronto' | 'jogando' | 'fim';
/** Casa da grade na tela: `v` muda quando o símbolo é trocado pela explosão (reinicia a animação de revelar). */
interface Casa { s: PaganteChuva; v: number }
interface Raio { id: number; c: number; l: number; tipo: TipoBomba }

function elogioDeGanho(premio: number, aposta: number): string | null {
  const v = premio / aposta;
  if (v >= 25) return 'MEGA GANHO!';
  if (v >= 10) return 'GRANDE GANHO!';
  if (v >= 5) return 'ÓTIMO!';
  if (v >= 2) return 'BOA!';
  if (v > 1) return 'GANHOU!';
  return null;
}

/** Grade de enfeite antes do primeiro giro (sorteada no aparelho, só para a tela não começar vazia). */
function gradeDeEnfeite(): Casa[][] {
  let x = 20_261_115;
  const r = girarBombas(100, ESTADO_BOMBAS_VAZIO, { int: (n) => { x = (x * 48271) % 2147483647; return x % n; } });
  return r.grade.map((col) => col.map((s) => ({ s, v: 0 })));
}

/** Fita de enfeite de cada rolo enquanto gira: 9 símbolos e os 3 primeiros repetidos no fim (o laço não tem emenda). */
function fitasDeEnfeite(): PaganteChuva[][] {
  let x = 7_654_321;
  const prox = (n: number) => {
    x = (x * 48271) % 2147483647;
    return x % n;
  };
  return Array.from({ length: colunas }, () => {
    const base = Array.from({ length: linhas * 3 }, () => PAGANTES_CHUVA[prox(PAGANTES_CHUVA.length)]!);
    return [...base, ...base.slice(0, linhas)];
  });
}

/** Mini-grade 5 × 3 com as casas atingidas por um tipo de bomba no centro (ajuda da tabela). */
function MiniPadrao({ tipo }: { tipo: TipoBomba }) {
  const atingidas = new Set(casasDaExplosao({ c: 2, l: 1, tipo }).map(([c, l]) => `${c},${l}`));
  return (
    <span className="bombas-mini" aria-hidden>
      {Array.from({ length: linhas }, (_, l) =>
        Array.from({ length: colunas }, (_, c) => <i key={`${c},${l}`} data-on={atingidas.has(`${c},${l}`) ? '' : undefined} data-centro={c === 2 && l === 1 ? '' : undefined} />),
      )}
    </span>
  );
}

function TabelaBombas({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  return (
    <Modal aberto={aberta} aoFechar={aoFechar} titulo="Como funciona">
      <div className="chuva-tabela-texto">
        <p>
          São <b>{LINHAS_BOMBAS.length} linhas</b> numa grade de {colunas} × {linhas}. Paga com <b>3, 4 ou 5 símbolos iguais</b> seguidos numa linha, a partir da
          esquerda.
        </p>
        <h3 className="bombas-tabela-titulo">Ovos-bomba</h3>
        <ul>
          <li>
            O ovo-bomba para junto com o rolo, fica <b>preso</b> na casa e conta um número a menos a cada giro, enquanto os outros símbolos continuam
            girando.
          </li>
          <li>
            Quando chega a zero, <b>explode</b> nas casas vizinhas do padrão dele: a casa da bomba e as atingidas viram o <b>mesmo símbolo</b>, sorteado
            na hora.
          </li>
          <li>Bomba presa atingida por outra explosão detona junto (reação em cadeia), mesmo que a contagem dela ainda esteja alta.</li>
          <li>Enquanto está presa, a bomba ocupa a casa e interrompe as linhas que passam por ela.</li>
        </ul>
        <div className="bombas-tipos">
          {TIPOS_BOMBA.map((t) => (
            <div key={t} className="bombas-tipo">
              <OvoBomba tipo={t} className="bombas-tipo-ovo" />
              <MiniPadrao tipo={t} />
              <span>
                <b>{NOME_BOMBA[t]}</b>: {ALCANCE_BOMBA[t]}
              </span>
            </div>
          ))}
        </div>
        <h3 className="bombas-tabela-titulo">Prêmios por linha</h3>
        <table className="manual-tabela">
          <thead>
            <tr>
              <th>Símbolo</th>
              <th>3</th>
              <th>4</th>
              <th>5</th>
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
                {CONFIG_BOMBAS.pagamentos[s].map((p, k) => (
                  <td key={k}>{vezes(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="chuva-tabela-nota">Os valores são em vezes a aposta, por linha premiada. Várias linhas podem pagar no mesmo giro.</p>
        <ul>
          <li>
            <b>Cada aposta tem o seu tabuleiro:</b> as bombas presas com a aposta de 2 moedas ficam esperando lá se você trocar para outra aposta.
          </li>
          <li>O prêmio máximo é a tela toda de ovo de avestruz: {CONFIG_BOMBAS.premioMaxVezes.toLocaleString('pt-BR')}× a aposta.</li>
          <li>
            <b>A casa leva vantagem:</b> de cada 100 moedas apostadas, voltam em média {CONFIG_BOMBAS.retornoPct}. Cerca de {CONFIG_BOMBAS.acertoPct}% dos giros
            pagam alguma coisa, e sai uma explosão a cada ~{CONFIG_BOMBAS.explosaoACada} giros.
          </li>
          <li>Tudo é sorteado no servidor antes da animação. Só moedas do jogo: nada se compra nem se saca.</li>
        </ul>
      </div>
    </Modal>
  );
}

let seqFx = 1;

export function TelaBombas() {
  const { data: estado } = useEstado();
  const liberada = estado?.player.roletaLiberada ?? false;
  const tabuleiros = useTabuleirosBombas(liberada);
  const girarM = useGirarBombas();
  const qc = useQueryClient();
  const reduzir = useReduzirMovimento();
  const enfeite = useMemo(gradeDeEnfeite, []);
  const fitas = useMemo(fitasDeEnfeite, []);
  const [rolando, setRolando] = useState<boolean[]>(TODOS_PARADOS);
  const tiques = useRef<ReturnType<typeof setInterval> | null>(null);
  const [aposta, setAposta] = useState(200);
  const [fase, setFase] = useState<Fase>('pronto');
  const [giro, setGiro] = useState(0);
  const [grade, setGrade] = useState<Casa[][]>(enfeite);
  const [bombas, setBombas] = useState<BombaPresa[]>([]);
  const [novas, setNovas] = useState<Set<number>>(new Set());
  const [detonando, setDetonando] = useState<number | null>(null);
  const [raios, setRaios] = useState<Raio[]>([]);
  const [efeitos, setEfeitos] = useState<EfeitoEstouro[]>([]);
  const [linhasVista, setLinhasVista] = useState<LinhaPremiada[]>([]);
  const [ganho, setGanho] = useState(0);
  const [clarao, setClarao] = useState(0);
  const [tremor, setTremor] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resumo, setResumo] = useState<{ texto: string; tom: 'ganho' | 'parte' | 'nada' } | null>(null);
  const [elogio, setElogio] = useState<{ id: number; texto: string } | null>(null);
  const [tabela, setTabela] = useState(false);
  const viva = useRef(true);
  const [palco, animarPalco] = useAnimate<HTMLDivElement>();
  const letreiro = useRef<HTMLDivElement>(null);
  const pararTiques = () => {
    if (tiques.current) clearInterval(tiques.current);
    tiques.current = null;
  };
  useEffect(() => {
    viva.current = true;
    return () => {
      viva.current = false;
      if (tiques.current) clearInterval(tiques.current);
    };
  }, []);
  useEffect(() => {
    if (!tremor || reduzir || !palco.current) return;
    void animarPalco(palco.current, { x: [0, -10, 9, -6, 3, 0], y: [0, 5, -4, 2, 0, 0], scale: [1, 1.03, 1] }, { duration: 0.32 });
  }, [tremor, reduzir, palco, animarPalco]);
  // parado: a tela mostra as bombas presas no tabuleiro da aposta escolhida
  const doServidor = tabuleiros.data?.tabuleiros[String(aposta)];
  useEffect(() => {
    if (fase !== 'jogando' && doServidor) {
      setBombas(doServidor);
      setNovas(new Set());
    }
  }, [doServidor, fase]);

  if (!estado) return null;
  const saldo = estado.player.moedasX100;
  const jogando = fase === 'jogando';
  const casasPremiadas = new Set(linhasVista.flatMap((x) => LINHAS_BOMBAS[x.linha]!.slice(0, x.n).map((l, c) => `${c},${l}`)));

  /** Efeito de estouro no centro de cada casa atingida (medido no palco). */
  const estourarCasas = (casas: [number, number][], antes: Casa[][]) => {
    const base = palco.current?.getBoundingClientRect();
    if (!base) return;
    const novos: EfeitoEstouro[] = [];
    for (const [c, l] of casas) {
      const el = palco.current?.querySelector<HTMLElement>(`[data-casa="${c},${l}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      novos.push({ id: seqFx++, s: antes[c]![l]!.s, x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2, tam: r.width });
    }
    setEfeitos((e) => [...e, ...novos].slice(-60));
    const ids = new Set(novos.map((n) => n.id));
    setTimeout(() => setEfeitos((e) => e.filter((x) => !ids.has(x.id))), 900);
  };

  /** Encena uma explosão sobre a grade `atual` e devolve a grade com as casas atingidas já trocadas. */
  const explodir = async (e: ExplosaoBombas, misterio: PaganteChuva, ordem: number, atual: Casa[][]): Promise<Casa[][]> => {
    setDetonando(e.id);
    setAviso(e.por === null ? 'A contagem zerou!' : 'Reação em cadeia!');
    som.zunido();
    await esperar(T.pavio);
    const b = { c: e.casas[0]![0], l: e.casas[0]![1] }; // a 1ª casa é a da própria bomba
    const idRaio = seqFx++;
    setRaios((r) => [...r, { id: idRaio, c: b.c, l: b.l, tipo: e.tipo }]);
    setTimeout(() => setRaios((r) => r.filter((x) => x.id !== idRaio)), 520);
    estourarCasas(e.casas, atual);
    const atingidas = new Set(e.casas.map(([c, l]) => `${c},${l}`));
    const depois = atual.map((col, c) => col.map((casa, l) => (atingidas.has(`${c},${l}`) ? { s: misterio, v: casa.v + 1 } : casa)));
    setGrade(depois);
    setBombas((bs) => bs.filter((x) => x.id !== e.id));
    setDetonando(null);
    setTremor((t) => t + 1);
    setClarao((c) => c + 1);
    som.golpe(true);
    som.sobe(2 + ordem);
    vibracao.jackpot();
    await esperar(T.explosao);
    return depois;
  };

  const encenar = async (r: ResultadoBombas, saldoFinalX100: number, inicio: number) => {
    const concluir = () => {
      pararTiques();
      setRolando(TODOS_PARADOS);
      concluirChuva(qc, saldoFinalX100);
    };
    setLinhasVista([]);
    setRaios([]);
    setGiro((g) => g + 1);
    let atual: Casa[][] = r.grade.map((col) => col.map((s) => ({ s, v: 0 })));
    setGrade(atual);
    setBombas(r.bombas);
    setNovas(new Set(r.novas));
    if (!reduzir) {
      // os rolos giram pelo menos um instante e param um a um, da esquerda para a direita
      const falta = T.giroMin - (performance.now() - inicio);
      if (falta > 0) await esperar(falta);
      const colunaComNova = new Set(r.bombas.filter((b) => r.novas.includes(b.id)).map((b) => b.c));
      for (let c = 0; c < colunas; c++) {
        if (!viva.current) return concluir();
        setRolando(TODOS_GIRANDO.map((_, i) => i > c));
        som.queda();
        if (colunaComNova.has(c)) {
          som.gongo(); // bomba nova travou neste rolo
          vibracao.coleta();
        }
        if (c === colunas - 1) pararTiques();
        await esperar(c === colunas - 1 ? T.assenta : T.parada);
      }
      for (let k = 0; k < r.explosoes.length; k++) {
        if (!viva.current) return concluir();
        atual = await explodir(r.explosoes[k]!, r.misterio!, k, atual);
      }
    } else {
      setRolando(TODOS_PARADOS);
      if (r.misterio) {
        setGrade(r.final.map((col, c) => col.map((s, l) => ({ s: s ?? r.grade[c]![l]!, v: 0 }))));
        setBombas(r.proximo.bombas);
      }
    }
    if (!viva.current) return concluir();
    setAviso(null);
    if (r.linhas.length) {
      setLinhasVista(r.linhas);
      setGanho(r.premioX100);
      r.linhas.slice(0, 5).forEach((_, i) => setTimeout(() => som.sobe(i), i * 70));
      vibracao.coleta();
      if (!reduzir) await esperar(T.linhas);
    }
    const lucro = r.premioX100 - r.apostaX100;
    setResumo(
      lucro > 0
        ? { texto: `Ganhou ${moedas(r.premioX100)}!`, tom: 'ganho' }
        : r.premioX100 > 0
          ? { texto: `Voltou ${moedas(r.premioX100)} de ${moedas(r.apostaX100)}`, tom: 'parte' }
          : { texto: r.proximo.bombas.length ? 'Não foi dessa vez. As bombas continuam contando…' : 'Não foi dessa vez', tom: 'nada' },
    );
    const texto = elogioDeGanho(r.premioX100, r.apostaX100);
    if (texto && !reduzir) {
      const id = seqFx++;
      setElogio({ id, texto });
      setClarao((c) => c + 1);
      som.premio(r.premioX100 >= r.apostaX100 * 10 ? 2 : r.premioX100 >= r.apostaX100 * 3 ? 1 : 0);
      setTimeout(() => setElogio((e) => (e?.id === id ? null : e)), r.premioX100 >= r.apostaX100 * 10 ? 1500 : 850);
    }
    const rect = letreiro.current?.getBoundingClientRect();
    if (r.premioX100 > 0 && rect && !reduzir) {
      useUi.getState().lancarRajada({ tipo: 'fonte-moedas', x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      useUi.getState().lancarChuvaMoedas(rect, Math.round(Math.min(18, Math.max(8, Math.log2(Math.max(1, r.premioX100 / 100)) * 3))), r.premioX100);
      som.moedas();
    }
    concluir();
    setFase('fim');
  };

  const girar = async () => {
    if (girarM.isPending || jogando) return;
    if (saldo < aposta) {
      som.erro();
      toast(saldo < apostasX100[0]! ? 'Você não tem moedas para apostar. Venda ovos primeiro.' : 'Saldo menor que a aposta. Escolha uma aposta menor.', 'erro');
      return;
    }
    try {
      som.girar();
      vibracao.coleta();
      setFase('jogando');
      setResumo(null);
      setElogio(null);
      setGanho(0);
      setLinhasVista([]);
      setNovas(new Set());
      // as bombas presas contam um giro já no toque (é sempre um a menos) e os rolos giram enquanto o servidor sorteia
      const vaiExplodir = bombas.some((b) => b.contagem <= 1);
      setBombas((bs) => bs.map((b) => ({ ...b, contagem: Math.max(0, b.contagem - 1) })));
      setAviso(vaiExplodir ? 'A contagem zerou…' : null);
      const inicio = performance.now();
      if (!reduzir) {
        setRolando(TODOS_GIRANDO);
        pararTiques();
        tiques.current = setInterval(() => som.tique(), 70);
      }
      const r = await girarM.mutateAsync(aposta);
      await encenar(r.data.resultado, r.data.saldoX100, inicio);
    } catch (erro) {
      pararTiques();
      setRolando(TODOS_PARADOS);
      setAviso(null);
      setFase('pronto');
      som.erro();
      toast(mensagemDeErro(erro), 'erro');
    }
  };

  const trocarAposta = (a: number) => {
    if (jogando || a === aposta) return;
    som.toque();
    setAposta(a);
    setLinhasVista([]);
    setResumo(null);
    setGanho(0);
    setBombas(tabuleiros.data?.tabuleiros[String(a)] ?? []);
    setNovas(new Set());
  };

  const cabeca = (
    <div className="tela-cabeca">
      <Link href="/loja" className="botao botao-icone botao-secundario tela-cabeca-voltar" aria-label="Voltar à Loja">
        <ChevronLeft strokeWidth={3} />
      </Link>
      <h1 className="titulo-tela">Ovos-Bomba</h1>
      <div className="tela-cabeca-acao">
        <button type="button" className="botao botao-p" onClick={() => setTabela(true)} aria-label="Como funciona">
          <Info className="h-4 w-4" aria-hidden /> Regras
        </button>
      </div>
    </div>
  );

  if (!liberada) {
    return (
      <div className="tela bombas-tela">
        {cabeca}
        <section className="painel rinha-trancada">
          <Lock className="rinha-trancada-icone" strokeWidth={3} aria-hidden />
          <h2 className="rinha-trancada-titulo">Os Ovos-Bomba ainda estão fechados</h2>
          <p>Eles abrem depois que você libera a roleta com as moedas da sua codorna.</p>
          <Link href="/roleta" className="botao botao-primario mt-3">
            Ir à roleta
          </Link>
        </section>
        <TabelaBombas aberta={tabela} aoFechar={() => setTabela(false)} />
      </div>
    );
  }

  const porCasa = new Map(bombas.map((b) => [`${b.c},${b.l}`, b]));
  const pct = (parte: number, todo: number) => `${(parte / todo) * 100}%`;
  return (
    <div className="tela bombas-tela">
      {cabeca}
      <div className="chuva-maquina bombas-maquina" data-jogando={jogando ? '' : undefined} data-quente={detonando !== null || raios.length ? '' : undefined}>
        <div className="chuva-luzes" aria-hidden>
          {Array.from({ length: 14 }, (_, k) => (
            <i key={k} style={{ animationDelay: `${k * -0.1}s` }} />
          ))}
        </div>
        <div className="chuva-letreiro" ref={letreiro} aria-live="polite">
          <span className="chuva-letreiro-rotulo">GANHO</span>
          <motion.span
            key={ganho}
            className="chuva-letreiro-ganho"
            initial={ganho > 0 && !reduzir ? { scale: 1.35 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 12 }}
          >
            <Moeda className="h-7 w-7" />
            <NumeroAnimado valor={ganho} formatar={moedas} duracao={0.35} />
          </motion.span>
          {bombas.length > 0 && (
            <span className="chuva-letreiro-gratis">
              {bombas.length} {bombas.length === 1 ? 'bomba presa' : 'bombas presas'}
            </span>
          )}
        </div>
        <div ref={palco} className="chuva-palco bombas-palco">
          <span className="chuva-raios" aria-hidden />
          <div className="bombas-grade" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${linhas}, minmax(0, 1fr))` }}>
            {/* a janela de cada rolo */}
            {rolando.map((_, c) => (
              <span key={`t${c}`} className="bombas-trilho" style={{ gridColumn: c + 1, gridRow: `1 / span ${linhas}` }} aria-hidden />
            ))}
            {grade.flatMap((col, c) =>
              col.map((casa, l) => {
                const presa = porCasa.get(`${c},${l}`);
                // a bomba nova só aparece quando o rolo dela para; as que já estavam presas ficam por cima do rolo girando
                const b = presa && !(novas.has(presa.id) && rolando[c]) ? presa : undefined;
                return (
                  <div
                    key={`${c},${l}`}
                    className="bombas-casa"
                    data-casa={`${c},${l}`}
                    data-presa={b ? '' : undefined}
                    data-premiada={casasPremiadas.has(`${c},${l}`) ? '' : undefined}
                    data-apagada={linhasVista.length > 0 && !casasPremiadas.has(`${c},${l}`) ? '' : undefined}
                    style={{ gridColumn: c + 1, gridRow: l + 1 }}
                  >
                    {b ? (
                      <span key={`b${b.id}`} className="bombas-peca" data-nova={novas.has(b.id) ? '' : undefined} data-detona={detonando === b.id ? '' : undefined}>
                        <OvoBomba tipo={b.tipo} contagem={b.contagem} />
                      </span>
                    ) : rolando[c] ? null : (
                      <span key={`s${giro}-${casa.v}`} className="bombas-peca" data-revelada={casa.v > 0 ? '' : undefined} data-para={casa.v === 0 && giro > 0 ? '' : undefined}>
                        <SimboloChuva s={casa.s} />
                      </span>
                    )}
                  </div>
                );
              }),
            )}
            {/* rolo girando: uma fita de símbolos borrados correndo para baixo até o rolo parar */}
            {rolando.map((gira, c) =>
              gira ? (
                <span key={`r${c}`} className="bombas-rolo" style={{ gridColumn: c + 1, gridRow: `1 / span ${linhas}` }} aria-hidden>
                  <span className="bombas-fita" style={{ animationDelay: `${c * -60}ms` }}>
                    {fitas[c]!.map((s, k) => (
                      <span key={k} className="bombas-fita-casa">
                        <SimboloChuva s={s} />
                      </span>
                    ))}
                  </span>
                </span>
              ) : null,
            )}
            {/* raio da explosão: cobre a casa da bomba e as vizinhas (3 × 3), no padrão dela */}
            {raios.map((r) => (
              <span
                key={r.id}
                className="bombas-raio"
                data-tipo={r.tipo}
                style={{ left: pct(r.c - 1, colunas), top: pct(r.l - 1, linhas), width: pct(3, colunas), height: pct(3, linhas) }}
                aria-hidden
              >
                <i />
                <i />
              </span>
            ))}
          </div>
          <CamadaEstouros efeitos={efeitos} rotulos={[]} moedas={[]} />
          {/* linhas premiadas por cima da grade */}
          {linhasVista.length > 0 && (
            <svg className="bombas-linhas" viewBox={`0 0 ${colunas} ${linhas}`} preserveAspectRatio="none" aria-hidden>
              {linhasVista.map((x, i) => {
                const pontos = LINHAS_BOMBAS[x.linha]!.slice(0, x.n).map((l, c) => `${c + 0.5},${l + 0.5}`).join(' ');
                return (
                  <g key={x.linha}>
                    <polyline points={pontos} fill="none" stroke="#2b1a0f" strokeWidth={0.13} strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points={pontos} fill="none" stroke={CORES_LINHA[i % CORES_LINHA.length]} strokeWidth={0.075} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                );
              })}
            </svg>
          )}
          {clarao > 0 && !reduzir && <span key={clarao} className="chuva-clarao" aria-hidden />}
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
        </div>
        <p className="chuva-aviso" data-tom={resumo?.tom} aria-live="polite">
          {resumo?.texto ??
            aviso ??
            (linhasVista.length
              ? `${linhasVista.length} ${linhasVista.length === 1 ? 'linha premiada' : 'linhas premiadas'}`
              : fase === 'pronto'
                ? bombas.length
                  ? 'Suas bombas estão esperando. Gire para contar!'
                  : '3 iguais numa linha pagam. O ovo-bomba trava, conta e explode no zero.'
                : ' ')}
        </p>
      </div>

      <div className="chuva-controles" data-travado={jogando ? '' : undefined}>
        <p className="bombas-aposta-rotulo">Aposta (cada valor tem o seu tabuleiro de bombas)</p>
        <div className="rinha-fichas">
          {apostasX100.map((f) => {
            const presas = tabuleiros.data?.tabuleiros[String(f)]?.length ?? 0;
            return (
              <button key={f} type="button" className="rinha-ficha bombas-ficha numeros" aria-pressed={aposta === f} onClick={() => trocarAposta(f)} disabled={jogando}>
                {valor(f)}
                {presas > 0 && <span className="bombas-ficha-presas" aria-label={`${presas} bombas presas`}>{presas}</span>}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="botao botao-compra botao-g botao-brilho chuva-girar w-full"
          onClick={() => void girar()}
          aria-disabled={saldo < aposta || undefined}
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
        A casa leva vantagem: de cada 100 moedas apostadas, voltam em média {CONFIG_BOMBAS.retornoPct}. Prêmio máximo de{' '}
        {CONFIG_BOMBAS.premioMaxVezes.toLocaleString('pt-BR')}× a aposta. Tudo aqui é moeda do jogo: não se compra nem se saca.
      </p>
      <TabelaBombas aberta={tabela} aoFechar={() => setTabela(false)} />
    </div>
  );
}

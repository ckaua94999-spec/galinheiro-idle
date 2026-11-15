'use client';

// Rinha de galo (minijogo de aposta com moedas do jogo; nada se compra nem se saca).
// O jogador escolhe um galo (chance, prêmio e retorno médio à vista), a aposta e assiste à luta. O servidor sorteia o
// resultado antes; aqui é só a encenação dos golpes que ele devolveu, em ritmo de jogo de luta (~3 golpes por
// segundo, a luta inteira dura uns 4 s):
//  - gongo, os galos avançam com rastro e poeira; no impacto a arena dá um soco de zoom, sai o corte, o estouro,
//    as penas e o número de dano; crítico = clarão branco, tremor e número gigante;
//  - golpes seguidos do mesmo galo viram "COMBO ×N"; as barras de vida caem na hora e deixam um rastro branco;
//  - o último golpe é o nocaute: clarão, "K.O.!", onda de choque, penas chovendo; se venceu, as moedas voam
//    para o saldo.
// Os controles ficam sempre na tela: acabou, é só lutar de novo. A casa leva vantagem e a tela diz quanto.
import type { Galo, Golpe, HistoricoRinhaDTO, RinhaDTO } from '@galinheiro/api-contract';
import { CONFIG, GALOS, chanceRinhaPct, premioRinhaX100, retornoMedioRinhaPct } from '@galinheiro/game-core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Lock, Minus, Plus, Swords } from 'lucide-react';
import { useAnimate } from 'motion/react';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { chamar } from '../api';
import { Moeda } from '../arte/Icones';
import { concluirRinha, useEstado, useLutarRinha } from '../estado';
import { useReduzirMovimento } from '../Provedores';
import { ArteGalo } from '../rinha/ArteGalo';
import { som } from '../som';
import { toast, useUi } from '../ui';
import { cx, mensagemDeErro, moedas } from '../util';
import { vibracao } from '../vibracao';

const { apostaMinX100, apostaMaxX100, galos: CFG_GALOS } = CONFIG.rinha;
const FICHAS = [100, 500, 1_000, 2_500, 5_000].filter((v) => v >= apostaMinX100 && v <= apostaMaxX100);
const valor = (x100: number) => moedas(x100).replace(/,00$/, '');
const NOME_GOLPE: Record<Golpe['golpe'], string> = { bicada: 'Bicada', esporada: 'Esporada', voadora: 'Voadora', asa: 'Asada' };
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ritmo da luta (ms): o impacto acontece `impacto` depois de a investida começar. */
const T = { entrada: 380, impacto: 105, golpe: 230, critico: 380, erro: 190, nocaute: 720 };

type Fase = 'escolha' | 'luta' | 'fim';
type Lado = 'jogador' | 'rival';

function useHistorico(ativo: boolean) {
  return useQuery({
    queryKey: ['rinha'],
    queryFn: async () => (await chamar<HistoricoRinhaDTO>('GET', '/rinha')).data,
    enabled: ativo,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------- arena

interface Cena {
  vidaJogador: number;
  vidaRival: number;
  /** golpe sendo encenado (a chave reinicia as animações dos galos) */
  golpe: (Golpe & { n: number }) | null;
  fim: 'vitoria' | 'derrota' | null;
  /** golpes seguidos do mesmo galo que acertaram */
  combo: { lado: Lado; n: number } | null;
}
/** Efeito de um impacto (vive mais que o golpe: o número de dano termina de subir enquanto a luta segue). */
interface Impacto { id: number; alvo: Lado; dano: number; critico: boolean; dx: number; dy: number }

const CENA_ZERO: Cena = { vidaJogador: 100, vidaRival: 100, golpe: null, fim: null, combo: null };
let seqFx = 1;

function BarraVidaGalo({ vida, lado, nome }: { vida: number; lado: Lado; nome: string }) {
  const cor = vida > 50 ? 'verde' : vida > 25 ? 'amarela' : 'vermelha';
  const w = `${Math.max(0, vida)}%`;
  return (
    <div className="rinha-vida" data-lado={lado}>
      <span className="rinha-vida-nome texto-contorno-fino">{nome}</span>
      <span className="rinha-hp" data-cor={cor} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={vida} aria-label={`Vida de ${nome}: ${vida}`}>
        <span className="rinha-hp-rastro" style={{ width: w }} />
        <span className="rinha-hp-cheio" style={{ width: w }} />
      </span>
    </div>
  );
}

function Arena({ galo, cena, impactos, clarao, resultado }: {
  galo: Galo;
  cena: Cena;
  impactos: Impacto[];
  /** contador de clarões (crítico e nocaute) */
  clarao: number;
  /** "+6,00" / "−5,00" depois do nocaute */
  resultado: string | null;
}) {
  const reduzir = useReduzirMovimento();
  const [escopo, animar] = useAnimate<HTMLDivElement>();
  const g = cena.golpe;
  // soco de zoom no impacto; no crítico, tremor junto
  useEffect(() => {
    if (!g || g.dano === 0 || reduzir || !escopo.current) return;
    void animar(
      escopo.current,
      g.critico ? { scale: [1, 1.07, 1], x: [0, -10, 9, -6, 3, 0], y: [0, 4, -3, 0] } : { scale: [1, 1.03, 1] },
      { duration: g.critico ? 0.3 : 0.16, delay: T.impacto / 1000 },
    );
  }, [g?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!cena.fim || reduzir || !escopo.current) return;
    void animar(escopo.current, { scale: [1, 1.1, 1], x: [0, -12, 11, -7, 4, 0] }, { duration: 0.42 });
  }, [cena.fim]); // eslint-disable-line react-hooks/exhaustive-deps

  const acaoDe = (lado: Lado): string | undefined => {
    if (cena.fim) return (cena.fim === 'vitoria') === (lado === 'jogador') ? 'vence' : 'cai';
    if (!g) return undefined;
    if (g.atacante === lado) return 'ataca';
    return g.dano === 0 ? 'desvia' : 'apanha';
  };
  return (
    <div ref={escopo} className="rinha-arena" data-fim={cena.fim ?? undefined}>
      <span className="rinha-holofotes" aria-hidden />
      <span className="rinha-plateia" aria-hidden />
      <span className="rinha-bandeirolas" aria-hidden />
      <div className="rinha-arena-chao" aria-hidden />
      <div className="rinha-vidas">
        <BarraVidaGalo vida={cena.vidaJogador} lado="jogador" nome={`Seu ${CFG_GALOS[galo].nome}`} />
        <span className="rinha-vs texto-contorno" aria-hidden>VS</span>
        <BarraVidaGalo vida={cena.vidaRival} lado="rival" nome="Rival" />
      </div>
      <div className="rinha-ringue">
        <div className="rinha-galo" data-lado="jogador" data-acao={acaoDe('jogador')} key={`j${g?.n ?? 0}${cena.fim ?? ''}`}>
          <span className="rinha-rastro" aria-hidden />
          <ArteGalo pelagem={galo} className="rinha-galo-arte" />
        </div>
        <div className="rinha-galo" data-lado="rival" data-acao={acaoDe('rival')} key={`r${g?.n ?? 0}${cena.fim ?? ''}`}>
          <span className="rinha-rastro" aria-hidden />
          <ArteGalo pelagem="rival" className="rinha-galo-arte" espelhado />
        </div>
        {g && (
          <span className="rinha-poeira" data-lado={g.atacante} key={`p${g.n}`} aria-hidden>
            <i />
            <i />
            <i />
          </span>
        )}
        {impactos.map((i) => (
          <div className="rinha-impacto" data-lado={i.alvo} key={i.id} style={{ '--dx': `${i.dx}px`, '--dy': `${i.dy}px` } as CSSProperties} aria-hidden>
            {i.dano > 0 ? (
              <>
                <span className="rinha-corte" data-critico={i.critico ? '' : undefined} />
                <span className="rinha-estouro" data-critico={i.critico ? '' : undefined} />
                <span className="rinha-penas">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span className={cx('rinha-dano texto-contorno', i.critico && 'rinha-dano-critico')}>
                  {i.critico && <small>CRÍTICO!</small>}-{i.dano}
                </span>
              </>
            ) : (
              <span className="rinha-dano rinha-dano-desvio texto-contorno">DESVIOU!</span>
            )}
          </div>
        ))}
        {cena.combo && cena.combo.n >= 2 && !cena.fim && (
          <span className="rinha-combo texto-contorno" data-lado={cena.combo.lado} key={`c${cena.combo.lado}${cena.combo.n}`} aria-hidden>
            COMBO ×{cena.combo.n}
          </span>
        )}
        {cena.fim && (
          <>
            <span className="rinha-onda" aria-hidden />
            <span className="rinha-chuva-penas" data-fim={cena.fim} aria-hidden>
              {Array.from({ length: 14 }, (_, k) => (
                <i key={k} />
              ))}
            </span>
            <span className="rinha-ko texto-contorno" data-fim={cena.fim} aria-hidden>
              {cena.fim === 'vitoria' ? 'VITÓRIA!' : 'K.O.!'}
            </span>
            {resultado && (
              <span className="rinha-ko-valor texto-contorno numeros" data-fim={cena.fim} aria-hidden>
                {resultado}
              </span>
            )}
          </>
        )}
      </div>
      {clarao > 0 && !reduzir && <span key={clarao} className="rinha-flash" aria-hidden />}
    </div>
  );
}

// ---------------------------------------------------------------- tela

export function TelaRinha() {
  const { data: estado } = useEstado();
  const liberada = estado?.player.roletaLiberada ?? false;
  const historico = useHistorico(liberada);
  const lutarM = useLutarRinha();
  const qc = useQueryClient();
  const reduzir = useReduzirMovimento();
  const [galo, setGalo] = useState<Galo>('brigao');
  const [aposta, setAposta] = useState(500);
  const [fase, setFase] = useState<Fase>('escolha');
  const [cena, setCena] = useState<Cena>(CENA_ZERO);
  const [impactos, setImpactos] = useState<Impacto[]>([]);
  const [clarao, setClarao] = useState(0);
  const [narracao, setNarracao] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ rinha: RinhaDTO; saldoX100: number } | null>(null);
  const arena = useRef<HTMLDivElement>(null);
  const viva = useRef(true);
  // o StrictMode monta, desmonta e monta de novo: a montagem volta a marcar a tela como viva
  useEffect(() => {
    viva.current = true;
    return () => {
      viva.current = false;
    };
  }, []);

  if (!estado) return null;
  const saldo = estado.player.moedasX100;
  const maxPossivel = Math.min(apostaMaxX100, saldo);
  const apostaValida = aposta >= apostaMinX100 && aposta <= maxPossivel;
  const premio = premioRinhaX100(aposta, galo);
  const lutando = fase === 'luta';

  const ajustar = (delta: number) => setAposta((a) => Math.min(apostaMaxX100, Math.max(apostaMinX100, a + delta)));

  const impacto = (g: Golpe) => {
    const id = seqFx++;
    const alvo: Lado = g.atacante === 'jogador' ? 'rival' : 'jogador';
    // cada número nasce num ponto um pouco diferente: golpes seguidos não se empilham
    setImpactos((l) => [...l, { id, alvo, dano: g.dano, critico: g.critico, dx: ((id * 37) % 44) - 22, dy: ((id * 53) % 30) - 15 }].slice(-8));
    setTimeout(() => setImpactos((l) => l.filter((x) => x.id !== id)), 900);
  };

  const encenar = async (r: RinhaDTO, saldoFinalX100: number) => {
    const concluir = () => concluirRinha(qc, saldoFinalX100);
    setFase('luta');
    setCena(CENA_ZERO);
    setImpactos([]);
    setNarracao(null);
    if (!reduzir) {
      som.gongo();
      await esperar(T.entrada);
      let combo = null as Cena['combo'];
      for (let i = 0; i < r.golpes.length; i++) {
        if (!viva.current) return concluir();
        const g = r.golpes[i]!;
        const ultimo = i === r.golpes.length - 1;
        combo = g.dano > 0 ? { lado: g.atacante, n: combo?.lado === g.atacante ? combo.n + 1 : 1 } : null;
        const comboAgora = combo;
        setCena((c) => ({ ...c, golpe: { ...g, n: i + 1 }, combo: comboAgora }));
        setNarracao(`${g.atacante === 'jogador' ? 'Seu galo' : 'O rival'}: ${NOME_GOLPE[g.golpe]}${g.dano === 0 ? ', mas errou' : g.critico ? ' crítica' : ''}!`);
        som.zunido();
        // a barra cai e o impacto estoura no meio da investida
        await esperar(T.impacto);
        impacto(g);
        if (g.dano > 0) {
          som.golpe(g.critico || ultimo);
          vibracao.coleta();
          if (g.critico || ultimo) {
            setClarao((c) => c + 1);
            vibracao.erro();
          }
        } else som.toque();
        setCena((c) => ({ ...c, vidaJogador: g.vidaJogador, vidaRival: g.vidaRival }));
        await esperar(ultimo ? 260 : g.dano === 0 ? T.erro : g.critico ? T.critico : T.golpe);
      }
    }
    if (!viva.current) return concluir();
    const fim = r.golpes.at(-1);
    setCena({ vidaJogador: fim?.vidaJogador ?? 0, vidaRival: fim?.vidaRival ?? 0, golpe: null, fim: r.venceu ? 'vitoria' : 'derrota', combo: null });
    setClarao((c) => c + 1);
    setNarracao(`Sorteio ${r.rngValor} · vitória abaixo de ${CFG_GALOS[r.galo].chanceBp}`);
    som.gongo();
    if (r.venceu) {
      som.cantar();
      som.premio(r.premioX100 >= r.apostaX100 * 3 ? 2 : 1);
      vibracao.jackpot();
    } else {
      som.erro();
      vibracao.erro();
    }
    await esperar(reduzir ? 150 : T.nocaute);
    concluir();
    // venceu: as moedas do prêmio voam da arena para o saldo
    const rect = arena.current?.getBoundingClientRect();
    if (r.venceu && rect && !reduzir) {
      useUi.getState().lancarRajada({ tipo: 'fonte-moedas', x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.6 });
      useUi.getState().lancarChuvaMoedas(rect, Math.round(Math.min(18, Math.max(8, Math.log2(Math.max(1, r.premioX100 / 100)) * 3))), r.premioX100);
      som.moedas();
    }
    if (viva.current) setFase('fim');
  };

  const lutar = async () => {
    if (lutarM.isPending || lutando) return;
    if (!apostaValida) {
      som.erro();
      toast(saldo < apostaMinX100 ? 'Você não tem moedas para apostar. Venda ovos primeiro.' : `Aposte entre ${valor(apostaMinX100)} e ${valor(maxPossivel)} moedas.`, 'erro');
      return;
    }
    try {
      vibracao.coleta();
      // limpa a luta anterior já no toque (o nocaute antigo não fica na tela esperando o servidor)
      setFase('luta');
      setCena(CENA_ZERO);
      setImpactos([]);
      setNarracao(null);
      const r = await lutarM.mutateAsync({ galo, apostaX100: aposta });
      setResultado(r.data);
      await encenar(r.data.rinha, r.data.saldoX100);
    } catch (erro) {
      setFase('escolha');
      som.erro();
      toast(mensagemDeErro(erro), 'erro');
    }
  };

  const cabeca = (
    <div className="tela-cabeca">
      <Link href="/loja" className="botao botao-icone botao-secundario tela-cabeca-voltar" aria-label="Voltar à Loja">
        <ChevronLeft strokeWidth={3} />
      </Link>
      <h1 className="titulo-tela">Rinha de galo</h1>
    </div>
  );

  if (!liberada) {
    return (
      <div className="tela rinha-tela">
        {cabeca}
        <section className="painel rinha-trancada">
          <Lock className="rinha-trancada-icone" strokeWidth={3} aria-hidden />
          <h2 className="rinha-trancada-titulo">A rinha ainda está fechada</h2>
          <p>Ela abre depois que você libera a roleta com as moedas da sua codorna.</p>
          <Link href="/roleta" className="botao botao-primario mt-3">
            Ir à roleta
          </Link>
        </section>
      </div>
    );
  }

  const r = resultado?.rinha;
  // na escolha a arena mostra o galo marcado; durante e depois da luta, o galo que lutou
  const naArena = fase === 'escolha' ? galo : (r?.galo ?? galo);
  const valorFinal = fase !== 'escolha' && cena.fim && r ? (r.venceu ? `+${moedas(r.premioX100 - r.apostaX100)}` : `-${moedas(r.apostaX100)}`) : null;
  return (
    <div className="tela rinha-tela">
      {cabeca}
      <div ref={arena}>
        <Arena galo={naArena} cena={fase === 'escolha' ? CENA_ZERO : cena} impactos={impactos} clarao={clarao} resultado={valorFinal} />
      </div>
      <p className="rinha-narracao" data-fim={fase === 'fim' ? '' : undefined} aria-live="polite">
        {fase === 'fim' && r
          ? `${r.venceu ? 'Seu galo venceu!' : 'Seu galo foi nocauteado.'} ${narracao ?? ''} · saldo ${moedas(resultado.saldoX100)}`
          : (narracao ?? (lutando ? 'Os galos se encaram…' : 'Escolha o galo, a aposta e lute!'))}
      </p>

      <div className="rinha-controles" data-travado={lutando ? '' : undefined}>
        <div className="rinha-galos" role="radiogroup" aria-label="Galo">
          {GALOS.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={galo === g}
              className="rinha-opcao"
              data-galo={g}
              disabled={lutando}
              onClick={() => {
                som.toque();
                setGalo(g);
                if (fase === 'fim') setFase('escolha');
              }}
            >
              <ArteGalo pelagem={g} className="rinha-opcao-arte" />
              <span className="rinha-opcao-nome">{CFG_GALOS[g].nome}</span>
              <span className="rinha-opcao-dado numeros">
                <b>{chanceRinhaPct(g)}%</b> · paga <b>{(CFG_GALOS[g].premioPct / 100).toLocaleString('pt-BR')}×</b>
              </span>
            </button>
          ))}
        </div>

        <div className="rinha-aposta">
          <button type="button" className="botao botao-secundario botao-icone" onClick={() => ajustar(-100)} aria-label="Menos 1 moeda" disabled={lutando || aposta <= apostaMinX100}>
            <Minus />
          </button>
          <span className="chuva-aposta-valor numeros" aria-live="polite" aria-label={`Aposta: ${valor(aposta)} moedas`}>
            <small>Aposta</small>
            <span>
              <Moeda className="h-6 w-6" />
              {valor(aposta)}
            </span>
          </span>
          <button type="button" className="botao botao-secundario botao-icone" onClick={() => ajustar(100)} aria-label="Mais 1 moeda" disabled={lutando || aposta >= apostaMaxX100}>
            <Plus />
          </button>
        </div>
        <div className="rinha-fichas">
          {FICHAS.map((f) => (
            <button key={f} type="button" className="rinha-ficha numeros" aria-pressed={aposta === f} onClick={() => setAposta(f)} disabled={lutando || f > saldo}>
              {valor(f)}
            </button>
          ))}
        </div>
        <p className="rinha-conta-linha numeros">
          Se vencer: <b>+{moedas(premio - aposta)}</b> · se perder: <b>-{moedas(aposta)}</b>
        </p>

        <button
          type="button"
          className="botao botao-compra botao-g botao-brilho rinha-lutar w-full"
          onClick={() => void lutar()}
          aria-disabled={!apostaValida || undefined}
          disabled={lutando || lutarM.isPending}
        >
          <span className="icone-contorno" aria-hidden>
            <Swords />
            <Swords />
          </span>
          {lutando ? 'Lutando…' : fase === 'fim' ? 'Lutar de novo' : 'Lutar!'}
          <span className="botao-preco">
            <Moeda className="h-[1.2em] w-[1.2em]" />
            {valor(aposta)}
          </span>
        </button>
      </div>

      <p className="rinha-aviso">
        A casa leva vantagem: a cada 100 moedas apostadas, voltam em média {retornoMedioRinhaPct(galo).toLocaleString('pt-BR')} com o {CFG_GALOS[galo].nome}. O
        resultado é sorteado no servidor antes da luta. Tudo aqui é moeda do jogo: não se compra nem se saca.
      </p>

      {!!historico.data?.itens.length && (
        <section className="painel rinha-secao" aria-labelledby="rinha-historico">
          <h2 id="rinha-historico" className="rinha-secao-titulo">Últimas lutas</h2>
          <ul className="rinha-historico">
            {historico.data.itens.map((h) => (
              <li key={h.id} data-venceu={h.venceu ? '' : undefined}>
                <span>{CFG_GALOS[h.galo].nome}</span>
                <span className="numeros">{h.venceu ? `+${moedas(h.premioX100 - h.apostaX100)}` : `-${moedas(h.apostaX100)}`}</span>
              </li>
            ))}
          </ul>
          <p className="rinha-historico-total numeros">
            Nessas lutas: apostou {moedas(historico.data.apostadoX100)}, recebeu {moedas(historico.data.ganhoX100)}.
          </p>
        </section>
      )}
    </div>
  );
}

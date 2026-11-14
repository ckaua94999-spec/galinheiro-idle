'use client';

// Rinha de galo (minijogo de aposta com moedas do jogo; nada se compra nem se saca).
// O jogador escolhe um galo (cada um com chance, prêmio e retorno médio à vista), escolhe a aposta e assiste à
// luta. O servidor sorteia o resultado antes; a luta só encena os golpes que ele devolveu: estocada, impacto com
// tremor, número de dano, crítico e nocaute. A casa leva vantagem e a tela diz quanto, antes de apostar.
import type { Galo, Golpe, HistoricoRinhaDTO, RinhaDTO } from '@galinheiro/api-contract';
import { CONFIG, GALOS, chanceRinhaPct, premioRinhaX100, retornoMedioRinhaPct } from '@galinheiro/game-core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, FastForward, Lock, Minus, Plus, Swords } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { chamar } from '../api';
import { Moeda } from '../arte/Icones';
import { concluirRinha, useEstado, useLutarRinha } from '../estado';
import { useReduzirMovimento } from '../Provedores';
import { ArteGalo } from '../rinha/ArteGalo';
import { som } from '../som';
import { toast } from '../ui';
import { cx, mensagemDeErro, moedas } from '../util';
import { vibracao } from '../vibracao';

const { apostaMinX100, apostaMaxX100, galos: CFG_GALOS } = CONFIG.rinha;
const FICHAS = [100, 500, 1_000, 2_500, 5_000].filter((v) => v >= apostaMinX100 && v <= apostaMaxX100);
const valor = (x100: number) => moedas(x100).replace(/,00$/, '');
const NOME_GOLPE: Record<Golpe['golpe'], string> = { bicada: 'Bicada', esporada: 'Esporada', voadora: 'Voadora', asa: 'Asada' };
const DESCRICAO: Record<Galo, string> = {
  favorito: 'Experiente. Ganha mais vezes, paga menos.',
  brigao: 'Briga parelha. Risco e prêmio no meio.',
  azarao: 'Quase sempre perde. Quando ganha, paga muito.',
};
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Fase = 'escolha' | 'luta' | 'fim';

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
  /** golpe sendo encenado (a chave reinicia as animações) */
  golpe: (Golpe & { n: number }) | null;
  fim: 'vitoria' | 'derrota' | null;
}

function BarraVidaGalo({ vida, lado, nome }: { vida: number; lado: 'jogador' | 'rival'; nome: string }) {
  const cor = vida > 50 ? 'verde' : vida > 25 ? 'amarela' : 'vermelha';
  return (
    <div className="rinha-vida" data-lado={lado}>
      <span className="rinha-vida-nome texto-contorno-fino">{nome}</span>
      <span className="barra" data-cor={cor} style={{ '--barra-h': '14px' } as CSSProperties} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={vida} aria-label={`Vida de ${nome}: ${vida}`}>
        <span className="barra-preenchimento" style={{ '--p': Math.max(0, vida) } as CSSProperties} />
      </span>
    </div>
  );
}

function Arena({ galo, cena }: { galo: Galo; cena: Cena }) {
  const g = cena.golpe;
  const acaoDe = (lado: 'jogador' | 'rival'): string | undefined => {
    if (cena.fim) return (cena.fim === 'vitoria') === (lado === 'jogador') ? 'vence' : 'cai';
    if (!g) return undefined;
    if (g.atacante === lado) return 'ataca';
    return g.dano === 0 ? 'desvia' : 'apanha';
  };
  const alvo = g ? (g.atacante === 'jogador' ? 'rival' : 'jogador') : null;
  return (
    <div className="rinha-arena" data-tremor={g?.critico ? String(g.n % 2) : undefined} key={g?.critico ? `t${g.n}` : 'arena'}>
      <div className="rinha-arena-chao" aria-hidden />
      <div className="rinha-vidas">
        <BarraVidaGalo vida={cena.vidaJogador} lado="jogador" nome={`Seu ${CFG_GALOS[galo].nome}`} />
        <span className="rinha-vs texto-contorno" aria-hidden>VS</span>
        <BarraVidaGalo vida={cena.vidaRival} lado="rival" nome="Rival" />
      </div>
      <div className="rinha-ringue">
        <div className="rinha-galo" data-lado="jogador" data-acao={acaoDe('jogador')} key={`j${g?.n ?? 0}${cena.fim ?? ''}`}>
          <ArteGalo pelagem={galo} className="rinha-galo-arte" />
        </div>
        <div className="rinha-galo" data-lado="rival" data-acao={acaoDe('rival')} key={`r${g?.n ?? 0}${cena.fim ?? ''}`}>
          <ArteGalo pelagem="rival" className="rinha-galo-arte" espelhado />
        </div>
        {g && alvo && (
          <div className="rinha-impacto" data-lado={alvo} key={`i${g.n}`} aria-hidden>
            {g.dano > 0 ? (
              <>
                <span className="rinha-estouro" data-critico={g.critico ? '' : undefined} />
                <span className="rinha-penas">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span className={cx('rinha-dano texto-contorno', g.critico && 'rinha-dano-critico')}>
                  {g.critico && <small>CRÍTICO!</small>}-{g.dano}
                </span>
              </>
            ) : (
              <span className="rinha-dano rinha-dano-desvio texto-contorno">DESVIOU!</span>
            )}
          </div>
        )}
        {cena.fim && (
          <span className="rinha-ko texto-contorno" data-fim={cena.fim} aria-hidden>
            {cena.fim === 'vitoria' ? 'VITÓRIA!' : 'K.O.'}
          </span>
        )}
      </div>
      <p className="rinha-narracao" aria-live="polite">
        {cena.fim
          ? cena.fim === 'vitoria' ? 'Seu galo venceu!' : 'Seu galo foi nocauteado.'
          : g
            ? `${g.atacante === 'jogador' ? 'Seu galo' : 'O rival'}: ${NOME_GOLPE[g.golpe]}${g.dano === 0 ? ', mas errou' : g.critico ? ' crítica' : ''}!`
            : 'Os galos se encaram…'}
      </p>
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
  const [cena, setCena] = useState<Cena>({ vidaJogador: 100, vidaRival: 100, golpe: null, fim: null });
  const [resultado, setResultado] = useState<{ rinha: RinhaDTO; saldoX100: number } | null>(null);
  const pular = useRef(false);
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

  const ajustar = (delta: number) => setAposta((a) => Math.min(apostaMaxX100, Math.max(apostaMinX100, a + delta)));

  const encenar = async (r: RinhaDTO, saldoFinalX100: number) => {
    const concluir = () => concluirRinha(qc, saldoFinalX100);
    pular.current = false;
    setFase('luta');
    setCena({ vidaJogador: 100, vidaRival: 100, golpe: null, fim: null });
    if (!reduzir) await esperar(700);
    for (let i = 0; i < r.golpes.length; i++) {
      if (!viva.current) return concluir();
      const g = r.golpes[i]!;
      if (pular.current || reduzir) break;
      setCena((c) => ({ ...c, golpe: { ...g, n: i + 1 } }));
      if (g.dano > 0) {
        som.golpe(g.critico);
        if (g.critico) vibracao.erro();
      } else som.toque();
      // a barra cai no instante do impacto (meio da estocada)
      await esperar(g.critico ? 330 : 240);
      setCena((c) => ({ ...c, vidaJogador: g.vidaJogador, vidaRival: g.vidaRival }));
      await esperar(g.critico ? 620 : 420);
    }
    const ultimo = r.golpes.at(-1);
    setCena({ vidaJogador: ultimo?.vidaJogador ?? 0, vidaRival: ultimo?.vidaRival ?? 0, golpe: null, fim: r.venceu ? 'vitoria' : 'derrota' });
    concluir();
    if (r.venceu) {
      som.cantar();
      som.moedas();
      vibracao.jackpot();
    } else {
      som.erro();
      vibracao.erro();
    }
    await esperar(reduzir ? 200 : 900);
    if (viva.current) setFase('fim');
  };

  const lutar = async () => {
    if (lutarM.isPending || fase === 'luta') return;
    if (!apostaValida) {
      som.erro();
      toast(saldo < apostaMinX100 ? 'Você não tem moedas para apostar. Venda ovos primeiro.' : `Aposte entre ${valor(apostaMinX100)} e ${valor(maxPossivel)} moedas.`, 'erro');
      return;
    }
    try {
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
  return (
    <div className="tela rinha-tela">
      {cabeca}
      <Arena galo={fase === 'escolha' ? galo : (r?.galo ?? galo)} cena={fase === 'escolha' ? { vidaJogador: 100, vidaRival: 100, golpe: null, fim: null } : cena} />

      {fase === 'luta' && (
        <button type="button" className="botao botao-secundario rinha-pular" onClick={() => (pular.current = true)}>
          <FastForward className="h-4 w-4" aria-hidden /> Pular luta
        </button>
      )}

      {fase === 'fim' && r && (
        <section className="painel rinha-resultado" data-venceu={r.venceu ? '' : undefined} aria-live="polite">
          <h2 className="rinha-resultado-titulo texto-contorno">{r.venceu ? 'Você ganhou!' : 'Você perdeu'}</h2>
          <p className="rinha-resultado-valor numeros">
            <Moeda className="h-7 w-7" />
            {r.venceu ? `+${moedas(r.premioX100 - r.apostaX100)}` : `-${moedas(r.apostaX100)}`}
          </p>
          <p className="rinha-resultado-sorteio">
            Sorteio {r.rngValor} · vitória abaixo de {CFG_GALOS[r.galo].chanceBp} · saldo {moedas(resultado.saldoX100)}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="botao botao-primario flex-1" onClick={() => setFase('escolha')}>
              Lutar de novo
            </button>
            <Link href="/galinheiro" className="botao botao-secundario flex-1">
              Galinheiro
            </Link>
          </div>
        </section>
      )}

      {fase === 'escolha' && (
        <>
          <section className="painel rinha-secao" aria-labelledby="rinha-galos">
            <h2 id="rinha-galos" className="rinha-secao-titulo">Escolha seu galo</h2>
            <div className="rinha-galos" role="radiogroup" aria-label="Galo">
              {GALOS.map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={galo === g}
                  className="rinha-opcao"
                  data-galo={g}
                  onClick={() => {
                    som.toque();
                    setGalo(g);
                  }}
                >
                  <ArteGalo pelagem={g} className="rinha-opcao-arte" />
                  <span className="rinha-opcao-nome">{CFG_GALOS[g].nome}</span>
                  <span className="rinha-opcao-dado numeros">
                    <b>{chanceRinhaPct(g)}%</b> de chance
                  </span>
                  <span className="rinha-opcao-dado numeros">
                    paga <b>{(CFG_GALOS[g].premioPct / 100).toLocaleString('pt-BR')}×</b>
                  </span>
                  <span className="rinha-opcao-desc">{DESCRICAO[g]}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="painel rinha-secao" aria-labelledby="rinha-aposta">
            <h2 id="rinha-aposta" className="rinha-secao-titulo">Sua aposta</h2>
            <div className="rinha-aposta">
              <button type="button" className="botao botao-secundario botao-icone" onClick={() => ajustar(-100)} aria-label="Menos 1 moeda" disabled={aposta <= apostaMinX100}>
                <Minus />
              </button>
              <span className="rinha-aposta-valor numeros" aria-live="polite">
                <Moeda className="h-7 w-7" />
                {valor(aposta)}
              </span>
              <button type="button" className="botao botao-secundario botao-icone" onClick={() => ajustar(100)} aria-label="Mais 1 moeda" disabled={aposta >= apostaMaxX100}>
                <Plus />
              </button>
            </div>
            <div className="rinha-fichas">
              {FICHAS.map((f) => (
                <button key={f} type="button" className="rinha-ficha numeros" aria-pressed={aposta === f} onClick={() => setAposta(f)} disabled={f > saldo}>
                  {valor(f)}
                </button>
              ))}
            </div>
            <p className="rinha-saldo numeros">
              Saldo: <Moeda className="h-5 w-5" /> {moedas(saldo)}
            </p>
            <dl className="rinha-conta numeros">
              <div>
                <dt>Se vencer, recebe</dt>
                <dd>{moedas(premio)}</dd>
              </div>
              <div>
                <dt>Se perder</dt>
                <dd>-{moedas(aposta)}</dd>
              </div>
            </dl>
          </section>

          <button
            type="button"
            className="botao botao-compra botao-g botao-brilho rinha-lutar w-full"
            onClick={() => void lutar()}
            aria-disabled={!apostaValida || undefined}
            disabled={lutarM.isPending}
          >
            <span className="icone-contorno" aria-hidden>
              <Swords />
              <Swords />
            </span>
            {lutarM.isPending ? 'Preparando…' : 'Lutar!'}
            <span className="botao-preco">
              <Moeda className="h-[1.2em] w-[1.2em]" />
              {valor(aposta)}
            </span>
          </button>

          <p className="rinha-aviso">
            A casa leva vantagem: a cada 100 moedas apostadas, voltam em média {retornoMedioRinhaPct(galo).toLocaleString('pt-BR')} com o {CFG_GALOS[galo].nome}. O resultado é sorteado no servidor antes da luta. Tudo aqui é moeda do jogo: não se compra nem se saca.
          </p>
        </>
      )}

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

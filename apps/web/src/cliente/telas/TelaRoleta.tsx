'use client';

// Roleta (GDD 3.6, 6.9 e 6.10). O servidor sorteia; a roda só encena o resultado, parando no ângulo exato.
// Coreografia (DIRECAO_DE_ARTE 7.2): antecipação (recua) → arranque acelerado → cruzeiro enquanto o servidor responde →
// desaceleração com suspense até alvo + 2° → mola de volta ao alvo exato → vitória (gomo pisca, confete).
import type { GirarResposta } from '@galinheiro/api-contract';
import {
  ANIMAIS, CONFIG, FAIXAS_ROLETA, GEMAS_RARIDADE, NOME_RARIDADE, NOME_TIPO, rotacaoFinal, validarNome,
} from '@galinheiro/game-core';
import { Info, Lock, LockOpen } from 'lucide-react';
import { animate, motion, useMotionValue, type AnimationPlaybackControls, type ValueAnimationTransition } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ErroApi } from '../api';
import { FiguraAnimal } from '../arte/Animal';
import { Gemas, IconeNinho, IconeRoleta, Moeda } from '../arte/Icones';
import { PalcoRoda } from '../arte/Roda';
import { Modal } from '../componentes/Modal';
import { FormNomeRevelacao, RevelacaoAnimal } from '../componentes/RevelacaoAnimal';
import { useEstado, useGirar, useLiberarRoleta, useRenomear } from '../estado';
import { useReduzirMovimento } from '../Provedores';
import { useAgora } from '../relogio';
import { som } from '../som';
import { toast, useUi } from '../ui';
import { ETAPA, useAcoes } from '../useAcoes';
import { COR_RARIDADE, cx, mensagemDeErro, moedas } from '../util';
import { vibracao } from '../vibracao';

type Fase = 'parado' | 'girando' | 'parando';
type Bloqueio = { tipo: 'cheio' } | { tipo: 'saldo'; faltaX100: number } | null;
type Curva = [number, number, number, number];

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Curvas e tempos do giro. As duas curvas de desaceleração começam com inclinação 4 (0,6/0,15): a duração é
// escolhida para a velocidade inicial bater com a de cruzeiro, então não há "tranco" na troca.
const EASE_SUAVE: Curva = [0.22, 1, 0.36, 1];
const EASE_GIRO: Curva = [0.15, 0.6, 0.12, 1];
const EASE_SUSPENSE: Curva = [0.15, 0.6, 0.05, 1]; // épico/lendário: rasteja mais no fim
const EASE_RECUO: Curva = [0.37, 0, 0.63, 1]; // senoide: sai e chega parada (sem tranco na inversão)
const EASE_ARRANQUE: Curva = [1 / 3, 0, 2 / 3, 1 / 3]; // exatamente t²: termina com o dobro da velocidade média
const VEL_CRUZEIRO = 1440; // graus por segundo (4 voltas/s)
const RECUO = { graus: 10, s: 0.22 };
/** Arranque: acelera do zero até a velocidade de cruzeiro (t² ⇒ duração = 2·distância / velocidade final). */
const ARRANQUE = { graus: 180, s: (2 * 180) / VEL_CRUZEIRO };
const MOLA_RODA = { type: 'spring', stiffness: 200, damping: 12 } as const;

/** Número da moeda do jogo sem ",00" quando é inteiro (40 em vez de 40,00). */
const valor = (x100: number) => moedas(x100).replace(/,00$/, '');

// ---------------------------------------------------------------- tabela de chances

/** Lista das chances com a arte dos animais e barras proporcionais (corpo do ModalChances; também na galeria). */
export function TabelaChances() {
  return (
    <ul className="roleta-chances" aria-label="Chances de cada animal">
      {FAIXAS_ROLETA.map((f) => {
        const raridade = ANIMAIS[f.tipo].raridade;
        const pct = (f.ate - f.de + 1) / 100;
        return (
          <li key={f.tipo} className="roleta-chance" data-raridade={raridade}>
            <span className="roleta-chance-retrato" aria-hidden>
              <FiguraAnimal tipo={f.tipo} ninho={false} detalhe="p" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="roleta-chance-nome">{NOME_TIPO[f.tipo]}</span>
                <span className="pilula" data-raridade={raridade}>
                  {NOME_RARIDADE[raridade]}
                </span>
                <Gemas quantidade={GEMAS_RARIDADE[raridade]} cor={COR_RARIDADE[raridade]} />
              </div>
              <span className="barra mt-2" style={{ '--barra-h': '14px' } as CSSProperties} aria-hidden>
                <span className="barra-preenchimento" style={{ '--p': pct } as CSSProperties} />
              </span>
            </div>
            <span className="roleta-chance-pct texto-contorno numeros" aria-label={`${pct}% de chance`}>
              {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ModalChances({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Chances da roleta">
      <TabelaChances />
      <p className="mt-4 text-sm font-semibold text-texto-suave">
        O resultado é sorteado no servidor antes da animação. Cada giro é independente: giros anteriores não mudam as chances.
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------- botão Girar

export type EstadoBotaoGirar = 'pronto' | 'girando' | 'cheio' | 'saldo';

/** Botão 3D de compra da roleta (texto contornado + selo de preço com a moeda do jogo). */
export function BotaoGirar({
  estado,
  custoX100,
  faltaX100 = 0,
  pressionado = false,
  vagas,
  girosGratis = 0,
  onClick,
  className,
}: {
  estado: EstadoBotaoGirar;
  custoX100: number;
  faltaX100?: number;
  /** Giros grátis (cupom ou liberação) ainda disponíveis. No estado pronto, o botão gira sem cobrar. */
  girosGratis?: number;
  /** Ninhos livres: selo "N vagas" pendurado no canto do botão (só em telas baixas, onde a pílula de saldo/ninhos
   *  sai; com 1 ou 2 ele fica vermelho de alerta). Com 0 o próprio botão já diz "Galinheiro cheio". */
  vagas?: number;
  pressionado?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-tut="girar"
      className={cx('botao botao-compra botao-g roleta-botao', className)}
      onClick={onClick}
      // girando: o botão fica afundado e azul ("segurando" a roda) em vez de cinza; o clique é ignorado em girar()
      aria-busy={estado === 'girando' || undefined}
      aria-disabled={estado === 'cheio' || estado === 'saldo'}
      data-pressionado={pressionado || estado === 'girando' ? '' : undefined}
    >
      {estado === 'girando' && 'Girando…'}
      {estado === 'cheio' && 'Galinheiro cheio'}
      {estado === 'saldo' && (
        <>
          Faltam
          <span className="botao-preco">
            <Moeda className="h-[1.2em] w-[1.2em]" />
            {valor(faltaX100)}
          </span>
        </>
      )}
      {estado === 'pronto' && girosGratis > 0 && (
        <>
          Girar
          <span className="botao-preco" aria-label={`${girosGratis} ${girosGratis === 1 ? 'giro grátis' : 'giros grátis'}`}>
            Grátis · {girosGratis}
          </span>
        </>
      )}
      {estado === 'pronto' && girosGratis <= 0 && (
        <>
          Girar
          <span className="botao-preco" aria-label={`por ${valor(custoX100)} moedas`}>
            <Moeda className="h-[1.2em] w-[1.2em]" />
            {valor(custoX100)}
          </span>
        </>
      )}
      {vagas !== undefined && vagas > 0 && estado !== 'cheio' && (
        <span className="badge roleta-botao-vagas" data-alerta={vagas <= 2 ? '' : undefined}>
          <IconeNinho className="roleta-botao-vagas-icone" />
          {vagas === 1 ? '1 vaga' : `${vagas} vagas`}
        </span>
      )}
    </button>
  );
}

/** Pílula com saldo e ninhos livres, embaixo do botão (some em telas baixas: o HUD já mostra o saldo e o botão
 *  Girar ganha o selo compacto "N vagas"). */
export function InfoRoleta({
  moedasX100, livres, custoX100, alertarSaldo = true,
}: {
  moedasX100: number;
  livres: number;
  custoX100: number;
  /** Com giro grátis na mão, o saldo baixo não bloqueia o giro. */
  alertarSaldo?: boolean;
}) {
  return (
    <p className="roleta-info">
      <span aria-label={`Saldo: ${moedas(moedasX100)} moedas`} data-alerta={alertarSaldo && moedasX100 < custoX100 ? '' : undefined}>
        <Moeda className="h-6 w-6" />
        <span className="numeros">{moedas(moedasX100)}</span>
      </span>
      <span className="roleta-info-sep" aria-hidden />
      <span aria-label={`Ninhos livres: ${Math.max(0, livres)}`} data-alerta={livres <= 0 ? '' : undefined}>
        <IconeNinho className="h-5 w-6" />
        <span className="numeros">{Math.max(0, livres)}</span>
        <small>
          <span className="roleta-info-longo">{livres === 1 ? 'ninho ' : 'ninhos '}</span>
          {livres === 1 ? 'livre' : 'livres'}
        </small>
      </span>
    </p>
  );
}

/** Resultado do giro: revelação em tela cheia (RevelacaoAnimal) + nome. Valida e renomeia antes de fechar. */
function ModalResultado({ r, aoFechar }: { r: GirarResposta | null; aoFechar: (destino?: string) => void }) {
  const renomear = useRenomear();
  const agora = useAgora();
  const [nome, setNome] = useState('');
  const [erroNome, setErroNome] = useState<string | null>(null);
  useEffect(() => {
    if (r) {
      setNome(r.entity.nome);
      setErroNome(null);
    }
  }, [r]);

  const confirmar = async (destino?: string) => {
    if (!r || renomear.isPending) return;
    const { entity } = r;
    const v = validarNome(nome);
    if (!v.ok) {
      setErroNome(v.erro === 'NOME_IMPROPRIO' ? 'Esse nome não pode. Que tal outro?' : 'Use de 1 a 20 letras, números, espaço, hífen, apóstrofo ou ponto.');
      return;
    }
    if (v.nome !== entity.nome) {
      try {
        await renomear.mutateAsync({ id: entity.id, nome: v.nome });
      } catch (erro) {
        setErroNome(mensagemDeErro(erro));
        return;
      }
    }
    aoFechar(destino);
  };

  return (
    <RevelacaoAnimal entidade={r?.entity ?? null} agora={agora} aoEsc={() => void confirmar()}>
      {r && (
        <FormNomeRevelacao
          nome={nome}
          aoMudarNome={(v) => {
            setNome(v);
            setErroNome(null);
          }}
          erro={erroNome}
          salvando={renomear.isPending}
          aoConfirmar={(destino) => void confirmar(destino)}
        />
      )}
    </RevelacaoAnimal>
  );
}

// ---------------------------------------------------------------- roleta trancada (membro novo)

/**
 * Roleta trancada: o membro novo junta `CONFIG.roleta.liberacaoX100` moedas vendendo os ovos da codorna e paga a
 * liberação uma vez. A liberação já vem com o primeiro giro (giro grátis).
 */
export function PainelLiberacao({
  moedasX100, estoqueX100, liberando, aoLiberar, aoVender,
}: {
  moedasX100: number;
  /** Quanto os ovos do estoque valem agora (mostra que dá para vender e chegar lá). */
  estoqueX100: number;
  liberando: boolean;
  aoLiberar: () => void;
  aoVender: () => void;
}) {
  const preco = CONFIG.roleta.liberacaoX100;
  const falta = Math.max(0, preco - moedasX100);
  const pct = Math.min(100, (moedasX100 / preco) * 100);
  return (
    <section className="painel roleta-trava" aria-labelledby="roleta-trava-titulo" data-tut="liberar">
      <div className="roleta-trava-cabeca">
        <span className="roleta-trava-codorna" aria-hidden>
          <FiguraAnimal tipo="codorna" ninho={false} detalhe="p" />
        </span>
        <div className="min-w-0">
          <h2 id="roleta-trava-titulo" className="roleta-trava-titulo texto-contorno">
            <Lock className="roleta-trava-cadeado" strokeWidth={3} aria-hidden /> Roleta trancada
          </h2>
          <p className="roleta-trava-texto">
            Venda os ovos da sua codorna e junte <b className="numeros">{valor(preco)} moedas</b>. Ao liberar, o primeiro giro já vem de presente.
          </p>
        </div>
      </div>
      <div
        className="barra roleta-trava-barra"
        data-cor="ouro"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={preco}
        aria-valuenow={Math.min(moedasX100, preco)}
        aria-label={`${moedas(Math.min(moedasX100, preco))} de ${moedas(preco)} moedas`}
        style={{ '--barra-h': '22px' } as CSSProperties}
      >
        <span className="barra-preenchimento" data-anima style={{ '--p': pct } as CSSProperties} />
        <span className="barra-texto numeros">
          {moedas(Math.min(moedasX100, preco))} / {valor(preco)}
        </span>
      </div>
      {falta > 0 ? (
        <>
          <button type="button" className="botao botao-compra botao-g roleta-botao w-full" aria-disabled onClick={aoLiberar}>
            Faltam
            <span className="botao-preco">
              <Moeda className="h-[1.2em] w-[1.2em]" />
              {moedas(falta)}
            </span>
          </button>
          {estoqueX100 > 0 && (
            <button type="button" className="botao botao-secundario botao-p roleta-trava-vender" onClick={aoVender}>
              Vender ovos ({moedas(estoqueX100)} moedas)
            </button>
          )}
        </>
      ) : (
        <button type="button" className="botao botao-compra botao-g botao-brilho roleta-botao w-full" onClick={aoLiberar} disabled={liberando}>
          <span className="icone-contorno" aria-hidden>
            <LockOpen />
            <LockOpen />
          </span>
          {liberando ? 'Liberando…' : 'Liberar'}
          <span className="botao-preco" aria-label={`por ${valor(preco)} moedas`}>
            <Moeda className="h-[1.2em] w-[1.2em]" />
            {valor(preco)}
          </span>
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- tela

export function TelaRoleta() {
  const { data: estado } = useEstado();
  const router = useRouter();
  const girarM = useGirar();
  const liberarM = useLiberarRoleta();
  const { avancarSe } = useAcoes();
  const reduzir = useReduzirMovimento();
  const pularSempre = useUi((s) => s.preferencias.pularAnimacaoRoleta);
  const chancesAbertas = useUi((s) => s.chancesAbertas);
  const abrirChances = useUi((s) => s.abrirChances);
  // repouso girado -24°: o gomo estreito fica visível, longe do ponteiro
  const rotacao = useMotionValue(-24);
  const opacidade = useMotionValue(1);
  const [fase, setFase] = useState<Fase>('parado');
  const [pressionado, setPressionado] = useState(false);
  const [destaque, setDestaque] = useState<number | null>(null);
  const [resultado, setResultado] = useState<GirarResposta | null>(null);
  const [bloqueio, setBloqueio] = useState<Bloqueio>(null);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const alvoFinal = useRef<number | null>(null);
  const terminar = useRef<(() => void) | null>(null);
  const girosNaSessao = useRef(0);
  const giroPedido = useRef(false);

  // "Tique" do ponteiro a cada pino (24 por volta). A mola do ponteiro mora na própria Roda.
  useEffect(() => {
    let pino = Math.floor(rotacao.get() / 15);
    return rotacao.on('change', (v) => {
      const p = Math.floor(v / 15);
      if (p !== pino) {
        pino = p;
        som.tique();
      }
    });
  }, [rotacao]);

  useEffect(() => () => anim.current?.stop(), []);

  if (!estado) return null;
  const { moedasX100, capacidade } = estado.player;
  const livres = capacidade - estado.entidades.length;
  const custo = CONFIG.roleta.custoX100;

  /** Anima a roda até `alvo`; a promessa resolve no fim (ou quando "pular" encurta a animação). */
  const rodar = (alvo: number, transicao: ValueAnimationTransition<number>) =>
    new Promise<void>((resolve) => {
      terminar.current = resolve;
      anim.current = animate(rotacao, alvo, { ...transicao, onComplete: () => resolve() });
    });

  const pular = () => {
    if (fase !== 'parando' || girosNaSessao.current < 1 || alvoFinal.current === null) return;
    anim.current?.stop();
    const fim = terminar.current;
    anim.current = animate(rotacao, alvoFinal.current, { duration: 0.35, ease: EASE_SUAVE, onComplete: () => fim?.() });
  };

  const girosGratis = estado.player.girosGratis ?? 0;

  const girar = async () => {
    if (fase !== 'parado' || giroPedido.current) return;
    if (livres <= 0) {
      setBloqueio({ tipo: 'cheio' });
      som.erro();
      return;
    }
    if (girosGratis <= 0 && moedasX100 < custo) {
      setBloqueio({ tipo: 'saldo', faltaX100: custo - moedasX100 });
      som.erro();
      return;
    }
    giroPedido.current = true;
    setDestaque(null);
    setFase('girando');
    alvoFinal.current = null;
    som.girar();
    const rapido = reduzir || pularSempre;
    const pedido = girarM.mutateAsync();
    let pronta: Awaited<typeof pedido> | null = null;
    pedido.then(
      (r) => {
        pronta = r;
      },
      () => {},
    );
    try {
      let r: Awaited<typeof pedido>;
      let final: number;
      if (rapido) {
        // Sem giro: crossfade de 400 ms direto para o gomo vencedor.
        r = await pedido;
        final = rotacaoFinal(rotacao.get(), r.data.giro.anguloResultado, 0);
        alvoFinal.current = final;
        await animate(opacidade, 0.15, { duration: 0.2 });
        rotacao.set(final);
      } else {
        // Antecipação: a roda recua 10° (botão afundado) e arranca acelerando até o cruzeiro, sem salto de velocidade.
        setPressionado(true);
        await rodar(rotacao.get() - RECUO.graus, { duration: RECUO.s, ease: EASE_RECUO });
        setPressionado(false);
        await rodar(rotacao.get() + ARRANQUE.graus, { duration: ARRANQUE.s, ease: EASE_ARRANQUE });
        // Servidor ainda não respondeu? Gira em velocidade de cruzeiro até a resposta chegar.
        if (!pronta) {
          const de = rotacao.get();
          anim.current = animate(rotacao, de + VEL_CRUZEIRO * 60, { duration: 60, ease: 'linear' });
          await pedido;
          anim.current.stop();
        }
        r = pronta ?? (await pedido);
        const { raridade, anguloResultado } = r.data.giro;
        const suspense = raridade === 'lendario' || raridade === 'epico';
        const atual = rotacao.get();
        final = rotacaoFinal(atual, anguloResultado, raridade === 'lendario' ? 1 : 0);
        alvoFinal.current = final;
        setFase('parando');
        // Desaceleração com suspense até passar 2° do alvo, e a mola devolve ao ponto exato.
        const distancia = final + 2 - atual;
        const duracao = Math.min(7.5, Math.max(4.5, (4 * distancia) / VEL_CRUZEIRO));
        await rodar(final + 2, { duration: duracao, ease: suspense ? EASE_SUSPENSE : EASE_GIRO });
        await rodar(final, MOLA_RODA);
        anim.current?.stop();
        rotacao.set(final);
      }
      const { giro } = r.data;
      som.parar();
      setDestaque(FAIXAS_ROLETA.findIndex((f) => f.tipo === giro.tipo));
      if (rapido) void animate(opacidade, 1, { duration: 0.2 });
      som.vitoria(giro.raridade);
      vibracao.roleta(giro.raridade);
      // a vitória fica à vista ~0,9 s depois que o retrato do vencedor assenta no gomo (~520 ms) antes da carta
      await esperar(rapido ? 450 : giro.raridade === 'lendario' ? 1750 : 1450);
      girosNaSessao.current++;
      useUi.getState().definirUltimoGiro({
        entityId: r.data.entity.id,
        tipo: giro.tipo,
        raridade: giro.raridade,
        slotId: r.data.entity.slotId,
        nome: r.data.entity.nome,
      });
      useUi.getState().abrirResultadoGiro(true);
      setResultado(r.data);
      avancarSe(ETAPA.PRIMEIRO_GIRO, ETAPA.NOMEAR);
    } catch (erro) {
      anim.current?.stop();
      setPressionado(false);
      void animate(opacidade, 1, { duration: 0.2 });
      if (!rapido) void rodar(rotacao.get() + 60, { duration: 0.8, ease: 'easeOut' });
      som.erro();
      if (erro instanceof ErroApi && erro.codigo === 'SEM_NINHO_LIVRE') setBloqueio({ tipo: 'cheio' });
      else if (erro instanceof ErroApi && erro.codigo === 'SALDO_INSUFICIENTE') {
        setBloqueio({ tipo: 'saldo', faltaX100: Number(erro.detalhes?.faltamX100 ?? custo) });
      } else toast(mensagemDeErro(erro), 'erro');
    } finally {
      giroPedido.current = false;
      setFase('parado');
    }
  };

  const liberar = async () => {
    if (liberarM.isPending) return;
    if (moedasX100 < CONFIG.roleta.liberacaoX100) {
      som.erro();
      toast(`Faltam ${moedas(CONFIG.roleta.liberacaoX100 - moedasX100)} moedas. Venda os ovos da codorna para juntar.`, 'erro');
      return;
    }
    try {
      await liberarM.mutateAsync();
      som.vitoria('raro');
      vibracao.roleta('raro');
      toast('Roleta liberada! O primeiro giro é por nossa conta.', 'sucesso', { duracaoMs: 3200 });
    } catch (erro) {
      som.erro();
      toast(mensagemDeErro(erro), 'erro');
    }
  };

  const fecharResultado = (destino?: string) => {
    const r = resultado;
    setResultado(null);
    setDestaque(null);
    useUi.getState().abrirResultadoGiro(false);
    avancarSe(ETAPA.NOMEAR, ETAPA.COLETAR_NOVO);
    if (destino && r) {
      router.push(destino);
      setTimeout(() => document.querySelector(`[data-slot="${r.entity.slotId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
    }
  };

  const estadoBotao: EstadoBotaoGirar =
    fase !== 'parado' ? 'girando' : livres <= 0 ? 'cheio' : girosGratis <= 0 && moedasX100 < custo ? 'saldo' : 'pronto';
  const liberada = estado.player.roletaLiberada;
  const podePular = fase === 'parando' && girosNaSessao.current >= 1;

  return (
    <div className="roleta-tela mx-auto flex max-w-md flex-col items-center px-4">
      {/* cabeçalho padrão das telas (Loja, Ajustes): ícone da aba + título contornado; Chances no encaixe da direita.
          O saldo NÃO sobe para cá em telas baixas: o HUD logo acima já mostra moedas e ninhos (roleta.css). */}
      <div className="tela-cabeca roleta-cabeca">
        <IconeRoleta className="tela-cabeca-icone" />
        <h1 className="titulo-tela">Roleta</h1>
        <div className="tela-cabeca-acao">
          {/* celular estreito (< 360 px): vira botão-ícone redondo de 44 px (CSS) */}
          <button type="button" className="botao botao-p roleta-botao-chances" onClick={() => abrirChances(true)} aria-label="Chances">
            <Info className="h-4 w-4" /> <span className="roleta-botao-chances-texto">Chances</span>
          </button>
        </div>
      </div>
      {/* a roda encolhe com a altura da tela: em 600 px ainda cabe com o botão acima das abas */}
      <motion.div className="roleta-caixa" style={{ opacity: opacidade }} data-trancada={liberada ? undefined : ''}>
        <PalcoRoda rotacao={rotacao} destaque={destaque} girando={fase !== 'parado'} onClick={pular} palcoClassName={podePular ? 'cursor-pointer' : undefined}>
          {podePular && <p className="roleta-dica painel-escuro px-3 py-1 text-xs">Toque na roda para pular</p>}
        </PalcoRoda>
      </motion.div>
      {liberada ? (
        <>
          <BotaoGirar
            estado={estadoBotao}
            custoX100={custo}
            faltaX100={Math.max(0, custo - moedasX100)}
            vagas={livres}
            girosGratis={girosGratis}
            pressionado={pressionado}
            onClick={() => void girar()}
            className="mt-2"
          />
          <div className="roleta-info-baixo mt-2.5">
            <InfoRoleta moedasX100={moedasX100} livres={livres} custoX100={custo} alertarSaldo={girosGratis <= 0} />
          </div>
        </>
      ) : (
        <PainelLiberacao
          moedasX100={moedasX100}
          estoqueX100={estado.resumo.valorInventarioX100}
          liberando={liberarM.isPending}
          aoLiberar={() => void liberar()}
          aoVender={() => useUi.getState().abrirVenda(true)}
        />
      )}

      <ModalChances aberto={chancesAbertas} aoFechar={() => abrirChances(false)} />
      <ModalResultado r={resultado} aoFechar={fecharResultado} />
      <Modal aberto={bloqueio?.tipo === 'cheio'} aoFechar={() => setBloqueio(null)} titulo="Galinheiro cheio!">
        <p>Todos os {capacidade} ninhos estão ocupados. Amplie o galinheiro na Loja.</p>
        <div className="mt-4 flex gap-2">
          <Link href="/loja" className="botao botao-primario flex-1" onClick={() => setBloqueio(null)}>
            Ir à Loja
          </Link>
          <button type="button" className="botao botao-secundario flex-1" onClick={() => setBloqueio(null)}>
            Agora não
          </button>
        </div>
      </Modal>
      <Modal aberto={bloqueio?.tipo === 'saldo'} aoFechar={() => setBloqueio(null)} titulo={`Faltam ${moedas(bloqueio?.tipo === 'saldo' ? bloqueio.faltaX100 : 0)} moedas`}>
        <p>
          Venda ovos para conseguir mais moedas. Você tem <span className="numeros font-bold">{moedas(moedasX100)}</span>.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="botao botao-primario flex-1"
            onClick={() => {
              setBloqueio(null);
              useUi.getState().abrirVenda(true);
            }}
          >
            Vender ovos
          </button>
          <button type="button" className="botao botao-secundario flex-1" onClick={() => setBloqueio(null)}>
            Agora não
          </button>
        </div>
      </Modal>
    </div>
  );
}

'use client';

// Atendimento (chat com a equipe): uma conversa contínua por membro; o jogador escreve aqui e a equipe responde
// pelo painel. Atualiza a cada 5 s com a tela aberta (abrir a conversa zera as não lidas do jogador).
// Visual (DIRECAO_DE_ARTE 4): cabeçalho de tela com o balão ilustrado; o Seu Juca apresenta o chat quando ainda
// não há mensagens; bolhas contornadas (jogador à direita em azul-céu; equipe à esquerda em pergaminho, com o
// nome do atendente e o selo "Equipe"; sistema centralizado e discreto), separadores por dia e a caixa de
// mensagem presa acima das abas (num portal: não "pula" durante o deslize da troca de tela; sobe com o teclado).
import { MensagemSuporteBody, type ConversaSuporteDTO, type MensagemSuporteDTO } from '@galinheiro/api-contract';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown, BadgeCheck, Check, CheckCheck, ChevronLeft, CircleAlert, Clock3, Info, RotateCcw, SendHorizontal, WifiOff, X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { chamar } from '../api';
import { Juca } from '../arte/Juca';
import { IconeAtendimento } from '../avisos/IconeAtendimento';
import { CHAVE_SUPORTE, zerarNaoLidasNoCache } from '../avisos/consultas';
import { useMontado } from '../componentes/ShellJogo';
import { useConexao } from '../conexao';
import { MOLA, SAIDA } from '../movimento';
import { agoraServidor } from '../relogio';
import { som } from '../som';
import { mensagemDeErro } from '../util';

/** Limite do contrato (MensagemSuporteBody). */
const LIMITE = 2000;
const PERTO_DO_LIMITE = 1800;
const INTERVALO_MS = 5_000;
/** Mensagens seguidas do mesmo autor, até 5 min de distância, formam um grupo (nome e avatar uma vez só). */
const JANELA_GRUPO_MS = 5 * 60_000;
/** Altura máxima da caixa de texto antes de rolar por dentro (~5 linhas). */
const ALTURA_MAX_CAMPO = 132;
/** "Perto do fim": mensagem nova rola sozinha; mais acima, aparece o aviso "Nova mensagem". */
const PERTO_DO_FIM_PX = 140;

const SUGESTOES = [
  { rotulo: 'Tenho uma dúvida', texto: 'Olá! Tenho uma dúvida: ' },
  { rotulo: 'Encontrei um problema', texto: 'Olá! Encontrei um problema: ' },
  { rotulo: 'Quero dar uma sugestão', texto: 'Olá! Tenho uma sugestão: ' },
];

/** Mensagem otimista: aparece na hora e vira a do servidor quando o envio confirma. */
interface Pendente {
  chave: string;
  texto: string;
  criadoEm: string;
  estado: 'enviando' | 'erro';
  erro?: string;
}

type ItemChat =
  | { tipo: 'dia'; chave: string; rotulo: string }
  | { tipo: 'msg'; chave: string; m: MensagemSuporteDTO; pendente?: Pendente; inicio: boolean; fim: boolean };

let sequenciaLocal = 0;

// ---------------------------------------------------------------- datas e agrupamento

const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const DIA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
const DIA_ANO = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** "Hoje", "Ontem", "Sábado, 3 de out." ou, de outro ano, "3 de out. de 2025". */
function rotuloDia(d: Date, agora: Date): string {
  if (chaveDia(d) === chaveDia(agora)) return 'Hoje';
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (chaveDia(d) === chaveDia(ontem)) return 'Ontem';
  const t = d.getFullYear() === agora.getFullYear() ? DIA.format(d) : DIA_ANO.format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const mesmoGrupo = (a: MensagemSuporteDTO, b: MensagemSuporteDTO): boolean =>
  a.autor === b.autor &&
  a.autor !== 'sistema' &&
  (a.adminNome ?? '') === (b.adminNome ?? '') &&
  chaveDia(new Date(a.criadoEm)) === chaveDia(new Date(b.criadoEm)) &&
  Date.parse(b.criadoEm) - Date.parse(a.criadoEm) < JANELA_GRUPO_MS;

/** Mensagens do servidor + otimistas, com separadores de dia e marcas de início/fim de grupo. */
function montarItens(mensagens: MensagemSuporteDTO[], pendentes: Pendente[], chaves: Map<number, string>): ItemChat[] {
  const todas: { chave: string; m: MensagemSuporteDTO; pendente?: Pendente }[] = [
    ...mensagens.map((m) => ({ chave: chaves.get(m.id) ?? `s${m.id}`, m })),
    ...pendentes.map((p) => ({ chave: p.chave, m: { id: -1, autor: 'jogador' as const, texto: p.texto, criadoEm: p.criadoEm }, pendente: p })),
  ];
  // "Hoje"/"Ontem" pelo relógio do servidor (o do aparelho pode estar errado), como o resto do jogo
  const agora = new Date(agoraServidor());
  const itens: ItemChat[] = [];
  let diaAnterior = '';
  todas.forEach((x, i) => {
    const d = new Date(x.m.criadoEm);
    const dia = chaveDia(d);
    if (dia !== diaAnterior) {
      itens.push({ tipo: 'dia', chave: `d${dia}`, rotulo: rotuloDia(d, agora) });
      diaAnterior = dia;
    }
    const antes = todas[i - 1];
    const depois = todas[i + 1];
    itens.push({ tipo: 'msg', ...x, inicio: !antes || !mesmoGrupo(antes.m, x.m), fim: !depois || !mesmoGrupo(x.m, depois.m) });
  });
  return itens;
}

const primeiroNome = (nome: string | null | undefined): string => nome?.trim().split(/\s+/)[0] || 'Equipe';

// links https viram clicáveis (abrem em outra aba); pontuação final fica fora do link
const URL_HTTPS = /(https:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]}])/;
function comLinks(texto: string): ReactNode[] {
  return texto.split(URL_HTTPS).map((parte, i) =>
    i % 2 === 1 ? (
      <a key={i} href={parte} target="_blank" rel="noopener noreferrer nofollow" className="suporte-link">
        {parte}
      </a>
    ) : (
      parte
    ),
  );
}

// ---------------------------------------------------------------- ganchos de tela

/** Quanto o teclado virtual cobre a tela (px), pelo visualViewport. 0 = fechado (ou sem suporte). */
function useTeclado(): number {
  const [cobre, setCobre] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const medir = () => {
      const bruto = window.innerHeight - vv.height - vv.offsetTop;
      // com zoom de pinça não é teclado; barras do navegador mexem só alguns px
      setCobre(Math.abs(vv.scale - 1) < 0.01 && bruto > 80 ? Math.round(bruto) : 0);
    };
    medir();
    vv.addEventListener('resize', medir);
    vv.addEventListener('scroll', medir);
    return () => {
      vv.removeEventListener('resize', medir);
      vv.removeEventListener('scroll', medir);
    };
  }, []);
  return cobre;
}

const reduzirMovimento = () => document.documentElement.classList.contains('reduzir-movimento');

// ---------------------------------------------------------------- peças

/** Seu Juca apresentando o atendimento (conversa vazia) + atalhos que já começam a mensagem. */
function Apresentacao({ aoEscolher }: { aoEscolher: (texto: string) => void }) {
  const [falando, setFalando] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setFalando(false), 3600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="suporte-apresentacao">
      <div className="balao-juca">
        <motion.div
          className="balao-juca-figura"
          style={{ transformOrigin: '50% 100%' }}
          initial={{ scale: 0.4, y: 24 }}
          animate={{ scale: 1, y: 0, transition: { type: 'spring', visualDuration: 0.34, bounce: 0.45 } }}
        >
          <Juca expressao={falando ? 'falando' : 'feliz'} sombra={false} />
        </motion.div>
        <motion.div
          className="painel balao"
          style={{ transformOrigin: '0% 85%' }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: { delay: 0.1, duration: 0.32, ease: [0.34, 1.56, 0.64, 1] } }}
        >
          <span className="pilula pilula-aviso balao-nome">Seu Juca</span>
          <p className="balao-texto">
            Fale com a equipe do Galinheiro! Conte sua dúvida, problema ou sugestão aqui embaixo. Quando responderem, eu te aviso.
          </p>
        </motion.div>
      </div>
      <p className="texto-contorno suporte-sugestoes-titulo">Comece por aqui</p>
      <div className="suporte-sugestoes">
        {SUGESTOES.map((s) => (
          <button key={s.rotulo} type="button" className="botao botao-secundario botao-p" onClick={() => aoEscolher(s.texto)}>
            {s.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Topo da conversa: quem atende do outro lado. */
function TopoConversa() {
  return (
    <div className="suporte-topo">
      <span className="suporte-topo-juca" aria-hidden>
        <Juca expressao="feliz" sombra={false} parado />
      </span>
      <span className="min-w-0">
        <span className="suporte-topo-titulo">Equipe do Galinheiro</span>
        <span className="suporte-topo-texto">A gente responde por aqui, o quanto antes.</span>
      </span>
    </div>
  );
}

function StatusEnvio({ pendente }: { pendente?: Pendente }) {
  if (pendente?.estado === 'enviando') return <Clock3 aria-label="Enviando" />;
  if (pendente?.estado === 'erro') return <CircleAlert aria-label="Não enviada" />;
  return <Check aria-label="Enviada" />;
}

function Mensagem({
  item,
  animar,
  aoReenviar,
  aoDescartar,
}: {
  item: Extract<ItemChat, { tipo: 'msg' }>;
  animar: boolean;
  aoReenviar: (p: Pendente) => void;
  aoDescartar: (p: Pendente) => void;
}) {
  const { m, pendente, inicio, fim } = item;
  const hora = HORA.format(new Date(m.criadoEm));

  if (m.autor === 'sistema') {
    return (
      <motion.div
        className="suporte-sistema"
        initial={animar ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.24, delay: 0.25 } }}
      >
        <Info aria-hidden />
        <p>
          <span className="sr-only">Aviso automático: </span>
          {m.texto}
          <time dateTime={m.criadoEm}>{hora}</time>
        </p>
      </motion.div>
    );
  }

  const equipe = m.autor === 'admin';
  const nome = primeiroNome(m.adminNome);
  return (
    <motion.div
      className="suporte-linha"
      data-autor={m.autor}
      data-inicio={inicio ? '' : undefined}
      data-fim={fim ? '' : undefined}
      data-estado={pendente?.estado}
      style={{ transformOrigin: equipe ? '0% 100%' : '100% 100%' }}
      initial={animar ? { opacity: 0, y: 10, scale: 0.9 } : false}
      animate={{ opacity: 1, y: 0, scale: 1, transition: MOLA.aviso }}
    >
      {equipe &&
        (inicio ? (
          <span className="suporte-avatar" aria-hidden>
            {nome.charAt(0).toUpperCase()}
          </span>
        ) : (
          <span className="suporte-avatar-vao" aria-hidden />
        ))}
      <div className="suporte-coluna">
        {equipe && inicio && (
          <p className="suporte-autor" aria-hidden>
            <span className="texto-contorno suporte-autor-nome">{nome}</span>
            <span className="pilula suporte-selo">
              <BadgeCheck />
              Equipe
            </span>
          </p>
        )}
        <div className="suporte-bolha">
          <p className="suporte-texto">
            <span className="sr-only">{equipe ? `${nome}, da equipe: ` : 'Você: '}</span>
            {comLinks(m.texto)}
            <span className="suporte-meta-reserva" aria-hidden />
          </p>
          <span className="suporte-meta">
            {pendente?.estado === 'erro' ? <span>Não enviada</span> : <time dateTime={m.criadoEm}>{hora}</time>}
            {!equipe && <StatusEnvio pendente={pendente} />}
          </span>
        </div>
        {pendente?.estado === 'erro' && (
          <div className="suporte-falhou" role="alert">
            <span className="sr-only">Mensagem não enviada. </span>
            <button type="button" className="suporte-falhou-acao" onClick={() => aoReenviar(pendente)}>
              <RotateCcw aria-hidden />
              Tentar de novo
            </button>
            <button type="button" className="suporte-falhou-descartar" onClick={() => aoDescartar(pendente)} aria-label="Descartar mensagem">
              <X aria-hidden />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Esqueleto() {
  return (
    <div className="suporte-esqueleto" role="status">
      <span className="sr-only">Carregando a conversa…</span>
      <span aria-hidden />
      <span aria-hidden />
      <span aria-hidden />
    </div>
  );
}

interface PropsCaixa {
  texto: string;
  aoMudar: (t: string) => void;
  aoEnviar: () => void;
  enviando: boolean;
  online: boolean;
  falhaAoAtualizar: boolean;
  novas: boolean;
  aoVerNovas: () => void;
  teclado: number;
  refCampo: RefObject<HTMLTextAreaElement | null>;
  refCaixa: RefObject<HTMLDivElement | null>;
}

/** Caixa de mensagem presa acima das abas (ou do teclado). Enter envia; Shift+Enter quebra a linha. */
function CaixaMensagem({ texto, aoMudar, aoEnviar, enviando, online, falhaAoAtualizar, novas, aoVerNovas, teclado, refCampo, refCaixa }: PropsCaixa) {
  const tamanho = texto.length;
  const vazio = texto.trim().length === 0;
  const podeEnviar = !enviando && !vazio && online;

  // a caixa cresce com o texto (até ~5 linhas) e volta a 1 linha ao enviar
  useLayoutEffect(() => {
    const el = refCampo.current;
    if (!el) return;
    el.style.height = 'auto';
    const borda = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(el.scrollHeight + borda, ALTURA_MAX_CAMPO)}px`;
  }, [texto, refCampo]);

  return (
    <motion.div
      ref={refCaixa}
      className="suporte-caixa"
      // teclado aberto: a caixa encosta nele (as abas ficam escondidas atrás do teclado)
      style={{ ['--teclado' as string]: `${teclado}px` }}
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: MOLA.folha }}
    >
      <div className="suporte-caixa-miolo">
        <AnimatePresence>
          {novas && (
            <motion.button
              type="button"
              className="suporte-novas"
              onClick={aoVerNovas}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: MOLA.aviso }}
              exit={{ opacity: 0, y: 6, transition: SAIDA }}
            >
              <ArrowDown aria-hidden />
              Nova mensagem
            </motion.button>
          )}
        </AnimatePresence>
        <form
          className="suporte-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (podeEnviar) aoEnviar();
          }}
        >
          <textarea
            ref={refCampo}
            className="campo suporte-campo"
            rows={1}
            value={texto}
            maxLength={LIMITE}
            onChange={(e) => aoMudar(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (podeEnviar) aoEnviar();
              }
            }}
            placeholder="Escreva sua mensagem…"
            enterKeyHint="send"
            aria-label="Mensagem para a equipe"
            aria-describedby="suporte-contador"
          />
          <button
            type="submit"
            className="botao botao-primario botao-icone suporte-enviar"
            disabled={!podeEnviar}
            aria-busy={enviando || undefined}
            aria-label={enviando ? 'Enviando…' : 'Enviar mensagem'}
          >
            <span className="icone-contorno" aria-hidden>
              <SendHorizontal />
              <SendHorizontal />
            </span>
          </button>
        </form>
        <div className="suporte-caixa-rodape">
          {!online ? (
            <span className="suporte-dica" data-tipo="erro" role="status">
              <WifiOff aria-hidden />
              Sem conexão
            </span>
          ) : falhaAoAtualizar ? (
            <span className="suporte-dica" data-tipo="erro" role="status">
              <CircleAlert aria-hidden />
              Reconectando…
            </span>
          ) : (
            <span className="suporte-dica suporte-dica-teclado">Enter envia · Shift+Enter pula linha</span>
          )}
          <span
            id="suporte-contador"
            className="suporte-contador numeros"
            data-perto={tamanho >= PERTO_DO_LIMITE ? '' : undefined}
            data-limite={tamanho >= LIMITE ? '' : undefined}
          >
            {tamanho}/{LIMITE}
            <span className="sr-only"> caracteres</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------- tela

export function TelaSuporte() {
  const qc = useQueryClient();
  const montado = useMontado();
  const online = useConexao((s) => s.online);
  const [texto, setTexto] = useState('');
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  // id da mensagem no servidor → chave da bolha otimista (a bolha confirmada não remonta nem anima de novo)
  const chaves = useRef(new Map<number, string>());
  const refCampo = useRef<HTMLTextAreaElement>(null);
  const refCaixa = useRef<HTMLDivElement>(null);
  const [alturaCaixa, setAlturaCaixa] = useState(84);
  const [alturaAbas, setAlturaAbas] = useState(70);
  const teclado = useTeclado();

  const conversa = useQuery({
    queryKey: CHAVE_SUPORTE,
    queryFn: async () => {
      const r = await chamar<ConversaSuporteDTO>('GET', '/suporte');
      zerarNaoLidasNoCache(qc);
      return r.data;
    },
    // enquanto envia, a consulta pausa (a resposta do envio já traz a conversa)
    refetchInterval: enviando ? false : INTERVALO_MS,
    refetchOnWindowFocus: true,
    staleTime: 2_000,
    retry: false,
  });
  const dados = conversa.data;
  const mensagens = useMemo(() => dados?.mensagens ?? [], [dados]);
  const itens = useMemo(() => montarItens(mensagens, pendentes, chaves.current), [mensagens, pendentes]);
  const vazia = !!dados && mensagens.length === 0 && pendentes.length === 0;
  const carregada = !!dados;

  // ------------------------------------------------ envio (otimista)
  const enviar = useCallback(
    async (bruto: string, doCampo: boolean) => {
      const validado = MensagemSuporteBody.safeParse({ texto: bruto });
      if (!validado.success || enviandoRef.current) return;
      const corpo = validado.data;
      enviandoRef.current = true;
      setEnviando(true);
      const local: Pendente = { chave: `p${++sequenciaLocal}`, texto: corpo.texto, criadoEm: new Date(agoraServidor()).toISOString(), estado: 'enviando' };
      setPendentes((p) => [...p, local]);
      if (doCampo) setTexto('');
      som.toque();
      await qc.cancelQueries({ queryKey: CHAVE_SUPORTE });
      try {
        const r = await chamar<ConversaSuporteDTO>('POST', '/suporte', { corpo });
        const usados = new Set(chaves.current.keys());
        const minha = [...r.data.mensagens].reverse().find((m) => m.autor === 'jogador' && m.texto === corpo.texto && !usados.has(m.id));
        if (minha) chaves.current.set(minha.id, local.chave);
        qc.setQueryData(CHAVE_SUPORTE, r.data);
        zerarNaoLidasNoCache(qc);
        setPendentes((p) => p.filter((x) => x.chave !== local.chave));
      } catch (erro) {
        setPendentes((p) => p.map((x) => (x.chave === local.chave ? { ...x, estado: 'erro', erro: mensagemDeErro(erro) } : x)));
        som.erro();
      } finally {
        enviandoRef.current = false;
        setEnviando(false);
      }
    },
    [qc],
  );

  const reenviar = useCallback(
    (p: Pendente) => {
      if (enviandoRef.current) return;
      setPendentes((lista) => lista.filter((x) => x.chave !== p.chave));
      void enviar(p.texto, false);
    },
    [enviar],
  );
  const descartar = useCallback((p: Pendente) => setPendentes((lista) => lista.filter((x) => x.chave !== p.chave)), []);

  const escolherSugestao = useCallback((t: string) => {
    setTexto(t);
    requestAnimationFrame(() => {
      const el = refCampo.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(t.length, t.length);
    });
  }, []);

  // ------------------------------------------------ rolagem: começa no fim; mensagem nova rola se você estiver lá
  const pertoDoFim = useRef(true);
  // durante a rolagem suave até o fim, os eventos de rolagem do caminho não contam como "saiu do fim"
  const descendoAte = useRef(0);
  const [novas, setNovas] = useState(false);
  const irAoFim = useCallback((suave: boolean) => {
    const comAnimacao = suave && !reduzirMovimento();
    descendoAte.current = comAnimacao ? performance.now() + 800 : 0;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: comAnimacao ? 'smooth' : 'instant' });
    pertoDoFim.current = true;
    setNovas(false);
  }, []);

  useEffect(() => {
    const medir = () => {
      if (performance.now() < descendoAte.current) return;
      const doc = document.documentElement;
      pertoDoFim.current = window.scrollY + window.innerHeight >= doc.scrollHeight - PERTO_DO_FIM_PX;
      if (pertoDoFim.current) setNovas(false);
    };
    window.addEventListener('scroll', medir, { passive: true });
    return () => window.removeEventListener('scroll', medir);
  }, []);

  const total = mensagens.length + pendentes.length;
  const ultima = itens[itens.length - 1];
  const ultimoAutor = ultima?.tipo === 'msg' ? ultima.m.autor : null;
  const jaRolou = useRef(false);
  const totalAntes = useRef(0);
  useEffect(() => {
    if (!carregada) return;
    if (!jaRolou.current) {
      // conversa vazia: fica no topo, com a apresentação do Seu Juca à vista
      if (total === 0) return;
      jaRolou.current = true;
      totalAntes.current = total;
      // 2 quadros: depois do commit e do "volta ao topo" da navegação do Next
      requestAnimationFrame(() => requestAnimationFrame(() => irAoFim(false)));
      return;
    }
    if (total > totalAntes.current) {
      // a sua mensagem sempre desce até o fim; a da equipe só avisa se você estiver lendo lá em cima
      if (ultimoAutor === 'jogador') requestAnimationFrame(() => irAoFim(true));
      else if (!pertoDoFim.current) setNovas(true);
    }
    totalAntes.current = total;
  }, [carregada, total, ultimoAutor, irAoFim]);

  // Quem está no fim continua no fim quando algo cresce (bolha nova, "Não enviada", caixa de texto maior).
  const refTela = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = refTela.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (jaRolou.current && pertoDoFim.current) irAoFim(false);
    });
    // border-box: a reserva da caixa de mensagem é padding (o content-box não mudaria)
    ro.observe(el, { box: 'border-box' });
    return () => ro.disconnect();
  }, [irAoFim]);

  // bolhas que chegam depois da 1ª pintura entram com pop (as já existentes não animam)
  const [animar, setAnimar] = useState(false);
  useEffect(() => {
    if (carregada) setAnimar(true);
  }, [carregada]);

  // "blip" quando chega resposta da equipe com a tela aberta
  const ultimaDaEquipe = useRef<number | null>(null);
  useEffect(() => {
    if (!dados) return;
    const maior = dados.mensagens.reduce((a, m) => (m.autor === 'admin' ? Math.max(a, m.id) : a), 0);
    if (ultimaDaEquipe.current !== null && maior > ultimaDaEquipe.current) som.abrir();
    ultimaDaEquipe.current = maior;
  }, [dados]);

  // ------------------------------------------------ caixa fixa: reserva de espaço e teclado
  useEffect(() => {
    const caixa = refCaixa.current;
    const abas = document.querySelector<HTMLElement>('.abas');
    const ro = new ResizeObserver(() => {
      if (caixa) setAlturaCaixa(caixa.offsetHeight);
      if (abas) setAlturaAbas(abas.offsetHeight);
    });
    if (caixa) ro.observe(caixa);
    if (abas) ro.observe(abas);
    return () => ro.disconnect();
  }, [montado]);

  // no computador o cursor já vem na caixa de texto (no celular não: abriria o teclado sem pedir)
  useEffect(() => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) refCampo.current?.focus({ preventScroll: true });
  }, [montado]);

  const reserva = alturaCaixa + 18 + Math.max(0, teclado - alturaAbas);
  const resolvida = dados?.status === 'resolvida' && mensagens.length > 0 && pendentes.length === 0;

  return (
    <div ref={refTela} className="tela suporte-tela" style={{ paddingBottom: reserva }}>
      <div className="tela-cabeca">
        <Link href="/ajustes" className="botao botao-icone botao-secundario tela-cabeca-voltar" aria-label="Voltar para as configurações">
          <ChevronLeft strokeWidth={3} />
        </Link>
        <IconeAtendimento className="tela-cabeca-icone" />
        <h1 className="titulo-tela">Atendimento</h1>
      </div>

      {!carregada ? (
        conversa.isError ? (
          <div className="painel suporte-erro" role="alert">
            <Juca expressao="surpreso" sombra={false} className="suporte-erro-juca" />
            <p className="suporte-erro-titulo">Não consegui abrir o atendimento.</p>
            <p className="suporte-erro-texto">{online ? mensagemDeErro(conversa.error) : 'Sem conexão com a internet.'}</p>
            <button type="button" className="botao botao-primario mt-2" onClick={() => void conversa.refetch()} disabled={conversa.isFetching}>
              {conversa.isFetching ? 'Tentando…' : 'Tentar de novo'}
            </button>
          </div>
        ) : (
          <Esqueleto />
        )
      ) : vazia ? (
        <Apresentacao aoEscolher={escolherSugestao} />
      ) : (
        <>
          <TopoConversa />
          <div className="suporte-lista" role="log" aria-live="polite" aria-label="Mensagens do atendimento">
            {itens.map((item) =>
              item.tipo === 'dia' ? (
                <p key={item.chave} className="suporte-dia">
                  {item.rotulo}
                </p>
              ) : (
                <Mensagem key={item.chave} item={item} animar={animar} aoReenviar={reenviar} aoDescartar={descartar} />
              ),
            )}
            {resolvida && (
              <div className="suporte-sistema" data-tipo="resolvida">
                <CheckCheck aria-hidden />
                <p>Atendimento concluído. Precisa de mais alguma coisa? É só escrever.</p>
              </div>
            )}
          </div>
        </>
      )}

      {montado &&
        createPortal(
          <CaixaMensagem
            texto={texto}
            aoMudar={setTexto}
            aoEnviar={() => void enviar(texto, true)}
            enviando={enviando}
            online={online}
            falhaAoAtualizar={carregada && conversa.isError}
            novas={novas}
            aoVerNovas={() => irAoFim(true)}
            teclado={teclado}
            refCampo={refCampo}
            refCaixa={refCaixa}
          />,
          document.body,
        )}
    </div>
  );
}

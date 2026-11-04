'use client';

// Conversa aberta no atendimento: cabeçalho com os contatos do membro (e-mail, telefone, WhatsApp e ficha) e o
// botão Resolver/Reabrir; mensagens em bolhas (membro à esquerda, equipe à direita com o nome de quem respondeu,
// sistema no meio, discreto) separadas por dia; caixa de resposta (Enter envia, Shift+Enter quebra linha) com
// respostas rápidas. Atualiza a cada 5 s sem tirar o admin do ponto em que está lendo.
import { formatarTelefone, type AdminConversaDTO, type MensagemSuporteDTO } from '@galinheiro/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, Bot, CheckCheck, Mail, MessageCircle, Phone, RotateCcw, SendHorizontal, UserRound, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { chamar, ErroApi } from '../../api';
import { toast } from '../../ui';
import { cx } from '../../util';
import { BotaoAdm, Carregando, mensagemAdmin, Selo, Vazio } from '../ui';
import { Avatar } from './Avatar';
import { dataCompleta, hora, chaveDia, linkTelefone, linkWhatsApp, primeiroNome, RESPOSTAS_RAPIDAS, rotuloDia, useAgoraLento } from './util';

export const LIMITE_TEXTO = 2000;
export const chaveConversa = (id: string) => ['admin', 'suporte', 'conversa', id] as const;
/** id da bolha provisória (resposta ainda indo para o servidor) */
const ID_ENVIANDO = -1;

/** Rascunhos por conversa (trocar de conversa não perde o que estava escrito). */
const rascunhos = new Map<string, string>();

type Item =
  | { tipo: 'dia'; chave: string; rotulo: string }
  | { tipo: 'msg'; msg: MensagemSuporteDTO; inicioGrupo: boolean; enviando?: boolean };

/** Monta a lista do chat: separador a cada dia novo e "início de grupo" quando muda quem fala (ou passa 10 min). */
function montarItens(mensagens: MensagemSuporteDTO[], agora: number): Item[] {
  const itens: Item[] = [];
  let diaAnterior = '';
  let anterior: MensagemSuporteDTO | null = null;
  for (const m of mensagens) {
    const ms = Date.parse(m.criadoEm);
    const dia = chaveDia(ms);
    const novoDia = dia !== diaAnterior;
    if (novoDia) {
      itens.push({ tipo: 'dia', chave: `dia-${dia}`, rotulo: rotuloDia(m.criadoEm, agora) });
      diaAnterior = dia;
    }
    const inicioGrupo =
      novoDia ||
      !anterior ||
      anterior.autor !== m.autor ||
      (m.autor === 'admin' && anterior.adminNome !== m.adminNome) ||
      ms - Date.parse(anterior.criadoEm) > 10 * 60_000;
    itens.push({ tipo: 'msg', msg: m, inicioGrupo, enviando: m.id === ID_ENVIANDO });
    anterior = m;
  }
  return itens;
}

function Bolha({ item, nomeMembro }: { item: Extract<Item, { tipo: 'msg' }>; nomeMembro: string }) {
  const { msg, inicioGrupo, enviando } = item;
  if (msg.autor === 'sistema') {
    return (
      <div className="atd-msg-sistema">
        <Bot className="h-3.5 w-3.5 flex-none" aria-hidden />
        <span>
          <span className="sr-only">Mensagem automática: </span>
          {msg.texto}
        </span>
        <time dateTime={msg.criadoEm} title={dataCompleta(msg.criadoEm)}>
          {hora(msg.criadoEm)}
        </time>
      </div>
    );
  }
  const equipe = msg.autor === 'admin';
  const autor = equipe ? (msg.adminNome ?? 'Equipe') : nomeMembro;
  return (
    <div className="atd-msg" data-autor={equipe ? 'equipe' : 'membro'} data-inicio={inicioGrupo || undefined} data-enviando={enviando || undefined}>
      {equipe && inicioGrupo && (
        <span className="atd-msg-autor">
          {autor} <span className="atd-msg-autor-papel">· equipe</span>
        </span>
      )}
      <div className="atd-bolha">
        <span className="sr-only">{equipe ? `${autor} (equipe)` : autor} disse: </span>
        <p className="atd-bolha-texto">{msg.texto}</p>
        <span className="atd-bolha-rodape">
          {enviando ? (
            'Enviando…'
          ) : (
            <time dateTime={msg.criadoEm} title={dataCompleta(msg.criadoEm)}>
              {hora(msg.criadoEm)}
            </time>
          )}
        </span>
      </div>
    </div>
  );
}

function RespostasRapidas({ nome, aoEscolher }: { nome: string; aoEscolher: (texto: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false);
        caixa.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    // foco no 1º item (teclado)
    caixa.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);
  const navegar = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const itens = [...(caixa.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const i = itens.indexOf(document.activeElement as HTMLButtonElement);
    itens[(i + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length]?.focus();
  };
  return (
    <div className="atd-rapidas" ref={caixa}>
      <BotaoAdm tamanho="p" variante="fantasma" aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto((a) => !a)} title="Respostas rápidas">
        <Zap className="h-4 w-4" aria-hidden />
        <span className="atd-rapidas-rotulo">Respostas rápidas</span>
      </BotaoAdm>
      {aberto && (
        <ul className="atd-rapidas-menu" role="menu" aria-label="Respostas rápidas" onKeyDown={navegar}>
          {RESPOSTAS_RAPIDAS.map((r) => {
            const texto = r.texto.replaceAll('{nome}', nome || 'tudo bem');
            return (
              <li key={r.titulo} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    aoEscolher(texto);
                    setAberto(false);
                  }}
                >
                  <strong>{r.titulo}</strong>
                  <span>{texto}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function PainelConversa({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const qc = useQueryClient();
  const agora = useAgoraLento(60_000);
  const consulta = useQuery({
    queryKey: chaveConversa(id),
    queryFn: async ({ signal }) => (await chamar<AdminConversaDTO>('GET', `/api/admin/suporte/${id}`, { sinal: signal })).data,
    refetchInterval: 5_000,
    retry: (falhas, erro) => !(erro instanceof ErroApi && erro.status === 404) && falhas < 1,
  });

  const atualizarListas = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'suporte', 'fila'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'suporte', 'contagem'] });
  };

  // abrir zera as não lidas no servidor: o contador do menu e a fila acompanham
  const carregou = consulta.isSuccess;
  useEffect(() => {
    if (carregou) atualizarListas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregou]);

  // ---------------------------------------------------------------- resposta
  const [texto, setTextoBruto] = useState(() => rascunhos.get(id) ?? '');
  const setTexto = (t: string) => {
    setTextoBruto(t);
    if (t) rascunhos.set(id, t);
    else rascunhos.delete(id);
  };
  const campo = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const t = campo.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight + 2, 180)}px`;
  }, [texto]);

  const enviar = useMutation({
    mutationFn: async (t: string) => (await chamar<AdminConversaDTO>('POST', `/api/admin/suporte/${id}/mensagens`, { corpo: { texto: t } })).data,
    // uma atualização automática em andamento (com a lista antiga) não pode sobrescrever a resposta nova
    onMutate: () => qc.cancelQueries({ queryKey: chaveConversa(id) }),
    onSuccess: (dados) => {
      qc.setQueryData(chaveConversa(id), dados);
      atualizarListas();
    },
    onError: (erro, t) => {
      toast(mensagemAdmin(erro), 'erro');
      // devolve o texto para a caixa (se o admin não começou outra mensagem)
      setTextoBruto((atual) => atual || t);
      rascunhos.set(id, t);
    },
  });

  const mudarStatus = useMutation({
    mutationFn: async (status: 'aberta' | 'resolvida') =>
      (await chamar<AdminConversaDTO>('PATCH', `/api/admin/suporte/${id}`, { corpo: { status } })).data,
    onMutate: () => qc.cancelQueries({ queryKey: chaveConversa(id) }),
    onSuccess: (dados, status) => {
      qc.setQueryData(chaveConversa(id), dados);
      atualizarListas();
      toast(status === 'resolvida' ? 'Conversa marcada como resolvida.' : 'Conversa reaberta.', 'sucesso');
    },
    onError: (erro) => toast(mensagemAdmin(erro), 'erro'),
  });

  const limpo = texto.trim();
  const longoDemais = texto.length > LIMITE_TEXTO;
  const podeEnviar = limpo.length > 0 && !longoDemais && !enviar.isPending;
  const submeter = () => {
    if (!podeEnviar) return;
    setTexto('');
    enviar.mutate(limpo);
    campo.current?.focus();
  };
  const aoTeclar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submeter();
    }
  };
  const inserirRapida = (t: string) => {
    const novo = texto.trim() ? `${texto.replace(/\s+$/, '')}\n${t}` : t;
    setTexto(novo);
    requestAnimationFrame(() => {
      const el = campo.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(novo.length, novo.length);
    });
  };

  // ---------------------------------------------------------------- rolagem
  const lista = useRef<HTMLDivElement>(null);
  const noFim = useRef(true);
  const ultimoVisto = useRef<number | null>(null);
  const [novas, setNovas] = useState(0);
  const mensagens = consulta.data?.mensagens;
  const ultimoId = mensagens?.at(-1)?.id ?? null;

  const rolarParaFim = (suave: boolean) => {
    const el = lista.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: suave ? 'smooth' : 'auto' });
    noFim.current = true;
    setNovas(0);
  };
  const aoRolar = () => {
    const el = lista.current;
    if (!el) return;
    noFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (noFim.current) setNovas(0);
  };

  useLayoutEffect(() => {
    if (ultimoId === null || !mensagens) return;
    const anterior = ultimoVisto.current;
    ultimoVisto.current = ultimoId;
    if (anterior === null) {
      // 1ª carga desta conversa: começa no fim
      rolarParaFim(false);
      return;
    }
    if (ultimoId === anterior) return;
    const chegaram = mensagens.filter((m) => m.id > anterior);
    if (chegaram.some((m) => m.autor === 'jogador')) atualizarListas();
    // quem está lendo mais acima não é puxado para baixo: aparece o aviso "novas mensagens"
    if (noFim.current || chegaram.every((m) => m.autor === 'admin')) rolarParaFim(true);
    else setNovas((n) => n + chegaram.filter((m) => m.autor !== 'admin').length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimoId]);

  // a mensagem sendo enviada aparece no fim na hora
  const enviando = enviar.isPending ? enviar.variables : undefined;
  useLayoutEffect(() => {
    if (enviando) rolarParaFim(true);
  }, [enviando]);

  // caixa de resposta crescendo (ou teclado do celular abrindo): quem estava no fim continua no fim
  useEffect(() => {
    const el = lista.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (noFim.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [carregou]);

  // ---------------------------------------------------------------- render
  const dados = consulta.data;
  if (!dados && !consulta.isError) {
    return (
      <div className="atd-conversa-estado">
        <Carregando texto="Abrindo a conversa…" />
      </div>
    );
  }
  if (!dados) {
    const naoExiste = consulta.error instanceof ErroApi && consulta.error.status === 404;
    return (
      <div className="atd-conversa-estado">
        <Vazio titulo={naoExiste ? 'Conversa não encontrada' : 'Não deu para abrir a conversa'}>
          <p>{naoExiste ? 'Ela pode ter sido apagada junto com a conta do membro.' : mensagemAdmin(consulta.error)}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <BotaoAdm tamanho="p" onClick={aoVoltar}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar para a fila
            </BotaoAdm>
            {!naoExiste && (
              <BotaoAdm tamanho="p" variante="primario" onClick={() => void consulta.refetch()}>
                Tentar de novo
              </BotaoAdm>
            )}
          </div>
        </Vazio>
      </div>
    );
  }

  const { conversa } = dados;
  const nome = conversa.nome || 'Membro sem nome';
  const aberta = conversa.status === 'aberta';
  // a resposta sendo enviada entra no fim (id -1) já com o visual de "enviando"
  const itens = montarItens(
    enviando
      ? [...dados.mensagens, { id: ID_ENVIANDO, autor: 'admin', texto: enviando, criadoEm: new Date().toISOString(), adminNome: 'Você' }]
      : dados.mensagens,
    agora,
  );
  const contador = texto.length;

  return (
    <>
      <header className="atd-conversa-cabeca">
        <button type="button" className="atd-voltar" onClick={aoVoltar} aria-label="Voltar para a fila">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <Avatar nome={nome} semente={conversa.contaId} tamanho="g" className="atd-conversa-avatar" />
        <div className="atd-conversa-titulo">
          <h2 className="atd-conversa-nome">{nome}</h2>
          <Selo tom={aberta ? 'verde' : 'neutro'}>{aberta ? 'Aberta' : 'Resolvida'}</Selo>
        </div>
        <ul className="atd-contatos" aria-label={`Contatos de ${nome}`}>
          {conversa.email && (
            <li>
              <a href={`mailto:${conversa.email}`} title={`Enviar e-mail para ${conversa.email}`}>
                <Mail aria-hidden />
                <span className="atd-contato-texto">{conversa.email}</span>
              </a>
            </li>
          )}
          {conversa.telefone && (
            <>
              <li>
                <a href={linkTelefone(conversa.telefone)} title="Ligar">
                  <Phone aria-hidden />
                  <span className="atd-contato-texto">{formatarTelefone(conversa.telefone)}</span>
                </a>
              </li>
              <li>
                <a href={linkWhatsApp(conversa.telefone)} target="_blank" rel="noopener noreferrer" title="Abrir no WhatsApp (outra aba)">
                  <MessageCircle aria-hidden />
                  <span className="atd-contato-texto">WhatsApp</span>
                </a>
              </li>
            </>
          )}
          <li className="atd-contato-ficha">
            <Link href={`/admin/usuarios/${conversa.contaId}`}>
              <UserRound aria-hidden />
              <span className="atd-contato-texto">Ver ficha</span>
            </Link>
          </li>
        </ul>
        <div className="atd-conversa-acoes">
          <Link
            href={`/admin/usuarios/${conversa.contaId}`}
            className="adm-botao atd-ficha"
            data-tamanho="p"
            title="Ver a ficha completa do membro"
            aria-label={`Ver ficha de ${nome}`}
          >
            <UserRound className="h-4 w-4" aria-hidden />
            <span className="atd-ficha-rotulo">Ver ficha</span>
          </Link>
          <BotaoAdm
            tamanho="p"
            variante={aberta ? 'primario' : 'secundario'}
            disabled={mudarStatus.isPending}
            onClick={() => mudarStatus.mutate(aberta ? 'resolvida' : 'aberta')}
            title={aberta ? 'Marcar como resolvida (sai da fila de abertas)' : 'Reabrir a conversa'}
          >
            {aberta ? <CheckCheck className="h-4 w-4" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
            {aberta ? 'Resolver' : 'Reabrir'}
          </BotaoAdm>
        </div>
      </header>

      <div className="atd-mensagens-caixa">
        <div ref={lista} className="atd-mensagens" onScroll={aoRolar} role="log" aria-label={`Mensagens com ${nome}`} tabIndex={0}>
          {itens.length === 0 ? (
            <p className="atd-mensagens-vazio">Ainda não há mensagens nesta conversa.</p>
          ) : (
            itens.map((it) =>
              it.tipo === 'dia' ? (
                <div key={it.chave} className="atd-dia" role="separator" aria-label={it.rotulo}>
                  <span>{it.rotulo}</span>
                </div>
              ) : (
                <Bolha key={it.msg.id} item={it} nomeMembro={nome} />
              ),
            )
          )}
        </div>
        {novas > 0 && (
          <button type="button" className="atd-novas" onClick={() => rolarParaFim(true)}>
            <ArrowDown className="h-4 w-4" aria-hidden />
            {novas === 1 ? '1 mensagem nova' : `${novas} mensagens novas`}
          </button>
        )}
      </div>

      <form
        className="atd-resposta"
        onSubmit={(e) => {
          e.preventDefault();
          submeter();
        }}
      >
        {!aberta && <p className="atd-resposta-aviso">Esta conversa está resolvida. Se você responder, ela volta para a fila de abertas.</p>}
        <div className={cx('atd-resposta-caixa', longoDemais && 'atd-resposta-erro')}>
          <label htmlFor={`resposta-${id}`} className="sr-only">
            Resposta para {nome}
          </label>
          <textarea
            id={`resposta-${id}`}
            ref={campo}
            className="atd-resposta-campo"
            rows={1}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder={`Responder ${primeiroNome(nome) || 'o membro'}…`}
            enterKeyHint="send"
            aria-describedby={`resposta-dica-${id}`}
            aria-invalid={longoDemais || undefined}
          />
          <div className="atd-resposta-barra">
            <RespostasRapidas nome={primeiroNome(nome)} aoEscolher={inserirRapida} />
            <span
              className="atd-contador"
              data-tom={longoDemais ? 'erro' : contador > LIMITE_TEXTO * 0.9 ? 'alerta' : undefined}
              aria-live={longoDemais ? 'polite' : 'off'}
            >
              {longoDemais ? `${contador - LIMITE_TEXTO} acima do limite · ` : ''}
              {contador.toLocaleString('pt-BR')}/{LIMITE_TEXTO.toLocaleString('pt-BR')}
            </span>
            <BotaoAdm type="submit" variante="primario" tamanho="p" disabled={!podeEnviar} aria-label="Enviar resposta">
              <SendHorizontal className="h-4 w-4" aria-hidden />
              <span className="atd-enviar-rotulo">Enviar</span>
            </BotaoAdm>
          </div>
        </div>
        <p id={`resposta-dica-${id}`} className="atd-resposta-dica">
          <kbd>Enter</kbd> envia · <kbd>Shift</kbd>+<kbd>Enter</kbd> quebra a linha
        </p>
      </form>
    </>
  );
}

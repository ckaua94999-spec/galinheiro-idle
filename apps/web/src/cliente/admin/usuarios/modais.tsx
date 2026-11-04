'use client';

// Modais de ação da ficha do membro. Cada um explica o que vai acontecer, pede motivo quando mexe no jogo
// (fica na auditoria), desabilita o botão enquanto envia e mostra o erro da API sem fechar. No sucesso:
// recarrega ficha/lista/auditoria, avisa (toast) e fecha. Saldo, ovos, tickets e animais vão com Idempotency-Key (um
// envio repetido pela rede não vale duas vezes). Os números mostrados ficam congelados no momento em que o
// modal abriu (é o que o admin viu ao decidir; o servidor confere de novo).
import {
  AdminEditarUsuarioBody, formatarTelefone, mascararTelefone, normalizarTelefone,
  type AdminCobrancaUsdtDTO, type AdminCodigoRecuperacaoDTO, type AdminConversaDTO, type AdminUsuarioDetalheDTO, type AdminUsuarioLinhaDTO,
} from '@galinheiro/api-contract';
import { ANIMAIS, CONFIG, ITENS, NOME_RARIDADE, NOME_TIPO, TIPOS, tipoDoItem, type Item, type Tipo } from '@galinheiro/game-core';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  ArrowRight, Ban, Banknote, CircleCheck, Coins, Copy, Gift, KeyRound, Layers, LockOpen, LogOut, MessageSquareText, Minus, Plus, Send, ShieldCheck, Trash,
  TriangleAlert, UserRound,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ErroApi, chamar } from '../../api';
import { FiguraAnimal } from '../../arte/Animal';
import { Moeda, Ovo } from '../../arte/Icones';
import { toast } from '../../ui';
import { COR_RARIDADE } from '../../util';
import { IconeTicket } from '../intercambio/comum';
import { textoTickets } from '../intercambio/formato';
import { BotaoAdm, Campo, ModalAdm, fmt, mensagemAdmin } from '../ui';
import {
  AcoesModal, Alerta, ErroModal, Segmentos, SugestoesMotivo, caminhoDaLista, copiar, lerMoedas, plural, primeiroNome, soDigitos, type AcaoFicha,
} from './comum';
import { nomeOvos } from './textos';

interface PropsModal {
  d: AdminUsuarioDetalheDTO;
  /** precisa ser estável (useCallback): o ModalAdm refaz o foco quando ela muda */
  aoFechar: () => void;
}

const MAX_AJUSTE_X100 = 100_000_000;
const MAX_OVOS = 100_000;
const MAX_TICKETS = 100_000;

const erroDoMotivo = (m: string): string | null => (m.trim().length < 3 ? 'Explique o motivo (mínimo 3 caracteres).' : null);

/** Tudo que muda depois de uma ação: a ficha e a lista de usuários, a auditoria e o resumo da visão geral. */
function recarregar(qc: QueryClient): Promise<unknown> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] }),
    qc.invalidateQueries({ queryKey: ['admin', 'auditoria'] }),
    qc.invalidateQueries({ queryKey: ['admin', 'resumo'] }),
  ]);
}

/**
 * Mutação de uma ação da ficha: recarrega e só então avisa (o modal fecha e o toast aparece com a ficha já
 * atualizada). O botão fica em "Enviando…" até lá.
 */
function useAcao<V, R>(executar: (v: V) => Promise<R>, sucesso: (r: R, v: V) => string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: executar,
    onSuccess: async (r, v) => {
      await recarregar(qc);
      toast(sucesso(r, v), 'sucesso', { duracaoMs: 4000 });
    },
  });
}

/** Foca um campo específico depois do foco automático do ModalAdm (que pega o 1º elemento focável). */
function useFocoInicial<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const t = window.setTimeout(() => ref.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, []);
  return ref;
}

function CampoMotivo({ valor, aoMudar, erro, rotulo = 'Motivo', dica = 'Fica registrado na auditoria do painel.', sugestoes, placeholder }: {
  valor: string;
  aoMudar: (v: string) => void;
  erro: string | null;
  rotulo?: string;
  dica?: string;
  sugestoes?: string[];
  placeholder?: string;
}) {
  return (
    <div className="adm-us-campo-motivo">
      <Campo rotulo={rotulo} erro={erro} dica={dica}>
        <input
          className="adm-input"
          type="text"
          value={valor}
          maxLength={300}
          autoComplete="off"
          placeholder={placeholder ?? 'Por que você está fazendo isso?'}
          aria-invalid={!!erro || undefined}
          onChange={(e) => aoMudar(e.target.value)}
        />
      </Campo>
      {sugestoes && <SugestoesMotivo opcoes={sugestoes} aoEscolher={aoMudar} />}
    </div>
  );
}

function Cancelar({ aoFechar }: { aoFechar: () => void }) {
  return (
    <BotaoAdm variante="fantasma" onClick={aoFechar}>
      Cancelar
    </BotaoAdm>
  );
}

// ---------------------------------------------------------------- perfil

type CampoPerfil = 'nome' | 'telefone' | 'email' | 'papel';
const CAMPOS_PERFIL: readonly CampoPerfil[] = ['nome', 'telefone', 'email', 'papel'];
/** As mensagens do schema falam com o jogador ("Digite seu nome"); no painel, com quem edita. */
const paraAdmin = (m: string): string => (m === 'Digite seu nome.' ? 'Digite o nome (pelo menos 2 letras).' : m);

export function ModalPerfil({ d: dAtual, proprio, aoFechar }: PropsModal & { proprio: boolean }) {
  const [d] = useState(dAtual);
  const u = d.usuario;
  const primeiro = primeiroNome(u.nome);
  const [nome, setNome] = useState(u.nome);
  const [telefone, setTelefone] = useState(formatarTelefone(u.telefone));
  const [email, setEmail] = useState(u.email);
  const [papel, setPapel] = useState(u.papel);
  const [tentou, setTentou] = useState(false);

  // só vai o que mudou (o servidor normaliza nome, telefone e e-mail)
  const corpo: { nome?: string; telefone?: string; email?: string; papel?: 'jogador' | 'admin' } = {};
  if (nome.trim().replace(/\s+/g, ' ') !== u.nome) corpo.nome = nome;
  if ((normalizarTelefone(telefone) ?? telefone) !== u.telefone) corpo.telefone = telefone;
  if (email.trim().toLowerCase() !== u.email.toLowerCase()) corpo.email = email;
  if (papel !== u.papel) corpo.papel = papel;
  const mudou = Object.keys(corpo).length > 0;

  // validação no aparelho com o MESMO schema do servidor (mesmas mensagens)
  const errosLocais: Partial<Record<CampoPerfil, string>> = {};
  const validacao = mudou ? AdminEditarUsuarioBody.safeParse(corpo) : null;
  if (validacao && !validacao.success) {
    for (const i of validacao.error.issues) {
      const c = i.path[0];
      if (typeof c === 'string' && (CAMPOS_PERFIL as readonly string[]).includes(c)) errosLocais[c as CampoPerfil] ??= paraAdmin(i.message);
    }
  }

  const m = useAcao(
    async (c: typeof corpo) => (await chamar<AdminUsuarioLinhaDTO>('PATCH', `/api/admin/usuarios/${u.id}`, { corpo: c })).data,
    (r) => `Perfil de ${primeiroNome(r.nome)} atualizado`,
  );

  // erros do servidor: e-mail/telefone de outro membro e validação vão para o campo certo
  const errosServidor: Partial<Record<CampoPerfil, string>> = {};
  let erroGeral: string | null = null;
  if (m.isError) {
    const e = m.error;
    if (e instanceof ErroApi && e.codigo === 'EMAIL_EM_USO') errosServidor.email = 'Esse e-mail já é de outro membro.';
    else if (e instanceof ErroApi && e.codigo === 'TELEFONE_EM_USO') errosServidor.telefone = 'Esse telefone já é de outro membro.';
    else if (e instanceof ErroApi && e.codigo === 'PAYLOAD_INVALIDO' && Array.isArray(e.detalhes?.issues)) {
      for (const i of e.detalhes.issues as { caminho?: string; mensagem?: string }[]) {
        const c = i.caminho?.split('.')[0];
        if (c && (CAMPOS_PERFIL as readonly string[]).includes(c)) errosServidor[c as CampoPerfil] ??= paraAdmin(i.mensagem ?? 'Valor inválido.');
        else erroGeral ??= i.mensagem ?? mensagemAdmin(e);
      }
    } else erroGeral = mensagemAdmin(e);
  }
  const erro = (c: CampoPerfil): string | null => errosServidor[c] ?? (tentou ? errosLocais[c] : undefined) ?? null;
  // mexeu num campo depois de um erro do servidor: some o aviso antigo
  const editar = <T,>(definir: (v: T) => void) => (v: T) => {
    definir(v);
    if (m.isError) m.reset();
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (!mudou || !validacao?.success || m.isPending) return;
    m.mutate(corpo, { onSuccess: aoFechar });
  };
  const travarPapel = proprio && u.papel === 'admin';

  return (
    <ModalAdm aberto titulo={`Editar perfil de ${u.nome}`} aoFechar={aoFechar}>
      <form className="adm-us-form" onSubmit={enviar} noValidate>
        <Campo rotulo="Nome" erro={erro('nome')}>
          <input className="adm-input" type="text" value={nome} maxLength={60} autoComplete="off" aria-invalid={!!erro('nome') || undefined} onChange={(e) => editar(setNome)(e.target.value)} />
        </Campo>
        <Campo rotulo="Telefone (com DDD)" erro={erro('telefone')} dica="Celular ou fixo do Brasil, ex.: (11) 98765-4321">
          <input
            className="adm-input tabular-nums"
            type="tel"
            inputMode="tel"
            value={telefone}
            autoComplete="off"
            placeholder="(11) 98765-4321"
            aria-invalid={!!erro('telefone') || undefined}
            onChange={(e) => editar(setTelefone)(mascararTelefone(e.target.value))}
          />
        </Campo>
        <Campo rotulo="E-mail" erro={erro('email')} dica="É com ele que o membro entra no jogo.">
          <input
            className="adm-input"
            type="email"
            inputMode="email"
            value={email}
            maxLength={254}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!erro('email') || undefined}
            onChange={(e) => editar(setEmail)(e.target.value)}
          />
        </Campo>
        <fieldset className="adm-us-opcoes">
          <legend className="adm-campo-rotulo">Papel</legend>
          <div className="adm-us-opcoes-grade" data-colunas="2">
            <label className="adm-us-opcao adm-us-opcao-linha" data-desabilitada={travarPapel || undefined}>
              <input type="radio" name="papel" className="sr-only" checked={papel === 'jogador'} disabled={travarPapel} onChange={() => editar(setPapel)('jogador')} />
              <UserRound className="adm-us-opcao-icone" aria-hidden />
              <span className="min-w-0">
                <span className="adm-us-opcao-nome">Jogador</span>
                <span className="adm-us-opcao-sub">Joga normalmente, sem acesso ao painel.</span>
              </span>
            </label>
            <label className="adm-us-opcao adm-us-opcao-linha">
              <input type="radio" name="papel" className="sr-only" checked={papel === 'admin'} onChange={() => editar(setPapel)('admin')} />
              <ShieldCheck className="adm-us-opcao-icone" aria-hidden />
              <span className="min-w-0">
                <span className="adm-us-opcao-nome">Administrador</span>
                <span className="adm-us-opcao-sub">Acesso total a este painel.</span>
              </span>
            </label>
          </div>
          {travarPapel && <p className="adm-campo-dica mt-1">Você não pode tirar o seu próprio acesso de administrador.</p>}
          {erro('papel') && <p className="adm-campo-erro mt-1">{erro('papel')}</p>}
        </fieldset>
        {papel !== u.papel &&
          (papel === 'admin' ? (
            <Alerta tom="ambar" icone={<TriangleAlert className="h-4 w-4" />}>
              {primeiro} vai poder ver e alterar todos os membros, responder o atendimento e publicar popups.
            </Alerta>
          ) : (
            <Alerta tom="azul" icone={<ShieldCheck className="h-4 w-4" />}>
              {primeiro} perde o acesso ao painel na hora (continua jogando normalmente).
            </Alerta>
          ))}
        <ErroModal texto={erroGeral} />
        <AcoesModal>
          <Cancelar aoFechar={aoFechar} />
          <BotaoAdm type="submit" variante="primario" disabled={!mudou || m.isPending}>
            {m.isPending ? 'Salvando…' : 'Salvar alterações'}
          </BotaoAdm>
        </AcoesModal>
      </form>
    </ModalAdm>
  );
}

// ---------------------------------------------------------------- saldo

export function ModalSaldo({ d: dAtual, sentidoInicial, aoFechar }: PropsModal & { sentidoInicial: 'creditar' | 'debitar' }) {
  const [d] = useState(dAtual);
  const u = d.usuario;
  const primeiro = primeiroNome(u.nome);
  const [sentido, setSentido] = useState(sentidoInicial);
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [tentou, setTentou] = useState(false);
  const campo = useFocoInicial<HTMLInputElement>();

  const credito = sentido === 'creditar';
  const centavos = lerMoedas(valor);
  const delta = centavos === null ? null : credito ? centavos : -centavos;
  const novo = delta === null ? null : u.moedasX100 + delta;
  const erroValor = !valor.trim()
    ? 'Informe o valor.'
    : centavos === null
      ? 'Valor inválido: use números, ex.: 12,50.'
      : centavos === 0
        ? 'O valor não pode ser zero.'
        : centavos > MAX_AJUSTE_X100
          ? 'Máximo de 1.000.000,00 por ajuste.'
          : novo !== null && novo < 0
            ? `O saldo ficaria negativo: ${primeiro} tem ${fmt.moedas(u.moedasX100)}.`
            : null;
  // enquanto digita, só os avisos de regra (zero, teto, saldo negativo); formato inválido aparece ao enviar
  const erroValorVisivel = tentou || (valor.trim() !== '' && centavos !== null) ? erroValor : null;
  const erroMotivo = erroDoMotivo(motivo);

  const m = useAcao(
    async (v: { valorX100: number; motivo: string }) =>
      (await chamar<{ saldoX100: number }>('POST', `/api/admin/usuarios/${u.id}/saldo`, { corpo: v, idempotente: true })).data,
    (r, v) => `${v.valorX100 > 0 ? '+' : '−'}${fmt.moedas(Math.abs(v.valorX100))} moedas ${v.valorX100 > 0 ? 'para' : 'de'} ${primeiro} · saldo ${fmt.moedas(r.saldoX100)}`,
  );
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (erroValor || erroMotivo || delta === null || m.isPending) return;
    m.mutate({ valorX100: delta, motivo: motivo.trim() }, { onSuccess: aoFechar });
  };

  return (
    <ModalAdm aberto titulo={credito ? `Creditar moedas para ${u.nome}` : `Debitar moedas de ${u.nome}`} aoFechar={aoFechar}>
      <form className="adm-us-form" onSubmit={enviar} noValidate>
        <Segmentos
          rotulo="Tipo de ajuste"
          valor={sentido}
          aoMudar={setSentido}
          opcoes={[
            { valor: 'creditar', tom: 'verde', rotulo: <><Plus className="h-4 w-4" aria-hidden /> Creditar</> },
            { valor: 'debitar', tom: 'vermelho', rotulo: <><Minus className="h-4 w-4" aria-hidden /> Debitar</> },
          ]}
        />
        <Campo rotulo="Valor (moedas do jogo)" erro={erroValorVisivel} dica="Use vírgula nos centavos. Ex.: 12,50">
          <span className="adm-us-campo-moeda">
            <Moeda className="adm-us-campo-moeda-icone" />
            <input
              ref={campo}
              className="adm-input tabular-nums"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              autoComplete="off"
              aria-invalid={!!erroValorVisivel || undefined}
              value={valor}
              onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, '').slice(0, 14))}
            />
          </span>
        </Campo>
        <div className="adm-us-sugestoes" aria-label="Valores rápidos">
          {[1_000, 5_000, 10_000, 50_000].map((v) => (
            <button key={v} type="button" className="adm-us-sugestao" onClick={() => setValor(fmt.moedas(v))}>
              {fmt.moedas(v)}
            </button>
          ))}
          {!credito && u.moedasX100 > 0 && (
            <button type="button" className="adm-us-sugestao" onClick={() => setValor(fmt.moedas(u.moedasX100))}>
              Saldo todo ({fmt.moedas(u.moedasX100)})
            </button>
          )}
        </div>
        <div className="adm-us-previa">
          <div>
            <span>Saldo atual</span>
            <strong>{fmt.moedas(u.moedasX100)}</strong>
          </div>
          <ArrowRight className="adm-us-previa-seta" aria-hidden />
          <div>
            <span>Depois do ajuste</span>
            <strong data-tom={novo === null || erroValor ? undefined : credito ? 'verde' : 'vermelho'}>
              {novo !== null && !erroValor ? fmt.moedas(novo) : '—'}
            </strong>
          </div>
        </div>
        <CampoMotivo
          valor={motivo}
          aoMudar={setMotivo}
          erro={tentou ? erroMotivo : null}
          dica="Fica na auditoria e no extrato do membro (só a equipe vê o motivo)."
          sugestoes={credito ? ['Compensação por falha no jogo', 'Prêmio de evento', 'Correção de saldo'] : ['Correção de saldo', 'Crédito dado por engano', 'Estorno de compensação']}
        />
        <ErroModal texto={m.isError ? mensagemAdmin(m.error) : null} />
        <AcoesModal>
          <Cancelar aoFechar={aoFechar} />
          <BotaoAdm type="submit" variante={credito ? 'primario' : 'perigo'} disabled={m.isPending}>
            {m.isPending ? 'Enviando…' : `${credito ? 'Creditar' : 'Debitar'}${centavos && !erroValor ? ` ${fmt.moedas(centavos)} moedas` : ''}`}
          </BotaoAdm>
        </AcoesModal>
      </form>
    </ModalAdm>
  );
}

// ---------------------------------------------------------------- ovos

export function ModalOvos({ d: dAtual, itemInicial, aoFechar }: PropsModal & { itemInicial?: Item }) {
  const [d] = useState(dAtual);
  const u = d.usuario;
  const inv = d.jogo.inventario;
  const primeiro = primeiroNome(u.nome);
  const [item, setItem] = useState<Item>(itemInicial ?? 'ovo_galinha');
  const [sentido, setSentido] = useState<'dar' | 'tirar'>('dar');
  const [qtd, setQtd] = useState('');
  const [motivo, setMotivo] = useState('');
  const [tentou, setTentou] = useState(false);
  const campo = useFocoInicial<HTMLInputElement>();

  const dar = sentido === 'dar';
  const n = qtd ? Number(qtd) : NaN;
  const delta = Number.isFinite(n) ? (dar ? n : -n) : null;
  const atual = inv[item];
  const novo = delta === null ? null : atual + delta;
  const erroQtd = !qtd
    ? 'Informe a quantidade.'
    : n < 1
      ? 'Use pelo menos 1 ovo.'
      : n > MAX_OVOS
        ? 'Máximo de 100.000 ovos por ajuste.'
        : novo !== null && novo < 0
          ? `O estoque ficaria negativo: ${primeiro} tem ${fmt.int(atual)} ${nomeOvos(item, atual)}.`
          : null;
  const erroMotivo = erroDoMotivo(motivo);

  const m = useAcao(
    async (v: { item: Item; quantidade: number; motivo: string }) =>
      (await chamar<{ ok: boolean }>('POST', `/api/admin/usuarios/${u.id}/ovos`, { corpo: v, idempotente: true })).data,
    (_, v) =>
      v.quantidade > 0
        ? `+${fmt.int(v.quantidade)} ${nomeOvos(v.item, v.quantidade)} para ${primeiro}`
        : `${fmt.int(-v.quantidade)} ${nomeOvos(v.item, -v.quantidade)} tirados de ${primeiro}`,
  );
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (erroQtd || erroMotivo || delta === null || m.isPending) return;
    m.mutate({ item, quantidade: delta, motivo: motivo.trim() }, { onSuccess: aoFechar });
  };

  return (
    <ModalAdm aberto titulo={`Ajustar ovos de ${u.nome}`} aoFechar={aoFechar}>
      <form className="adm-us-form" onSubmit={enviar} noValidate>
        <fieldset className="adm-us-opcoes">
          <legend className="adm-campo-rotulo">Ovo</legend>
          <div className="adm-us-opcoes-grade" data-colunas="4">
            {ITENS.map((i) => (
              <label key={i} className="adm-us-opcao">
                <input type="radio" name="ovo" className="sr-only" checked={item === i} onChange={() => setItem(i)} />
                <Ovo tipo={tipoDoItem(i)} className="h-8 w-8" />
                <span className="adm-us-opcao-nome">{NOME_TIPO[tipoDoItem(i)]}</span>
                <span className="adm-us-opcao-sub">{fmt.int(inv[i])} no estoque</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Segmentos
          rotulo="Dar ou tirar"
          valor={sentido}
          aoMudar={setSentido}
          opcoes={[
            { valor: 'dar', tom: 'verde', rotulo: <><Plus className="h-4 w-4" aria-hidden /> Dar ovos</> },
            { valor: 'tirar', tom: 'vermelho', rotulo: <><Minus className="h-4 w-4" aria-hidden /> Tirar ovos</> },
          ]}
        />
        <Campo rotulo="Quantidade" erro={tentou || qtd ? erroQtd : null}>
          <input
            ref={campo}
            className="adm-input tabular-nums"
            type="text"
            inputMode="numeric"
            placeholder="0"
            autoComplete="off"
            aria-invalid={((tentou || !!qtd) && !!erroQtd) || undefined}
            value={qtd}
            onChange={(e) => setQtd(soDigitos(e.target.value, 6))}
          />
        </Campo>
        <div className="adm-us-previa">
          <div>
            <span>Ovos de {NOME_TIPO[tipoDoItem(item)].toLowerCase()} agora</span>
            <strong>{fmt.int(atual)}</strong>
          </div>
          <ArrowRight className="adm-us-previa-seta" aria-hidden />
          <div>
            <span>Depois do ajuste</span>
            <strong data-tom={novo === null || erroQtd ? undefined : dar ? 'verde' : 'vermelho'}>{novo !== null && !erroQtd ? fmt.int(novo) : '—'}</strong>
          </div>
        </div>
        <CampoMotivo
          valor={motivo}
          aoMudar={setMotivo}
          erro={tentou ? erroMotivo : null}
          sugestoes={dar ? ['Ovos perdidos por falha', 'Prêmio de evento', 'Correção de estoque'] : ['Correção de estoque', 'Ovos dados por engano']}
        />
        <ErroModal texto={m.isError ? mensagemAdmin(m.error) : null} />
        <AcoesModal>
          <Cancelar aoFechar={aoFechar} />
          <BotaoAdm type="submit" variante={dar ? 'primario' : 'perigo'} disabled={m.isPending}>
            {m.isPending ? 'Enviando…' : `${dar ? 'Dar' : 'Tirar'}${n > 0 && !erroQtd ? ` ${fmt.int(n)} ${nomeOvos(item, n)}` : ' ovos'}`}
          </BotaoAdm>
        </AcoesModal>
      </form>
    </ModalAdm>
  );
}

// ---------------------------------------------------------------- tickets do Intercâmbio (vales do jogo)

export function ModalTickets({ d: dAtual, aoFechar }: PropsModal) {
  const [d] = useState(dAtual);
  const u = d.usuario;
  const primeiro = primeiroNome(u.nome);
  const saldo = d.tickets.saldo;
  const [sentido, setSentido] = useState<'creditar' | 'debitar'>('creditar');
  const [qtd, setQtd] = useState('');
  const [motivo, setMotivo] = useState('');
  const [tentou, setTentou] = useState(false);
  const campo = useFocoInicial<HTMLInputElement>();

  const credito = sentido === 'creditar';
  const n = qtd ? Number(qtd) : NaN;
  const delta = Number.isFinite(n) ? (credito ? n : -n) : null;
  const novo = delta === null ? null : saldo + delta;
  const erroQtd = !qtd
    ? 'Informe quantos tickets.'
    : n < 1
      ? 'Use pelo menos 1 ticket.'
      : n > MAX_TICKETS
        ? 'Máximo de 100.000 tickets por ajuste.'
        : novo !== null && novo < 0
          ? `O saldo ficaria negativo: ${primeiro} tem ${textoTickets(saldo)}.`
          : null;
  const erroMotivo = erroDoMotivo(motivo);

  const m = useAcao(
    async (v: { quantidade: number; motivo: string }) =>
      (await chamar<{ tickets: number }>('POST', `/api/admin/usuarios/${u.id}/tickets`, { corpo: v, idempotente: true })).data,
    (r, v) =>
      `${v.quantidade > 0 ? '+' : '−'}${textoTickets(Math.abs(v.quantidade))} ${v.quantidade > 0 ? 'para' : 'de'} ${primeiro} · saldo ${textoTickets(r.tickets)}`,
  );
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (erroQtd || erroMotivo || delta === null || m.isPending) return;
    m.mutate({ quantidade: delta, motivo: motivo.trim() }, { onSuccess: aoFechar });
  };

  return (
    <ModalAdm aberto titulo={credito ? `Creditar tickets para ${u.nome}` : `Debitar tickets de ${u.nome}`} aoFechar={aoFechar}>
      <form className="adm-us-form" onSubmit={enviar} noValidate>
        <Segmentos
          rotulo="Tipo de ajuste"
          valor={sentido}
          aoMudar={setSentido}
          opcoes={[
            { valor: 'creditar', tom: 'verde', rotulo: <><Plus className="h-4 w-4" aria-hidden /> Creditar</> },
            { valor: 'debitar', tom: 'vermelho', rotulo: <><Minus className="h-4 w-4" aria-hidden /> Debitar</> },
          ]}
        />
        <Campo rotulo="Quantidade de tickets" erro={tentou || qtd ? erroQtd : null} dica="Números inteiros. Tickets são vales do jogo.">
          <span className="adm-us-campo-moeda">
            <IconeTicket className="adm-us-campo-moeda-icone itc-campo-ticket" />
            <input
              ref={campo}
              className="adm-input tabular-nums"
              type="text"
              inputMode="numeric"
              placeholder="0"
              autoComplete="off"
              aria-invalid={((tentou || !!qtd) && !!erroQtd) || undefined}
              value={qtd}
              onChange={(e) => setQtd(soDigitos(e.target.value, 6))}
            />
          </span>
        </Campo>
        <div className="adm-us-sugestoes" aria-label="Quantidades rápidas">
          {[1, 5, 10, 50].map((v) => (
            <button key={v} type="button" className="adm-us-sugestao" onClick={() => setQtd(String(v))}>
              {textoTickets(v)}
            </button>
          ))}
          {!credito && saldo > 0 && (
            <button type="button" className="adm-us-sugestao" onClick={() => setQtd(String(saldo))}>
              Todos ({fmt.int(saldo)})
            </button>
          )}
        </div>
        <div className="adm-us-previa">
          <div>
            <span>Tickets agora</span>
            <strong>{fmt.int(saldo)}</strong>
          </div>
          <ArrowRight className="adm-us-previa-seta" aria-hidden />
          <div>
            <span>Depois do ajuste</span>
            <strong data-tom={novo === null || erroQtd ? undefined : credito ? 'verde' : 'vermelho'}>{novo !== null && !erroQtd ? fmt.int(novo) : '—'}</strong>
          </div>
        </div>
        <CampoMotivo
          valor={motivo}
          aoMudar={setMotivo}
          erro={tentou ? erroMotivo : null}
          dica="Fica na auditoria e no extrato de tickets do membro (só a equipe vê o motivo)."
          sugestoes={credito ? ['Prêmio de evento', 'Compensação por falha no jogo', 'Cupom que não funcionou'] : ['Correção de saldo', 'Tickets dados por engano']}
        />
        <ErroModal texto={m.isError ? mensagemAdmin(m.error) : null} />
        <AcoesModal>
          <Cancelar aoFechar={aoFechar} />
          <BotaoAdm type="submit" variante={credito ? 'primario' : 'perigo'} disabled={m.isPending}>
            {m.isPending ? 'Enviando…' : `${credito ? 'Creditar' : 'Debitar'}${n > 0 && !erroQtd ? ` ${textoTickets(n)}` : ' tickets'}`}
          </BotaoAdm>
        </AcoesModal>
      </form>
    </ModalAdm>
  );
}

// ---------------------------------------------------------------- nível

export function ModalNivel({ d: dAtual, aoFechar }: PropsModal) {
  const [d] = useState(dAtual);
  const u = d.usuario;
  const primeiro = primeiroNome(u.nome);
  const porNivel = CONFIG.galinheiro.ninhosPorNivel;
  const max = CONFIG.galinheiro.nivelMax;
  const ocupados = new Set(d.jogo.entidades.map((e) => e.slotId).filter((s): s is number => s !== null));
  const maiorSlot = Math.max(0, ...ocupados);
  const minimo = Math.max(1, Math.ceil(maiorSlot / porNivel));
  const [texto, setTexto] = useState(String(u.nivel));
  const [motivo, setMotivo] = useState('');
  const [tentou, setTentou] = useState(false);
  const campo = useFocoInicial<HTMLInputElement>();

  const nivel = Number(texto);
  const valido = Number.isInteger(nivel) && nivel >= 1 && nivel <= max;
  const erroNivel = !valido
    ? `Escolha um nível de 1 a ${max}.`
    : nivel === u.nivel
      ? 'Escolha um nível diferente do atual.'
      : nivel < minimo
        ? `Há animal no ninho ${maiorSlot}: o menor nível possível agora é ${minimo}.`
        : null;
  const erroMotivo = erroDoMotivo(motivo);
  const capAtual = d.jogo.capacidade;
  const capNova = valido ? nivel * porNivel : capAtual;
  const passo = (delta: number) => setTexto(String(Math.min(max, Math.max(1, (valido ? nivel : u.nivel) + delta))));

  const m = useAcao(
    async (v: { nivel: number; motivo: string }) => (await chamar<{ nivel: number }>('POST', `/api/admin/usuarios/${u.id}/nivel`, { corpo: v })).data,
    (r) => `Galinheiro de ${primeiro} agora no nível ${r.nivel} (${r.nivel * porNivel} ninhos)`,
  );
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (erroNivel || erroMotivo || m.isPending) return;
    m.mutate({ nivel, motivo: motivo.trim() }, { onSuccess: aoFechar });
  };

  return (
    <ModalAdm aberto titulo={`Nível do galinheiro de ${u.nome}`} aoFechar={aoFechar}>
      <form className="adm-us-form" onSubmit={enviar} noValidate>
        <p className="adm-us-texto">
          Agora: <strong>nível {u.nivel}</strong> · {plural(capAtual, 'ninho', 'ninhos')} · {plural(ocupados.size, 'ocupado', 'ocupados')}. Cada nível tem{' '}
          {porNivel} ninhos (máximo: nível {max}).
        </p>
        <Campo rotulo="Novo nível" erro={tentou || texto !== String(u.nivel) ? erroNivel : null}>
          <span className="adm-us-passo">
            <button type="button" className="adm-us-passo-botao" onClick={() => passo(-1)} aria-label="Diminuir nível" disabled={valido && nivel <= 1}>
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <input
              ref={campo}
              className="adm-input tabular-nums"
              type="text"
              inputMode="numeric"
              value={texto}
              onChange={(e) => setTexto(soDigitos(e.target.value, 2))}
              aria-label="Novo nível"
              aria-invalid={((tentou || texto !== String(u.nivel)) && !!erroNivel) || undefined}
            />
            <button type="button" className="adm-us-passo-botao" onClick={() => passo(1)} aria-label="Aumentar nível" disabled={valido && nivel >= max}>
              <Plus className="h-4 w-4" aria-hidden />
            </button>
            <span className="adm-us-passo-total">= {plural(capNova, 'ninho', 'ninhos')}</span>
          </span>
        </Campo>
        <div>
          <div className="adm-us-ninhos" aria-hidden>
            {Array.from({ length: Math.max(capAtual, capNova) }, (_, i) => {
              const s = i + 1;
              const estado = s > capNova ? 'some' : s > capAtual ? 'novo' : ocupados.has(s) ? 'ocupado' : 'livre';
              return <span key={s} data-estado={estado} title={`Ninho ${s}`} />;
            })}
          </div>
          <p className="adm-us-ninhos-legenda">
            <span data-estado="ocupado">ocupado</span>
            <span data-estado="livre">livre</span>
            {capNova > capAtual && <span data-estado="novo">novo</span>}
            {capNova < capAtual && <span data-estado="some">deixa de existir</span>}
          </p>
        </div>
        <CampoMotivo valor={motivo} aoMudar={setMotivo} erro={tentou ? erroMotivo : null} sugestoes={['Compensação por falha', 'Prêmio de evento', 'Correção de nível']} />
        <ErroModal texto={m.isError ? mensagemAdmin(m.error) : null} />
        <AcoesModal>
          <Cancelar aoFechar={aoFechar} />
          <BotaoAdm type="submit" variante="primario" disabled={m.isPending}>
            <Layers className="h-4 w-4" aria-hidden />
            {m.isPending ? 'Salvando…' : valido && nivel !== u.nivel ? `Mudar para o nível ${nivel}` : 'Mudar nível'}
          </BotaoAdm>
        </AcoesModal>
      </form>
    </ModalAdm>
  );
}

// ---------------------------------------------------------------- dar animal

export function ModalAnimal({ d: dAtual, aoFechar, abrir }: PropsModal & { abrir: (a: AcaoFicha) => void }) {
  const [d] = useState(dAtual);
  const u = d.usuario;
  const primeiro = primeiroNome(u.nome);
  const capacidade = d.jogo.capacidade;
  const ocupados = new Set(d.jogo.entidades.map((e) => e.slotId));
  let livre: number | null = null;
  for (let s = 1; s <= capacidade; s++) {
    if (!ocupados.has(s)) {
      livre = s;
      break;
    }
  }
  const [tipo, setTipo] = useState<Tipo>('galinha');
  const [motivo, setMotivo] = useState('');
  const [tentou, setTentou] = useState(false);
  const erroMotivo = erroDoMotivo(motivo);

  const m = useAcao(
    async (v: { tipo: Tipo; motivo: string }) =>
      (await chamar<{ entityId: string }>('POST', `/api/admin/usuarios/${u.id}/animais`, { corpo: v, idempotente: true })).data,
    (_, v) => `${NOME_TIPO[v.tipo]} entregue para ${primeiro}${livre ? ` (ninho ${livre})` : ''}`,
  );
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (livre === null || erroMotivo || m.isPending) return;
    m.mutate({ tipo, motivo: motivo.trim() }, { onSuccess: aoFechar });
  };

  return (
    <ModalAdm aberto titulo={`Dar um animal para ${u.nome}`} aoFechar={aoFechar} largura="g">
      <form className="adm-us-form" onSubmit={enviar} noValidate>
        {livre === null ? (
          <Alerta tom="vermelho" icone={<TriangleAlert className="h-4 w-4" />}>
            <p>
              <strong>Galinheiro cheio</strong> ({capacidade} de {capacidade} ninhos ocupados). Aumente o nível antes de dar um animal.
            </p>
            <BotaoAdm className="mt-2" tamanho="p" onClick={() => abrir({ tipo: 'nivel' })}>
              <Layers className="h-4 w-4" aria-hidden /> Definir nível
            </BotaoAdm>
          </Alerta>
        ) : (
          <fieldset className="adm-us-opcoes">
            <legend className="adm-campo-rotulo">Espécie</legend>
            <div className="adm-us-opcoes-grade" data-colunas="4">
              {TIPOS.map((t) => {
                const cfg = ANIMAIS[t];
                return (
                  <label key={t} className="adm-us-opcao adm-us-opcao-animal">
                    <input type="radio" name="especie" className="sr-only" checked={tipo === t} onChange={() => setTipo(t)} />
                    <span className="adm-us-figura">
                      <FiguraAnimal tipo={t} ninho={false} detalhe="p" className="h-14 w-14" />
                    </span>
                    <span className="adm-us-opcao-nome">{NOME_TIPO[t]}</span>
                    <span className="adm-us-raridade" style={{ '--cor': COR_RARIDADE[cfg.raridade] } as CSSProperties}>
                      {NOME_RARIDADE[cfg.raridade]}
                    </span>
                    <span className="adm-us-opcao-sub">ovo vale {fmt.moedas(cfg.precoOvoX100)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        {livre !== null && (
          <p className="adm-us-texto-suave">
            Nasce no <strong>ninho {livre}</strong> com vida cheia e nome sorteado, e já aparece no galinheiro de {primeiro}.
          </p>
        )}
        <CampoMotivo valor={motivo} aoMudar={setMotivo} erro={tentou ? erroMotivo : null} sugestoes={['Prêmio de evento', 'Compensação por animal perdido', 'Presente de boas-vindas']} />
        <ErroModal texto={m.isError ? mensagemAdmin(m.error) : null} />
        <AcoesModal>
          <Cancelar aoFechar={aoFechar} />
          <BotaoAdm type="submit" variante="primario" disabled={m.isPending || livre === null}>
            <Plus className="h-4 w-4" aria-hidden />
            {m.isPending ? 'Entregando…' : `Dar ${NOME_TIPO[tipo]}`}
          </BotaoAdm>
        </AcoesModal>
      </form>
    </ModalAdm>
  );
}

// ---------------------------------------------------------------- sessões

export function ModalSessoes({ d: dAtual, proprio, aoFechar }: PropsModal & { proprio: boolean }) {
  const [d] = useState(dAtual);
  const u = d.usuario;
  const m = useAcao(
    async () => (await chamar<{ encerradas: boolean }>('POST', `/api/admin/usuarios/${u.id}/sessoes`)).data,
    () => `Sessões de ${primeiroNome(u.nome)} encerradas`,
  );
  return (
    <ModalAdm aberto titulo="Encerrar sessões" aoFechar={aoFechar}>
      <div className="adm-us-form">
        <p className="adm-us-texto">
          Desconectar <strong>{u.nome}</strong> de todos os aparelhos?
        </p>
        <ul className="adm-us-efeitos">
          <li>Sai do jogo em todos os celulares e computadores, na hora.</li>
          <li>Precisa entrar de novo com e-mail e senha.</li>
          <li>A conta continua ativa; nada é apagado.</li>
        </ul>
        {proprio && (
          <Alerta tom="ambar" icone={<TriangleAlert className="h-4 w-4" />}>
            Esta é a sua conta: você também sai deste painel e vai precisar entrar de novo.
          </Alerta>
        )}
        <ErroModal texto={m.isError ? mensagemAdmin(m.error) : null} />
        <AcoesModal>
          <Cancelar aoFechar={aoFechar} />
          <BotaoAdm variante="primario" disabled={m.isPending} onClick={() => m.mutate(undefined, { onSuccess: aoFechar })}>
            <LogOut className="h-4 w-4" aria-hidden />
            {m.isPending ? 'Encerrando…' : 'Encerrar sessões'}
          </BotaoAdm>
        </AcoesModal>
      </div>
    </ModalAdm>
  );
}

// ---------------------------------------------------------------- código de recuperação

export function ModalCodigo({ d: dAtual, aoFechar }: PropsModal) {
  const [d] = useState(dAtual);
  const u = d.usuario;
  const primeiro = primeiroNome(u.nome);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [copiou, setCopiou] = useState(false);
  const [insistiu, setInsistiu] = useState(false);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async () => (await chamar<AdminCodigoRecuperacaoDTO>('POST', `/api/admin/usuarios/${u.id}/codigo-recuperacao`)).data,
    onSuccess: (r) => {
      // sem toast: o próprio modal mostra o código e avisa que o antigo deixou de valer
      setCodigo(r.codigoRecuperacao);
      void recarregar(qc);
    },
  });

  // Fechar sem copiar o código pede uma 2ª tentativa (ele não aparece de novo). A função precisa ser estável.
  const estado = useRef({ codigo, copiou, insistiu });
  useEffect(() => {
    estado.current = { codigo, copiou, insistiu };
  }, [codigo, copiou, insistiu]);
  const fecharSeguro = useCallback(() => {
    const s = estado.current;
    if (s.codigo && !s.copiou && !s.insistiu) {
      setInsistiu(true);
      return;
    }
    aoFechar();
  }, [aoFechar]);

  const mensagem = codigo
    ? `Olá, ${primeiro}! Seu novo código de recuperação do Galinheiro é ${codigo}. Na tela de entrada, toque em “Esqueci a senha”, informe seu e-mail, este código e crie uma senha nova. O código anterior não vale mais.`
    : '';

  return (
    <ModalAdm aberto titulo="Código de recuperação" aoFechar={fecharSeguro}>
      {codigo ? (
        <div className="adm-us-form">
          <Alerta tom="verde" icone={<CircleCheck className="h-4 w-4" />}>
            <strong>Código gerado.</strong> O código anterior de {primeiro} deixou de valer.
          </Alerta>
          <p className="adm-us-codigo" aria-label="Novo código de recuperação">
            {codigo}
          </p>
          <div className="adm-us-botoes adm-us-botoes-cheios">
            <BotaoAdm
              variante="primario"
              onClick={async () => {
                if (await copiar(codigo, 'Código copiado')) setCopiou(true);
              }}
            >
              <Copy className="h-4 w-4" aria-hidden /> Copiar código
            </BotaoAdm>
            <BotaoAdm
              onClick={async () => {
                if (await copiar(mensagem, 'Mensagem copiada')) setCopiou(true);
              }}
            >
              <MessageSquareText className="h-4 w-4" aria-hidden /> Copiar mensagem pronta
            </BotaoAdm>
          </div>
          <Alerta tom="ambar" icone={<TriangleAlert className="h-4 w-4" />}>
            Este código aparece <strong>só agora</strong>. Passe para {primeiro} por um canal seguro, depois de confirmar que é mesmo a pessoa. Ao
            fechar, não dá para ver de novo — se perder, gere outro.
          </Alerta>
          {insistiu && !copiou && (
            <p className="adm-us-erro" role="alert">
              Você ainda não copiou o código. Feche de novo para descartar.
            </p>
          )}
          <AcoesModal>
            <BotaoAdm variante={copiou ? 'primario' : 'secundario'} onClick={fecharSeguro}>
              Concluir
            </BotaoAdm>
          </AcoesModal>
        </div>
      ) : (
        <div className="adm-us-form">
          <p className="adm-us-texto">
            Gerar um novo código de recuperação para <strong>{u.nome}</strong>?
          </p>
          <ul className="adm-us-efeitos">
            <li>O código atual deixa de valer na hora.</li>
            <li>Com o código novo, o membro cria outra senha em “Esqueci a senha”, na tela de entrada.</li>
            <li>O código aparece uma única vez, logo depois de gerar.</li>
          </ul>
          <ErroModal texto={m.isError ? mensagemAdmin(m.error) : null} />
          <AcoesModal>
            <Cancelar aoFechar={aoFechar} />
            <BotaoAdm variante="primario" disabled={m.isPending} onClick={() => m.mutate()}>
              <KeyRound className="h-4 w-4" aria-hidden />
              {m.isPending ? 'Gerando…' : 'Gerar novo código'}
            </BotaoAdm>
          </AcoesModal>
        </div>
      )}
    </ModalAdm>
  );
}

// ---------------------------------------------------------------- bloquear / desbloquear

export function ModalBloquear({ d: dAtual, aoFechar }: PropsModal) {
  const [d] = useState(dAtual);
  const u = d.usuario;
  const primeiro = primeiroNome(u.nome);
  const [motivo, setMotivo] = useState('');
  const [tentou, setTentou] = useState(false);
  const erroMotivo = erroDoMotivo(motivo);
  const m = useAcao(
    async (v: { motivo: string }) => (await chamar<{ bloqueado: boolean }>('POST', `/api/admin/usuarios/${u.id}/bloquear`, { corpo: v })).data,
    () => `Conta de ${primeiro} bloqueada`,
  );
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (erroMotivo || m.isPending) return;
    m.mutate({ motivo: motivo.trim() }, { onSuccess: aoFechar });
  };
  return (
    <ModalAdm aberto titulo={`Bloquear ${u.nome}`} aoFechar={aoFechar}>
      <form className="adm-us-form" onSubmit={enviar} noValidate>
        <Alerta tom="vermelho" icone={<Ban className="h-4 w-4" />}>
          <p className="font-extrabold">O que acontece ao bloquear {u.nome}:</p>
          <ul className="adm-us-efeitos">
            <li>As sessões abertas caem na hora.</li>
            <li>Novos logins são recusados — ao tentar entrar, {primeiro} vê o motivo abaixo.</li>
            <li>Nada é apagado: dá para desbloquear depois.</li>
          </ul>
        </Alerta>
        <CampoMotivo
          rotulo="Motivo do bloqueio"
          valor={motivo}
          aoMudar={setMotivo}
          erro={tentou ? erroMotivo : null}
          dica="Aparece para o membro ao tentar entrar e fica na auditoria."
          placeholder="Ex.: comportamento abusivo no atendimento"
          sugestoes={['Comportamento abusivo no atendimento', 'Suspeita de fraude', 'Pedido do próprio membro']}
        />
        <ErroModal texto={m.isError ? mensagemAdmin(m.error) : null} />
        <AcoesModal>
          <Cancelar aoFechar={aoFechar} />
          <BotaoAdm type="submit" variante="perigo" disabled={m.isPending}>
            <Ban className="h-4 w-4" aria-hidden />
            {m.isPending ? 'Bloqueando…' : 'Bloquear conta'}
          </BotaoAdm>
        </AcoesModal>
      </form>
    </ModalAdm>
  );
}

export function ModalDesbloquear({ d: dAtual, aoFechar }: PropsModal) {
  const [d] = useState(dAtual);
  const u = d.usuario;
  const primeiro = primeiroNome(u.nome);
  const m = useAcao(
    async () => (await chamar<{ bloqueado: boolean }>('POST', `/api/admin/usuarios/${u.id}/desbloquear`)).data,
    () => `Conta de ${primeiro} desbloqueada`,
  );
  return (
    <ModalAdm aberto titulo={`Desbloquear ${u.nome}`} aoFechar={aoFechar}>
      <div className="adm-us-form">
        <p className="adm-us-texto">
          Devolver o acesso de <strong>{u.nome}</strong>? O membro volta a conseguir entrar no jogo com e-mail e senha.
        </p>
        {u.bloqueioMotivo && (
          <Alerta tom="azul">
            Motivo do bloqueio: <strong>“{u.bloqueioMotivo}”</strong>
          </Alerta>
        )}
        <ErroModal texto={m.isError ? mensagemAdmin(m.error) : null} />
        <AcoesModal>
          <Cancelar aoFechar={aoFechar} />
          <BotaoAdm variante="primario" disabled={m.isPending} onClick={() => m.mutate(undefined, { onSuccess: aoFechar })}>
            <LockOpen className="h-4 w-4" aria-hidden />
            {m.isPending ? 'Desbloqueando…' : 'Desbloquear conta'}
          </BotaoAdm>
        </AcoesModal>
      </div>
    </ModalAdm>
  );
}

// ---------------------------------------------------------------- cobrança PIX ou USDT

export function ModalCobranca({ d: dAtual, aoFechar }: PropsModal) {
  const [d] = useState(dAtual);
  const u = d.usuario;
  const [meio, setMeio] = useState(d.cobranca.meio);
  const [abertas, setAbertas] = useState(d.cobranca.abertas);
  const salvar = useAcao(
    async (escolhido: 'pix' | 'usdt') => (await chamar<{ meio: 'pix' | 'usdt' }>('POST', `/api/admin/usuarios/${u.id}/cobranca`, { corpo: { meio: escolhido }, idempotente: true })).data,
    (r) => r.meio === 'usdt' ? `${primeiroNome(u.nome)} passa a pagar em USDT` : `${primeiroNome(u.nome)} volta a pagar no PIX`,
  );
  const confirmar = useAcao(
    async (item: AdminCobrancaUsdtDTO) => {
      await chamar('POST', `/api/admin/usuarios/${u.id}/cobranca-usdt`, { corpo: { cobrancaId: item.id, tipo: item.tipo }, idempotente: true });
      return item;
    },
    (item) => `USDT confirmado: ${fmt.moedas(item.valorUsdtX100)} na ${item.tipo === 'roleta' ? 'roleta' : 'ampliação'}`,
  );
  return (
    <ModalAdm aberto titulo={`Cobrança de ${u.nome}`} aoFechar={aoFechar}>
      <div className="adm-us-form">
        <p className="adm-us-texto">
          Vale para a roleta e para a ampliação do galinheiro. No USDT, o membro vê a rede, o valor, o endereço e o QR da carteira configurada em Pagamentos. A equipe confirma aqui quando o valor chega.
        </p>
        <fieldset className="adm-us-opcoes">
          <legend className="adm-campo-rotulo">Meio</legend>
          <div className="adm-us-opcoes-grade" data-colunas="2">
            <label className="adm-us-opcao adm-us-opcao-linha">
              <input type="radio" name="meio" className="sr-only" checked={meio === 'pix'} onChange={() => setMeio('pix')} />
              <Banknote className="adm-us-opcao-icone" aria-hidden />
              <span className="min-w-0">
                <span className="adm-us-opcao-nome">PIX</span>
                <span className="adm-us-opcao-sub">QR da gateway de pagamentos.</span>
              </span>
            </label>
            <label className="adm-us-opcao adm-us-opcao-linha">
              <input type="radio" name="meio" className="sr-only" checked={meio === 'usdt'} onChange={() => setMeio('usdt')} />
              <Coins className="adm-us-opcao-icone" aria-hidden />
              <span className="min-w-0">
                <span className="adm-us-opcao-nome">USDT</span>
                <span className="adm-us-opcao-sub">{d.cobranca.carteiraPronta ? 'Endereço e QR da carteira.' : 'Falta a carteira em Pagamentos.'}</span>
              </span>
            </label>
          </div>
        </fieldset>
        {abertas.length > 0 && (
          <div className="adm-us-campo-motivo">
            <p className="adm-campo-rotulo">Aguardando USDT</p>
            <ul className="adm-us-texto">
              {abertas.map((item) => (
                <li key={item.id} className="mb-2 flex items-center justify-between gap-2">
                  <span>{item.tipo === 'roleta' ? 'Roleta' : 'Ampliação'} · {fmt.moedas(item.valorUsdtX100)} USDT · {item.rede}</span>
                  <BotaoAdm tamanho="p" disabled={confirmar.isPending} onClick={() => confirmar.mutate(item, { onSuccess: () => setAbertas((lista) => lista.filter((x) => x.id !== item.id)) })}>
                    Confirmar
                  </BotaoAdm>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ErroModal texto={(salvar.isError ? mensagemAdmin(salvar.error) : null) ?? (confirmar.isError ? mensagemAdmin(confirmar.error) : null)} />
        <AcoesModal>
          <Cancelar aoFechar={aoFechar} />
          <BotaoAdm variante="primario" disabled={salvar.isPending || meio === d.cobranca.meio} onClick={() => salvar.mutate(meio, { onSuccess: aoFechar })}>
            {salvar.isPending ? 'Salvando…' : 'Salvar cobrança'}
          </BotaoAdm>
        </AcoesModal>
      </div>
    </ModalAdm>
  );
}

// ---------------------------------------------------------------- bônus de quem entra pelo link

const MAX_BONUS_X100 = 100_000;

function lerBonus(texto: string): { valor: number | null; erro: string | null } {
  if (!texto.trim()) return { valor: null, erro: 'Informe o valor do bônus.' };
  const valor = lerMoedas(texto);
  if (valor === null) return { valor: null, erro: 'Use um valor como 40,00.' };
  if (valor > MAX_BONUS_X100) return { valor, erro: 'O máximo é R$ 1.000,00.' };
  return { valor, erro: null };
}

export function ModalBonusLink({ d: dAtual, aoFechar }: PropsModal) {
  const [d] = useState(dAtual);
  const u = d.usuario;
  const primeiro = primeiroNome(u.nome);
  const atual = d.afiliacao.bonusLinkX100;
  const [texto, setTexto] = useState(fmt.moedas(atual ?? d.afiliacao.bonusGeralX100));
  const [tentou, setTentou] = useState(false);
  const lido = lerBonus(texto);
  const salvar = useAcao(
    async (bonusX100: number) => (await chamar<{ bonusX100: number }>('POST', `/api/admin/usuarios/${u.id}/bonus-link`, { corpo: { bonusX100 }, idempotente: true })).data,
    (r) => `Quem entrar pelo link de ${primeiro} recebe R$ ${fmt.moedas(r.bonusX100)}`,
  );
  const geral = useAcao(
    async () => (await chamar<{ bonusX100: number | null }>('POST', `/api/admin/usuarios/${u.id}/bonus-link`, { corpo: { bonusX100: null }, idempotente: true })).data,
    () => `O link de ${primeiro} voltou a seguir o bônus geral`,
  );
  const enviar = () => {
    setTentou(true);
    if (lido.erro || lido.valor === null || salvar.isPending) return;
    salvar.mutate(lido.valor, { onSuccess: aoFechar });
  };
  return (
    <ModalAdm aberto titulo={`Bônus do link de ${u.nome}`} aoFechar={aoFechar}>
      <div className="adm-us-form">
        <p className="adm-us-texto">
          Quem se cadastrar pelo link de <strong>{u.nome}</strong> recebe este bônus. Quem já entrou não muda. O bônus geral hoje é R$ {fmt.moedas(d.afiliacao.bonusGeralX100)}.
        </p>
        <Campo rotulo="Bônus deste link" erro={tentou ? lido.erro : null} dica="Em reais. 0 deixa o cadastro sem bônus.">
          <input
            className="adm-input"
            inputMode="decimal"
            value={texto}
            autoComplete="off"
            aria-invalid={tentou && !!lido.erro || undefined}
            onChange={(e) => setTexto(e.target.value)}
          />
        </Campo>
        <ErroModal texto={(salvar.isError ? mensagemAdmin(salvar.error) : null) ?? (geral.isError ? mensagemAdmin(geral.error) : null)} />
        <AcoesModal>
          {atual !== null && (
            <BotaoAdm disabled={geral.isPending || salvar.isPending} onClick={() => geral.mutate(undefined, { onSuccess: aoFechar })}>
              Usar o bônus geral
            </BotaoAdm>
          )}
          <Cancelar aoFechar={aoFechar} />
          <BotaoAdm variante="primario" disabled={salvar.isPending || geral.isPending} onClick={enviar}>
            <Gift className="h-4 w-4" aria-hidden />
            {salvar.isPending ? 'Salvando…' : 'Salvar bônus do link'}
          </BotaoAdm>
        </AcoesModal>
      </div>
    </ModalAdm>
  );
}

export function ModalBonusGeral({ d: dAtual, aoFechar }: PropsModal) {
  const [d] = useState(dAtual);
  const [texto, setTexto] = useState(fmt.moedas(d.afiliacao.bonusGeralX100));
  const [tentou, setTentou] = useState(false);
  const lido = lerBonus(texto);
  const salvar = useAcao(
    async (bonusX100: number) => (await chamar<{ bonusX100: number }>('POST', '/api/admin/afiliados/bonus-geral', { corpo: { bonusX100 }, idempotente: true })).data,
    (r) => `Bônus geral dos próximos cadastros: R$ ${fmt.moedas(r.bonusX100)}`,
  );
  const enviar = () => {
    setTentou(true);
    if (lido.erro || lido.valor === null || salvar.isPending) return;
    salvar.mutate(lido.valor, { onSuccess: aoFechar });
  };
  return (
    <ModalAdm aberto titulo="Bônus geral do cadastro" aoFechar={aoFechar}>
      <div className="adm-us-form">
        <p className="adm-us-texto">
          Vale para quem entrar sem convite e para os links que seguem o bônus geral. Um link com valor próprio, como o de um afiliado, continua no valor dele. Quem já recebeu o bônus não muda.
        </p>
        <Campo rotulo="Bônus geral" erro={tentou ? lido.erro : null} dica="Em reais. Hoje o padrão de quem não tem valor próprio.">
          <input
            className="adm-input"
            inputMode="decimal"
            value={texto}
            autoComplete="off"
            aria-invalid={tentou && !!lido.erro || undefined}
            onChange={(e) => setTexto(e.target.value)}
          />
        </Campo>
        <ErroModal texto={salvar.isError ? mensagemAdmin(salvar.error) : null} />
        <AcoesModal>
          <Cancelar aoFechar={aoFechar} />
          <BotaoAdm variante="primario" disabled={salvar.isPending} onClick={enviar}>
            <Coins className="h-4 w-4" aria-hidden />
            {salvar.isPending ? 'Salvando…' : 'Salvar bônus geral'}
          </BotaoAdm>
        </AcoesModal>
      </div>
    </ModalAdm>
  );
}

// ---------------------------------------------------------------- bônus inicial no saque

export function ModalBonusSaque({ d: dAtual, aoFechar }: PropsModal) {
  const [d] = useState(dAtual);
  const u = d.usuario;
  const primeiro = primeiroNome(u.nome);
  const liberar = !d.bonusSaque.liberadoPelaEquipe;
  const valor = fmt.moedas(d.bonusSaque.recebidoX100);
  const m = useAcao(
    async () => (await chamar<{ liberado: boolean }>('POST', `/api/admin/usuarios/${u.id}/bonus-saque`, { corpo: { liberado: liberar }, idempotente: true })).data,
    () => (liberar ? `Bônus de ${primeiro} liberado para saque` : `Bônus de ${primeiro} voltou a exigir a roleta`),
  );
  return (
    <ModalAdm aberto titulo={liberar ? `Liberar bônus de ${u.nome}` : `Exigir a roleta de ${u.nome}`} aoFechar={aoFechar}>
      <div className="adm-us-form">
        <p className="adm-us-texto">
          {liberar ? (
            <>
              Liberar o bônus inicial de <strong>R$ {valor}</strong> para saque? <strong>{u.nome}</strong> poderá sacar esse valor sem PIX da roleta pago e sem ter girado.
            </>
          ) : d.bonusSaque.liberadoPeloPlano ? (
            <>
              Tirar a liberação da equipe? O bônus de <strong>R$ {valor}</strong> continua sacável enquanto <strong>{u.nome}</strong> tiver um PIX da roleta pago ou um animal comprado no galinheiro.
            </>
          ) : (
            <>
              Voltar a exigir a roleta? O bônus inicial de <strong>R$ {valor}</strong> deixa de entrar no saque até o PIX da roleta ser pago e o giro feito.
            </>
          )}
        </p>
        <ErroModal texto={m.isError ? mensagemAdmin(m.error) : null} />
        <AcoesModal>
          <Cancelar aoFechar={aoFechar} />
          <BotaoAdm variante={liberar ? 'primario' : undefined} disabled={m.isPending} onClick={() => m.mutate(undefined, { onSuccess: aoFechar })}>
            <Banknote className="h-4 w-4" aria-hidden />
            {m.isPending ? 'Salvando…' : liberar ? 'Liberar para saque' : 'Exigir a roleta'}
          </BotaoAdm>
        </AcoesModal>
      </div>
    </ModalAdm>
  );
}

// ---------------------------------------------------------------- mensagem pelo atendimento

const MAX_MENSAGEM = 2000;

export function ModalMensagem({ d: dAtual, aoFechar }: PropsModal) {
  const [d] = useState(dAtual);
  const u = d.usuario;
  const primeiro = primeiroNome(u.nome);
  const router = useRouter();
  const qc = useQueryClient();
  const [texto, setTexto] = useState('');
  const [tentou, setTentou] = useState(false);
  const limpo = texto.trim();
  const erro = !limpo ? 'Escreva uma mensagem.' : limpo.length > MAX_MENSAGEM ? `Mensagem muito longa (máximo ${MAX_MENSAGEM} caracteres).` : null;
  const m = useMutation({
    mutationFn: async (t: string) => (await chamar<AdminConversaDTO>('POST', '/api/admin/suporte', { corpo: { contaId: u.id, texto: t } })).data,
    onSuccess: (r) => {
      toast(`Mensagem enviada para ${primeiro}`, 'sucesso', { duracaoMs: 4000 });
      void qc.invalidateQueries({ queryKey: ['admin', 'suporte'] });
      void recarregar(qc);
      router.push(`/admin/atendimento?c=${encodeURIComponent(r.conversa.id)}`);
    },
  });
  const enviar = () => {
    setTentou(true);
    if (erro || m.isPending) return;
    m.mutate(limpo);
  };
  return (
    <ModalAdm aberto titulo={`Mensagem para ${u.nome}`} aoFechar={aoFechar}>
      <form
        className="adm-us-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <p className="adm-us-texto-suave">
          {d.suporte.conversaId ? 'Continua a conversa que já existe no atendimento.' : 'Abre uma conversa nova no atendimento.'} {primeiro} vê a mensagem
          dentro do jogo, com aviso de mensagem nova.
        </p>
        <Campo rotulo="Mensagem" erro={tentou ? erro : null}>
          <textarea
            className="adm-input"
            rows={5}
            value={texto}
            maxLength={MAX_MENSAGEM}
            placeholder={`Olá, ${primeiro}! …`}
            aria-invalid={(tentou && !!erro) || undefined}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                enviar();
              }
            }}
          />
        </Campo>
        <p className="adm-us-contador">
          {fmt.int(limpo.length)}/{fmt.int(MAX_MENSAGEM)} · Ctrl+Enter envia
        </p>
        <ErroModal texto={m.isError ? mensagemAdmin(m.error) : null} />
        <AcoesModal>
          <Cancelar aoFechar={aoFechar} />
          <BotaoAdm type="submit" variante="primario" disabled={m.isPending || m.isSuccess}>
            <Send className="h-4 w-4" aria-hidden />
            {m.isPending ? 'Enviando…' : m.isSuccess ? 'Abrindo a conversa…' : 'Enviar e abrir conversa'}
          </BotaoAdm>
        </AcoesModal>
      </form>
    </ModalAdm>
  );
}

// ---------------------------------------------------------------- excluir

export function ModalExcluir({ d: dAtual, aoFechar, aoExcluir }: PropsModal & { aoExcluir: () => void }) {
  const [d] = useState(dAtual);
  const u = d.usuario;
  const router = useRouter();
  const qc = useQueryClient();
  const [confirmacao, setConfirmacao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [tentou, setTentou] = useState(false);
  const erroConfirmacao = confirmacao.trim() !== 'EXCLUIR' ? 'Digite EXCLUIR para confirmar.' : null;
  const erroMotivo = erroDoMotivo(motivo);
  const m = useMutation({
    mutationFn: async (v: { confirmacao: 'EXCLUIR'; motivo: string }) =>
      (await chamar<{ excluido: boolean }>('DELETE', `/api/admin/usuarios/${u.id}`, { corpo: v })).data,
    onSuccess: () => {
      toast(`Conta de ${u.nome} excluída`, 'sucesso', { duracaoMs: 5000 });
      // a ficha para de buscar antes de sumir do cache (senão ela tentaria recarregar e daria "não encontrado")
      aoExcluir();
      qc.removeQueries({ queryKey: ['admin', 'usuarios', 'detalhe', u.id] });
      void qc.invalidateQueries({ queryKey: ['admin', 'usuarios', 'lista'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'usuarios', 'contagens'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'auditoria'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'resumo'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'suporte'] });
      router.replace(caminhoDaLista());
    },
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (erroConfirmacao || erroMotivo || m.isPending) return;
    m.mutate({ confirmacao: 'EXCLUIR', motivo: motivo.trim() });
  };
  const ovos = ITENS.reduce((s, i) => s + d.jogo.inventario[i], 0);
  return (
    <ModalAdm aberto titulo={`Excluir a conta de ${u.nome}`} aoFechar={aoFechar}>
      <form className="adm-us-form" onSubmit={enviar} noValidate>
        <Alerta tom="vermelho" icone={<TriangleAlert className="h-4 w-4" />}>
          <p className="font-extrabold">Isto é permanente e não pode ser desfeito.</p>
          <ul className="adm-us-efeitos">
            <li>
              Apaga a conta de <strong>{u.nome}</strong> ({u.email}).
            </li>
            <li>
              Apaga o galinheiro: {plural(d.jogo.entidades.length, 'animal', 'animais')}, {plural(ovos, 'ovo', 'ovos')} e {fmt.moedas(u.moedasX100)} moedas.
            </li>
            <li>Apaga o extrato e a conversa do atendimento.</li>
            <li>O e-mail e o telefone ficam livres para um novo cadastro. O registro desta exclusão fica na auditoria.</li>
          </ul>
        </Alerta>
        <CampoMotivo
          rotulo="Motivo da exclusão"
          valor={motivo}
          aoMudar={setMotivo}
          erro={tentou ? erroMotivo : null}
          sugestoes={['Pedido do próprio membro (LGPD)', 'Conta duplicada', 'Conta de teste']}
        />
        <Campo rotulo="Para confirmar, digite EXCLUIR" erro={tentou ? erroConfirmacao : null}>
          <input
            className="adm-input adm-us-confirmacao"
            type="text"
            value={confirmacao}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="EXCLUIR"
            aria-invalid={(tentou && !!erroConfirmacao) || undefined}
            onChange={(e) => setConfirmacao(e.target.value.toUpperCase())}
          />
        </Campo>
        <ErroModal texto={m.isError ? mensagemAdmin(m.error) : null} />
        <AcoesModal>
          <Cancelar aoFechar={aoFechar} />
          <BotaoAdm type="submit" variante="perigo" disabled={m.isPending || m.isSuccess || !!erroConfirmacao}>
            <Trash className="h-4 w-4" aria-hidden />
            {m.isPending ? 'Excluindo…' : 'Excluir conta definitivamente'}
          </BotaoAdm>
        </AcoesModal>
      </form>
    </ModalAdm>
  );
}

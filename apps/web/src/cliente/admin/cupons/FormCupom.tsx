'use client';

// Criar/editar cupom (modal largo, com a prévia do vale ao lado): código (digitado ou "Gerar"; não muda depois de
// criado), tickets por membro, limite de usos (ou sem limite), validade (início/fim no horário do navegador → ISO
// com fuso), descrição interna e ligado/pausado. Valida como o servidor (mesmas mensagens), mostra os erros dele no
// campo certo e pede confirmação antes de descartar alterações. Tickets são vales do jogo (só itens e moedas do jogo).
import { AdminCupomBody, type AdminCupomDTO, type BeneficioCupom } from '@galinheiro/api-contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Dices, Infinity as SemLimite, Lock, Minus, Plus, Users } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ErroApi, chamar } from '../../api';
import { agoraServidor } from '../../relogio';
import { toast } from '../../ui';
import { cx } from '../../util';
import { IconeTicket } from '../intercambio/comum';
import { textoTickets } from '../intercambio/formato';
import { campoParaIso, campoParaMs, dataCurta, emQuanto, paraCampoData, rotuloFuso } from '../popups/util';
import { BotaoAdm, ModalAdm, fmt, mensagemAdmin } from '../ui';
import { soDigitos } from '../usuarios/comum';
import { CHAVE_CUPONS, gerarCodigo, limparCodigo } from './util';

export type ModoCupom = { tipo: 'novo' } | { tipo: 'editar'; cupom: AdminCupomDTO };

const DIA = 86_400_000;
const TICKETS_MAX = 10_000;
const USOS_MAX = 10_000_000;
const DESCRICAO_MAX = 200;

interface Rascunho {
  codigo: string;
  descricao: string;
  beneficio: BeneficioCupom;
  /** texto do campo: tickets ou giros, conforme o benefício */
  tickets: string;
  comLimite: boolean;
  /** texto do campo */
  usosMax: string;
  /** datetime-local (horário do navegador) */
  inicio: string;
  fim: string;
  ativo: boolean;
}

type CampoErro = 'codigo' | 'tickets' | 'usosMax' | 'inicio' | 'fim' | 'descricao';
type Erros = Partial<Record<CampoErro, string>>;
const ORDEM_CAMPOS: CampoErro[] = ['codigo', 'tickets', 'usosMax', 'inicio', 'fim', 'descricao'];

function rascunhoDe(modo: ModoCupom, agora: number): Rascunho {
  if (modo.tipo === 'novo') {
    return { codigo: '', descricao: '', beneficio: 'tickets', tickets: '5', comLimite: false, usosMax: '100', inicio: paraCampoData(agora), fim: '', ativo: true };
  }
  const c = modo.cupom;
  return {
    codigo: c.codigo,
    descricao: c.descricao ?? '',
    beneficio: c.beneficio === 'giros' ? 'giros' : 'tickets',
    tickets: String(c.beneficio === 'giros' ? c.giros : c.tickets),
    comLimite: c.usosMax !== null,
    usosMax: String(c.usosMax ?? Math.max(100, c.usos)),
    inicio: paraCampoData(Date.parse(c.inicio)),
    fim: c.fim ? paraCampoData(Date.parse(c.fim)) : '',
    ativo: c.ativo,
  };
}

/** Mesmas regras (e mensagens) do servidor, para avisar antes de enviar. */
function validar(r: Rascunho, modo: ModoCupom, existentes: readonly AdminCupomDTO[]): Erros {
  const e: Erros = {};
  if (modo.tipo === 'novo') {
    if (r.codigo.length < 4) e.codigo = r.codigo ? 'Use de 4 a 20 letras e números.' : 'Digite um código ou toque em “Gerar”.';
    else if (existentes.some((c) => c.codigo === r.codigo)) e.codigo = 'Já existe um cupom com esse código.';
  }
  const tickets = Number(r.tickets);
  const deGiros = r.beneficio === 'giros';
  if (!r.tickets) e.tickets = deGiros ? 'Informe quantos giros o cupom dá.' : 'Informe quantos tickets o cupom dá.';
  else if (tickets < 1) e.tickets = deGiros ? 'Pelo menos 1 giro.' : 'Pelo menos 1 ticket.';
  else if (tickets > TICKETS_MAX) e.tickets = deGiros ? 'Máximo de 10.000 giros por cupom.' : 'Máximo de 10.000 tickets por cupom.';
  if (r.comLimite) {
    const usos = Number(r.usosMax);
    if (!r.usosMax) e.usosMax = 'Informe quantos membros podem resgatar.';
    else if (usos < 1) e.usosMax = 'O limite precisa ser pelo menos 1.';
    else if (usos > USOS_MAX) e.usosMax = 'Limite alto demais (máximo 10.000.000).';
    else if (modo.tipo === 'editar' && usos < modo.cupom.usos) e.usosMax = `Já houve ${fmt.int(modo.cupom.usos)} resgates: o limite não pode ser menor.`;
  }
  const inicio = campoParaMs(r.inicio);
  const fim = campoParaMs(r.fim);
  if (inicio === null) e.inicio = 'Escolha a data e a hora de início.';
  if (r.fim && fim === null) e.fim = 'Data de fim inválida.';
  else if (inicio !== null && fim !== null && fim <= inicio) e.fim = 'O fim precisa ser depois do início.';
  if (r.descricao.trim().length > DESCRICAO_MAX) e.descricao = 'Descrição muito longa (máximo 200).';
  return e;
}

/** Corpo do POST (e base do PATCH, sem o código). */
function corpoDe(r: Rascunho) {
  return {
    codigo: r.codigo,
    descricao: r.descricao.trim() || null,
    beneficio: r.beneficio,
    tickets: r.beneficio === 'giros' ? 0 : Number(r.tickets),
    giros: r.beneficio === 'giros' ? Number(r.tickets) : 0,
    usosMax: r.comLimite ? Number(r.usosMax) : null,
    inicio: campoParaIso(r.inicio) ?? undefined,
    fim: r.fim ? campoParaIso(r.fim) : null,
    ativo: r.ativo,
  };
}

/** Erros de validação do servidor ({ caminho, mensagem }) no campo certo do formulário. */
function errosDoServidor(erro: unknown): Erros {
  if (!(erro instanceof ErroApi)) return {};
  const issues = (erro.detalhes?.issues as { caminho?: string; mensagem?: string }[] | undefined) ?? [];
  const e: Erros = {};
  for (const i of issues) {
    const raiz = (i.caminho ?? '').split('.')[0] as CampoErro;
    if (ORDEM_CAMPOS.includes(raiz) && i.mensagem && !e[raiz]) e[raiz] = i.mensagem;
  }
  return e;
}

// ---------------------------------------------------------------- peças

function CampoCup({ id, rotulo, opcional, dica, erro, contador, children }: {
  id: string;
  rotulo: string;
  opcional?: boolean;
  dica?: ReactNode;
  erro?: string;
  contador?: { atual: number; max: number };
  children: ReactNode;
}) {
  return (
    <div className="pop-campo">
      <div className="pop-campo-topo">
        <label htmlFor={id} className="adm-campo-rotulo">
          {rotulo}
          {opcional && <span className="pop-opcional"> (opcional)</span>}
        </label>
        {contador && (
          <span className="pop-contador" data-excedeu={contador.atual > contador.max || undefined} aria-hidden>
            {contador.atual}/{contador.max}
          </span>
        )}
      </div>
      {children}
      {erro ? (
        <p id={`${id}-msg`} className="adm-campo-erro" role="alert">
          {erro}
        </p>
      ) : dica ? (
        <p id={`${id}-msg`} className="adm-campo-dica">
          {dica}
        </p>
      ) : null}
    </div>
  );
}

const descrito = (id: string, erro?: string, temDica = true) => ({
  id,
  'aria-invalid': erro ? true : undefined,
  'aria-describedby': erro || temDica ? `${id}-msg` : undefined,
});

/** O vale como o membro digita: código grande, quantos tickets, validade e limite. */
function PreviaVale({ r, agora }: { r: Rascunho; agora: number }) {
  const tickets = Number(r.tickets) || 0;
  const deGiros = r.beneficio === 'giros';
  const inicio = campoParaMs(r.inicio);
  const fim = campoParaMs(r.fim);
  const validade =
    fim !== null
      ? `${inicio !== null && inicio > agora + 60_000 ? `de ${dataCurta(new Date(inicio).toISOString(), agora)} ` : ''}até ${dataCurta(new Date(fim).toISOString(), agora)}`
      : inicio !== null && inicio > agora + 60_000
        ? `a partir de ${dataCurta(new Date(inicio).toISOString(), agora)}`
        : 'sem data para acabar';
  return (
    <div className="cup-previa-vale" data-apagado={!r.ativo || undefined}>
      <div className="cup-previa-topo">
        <IconeTicket className="cup-previa-ticket" />
        <span>Cupom do Intercâmbio</span>
      </div>
      <p className={cx('cup-previa-codigo', !r.codigo && 'cup-previa-codigo-vazio')}>{r.codigo || 'CÓDIGO'}</p>
      <p className="cup-previa-vale-txt">
        vale <strong>{deGiros ? `${tickets} ${tickets === 1 ? 'giro' : 'giros'} na roleta` : textoTickets(tickets)}</strong>
      </p>
      <span className="cup-previa-picote" aria-hidden />
      <p className="cup-previa-linha">
        <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden /> {validade}
      </p>
      <p className="cup-previa-linha">
        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden /> 1 resgate por membro
        {r.comLimite && Number(r.usosMax) > 0 ? ` · até ${fmt.int(Number(r.usosMax))} ${Number(r.usosMax) === 1 ? 'membro' : 'membros'}` : ''}
      </p>
      {!r.ativo && <p className="cup-previa-pausado">Pausado</p>}
    </div>
  );
}

// ---------------------------------------------------------------- formulário

function Formulario({ modo, existentes, aoFechar, aoSujar }: {
  modo: ModoCupom;
  existentes: readonly AdminCupomDTO[];
  aoFechar: () => void;
  aoSujar: (sujo: boolean) => void;
}) {
  const qc = useQueryClient();
  const uid = useId();
  const id = (campo: string) => `${uid}-${campo}`;
  const [original] = useState(() => rascunhoDe(modo, agoraServidor()));
  const [r, setR] = useState<Rascunho>(original);
  const [tentou, setTentou] = useState(false);
  const [errosServidor, setErrosServidor] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const editando = modo.tipo === 'editar';
  const usos = modo.tipo === 'editar' ? modo.cupom.usos : 0;

  const set = <K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) => {
    setR((atual) => ({ ...atual, [campo]: valor }));
    const chave = (campo === 'comLimite' ? 'usosMax' : campo) as CampoErro;
    setErrosServidor((e) => (e[chave] ? { ...e, [chave]: undefined } : e));
    setErroGeral(null);
  };

  const sujo = JSON.stringify(r) !== JSON.stringify(original);
  useEffect(() => aoSujar(sujo), [sujo, aoSujar]);

  const errosLocais = useMemo(() => validar(r, modo, existentes), [r, modo, existentes]);
  const erro = (c: CampoErro): string | undefined => errosServidor[c] ?? (tentou || (c === 'codigo' && r.codigo.length >= 4) ? errosLocais[c] : undefined);

  const salvar = useMutation({
    mutationFn: async (): Promise<AdminCupomDTO | null> => {
      const corpo = corpoDe(r);
      if (modo.tipo === 'editar') {
        // só o que mudou (a auditoria registra os campos alterados); o código não muda
        const antes = corpoDe(original) as Record<string, unknown>;
        const mudou = Object.fromEntries(
          Object.entries(corpo).filter(([k, v]) => k !== 'codigo' && JSON.stringify(v) !== JSON.stringify(antes[k])),
        );
        if (!Object.keys(mudou).length) return null;
        return (await chamar<AdminCupomDTO>('PATCH', `/api/admin/cupons/${modo.cupom.id}`, { corpo: mudou })).data;
      }
      return (await chamar<AdminCupomDTO>('POST', '/api/admin/cupons', { corpo })).data;
    },
    onSuccess: async (salvo) => {
      if (!salvo) toast('Nada mudou neste cupom.', 'info');
      else if (editando) toast(`Cupom ${salvo.codigo} salvo.`, 'sucesso');
      else {
        const premio = salvo.beneficio === 'giros' ? `${salvo.giros} ${salvo.giros === 1 ? 'giro' : 'giros'} na roleta` : textoTickets(salvo.tickets);
        toast(salvo.ativo ? `Cupom ${salvo.codigo} criado: vale ${premio}.` : `Cupom ${salvo.codigo} criado (pausado).`, 'sucesso', { duracaoMs: 4000 });
      }
      aoSujar(false);
      await Promise.all([qc.invalidateQueries({ queryKey: CHAVE_CUPONS }), qc.invalidateQueries({ queryKey: ['admin', 'auditoria'] })]);
      aoFechar();
    },
    onError: (e) => {
      const porCampo = errosDoServidor(e);
      setErrosServidor(porCampo);
      setErroGeral(Object.keys(porCampo).length ? null : mensagemAdmin(e));
      toast(mensagemAdmin(e), 'erro');
    },
  });

  const formRef = useRef<HTMLFormElement>(null);
  const enviar = () => {
    setTentou(true);
    const primeiro = ORDEM_CAMPOS.find((c) => errosLocais[c]);
    if (primeiro) {
      const alvo = formRef.current?.querySelector<HTMLElement>(`[data-campo="${primeiro}"]`);
      alvo?.focus();
      alvo?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (!editando) {
      // o mesmo schema do servidor (normaliza o código e confere tudo de novo)
      const v = AdminCupomBody.safeParse(corpoDe(r));
      if (!v.success) {
        setErroGeral(v.error.issues[0]?.message ?? 'Confira os campos.');
        return;
      }
    }
    salvar.mutate();
  };

  const agora = agoraServidor();
  const inicioMs = campoParaMs(r.inicio);
  const fimMs = campoParaMs(r.fim);
  const tickets = Number(r.tickets) || 0;
  const fuso = useMemo(() => rotuloFuso(), []);
  const atalhoFim = (dias: number) => set('fim', paraCampoData((inicioMs ?? agora) + dias * DIA));
  const passoTickets = (d: number) => set('tickets', String(Math.min(TICKETS_MAX, Math.max(1, tickets + d))));

  const comeco =
    inicioMs !== null && inicioMs > agora + 60_000
      ? `a partir de ${dataCurta(new Date(inicioMs).toISOString(), agora)}`
      : editando && inicioMs !== null
        ? 'já valendo'
        : 'a partir de agora';
  const resumo = !r.ativo
    ? 'Fica pausado: ninguém consegue resgatar até ser ligado.'
    : fimMs !== null && fimMs <= agora
      ? 'A validade já terminou: ninguém vai conseguir resgatar.'
      : `Vale ${r.beneficio === 'giros' ? `${tickets} ${tickets === 1 ? 'giro' : 'giros'} na roleta` : textoTickets(tickets)} por membro${r.comLimite && Number(r.usosMax) > 0 ? `, para até ${fmt.int(Number(r.usosMax))} ${Number(r.usosMax) === 1 ? 'membro' : 'membros'}` : ''}, ${comeco}${
          fimMs !== null ? ` até ${dataCurta(new Date(fimMs).toISOString(), agora)}` : ', sem data para acabar'
        }.`;
  const rotuloSalvar = editando
    ? 'Salvar alterações'
    : !r.ativo
      ? 'Salvar pausado'
      : inicioMs !== null && inicioMs > agora + 60_000
        ? 'Agendar cupom'
        : 'Criar cupom';
  const dicaFim = !r.fim
    ? 'Sem data de fim: vale até ser pausado ou esgotar.'
    : fimMs !== null && inicioMs !== null && fimMs > inicioMs
      ? `Vale por ${emQuanto(fimMs - inicioMs).replace(/^em /, '')}.`
      : undefined;

  return (
    <form
      ref={formRef}
      className="cup-form"
      noValidate
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        enviar();
      }}
    >
      <div className="cup-form-campos">
        {editando ? (
          <div className="pop-campo">
            <span className="adm-campo-rotulo">Código</span>
            <p className="cup-codigo-fixo">
              <span className="cup-codigo-texto">{r.codigo}</span>
              <span className="cup-codigo-fixo-nota">
                <Lock className="h-3.5 w-3.5" aria-hidden /> o código não muda depois de criado
              </span>
            </p>
          </div>
        ) : (
          <CampoCup
            id={id('codigo')}
            rotulo="Código"
            erro={erro('codigo')}
            dica="4 a 20 letras e números. O membro pode digitar em minúsculas, com espaço ou traço."
          >
            <div className="cup-codigo-campo">
              <input
                {...descrito(id('codigo'), erro('codigo'))}
                data-campo="codigo"
                type="text"
                className="adm-input cup-codigo-input"
                value={r.codigo}
                onChange={(e) => set('codigo', limparCodigo(e.target.value))}
                placeholder="Ex.: PASCOA26"
                maxLength={40}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <BotaoAdm onClick={() => set('codigo', gerarCodigo())} title="Gerar um código fácil de ditar">
                <Dices className="h-4 w-4" aria-hidden /> Gerar
              </BotaoAdm>
            </div>
          </CampoCup>
        )}

        <fieldset className="pop-campo">
          <legend className="adm-campo-rotulo">O que o cupom dá</legend>
          <div className="adm-us-segmentos" role="radiogroup" aria-label="O que o cupom dá">
            <button type="button" role="radio" aria-checked={r.beneficio === 'tickets'} className="adm-us-segmento" onClick={() => set('beneficio', 'tickets')}>
              Tickets
            </button>
            <button type="button" role="radio" aria-checked={r.beneficio === 'giros'} className="adm-us-segmento" onClick={() => set('beneficio', 'giros')}>
              Giros da roleta
            </button>
          </div>
        </fieldset>

        <CampoCup
          id={id('tickets')}
          rotulo={r.beneficio === 'giros' ? 'Giros por membro' : 'Tickets por membro'}
          erro={erro('tickets')}
          dica={
            usos > 0
              ? 'Vale para os próximos resgates; quem já resgatou fica com o que recebeu.'
              : r.beneficio === 'giros'
                ? 'Cada membro ganha esses giros ao resgatar. Na roleta, o clique gira sem pedir PIX.'
                : 'Cada membro recebe isso ao resgatar (uma vez só).'
          }
        >
          <span className="adm-us-passo itc-passo">
            <button type="button" className="adm-us-passo-botao" onClick={() => passoTickets(-1)} aria-label={r.beneficio === 'giros' ? 'Menos 1 giro' : 'Menos 1 ticket'} disabled={tickets <= 1}>
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <input
              {...descrito(id('tickets'), erro('tickets'))}
              data-campo="tickets"
              className="adm-input tabular-nums"
              type="text"
              inputMode="numeric"
              value={r.tickets}
              autoComplete="off"
              onChange={(e) => set('tickets', soDigitos(e.target.value, 5))}
            />
            <button type="button" className="adm-us-passo-botao" onClick={() => passoTickets(1)} aria-label={r.beneficio === 'giros' ? 'Mais 1 giro' : 'Mais 1 ticket'} disabled={tickets >= TICKETS_MAX}>
              <Plus className="h-4 w-4" aria-hidden />
            </button>
            <span className="adm-us-passo-total">{r.beneficio === 'giros' ? (tickets === 1 ? 'giro' : 'giros') : (tickets === 1 ? 'ticket' : 'tickets')}</span>
          </span>
          <div className="adm-us-sugestoes" aria-label="Quantidades rápidas">
            {[1, 3, 5, 10, 20, 50].map((n) => (
              <button key={n} type="button" className="adm-us-sugestao" data-marcada={tickets === n || undefined} onClick={() => set('tickets', String(n))}>
                {r.beneficio === 'giros' ? `${n} ${n === 1 ? 'giro' : 'giros'}` : textoTickets(n)}
              </button>
            ))}
          </div>
        </CampoCup>

        <fieldset className="pop-campo">
          <legend className="adm-campo-rotulo">Limite de usos</legend>
          <div className="adm-us-segmentos" role="radiogroup" aria-label="Limite de usos">
            <button type="button" role="radio" aria-checked={!r.comLimite} className="adm-us-segmento" onClick={() => set('comLimite', false)}>
              <SemLimite className="h-4 w-4" aria-hidden /> Sem limite
            </button>
            <button type="button" role="radio" aria-checked={r.comLimite} className="adm-us-segmento" onClick={() => set('comLimite', true)}>
              <Users className="h-4 w-4" aria-hidden /> Até N membros
            </button>
          </div>
          {r.comLimite ? (
            <div className="pop-sub">
              <span className="cup-limite-campo">
                <label htmlFor={id('usos')} className="sr-only">
                  Quantos membros podem resgatar
                </label>
                <input
                  {...descrito(id('usos'), erro('usosMax'))}
                  data-campo="usosMax"
                  className="adm-input tabular-nums"
                  type="text"
                  inputMode="numeric"
                  value={r.usosMax}
                  autoComplete="off"
                  onChange={(e) => set('usosMax', soDigitos(e.target.value, 8))}
                />
                <span>{Number(r.usosMax) === 1 ? 'membro pode resgatar' : 'membros podem resgatar'}</span>
              </span>
              {erro('usosMax') ? (
                <p id={`${id('usos')}-msg`} className="adm-campo-erro" role="alert">
                  {erro('usosMax')}
                </p>
              ) : (
                <p id={`${id('usos')}-msg`} className="adm-campo-dica">
                  {usos > 0 ? `Já houve ${fmt.int(usos)} ${usos === 1 ? 'resgate' : 'resgates'}. ` : ''}Ao chegar no limite, o cupom fica esgotado.
                </p>
              )}
            </div>
          ) : (
            <p className="adm-campo-dica">Qualquer membro pode resgatar (uma vez cada) enquanto o cupom valer.</p>
          )}
        </fieldset>

        <div className="pop-periodo cup-periodo">
          <CampoCup
            id={id('inicio')}
            rotulo="Início"
            erro={erro('inicio')}
            dica={inicioMs !== null && inicioMs > agora + 60_000 ? `Começa ${emQuanto(inicioMs - agora)}.` : editando ? 'Já começou.' : 'Vale assim que for salvo.'}
          >
            <div className="pop-data">
              <input
                {...descrito(id('inicio'), erro('inicio'))}
                data-campo="inicio"
                type="datetime-local"
                className="adm-input"
                value={r.inicio}
                onChange={(e) => set('inicio', e.target.value)}
                required
              />
              <button type="button" className="pop-link" onClick={() => set('inicio', paraCampoData(agoraServidor()))}>
                Agora
              </button>
            </div>
          </CampoCup>
          <CampoCup id={id('fim')} rotulo="Fim" opcional erro={erro('fim')} dica={dicaFim}>
            <div className="pop-data">
              <input
                {...descrito(id('fim'), erro('fim'), !!dicaFim)}
                data-campo="fim"
                type="datetime-local"
                className="adm-input"
                value={r.fim}
                min={r.inicio || undefined}
                onChange={(e) => set('fim', e.target.value)}
              />
              {r.fim && (
                <button type="button" className="pop-link" onClick={() => set('fim', '')}>
                  Sem fim
                </button>
              )}
            </div>
            <div className="pop-atalhos" aria-label="Atalhos para o fim">
              {[1, 3, 7, 30].map((d) => (
                <button key={d} type="button" className="pop-atalho" onClick={() => atalhoFim(d)}>
                  +{d} {d === 1 ? 'dia' : 'dias'}
                </button>
              ))}
            </div>
          </CampoCup>
          <p className="pop-fuso">
            <CalendarClock className="h-3.5 w-3.5 flex-none" aria-hidden /> Datas no {fuso}.
          </p>
        </div>

        <CampoCup
          id={id('descricao')}
          rotulo="Descrição interna"
          opcional
          contador={{ atual: r.descricao.trim().length, max: DESCRICAO_MAX }}
          dica="Só a equipe vê. Ex.: live de sexta, campanha de Páscoa no Instagram."
          erro={erro('descricao')}
        >
          <input
            {...descrito(id('descricao'), erro('descricao'))}
            data-campo="descricao"
            type="text"
            className="adm-input"
            value={r.descricao}
            onChange={(e) => set('descricao', e.target.value)}
            placeholder="Para que é este cupom?"
            maxLength={240}
            autoComplete="off"
          />
        </CampoCup>

        <div className="pop-campo">
          <span className="adm-campo-rotulo" id={id('ativo-rotulo')}>
            Situação
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={r.ativo}
            aria-labelledby={id('ativo-rotulo')}
            aria-describedby={id('ativo-texto')}
            className="pop-switch"
            onClick={() => set('ativo', !r.ativo)}
          >
            <span className="pop-switch-trilho" aria-hidden>
              <span className="pop-switch-bola" />
            </span>
            <span id={id('ativo-texto')} className="pop-switch-texto">
              <strong>{r.ativo ? 'Ligado' : 'Pausado'}</strong>
              <span>{r.ativo ? 'Vale no período escolhido.' : 'Fica guardado: ninguém consegue resgatar.'}</span>
            </span>
          </button>
        </div>
      </div>

      <aside className="cup-form-previa" aria-label="Prévia do cupom">
        <p className="itc-previa-titulo">Prévia do vale</p>
        <PreviaVale r={r} agora={agora} />
        <p className="itc-texto-suave">
          O membro digita o código no jogo e recebe o prêmio na hora — uma vez por membro. Tickets viram vales do Intercâmbio. Giros entram na roleta sem PIX.
        </p>
      </aside>

      <div className="pop-form-rodape cup-form-rodape">
        {erroGeral && (
          <p className="adm-us-erro cup-form-erro" role="alert">
            {erroGeral}
          </p>
        )}
        <p className={cx('pop-form-resumo', (!r.ativo || (fimMs !== null && fimMs <= agora)) && 'pop-form-resumo-pausado')} aria-live="polite">
          {resumo}
        </p>
        <div className="pop-form-botoes">
          <BotaoAdm onClick={aoFechar}>Cancelar</BotaoAdm>
          <BotaoAdm type="submit" variante="primario" disabled={salvar.isPending}>
            {salvar.isPending ? 'Salvando…' : rotuloSalvar}
          </BotaoAdm>
        </div>
      </div>
    </form>
  );
}

/** Modal do formulário: pede confirmação antes de descartar alterações (Esc, clique fora, Cancelar). */
export function ModalFormCupom({ modo, existentes, aoFechar }: { modo: ModoCupom | null; existentes: readonly AdminCupomDTO[]; aoFechar: () => void }) {
  const sujo = useRef(false);
  const [confirmando, setConfirmando] = useState(false);
  // estável de propósito: o ModalAdm refaz o foco inicial sempre que aoFechar muda de identidade
  const pedirFechar = useCallback(() => {
    if (sujo.current) setConfirmando(true);
    else aoFechar();
  }, [aoFechar]);
  const aoSujar = useCallback((s: boolean) => {
    sujo.current = s;
  }, []);
  useEffect(() => {
    if (!modo) {
      setConfirmando(false);
      sujo.current = false;
    }
  }, [modo]);
  const titulo = modo?.tipo === 'editar' ? `Editar cupom ${modo.cupom.codigo}` : 'Novo cupom';
  return (
    <ModalAdm aberto={!!modo} titulo={titulo} aoFechar={pedirFechar} largura="g">
      {modo && (
        <>
          <Formulario key={modo.tipo === 'novo' ? 'novo' : modo.cupom.id} modo={modo} existentes={existentes} aoFechar={pedirFechar} aoSujar={aoSujar} />
          {confirmando && (
            <div className="pop-descartar" role="alertdialog" aria-label="Descartar alterações?">
              <p>
                <strong>Descartar as alterações?</strong> O que você preencheu neste cupom vai se perder.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <BotaoAdm tamanho="p" onClick={() => setConfirmando(false)} autoFocus>
                  Continuar editando
                </BotaoAdm>
                <BotaoAdm
                  tamanho="p"
                  variante="perigo"
                  onClick={() => {
                    setConfirmando(false);
                    sujo.current = false;
                    aoFechar();
                  }}
                >
                  Descartar
                </BotaoAdm>
              </div>
            </div>
          )}
        </>
      )}
    </ModalAdm>
  );
}

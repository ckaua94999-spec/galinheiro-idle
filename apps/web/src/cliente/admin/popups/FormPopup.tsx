'use client';

// Formulário de criar/editar/duplicar popup (num ModalAdm largo) com prévia ao vivo ao lado: conteúdo (título,
// mensagem, imagem, texto do botão e link), público (todos ou membros escolhidos), frequência, período e
// ligado/pausado. Valida como o servidor (mesmas mensagens) e mostra os erros do servidor no campo certo.
import type { AdminPopupDTO } from '@galinheiro/api-contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ExternalLink, Gamepad2, Link2Off, Users, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { chamar, ErroApi } from '../../api';
import { agoraServidor } from '../../relogio';
import { toast } from '../../ui';
import { cx } from '../../util';
import { BotaoAdm, mensagemAdmin, ModalAdm } from '../ui';
import { EscolherMembros, useAtrasado } from './EscolherMembros';
import { PreviaPopup } from './PreviaPopup';
import {
  campoParaIso, campoParaMs, ehHttps, emQuanto, FREQUENCIAS, paraCampoData, rotuloFuso, TELAS_JOGO, type Frequencia,
} from './util';

export type ModoForm = { tipo: 'novo' } | { tipo: 'editar'; popup: AdminPopupDTO } | { tipo: 'duplicar'; popup: AdminPopupDTO };

export const CHAVE_POPUPS = ['admin', 'popups', 'lista'] as const;

const LIMITES = { titulo: 80, mensagem: 1000, botaoTexto: 30 } as const;
const DIA = 86_400_000;

type TipoLink = 'nenhum' | 'jogo' | 'externo';

interface Rascunho {
  titulo: string;
  mensagem: string;
  imagemUrl: string;
  botaoTexto: string;
  tipoLink: TipoLink;
  linkJogo: string;
  linkExterno: string;
  publico: 'todos' | 'contas';
  contas: string[];
  frequencia: Frequencia;
  /** datetime-local (horário do navegador) */
  inicio: string;
  fim: string;
  ativo: boolean;
}

type CampoErro = 'titulo' | 'mensagem' | 'imagemUrl' | 'botaoTexto' | 'link' | 'contas' | 'inicio' | 'fim';
type Erros = Partial<Record<CampoErro, string>>;
const ORDEM_CAMPOS: CampoErro[] = ['titulo', 'mensagem', 'imagemUrl', 'botaoTexto', 'link', 'contas', 'inicio', 'fim'];

function comSufixo(texto: string, sufixo: string, max: number): string {
  return texto.length + sufixo.length <= max ? texto + sufixo : `${texto.slice(0, max - sufixo.length).trimEnd()}${sufixo}`;
}

function rascunhoDe(modo: ModoForm, agora: number): Rascunho {
  if (modo.tipo === 'novo') {
    return {
      titulo: '', mensagem: '', imagemUrl: '', botaoTexto: '', tipoLink: 'nenhum', linkJogo: '/roleta', linkExterno: '',
      publico: 'todos', contas: [], frequencia: 'uma_vez', inicio: paraCampoData(agora), fim: '', ativo: true,
    };
  }
  const p = modo.popup;
  const tipoLink: TipoLink = !p.link ? 'nenhum' : p.link.startsWith('/') ? 'jogo' : 'externo';
  const base: Rascunho = {
    titulo: p.titulo,
    mensagem: p.mensagem,
    imagemUrl: p.imagemUrl ?? '',
    botaoTexto: p.botaoTexto ?? '',
    tipoLink,
    linkJogo: tipoLink === 'jogo' && p.link ? p.link : '/roleta',
    linkExterno: tipoLink === 'externo' && p.link ? p.link : '',
    publico: p.publico,
    contas: p.contas,
    frequencia: p.frequencia,
    inicio: paraCampoData(Date.parse(p.inicio)),
    fim: p.fim ? paraCampoData(Date.parse(p.fim)) : '',
    ativo: p.ativo,
  };
  if (modo.tipo === 'editar') return base;
  // duplicar: mesmo conteúdo, começa agora (com a mesma duração) e nasce pausado, para a equipe conferir antes
  const duracao = p.fim ? Date.parse(p.fim) - Date.parse(p.inicio) : null;
  return {
    ...base,
    titulo: comSufixo(p.titulo, ' (cópia)', LIMITES.titulo),
    inicio: paraCampoData(agora),
    fim: duracao && duracao > 0 ? paraCampoData(agora + duracao) : '',
    ativo: false,
  };
}

const linkDo = (r: Rascunho): string | null =>
  r.tipoLink === 'jogo' ? r.linkJogo : r.tipoLink === 'externo' ? r.linkExterno.trim() : null;

/** Corpo do POST (e base do PATCH). */
function corpoDe(r: Rascunho) {
  return {
    titulo: r.titulo.trim(),
    mensagem: r.mensagem.trim(),
    imagemUrl: r.imagemUrl.trim() || null,
    botaoTexto: r.botaoTexto.trim() || null,
    link: linkDo(r),
    publico: r.publico,
    contas: r.publico === 'contas' ? r.contas : [],
    frequencia: r.frequencia,
    inicio: campoParaIso(r.inicio) ?? undefined,
    fim: r.fim ? campoParaIso(r.fim) : null,
    ativo: r.ativo,
  };
}

/** Mesmas regras (e mensagens) do servidor, para avisar antes de enviar. */
function validar(r: Rascunho): Erros {
  const e: Erros = {};
  const titulo = r.titulo.trim();
  const mensagem = r.mensagem.trim();
  if (!titulo) e.titulo = 'Dê um título.';
  else if (titulo.length > LIMITES.titulo) e.titulo = 'Título muito longo (máximo 80).';
  if (!mensagem) e.mensagem = 'Escreva a mensagem.';
  else if (mensagem.length > LIMITES.mensagem) e.mensagem = 'Mensagem muito longa (máximo 1000).';
  if (r.imagemUrl.trim() && !ehHttps(r.imagemUrl.trim())) e.imagemUrl = 'A imagem precisa ser um endereço https://';
  if (r.botaoTexto.trim().length > LIMITES.botaoTexto) e.botaoTexto = 'Texto do botão muito longo (máximo 30).';
  if (r.tipoLink === 'externo' && !ehHttps(r.linkExterno.trim())) e.link = 'Use um endereço que comece com https://';
  if (r.publico === 'contas' && r.contas.length === 0) e.contas = 'Escolha pelo menos um usuário.';
  const inicio = campoParaMs(r.inicio);
  const fim = campoParaMs(r.fim);
  if (inicio === null) e.inicio = 'Escolha a data e a hora de início.';
  if (r.fim && fim === null) e.fim = 'Data de fim inválida.';
  else if (inicio !== null && fim !== null && fim <= inicio) e.fim = 'O fim precisa ser depois do início.';
  return e;
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

// ---------------------------------------------------------------- peças do formulário

function CampoPop({ id, rotulo, contador, dica, erro, children, opcional }: {
  id: string;
  rotulo: string;
  contador?: { atual: number; max: number };
  dica?: ReactNode;
  erro?: string;
  opcional?: boolean;
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

/** Atributos de acessibilidade de um campo com mensagem (dica ou erro) embaixo. */
const descrito = (id: string, erro?: string, temDica = true) => ({
  id,
  'aria-invalid': erro ? true : undefined,
  'aria-describedby': erro || temDica ? `${id}-msg` : undefined,
});

function Segmentos<T extends string>({ nome, valor, opcoes, aoMudar, rotulo }: {
  nome: string;
  valor: T;
  opcoes: { valor: T; rotulo: string; Icone: typeof Users }[];
  aoMudar: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div className="pop-segmentos" role="radiogroup" aria-label={rotulo}>
      {opcoes.map(({ valor: v, rotulo: r, Icone }) => (
        <label key={v} className="pop-segmento" data-marcado={valor === v || undefined}>
          <input type="radio" name={nome} value={v} checked={valor === v} onChange={() => aoMudar(v)} className="sr-only" />
          <Icone className="h-4 w-4 flex-none" aria-hidden />
          <span>{r}</span>
        </label>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- formulário

function Formulario({ modo, aoFechar, aoSujar }: { modo: ModoForm; aoFechar: () => void; aoSujar: (sujo: boolean) => void }) {
  const qc = useQueryClient();
  const uid = useId();
  const id = (campo: string) => `${uid}-${campo}`;
  const [original] = useState(() => rascunhoDe(modo, agoraServidor()));
  const [r, setR] = useState<Rascunho>(original);
  const [tentou, setTentou] = useState(false);
  const [errosServidor, setErrosServidor] = useState<Erros>({});

  const set = <K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) => {
    setR((atual) => ({ ...atual, [campo]: valor }));
    // o erro do servidor some quando o campo muda
    const chave = (campo === 'linkJogo' || campo === 'linkExterno' || campo === 'tipoLink' ? 'link' : campo === 'publico' ? 'contas' : campo) as CampoErro;
    setErrosServidor((e) => (e[chave] ? { ...e, [chave]: undefined } : e));
  };

  const sujo = JSON.stringify(r) !== JSON.stringify(original);
  useEffect(() => aoSujar(sujo), [sujo, aoSujar]);

  const errosLocais = useMemo(() => validar(r), [r]);
  const erro = (c: CampoErro): string | undefined => errosServidor[c] ?? (tentou ? errosLocais[c] : undefined);

  // imagem: confere se o endereço abre mesmo (só avisa; quem decide é a equipe)
  const imagem = useAtrasado(r.imagemUrl.trim(), 500);
  const [estadoImagem, setEstadoImagem] = useState<'ok' | 'erro' | 'carregando' | null>(null);
  useEffect(() => {
    if (!ehHttps(imagem)) {
      setEstadoImagem(null);
      return;
    }
    setEstadoImagem('carregando');
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => setEstadoImagem('ok');
    img.onerror = () => setEstadoImagem('erro');
    img.src = imagem;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imagem]);

  const agora = agoraServidor();
  const inicioMs = campoParaMs(r.inicio);
  const fimMs = campoParaMs(r.fim);
  const linkPrevia = linkDo(r);
  const previa = {
    titulo: r.titulo,
    mensagem: r.mensagem.trim() || 'A mensagem do aviso aparece aqui.',
    imagemUrl: ehHttps(r.imagemUrl.trim()) && estadoImagem !== 'erro' ? r.imagemUrl.trim() : null,
    botaoTexto: r.botaoTexto.trim() || null,
    link: linkPrevia && (r.tipoLink === 'jogo' || ehHttps(linkPrevia)) ? linkPrevia : null,
  };

  const editando = modo.tipo === 'editar';
  const salvar = useMutation({
    mutationFn: async (): Promise<AdminPopupDTO | null> => {
      const corpo = corpoDe(r);
      if (modo.tipo === 'editar') {
        // só o que mudou (a auditoria registra os campos alterados)
        const antes = corpoDe(original) as Record<string, unknown>;
        const mudou = Object.fromEntries(Object.entries(corpo).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(antes[k])));
        if (!Object.keys(mudou).length) return null;
        return (await chamar<AdminPopupDTO>('PATCH', `/api/admin/popups/${modo.popup.id}`, { corpo: mudou })).data;
      }
      return (await chamar<AdminPopupDTO>('POST', '/api/admin/popups', { corpo })).data;
    },
    onSuccess: (salvo) => {
      void qc.invalidateQueries({ queryKey: CHAVE_POPUPS });
      if (!salvo) toast('Nada mudou neste popup.', 'info');
      else if (editando) toast('Alterações salvas.', 'sucesso');
      else toast(salvo.ativo ? 'Popup criado e ligado.' : 'Popup criado (pausado).', 'sucesso');
      aoSujar(false);
      aoFechar();
    },
    onError: (e) => {
      setErrosServidor(errosDoServidor(e));
      toast(mensagemAdmin(e), 'erro');
    },
  });

  const formRef = useRef<HTMLFormElement>(null);
  const enviar = () => {
    setTentou(true);
    const primeiro = ORDEM_CAMPOS.find((c) => errosLocais[c]);
    if (primeiro) {
      // leva o foco ao 1º campo com problema
      const alvo = formRef.current?.querySelector<HTMLElement>(`[data-campo="${primeiro}"]`);
      alvo?.focus();
      alvo?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    salvar.mutate();
  };

  // resumo do que vai acontecer (rodapé)
  const quando =
    inicioMs !== null && inicioMs > agora + 60_000 ? `a partir de ${new Date(inicioMs).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'agora';
  const paraQuem = r.publico === 'todos' ? 'todos os membros' : r.contas.length === 1 ? '1 membro' : `${r.contas.length} membros`;
  const semPublico = r.publico === 'contas' && r.contas.length === 0;
  const resumo = !r.ativo
    ? 'Fica pausado: não aparece para ninguém até ser ligado.'
    : fimMs !== null && fimMs <= agora
      ? 'O período já terminou: não vai aparecer.'
      : semPublico
        ? 'Escolha quem vai ver o aviso.'
        : `Aparece ${quando} para ${paraQuem}.`;
  const rotuloSalvar = editando
    ? 'Salvar alterações'
    : !r.ativo
      ? 'Salvar pausado'
      : inicioMs !== null && inicioMs > agora + 60_000
        ? 'Agendar popup'
        : 'Publicar popup';

  const dicaFim = !r.fim
    ? 'Sem data de fim: fica no ar até ser pausado.'
    : fimMs !== null && inicioMs !== null && fimMs > inicioMs
      ? `Fica no ar por ${emQuanto(fimMs - inicioMs).replace(/^em /, '')}.`
      : undefined;
  const fuso = useMemo(() => rotuloFuso(), []);
  const atalhoFim = (dias: number) => set('fim', paraCampoData((inicioMs ?? agora) + dias * DIA));

  return (
    <form
      ref={formRef}
      className="pop-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
    >
      {/* ------------------------------------------------ conteúdo */}
      <fieldset className="pop-secao pop-secao-conteudo">
        <legend className="pop-secao-titulo">Conteúdo</legend>
        <CampoPop
          id={id('titulo')}
          rotulo="Título"
          contador={{ atual: r.titulo.trim().length, max: LIMITES.titulo }}
          dica="Aparece na faixa colorida no alto do aviso."
          erro={erro('titulo')}
        >
          <input
            {...descrito(id('titulo'), erro('titulo'))}
            data-campo="titulo"
            type="text"
            className="adm-input"
            value={r.titulo}
            onChange={(e) => set('titulo', e.target.value)}
            placeholder="Ex.: Roleta em dobro no fim de semana!"
            maxLength={120}
            autoComplete="off"
          />
        </CampoPop>
        <CampoPop
          id={id('mensagem')}
          rotulo="Mensagem"
          contador={{ atual: r.mensagem.trim().length, max: LIMITES.mensagem }}
          dica="Pode quebrar linhas; aparece centralizada, como na prévia."
          erro={erro('mensagem')}
        >
          <textarea
            {...descrito(id('mensagem'), erro('mensagem'))}
            data-campo="mensagem"
            className="adm-input pop-mensagem"
            value={r.mensagem}
            onChange={(e) => set('mensagem', e.target.value)}
            placeholder="Conte a novidade em poucas linhas."
            rows={4}
          />
        </CampoPop>
        <CampoPop
          id={id('imagem')}
          rotulo="Imagem"
          opcional
          dica={
            estadoImagem === 'erro' ? (
              <span className="pop-aviso-imagem">Não conseguimos abrir essa imagem. Confira se é o link direto do arquivo.</span>
            ) : estadoImagem === 'carregando' ? (
              'Carregando a imagem…'
            ) : (
              'Endereço https:// de uma imagem (aparece no topo do aviso).'
            )
          }
          erro={erro('imagemUrl')}
        >
          <input
            {...descrito(id('imagem'), erro('imagemUrl'))}
            data-campo="imagemUrl"
            type="url"
            inputMode="url"
            className="adm-input"
            value={r.imagemUrl}
            onChange={(e) => set('imagemUrl', e.target.value)}
            placeholder="https://…"
            autoComplete="off"
            spellCheck={false}
          />
        </CampoPop>
        <CampoPop
          id={id('botao')}
          rotulo="Texto do botão"
          opcional
          contador={{ atual: r.botaoTexto.trim().length, max: LIMITES.botaoTexto }}
          dica={`Se ficar vazio: “${r.tipoLink === 'nenhum' ? 'Entendi' : 'Ver agora'}”.`}
          erro={erro('botaoTexto')}
        >
          <input
            {...descrito(id('botao'), erro('botaoTexto'))}
            data-campo="botaoTexto"
            type="text"
            className="adm-input"
            value={r.botaoTexto}
            onChange={(e) => set('botaoTexto', e.target.value)}
            placeholder={r.tipoLink === 'nenhum' ? 'Entendi' : 'Ver agora'}
            maxLength={60}
            autoComplete="off"
          />
        </CampoPop>

        <fieldset className="pop-campo">
          <legend className="adm-campo-rotulo">O botão leva para</legend>
          <Segmentos
            nome={id('tipo-link')}
            rotulo="Destino do botão"
            valor={r.tipoLink}
            aoMudar={(v) => set('tipoLink', v)}
            opcoes={[
              { valor: 'nenhum', rotulo: 'Sem link', Icone: Link2Off },
              { valor: 'jogo', rotulo: 'Tela do jogo', Icone: Gamepad2 },
              { valor: 'externo', rotulo: 'Site externo', Icone: ExternalLink },
            ]}
          />
          {r.tipoLink === 'nenhum' && <p className="adm-campo-dica">O botão só fecha o aviso.</p>}
          {r.tipoLink === 'jogo' && (
            <div className="pop-sub">
              <label htmlFor={id('link-jogo')} className="sr-only">
                Tela do jogo
              </label>
              <select
                id={id('link-jogo')}
                data-campo="link"
                className="adm-input"
                value={r.linkJogo}
                onChange={(e) => set('linkJogo', e.target.value)}
              >
                {TELAS_JOGO.map((t) => (
                  <option key={t.caminho} value={t.caminho}>
                    {t.rotulo} — {t.caminho}
                  </option>
                ))}
                {!TELAS_JOGO.some((t) => t.caminho === r.linkJogo) && <option value={r.linkJogo}>Outra tela — {r.linkJogo}</option>}
              </select>
              <p className="adm-campo-dica">O membro vai direto para essa tela, dentro do jogo.</p>
            </div>
          )}
          {r.tipoLink === 'externo' && (
            <div className="pop-sub">
              <label htmlFor={id('link-externo')} className="sr-only">
                Endereço externo
              </label>
              <input
                {...descrito(id('link-externo'), erro('link'))}
                data-campo="link"
                type="url"
                inputMode="url"
                className="adm-input"
                value={r.linkExterno}
                onChange={(e) => set('linkExterno', e.target.value)}
                placeholder="https://…"
                autoComplete="off"
                spellCheck={false}
              />
              {erro('link') ? (
                <p id={`${id('link-externo')}-msg`} className="adm-campo-erro" role="alert">
                  {erro('link')}
                </p>
              ) : (
                <p id={`${id('link-externo')}-msg`} className="adm-campo-dica">
                  Abre em outra aba do navegador do membro.
                </p>
              )}
            </div>
          )}
        </fieldset>
      </fieldset>

      {/* ------------------------------------------------ prévia */}
      <section className="pop-form-previa" aria-label="Prévia">
        <p className="pop-previa-titulo">Prévia no jogo</p>
        <PreviaPopup popup={previa} />
        <p className="pop-previa-legenda">Assim o aviso aparece na tela do membro.</p>
      </section>

      {/* ------------------------------------------------ público e período */}
      <fieldset className="pop-secao pop-secao-regras">
        <legend className="pop-secao-titulo">Quem vê e quando</legend>

        <fieldset className="pop-campo">
          <legend className="adm-campo-rotulo">Público</legend>
          <Segmentos
            nome={id('publico')}
            rotulo="Público"
            valor={r.publico}
            aoMudar={(v) => set('publico', v)}
            opcoes={[
              { valor: 'todos', rotulo: 'Todos os membros', Icone: UsersRound },
              { valor: 'contas', rotulo: 'Escolher membros', Icone: Users },
            ]}
          />
          {r.publico === 'contas' ? (
            <div className="pop-sub" data-campo="contas" tabIndex={-1}>
              <label htmlFor={id('membros')} className="sr-only">
                Buscar membro
              </label>
              <EscolherMembros idCampo={id('membros')} ids={r.contas} aoMudar={(ids) => set('contas', ids)} erro={erro('contas')} />
            </div>
          ) : (
            <p className="adm-campo-dica">Aparece para todo mundo que abrir o jogo no período.</p>
          )}
        </fieldset>

        <fieldset className="pop-campo">
          <legend className="adm-campo-rotulo">Frequência</legend>
          <div className="pop-frequencias">
            {FREQUENCIAS.map((f) => (
              <label key={f.valor} className="pop-frequencia" data-marcado={r.frequencia === f.valor || undefined}>
                <input type="radio" name={id('frequencia')} value={f.valor} checked={r.frequencia === f.valor} onChange={() => set('frequencia', f.valor)} />
                <span>
                  <strong>{f.rotulo}</strong>
                  <span>{f.explicacao}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="pop-periodo">
          <CampoPop
            id={id('inicio')}
            rotulo="Início"
            erro={erro('inicio')}
            dica={inicioMs !== null && inicioMs > agora + 60_000 ? `Começa ${emQuanto(inicioMs - agora)}.` : editando ? 'Já começou.' : 'Começa assim que for salvo.'}
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
          </CampoPop>
          <CampoPop id={id('fim')} rotulo="Fim" opcional erro={erro('fim')} dica={dicaFim}>
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
          </CampoPop>
        </div>
        <p className="pop-fuso">
          <CalendarClock className="h-3.5 w-3.5 flex-none" aria-hidden /> Datas no {fuso}.
        </p>

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
              <span>{r.ativo ? 'Aparece no período escolhido.' : 'Fica guardado e não aparece para ninguém.'}</span>
            </span>
          </button>
        </div>
      </fieldset>

      {/* ------------------------------------------------ rodapé */}
      <div className="pop-form-rodape">
        <p className={cx('pop-form-resumo', (!r.ativo || semPublico || (fimMs !== null && fimMs <= agora)) && 'pop-form-resumo-pausado')} aria-live="polite">
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
export function ModalFormPopup({ modo, aoFechar }: { modo: ModoForm | null; aoFechar: () => void }) {
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
  const titulo = modo?.tipo === 'editar' ? 'Editar popup' : modo?.tipo === 'duplicar' ? 'Duplicar popup' : 'Novo popup';
  return (
    <ModalAdm aberto={!!modo} titulo={titulo} aoFechar={pedirFechar} largura="g">
      {modo && (
        <>
          <Formulario key={modo.tipo === 'novo' ? 'novo' : `${modo.tipo}-${modo.popup.id}`} modo={modo} aoFechar={pedirFechar} aoSujar={aoSujar} />
          {confirmando && (
            <div className="pop-descartar" role="alertdialog" aria-label="Descartar alterações?">
              <p>
                <strong>Descartar as alterações?</strong> O que você escreveu neste popup vai se perder.
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

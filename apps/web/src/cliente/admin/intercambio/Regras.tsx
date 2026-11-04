'use client';

// Regras do Intercâmbio no painel: aberto/fechado, compra de tickets com moedas do jogo (padrão: desligada), preço
// do ticket e limite de compra por membro por dia (ou sem limite). O rascunho mora num hook (a tela usa o rascunho
// válido para a prévia da regra "sem lucro" nas ofertas). Valida com o MESMO schema do servidor, mostra o preço
// mínimo sem lucro, pede confirmação (o que muda e os avisos) e mostra a recusa do servidor quando a regra barra.
import { AdminIntercambioConfigBody, type AdminIntercambioDTO, type ConfigIntercambioDTO } from '@galinheiro/api-contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CircleCheck, DoorClosed, DoorOpen, History, Infinity as SemLimite, Info, Lock, RotateCcw, Save, ShieldCheck, ShoppingCart, TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ErroApi, chamar } from '../../api';
import { Moeda } from '../../arte/Icones';
import { toast } from '../../ui';
import { cx } from '../../util';
import { TituloSecao } from '../afiliados/comum';
import { BotaoAdm, Cartao, ModalAdm, Selo, fmt, mensagemAdmin } from '../ui';
import { AcoesModal, Alerta, ErroModal, lerMoedas, soDigitos } from '../usuarios/comum';
import { CHAVE_INTERCAMBIO, IconeTicket } from './comum';
import {
  LIMITE_DIA_MAX, PRECO_MAX_X100, analisarOferta, mudancasRegras, ofertaPorTickets, ofertasLucrativas, pctBp, precoMinimoSemLucro, resumoRegras,
  textoTickets,
} from './formato';

export interface RascunhoRegras {
  ativo: boolean;
  compraAtiva: boolean;
  /** texto do campo do preço, em moedas ("10,00") */
  preco: string;
  comLimite: boolean;
  /** texto do campo do limite (tickets por dia) */
  limite: string;
}

interface ErrosRegras {
  preco: string | null;
  limite: string | null;
  geral: string | null;
}

const deRegras = (c: ConfigIntercambioDTO): RascunhoRegras => ({
  ativo: c.ativo,
  compraAtiva: c.compraAtiva,
  preco: fmt.moedas(c.precoTicketX100),
  comLimite: c.limiteCompraDia !== null,
  limite: String(c.limiteCompraDia ?? 10),
});

/** Rascunho → corpo do PUT + erros, com as mensagens do servidor (o mesmo schema do contrato). */
function validar(r: RascunhoRegras): { corpo: ConfigIntercambioDTO; erros: ErrosRegras; ok: boolean } {
  const erros: ErrosRegras = { preco: null, limite: null, geral: null };
  const preco = lerMoedas(r.preco);
  if (!r.preco.trim()) erros.preco = 'Informe o preço do ticket.';
  else if (preco === null) erros.preco = 'Valor inválido. Use até 2 casas decimais (ex.: 10,00).';
  else if (preco > PRECO_MAX_X100) erros.preco = 'Preço alto demais (máximo 1.000.000,00 moedas).';
  let limite: number | null = null;
  if (r.comLimite) {
    const t = r.limite.trim();
    if (!t) erros.limite = 'Informe quantos tickets cada membro pode comprar por dia.';
    else {
      limite = Number(t);
      if (limite < 1 || limite > LIMITE_DIA_MAX) erros.limite = 'Use de 1 a 100.000 tickets por dia.';
    }
  }
  const corpo: ConfigIntercambioDTO = { ativo: r.ativo, compraAtiva: r.compraAtiva, precoTicketX100: preco ?? 0, limiteCompraDia: r.comLimite ? limite : null };
  const v = AdminIntercambioConfigBody.safeParse(corpo);
  if (!v.success) {
    for (const i of v.error.issues) {
      const campo = i.path[0];
      if (campo === 'precoTicketX100') erros.preco ??= i.message;
      else if (campo === 'limiteCompraDia') erros.limite ??= i.message;
      else erros.geral ??= i.message;
    }
  }
  return { corpo, erros, ok: !erros.preco && !erros.limite && !erros.geral };
}

/** Rascunho das regras: acompanha o servidor enquanto ninguém mexe; com edição em andamento, avisa se mudou fora. */
export function useRascunhoRegras(base: ConfigIntercambioDTO) {
  const [r, setR] = useState<RascunhoRegras>(() => deRegras(base));
  const [baseUsada, setBaseUsada] = useState(base);
  const { corpo, erros, ok } = validar(r);
  const sujo = JSON.stringify(deRegras(baseUsada)) !== JSON.stringify(r);
  const mudancas = ok ? mudancasRegras(baseUsada, corpo) : [];
  const mudouFora = JSON.stringify(base) !== JSON.stringify(baseUsada);

  useEffect(() => {
    if (mudouFora && !sujo) {
      setBaseUsada(base);
      setR(deRegras(base));
    }
  }, [base, mudouFora, sujo]);

  // sair com alterações não salvas: o navegador pergunta
  useEffect(() => {
    if (!sujo) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [sujo]);

  return {
    r,
    setR,
    corpo,
    erros,
    ok,
    sujo,
    mudancas,
    mudouFora,
    baseUsada,
    /** volta para a configuração dada (desfazer, usar as novas, depois de salvar) */
    redefinir: (c: ConfigIntercambioDTO) => {
      setBaseUsada(c);
      setR(deRegras(c));
    },
    /** regras do rascunho quando ele é válido e diferente do que está em vigor (prévia nas ofertas) */
    previa: ok && mudancas.length ? corpo : null,
  };
}
export type EstadoRegras = ReturnType<typeof useRascunhoRegras>;

// ---------------------------------------------------------------- opção (cartão com rádio)

function Opcao({ nome, marcada, aoMarcar, Icone, titulo, texto, tom }: {
  nome: string;
  marcada: boolean;
  aoMarcar: () => void;
  Icone: typeof Lock;
  titulo: string;
  texto: string;
  /** âmbar para o lado "desligado/fechado" quando marcado */
  tom?: 'ambar';
}) {
  return (
    <label className={cx('adm-us-opcao adm-us-opcao-linha', tom === 'ambar' && 'itc-opcao-ambar')}>
      <input type="radio" name={nome} className="sr-only" checked={marcada} onChange={aoMarcar} />
      <Icone className="adm-us-opcao-icone" aria-hidden />
      <span className="min-w-0">
        <span className="adm-us-opcao-nome">{titulo}</span>
        <span className="adm-us-opcao-sub">{texto}</span>
      </span>
    </label>
  );
}

// ---------------------------------------------------------------- confirmação

function ModalConfirmarRegras({ painel, estado, salvando, erro, aoConfirmar, aoFechar, aoUsarPreco }: {
  painel: AdminIntercambioDTO;
  estado: EstadoRegras;
  salvando: boolean;
  erro: unknown;
  aoConfirmar: () => void;
  aoFechar: () => void;
  aoUsarPreco: (x100: number) => void;
}) {
  const { baseUsada: atual, corpo: novo, mudancas } = estado;
  const ruins = ofertasLucrativas(novo, painel.ofertas, painel.comissaoTotalBp);
  const minimo = precoMinimoSemLucro(painel.ofertas, painel.comissaoTotalBp);
  // a recusa "sem lucro" do servidor: a mensagem dele (com as trocas) e a dica geral
  const recusaSemLucro = erro instanceof ErroApi && erro.codigo === 'PAYLOAD_INVALIDO' && Array.isArray(erro.detalhes?.ofertas);
  return (
    <ModalAdm aberto titulo="Salvar as regras do Intercâmbio?" aoFechar={aoFechar}>
      <div className="adm-us-form">
        <div>
          <p className="adm-campo-rotulo">O que muda</p>
          <ul className="adm-us-efeitos">
            {mudancas.map((m) => (
              <li key={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</li>
            ))}
          </ul>
        </div>
        <div className="itc-confirmar-novo">
          <p className="adm-campo-rotulo">Fica assim</p>
          <div className="itc-confirmar-selos">
            <SeloAberto ativo={novo.ativo} />
            <SeloCompra ligada={novo.compraAtiva} />
          </div>
          <p className="itc-texto-suave">{resumoRegras(novo).replace(/^./, (c) => c.toUpperCase())}.</p>
        </div>
        {!novo.ativo && atual.ativo && (
          <Alerta tom="ambar" icone={<DoorClosed className="h-4 w-4" />}>
            Com o Intercâmbio fechado, ninguém troca nem compra tickets. Os tickets dos membros continuam guardados.
          </Alerta>
        )}
        {novo.compraAtiva && !atual.compraAtiva && (
          <Alerta tom="ambar" icone={<ShoppingCart className="h-4 w-4" />}>
            Os membros passam a poder comprar tickets pagando {fmt.moedas(novo.precoTicketX100)} moedas do jogo cada
            {novo.limiteCompraDia !== null ? `, até ${textoTickets(novo.limiteCompraDia)} por dia` : ''}. Tickets são vales do jogo: só se compram com moedas do jogo.
          </Alerta>
        )}
        {ruins.length > 0 && !recusaSemLucro && (
          <Alerta tom="vermelho" icone={<TriangleAlert className="h-4 w-4" />}>
            <p>
              <strong>Pela conta do painel, {ruins.length === 1 ? '1 troca daria lucro' : `${ruins.length} trocas dariam lucro`}</strong> com a compra a{' '}
              {fmt.moedas(novo.precoTicketX100)}: {ruins.map((o) => ofertaPorTickets(o)).join('; ')}. O servidor confere e deve recusar.
            </p>
            {minimo && minimo.precoX100 > novo.precoTicketX100 && (
              <BotaoAdm tamanho="p" className="mt-2" onClick={() => aoUsarPreco(minimo.precoX100)}>
                Usar o preço mínimo sem lucro ({fmt.moedas(minimo.precoX100)})
              </BotaoAdm>
            )}
          </Alerta>
        )}
        {recusaSemLucro && erro instanceof ErroApi ? (
          <Alerta tom="vermelho" icone={<ShieldCheck className="h-4 w-4" />}>
            <p>
              <strong>O servidor recusou a mudança (regra “sem lucro”).</strong> {mensagemAdmin(erro)}
            </p>
            <p className="mt-1">
              Para salvar: aumente o preço do ticket{minimo ? ` (mínimo ${fmt.moedas(minimo.precoX100)})` : ''}, aumente o custo dessas trocas ou diminua os
              ovos delas.
            </p>
            {minimo && minimo.precoX100 > novo.precoTicketX100 && (
              <BotaoAdm tamanho="p" className="mt-2" onClick={() => aoUsarPreco(minimo.precoX100)}>
                Usar o preço mínimo sem lucro ({fmt.moedas(minimo.precoX100)})
              </BotaoAdm>
            )}
          </Alerta>
        ) : (
          <ErroModal texto={erro ? mensagemAdmin(erro) : null} />
        )}
        <Alerta tom="azul" icone={<Info className="h-4 w-4" />}>
          Vale na hora para todos os membros. A alteração fica registrada na auditoria.
        </Alerta>
        <AcoesModal>
          <BotaoAdm onClick={aoFechar} disabled={salvando}>
            Cancelar
          </BotaoAdm>
          <BotaoAdm variante="primario" onClick={aoConfirmar} disabled={salvando}>
            <Save className="h-4 w-4" aria-hidden />
            {salvando ? 'Salvando…' : 'Salvar regras'}
          </BotaoAdm>
        </AcoesModal>
      </div>
    </ModalAdm>
  );
}

export function SeloAberto({ ativo }: { ativo: boolean }) {
  return (
    <Selo tom={ativo ? 'verde' : 'ambar'}>
      <span className="afi-luz" data-ativo={ativo || undefined} aria-hidden />
      {ativo ? 'Aberto' : 'Fechado'}
    </Selo>
  );
}

export function SeloCompra({ ligada }: { ligada: boolean }) {
  return (
    <Selo tom={ligada ? 'azul' : 'neutro'}>
      <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
      {ligada ? 'Compra ligada' : 'Compra desligada'}
    </Selo>
  );
}

// ---------------------------------------------------------------- formulário

export function FormRegras({ painel, estado, agora }: { painel: AdminIntercambioDTO; estado: EstadoRegras; agora: number }) {
  const qc = useQueryClient();
  const id = useId();
  const [tentou, setTentou] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const { r, setR, corpo, erros, ok, sujo, mudancas, mudouFora, baseUsada, redefinir } = estado;

  const salvar = useMutation({
    mutationFn: async (c: ConfigIntercambioDTO) => (await chamar<ConfigIntercambioDTO>('PUT', '/api/admin/intercambio', { corpo: c })).data,
    onSuccess: async (salvo) => {
      qc.setQueryData<AdminIntercambioDTO>(CHAVE_INTERCAMBIO, (p) => (p ? { ...p, config: salvo } : p));
      redefinir(salvo);
      setTentou(false);
      setConfirmar(false);
      toast('Regras do Intercâmbio salvas: valem na hora.', 'sucesso');
      await Promise.all([qc.invalidateQueries({ queryKey: CHAVE_INTERCAMBIO }), qc.invalidateQueries({ queryKey: ['admin', 'auditoria'] })]);
    },
  });

  // fechar a confirmação: estável (o ModalAdm refaz o foco quando a função muda) e travado enquanto salva
  const salvando = useRef(false);
  useEffect(() => {
    salvando.current = salvar.isPending;
  });
  const fecharConfirmar = useCallback(() => {
    if (!salvando.current) setConfirmar(false);
  }, []);

  const mexer = (f: (a: RascunhoRegras) => RascunhoRegras) => {
    setR(f);
    if (salvar.isError) salvar.reset();
  };
  const erroPreco = tentou || r.preco.trim() ? erros.preco : null;
  const erroLimite = tentou || (r.comLimite && r.limite.trim()) ? erros.limite : null;

  // regra "sem lucro" com o rascunho: o preço mínimo e quantas trocas dariam lucro
  const minimo = precoMinimoSemLucro(painel.ofertas, painel.comissaoTotalBp);
  const ruins = ok ? ofertasLucrativas(corpo, painel.ofertas, painel.comissaoTotalBp) : [];
  const pausadasRuins = ok && corpo.compraAtiva
    ? painel.ofertas.filter((o) => !o.ativo && analisarOferta(o, corpo, painel.comissaoTotalBp).lucro).length
    : 0;
  const usarPreco = (x100: number) => mexer((a) => ({ ...a, preco: fmt.moedas(x100) }));

  const pedir = (e?: FormEvent) => {
    e?.preventDefault();
    setTentou(true);
    if (!ok) return;
    if (!mudancas.length) {
      toast('Nada mudou nos valores: as regras em vigor continuam as mesmas.', 'info');
      return;
    }
    salvar.reset();
    setConfirmar(true);
  };
  const desfazer = () => {
    redefinir(baseUsada);
    setTentou(false);
    salvar.reset();
  };

  const atualizada = painel.configAtualizadaEm;

  return (
    <>
      <Cartao
        className="itc-regras"
        titulo={<TituloSecao Icone={ShieldCheck} texto="Regras" tom="verde" sub="valem para todos os membros" />}
        acoes={
          <span className="itc-regras-selos">
            <SeloAberto ativo={baseUsada.ativo} />
            <SeloCompra ligada={baseUsada.compraAtiva} />
          </span>
        }
      >
        {mudouFora && sujo && (
          <div className="itc-aviso-fora" role="alert">
            <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1">As regras foram alteradas em outro lugar enquanto você editava (agora: {resumoRegras(painel.config)}).</p>
            <BotaoAdm tamanho="p" onClick={() => redefinir(painel.config)}>
              Usar as novas
            </BotaoAdm>
          </div>
        )}
        <form className="itc-regras-form" onSubmit={pedir} noValidate>
          <fieldset className="itc-regra-campo">
            <legend className="adm-campo-rotulo">Intercâmbio</legend>
            <div className="adm-us-opcoes-grade" data-colunas="2">
              <Opcao
                nome={`${id}-ativo`}
                marcada={r.ativo}
                aoMarcar={() => mexer((a) => ({ ...a, ativo: true }))}
                Icone={DoorOpen}
                titulo="Aberto"
                texto="Os membros veem as ofertas e trocam tickets."
              />
              <Opcao
                nome={`${id}-ativo`}
                marcada={!r.ativo}
                aoMarcar={() => mexer((a) => ({ ...a, ativo: false }))}
                Icone={DoorClosed}
                titulo="Fechado"
                texto="Ninguém troca nem compra. Os tickets ficam guardados."
                tom="ambar"
              />
            </div>
          </fieldset>

          <fieldset className="itc-regra-campo">
            <legend className="adm-campo-rotulo">Compra de tickets com moedas do jogo</legend>
            <div className="adm-us-opcoes-grade" data-colunas="2">
              <Opcao
                nome={`${id}-compra`}
                marcada={!r.compraAtiva}
                aoMarcar={() => mexer((a) => ({ ...a, compraAtiva: false }))}
                Icone={Lock}
                titulo="Desligada"
                texto="Tickets só vêm de cupons e de ajustes da equipe."
              />
              <Opcao
                nome={`${id}-compra`}
                marcada={r.compraAtiva}
                aoMarcar={() => mexer((a) => ({ ...a, compraAtiva: true }))}
                Icone={ShoppingCart}
                titulo="Ligada"
                texto="O membro compra tickets pagando com moedas do jogo."
              />
            </div>
          </fieldset>

          <div className="itc-regra-campo">
            <label className="adm-campo-rotulo" htmlFor={`${id}-preco`}>
              Preço do ticket <span className="itc-opcional">(moedas do jogo)</span>
            </label>
            <span className="adm-us-campo-moeda itc-campo-preco">
              <Moeda className="adm-us-campo-moeda-icone" />
              <input
                id={`${id}-preco`}
                className="adm-input tabular-nums"
                type="text"
                inputMode="decimal"
                value={r.preco}
                maxLength={14}
                autoComplete="off"
                aria-invalid={erroPreco ? true : undefined}
                aria-describedby={`${id}-preco-msg`}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d.,]/g, '');
                  mexer((a) => ({ ...a, preco: v }));
                }}
                onBlur={() => {
                  const v = lerMoedas(r.preco);
                  if (v !== null) mexer((a) => ({ ...a, preco: fmt.moedas(v) }));
                }}
              />
              <span className="itc-campo-sufixo" aria-hidden>
                por ticket
              </span>
            </span>
            <div id={`${id}-preco-msg`}>
              {erroPreco ? (
                <p className="adm-campo-erro">{erroPreco}</p>
              ) : !r.compraAtiva ? (
                <p className="adm-campo-dica">
                  Só vale com a compra ligada.
                  {minimo && <> Mínimo sem lucro hoje: {fmt.moedas(minimo.precoX100)}.</>}
                </p>
              ) : minimo && corpo.precoTicketX100 < minimo.precoX100 ? (
                <p className="itc-dica-ruim">
                  Abaixo do mínimo sem lucro ({fmt.moedas(minimo.precoX100)}, por causa de {ofertaPorTickets(minimo.oferta)}):{' '}
                  {ruins.length === 1 ? '1 troca daria lucro' : `${ruins.length} trocas dariam lucro`}.{' '}
                  <button type="button" className="itc-link" onClick={() => usarPreco(minimo.precoX100)}>
                    Usar {fmt.moedas(minimo.precoX100)}
                  </button>
                </p>
              ) : (
                <p className="itc-dica-ok">
                  <CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {minimo ? `Nenhuma troca de ovos dá lucro (mínimo: ${fmt.moedas(minimo.precoX100)}).` : 'Sem ofertas de ovos ativas para conferir.'}
                </p>
              )}
              {pausadasRuins > 0 && !erroPreco && (
                <p className="adm-campo-dica">
                  {pausadasRuins === 1 ? '1 oferta pausada daria lucro' : `${pausadasRuins} ofertas pausadas dariam lucro`} a esse preço: o servidor
                  recusa ativá-las.
                </p>
              )}
            </div>
          </div>

          <fieldset className="itc-regra-campo">
            <legend className="adm-campo-rotulo">Limite de compra por membro</legend>
            <div className="itc-limite">
              <div className="adm-us-segmentos" role="radiogroup" aria-label="Limite de compra por dia">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!r.comLimite}
                  className="adm-us-segmento"
                  onClick={() => mexer((a) => ({ ...a, comLimite: false }))}
                >
                  <SemLimite className="h-4 w-4" aria-hidden /> Sem limite
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={r.comLimite}
                  className="adm-us-segmento"
                  onClick={() => mexer((a) => ({ ...a, comLimite: true }))}
                >
                  <IconeTicket className="h-4 w-5" /> Por dia
                </button>
              </div>
              {r.comLimite && (
                <span className="itc-limite-campo">
                  <label htmlFor={`${id}-limite`} className="sr-only">
                    Tickets por membro por dia
                  </label>
                  <input
                    id={`${id}-limite`}
                    className="adm-input tabular-nums"
                    type="text"
                    inputMode="numeric"
                    value={r.limite}
                    autoComplete="off"
                    aria-invalid={erroLimite ? true : undefined}
                    onChange={(e) => mexer((a) => ({ ...a, limite: soDigitos(e.target.value, 6) }))}
                  />
                  <span>tickets por dia</span>
                </span>
              )}
            </div>
            {erroLimite ? (
              <p className="adm-campo-erro">{erroLimite}</p>
            ) : (
              <p className="adm-campo-dica">
                {r.comLimite
                  ? 'Cada membro compra no máximo isso por dia (zera à meia-noite, horário de Brasília).'
                  : 'Cada membro compra quantos tickets quiser (se a compra estiver ligada).'}
              </p>
            )}
          </fieldset>

          <p className="itc-regras-nota">
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Comissões de afiliação em vigor: {pctBp(painel.comissaoTotalBp)} sobre cada venda de ovos — entram na conta da regra “sem lucro”.
            </span>
          </p>

          <div className="itc-regras-rodape" data-sujo={sujo || undefined}>
            <div className="min-w-0 flex-1">
              {sujo && !ok ? (
                <p className="itc-salvar-detalhe" data-erro>
                  Corrija os campos marcados para poder salvar.
                </p>
              ) : mudancas.length ? (
                <>
                  <p className="itc-salvar-titulo">
                    {mudancas.length} {mudancas.length === 1 ? 'alteração não salva' : 'alterações não salvas'}
                    {ruins.length > 0 && <span className="itc-salvar-alerta"> · {ruins.length === 1 ? '1 troca daria lucro' : `${ruins.length} trocas dariam lucro`}</span>}
                  </p>
                  <p className="itc-salvar-detalhe">{mudancas.join(' · ')}</p>
                </>
              ) : (
                <p className="itc-salvar-ok">
                  <CircleCheck className="h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    Regras em vigor · alteradas{' '}
                    <span title={fmt.dataHora(atualizada)}>{fmt.relativo(atualizada, agora)}</span> ·{' '}
                    <Link href="/admin/auditoria" className="itc-link">
                      <History className="h-3.5 w-3.5" aria-hidden /> auditoria
                    </Link>
                  </span>
                </p>
              )}
            </div>
            <div className="itc-salvar-botoes">
              <BotaoAdm onClick={desfazer} disabled={!sujo || salvar.isPending}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Desfazer
              </BotaoAdm>
              <BotaoAdm type="submit" variante="primario" disabled={!sujo || salvar.isPending}>
                <Save className="h-4 w-4" aria-hidden /> Salvar regras
              </BotaoAdm>
            </div>
          </div>
        </form>
      </Cartao>

      {confirmar && (
        <ModalConfirmarRegras
          painel={painel}
          estado={estado}
          salvando={salvar.isPending}
          erro={salvar.isError ? salvar.error : null}
          aoConfirmar={() => {
            if (ok) salvar.mutate(corpo);
          }}
          aoFechar={fecharConfirmar}
          aoUsarPreco={(x100) => {
            usarPreco(x100);
            setConfirmar(false);
          }}
        />
      )}
    </>
  );
}

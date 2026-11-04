'use client';

// Criar/editar uma oferta do Intercâmbio (modal): tipo (ovos ou animal — não muda depois de criada), o ovo e a
// quantidade ou a espécie, o custo em tickets e ativa/pausada. Ao lado, a prévia de como a oferta aparece e a conta
// da regra "sem lucro" com as regras EM VIGOR (valor de mercado, comissões, custo em moedas e o selo), com o ajuste
// que deixaria a troca ok. Valida com o MESMO schema do servidor e mostra a recusa dele sem fechar.
import { AdminOfertaBody, type AdminIntercambioDTO, type AdminOfertaDTO, type OfertaIntercambioDTO } from '@galinheiro/api-contract';
import { ANIMAIS, ITENS, NOME_RARIDADE, NOME_TIPO, TIPOS, tipoDoItem, type Item, type Tipo } from '@galinheiro/game-core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bird, CircleCheck, Egg, Minus, Plus, TriangleAlert } from 'lucide-react';
import { useId, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { ErroApi, chamar } from '../../api';
import { FiguraAnimal } from '../../arte/Animal';
import { Ovo } from '../../arte/Icones';
import { toast } from '../../ui';
import { COR_RARIDADE } from '../../util';
import { BotaoAdm, ModalAdm, Selo, fmt, mensagemAdmin } from '../ui';
import { AcoesModal, Alerta, ErroModal, soDigitos } from '../usuarios/comum';
import { ArteOferta, CHAVE_INTERCAMBIO, ChipTickets } from './comum';
import {
  CUSTO_MAX, OVOS_MAX, ajustesSemLucro, analisarOferta, ofertaPorTickets, pctBp, precoOvoX100, rotuloOferta, textoTickets,
} from './formato';

export type ModoOferta = { tipo: 'nova' } | { tipo: 'editar'; oferta: AdminOfertaDTO };

interface Rascunho {
  tipo: 'ovos' | 'animal';
  item: Item;
  /** texto do campo */
  quantidade: string;
  animal: Tipo;
  /** texto do campo */
  custo: string;
  ativo: boolean;
}

function rascunhoDe(modo: ModoOferta): Rascunho {
  if (modo.tipo === 'nova') return { tipo: 'ovos', item: 'ovo_galinha', quantidade: '5', animal: 'galinha', custo: '1', ativo: true };
  const o = modo.oferta;
  return {
    tipo: o.tipo,
    item: o.item ?? 'ovo_galinha',
    quantidade: String(o.quantidade ?? 1),
    animal: o.animal ?? 'galinha',
    custo: String(o.custoTickets),
    ativo: o.ativo,
  };
}

type Corpo = { tipo: 'ovos'; item: Item; quantidade: number; custoTickets: number; ativo: boolean } | { tipo: 'animal'; animal: Tipo; custoTickets: number; ativo: boolean };

/** Rascunho → corpo do POST + erros, com as mensagens do servidor (o mesmo schema do contrato). */
function validar(r: Rascunho): { corpo: Corpo; erros: { quantidade: string | null; custo: string | null }; ok: boolean } {
  const erros = { quantidade: null as string | null, custo: null as string | null };
  const quantidade = Number(r.quantidade || 0);
  const custo = Number(r.custo || 0);
  if (r.tipo === 'ovos') {
    if (!r.quantidade) erros.quantidade = 'Informe quantos ovos.';
    else if (quantidade > OVOS_MAX) erros.quantidade = 'Máximo de 100.000 ovos por troca.';
  }
  if (!r.custo) erros.custo = 'Informe o custo em tickets.';
  else if (custo > CUSTO_MAX) erros.custo = 'Custo muito alto (máximo 100.000 tickets).';
  const corpo: Corpo =
    r.tipo === 'ovos'
      ? { tipo: 'ovos', item: r.item, quantidade, custoTickets: custo, ativo: r.ativo }
      : { tipo: 'animal', animal: r.animal, custoTickets: custo, ativo: r.ativo };
  const v = AdminOfertaBody.safeParse(corpo);
  if (!v.success) {
    for (const i of v.error.issues) {
      if (i.path[0] === 'quantidade') erros.quantidade ??= i.message;
      else if (i.path[0] === 'custoTickets') erros.custo ??= i.message;
    }
  }
  return { corpo, erros, ok: !erros.quantidade && !erros.custo };
}

/** Oferta (no formato do DTO) a partir do corpo, para a prévia e a conta. */
const comoOferta = (c: Corpo): Omit<OfertaIntercambioDTO, 'id'> => ({
  tipo: c.tipo,
  item: c.tipo === 'ovos' ? c.item : null,
  quantidade: c.tipo === 'ovos' ? c.quantidade : null,
  animal: c.tipo === 'animal' ? c.animal : null,
  custoTickets: c.custoTickets,
  ativo: c.ativo,
});

// ---------------------------------------------------------------- peças

/** Campo numérico com − e + (quantidade de ovos, custo em tickets). */
function Passo({ id, valor, aoMudar, min, max, rotulo, sufixo, erro }: {
  id: string;
  valor: string;
  aoMudar: (v: string) => void;
  min: number;
  max: number;
  rotulo: string;
  sufixo: ReactNode;
  erro: string | null;
}) {
  const n = Number(valor || 0);
  const passo = (d: number) => aoMudar(String(Math.min(max, Math.max(min, (Number.isFinite(n) ? n : 0) + d))));
  return (
    <span className="adm-us-passo itc-passo">
      <button type="button" className="adm-us-passo-botao" onClick={() => passo(-1)} aria-label={`Diminuir ${rotulo}`} disabled={n <= min}>
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <input
        id={id}
        className="adm-input tabular-nums"
        type="text"
        inputMode="numeric"
        value={valor}
        autoComplete="off"
        aria-invalid={erro ? true : undefined}
        onChange={(e) => aoMudar(soDigitos(e.target.value, 6))}
      />
      <button type="button" className="adm-us-passo-botao" onClick={() => passo(1)} aria-label={`Aumentar ${rotulo}`} disabled={n >= max}>
        <Plus className="h-4 w-4" aria-hidden />
      </button>
      <span className="adm-us-passo-total">{sufixo}</span>
    </span>
  );
}

/** A conta da regra "sem lucro" para a oferta do rascunho, com as regras em vigor. */
function ContaSemLucro({ oferta, painel }: { oferta: Omit<OfertaIntercambioDTO, 'id'>; painel: AdminIntercambioDTO }) {
  const { config, comissaoTotalBp: bp } = painel;
  if (oferta.tipo === 'animal') {
    return (
      <div className="itc-conta">
        <p className="itc-conta-titulo">Regra “sem lucro”</p>
        <p className="itc-texto-suave">Vale só para ofertas de ovos: o animal não pode ser vendido, então não dá para “fabricar” moedas com ele.</p>
      </div>
    );
  }
  const a = analisarOferta(oferta, config, bp);
  const ajuste = a.lucro ? ajustesSemLucro(oferta, config.precoTicketX100, bp) : null;
  const preco = oferta.item ? precoOvoX100(oferta.item) : 0;
  return (
    <div className="itc-conta" data-lucro={a.lucro || undefined} data-conferida={a.conferida || undefined}>
      <p className="itc-conta-titulo">
        Regra “sem lucro”
        {config.compraAtiva ? (
          a.lucro ? (
            <Selo tom="vermelho">
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> daria lucro
            </Selo>
          ) : (
            <Selo tom="verde">
              <CircleCheck className="h-3.5 w-3.5" aria-hidden /> ok
            </Selo>
          )
        ) : (
          <Selo>compra desligada</Selo>
        )}
      </p>
      <dl className="itc-conta-linhas">
        <div>
          <dt>Valor de mercado</dt>
          <dd>
            <span className="itc-conta-calc">
              {fmt.int(oferta.quantidade ?? 0)} × {fmt.moedas(preco)} =
            </span>{' '}
            <strong>{fmt.moedas(a.valorX100 ?? 0)}</strong>
          </dd>
        </div>
        <div>
          <dt>Com as comissões ({pctBp(bp)})</dt>
          <dd>
            <strong>{fmt.moedas(a.valorComComissoesX100 ?? 0)}</strong>
          </dd>
        </div>
        <div data-destaque>
          <dt>{config.compraAtiva ? 'Custo em moedas' : 'Custo se a compra ligar'}</dt>
          <dd>
            <span className="itc-conta-calc">
              {fmt.int(oferta.custoTickets)} × {fmt.moedas(config.precoTicketX100)} =
            </span>{' '}
            <strong>{fmt.moedas(a.custoX100)}</strong>
          </dd>
        </div>
      </dl>
      <p className="itc-conta-veredito">
        {a.lucro
          ? `Os ovos rendem ${fmt.moedas((a.valorComComissoesX100 ?? 0) - a.custoX100)} a mais do que a troca custa.`
          : `A troca custa ${fmt.moedas(a.custoX100 - (a.valorComComissoesX100 ?? 0))} a mais do que os ovos rendem.`}{' '}
        {!config.compraAtiva
          ? a.lucro
            ? 'Hoje não importa (a compra está desligada), mas o servidor não deixa ligar a compra assim.'
            : 'Hoje não importa: a compra de tickets está desligada.'
          : !oferta.ativo
            ? a.lucro
              ? 'Pausada ela passa, mas o servidor não deixa ativar assim.'
              : 'Pausada: o servidor confere quando for ativada.'
            : a.lucro
              ? 'O servidor recusa.'
              : 'Pode salvar.'}
      </p>
      {ajuste && (
        <p className="itc-conta-ajuste">
          Para ficar ok: até <strong>{fmt.int(ajuste.maxOvos)}</strong> {ajuste.maxOvos === 1 ? 'ovo' : 'ovos'} por {textoTickets(oferta.custoTickets)}, ou{' '}
          <strong>{textoTickets(ajuste.minTickets)}</strong> por {fmt.int(oferta.quantidade ?? 0)} ovos.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- modal

export function ModalOferta({ modo, painel, aoFechar }: { modo: ModoOferta; painel: AdminIntercambioDTO; aoFechar: () => void }) {
  const qc = useQueryClient();
  const id = useId();
  const [original] = useState(() => rascunhoDe(modo));
  const [r, setR] = useState<Rascunho>(original);
  const [tentou, setTentou] = useState(false);
  const editando = modo.tipo === 'editar';
  const { corpo, erros, ok } = validar(r);
  const oferta = comoOferta(corpo);

  const salvar = useMutation({
    mutationFn: async (): Promise<OfertaIntercambioDTO | null> => {
      if (modo.tipo === 'editar') {
        // só o que mudou (a auditoria registra os campos alterados)
        const o = modo.oferta;
        const mudou: Record<string, unknown> = {};
        if (corpo.tipo === 'ovos') {
          if (corpo.item !== o.item) mudou.item = corpo.item;
          if (corpo.quantidade !== o.quantidade) mudou.quantidade = corpo.quantidade;
        } else if (corpo.animal !== o.animal) mudou.animal = corpo.animal;
        if (corpo.custoTickets !== o.custoTickets) mudou.custoTickets = corpo.custoTickets;
        if (corpo.ativo !== o.ativo) mudou.ativo = corpo.ativo;
        if (!Object.keys(mudou).length) return null;
        return (await chamar<OfertaIntercambioDTO>('PATCH', `/api/admin/intercambio/ofertas/${o.id}`, { corpo: mudou })).data;
      }
      return (await chamar<OfertaIntercambioDTO>('POST', '/api/admin/intercambio/ofertas', { corpo })).data;
    },
    onSuccess: async (salva) => {
      if (!salva) toast('Nada mudou nesta oferta.', 'info');
      else if (editando) toast(`Oferta salva: ${ofertaPorTickets(salva)}.`, 'sucesso');
      else toast(salva.ativo ? `Oferta criada: ${ofertaPorTickets(salva)}. Já aparece no Intercâmbio.` : 'Oferta criada (pausada).', 'sucesso', { duracaoMs: 4000 });
      await Promise.all([qc.invalidateQueries({ queryKey: CHAVE_INTERCAMBIO }), qc.invalidateQueries({ queryKey: ['admin', 'auditoria'] })]);
      aoFechar();
    },
  });

  const mexer = (f: (a: Rascunho) => Rascunho) => {
    setR(f);
    if (salvar.isError) salvar.reset();
  };
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (!ok || salvar.isPending) return;
    salvar.mutate();
  };

  // oferta igual já na tabela (só avisa)
  const igual = painel.ofertas.find(
    (o) =>
      (modo.tipo !== 'editar' || o.id !== modo.oferta.id) &&
      o.tipo === oferta.tipo &&
      o.custoTickets === oferta.custoTickets &&
      (o.tipo === 'animal' ? o.animal === oferta.animal : o.item === oferta.item && o.quantidade === oferta.quantidade),
  );
  const erroQtd = tentou || r.quantidade ? erros.quantidade : null;
  const erroCusto = tentou || r.custo ? erros.custo : null;
  const recusaSemLucro = salvar.error instanceof ErroApi && salvar.error.codigo === 'PAYLOAD_INVALIDO' && Array.isArray(salvar.error.detalhes?.ofertas);
  const especie = r.tipo === 'ovos' ? tipoDoItem(r.item) : r.animal;

  return (
    <ModalAdm aberto titulo={editando ? `Editar oferta: ${rotuloOferta(modo.oferta)}` : 'Nova oferta'} aoFechar={aoFechar} largura="g">
      <form className="itc-form-oferta" onSubmit={enviar} noValidate>
        <div className="itc-form-campos">
          {editando ? (
            <p className="itc-form-tipo">
              {r.tipo === 'ovos' ? <Egg className="h-4 w-4" aria-hidden /> : <Bird className="h-4 w-4" aria-hidden />}
              <span>
                Oferta de <strong>{r.tipo === 'ovos' ? 'ovos' : 'animal'}</strong> — o tipo não muda depois de criada.
              </span>
            </p>
          ) : (
            <fieldset className="itc-regra-campo">
              <legend className="adm-campo-rotulo">O membro recebe</legend>
              <div className="adm-us-segmentos" role="radiogroup" aria-label="Tipo da oferta">
                <button type="button" role="radio" aria-checked={r.tipo === 'ovos'} className="adm-us-segmento" onClick={() => mexer((a) => ({ ...a, tipo: 'ovos' }))}>
                  <Egg className="h-4 w-4" aria-hidden /> Ovos
                </button>
                <button type="button" role="radio" aria-checked={r.tipo === 'animal'} className="adm-us-segmento" onClick={() => mexer((a) => ({ ...a, tipo: 'animal' }))}>
                  <Bird className="h-4 w-4" aria-hidden /> Animal
                </button>
              </div>
              <p className="adm-campo-dica">
                {r.tipo === 'ovos' ? 'Os ovos vão direto para o estoque do membro.' : 'O animal nasce no menor ninho livre do galinheiro do membro.'}
              </p>
            </fieldset>
          )}

          {r.tipo === 'ovos' ? (
            <>
              <fieldset className="adm-us-opcoes">
                <legend className="adm-campo-rotulo">Ovo</legend>
                <div className="adm-us-opcoes-grade" data-colunas="4">
                  {ITENS.map((i) => (
                    <label key={i} className="adm-us-opcao">
                      <input type="radio" name={`${id}-ovo`} className="sr-only" checked={r.item === i} onChange={() => mexer((a) => ({ ...a, item: i }))} />
                      <Ovo tipo={tipoDoItem(i)} className="h-8 w-8" />
                      <span className="adm-us-opcao-nome">{NOME_TIPO[tipoDoItem(i)]}</span>
                      <span className="adm-us-opcao-sub">vale {fmt.moedas(precoOvoX100(i))}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="itc-regra-campo">
                <label className="adm-campo-rotulo" htmlFor={`${id}-qtd`}>
                  Quantidade de ovos
                </label>
                <Passo
                  id={`${id}-qtd`}
                  valor={r.quantidade}
                  aoMudar={(v) => mexer((a) => ({ ...a, quantidade: v }))}
                  min={1}
                  max={OVOS_MAX}
                  rotulo="a quantidade de ovos"
                  sufixo={`${Number(r.quantidade) === 1 ? 'ovo' : 'ovos'} de ${NOME_TIPO[tipoDoItem(r.item)].toLowerCase()}`}
                  erro={erroQtd}
                />
                {erroQtd && <p className="adm-campo-erro">{erroQtd}</p>}
              </div>
            </>
          ) : (
            <fieldset className="adm-us-opcoes">
              <legend className="adm-campo-rotulo">Espécie</legend>
              <div className="adm-us-opcoes-grade" data-colunas="4">
                {TIPOS.map((t) => (
                  <label key={t} className="adm-us-opcao adm-us-opcao-animal">
                    <input type="radio" name={`${id}-animal`} className="sr-only" checked={r.animal === t} onChange={() => mexer((a) => ({ ...a, animal: t }))} />
                    <span className="adm-us-figura">
                      <FiguraAnimal tipo={t} ninho={false} detalhe="p" className="h-14 w-14" />
                    </span>
                    <span className="adm-us-opcao-nome">{NOME_TIPO[t]}</span>
                    <span className="adm-us-raridade" style={{ '--cor': COR_RARIDADE[ANIMAIS[t].raridade] } as CSSProperties}>
                      {NOME_RARIDADE[ANIMAIS[t].raridade]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="itc-regra-campo">
            <label className="adm-campo-rotulo" htmlFor={`${id}-custo`}>
              Custo em tickets
            </label>
            <Passo
              id={`${id}-custo`}
              valor={r.custo}
              aoMudar={(v) => mexer((a) => ({ ...a, custo: v }))}
              min={1}
              max={CUSTO_MAX}
              rotulo="o custo em tickets"
              sufixo={Number(r.custo) === 1 ? 'ticket' : 'tickets'}
              erro={erroCusto}
            />
            {erroCusto && <p className="adm-campo-erro">{erroCusto}</p>}
          </div>

          <div className="itc-regra-campo">
            <span className="adm-campo-rotulo" id={`${id}-ativo-rotulo`}>
              Situação
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={r.ativo}
              aria-labelledby={`${id}-ativo-rotulo`}
              className="pop-switch"
              onClick={() => mexer((a) => ({ ...a, ativo: !a.ativo }))}
            >
              <span className="pop-switch-trilho" aria-hidden>
                <span className="pop-switch-bola" />
              </span>
              <span className="pop-switch-texto">
                <strong>{r.ativo ? 'Ativa' : 'Pausada'}</strong>
                <span>{r.ativo ? 'Aparece no Intercâmbio para todos os membros.' : 'Fica guardada e não aparece para ninguém.'}</span>
              </span>
            </button>
          </div>

          {igual && (
            <Alerta tom="ambar" icone={<TriangleAlert className="h-4 w-4" />}>
              Já existe uma oferta igual na tabela ({ofertaPorTickets(igual)}{igual.ativo ? '' : ', pausada'}).
            </Alerta>
          )}
        </div>

        <aside className="itc-form-previa" aria-label="Prévia da oferta">
          <p className="itc-previa-titulo">Como aparece no Intercâmbio</p>
          <div className="itc-previa-cartao" data-apagada={!r.ativo || undefined}>
            <ArteOferta tipo={oferta.tipo} item={oferta.item} quantidade={ok ? oferta.quantidade : null} animal={oferta.animal} tamanho="g" apagada={!r.ativo} />
            <p className="itc-previa-rotulo">{ok || r.tipo === 'animal' ? rotuloOferta(oferta) : '—'}</p>
            {r.tipo === 'animal' && (
              <span className="adm-us-raridade" style={{ '--cor': COR_RARIDADE[ANIMAIS[especie].raridade] } as CSSProperties}>
                {NOME_RARIDADE[ANIMAIS[especie].raridade]}
              </span>
            )}
            {ok && <ChipTickets n={oferta.custoTickets} tamanho="g" />}
            {!r.ativo && <Selo tom="ambar">Pausada</Selo>}
          </div>
          {ok ? <ContaSemLucro oferta={oferta} painel={painel} /> : <p className="itc-texto-suave">Preencha os campos para ver a conta.</p>}
        </aside>

        <div className="itc-form-rodape">
          {recusaSemLucro && salvar.error instanceof ErroApi ? (
            <Alerta tom="vermelho" icone={<TriangleAlert className="h-4 w-4" />}>
              <p>
                <strong>O servidor recusou (regra “sem lucro”).</strong> {mensagemAdmin(salvar.error)}
              </p>
            </Alerta>
          ) : (
            <ErroModal texto={salvar.isError ? mensagemAdmin(salvar.error) : null} />
          )}
          <AcoesModal>
            <BotaoAdm variante="fantasma" onClick={aoFechar}>
              Cancelar
            </BotaoAdm>
            <BotaoAdm type="submit" variante="primario" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando…' : editando ? 'Salvar alterações' : r.ativo ? 'Criar oferta' : 'Criar pausada'}
            </BotaoAdm>
          </AcoesModal>
        </div>
      </form>
    </ModalAdm>
  );
}

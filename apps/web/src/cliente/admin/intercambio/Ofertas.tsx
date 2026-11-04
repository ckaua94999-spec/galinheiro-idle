'use client';

// Tabela de ofertas do Intercâmbio (painel): cada oferta com a arte (ovos ou animal), o rótulo, o custo em tickets,
// o valor de mercado, o custo em moedas e o selo da regra "sem lucro" (com a compra ligada; como previsão com ela
// desligada ou com regras ainda não salvas), as trocas (30 dias e total) e as ações: subir/descer na ordem,
// editar, pausar/ativar e excluir (com confirmação). Linhas no desktop, cartões no celular.
import type { AdminIntercambioDTO, AdminOfertaDTO, ConfigIntercambioDTO, OfertaIntercambioDTO } from '@galinheiro/api-contract';
import { ANIMAIS, NOME_RARIDADE } from '@galinheiro/game-core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, ChevronDown, ChevronUp, CircleCheck, Eye, Pause, Pencil, Play, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { chamar } from '../../api';
import { Moeda } from '../../arte/Icones';
import { toast } from '../../ui';
import { TituloSecao } from '../afiliados/comum';
import { BotaoAdm, Cartao, ModalAdm, Selo, Vazio, fmt, mensagemAdmin } from '../ui';
import { AcoesModal, Alerta, ErroModal } from '../usuarios/comum';
import { ArteOferta, CHAVE_INTERCAMBIO, ChipTickets } from './comum';
import { analisarOferta, ofertaPorTickets, ofertasLucrativas, pctBp, precoMinimoSemLucro, rotuloOferta, textoTickets } from './formato';

/** Troca duas ofertas vizinhas de lugar (e de `ordem`). */
function trocarOrdem(lista: readonly AdminOfertaDTO[], de: number, para: number): AdminOfertaDTO[] {
  const nova = [...lista];
  const a = nova[de];
  const b = nova[para];
  if (!a || !b) return nova;
  nova[de] = { ...b, ordem: a.ordem };
  nova[para] = { ...a, ordem: b.ordem };
  return nova;
}

/** Conta da regra para o title (passar o mouse mostra a conta inteira). */
function contaPorExtenso(o: OfertaIntercambioDTO, config: ConfigIntercambioDTO, bp: number): string {
  const a = analisarOferta(o, config, bp);
  if (a.valorX100 === null || a.valorComComissoesX100 === null) return 'Animal: a regra “sem lucro” vale só para ofertas de ovos.';
  return [
    `Valor de mercado: ${fmt.moedas(a.valorX100)} moedas`,
    `com as comissões de afiliação (${pctBp(bp)}): ${fmt.moedas(a.valorComComissoesX100)}`,
    `custo: ${textoTickets(o.custoTickets)} × ${fmt.moedas(config.precoTicketX100)} = ${fmt.moedas(a.custoX100)}`,
    a.lucro ? 'os ovos valem mais do que a troca custa: daria lucro' : 'a troca custa pelo menos o que os ovos rendem: ok',
  ].join('\n');
}

function CelulaRegra({ o, config, bp }: { o: OfertaIntercambioDTO; config: ConfigIntercambioDTO; bp: number }) {
  const a = analisarOferta(o, config, bp);
  if (a.valorX100 === null) {
    return (
      <div className="itc-regra" title={contaPorExtenso(o, config, bp)}>
        <p className="itc-regra-linha">
          <span>Mercado</span>
          <strong className="itc-regra-vazio">—</strong>
        </p>
        <p className="itc-previsao">animal: fora da regra</p>
      </div>
    );
  }
  return (
    <div className="itc-regra" title={contaPorExtenso(o, config, bp)}>
      <p className="itc-regra-linha">
        <span>Mercado</span>
        <strong>
          <Moeda className="itc-regra-moeda" />
          {fmt.moedas(a.valorX100)}
        </strong>
      </p>
      {config.compraAtiva ? (
        <>
          <p className="itc-regra-linha">
            <span>Custo</span>
            <strong>{fmt.moedas(a.custoX100)}</strong>
          </p>
          {a.lucro ? (
            <Selo tom={o.ativo ? 'vermelho' : 'ambar'}>
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> {o.ativo ? 'daria lucro' : 'daria lucro se ativar'}
            </Selo>
          ) : (
            <Selo tom="verde">
              <CircleCheck className="h-3.5 w-3.5" aria-hidden /> ok
            </Selo>
          )}
        </>
      ) : (
        <p className="itc-previsao" data-ruim={a.lucro || undefined}>
          {a.lucro ? `daria lucro a ${fmt.moedas(config.precoTicketX100)}` : `ok a ${fmt.moedas(config.precoTicketX100)} por ticket`}
        </p>
      )}
    </div>
  );
}

function LinhaOferta({ o, pos, total, config, bp, idBase, travado, ocupado, aoSubir, aoDescer, aoEditar, aoAlternar, aoExcluir }: {
  o: AdminOfertaDTO;
  pos: number;
  total: number;
  config: ConfigIntercambioDTO;
  bp: number;
  idBase: string;
  /** reordenando: as setas esperam */
  travado: boolean;
  /** pausando/ativando esta oferta */
  ocupado: boolean;
  aoSubir: () => void;
  aoDescer: () => void;
  aoEditar: () => void;
  aoAlternar: () => void;
  aoExcluir: () => void;
}) {
  const rotulo = rotuloOferta(o);
  const a = analisarOferta(o, config, bp);
  return (
    <li className="itc-oferta" data-ativa={o.ativo || undefined} data-lucro={(a.lucro && a.conferida) || undefined}>
      <div className="itc-oferta-ordem" role="group" aria-label={`Posição ${pos} de ${total}`}>
        <button
          type="button"
          id={`${idBase}-${o.id}-subir`}
          className="itc-seta"
          onClick={aoSubir}
          disabled={pos === 1 || travado}
          aria-label={`Subir “${rotulo}”`}
          title="Subir na ordem"
        >
          <ChevronUp className="h-4 w-4" aria-hidden />
        </button>
        <span className="itc-oferta-pos" aria-hidden>
          {pos}
        </span>
        <button
          type="button"
          id={`${idBase}-${o.id}-descer`}
          className="itc-seta"
          onClick={aoDescer}
          disabled={pos === total || travado}
          aria-label={`Descer “${rotulo}”`}
          title="Descer na ordem"
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <ArteOferta tipo={o.tipo} item={o.item} quantidade={o.quantidade} animal={o.animal} apagada={!o.ativo} />
      <div className="itc-oferta-info">
        <h3 className="itc-oferta-titulo">
          {rotulo}
          {!o.ativo && (
            <Selo tom="ambar">
              <Pause className="h-3 w-3" aria-hidden /> Pausada
            </Selo>
          )}
        </h3>
        <p className="itc-oferta-sub">
          {o.tipo === 'ovos' ? 'Ovos · vão para o estoque' : `${o.animal ? NOME_RARIDADE[ANIMAIS[o.animal].raridade] : 'Animal'} · vai para o ninho livre`}
        </p>
      </div>
      <div className="itc-oferta-custo">
        <span className="itc-celula-rotulo">Custo</span>
        <ChipTickets n={o.custoTickets} />
      </div>
      <div className="itc-oferta-regra">
        <CelulaRegra o={o} config={config} bp={bp} />
      </div>
      <dl className="itc-oferta-trocas" aria-label="Trocas">
        <div>
          <dt>30 dias</dt>
          <dd>{fmt.int(o.trocas30d)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{fmt.int(o.trocasTotal)}</dd>
        </div>
      </dl>
      <div className="itc-oferta-acoes">
        <BotaoAdm tamanho="p" onClick={aoEditar} aria-label={`Editar “${rotulo}”`}>
          <Pencil className="h-4 w-4" aria-hidden /> Editar
        </BotaoAdm>
        <BotaoAdm tamanho="p" onClick={aoAlternar} disabled={ocupado} title={o.ativo ? 'Tirar do Intercâmbio (não apaga)' : 'Voltar a mostrar no Intercâmbio'}>
          {o.ativo ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          {ocupado ? '…' : o.ativo ? 'Pausar' : 'Ativar'}
        </BotaoAdm>
        <BotaoAdm tamanho="p" variante="fantasma" className="itc-excluir" onClick={aoExcluir} title="Excluir" aria-label={`Excluir “${rotulo}”`}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </BotaoAdm>
      </div>
    </li>
  );
}

/** Faixa no alto da tabela: como está a regra "sem lucro" com as regras em vigor (ou com a prévia). */
function FaixaRegra({ painel, config, previa }: { painel: AdminIntercambioDTO; config: ConfigIntercambioDTO; previa: boolean }) {
  const bp = painel.comissaoTotalBp;
  const ruins = ofertasLucrativas(config, painel.ofertas, bp);
  const previsao = ofertasLucrativas({ ...config, compraAtiva: true }, painel.ofertas, bp);
  const minimo = precoMinimoSemLucro(painel.ofertas, bp);
  const preco = fmt.moedas(config.precoTicketX100);
  if (config.compraAtiva) {
    return (
      <div className="itc-faixa" data-tom={ruins.length ? 'vermelho' : 'verde'} role="status">
        {ruins.length ? <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden /> : <CircleCheck className="h-4 w-4 shrink-0" aria-hidden />}
        <p>
          {previa && <strong className="itc-faixa-previa">Prévia das regras não salvas · </strong>}
          {ruins.length ? (
            <>
              <strong>{ruins.length === 1 ? '1 troca daria lucro' : `${ruins.length} trocas dariam lucro`}</strong> com a compra a {preco} por ticket
              {minimo ? ` (mínimo sem lucro: ${fmt.moedas(minimo.precoX100)})` : ''}. O servidor recusa salvar assim.
            </>
          ) : (
            <>
              <strong>Regra “sem lucro” em dia:</strong> com a compra a {preco} por ticket e as comissões de afiliação ({pctBp(bp)}), nenhuma troca de
              ovos rende mais do que custa.
            </>
          )}
        </p>
      </div>
    );
  }
  return (
    <div className="itc-faixa" data-tom="neutro" role="status">
      <Eye className="h-4 w-4 shrink-0" aria-hidden />
      <p>
        {previa && <strong className="itc-faixa-previa">Prévia das regras não salvas · </strong>}
        <strong>Compra de tickets desligada:</strong> a regra “sem lucro” só vale com a compra ligada. Previsão a {preco} por ticket:{' '}
        {previsao.length ? (
          <span className="itc-faixa-ruim">{previsao.length === 1 ? '1 troca daria lucro' : `${previsao.length} trocas dariam lucro`}</span>
        ) : (
          'todas ok'
        )}
        {minimo ? ` (mínimo sem lucro: ${fmt.moedas(minimo.precoX100)})` : ''}.
      </p>
    </div>
  );
}

export function ListaOfertas({ painel, previa, aoNova, aoEditar }: {
  painel: AdminIntercambioDTO;
  /** regras do rascunho (válidas e diferentes das em vigor) para a prévia da regra */
  previa: ConfigIntercambioDTO | null;
  aoNova: () => void;
  aoEditar: (o: AdminOfertaDTO) => void;
}) {
  const qc = useQueryClient();
  const idBase = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const config = previa ?? painel.config;
  const bp = painel.comissaoTotalBp;
  const ofertas = painel.ofertas;
  const ativas = ofertas.filter((o) => o.ativo).length;
  const [excluindo, setExcluindo] = useState<AdminOfertaDTO | null>(null);
  const fecharExcluir = useCallback(() => setExcluindo(null), []);
  const foco = useRef<{ id: string; dir: 'subir' | 'descer' } | null>(null);

  const recarregar = () =>
    Promise.all([qc.invalidateQueries({ queryKey: CHAVE_INTERCAMBIO }), qc.invalidateQueries({ queryKey: ['admin', 'auditoria'] })]);

  const alternar = useMutation({
    mutationFn: async (o: AdminOfertaDTO) =>
      (await chamar<OfertaIntercambioDTO>('PATCH', `/api/admin/intercambio/ofertas/${o.id}`, { corpo: { ativo: !o.ativo } })).data,
    onSuccess: async (o) => {
      toast(o.ativo ? `Oferta ativada: ${ofertaPorTickets(o)}. Já aparece no Intercâmbio.` : `Oferta pausada: ${rotuloOferta(o)} saiu do Intercâmbio.`, 'sucesso', {
        duracaoMs: 3500,
      });
      await recarregar();
    },
    onError: (e) => toast(mensagemAdmin(e), 'erro', { duracaoMs: 7000 }),
  });

  const mover = useMutation({
    mutationFn: async ({ lista, de, para }: { lista: AdminOfertaDTO[]; de: number; para: number }) => {
      const a = lista[de];
      const b = lista[para];
      if (!a || !b) return;
      if (new Set(lista.map((o) => o.ordem)).size === lista.length) {
        // ordens distintas: basta trocar as duas de lugar
        await chamar('PATCH', `/api/admin/intercambio/ofertas/${a.id}`, { corpo: { ordem: b.ordem } });
        await chamar('PATCH', `/api/admin/intercambio/ofertas/${b.id}`, { corpo: { ordem: a.ordem } });
        return;
      }
      // ordens repetidas: renumera a tabela inteira já na ordem nova
      const nova = trocarOrdem(lista, de, para);
      for (const [i, o] of nova.entries()) {
        await chamar('PATCH', `/api/admin/intercambio/ofertas/${o.id}`, { corpo: { ordem: i + 1 } });
      }
    },
    onMutate: async ({ de, para }) => {
      await qc.cancelQueries({ queryKey: CHAVE_INTERCAMBIO });
      const antes = qc.getQueryData<AdminIntercambioDTO>(CHAVE_INTERCAMBIO);
      if (antes) qc.setQueryData<AdminIntercambioDTO>(CHAVE_INTERCAMBIO, { ...antes, ofertas: trocarOrdem(antes.ofertas, de, para) });
      return { antes };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(CHAVE_INTERCAMBIO, ctx.antes);
      toast(mensagemAdmin(e), 'erro', { duracaoMs: 6000 });
    },
    onSettled: () => void recarregar(),
  });

  const excluir = useMutation({
    mutationFn: async (o: AdminOfertaDTO) => {
      await chamar('DELETE', `/api/admin/intercambio/ofertas/${o.id}`);
      return o;
    },
    onSuccess: async (o) => {
      qc.setQueryData<AdminIntercambioDTO>(CHAVE_INTERCAMBIO, (p) => (p ? { ...p, ofertas: p.ofertas.filter((x) => x.id !== o.id) } : p));
      setExcluindo(null);
      toast(`Oferta excluída: ${ofertaPorTickets(o)}.`, 'sucesso');
      await recarregar();
    },
  });

  const moverPara = (de: number, para: number, dir: 'subir' | 'descer') => {
    const o = ofertas[de];
    if (!o || para < 0 || para >= ofertas.length || mover.isPending) return;
    foco.current = { id: o.id, dir };
    mover.mutate({ lista: ofertas, de, para });
  };

  // o foco acompanha a oferta que mudou de lugar (o nó é movido no DOM e perderia o foco)
  useEffect(() => {
    const f = foco.current;
    if (!f) return;
    const botao = document.getElementById(`${idBase}-${f.id}-${f.dir}`) as HTMLButtonElement | null;
    const outro = document.getElementById(`${idBase}-${f.id}-${f.dir === 'subir' ? 'descer' : 'subir'}`) as HTMLButtonElement | null;
    if (botao && !botao.disabled) botao.focus();
    else outro?.focus();
    if (!mover.isPending) foco.current = null;
  }, [ofertas, mover.isPending, idBase]);

  return (
    <Cartao
      className="itc-ofertas-cartao"
      titulo={<TituloSecao Icone={ArrowLeftRight} texto="Ofertas" tom="roxo" sub={`${ofertas.length} ${ofertas.length === 1 ? 'oferta' : 'ofertas'} · ${ativas} ${ativas === 1 ? 'ativa' : 'ativas'}`} />}
      acoes={
        <BotaoAdm tamanho="p" variante="primario" onClick={aoNova}>
          <Plus className="h-4 w-4" aria-hidden /> Nova oferta
        </BotaoAdm>
      }
    >
      <p className="itc-texto-suave itc-explica">
        O que os membros recebem por tickets, na ordem em que aparece no jogo. Ovos vão para o estoque; o animal nasce no menor ninho livre.
      </p>
      {/* .itc-ofertas-caixa é o contêiner das consultas de largura; o modal fica fora dele (position: fixed) */}
      <div className="itc-ofertas-caixa">
        {ofertas.length > 0 && <FaixaRegra painel={painel} config={config} previa={!!previa} />}
        {ofertas.length === 0 ? (
          <div className="itc-vazio">
            <Vazio titulo="Nenhuma oferta na tabela">
              <p>Sem ofertas, o Intercâmbio fica vazio: os membros juntam tickets mas não têm pelo que trocar.</p>
              <BotaoAdm variante="primario" className="mt-4" onClick={aoNova}>
                <Plus className="h-4 w-4" aria-hidden /> Criar a primeira oferta
              </BotaoAdm>
            </Vazio>
          </div>
        ) : (
          <>
            <div className="itc-ofertas-cabeca" aria-hidden>
              <span>Ordem</span>
              <span />
              <span>Oferta</span>
              <span>Custo</span>
              <span>Valor e regra “sem lucro”</span>
              <span>Trocas</span>
              <span />
            </div>
            <ol className="itc-ofertas" aria-label="Ofertas do Intercâmbio" aria-busy={mover.isPending || undefined}>
              {ofertas.map((o, i) => (
                <LinhaOferta
                  key={o.id}
                  o={o}
                  pos={i + 1}
                  total={ofertas.length}
                  config={config}
                  bp={bp}
                  idBase={idBase}
                  travado={mover.isPending}
                  ocupado={alternar.isPending && alternar.variables?.id === o.id}
                  aoSubir={() => moverPara(i, i - 1, 'subir')}
                  aoDescer={() => moverPara(i, i + 1, 'descer')}
                  aoEditar={() => aoEditar(o)}
                  aoAlternar={() => alternar.mutate(o)}
                  aoExcluir={() => {
                    excluir.reset();
                    setExcluindo(o);
                  }}
                />
              ))}
            </ol>
          </>
        )}
      </div>

      <ModalAdm aberto={!!excluindo} titulo="Excluir oferta" aoFechar={fecharExcluir}>
        {excluindo && (
          <div className="adm-us-form">
            <div className="itc-excluir-oferta">
              <ArteOferta tipo={excluindo.tipo} item={excluindo.item} quantidade={excluindo.quantidade} animal={excluindo.animal} />
              <div className="min-w-0">
                <p className="itc-excluir-rotulo">{rotuloOferta(excluindo)}</p>
                <ChipTickets n={excluindo.custoTickets} />
              </div>
            </div>
            <p className="adm-us-texto">Excluir esta oferta? Ela some do Intercâmbio na hora.</p>
            <ul className="adm-us-efeitos">
              <li>As trocas já feitas continuam valendo: os ovos e animais ficam com os membros, e o extrato de tickets de cada um mostra a troca.</li>
              <li>
                {excluindo.trocasTotal
                  ? `Já foi trocada ${fmt.int(excluindo.trocasTotal)} ${excluindo.trocasTotal === 1 ? 'vez' : 'vezes'} (${fmt.int(excluindo.trocas30d)} nos últimos 30 dias).`
                  : 'Ninguém trocou tickets por ela ainda.'}
              </li>
              <li>Não dá para desfazer (mas dá para criar uma igual depois).</li>
            </ul>
            {excluindo.ativo && (
              <Alerta tom="azul" icone={<Pause className="h-4 w-4" />}>
                <p>Se a ideia é só tirar do ar por um tempo, pause: ela fica guardada com as estatísticas.</p>
                <BotaoAdm
                  tamanho="p"
                  className="mt-2"
                  disabled={alternar.isPending}
                  onClick={() => {
                    alternar.mutate(excluindo);
                    setExcluindo(null);
                  }}
                >
                  <Pause className="h-4 w-4" aria-hidden /> Pausar em vez de excluir
                </BotaoAdm>
              </Alerta>
            )}
            <ErroModal texto={excluir.isError ? mensagemAdmin(excluir.error) : null} />
            <AcoesModal>
              <BotaoAdm onClick={fecharExcluir}>Cancelar</BotaoAdm>
              <BotaoAdm variante="perigo" disabled={excluir.isPending} onClick={() => excluir.mutate(excluindo)}>
                <Trash2 className="h-4 w-4" aria-hidden /> {excluir.isPending ? 'Excluindo…' : 'Excluir oferta'}
              </BotaoAdm>
            </AcoesModal>
          </div>
        )}
      </ModalAdm>
    </Cartao>
  );
}

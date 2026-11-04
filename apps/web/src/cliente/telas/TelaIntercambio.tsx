'use client';

// Intercâmbio (lado do jogador): o jogador troca TICKETS — vales do jogo — por ovos (vão para o estoque) ou por
// animais (vão para um ninho livre), pela tabela de ofertas que a equipe monta no painel. Tickets vêm de cupons
// (códigos da equipe), de presentes da equipe e, só se a equipe ligar, da compra com MOEDAS DO JOGO. Nunca de
// dinheiro — a tela diz isso com todas as letras.
// Visual (DIRECAO_DE_ARTE 4): cabeçalho com voltar e o ícone ilustrado; o saldo num bilhete rosa de verdade (conta
// animada); "Resgatar cupom" em painel com faixa; as ofertas em cartões (cesto de ovos ou o animal no ninho sobre o
// fundo da raridade) com o botão azul de troca e o preço em tickets; a compra com seletor; o histórico com azulejos.
// Celebrações: tickets voando até o bilhete (cupom, compra), ovos voando até o HUD (troca por ovos) e a revelação da
// carta, a mesma da roleta (troca por animal). Celular: uma coluna; desktop: saldo, cupom e compra à esquerda
// (presos ao rolar) e as vitrines (4 cartões por linha) e o histórico à direita.
import type { EntityDTO } from '@galinheiro/api-contract';
import { CONFIG, NOME_TIPO_PLURAL_OVO } from '@galinheiro/game-core';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, CirclePause } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ErroApi } from '../api';
import { FiguraAnimal } from '../arte/Animal';
import { IconeNinho, Ovo } from '../arte/Icones';
import { Juca } from '../arte/Juca';
import { Modal } from '../componentes/Modal';
import { useConexao } from '../conexao';
import { CHAVE_ESTADO, useEstado } from '../estado';
import { ComprarTickets, ModalConfirmarCompra } from '../intercambio/ComprarTickets';
import { useComprarTickets, useIntercambio, useTrocarTickets } from '../intercambio/consultas';
import { HistoricoTickets } from '../intercambio/Historico';
import { IconeIntercambio } from '../intercambio/IconeTicket';
import { CartaoOferta, ModalConfirmarTroca, SecaoOfertas, type Bloqueio } from '../intercambio/Ofertas';
import { ResgatarCupom } from '../intercambio/ResgatarCupom';
import { RevelacaoTroca } from '../intercambio/RevelacaoTroca';
import { BilheteSaldo, useFestaTickets } from '../intercambio/Saldo';
import { ovos, separarOfertas, tickets, type OfertaTela } from '../intercambio/texto';
import { marcarIntercambioVisto } from '../intercambio/visto';
import { CSS_EASE } from '../movimento';
import { som } from '../som';
import { toast, useUi } from '../ui';
import { mensagemDeErro } from '../util';
import { vibracao } from '../vibracao';

/** Ovos que saltam do cesto (60 ms entre si, como na coleta) e voam até o contador do HUD. */
const PASSO_OVO_MS = 60;
const MAX_OVOS_VOANDO = 10;
/** Erros que mudam o que a tela mostra (saldo, ofertas, regras): recarrega tudo. */
const RECARREGA = new Set(['TICKETS_INSUFICIENTES', 'OFERTA_INDISPONIVEL', 'INTERCAMBIO_FECHADO', 'COMPRA_DESLIGADA', 'LIMITE_DIARIO', 'SALDO_INSUFICIENTE']);

function AvisoFechado() {
  return (
    <div className="painel-escuro aviso intercambio-aviso intercambio-fechado" role="status">
      <span className="toast-icone" aria-hidden>
        <span className="icone-contorno">
          <CirclePause />
          <CirclePause />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="intercambio-aviso-titulo">Intercâmbio fechado</p>
        <p className="intercambio-aviso-texto">As trocas estão pausadas por enquanto. Seus tickets ficam guardados e os cupons continuam valendo.</p>
      </div>
    </div>
  );
}

function AvisoCheio({ noMaximo }: { noMaximo: boolean }) {
  return (
    <div className="painel-escuro aviso intercambio-aviso intercambio-cheio" role="status">
      <span className="toast-icone" aria-hidden>
        <IconeNinho className="intercambio-aviso-ninho" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="intercambio-aviso-titulo">Galinheiro cheio</p>
        <p className="intercambio-aviso-texto">
          {noMaximo
            ? 'Todos os ninhos estão ocupados. Quando um animal se aposentar, o ninho dele fica livre.'
            : 'Para receber um animal, amplie o galinheiro na Loja.'}
        </p>
      </div>
      {!noMaximo && (
        <Link href="/loja" className="botao botao-primario botao-p intercambio-aviso-botao">
          Ampliar
        </Link>
      )}
    </div>
  );
}

function EsqueletoOfertas() {
  return (
    <div className="intercambio-esqueleto" role="status">
      <span className="sr-only">Carregando as trocas…</span>
      <span className="intercambio-esqueleto-placa" aria-hidden />
      <div className="troca-grade" aria-hidden>
        {/* o "encaixe vazio" de um cartão: janelinha da arte, nome, valor e botão só sugeridos */}
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="intercambio-esqueleto-cartao" style={{ ['--i' as string]: i }}>
            <span className="intercambio-esqueleto-arte" />
            <span className="intercambio-esqueleto-linha" />
            <span className="intercambio-esqueleto-linha intercambio-esqueleto-linha-curta" />
            <span className="intercambio-esqueleto-botao" />
          </span>
        ))}
      </div>
    </div>
  );
}

export function TelaIntercambio() {
  const params = useSearchParams();
  const focarCupom = params?.get('cupom') === '1';
  // quem veio de "Resgatar cupom" (Ajustes) volta para os Ajustes; o resto, para a Loja
  const deAjustes = params?.get('de') === 'ajustes';
  const router = useRouter();
  const qc = useQueryClient();
  const online = useConexao((s) => s.online);
  const { data: estado } = useEstado();
  const consulta = useIntercambio();
  const d = consulta.data;
  const trocarM = useTrocarTickets();
  const comprarM = useComprarTickets();
  const real = estado?.player.tickets ?? d?.tickets ?? 0;
  const festa = useFestaTickets(real);
  const campoCupom = useRef<HTMLInputElement>(null);
  const [confirmar, setConfirmar] = useState<{ of: OfertaTela; arte: HTMLElement | null } | null>(null);
  const [trocandoId, setTrocandoId] = useState<string | null>(null);
  const [revelando, setRevelando] = useState<EntityDTO | null>(null);
  const [cheio, setCheio] = useState(false);
  const [compra, setCompra] = useState<{ quantidade: number; origem: HTMLElement | null } | null>(null);

  // o selo "NOVO" do cartão da Loja sai depois da primeira visita
  useEffect(() => marcarIntercambioVisto(), []);

  // o saldo mudou por fora (presente da equipe, outra aba) e chegou pelo /state: busca o histórico novo
  const ticketsEstado = estado?.player.tickets;
  const ticketsTela = d?.tickets;
  const buscando = consulta.isFetching;
  const recarregar = consulta.refetch;
  useEffect(() => {
    if (ticketsEstado !== undefined && ticketsTela !== undefined && ticketsEstado !== ticketsTela && !buscando) void recarregar();
    // só quando o saldo do estado muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketsEstado]);

  if (!estado) return null;

  const livres = estado.player.capacidade - estado.entidades.length;
  const noMaximo = estado.player.nivelGalinheiro >= CONFIG.galinheiro.nivelMax;
  const aberto = d ? d.config.ativo : true;
  const { ovos: ofertasOvos, animais: ofertasAnimais } = d ? separarOfertas(d.ofertas) : { ovos: [], animais: [] };

  const focarCampoCupom = () => {
    const campo = campoCupom.current;
    if (!campo) return;
    campo.scrollIntoView({ block: 'center', behavior: 'smooth' });
    campo.focus({ preventScroll: true });
  };

  const recarregarTudo = () => {
    void consulta.refetch();
    void qc.invalidateQueries({ queryKey: CHAVE_ESTADO });
  };

  // ---------------------------------------------------------------- trocas
  const pedirTroca = (of: OfertaTela, arte: HTMLElement | null) => {
    if (trocandoId) return;
    if (!online) {
      toast('Sem conexão. Tente quando a internet voltar.', 'erro');
      return;
    }
    som.toque();
    setConfirmar({ of, arte });
  };

  const bloqueado = (of: OfertaTela, motivo: Bloqueio) => {
    som.erro();
    if (motivo === 'ninho') {
      setCheio(true);
      return;
    }
    toast(`Faltam ${tickets(Math.max(1, of.o.custoTickets - real))} para esta troca.`, 'info', {
      acao: { rotulo: 'Usar cupom', fn: focarCampoCupom },
      duracaoMs: 3600,
    });
  };

  /** Ovos recebidos: saltam do cesto do cartão e voam até o HUD (o contador conta quando chegam), faíscas e toast. */
  const comemorarOvos = (of: Extract<OfertaTela, { tipo: 'ovos' }>, arte: HTMLElement | null) => {
    const rect = arte?.isConnected ? arte.getBoundingClientRect() : null;
    const n = Math.min(MAX_OVOS_VOANDO, of.quantidade);
    if (arte && rect && rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight) {
      const ui = useUi.getState();
      ui.lancarOvos(Array.from({ length: n }, (_, i) => ({ item: of.item, de: rect, atrasoMs: i * PASSO_OVO_MS, indice: i, total: n })));
      ui.lancarRajada({ tipo: 'faiscas', x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.55, n: 10 });
      if (!document.documentElement.classList.contains('reduzir-movimento')) {
        arte.closest('.troca')?.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.06) rotate(-1deg)', offset: 0.35 }, { transform: 'scale(1)' }],
          { duration: 340, easing: CSS_EASE.suave },
        );
      }
    }
    for (let i = 0; i < Math.min(n, 6); i++) setTimeout(() => som.pop(i), 40 + i * PASSO_OVO_MS * 1.5);
    vibracao.coleta();
    toast(`+${ovos(of.quantidade)} de ${NOME_TIPO_PLURAL_OVO[of.especie]} no estoque!`, 'sucesso', { duracaoMs: 2800 });
  };

  const trocar = async () => {
    const pedido = confirmar;
    if (!pedido || trocandoId) return;
    setConfirmar(null);
    const { of, arte } = pedido;
    setTrocandoId(of.o.id);
    try {
      const r = await trocarM.mutateAsync(of.o.id);
      festa.gastar(of.o.custoTickets);
      if (r.data.entity) setRevelando(r.data.entity);
      else if (of.tipo === 'ovos') comemorarOvos(of, arte);
    } catch (erro) {
      som.erro();
      vibracao.erro();
      if (erro instanceof ErroApi && erro.codigo === 'SEM_NINHO_LIVRE') {
        setCheio(true);
        void qc.invalidateQueries({ queryKey: CHAVE_ESTADO });
        return;
      }
      if (erro instanceof ErroApi && RECARREGA.has(erro.codigo)) recarregarTudo();
      toast(mensagemDeErro(erro), 'erro');
    } finally {
      setTrocandoId(null);
    }
  };

  const fecharRevelacao = (destino?: string) => {
    const e = revelando;
    setRevelando(null);
    if (destino && e) {
      router.push(destino);
      setTimeout(() => document.querySelector(`[data-slot="${e.slotId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
    }
  };

  // ---------------------------------------------------------------- compra (moedas do jogo → tickets)
  const pedirCompra = (quantidade: number, origem: HTMLElement | null) => {
    if (comprarM.isPending) return;
    if (!online) {
      toast('Sem conexão. Tente quando a internet voltar.', 'erro');
      return;
    }
    som.toque();
    setCompra({ quantidade, origem });
  };

  const comprar = async () => {
    const pedido = compra;
    if (!pedido || comprarM.isPending) return;
    setCompra(null);
    festa.segurar();
    try {
      const r = await comprarM.mutateAsync(pedido.quantidade);
      som.moedas();
      // os tickets voam do botão até o bilhete; se o bilhete está fora da tela, o toast confirma
      const viu = festa.ganhar(r.data.quantidade, pedido.origem);
      if (!viu) toast(`+${tickets(r.data.quantidade)} no seu saldo!`, 'sucesso');
    } catch (erro) {
      festa.soltar();
      som.erro();
      vibracao.erro();
      if (erro instanceof ErroApi && RECARREGA.has(erro.codigo)) recarregarTudo();
      toast(mensagemDeErro(erro), 'erro');
    }
  };

  const ofertas = (lista: OfertaTela[], base: number) =>
    lista.map((of, i) => (
      <CartaoOferta
        key={of.o.id}
        of={of}
        indice={base + i}
        saldo={real}
        semNinho={livres <= 0}
        trocando={trocandoId === of.o.id}
        aoTrocar={pedirTroca}
        aoBloqueado={bloqueado}
      />
    ));

  return (
    <div className="tela intercambio-tela">
      <div className="tela-cabeca">
        <Link
          href={deAjustes ? '/ajustes' : '/loja'}
          className="botao botao-icone botao-secundario tela-cabeca-voltar"
          aria-label={deAjustes ? 'Voltar para as configurações' : 'Voltar para a loja'}
        >
          <ChevronLeft strokeWidth={3} />
        </Link>
        <IconeIntercambio className="tela-cabeca-icone" />
        <h1 className="titulo-tela">Intercâmbio</h1>
      </div>

      <div className="intercambio-secoes" data-fechado={d && !aberto ? '' : undefined}>
        {d && !aberto && <AvisoFechado />}
        <div className="intercambio-coluna intercambio-coluna-saldo" data-compra={d && aberto && d.config.compraAtiva ? '' : undefined}>
          <BilheteSaldo festa={festa} real={real} fechado={!aberto} />
          <ResgatarCupom festa={festa} campoRef={campoCupom} focar={focarCupom} />
          {d && aberto && d.config.compraAtiva && (
            <ComprarTickets
              config={d.config}
              compradosHoje={d.compradosHoje}
              moedasX100={estado.player.moedasX100}
              comprando={comprarM.isPending}
              aoComprar={pedirCompra}
            />
          )}
        </div>

        {aberto && (
          <div className="intercambio-coluna intercambio-coluna-trocas">
            {!d ? (
              consulta.isError ? (
                <div className="painel intercambio-erro" role="alert">
                  <Juca expressao="surpreso" sombra={false} className="intercambio-erro-juca" />
                  <p className="intercambio-erro-titulo">Não consegui abrir as trocas.</p>
                  <p className="intercambio-erro-texto">{online ? mensagemDeErro(consulta.error) : 'Sem conexão com a internet.'}</p>
                  <button type="button" className="botao botao-primario mt-2" onClick={() => void consulta.refetch()} disabled={consulta.isFetching}>
                    {consulta.isFetching ? 'Tentando…' : 'Tentar de novo'}
                  </button>
                </div>
              ) : (
                <EsqueletoOfertas />
              )
            ) : (
              <>
                {ofertasOvos.length + ofertasAnimais.length === 0 && (
                  <div className="painel intercambio-vazio">
                    <Juca expressao="piscando" sombra={false} parado className="intercambio-vazio-juca" />
                    <div className="min-w-0">
                      <p className="intercambio-vazio-titulo">Nenhuma troca agora</p>
                      <p className="intercambio-vazio-texto">A equipe está arrumando a vitrine. Seus tickets ficam guardados até lá.</p>
                    </div>
                  </div>
                )}
                {ofertasOvos.length > 0 && (
                  <SecaoOfertas
                    id="intercambio-ovos"
                    titulo="Trocar por ovos"
                    icone={
                      <span className="tile-icone" data-cor="verde" aria-hidden>
                        <Ovo tipo="galinha" className="intercambio-placa-arte" />
                      </span>
                    }
                  >
                    {ofertas(ofertasOvos, 0)}
                  </SecaoOfertas>
                )}
                {ofertasAnimais.length > 0 && (
                  <SecaoOfertas
                    id="intercambio-animais"
                    titulo="Trocar por animais"
                    icone={
                      <span className="tile-icone" data-cor="ouro" aria-hidden>
                        <FiguraAnimal tipo="galinha" ninho={false} detalhe="p" className="intercambio-placa-arte intercambio-placa-animal" />
                      </span>
                    }
                    aviso={livres <= 0 ? <AvisoCheio noMaximo={noMaximo} /> : undefined}
                  >
                    {ofertas(ofertasAnimais, ofertasOvos.length)}
                  </SecaoOfertas>
                )}
                <HistoricoTickets historico={d.historico} />
              </>
            )}
          </div>
        )}
      </div>

      <ModalConfirmarTroca of={confirmar?.of ?? null} saldo={real} aoConfirmar={() => void trocar()} aoFechar={() => setConfirmar(null)} />
      <ModalConfirmarCompra
        quantidade={compra?.quantidade ?? null}
        precoX100={d?.config.precoTicketX100 ?? 0}
        aoConfirmar={() => void comprar()}
        aoFechar={() => setCompra(null)}
      />
      <Modal aberto={cheio} aoFechar={() => setCheio(false)} titulo="Galinheiro cheio!">
        <p className="intercambio-modal-texto">
          {noMaximo
            ? `Todos os ${estado.player.capacidade} ninhos estão ocupados. Quando um animal se aposentar, o ninho dele fica livre para um novo.`
            : `Todos os ${estado.player.capacidade} ninhos estão ocupados. Amplie o galinheiro na Loja para receber o animal.`}
        </p>
        <div className="mt-4 flex gap-2">
          {!noMaximo && (
            <Link href="/loja" className="botao botao-primario flex-1" onClick={() => setCheio(false)}>
              Ir à Loja
            </Link>
          )}
          <button type="button" className="botao botao-secundario flex-1" onClick={() => setCheio(false)}>
            {noMaximo ? 'Entendi' : 'Agora não'}
          </button>
        </div>
      </Modal>
      <RevelacaoTroca entidade={revelando} aoFechar={fecharRevelacao} />
      {festa.camada}
    </div>
  );
}

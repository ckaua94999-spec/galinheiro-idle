'use client';

// Intercâmbio do painel (/admin/intercambio): onde os membros trocam TICKETS (vales do jogo) por ovos ou animais.
// Mostra de onde vêm os tickets, as estatísticas (circulação agora e últimos 30 dias), as regras (aberto, compra
// com moedas do jogo, preço do ticket e limite diário) e a tabela de ofertas, com criar/editar, ordem, pausar e
// excluir. A regra "sem lucro" aparece em cada oferta de ovos. Tudo em MOEDAS E ITENS DO JOGO.
import type { AdminIntercambioDTO } from '@galinheiro/api-contract';
import { ArrowLeftRight, Plus, ShoppingCart, TicketPercent, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState, type ReactNode } from 'react';
import { Moeda } from '../../arte/Icones';
import { Falha } from '../afiliados/comum';
import { CabecalhoAdm } from '../ShellAdmin';
import { BotaoAdm, Cartao, Carregando, fmt } from '../ui';
import { useAgoraLento } from '../usuarios/comum';
import { AvisoTickets, IconeTicket, usePainelIntercambio } from './comum';
import { ModalOferta, type ModoOferta } from './ModalOferta';
import { ListaOfertas } from './Ofertas';
import { FormRegras, useRascunhoRegras } from './Regras';

/** "+12" / "−3" / "0" */
const comSinal = (n: number): string => (n > 0 ? `+${fmt.int(n)}` : n < 0 ? `−${fmt.int(-n)}` : '0');
/** entradas: "+12" / "0" */
const entrada = (n: number): string => (n > 0 ? `+${fmt.int(n)}` : fmt.int(n));

function Fluxo({ rotulo, valor, sub, tom, icone }: { rotulo: string; valor: ReactNode; sub: string; tom: 'azul' | 'ambar' | 'roxo' | 'verde'; icone: ReactNode }) {
  return (
    <div className="itc-fluxo-item" data-tom={tom}>
      <dt>
        <span className="itc-fluxo-icone" aria-hidden>
          {icone}
        </span>
        {rotulo}
      </dt>
      <dd>{valor}</dd>
      <dd className="itc-fluxo-item-sub">{sub}</dd>
    </div>
  );
}

/** Tickets em circulação agora e o que entrou e saiu nos últimos 30 dias. */
function Estatisticas({ painel }: { painel: AdminIntercambioDTO }) {
  const e = painel.estatisticas;
  return (
    <section className="adm-cartao itc-fluxo" aria-label="Tickets: circulação e últimos 30 dias">
      <div className="itc-fluxo-grade">
        <div className="itc-fluxo-circulacao">
          <IconeTicket className="itc-fluxo-ticket" />
          <div className="min-w-0">
            <p className="itc-fluxo-rotulo">Em circulação</p>
            <p className="itc-fluxo-total">
              {fmt.int(e.ticketsCirculacao)} <span>{e.ticketsCirculacao === 1 ? 'ticket' : 'tickets'}</span>
            </p>
            <p className="itc-fluxo-sub">com os membros agora</p>
          </div>
        </div>
        <div className="itc-fluxo-periodo">
          <p className="itc-fluxo-rotulo">Últimos 30 dias</p>
          <dl className="itc-fluxo-lista">
            <Fluxo rotulo="De cupons" valor={entrada(e.cupons30d)} sub="resgatados com código" tom="azul" icone={<TicketPercent className="h-4 w-4" />} />
            <Fluxo
              rotulo="Comprados"
              valor={entrada(e.comprados30d)}
              sub={painel.config.compraAtiva ? 'com moedas do jogo' : 'compra desligada agora'}
              tom="ambar"
              icone={<ShoppingCart className="h-4 w-4" />}
            />
            <Fluxo rotulo="Ajustes" valor={comSinal(e.ajustes30d)} sub="créditos e débitos da equipe" tom="roxo" icone={<Wrench className="h-4 w-4" />} />
            <Fluxo rotulo="Trocados" valor={fmt.int(e.trocados30d)} sub="viraram ovos e animais" tom="verde" icone={<ArrowLeftRight className="h-4 w-4" />} />
            <Fluxo
              rotulo="Moedas gastas"
              valor={fmt.moedas(e.moedasCompra30dX100)}
              sub="na compra de tickets"
              tom="ambar"
              icone={<Moeda className="h-4 w-4" />}
            />
          </dl>
        </div>
      </div>
    </section>
  );
}

function Conteudo({ painel, agora, aoNova, aoEditar }: {
  painel: AdminIntercambioDTO;
  agora: number;
  aoNova: () => void;
  aoEditar: (m: ModoOferta) => void;
}) {
  const regras = useRascunhoRegras(painel.config);
  return (
    <>
      <Estatisticas painel={painel} />
      <FormRegras painel={painel} estado={regras} agora={agora} />
      <ListaOfertas painel={painel} previa={regras.previa} aoNova={aoNova} aoEditar={(o) => aoEditar({ tipo: 'editar', oferta: o })} />
    </>
  );
}

export function TelaIntercambio() {
  const painel = usePainelIntercambio();
  const agora = useAgoraLento();
  const [modo, setModo] = useState<ModoOferta | null>(null);
  const fechar = useCallback(() => setModo(null), []);
  const nova = () => setModo({ tipo: 'nova' });

  return (
    <div className="itc">
      <CabecalhoAdm
        titulo="Intercâmbio"
        descricao="Onde os membros trocam tickets por ovos e animais: as regras e a tabela de ofertas."
        acoes={
          <>
            <Link href="/admin/cupons" className="adm-botao">
              <TicketPercent className="h-4 w-4" aria-hidden /> Cupons
            </Link>
            <BotaoAdm variante="primario" onClick={nova} disabled={!painel.data}>
              <Plus className="h-4 w-4" aria-hidden /> Nova oferta
            </BotaoAdm>
          </>
        }
      />
      <AvisoTickets />
      {painel.data ? (
        <Conteudo painel={painel.data} agora={agora} aoNova={nova} aoEditar={setModo} />
      ) : painel.isError ? (
        <Falha erro={painel.error} tentar={() => void painel.refetch()} titulo="Não deu para carregar o Intercâmbio." />
      ) : (
        <Cartao>
          <Carregando texto="Carregando o Intercâmbio…" />
        </Cartao>
      )}
      {modo && painel.data && (
        <ModalOferta key={modo.tipo === 'nova' ? 'nova' : modo.oferta.id} modo={modo} painel={painel.data} aoFechar={fechar} />
      )}
    </div>
  );
}

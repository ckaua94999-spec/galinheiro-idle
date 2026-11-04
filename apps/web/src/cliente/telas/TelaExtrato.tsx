'use client';

// Extrato de moedas (GDD 3.5.5 e 6.16): toda movimentação de 🪙, paginada por cursor.
// Visual: placa de madeira com o saldo, transações agrupadas por dia (Hoje, Ontem…), azulejo colorido
// por tipo e valor +/− em texto contornado verde/vermelho com a moeda do jogo.
import type { ListaTransacoes, TransacaoDTO } from '@galinheiro/api-contract';
import { CONFIG, NOME_TIPO, type Tipo } from '@galinheiro/game-core';
import { useInfiniteQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, Gift, Hammer, Wrench } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { chamar } from '../api';
import { IconeCesto, IconeRoleta, Moeda } from '../arte/Icones';
import { BotaoSaque } from '../saque/BotaoSaque';
import { IconeConvite } from '../convites/IconeConvite';
import { useEstado } from '../estado';
import { IconeTicket } from '../intercambio/IconeTicket';
import { entradaDeLista } from '../movimento';
import { moedas } from '../util';

function descricao(t: TransacaoDTO): string {
  const d = t.detalhes as { tipo?: Tipo; nivelPara?: number };
  switch (t.tipo) {
    case 'BONUS_INICIAL':
      return 'Bônus inicial';
    case 'VENDA_OVOS':
      return 'Venda de ovos';
    case 'GIRO_ROLETA':
      return `Giro (${d.tipo ? NOME_TIPO[d.tipo] : 'roleta'})`;
    case 'UPGRADE_NINHO':
      return `Ampliação (nível ${d.nivelPara ?? '?'})`;
    case 'COMISSAO_INDICACAO':
      return 'Comissão de indicação';
    case 'COMPRA_TICKET':
      return 'Compra de tickets';
    case 'SAQUE':
      return 'Saque PIX';
    case 'SAQUE_ESTORNO':
      return 'Saque devolvido';
    default:
      return 'Ajuste';
  }
}

/** Linha extra de alguns tipos: a comissão diz de que nível e de quem foi a venda ("Nível 1 · venda de Ana L.");
 *  a compra de tickets do Intercâmbio, quantos ("3 tickets"). */
function detalhe(t: TransacaoDTO): string | null {
  if (t.tipo === 'COMPRA_TICKET') {
    const q = Number((t.detalhes as { quantidade?: unknown }).quantidade);
    return Number.isFinite(q) && q > 0 ? `${q} ${q === 1 ? 'ticket' : 'tickets'}` : null;
  }
  if (t.tipo !== 'COMISSAO_INDICACAO') return null;
  const d = t.detalhes as { nivel?: number; origem?: string | null };
  const quem = d.origem ? `venda de ${d.origem}` : 'venda de um convidado';
  return d.nivel ? `Nível ${d.nivel} · ${quem}` : quem;
}

/** Azulejo colorido do tipo de transação. */
function IconeTransacao({ tipo }: { tipo: TransacaoDTO['tipo'] }) {
  const lucide = (Icone: typeof Gift) => (
    <span className="icone-contorno">
      <Icone />
      <Icone />
    </span>
  );
  switch (tipo) {
    case 'BONUS_INICIAL':
      return (
        <span className="tile-icone" data-cor="rosa" aria-hidden>
          {lucide(Gift)}
        </span>
      );
    case 'VENDA_OVOS':
      return (
        <span className="tile-icone" data-cor="verde" aria-hidden>
          <IconeCesto />
        </span>
      );
    case 'GIRO_ROLETA':
      return (
        <span className="tile-icone" data-cor="azul" aria-hidden>
          <IconeRoleta />
        </span>
      );
    case 'UPGRADE_NINHO':
      return (
        <span className="tile-icone" aria-hidden>
          {lucide(Hammer)}
        </span>
      );
    case 'COMISSAO_INDICACAO':
      return (
        <span className="tile-icone" data-cor="rosa" aria-hidden>
          <IconeConvite />
        </span>
      );
    case 'COMPRA_TICKET':
      return (
        <span className="tile-icone" data-cor="creme" aria-hidden>
          <IconeTicket />
        </span>
      );
    default:
      return (
        <span className="tile-icone" data-cor="cinza" aria-hidden>
          {lucide(Wrench)}
        </span>
      );
  }
}

const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const DIA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** "Hoje", "Ontem" ou "sábado, 3 de out." */
function rotuloDia(iso: string, agora: Date): string {
  const d = new Date(iso);
  if (chaveDia(d) === chaveDia(agora)) return 'Hoje';
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (chaveDia(d) === chaveDia(ontem)) return 'Ontem';
  const t = DIA.format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function agrupar(itens: TransacaoDTO[], agora: Date): { rotulo: string; itens: TransacaoDTO[] }[] {
  const grupos: { chave: string; rotulo: string; itens: TransacaoDTO[] }[] = [];
  for (const t of itens) {
    const chave = chaveDia(new Date(t.criadoEm));
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.chave === chave) ultimo.itens.push(t);
    else grupos.push({ chave, rotulo: rotuloDia(t.criadoEm, agora), itens: [t] });
  }
  return grupos;
}

/** Placa com o saldo atual (exportada para a galeria). */
export function CartaoSaldo({ saldoX100 }: { saldoX100: number | null }) {
  return (
    <div className="painel-madeira extrato-saldo">
      <Moeda className="extrato-saldo-moeda" />
      <div className="relative min-w-0">
        <p className="extrato-saldo-rotulo">Saldo atual</p>
        <p className="extrato-saldo-valor texto-contorno numeros">{saldoX100 === null ? '…' : moedas(saldoX100)}</p>
      </div>
    </div>
  );
}

/** Lista agrupada por dia (exportada para a galeria). */
export function ListaExtrato({ itens, carregando = false, agora = new Date() }: { itens: TransacaoDTO[]; carregando?: boolean; agora?: Date }) {
  if (carregando)
    return (
      <div className="painel py-2" aria-busy>
        <p className="sr-only">Carregando…</p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="extrato-esqueleto" />
        ))}
      </div>
    );
  if (itens.length === 0)
    return (
      <div className="painel extrato-vazio">
        <Moeda className="h-12 w-12" />
        <p>Nenhuma movimentação ainda.</p>
      </div>
    );
  return (
    <div className="extrato-grupos">
      {agrupar(itens, agora).map((g, gi) => (
        <section key={`${g.rotulo}-${gi}`}>
          <h2 className="extrato-dia">
            <CalendarDays strokeWidth={3} aria-hidden />
            {g.rotulo}
          </h2>
          <ul className="painel lista-painel overflow-hidden">
            {g.itens.map((t, i) => {
              const mais = t.valorX100 > 0;
              const extra = detalhe(t);
              return (
                <motion.li
                  key={t.id}
                  className="extrato-linha"
                  {...entradaDeLista(i)}
                >
                  <IconeTransacao tipo={t.tipo} />
                  <div className="extrato-desc">
                    <p className={extra ? 'extrato-titulo-quebra' : undefined}>{descricao(t)}</p>
                    {extra && <p className="extrato-detalhe">{extra}</p>}
                    <p className="numeros extrato-meta">
                      {HORA.format(new Date(t.criadoEm))}{' '}
                      <span className="extrato-meta-saldo">
                        <span className="extrato-meta-sep" aria-hidden>
                          ·{' '}
                        </span>
                        saldo {moedas(t.saldoAposX100)}
                      </span>
                    </p>
                  </div>
                  <span className="extrato-valor numeros" data-sinal={mais ? 'mais' : 'menos'}>
                    {mais ? '+' : '−'}
                    {moedas(Math.abs(t.valorX100))}
                    <Moeda />
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function TelaExtrato() {
  const { data: estado } = useEstado();
  const q = useInfiniteQuery({
    queryKey: ['extrato'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      (await chamar<ListaTransacoes>('GET', `/transactions?limit=25${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`)).data,
    getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined,
  });
  const itens = q.data?.pages.flatMap((p) => p.itens) ?? [];
  const saldo = estado?.player.moedasX100 ?? itens[0]?.saldoAposX100 ?? null;

  return (
    <div className="tela">
      <div className="tela-cabeca">
        <Link href="/ajustes" className="botao botao-icone botao-secundario tela-cabeca-voltar" aria-label="Voltar">
          <ChevronLeft strokeWidth={3} />
        </Link>
        <h1 className="titulo-tela">Extrato de moedas</h1>
      </div>
      <CartaoSaldo saldoX100={saldo} />
      <div className="extrato-sacar">
        <BotaoSaque />
        <p className="extrato-taxa">Taxa de R$ {moedas(CONFIG.saque.taxaFixaX100)} + {CONFIG.saque.taxaPercentualBp / 100}% em cima do valor. Nos 3 primeiros dias, só o bônus do cadastro sai na hora; o rendimento das galinhas entra 24 h depois de virar moeda.</p>
      </div>
      <ListaExtrato itens={itens} carregando={q.isLoading} />
      {q.hasNextPage && (
        <div className="mt-5 text-center">
          <button type="button" className="botao botao-secundario" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {q.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
          </button>
        </div>
      )}
    </div>
  );
}

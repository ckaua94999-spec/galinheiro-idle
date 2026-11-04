'use client';

// Ofertas do Intercâmbio em grade de cartões (pergaminho com a janelinha da arte, nome, quanto vale e o botão de
// troca azul com o preço em tickets — o mesmo idioma do "Girar" e do "Ampliar"). Sem tickets suficientes o botão
// fica cinza e diz quanto falta, com a "poupança" rosa preenchendo por trás; sem ninho livre, o animal diz
// "Sem ninho livre". A troca passa por uma confirmação curta (modal com a arte, o que entra e o saldo depois).
import { ANIMAIS, NOME_RARIDADE, NOME_TIPO } from '@galinheiro/game-core';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { Moeda } from '../arte/Icones';
import { Modal } from '../componentes/Modal';
import { entradaDeLista } from '../movimento';
import { moedas } from '../util';
import { ArteOferta } from './ArteOferta';
import { IconeTicket } from './IconeTicket';
import { entregaDaOferta, nomeOferta, numeroTickets, tickets as textoTickets, valorDaOfertaX100, type OfertaTela } from './texto';

export type Bloqueio = 'tickets' | 'ninho';

interface PropsCartao {
  of: OfertaTela;
  indice: number;
  saldo: number;
  semNinho: boolean;
  /** esta oferta está sendo trocada agora */
  trocando: boolean;
  aoTrocar: (of: OfertaTela, arte: HTMLElement | null) => void;
  aoBloqueado: (of: OfertaTela, motivo: Bloqueio) => void;
}

/** Selo de preço com o ticket (dentro do botão). */
function Preco({ n }: { n: number }) {
  return (
    <span className="botao-preco troca-preco">
      <IconeTicket className="troca-preco-icone" />
      {numeroTickets(n)}
    </span>
  );
}

export function CartaoOferta({ of, indice, saldo, semNinho, trocando, aoTrocar, aoBloqueado }: PropsCartao) {
  const idNome = useId();
  const arte = useRef<HTMLDivElement>(null);
  const custo = of.o.custoTickets;
  const falta = Math.max(0, custo - saldo);
  const bloqueio: Bloqueio | null = of.tipo === 'animal' && semNinho ? 'ninho' : falta > 0 ? 'tickets' : null;
  const nome = nomeOferta(of);
  const valor = valorDaOfertaX100(of);
  const raridade = of.tipo === 'animal' ? ANIMAIS[of.especie].raridade : undefined;

  const rotulo =
    bloqueio === 'ninho'
      ? `${nome}: sem ninho livre no galinheiro`
      : bloqueio === 'tickets'
        ? `${nome}: faltam ${textoTickets(falta)} (custa ${textoTickets(custo)})`
        : `Trocar ${textoTickets(custo)} por ${entregaDaOferta(of)}`;

  return (
    <motion.article className="painel troca" data-tipo={of.tipo} data-raridade={raridade} aria-labelledby={idNome} {...entradaDeLista(indice)}>
      <div ref={arte} className="troca-arte-caixa">
        <ArteOferta of={of} indice={indice} />
        {/* selo da raridade pendurado no canto de cima do cartão (como o selo das cartas): não cobre a cabeça */}
        {raridade && (
          <span className="pilula troca-raridade" data-raridade={raridade} aria-hidden>
            {NOME_RARIDADE[raridade]}
          </span>
        )}
      </div>
      <div className="troca-texto">
        <h3 id={idNome} className="troca-nome">
          {nome}
          {raridade && <span className="sr-only">, {NOME_RARIDADE[raridade]}</span>}
        </h3>
        <p className="troca-sub numeros">
          {of.tipo === 'ovos' ? 'Valem' : 'Ovo vale'} {moedas(valor)}
          <Moeda className="troca-sub-moeda" />
          <span className="sr-only">moedas do jogo{of.tipo === 'ovos' ? ' na venda' : ''}</span>
        </p>
      </div>
      <button
        type="button"
        className="botao botao-compra botao-p troca-botao"
        aria-disabled={bloqueio ? true : undefined}
        aria-busy={trocando || undefined}
        data-pressionado={trocando ? '' : undefined}
        data-bloqueio={bloqueio ?? undefined}
        aria-label={rotulo}
        onClick={() => (bloqueio ? aoBloqueado(of, bloqueio) : aoTrocar(of, arte.current))}
      >
        {trocando ? (
          'Trocando…'
        ) : bloqueio === 'ninho' ? (
          <span className="troca-botao-texto">Sem ninho livre</span>
        ) : bloqueio === 'tickets' ? (
          <>
            {/* poupança: o quanto já tem do preço, em rosa, por trás do rótulo */}
            {saldo > 0 && <span className="troca-poupanca" style={{ ['--p' as string]: Math.min(100, (saldo / custo) * 100) }} aria-hidden />}
            <span className="troca-botao-texto">Faltam</span>
            <Preco n={falta} />
          </>
        ) : (
          <>
            <span className="troca-botao-texto">Trocar</span>
            <Preco n={custo} />
          </>
        )}
      </button>
    </motion.article>
  );
}

/** Seção com placa de madeira e a grade de cartões. */
export function SecaoOfertas({ id, titulo, icone, aviso, children }: { id: string; titulo: string; icone: ReactNode; aviso?: ReactNode; children: ReactNode }) {
  return (
    <section className="intercambio-secao" aria-labelledby={id}>
      <h2 id={id} className="placa-secao">
        {icone}
        {titulo}
      </h2>
      {aviso}
      <div className="troca-grade">{children}</div>
    </section>
  );
}

/** O último valor não nulo: o modal continua mostrando o conteúdo enquanto anima a saída. */
export function useUltimo<T>(valor: T | null): T | null {
  const [ultimo, setUltimo] = useState(valor);
  // guardar informação do render anterior (padrão do React: setState durante o render, sem efeito)
  if (valor !== null && valor !== ultimo) setUltimo(valor);
  return valor ?? ultimo;
}

/** Confirmação curta antes de trocar: a arte, "5 tickets → 1 galinha", para onde vai e o saldo depois. */
export function ModalConfirmarTroca({
  of: pedido,
  saldo,
  aoConfirmar,
  aoFechar,
}: {
  of: OfertaTela | null;
  saldo: number;
  aoConfirmar: () => void;
  aoFechar: () => void;
}) {
  const of = useUltimo(pedido);
  const custo = of?.o.custoTickets ?? 0;
  return (
    <Modal
      aberto={!!pedido}
      aoFechar={aoFechar}
      titulo="Confirmar troca"
      variante="azul"
      rodape={
        <div className="troca-confirma-botoes">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Agora não
          </button>
          <button type="button" className="botao botao-compra" onClick={aoConfirmar} data-autofoco>
            Trocar
            <Preco n={custo} />
          </button>
        </div>
      }
    >
      {of && (
        <div className="troca-confirma">
          <div className="troca-confirma-par" aria-hidden>
            <span className="troca-confirma-custo">
              <IconeTicket className="troca-confirma-ticket" />
              <span className="texto-contorno numeros">{numeroTickets(custo)}</span>
            </span>
            <ArrowRight className="troca-confirma-seta" strokeWidth={3.4} />
            <ArteOferta of={of} pequena className="troca-confirma-arte" />
          </div>
          <p className="troca-confirma-texto">
            Trocar <b>{textoTickets(custo)}</b> por <b>{of.tipo === 'ovos' ? entregaDaOferta(of) : `1 ${NOME_TIPO[of.especie]}`}</b>?
          </p>
          <p className="troca-confirma-destino">
            {of.tipo === 'ovos' ? 'Os ovos vão direto para o seu estoque.' : 'O animal vai para um ninho livre do seu galinheiro.'}
          </p>
          <p className="troca-confirma-saldo numeros">
            <IconeTicket className="troca-confirma-saldo-icone" />
            <span>
              Seu saldo: {numeroTickets(saldo)} → <b>{textoTickets(Math.max(0, saldo - custo))}</b>
            </span>
          </p>
        </div>
      )}
    </Modal>
  );
}

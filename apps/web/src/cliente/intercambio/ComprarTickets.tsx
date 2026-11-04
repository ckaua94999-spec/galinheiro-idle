'use client';

// "Comprar tickets" (só quando a equipe liga a compra): seletor de quantidade (− N +, atalhos 1/5/10), preço em
// MOEDAS DO JOGO (<Moeda/>), o limite do dia ("restam N hoje") e o botão azul de compra com o total. A compra
// passa por uma confirmação curta. Nada aqui fala em dinheiro: tickets se compram só com moedas do jogo.
import type { ConfigIntercambioDTO } from '@galinheiro/api-contract';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Moeda } from '../arte/Icones';
import { Modal } from '../componentes/Modal';
import { cx, moedas } from '../util';
import { IconeTicket } from './IconeTicket';
import { useUltimo } from './Ofertas';
import { numeroTickets, tickets as textoTickets } from './texto';

/** Teto do contrato por pedido (IntercambioComprarBody). */
const MAX_PEDIDO = 1000;
const ATALHOS = [1, 5, 10];

interface Props {
  config: ConfigIntercambioDTO;
  compradosHoje: number;
  moedasX100: number;
  comprando: boolean;
  /** pede a compra (o pai confirma e executa); `origem` = o botão (de onde os tickets saem voando) */
  aoComprar: (quantidade: number, origem: HTMLElement | null) => void;
}

export function ComprarTickets({ config, compradosHoje, moedasX100, comprando, aoComprar }: Props) {
  const id = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const [pedido, setPedido] = useState(1);
  const preco = config.precoTicketX100;
  const restam = config.limiteCompraDia === null ? null : Math.max(0, config.limiteCompraDia - compradosHoje);
  const maximo = Math.max(1, Math.min(MAX_PEDIDO, restam ?? MAX_PEDIDO));
  const qtd = Math.min(Math.max(1, pedido), maximo);
  const total = qtd * preco;
  const falta = Math.max(0, total - moedasX100);
  const esgotou = restam === 0;
  const mudar = (n: number) => setPedido(Math.min(Math.max(1, n), maximo));

  return (
    <section className="intercambio-secao" aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className="placa-secao">
        <span className="tile-icone" data-cor="azul" aria-hidden>
          <Moeda className="intercambio-placa-moeda" />
        </span>
        Comprar tickets
      </h2>
      <div className="painel intercambio-compra">
        <p className="intercambio-compra-preco numeros">
          Cada ticket custa
          <span className="intercambio-compra-preco-valor">
            {moedas(preco)}
            <Moeda />
          </span>
          <span>moedas do jogo</span>
        </p>

        <div className="intercambio-seletor" role="group" aria-label="Quantos tickets comprar">
          <button
            type="button"
            className="botao botao-icone botao-secundario"
            onClick={() => mudar(qtd - 1)}
            disabled={esgotou || qtd <= 1}
            aria-label="Um ticket a menos"
          >
            <Minus strokeWidth={3.4} />
          </button>
          <output className="intercambio-seletor-valor" aria-live="polite" aria-label={textoTickets(qtd)}>
            <IconeTicket className="intercambio-seletor-icone" />
            <span className="texto-contorno numeros">{numeroTickets(esgotou ? 0 : qtd)}</span>
          </output>
          <button
            type="button"
            className="botao botao-icone botao-secundario"
            onClick={() => mudar(qtd + 1)}
            disabled={esgotou || qtd >= maximo}
            aria-label="Um ticket a mais"
          >
            <Plus strokeWidth={3.4} />
          </button>
        </div>
        <div className="intercambio-atalhos" role="group" aria-label="Atalhos de quantidade">
          {ATALHOS.map((n) => (
            <button
              key={n}
              type="button"
              className={cx('intercambio-atalho numeros', qtd === n && !esgotou && 'intercambio-atalho-ativo')}
              aria-pressed={qtd === n && !esgotou}
              onClick={() => mudar(n)}
              disabled={esgotou || n > maximo}
            >
              {n}
            </button>
          ))}
        </div>

        {restam !== null && config.limiteCompraDia !== null && (
          <div className="intercambio-limite">
            <p className="intercambio-limite-linha numeros">
              <span>{esgotou ? 'Limite de hoje atingido' : `Restam ${numeroTickets(restam)} hoje`}</span>
              <span>
                {numeroTickets(Math.min(compradosHoje, config.limiteCompraDia))} / {numeroTickets(config.limiteCompraDia)}
              </span>
            </p>
            <div
              className="barra"
              data-cor="azul"
              role="progressbar"
              aria-label="Tickets comprados hoje em relação ao limite do dia"
              aria-valuemin={0}
              aria-valuemax={config.limiteCompraDia}
              aria-valuenow={Math.min(compradosHoje, config.limiteCompraDia)}
            >
              <span
                className="barra-preenchimento"
                data-anima
                style={{ ['--p' as string]: Math.min(100, (compradosHoje / Math.max(1, config.limiteCompraDia)) * 100) }}
              />
            </div>
          </div>
        )}

        <button
          ref={botao}
          type="button"
          className="botao botao-compra botao-g intercambio-compra-botao"
          disabled={esgotou || falta > 0}
          aria-busy={comprando || undefined}
          data-pressionado={comprando ? '' : undefined}
          onClick={() => {
            if (!comprando) aoComprar(qtd, botao.current);
          }}
        >
          {esgotou ? (
            'Volte amanhã'
          ) : falta > 0 ? (
            <>
              Faltam
              <span className="botao-preco">
                {moedas(falta)}
                <Moeda className="intercambio-compra-moeda" />
              </span>
            </>
          ) : comprando ? (
            'Comprando…'
          ) : (
            <>
              Comprar
              <span className="sr-only">{textoTickets(qtd)} por</span>
              <span className="botao-preco">
                {moedas(total)}
                <Moeda className="intercambio-compra-moeda" />
              </span>
            </>
          )}
        </button>
      </div>
    </section>
  );
}

/** Confirmação curta da compra (sempre em moedas do jogo). */
export function ModalConfirmarCompra({
  quantidade,
  precoX100,
  aoConfirmar,
  aoFechar,
}: {
  quantidade: number | null;
  precoX100: number;
  aoConfirmar: () => void;
  aoFechar: () => void;
}) {
  const q = useUltimo(quantidade) ?? 0;
  return (
    <Modal
      aberto={quantidade !== null}
      aoFechar={aoFechar}
      titulo="Comprar tickets"
      variante="azul"
      rodape={
        <div className="troca-confirma-botoes">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Agora não
          </button>
          <button type="button" className="botao botao-compra" onClick={aoConfirmar} data-autofoco>
            Comprar
          </button>
        </div>
      }
    >
      <div className="troca-confirma">
        <div className="troca-confirma-par" aria-hidden>
          <span className="troca-confirma-custo troca-confirma-moedas">
            <Moeda className="troca-confirma-ticket" />
            <span className="texto-contorno numeros">{moedas(q * precoX100)}</span>
          </span>
          <ArrowRight className="troca-confirma-seta" strokeWidth={3.4} />
          <span className="troca-confirma-custo">
            <IconeTicket className="troca-confirma-ticket" />
            <span className="texto-contorno numeros">{numeroTickets(q)}</span>
          </span>
        </div>
        <p className="troca-confirma-texto">
          Comprar <b>{textoTickets(q)}</b> por <b>{moedas(q * precoX100)} moedas do jogo</b>?
        </p>
        <p className="troca-confirma-destino">Os tickets entram na hora no seu saldo do Intercâmbio.</p>
      </div>
    </Modal>
  );
}

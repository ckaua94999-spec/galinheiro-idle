'use client';

// Histórico dos tickets (os últimos 20 movimentos que o servidor manda): azulejo por tipo (compra com moedas,
// cupom, troca por ovos ou animal, presente da equipe), quando e o saldo depois, e o +N/−N contornado em verde
// ou vermelho com o ticket. Abre 5 linhas; o resto fica atrás de "Ver todos".
import type { MovimentoTicketDTO } from '@galinheiro/api-contract';
import { ANIMAIS } from '@galinheiro/game-core';
import { ChevronDown, Gift, History, Wrench } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { FiguraAnimal } from '../arte/Animal';
import { Moeda, Ovo } from '../arte/Icones';
import { Juca } from '../arte/Juca';
import { quando } from '../convites/texto';
import { entradaDeLista } from '../movimento';
import { IconeTicket } from './IconeTicket';
import { descreverMovimento, numeroTickets, type MovimentoTela } from './texto';

const LINHAS_INICIAIS = 5;
const COR_RARIDADE_TILE = { comum: 'cinza', raro: 'azul', epico: 'roxo', lendario: 'ouro' } as const;

function IconeMovimento({ mv }: { mv: MovimentoTela }) {
  const lucide = (Icone: typeof Gift) => (
    <span className="icone-contorno">
      <Icone />
      <Icone />
    </span>
  );
  switch (mv.tipo) {
    case 'compra':
      return (
        <span className="tile-icone" data-cor="azul" aria-hidden>
          <Moeda />
        </span>
      );
    case 'cupom':
      return (
        <span className="tile-icone" data-cor="creme" aria-hidden>
          <IconeTicket />
        </span>
      );
    case 'troca-ovos':
      return (
        <span className="tile-icone intercambio-tile-ovo" data-cor="verde" aria-hidden>
          {mv.especie ? <Ovo tipo={mv.especie} /> : lucide(History)}
        </span>
      );
    case 'troca-animal':
      return (
        <span className="tile-icone intercambio-tile-animal" data-cor={mv.especie ? COR_RARIDADE_TILE[ANIMAIS[mv.especie].raridade] : 'cinza'} aria-hidden>
          {mv.especie && <FiguraAnimal tipo={mv.especie} ninho={false} detalhe="p" />}
        </span>
      );
    case 'presente':
      return (
        <span className="tile-icone" data-cor="rosa" aria-hidden>
          {lucide(Gift)}
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

export function HistoricoTickets({ historico }: { historico: MovimentoTicketDTO[] }) {
  const [aberto, setAberto] = useState(false);
  const sobra = historico.length - LINHAS_INICIAIS;
  const visiveis = aberto || sobra <= 0 ? historico : historico.slice(0, LINHAS_INICIAIS);

  return (
    <section className="intercambio-secao" aria-labelledby="intercambio-historico">
      <h2 id="intercambio-historico" className="placa-secao">
        <span className="tile-icone" data-cor="roxo" aria-hidden>
          <span className="icone-contorno">
            <History />
            <History />
          </span>
        </span>
        Histórico
      </h2>
      {historico.length === 0 ? (
        <div className="painel intercambio-vazio">
          <Juca expressao="piscando" sombra={false} parado className="intercambio-vazio-juca" />
          <div className="min-w-0">
            <p className="intercambio-vazio-titulo">Nenhum ticket ainda</p>
            <p className="intercambio-vazio-texto">Resgate um cupom da equipe para ganhar os primeiros. Tudo o que entra e sai aparece aqui.</p>
          </div>
        </div>
      ) : (
        <ul className="painel lista-painel intercambio-historico" aria-label="Últimas movimentações de tickets">
          {visiveis.map((m, i) => {
            const mv = descreverMovimento(m);
            const mais = m.delta > 0;
            return (
              <motion.li key={m.id} className="intercambio-mov" {...entradaDeLista(i % LINHAS_INICIAIS)}>
                <IconeMovimento mv={mv} />
                <div className="intercambio-mov-texto">
                  <p className="intercambio-mov-titulo">{mv.titulo}</p>
                  <p className="intercambio-mov-meta numeros">
                    <time dateTime={m.criadoEm}>{quando(m.criadoEm)}</time>{' '}
                    <span className="intercambio-mov-saldo">
                      <span className="intercambio-mov-sep" aria-hidden>
                        ·{' '}
                      </span>
                      saldo {numeroTickets(m.saldoApos)}
                    </span>
                  </p>
                </div>
                <span className="extrato-valor numeros intercambio-mov-valor" data-sinal={mais ? 'mais' : 'menos'}>
                  {mais ? '+' : '−'}
                  {numeroTickets(Math.abs(m.delta))}
                  <IconeTicket />
                  <span className="sr-only"> {Math.abs(m.delta) === 1 ? 'ticket' : 'tickets'}</span>
                </span>
              </motion.li>
            );
          })}
          {sobra > 0 && (
            <li className="intercambio-ver-mais-linha">
              <button type="button" className="intercambio-ver-mais" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
                {aberto ? 'Mostrar menos' : `Ver todos (${historico.length})`}
                <ChevronDown className="intercambio-ver-mais-seta" strokeWidth={3} aria-hidden />
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

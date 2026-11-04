'use client';

// Cartão "Intercâmbio" da Loja (o ponto de entrada da tela /intercambio; o outro é "Resgatar cupom" nos Ajustes).
// Mesma família do cartão de convites (faixa de pergaminho clicável que afunda no toque, janelinha ilustrada,
// título, frase e a seta laranja), com a janelinha rosa do ticket e o saldo de tickets num selo — o saldo vem do
// estado do jogo (player.tickets). Selo "NOVO" até a primeira visita. Usa a mesma consulta da tela
// (CHAVE_INTERCAMBIO): quem passa pela Loja já deixa o Intercâmbio pronto no cache.
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useEstado } from '../estado';
import { useIntercambio } from './consultas';
import { IconeIntercambio, IconeTicket } from './IconeTicket';
import { tickets } from './texto';
import { jaViuIntercambio } from './visto';

export function CartaoIntercambio() {
  const { data: estado } = useEstado();
  const { data } = useIntercambio();
  const [novo, setNovo] = useState(false);
  useEffect(() => setNovo(!jaViuIntercambio()), []);

  const saldo = estado?.player.tickets ?? data?.tickets ?? 0;
  const fechado = !!data && !data.config.ativo;

  return (
    <Link href="/intercambio" className="painel intercambio-loja">
      <span className="intercambio-loja-janela" aria-hidden>
        <span className="intercambio-loja-ceu" />
        <IconeIntercambio className="intercambio-loja-icone" />
      </span>
      <span className="intercambio-loja-texto">
        <span className="intercambio-loja-titulo">Intercâmbio</span>
        <span className="intercambio-loja-desc">{fechado ? 'As trocas estão pausadas. Cupons continuam valendo.' : 'Troque tickets por ovos e animais.'}</span>
        <span className="intercambio-loja-numeros">
          <span className="intercambio-loja-chip numeros">
            <IconeTicket />
            {tickets(saldo)}
          </span>
        </span>
      </span>
      <span className="botao botao-primario botao-icone intercambio-loja-seta" aria-hidden>
        <span className="icone-contorno">
          <ChevronRight />
          <ChevronRight />
        </span>
      </span>
      {novo && (
        <span className="pilula pilula-aviso intercambio-loja-novo" aria-hidden>
          NOVO
        </span>
      )}
    </Link>
  );
}

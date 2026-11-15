'use client';

// Cartão "Rinha de galo" da Loja (entrada da tela /rinha). Mesma família dos cartões de Intercâmbio e convites:
// faixa clicável com a janelinha ilustrada (dois galos se encarando), título, frase e a seta laranja.
import { ChevronRight, Lock } from 'lucide-react';
import Link from 'next/link';
import { useEstado } from '../estado';
import { ArteGalo } from './ArteGalo';

export function CartaoRinha() {
  const { data: estado } = useEstado();
  const liberada = estado?.player.roletaLiberada ?? false;
  return (
    <Link href="/rinha" className="painel rinha-loja" aria-label={liberada ? 'Rinha de galo' : 'Rinha de galo (abre depois da roleta)'}>
      <span className="rinha-loja-janela" aria-hidden>
        <span className="rinha-loja-ceu" />
        <ArteGalo pelagem="favorito" className="rinha-loja-galo rinha-loja-galo-a" />
        <ArteGalo pelagem="rival" className="rinha-loja-galo rinha-loja-galo-b" espelhado />
      </span>
      <span className="rinha-loja-texto">
        <span className="rinha-loja-titulo">Rinha de galo</span>
        <span className="rinha-loja-desc">
          {liberada ? 'Aposte moedas do jogo no seu galo. Chances na tela antes da luta.' : 'Abre depois que você libera a roleta.'}
        </span>
      </span>
      <span className="botao botao-primario botao-icone rinha-loja-seta" aria-hidden>
        <span className="icone-contorno">
          {liberada ? (
            <>
              <ChevronRight />
              <ChevronRight />
            </>
          ) : (
            <>
              <Lock />
              <Lock />
            </>
          )}
        </span>
      </span>
    </Link>
  );
}

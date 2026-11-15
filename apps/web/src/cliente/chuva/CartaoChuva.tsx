'use client';

// Cartão "Chuva de Ovos" da Loja (entrada da tela /chuva), na mesma família do cartão da rinha.
import { CONFIG_CHUVA } from '@galinheiro/game-core';
import { ChevronRight, Lock } from 'lucide-react';
import Link from 'next/link';
import { useEstado } from '../estado';
import { SimboloChuva } from './SimboloChuva';

export function CartaoChuva() {
  const { data: estado } = useEstado();
  const liberada = estado?.player.roletaLiberada ?? false;
  return (
    <Link href="/chuva" className="painel rinha-loja chuva-loja" aria-label={liberada ? 'Chuva de Ovos' : 'Chuva de Ovos (abre depois da roleta)'}>
      <span className="rinha-loja-janela" aria-hidden>
        <span className="rinha-loja-ceu chuva-loja-ceu" />
        <span className="chuva-loja-simbolos">
          <SimboloChuva s="ovo_avestruz" />
          <SimboloChuva s="bomba" x={10} />
          <SimboloChuva s="pena_azul" />
          <SimboloChuva s="ninho" />
        </span>
      </span>
      <span className="rinha-loja-texto">
        <span className="rinha-loja-titulo">Chuva de Ovos</span>
        <span className="rinha-loja-desc">
          {liberada
            ? `Junte 8 iguais, ganhe cascatas e rodadas grátis. Volta em média ${CONFIG_CHUVA.retornoPct}%.`
            : 'Abre depois que você libera a roleta.'}
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

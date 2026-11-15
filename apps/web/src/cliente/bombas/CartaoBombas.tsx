'use client';

// Cartão "Ovos-Bomba" da Loja (entrada da tela /bombas), na mesma família dos cartões da rinha e da Chuva de Ovos.
import { CONFIG_BOMBAS } from '@galinheiro/game-core';
import { ChevronRight, Lock } from 'lucide-react';
import Link from 'next/link';
import { useEstado } from '../estado';
import { OvoBomba } from './OvoBomba';

export function CartaoBombas() {
  const { data: estado } = useEstado();
  const liberada = estado?.player.roletaLiberada ?? false;
  return (
    <Link href="/bombas" className="painel rinha-loja chuva-loja" aria-label={liberada ? 'Ovos-Bomba' : 'Ovos-Bomba (abre depois da roleta)'}>
      <span className="rinha-loja-janela" aria-hidden>
        <span className="rinha-loja-ceu bombas-loja-ceu" />
        <span className="bombas-loja-ovos">
          <OvoBomba tipo="cruz" contagem={3} />
          <OvoBomba tipo="xis" contagem={1} />
        </span>
      </span>
      <span className="rinha-loja-texto">
        <span className="rinha-loja-titulo">Ovos-Bomba</span>
        <span className="rinha-loja-desc">
          {liberada
            ? `Os rolos giram, as bombas travam, contam a cada giro e explodem nas casas vizinhas. Volta em média ${CONFIG_BOMBAS.retornoPct}%.`
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

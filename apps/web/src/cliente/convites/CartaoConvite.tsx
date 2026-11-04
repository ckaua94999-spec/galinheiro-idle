'use client';

// Cartão "Convide amigos" da Loja: o 2º ponto de entrada da tela /convites (o 1º é a linha nos Ajustes).
// Discreto: uma faixa de pergaminho com o Seu Juca acenando numa janelinha de céu, o convite numa frase e,
// quando já existe rede, os números dela (pessoas e o ganho de hoje, em moedas do jogo). Selo "NOVO" até a
// primeira visita à tela. Some com o programa pausado. Usa a mesma consulta da tela (CHAVE_CONVITES): quem
// passa pela Loja já deixa os convites prontos no cache.
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Moeda } from '../arte/Icones';
import { Juca } from '../arte/Juca';
import { moedas } from '../util';
import { useMeuConvite } from './consultas';
import { jaViuConvites } from './visto';

export function CartaoConvite() {
  const { data } = useMeuConvite();
  const [novo, setNovo] = useState(false);
  useEffect(() => setNovo(!jaViuConvites()), []);

  if (data && !data.config.ativo) return null;
  const rede = data ? data.rede.reduce((a, b) => a + b, 0) : 0;
  const hoje = data?.ganhos.hojeX100 ?? 0;

  return (
    <Link href="/convites?de=loja" className="painel convite-loja">
      <span className="convite-loja-janela" aria-hidden>
        <span className="convite-loja-ceu" />
        <Juca acenando sombra={false} className="convite-loja-juca" />
      </span>
      <span className="convite-loja-texto">
        <span className="convite-loja-titulo">Convide amigos</span>
        <span className="convite-loja-desc">
          Cada venda de ovos deles rende moedas do jogo para você.
        </span>
        {rede > 0 && (
          <span className="convite-loja-numeros">
            <span className="convite-loja-chip">
              {rede} {rede === 1 ? 'pessoa' : 'pessoas'} na rede
            </span>
            {hoje > 0 && (
              <span className="convite-loja-chip convite-loja-chip-ganho numeros">
                <Moeda />+{moedas(hoje)} hoje
              </span>
            )}
          </span>
        )}
      </span>
      <span className="botao botao-primario botao-icone convite-loja-seta" aria-hidden>
        <span className="icone-contorno">
          <ChevronRight />
          <ChevronRight />
        </span>
      </span>
      {novo && (
        <span className="pilula pilula-aviso convite-loja-novo" aria-hidden>
          NOVO
        </span>
      )}
    </Link>
  );
}

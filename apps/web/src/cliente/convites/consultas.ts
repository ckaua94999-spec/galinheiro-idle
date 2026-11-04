'use client';

// Convites no lado do jogador: GET /convites (código, link, taxas, rede, ganhos, convidados e comissões).
// A tela /convites e o cartão da Loja usam a MESMA chave: quem abre a Loja já deixa a tela pronta no cache.
// Tudo é em moedas do jogo (nada vira dinheiro).
import type { MeuConviteDTO } from '@galinheiro/api-contract';
import { useQuery } from '@tanstack/react-query';
import { chamar } from '../api';

export const CHAVE_CONVITES = ['convites'] as const;

const buscarMeuConvite = async (): Promise<MeuConviteDTO> => (await chamar<MeuConviteDTO>('GET', '/convites')).data;

/** Dados do programa de convites do membro logado (precisa de sessão: use só dentro da casca do jogo). */
export function useMeuConvite() {
  return useQuery({
    queryKey: CHAVE_CONVITES,
    queryFn: buscarMeuConvite,
    staleTime: 30_000,
    // o cliente HTTP já repete GET com espera; a tela mostra o erro com "Tentar de novo"
    retry: false,
  });
}

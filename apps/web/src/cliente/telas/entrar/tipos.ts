// Contrato das cenas da tela de entrada: a cena cuida de TODO o visual (fundo, logo, lema, elenco, animações)
// e posiciona o painel de ações e o texto legal que a TelaEntrar entrega prontos (lógica de login intocada).
import type { ReactNode } from 'react';

export type ModoEntrar = 'inicio' | 'email' | 'cadastro' | 'recuperar';

export interface PropsCena {
  /** inicio = botões "Jogar agora"/"Entrar"/"Criar conta"; email/cadastro/recuperar = formulário aberto (a cena encolhe). */
  modo: ModoEntrar;
  /** Painel de ações (já animado entre os modos). Renderize-o inteiro, sem alterar. */
  painel: ReactNode;
  /** Texto legal (Termos/Privacidade + aviso de moedas do jogo): precisa ficar visível. */
  legal: ReactNode;
}

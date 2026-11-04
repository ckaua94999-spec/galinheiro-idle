// "NOVO" no cartão de convites da Loja até o jogador abrir a tela /convites pela primeira vez neste aparelho.
// Sem localStorage (modo privado, bloqueado) o selo só não aparece: é um enfeite, nunca um estado do jogo.
const CHAVE = 'gi:convites:visto:v1';

export function jaViuConvites(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) === '1';
  } catch {
    return true;
  }
}

export function marcarConvitesVistos(): void {
  try {
    window.localStorage.setItem(CHAVE, '1');
  } catch {
    // ignora
  }
}

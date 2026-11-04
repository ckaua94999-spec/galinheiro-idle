// "NOVO" no cartão do Intercâmbio na Loja até o jogador abrir a tela /intercambio pela primeira vez neste
// aparelho. Sem localStorage (modo privado, bloqueado) o selo só não aparece: é um enfeite, nunca estado do jogo.
const CHAVE = 'gi:intercambio:visto:v1';

export function jaViuIntercambio(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) === '1';
  } catch {
    return true;
  }
}

export function marcarIntercambioVisto(): void {
  try {
    window.localStorage.setItem(CHAVE, '1');
  } catch {
    // ignora
  }
}

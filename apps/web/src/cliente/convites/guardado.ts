// Código de convite que chegou pelo link (/c/CODIGO → /entrar?convite=CODIGO), guardado no aparelho até o
// cadastro: sobrevive a recarregar e a voltar para a tela de entrada sem o link. Sem localStorage (modo
// privado, bloqueado) só não sobrevive — o cadastro continua funcionando.
import { CODIGO_CONVITE, normalizarConvite } from '@galinheiro/api-contract';

const CHAVE = 'gi:convite:v1';

/** Código no formato do convite (maiúsculas, sem espaço/traço) ou null. */
export function codigoDeConvite(bruto: string | null | undefined): string | null {
  const c = normalizarConvite(bruto ?? '');
  return CODIGO_CONVITE.test(c) ? c : null;
}

export function lerConviteGuardado(): string | null {
  try {
    return codigoDeConvite(window.localStorage.getItem(CHAVE));
  } catch {
    return null;
  }
}

export function guardarConvite(codigo: string): void {
  try {
    window.localStorage.setItem(CHAVE, codigo);
  } catch {
    // sem armazenamento: o código vale só nesta página
  }
}

export function esquecerConvite(): void {
  try {
    window.localStorage.removeItem(CHAVE);
  } catch {
    // ignora
  }
}

// Telefone brasileiro: validação, normalização (E.164) e máscara. Usado no formulário e no servidor.

/** DDDs em uso no Brasil (plano de numeração da Anatel). */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47,
  48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87,
  88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Só os dígitos do número nacional (DDD + número), sem +55 nem o 0 de longa distância. */
function digitosNacionais(texto: string): string {
  let d = texto.replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
}

/**
 * Normaliza para E.164 (+55DDNNNNNNNNN). Aceita máscara, espaços, "+55" e o "0" na frente. Celular: 9 dígitos
 * começando com 9; fixo: 8 dígitos começando com 2 a 5. Devolve null se não for um telefone brasileiro válido.
 */
export function normalizarTelefone(texto: string): string | null {
  const d = digitosNacionais(texto);
  if (d.length !== 10 && d.length !== 11) return null;
  if (!DDDS.has(Number(d.slice(0, 2)))) return null;
  const numero = d.slice(2);
  if (numero.length === 9 && numero[0] !== '9') return null;
  if (numero.length === 8 && !'2345'.includes(numero[0]!)) return null;
  return `+55${d}`;
}

/** Máscara enquanto digita: (11) 98765-4321 ou (11) 3456-7890. */
export function mascararTelefone(texto: string): string {
  const d = digitosNacionais(texto).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  const corte = d.length === 11 ? 5 : 4;
  return resto.length <= corte ? `(${ddd}) ${resto}` : `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** Exibição de um telefone já normalizado (E.164): (11) 98765-4321. */
export function formatarTelefone(e164: string): string {
  return mascararTelefone(e164);
}

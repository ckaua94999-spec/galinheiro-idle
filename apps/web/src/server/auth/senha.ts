// Hash de senha com scrypt (nativo do Node) e códigos de recuperação.
import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const PARAMS = { N: 16384, r: 8, p: 1, tamanho: 64 };

function derivar(segredo: string, sal: Buffer, N: number, r: number, p: number, tamanho: number): Promise<Buffer> {
  const opcoes: ScryptOptions = { N, r, p, maxmem: 64 * 1024 * 1024 };
  return new Promise((ok, falha) => scrypt(segredo.normalize('NFKC'), sal, tamanho, opcoes, (erro, chave) => (erro ? falha(erro) : ok(chave))));
}

export async function gerarHash(segredo: string): Promise<string> {
  const sal = randomBytes(16);
  const chave = await derivar(segredo, sal, PARAMS.N, PARAMS.r, PARAMS.p, PARAMS.tamanho);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${sal.toString('base64url')}$${chave.toString('base64url')}`;
}

export async function conferirHash(segredo: string, hash: string | null): Promise<boolean> {
  if (!hash) {
    await derivar(segredo, randomBytes(16), PARAMS.N, PARAMS.r, PARAMS.p, PARAMS.tamanho); // tempo constante
    return false;
  }
  const partes = hash.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, N, r, p, salB64, chaveB64] = partes as [string, string, string, string, string, string];
  const esperada = Buffer.from(chaveB64, 'base64url');
  const obtida = await derivar(segredo, Buffer.from(salB64, 'base64url'), Number(N), Number(r), Number(p), esperada.length);
  return obtida.length === esperada.length && timingSafeEqual(obtida, esperada);
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0 e I/1 para evitar confusão

/** Código de recuperação no formato XXXX-XXXX-XXXX. */
export function gerarCodigoRecuperacao(): string {
  const blocos = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => ALFABETO[randomInt(0, ALFABETO.length)]).join(''));
  return blocos.join('-');
}

export const normalizarCodigo = (codigo: string): string => codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');

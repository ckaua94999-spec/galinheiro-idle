// Segredos locais de desenvolvimento, gerados uma vez e guardados em .data/ (fora do controle de versão).
// Em produção os valores DEVEM vir das variáveis de ambiente.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dirDados = (): string => path.join(process.cwd(), '.data');

export function lerOuCriarArquivoLocal<T>(nome: string, criar: () => T): T {
  const arquivo = path.join(dirDados(), nome);
  if (existsSync(arquivo)) return JSON.parse(readFileSync(arquivo, 'utf8')) as T;
  mkdirSync(dirDados(), { recursive: true });
  const valor = criar();
  writeFileSync(arquivo, JSON.stringify(valor, null, 2), { encoding: 'utf8', mode: 0o600 });
  return valor;
}

let segredoCache: Uint8Array | null = null;

export function segredoSessao(): Uint8Array {
  if (segredoCache) return segredoCache;
  const env = process.env.AUTH_SECRET;
  if (env && env.length >= 32) {
    segredoCache = new TextEncoder().encode(env);
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET é obrigatório em produção (32 ou mais caracteres aleatórios).');
  } else {
    const { segredo } = lerOuCriarArquivoLocal('auth.json', () => ({ segredo: randomBytes(48).toString('base64url') }));
    segredoCache = new TextEncoder().encode(segredo);
  }
  return segredoCache;
}

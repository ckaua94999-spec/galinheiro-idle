// Gera o hash da senha do painel administrador para a variável ADMIN_SENHA_HASH (mesmo scrypt do servidor).
// Uso (em apps/web):  pnpm senha-admin            → pergunta a senha
//                     echo "minha senha" | pnpm senha-admin
// O hash sai com ":" no lugar de "$", porque os arquivos .env expandiriam "$16384…" como variável.
import { randomBytes, scrypt } from 'node:crypto';
import { createInterface } from 'node:readline';

const PARAMS = { N: 16384, r: 8, p: 1, tamanho: 64 };

async function lerSenha() {
  const rl = createInterface({ input: process.stdin, output: process.stdin.isTTY ? process.stdout : undefined, terminal: false });
  if (process.stdin.isTTY) process.stdout.write('Senha do painel: ');
  for await (const linha of rl) {
    rl.close();
    return linha;
  }
  return '';
}

const senha = (await lerSenha()).replace(/\r$/, '');
if (senha.length < 8) {
  console.error('Use uma senha com pelo menos 8 caracteres.');
  process.exit(1);
}
const sal = randomBytes(16);
const chave = await new Promise((ok, falha) =>
  scrypt(senha.normalize('NFKC'), sal, PARAMS.tamanho, { N: PARAMS.N, r: PARAMS.r, p: PARAMS.p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? falha(e) : ok(k))),
);
console.log(`ADMIN_SENHA_HASH=scrypt:${PARAMS.N}:${PARAMS.r}:${PARAMS.p}:${sal.toString('base64url')}:${chave.toString('base64url')}`);

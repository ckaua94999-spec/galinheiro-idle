// Sobe o build de produção localmente para testar o PWA (service worker, instalação, modo offline, push).
// Usa um banco PGlite separado do de desenvolvimento e segredos locais guardados em .data/.
// Uso: pnpm build && pnpm start:local   (porta 3100; PORT=xxxx para trocar)
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dados = path.join(raiz, '.data');
mkdirSync(dados, { recursive: true });

function lerOuCriar(nome, criar) {
  const arquivo = path.join(dados, nome);
  if (existsSync(arquivo)) return JSON.parse(readFileSync(arquivo, 'utf8'));
  const valor = criar();
  writeFileSync(arquivo, JSON.stringify(valor, null, 2), { encoding: 'utf8', mode: 0o600 });
  return valor;
}

if (!existsSync(path.join(raiz, '.next', 'BUILD_ID'))) {
  console.error('Nenhum build encontrado. Rode "pnpm build" antes.');
  process.exit(1);
}

const { segredo } = lerOuCriar('auth-producao-local.json', () => ({ segredo: randomBytes(48).toString('base64url') }));
const env = {
  ...process.env,
  AUTH_SECRET: process.env.AUTH_SECRET ?? segredo,
  PGLITE_DIR: process.env.PGLITE_DIR ?? path.join(dados, 'pglite-producao'),
};
// Reaproveita as chaves VAPID de desenvolvimento, se existirem, para o push funcionar localmente.
const vapid = path.join(dados, 'vapid.json');
if (!env.VAPID_PUBLIC_KEY && existsSync(vapid)) {
  const chaves = JSON.parse(readFileSync(vapid, 'utf8'));
  env.VAPID_PUBLIC_KEY = chaves.publicKey;
  env.VAPID_PRIVATE_KEY = chaves.privateKey;
}

const porta = process.env.PORT ?? '3100';
const next = createRequire(import.meta.url).resolve('next/dist/bin/next');

let filhoAtual = null;
let encerrando = false;
let quedasSeguidas = 0;

function subir() {
  const filho = spawn(process.execPath, [next, 'start', '--port', porta], { cwd: raiz, env, stdio: 'inherit' });
  filhoAtual = filho;
  const iniciado = Date.now();
  let falhas = 0;
  const vigia = setInterval(async () => {
    if (Date.now() - iniciado < 20_000) return;
    let ok = false;
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/api/v1/health`, { signal: AbortSignal.timeout(4_000) });
      ok = resposta.ok;
    } catch {
      ok = false;
    }
    if (ok) {
      falhas = 0;
      return;
    }
    falhas += 1;
    if (falhas < 2) return;
    console.error('[watchdog] o health não respondeu. Reiniciando o servidor.');
    falhas = 0;
    filho.kill();
  }, 20_000);
  vigia.unref?.();

  filho.on('exit', (codigo) => {
    clearInterval(vigia);
    if (filhoAtual === filho) filhoAtual = null;
    if (encerrando) {
      process.exit(codigo ?? 0);
      return;
    }
    if (Date.now() - iniciado < 15_000) {
      quedasSeguidas += 1;
      if (quedasSeguidas >= 5) {
        console.error('[watchdog] o servidor caiu 5 vezes seguidas. Parando.');
        process.exit(codigo ?? 1);
      }
    } else {
      quedasSeguidas = 0;
    }
    console.error(`[watchdog] processo encerrou (${codigo ?? 0}). Subindo de novo.`);
    setTimeout(subir, 1_000);
  });
}

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => {
    encerrando = true;
    filhoAtual?.kill();
  });
}

subir();

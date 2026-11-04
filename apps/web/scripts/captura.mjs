// Captura de tela headless do app via Chrome DevTools Protocol (revisão visual sem abrir o navegador).
//
// Uso: node scripts/captura.mjs <caminho-ou-url> <saida.png> [opções]
//   --largura 390        largura da tela em px CSS (padrão 390, celular)
//   --altura 844         altura da tela (padrão 844)
//   --escala 2           densidade de pixels (padrão 2)
//   --espera 2500        ms de espera depois do carregamento (padrão 2500)
//   --js "<código>"      JavaScript executado na página depois da espera (pode usar await; o valor de `return`
//                        é impresso — console.log da página não aparece)
//   --depois 600         ms de espera depois do --js (padrão 600)
//   --inteira            captura a página inteira (não só a tela)
//   --quadros 6          tira N fotos seguidas (saida-1.png, saida-2.png…) para ver uma animação
//   --intervalo 150      ms entre os quadros (padrão 150)
//   --desktop            sem emulação de celular (largura padrão 1280×800)
//
// Exemplos (rodar em apps/web, com o servidor de desenvolvimento ligado em http://localhost:3000):
//   node scripts/captura.mjs dev/galeria/animais C:/tmp/a.png --inteira
//   node scripts/captura.mjs "dev/demo?para=/loja" C:/tmp/loja.png
//   node scripts/captura.mjs "dev/demo?para=/galinheiro" C:/tmp/col.png --js "document.querySelector('[data-slot=\"2\"]').click()" --quadros 8
// "dev/demo?para=<rota>" entra na conta demo (só desenvolvimento) e abre a rota pedida.
// Erros do console e exceções da página são impressos no fim.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const posicionais = [];
const op = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const chave = a.slice(2);
    const prox = args[i + 1];
    if (prox === undefined || prox.startsWith('--')) op[chave] = true;
    else {
      op[chave] = prox;
      i++;
    }
  } else posicionais.push(a);
}
const [alvo, saida] = posicionais;
if (!alvo || !saida) {
  console.error('Uso: node scripts/captura.mjs <caminho-ou-url> <saida.png> [--largura N] [--altura N] [--escala N] [--espera ms] [--js código] [--depois ms] [--inteira] [--quadros N] [--intervalo ms] [--desktop]');
  process.exit(1);
}
const desktop = !!op.desktop;
const largura = Number(op.largura ?? (desktop ? 1280 : 390));
const altura = Number(op.altura ?? (desktop ? 800 : 844));
const escala = Number(op.escala ?? (desktop ? 1 : 2));
const espera = Number(op.espera ?? 2500);
const depois = Number(op.depois ?? 600);
const quadros = Math.max(1, Number(op.quadros ?? 1));
const intervalo = Number(op.intervalo ?? 150);

const candidatos = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const navegador = candidatos.find((c) => existsSync(c));
if (!navegador) {
  console.error('Chrome/Edge não encontrado. Defina CHROME=<caminho do executável>.');
  process.exit(1);
}
// O Git Bash (MSYS) troca "/dev/x" por "C:/Program Files/Git/dev/x": desfaz isso. Também aceita "dev/x".
const caminho = alvo.replace(/^[A-Za-z]:[\\/].*?[\\/]Git[\\/]/i, '/').replace(/^(?!\/)/, '/');
const url = /^https?:/.test(alvo) ? alvo : `${process.env.BASE_URL ?? 'http://localhost:3000'}${caminho}`;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const perfil = mkdtempSync(path.join(os.tmpdir(), 'gi-captura-'));
const chrome = spawn(
  navegador,
  [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${perfil}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--mute-audio',
    '--hide-scrollbars',
    '--disable-gpu',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const erros = [];
let ws;
async function principal() {
  // Porta do DevTools: o Chrome escreve em <perfil>/DevToolsActivePort.
  const arquivoPorta = path.join(perfil, 'DevToolsActivePort');
  for (let i = 0; i < 200 && !existsSync(arquivoPorta); i++) await dormir(100);
  if (!existsSync(arquivoPorta)) throw new Error('O Chrome não abriu o DevTools a tempo.');
  await dormir(100);
  const [porta, caminhoWs] = readFileSync(arquivoPorta, 'utf8').trim().split(/\r?\n/);

  ws = new WebSocket(`ws://127.0.0.1:${porta}${caminhoWs}`);
  await new Promise((ok, falha) => {
    ws.onopen = ok;
    ws.onerror = () => falha(new Error('Falha ao conectar no DevTools.'));
  });
  let seq = 0;
  const pendentes = new Map();
  const ouvintes = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (msg.id && pendentes.has(msg.id)) {
      const { ok, falha } = pendentes.get(msg.id);
      pendentes.delete(msg.id);
      if (msg.error) falha(new Error(`${msg.error.message} ${msg.error.data ?? ''}`));
      else ok(msg.result);
    } else if (msg.method) {
      for (const o of ouvintes) o(msg);
    }
  };
  const enviar = (method, params = {}, sessionId) =>
    new Promise((ok, falha) => {
      const id = ++seq;
      pendentes.set(id, { ok, falha });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });

  const { targetId } = await enviar('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await enviar('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => enviar(m, p, sessionId);

  ouvintes.push((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      erros.push(`exceção: ${d.exception?.description ?? d.text}`);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
      erros.push(`console.${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 4000)}`);
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      erros.push(`log: ${msg.params.entry.text} ${msg.params.entry.url ?? ''}`.slice(0, 4000));
    }
  });
  await s('Page.enable');
  await s('Runtime.enable');
  await s('Log.enable');
  await s('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: escala, mobile: !desktop });
  if (!desktop) await s('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  const carregou = new Promise((ok) => ouvintes.push((m) => m.sessionId === sessionId && m.method === 'Page.loadEventFired' && ok()));
  await s('Page.navigate', { url });
  // (timer com unref: não segura o processo depois que a página carregou)
  await Promise.race([carregou, new Promise((r) => setTimeout(r, 30_000).unref())]);
  await dormir(espera);
  // Espera a página assentar: documento completo e sem o indicador "Compiling" do Next (compilação sob demanda),
  // para o --js não rodar antes da hidratação (gerava avisos falsos de hidratação).
  for (let i = 0; i < 60; i++) {
    const r = await s('Runtime.evaluate', {
      expression: "document.readyState === 'complete' && !/Compiling|Rendering/.test(document.querySelector('nextjs-portal')?.shadowRoot?.textContent ?? '')",
      returnByValue: true,
    });
    if (r.result?.value) break;
    await dormir(250);
  }

  if (typeof op.js === 'string') {
    const r = await s('Runtime.evaluate', { expression: `(async () => { ${op.js} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) erros.push(`--js falhou: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    else if (r.result?.value !== undefined) console.log('--js retornou:', JSON.stringify(r.result.value).slice(0, 2000));
    await dormir(depois);
  }

  let clip;
  if (op.inteira) {
    const m = await s('Page.getLayoutMetrics');
    const tam = m.cssContentSize ?? m.contentSize;
    clip = { x: 0, y: 0, width: largura, height: Math.min(Math.ceil(tam.height), 16_000), scale: 1 };
  }
  const base = path.resolve(saida);
  const arquivos = [];
  for (let q = 1; q <= quadros; q++) {
    const { data } = await s('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) });
    const nome = quadros > 1 ? base.replace(/(\.png)?$/i, `-${q}.png`) : base;
    writeFileSync(nome, Buffer.from(data, 'base64'));
    arquivos.push(nome);
    if (q < quadros) await dormir(intervalo);
  }
  console.log(`ok (${url}, ${largura}×${altura} @${escala}x):`);
  for (const a of arquivos) console.log(`  ${a}`);
  await enviar('Browser.close').catch(() => {});
}

principal()
  .catch((e) => {
    console.error('Falha na captura:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (erros.length) {
      console.log(`\n${erros.length} erro(s)/aviso(s) na página:`);
      for (const e of erros.slice(0, 30)) console.log(`  - ${e}`);
    }
    try {
      ws?.close();
    } catch {}
    chrome.kill();
    await dormir(300);
    // No Windows o Chrome às vezes ainda segura arquivos do perfil (EBUSY); a captura já foi salva, então só avisa.
    try {
      rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch {
      console.log(`(aviso: não deu para apagar o perfil temporário ${perfil}; pode apagar depois)`);
    }
  });

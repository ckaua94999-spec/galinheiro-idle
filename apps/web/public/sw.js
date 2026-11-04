/* Galinheiro Idle — service worker (GDD 7.11)
 * - A versão vem da URL de registro (/sw.js?v=<build>): cada deploy instala um SW novo, o app mostra
 *   "Nova versão disponível" e, ao ativar, os caches da versão anterior são apagados.
 * - Instalação: pré-cacheia as telas do jogo (HTML estático, sem dados do jogador) e todos os arquivos
 *   /_next/static que elas referenciam, para o app abrir offline já no primeiro uso.
 * - Assets estáticos (/_next/static, ícones, fontes): cache primeiro (são versionados por hash).
 * - Páginas: rede primeiro; sem rede, abre a versão salva (o app usa o estado em cache, só leitura).
 * - API (/api/*) e payloads RSC: sempre rede — o servidor é a fonte da verdade.
 * - Push: mostra "Ovos prontos!" e abre o galinheiro ao tocar.
 */
const VERSAO = `gi-${new URL(self.location.href).searchParams.get('v') || 'dev'}`;
const CACHE_ESTATICO = `${VERSAO}-estatico`;
const CACHE_PAGINAS = `${VERSAO}-paginas`;
const ICONES_V = 2; // igual a ICONES_V em app/manifest.ts
const PRECACHE = ['/offline.html', `/icones/icone-192.png?v=${ICONES_V}`, `/icones/icone-512.png?v=${ICONES_V}`, `/icones/selo-96.png?v=${ICONES_V}`, '/manifest.webmanifest'];
const TELAS = ['/galinheiro', '/roleta', '/loja', '/colecao', '/ajustes', '/extrato', '/suporte', '/convites', '/intercambio', '/entrar'];
const RECURSO_ESTATICO = /\/_next\/static\/[^"'\\\s)<>]+/g;

async function guardarTela(caminho, paginas, estatico) {
  const resp = await fetch(caminho, { cache: 'no-cache' });
  if (!resp.ok || resp.redirected) return;
  const html = await resp.clone().text();
  await paginas.put(caminho, resp);
  const recursos = new Set(html.match(RECURSO_ESTATICO) || []);
  await Promise.all(
    [...recursos].map(async (r) => {
      if (!(await estatico.match(r))) await estatico.add(r).catch(() => undefined);
    }),
  );
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const [estatico, paginas] = await Promise.all([caches.open(CACHE_ESTATICO), caches.open(CACHE_PAGINAS)]);
      await Promise.all([
        ...PRECACHE.map((u) => estatico.add(u).catch(() => undefined)),
        ...TELAS.map((t) => guardarTela(t, paginas, estatico).catch(() => undefined)),
      ]);
    })(),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const atuais = [CACHE_ESTATICO, CACHE_PAGINAS];
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((n) => n.startsWith('gi-') && !atuais.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.tipo === 'PULAR_ESPERA') self.skipWaiting();
});

function ehEstatico(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icones/') ||
    /\.(?:woff2?|png|svg|ico|webmanifest|css|js)$/.test(url.pathname)
  );
}

async function cachePrimeiro(req) {
  const cache = await caches.open(CACHE_ESTATICO);
  const salvo = await cache.match(req);
  if (salvo) return salvo;
  const resp = await fetch(req);
  if (resp.ok && resp.type === 'basic') cache.put(req, resp.clone());
  return resp;
}

async function redePrimeiro(req) {
  const cache = await caches.open(CACHE_PAGINAS);
  try {
    const resp = await fetch(req);
    if (resp.ok && resp.type === 'basic') cache.put(req, resp.clone());
    return resp;
  } catch (erro) {
    const salvo = await cache.match(req);
    if (salvo) return salvo;
    throw erro;
  }
}

async function pagina(req) {
  const url = new URL(req.url);
  const paginas = await caches.open(CACHE_PAGINAS);
  try {
    const resp = await fetch(req);
    // Guarda por caminho (sem ?query); redirecionamentos (type opaqueredirect) não entram no cache.
    if (resp.ok && resp.type === 'basic') paginas.put(url.pathname, resp.clone());
    return resp;
  } catch {
    return (
      (await paginas.match(url.pathname, { ignoreVary: true })) ||
      (await paginas.match('/galinheiro', { ignoreVary: true })) ||
      (await caches.match('/offline.html')) ||
      new Response('Sem conexão', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    );
  }
}

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;
  // Payloads RSC da navegação no cliente variam com o estado do roteador: sem rede, o Next cai para a
  // navegação comum, que é atendida pelas telas em cache.
  if (url.searchParams.has('_rsc') || req.headers.get('RSC') === '1') return;
  if (ehEstatico(url)) {
    evento.respondWith(cachePrimeiro(req));
    return;
  }
  if (req.mode === 'navigate') {
    evento.respondWith(pagina(req));
    return;
  }
  evento.respondWith(redePrimeiro(req));
});

self.addEventListener('push', (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { corpo: evento.data ? evento.data.text() : '' };
  }
  evento.waitUntil(
    self.registration.showNotification(dados.titulo || 'Galinheiro Idle', {
      body: dados.corpo || 'Seus ovos estão prontos!',
      icon: `/icones/icone-192.png?v=${ICONES_V}`,
      badge: `/icones/selo-96.png?v=${ICONES_V}`,
      tag: dados.tag || 'galinheiro',
      data: { url: dados.url || '/galinheiro' },
      vibrate: [100, 50, 100],
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || '/galinheiro';
  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const janela of janelas) {
        if (new URL(janela.url).origin === self.location.origin) {
          await janela.focus();
          if ('navigate' in janela) await janela.navigate(destino).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});

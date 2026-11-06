/**
 * Service Worker do Lores Novelas (alvo web).
 *
 * Responsabilidades:
 * - manter o shell da aplicacao (HTML, chunks JS, icones) em cache, para
 *   que o app abra sem conexao;
 * - nunca interceptar o conteudo do Google Drive, que e gerenciado pela
 *   camada de cache do app (IndexedDB);
 * - nao prender o usuario numa versao antiga: o shell e revalidado em
 *   segundo plano e a versao do cache acompanha a publicacao.
 *
 * Todos os caminhos sao relativos a `BASE_PATH`, deduzida do proprio
 * endereco do Service Worker. Assim a PWA funciona tanto na raiz de um
 * dominio (`https://lores.app/`) quanto em um subpath de Pages
 * (`https://usuario.github.io/lores/`).
 *
 * A lista de precache e preenchida em tempo de build por
 * `scripts/build-web.mjs`, que substitui o marcador abaixo pela relacao
 * real de arquivos de `dist/`. Sem esse passo, o fallback cobre apenas o
 * HTML e os icones: na primeira visita o Service Worker ainda nao controla
 * a pagina, entao os chunks so entrariam no cache numa segunda visita.
 */

/* eslint-disable no-restricted-globals */

const VERSION = 'va4a7ab53b020';

/**
 * Versao da publicacao anterior. Preenchida em tempo de build.
 *
 * O cache da geracao anterior e mantido de proposito: uma pagina que ficou
 * aberta durante uma publicacao pode pedir um chunk da versao antiga depois
 * que o Service Worker novo assumiu. Como o Service Worker novo assume
 * imediatamente (skipWaiting), sem essa janela de duas geracoes o usuario
 * veria a rota falhar. O cache da geracao anterior e removido na
 * publicacao seguinte, o que mantem o uso de disco limitado a duas geracoes.
 */
const PREVIOUS_VERSION = 'v740db8066a51';

const CACHE_NAME = `lores-novelas-${VERSION}`;
const PREVIOUS_CACHE_NAME = PREVIOUS_VERSION ? `lores-novelas-${PREVIOUS_VERSION}` : null;

/** Prefixo do app no servidor, sempre terminado em '/'. */
const BASE_PATH = new URL('./', self.location.href).pathname;

/** URL absoluta da raiz do app (ex.: `https://usuario.github.io/lores/`). */
const BASE_URL = new URL(BASE_PATH, self.location.href).href;

/** URL do shell da aplicacao (a SPA serve o mesmo HTML em toda rota). */
const SHELL_URL = BASE_PATH;

/** Hosts cujo conteudo nunca pode ser interceptado (Google Drive). */
const BYPASS_HOSTS = [
  'drive.usercontent.google.com',
  'www.googleapis.com',
  'drive.google.com',
  'lh3.googleusercontent.com',
];

/** Substituido em tempo de build pela lista real de arquivos do shell. */
const PRECACHE_URLS = [
  "_expo/static/js/web/+not-found-d101df09b4d306355cce65e4d031a996.js",
  "_expo/static/js/web/[novelId]-d519fbb451700901faecd935be74f27c.js",
  "_expo/static/js/web/__common-39acb9cc6e1fa7a163d2aa0c938301b4.js",
  "_expo/static/js/web/__expo-metro-runtime-97703ae02682710149335928b974f18d.js",
  "_expo/static/js/web/_layout-e4329f32f3241495b9cf7c7a172b1cdc.js",
  "_expo/static/js/web/_layout-ffbe4baef3c77a28125197a363071519.js",
  "_expo/static/js/web/descobrir-63860e8fe9ad2cb6f23aab5f70f29d44.js",
  "_expo/static/js/web/entry-9f035ccb9028082d708f715f8f759d0f.js",
  "_expo/static/js/web/index-b7aa16ec3b2f92fdaae7df5ccf84b84d.js",
  "favicon.ico",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "index.html",
  "manifest.json"
];

/** Converte um caminho relativo do app em URL absoluta. */
function absolute(relativePath) {
  return new URL(relativePath, BASE_URL).href;
}

/** Caminho do recurso dentro do app, sem o prefixo de base. */
function relativeToBase(pathname) {
  return pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : null;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // `addAll` falha inteiro se uma URL falhar; aqui cada item e
      // independente, para que um recurso ausente nao derrube a instalacao.
      // As falhas sao reportadas: um pre-cache silenciosamente incompleto
      // faria o app falhar ao abrir offline.
      const results = await Promise.allSettled(
        PRECACHE_URLS.map(async (relativePath) => {
          const url = relativePath === 'index.html' ? SHELL_URL : absolute(relativePath);
          const response = await fetch(url, { cache: 'reload' });
          if (!response || !response.ok) {
            throw new Error(`pre-cache falhou para ${url}: status ${response ? response.status : 'sem resposta'}`);
          }
          await cache.put(url, response);
        }),
      );
      for (const result of results) {
        if (result.status === 'rejected') {
          console.warn('[lores] pre-cache:', result.reason);
        }
      }
      // `skipWaiting` faz a nova versao assumir imediatamente, para que a
      // proxima navegacao ja sirva o shell novo. A seguranca vem da janela
      // de duas geracoes de cache (PREVIOUS_CACHE_NAME), que preserva os
      // chunks antigos que uma pagina ainda aberta possa pedir.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith('lores-novelas-') &&
              name !== CACHE_NAME &&
              name !== PREVIOUS_CACHE_NAME,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function shouldBypass(url) {
  return BYPASS_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

/**
 * Resposta usada quando nao ha rede nem shell em cache.
 */
function offlineResponse() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
      '<p style="font-family:serif;padding:2rem">Sem conexao e sem copia em cache.</p>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/**
 * Arquivos estaticos do proprio app: nomes com hash, logo sao imutaveis e
 * podem ser servidos do cache (cache-first). As fontes entram por aqui na
 * primeira visita, ja que so as variantes realmente usadas sao baixadas.
 */
async function handleStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  // Pagina que ficou aberta durante uma publicacao pode pedir um chunk da
  // versao antiga: a geracao anterior responde por ele.
  if (PREVIOUS_CACHE_NAME) {
    const previous = await caches.open(PREVIOUS_CACHE_NAME);
    const fromPrevious = await previous.match(request);
    if (fromPrevious) return fromPrevious;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    try {
      await cache.put(request, response.clone());
    } catch {
      // Recurso nao cacheavel: apenas segue sem cache.
    }
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Conteudo do Google Drive: nunca interceptado.
  if (url.origin !== self.location.origin || shouldBypass(url)) return;

  if (request.mode === 'navigate') {
    // Navegacao: stale-while-revalidate sobre o shell.
    //
    // Uma unica promessa de rede e compartilhada entre a resposta e a
    // revalidacao. Isso e obrigatorio: o Service Worker e encerrado assim
    // que a resposta assincrona termina, o que mataria a revalidacao em
    // segundo plano se ela usasse uma promessa separada. Com `waitUntil` o
    // worker permanece vivo ate a rede responder (ou falhar).
    //
    // A revalidacao busca o **shell** (`BASE_PATH`), e nao a URL pedida.
    // Em um *project page* do GitHub Pages a URL pedida (`/leitor/<id>`)
    // responde 404 — e o corpo e o shell, mas o status nao e `ok`, o que
    // faria o shell novo nunca entrar no cache. Buscando o shell, a
    // publicacao nova e detectada e o console fica limpo.
    const networkPromise = fetch(SHELL_URL, { cache: 'no-cache' })
      .then(async (response) => {
        if (response && response.ok) {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(SHELL_URL, response.clone());
          } catch {
            // cache.put pode falhar com respostas de navegacao parciais.
          }
        }
        return response;
      })
      .catch(() => null);

    // Mantem o Service Worker vivo durante a revalidacao em segundo plano.
    event.waitUntil(networkPromise.then(() => undefined));

    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(SHELL_URL);
        if (cached) return cached;

        const response = await networkPromise;
        return response ?? offlineResponse();
      })(),
    );
    return;
  }

  const relativePath = relativeToBase(url.pathname);
  if (relativePath === null) return;

  if (
    relativePath.startsWith('_expo/static/') ||
    relativePath.startsWith('assets/') ||
    relativePath.startsWith('icons/') ||
    relativePath === 'manifest.json' ||
    relativePath === 'favicon.ico'
  ) {
    event.respondWith(handleStatic(request));
  }
});

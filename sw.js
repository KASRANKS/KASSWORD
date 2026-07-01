/* Kassword Service Worker - release 2026-06-30-r18 (mainnet)
 * Lets a cold device (offline phone in airplane mode) re-open the app
 * indefinitely after one online install. Bumps CACHE_NAME on every release
 * so every existing PWA install purges old cache on next activate. */

const KW_BUILD_ID = '2026-06-30-r18';
const CACHE_NAME = 'kassword-v5-' + KW_BUILD_ID + '-mainnet';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './kw-pq.js',
  './kaspa/kaspa.js',
  './kaspa/kaspa_bg.wasm'
];

/* Pin the WASM signer + its JS glue. The app re-verifies these on every load and hard-halts on mismatch
   (the real enforcement); pinning them here too means a poisoned host can never cache a swapped signer into
   the offline PWA. Keep in lock-step with KW_INTEGRITY in index.html on every SDK bump. */
const SUBRESOURCE_INTEGRITY = {
  './kaspa/kaspa.js':      'sha384-/wAUto/tC9az48I3OdiPnnhollvE8J7uuvJwX7k4pilAnpusvvq512NuIS9Bz+S5',
  './kaspa/kaspa_bg.wasm': 'sha384-OSCmbnyP544WkYU7GHoeE0yrGO1NlW9ShaxnswxmTxI5ospQX0Gd8ksp1ioFl5zy',
  './kw-pq.js':            'sha384-khUzgjL4249wolAYxmPRLrvulip9gD0GUlAYQPgsHvbnZKfDS2lalQQMJOpq7QX3'
};
async function _sw_sha384(buf){
  const h = await crypto.subtle.digest('SHA-384', buf);
  let s=''; const b = new Uint8Array(h); for(let i=0;i<b.length;i+=0x8000){ s += String.fromCharCode.apply(null, b.subarray(i,i+0x8000)); }
  return 'sha384-' + btoa(s);
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    /* Individual puts (tolerant of optional asset gaps), but any PINNED asset that fails its hash is REFUSED
       - never cached - so the offline copy can only ever be the authentic signer. */
    for(const url of CORE_ASSETS){
      try {
        const resp = await fetch(url, {cache:'no-cache'});
        if(!resp.ok) continue;
        const pin = SUBRESOURCE_INTEGRITY[url];
        if(pin){
          const buf = await resp.clone().arrayBuffer();
          const got = await _sw_sha384(buf);
          if(got !== pin) continue;  /* tampered signer - refuse to cache it */
        }
        await cache.put(url, resp);
      } catch(_) {}
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(n => n.startsWith('kassword-') && n !== CACHE_NAME)
        .map(n => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

/* R7: report the active build/cache to the page so it can detect a stale shell (no-op otherwise). */
self.addEventListener('message', e => {
  const msg = e.data || {};
  if(!msg || msg.t !== 'kw-shell-state') return;
  const reply = { t:'kw-shell-state', buildId:KW_BUILD_ID, cacheName:CACHE_NAME };
  try {
    if(e.ports && e.ports[0]) e.ports[0].postMessage(reply);
    else if(e.source) e.source.postMessage(reply);
  } catch(_) {}
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Network-first for RPC-shaped URLs (Kaspa node WSS uses ws://, not handled
     here; this branch only catches HTTPS REST calls). */
  const isRpc = /\/transactions\/|\/blocks\/|\/addresses\/|\/info\/|api\.kaspa\.org|kasplex/i.test(url.pathname + url.host);
  if(isRpc){
    e.respondWith(
      fetch(req).catch(() => caches.match(req).then(r => r || new Response('', {status: 503})))
    );
    return;
  }

  /* Cache-first for everything else (the app shell, WASM, scripts, fonts). */
  e.respondWith((async () => {
    const cached = await caches.match(req, {ignoreSearch: true});
    if(cached) return cached;
    try {
      const resp = await fetch(req);
      if(resp.ok && url.origin === self.location.origin){
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, resp.clone());
      }
      return resp;
    } catch(_) {
      /* Offline + not in cache -> fall back to the SPA shell. */
      const shell = await caches.match('./index.html');
      return shell || new Response('Offline and no cached shell available.', {status: 503});
    }
  })());
});

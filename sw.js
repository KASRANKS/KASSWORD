/* Kassword Service Worker (mainnet)
 * Lets a cold device (offline phone in airplane mode) re-open the app
 * indefinitely after one online install. Bumps CACHE_NAME on every release
 * so every existing PWA install purges old cache on next activate. */

const KW_BUILD_ID = '1.3.0';
const KW_SW_NET = 'mainnet'; /* compiled net identity, reported in the shell-state handshake*/
const KW_SHELL_TAG = '1bdea332f18bf35fe722dae2b6854623'; /* per-byte-set shell hash, injected by the seal - two different sealed candidates get DISTINCT cache names so a failed update can never mix shells or evict the last verified cache */
const CACHE_NAME = 'kassword-v5-' + KW_BUILD_ID + '-' + KW_SHELL_TAG + '-mainnet';
const KW_RELEASE_ID = '4d8bbc18c77741b42b5fda1c21cef0aadf1ccb6f7fc14d80048184521579aa2c';  /* injected by the seal - reported to pages via kw-shell-state; the page compares against its OWN copy */
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './kw-pq.js',
  './kaspa/kaspa.js',
  './kaspa/kaspa_bg.wasm'
];

/* the ENTIRE app shell is content-addressed, not just the signer. Every CORE_ASSET carries a
   sha384 pin (index.html + manifest.json pins are injected by the seal in lock-step with KW_SHELL_TAG).
   The fetch handler verifies a pinned asset BEFORE returning it or writing it into the tagged cache, so the
   cache named for this byte set can never be mutated to hold different bytes: a host/CDN that starts serving
   changed same-version shell bytes gets rejected and the last verified copy is served instead. A NEW byte set
   ships as a NEW sw.js whose transactional install builds and read-back-verifies its own cache before takeover. */
const SUBRESOURCE_INTEGRITY = {
  './':                    'sha384-tRhCIOl1gh9iAVmkpOFEzXXbIFdPrnjaQPv0RrFMYGspG8cSXozdTPLXhu6ABhyn',
  './index.html':          'sha384-tRhCIOl1gh9iAVmkpOFEzXXbIFdPrnjaQPv0RrFMYGspG8cSXozdTPLXhu6ABhyn',
  './manifest.json':       'sha384-NvVf6E3RBuomND1v3cpCmh7/d9JB49+SRw047HWvS9xsnWmmvaZjGzBUPGegwF2o',
  './kaspa/kaspa.js':      'sha384-/wAUto/tC9az48I3OdiPnnhollvE8J7uuvJwX7k4pilAnpusvvq512NuIS9Bz+S5',
  './kaspa/kaspa_bg.wasm': 'sha384-OSCmbnyP544WkYU7GHoeE0yrGO1NlW9ShaxnswxmTxI5ospQX0Gd8ksp1ioFl5zy',
  './kw-pq.js':            'sha384-khUzgjL4249wolAYxmPRLrvulip9gD0GUlAYQPgsHvbnZKfDS2lalQQMJOpq7QX3'
};
async function _sw_sha384(buf){
  const h = await crypto.subtle.digest('SHA-384', buf);
  let s=''; const b = new Uint8Array(h); for(let i=0;i<b.length;i+=0x8000){ s += String.fromCharCode.apply(null, b.subarray(i,i+0x8000)); }
  return 'sha384-' + btoa(s);
}
/* fallback bytes come ONLY from THIS release's named cache, and every pinned asset is re-hashed against
   SUBRESOURCE_INTEGRITY before it is returned. A foreign/older/attacker-seeded same-origin cache entry can never be
   served. reqOrKey may be a Request/URL or a './'-relative core-asset key. */
async function _sw_verifiedCacheMatch(reqOrKey){
  let cache; try { cache = await caches.open(CACHE_NAME); } catch(_){ return null; }
  let hit; try { hit = await cache.match(reqOrKey, {ignoreSearch: true}); } catch(_){ return null; }
  if(!hit || !hit.ok) return null;
  let pathname = '';
  try { pathname = (typeof reqOrKey === 'string') ? reqOrKey.replace(/^\.\//,'/') : new URL(reqOrKey.url || reqOrKey).pathname; } catch(_){ pathname = String(reqOrKey || ''); }
  let pin = null;
  for(const k in SUBRESOURCE_INTEGRITY){ if(pathname.endsWith(k.replace(/^\.\//,'/'))){ pin = SUBRESOURCE_INTEGRITY[k]; break; } }
  if(!pin) return null;   /* serve ONLY integrity-pinned assets from cache - an unpinned same-origin entry is never returned unverified */
  try { const buf = await hit.clone().arrayBuffer(); if(await _sw_sha384(buf) !== pin) return null; } catch(_){ return null; }
  return hit;
}

/* TRANSACTIONAL INSTALL. Build the whole offline set into the versioned cache, then READ IT BACK
   and re-verify before taking over. ANY mandatory fetch / hash / put failure THROWS, which fails the
   install - the browser keeps the previous complete SW + cache active, so a partial download can never
   become the offline copy. Every CORE_ASSET is mandatory (they are exactly the cold-device shell + signer). */
async function _sw_buildCache(cacheName){
  /* if ANY fetch / hash / put fails mid-build, do NOT leave a half-built candidate cache behind (a later
     activate could otherwise prune the previous complete cache while trusting a partial one). Delete the candidate on
     any failure, then rethrow so the install fails and the browser keeps the previous complete SW + cache active. */
  try {
    const cache = await caches.open(cacheName);
    for(const url of CORE_ASSETS){
      const resp = await fetch(url, {cache:'no-cache'});
      if(!resp || !resp.ok) throw new Error('core asset fetch failed: ' + url + ' ' + (resp && resp.status));
      const pin = SUBRESOURCE_INTEGRITY[url];
      if(pin){
        const buf = await resp.clone().arrayBuffer();
        if(await _sw_sha384(buf) !== pin) throw new Error('core asset hash mismatch: ' + url);  /* tampered/partial signer - refuse */
      }
      await cache.put(url, resp);  /* AWAITED, not best-effort - a rejected put fails the whole install */
    }
  } catch(e){
    try { await caches.delete(cacheName); } catch(_){} /* drop the partial candidate cache before failing the install */
    throw e;
  }
}
/* Read-back completeness: every mandatory asset is actually present AND every pinned asset re-verifies
   from what was stored. Gate for both taking over (post-install) and pruning the previous cache (activate). */
async function _sw_cacheComplete(cacheName){
  let cache; try { cache = await caches.open(cacheName); } catch(_){ return false; }
  for(const url of CORE_ASSETS){
    let hit; try { hit = await cache.match(url); } catch(_){ return false; }
    if(!hit || !hit.ok) return false;
    const pin = SUBRESOURCE_INTEGRITY[url];
    if(pin){
      try { const buf = await hit.clone().arrayBuffer(); if(await _sw_sha384(buf) !== pin) return false; }
      catch(_){ return false; }
    }
  }
  return true;
}
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await _sw_buildCache(CACHE_NAME);
    if(!(await _sw_cacheComplete(CACHE_NAME))){ try { await caches.delete(CACHE_NAME); } catch(_){} throw new Error('post-install verification incomplete - refusing to activate'); }
    /* A fully stored and read-back-verified UPDATE announces itself so open pages block new sensitive actions and defer reload through any active durable boundary; the verified worker then calls skipWaiting() below. */
    if(self.registration.active){
      try {
        const cs = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        for(const c of cs){ try { c.postMessage({ t: 'kw-update-ready', buildId: KW_BUILD_ID, cacheName: CACHE_NAME, releaseId: KW_RELEASE_ID }); } catch(_){} }
      } catch(_){}
    }
    self.skipWaiting();  /* only after the full set is stored AND read-back-verified */
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    /* prune old caches ONLY when THIS build verifies complete; otherwise keep the previous verified
       offline cache so a cold device that goes offline still holds a full signer . */
    if(await _sw_cacheComplete(CACHE_NAME)){
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(n => n.startsWith('kassword-') && n !== CACHE_NAME)
          .map(n => caches.delete(n))
      );
    }
    await self.clients.claim();
  })());
});

/* Report the active build/cache to the page so it can detect a stale shell (no-op otherwise). */
self.addEventListener('message', e => {
  const msg = e.data || {};
  /* let the page ask a fully-installed-but-waiting worker to activate, so "Force refresh" can swap to
     the verified new worker WITHOUT the page ever unregistering the working one. skipWaiting only promotes a worker
     that already passed its transactional install (every pinned asset verified) - it can never activate a partial build. */
  if(msg && msg.t === 'kw-skip-waiting'){ try { self.skipWaiting(); } catch(_){} return; }
  if(!msg || msg.t !== 'kw-shell-state') return;
  const reply = { t:'kw-shell-state', buildId:KW_BUILD_ID, cacheName:CACHE_NAME, releaseId:KW_RELEASE_ID, net:KW_SW_NET };
  try {
    if(e.ports && e.ports[0]) e.ports[0].postMessage(reply);
    else if(e.source) e.source.postMessage(reply);
  } catch(_) {}
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  /* a connectivity PROBE must reflect REAL network state - it must NEVER be answered from the cache (a
     cached shell 200 would make an OFFLINE device look online). Network-only; on network failure return a DISTINCT
     offline marker (599 + header) the probe recognizes, never a cached shell. */
  if(/kw-net-probe-/i.test(url.pathname) || /kw-net-probe-/i.test(url.search)){
    e.respondWith(
      fetch(req, {cache:'no-store'}).catch(() => new Response('kw-net-probe-offline', {status: 599, headers: {'x-kw-net-probe': 'offline', 'cache-control': 'no-store'}}))
    );
    return;
  }

  /* Network-first for RPC-shaped URLs (Kaspa node WSS uses ws://, not handled
     here; this branch only catches HTTPS REST calls). */
  const isRpc = /\/transactions\/|\/blocks\/|\/addresses\/|\/info\/|api\.kaspa\.org|kasplex/i.test(url.pathname + url.host);
  if(isRpc){
    e.respondWith(
      fetch(req).catch(() => new Response('', {status: 503}))   /* chain truth is LIVE only - never answer an RPC/API request from cache */
    );
    return;
  }

  /* NETWORK-FIRST for the same-origin app shell + assets. Cache-first served a STALE shell to a
     returning install (the old shell + old SW agree on their build id, and reg.update() is async), so the user could
     operate an out-of-date security build. Now: fetch fresh (cache:'no-store'), update the cache on success, and fall
     back to cache ONLY on network failure - which preserves the cold-device offline re-open (one online install, then
     airplane mode). Pinned signer assets are RE-VERIFIED (sha384) before being cached OR returned, so a poisoned host
     can never slip a swapped signer through this path (matches the install-time enforcement; the app also re-verifies
     on load). Cross-origin GETs are network-only (see the cross-origin branch below). */
  if(url.origin === self.location.origin){
    /* is this request one of the integrity-pinned signer assets? (base-path independent) */
    let pin = null;
    for(const k in SUBRESOURCE_INTEGRITY){ if(url.pathname.endsWith(k.replace(/^\.\//,'/'))){ pin = SUBRESOURCE_INTEGRITY[k]; break; } }
    e.respondWith((async () => {
      try {
        /* Bounded timeout: over a multi-year freeze a hung/slow host must NOT deny the working offline copy.
           On timeout we abort the fetch, which throws into the catch below and serves the last verified cached
           shell (identical to the offline path). Pure-additive graceful degradation - never affects the happy path. */
        const _ac = new AbortController();
        const _to = setTimeout(() => { try { _ac.abort(); } catch(_){} }, 8000);
        let resp;
        try { resp = await fetch(req, {cache:'no-store', signal:_ac.signal}); }
        finally { clearTimeout(_to); }
        if(resp && resp.ok){
          if(pin){
            const buf = await resp.clone().arrayBuffer();
            const got = await _sw_sha384(buf);
            if(got !== pin){
              /* fresh copy fails its pin - NEVER cache or return it; use the VERIFIED cached copy (this release's cache, re-hashed) if we have one. */
              const cachedOk = await _sw_verifiedCacheMatch(req);
              return cachedOk || new Response('Signer integrity check failed and no verified cached copy.', {status: 502});
            }
          }
          /* AWAIT the durable write - an unawaited cache.put can lose the race with worker
             termination, leaving the offline copy on an older shell after a good online session. */
          if(pin){ try { const cache = await caches.open(CACHE_NAME); await cache.put(req, resp.clone()); } catch(_){} }   /* cache ONLY integrity-pinned shell assets - never persist an unpinned same-origin response */
          return resp;
        }
        /* non-ok (e.g. 404/500): prefer the VERIFIED cached copy (re-hashed, this release's cache), else the network response. */
        const cached = await _sw_verifiedCacheMatch(req);
        return cached || resp;
      } catch(_) {
        /* Offline: serve the VERIFIED cached asset; for a NAVIGATION only, fall back to the VERIFIED cached SPA shell
           (a non-navigation request must fail cleanly - never receive HTML shell bytes with a 200 status). */
        const cached = await _sw_verifiedCacheMatch(req);
        if(cached) return cached;
        if(req.mode === 'navigate'){ const shell = await _sw_verifiedCacheMatch('./index.html'); if(shell) return shell; }
        return new Response('Offline and no cached copy.', {status: 503});
      }
    })());
    return;
  }

  /* Cross-origin: NETWORK-ONLY. The sealed single-file app makes no integrity-pinned cross-origin GETs, and a global
     caches.match could return foreign / attacker-seeded bytes from any cache on the origin - so cross-origin is never
     served from cache. */
  e.respondWith(fetch(req).catch(() => new Response('', {status: 503})));
});

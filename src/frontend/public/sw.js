const CACHE_NAME = 'manga-watchlist-v5';
const STATIC_ASSETS = ['/', '/index.html'];

// Patterns that should NEVER be served from cache — always hit the network
function isPassThrough(url) {
  const u = new URL(url);
  // ICP canister API calls (raw, icp0.io, icp-api.io, localhost dfx port)
  if (
    u.hostname.endsWith('.icp0.io') ||
    u.hostname.endsWith('.ic0.app') ||
    u.hostname.endsWith('.raw.icp0.io') ||
    u.hostname.endsWith('.icp-api.io') ||
    u.hostname.endsWith('.caffeine.ai') ||
    // local dfx replica
    (u.hostname === 'localhost' && u.port === '4943') ||
    // storage gateway / blob uploads
    u.pathname.startsWith('/v1/chunk') ||
    u.pathname.startsWith('/v1/blob') ||
    u.pathname.startsWith('/v1/blob-tree') ||
    // Candid / agent calls
    u.pathname.startsWith('/api/v2') ||
    u.pathname.startsWith('/api/v3')
  ) {
    return true;
  }
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Always bypass cache for canister/API requests
  if (isPassThrough(event.request.url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For static assets: network-first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache a clone of successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

/**
 * AzFIT Service Worker
 * Cache-First with Network Fallback strategy
 * Optimized for gym floor with spotty Wi-Fi
 */

const CACHE_NAME = 'azfit-v2';
// Scope-relative paths: resolve against registration.scope (the SW script
// location), so they work under the GitHub Pages subpath (/Azfit.ai/).
// Root-absolute paths 404 there and used to kill install via addAll rejection.
const CRITICAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];
const OPTIONAL_ASSETS = [
  './azfit-logo.png',
  './azfit-logo-transparent-1.png',
  './azfit-logo-text.png',
  './azfit-hero-bg.png',
  './azfit-bg-2.png',
];

// Supabase API cache (short TTL for fresh data)
const API_CACHE_NAME = 'azfit-api-v2';
const API_TTL = 5 * 60 * 1000; // 5 minutes

// Install: precache assets — failure-tolerant so one missing file can never
// abort install again (criticals as a group with catch, optionals individually)
self.addEventListener('install', (event) => {
  console.log('[SW] Installing AzFIT service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const criticals = cache.addAll(CRITICAL_ASSETS).catch((err) => {
        console.warn('[SW] Critical precache failed (continuing install):', err);
      });
      const optionals = Promise.all(
        OPTIONAL_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn('[SW] Optional precache skipped:', asset, err);
          })
        )
      );
      return Promise.all([criticals, optionals]);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating AzFIT service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch: Cache-First for static, Network-First for API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Chrome extensions
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Supabase Auth/Realtime: always network
  if (url.pathname.includes('/auth/v1/') || url.pathname.includes('/realtime/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Supabase API (REST): Network-First with cache fallback
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cached API response
          return caches.match(request).then((cached) => {
            if (cached) {
              console.log('[SW] Serving cached API response:', url.pathname);
              return cached;
            }
            // Return offline JSON for API calls
            return new Response(
              JSON.stringify({ error: 'offline', message: 'You are offline. Data will sync when connection is restored.' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Static assets: Cache-First with Network Fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Return cached version immediately, but fetch update in background
        fetch(request)
          .then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, response);
              });
            }
          })
          .catch(() => {}); // Silently fail background update
        return cached;
      }

      // Not in cache: fetch and cache
      return fetch(request)
        .then((response) => {
          if (response.ok && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Complete offline fallback (scope-relative — see install note)
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503 });
        });
    })
  );
});

// Background Sync: Queue failed writes for Phase 2
self.addEventListener('sync', (event) => {
  if (event.tag === 'azfit-sync') {
    console.log('[SW] Background sync triggered:', event.tag);
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  // Phase 2 will implement localStorage queue sync here
  console.log('[SW] Syncing pending data...');
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_COMPLETE' });
  });
}

// Push notifications (Phase 24A)
// registration.scope ends with the deployed base path (e.g. /Azfit.ai/),
// so all asset/page URLs derived from it work on GitHub Pages subpaths.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    console.warn('[SW] Malformed push payload:', err);
    data = {};
  }

  const title = typeof data.title === 'string' && data.title ? data.title : 'AzFIT';
  const body = typeof data.body === 'string' && data.body ? data.body : 'You have a new notification';
  const icon = self.registration.scope + 'azfit-logo.png';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      data: { url: typeof data.url === 'string' ? data.url : null },
    })
  );
});

// Notification click handler: focus an existing app window if one is
// open (navigating it to the target), otherwise open a new window.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const scope = self.registration.scope; // e.g. https://azfit.github.io/Azfit.ai/
  const raw = event.notification.data && event.notification.data.url
    ? String(event.notification.data.url)
    : '#/dashboard';
  // Strip any leading '/' so relative targets resolve UNDER the base path.
  const target = new URL(raw.replace(/^\/+/, ''), scope).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(scope) && 'focus' in client) {
          if ('navigate' in client) {
            return client.navigate(target).then((c) => (c ? c.focus() : client.focus()));
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

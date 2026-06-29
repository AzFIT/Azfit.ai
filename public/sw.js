/**
 * AzFIT Service Worker
 * Cache-First with Network Fallback strategy
 * Optimized for gym floor with spotty Wi-Fi
 */

const CACHE_NAME = 'azfit-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/azfit-logo.png',
  '/azfit-logo-transparent-1.png',
  '/azfit-logo-text.png',
  '/azfit-hero-bg.png',
  '/azfit-bg-2.png',
];

// Supabase API cache (short TTL for fresh data)
const API_CACHE_NAME = 'azfit-api-v1';
const API_TTL = 5 * 60 * 1000; // 5 minutes

// Install: Precache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing AzFIT service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
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
          // Complete offline fallback
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
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

// Push notifications (future Phase expansion)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'AzFIT', {
        body: data.body || 'You have a new notification',
        icon: '/azfit-logo.png',
        badge: '/azfit-logo.png',
        data: data,
      })
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow('/#/dashboard')
  );
});

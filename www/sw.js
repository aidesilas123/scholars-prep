const CACHE_NAME = 'scholars-prep-cache-v6';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon1.png',
  '/supabase-config.js',
  '/post-utme-login.html',
  '/post-utme-login.js',
  '/post-utme-dashboard.html',
  '/post-utme-dashboard.js',
  '/post-utme-cbt.html',
  '/post-utme-cbt.js'
  // Note: I shortened the list here for speed, but you can add your other files back in!
];

// 1. INSTALL
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url).catch(() => console.warn('Skipped:', url)))
      );
    })
  );
});

// 2. ACTIVATE
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

// 3. FETCH (The Vercel Redirect Fix)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;
  if (event.request.url.includes('supabase.co')) return; // Never cache database

  event.respondWith((async () => {
    try {
      // THE FIX: If loading a full HTML page, fetch the raw URL to bypass the strict redirect security block.
      // Otherwise, fetch the normal request (for CSS, JS, images).
      const fetchTarget = event.request.mode === 'navigate' ? event.request.url : event.request;
      
      // Try the network (Vercel) first
      const networkResponse = await fetch(fetchTarget);

      // Save a clean backup to the cache if it succeeds
      if (networkResponse && networkResponse.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, networkResponse.clone());
      }
      
      return networkResponse;
    } catch (error) {
      // If Vercel fails (Offline), pull the backup from the cache
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) return cachedResponse;

      // Failsafe to prevent ERR_FAILED crashes
      return new Response('Offline. No connection available.', { 
          status: 503, 
          headers: { 'Content-Type': 'text/plain' }
      });
    }
  })());
});
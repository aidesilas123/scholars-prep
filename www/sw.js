const CACHE_NAME = 'scholars-prep-cache-v1';

// 1. THE PRE-CACHE LIST (The App Shell)
// We explicitly tell it to save these immediately so they load in 0ms.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon1.png',
  '/styles.css',
  '/supabase-config.js',
  // Your upcoming POST UTME files:
  '/post-utme-login.html',
  '/post-utme-login.js',
  '/post-utme-dashboard.html',
  '/post-utme-dashboard.js'
];

// INSTALL EVENT: Save the core shell files instantly
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting(); // Forces the browser to activate this worker immediately
});

// ACTIVATE EVENT: Clean up old data if you ever change the CACHE_NAME version
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// FETCH EVENT: The Traffic Controller
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // RULE A: STRICT BYPASS FOR SUPABASE (Always 100% Live)
  if (requestUrl.hostname.includes('supabase.co')) {
    // We do nothing. The request goes straight to the live internet.
    return; 
  }

  // RULE B: STALE-WHILE-REVALIDATE (For all your HTML, CSS, JS, and Images)
  if (requestUrl.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        
        // The "Revalidate" Phase: Fetch fresh code from Vercel in the background
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // If the network fetch is successful, secretly update the cache
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        }).catch(() => {
          // If the user has no internet, this fails silently and we rely entirely on the cache
        });

        // The "Stale" Phase: Return the instant cached version to eliminate the white screen.
        // If it isn't in the cache yet, fallback to the network promise.
        return cachedResponse || fetchPromise;
      })
    );
  }
});
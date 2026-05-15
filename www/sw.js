const CACHE_NAME = 'scholars-prep-cache-v2';

// 1. THE PRE-CACHE LIST (The App Shell)
// Keep this list small! Only the absolute essentials for instant loading.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon1.png',
  '/supabase-config.js',
  '/dashboard.html',
  '/dashboard.js',

  '/login.html',
  '/login.js',
  '/cbt.html',
  '/cbt.js',
  '/leaderboard.html',
  '/leaderboard.js',
  '/history.html',
  '/mock-exam.html',
  '/history.js',
  '/mock-exam.js',
  '/pastquestions.html',
  '/past-questions.js',
  '/chat.html',
  '/nexus.js',
  '/messages.html',
  '/messages.js',
  '/notifications.html',
  '/notifications.js',
  '/feedback.html',
  '/feedback.js',
  '/update-password.html',
  '/update-password.js',

  // POST UTME Core Files:
  '/post-utme-login.html',
  '/post-utme-login.js',
  '/post-utme-dashboard.html',
  '/post-utme-dashboard.js',
  '/post-utme-cbt.html',
  '/post-utme-cbt.js',
  '/post-utme-alerts.html',
  '/post-utme-alerts.js',
  '/exam-mode.html',
  '/exam-mode.js'
];

// INSTALL EVENT: Safe Install Strategy
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // SAFE INSTALL: Maps through the list and caches one by one.
      // If a file is missing, it logs a warning but DOES NOT crash the app.
      return Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url).catch(err => console.warn('Cache skipped missing file:', url)))
      );
    })
  );
  self.skipWaiting(); // Forces the browser to activate this worker immediately
});

// ACTIVATE EVENT: Clean up old data (e.g., deletes v1 when v2 installs)
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
    return; 
  }

  // RULE B: STALE-WHILE-REVALIDATE
  // Only intercept GET requests from our own domain
  if (requestUrl.origin === location.origin && event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        
        // Fetch fresh code from Vercel in the background
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        }).catch(error => {
           // Fails silently if offline, relies strictly on cache
           console.warn('Network unavailable, relying on cache for:', event.request.url);
           throw error; 
        });

        // Return the instant cached version to eliminate the white screen.
        // If it isn't in the cache, fallback to the network promise.
        return cachedResponse || fetchPromise;
      }).catch(() => {
         // Failsafe for Android WebViews: If BOTH cache and network fail, 
         // prevent the ERR_FAILED crash by doing nothing and letting the browser handle it.
      })
    );
  }
});
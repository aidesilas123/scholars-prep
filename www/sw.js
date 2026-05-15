const CACHE_NAME = 'scholars-prep-cache-v5';

// 1. THE PRE-CACHE LIST (The Original Plan)
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

// 2. INSTALL: Safe Background Caching
self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Safe Install: Caches one by one. Does NOT crash if a file is missing.
      return Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url).catch(err => console.warn('Cache skipped missing file:', url)))
      );
    })
  );
});

// 3. ACTIVATE: Nuke Old Caches
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

// 4. FETCH: Zero White Screen Logic
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;
  
  // NEVER cache Supabase Database calls (always fetch live questions/auth)
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      
      // Fetch fresh files from Vercel silently in the background
      const networkFetch = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        // Fail silently if offline, rely entirely on the cache
      });

      // ORIGINAL PLAN: Instantly return the cached file so the screen loads in 0ms.
      // If it isn't cached yet, wait for the network.
      // If both fail, return a safe fallback so the browser doesn't crash with ERR_FAILED.
      return cachedResponse || networkFetch || new Response('Offline. Please check your internet connection.', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'Content-Type': 'text/plain' })
      });
    })
  );
});
const CACHE_NAME = 'scholars-prep-cache-v6';


const PRECACHE_URLS = [
  '/',
  '/favicon1.png',
  '/supabase-config.js',
  '/dashboard',
  '/dashboard.js',
  '/login',
  '/login.js',
  '/cbt',
  '/cbt.js',
  '/leaderboard',
  '/leaderboard.js',
  '/history',
  '/history.js',
  '/mock-exam',
  '/mock-exam.js',
  '/pastquestions',
  '/past-questions.js',
  '/chat',
  '/nexus.js',
  '/messages',
  '/messages.js',
  '/notifications',
  '/notifications.js',
  '/feedback',
  '/feedback.js',
  '/update-password',
  '/update-password.js',
  // POST UTME
  '/post-utme-login',
  '/post-utme-login.js',
  '/post-utme-dashboard',
  '/post-utme-dashboard.js',
  '/post-utme-cbt',
  '/post-utme-cbt.js',
  '/post-utme-alerts',
  '/post-utme-alerts.js',
  '/exam-mode',
  '/exam-mode.js'
];

// 1. INSTALL
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('Cache skipped:', url, err))
        )
      );
    })
  );
});

// 2. ACTIVATE — nuke old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// 3. FETCH — Cache-first, zero white screen
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // Never intercept Supabase — always live
  if (event.request.url.includes('supabase.co')) return;

  // Never intercept cdn/external scripts — let them pass through
  if (
    event.request.url.includes('cdn.jsdelivr.net') ||
    event.request.url.includes('fonts.googleapis.com') ||
    event.request.url.includes('fonts.gstatic.com')
  ) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // ✅ Serve from cache instantly (zero white screen)
      if (cachedResponse) {
        // Silently refresh cache in background
        fetch(event.request, { redirect: 'follow' })
          .then(networkResponse => {
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === 'basic' &&
              !networkResponse.redirected
            ) {
              caches.open(CACHE_NAME).then(cache =>
                cache.put(event.request, networkResponse.clone())
              );
            }
          })
          .catch(() => {});

        return cachedResponse; // ← instant response, no waiting
      }

      // Not in cache — fetch from network and cache it
      return fetch(event.request, { redirect: 'follow' })
        .then(networkResponse => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic' &&
            !networkResponse.redirected
          ) {
            caches.open(CACHE_NAME).then(cache =>
              cache.put(event.request, networkResponse.clone())
            );
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return new Response('You are offline. Please check your connection.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
    })
  );
});
const CACHE_NAME = 'scholars-prep-cache-v7';

const PRECACHE_URLS = [
  '/',
  '/favicon1.png',
  '/supabase-config.js',
  '/login',
  '/login.js',
  '/dashboard',
  '/dashboard.js',
  '/cbt',
  '/cbt.js',
  '/leaderboard',
  '/leaderboard.js',
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
  '/post-utme-login',
  '/post-utme-login.js',
  '/post-utme-dashboard',
  '/post-utme-dashboard.js',
  '/post-utme-cbt',
  '/post-utme-alerts',
  '/exam-mode',
  '/exam-mode.js'
];

// 1. INSTALL
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(() => console.warn('Skipped (not found on server):', url))
        )
      )
    )
  );
});

// 2. ACTIVATE
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ✅ HELPER: Normalize any request — strips .html so both
// /login.html and /login always resolve to the same cache key
function normalizeRequest(request) {
  const url = new URL(request.url);
  if (url.pathname.endsWith('.html')) {
    const clean = url.origin + url.pathname.replace(/\.html$/, '') + url.search;
    return new Request(clean, { mode: 'same-origin' });
  }
  return request; // already clean, return as-is
}

// 3. FETCH
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // Always bypass external services
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) return;

  // ✅ Normalize ONCE — all logic below uses the clean request
  const req = normalizeRequest(event.request);

  event.respondWith(
    caches.match(req).then(cachedResponse => {

      // Cache hit — serve instantly, update in background
      if (cachedResponse) {
        fetch(req, { redirect: 'follow' })
          .then(res => {
            if (res && res.status === 200 && res.type === 'basic' && !res.redirected) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
            }
          })
          .catch(() => {});

        return cachedResponse;
      }

      // Cache miss — fetch, cache, return
      return fetch(req, { redirect: 'follow' })
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic' && !res.redirected) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return res;
        })
        .catch(() =>
          new Response('You are offline. Please check your connection.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          })
        );
    })
  );
});
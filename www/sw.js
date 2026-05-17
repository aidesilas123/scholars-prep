const CACHE_NAME = 'scholars-prep-cache-v10';

// Strictly Clean URLs (No .html allowed in this list)
const PRECACHE_URLS = [
  '/',
  '/favicon1.png',
  '/supabase-config.js',
  '/login', '/login.js',
  '/dashboard', '/dashboard.js',
  '/cbt', '/cbt.js',
  '/leaderboard', '/leaderboard.js',
  '/mock-exam', '/mock-exam.js',
  '/pastquestions', '/past-questions.js',
  '/chat', '/nexus.js',
  '/messages', '/messages.js',
  '/notifications', '/notifications.js',
  '/feedback', '/feedback.js',
  '/post-utme-login', '/post-utme-login.js',
  '/post-utme-dashboard', '/post-utme-dashboard.js',
  '/post-utme-cbt', '/post-utme-cbt.js',
  '/post-utme-alerts', '/post-utme-alerts.js',
  '/exam-mode', '/exam-mode.js',
  '/post-utme-history', '/post-utme-history.js',
  '/post-utme-pastquestions', '/post-utme-pastquestions.js',
  '/post-utme-settings', '/post-utme-settings.js',
  '/post-utme-report', '/post-utme-report.js',
  '/post-utme-profile', '/post-utme-profile.js',
  '/post-utme-leaderboard', '/post-utme-leaderboard.js',
  
  '/'
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

// 3. FETCH
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // Always bypass external services (Supabase, CDNs)
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) return;

  // THE STRICT CLEAN URL ENFORCER
  // If the browser asks for a .html file, strip it internally.
  // E.g., if a stray code says window.location.href = 'login.html', we fetch '/login' instead.
  let targetUrl = event.request.url;
  if (targetUrl.endsWith('.html')) {
    if (targetUrl.endsWith('index.html')) {
      targetUrl = targetUrl.replace('index.html', ''); // map index.html to root '/'
    } else {
      targetUrl = targetUrl.replace('.html', ''); // strip .html from everything else
    }
  }

  event.respondWith(
    caches.match(targetUrl).then(cachedResponse => {

      // Cache hit — serve instantly, update quietly in background
      if (cachedResponse) {
        fetch(targetUrl, { redirect: 'follow' })
          .then(res => {
            // REMOVED !res.redirected so Vercel fetches actually cache
            if (res && res.status === 200 && res.type === 'basic') {
              caches.open(CACHE_NAME).then(cache => cache.put(targetUrl, res.clone()));
            }
          })
          .catch(() => {}); // Fails silently if offline

        return cachedResponse;
      }

      // Cache miss — fetch from live Vercel, cache it, return it
      return fetch(targetUrl, { redirect: 'follow' })
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(targetUrl, clone));
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
const CACHE_NAME = 'scholars-prep-cache-v14'; 

const PRECACHE_URLS = [
  '/',
  '/favicon1.png',
  '/supabase-config.js',
  '/styles.css',                       

  // HTML pages
  '/post-utme-login.html',
  '/post-utme-dashboard.html',
  '/post-utme-history.html',
  '/post-utme-leaderboard.html',
  '/post-utme-pastquestions.html',
  '/post-utme-settings.html',
  '/post-utme-report.html',
  '/post-utme-profile.html',
  '/update-password.html',
  '/signup.html',
  '/exam-mode.html',

  // JS files 
  '/post-utme-login.js',
  '/post-utme-dashboard.js',
  '/post-utme-history.js',
  '/post-utme-leaderboard.js',
  '/post-utme-pastquestions.js',
  '/post-utme-settings.js',
  '/post-utme-report.js',
  '/post-utme-profile.js',
  '/exam-mode.js',

  // Images
  '/slide8.jpg',
  '/slider7.jpg',
  '/slider5.jpg',
  '/slider9.jpg',
  '/slider6.jpg',
];

// ─── 1. INSTALL ───────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('Precache skipped:', url, err))
        )
      )
    )
  );
});

// ─── 2. ACTIVATE ─────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ─── 3. FETCH (STALE-WHILE-REVALIDATE) ───────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // Bypass external services
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('paystack.co')
  ) return;

  // 1. Normalize the Cache Key
  // Maps clean URLs (like '/exam-mode') to their physical files ('/exam-mode.html')
  let cacheKey = url.pathname;
  if (cacheKey === '/index' || cacheKey === '/index.html') {
    cacheKey = '/';
  } else if (!cacheKey.includes('.') && cacheKey !== '/') {
    cacheKey += '.html';
  }

  // 2. The Stale-While-Revalidate Engine
  event.respondWith(
    caches.match(cacheKey, { ignoreSearch: true }).then(cachedResponse => {
      
      // Define the background network fetch using the unmutated, raw event.request
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // Silently update the cache with the fresh network version for next time
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, clone));
        }
        return networkResponse;
      }).catch(() => {
        // Fail silently in the background if network drops
      });

      // KEY LOGIC: 
      // If we have a cached version, return it INSTANTLY (do not wait for fetchPromise).
      // If we don't have it, wait for the fetchPromise.
      // If fetchPromise fails, show the offline page.
      return cachedResponse || fetchPromise.catch(() => {
        return new Response(
          '<div style="text-align:center; margin-top:50px; font-family:sans-serif;"><h2>You are offline</h2><p>Please check your internet connection.</p></div>',
          { status: 503, headers: new Headers({ 'Content-Type': 'text/html' }) }
        );
      });
    })
  );
});
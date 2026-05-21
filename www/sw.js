const CACHE_NAME = 'scholars-prep-cache-v12'; // bump version on every deploy

// ─── BUG 1 & 3 FIX ───────────────────────────────────────────────────────────
// Use the ACTUAL filenames (.html) the server can respond to with 200.
// The fetch handler below will map clean URL requests → .html cache entries.
const PRECACHE_URLS = [
  '/',
  '/favicon1.png',
  '/supabase-config.js',
  '/styles.css',                       // BUG 2 FIX: was completely missing!

  // HTML pages — use real .html filenames so cache.add() gets a 200 response
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

  // JS files (these are fetched by filename, no issue here)
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
    // BUG 4 FIX: clients.claim() is now INSIDE the waitUntil chain,
    // so it runs only after old caches are fully deleted.
    caches.keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ─── 3. FETCH ────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // Always bypass external services
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('paystack.co')
  ) return;

  event.respondWith(handleFetch(event.request));
});

async function handleFetch(request) {
  const url = new URL(request.url);
  let pathname = url.pathname;

  // Normalise root
  if (pathname === '/index' || pathname === '/index.html') {
    pathname = '/';
  }

  // ─── BUG 1 & 3 FIX: Try both clean URL AND .html version ─────────────────
  // We cache as .html filenames, but the browser requests clean URLs.
  // So we build a list of keys to try, in order.
  const keysToTry = [];

  if (pathname === '/') {
    keysToTry.push('/');
  } else if (pathname.endsWith('.html')) {
    // Request already has .html → try as-is, then strip
    keysToTry.push(pathname);
    keysToTry.push(pathname.replace('.html', ''));
  } else if (pathname.endsWith('.js') || pathname.endsWith('.css') ||
             pathname.endsWith('.jpg') || pathname.endsWith('.png') ||
             pathname.endsWith('.ico') || pathname.endsWith('.webp')) {
    // Static assets → try as-is only
    keysToTry.push(pathname);
  } else {
    // Clean URL navigation (e.g. /post-utme-dashboard)
    // Try .html version first (which is what we precached), then clean URL
    keysToTry.push(pathname + '.html');
    keysToTry.push(pathname);
  }

  // Try each cache key in order
  const cache = await caches.open(CACHE_NAME);
  for (const key of keysToTry) {
    const cached = await caches.match(key, { ignoreSearch: true });
    if (cached) {
      // Cache hit — serve instantly, update in background (stale-while-revalidate)
      refreshInBackground(cache, request, key);
      return cached;
    }
  }

  // Not in cache — go to network and cache the result for next time
  try {
    // ─── FIX: explicitly follow redirects ───────────────────────────────────
    const networkResponse = await fetch(request, { redirect: 'follow' });
    if (networkResponse.ok) {
      // Cache successful responses dynamically using the full request URL
      cache.put(request.url, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response(
      '<h1>You are offline</h1><p>Please check your connection and try again.</p>',
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'Content-Type': 'text/html' })
      }
    );
  }
}

// Background cache refresh (stale-while-revalidate pattern)
// Keeps cached pages up to date without slowing down the user
function refreshInBackground(cache, request, cacheKey) {
  // ─── FIX: explicitly follow redirects ─────────────────────────────────────
  fetch(request, { redirect: 'follow' }).then(response => {
    if (response.ok) cache.put(request.url, response);
  }).catch(() => {});
}
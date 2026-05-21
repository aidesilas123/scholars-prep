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

  // JS files (these are fetched by filename, no issue here)
  '/post-utme-login.js',
  '/post-utme-dashboard.js',
  '/post-utme-history.js',
  '/post-utme-leaderboard.js',
  '/post-utme-pastquestions.js',
  '/post-utme-settings.js',
  '/post-utme-report.js',
  '/post-utme-profile.js',

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

  if (pathname === '/index' || pathname === '/index.html') {
    pathname = '/';
  }

  const keysToTry = [];
  if (pathname === '/') {
    keysToTry.push('/');
  } else if (pathname.endsWith('.html')) {
    keysToTry.push(pathname);
    keysToTry.push(pathname.replace('.html', ''));
  } else if (
    pathname.endsWith('.js') || pathname.endsWith('.css') ||
    pathname.endsWith('.jpg') || pathname.endsWith('.png') ||
    pathname.endsWith('.ico') || pathname.endsWith('.webp')
  ) {
    keysToTry.push(pathname);
  } else {
    keysToTry.push(pathname + '.html');
    keysToTry.push(pathname);
  }

  const cache = await caches.open(CACHE_NAME);
  for (const key of keysToTry) {
    const cached = await caches.match(key, { ignoreSearch: true });
    if (cached) {
      refreshInBackground(cache, request.url, key);
      return cached;
    }
  }

  try {
   
    const networkResponse = await fetch(request.url, {
      redirect: 'follow',
      headers: request.headers,        // preserve original headers
      credentials: 'same-origin',
    });

    if (networkResponse.ok) {
      // Use the FINAL URL after redirect as cache key (handles redirect chains)
      const finalUrl = networkResponse.url || request.url;
      cache.put(finalUrl, networkResponse.clone());
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

function refreshInBackground(cache, requestUrl, cacheKey) {
  
  fetch(requestUrl, { redirect: 'follow', credentials: 'same-origin' })
    .then(response => {
      if (response.ok) cache.put(cacheKey, response);
    })
    .catch(() => {});
}
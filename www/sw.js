const CACHE_NAME = 'scholars-prep-cache-v3';

// 1. THE PRE-CACHE LIST
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
      return Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url).catch(err => console.warn('Cache skipped missing file:', url)))
      );
    })
  );
  self.skipWaiting();
});

// ACTIVATE EVENT: Clean up old v1/v2 caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// FETCH EVENT: The Bulletproof Traffic Controller
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // RULE A: STRICT BYPASS FOR SUPABASE (Always Live)
  if (requestUrl.hostname.includes('supabase.co')) {
    return; 
  }

  // RULE B: ONLY INTERCEPT OUR OWN DOMAIN'S GET REQUESTS
  if (requestUrl.origin === location.origin && event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        
        // BUG FIX 1: Explicitly tell the fetch to follow Vercel's redirects
        const networkFetch = fetch(event.request, { redirect: 'follow' })
          .then(networkResponse => {
            // BUG FIX 2: Only clone and cache valid, basic HTTP 200 responses
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(error => {
            console.warn('Network unavailable for:', event.request.url);
            
            // BUG FIX 3: Prevent the ERR_FAILED crash!
            // If network fails, return the cache. If cache is also empty, return a fake 503 response.
            // NEVER return undefined.
            return cachedResponse || new Response('Offline. Please check your internet connection.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain' })
            });
          });

        // Return cache instantly if we have it, otherwise wait for the network
        return cachedResponse || networkFetch;
      })
    );
  }
});
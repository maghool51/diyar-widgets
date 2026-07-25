// ============================================================
// sw.js - Service Worker for دیار قدمگاه پلیر
// ============================================================
// Version: 1.0.0
// Cache name with version for easy updates

const CACHE_NAME = 'diar-player-v1.0.0';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/logo.png',
  '/default-cover.png',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png'
];

// ============================================================
// INSTALL EVENT - Cache static assets
// ============================================================
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SW] Caching assets...');
        return cache.addAll(ASSETS);
      })
      .then(function() {
        console.log('[SW] Assets cached successfully');
        return self.skipWaiting();
      })
      .catch(function(error) {
        console.error('[SW] Cache installation failed:', error);
      })
  );
});

// ============================================================
// ACTIVATE EVENT - Clean up old caches
// ============================================================
self.addEventListener('activate', function(event) {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      console.log('[SW] Activated successfully');
      return self.clients.claim();
    })
  );
});

// ============================================================
// FETCH EVENT - Serve from cache, fallback to network
// ============================================================
self.addEventListener('fetch', function(event) {
  const requestUrl = new URL(event.request.url);
  
  // Skip cross-origin requests
  if (requestUrl.origin !== location.origin) {
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip browser extensions, devtools, etc.
  if (requestUrl.pathname.startsWith('/chrome-extension') || 
      requestUrl.pathname.startsWith('/__')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(cachedResponse) {
        if (cachedResponse) {
          // Return cached response
          return cachedResponse;
        }

        // If not in cache, fetch from network
        return fetch(event.request)
          .then(function(networkResponse) {
            // Cache the fetched response for future use
            // Only cache successful responses for static assets
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(function(cache) {
                // Cache specific file types
                const url = new URL(event.request.url);
                const ext = url.pathname.split('.').pop().toLowerCase();
                const cacheableTypes = ['html', 'css', 'js', 'json', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'woff2', 'ttf', 'otf', 'mp3', 'mp4', 'webm'];
                if (cacheableTypes.indexOf(ext) !== -1) {
                  cache.put(event.request, responseClone);
                }
              }).catch(function(error) {
                console.warn('[SW] Cache put failed:', error);
              });
            }
            return networkResponse;
          })
          .catch(function(error) {
            console.warn('[SW] Network fetch failed:', error);
            // Return offline fallback for HTML requests
            if (event.request.headers.get('Accept') && event.request.headers.get('Accept').indexOf('text/html') !== -1) {
              return caches.match('/index.html');
            }
            // Return a simple offline response for other requests
            return new Response('Network error occurred', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// ============================================================
// MESSAGE EVENT - Handle messages from client
// ============================================================
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ============================================================
// PUSH EVENT - Handle push notifications (optional)
// ============================================================
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'دیار قدمگاه';
  const options = {
    body: data.body || 'یک فایل جدید در لیست پخش',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    tag: 'diar-player-notification',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'باز کردن پلیر'
      },
      {
        action: 'close',
        title: 'بستن'
      }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ============================================================
// NOTIFICATION CLICK EVENT
// ============================================================
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Just close the notification
  } else {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(function(clientList) {
          for (var i = 0; i < clientList.length; i++) {
            var client = clientList[i];
            if (client.url === '/' && 'focus' in client) {
              return client.focus();
            }
          }
          return clients.openWindow('/');
        })
    );
  }
});

// ============================================================
// PERIODIC SYNC - Check for updates (optional)
// ============================================================
// self.addEventListener('periodicsync', function(event) {
//   if (event.tag === 'update-check') {
//     event.waitUntil(checkForUpdates());
//   }
// });

console.log('[SW] Service Worker loaded successfully');

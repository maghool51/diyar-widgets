/**
 * Diyar Player - Service Worker
 * Version: 1.0.0
 * Cache strategy: Cache-first for static assets, network-first for API calls
 */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `diyar-player-${CACHE_VERSION}`;

// Files to cache on install
const STATIC_CACHE_URLS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/assets/default-cover.png',
    '/assets/icons/icon-72x72.png',
    '/assets/icons/icon-96x96.png',
    '/assets/icons/icon-128x128.png',
    '/assets/icons/icon-144x144.png',
    '/assets/icons/icon-152x152.png',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-384x384.png',
    '/assets/icons/icon-512x512.png',
];

// URLs that should be fetched from network first (e.g., streaming media)
// We'll treat all audio/video URLs and external streams as network-first
// Also any URL that is not in the static list

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log(`[SW] Caching static assets (${CACHE_NAME})`);
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .then(() => {
                console.log('[SW] Static assets cached');
                // Force the waiting service worker to become active
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Failed to cache static assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName.startsWith('diyar-player-')) {
                            console.log(`[SW] Deleting old cache: ${cacheName}`);
                            return caches.delete(cacheName);
                        }
                        return Promise.resolve();
                    })
                );
            })
            .then(() => {
                console.log('[SW] Activated and old caches cleaned');
                // Claim clients so the SW controls all pages
                return self.clients.claim();
            })
    );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip cross-origin requests (except for media streams which we handle separately)
    if (url.origin !== self.location.origin) {
        // For cross-origin media requests, we can try network first but we don't cache them
        // We'll just let the browser handle it normally
        return;
    }

    // For static assets (our own files), use cache-first
    if (STATIC_CACHE_URLS.includes(url.pathname) || url.pathname.startsWith('/assets/')) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        // Return cached response
                        return cachedResponse;
                    }
                    // If not in cache, fetch from network and cache it
                    return fetch(request)
                        .then((networkResponse) => {
                            // Clone the response to put one in cache and return the other
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(request, responseToCache);
                                })
                                .catch((err) => console.warn('[SW] Failed to cache:', err));
                            return networkResponse;
                        })
                        .catch((error) => {
                            console.warn('[SW] Failed to fetch:', request.url, error);
                            // Return offline fallback if available
                            return caches.match('/index.html');
                        });
                })
        );
        return;
    }

    // For all other requests (including media files that might be cached), use network-first
    event.respondWith(
        fetch(request)
            .then((networkResponse) => {
                // If it's a successful response, clone it and cache it (if it's a GET request)
                if (networkResponse.ok && request.method === 'GET') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(request, responseToCache);
                        })
                        .catch((err) => console.warn('[SW] Failed to cache:', err));
                }
                return networkResponse;
            })
            .catch(() => {
                // If network fails, try cache
                return caches.match(request)
                    .then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // If not in cache, return a fallback (index.html for navigation)
                        if (request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                        // Otherwise, return an error response
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable',
                        });
                    });
            })
    );
});

// Handle messages from clients (e.g., skip waiting)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('[SW] Diyar Player Service Worker loaded');

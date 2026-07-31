/* ============================================
   sw.js — Complete Service Worker
   ============================================ */

// Cache version - update to force cache refresh
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `music-player-${CACHE_VERSION}`;

// Assets to cache on install (app shell)
const STATIC_ASSETS = [
    '/player/index.html',
    '/player/style.css',
    '/player/script.js',
    '/player/playlist.json',
    '/player/manifest.json',
    '/player/covers/default.jpg',
    '/player/icons/icon-72.png',
    '/player/icons/icon-96.png',
    '/player/icons/icon-128.png',
    '/player/icons/icon-144.png',
    '/player/icons/icon-152.png',
    '/player/icons/icon-192.png',
    '/player/icons/icon-384.png',
    '/player/icons/icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                // Add all static assets
                return cache.addAll(STATIC_ASSETS)
                    .catch((err) => {
                        console.warn('Some assets failed to cache:', err);
                        // Continue anyway - we'll cache what we can
                    });
            })
            .then(() => {
                // Skip waiting to activate immediately
                return self.skipWaiting();
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
                        // Delete caches that are not the current version
                        if (cacheName.startsWith('music-player-') && cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                        return null;
                    })
                );
            })
            .then(() => {
                // Claim clients so SW takes control immediately
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip cross-origin requests (except our own domain)
    if (url.origin !== self.location.origin) {
        return;
    }

    // Handle music files - network first with cache fallback
    if (url.pathname.startsWith('/player/music/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache a copy for future offline use
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(request, clonedResponse);
                        });
                    return response;
                })
                .catch(() => {
                    // If network fails, try to serve from cache
                    return caches.match(request);
                })
        );
        return;
    }

    // Handle cover images - similar strategy
    if (url.pathname.startsWith('/player/covers/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(request, clonedResponse);
                        });
                    return response;
                })
                .catch(() => {
                    return caches.match(request);
                })
        );
        return;
    }

    // For all other requests (HTML, CSS, JS, manifest, icons)
    // Use cache-first strategy for speed
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version - but also update cache in background
                    // We'll do a fetch to update cache if network is available
                    fetch(request)
                        .then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200) {
                                caches.open(CACHE_NAME)
                                    .then((cache) => {
                                        cache.put(request, networkResponse);
                                    });
                            }
                        })
                        .catch(() => { /* ignore network errors */ });
                    return cachedResponse;
                }

                // Not in cache - fetch from network
                return fetch(request)
                    .then((networkResponse) => {
                        // Cache the response for future
                        const clonedResponse = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, clonedResponse);
                            });
                        return networkResponse;
                    })
                    .catch(() => {
                        // If both cache and network fail, return a fallback for HTML
                        if (request.headers.get('Accept')?.includes('text/html')) {
                            return caches.match('/player/index.html');
                        }
                        // For other assets, return a simple error response
                        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
                    });
            })
    );
});

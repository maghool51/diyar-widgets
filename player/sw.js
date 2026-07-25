'use strict';

/* ============================================================
   sw.js — Diyar Player Service Worker
   Complete offline caching with versioning and fallback.
   ============================================================ */

// Cache version — increment to force refresh
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `diyar-player-${CACHE_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/assets/default-cover.png',
    '/assets/icons/icon-72.png',
    '/assets/icons/icon-96.png',
    '/assets/icons/icon-128.png',
    '/assets/icons/icon-144.png',
    '/assets/icons/icon-152.png',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-384.png',
    '/assets/icons/icon-512.png',
    '/assets/icons/favicon.ico'
];

// Offline fallback page (could be a simple message)
const OFFLINE_FALLBACK = '/index.html'; // Since we have a complete app, we reuse the main page

// Install event — cache static assets
self.addEventListener('install', event => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] All assets cached, skipping waiting');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('[SW] Install failed:', err);
            })
    );
});

// Activate event — clean old caches
self.addEventListener('activate', event => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName.startsWith('diyar-player-') && cacheName !== CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                        return Promise.resolve();
                    })
                );
            })
            .then(() => {
                console.log('[SW] Claiming clients');
                return self.clients.claim();
            })
    );
});

// Fetch event — network-first with cache fallback for dynamic content,
// cache-first for static assets.
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip cross-origin requests
    if (url.origin !== self.location.origin) {
        return;
    }

    // For API or non-GET requests, skip caching
    if (request.method !== 'GET') {
        return;
    }

    // For static assets (css, js, images, manifest), use cache-first
    const isStaticAsset = STATIC_ASSETS.some(asset => {
        // Check if the request URL matches any static asset
        const reqPath = url.pathname;
        // Handle root and index.html
        if (reqPath === '/' || reqPath === '/index.html') return true;
        // Check exact match or if asset is a prefix (e.g., /assets/)
        if (reqPath.startsWith('/assets/')) return true;
        // Check for specific extensions
        const ext = reqPath.split('.').pop();
        return ['css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'json'].includes(ext);
    });

    if (isStaticAsset) {
        // Cache-first strategy
        event.respondWith(
            caches.match(request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        // Return cached, but update in background
                        event.waitUntil(
                            fetch(request)
                                .then(networkResponse => {
                                    if (networkResponse && networkResponse.ok) {
                                        caches.open(CACHE_NAME)
                                            .then(cache => cache.put(request, networkResponse));
                                    }
                                })
                                .catch(() => {}) // ignore network errors
                        );
                        return cachedResponse;
                    }
                    // Not in cache, fetch from network
                    return fetch(request)
                        .then(networkResponse => {
                            if (networkResponse && networkResponse.ok) {
                                caches.open(CACHE_NAME)
                                    .then(cache => cache.put(request, networkResponse.clone()));
                            }
                            return networkResponse;
                        })
                        .catch(() => {
                            // If network fails, return offline fallback
                            return caches.match(OFFLINE_FALLBACK);
                        });
                })
        );
    } else {
        // For dynamic content (like media files, user-loaded audio/video)
        // Network-first, with cache fallback (but we might not want to cache large media)
        // We'll cache only on success if the response is not a media file
        const isMedia = url.pathname.match(/\.(mp3|aac|m4a|wav|ogg|opus|flac|mp4|webm|ogv|mkv|avi|mov)$/i);
        if (isMedia) {
            // Network-only for media files (no caching, to save storage)
            event.respondWith(
                fetch(request)
                    .catch(() => {
                        // Return a simple error response
                        return new Response('Media not available offline', { status: 503, statusText: 'Service Unavailable' });
                    })
            );
        } else {
            // Network-first for other dynamic requests (like API, if any)
            event.respondWith(
                fetch(request)
                    .then(networkResponse => {
                        // Cache successful responses (except media)
                        if (networkResponse && networkResponse.ok) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => cache.put(request, responseClone))
                                .catch(() => {});
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Fallback to cache
                        return caches.match(request)
                            .then(cachedResponse => {
                                if (cachedResponse) return cachedResponse;
                                // If nothing cached, return offline fallback
                                return caches.match(OFFLINE_FALLBACK);
                            });
                    })
            );
        }
    }
});

// Handle messages from client (e.g., skip waiting)
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

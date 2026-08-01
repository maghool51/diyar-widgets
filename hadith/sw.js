/**
 * sw.js
 * ─────────────────────────────────────────────────────────────
 * Service Worker سبک برای پشتیبانی واقعی آفلاین.
 * بدون این فایل، کش localStorage فقط داده‌ی حدیث را نگه می‌دارد؛
 * اما خودِ HTML/JS/CSS همچنان به شبکه نیاز دارند. این فایل «پوسته‌ی
 * اپ» (App Shell) را نیز کش می‌کند تا رفرش کامل صفحه بدون اینترنت
 * هم کار کند.
 *
 * استراتژی:
 *   - فایل‌های پوسته (HTML/CSS/JS/آیکون‌ها): Cache First
 *   - فایل‌های داده (hadiths.json / version.json): Network First
 *     با بازگشت به کش در صورت قطع اینترنت (تا سیستم بروزرسانی
 *     نسخه در core/cache.js همچنان بتواند نسخه‌ی تازه را وقتی
 *     آنلاین هستیم دریافت کند).
 * ─────────────────────────────────────────────────────────────
 */
'use strict';

var CACHE_NAME = 'diyar-hadith-shell-v1';

var SHELL_FILES = [
  './',
  './index.html',
  './widget.css',
  './widget.js',
  './config.js',
  './core/storage.js',
  './core/cache.js',
  './core/utils.js',
  './data/hadiths.json',
  './data/version.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isDataRequest(url) {
  return url.indexOf('/data/hadiths.json') !== -1 || url.indexOf('/data/version.json') !== -1;
}

self.addEventListener('fetch', function (event) {
  var request = event.request;

  // فقط درخواست‌های GET هم‌مبدأ را مدیریت کن
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  if (isDataRequest(request.url)) {
    // Network First → تا سیستم Version Control همیشه در آنلاین‌بودن نسخه‌ی تازه بگیرد
    event.respondWith(
      fetch(request)
        .then(function (response) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
          return response;
        })
        .catch(function () {
          return caches.match(request);
        })
    );
    return;
  }

  // Cache First برای پوسته‌ی اپ (HTML/CSS/JS/آیکون)
  event.respondWith(
    caches.match(request).then(function (cached) {
      return cached || fetch(request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
        return response;
      });
    }).catch(function () {
      // اگر هیچ‌کدام در دسترس نبود (مثلاً اولین بار و آفلاین)، خطا را برگردان
      return caches.match('./index.html');
    })
  );
});

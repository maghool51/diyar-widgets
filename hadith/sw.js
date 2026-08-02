/**
 * sw.js
 * ─────────────────────────────────────────────────────────────
 * Service Worker برای پشتیبانی واقعی آفلاین (App Shell caching).
 *
 * تاریخچه‌ی این بازبینی (برای نگهدارنده‌های بعدی):
 *   نسخه‌ی قبلی برای فایل‌های پوسته (HTML/CSS/JS) از استراتژی خالص
 *   Cache First استفاده می‌کرد. با تست تجربی (بارگذاری صفحه، سپس تغییر
 *   محتوای widget.js روی سرور بدون تغییر CACHE_NAME) ثابت شد که کاربرانِ
 *   قبلاً بازدیدکننده هرگز نسخه‌ی جدید فایل‌های پوسته را دریافت نمی‌کردند
 *   — even پس از رفرش کامل — مگر اینکه نگهدارنده به‌صورت دستی CACHE_NAME
 *   را در همین فایل تغییر می‌داد. این دقیقاً همان باگ کلاسیک PWA
 *   «گیر کردن روی نسخه‌ی قدیمی» است.
 *
 *   راه‌حل: استراتژی پوسته از Cache First به Stale-While-Revalidate تغییر
 *   کرد — یعنی پاسخ کش‌شده بلافاصله (برای سرعت/آفلاین) برگردانده می‌شود،
 *   اما هم‌زمان یک fetch در پس‌زمینه اجرا و کش برای دفعه‌ی بعد بروزرسانی
 *   می‌شود. این یعنی نیازی نیست نگهدارنده هر بار CACHE_NAME را دستی
 *   افزایش دهد؛ تغییرات حداکثر با یک بار رفرش اضافه به‌روزرسانی می‌شوند.
 * ─────────────────────────────────────────────────────────────
 */
'use strict';

// خواندن مسیر فایل‌های داده از همان منبع واحدی که widget.js/cache.js هم
// استفاده می‌کنند (رفع تکرار/DRY). config.js با الگوی
// `typeof window !== 'undefined' ? window : this` نوشته شده، و در یک
// اسکریپت کلاسیک بارگذاری‌شده با importScripts، `this` سطح بالا همان
// self (ServiceWorkerGlobalScope) است — پس HadithConfig درست روی self
// قرار می‌گیرد. اگر به هر دلیلی importScripts شکست بخورد (مثلاً مسیر
// در آینده تغییر کند)، یک fallback ایمن وجود دارد تا Service Worker
// کامل از کار نیفتد.
var CONFIG = null;
try {
  importScripts('./config.js');
  CONFIG = self.HadithConfig;
} catch (err) {
  CONFIG = null;
}

var DATA_BASE = (CONFIG && CONFIG.dataBaseUrl) || 'data';
var DATA_FILES = {
  hadiths: DATA_BASE + '/' + ((CONFIG && CONFIG.files && CONFIG.files.hadiths) || 'hadiths.json'),
  version: DATA_BASE + '/' + ((CONFIG && CONFIG.files && CONFIG.files.version) || 'version.json')
};

/**
 * شماره‌ی نسخه‌ی کش پوسته. بالا بردن این عدد باعث می‌شود مرورگر تمام
 * فایل‌های پوسته را از نو دانلود کند (برای تغییرات بزرگ/breaking مفید
 * است)؛ اما به‌خاطر Stale-While-Revalidate پایین، حتی بدون تغییر این
 * عدد هم بروزرسانی‌های عادی حداکثر با یک بار بازدید اضافه اعمال می‌شوند.
 */
var CACHE_VERSION = 2;
var CACHE_NAME = 'diyar-hadith-shell-v' + CACHE_VERSION;

var SHELL_FILES = [
  './',
  './index.html',
  './widget.css',
  './widget.js',
  './config.js',
  './core/storage.js',
  './core/cache.js',
  './core/utils.js',
  DATA_FILES.hadiths,
  DATA_FILES.version,
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // رفع باگ استحکام: cache.addAll تمام‌یا‌هیچ است — اگر فقط یکی از
      // فایل‌های SHELL_FILES با خطا مواجه شود (۴۰۴، مسیر اشتباه بعد از
      // یک تغییر آینده و...)، کل نصب Service Worker fail می‌شود و
      // پشتیبانی آفلاین برای همه‌ی فایل‌های دیگر هم از کار می‌افتد.
      // اینجا هر فایل جداگانه با Promise.allSettled اضافه می‌شود تا
      // شکست یک فایل، بقیه را از کار نیندازد.
      return Promise.allSettled(
        SHELL_FILES.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('[sw] کش‌کردن فایل ناموفق بود (نادیده گرفته شد):', url, err && err.message);
          });
        })
      );
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
  return url.indexOf(DATA_FILES.hadiths) !== -1 || url.indexOf(DATA_FILES.version) !== -1;
}

/**
 * Stale-While-Revalidate: پاسخ کش‌شده (اگر موجود) فوراً برگردانده
 * می‌شود، هم‌زمان یک fetch در پس‌زمینه کش را برای دفعه‌ی بعد بروز
 * می‌کند. اگر هیچ کشی موجود نباشد (اولین بازدید)، منتظر شبکه می‌مانیم.
 */
function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(request).then(function (cached) {
      var networkFetch = fetch(request).then(function (response) {
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(function () {
        return null; // آفلاین: صرفاً به‌روزرسانی پس‌زمینه انجام نمی‌شود
      });

      return cached || networkFetch;
    });
  });
}

/** Network First مخصوص فایل‌های داده (برای اینکه سیستم Version Control
 *  همیشه، وقتی آنلاین هستیم، جدیدترین نسخه را ببیند) */
function networkFirst(request) {
  return fetch(request)
    .then(function (response) {
      if (response && response.ok) {
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, response.clone()); });
      }
      return response;
    })
    .catch(function () {
      return caches.match(request);
    });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;

  // فقط درخواست‌های GET هم‌مبدأ را مدیریت کن
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  if (isDataRequest(request.url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(
    staleWhileRevalidate(request).catch(function () {
      // رفع باگ: نسخه‌ی قبلی برای *هر* درخواست ناموفق (حتی یک فایل CSS/JS
      // گم‌شده) index.html را با همان MIME/محتوای اشتباه برمی‌گرداند که
      // می‌توانست خطای «MIME type نامعتبر» برای اسکریپت/استایل ایجاد کند.
      // اکنون این جایگزینی فقط برای ناوبری صفحه (document) اعمال می‌شود.
      if (request.mode === 'navigate') {
        return caches.match('./index.html');
      }
      return Response.error();
    })
  );
});

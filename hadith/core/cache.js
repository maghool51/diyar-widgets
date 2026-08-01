/**
 * core/cache.js
 * ─────────────────────────────────────────────────────────────
 * مسئول:
 *   ۱) نگهداری داده‌ی احادیث در localStorage همراه با زمان انقضا (TTL)
 *   ۲) پشتیبانی آفلاین — اگر شبکه در دسترس نباشد، آخرین نسخه‌ی کش‌شده
 *      برگردانده می‌شود، حتی اگر منقضی شده باشد.
 *   ۳) سیستم Version Control — پیش از استفاده از کش، نسخه‌ی فایل
 *      version.json روی سرور را با نسخه‌ی ذخیره‌شده مقایسه می‌کند؛
 *      در صورت تفاوت، کش قدیمی کاملاً پاک و داده‌ی جدید دریافت می‌شود.
 * ─────────────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  var Storage = global.HadithStorage;
  var cfg = global.HadithConfig;

  var KEYS = {
    hadiths: 'cache:hadiths',
    version: 'cache:version',
    lastVersionCheck: 'cache:last-version-check'
  };

  function now() {
    return Date.now();
  }

  /** ساخت آدرس کامل یک فایل داده با توجه به dataBaseUrl تنظیمات */
  function dataUrl(fileName) {
    var base = cfg.dataBaseUrl.replace(/\/+$/, '');
    // اضافه کردن پارامتر ضدکش برای اطمینان از دریافت فایل تازه هنگام بروزرسانی نسخه
    return base + '/' + fileName;
  }

  /** واکشی JSON با مدیریت خطای شبکه */
  function fetchJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) {
        throw new Error('پاسخ نامعتبر از سرور: ' + res.status);
      }
      return res.json();
    });
  }

  /** خواندن نسخه‌ی محلی نصب‌شده (کش‌شده) */
  function getCachedVersion() {
    return Storage.getItem(KEYS.version);
  }

  /**
   * بررسی نسخه‌ی جدید روی سرور.
   * برای جلوگیری از درخواست‌های زیاد، بین دو بررسی حداقل فاصله‌ی
   * versionCheck.minInterval رعایت می‌شود.
   * @returns {Promise<{changed:boolean, remoteVersion:object|null}>}
   */
  function checkForUpdate() {
    var lastCheck = Storage.getItem(KEYS.lastVersionCheck) || 0;
    var minInterval = (cfg.versionCheck && cfg.versionCheck.minInterval) || 0;

    if (!cfg.versionCheck || !cfg.versionCheck.enabled) {
      return Promise.resolve({ changed: false, remoteVersion: null });
    }

    if (now() - lastCheck < minInterval) {
      return Promise.resolve({ changed: false, remoteVersion: getCachedVersion() });
    }

    return fetchJSON(dataUrl(cfg.files.version))
      .then(function (remoteVersion) {
        Storage.setItem(KEYS.lastVersionCheck, now());
        var localVersion = getCachedVersion();
        var changed = !localVersion || localVersion.version !== remoteVersion.version;
        return { changed: changed, remoteVersion: remoteVersion };
      })
      .catch(function () {
        // آفلاین یا خطای شبکه؛ فرض می‌کنیم نسخه تغییری نکرده
        return { changed: false, remoteVersion: getCachedVersion() };
      });
  }

  /** پاک کردن کامل کش قدیمی (هنگام تشخیص نسخه‌ی جدید) */
  function invalidateAll() {
    Storage.removeItem(KEYS.hadiths);
    Storage.removeItem(KEYS.version);
  }

  /**
   * دریافت لیست احادیث؛ ترتیب اولویت:
   *   ۱) اگر نسخه‌ی جدیدی وجود دارد → دریافت از شبکه و جایگزینی کش
   *   ۲) اگر کش معتبر (در بازه‌ی TTL) موجود است → همان را برگردان
   *   ۳) در غیر این صورت تلاش برای دریافت از شبکه
   *   ۴) در صورت قطع اینترنت → آخرین کش موجود (حتی منقضی‌شده) برگردانده می‌شود
   */
  function getHadiths() {
    return checkForUpdate().then(function (updateInfo) {
      if (updateInfo.changed) {
        invalidateAll();
      }

      var cached = Storage.getItem(KEYS.hadiths);
      var cacheValid = cached && cfg.cache.enabled && (now() - cached.cachedAt < cfg.cache.ttl);

      if (cacheValid && !updateInfo.changed) {
        return { hadiths: cached.data, fromCache: true, offline: false };
      }

      return fetchJSON(dataUrl(cfg.files.hadiths))
        .then(function (json) {
          var list = json.hadiths || [];
          if (cfg.cache.enabled) {
            Storage.setItem(KEYS.hadiths, { data: list, cachedAt: now() });
          }
          if (updateInfo.remoteVersion) {
            Storage.setItem(KEYS.version, updateInfo.remoteVersion);
          }
          return { hadiths: list, fromCache: false, offline: false };
        })
        .catch(function (err) {
          // شبکه در دسترس نیست: اگر کش قدیمی (حتی منقضی) داریم، همان را بده
          if (cached && cached.data && cached.data.length) {
            return { hadiths: cached.data, fromCache: true, offline: true };
          }
          throw err;
        });
    });
  }

  global.HadithCache = {
    getHadiths: getHadiths,
    checkForUpdate: checkForUpdate,
    invalidateAll: invalidateAll,
    getCachedVersion: getCachedVersion,
    KEYS: KEYS
  };
})(typeof window !== 'undefined' ? window : this);

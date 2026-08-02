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
    return base + '/' + fileName;
  }

  /** حداکثر زمان انتظار برای هر درخواست شبکه؛ پس از این مدت به کش/خطا برمی‌گردیم */
  var FETCH_TIMEOUT_MS = 8000;

  /**
   * واکشی JSON با مدیریت خطای شبکه و timeout.
   * بدون timeout، یک اتصال کند/معلق (مثلاً پشت یک captive portal) باعث
   * می‌شد اسکلتون بارگذاری تا ابد نمایش داده شود؛ اینجا با AbortController
   * پس از FETCH_TIMEOUT_MS درخواست لغو و به مسیر آفلاین/خطا سوییچ می‌شود.
   */
  function fetchJSON(url) {
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS)
      : null;

    return fetch(url, {
      cache: 'no-cache',
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) {
        throw new Error('پاسخ نامعتبر از سرور: ' + res.status);
      }
      return res.json();
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  /** در حال اجرای هم‌زمان — برای جلوگیری از درخواست‌های تکراری هنگامی که
   *  چند نمونه از ویجت روی یک صفحه هم‌زمان getHadiths را صدا می‌زنند */
  var inFlightRequest = null;

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

  /**
   * پاک کردن کامل کش (برای استفاده‌ی دستی/توسعه، مثلاً از کنسول مرورگر).
   * توجه: در جریان عادیِ بروزرسانیِ نسخه دیگر از این تابع استفاده نمی‌شود؛
   * چون حذفِ کش پیش از تضمینِ موفقیت دریافتِ داده‌ی جدید می‌تواند در صورت
   * قطع همزمان اینترنت، کاربر را بدون هیچ داده‌ای (نه جدید، نه قدیمی) رها کند.
   * به‌جای آن، getHadiths پایین فقط پس از دریافت موفق نسخه‌ی جدید، کش قدیمی
   * را جایگزین می‌کند (نگاه کنید به توضیح باگ رفع‌شده در تاریخچه‌ی تغییرات).
   */
  function invalidateAll() {
    Storage.removeItem(KEYS.hadiths);
    Storage.removeItem(KEYS.version);
  }

  /**
   * دریافت لیست احادیث؛ ترتیب اولویت:
   *   ۱) اگر کش معتبر (در بازه‌ی TTL) موجود است و نسخه تغییر نکرده → همان را برگردان
   *   ۲) در غیر این صورت (کش منقضی یا نسخه تغییر کرده) تلاش برای دریافت از شبکه
   *   ۳) در صورت موفقیت، کش قدیمی با داده‌ی تازه جایگزین می‌شود
   *   ۴) در صورت قطع اینترنت → کش قدیمی (حتی اگر نسخه‌اش قدیمی/منقضی باشد)
   *      همچنان برگردانده می‌شود؛ داشتن داده‌ی قدیمی همیشه بهتر از هیچ داده‌ای است
   */
  function getHadithsUncached() {
    return checkForUpdate().then(function (updateInfo) {
      var cached = Storage.getItem(KEYS.hadiths);
      var cacheValid = cached && cfg.cache.enabled && (now() - cached.cachedAt < cfg.cache.ttl);

      if (cacheValid && !updateInfo.changed) {
        return { hadiths: cached.data, fromCache: true, offline: false };
      }

      return fetchJSON(dataUrl(cfg.files.hadiths))
        .then(function (json) {
          var list = json.hadiths || [];
          // فقط پس از دریافتِ موفقِ داده‌ی جدید، کشِ قبلی جایگزین می‌شود
          if (cfg.cache.enabled) {
            Storage.setItem(KEYS.hadiths, { data: list, cachedAt: now() });
          }
          if (updateInfo.remoteVersion) {
            Storage.setItem(KEYS.version, updateInfo.remoteVersion);
          }
          return { hadiths: list, fromCache: false, offline: false };
        })
        .catch(function (err) {
          // شبکه در دسترس نیست یا timeout شد: اگر کش قدیمی (حتی منقضی یا
          // متعلق به نسخه‌ی قبلی) داریم، همان را بازگردان تا کاربر هرگز
          // با صفحه‌ی کاملاً خالی مواجه نشود
          if (cached && cached.data && cached.data.length) {
            return { hadiths: cached.data, fromCache: true, offline: true };
          }
          throw err;
        });
    });
  }

  /**
   * نسخه‌ی عمومی getHadiths با جلوگیری از درخواست‌های موازی تکراری:
   * اگر چند نمونه از ویجت هم‌زمان روی یک صفحه init شوند، همه از یک
   * Promise مشترک استفاده می‌کنند به‌جای اینکه هرکدام درخواست شبکه‌ی
   * جداگانه بزنند.
   */
  function getHadiths() {
    if (inFlightRequest) return inFlightRequest;

    inFlightRequest = getHadithsUncached().finally(function () {
      inFlightRequest = null;
    });

    return inFlightRequest;
  }

  global.HadithCache = {
    getHadiths: getHadiths,
    checkForUpdate: checkForUpdate,
    invalidateAll: invalidateAll,
    getCachedVersion: getCachedVersion,
    KEYS: KEYS
  };
})(typeof window !== 'undefined' ? window : this);

/**
 * core/storage.js
 * ─────────────────────────────────────────────────────────────
 * لایه‌ی ایمن روی window.localStorage با فضای‌نام‌گذاری اختصاصی.
 * در محیط‌هایی که localStorage در دسترس نیست (حالت خصوصی مرورگر،
 * iframe با محدودیت، یا Blogfa) به‌آرامی به حافظه‌ی موقت داخل
 * جاوااسکریپت سوییچ می‌کند تا ویجت هرگز خطا ندهد.
 * ─────────────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  var DEFAULT_NS = 'diyar-hadith';

  var memoryFallback = Object.create(null);
  var storageAvailable = null;

  /**
   * محاسبه‌ی فضای‌نام به‌صورت تنبل (Lazy) به‌جای یک‌بار در زمان بارگذاری فایل.
   * علت: اگر به هر دلیلی ترتیب بارگذاری اسکریپت‌ها رعایت نشود (مثلاً یک
   * صفحه‌ی میزبان config.js را بعد از storage.js بارگذاری کند)، خواندن
   * مقدار namespace در لحظه‌ی اجرای واقعی (نه در لحظه‌ی parse شدن فایل)
   * از بروز باگ‌های وابسته به ترتیب اسکریپت جلوگیری می‌کند.
   */
  function getNamespace() {
    var cfg = global.HadithConfig;
    var ns = (cfg && cfg.cache && cfg.cache.namespace) ? cfg.cache.namespace : DEFAULT_NS;
    return ns + ':';
  }

  /** آزمایش در دسترس بودن localStorage (فقط یک‌بار محاسبه می‌شود) */
  function isAvailable() {
    if (storageAvailable !== null) return storageAvailable;
    try {
      var testKey = getNamespace() + '__probe__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      storageAvailable = true;
    } catch (err) {
      storageAvailable = false;
    }
    return storageAvailable;
  }

  function nsKey(key) {
    return getNamespace() + key;
  }

  /** خواندن و JSON.parse ایمن یک مقدار */
  function getItem(key) {
    try {
      var raw = isAvailable()
        ? window.localStorage.getItem(nsKey(key))
        : (Object.prototype.hasOwnProperty.call(memoryFallback, key) ? memoryFallback[key] : null);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  /** ذخیره‌ی امن یک مقدار به‌صورت JSON */
  function setItem(key, value) {
    try {
      var raw = JSON.stringify(value);
      if (isAvailable()) {
        window.localStorage.setItem(nsKey(key), raw);
      } else {
        memoryFallback[key] = raw;
      }
      return true;
    } catch (err) {
      // مثلاً QuotaExceededError؛ ویجت باید بدون کرش ادامه یابد
      return false;
    }
  }

  function removeItem(key) {
    try {
      if (isAvailable()) {
        window.localStorage.removeItem(nsKey(key));
      } else {
        delete memoryFallback[key];
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  /** پاک‌سازی کامل تمام کلیدهای متعلق به این ویجت */
  function clearNamespace() {
    try {
      if (isAvailable()) {
        var ns = getNamespace();
        var keys = [];
        for (var i = 0; i < window.localStorage.length; i++) {
          var k = window.localStorage.key(i);
          if (k && k.indexOf(ns) === 0) keys.push(k);
        }
        keys.forEach(function (k) { window.localStorage.removeItem(k); });
      } else {
        memoryFallback = Object.create(null);
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  global.HadithStorage = {
    isAvailable: isAvailable,
    getItem: getItem,
    setItem: setItem,
    removeItem: removeItem,
    clearNamespace: clearNamespace
  };
})(typeof window !== 'undefined' ? window : this);

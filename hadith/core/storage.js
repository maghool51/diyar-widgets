/**
 * core/storage.js
 * لایه‌ی انتزاعی روی localStorage با namespace اختصاصی و مدیریت خطا.
 * در محیط‌هایی که localStorage در دسترس نیست (مثلاً iframe محدود)، به آرام‌ترین
 * شکل ممکن به یک حافظه‌ی موقت در حافظه‌ی جاوااسکریپت سوییچ می‌کند.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HadithStorage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NAMESPACE = 'hadith-widget:';
  const memoryFallback = new Map();
  let storageAvailable = null;

  function isStorageAvailable() {
    if (storageAvailable !== null) return storageAvailable;
    try {
      const testKey = `${NAMESPACE}__test__`;
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      storageAvailable = true;
    } catch (e) {
      storageAvailable = false;
    }
    return storageAvailable;
  }

  function key(k) {
    return `${NAMESPACE}${k}`;
  }

  function get(k) {
    try {
      if (isStorageAvailable()) {
        const raw = window.localStorage.getItem(key(k));
        return raw ? JSON.parse(raw) : null;
      }
      return memoryFallback.has(k) ? memoryFallback.get(k) : null;
    } catch (e) {
      return null;
    }
  }

  function set(k, value) {
    try {
      if (isStorageAvailable()) {
        window.localStorage.setItem(key(k), JSON.stringify(value));
      } else {
        memoryFallback.set(k, value);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function remove(k) {
    try {
      if (isStorageAvailable()) {
        window.localStorage.removeItem(key(k));
      } else {
        memoryFallback.delete(k);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearAll() {
    try {
      if (isStorageAvailable()) {
        Object.keys(window.localStorage)
          .filter((k) => k.startsWith(NAMESPACE))
          .forEach((k) => window.localStorage.removeItem(k));
      } else {
        memoryFallback.clear();
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  return { get, set, remove, clearAll, isStorageAvailable };
});

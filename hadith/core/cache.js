/**
 * core/cache.js
 * لایه‌ی کش با پشتیبانی از TTL، بر پایه‌ی core/storage.js ساخته شده است.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./storage.js'));
  } else {
    root.HadithCache = factory(root.HadithStorage);
  }
})(typeof self !== 'undefined' ? self : this, function (Storage) {
  'use strict';

  function isExpired(entry) {
    if (!entry || typeof entry.expiresAt !== 'number') return true;
    return Date.now() > entry.expiresAt;
  }

  /**
   * ذخیره‌ی مقدار در کش با زمان انقضا
   * @param {string} key
   * @param {*} value
   * @param {number} ttlMs
   */
  function set(key, value, ttlMs) {
    const entry = {
      value,
      cachedAt: Date.now(),
      expiresAt: Date.now() + (ttlMs || 0)
    };
    return Storage.set(key, entry);
  }

  /**
   * خواندن مقدار از کش؛ اگر منقضی شده باشد null برمی‌گرداند و پاک می‌کند
   * @param {string} key
   */
  function get(key) {
    const entry = Storage.get(key);
    if (!entry) return null;
    if (isExpired(entry)) {
      Storage.remove(key);
      return null;
    }
    return entry.value;
  }

  function invalidate(key) {
    return Storage.remove(key);
  }

  return { get, set, invalidate, isExpired };
});

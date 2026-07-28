/**
 * core/api.js
 * مسئول واکشی داده‌ی احادیث و دسته‌بندی‌ها، با پشتیبانی از کش.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./cache.js'));
  } else {
    root.HadithApi = factory(root.HadithCache);
  }
})(typeof self !== 'undefined' ? self : this, function (Cache) {
  'use strict';

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`درخواست ناموفق بود: ${url} (${res.status})`);
    }
    return res.json();
  }

  /**
   * واکشی لیست احادیث با پشتیبانی از کش
   * @param {object} config
   */
  async function getHadiths(config) {
    const cacheKey = 'hadiths-data';

    if (config.cacheEnabled) {
      const cached = Cache.get(cacheKey);
      if (cached) return cached;
    }

    const url = `${config.dataBaseUrl}/hadiths.json`;
    const data = await fetchJSON(url);
    const list = data.hadiths || [];

    if (config.cacheEnabled) {
      Cache.set(cacheKey, list, config.cacheTTL);
    }

    return list;
  }

  /**
   * واکشی لیست دسته‌بندی‌ها با پشتیبانی از کش
   * @param {object} config
   */
  async function getCategories(config) {
    const cacheKey = 'hadiths-categories';

    if (config.cacheEnabled) {
      const cached = Cache.get(cacheKey);
      if (cached) return cached;
    }

    const url = `${config.dataBaseUrl}/categories.json`;
    const data = await fetchJSON(url);
    const list = data.categories || [];

    if (config.cacheEnabled) {
      Cache.set(cacheKey, list, config.cacheTTL);
    }

    return list;
  }

  return { getHadiths, getCategories, fetchJSON };
});

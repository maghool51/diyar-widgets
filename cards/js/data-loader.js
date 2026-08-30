/**
 * data-loader.js — بارگذاری فایل‌های داده (data/*.json). افزودن
 * دسته/طرح/متن جدید فقط با ویرایش همین فایل‌های JSON انجام می‌شود؛
 * این فایل چیزی درباره‌ی محتوا نمی‌داند و فقط آن‌ها را می‌خواند.
 */
(function (global) {
  'use strict';

  async function fetchJson(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error('خطا در بارگذاری ' + path);
    return res.json();
  }

  async function loadAllData(baseUrl) {
    const base = baseUrl || 'data/';
    const [categories, occasions, templates, messages] = await Promise.all([
      fetchJson(base + 'categories.json'),
      fetchJson(base + 'occasions.json'),
      fetchJson(base + 'templates.json'),
      fetchJson(base + 'messages.json')
    ]);
    return { categories, occasions, templates, messages };
  }

  global.DiyarCardData = { loadAllData };
})(typeof window !== 'undefined' ? window : this);

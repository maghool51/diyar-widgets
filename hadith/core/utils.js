/**
 * core/utils.js
 * توابع کمکی عمومی مورد استفاده در سراسر ویجت
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HadithUtils = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** جلوگیری از اجرای مکرر یک تابع در بازه زمانی کوتاه */
  function debounce(fn, wait) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /** تولید شناسه‌ی تصادفی کوتاه */
  function generateId(prefix = 'hw') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /** پاکسازی ساده‌ی HTML برای جلوگیری از XSS در متن‌های پویا */
  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** گرفتن شماره‌ی روز سال، برای انتخاب حدیث روزانه ثابت */
  function dayOfYear(date = new Date()) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /** انتخاب یک آیتم ثابت بر اساس روز (برای حالت daily) */
  function pickDaily(list, date = new Date()) {
    if (!Array.isArray(list) || list.length === 0) return null;
    const idx = dayOfYear(date) % list.length;
    return list[idx];
  }

  /** انتخاب تصادفی از یک آرایه */
  function pickRandom(list) {
    if (!Array.isArray(list) || list.length === 0) return null;
    const idx = Math.floor(Math.random() * list.length);
    return list[idx];
  }

  /** فرمت‌دهی ساده تاریخ به شکل YYYY-MM-DD */
  function formatDate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** ادغام امن دو شیء (shallow merge) */
  function merge(a, b) {
    return Object.assign({}, a || {}, b || {});
  }

  return {
    debounce,
    generateId,
    escapeHTML,
    dayOfYear,
    pickDaily,
    pickRandom,
    formatDate,
    merge
  };
});

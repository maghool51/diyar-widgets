/**
 * core/utils.js — کمکی‌های عمومی. الگو مطابق سایر ویجت‌های دیار
 * (IIFE روی window، بدون bundler) تا مستقیم روی GitHub Pages کار کند.
 */
(function (global) {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** جایگزین امن innerHTML — همیشه فقط متن خام کاربر را ست می‌کند */
  function setText(el, text) {
    if (!el) return;
    el.textContent = text == null ? '' : String(text);
  }

  const PERSIAN_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  function toPersianDigits(input) {
    return String(input == null ? '' : input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[+d]);
  }

  /** حذف کاراکترهای کنترلی/تگ احتمالی و محدودکردن طول — برای متن‌های آزاد کاربر */
  function sanitizeText(input, maxLen) {
    let s = String(input == null ? '' : input);
    s = s.replace(/<[^>]*>/g, ''); // حذف هر تگ احتمالی
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); // کاراکترهای کنترلی
    s = s.trim();
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
    return s;
  }

  function debounce(fn, wait) {
    let t;
    return function debounced(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function showToast(el, message, duration) {
    if (!el) return;
    setText(el, message);
    el.setAttribute('data-show', 'true');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.setAttribute('data-show', 'false'), duration || 2200);
  }

  global.DiyarCardUtils = { $, qs, qsa, setText, toPersianDigits, sanitizeText, debounce, showToast };
})(typeof window !== 'undefined' ? window : this);

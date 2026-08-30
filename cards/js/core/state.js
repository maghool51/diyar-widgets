/**
 * core/state.js — استیت مرکزی برنامه + الگوی ساده‌ی pub/sub.
 * فیلدهای state دقیقاً همان‌هایی هستند که در core/url.js به URL
 * تبدیل می‌شوند (کلیدهای کوتاه در url.js).
 */
(function (global) {
  'use strict';

  function createStore(initial) {
    let state = Object.assign({
      step: 'category',      // category | occasion | template | form | done
      categoryId: null,
      occasionId: null,
      templateId: null,
      to: '',                // نام گیرنده
      title: '',              // عنوان (مثلاً «دوست عزیزم»)
      message: '',
      from: ''                // نام فرستنده
    }, initial || {});

    const listeners = [];

    return {
      get: () => state,
      set(patch) {
        state = Object.assign({}, state, patch);
        listeners.forEach((fn) => fn(state));
      },
      subscribe(fn) { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); }
    };
  }

  global.DiyarCardState = { createStore };
})(typeof window !== 'undefined' ? window : this);

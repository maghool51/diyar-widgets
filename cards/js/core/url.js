/**
 * core/url.js — تبدیل state به یک URL کوتاه و قابل‌اشتراک و برعکس.
 * چون Backend نداریم، تمام اطلاعات کارت در Query String کدگذاری
 * می‌شود. کلیدها کوتاه نگه داشته شده‌اند تا لینک کوتاه‌تر بماند.
 *
 * نگاشت کلیدها: c=category, o=occasion, t=template,
 *                r=گیرنده(to), g=عنوان(title), m=پیام, f=فرستنده
 */
(function (global) {
  'use strict';

  const MAX_NAME = 40;
  const MAX_TITLE = 60;
  const MAX_MESSAGE = 400;

  function buildShareUrl(state) {
    const params = new URLSearchParams();
    if (state.categoryId) params.set('c', state.categoryId);
    if (state.occasionId) params.set('o', state.occasionId);
    if (state.templateId) params.set('t', state.templateId);
    if (state.to) params.set('r', state.to);
    if (state.title) params.set('g', state.title);
    if (state.message) params.set('m', state.message);
    if (state.from) params.set('f', state.from);

    const base = global.location.origin + global.location.pathname;
    return base + '?' + params.toString();
  }

  function readStateFromUrl() {
    const params = new URLSearchParams(global.location.search);
    if (![...params.keys()].length) return null;
    const U = global.DiyarCardUtils;
    return {
      categoryId: U.sanitizeText(params.get('c') || '', 60) || null,
      occasionId: U.sanitizeText(params.get('o') || '', 60) || null,
      templateId: U.sanitizeText(params.get('t') || '', 60) || null,
      to: U.sanitizeText(params.get('r') || '', MAX_NAME),
      title: U.sanitizeText(params.get('g') || '', MAX_TITLE),
      message: U.sanitizeText(params.get('m') || '', MAX_MESSAGE),
      from: U.sanitizeText(params.get('f') || '', MAX_NAME)
    };
  }

  global.DiyarCardUrl = { buildShareUrl, readStateFromUrl, MAX_NAME, MAX_TITLE, MAX_MESSAGE };
})(typeof window !== 'undefined' ? window : this);

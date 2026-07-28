/**
 * config.js
 * تنظیمات پیش‌فرض ویجت حدیث
 * این تنظیمات هنگام مقداردهی اولیه ویجت با گزینه‌های کاربر ادغام می‌شود.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HadithWidgetConfig = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_CONFIG = {
    // آدرس پایه‌ی داده‌ها (می‌تواند لوکال یا CDN باشد)
    dataBaseUrl: './data',

    // زبان نمایش: 'fa' | 'ar' | 'en'
    language: 'fa',

    // تم ظاهری: 'light' | 'dark' | 'auto'
    theme: 'light',

    // دسته‌بندی پیش‌فرض ('all' یعنی بدون فیلتر)
    category: 'all',

    // نمایش نام راوی و منبع
    showNarrator: true,
    showSource: true,

    // دکمه اشتراک‌گذاری
    enableShare: true,

    // بروزرسانی خودکار حدیث (به میلی‌ثانیه، صفر یعنی غیرفعال)
    autoRefreshInterval: 0,

    // کش کردن داده در localStorage
    cacheEnabled: true,
    cacheTTL: 1000 * 60 * 60 * 6, // ۶ ساعت

    // انتخاب حدیث: 'random' | 'daily' | 'sequential'
    selectionMode: 'daily',

    // جهت متن
    direction: 'rtl',

    // فونت سفارشی (اختیاری)
    fontFamily: null,

    // شناسه‌ی کانتینر HTML برای رندر ویجت
    containerId: 'hadith-widget',

    // فراخوانی هنگام بارگذاری موفق حدیث
    onLoad: null,

    // فراخوانی هنگام خطا
    onError: null
  };

  function mergeConfig(userConfig) {
    return Object.assign({}, DEFAULT_CONFIG, userConfig || {});
  }

  return {
    defaults: DEFAULT_CONFIG,
    merge: mergeConfig
  };
});

/**
 * config.js
 * ─────────────────────────────────────────────────────────────
 * تمام تنظیمات قابل تغییر ویجت «حدیث روز» در این فایل قرار دارد.
 * سایر ماژول‌ها (storage.js, cache.js, utils.js, widget.js) فقط
 * از این فایل تنظیمات را می‌خوانند و هیچ مقدار ثابتی را در خود
 * تکرار نمی‌کنند.
 *
 * این فایل به‌صورت سراسری (Global) روی window.HadithConfig
 * در دسترس قرار می‌گیرد تا در GitHub Pages و Blogfa بدون نیاز
 * به bundler قابل استفاده باشد.
 * ─────────────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  var HadithConfig = {
    /** مسیر پایه‌ی داده‌ها — نسبی، تا هم روی GitHub Pages و هم زیرپوشه کار کند */
    dataBaseUrl: 'data',

    /** فایل‌های داده */
    files: {
      hadiths: 'hadiths.json',
      version: 'version.json'
    },

    /** زبان ثابت رابط کاربری (فعلاً فقط فارسی پشتیبانی می‌شود) */
    language: 'fa',
    direction: 'rtl',

    /** تبدیل خودکار ارقام لاتین به فارسی در تمام متن‌های ویجت */
    usePersianDigits: true,

    /** تم ظاهری: 'light' | 'dark' | 'auto' (پیرو ترجیح سیستم) */
    theme: 'auto',

    /** دسته‌بندی پیش‌فرض؛ 'all' یعنی بدون فیلتر */
    category: 'all',

    /**
     * حالت انتخاب حدیث:
     *  'daily'  → یک حدیث ثابت برای هر روز (بدون تکرار در یک چرخه‌ی کامل)
     *  'random' → حدیث تصادفی با جلوگیری از تکرار نزدیک
     */
    selectionMode: 'daily',

    /** نمایش موارد مختلف در کارت */
    ui: {
      showSource: true,
      showBook: true,
      showCategory: true,
      showShareButton: true,
      showCopyButton: true,
      showPrintButton: true,
      showNextButton: true,
      showRandomButton: true,
      /**
       * فاصله‌ی زمانی محافظ کلیک روی دکمه‌ها (میلی‌ثانیه). برخلاف نسخه‌ی
       * قبلی که از debounce (تأخیر در همان کلیک اول) استفاده می‌کرد، اکنون
       * کلیک اول بلافاصله اجرا می‌شود و فقط کلیک‌های *بعدی* تا پایان این
       * بازه نادیده گرفته می‌شوند (نگاه کنید به core/utils.js#createClickGuard).
       */
      buttonCooldownMs: 250
    },

    /** تنظیمات کش */
    cache: {
      enabled: true,
      /** مدت اعتبار کش داده‌ها (میلی‌ثانیه) — ۱۲ ساعت */
      ttl: 1000 * 60 * 60 * 12,
      /** کلید فضای‌نام‌گذاری‌شده در localStorage */
      namespace: 'diyar-hadith'
    },

    /** بررسی نسخه‌ی داده و بروزرسانی خودکار */
    versionCheck: {
      enabled: true,
      /** حداقل فاصله بین دو بررسی نسخه (میلی‌ثانیه) — ۱ ساعت */
      minInterval: 1000 * 60 * 60
    },

    /** شناسه‌ی عنصر HTML میزبان ویجت */
    containerId: 'diyar-hadith-widget',

    /** آدرس GitHub Pages برای ساخت کد Embed / iframe */
    embedBaseUrl: 'https://maghool51.github.io/diyar-widgets/hadith/',

    /** فراخوانی‌های اختیاری کاربر ویجت */
    callbacks: {
      onReady: null,   // function(hadith)
      onChange: null,  // function(hadith)
      onError: null    // function(error)
    }
  };

  global.HadithConfig = HadithConfig;
})(typeof window !== 'undefined' ? window : this);

/**
 * core/utils.js
 * ─────────────────────────────────────────────────────────────
 * توابع عمومی مستقل از DOM: تبدیل ارقام فارسی، انتخاب حدیث روز
 * بدون تکرار، پاک‌سازی XSS، اشتراک‌گذاری/کپی/چاپ.
 * ─────────────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  var PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

  /** تبدیل هر رقم لاتین موجود در یک رشته/عدد به معادل فارسی آن */
  function toPersianDigits(input) {
    return String(input).replace(/[0-9]/g, function (d) {
      return PERSIAN_DIGITS[Number(d)];
    });
  }

  /**
   * پاک‌سازی متن قبل از درج در DOM برای جلوگیری از XSS.
   * چون در widget.js همه‌جا از textContent استفاده می‌شود این تابع
   * به‌عنوان یک لایه‌ی دفاعی دوم برای مواردی است که innerHTML لازم شود.
   */
  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** اعتبارسنجی حداقلی ساختار یک آیتم حدیث؛ آیتم‌های ناقص/مخرب حذف می‌شوند */
  function isValidHadith(item) {
    return !!item &&
      (typeof item.id === 'number' || typeof item.id === 'string') &&
      typeof item.text === 'string' &&
      item.text.trim().length > 0;
  }

  function sanitizeHadithList(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(isValidHadith);
  }

  /** شماره‌ی روز سال میلادی جاری (۱ تا ۳۶۵/۳۶۶) */
  function dayOfYear(date) {
    date = date || new Date();
    var start = new Date(date.getFullYear(), 0, 0);
    var diff = date - start;
    return Math.floor(diff / 86400000);
  }

  /**
   * تولید یک ترتیب شبه‌تصادفی اما تکرارپذیر (seeded) از اندیس‌های
   * ۰..n-1 با استفاده از الگوریتم Fisher–Yates و PRNG ساده‌ی خطی.
   * این ترتیب برای هر سال ثابت است تا «حدیث روز» در طول روز تغییر
   * نکند اما در طول یک چرخه‌ی کامل (n روز) هیچ حدیثی تکرار نشود.
   */
  function seededShuffle(n, seed) {
    var arr = [];
    for (var i = 0; i < n; i++) arr.push(i);

    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;

    function nextRandom() {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    }

    for (var j = arr.length - 1; j > 0; j--) {
      var k = Math.floor(nextRandom() * (j + 1));
      var tmp = arr[j];
      arr[j] = arr[k];
      arr[k] = tmp;
    }
    return arr;
  }

  /**
   * انتخاب «حدیث روز»: بر اساس سال + روزِ سال، یک اندیس ثابت اما
   * غیرتکراری (در طول یک چرخه‌ی کامل) از لیست انتخاب می‌شود.
   */
  function pickDailyHadith(list, date) {
    if (!list.length) return null;
    date = date || new Date();
    var order = seededShuffle(list.length, date.getFullYear());
    var idx = order[dayOfYear(date) % list.length];
    return list[idx];
  }

  /**
   * انتخاب تصادفی با جلوگیری از تکرار نزدیک: شناسه‌ی آیتم‌های
   * اخیراً نمایش‌داده‌شده در recentIds نگه داشته می‌شود؛ وقتی همه‌ی
   * آیتم‌ها یک‌بار دیده شدند، چرخه از نو آغاز می‌شود.
   * @param {Array} list
   * @param {Array} recentIds  آرایه‌ای از id هایی که اخیراً دیده شده‌اند
   * @returns {{ hadith:object, recentIds:Array }}
   */
  function pickRandomHadith(list, recentIds) {
    if (!list.length) return { hadith: null, recentIds: [] };
    recentIds = Array.isArray(recentIds) ? recentIds.slice() : [];

    var remaining = list.filter(function (h) {
      return recentIds.indexOf(h.id) === -1;
    });

    if (!remaining.length) {
      recentIds = [];
      remaining = list;
    }

    var pick = remaining[Math.floor(Math.random() * remaining.length)];
    recentIds.push(pick.id);

    // محدود کردن اندازه‌ی تاریخچه به اندازه‌ی کل لیست (منطقی و بدون رشد بی‌نهایت)
    if (recentIds.length > list.length) {
      recentIds = recentIds.slice(recentIds.length - list.length);
    }

    return { hadith: pick, recentIds: recentIds };
  }

  /** ساخت متن نهایی برای اشتراک‌گذاری/کپی از روی یک آیتم حدیث */
  function buildShareText(hadith) {
    if (!hadith) return '';
    var parts = [];
    if (hadith.arabic) parts.push(hadith.arabic);
    parts.push(hadith.text);
    var meta = [];
    if (hadith.source) meta.push(hadith.source);
    if (hadith.book) meta.push(hadith.book);
    if (meta.length) parts.push('— ' + meta.join('، '));
    return parts.join('\n');
  }

  /** کپی متن در کلیپ‌بورد با پشتیبانی از مرورگرهای قدیمی */
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        return true;
      }).catch(function () {
        return legacyCopy(text);
      });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (err) {
      return false;
    }
  }

  /** اشتراک‌گذاری با Web Share API و بازگشت به کپی در صورت نبود آن */
  function shareText(text, title) {
    if (navigator.share) {
      return navigator.share({ text: text, title: title || 'حدیث' }).then(function () {
        return { ok: true, method: 'share' };
      }).catch(function () {
        return copyToClipboard(text).then(function (ok) {
          return { ok: ok, method: 'copy' };
        });
      });
    }
    return copyToClipboard(text).then(function (ok) {
      return { ok: ok, method: 'copy' };
    });
  }

  /** باز کردن یک پنجره‌ی چاپ ساده و ایمن حاوی متن حدیث جاری (عربی + ترجمه) */
  function printHadith(hadith) {
    if (!hadith) return;
    var win = window.open('', '_blank', 'width=480,height=640');
    if (!win) return; // popup blocker

    var safeArabic = hadith.arabic ? escapeHTML(hadith.arabic) : '';
    var safeText = escapeHTML(hadith.text);
    var safeSource = escapeHTML(hadith.source || '');
    var safeBook = escapeHTML(hadith.book || '');

    win.document.open();
    win.document.write(
      '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">' +
      '<title>چاپ حدیث</title>' +
      '<style>body{font-family:Tahoma,sans-serif;padding:32px;line-height:2;}' +
      'p.arabic{font-size:19px;font-weight:600;margin-bottom:14px}' +
      'p.text{font-size:18px}p.meta{color:#555;font-size:14px}</style></head><body>' +
      (safeArabic ? '<p class="arabic" lang="ar" dir="rtl">' + safeArabic + '</p>' : '') +
      '<p class="text">' + safeText + '</p>' +
      '<p class="meta">' + [safeSource, safeBook].filter(Boolean).join('، ') + '</p>' +
      '</body></html>'
    );
    win.document.close();
    win.focus();
    win.print();
  }

  /**
   * debounce ساده (لبه‌ی پایانی/trailing edge). توجه: هر فراخوانی —
   * حتی تک‌کلیک اول — به‌اندازه‌ی wait میلی‌ثانیه به تأخیر می‌افتد.
   * برای دکمه‌های ویجت به‌جای این تابع از createClickGuard استفاده کنید؛
   * این تابع فقط برای مواردی نگه داشته شده که تأخیر واقعاً مطلوب است
   * (مثلاً محدود کردن نرخ فراخوانی یک رویداد پرتکرار مثل resize/scroll).
   */
  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  /**
   * محافظ کلیک (throttle با لبه‌ی ابتدایی/leading edge): برخلاف debounce،
   * اولین کلیک بلافاصله و بدون هیچ تأخیری اجرا می‌شود — این برای واکنش‌گرا
   * نگه‌داشتن کارت حدیث مهم است (نباید کاربر ۱۵۰ میلی‌ثانیه صبر کند تا
   * حدیث بعدی ظاهر شود). کلیک‌های بعدی تا پایان cooldownMs نادیده گرفته
   * می‌شوند تا از رویدادهای تصادفی/دوبار-کلیک محافظت شود.
   */
  function createClickGuard(fn, cooldownMs) {
    var locked = false;
    return function () {
      if (locked) return;
      locked = true;
      var args = arguments;
      var ctx = this;
      fn.apply(ctx, args);
      setTimeout(function () { locked = false; }, cooldownMs);
    };
  }

  global.HadithUtils = {
    toPersianDigits: toPersianDigits,
    escapeHTML: escapeHTML,
    sanitizeHadithList: sanitizeHadithList,
    dayOfYear: dayOfYear,
    seededShuffle: seededShuffle,
    pickDailyHadith: pickDailyHadith,
    pickRandomHadith: pickRandomHadith,
    buildShareText: buildShareText,
    copyToClipboard: copyToClipboard,
    shareText: shareText,
    printHadith: printHadith,
    debounce: debounce,
    createClickGuard: createClickGuard
  };
})(typeof window !== 'undefined' ? window : this);

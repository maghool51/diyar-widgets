/**
 * core/share.js
 * مسئول اشتراک‌گذاری حدیث جاری از طریق Web Share API یا کپی در کلیپ‌بورد.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HadithShare = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function buildShareText(hadith, config) {
    if (!hadith) return '';
    const field = config.language === 'en' ? 'translation_en' : 'translation_fa';
    const text = hadith[field] || hadith.text;
    const source = hadith.source ? `\n— ${hadith.source}` : '';
    return `${text}${source}`;
  }

  async function share(hadith, config) {
    const text = buildShareText(hadith, config);
    if (!text) return { ok: false, method: null };

    if (navigator.share) {
      try {
        await navigator.share({ text, title: 'حدیث' });
        return { ok: true, method: 'web-share' };
      } catch (e) {
        // کاربر اشتراک‌گذاری را لغو کرده یا خطا رخ داده؛ به کپی برمی‌گردیم
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return { ok: true, method: 'clipboard' };
      } catch (e) {
        return { ok: false, method: 'clipboard', error: e };
      }
    }

    return { ok: false, method: null };
  }

  return { share, buildShareText };
});

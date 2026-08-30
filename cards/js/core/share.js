/**
 * core/share.js — اشتراک‌گذاری لینک کارت از طریق Web Share API یا کپی
 * در کلیپ‌بورد. الگو مطابق hadith/core/share.js برای هماهنگی با بقیه‌ی
 * پروژه.
 */
(function (global) {
  'use strict';

  async function shareUrl(url, titleText) {
    if (global.navigator && global.navigator.share) {
      try {
        await global.navigator.share({ title: titleText || 'کارت‌پستال دیجیتال دیار قدمگاه', url });
        return { ok: true, method: 'web-share' };
      } catch (e) {
        // کاربر لغو کرده یا خطا رخ داده؛ به کپی برمی‌گردیم
      }
    }
    return copyToClipboard(url);
  }

  async function copyToClipboard(text) {
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      try {
        await global.navigator.clipboard.writeText(text);
        return { ok: true, method: 'clipboard' };
      } catch (e) {
        return legacyCopy(text);
      }
    }
    return legacyCopy(text);
  }

  function legacyCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return { ok: true, method: 'legacy-clipboard' };
    } catch (e) {
      return { ok: false, method: null, error: e };
    }
  }

  global.DiyarCardShare = { shareUrl, copyToClipboard };
})(typeof window !== 'undefined' ? window : this);

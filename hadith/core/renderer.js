/**
 * core/renderer.js
 * مسئول ساخت و به‌روزرسانی ساختار DOM ویجت.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./utils.js'));
  } else {
    root.HadithRenderer = factory(root.HadithUtils);
  }
})(typeof self !== 'undefined' ? self : this, function (Utils) {
  'use strict';

  const FIELD_BY_LANG = {
    fa: 'translation_fa',
    en: 'translation_en',
    ar: 'text'
  };

  function createSkeleton(container, config) {
    container.classList.add('hw-container');
    container.setAttribute('dir', config.direction);
    container.setAttribute('data-theme', config.theme);
    if (config.fontFamily) {
      container.style.fontFamily = config.fontFamily;
    }

    container.innerHTML = `
      <div class="hw-card" role="region" aria-live="polite">
        <div class="hw-card-header">
          <span class="hw-badge">حدیث</span>
        </div>
        <blockquote class="hw-text"></blockquote>
        <div class="hw-meta">
          <span class="hw-narrator"></span>
          <span class="hw-source"></span>
        </div>
        <div class="hw-actions">
          <button type="button" class="hw-btn hw-refresh" aria-label="حدیث دیگر">⟳</button>
          <button type="button" class="hw-btn hw-share" aria-label="اشتراک‌گذاری">↗</button>
        </div>
        <div class="hw-footer">
          <a class="hw-brand" href="#" target="_blank" rel="noopener">ویجت حدیث</a>
        </div>
      </div>
    `;

    return {
      card: container.querySelector('.hw-card'),
      textEl: container.querySelector('.hw-text'),
      narratorEl: container.querySelector('.hw-narrator'),
      sourceEl: container.querySelector('.hw-source'),
      refreshBtn: container.querySelector('.hw-refresh'),
      shareBtn: container.querySelector('.hw-share')
    };
  }

  function renderHadith(refs, hadith, config) {
    if (!hadith) {
      refs.textEl.textContent = 'حدیثی برای نمایش یافت نشد.';
      refs.narratorEl.textContent = '';
      refs.sourceEl.textContent = '';
      return;
    }

    const field = FIELD_BY_LANG[config.language] || 'translation_fa';
    const text = hadith[field] || hadith.translation_fa || hadith.text;

    refs.textEl.textContent = text;
    refs.narratorEl.textContent = config.showNarrator && hadith.narrator
      ? `راوی: ${hadith.narrator}`
      : '';
    refs.sourceEl.textContent = config.showSource && hadith.source
      ? hadith.source
      : '';

    refs.narratorEl.style.display = refs.narratorEl.textContent ? '' : 'none';
    refs.sourceEl.style.display = refs.sourceEl.textContent ? '' : 'none';
    refs.shareBtn.style.display = config.enableShare ? '' : 'none';

    refs.card.classList.remove('hw-fade-in');
    // reflow برای ری‌استارت انیمیشن
    void refs.card.offsetWidth;
    refs.card.classList.add('hw-fade-in');
  }

  function renderError(refs, message) {
    refs.textEl.textContent = message || 'خطا در بارگذاری حدیث.';
    refs.narratorEl.textContent = '';
    refs.sourceEl.textContent = '';
  }

  return { createSkeleton, renderHadith, renderError };
});

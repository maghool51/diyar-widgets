/**
 * core/experience.js — ارکستراتور تجربه‌ی «پاکت → خروج کارت → باز
 * شدن → نمایش مرحله‌ای متن → جلوه‌ها». فقط برای Templateهایی که
 * فیلد "experience" دارند فعال می‌شود (فعلاً فقط birthday-shad)؛
 * برای بقیه، و در حالت prefers-reduced-motion، و در هر خطای
 * غیرمنتظره، مستقیماً کارت باز و کامل نمایش داده می‌شود — هرگز
 * صفحه‌ی خالی.
 *
 * معماری قابل‌توسعه: هر مناسبت می‌تواند بعداً experience اختصاصی خودش
 * را در EXPERIENCE_BUILDERS تعریف کند (envelope → reveal → card →
 * effects → music). فعلاً فقط "envelope" پیاده شده است.
 */
(function (global) {
  'use strict';

  const U = global.DiyarCardUtils;
  const R = global.DiyarCardRender;

  function prefersReducedMotion() {
    try { return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  function buildCardData(tpl, cardData) {
    return Object.assign({}, cardData, {
      layout: tpl.layout, palette: tpl.palette, icon: tpl.icon,
      templateId: tpl.id, headline: tpl.headline
    });
  }

  /** مسیر مستقیم/پشتیبان: کارت باز و کامل، بدون توالی پاکت (برای Reduced Motion، Templateهای بدون experience، یا هر خطا) */
  function renderDirect(container, musicContainer, tpl, cardData) {
    container.textContent = '';
    const cardEl = R.buildCardSkeleton(container);
    R.updateCard(cardEl, buildCardData(tpl, cardData));
    if (global.DiyarCardEffects) global.DiyarCardEffects.playCardEffects(cardEl, tpl.effects);
    if (global.DiyarCardMusic && musicContainer) global.DiyarCardMusic.createMusicToggle(musicContainer, tpl.music);
    return cardEl;
  }

  function revealCardContent(cardEl, tpl) {
    const order = ['.dq-card__headline', '.dq-card__icon', '.dq-card__to', '.dq-card__title', '.dq-card__message', '.dq-card__from'];
    order.forEach((sel, i) => {
      const el = cardEl.querySelector(sel);
      if (!el) return;
      el.style.setProperty('--reveal-delay', (i * 0.16) + 's');
      el.classList.add('dq-exp-reveal');
    });
    setTimeout(() => {
      if (global.DiyarCardEffects) global.DiyarCardEffects.playCardEffects(cardEl, tpl.effects);
    }, order.length * 160 + 150);
  }

  function runEnvelope(container, musicContainer, tpl, cardData) {
    container.textContent = '';

    const stage = document.createElement('div');
    stage.className = 'dq-exp-stage';
    stage.setAttribute('data-palette', tpl.palette);

    const envelope = document.createElement('button');
    envelope.type = 'button';
    envelope.className = 'dq-envelope';
    envelope.setAttribute('aria-label', 'برای باز کردن کارت لمس کنید');

    const body = document.createElement('div'); body.className = 'dq-envelope__body';
    const flap = document.createElement('div'); flap.className = 'dq-envelope__flap';
    const brand = document.createElement('div'); brand.className = 'dq-envelope__brand';
    brand.textContent = '🏡 دیار قدمگاه';
    envelope.append(body, flap, brand);

    const hint = document.createElement('p');
    hint.className = 'dq-exp-hint';
    hint.textContent = '💌 برای باز کردن کارت لمس کنید';

    stage.append(envelope, hint);
    container.appendChild(stage);

    const musicController = global.DiyarCardMusic && tpl.music
      ? global.DiyarCardMusic.createMusicController(tpl.music)
      : null;

    let opened = false;
    envelope.addEventListener('click', () => {
      if (opened) return;
      opened = true;
      envelope.disabled = true;
      hint.classList.add('dq-exp-hidden');
      envelope.classList.add('dq-envelope--open');

      // موسیقی باید همین‌جا، همزمان با همین لمس، شروع شود (نه بعد از تأخیر)
      if (musicController) {
        musicController.start();
        if (musicContainer) {
          const { wrap } = musicController.getButton();
          musicContainer.textContent = '';
          musicContainer.appendChild(wrap);
        }
      }

      if (global.DiyarCardEffects) global.DiyarCardEffects.sparkleBurst(envelope, 7);

      setTimeout(() => {
        stage.removeChild(envelope);
        hint.remove();

        const cardWrap = document.createElement('div');
        cardWrap.className = 'dq-exp-card-enter';
        stage.appendChild(cardWrap);

        const cardEl = R.buildCardSkeleton(cardWrap);
        R.updateCard(cardEl, buildCardData(tpl, cardData));

        cardWrap.addEventListener('animationend', function onEmerge(e) {
          if (e.animationName !== 'dq-exp-card-emerge') return; // نادیده گرفتن رویدادهای Bubble‌شده از انیمیشن‌های دیگر (مثل dq-card-in خودِ .dq-card)
          cardWrap.removeEventListener('animationend', onEmerge);
          cardEl.classList.add('dq-exp-card-unfold');
          cardEl.addEventListener('animationend', function onUnfold(e2) {
            if (e2.animationName !== 'dq-exp-unfold') return;
            cardEl.removeEventListener('animationend', onUnfold);
            revealCardContent(cardEl, tpl);
          });
        });
      }, 820); // مطابق مدت‌زمان انیمیشن باز شدن flap
    }, { once: true });
  }

  const EXPERIENCE_BUILDERS = { envelope: runEnvelope };

  /**
   * نقطه‌ی ورود اصلی. container = ظرف کارت (مثل viewerPreview یا
   * sharePreview)، musicContainer = ظرف کوچک دکمه‌ی موسیقی.
   */
  function reveal(container, musicContainer, tpl, cardData) {
    if (!container || !tpl) return null;

    if (!tpl.experience || prefersReducedMotion()) {
      return renderDirect(container, musicContainer, tpl, cardData);
    }

    const builder = EXPERIENCE_BUILDERS[tpl.experience];
    if (!builder) return renderDirect(container, musicContainer, tpl, cardData);

    try {
      builder(container, musicContainer, tpl, cardData);
      return null; // کارت به‌صورت پویا و با تأخیر ساخته می‌شود؛ ارجاع مستقیم لازم نیست
    } catch (e) {
      // جلوه‌ی سینمایی هرگز نباید باعث صفحه‌ی خالی شود
      return renderDirect(container, musicContainer, tpl, cardData);
    }
  }

  global.DiyarCardExperience = { reveal };
})(typeof window !== 'undefined' ? window : this);

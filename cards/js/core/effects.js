/**
 * core/effects.js — جلوه‌های بصری ظریف و اختیاری برای لحظه‌ی «نمایش
 * نهایی» کارت (حالت Viewer و پنل اشتراک‌گذاری) — نه برای Live Preview
 * فرم یا کارت‌های کوچک گالری، تا آن‌ها همچنان سریع و ساده بمانند.
 *
 * فقط وقتی اجرا می‌شود که Template متناظر فیلد "effects" داشته باشد؛
 * برای بقیه‌ی Templateها هرگز صدا زده نمی‌شود و کارت دقیقاً مثل قبل
 * می‌ماند.
 */
(function (global) {
  'use strict';

  function prefersReducedMotion() {
    try {
      return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function makeEl(className, styleText) {
    const el = document.createElement('span');
    el.className = className;
    el.setAttribute('style', styleText);
    return el;
  }

  /** جلوه‌ی مخصوص کارت تولد: بادکنک شناور + ستاره‌ی چشمک‌زن + ذرات نور + قلب‌های ظریف + کنفتی ورودی + Glow */
  function birthdayConfetti(fxLayer) {
    const balloons = ['🎈', '🎈', '🎈'];
    balloons.forEach((emoji, i) => {
      const left = 10 + i * 32 + rand(-6, 6);
      const delay = i * 1.4 + rand(0, 0.6);
      const b = makeEl('dq-fx-balloon', `left:${left}%; animation-delay:${delay}s;`);
      b.textContent = emoji;
      fxLayer.appendChild(b);
    });

    for (let i = 0; i < 6; i++) {
      const s = makeEl('dq-fx-star', `top:${rand(8, 40)}%; left:${rand(6, 90)}%; animation-delay:${rand(0, 2.4)}s;`);
      s.textContent = '✦';
      fxLayer.appendChild(s);
    }

    for (let i = 0; i < 5; i++) {
      const sp = makeEl('dq-fx-spark', `bottom:${rand(4, 20)}%; left:${rand(8, 88)}%; animation-delay:${rand(0, 3)}s;`);
      fxLayer.appendChild(sp);
    }

    // چند ذره‌ی قلبی بسیار ظریف — کم و شیک، نه شلوغ
    for (let i = 0; i < 3; i++) {
      const h = makeEl('dq-fx-heart', `left:${rand(20, 80)}%; animation-delay:${rand(0.5, 4)}s;`);
      h.textContent = '♥';
      fxLayer.appendChild(h);
    }

    const confettiColors = ['#e0b559', '#d43f5e', '#f3b7c3', '#ffffff'];
    for (let i = 0; i < 14; i++) {
      const c = makeEl(
        'dq-fx-confetti',
        `left:${rand(4, 94)}%; background:${confettiColors[i % confettiColors.length]}; animation-delay:${rand(0, 0.9)}s; transform: rotate(${rand(0, 360)}deg);`
      );
      fxLayer.appendChild(c);
    }
  }

  /** جرقه‌ی کوچک و ظریف برای لحظه‌ی باز شدن پاکت (مستقل از مجموعه‌جلوه‌های کامل) */
  function sparkleBurst(container, count) {
    if (!container || prefersReducedMotion()) return;
    for (let i = 0; i < (count || 8); i++) {
      const sp = makeEl(
        'dq-fx-spark dq-fx-spark--burst',
        `top:${rand(20, 80)}%; left:${rand(10, 90)}%; animation-delay:${rand(0, 0.3)}s;`
      );
      container.appendChild(sp);
    }
    setTimeout(() => {
      container.querySelectorAll('.dq-fx-spark--burst').forEach((el) => el.remove());
    }, 1600);
  }

  const EFFECT_BUILDERS = {
    'birthday-confetti': birthdayConfetti,
    'celebration-stars': celebrationStars,
    'romantic-soft': romanticSoft,
    'gentle-glow': gentleGlow,
    'somber-light': somberLight
  };

  /** جلوه‌ی جشن (بدون بادکنک/قلب) — برای تبریک/موفقیت/خانه‌ی جدید */
  function celebrationStars(fxLayer) {
    for (let i = 0; i < 8; i++) {
      const s = makeEl('dq-fx-star', `top:${rand(6, 42)}%; left:${rand(6, 92)}%; animation-delay:${rand(0, 2.4)}s;`);
      s.textContent = '✦';
      fxLayer.appendChild(s);
    }
    for (let i = 0; i < 5; i++) {
      const sp = makeEl('dq-fx-spark', `bottom:${rand(4, 20)}%; left:${rand(8, 88)}%; animation-delay:${rand(0, 3)}s;`);
      fxLayer.appendChild(sp);
    }
    const confettiColors = ['#e0b559', '#ffffff'];
    for (let i = 0; i < 8; i++) {
      const c = makeEl('dq-fx-confetti', `left:${rand(4, 94)}%; background:${confettiColors[i % confettiColors.length]}; animation-delay:${rand(0, 0.9)}s; transform: rotate(${rand(0, 360)}deg);`);
      fxLayer.appendChild(c);
    }
  }

  /** جلوه‌ی رمانتیک ملایم (قلب + جرقه، بدون کنفتی/بادکنک) — برای ازدواج/سالگرد */
  function romanticSoft(fxLayer) {
    for (let i = 0; i < 5; i++) {
      const h = makeEl('dq-fx-heart', `left:${rand(15, 85)}%; animation-delay:${rand(0, 4)}s;`);
      h.textContent = '♥';
      fxLayer.appendChild(h);
    }
    for (let i = 0; i < 4; i++) {
      const sp = makeEl('dq-fx-spark', `bottom:${rand(4, 24)}%; left:${rand(8, 88)}%; animation-delay:${rand(0, 3)}s;`);
      fxLayer.appendChild(sp);
    }
  }

  /** جلوه‌ی ملایم و باوقار — برای مناسبت‌های مذهبی غیرسوگواری (میلاد/مبعث/اعیاد) */
  function gentleGlow(fxLayer) {
    for (let i = 0; i < 5; i++) {
      const s = makeEl('dq-fx-star', `top:${rand(10, 38)}%; left:${rand(10, 88)}%; animation-delay:${rand(0, 2.6)}s;`);
      s.textContent = '✦';
      fxLayer.appendChild(s);
    }
  }

  /** جلوه‌ی بسیار کم‌رنگ — فقط درخشش ملایم، بدون کنفتی/بادکنک/قلب/ستاره — برای سوگواری/تسلیت/رحلت/شهادت */
  function somberLight() { /* عمداً خالی؛ فقط کلاس Glow (در playCardEffects) اعمال می‌شود */ }

  /**
   * جلوه‌ها را روی یک کارت اجرا می‌کند. ایمن است که چند بار صدا زده شود
   * (هربار قبلی‌ها را پاک می‌کند).
   */
  function playCardEffects(cardEl, effectsKey) {
    if (!cardEl) return;
    const fxLayer = cardEl.querySelector('.dq-card__fx');
    if (fxLayer) fxLayer.textContent = '';
    cardEl.classList.remove('dq-fx-glow');
    const headline = cardEl.querySelector('.dq-card__headline');
    if (headline) headline.classList.remove('dq-fx-headline');

    if (!effectsKey || prefersReducedMotion()) return;
    const builder = EFFECT_BUILDERS[effectsKey];
    if (!builder || !fxLayer) return;

    try {
      builder(fxLayer);
      cardEl.classList.add('dq-fx-glow');
      if (headline) headline.classList.add('dq-fx-headline');
    } catch (e) {
      // جلوه‌های تزئینی هرگز نباید باعث خرابی نمایش کارت شوند
      if (fxLayer) fxLayer.textContent = '';
    }
  }

  global.DiyarCardEffects = { playCardEffects, sparkleBurst };
})(typeof window !== 'undefined' ? window : this);

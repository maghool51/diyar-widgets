/**
 * core/render.js — ساخت مارک‌آپ کارت و شبکه‌های انتخاب (دسته/مناسبت/طرح).
 * همه‌ی متن‌های کاربر همیشه با textContent ست می‌شوند (هرگز innerHTML)
 * تا از XSS جلوگیری شود.
 */
(function (global) {
  'use strict';

  const U = global.DiyarCardUtils;

  /** ساخت ساختار داخلی یک کارت (خالی از متن) داخل container */
  function buildCardSkeleton(container) {
    container.textContent = '';
    const card = document.createElement('div');
    card.className = 'dq-card';

    const ornament = document.createElement('div');
    ornament.className = 'dq-card__ornament';
    ornament.setAttribute('aria-hidden', 'true');
    const ornA = document.createElement('i'); ornA.className = 'dq-card__orn-a';
    const ornB = document.createElement('i'); ornB.className = 'dq-card__orn-b';
    ornament.appendChild(ornA); ornament.appendChild(ornB);

    const fx = document.createElement('div');
    fx.className = 'dq-card__fx';
    fx.setAttribute('aria-hidden', 'true');

    const headline = document.createElement('p'); headline.className = 'dq-card__headline';
    const icon = document.createElement('div'); icon.className = 'dq-card__icon'; icon.setAttribute('aria-hidden', 'true');
    const to = document.createElement('p'); to.className = 'dq-card__to';
    const title = document.createElement('p'); title.className = 'dq-card__title';
    const message = document.createElement('p'); message.className = 'dq-card__message';
    const from = document.createElement('p'); from.className = 'dq-card__from';
    const brand = document.createElement('div'); brand.className = 'dq-card__brand';
    brand.textContent = '🏡 دیار قدمگاه · ✍️ معقول';

    card.append(ornament, fx, headline, icon, to, title, message, from, brand);
    container.appendChild(card);
    return card;
  }

  /** به‌روزرسانی محتوای یک کارت موجود (برای Live Preview بدون ری‌رندر کامل) */
  function updateCard(cardEl, data) {
    if (!cardEl) return;
    cardEl.setAttribute('data-layout', data.layout || '');
    cardEl.setAttribute('data-palette', data.palette || '');
    if (data.templateId) cardEl.setAttribute('data-template', data.templateId);
    U.setText(cardEl.querySelector('.dq-card__headline'), data.headline || '');
    U.setText(cardEl.querySelector('.dq-card__icon'), data.icon || '');
    U.setText(cardEl.querySelector('.dq-card__to'), data.to ? ('برای ' + data.to) : 'برای …');
    U.setText(cardEl.querySelector('.dq-card__title'), data.title || '');
    U.setText(cardEl.querySelector('.dq-card__message'), data.message || 'متن پیام شما اینجا نمایش داده می‌شود…');
    U.setText(cardEl.querySelector('.dq-card__from'), data.from ? ('با محبت، ' + data.from) : '');
  }

  function renderChoiceGrid(container, items, opts) {
    container.textContent = '';
    items.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dq-choice';
      btn.setAttribute('aria-pressed', String(opts.isSelected ? opts.isSelected(item) : false));
      if (item.icon) {
        const ic = document.createElement('span');
        ic.className = 'dq-choice__icon'; ic.setAttribute('aria-hidden', 'true');
        U.setText(ic, item.icon);
        btn.appendChild(ic);
      }
      const label = document.createElement('span');
      U.setText(label, item.title);
      btn.appendChild(label);
      btn.addEventListener('click', () => opts.onSelect(item));
      container.appendChild(btn);
    });
  }

  function renderOccasionList(container, items, opts) {
    container.textContent = '';
    items.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dq-occasion-item';
      const label = document.createElement('span');
      U.setText(label, item.title);
      btn.appendChild(label);
      btn.addEventListener('click', () => opts.onSelect(item));
      container.appendChild(btn);
    });
  }

  function renderTemplateGrid(container, templates, previewData, opts) {
    container.textContent = '';
    templates.forEach((tpl) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dq-choice dq-template-choice';
      btn.setAttribute('aria-pressed', String(opts.isSelected ? opts.isSelected(tpl) : false));

      const miniWrap = document.createElement('div');
      miniWrap.className = 'dq-card-mini';
      const miniCard = buildCardSkeleton(miniWrap);
      updateCard(miniCard, Object.assign({}, previewData, {
        layout: tpl.layout, palette: tpl.palette, icon: tpl.icon
      }));

      const label = document.createElement('div');
      label.className = 'dq-template-choice__label';
      U.setText(label, tpl.title);

      btn.appendChild(miniWrap);
      btn.appendChild(label);
      btn.addEventListener('click', () => opts.onSelect(tpl));
      container.appendChild(btn);
    });
  }

  function renderMessageChips(container, messages, opts) {
    container.textContent = '';
    messages.forEach((m) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dq-message-chip';
      U.setText(btn, m.style);
      btn.addEventListener('click', () => opts.onSelect(m));
      container.appendChild(btn);
    });
  }

  global.DiyarCardRender = {
    buildCardSkeleton, updateCard, renderChoiceGrid,
    renderOccasionList, renderTemplateGrid, renderMessageChips
  };
})(typeof window !== 'undefined' ? window : this);

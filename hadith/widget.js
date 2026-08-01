/**
 * widget.js
 * ─────────────────────────────────────────────────────────────
 * نقطه‌ی ورود اصلی. کلاس DiyarHadithWidget تمام ماژول‌های core را
 * به هم متصل کرده و یک کارت حدیث تعاملی می‌سازد.
 *
 * استفاده‌ی ساده:
 *   <div id="diyar-hadith-widget"></div>
 *   <script>
 *     new DiyarHadithWidget().init();
 *   </script>
 * ─────────────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  var Config = global.HadithConfig;
  var Cache = global.HadithCache;
  var Utils = global.HadithUtils;

  var RECENT_KEY = 'state:recent-random-ids';

  function DiyarHadithWidget(options) {
    this.config = mergeDeep(Config, options || {});
    this.el = null;
    this.refs = {};
    this.hadiths = [];
    this.current = null;
    this.offline = false;
  }

  function mergeDeep(base, override) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(override).forEach(function (k) {
      if (typeof override[k] === 'object' && override[k] !== null && !Array.isArray(override[k]) &&
          typeof base[k] === 'object' && base[k] !== null) {
        out[k] = mergeDeep(base[k], override[k]);
      } else {
        out[k] = override[k];
      }
    });
    return out;
  }

  DiyarHadithWidget.prototype.init = function () {
    var self = this;
    this.el = document.getElementById(this.config.containerId);

    if (!this.el) {
      console.error('[DiyarHadithWidget] عنصر میزبان با شناسه‌ی «' + this.config.containerId + '» یافت نشد.');
      return this;
    }

    this._buildSkeleton();
    this._setState('loading');

    return Cache.getHadiths()
      .then(function (result) {
        self.offline = !!result.offline;
        self.hadiths = Utils.sanitizeHadithList(result.hadiths);

        if (self.config.category && self.config.category !== 'all') {
          self.hadiths = self.hadiths.filter(function (h) { return h.category === self.config.category; });
        }

        if (!self.hadiths.length) {
          self._setState('error', 'داده‌ای برای نمایش یافت نشد.');
          return;
        }

        self._selectInitial();
        self._setState('ready');
        self._notifyOfflineIfNeeded();

        if (typeof self.config.callbacks.onReady === 'function') {
          self.config.callbacks.onReady(self.current);
        }
      })
      .catch(function (err) {
        self._setState('error', 'اتصال به اینترنت برقرار نیست و نسخه‌ی ذخیره‌شده‌ای هم در دسترس نیست.');
        if (typeof self.config.callbacks.onError === 'function') {
          self.config.callbacks.onError(err);
        }
      });
  };

  DiyarHadithWidget.prototype._selectInitial = function () {
    if (this.config.selectionMode === 'random') {
      this.next();
    } else {
      this.current = Utils.pickDailyHadith(this.hadiths, new Date());
      this._render();
    }
  };

  /** نمایش حدیث «بعدی» — با احترام به selectionMode جاری */
  DiyarHadithWidget.prototype.next = function () {
    if (!this.hadiths.length) return;

    if (this.config.selectionMode === 'daily') {
      // در حالت روزانه، دکمه‌ی بعدی به‌صورت تصادفیِ بدون‌تکرار عمل می‌کند
      this._pickRandom();
    } else {
      this._pickRandom();
    }
  };

  DiyarHadithWidget.prototype._pickRandom = function () {
    var storage = global.HadithStorage;
    var recentIds = storage.getItem(RECENT_KEY) || [];
    var result = Utils.pickRandomHadith(this.hadiths, recentIds);

    this.current = result.hadith;
    storage.setItem(RECENT_KEY, result.recentIds);

    this._render();
    if (typeof this.config.callbacks.onChange === 'function') {
      this.config.callbacks.onChange(this.current);
    }
  };

  /** بازسازی اسکلت اولیه‌ی DOM (فقط یک‌بار اجرا می‌شود) */
  DiyarHadithWidget.prototype._buildSkeleton = function () {
    var el = this.el;
    el.classList.add('dhw');
    el.setAttribute('dir', this.config.direction);
    el.setAttribute('data-theme', this.config.theme);

    el.innerHTML =
      '<div class="dhw-card" role="region" aria-live="polite">' +
        '<div class="dhw-top">' +
          '<span class="dhw-chip dhw-chip-category"></span>' +
          '<span class="dhw-chip dhw-chip-offline" hidden>آفلاین</span>' +
        '</div>' +
        '<div class="dhw-body">' +
          '<p class="dhw-quote-mark">”</p>' +
          '<blockquote class="dhw-text"></blockquote>' +
        '</div>' +
        '<div class="dhw-meta">' +
          '<span class="dhw-source"></span>' +
          '<span class="dhw-book"></span>' +
        '</div>' +
        '<div class="dhw-actions"></div>' +
        '<div class="dhw-skeleton" hidden>' +
          '<div class="dhw-sk-line dhw-sk-80"></div>' +
          '<div class="dhw-sk-line dhw-sk-100"></div>' +
          '<div class="dhw-sk-line dhw-sk-60"></div>' +
        '</div>' +
      '</div>';

    this.refs = {
      card: el.querySelector('.dhw-card'),
      category: el.querySelector('.dhw-chip-category'),
      offlineChip: el.querySelector('.dhw-chip-offline'),
      text: el.querySelector('.dhw-text'),
      source: el.querySelector('.dhw-source'),
      book: el.querySelector('.dhw-book'),
      actions: el.querySelector('.dhw-actions'),
      skeleton: el.querySelector('.dhw-skeleton')
    };

    this._buildActions();
  };

  DiyarHadithWidget.prototype._buildActions = function () {
    var self = this;
    var ui = this.config.ui;
    var buttons = [];

    if (ui.showNextButton) {
      buttons.push(this._makeButton('next', 'حدیث بعدی', '⟳', function () { self.next(); }));
    }
    if (ui.showRandomButton) {
      buttons.push(this._makeButton('random', 'حدیث تصادفی', '🎲', function () { self._pickRandom(); }));
    }
    if (ui.showCopyButton) {
      buttons.push(this._makeButton('copy', 'کپی متن', '⧉', function () { self._copy(); }));
    }
    if (ui.showShareButton) {
      buttons.push(this._makeButton('share', 'اشتراک‌گذاری', '↗', function () { self._share(); }));
    }
    if (ui.showPrintButton) {
      buttons.push(this._makeButton('print', 'چاپ', '🖨', function () { self._print(); }));
    }

    buttons.forEach(function (btn) { self.refs.actions.appendChild(btn); });
  };

  DiyarHadithWidget.prototype._makeButton = function (name, label, glyph, handler) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dhw-btn dhw-btn-' + name;
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.textContent = glyph;
    btn.addEventListener('click', Utils.debounce(handler, 150));
    return btn;
  };

  DiyarHadithWidget.prototype._render = function () {
    if (!this.current) return;
    var h = this.current;
    var digits = this.config.usePersianDigits ? Utils.toPersianDigits : function (s) { return s; };

    this.refs.text.textContent = h.text;
    this.refs.source.textContent = this.config.ui.showSource && h.source ? h.source : '';
    this.refs.book.textContent = this.config.ui.showBook && h.book ? digits(h.book) : '';
    this.refs.category.textContent = this.config.ui.showCategory && h.category ? h.category : '';
    this.refs.category.hidden = !(this.config.ui.showCategory && h.category);
    this.refs.source.hidden = !this.refs.source.textContent;
    this.refs.book.hidden = !this.refs.book.textContent;

    this.refs.card.classList.remove('dhw-fade');
    void this.refs.card.offsetWidth; // ری‌استارت انیمیشن
    this.refs.card.classList.add('dhw-fade');
  };

  DiyarHadithWidget.prototype._setState = function (state, message) {
    var skeleton = this.refs.skeleton;
    var card = this.refs.card;
    if (!skeleton || !card) return;

    if (state === 'loading') {
      skeleton.hidden = false;
      card.classList.add('dhw-loading');
    } else if (state === 'ready') {
      skeleton.hidden = true;
      card.classList.remove('dhw-loading');
    } else if (state === 'error') {
      skeleton.hidden = true;
      card.classList.remove('dhw-loading');
      this.refs.text.textContent = message || 'خطایی رخ داد.';
      this.refs.source.hidden = true;
      this.refs.book.hidden = true;
      this.refs.category.hidden = true;
    }
  };

  DiyarHadithWidget.prototype._notifyOfflineIfNeeded = function () {
    this.refs.offlineChip.hidden = !this.offline;
  };

  DiyarHadithWidget.prototype._copy = function () {
    var text = Utils.buildShareText(this.current);
    Utils.copyToClipboard(text).then(function (ok) {
      // بازخورد بصری کوچک از طریق CSS state انجام می‌شود؛ اینجا فقط لاگ خطا
      if (!ok) console.warn('[DiyarHadithWidget] کپی متن ناموفق بود.');
    });
  };

  DiyarHadithWidget.prototype._share = function () {
    var text = Utils.buildShareText(this.current);
    Utils.shareText(text, 'حدیث روز');
  };

  DiyarHadithWidget.prototype._print = function () {
    Utils.printHadith(this.current);
  };

  global.DiyarHadithWidget = DiyarHadithWidget;
})(typeof window !== 'undefined' ? window : this);

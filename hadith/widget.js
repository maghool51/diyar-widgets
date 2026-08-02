/**
 * widget.js
 * ─────────────────────────────────────────────────────────────
 * نقطه‌ی ورود اصلی. کلاس DiyarHadithWidget تمام ماژول‌های core را
 * به هم متصل کرده و یک کارت حدیث تعاملی می‌سازد.
 *
 * استفاده‌ی دستی (روش پیش‌فرض و مستند در README):
 *   <div id="diyar-hadith-widget"></div>
 *   <script>
 *     new DiyarHadithWidget().init();
 *   </script>
 *
 * استفاده‌ی کاملاً بدون اسکریپت درون‌خطی (برای صفحاتی با CSP سخت‌گیرانه
 * که script-src 'unsafe-inline' ندارند — رجوع کنید به بخش CSP در
 * README): همین تگ <script src="widget.js"> را با data-auto-init="true"
 * علامت بزنید؛ ویجت به‌محض DOMContentLoaded خودش را روی
 * containerId پیش‌فرض («diyar-hadith-widget») مقداردهی می‌کند:
 *   <script src="widget.js" data-auto-init="true"></script>
 * این قابلیت کاملاً opt-in است و رفتار پیش‌فرض/مستندات موجود را تغییر
 * نمی‌دهد.
 * ─────────────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  var Config = global.HadithConfig;
  var Cache = global.HadithCache;
  var Utils = global.HadithUtils;

  /**
   * آیکون‌های SVG به‌سبک Material (خطی/outline)، جایگزین ایموجی‌های قبلی.
   * چرا: ایموجی‌ها بین سیستم‌عامل‌ها و مرورگرهای مختلف ظاهر متفاوتی
   * دارند (فونت ایموجی سیستم)، رنگشان با تم (روشن/تاریک) هماهنگ نمی‌شود
   * و در Material 3 خطی/تک‌رنگ نیستند. این SVGها از currentColor استفاده
   * می‌کنند تا رنگشان خودکار با رنگ متن دکمه (و تم روشن/تاریک) هماهنگ
   * شود؛ aria-hidden دارند چون نام قابل‌دسترس دکمه از aria-label می‌آید.
   */
  var ICONS = {
    next:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><polyline points="20 4 20 9 15 9"/></svg>',
    random:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M4 6h3l7 12h4"/><path d="M4 18h3l3-5"/>' +
      '<polyline points="15 4 18 6 15 8"/><line x1="18" y1="6" x2="14" y2="6"/>' +
      '<polyline points="15 16 18 18 15 20"/><line x1="18" y1="18" x2="12" y2="18"/></svg>',
    copy:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4.5 15.5A2 2 0 0 1 3 13.6V4a2 2 0 0 1 2-2h9.6a2 2 0 0 1 1.9 1.5"/></svg>',
    share:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<circle cx="18" cy="5" r="2.4"/><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="19" r="2.4"/>' +
      '<line x1="8.1" y1="10.7" x2="15.9" y2="6.3"/><line x1="8.1" y1="13.3" x2="15.9" y2="17.7"/></svg>',
    print:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<polyline points="6 9 6 3 18 3 18 9"/><rect x="4" y="9" width="16" height="8" rx="2"/>' +
      '<polyline points="6 17 6 21 18 21 18 17"/></svg>'
  };

  function DiyarHadithWidget(options) {
    this.config = mergeDeep(Config, options || {});
    this.el = null;
    this.refs = {};
    this.hadiths = [];
    this.current = null;
    this.offline = false;
    this._initialized = false;
    this._listeners = []; // { el, type, handler } — برای پاک‌سازی کامل در destroy()
    // کلید ذخیره‌سازی «حدیث‌های اخیر» به ازای هر containerId مجزاست تا
    // چند نمونه‌ی هم‌زمان از ویجت روی یک صفحه (مثلاً یک ویجت با تم روشن
    // و یکی با تم تاریک) تاریخچه‌ی یکدیگر را خراب نکنند.
    this._recentKey = 'state:recent-random-ids:' + this.config.containerId;
  }

  /**
   * ادغام عمیق دو شیء تنظیمات.
   *
   * نکته‌ی مهم (رفع باگ): نسخه‌ی قبلی برای کلیدهایی که در override نبودند
   * فقط ارجاع base[k] را کپی می‌کرد (`out[k] = base[k]`)؛ چون base همان
   * شیء سراسری window.HadithConfig است، این یعنی چند نمونه‌ی هم‌زمان از
   * ویجت (مثلاً دو ویجت در یک صفحه) روی یک شیء تودرتوی مشترک (مثل
   * config.ui) کار می‌کردند — تغییر تنظیمات یک نمونه در زمان اجرا می‌توانست
   * بی‌سروصدا روی نمونه‌های دیگر و حتی خودِ HadithConfig سراسری اثر بگذارد.
   * اکنون شیءهای تودرتوی base هم عمیقاً کلون می‌شوند تا هر نمونه یک کپی
   * کاملاً مستقل داشته باشد.
   */
  function mergeDeep(base, override) {
    var out = {};
    Object.keys(base).forEach(function (k) {
      var v = base[k];
      out[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? mergeDeep(v, {}) : v;
    });
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

  /**
   * مقداردهی اولیه‌ی ویجت.
   *
   * رفع باگ: نسخه‌ی قبلی در مسیر «عنصر میزبان یافت نشد» مقدار `this`
   * (نه یک Promise) برمی‌گرداند، اما در مسیر موفق یک Promise. کد فراخوان
   * که همیشه انتظار `.then()`/`.catch()` دارد (مطابق مستندات README) با
   * نبود کانتینر روی خطای «init(...).then is not a function» کرش می‌کرد.
   * اکنون در هر دو حالت یک Promise برگردانده می‌شود.
   *
   * @returns {Promise<DiyarHadithWidget>}
   */
  DiyarHadithWidget.prototype.init = function () {
    var self = this;

    if (this._initialized) {
      // جلوگیری از دوبار مقداردهی روی همان نمونه (مثلاً اگر کد میزبان
      // به‌اشتباه init() را دوبار صدا بزند)
      return Promise.resolve(this);
    }

    this.el = document.getElementById(this.config.containerId);

    if (!this.el) {
      var msg = '[DiyarHadithWidget] عنصر میزبان با شناسه‌ی «' + this.config.containerId + '» یافت نشد.';
      console.error(msg);
      if (typeof this.config.callbacks.onError === 'function') {
        this.config.callbacks.onError(new Error(msg));
      }
      return Promise.resolve(this);
    }

    // اگر این عنصر قبلاً توسط یک نمونه‌ی دیگر مقداردهی شده (مثلاً کد
    // میزبان دوبار new DiyarHadithWidget().init() را روی یک containerId
    // فراخوانی کرده)، از ساخت دکمه‌ها/listenerهای تکراری جلوگیری می‌شود.
    if (this.el.hasAttribute('data-dhw-initialized')) {
      console.warn('[DiyarHadithWidget] عنصر «' + this.config.containerId + '» قبلاً مقداردهی شده است؛ از init دوباره صرف‌نظر شد.');
      return Promise.resolve(this);
    }
    this.el.setAttribute('data-dhw-initialized', 'true');

    this._initialized = true;
    this._buildSkeleton();
    this._setState('loading');

    return Cache.getHadiths()
      .then(function (result) {
        // نکته: این پرچم فقط نشان می‌دهد داده‌ی حدیث از کش (به‌خاطر شکست
        // fetch) آمده یا نه — به نشان «آفلاین» در رابط کاربری متصل
        // نیست. طبق الزام محصول، آن نشان صرفاً از navigator.onLine
        // واقعی می‌آید (نگاه کنید به _setupOnlineStatus)، چون ممکن است
        // fetch به دلایل دیگری (نه لزوماً قطعی کامل اینترنت) شکست بخورد.
        self.offline = !!result.offline;
        self.hadiths = Utils.sanitizeHadithList(result.hadiths);

        if (self.config.category && self.config.category !== 'all') {
          self.hadiths = self.hadiths.filter(function (h) { return h.category === self.config.category; });
        }

        if (!self.hadiths.length) {
          self._setState('error', 'داده‌ای برای نمایش یافت نشد.');
          return self;
        }

        self._selectInitial();
        self._setState('ready');

        if (typeof self.config.callbacks.onReady === 'function') {
          self.config.callbacks.onReady(self.current);
        }
        return self;
      })
      .catch(function (err) {
        self._setState('error', 'اتصال به اینترنت برقرار نیست و نسخه‌ی ذخیره‌شده‌ای هم در دسترس نیست.');
        if (typeof self.config.callbacks.onError === 'function') {
          self.config.callbacks.onError(err);
        }
        return self;
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

  /**
   * نمایش حدیث «بعدی».
   *
   * رفع باگ (کد مرده): نسخه‌ی قبلی یک شرط if/else داشت که هر دو شاخه‌اش
   * دقیقاً یک کار انجام می‌دادند (_pickRandom())؛ آن شرط بلااستفاده حذف شد.
   */
  DiyarHadithWidget.prototype.next = function () {
    if (!this.hadiths.length) return;
    this._pickRandom();
  };

  DiyarHadithWidget.prototype._pickRandom = function () {
    var storage = global.HadithStorage;
    // رفع باگ: قبلاً یک کلید سراسری (RECENT_KEY) بین همه‌ی نمونه‌های ویجت
    // مشترک بود؛ اگر دو ویجت هم‌زمان روی یک صفحه باشند، تاریخچه‌ی
    // «اخیراً دیده‌شده»ی یکدیگر را خراب می‌کردند. اکنون هر نمونه کلید
    // مخصوص به خودش (this._recentKey) را دارد.
    var recentIds = storage.getItem(this._recentKey) || [];
    var result = Utils.pickRandomHadith(this.hadiths, recentIds);

    this.current = result.hadith;
    storage.setItem(this._recentKey, result.recentIds);

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

    // شناسه‌ی یکتا برای عنوان به‌ازای هر نمونه (چند ویجت هم‌زمان روی یک
    // صفحه نباید id تکراری بسازند)
    var titleId = 'dhw-title-' + this.config.containerId;

    el.innerHTML =
      '<div class="dhw-card" role="region" aria-labelledby="' + titleId + '" aria-live="polite">' +
        '<div class="dhw-top">' +
          '<h2 class="dhw-title" id="' + titleId + '">حدیث روز</h2>' +
          '<div class="dhw-top-meta">' +
            '<span class="dhw-chip dhw-chip-category"></span>' +
            '<span class="dhw-chip dhw-chip-offline" hidden>آفلاین</span>' +
          '</div>' +
        '</div>' +
        '<div class="dhw-body">' +
          '<p class="dhw-quote-mark" aria-hidden="true">”</p>' +
          '<p class="dhw-text-ar" lang="ar" dir="rtl"></p>' +
          '<blockquote class="dhw-text"></blockquote>' +
        '</div>' +
        '<div class="dhw-meta">' +
          '<span class="dhw-source"></span>' +
          '<span class="dhw-book"></span>' +
        '</div>' +
        '<div class="dhw-actions" role="group" aria-label="عملیات روی حدیث"></div>' +
        '<div class="dhw-status" aria-live="polite" aria-atomic="true"></div>' +
        '<div class="dhw-skeleton" hidden aria-hidden="true">' +
          '<div class="dhw-sk-line dhw-sk-80"></div>' +
          '<div class="dhw-sk-line dhw-sk-100"></div>' +
          '<div class="dhw-sk-line dhw-sk-60"></div>' +
        '</div>' +
      '</div>';

    this.refs = {
      card: el.querySelector('.dhw-card'),
      title: el.querySelector('.dhw-title'),
      category: el.querySelector('.dhw-chip-category'),
      offlineChip: el.querySelector('.dhw-chip-offline'),
      text: el.querySelector('.dhw-text'),
      textAr: el.querySelector('.dhw-text-ar'),
      source: el.querySelector('.dhw-source'),
      book: el.querySelector('.dhw-book'),
      actions: el.querySelector('.dhw-actions'),
      status: el.querySelector('.dhw-status'),
      skeleton: el.querySelector('.dhw-skeleton')
    };

    this._buildActions();
    this._setupOnlineStatus();
  };

  DiyarHadithWidget.prototype._buildActions = function () {
    var self = this;
    var ui = this.config.ui;
    var buttons = [];

    if (ui.showNextButton) {
      buttons.push(this._makeButton('next', 'حدیث بعدی', ICONS.next, function () { self.next(); }));
    }
    if (ui.showRandomButton) {
      buttons.push(this._makeButton('random', 'حدیث تصادفی', ICONS.random, function () { self._pickRandom(); }));
    }
    if (ui.showCopyButton) {
      buttons.push(this._makeButton('copy', 'کپی متن', ICONS.copy, function () { self._copy(); }));
    }
    if (ui.showShareButton) {
      buttons.push(this._makeButton('share', 'اشتراک‌گذاری', ICONS.share, function () { self._share(); }));
    }
    if (ui.showPrintButton) {
      buttons.push(this._makeButton('print', 'چاپ', ICONS.print, function () { self._print(); }));
    }

    buttons.forEach(function (btn) { self.refs.actions.appendChild(btn); });
  };

  /**
   * ساخت یک دکمه‌ی اکشن.
   *
   * رفع باگ عملکردی (بازبینی قبلی): نسخه‌ای که از Utils.debounce (لبه‌ی
   * پایانی) استفاده می‌کرد هر کلیک — حتی تک‌کلیک اول — را ۱۵۰ میلی‌ثانیه
   * به تأخیر می‌انداخت. اکنون از createClickGuard استفاده می‌شود: کلیک
   * اول بلافاصله اجرا و فقط کلیک‌های تکراری تا پایان cooldown نادیده
   * گرفته می‌شوند.
   *
   * پولیش UI: آیکون ایموجی قبلی با SVG درون‌خطیِ به‌سبک Material جایگزین
   * شد (markup ثابت و از پیش تعریف‌شده در ICONS — نه داده‌ی کاربر، پس
   * innerHTML اینجا امن است). SVG با aria-hidden مخفی از صفحه‌خوان است؛
   * نام قابل‌دسترس دکمه فقط از aria-label می‌آید.
   */
  DiyarHadithWidget.prototype._makeButton = function (name, label, iconSvg, handler) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dhw-btn dhw-btn-' + name;
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.innerHTML = iconSvg;

    var cooldown = (this.config.ui && this.config.ui.buttonCooldownMs) || 250;
    var guardedHandler = Utils.createClickGuard(handler, cooldown);
    btn.addEventListener('click', guardedHandler);

    // نگه‌داشتن مرجع برای پاک‌سازی کامل در destroy()
    this._listeners.push({ el: btn, type: 'click', handler: guardedHandler });

    return btn;
  };

  DiyarHadithWidget.prototype._render = function () {
    if (!this.current) return;
    var h = this.current;
    var digits = this.config.usePersianDigits ? Utils.toPersianDigits : function (s) { return s; };

    // متن عربی اصلی (در صورت وجود در داده و فعال‌بودن تنظیم showArabic)
    // پیش از ترجمه‌ی فارسی نمایش داده می‌شود. اگر آیتمی متن عربی نداشته
    // باشد، این پاراگراف به‌آرامی مخفی می‌شود (سازگاری با داده‌ی قدیمی
    // که فیلد arabic را نداشت).
    var showArabic = this.config.ui.showArabic !== false && !!h.arabic;
    if (this.refs.textAr) {
      this.refs.textAr.textContent = showArabic ? h.arabic : '';
      this.refs.textAr.hidden = !showArabic;
    }

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
      if (this.refs.textAr) this.refs.textAr.hidden = true;
      this.refs.source.hidden = true;
      this.refs.book.hidden = true;
      this.refs.category.hidden = true;
    }
  };

  /**
   * نشان «آفلاین» را دقیقاً طبق وضعیت واقعی اتصال شبکه (navigator.onLine)
   * مدیریت می‌کند — نه بر اساس نتیجه‌ی یک fetch خاص. علاوه بر تنظیم
   * وضعیت اولیه، به رویدادهای 'online'/'offline' مرورگر گوش می‌دهد تا
   * نشان بدون نیاز به رفرش صفحه زنده بروز شود (مثلاً وقتی کاربر در حین
   * مطالعه‌ی همان صفحه اینترنتش قطع/وصل می‌شود).
   */
  DiyarHadithWidget.prototype._setupOnlineStatus = function () {
    var self = this;

    function update() {
      if (self.refs.offlineChip) {
        self.refs.offlineChip.hidden = navigator.onLine !== false;
      }
    }

    update();

    var onOnline = function () { update(); };
    var onOffline = function () { update(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // ثبت برای پاک‌سازی کامل در destroy() (رفع نشتی listener سطح window)
    this._listeners.push({ el: window, type: 'online', handler: onOnline });
    this._listeners.push({ el: window, type: 'offline', handler: onOffline });
  };

  /**
   * اعلام یک پیام کوتاه هم برای کاربران بینا (به‌طور مختصر و محو‌شونده)
   * و هم برای صفحه‌خوان‌ها (از طریق aria-live). رفع باگ: نسخه‌ی قبلی
   * شکست کپی/اشتراک‌گذاری را فقط با console.warn گزارش می‌کرد — کاربر
   * واقعی (به‌خصوص کاربر صفحه‌خوان) هیچ بازخوردی دریافت نمی‌کرد.
   */
  DiyarHadithWidget.prototype._announce = function (message) {
    if (!this.refs.status) return;
    this.refs.status.textContent = message;
  };

  DiyarHadithWidget.prototype._copy = function () {
    var self = this;
    var text = Utils.buildShareText(this.current);
    Utils.copyToClipboard(text).then(function (ok) {
      self._announce(ok ? 'متن حدیث کپی شد.' : 'کپی متن ناموفق بود.');
      if (!ok) console.warn('[DiyarHadithWidget] کپی متن ناموفق بود.');
    });
  };

  DiyarHadithWidget.prototype._share = function () {
    var self = this;
    var text = Utils.buildShareText(this.current);
    Utils.shareText(text, 'حدیث روز').then(function (result) {
      if (!result || !result.ok) {
        self._announce('اشتراک‌گذاری ناموفق بود.');
      } else if (result.method === 'copy') {
        self._announce('اشتراک‌گذاری در دسترس نبود؛ متن در کلیپ‌بورد کپی شد.');
      }
    });
  };

  DiyarHadithWidget.prototype._print = function () {
    Utils.printHadith(this.current);
  };

  /**
   * پاک‌سازی کامل نمونه: تمام event listenerهای دکمه‌ها حذف می‌شوند،
   * محتوای DOM کانتینر خالی می‌شود و پرچم data-dhw-initialized برداشته
   * می‌شود تا در صورت نیاز بتوان دوباره init() را روی همان عنصر فراخوانی
   * کرد. برای برنامه‌های صفحه‌ی-تکی (SPA) که ویجت را هنگام ناوبری از
   * DOM حذف/اضافه می‌کنند مفید است.
   *
   * (این متد در بازنویسی قبلی به‌اشتباه حذف شده بود و در این بازبینی
   * بازگردانده شد.)
   */
  DiyarHadithWidget.prototype.destroy = function () {
    this._listeners.forEach(function (l) {
      l.el.removeEventListener(l.type, l.handler);
    });
    this._listeners = [];

    if (this.el) {
      this.el.removeAttribute('data-dhw-initialized');
      this.el.innerHTML = '';
      this.el.classList.remove('dhw');
    }

    this.refs = {};
    this.hadiths = [];
    this.current = null;
    this._initialized = false;
  };

  global.DiyarHadithWidget = DiyarHadithWidget;

  /**
   * Auto-init اختیاری: فقط وقتی فعال می‌شود که همین تگ
   * <script src="widget.js"> ویژگی data-auto-init="true" را داشته باشد.
   * document.currentScript فقط هنگام اجرای همزمان (غیر-async/module) این
   * فایل معتبر است — که چون این فایل به‌صورت اسکریپت کلاسیک بارگذاری
   * می‌شود، دقیقاً همین حالت است.
   */
  var thisScript = document.currentScript;
  if (thisScript && thisScript.getAttribute('data-auto-init') === 'true') {
    document.addEventListener('DOMContentLoaded', function () {
      new DiyarHadithWidget().init();
    });
  }
})(typeof window !== 'undefined' ? window : this);

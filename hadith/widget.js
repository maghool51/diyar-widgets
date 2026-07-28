/**
 * widget.js
 * نقطه‌ی ورود اصلی ویجت حدیث. کلاس HadithWidget تمام لایه‌های core را
 * به هم متصل می‌کند و رابط عمومی برای صفحات میزبان فراهم می‌آورد.
 *
 * نمونه استفاده:
 *   const widget = new HadithWidget({ containerId: 'hadith-widget', language: 'fa' });
 *   widget.init();
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./config.js'),
      require('./core/utils.js'),
      require('./core/storage.js'),
      require('./core/cache.js'),
      require('./core/api.js'),
      require('./core/renderer.js'),
      require('./core/share.js')
    );
  } else {
    root.HadithWidget = factory(
      root.HadithWidgetConfig,
      root.HadithUtils,
      root.HadithStorage,
      root.HadithCache,
      root.HadithApi,
      root.HadithRenderer,
      root.HadithShare
    );
  }
})(typeof self !== 'undefined' ? self : this, function (
  ConfigModule,
  Utils,
  Storage,
  Cache,
  Api,
  Renderer,
  Share
) {
  'use strict';

  class HadithWidget {
    constructor(options) {
      this.config = ConfigModule.merge(options);
      this.container = null;
      this.refs = null;
      this.hadiths = [];
      this.currentIndex = 0;
      this.currentHadith = null;
      this._refreshTimer = null;
      this._destroyed = false;
    }

    /** مقداردهی اولیه، دریافت داده و اولین رندر */
    async init() {
      this.container = document.getElementById(this.config.containerId);
      if (!this.container) {
        this._error(`عنصر با شناسه‌ی «${this.config.containerId}» پیدا نشد.`);
        return this;
      }

      this.refs = Renderer.createSkeleton(this.container, this.config);
      this._bindEvents();

      try {
        this.hadiths = await Api.getHadiths(this.config);
        if (this.config.category && this.config.category !== 'all') {
          this.hadiths = this.hadiths.filter((h) => h.category === this.config.category);
        }
        this._selectAndRender();

        if (typeof this.config.onLoad === 'function') {
          this.config.onLoad(this.currentHadith);
        }
      } catch (err) {
        this._error('خطا در دریافت داده‌ی احادیث. لطفاً اتصال اینترنت را بررسی کنید.');
        if (typeof this.config.onError === 'function') {
          this.config.onError(err);
        }
      }

      if (this.config.autoRefreshInterval > 0) {
        this._refreshTimer = setInterval(
          () => this.next(),
          this.config.autoRefreshInterval
        );
      }

      return this;
    }

    /** انتخاب حدیث بعدی و رندر مجدد */
    next() {
      if (!this.hadiths.length) return;
      if (this.config.selectionMode === 'sequential') {
        this.currentIndex = (this.currentIndex + 1) % this.hadiths.length;
        this.currentHadith = this.hadiths[this.currentIndex];
      } else {
        this.currentHadith = Utils.pickRandom(this.hadiths);
      }
      Renderer.renderHadith(this.refs, this.currentHadith, this.config);
    }

    /** اشتراک‌گذاری حدیث جاری */
    async share() {
      if (!this.currentHadith) return { ok: false };
      return Share.share(this.currentHadith, this.config);
    }

    /** بروزرسانی بخشی از تنظیمات در زمان اجرا و رندر مجدد */
    updateConfig(partial) {
      this.config = Utils.merge(this.config, partial);
      if (this.refs) {
        this.container.setAttribute('dir', this.config.direction);
        this.container.setAttribute('data-theme', this.config.theme);
        Renderer.renderHadith(this.refs, this.currentHadith, this.config);
      }
    }

    /** توقف تایمرها و پاکسازی رویدادها */
    destroy() {
      if (this._refreshTimer) clearInterval(this._refreshTimer);
      if (this.refs) {
        this.refs.refreshBtn.removeEventListener('click', this._onRefreshClick);
        this.refs.shareBtn.removeEventListener('click', this._onShareClick);
      }
      this._destroyed = true;
    }

    _selectAndRender() {
      if (this.config.selectionMode === 'daily') {
        this.currentHadith = Utils.pickDaily(this.hadiths);
      } else if (this.config.selectionMode === 'sequential') {
        this.currentIndex = 0;
        this.currentHadith = this.hadiths[0] || null;
      } else {
        this.currentHadith = Utils.pickRandom(this.hadiths);
      }
      Renderer.renderHadith(this.refs, this.currentHadith, this.config);
    }

    _bindEvents() {
      this._onRefreshClick = () => this.next();
      this._onShareClick = () => this.share();
      this.refs.refreshBtn.addEventListener('click', this._onRefreshClick);
      this.refs.shareBtn.addEventListener('click', this._onShareClick);
    }

    _error(message) {
      if (this.refs) {
        Renderer.renderError(this.refs, message);
      } else if (this.container) {
        this.container.textContent = message;
      }
    }
  }

  return HadithWidget;
});

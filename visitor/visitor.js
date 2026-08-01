/**
 * ==========================================================================
 * Diyar Visitor Widget — Core Controller
 * ==========================================================================
 * Orchestrates configuration, the data layer, theming, and animations
 * into a single mountable widget. This is the only module that touches
 * the live DOM tree of the widget instance — every other module is a
 * pure helper or an isolated subsystem consumed from here.
 *
 * @module visitor
 * @license MIT
 * ==========================================================================
 */

'use strict';

(function (global, document) {
  const config = global.DiyarVisitorConfig;
  const utils = global.DiyarVisitorUtils;
  const themeEngine = global.DiyarVisitorTheme;
  const animations = global.DiyarVisitorAnimations;

  if (!config || !utils || !themeEngine || !animations) {
    // eslint-disable-next-line no-console
    console.error(
      '[Diyar Visitor] Missing dependency. Ensure config.js, utils.js, theme.js and ' +
        'animations.js are loaded before visitor.js.'
    );
    return;
  }

  const { log, fetchVisitorStats, formatPersianDateTime } = utils;

  /**
   * Declarative definition of every stat card rendered by the widget.
   * `icon` references a `<symbol>` id defined once in the sprite loaded
   * by `index.html`. Order here drives the visual/reading order.
   */
  const STAT_DEFINITIONS = [
    { key: 'today', label: 'امروز', icon: 'icon-eye', tone: 'primary' },
    { key: 'yesterday', label: 'دیروز', icon: 'icon-calendar', tone: 'secondary' },
    { key: 'week', label: 'این هفته', icon: 'icon-chart', tone: 'tertiary' },
    { key: 'month', label: 'این ماه', icon: 'icon-calendar', tone: 'primary' },
    { key: 'total', label: 'کل بازدید', icon: 'icon-globe', tone: 'secondary' },
    { key: 'online', label: 'کاربران آنلاین', icon: 'icon-online', tone: 'success', live: true },
  ];

  /**
   * Builds the full widget DOM tree for a single mount point. Markup is
   * generated once; subsequent updates only ever touch text nodes and
   * class lists for maximum render efficiency.
   *
   * @param {HTMLElement} root
   * @returns {{
   *   counters: Record<string, HTMLElement>,
   *   cards: Record<string, HTMLElement>,
   *   themeToggle: HTMLElement,
   *   refreshButton: HTMLElement,
   *   footerTimestamp: HTMLElement,
   *   liveRegion: HTMLElement,
   * }}
   */
  function buildWidgetMarkup(root) {
    root.classList.add('diyar-visitor');
    root.setAttribute('dir', 'rtl');
    root.setAttribute('lang', 'fa');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'آمار بازدید سایت');
    root.setAttribute('data-diyar-widget', config.NAME);
    root.setAttribute('data-diyar-version', config.VERSION);

    root.innerHTML = `
      <div class="diyar-visitor__surface">
        <header class="diyar-visitor__header">
          <div class="diyar-visitor__title-group">
            <span class="diyar-visitor__title-icon" aria-hidden="true">📊</span>
            <h2 class="diyar-visitor__title">آمار بازدید</h2>
          </div>
          <button
            type="button"
            class="diyar-visitor__theme-toggle"
            data-diyar-theme-toggle
            aria-label="تغییر پوسته (روشن، تیره، خودکار)"
            title="تغییر پوسته"
          >
            <span class="diyar-visitor__theme-icon" data-theme-icon aria-hidden="true"></span>
          </button>
        </header>

        <ul class="diyar-visitor__grid" data-diyar-grid role="list">
          ${STAT_DEFINITIONS.map((stat) => renderCardMarkup(stat)).join('')}
        </ul>

        <footer class="diyar-visitor__footer">
          <svg class="diyar-visitor__footer-icon" aria-hidden="true" width="16" height="16">
            <use href="#icon-clock"></use>
          </svg>
          <span class="diyar-visitor__footer-label">آخرین بروزرسانی:</span>
          <time class="diyar-visitor__footer-time" data-diyar-updated-at>—</time>
          <button
            type="button"
            class="diyar-visitor__refresh"
            data-diyar-refresh
            aria-label="بروزرسانی دستی آمار"
            title="بروزرسانی"
          >
            <svg width="16" height="16" aria-hidden="true"><use href="#icon-refresh"></use></svg>
          </button>
        </footer>

        <div class="diyar-visitor__live-region" data-diyar-live role="status" aria-live="polite"></div>
      </div>
    `;

    const counters = {};
    const cards = {};

    STAT_DEFINITIONS.forEach((stat) => {
      cards[stat.key] = root.querySelector(`[data-card="${stat.key}"]`);
      counters[stat.key] = root.querySelector(`[data-counter="${stat.key}"]`);
    });

    return {
      counters,
      cards,
      themeToggle: root.querySelector('[data-diyar-theme-toggle]'),
      refreshButton: root.querySelector('[data-diyar-refresh]'),
      footerTimestamp: root.querySelector('[data-diyar-updated-at]'),
      liveRegion: root.querySelector('[data-diyar-live]'),
      themeIcon: root.querySelector('[data-theme-icon]'),
      grid: root.querySelector('[data-diyar-grid]'),
    };
  }

  /**
   * Renders the static markup for a single stat card, including its
   * skeleton placeholder markup which is toggled via the `is-loading`
   * class rather than re-rendered.
   *
   * @param {{key:string, label:string, icon:string, tone:string, live?:boolean}} stat
   * @returns {string}
   */
  function renderCardMarkup(stat) {
    return `
      <li
        class="diyar-visitor__card diyar-visitor__card--${stat.tone}"
        data-card="${stat.key}"
        role="listitem"
        aria-busy="true"
      >
        <div class="diyar-visitor__card-icon" aria-hidden="true">
          <svg width="22" height="22"><use href="#${stat.icon}"></use></svg>
          ${stat.live ? '<span class="diyar-visitor__pulse" aria-hidden="true"></span>' : ''}
        </div>
        <div class="diyar-visitor__card-body">
          <p class="diyar-visitor__card-label">${stat.label}</p>
          <p class="diyar-visitor__card-value">
            <span
              class="diyar-visitor__card-number"
              data-counter="${stat.key}"
              aria-live="off"
            >۰</span>
            <span class="diyar-visitor__skeleton-line" aria-hidden="true"></span>
          </p>
        </div>
      </li>
    `;
  }

  /**
   * Creates and mounts a single Diyar Visitor Widget instance.
   *
   * @param {string|HTMLElement} target - Selector or element to mount into.
   * @returns {{ refresh: () => Promise<void>, destroy: () => void, setTheme: (mode:string)=>void }}
   */
  function mount(target) {
    const root = typeof target === 'string' ? document.querySelector(target) : target;

    if (!root) {
      log('error', `Mount target not found: ${target}`);
      return { refresh: async () => {}, destroy: () => {}, setTheme: () => {} };
    }

    const refs = buildWidgetMarkup(root);
    const theme = themeEngine.createThemeController(root);
    let pollHandle = null;
    let previousStats = null;

    updateThemeIcon();
    root.addEventListener('diyar:theme-change', updateThemeIcon);

    refs.themeToggle.addEventListener('click', () => {
      animations.attachRipple(refs.themeToggle);
      theme.cycle();
    });
    animations.attachRipple(refs.themeToggle);

    refs.refreshButton.addEventListener('click', () => {
      animations.attachRipple(refs.refreshButton);
      renderStats({ force: true, announce: true });
    });
    animations.attachRipple(refs.refreshButton);

    // Reveal cards with a staggered entrance the moment the widget mounts,
    // independent of when data actually resolves.
    animations.staggerEntrance(Object.values(refs.cards));

    /** Updates the theme-toggle glyph to reflect the active resolved theme. */
    function updateThemeIcon() {
      const resolved = theme.getResolvedTheme();
      const mode = theme.getMode();
      const glyphs = { light: '☀️', dark: '🌙', auto: '🌓' };
      refs.themeIcon.textContent = glyphs[mode] || glyphs[resolved];
    }

    /**
     * Fetches the latest stats and reflects them into the DOM, animating
     * each counter from its previous value and updating the footer
     * timestamp. Skeleton state is shown only on the very first load so
     * subsequent silent polls never cause a visual flicker.
     *
     * @param {{ force?: boolean, announce?: boolean }} [options]
     */
    async function renderStats(options = {}) {
      const isFirstLoad = previousStats === null;

      if (isFirstLoad) {
        Object.values(refs.cards).forEach((card) => animations.setSkeletonState(card, true));
      }

      try {
        const stats = await fetchVisitorStats({ force: options.force });

        STAT_DEFINITIONS.forEach((stat) => {
          const el = refs.counters[stat.key];
          const card = refs.cards[stat.key];
          const from = previousStats ? previousStats[stat.key] : 0;
          const to = stats[stat.key];

          animations.setSkeletonState(card, false);
          animations.animateCounter(el, from, to);
        });

        refs.footerTimestamp.textContent = formatPersianDateTime(stats.updatedAt);
        refs.footerTimestamp.setAttribute('datetime', stats.updatedAt);

        if (options.announce) {
          refs.liveRegion.textContent = 'آمار بازدید بروزرسانی شد.';
        }

        previousStats = stats;
      } catch (error) {
        log('error', 'Failed to render visitor stats:', error);
        refs.liveRegion.textContent = 'بروزرسانی آمار با خطا مواجه شد.';
        Object.values(refs.cards).forEach((card) => animations.setSkeletonState(card, false));
      }
    }

    /** Starts the silent background polling loop. */
    function startPolling() {
      stopPolling();
      pollHandle = global.setInterval(() => {
        renderStats({ force: true });
      }, config.UPDATE_INTERVAL);
    }

    function stopPolling() {
      if (pollHandle) {
        global.clearInterval(pollHandle);
        pollHandle = null;
      }
    }

    // Pause polling when the tab is hidden to avoid wasted work, and
    // resume — with an immediate refresh — when it becomes visible again.
    function handleVisibilityChange() {
      if (document.hidden) {
        stopPolling();
      } else {
        renderStats({ force: true });
        startPolling();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    renderStats();
    startPolling();

    return {
      /** Forces an immediate re-fetch and re-render. */
      refresh: () => renderStats({ force: true, announce: true }),
      /** Tears down timers and listeners for this widget instance. */
      destroy() {
        stopPolling();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        root.removeEventListener('diyar:theme-change', updateThemeIcon);
        theme.destroy();
      },
      /** Programmatically sets the theme mode ('light' | 'dark' | 'auto'). */
      setTheme: (mode) => theme.setMode(mode),
    };
  }

  /**
   * Auto-mounts the widget into every element matching the configured
   * selector once the DOM is ready, storing instances on a global
   * registry so they can be inspected or torn down from the console.
   */
  function autoInit() {
    const selector = config.MOUNT_SELECTOR;
    const targets = document.querySelectorAll(selector);

    if (targets.length === 0) {
      log('warn', `No element matched mount selector "${selector}".`);
      return;
    }

    global.DiyarVisitorInstances = Array.prototype.map.call(targets, (el) => mount(el));
  }

  const DiyarVisitor = Object.freeze({ mount, VERSION: config.VERSION });
  global.DiyarVisitor = DiyarVisitor;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null);

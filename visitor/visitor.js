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
   * Tracks which root elements already have a live widget instance
   * mounted on them, keyed by the element itself. Backed by a WeakMap
   * so entries never leak once a root element is garbage collected,
   * and used to guarantee `mount()`/`autoInit()` never attach a second
   * set of listeners/timers to the same DOM node.
   *
   * @type {WeakMap<Element, {refresh:Function, destroy:Function, setTheme:Function}>}
   */
  const mountedInstances = new WeakMap();

  /**
   * Normalizes every input shape `mount()`/`autoInit()` accept into a
   * de-duplicated array of real DOM elements:
   *
   *   - a CSS selector string      → every match of `document.querySelectorAll`
   *   - a single `Element`         → that one element
   *   - a `NodeList`               → every element it contains
   *   - a plain `Array` of `Element`s → every element it contains
   *
   * De-duplication guards against a target matching more than one
   * selector, or a caller passing overlapping collections, ever
   * resulting in the same element being mounted twice.
   *
   * @param {string|Element|NodeList|Element[]} target
   * @returns {Element[]}
   */
  function resolveMountTargets(target) {
    let candidates = [];

    if (typeof target === 'string') {
      candidates = Array.from(document.querySelectorAll(target));
    } else if (target instanceof Element) {
      candidates = [target];
    } else if (target && typeof target.length === 'number') {
      // Covers both NodeList and a plain Array of elements.
      candidates = Array.prototype.filter.call(target, (el) => el instanceof Element);
    }

    return Array.from(new Set(candidates));
  }

  /**
   * Creates and mounts a single Diyar Visitor Widget instance onto one
   * root element. Idempotent: calling this again on a root that already
   * has a live instance returns that SAME instance rather than building
   * a second one, so repeated `mount()`/`autoInit()` calls can never
   * result in duplicate event listeners or duplicate polling timers on
   * the same DOM node.
   *
   * @param {Element} root
   * @returns {{ refresh: () => Promise<void>, destroy: () => void, setTheme: (mode:string)=>void }}
   */
  function mountSingle(root) {
    if (mountedInstances.has(root)) {
      log('warn', 'Element is already mounted; skipping duplicate mount.', root);
      return mountedInstances.get(root);
    }

    const refs = buildWidgetMarkup(root);
    const theme = themeEngine.createThemeController(root);
    let pollHandle = null;
    let previousStats = null;

    // One in-flight animation cancel function per stat key, so a rapid
    // refresh (manual click racing a background poll, or two polls
    // overlapping under an unusually slow connection) never leaves two
    // requestAnimationFrame loops racing to write the same counter.
    const activeCounterCancellers = {};

    updateThemeIcon();
    root.addEventListener('diyar:theme-change', updateThemeIcon);

    const handleThemeToggleClick = () => {
      animations.attachRipple(refs.themeToggle);
      theme.cycle();
    };
    refs.themeToggle.addEventListener('click', handleThemeToggleClick);
    const detachThemeToggleRipple = animations.attachRipple(refs.themeToggle);

    const handleRefreshClick = () => {
      animations.attachRipple(refs.refreshButton);
      renderStats({ force: true, announce: true });
    };
    refs.refreshButton.addEventListener('click', handleRefreshClick);
    const detachRefreshRipple = animations.attachRipple(refs.refreshButton);

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
     * subsequent silent polls never cause a visual flicker. A counter
     * whose value hasn't changed since the last render is left alone
     * entirely — no animation is started and no DOM write happens for
     * it — since animating a value to itself would be pure wasted work.
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

          // Skip the animation (and the DOM writes it performs every
          // frame) whenever this isn't the very first render AND the
          // value is identical to what's already on screen.
          const valueUnchanged = !isFirstLoad && from === to;
          if (valueUnchanged) {
            return;
          }

          if (typeof activeCounterCancellers[stat.key] === 'function') {
            activeCounterCancellers[stat.key]();
          }
          activeCounterCancellers[stat.key] = animations.animateCounter(el, from, to);
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

    const instance = {
      /** Forces an immediate re-fetch and re-render. */
      refresh: () => renderStats({ force: true, announce: true }),
      /** Tears down timers, listeners, and in-flight animations, and clears this instance's rendered markup so it is neither visible nor interactive after destruction. */
      destroy() {
        stopPolling();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        root.removeEventListener('diyar:theme-change', updateThemeIcon);
        refs.themeToggle.removeEventListener('click', handleThemeToggleClick);
        refs.refreshButton.removeEventListener('click', handleRefreshClick);
        detachThemeToggleRipple();
        detachRefreshRipple();
        Object.values(activeCounterCancellers).forEach((cancel) => {
          if (typeof cancel === 'function') cancel();
        });
        theme.destroy();
        mountedInstances.delete(root);

        // Fully clear the rendered markup and the attributes/classes
        // buildWidgetMarkup() added, so a "destroyed" widget is neither
        // visible nor interactive — not merely quiet in the background —
        // and so the same root element can be legitimately mounted again
        // later via mount()/autoInit() without leftover state.
        root.innerHTML = '';
        root.classList.remove('diyar-visitor');
        root.removeAttribute('data-diyar-mounted');
        root.removeAttribute('data-diyar-widget');
        root.removeAttribute('data-diyar-version');
        root.removeAttribute('dir');
        root.removeAttribute('lang');
        root.removeAttribute('role');
        root.removeAttribute('aria-label');
      },
      /** Programmatically sets the theme mode ('light' | 'dark' | 'auto'). */
      setTheme: (mode) => theme.setMode(mode),
    };

    root.setAttribute('data-diyar-mounted', 'true');
    mountedInstances.set(root, instance);

    return instance;
  }

  /**
   * Creates and mounts one or more Diyar Visitor Widget instances.
   *
   * Accepts anything `resolveMountTargets` understands: a CSS selector
   * string, a single `Element`, a `NodeList`, or a plain `Array` of
   * elements. Resolving to exactly one element returns a single
   * instance object exactly as before — full backward compatibility
   * with every existing caller (including `embed.js`, unchanged).
   * Resolving to more than one element returns an array of instance
   * objects, one per element, in the same order they were resolved.
   * An element that is already mounted is never mounted a second time.
   *
   * @param {string|Element|NodeList|Element[]} target
   * @returns {{refresh:Function,destroy:Function,setTheme:Function}|Array<{refresh:Function,destroy:Function,setTheme:Function}>}
   */
  function mount(target) {
    const elements = resolveMountTargets(target);

    if (elements.length === 0) {
      log('error', 'Mount target not found:', target);
      return { refresh: async () => {}, destroy: () => {}, setTheme: () => {} };
    }

    const instances = elements.map((el) => mountSingle(el));

    return instances.length === 1 ? instances[0] : instances;
  }

  /**
   * Auto-mounts the widget into every element matching any supported
   * mount convention once the DOM is ready:
   *
   *   - `config.MOUNT_SELECTOR` (`#diyar-visitor-widget` by default) —
   *     kept exactly as-is for full backward compatibility with existing
   *     pages and the bundled `index.html` demo.
   *   - `[data-diyar-widget]` — attribute-based convention, the
   *     preferred way to mark up more than one widget on a single page.
   *   - `.diyar-visitor-widget` — equivalent class-based convention.
   *
   * All three are queried together in one pass; `resolveMountTargets`
   * already de-duplicates in case a single element happens to match
   * more than one of them, and `mountSingle` refuses to mount the same
   * element twice regardless, so no element ever ends up with two sets
   * of listeners or two polling timers no matter how it was marked up.
   */
  function autoInit() {
    const selector = [config.MOUNT_SELECTOR, '[data-diyar-widget]', '.diyar-visitor-widget']
      .filter(Boolean)
      .join(', ');

    const targets = resolveMountTargets(selector);

    if (targets.length === 0) {
      log('warn', `No element matched any mount selector ("${selector}").`);
      return;
    }

    global.DiyarVisitorInstances = targets.map((el) => mountSingle(el));
  }

  const DiyarVisitor = Object.freeze({ mount, VERSION: config.VERSION });
  global.DiyarVisitor = DiyarVisitor;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null);

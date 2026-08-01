/**
 * ============================================================================
 * Diyar Widgets — Visitor Statistics Widget
 * visitor.js
 * ----------------------------------------------------------------------------
 * Vanilla ES6+ implementation. No frameworks, no globals leaked.
 *
 * Architecture
 * ------------
 *   PersianNumberFormatter — converts numbers to localized Persian digits.
 *   DataProvider            — the ONLY module that will change when a real
 *                              API is introduced (see fetchVisitorStats).
 *   ThemeManager            — resolves & applies light/dark theme.
 *   CounterAnimator         — animates numeric values with easing.
 *   VisitorWidgetApp        — orchestrates DOM rendering & lifecycle.
 *
 * Everything is wrapped in a single IIFE under strict mode so nothing
 * leaks into the global scope except what is intentionally exposed for
 * debugging (window.VisitorWidget, only when CONFIG.DEBUG is true).
 * ============================================================================
 */

"use strict";

(function visitorWidgetBootstrap(root, doc) {
  const CONFIG = root.VisitorWidgetConfig;

  if (!CONFIG) {
    console.error(
      "[visitor-widget] config.js must be loaded before visitor.js."
    );
    return;
  }

  /**
   * Lightweight logger that respects CONFIG.DEBUG.
   * Keeps the rest of the code free of scattered `if (DEBUG)` checks.
   */
  const Logger = Object.freeze({
    info(...args) {
      if (CONFIG.DEBUG) console.info("[visitor-widget]", ...args);
    },
    warn(...args) {
      if (CONFIG.DEBUG) console.warn("[visitor-widget]", ...args);
    },
    error(...args) {
      console.error("[visitor-widget]", ...args);
    }
  });

  /**
   * ==========================================================================
   * MODULE: PersianNumberFormatter
   * --------------------------------------------------------------------------
   * Reusable, dependency-free formatter that converts Western Arabic digits
   * into Persian digits and inserts the Persian thousands separator (٬).
   *
   *   184352  ->  "۱۸۴٬۳۵۲"
   * ==========================================================================
   */
  const PersianNumberFormatter = (() => {
    const DIGIT_MAP = Object.freeze({
      0: "۰", 1: "۱", 2: "۲", 3: "۳", 4: "۴",
      5: "۵", 6: "۶", 7: "۷", 8: "۸", 9: "۹"
    });

    const PERSIAN_THOUSANDS_SEPARATOR = "٬";

    /**
     * Converts every Western digit inside a string to its Persian equivalent.
     * @param {string} value
     * @returns {string}
     */
    function toPersianDigits(value) {
      return String(value).replace(/[0-9]/g, (digit) => DIGIT_MAP[digit]);
    }

    /**
     * Formats an integer with Persian thousands separators and digits.
     * Falls back gracefully for non-finite input.
     * @param {number} value
     * @returns {string}
     */
    function formatNumber(value) {
      const safeValue = Number.isFinite(value) ? Math.round(value) : 0;
      const withEnglishSeparators = safeValue.toLocaleString("en-US");
      const withPersianSeparators = withEnglishSeparators.replace(
        /,/g,
        PERSIAN_THOUSANDS_SEPARATOR
      );
      return toPersianDigits(withPersianSeparators);
    }

    /**
     * Formats a Date as a Persian-digit HH:MM 24h time string.
     * @param {Date} date
     * @returns {string}
     */
    function formatTime(date) {
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return toPersianDigits(`${hours}:${minutes}`);
    }

    return Object.freeze({ toPersianDigits, formatNumber, formatTime });
  })();

  /**
   * ==========================================================================
   * MODULE: DataProvider
   * --------------------------------------------------------------------------
   * Single source of truth for visitor statistics.
   *
   * IMPORTANT — FUTURE API MIGRATION
   * When a real backend becomes available, replace ONLY the body of
   * `fetchVisitorStats` with a real network call, e.g.:
   *
   *   async function fetchVisitorStats() {
   *     const response = await fetch(CONFIG.API.ENDPOINT, {
   *       signal: AbortSignal.timeout(CONFIG.API.TIMEOUT_MS)
   *     });
   *     if (!response.ok) throw new Error(`HTTP ${response.status}`);
   *     return response.json();
   *   }
   *
   * Every other module consumes this function's return shape
   * ({ today, yesterday, week, month, total, online, updatedAt }),
   * so no other file needs to change.
   * ==========================================================================
   */
  const DataProvider = (() => {
    let cachedStats = null;
    let cachedAt = 0;

    /**
     * Simulates network latency so the UI's loading/animation behavior
     * matches what a real API call would feel like.
     * @returns {Promise<void>}
     */
    function simulateNetworkDelay() {
      const delay = 250 + Math.random() * 350;
      return new Promise((resolve) => setTimeout(resolve, delay));
    }

    /**
     * Produces a small, believable amount of drift on the "online" figure
     * so the widget feels alive between refresh cycles. Purely cosmetic —
     * has no bearing on how a real API integration would behave.
     * @param {number} base
     * @returns {number}
     */
    function driftOnlineCount(base) {
      const delta = Math.round(Math.random() * 4) - 2; // -2..+2
      return Math.max(0, base + delta);
    }

    /**
     * MOCK IMPLEMENTATION — replace this function's body only.
     * @returns {Promise<VisitorMockData & {updatedAt: Date}>}
     */
    async function fetchVisitorStats() {
      await simulateNetworkDelay();

      const base = CONFIG.DEFAULT_DATA;
      return {
        today: base.today,
        yesterday: base.yesterday,
        week: base.week,
        month: base.month,
        total: base.total,
        online: driftOnlineCount(base.online),
        updatedAt: new Date()
      };
    }

    /**
     * Public accessor with lightweight in-memory caching, respecting
     * CONFIG.CACHE_TIME so rapid re-renders don't spam the data source.
     * @param {boolean} [forceRefresh=false]
     * @returns {Promise<VisitorMockData & {updatedAt: Date}>}
     */
    async function getStats(forceRefresh = false) {
      const isCacheValid =
        cachedStats && Date.now() - cachedAt < CONFIG.CACHE_TIME;

      if (isCacheValid && !forceRefresh) {
        Logger.info("Serving visitor stats from cache.");
        return cachedStats;
      }

      Logger.info("Fetching fresh visitor stats.");
      const stats = await fetchVisitorStats();
      cachedStats = stats;
      cachedAt = Date.now();
      return stats;
    }

    return Object.freeze({ getStats });
  })();

  /**
   * ==========================================================================
   * MODULE: ThemeManager
   * --------------------------------------------------------------------------
   * Resolves the effective theme ("light" | "dark") from CONFIG.THEME,
   * the browser's prefers-color-scheme, and an optional in-memory
   * runtime override toggled by the user.
   * ==========================================================================
   */
  const ThemeManager = (() => {
    const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";
    let runtimeOverride = null; // "light" | "dark" | null

    /**
     * @returns {"light"|"dark"}
     */
    function detectSystemTheme() {
      const prefersDark =
        root.matchMedia && root.matchMedia(DARK_MEDIA_QUERY).matches;
      return prefersDark ? "dark" : "light";
    }

    /**
     * @returns {"light"|"dark"}
     */
    function resolveTheme() {
      if (runtimeOverride) return runtimeOverride;
      if (CONFIG.THEME === "light" || CONFIG.THEME === "dark") {
        return CONFIG.THEME;
      }
      return detectSystemTheme();
    }

    /**
     * Applies the resolved theme to the widget root via `data-theme`,
     * which visitor.css reads to switch custom property values.
     * @param {HTMLElement} widgetEl
     */
    function applyTheme(widgetEl) {
      const theme = resolveTheme();
      widgetEl.setAttribute("data-theme", theme);
      Logger.info("Theme applied:", theme);
    }

    /**
     * Flips between light and dark, overriding system preference until
     * the page is reloaded (no persistence, by design).
     * @param {HTMLElement} widgetEl
     */
    function toggleTheme(widgetEl) {
      const current = resolveTheme();
      runtimeOverride = current === "dark" ? "light" : "dark";
      applyTheme(widgetEl);
    }

    /**
     * Keeps the widget in sync with OS-level theme changes when the
     * user has not manually overridden the theme.
     * @param {HTMLElement} widgetEl
     */
    function watchSystemChanges(widgetEl) {
      if (!root.matchMedia) return;
      const mql = root.matchMedia(DARK_MEDIA_QUERY);
      const handler = () => {
        if (!runtimeOverride) applyTheme(widgetEl);
      };
      // addEventListener is preferred; addListener is a legacy fallback.
      if (mql.addEventListener) mql.addEventListener("change", handler);
      else if (mql.addListener) mql.addListener(handler);
    }

    return Object.freeze({ applyTheme, toggleTheme, watchSystemChanges });
  })();

  /**
   * ==========================================================================
   * MODULE: CounterAnimator
   * --------------------------------------------------------------------------
   * Animates a numeric text node from its current displayed value up to a
   * target value using an ease-out curve. Respects `prefers-reduced-motion`.
   * ==========================================================================
   */
  const CounterAnimator = (() => {
    const prefersReducedMotion =
      root.matchMedia &&
      root.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /**
     * Ease-out cubic — quick start, gentle settle.
     * @param {number} t progress between 0 and 1
     * @returns {number}
     */
    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    /**
     * @param {HTMLElement} element
     * @param {number} targetValue
     * @param {number} [duration]
     * @returns {void}
     */
    function animate(element, targetValue, duration = CONFIG.ANIMATION_SPEED) {
      const startValue = Number(element.dataset.countTarget) || 0;
      element.dataset.countTarget = String(targetValue);

      if (prefersReducedMotion || startValue === targetValue) {
        element.textContent = PersianNumberFormatter.formatNumber(targetValue);
        return;
      }

      const startTime = performance.now();

      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);
        const currentValue = startValue + (targetValue - startValue) * eased;

        element.textContent = PersianNumberFormatter.formatNumber(currentValue);

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          // Ensure we land exactly on the target, no rounding drift.
          element.textContent = PersianNumberFormatter.formatNumber(targetValue);
        }
      }

      requestAnimationFrame(step);
    }

    return Object.freeze({ animate });
  })();

  /**
   * ==========================================================================
   * MODULE: VisitorWidgetApp
   * --------------------------------------------------------------------------
   * Ties everything together: queries the DOM once, renders stats,
   * wires up interactions, and manages the auto-refresh lifecycle.
   * ==========================================================================
   */
  const VisitorWidgetApp = (() => {
    /** @type {Record<string, HTMLElement>} */
    let elements = {};
    let refreshTimerId = null;

    /**
     * Caches all DOM references a single time to avoid repeated queries
     * (performance: minimal reflow/repaint triggers).
     * @returns {boolean} whether the widget root was found
     */
    function cacheDom() {
      const widget = doc.getElementById("visitorWidget");
      if (!widget) {
        Logger.error("Widget root #visitorWidget not found in the DOM.");
        return false;
      }

      elements = {
        widget,
        themeToggle: doc.getElementById("visitorThemeToggle"),
        updatedTime: doc.getElementById("visitorUpdatedTime"),
        cards: {
          today: widget.querySelector('[data-stat="today"] .visitor-card__value'),
          yesterday: widget.querySelector('[data-stat="yesterday"] .visitor-card__value'),
          week: widget.querySelector('[data-stat="week"] .visitor-card__value'),
          month: widget.querySelector('[data-stat="month"] .visitor-card__value'),
          total: widget.querySelector('[data-stat="total"] .visitor-card__value'),
          online: widget.querySelector('[data-stat="online"] .visitor-card__value')
        }
      };

      return true;
    }

    /**
     * Renders a stats payload into the cached DOM nodes, animating
     * each counter. Only touches nodes whose value actually changed
     * would be ideal, but CounterAnimator already no-ops when the
     * target equals the current value, keeping repaints minimal.
     * @param {VisitorMockData & {updatedAt: Date}} stats
     */
    function render(stats) {
      CounterAnimator.animate(elements.cards.today, stats.today);
      CounterAnimator.animate(elements.cards.yesterday, stats.yesterday);
      CounterAnimator.animate(elements.cards.week, stats.week);
      CounterAnimator.animate(elements.cards.month, stats.month);
      CounterAnimator.animate(elements.cards.total, stats.total);
      CounterAnimator.animate(elements.cards.online, stats.online);

      if (elements.updatedTime) {
        elements.updatedTime.textContent = PersianNumberFormatter.formatTime(
          stats.updatedAt
        );
        elements.updatedTime.setAttribute(
          "datetime",
          stats.updatedAt.toISOString()
        );
      }
    }

    /**
     * Fetches the latest stats and renders them. Isolated so it can be
     * called both on load and on every refresh tick.
     * @param {boolean} [forceRefresh=false]
     */
    async function refresh(forceRefresh = false) {
      try {
        const stats = await DataProvider.getStats(forceRefresh);
        render(stats);
      } catch (error) {
        Logger.error("Failed to load visitor stats:", error);
      }
    }

    /**
     * Starts the background auto-refresh loop, cleaning up any
     * previous timer first (idempotent).
     */
    function startAutoRefresh() {
      stopAutoRefresh();
      refreshTimerId = setInterval(() => {
        refresh(true);
      }, CONFIG.UPDATE_INTERVAL);
    }

    function stopAutoRefresh() {
      if (refreshTimerId !== null) {
        clearInterval(refreshTimerId);
        refreshTimerId = null;
      }
    }

    /**
     * Pauses refreshing while the tab is hidden and resumes (with an
     * immediate refresh) when it becomes visible again — avoids wasted
     * work and keeps data fresh the moment the user returns.
     */
    function watchVisibility() {
      doc.addEventListener("visibilitychange", () => {
        if (doc.hidden) {
          stopAutoRefresh();
        } else {
          refresh(true);
          startAutoRefresh();
        }
      });
    }

    /**
     * Wires the theme toggle button, if present in the markup.
     */
    function bindThemeToggle() {
      if (!elements.themeToggle) return;
      elements.themeToggle.addEventListener("click", () => {
        ThemeManager.toggleTheme(elements.widget);
      });
    }

    /**
     * Public entry point.
     */
    async function init() {
      if (!cacheDom()) return;

      ThemeManager.applyTheme(elements.widget);
      ThemeManager.watchSystemChanges(elements.widget);
      bindThemeToggle();
      watchVisibility();

      await refresh(false);
      startAutoRefresh();

      Logger.info(`Visitor widget v${CONFIG.VERSION} ready.`);
    }

    return Object.freeze({ init });
  })();

  // Bootstrap once the DOM is interactive.
  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", VisitorWidgetApp.init);
  } else {
    VisitorWidgetApp.init();
  }

  // Expose a debug handle only when explicitly enabled — keeps the
  // global scope clean in production.
  if (CONFIG.DEBUG) {
    root.VisitorWidget = Object.freeze({
      PersianNumberFormatter,
      DataProvider,
      ThemeManager,
      CounterAnimator
    });
  }
})(window, document);

/**
 * ==========================================================================
 * Diyar Visitor Widget — Utilities & Data Layer
 * ==========================================================================
 * Pure, dependency-free helper functions plus the isolated data-access
 * layer. Every function here is side-effect-free unless explicitly noted
 * (the data layer caches in module scope by design).
 *
 * @module utils
 * @license MIT
 * ==========================================================================
 */

'use strict';

(function (global) {
  const config = global.DiyarVisitorConfig || {};

  /** Map of ASCII digits to their Persian (Farsi) counterparts. */
  const PERSIAN_DIGIT_MAP = Object.freeze({
    0: '۰', 1: '۱', 2: '۲', 3: '۳', 4: '۴',
    5: '۵', 6: '۶', 7: '۷', 8: '۸', 9: '۹',
  });

  /**
   * Emits a namespaced, debug-gated console message so production
   * consoles stay silent unless `DiyarVisitorConfig.DEBUG` is enabled.
   * @param {'log'|'warn'|'error'} level
   * @param {...*} args
   */
  function log(level, ...args) {
    if (!config.DEBUG) return;
    const prefix = '%c[Diyar Visitor]';
    const style = 'color:#4C6EF5;font-weight:600;';
    // eslint-disable-next-line no-console
    (console[level] || console.log)(prefix, style, ...args);
  }

  /**
   * Converts any finite number (or numeric string) into a string of
   * Persian digits, inserting Persian thousands separators (٬) every
   * three digits — e.g. 184352 → "۱۸۴٬۳۵۲".
   *
   * Non-finite or non-numeric input safely resolves to the Persian
   * zero glyph so the UI never renders "NaN" to an end user.
   *
   * @param {number|string} value
   * @returns {string}
   */
  function toPersianDigits(value) {
    const numeric = typeof value === 'string' ? Number(value.replace(/[^\d.-]/g, '')) : value;

    if (!Number.isFinite(numeric)) {
      log('warn', 'toPersianDigits received a non-finite value:', value);
      return PERSIAN_DIGIT_MAP[0];
    }

    const rounded = Math.round(numeric);
    const withSeparators = rounded.toLocaleString('en-US');

    return withSeparators.replace(/[0-9]/g, (digit) => PERSIAN_DIGIT_MAP[digit]).replace(/,/g, '٬');
  }

  /**
   * Formats an ISO timestamp into a localized Persian date/time string
   * suitable for the "last updated" footer, e.g. "۱۴۰۳/۰۵/۱۰ - ۱۴:۲۲".
   *
   * @param {string|number|Date} timestamp
   * @returns {string}
   */
  function formatPersianDateTime(timestamp) {
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      const formatter = new Intl.DateTimeFormat(config.LOCALE || 'fa-IR', {
        timeZone: config.TIMEZONE || 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      // Intl already renders Persian digits + calendar for the fa-IR
      // locale, so the string is returned as-is for maximum accuracy.
      return formatter.format(date);
    } catch (error) {
      log('error', 'formatPersianDateTime failed:', error);
      return '—';
    }
  }

  /**
   * Clamps a number between an inclusive lower and upper bound.
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Standard easing curve (ease-out-cubic) used for counter and entrance
   * animations so motion feels physical rather than linear/mechanical.
   * @param {number} t - Progress ratio between 0 and 1.
   * @returns {number}
   */
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Wraps `requestAnimationFrame` in a promise-friendly ticker used by
   * the animation engine. Falls back to `setTimeout` in environments
   * without RAF (e.g. headless test runners).
   * @param {(timestamp: number) => void} callback
   * @returns {number} handle usable with `cancelAnimationFrame`
   */
  function raf(callback) {
    if (typeof requestAnimationFrame === 'function') {
      return requestAnimationFrame(callback);
    }
    return setTimeout(() => callback(Date.now()), 16);
  }

  /**
   * Debounces a function so rapid, repeated calls (e.g. window `resize`)
   * only trigger the wrapped function once activity settles.
   * @param {Function} fn
   * @param {number} wait
   * @returns {Function}
   */
  function debounce(fn, wait) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /**
   * Merges the frozen `DEFAULT_DATA` with a partial payload, guaranteeing
   * every field required by the UI is always present even if a future
   * API response is incomplete.
   * @param {Partial<VisitorStats>} partial
   * @returns {VisitorStats}
   */
  function normalizeStats(partial) {
    const base = config.DEFAULT_DATA || {};
    return {
      today: Number.isFinite(partial?.today) ? partial.today : base.today,
      yesterday: Number.isFinite(partial?.yesterday) ? partial.yesterday : base.yesterday,
      week: Number.isFinite(partial?.week) ? partial.week : base.week,
      month: Number.isFinite(partial?.month) ? partial.month : base.month,
      total: Number.isFinite(partial?.total) ? partial.total : base.total,
      online: Number.isFinite(partial?.online) ? partial.online : base.online,
      updatedAt: partial?.updatedAt || new Date().toISOString(),
    };
  }

  // ------------------------------------------------------------------
  // Data Layer
  // ------------------------------------------------------------------
  // This is the ONLY module that knows whether data comes from a mock
  // object or a live network call. Swapping the data source later means
  // editing `fetchVisitorStats` here — `visitor.js` and every rendering
  // module remain completely untouched.
  // ------------------------------------------------------------------

  /** @type {{ data: VisitorStats|null, fetchedAt: number }} */
  const cache = { data: null, fetchedAt: 0 };

  /**
   * Produces a plausible next data snapshot by nudging the previous
   * snapshot's values. Keeps the mock feed feeling "alive" across polls
   * without requiring a network dependency.
   * @param {VisitorStats} previous
   * @returns {VisitorStats}
   */
  function driftMockStats(previous) {
    const wobble = (base, spread) => Math.max(0, Math.round(base + (Math.random() - 0.5) * spread));

    return normalizeStats({
      today: wobble(previous.today, 6),
      yesterday: previous.yesterday,
      week: wobble(previous.week, 10),
      month: wobble(previous.month, 14),
      total: previous.total + Math.round(Math.random() * 5),
      online: Math.max(1, wobble(previous.online, 3)),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Retrieves the current visitor statistics.
   *
   * Today this resolves the frozen `DEFAULT_DATA` (optionally drifted to
   * simulate a live feed). Once a backend exists, replace the body of
   * this function with a `fetch(config.API_ENDPOINT)` call — the return
   * contract (`Promise<VisitorStats>`) is future-proofed to make that a
   * drop-in change with zero UI-layer edits.
   *
   * @param {{ force?: boolean }} [options]
   * @returns {Promise<VisitorStats>}
   */
  async function fetchVisitorStats(options = {}) {
    const { force = false } = options;
    const now = Date.now();
    const isFresh = cache.data && now - cache.fetchedAt < (config.CACHE_TIME || 60000);

    if (isFresh && !force) {
      log('log', 'Serving visitor stats from cache.');
      return cache.data;
    }

    // --------------------------------------------------------------
    // FUTURE API INTEGRATION POINT
    // --------------------------------------------------------------
    // try {
    //   const controller = new AbortController();
    //   const timeout = setTimeout(() => controller.abort(), config.API_TIMEOUT);
    //   const response = await fetch(config.API_ENDPOINT, { signal: controller.signal });
    //   clearTimeout(timeout);
    //   if (!response.ok) throw new Error(`HTTP ${response.status}`);
    //   const payload = await response.json();
    //   cache.data = normalizeStats(payload);
    //   cache.fetchedAt = Date.now();
    //   return cache.data;
    // } catch (error) {
    //   log('warn', 'Live fetch failed, falling back to mock data:', error);
    // }
    // --------------------------------------------------------------

    const next = cache.data ? driftMockStats(cache.data) : normalizeStats(config.DEFAULT_DATA);

    // Simulate realistic network latency so loading/skeleton states are
    // visible and testable even against the mock data source.
    await new Promise((resolve) => setTimeout(resolve, 320));

    cache.data = next;
    cache.fetchedAt = Date.now();
    log('log', 'Visitor stats refreshed:', next);
    return next;
  }

  /** Clears the in-memory cache — primarily useful for tests. */
  function resetVisitorStatsCache() {
    cache.data = null;
    cache.fetchedAt = 0;
  }

  const DiyarVisitorUtils = Object.freeze({
    toPersianDigits,
    formatPersianDateTime,
    clamp,
    easeOutCubic,
    raf,
    debounce,
    normalizeStats,
    fetchVisitorStats,
    resetVisitorStatsCache,
    log,
  });

  global.DiyarVisitorUtils = DiyarVisitorUtils;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiyarVisitorUtils;
  }
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * ==========================================================================
 * Diyar Visitor Widget — Utilities & Data Layer
 * ==========================================================================
 * Pure, dependency-free helper functions plus the isolated data-access
 * layer. Every formatting helper here is side-effect-free; the data layer
 * (bottom of the file) intentionally keeps a small module-scoped cache by
 * design, since it is the single seam the rest of the widget talks through.
 *
 * DATA LAYER CONTRACT
 * --------------------------------------------------------------------------
 * `fetchVisitorStats()` is the ONLY function in the entire project that
 * knows where visitor numbers come from. Today it reads a static
 * `stats.json` file (see `DiyarVisitorConfig.DATA_URL`). A future backend
 * (REST API, Cloudflare Worker, Supabase, Firebase, a GitHub Action that
 * regenerates `stats.json` on a schedule, etc.) can be wired in by editing
 * only this function — `visitor.js`, `theme.js`, and `animations.js` never
 * need to change, since they only ever see the normalized
 * `VisitorStats` shape returned here.
 *
 * SCHEMA COMPATIBILITY
 * --------------------------------------------------------------------------
 * `stats.json` may arrive in either of two shapes:
 *
 *   Legacy (flat):
 *     { "today": 132, "yesterday": 241, ..., "updatedAt": "..." }
 *
 *   Current (versioned/nested):
 *     {
 *       "version": 1,
 *       "generatedAt": "...",
 *       "stats": { "today": 132, "yesterday": 241, ... }
 *     }
 *
 * `unwrapStatsPayload()` below detects which shape it received and
 * normalizes it into the flat `{ ...counts, updatedAt }` shape that
 * `normalizeStats()` has always expected — `normalizeStats()` itself is
 * untouched, and every module downstream of it stays exactly as it was.
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
   * Merges an arbitrary, possibly-partial payload with the frozen
   * `DEFAULT_DATA` fallback, guaranteeing every field required by the UI
   * is always present — even if a `stats.json` response (or, later, a
   * live API response) is incomplete or malformed.
   *
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
  // This is the ONLY section that knows visitor data currently comes
  // from a static `stats.json` file. Swapping in a real backend later
  // means editing `fetchVisitorStats` below — `visitor.js` and every
  // rendering module remain completely untouched, since they only ever
  // consume the returned `VisitorStats` shape.
  // ------------------------------------------------------------------

  /**
   * @type {{
   *   data: VisitorStats|null,
   *   fetchedAt: number,
   *   pendingRequest: Promise<VisitorStats>|null,
   * }}
   */
  const cache = { data: null, fetchedAt: 0, pendingRequest: null };

  /**
   * Detects which `stats.json` schema a raw payload uses and flattens it
   * into the shape `normalizeStats()` has always expected:
   * `{ today, yesterday, week, month, total, online, updatedAt }`.
   *
   * Two schemas are supported:
   *
   *   1. Current (versioned/nested) — has a `stats` object:
   *        { version, generatedAt, stats: { today, ... }, ... }
   *      The counts are read from `payload.stats`, and `generatedAt` is
   *      mapped onto `updatedAt` so the rest of the app never needs to
   *      know the field was renamed.
   *
   *   2. Legacy (flat) — no `stats` object, counts sit at the top level:
   *        { today, yesterday, week, month, total, online, updatedAt }
   *      The payload is passed through unchanged.
   *
   * This function never throws: an unrecognized or malformed payload
   * simply flattens to an object with no numeric fields, which
   * `normalizeStats()` will then fill in from `DEFAULT_DATA` as usual.
   *
   * @param {*} payload - Raw, parsed JSON body from `stats.json` (or a
   *   future live API response using either shape).
   * @returns {Partial<VisitorStats>}
   */
  function unwrapStatsPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    const usesNestedSchema =
      payload.stats && typeof payload.stats === 'object' && !Array.isArray(payload.stats);

    if (usesNestedSchema) {
      log('log', `Detected versioned stats.json schema (version ${payload.version ?? 'unknown'}).`);
      return {
        ...payload.stats,
        // `generatedAt` describes the whole payload in the new schema;
        // map it onto `updatedAt` so normalizeStats()/visitor.js/the
        // footer timestamp all keep working exactly as before.
        updatedAt: payload.generatedAt || payload.stats.updatedAt,
      };
    }

    log('log', 'Detected legacy flat stats.json schema.');
    return payload;
  }

  /**
   * Performs ONE network request attempt for `stats.json`, with a
   * request timeout and cache-busting support for forced refreshes.
   * Used internally by `requestStatsJson`, which adds retry behavior
   * on top of this single attempt.
   *
   * @param {boolean} bustCache - When true, bypasses the HTTP cache via
   *   a cache-busting query parameter and `cache: 'no-store'`.
   * @returns {Promise<VisitorStats>}
   */
  async function requestStatsJsonOnce(bustCache) {
    const dataUrl = config.DATA_URL || './stats.json';
    const requestUrl = bustCache
      ? `${dataUrl}${dataUrl.includes('?') ? '&' : '?'}_=${Date.now()}`
      : dataUrl;

    const supportsAbort = typeof AbortController === 'function';
    const controller = supportsAbort ? new AbortController() : null;
    const timeoutMs = config.API_TIMEOUT || 8000;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

    try {
      const response = await fetch(requestUrl, {
        method: 'GET',
        // Forced refreshes must not be served from the HTTP cache; routine
        // background polls are free to reuse a valid cached response —
        // this is the "use browser cache" behavior requested for polling.
        cache: bustCache ? 'no-store' : 'default',
        headers: { Accept: 'application/json' },
        signal: controller ? controller.signal : undefined,
      });

      if (!response.ok) {
        throw new Error(`stats.json request failed with HTTP status ${response.status}`);
      }

      // Guard against HTML error/proxy pages being silently parsed as
      // JSON — a 404 or 500 served through GitHub Pages, a captive
      // portal, or a misconfigured proxy typically responds with a 200
      // HTML document rather than a JSON body in some hosting setups,
      // so status alone isn't a sufficient check. Some CDNs, static
      // hosts, or edge platforms occasionally omit the Content-Type
      // header entirely even for genuinely valid JSON responses, so a
      // missing header is treated as "unknown" and allowed through —
      // only a header that is PRESENT but explicitly non-JSON is
      // rejected here. If the body still isn't valid JSON,
      // `response.json()` below will throw and the existing
      // catch/fallback in `fetchVisitorStats()` handles it exactly as
      // it already does.
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.toLowerCase().includes('application/json')) {
        throw new Error(`stats.json response was not JSON (content-type: "${contentType}")`);
      }

      const payload = await response.json();
      const flatPayload = unwrapStatsPayload(payload);
      return normalizeStats(flatPayload);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /** Fixed delay (ms) between retry attempts in `requestStatsJson`. */
  const RETRY_DELAY_MS = 400;

  /**
   * Performs the `stats.json` request, retrying on failure up to
   * `config.API_RETRY_COUNT` additional times (so `API_RETRY_COUNT: 2`
   * means up to 3 total attempts), with a short fixed delay between
   * attempts. Every retry attempt bypasses the HTTP cache — as if
   * `force` were true — regardless of the original `force` value,
   * since retrying against the exact same (possibly cached-and-broken)
   * response would be pointless. If every attempt fails, the LAST
   * error is thrown, which the caller (`fetchVisitorStats`) already
   * handles by falling back to the last-known-good cache or
   * `DEFAULT_DATA` — retrying here only reduces how often that
   * fallback path is needed for a transient failure, it doesn't change
   * what happens if the backend is genuinely unreachable.
   *
   * @param {boolean} force - When true, bypasses the HTTP cache on the
   *   very first attempt too (see `requestStatsJsonOnce`).
   * @returns {Promise<VisitorStats>}
   */
  async function requestStatsJson(force) {
    const maxAttempts = 1 + Math.max(0, Number(config.API_RETRY_COUNT) || 0);
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return await requestStatsJsonOnce(force || attempt > 1);
      } catch (error) {
        lastError = error;
        log('warn', `stats.json request attempt ${attempt}/${maxAttempts} failed:`, error);

        if (attempt < maxAttempts) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    throw lastError;
  }

  /**
   * Retrieves the current visitor statistics.
   *
   * Behavior:
   *   1. If a fresh cached result exists and `force` is not set, it is
   *      returned immediately with no network activity.
   *   2. If a request is already in flight — regardless of whether it
   *      or the new caller passed `force` — concurrent callers await
   *      the SAME promise instead of triggering duplicate network
   *      requests (important once multiple widget instances share one
   *      page and all poll on the same interval).
   *   3. Otherwise, `stats.json` is fetched via `requestStatsJson`,
   *      which itself retries up to `config.API_RETRY_COUNT` additional
   *      times on failure before giving up (see its own JSDoc). On
   *      success the result is normalized and cached. If every attempt
   *      fails (network error, timeout, non-2xx status, a Content-Type
   *      header that is present but explicitly non-JSON, or a response
   *      body that fails to parse as JSON), the widget falls back to
   *      the last successfully cached snapshot if one exists, or to the
   *      frozen `DEFAULT_DATA` fallback if nothing has ever loaded — the
   *      widget must never
   *      render a broken or empty state.
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

    // Coalesce concurrent callers onto a single in-flight request rather
    // than firing one network call per widget instance on the page.
    //
    // This intentionally applies REGARDLESS of `force`: every real call
    // site in visitor.js (the polling interval, the manual refresh
    // button, and the tab-visibility-resume handler) always passes
    // `force: true`, so a guard that only coalesced non-forced callers
    // never actually engaged in practice — with multiple widget
    // instances on one page (their polling timers all started within
    // milliseconds of each other at mount time), every poll tick would
    // fire one fully redundant network request PER widget, forever, for
    // as long as the page stayed open.
    //
    // A concurrent forced caller piggybacking on an already-in-flight
    // forced request is always safe: it still receives genuinely fresh,
    // cache-busted data, since that in-flight request already bypassed
    // the HTTP cache. The one narrow trade-off is a forced caller that
    // happens to arrive while a DIFFERENT, non-forced request is still
    // in flight (only possible in the brief window right after a page
    // first loads, when a widget's very first render is not yet
    // forced) — it will receive that request's result even though it
    // may have been served from the HTTP cache, rather than always
    // guaranteeing its own bypass. That rare, narrow-window trade-off is
    // preferable to guaranteed, unbounded, repeating duplicate requests.
    if (cache.pendingRequest) {
      log('log', 'Awaiting an already in-flight stats request.');
      return cache.pendingRequest;
    }

    const pending = (async () => {
      try {
        const stats = await requestStatsJson(force);
        cache.data = stats;
        cache.fetchedAt = Date.now();
        log('log', 'Visitor stats refreshed from stats.json:', stats);
        return stats;
      } catch (error) {
        log('warn', 'Falling back to last-known-good visitor stats:', error);

        // Prefer serving the last successfully fetched snapshot over the
        // static fallback, so a transient network blip doesn't visibly
        // regress numbers the visitor has already seen. Only fall all the
        // way back to DEFAULT_DATA if nothing has ever loaded successfully.
        if (!cache.data) {
          cache.data = normalizeStats(config.DEFAULT_DATA);
          cache.fetchedAt = Date.now();
        }

        return cache.data;
      } finally {
        cache.pendingRequest = null;
      }
    })();

    cache.pendingRequest = pending;
    return pending;
  }

  /** Clears the in-memory cache — primarily useful for tests. */
  function resetVisitorStatsCache() {
    cache.data = null;
    cache.fetchedAt = 0;
    cache.pendingRequest = null;
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

/**
 * ==========================================================================
 * Diyar Visitor Widget — Configuration Module
 * ==========================================================================
 * Single source of truth for every tunable value used across the widget.
 * Nothing outside this file should hard-code timing, endpoints, or defaults.
 *
 * @module config
 * @author Diyar Widgets
 * @license MIT
 * ==========================================================================
 */

'use strict';

/**
 * @typedef {Object} VisitorStats
 * @property {number} today       - Visits recorded today.
 * @property {number} yesterday   - Visits recorded yesterday.
 * @property {number} week        - Visits recorded during the current week.
 * @property {number} month       - Visits recorded during the current month.
 * @property {number} total       - All-time visit count.
 * @property {number} online      - Visitors currently online.
 * @property {string} updatedAt   - ISO-8601 timestamp of the last data refresh.
 */

/**
 * Central, frozen configuration object for the Diyar Visitor Widget.
 * Every property is documented and grouped by concern so future
 * contributors can locate a setting in constant time.
 *
 * `Object.freeze()` is applied at every nesting level that contains a
 * plain object (`ANIMATION_SPEED`, `THEME`, `DEFAULT_DATA`), not just
 * to the top-level object — a single top-level freeze alone would only
 * protect the primitive values and object *references* at the top
 * level, silently leaving every nested object fully mutable from
 * anywhere in the codebase.
 */
const DiyarVisitorConfig = Object.freeze({
  /** Semantic version of the widget, surfaced in the footer & console banner. */
  VERSION: '1.1.0',

  /** Human-readable widget name, used for logging and the DOM data attribute. */
  NAME: 'Diyar Visitor Widget',

  /**
   * How long (ms) a fetched/mock payload is considered fresh before the
   * data layer is allowed to request a new one. Prevents redundant work
   * when multiple widget instances share the same page.
   *
   * Consumed directly by `utils.js`'s `fetchVisitorStats()`: a cached
   * result younger than this value is returned with no network activity
   * unless the caller explicitly passes `{ force: true }` (used by the
   * manual refresh button and the tab-visibility-resume handler).
   */
  CACHE_TIME: 60_000,

  /**
   * Interval (ms) at which the widget silently polls for new data once
   * mounted. Sits comfortably above CACHE_TIME so a poll never races
   * a still-fresh cache entry.
   */
  UPDATE_INTERVAL: 90_000,

  /**
   * Master switch for verbose console diagnostics. Ship builds should
   * keep this `false`; toggle it manually while developing locally.
   */
  DEBUG: false,

  /** Timing multiplier applied to every animation in `animations.js`. */
  ANIMATION_SPEED: Object.freeze({
    /** Duration (ms) of the number counter roll-up animation. */
    COUNTER_DURATION: 1400,
    /** Duration (ms) of card entrance fade/slide/scale transitions. */
    ENTRANCE_DURATION: 480,
    /** Stagger (ms) applied between successive card entrances. */
    ENTRANCE_STAGGER: 70,
    /** Duration (ms) of the theme cross-fade transition. */
    THEME_TRANSITION: 420,
    /** Duration (ms) of the ripple feedback on interactive elements. */
    RIPPLE_DURATION: 620,
    /** Duration (ms) of the loading skeleton shimmer sweep. */
    SKELETON_SHIMMER: 1500,
  }),

  /**
   * Theme configuration. `mode` may be 'light', 'dark', or 'auto'.
   * 'auto' resolves against `prefers-color-scheme` and stays in sync
   * with live OS-level changes for the lifetime of the page.
   */
  THEME: Object.freeze({
    mode: 'auto',
    storageKey: 'diyar-visitor-theme',
    attribute: 'data-diyar-theme',
  }),

  /**
   * Location of the static visitor-statistics data file, fetched by
   * `utils.js`'s `fetchVisitorStats()`. This is the ONLY place that
   * hardcodes where `stats.json` lives — nothing else in the project
   * should ever hardcode this path or URL.
   *
   * Defaults to a path relative to the widget's own files, which works
   * correctly both for the bundled `index.html` demo and for the
   * `embed.js` loader on third-party pages (e.g. Blogfa), since the
   * widget's own script tags are always loaded from the same directory
   * as `stats.json` on GitHub Pages.
   *
   * To point at a different file, a subdirectory, or (later) a live
   * backend endpoint that returns the same JSON shape, change only this
   * value — `utils.js`, `visitor.js`, and every other module are
   * completely unaware of where this URL points.
   */
  DATA_URL: './stats.json',

  /**
   * Endpoint the data layer will call once a real backend is available.
   * Left intentionally generic — swapping MOCK data for a live API is a
   * one-line change inside `utils.js` (`fetchVisitorStats`) and touches
   * nothing in the rendering or animation layers.
   */
  API_ENDPOINT: 'https://api.diyar-widgets.example.com/v1/visitor-stats',

  /**
   * Number of ADDITIONAL retry attempts `utils.js`'s `requestStatsJson`
   * makes after an initial `stats.json` (or future live-endpoint)
   * request fails, before giving up and letting `fetchVisitorStats`
   * fall back to the last-known-good cache or `DEFAULT_DATA`. A value
   * of `2` means up to 3 total attempts. Every retry attempt bypasses
   * the HTTP cache, regardless of whether the original call was
   * `force`d, since retrying against the same cached failure would be
   * pointless.
   */
  API_RETRY_COUNT: 2,

  /**
   * Timeout (ms) for a `stats.json`/live-API fetch before the request is
   * aborted and the data layer falls back to the last-known-good cached
   * snapshot, or to `DEFAULT_DATA` if nothing has ever loaded
   * successfully. Enforced in `utils.js` via `AbortController`.
   */
  API_TIMEOUT: 8000,

  /**
   * Deterministic fallback dataset. Used whenever a live fetch is not
   * configured, fails, or is intentionally disabled — guaranteeing the
   * widget always renders something meaningful.
   *
   * `updatedAt` is deliberately OMITTED here (unlike a real API payload,
   * which always supplies one). `normalizeStats()`'s fallback for this
   * field is `partial?.updatedAt || new Date().toISOString()` — if this
   * object supplied a hardcoded ISO string, it would be evaluated once,
   * at module load time, and then reported as the "last updated" time
   * on every single fallback render for the rest of the page's
   * lifetime, however many hours that page stays open. Omitting the
   * field lets `normalizeStats()` compute a genuinely fresh timestamp
   * at the actual moment the fallback is used.
   *
   * @type {Omit<VisitorStats, 'updatedAt'>}
   */
  DEFAULT_DATA: Object.freeze({
    today: 128,
    yesterday: 241,
    week: 1385,
    month: 5623,
    total: 184352,
    online: 7,
  }),

  /** Locale used for digit conversion and date/time formatting. */
  LOCALE: 'fa-IR',

  /** IANA timezone used when formatting the "last updated" footer stamp. */
  TIMEZONE: 'Asia/Tehran',

  /** DOM selector the widget mounts itself into. */
  MOUNT_SELECTOR: '#diyar-visitor-widget',
});

// Expose the configuration on the global scope so every sibling script
// (loaded as plain <script> tags, no bundler required) can read it.
if (typeof window !== 'undefined') {
  window.DiyarVisitorConfig = DiyarVisitorConfig;
}

// Support CommonJS / bundler consumption without affecting the plain
// <script> loading path used by index.html.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DiyarVisitorConfig;
}

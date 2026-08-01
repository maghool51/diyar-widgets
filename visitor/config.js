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
 */
const DiyarVisitorConfig = Object.freeze({
  /** Semantic version of the widget, surfaced in the footer & console banner. */
  VERSION: '1.0.0',

  /** Human-readable widget name, used for logging and the DOM data attribute. */
  NAME: 'Diyar Visitor Widget',

  /**
   * How long (ms) a fetched/mock payload is considered fresh before the
   * data layer is allowed to request a new one. Prevents redundant work
   * when multiple widget instances share the same page.
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
  ANIMATION_SPEED: {
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
  },

  /**
   * Theme configuration. `mode` may be 'light', 'dark', or 'auto'.
   * 'auto' resolves against `prefers-color-scheme` and stays in sync
   * with live OS-level changes for the lifetime of the page.
   */
  THEME: {
    mode: 'auto',
    storageKey: 'diyar-visitor-theme',
    attribute: 'data-diyar-theme',
  },

  /**
   * Endpoint the data layer will call once a real backend is available.
   * Left intentionally generic — swapping MOCK data for a live API is a
   * one-line change inside `utils.js` (`fetchVisitorStats`) and touches
   * nothing in the rendering or animation layers.
   */
  API_ENDPOINT: 'https://api.diyar-widgets.example.com/v1/visitor-stats',

  /** Number of retry attempts the future fetch layer should allow. */
  API_RETRY_COUNT: 2,

  /** Timeout (ms) for a future live fetch before falling back to cache. */
  API_TIMEOUT: 8000,

  /**
   * Deterministic fallback dataset. Used whenever a live fetch is not
   * configured, fails, or is intentionally disabled — guaranteeing the
   * widget always renders something meaningful.
   * @type {VisitorStats}
   */
  DEFAULT_DATA: Object.freeze({
    today: 128,
    yesterday: 241,
    week: 1385,
    month: 5623,
    total: 184352,
    online: 7,
    updatedAt: new Date().toISOString(),
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

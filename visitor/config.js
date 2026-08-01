/**
 * ============================================================================
 * Diyar Widgets — Visitor Statistics Widget
 * config.js
 * ----------------------------------------------------------------------------
 * Central configuration for the "visitor" widget.
 *
 * This file has ZERO dependencies and must be loaded BEFORE visitor.js.
 * It exposes a single frozen object on `window` so the rest of the app
 * can read settings without touching the global scope directly.
 *
 * When a real backend is ready, you only need to:
 *   1. Update `API.ENDPOINT` below.
 *   2. Set `API.USE_MOCK` to false.
 * No other file needs to change (see DataProvider.fetchVisitorStats
 * inside visitor.js).
 * ============================================================================
 */

"use strict";

(function initVisitorWidgetConfig(root) {
  /**
   * @typedef {Object} VisitorMockData
   * @property {number} today
   * @property {number} yesterday
   * @property {number} week
   * @property {number} month
   * @property {number} total
   * @property {number} online
   */

  /** @type {VisitorMockData} */
  const DEFAULT_DATA = Object.freeze({
    today: 128,
    yesterday: 241,
    week: 1385,
    month: 5623,
    total: 184352,
    online: 7
  });

  const CONFIG = Object.freeze({
    /** Semantic version of the widget — bump on every release. */
    VERSION: "1.0.0",

    /** How long (ms) mock/API responses may be cached before refetching. */
    CACHE_TIME: 60 * 1000, // 1 minute

    /** How often (ms) the widget silently refreshes its data in the background. */
    UPDATE_INTERVAL: 30 * 1000, // 30 seconds

    /**
     * Theme mode: "auto" | "light" | "dark".
     * "auto" follows the browser / OS `prefers-color-scheme`.
     * The user can still override this at runtime via the theme toggle
     * button; the override is kept in memory only (no persistence by design,
     * keeping the widget stateless and embed-friendly).
     */
    THEME: "auto",

    /** Base duration (ms) used by counter animations and transitions. */
    ANIMATION_SPEED: 1200,

    /** When true, the widget logs lifecycle events to the console. */
    DEBUG: false,

    /**
     * API integration settings.
     * ------------------------------------------------------------------
     * USE_MOCK   — when true, DataProvider returns DEFAULT_DATA instead
     *              of performing a network request.
     * ENDPOINT   — the real REST endpoint to call once USE_MOCK is false.
     * TIMEOUT_MS — abort the request if it takes longer than this.
     */
    API: Object.freeze({
      USE_MOCK: true,
      ENDPOINT: "/api/visitor-stats",
      TIMEOUT_MS: 8000
    }),

    /** Fallback statistics used for the very first render and for mock mode. */
    DEFAULT_DATA: DEFAULT_DATA
  });

  // Expose a single, frozen, namespaced global — never pollute `window`
  // with loose variables.
  root.VisitorWidgetConfig = CONFIG;
})(window);

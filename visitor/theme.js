/**
 * ==========================================================================
 * Diyar Visitor Widget — Theme Engine
 * ==========================================================================
 * Handles Light / Dark / Auto theme resolution, persistence, live OS
 * preference syncing, and the animated cross-fade transition between
 * themes. Fully decoupled from rendering — it only ever toggles a single
 * data attribute on the widget root, letting `visitor.css` own every
 * visual consequence of a theme change.
 *
 * @module theme
 * @license MIT
 * ==========================================================================
 */

'use strict';

(function (global) {
  const config = global.DiyarVisitorConfig || {};
  const utils = global.DiyarVisitorUtils || {};
  const log = utils.log || function noop() {};

  const THEME_ATTR = config.THEME?.attribute || 'data-diyar-theme';
  const STORAGE_KEY = config.THEME?.storageKey || 'diyar-visitor-theme';
  const VALID_MODES = ['light', 'dark', 'auto'];

  /**
   * Reads the user's persisted theme preference, falling back to the
   * config default when nothing has been stored yet (or storage is
   * unavailable, e.g. in a locked-down iframe embed).
   * @returns {'light'|'dark'|'auto'}
   */
  function readStoredPreference() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return VALID_MODES.includes(stored) ? stored : (config.THEME?.mode || 'auto');
    } catch (error) {
      log('warn', 'localStorage unavailable, defaulting theme mode:', error);
      return config.THEME?.mode || 'auto';
    }
  }

  /**
   * Persists the user's explicit theme choice so it survives reloads.
   * @param {'light'|'dark'|'auto'} mode
   */
  function persistPreference(mode) {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch (error) {
      log('warn', 'Unable to persist theme preference:', error);
    }
  }

  /**
   * Resolves an 'auto' mode against the live OS color-scheme signal.
   * @returns {'light'|'dark'}
   */
  function resolveSystemScheme() {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  /**
   * Creates a self-contained theme controller bound to a given root
   * element. Multiple widget instances on the same page each get their
   * own controller so they never fight over global state.
   *
   * @param {HTMLElement} rootEl - The widget's outermost DOM node.
   * @returns {{
   *   getMode: () => string,
   *   getResolvedTheme: () => 'light'|'dark',
   *   setMode: (mode: string) => void,
   *   cycle: () => void,
   *   destroy: () => void,
   * }}
   */
  function createThemeController(rootEl) {
    let mode = readStoredPreference();
    const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    /**
     * Applies the resolved theme to the DOM with a short cross-fade so
     * the color swap never feels like a jarring flash.
     */
    function applyTheme({ animate = true } = {}) {
      const resolved = mode === 'auto' ? resolveSystemScheme() : mode;
      const duration = config.ANIMATION_SPEED?.THEME_TRANSITION || 420;

      if (animate && rootEl) {
        rootEl.style.setProperty('--diyar-theme-transition-duration', `${duration}ms`);
        rootEl.classList.add('diyar-theme-transitioning');
        window.setTimeout(() => rootEl.classList.remove('diyar-theme-transitioning'), duration);
      }

      if (rootEl) {
        rootEl.setAttribute(THEME_ATTR, resolved);
        rootEl.setAttribute('data-diyar-theme-mode', mode);
      }

      rootEl?.dispatchEvent(
        new CustomEvent('diyar:theme-change', {
          bubbles: true,
          detail: { mode, resolved },
        })
      );

      log('log', `Theme applied → mode: ${mode}, resolved: ${resolved}`);
    }

    /**
     * Explicitly sets the theme mode ('light' | 'dark' | 'auto') and
     * persists the choice for future visits.
     * @param {'light'|'dark'|'auto'} nextMode
     */
    function setMode(nextMode) {
      if (!VALID_MODES.includes(nextMode)) {
        log('warn', `Ignoring invalid theme mode: ${nextMode}`);
        return;
      }
      mode = nextMode;
      persistPreference(mode);
      applyTheme({ animate: true });
    }

    /** Cycles Light → Dark → Auto → Light, used by the header toggle. */
    function cycle() {
      const order = ['light', 'dark', 'auto'];
      const nextIndex = (order.indexOf(mode) + 1) % order.length;
      setMode(order[nextIndex]);
    }

    /** Handler for live OS-level theme changes while mode is 'auto'. */
    function handleSystemChange() {
      if (mode === 'auto') applyTheme({ animate: true });
    }

    mediaQuery?.addEventListener?.('change', handleSystemChange);

    // Initial paint happens without animation to avoid a flash on load.
    applyTheme({ animate: false });

    return {
      getMode: () => mode,
      getResolvedTheme: () => (mode === 'auto' ? resolveSystemScheme() : mode),
      setMode,
      cycle,
      destroy() {
        mediaQuery?.removeEventListener?.('change', handleSystemChange);
      },
    };
  }

  const DiyarVisitorTheme = Object.freeze({
    createThemeController,
    resolveSystemScheme,
  });

  global.DiyarVisitorTheme = DiyarVisitorTheme;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiyarVisitorTheme;
  }
})(typeof window !== 'undefined' ? window : globalThis);

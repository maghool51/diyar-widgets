/**
 * ==========================================================================
 * Diyar Visitor Widget — Animation Engine
 * ==========================================================================
 * A small, dependency-free animation toolkit: counter roll-ups, staggered
 * entrances (fade / slide / scale), ripple feedback, and skeleton
 * shimmer control. Every animation respects `prefers-reduced-motion` by
 * resolving instantly instead of skipping visual state changes.
 *
 * @module animations
 * @license MIT
 * ==========================================================================
 */

'use strict';

(function (global) {
  const config = global.DiyarVisitorConfig || {};
  const utils = global.DiyarVisitorUtils || {};
  const { easeOutCubic, raf, toPersianDigits, clamp, log } = utils;

  /** @returns {boolean} True if the user's OS requests reduced motion. */
  function prefersReducedMotion() {
    return Boolean(
      global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /**
   * Animates a numeric counter from `from` to `to`, rendering Persian
   * digits on every frame via the provided element. Uses a single RAF
   * loop with an ease-out-cubic curve for a natural deceleration.
   *
   * @param {HTMLElement} el - Target element whose textContent is updated.
   * @param {number} from - Starting value.
   * @param {number} to - Target value.
   * @param {{ duration?: number, onComplete?: () => void }} [options]
   * @returns {() => void} Cancel function.
   */
  function animateCounter(el, from, to, options = {}) {
    if (!el) return () => {};

    const duration = options.duration ?? config.ANIMATION_SPEED?.COUNTER_DURATION ?? 1400;

    if (prefersReducedMotion()) {
      el.textContent = toPersianDigits(to);
      options.onComplete?.();
      return () => {};
    }

    let cancelled = false;
    let startTime = null;
    let handle = null;

    function step(timestamp) {
      if (cancelled) return;
      if (startTime === null) startTime = timestamp;

      const elapsed = timestamp - startTime;
      const progress = clamp(elapsed / duration, 0, 1);
      const eased = easeOutCubic(progress);
      const currentValue = from + (to - from) * eased;

      el.textContent = toPersianDigits(currentValue);

      if (progress < 1) {
        handle = raf(step);
      } else {
        el.textContent = toPersianDigits(to);
        options.onComplete?.();
      }
    }

    handle = raf(step);

    return function cancel() {
      cancelled = true;
      if (handle && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(handle);
      }
    };
  }

  /**
   * Reveals a NodeList/array of elements with a staggered fade + slide +
   * scale entrance. Adds a `.diyar-in-view` class per element on a
   * timed offset, letting CSS own the actual transform/opacity curve.
   *
   * @param {ArrayLike<HTMLElement>} elements
   * @param {{ stagger?: number, baseDelay?: number }} [options]
   */
  function staggerEntrance(elements, options = {}) {
    const stagger = options.stagger ?? config.ANIMATION_SPEED?.ENTRANCE_STAGGER ?? 70;
    const baseDelay = options.baseDelay ?? 0;
    const list = Array.prototype.slice.call(elements);

    if (prefersReducedMotion()) {
      list.forEach((el) => el.classList.add('diyar-in-view'));
      return;
    }

    list.forEach((el, index) => {
      const delay = baseDelay + index * stagger;
      el.style.transitionDelay = `${delay}ms`;
      // Force a reflow-safe next frame so the initial (hidden) state is
      // committed before the class flip triggers the CSS transition.
      raf(() => raf(() => el.classList.add('diyar-in-view')));
    });
  }

  /**
   * Attaches a Material Design ripple effect to a clickable element.
   * The ripple element is created on demand and removed after its
   * transition completes to keep the DOM clean.
   *
   * @param {HTMLElement} el - Element to receive the ripple (needs
   *   `position: relative` and `overflow: hidden`, provided by CSS).
   */
  function attachRipple(el) {
    if (!el || el.__diyarRippleAttached) return;
    el.__diyarRippleAttached = true;

    el.addEventListener('pointerdown', (event) => {
      if (prefersReducedMotion()) return;

      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = (event.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2;
      const y = (event.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2;

      const ripple = document.createElement('span');
      ripple.className = 'diyar-ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      ripple.style.animationDuration = `${config.ANIMATION_SPEED?.RIPPLE_DURATION ?? 620}ms`;

      el.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    });
  }

  /**
   * Toggles the loading-skeleton state on a card element. When `loading`
   * is true, real content is hidden and shimmer placeholders are shown
   * (and vice versa) — purely a class toggle so CSS owns the shimmer
   * keyframes and timing.
   *
   * @param {HTMLElement} cardEl
   * @param {boolean} loading
   */
  function setSkeletonState(cardEl, loading) {
    if (!cardEl) return;
    cardEl.classList.toggle('is-loading', loading);
    cardEl.setAttribute('aria-busy', String(loading));
  }

  const DiyarVisitorAnimations = Object.freeze({
    prefersReducedMotion,
    animateCounter,
    staggerEntrance,
    attachRipple,
    setSkeletonState,
  });

  global.DiyarVisitorAnimations = DiyarVisitorAnimations;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiyarVisitorAnimations;
  }
})(typeof window !== 'undefined' ? window : globalThis);

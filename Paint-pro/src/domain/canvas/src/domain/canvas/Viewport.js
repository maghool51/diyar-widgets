// ============================================
// Paint Pro - Professional Web Graphics Application
// src/domain/canvas/Viewport.js
// Viewport Manager with Physics & Constraints
// ============================================

import { CoordinateSystem, Point, Rect } from './CoordinateSystem.js';

/**
 * @class Viewport
 * @description Manages the viewport state including zoom, pan, rotation,
 * and scroll physics. Provides smooth zooming with focal point preservation,
 * momentum-based panning, zoom-to-fit, and viewport constraints.
 * 
 * Key Features:
 * - Zoom with focal point preservation (zoom toward cursor)
 * - Momentum-based panning (inertial scrolling)
 * - Zoom constraints (min/max)
 * - Pan constraints (keep canvas visible)
 * - Animated transitions (zoom to fit, reset view)
 * - Viewport state queries (visible area, is fully visible)
 * 
 * The Viewport updates the CoordinateSystem which handles
 * the actual mathematical transformations.
 * 
 * @example
 * const viewport = new Viewport(coordinateSystem);
 * 
 * // Zoom toward a point
 * viewport.zoomAt(2.0, 500, 400);
 * 
 * // Pan with momentum
 * viewport.startPan();
 * viewport.updatePan(10, 5);  // Called each frame during drag
 * viewport.endPan();          // Starts momentum animation
 * 
 * // Fit canvas to screen
 * viewport.fitToScreen();
 */
export class Viewport {
    /**
     * @param {CoordinateSystem} coordinateSystem - Coordinate system to manage
     * @param {Object} [options={}] - Viewport configuration
     * @param {number} [options.minZoom=0.1] - Minimum zoom level
     * @param {number} [options.maxZoom=32] - Maximum zoom level
     * @param {number} [options.zoomStep=0.1] - Zoom increment per step
     * @param {number} [options.zoomSensitivity=0.001] - Mouse wheel sensitivity
     * @param {number} [options.panMomentum=0.9] - Pan momentum decay (0-1)
     * @param {number} [options.panFriction=0.95] - Pan friction per frame
     * @param {number} [options.minPanVelocity=0.5] - Minimum velocity to stop momentum
     * @param {number} [options.animationDuration=300] - Animation duration in ms
     * @param {number} [options.paddingPercent=0.1] - Padding for fit-to-screen
     */
    constructor(coordinateSystem, options = {}) {
        if (!coordinateSystem || !(coordinateSystem instanceof CoordinateSystem)) {
            throw new Error('Viewport requires a CoordinateSystem instance');
        }

        /**
         * The coordinate system being managed.
         * @private
         * @type {CoordinateSystem}
         */
        this._coords = coordinateSystem;

        /**
         * Configuration options.
         * @private
         * @type {Object}
         */
        this._options = Object.freeze({
            minZoom: Math.max(0.01, options.minZoom || 0.1),
            maxZoom: Math.min(64, options.maxZoom || 32),
            zoomStep: options.zoomStep || 0.1,
            zoomSensitivity: options.zoomSensitivity || 0.001,
            panMomentum: Math.max(0, Math.min(1, options.panMomentum ?? 0.9)),
            panFriction: Math.max(0.5, Math.min(1, options.panFriction ?? 0.95)),
            minPanVelocity: options.minPanVelocity || 0.5,
            animationDuration: options.animationDuration || 300,
            paddingPercent: Math.max(0, Math.min(0.5, options.paddingPercent ?? 0.1)),
        });

        /**
         * Current pan velocity for momentum scrolling.
         * @private
         * @type {{vx: number, vy: number}}
         */
        this._velocity = { vx: 0, vy: 0 };

        /**
         * Whether momentum animation is active.
         * @private
         * @type {boolean}
         */
        this._momentumActive = false;

        /**
         * Last pan position for velocity calculation.
         * @private
         * @type {{x: number, y: number, time: number}}
         */
        this._lastPan = { x: 0, y: 0, time: 0 };

        /**
         * Animation frame ID for momentum.
         * @private
         * @type {number|null}
         */
        this._animationFrameId = null;

        /**
         * Active animation state.
         * @private
         * @type {Object|null}
         */
        this._animation = null;

        /**
         * Change listeners.
         * @private
         * @type {Set<Function>}
         */
        this._listeners = new Set();

        /**
         * Whether the viewport has been disposed.
         * @private
         * @type {boolean}
         */
        this._disposed = false;
    }

    // ============================================
    // Getters
    // ============================================

    /** @returns {number} */
    get zoom() { return this._coords.zoom; }

    /** @returns {number} */
    get panX() { return this._coords.panX; }

    /** @returns {number} */
    get panY() { return this._coords.panY; }

    /** @returns {number} */
    get minZoom() { return this._options.minZoom; }

    /** @returns {number} */
    get maxZoom() { return this._options.maxZoom; }

    /** @returns {boolean} */
    get isAnimating() {
        return this._momentumActive || this._animation !== null;
    }

    // ============================================
    // Public API - Zoom
    // ============================================

    /**
     * Set the zoom level directly.
     * The zoom is anchored at the center of the viewport.
     * 
     * @param {number} zoom - New zoom level
     * @param {Object} [options={}] - Zoom options
     * @param {boolean} [options.animate=false] - Animate the zoom transition
     */
    setZoom(zoom, options = {}) {
        const clampedZoom = this._clampZoom(zoom);

        if (clampedZoom === this._coords.zoom) return;

        if (options.animate) {
            this._animateZoom(this._coords.zoom, clampedZoom);
        } else {
            this._coords.setZoom(clampedZoom);
            this._applyPanConstraints();
            this._notifyListeners('zoomChanged');
        }
    }

    /**
     * Zoom toward a specific point (preserves the point under the cursor).
     * 
     * @param {number} targetZoom - Target zoom level
     * @param {number} focalScreenX - Focal point X in screen coordinates
     * @param {number} focalScreenY - Focal point Y in screen coordinates
     * 
     * @example
     * // Zoom in toward the mouse cursor
     * viewport.zoomAt(viewport.zoom * 1.5, mouseEvent.clientX, mouseEvent.clientY);
     */
    zoomAt(targetZoom, focalScreenX, focalScreenY) {
        const oldZoom = this._coords.zoom;
        const newZoom = this._clampZoom(targetZoom);

        if (newZoom === oldZoom) return;

        // Get the canvas point under the focal point before zoom
        const canvasPoint = this._coords.screenToCanvas(focalScreenX, focalScreenY);

        // Apply the new zoom
        this._coords.setZoom(newZoom);

        // Calculate new pan to keep the canvas point under the same screen position
        const newScreenPoint = this._coords.canvasToScreen(canvasPoint.x, canvasPoint.y);

        const panDx = focalScreenX - newScreenPoint.x;
        const panDy = focalScreenY - newScreenPoint.y;

        this._coords.setPan(
            this._coords.panX + panDx,
            this._coords.panY + panDy
        );

        this._applyPanConstraints();
        this._notifyListeners('zoomChanged');
    }

    /**
     * Zoom in one step.
     * @param {Object} [options={}] - Options
     * @param {number} [options.cx] - Center X in screen coordinates
     * @param {number} [options.cy] - Center Y in screen coordinates
     */
    zoomIn(options = {}) {
        const newZoom = this._coords.zoom * (1 + this._options.zoomStep);

        if (options.cx !== undefined && options.cy !== undefined) {
            this.zoomAt(newZoom, options.cx, options.cy);
        } else {
            this.setZoom(newZoom);
        }
    }

    /**
     * Zoom out one step.
     * @param {Object} [options={}] - Options
     * @param {number} [options.cx] - Center X in screen coordinates
     * @param {number} [options.cy] - Center Y in screen coordinates
     */
    zoomOut(options = {}) {
        const newZoom = this._coords.zoom * (1 - this._options.zoomStep);

        if (options.cx !== undefined && options.cy !== undefined) {
            this.zoomAt(newZoom, options.cx, options.cy);
        } else {
            this.setZoom(newZoom);
        }
    }

    /**
     * Handle mouse wheel zoom.
     * 
     * @param {WheelEvent} event - Wheel event
     * @returns {boolean} True if zoom was applied
     */
    handleWheelZoom(event) {
        // Only handle Ctrl+Wheel or pinch events
        if (!event.ctrlKey && !event.metaKey) return false;

        const delta = -event.deltaY * this._options.zoomSensitivity;
        const currentZoom = this._coords.zoom;
        const newZoom = currentZoom * (1 + delta);

        this.zoomAt(newZoom, event.clientX, event.clientY);

        return true;
    }

    /**
     * Reset zoom to 100%.
     */
    resetZoom() {
        this.setZoom(1);
    }

    // ============================================
    // Public API - Pan
    // ============================================

    /**
     * Set the pan position directly.
     * @param {number} panX - Horizontal pan
     * @param {number} panY - Vertical pan
     */
    setPan(panX, panY) {
        this._coords.setPan(panX, panY);
        this._applyPanConstraints();
        this._notifyListeners('panChanged');
    }

    /**
     * Start a pan operation (called on pointer down).
     * Stops any active momentum animation.
     */
    startPan() {
        this._stopMomentum();
        this._stopAnimation();
        this._lastPan = {
            x: 0,
            y: 0,
            time: performance.now(),
        };
    }

    /**
     * Update pan during drag (called each frame during pointer move).
     * @param {number} dx - Delta X in screen pixels
     * @param {number} dy - Delta Y in screen pixels
     */
    updatePan(dx, dy) {
        const now = performance.now();
        const dt = Math.max(1, now - this._lastPan.time);

        // Update position
        this._coords.setPan(
            this._coords.panX + dx,
            this._coords.panY + dy
        );

        // Calculate velocity for momentum
        this._velocity.vx = dx / dt * 16; // Normalize to ~60fps
        this._velocity.vy = dy / dt * 16;

        this._lastPan = { x: dx, y: dy, time: now };

        this._applyPanConstraints();
        this._notifyListeners('panChanged');
    }

    /**
     * End a pan operation (called on pointer up).
     * Starts momentum animation if velocity is high enough.
     */
    endPan() {
        const speed = Math.sqrt(
            this._velocity.vx * this._velocity.vx +
            this._velocity.vy * this._velocity.vy
        );

        if (speed > this._options.minPanVelocity) {
            this._startMomentum();
        } else {
            this._velocity = { vx: 0, vy: 0 };
            this._applyPanConstraints();
            this._notifyListeners('panChanged');
        }
    }

    /**
     * Cancel any active pan or momentum.
     */
    cancelPan() {
        this._stopMomentum();
        this._velocity = { vx: 0, vy: 0 };
    }

    // ============================================
    // Public API - Viewport Operations
    // ============================================

    /**
     * Fit the entire canvas within the viewport.
     * @param {boolean} [animate=false] - Animate the transition
     */
    fitToScreen(animate = false) {
        const fitZoom = this._coords.calculateFitZoom(1 - this._options.paddingPercent);

        if (animate) {
            this._animateViewport(fitZoom, 0, 0);
        } else {
            this._coords.setViewport(fitZoom, 0, 0);
            this._notifyListeners('viewportChanged');
        }
    }

    /**
     * Center the canvas in the viewport.
     * @param {boolean} [animate=false] - Animate the transition
     */
    centerCanvas(animate = false) {
        if (animate) {
            this._animateViewport(this._coords.zoom, 0, 0);
        } else {
            this._coords.centerCanvas();
            this._notifyListeners('viewportChanged');
        }
    }

    /**
     * Reset the viewport to default (zoom 100%, centered).
     * @param {boolean} [animate=false] - Animate the transition
     */
    resetViewport(animate = false) {
        if (animate) {
            this._animateViewport(1, 0, 0);
        } else {
            this._coords.setViewport(1, 0, 0);
            this._notifyListeners('viewportChanged');
        }
    }

    /**
     * Scroll the viewport in a direction.
     * @param {'up'|'down'|'left'|'right'} direction - Scroll direction
     * @param {number} [amount=50] - Scroll amount in screen pixels
     */
    scroll(direction, amount = 50) {
        let dx = 0;
        let dy = 0;

        switch (direction) {
            case 'up': dy = amount; break;
            case 'down': dy = -amount; break;
            case 'left': dx = amount; break;
            case 'right': dx = -amount; break;
        }

        this._coords.setPan(this._coords.panX + dx, this._coords.panY + dy);
        this._applyPanConstraints();
        this._notifyListeners('panChanged');
    }

    // ============================================
    // Public API - Queries
    // ============================================

    /**
     * Get the visible area of the canvas.
     * @returns {Rect}
     */
    getVisibleArea() {
        return this._coords.getVisibleCanvasArea();
    }

    /**
     * Check if a canvas point is currently visible.
     * @param {number} canvasX - X in canvas coordinates
     * @param {number} canvasY - Y in canvas coordinates
     * @returns {boolean}
     */
    isPointVisible(canvasX, canvasY) {
        return this._coords.isCanvasPointVisible(canvasX, canvasY);
    }

    /**
     * Check if a canvas rectangle is fully visible.
     * @param {Rect} rect - Rectangle in canvas coordinates
     * @returns {boolean}
     */
    isRectFullyVisible(rect) {
        const visibleArea = this.getVisibleArea();
        return visibleArea.containsRect(rect);
    }

    /**
     * Get the current viewport state as a plain object.
     * @returns {{zoom: number, panX: number, panY: number}}
     */
    getState() {
        return {
            zoom: this._coords.zoom,
            panX: this._coords.panX,
            panY: this._coords.panY,
        };
    }

    // ============================================
    // Public API - Listeners
    // ============================================

    /**
     * Register a change listener.
     * @param {Function} listener - Callback(eventType, viewport)
     * @returns {Function} Unsubscribe function
     */
    onChange(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    // ============================================
    // Public API - Configuration
    // ============================================

    /**
     * Update the canvas dimensions (called when canvas is resized).
     * @param {number} width - New canvas width
     * @param {number} height - New canvas height
     */
    updateCanvasSize(width, height) {
        this._coords.setCanvasSize(width, height);
        this._applyPanConstraints();
    }

    /**
     * Update the container dimensions (called when window is resized).
     * @param {Object} rect - Container bounding rect
     * @param {number} rect.left
     * @param {number} rect.top
     * @param {number} rect.width
     * @param {number} rect.height
     */
    updateContainerRect(rect) {
        this._coords.setContainerRect(rect);
        this._applyPanConstraints();
    }

    /**
     * Set the zoom range.
     * @param {number} min - Minimum zoom
     * @param {number} max - Maximum zoom
     */
    setZoomRange(min, max) {
        this._options = Object.freeze({
            ...this._options,
            minZoom: Math.max(0.01, min),
            maxZoom: Math.min(64, max),
        });

        // Re-clamp current zoom
        const clampedZoom = this._clampZoom(this._coords.zoom);
        if (clampedZoom !== this._coords.zoom) {
            this._coords.setZoom(clampedZoom);
            this._notifyListeners('zoomChanged');
        }
    }

    // ============================================
    // Public API - Disposal
    // ============================================

    /**
     * Dispose the viewport and stop all animations.
     */
    dispose() {
        if (this._disposed) return;

        this._stopMomentum();
        this._stopAnimation();
        this._listeners.clear();
        this._disposed = true;
    }

    // ============================================
    // Private Methods - Zoom
    // ============================================

    /**
     * Clamp a zoom value to the allowed range.
     * @private
     * @param {number} zoom - Zoom value
     * @returns {number}
     */
    _clampZoom(zoom) {
        return Math.max(this._options.minZoom, Math.min(this._options.maxZoom, zoom));
    }

    // ============================================
    // Private Methods - Pan
    // ============================================

    /**
     * Apply constraints to keep the canvas reasonably visible.
     * Prevents panning too far away from the canvas.
     * @private
     */
    _applyPanConstraints() {
        // Allow some overscroll (2x canvas size in each direction)
        const maxPanX = this._coords._canvasSize.width * this._coords.zoom * 2;
        const maxPanY = this._coords._canvasSize.height * this._coords.zoom * 2;

        const clampedPanX = Math.max(-maxPanX, Math.min(maxPanX, this._coords.panX));
        const clampedPanY = Math.max(-maxPanY, Math.min(maxPanY, this._coords.panY));

        if (clampedPanX !== this._coords.panX || clampedPanY !== this._coords.panY) {
            this._coords.setPan(clampedPanX, clampedPanY);
        }
    }

    // ============================================
    // Private Methods - Momentum
    // ============================================

    /**
     * Start momentum animation after pan ends.
     * @private
     */
    _startMomentum() {
        if (this._momentumActive) return;

        this._momentumActive = true;
        this._animateMomentum();
    }

    /**
     * Stop momentum animation.
     * @private
     */
    _stopMomentum() {
        this._momentumActive = false;
        if (this._animationFrameId !== null) {
            cancelAnimationFrame(this._animationFrameId);
            this._animationFrameId = null;
        }
    }

    /**
     * Single frame of momentum animation.
     * @private
     */
    _animateMomentum() {
        if (!this._momentumActive) return;

        // Apply friction
        this._velocity.vx *= this._options.panFriction;
        this._velocity.vy *= this._options.panFriction;

        // Apply velocity
        this._coords.setPan(
            this._coords.panX + this._velocity.vx,
            this._coords.panY + this._velocity.vy
        );

        this._applyPanConstraints();
        this._notifyListeners('panChanged');

        // Check if momentum should stop
        const speed = Math.sqrt(
            this._velocity.vx * this._velocity.vx +
            this._velocity.vy * this._velocity.vy
        );

        if (speed < this._options.minPanVelocity) {
            this._stopMomentum();
            this._velocity = { vx: 0, vy: 0 };
            return;
        }

        this._animationFrameId = requestAnimationFrame(() => this._animateMomentum());
    }

    // ============================================
    // Private Methods - Animation
    // ============================================

    /**
     * Animate a viewport transition.
     * @private
     * @param {number} targetZoom - Target zoom
     * @param {number} targetPanX - Target pan X
     * @param {number} targetPanY - Target pan Y
     */
    _animateViewport(targetZoom, targetPanX, targetPanY) {
        this._stopAnimation();

        const startZoom = this._coords.zoom;
        const startPanX = this._coords.panX;
        const startPanY = this._coords.panY;
        const startTime = performance.now();
        const duration = this._options.animationDuration;

        this._animation = {
            startZoom,
            startPanX,
            startPanY,
            targetZoom,
            targetPanX,
            targetPanY,
            startTime,
            duration,
        };

        this._animateFrame();
    }

    /**
     * Animate zoom only.
     * @private
     * @param {number} fromZoom - Starting zoom
     * @param {number} toZoom - Target zoom
     */
    _animateZoom(fromZoom, toZoom) {
        this._stopAnimation();

        const startTime = performance.now();
        const duration = this._options.animationDuration;

        this._animation = {
            startZoom: fromZoom,
            startPanX: this._coords.panX,
            startPanY: this._coords.panY,
            targetZoom: toZoom,
            targetPanX: this._coords.panX,
            targetPanY: this._coords.panY,
            startTime,
            duration,
        };

        this._animateFrame();
    }

    /**
     * Stop active animation.
     * @private
     */
    _stopAnimation() {
        this._animation = null;
    }

    /**
     * Single frame of animation.
     * @private
     */
    _animateFrame() {
        if (!this._animation) return;

        const elapsed = performance.now() - this._animation.startTime;
        const progress = Math.min(1, elapsed / this._animation.duration);

        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);

        const currentZoom = this._animation.startZoom +
            (this._animation.targetZoom - this._animation.startZoom) * eased;
        const currentPanX = this._animation.startPanX +
            (this._animation.targetPanX - this._animation.startPanX) * eased;
        const currentPanY = this._animation.startPanY +
            (this._animation.targetPanY - this._animation.startPanY) * eased;

        this._coords.setViewport(currentZoom, currentPanX, currentPanY);
        this._applyPanConstraints();
        this._notifyListeners('viewportChanged');

        if (progress < 1) {
            requestAnimationFrame(() => this._animateFrame());
        } else {
            this._coords.setViewport(
                this._animation.targetZoom,
                this._animation.targetPanX,
                this._animation.targetPanY
            );
            this._animation = null;
            this._notifyListeners('viewportChanged');
        }
    }

    // ============================================
    // Private Methods - Notification
    // ============================================

    /**
     * Notify all listeners of a change.
     * @private
     * @param {string} eventType - Type of change
     */
    _notifyListeners(eventType) {
        const state = this.getState();
        for (const listener of this._listeners) {
            try {
                listener(eventType, state, this);
            } catch (error) {
                console.error('Viewport listener error:', error);
            }
        }
    }
}

// ============================================
// Default Export
// ============================================

export default Viewport;

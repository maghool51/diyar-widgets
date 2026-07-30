// ============================================
// Paint Pro - Professional Web Graphics Application
// src/rendering/RenderScheduler.js
// Centralized Render Scheduler & Coordinator
// ============================================

import { CanvasEvents, PerformanceEvents } from '../../core/event-bus/EventTypes.js';

/**
 * @class RenderScheduler
 * @description Centralized rendering coordinator that batches and schedules
 * all canvas updates. Uses requestAnimationFrame for optimal performance,
 * supports priority-based rendering, dirty region tracking, and prevents
 * redundant renders by merging multiple render requests into single frames.
 * 
 * Key Features:
 * - Single rAF loop for all rendering
 * - Priority-based render queue
 * - Dirty region merging (combine overlapping update areas)
 * - Render phase separation (layers → overlays → UI)
 * - Frame budget enforcement (prevents long frames)
 * - Automatic render on state changes
 * - Manual render forcing for critical updates
 * - Performance monitoring (FPS tracking)
 * 
 * Render Phases (in order):
 * 1. BACKGROUND: Background color/pattern
 * 2. LAYERS: All visible layers composited
 * 3. PREVIEW: Tool previews (brush cursor, shape preview)
 * 4. SELECTION: Selection outlines and handles
 * 5. GRID: Grid lines
 * 6. GUIDES: Guide lines
 * 7. OVERLAY: Other overlays (text editor, measurements)
 * 
 * @example
 * const scheduler = new RenderScheduler(eventBus);
 * 
 * // Request a render (batched automatically)
 * scheduler.requestRender(RenderPhase.LAYERS);
 * 
 * // Force immediate render
 * scheduler.forceRender();
 * 
 * // Subscribe to frame events
 * scheduler.onFrame((stats) => console.log('FPS:', stats.fps));
 */
export class RenderScheduler {
    /**
     * @param {EventBus} eventBus - Event bus for render events
     * @param {Object} [options={}] - Configuration options
     * @param {number} [options.targetFPS=60] - Target frames per second
     * @param {number} [options.frameBudget=14] - Max frame time in ms (~60fps = 16.67ms, leave 2.67ms buffer)
     * @param {boolean} [options.useDirtyRegions=true] - Enable dirty region optimization
     * @param {boolean} [options.debug=false] - Enable debug logging and overlays
     */
    constructor(eventBus, options = {}) {
        if (!eventBus) {
            throw new Error('RenderScheduler requires an EventBus instance');
        }

        /**
         * Event bus for render events.
         * @private
         * @type {EventBus}
         */
        this._eventBus = eventBus;

        /**
         * Configuration options.
         * @private
         * @type {Object}
         */
        this._options = Object.freeze({
            targetFPS: options.targetFPS || 60,
            frameBudget: options.frameBudget || 14,
            useDirtyRegions: options.useDirtyRegions !== false,
            debug: options.debug || false,
        });

        /**
         * Set of phases that need rendering.
         * @private
         * @type {Set<string>}
         */
        this._dirtyPhases = new Set();

        /**
         * Set of dirty regions (Rect objects in canvas space).
         * Empty set means full canvas render.
         * @private
         * @type {Set<Rect>|null}
         */
        this._dirtyRegions = null;

        /**
         * Whether a render frame is already scheduled.
         * @private
         * @type {boolean}
         */
        this._frameScheduled = false;

        /**
         * RAF animation frame ID.
         * @private
         * @type {number|null}
         */
        this._rafId = null;

        /**
         * Registered renderers for each phase.
         * @private
         * @type {Map<string, Function[]>}
         */
        this._renderers = new Map();

        /**
         * Frame statistics.
         * @private
         * @type {Object}
         */
        this._stats = {
            fps: 60,
            frameCount: 0,
            lastFrameTime: performance.now(),
            frameTimes: [],
            averageFrameTime: 0,
            droppedFrames: 0,
            renderedFrames: 0,
        };

        /**
         * FPS calculation interval.
         * @private
         * @type {number}
         */
        this._fpsUpdateInterval = 1000;
        this._lastFpsUpdate = performance.now();
        this._framesSinceLastFpsUpdate = 0;

        /**
         * Whether the scheduler is paused.
         * @private
         * @type {boolean}
         */
        this._paused = false;

        /**
         * Whether the scheduler has been disposed.
         * @private
         * @type {boolean}
         */
        this._disposed = false;

        /**
         * Frame listeners.
         * @private
         * @type {Set<Function>}
         */
        this._frameListeners = new Set();

        /**
         * Bound render loop function for rAF.
         * @private
         * @type {Function}
         */
        this._boundRenderLoop = this._renderLoop.bind(this);

        this._log('debug', 'RenderScheduler initialized');
    }

    // ============================================
    // Render Phase Constants
    // ============================================

    /**
     * @enum {string}
     * @description Ordered render phases.
     */
    static Phase = Object.freeze({
        /** Background color/pattern fill */
        BACKGROUND: 'background',

        /** Layer compositing */
        LAYERS: 'layers',

        /** Tool previews during drawing */
        PREVIEW: 'preview',

        /** Selection outlines, handles, marching ants */
        SELECTION: 'selection',

        /** Grid lines */
        GRID: 'grid',

        /** Guide lines */
        GUIDES: 'guides',

        /** Other overlays */
        OVERLAY: 'overlay',
    });

    /** @returns {string[]} Phases in render order */
    static get PHASE_ORDER() {
        return [
            RenderScheduler.Phase.BACKGROUND,
            RenderScheduler.Phase.LAYERS,
            RenderScheduler.Phase.PREVIEW,
            RenderScheduler.Phase.SELECTION,
            RenderScheduler.Phase.GRID,
            RenderScheduler.Phase.GUIDES,
            RenderScheduler.Phase.OVERLAY,
        ];
    }

    // ============================================
    // Public API - Renderer Registration
    // ============================================

    /**
     * Register a renderer function for a specific phase.
     * Multiple renderers can be registered per phase (called in registration order).
     * 
     * @param {string} phase - Render phase from RenderScheduler.Phase
     * @param {Function} renderer - Render function(ctx, dirtyRegions, stats)
     * @returns {Function} Unregister function
     * 
     * @example
     * scheduler.registerRenderer(RenderScheduler.Phase.LAYERS, (ctx, dirtyRegions) => {
     *     // Composite all visible layers onto ctx
     * });
     */
    registerRenderer(phase, renderer) {
        if (!RenderScheduler.PHASE_ORDER.includes(phase)) {
            throw new Error(`Invalid render phase: ${phase}`);
        }

        if (typeof renderer !== 'function') {
            throw new Error('Renderer must be a function');
        }

        if (!this._renderers.has(phase)) {
            this._renderers.set(phase, []);
        }

        this._renderers.get(phase).push(renderer);

        return () => {
            const renderers = this._renderers.get(phase);
            if (renderers) {
                const index = renderers.indexOf(renderer);
                if (index !== -1) renderers.splice(index, 1);
            }
        };
    }

    /**
     * Set a single renderer for a phase (replaces any existing).
     * @param {string} phase - Render phase
     * @param {Function} renderer - Render function
     * @returns {Function} Unregister function
     */
    setRenderer(phase, renderer) {
        this._renderers.set(phase, [renderer]);
        return () => this._renderers.delete(phase);
    }

    /**
     * Clear all renderers for a phase.
     * @param {string} phase - Render phase
     */
    clearRenderers(phase) {
        this._renderers.delete(phase);
    }

    // ============================================
    // Public API - Render Requests
    // ============================================

    /**
     * Request a render for specific phases.
     * The render is batched and will occur on the next animation frame.
     * Multiple requests within the same frame are merged.
     * 
     * @param {string|string[]} phases - Phase(s) to render
     * @param {Rect|Rect[]} [dirtyRegions] - Specific regions to update (null = full canvas)
     * 
     * @example
     * // Request layer re-render after drawing
     * scheduler.requestRender(RenderScheduler.Phase.LAYERS);
     * 
     * // Request multiple phases
     * scheduler.requestRender([RenderScheduler.Phase.LAYERS, RenderScheduler.Phase.SELECTION]);
     */
    requestRender(phases, dirtyRegions = null) {
        if (this._disposed) return;

        const phaseList = Array.isArray(phases) ? phases : [phases];

        // Mark phases as dirty
        for (const phase of phaseList) {
            this._dirtyPhases.add(phase);
        }

        // Merge dirty regions
        if (dirtyRegions && this._options.useDirtyRegions) {
            if (this._dirtyRegions === null) {
                this._dirtyRegions = new Set();
            }
            const regions = Array.isArray(dirtyRegions) ? dirtyRegions : [dirtyRegions];
            for (const region of regions) {
                this._addDirtyRegion(region);
            }
        } else if (dirtyRegions === null) {
            // Null means full canvas render
            this._dirtyRegions = null;
        }

        // Schedule frame if not already scheduled
        if (!this._frameScheduled && !this._paused) {
            this._scheduleFrame();
        }
    }

    /**
     * Request a full canvas render of all phases.
     */
    requestFullRender() {
        this._dirtyRegions = null; // Full canvas
        this.requestRender(RenderScheduler.PHASE_ORDER);
    }

    /**
     * Force an immediate render (bypasses rAF batching).
     * Use sparingly - only for critical updates like cursor position.
     * 
     * @param {string|string[]} [phases] - Specific phases to force render
     */
    forceRender(phases = null) {
        if (this._disposed) return;

        const phaseList = phases
            ? (Array.isArray(phases) ? phases : [phases])
            : RenderScheduler.PHASE_ORDER;

        // Cancel any scheduled frame
        this._cancelScheduledFrame();

        // Execute render immediately
        this._executeRender(phaseList, this._dirtyRegions);
    }

    /**
     * Cancel any pending render requests.
     */
    cancelPendingRender() {
        this._cancelScheduledFrame();
        this._dirtyPhases.clear();
        this._dirtyRegions = null;
    }

    // ============================================
    // Public API - Lifecycle
    // ============================================

    /**
     * Pause the render loop.
     * No renders will occur until resumed.
     */
    pause() {
        this._paused = true;
        this._cancelScheduledFrame();
    }

    /**
     * Resume the render loop.
     * Pending render requests will be processed.
     */
    resume() {
        this._paused = false;
        if (this._dirtyPhases.size > 0) {
            this._scheduleFrame();
        }
    }

    /**
     * Check if the scheduler is paused.
     * @returns {boolean}
     */
    isPaused() {
        return this._paused;
    }

    // ============================================
    // Public API - Frame Callbacks
    // ============================================

    /**
     * Register a callback called after each frame render.
     * @param {Function} callback - Callback(stats)
     * @returns {Function} Unsubscribe function
     */
    onFrame(callback) {
        this._frameListeners.add(callback);
        return () => this._frameListeners.delete(callback);
    }

    // ============================================
    // Public API - Statistics
    // ============================================

    /**
     * Get current rendering statistics.
     * @returns {Object}
     */
    getStats() {
        return {
            fps: this._stats.fps,
            averageFrameTime: this._stats.averageFrameTime,
            frameCount: this._stats.frameCount,
            droppedFrames: this._stats.droppedFrames,
            renderedFrames: this._stats.renderedFrames,
            dirtyPhases: Array.from(this._dirtyPhases),
            hasPendingRender: this._frameScheduled,
            isPaused: this._paused,
            registeredPhases: Array.from(this._renderers.keys()),
        };
    }

    // ============================================
    // Public API - Disposal
    // ============================================

    /**
     * Dispose the render scheduler.
     */
    dispose() {
        if (this._disposed) return;

        this._cancelScheduledFrame();
        this._dirtyPhases.clear();
        this._dirtyRegions = null;
        this._renderers.clear();
        this._frameListeners.clear();
        this._disposed = true;

        this._log('info', 'RenderScheduler disposed');
    }

    // ============================================
    // Private Methods - Scheduling
    // ============================================

    /**
     * Schedule a render frame via requestAnimationFrame.
     * @private
     */
    _scheduleFrame() {
        if (this._frameScheduled) return;

        this._frameScheduled = true;
        this._rafId = requestAnimationFrame(this._boundRenderLoop);
    }

    /**
     * Cancel a scheduled render frame.
     * @private
     */
    _cancelScheduledFrame() {
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this._frameScheduled = false;
    }

    // ============================================
    // Private Methods - Render Loop
    // ============================================

    /**
     * Main render loop executed on each animation frame.
     * @private
     * @param {DOMHighResTimeStamp} timestamp - Frame timestamp
     */
    _renderLoop(timestamp) {
        this._rafId = null;
        this._frameScheduled = false;

        if (this._paused || this._disposed) return;

        const frameStart = performance.now();

        // Collect phases to render
        const phasesToRender = RenderScheduler.PHASE_ORDER.filter(
            phase => this._dirtyPhases.has(phase)
        );

        // Collect dirty regions
        const dirtyRegions = this._dirtyRegions;

        // Clear dirty state BEFORE rendering (new requests may come during render)
        this._dirtyPhases.clear();
        this._dirtyRegions = null;

        // Execute render
        if (phasesToRender.length > 0) {
            try {
                this._executeRender(phasesToRender, dirtyRegions);
            } catch (error) {
                console.error('[RenderScheduler] Render error:', error);
            }
        }

        // Update statistics
        const frameEnd = performance.now();
        const frameTime = frameEnd - frameStart;
        this._updateStats(frameTime, timestamp);

        // Check frame budget
        if (frameTime > this._options.frameBudget && this._options.debug) {
            this._log('warn', `Frame over budget: ${frameTime.toFixed(2)}ms`);
        }

        // Emit frame event
        this._eventBus.emitSync(PerformanceEvents.FRAME_RENDERED, {
            frameTime,
            phases: phasesToRender,
            timestamp,
        });

        // Notify frame listeners
        for (const listener of this._frameListeners) {
            try {
                listener(this._stats);
            } catch (error) {
                console.error('[RenderScheduler] Frame listener error:', error);
            }
        }

        // If new render requests came in during this frame, schedule next frame
        if (this._dirtyPhases.size > 0 && !this._paused) {
            this._scheduleFrame();
        }
    }

    /**
     * Execute the actual rendering for given phases.
     * @private
     * @param {string[]} phases - Phases to render
     * @param {Set<Rect>|null} dirtyRegions - Dirty regions (null = full canvas)
     */
    _executeRender(phases, dirtyRegions) {
        for (const phase of phases) {
            const renderers = this._renderers.get(phase);
            if (!renderers || renderers.length === 0) continue;

            for (const renderer of renderers) {
                try {
                    renderer(null, dirtyRegions, this._stats);
                } catch (error) {
                    console.error(`[RenderScheduler] Renderer error in phase "${phase}":`, error);
                }
            }
        }

        this._stats.renderedFrames++;

        // Emit rendered event
        this._eventBus.emitSync(CanvasEvents.RENDERED, {
            phases,
            dirtyRegions: dirtyRegions ? Array.from(dirtyRegions) : null,
        });
    }

    // ============================================
    // Private Methods - Dirty Regions
    // ============================================

    /**
     * Add a dirty region, merging with existing ones.
     * @private
     * @param {Rect} region - New dirty region
     */
    _addDirtyRegion(region) {
        if (!region || region.isEmpty) return;

        // If dirty regions are null (full canvas), keep it that way
        if (this._dirtyRegions === null) return;

        // Check if new region overlaps existing ones and merge
        for (const existing of this._dirtyRegions) {
            if (existing.intersects(region) || this._isAdjacent(existing, region)) {
                // Merge by replacing with union
                this._dirtyRegions.delete(existing);
                this._dirtyRegions.add(existing.union(region));
                return;
            }
        }

        // No overlap, add as new region
        this._dirtyRegions.add(region);

        // If too many regions, collapse to full render
        if (this._dirtyRegions.size > 20) {
            this._dirtyRegions = null;
        }
    }

    /**
     * Check if two rectangles are adjacent or nearly adjacent.
     * @private
     * @param {Rect} a - First rectangle
     * @param {Rect} b - Second rectangle
     * @returns {boolean}
     */
    _isAdjacent(a, b) {
        const gap = 10; // Merge if within 10 pixels
        const expandedA = a.expand(gap);
        return expandedA.intersects(b);
    }

    // ============================================
    // Private Methods - Statistics
    // ============================================

    /**
     * Update frame statistics.
     * @private
     * @param {number} frameTime - Time spent in this frame (ms)
     * @param {number} timestamp - Frame timestamp
     */
    _updateStats(frameTime, timestamp) {
        this._stats.frameCount++;
        this._stats.lastFrameTime = timestamp;
        this._framesSinceLastFpsUpdate++;

        // Track frame times for average
        this._stats.frameTimes.push(frameTime);
        if (this._stats.frameTimes.length > 60) {
            this._stats.frameTimes.shift();
        }

        // Calculate average frame time
        this._stats.averageFrameTime = this._stats.frameTimes.reduce((a, b) => a + b, 0) /
            this._stats.frameTimes.length;

        // Update FPS every second
        if (timestamp - this._lastFpsUpdate >= this._fpsUpdateInterval) {
            this._stats.fps = Math.round(
                this._framesSinceLastFpsUpdate * 1000 / (timestamp - this._lastFpsUpdate)
            );
            this._framesSinceLastFpsUpdate = 0;
            this._lastFpsUpdate = timestamp;

            // Detect dropped frames
            if (this._stats.fps < this._options.targetFPS * 0.9) {
                this._stats.droppedFrames++;
                this._eventBus.emitSync(PerformanceEvents.FPS_DROP, {
                    fps: this._stats.fps,
                    targetFPS: this._options.targetFPS,
                });
            }
        }
    }

    // ============================================
    // Private Methods - Logging
    // ============================================

    /**
     * Log a message if debug mode is enabled.
     * @private
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {...*} args - Additional arguments
     */
    _log(level, message, ...args) {
        if (!this._options.debug) return;

        const prefix = '[RenderScheduler]';

        switch (level) {
            case 'error':
                console.error(prefix, message, ...args);
                break;
            case 'warn':
                console.warn(prefix, message, ...args);
                break;
            case 'info':
                console.info(prefix, message, ...args);
                break;
            case 'debug':
            default:
                console.debug(prefix, message, ...args);
                break;
        }
    }
}

// ============================================
// Default Export
// ============================================

export default RenderScheduler;

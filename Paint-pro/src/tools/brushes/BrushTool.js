// ============================================
// Paint Pro - Professional Web Graphics Application
// src/tools/brushes/BrushTool.js
// Freehand Brush Drawing Tool
// ============================================

import { BaseTool } from '../ToolAPI/BaseTool.js';
import { BaseCommand, CommandCategory } from '../../core/command-bus/Command.js';

/**
 * @class BrushStrokeCommand
 * @description Command that records a brush stroke for undo/redo.
 * Stores stroke points and brush settings, can merge with consecutive strokes.
 * @extends {BaseCommand}
 */
class BrushStrokeCommand extends BaseCommand {
    /**
     * @param {string} layerId - Target layer ID
     * @param {Array} points - Array of stroke points with pressure
     * @param {Object} brushSettings - Brush configuration at time of stroke
     * @param {Object} renderer - Reference to the layer renderer for undo/redo
     */
    constructor(layerId, points, brushSettings, renderer) {
        super('brushStroke', CommandCategory.DRAWING, {
            description: `Brush Stroke (${points.length} points)`,
            metadata: { layerId, brushType: brushSettings.type },
        });

        /**
         * Target layer for the stroke.
         * @private
         * @type {string}
         */
        this._layerId = layerId;

        /**
         * Stroke points with pressure data.
         * @private
         * @type {Array}
         */
        this._points = points;

        /**
         * Brush settings at time of stroke.
         * @private
         * @type {Object}
         */
        this._brushSettings = { ...brushSettings };

        /**
         * Layer renderer reference.
         * @private
         * @type {Object}
         */
        this._renderer = renderer;

        /**
         * Snapshot of the affected region before the stroke.
         * @private
         * @type {ImageData|null}
         */
        this._beforeSnapshot = null;

        /**
         * Snapshot of the affected region after the stroke.
         * @private
         * @type {ImageData|null}
         */
        this._afterSnapshot = null;

        /**
         * Bounding box of the stroke region.
         * @private
         * @type {Object|null}
         */
        this._bounds = null;
    }

    /** @override */
    async _execute() {
        // Capture before snapshot if not already captured
        if (!this._beforeSnapshot) {
            this._captureBeforeSnapshot();
        }

        // If we have the after snapshot, restore it (for redo)
        if (this._afterSnapshot && this._renderer) {
            const layerCtx = this._renderer.getLayerContext(this._layerId);
            if (layerCtx && this._bounds) {
                layerCtx.putImageData(this._afterSnapshot, this._bounds.x, this._bounds.y);
            }
        }
    }

    /** @override */
    async _undo() {
        // Restore the before snapshot
        if (this._beforeSnapshot && this._renderer && this._bounds) {
            const layerCtx = this._renderer.getLayerContext(this._layerId);
            if (layerCtx) {
                layerCtx.putImageData(this._beforeSnapshot, this._bounds.x, this._bounds.y);
            }
        }
    }

    /** @override */
    canMerge(other) {
        // Merge consecutive strokes on the same layer within 500ms
        return other instanceof BrushStrokeCommand &&
               other._layerId === this._layerId &&
               Math.abs(other.timestamp - this.timestamp) < 500;
    }

    /** @override */
    async merge(other) {
        // Combine points and expand bounds
        this._points.push(...other._points);
        this._bounds = this._unionBounds(this._bounds, other._bounds);
        this._afterSnapshot = other._afterSnapshot;
        this._description = `Brush Stroke (${this._points.length} points)`;
    }

    /** @override */
    get memoryUsage() {
        return (this._beforeSnapshot ? this._beforeSnapshot.data.length : 0) +
               (this._afterSnapshot ? this._afterSnapshot.data.length : 0) +
               this._points.length * 24; // ~24 bytes per point
    }

    /** @override */
    _dispose() {
        this._beforeSnapshot = null;
        this._afterSnapshot = null;
        this._points = [];
    }

    /**
     * Capture the state of the layer before the stroke.
     * @private
     */
    _captureBeforeSnapshot() {
        if (!this._renderer) return;

        const layerCtx = this._renderer.getLayerContext(this._layerId);
        if (!layerCtx) return;

        // Calculate bounding box with padding
        this._bounds = this._calculateStrokeBounds(10);
        const b = this._bounds;

        try {
            this._beforeSnapshot = layerCtx.getImageData(b.x, b.y, b.width, b.height);
        } catch (error) {
            console.warn('Failed to capture stroke snapshot:', error);
        }
    }

    /**
     * Capture the after state and finalize.
     * @param {Object} renderer - Layer renderer
     */
    captureAfterSnapshot(renderer) {
        if (!this._bounds) return;

        const layerCtx = renderer.getLayerContext(this._layerId);
        if (!layerCtx) return;

        try {
            const b = this._bounds;
            this._afterSnapshot = layerCtx.getImageData(b.x, b.y, b.width, b.height);
        } catch (error) {
            console.warn('Failed to capture after snapshot:', error);
        }
    }

    /**
     * Calculate bounding box of the stroke.
     * @private
     * @param {number} padding - Extra padding around stroke
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    _calculateStrokeBounds(padding = 5) {
        if (this._points.length === 0) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        const brushSize = (this._brushSettings.size || 10) / 2;

        for (const point of this._points) {
            minX = Math.min(minX, point.x - brushSize);
            minY = Math.min(minY, point.y - brushSize);
            maxX = Math.max(maxX, point.x + brushSize);
            maxY = Math.max(maxY, point.y + brushSize);
        }

        return {
            x: Math.max(0, Math.floor(minX - padding)),
            y: Math.max(0, Math.floor(minY - padding)),
            width: Math.ceil(maxX - minX + padding * 2),
            height: Math.ceil(maxY - minY + padding * 2),
        };
    }

    /**
     * Create union of two bounding boxes.
     * @private
     */
    _unionBounds(a, b) {
        if (!a) return b;
        if (!b) return a;

        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const right = Math.max(a.x + a.width, b.x + b.width);
        const bottom = Math.max(a.y + a.height, b.y + b.height);

        return { x, y, width: right - x, height: bottom - y };
    }
}

// ============================================
// BrushTool Class
// ============================================

/**
 * @class BrushTool
 * @description Freehand brush drawing tool with pressure sensitivity
 * and smooth stroke rendering. Uses BrushEngine for pixel output.
 * 
 * Features:
 * - Pressure-sensitive brush strokes
 * - Pen tilt support
 * - Smooth stroke interpolation
 * - Undoable via CommandBus
 * - Configurable brush settings (size, opacity, flow, hardness)
 * 
 * @extends {BaseTool}
 */
export class BrushTool extends BaseTool {
    /**
     * @param {Object} options - Tool options
     * @param {EventBus} options.eventBus - Event bus
     * @param {CommandBus} options.commandBus - Command bus for undo
     * @param {Object} [options.brushEngine] - Brush engine reference
     * @param {Object} [options.layerRenderer] - Layer renderer for pixel access
     * @param {Function} [options.getActiveLayerId] - Function returning active layer ID
     */
    constructor(options = {}) {
        super({
            eventBus: options.eventBus,
            cursor: 'crosshair',
            cursorPriority: 10,
            supportsPressure: true,
            supportsTilt: true,
            defaultOptions: {
                size: 10,
                opacity: 1,
                flow: 1,
                hardness: 0.5,
                spacing: 0.1,
                smoothing: 0.3,
                brushType: 'soft',
            },
        });

        /**
         * Command bus for undoable operations.
         * @private
         * @type {CommandBus}
         */
        this._commandBus = options.commandBus;

        /**
         * Brush engine reference.
         * @private
         * @type {Object}
         */
        this._brushEngine = options.brushEngine || null;

        /**
         * Layer renderer for pixel data access.
         * @private
         * @type {Object}
         */
        this._layerRenderer = options.layerRenderer || null;

        /**
         * Function returning the active layer ID.
         * @private
         * @type {Function}
         */
        this._getActiveLayerId = options.getActiveLayerId || (() => null);

        /**
         * Accumulated stroke points for the current stroke.
         * @private
         * @type {Array}
         */
        this._strokePoints = [];

        /**
         * Current brush stroke command being built.
         * @private
         * @type {BrushStrokeCommand|null}
         */
        this._currentCommand = null;

        /**
         * Last rendered point for spacing calculation.
         * @private
         * @type {{x: number, y: number}|null}
         */
        this._lastRenderedPoint = null;

        /**
         * Smoothing buffer for input stabilization.
         * @private
         * @type {Array}
         */
        this._smoothingBuffer = [];

        /**
         * Maximum smoothing buffer size.
         * @private
         * @type {number}
         */
        this._maxSmoothingBuffer = 8;
    }

    // ============================================
    // Tool Identity
    // ============================================

    /** @override */ get id() { return 'brush'; }
    /** @override */ get name() { return 'Brush'; }
    /** @override */ get icon() { return 'brush'; }
    /** @override */ get category() { return 'drawing'; }
    /** @override */ get shortcut() { return 'b'; }
    /** @override */ get description() { return 'Paint freehand brush strokes'; }

    // ============================================
    // Lifecycle Hooks
    // ============================================

    /** @override */
    async _onInitialize() {
        // Brush tool doesn't need heavy initialization
    }

    /** @override */
    async _onActivate() {
        this._lastRenderedPoint = null;
        this._smoothingBuffer = [];
    }

    /** @override */
    async _onDeactivate() {
        // Cancel any in-progress stroke
        if (this._isInteracting) {
            this._endStroke(this._currentPoint || this._startPoint);
        }
    }

    /** @override */
    _onDispose() {
        this._brushEngine = null;
        this._layerRenderer = null;
        this._getActiveLayerId = null;
    }

    // ============================================
    // Pointer Event Handlers
    // ============================================

    /** @override */
    _onPointerDown(point, event) {
        const layerId = this._getActiveLayerId();
        if (!layerId) return;

        // Start new stroke
        this._strokePoints = [];
        this._smoothingBuffer = [];
        this._lastRenderedPoint = null;

        // Add first point
        const pressure = event.pressure || 0.5;
        this._addStrokePoint(point, pressure);

        // Create undo command
        const brushSettings = {
            type: this.getOption('brushType'),
            size: this.getOption('size'),
            opacity: this.getOption('opacity'),
            flow: this.getOption('flow'),
            hardness: this.getOption('hardness'),
        };

        this._currentCommand = new BrushStrokeCommand(
            layerId,
            [],
            brushSettings,
            this._layerRenderer
        );

        // Begin drawing on layer
        this._beginLayerStroke(layerId, point, event);
    }

    /** @override */
    _onPointerMove(point, event) {
        if (!this._isInteracting) return;

        const pressure = event.pressure || 0.5;

        // Add to stroke points
        this._addStrokePoint(point, pressure);

        // Apply smoothing
        const smoothedPoint = this._smoothPoint(point);

        // Check spacing
        if (this._shouldRenderPoint(smoothedPoint)) {
            this._renderStrokeSegment(smoothedPoint, pressure, event);
            this._lastRenderedPoint = smoothedPoint;
        }
    }

    /** @override */
    _onPointerUp(point, event) {
        if (!this._isInteracting) return;

        this._endStroke(point);
    }

    /** @override */
    _onPointerCancel() {
        if (this._currentCommand) {
            this._currentCommand.dispose();
            this._currentCommand = null;
        }
        this._strokePoints = [];
        this._lastRenderedPoint = null;
    }

    // ============================================
    // Stroke Management
    // ============================================

    /**
     * Add a point to the stroke buffer.
     * @private
     * @param {{x: number, y: number}} point - Canvas point
     * @param {number} pressure - Pen pressure (0-1)
     */
    _addStrokePoint(point, pressure) {
        this._strokePoints.push({
            x: point.x,
            y: point.y,
            pressure,
            time: performance.now(),
        });

        this._smoothingBuffer.push({ x: point.x, y: point.y, pressure });

        // Limit buffer size
        if (this._smoothingBuffer.length > this._maxSmoothingBuffer) {
            this._smoothingBuffer.shift();
        }
    }

    /**
     * Smooth a point using moving average.
     * @private
     * @param {{x: number, y: number}} point - Raw point
     * @returns {{x: number, y: number}} Smoothed point
     */
    _smoothPoint(point) {
        const smoothing = this.getOption('smoothing');

        if (smoothing <= 0 || this._smoothingBuffer.length < 2) {
            return point;
        }

        // Weighted moving average
        let totalWeight = 0;
        let sumX = 0;
        let sumY = 0;

        for (let i = 0; i < this._smoothingBuffer.length; i++) {
            const p = this._smoothingBuffer[i];
            const weight = 1 + i * smoothing; // More recent = higher weight
            sumX += p.x * weight;
            sumY += p.y * weight;
            totalWeight += weight;
        }

        return {
            x: sumX / totalWeight,
            y: sumY / totalWeight,
        };
    }

    /**
     * Check if a point should be rendered based on spacing.
     * @private
     * @param {{x: number, y: number}} point - Candidate point
     * @returns {boolean}
     */
    _shouldRenderPoint(point) {
        if (!this._lastRenderedPoint) return true;

        const dx = point.x - this._lastRenderedPoint.x;
        const dy = point.y - this._lastRenderedPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const size = this.getOption('size') || 10;
        const spacing = this.getOption('spacing') || 0.1;

        return distance >= size * spacing;
    }

    /**
     * Begin a stroke on the active layer.
     * @private
     * @param {string} layerId - Target layer ID
     * @param {{x: number, y: number}} point - Start point
     * @param {PointerEvent} event - Pointer event
     */
    _beginLayerStroke(layerId, point, event) {
        const layerCtx = this._layerRenderer?.getLayerContext(layerId);
        if (!layerCtx) return;

        // Capture before snapshot for undo
        if (this._currentCommand) {
            this._currentCommand._captureBeforeSnapshot();
        }

        // Start the brush engine stroke
        if (this._brushEngine) {
            this._brushEngine.startStroke(point, {
                size: this.getOption('size'),
                opacity: this.getOption('opacity'),
                flow: this.getOption('flow'),
                hardness: this.getOption('hardness'),
                brushType: this.getOption('brushType'),
                pressure: event.pressure || 0.5,
                tiltX: event.tiltX || 0,
                tiltY: event.tiltY || 0,
            });
        } else {
            // Fallback: direct drawing
            layerCtx.save();
            layerCtx.lineCap = 'round';
            layerCtx.lineJoin = 'round';
            layerCtx.globalAlpha = this.getOption('opacity');
            layerCtx.strokeStyle = this._getActiveColor();
            layerCtx.lineWidth = this.getOption('size') * (event.pressure || 0.5);
            layerCtx.beginPath();
            layerCtx.moveTo(point.x, point.y);
        }
    }

    /**
     * Render a segment of the brush stroke.
     * @private
     * @param {{x: number, y: number}} point - Current point
     * @param {number} pressure - Pen pressure
     * @param {PointerEvent} event - Pointer event
     */
    _renderStrokeSegment(point, pressure, event) {
        const layerId = this._getActiveLayerId();
        const layerCtx = this._layerRenderer?.getLayerContext(layerId);
        if (!layerCtx) return;

        if (this._brushEngine) {
            this._brushEngine.continueStroke(point, {
                pressure,
                tiltX: event.tiltX || 0,
                tiltY: event.tiltY || 0,
            });
        } else if (this._lastRenderedPoint) {
            // Fallback: direct line drawing
            layerCtx.lineTo(point.x, point.y);
            layerCtx.stroke();
            layerCtx.beginPath();
            layerCtx.moveTo(point.x, point.y);
        }
    }

    /**
     * End the current stroke and record the command.
     * @private
     * @param {{x: number, y: number}} point - Final point
     */
    _endStroke(point) {
        const layerId = this._getActiveLayerId();

        if (this._brushEngine) {
            this._brushEngine.endStroke();
        } else {
            const layerCtx = this._layerRenderer?.getLayerContext(layerId);
            if (layerCtx) {
                layerCtx.restore();
            }
        }

        // Finalize undo command
        if (this._currentCommand && this._strokePoints.length > 0) {
            this._currentCommand._points = this._strokePoints;
            this._currentCommand.captureAfterSnapshot(this._layerRenderer);

            // Execute via command bus for undo support
            if (this._commandBus) {
                this._commandBus.execute(this._currentCommand).catch(err => {
                    console.error('Failed to execute brush stroke command:', err);
                });
            }
        }

        this._currentCommand = null;
        this._strokePoints = [];
        this._lastRenderedPoint = null;
    }

    // ============================================
    // Helpers
    // ============================================

    /**
     * Get the current active drawing color.
     * @private
     * @returns {string} CSS color string
     */
    _getActiveColor() {
        // Default black - in production, get from ColorManager
        return '#000000';
    }

    /**
     * Set the brush engine reference.
     * @param {Object} engine - Brush engine
     */
    setBrushEngine(engine) {
        this._brushEngine = engine;
    }

    /**
     * Set the layer renderer reference.
     * @param {Object} renderer - Layer renderer
     */
    setLayerRenderer(renderer) {
        this._layerRenderer = renderer;
    }

    // ============================================
    // Options UI
    // ============================================

    /** @override */
    getOptionsHTML() {
        const size = this.getOption('size');
        const opacity = this.getOption('opacity');
        const flow = this.getOption('flow');
        const hardness = this.getOption('hardness');

        return `
            <div class="tool-options-group">
                <label>Size: <span>${size}</span>px</label>
                <input type="range" min="1" max="500" value="${size}" 
                       data-option="size" class="tool-option-slider">
            </div>
            <div class="tool-options-group">
                <label>Opacity: <span>${Math.round(opacity * 100)}</span>%</label>
                <input type="range" min="1" max="100" value="${Math.round(opacity * 100)}" 
                       data-option="opacity" class="tool-option-slider">
            </div>
            <div class="tool-options-group">
                <label>Flow: <span>${Math.round(flow * 100)}</span>%</label>
                <input type="range" min="1" max="100" value="${Math.round(flow * 100)}" 
                       data-option="flow" class="tool-option-slider">
            </div>
            <div class="tool-options-group">
                <label>Hardness: <span>${Math.round(hardness * 100)}</span>%</label>
                <input type="range" min="0" max="100" value="${Math.round(hardness * 100)}" 
                       data-option="hardness" class="tool-option-slider">
            </div>
        `;
    }

    /** @override */
    getStatusText() {
        const size = this.getOption('size');
        return `Brush - Size: ${size}px`;
    }
}

// ============================================
// Default Export
// ============================================

export default BrushTool;

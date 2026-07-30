// ============================================
// Paint Pro - Professional Web Graphics Application
// src/rendering/SelectionRenderer.js
// Selection Visual Renderer
// ============================================

import { SelectionState, TransformHandle, SelectionType } from '../domain/selection/Selection.js';
import { SelectionEvents } from '../../core/event-bus/EventTypes.js';

/**
 * @class SelectionRenderer
 * @description Renders all selection-related visuals including marching ants,
 * transform handles, selection overlay, and quick mask. Handles multiple
 * selection types with proper anti-aliased rendering and animation.
 * 
 * Rendering Features:
 * - Marching ants animation (dashed outline)
 * - Semi-transparent selection fill
 * - Transform handles (8 resize + 1 rotation handle)
 * - Center point indicator during transforms
 * - Quick mask mode overlay
 * - Selection feathering visualization
 * 
 * Performance:
 * - Uses a dedicated overlay canvas to avoid full recomposite
 * - Marching ants offset updated incrementally
 * - Handles only rendered when selection is active
 * 
 * @example
 * const selectionRenderer = new SelectionRenderer(eventBus);
 * 
 * // Register with render scheduler
 * scheduler.registerRenderer(RenderScheduler.Phase.SELECTION,
 *     (ctx) => selectionRenderer.render(ctx));
 * 
 * // Update marching ants each frame
 * selectionRenderer.updateAnimation(deltaTime);
 */
export class SelectionRenderer {
    /**
     * @param {EventBus} eventBus - Event bus for selection events
     * @param {Object} [options={}] - Configuration options
     * @param {number} [options.handleSize=8] - Size of transform handles in pixels
     * @param {string} [options.marchingColor='#000000'] - Marching ants color
     * @param {string} [options.fillColor='rgba(0,120,215,0.1)'] - Selection fill color
     * @param {number} [options.dashLength=6] - Dash segment length
     * @param {number} [options.gapLength=3] - Gap between dashes
     * @param {number} [options.animationSpeed=30] - Pixels per second for marching ants
     * @param {boolean} [options.showHandles=true] - Show transform handles
     */
    constructor(eventBus, options = {}) {
        if (!eventBus) {
            throw new Error('SelectionRenderer requires an EventBus instance');
        }

        /**
         * Event bus for selection events.
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
            handleSize: options.handleSize || 8,
            marchingColor: options.marchingColor || '#000000',
            marchingColorLight: '#FFFFFF', // For contrast on dark backgrounds
            fillColor: options.fillColor || 'rgba(0, 120, 215, 0.1)',
            dashLength: options.dashLength || 6,
            gapLength: options.gapLength || 3,
            animationSpeed: options.animationSpeed || 30,
            showHandles: options.showHandles !== false,
        });

        /**
         * Current selection reference (set externally).
         * @private
         * @type {Selection|null}
         */
        this._selection = null;

        /**
         * Marching ants animation phase offset.
         * @private
         * @type {number}
         */
        this._animationOffset = 0;

        /**
         * Whether the renderer has been disposed.
         * @private
         * @type {boolean}
         */
        this._disposed = false;

        /**
         * Bound event handlers.
         * @private
         */
        this._boundHandlers = {};

        this._setupEventListeners();
    }

    // ============================================
    // Public API - Selection Reference
    // ============================================

    /**
     * Set the current selection to render.
     * @param {Selection} selection - Selection domain object
     */
    setSelection(selection) {
        this._selection = selection;
    }

    /**
     * Get the current selection.
     * @returns {Selection|null}
     */
    getSelection() {
        return this._selection;
    }

    // ============================================
    // Public API - Animation
    // ============================================

    /**
     * Update the marching ants animation.
     * Should be called each frame with the delta time.
     * 
     * @param {number} deltaTime - Time since last frame in milliseconds
     */
    updateAnimation(deltaTime = 16) {
        if (!this._selection || !this._selection.exists) return;

        // Advance the marching offset
        const totalDashGap = this._options.dashLength + this._options.gapLength;
        this._animationOffset = (
            (this._animationOffset + this._options.animationSpeed * deltaTime / 1000) %
            totalDashGap
        );

        // Update selection's marching offset for consistency
        this._selection.updateMarchingAnts(deltaTime);
    }

    // ============================================
    // Public API - Rendering
    // ============================================

    /**
     * Render the selection onto a canvas context.
     * This is the main rendering function called by RenderScheduler.
     * 
     * @param {CanvasRenderingContext2D} ctx - Target context
     * @param {Set<Rect>|null} [_dirtyRegions] - Dirty regions (unused, selection always full-renders)
     */
    render(ctx, _dirtyRegions = null) {
        if (!ctx || !this._selection || !this._selection.exists) return;
        if (!this._selection.visible) return;

        const bounds = this._selection.bounds;
        if (!bounds || bounds.isEmpty) return;

        ctx.save();

        // Apply rotation if needed
        if (bounds.angle !== 0) {
            const center = bounds.center;
            ctx.translate(center.x, center.y);
            ctx.rotate((bounds.angle * Math.PI) / 180);
            ctx.translate(-center.x, -center.y);
        }

        // Draw selection fill
        this._drawFill(ctx, bounds);

        // Draw marching ants outline
        this._drawMarchingAnts(ctx, bounds);

        // Draw transform handles if in transform mode
        if (this._selection.isTransforming && this._options.showHandles) {
            this._drawTransformHandles(ctx, bounds, this._selection.activeHandle);
        }

        ctx.restore();
    }

    /**
     * Render the quick mask overlay.
     * @param {CanvasRenderingContext2D} ctx - Target context
     * @param {number} canvasWidth - Canvas width
     * @param {number} canvasHeight - Canvas height
     */
    renderQuickMask(ctx, canvasWidth, canvasHeight) {
        if (!ctx || !this._selection) return;

        // Quick mask shows selected area as clear and unselected as red overlay
        ctx.save();

        // Fill entire canvas with mask color
        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Clear selected area (destination-out)
        if (this._selection.exists && this._selection.bounds) {
            const bounds = this._selection.bounds;

            ctx.globalCompositeOperation = 'destination-out';

            if (this._selection.isRectangular) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
            } else {
                // For non-rectangular, use the mask
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    /**
     * Get the transform handle at a given canvas position.
     * @param {number} x - X in canvas coordinates
     * @param {number} y - Y in canvas coordinates
     * @returns {string} Handle identifier from TransformHandle
     */
    getHandleAtPoint(x, y) {
        if (!this._selection || !this._selection.exists) {
            return TransformHandle.NONE;
        }

        const bounds = this._selection.bounds;
        if (!bounds) return TransformHandle.NONE;

        const handleSize = this._options.handleSize;
        const halfHandle = handleSize / 2;

        // Check if point is inside selection bounds (move handle)
        if (bounds.containsPoint(x, y)) {
            return TransformHandle.MOVE;
        }

        // Check corner and edge handles
        const handles = this._getHandlePositions(bounds);

        for (const [handleId, position] of Object.entries(handles)) {
            if (x >= position.x - halfHandle - 4 &&
                x <= position.x + halfHandle + 4 &&
                y >= position.y - halfHandle - 4 &&
                y <= position.y + halfHandle + 4) {
                return handleId;
            }
        }

        return TransformHandle.NONE;
    }

    // ============================================
    // Public API - Disposal
    // ============================================

    /**
     * Dispose the renderer.
     */
    dispose() {
        if (this._disposed) return;

        this._removeEventListeners();
        this._selection = null;
        this._disposed = true;
    }

    // ============================================
    // Private Methods - Drawing
    // ============================================

    /**
     * Draw the semi-transparent selection fill.
     * @private
     * @param {CanvasRenderingContext2D} ctx - Target context
     * @param {SelectionBounds} bounds - Selection bounds
     */
    _drawFill(ctx, bounds) {
        ctx.fillStyle = this._options.fillColor;

        if (this._selection.type === SelectionType.ELLIPTICAL) {
            ctx.beginPath();
            ctx.ellipse(
                bounds.x + bounds.width / 2,
                bounds.y + bounds.height / 2,
                bounds.width / 2,
                bounds.height / 2,
                0, 0, Math.PI * 2
            );
            ctx.fill();
        } else if (this._selection.hasMask) {
            // For masked selections, fill is already computed in the mask
            ctx.beginPath();
            ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
            ctx.fill();
        } else {
            ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        }
    }

    /**
     * Draw marching ants outline.
     * @private
     * @param {CanvasRenderingContext2D} ctx - Target context
     * @param {SelectionBounds} bounds - Selection bounds
     */
    _drawMarchingAnts(ctx, bounds) {
        const dashLen = this._options.dashLength;
        const gapLen = this._options.gapLength;
        const offset = this._animationOffset;

        ctx.lineWidth = 1;
        ctx.setLineDash([dashLen, gapLen]);
        ctx.lineDashOffset = -offset;

        // Draw dark dash
        ctx.strokeStyle = this._options.marchingColor;
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

        // Draw light dash (offset by half the total pattern length)
        ctx.lineDashOffset = -offset - dashLen;
        ctx.strokeStyle = this._options.marchingColorLight;
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

        // Reset dash
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        // Draw feather indicator if feathered
        if (bounds.feather > 0) {
            this._drawFeatherIndicator(ctx, bounds);
        }
    }

    /**
     * Draw feather radius indicator.
     * @private
     * @param {CanvasRenderingContext2D} ctx - Target context
     * @param {SelectionBounds} bounds - Selection bounds
     */
    _drawFeatherIndicator(ctx, bounds) {
        const feather = bounds.feather;

        // Draw outer dotted line showing feather extent
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 4]);

        // Outer feather boundary
        ctx.strokeRect(
            bounds.x - feather,
            bounds.y - feather,
            bounds.width + feather * 2,
            bounds.height + feather * 2
        );

        ctx.setLineDash([]);
    }

    /**
     * Draw transform handles for interactive manipulation.
     * @private
     * @param {CanvasRenderingContext2D} ctx - Target context
     * @param {SelectionBounds} bounds - Selection bounds
     * @param {string} activeHandle - Currently active handle
     */
    _drawTransformHandles(ctx, bounds, activeHandle) {
        const handleSize = this._options.handleSize;
        const halfHandle = handleSize / 2;
        const handles = this._getHandlePositions(bounds);

        for (const [handleId, position] of Object.entries(handles)) {
            const isActive = handleId === activeHandle;

            if (handleId === 'rotation') {
                // Draw rotation handle (circle with line connecting to top center)
                this._drawRotationHandle(ctx, bounds, position, isActive);
                continue;
            }

            // Draw resize handle (square)
            ctx.fillStyle = isActive ? '#4A90D9' : '#FFFFFF';
            ctx.strokeStyle = isActive ? '#2E5C8A' : '#333333';
            ctx.lineWidth = 1;
            ctx.setLineDash([]);

            ctx.fillRect(
                position.x - halfHandle,
                position.y - halfHandle,
                handleSize,
                handleSize
            );
            ctx.strokeRect(
                position.x - halfHandle,
                position.y - halfHandle,
                handleSize,
                handleSize
            );
        }

        // Draw center point
        const center = bounds.center;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(center.x, center.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    /**
     * Draw the rotation handle (circle above top center with connecting line).
     * @private
     * @param {CanvasRenderingContext2D} ctx - Target context
     * @param {SelectionBounds} bounds - Selection bounds
     * @param {{x: number, y: number}} position - Handle position
     * @param {boolean} isActive - Whether handle is active
     */
    _drawRotationHandle(ctx, bounds, position, isActive) {
        const topCenter = { x: bounds.x + bounds.width / 2, y: bounds.y };

        // Draw connecting line
        ctx.strokeStyle = isActive ? '#4A90D9' : '#666666';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(topCenter.x, topCenter.y);
        ctx.lineTo(position.x, position.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw rotation circle
        ctx.fillStyle = isActive ? '#4A90D9' : '#FFFFFF';
        ctx.strokeStyle = isActive ? '#2E5C8A' : '#333333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(position.x, position.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    // ============================================
    // Private Methods - Handle Positions
    // ============================================

    /**
     * Calculate positions of all transform handles.
     * @private
     * @param {SelectionBounds} bounds - Selection bounds
     * @returns {Object<string, {x: number, y: number}>}
     */
    _getHandlePositions(bounds) {
        const x = bounds.x;
        const y = bounds.y;
        const w = bounds.width;
        const h = bounds.height;
        const halfW = w / 2;
        const halfH = h / 2;

        return {
            [TransformHandle.TOP_LEFT]: { x, y },
            [TransformHandle.TOP_CENTER]: { x: x + halfW, y },
            [TransformHandle.TOP_RIGHT]: { x: x + w, y },
            [TransformHandle.MIDDLE_LEFT]: { x, y: y + halfH },
            [TransformHandle.MIDDLE_RIGHT]: { x: x + w, y: y + halfH },
            [TransformHandle.BOTTOM_LEFT]: { x, y: y + h },
            [TransformHandle.BOTTOM_CENTER]: { x: x + halfW, y: y + h },
            [TransformHandle.BOTTOM_RIGHT]: { x: x + w, y: y + h },
            [TransformHandle.ROTATION]: { x: x + halfW, y: y - 25 },
        };
    }

    // ============================================
    // Private Methods - Event Handling
    // ============================================

    /**
     * Setup event listeners for selection changes.
     * @private
     */
    _setupEventListeners() {
        this._boundHandlers.onSelectionCreated = () => {
            this._animationOffset = 0;
        };

        this._eventBus.on(SelectionEvents.CREATED, this._boundHandlers.onSelectionCreated);

        this._boundHandlers.onSelectionDeselected = () => {
            this._animationOffset = 0;
        };

        this._eventBus.on(SelectionEvents.DESELECTED, this._boundHandlers.onSelectionDeselected);
    }

    /**
     * Remove event listeners.
     * @private
     */
    _removeEventListeners() {
        if (this._boundHandlers.onSelectionCreated) {
            this._eventBus.off(SelectionEvents.CREATED, this._boundHandlers.onSelectionCreated);
        }
        if (this._boundHandlers.onSelectionDeselected) {
            this._eventBus.off(SelectionEvents.DESELECTED, this._boundHandlers.onSelectionDeselected);
        }
    }
}

// ============================================
// Default Export
// ============================================

export default SelectionRenderer;

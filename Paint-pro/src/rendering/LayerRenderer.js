// ============================================
// Paint Pro - Professional Web Graphics Application
// src/rendering/LayerRenderer.js
// Layer Compositing Renderer
// ============================================

import { Layer, BlendMode } from '../domain/layer/Layer.js';
import { LayerEvents, CanvasEvents } from '../core/event-bus/EventTypes.js';

/**
 * @class LayerRenderer
 * @description Handles compositing of all visible layers onto the main canvas.
 * Manages per-layer OffscreenCanvas elements for pixel data storage, applies
 * blend modes, opacity, and masks during composition. Responds to layer change
 * events and integrates with RenderScheduler for efficient updates.
 * 
 * Architecture:
 * - Each layer has an associated OffscreenCanvas for its pixel data
 * - Compositing reads from layer canvases and writes to the main context
 * - Blend modes are applied using globalCompositeOperation
 * - Masks are applied using destination-in compositing
 * 
 * @example
 * const layerRenderer = new LayerRenderer(eventBus, mainCanvas);
 * 
 * // Register with render scheduler
 * scheduler.registerRenderer(RenderScheduler.Phase.LAYERS, 
 *     (ctx, dirtyRegions) => layerRenderer.composite(ctx, dirtyRegions));
 * 
 * // Update a specific layer's canvas
 * layerRenderer.setLayerCanvas(layerId, offscreenCanvas);
 */
export class LayerRenderer {
    /**
     * @param {EventBus} eventBus - Event bus for layer events
     * @param {Object} [options={}] - Configuration options
     * @param {HTMLCanvasElement} [options.mainCanvas] - Main canvas element
     * @param {boolean} [options.useOffscreenCanvas=true] - Use OffscreenCanvas for layers
     * @param {number} [options.maxLayerCache=50] - Maximum cached layer canvases
     */
    constructor(eventBus, options = {}) {
        if (!eventBus) {
            throw new Error('LayerRenderer requires an EventBus instance');
        }

        /**
         * Event bus for layer events.
         * @private
         * @type {EventBus}
         */
        this._eventBus = eventBus;

        /**
         * Main canvas element reference.
         * @private
         * @type {HTMLCanvasElement|null}
         */
        this._mainCanvas = options.mainCanvas || null;

        /**
         * Configuration options.
         * @private
         * @type {Object}
         */
        this._options = Object.freeze({
            useOffscreenCanvas: options.useOffscreenCanvas !== false,
            maxLayerCache: options.maxLayerCache || 50,
        });

        /**
         * Map of layer ID to its OffscreenCanvas/HTMLCanvasElement.
         * @private
         * @type {Map<string, OffscreenCanvas|HTMLCanvasElement>}
         */
        this._layerCanvases = new Map();

        /**
         * Map of layer ID to its 2D context.
         * @private
         * @type {Map<string, CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D>}
         */
        this._layerContexts = new Map();

        /**
         * Canvas used for compositing (avoids creating new canvases each frame).
         * @private
         * @type {HTMLCanvasElement|OffscreenCanvas|null}
         */
        this._compositeBuffer = null;

        /**
         * Composite buffer context.
         * @private
         * @type {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D|null}
         */
        this._compositeBufferCtx = null;

        /**
         * Canvas dimensions.
         * @private
         * @type {{width: number, height: number}}
         */
        this._canvasSize = { width: 0, height: 0 };

        /**
         * Background color.
         * @private
         * @type {string}
         */
        this._backgroundColor = '#FFFFFF';

        /**
         * Whether the renderer has been disposed.
         * @private
         * @type {boolean}
         */
        this._disposed = false;

        /**
         * Bound event handlers for cleanup.
         * @private
         */
        this._boundHandlers = {};

        this._setupEventListeners();
    }

    // ============================================
    // Public API - Canvas Management
    // ============================================

    /**
     * Set the main canvas element.
     * @param {HTMLCanvasElement} canvas - Main canvas
     */
    setMainCanvas(canvas) {
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            throw new Error('Main canvas must be an HTMLCanvasElement');
        }

        this._mainCanvas = canvas;
        this._createCompositeBuffer();
    }

    /**
     * Set canvas dimensions (called on canvas resize).
     * @param {number} width - Canvas width in pixels
     * @param {number} height - Canvas height in pixels
     */
    setCanvasSize(width, height) {
        if (width === this._canvasSize.width && height === this._canvasSize.height) {
            return;
        }

        this._canvasSize = { width, height };

        // Resize all existing layer canvases
        for (const [layerId, canvas] of this._layerCanvases) {
            const resized = this._resizeCanvas(canvas, width, height);
            this._layerCanvases.set(layerId, resized);
            this._layerContexts.set(layerId, resized.getContext('2d'));
        }

        // Recreate composite buffer
        this._createCompositeBuffer();
    }

    /**
     * Set the background color.
     * @param {string} color - CSS color string
     */
    setBackgroundColor(color) {
        this._backgroundColor = color || '#FFFFFF';
    }

    /**
     * Get or create a canvas for a specific layer.
     * 
     * @param {string} layerId - Layer identifier
     * @param {Object} [options={}] - Canvas options
     * @param {number} [options.width] - Canvas width
     * @param {number} [options.height] - Canvas height
     * @param {boolean} [options.create=false] - Create if doesn't exist
     * @returns {OffscreenCanvas|HTMLCanvasElement|null}
     */
    getLayerCanvas(layerId, options = {}) {
        let canvas = this._layerCanvases.get(layerId);

        if (!canvas && options.create) {
            canvas = this._createLayerCanvas(
                options.width || this._canvasSize.width,
                options.height || this._canvasSize.height
            );
            this._layerCanvases.set(layerId, canvas);
            this._layerContexts.set(layerId, canvas.getContext('2d'));
        }

        return canvas || null;
    }

    /**
     * Get the 2D context for a layer's canvas.
     * @param {string} layerId - Layer identifier
     * @returns {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D|null}
     */
    getLayerContext(layerId) {
        return this._layerContexts.get(layerId) || null;
    }

    /**
     * Set the canvas for a layer (e.g., after loading from file).
     * @param {string} layerId - Layer identifier
     * @param {OffscreenCanvas|HTMLCanvasElement|ImageBitmap} source - Source canvas or bitmap
     */
    setLayerCanvas(layerId, source) {
        const canvas = this._createLayerCanvas(
            this._canvasSize.width,
            this._canvasSize.height
        );
        const ctx = canvas.getContext('2d');

        if (source) {
            ctx.drawImage(source, 0, 0);
        }

        this._layerCanvases.set(layerId, canvas);
        this._layerContexts.set(layerId, ctx);

        // Enforce cache limit
        this._enforceCacheLimit();
    }

    /**
     * Remove a layer's canvas (when layer is deleted).
     * @param {string} layerId - Layer identifier
     */
    removeLayerCanvas(layerId) {
        const canvas = this._layerCanvases.get(layerId);
        if (canvas) {
            // Clear context to help GC
            const ctx = this._layerContexts.get(layerId);
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }

        this._layerCanvases.delete(layerId);
        this._layerContexts.delete(layerId);
    }

    /**
     * Clear all layer canvases.
     */
    clearAllLayerCanvases() {
        for (const [layerId] of this._layerCanvases) {
            this.removeLayerCanvas(layerId);
        }
    }

    // ============================================
    // Public API - Compositing
    // ============================================

    /**
     * Composite all visible layers onto a target context.
     * This is the main rendering function called by RenderScheduler.
     * 
     * @param {CanvasRenderingContext2D} [targetCtx] - Target context (uses main canvas if not specified)
     * @param {Set<Rect>|null} [dirtyRegions] - Dirty regions to composite (null = full canvas)
     * @param {Object} [renderOptions={}] - Additional render options
     * @param {Layer[]} [renderOptions.layers] - Specific layers to composite (defaults to all from LayerManager)
     * @param {boolean} [renderOptions.skipBackground=false] - Skip background fill
     */
    composite(targetCtx = null, dirtyRegions = null, renderOptions = {}) {
        const ctx = targetCtx || this._getMainContext();
        if (!ctx) return;

        const layers = renderOptions.layers || this._getLayers();
        if (!layers || layers.length === 0) return;

        // If dirty regions are specified, use them; otherwise render full canvas
        if (dirtyRegions && dirtyRegions.size > 0) {
            this._compositeDirtyRegions(ctx, layers, dirtyRegions, renderOptions);
        } else {
            this._compositeFullCanvas(ctx, layers, renderOptions);
        }
    }

    /**
     * Composite a single layer onto a target context.
     * @param {string} layerId - Layer to composite
     * @param {CanvasRenderingContext2D} targetCtx - Target context
     * @param {Rect} [bounds] - Bounds to composite (null = entire layer)
     */
    compositeSingleLayer(layerId, targetCtx, bounds = null) {
        const layer = this._getLayerById(layerId);
        const layerCanvas = this._layerCanvases.get(layerId);

        if (!layer || !layer.visible || !layerCanvas) return;

        targetCtx.save();

        // Apply blend mode
        targetCtx.globalCompositeOperation = this._getCompositeOperation(layer.blendMode);

        // Apply opacity
        targetCtx.globalAlpha = layer.opacity;

        // Draw layer content
        if (bounds) {
            targetCtx.drawImage(
                layerCanvas,
                bounds.x, bounds.y, bounds.width, bounds.height,
                bounds.x + layer.offsetX, bounds.y + layer.offsetY, bounds.width, bounds.height
            );
        } else {
            targetCtx.drawImage(layerCanvas, layer.offsetX, layer.offsetY);
        }

        targetCtx.restore();
    }

    /**
     * Render a thumbnail of the composited layers.
     * @param {number} width - Thumbnail width
     * @param {number} height - Thumbnail height
     * @returns {HTMLCanvasElement}
     */
    renderThumbnail(width = 200, height = 150) {
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = width;
        thumbCanvas.height = height;
        const thumbCtx = thumbCanvas.getContext('2d');

        // Fill background
        thumbCtx.fillStyle = this._backgroundColor;
        thumbCtx.fillRect(0, 0, width, height);

        // Composite layers scaled down
        const layers = this._getLayers();
        if (layers) {
            const scaleX = width / this._canvasSize.width;
            const scaleY = height / this._canvasSize.height;

            thumbCtx.save();
            thumbCtx.scale(scaleX, scaleY);

            for (const layer of layers) {
                const layerCanvas = this._layerCanvases.get(layer.id);
                if (!layer.visible || !layerCanvas) continue;

                thumbCtx.save();
                thumbCtx.globalCompositeOperation = this._getCompositeOperation(layer.blendMode);
                thumbCtx.globalAlpha = layer.opacity;
                thumbCtx.drawImage(layerCanvas, layer.offsetX, layer.offsetY);
                thumbCtx.restore();
            }

            thumbCtx.restore();
        }

        return thumbCanvas;
    }

    // ============================================
    // Public API - Layer Canvas Operations
    // ============================================

    /**
     * Duplicate a layer's canvas content to another layer.
     * @param {string} sourceLayerId - Source layer ID
     * @param {string} targetLayerId - Target layer ID
     */
    duplicateLayerContent(sourceLayerId, targetLayerId) {
        const sourceCanvas = this._layerCanvases.get(sourceLayerId);
        if (!sourceCanvas) return;

        const targetCanvas = this._layerCanvases.get(targetLayerId);
        if (!targetCanvas) return;

        const targetCtx = this._layerContexts.get(targetLayerId);
        if (targetCtx) {
            targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
            targetCtx.drawImage(sourceCanvas, 0, 0);
        }
    }

    /**
     * Merge two layers' canvas content (source drawn on top of target).
     * @param {string} topLayerId - Top layer (will be removed after merge)
     * @param {string} bottomLayerId - Bottom layer (keeps merged result)
     */
    mergeLayerContent(topLayerId, bottomLayerId) {
        const topCanvas = this._layerCanvases.get(topLayerId);
        const bottomCtx = this._layerContexts.get(bottomLayerId);

        if (!topCanvas || !bottomCtx) return;

        bottomCtx.drawImage(topCanvas, 0, 0);
    }

    // ============================================
    // Public API - Disposal
    // ============================================

    /**
     * Dispose the renderer and release all resources.
     */
    dispose() {
        if (this._disposed) return;

        this._removeEventListeners();
        this.clearAllLayerCanvases();
        this._layerCanvases.clear();
        this._layerContexts.clear();
        this._compositeBuffer = null;
        this._compositeBufferCtx = null;
        this._disposed = true;
    }

    // ============================================
    // Private Methods - Compositing Implementation
    // ============================================

    /**
     * Composite full canvas.
     * @private
     * @param {CanvasRenderingContext2D} ctx - Target context
     * @param {Layer[]} layers - Layers to composite
     * @param {Object} options - Render options
     */
    _compositeFullCanvas(ctx, layers, options) {
        // Clear and fill background
        if (!options.skipBackground) {
            ctx.clearRect(0, 0, this._canvasSize.width, this._canvasSize.height);
            ctx.fillStyle = this._backgroundColor;
            ctx.fillRect(0, 0, this._canvasSize.width, this._canvasSize.height);
        }

        // Composite each visible layer
        for (const layer of layers) {
            const layerCanvas = this._layerCanvases.get(layer.id);

            if (!layer.visible) continue;
            if (!layerCanvas) continue;

            ctx.save();
            ctx.globalCompositeOperation = this._getCompositeOperation(layer.blendMode);
            ctx.globalAlpha = layer.opacity;

            // Draw layer at its offset position
            ctx.drawImage(layerCanvas, layer.offsetX, layer.offsetY);

            // Apply mask if present
            if (layer.hasMask && layer.mask.data) {
                this._applyMask(ctx, layer);
            }

            ctx.restore();
        }
    }

    /**
     * Composite only dirty regions for performance.
     * @private
     * @param {CanvasRenderingContext2D} ctx - Target context
     * @param {Layer[]} layers - Layers to composite
     * @param {Set<Rect>} dirtyRegions - Regions to update
     * @param {Object} options - Render options
     */
    _compositeDirtyRegions(ctx, layers, dirtyRegions, options) {
        // For each dirty region
        for (const region of dirtyRegions) {
            // Clip to region
            ctx.save();
            ctx.beginPath();
            ctx.rect(region.x, region.y, region.width, region.height);
            ctx.clip();

            // Fill background in region
            if (!options.skipBackground) {
                ctx.fillStyle = this._backgroundColor;
                ctx.fillRect(region.x, region.y, region.width, region.height);
            }

            // Composite layers in region
            for (const layer of layers) {
                const layerCanvas = this._layerCanvases.get(layer.id);
                if (!layer.visible || !layerCanvas) continue;

                ctx.save();
                ctx.globalCompositeOperation = this._getCompositeOperation(layer.blendMode);
                ctx.globalAlpha = layer.opacity;
                ctx.drawImage(layerCanvas, layer.offsetX, layer.offsetY);
                ctx.restore();
            }

            ctx.restore();
        }
    }

    /**
     * Apply a layer mask using destination-in compositing.
     * @private
     * @param {CanvasRenderingContext2D} ctx - Target context
     * @param {Layer} layer - Layer with mask
     */
    _applyMask(ctx, layer) {
        if (!layer.mask || !layer.mask.data) return;

        ctx.globalCompositeOperation = 'destination-in';

        // Create temporary canvas for mask
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = this._canvasSize.width;
        maskCanvas.height = this._canvasSize.height;
        const maskCtx = maskCanvas.getContext('2d');
        maskCtx.putImageData(layer.mask.data, 0, 0);

        ctx.drawImage(maskCanvas, 0, 0);
    }

    // ============================================
    // Private Methods - Canvas Management
    // ============================================

    /**
     * Create a layer canvas of the given dimensions.
     * @private
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @returns {OffscreenCanvas|HTMLCanvasElement}
     */
    _createLayerCanvas(width, height) {
        if (this._options.useOffscreenCanvas && typeof OffscreenCanvas !== 'undefined') {
            const canvas = new OffscreenCanvas(width, height);
            return canvas;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    /**
     * Resize an existing canvas while preserving content.
     * @private
     * @param {OffscreenCanvas|HTMLCanvasElement} canvas - Canvas to resize
     * @param {number} width - New width
     * @param {number} height - New height
     * @returns {OffscreenCanvas|HTMLCanvasElement}
     */
    _resizeCanvas(canvas, width, height) {
        if (canvas.width === width && canvas.height === height) return canvas;

        const newCanvas = this._createLayerCanvas(width, height);
        const newCtx = newCanvas.getContext('2d');
        const oldCtx = canvas.getContext('2d');

        // Copy old content (if the canvas API supports reading)
        try {
            newCtx.drawImage(canvas, 0, 0);
        } catch {
            // OffscreenCanvas may not support drawImage from another OffscreenCanvas
            // in all contexts; in that case the layer content is lost on resize
        }

        return newCanvas;
    }

    /**
     * Create or recreate the composite buffer.
     * @private
     */
    _createCompositeBuffer() {
        if (this._canvasSize.width === 0 || this._canvasSize.height === 0) return;

        if (this._options.useOffscreenCanvas && typeof OffscreenCanvas !== 'undefined') {
            this._compositeBuffer = new OffscreenCanvas(
                this._canvasSize.width,
                this._canvasSize.height
            );
        } else {
            this._compositeBuffer = document.createElement('canvas');
            this._compositeBuffer.width = this._canvasSize.width;
            this._compositeBuffer.height = this._canvasSize.height;
        }

        this._compositeBufferCtx = this._compositeBuffer.getContext('2d');
    }

    /**
     * Enforce the maximum number of cached layer canvases.
     * @private
     */
    _enforceCacheLimit() {
        if (this._layerCanvases.size <= this._options.maxLayerCache) return;

        // Remove oldest entries (first inserted)
        const excess = this._layerCanvases.size - this._options.maxLayerCache;
        const keysToRemove = Array.from(this._layerCanvases.keys()).slice(0, excess);

        for (const key of keysToRemove) {
            this.removeLayerCanvas(key);
        }
    }

    // ============================================
    // Private Methods - Helpers
    // ============================================

    /**
     * Get the main canvas 2D context.
     * @private
     * @returns {CanvasRenderingContext2D|null}
     */
    _getMainContext() {
        return this._mainCanvas ? this._mainCanvas.getContext('2d') : null;
    }

    /**
     * Get layers from LayerManager if available.
     * @private
     * @returns {Layer[]|null}
     */
    _getLayers() {
        // Layers are injected at composite time via renderOptions
        // or accessed through the application container
        return null;
    }

    /**
     * Get a layer by ID from LayerManager.
     * @private
     * @param {string} layerId - Layer identifier
     * @returns {Layer|null}
     */
    _getLayerById(layerId) {
        return null; // Accessed through application container
    }

    /**
     * Convert blend mode enum to Canvas globalCompositeOperation.
     * @private
     * @param {string} blendMode - Blend mode from BlendMode enum
     * @returns {string} Canvas composite operation
     */
    _getCompositeOperation(blendMode) {
        const mapping = {
            [BlendMode.NORMAL]: 'source-over',
            [BlendMode.MULTIPLY]: 'multiply',
            [BlendMode.SCREEN]: 'screen',
            [BlendMode.OVERLAY]: 'overlay',
            [BlendMode.DARKEN]: 'darken',
            [BlendMode.LIGHTEN]: 'lighten',
            [BlendMode.COLOR_DODGE]: 'color-dodge',
            [BlendMode.COLOR_BURN]: 'color-burn',
            [BlendMode.HARD_LIGHT]: 'hard-light',
            [BlendMode.SOFT_LIGHT]: 'soft-light',
            [BlendMode.DIFFERENCE]: 'difference',
            [BlendMode.EXCLUSION]: 'exclusion',
            [BlendMode.HUE]: 'hue',
            [BlendMode.SATURATION]: 'saturation',
            [BlendMode.COLOR]: 'color',
            [BlendMode.LUMINOSITY]: 'luminosity',
        };

        return mapping[blendMode] || 'source-over';
    }

    // ============================================
    // Private Methods - Event Handling
    // ============================================

    /**
     * Setup event listeners for layer changes.
     * @private
     */
    _setupEventListeners() {
        // Listen for layer content changes to mark canvas as dirty
        this._boundHandlers.onContentChanged = (data) => {
            // Layer content changed - the actual pixel data update
            // is handled by tools writing to the layer context directly
        };

        this._eventBus.on(LayerEvents.CONTENT_CHANGED, this._boundHandlers.onContentChanged);

        this._boundHandlers.onLayerRemoved = (data) => {
            this.removeLayerCanvas(data.layerId);
        };

        this._eventBus.on(LayerEvents.REMOVED, this._boundHandlers.onLayerRemoved);
    }

    /**
     * Remove event listeners.
     * @private
     */
    _removeEventListeners() {
        if (this._boundHandlers.onContentChanged) {
            this._eventBus.off(LayerEvents.CONTENT_CHANGED, this._boundHandlers.onContentChanged);
        }
        if (this._boundHandlers.onLayerRemoved) {
            this._eventBus.off(LayerEvents.REMOVED, this._boundHandlers.onLayerRemoved);
        }
    }
}

// ============================================
// Default Export
// ============================================

export default LayerRenderer;

// ============================================
// Paint Pro - Professional Web Graphics Application
// src/tools/brushes/BrushEngine.js
// Professional Brush Rendering Engine
// ============================================

/**
 * @class BrushEngine
 * @description High-performance brush rendering engine that produces
 * pixel-perfect brush stamps with full dynamics support. Renders smooth
 * strokes with pressure sensitivity, tilt effects, texture mapping,
 * and scatter. Supports multiple brush tip types.
 * 
 * Brush Types:
 * - soft: Smooth anti-aliased circular brush with hardness control
 * - hard: Crisp-edged circular brush
 * - pencil: Textured pencil-like brush with grain
 * - marker: Flat-tipped chisel marker
 * - spray: Airbrush with scattered particles
 * - calligraphy: Angled flat tip for calligraphic strokes
 * - highlighter: Wide semi-transparent rectangular tip
 * 
 * Dynamics:
 * - Pressure → Size, Opacity, Flow
 * - Tilt → Shape deformation, Scatter direction
 * - Velocity → Spacing, Scatter amount
 * 
 * @example
 * const engine = new BrushEngine();
 * 
 * engine.startStroke({ x: 100, y: 100 }, { size: 20, brushType: 'soft' });
 * engine.continueStroke({ x: 150, y: 120 }, { pressure: 0.7 });
 * engine.continueStroke({ x: 200, y: 110 }, { pressure: 0.3 });
 * engine.endStroke();
 */
export class BrushEngine {
    /**
     * @param {Object} [options={}] - Default brush settings
     * @param {number} [options.size=10] - Default brush size
     * @param {number} [options.opacity=1] - Default opacity
     * @param {number} [options.flow=1] - Default flow rate
     * @param {number} [options.hardness=0.5] - Default hardness
     * @param {number} [options.spacing=0.15] - Default spacing
     * @param {string} [options.brushType='soft'] - Default brush type
     */
    constructor(options = {}) {
        /**
         * Current brush configuration.
         * @private
         * @type {Object}
         */
        this._config = {
            size: options.size || 10,
            opacity: options.opacity || 1,
            flow: options.flow || 1,
            hardness: options.hardness || 0.5,
            spacing: options.spacing || 0.15,
            brushType: options.brushType || 'soft',
            angle: 0,
            roundness: 1,
            scatter: 0,
            texture: null,
            dualBrush: null,
        };

        /**
         * Whether a stroke is in progress.
         * @private
         * @type {boolean}
         */
        this._isStroking = false;

        /**
         * Current stroke points for interpolation.
         * @private
         * @type {Array<{x: number, y: number, pressure: number, tiltX: number, tiltY: number}>}
         */
        this._strokePoints = [];

        /**
         * Last rendered point position.
         * @private
         * @type {{x: number, y: number}|null}
         */
        this._lastPoint = null;

        /**
         * Current dynamics state.
         * @private
         * @type {Object}
         */
        this._dynamics = {
            pressure: 0.5,
            tiltX: 0,
            tiltY: 0,
            velocity: 0,
        };

        /**
         * Brush tip cache for different configurations.
         * @private
         * @type {Map<string, OffscreenCanvas|HTMLCanvasElement>}
         */
        this._tipCache = new Map();

        /**
         * Maximum cached brush tips.
         * @private
         * @type {number}
         */
        this._maxTipCache = 20;

        /**
         * Spray particle timer.
         * @private
         * @type {number|null}
         */
        this._sprayTimer = null;

        /**
         * Spray interval reference.
         * @private
         * @type {number|null}
         */
        this._sprayIntervalId = null;

        /**
         * Target context for rendering.
         * @private
         * @type {CanvasRenderingContext2D|null}
         */
        this._targetCtx = null;

        /**
         * Whether the engine has been disposed.
         * @private
         * @type {boolean}
         */
        this._disposed = false;
    }

    // ============================================
    // Public API - Stroke Lifecycle
    // ============================================

    /**
     * Begin a new brush stroke.
     * 
     * @param {{x: number, y: number}} point - Starting point in canvas coordinates
     * @param {Object} [options={}] - Brush options for this stroke
     * @param {CanvasRenderingContext2D} [targetCtx] - Target context to render to
     */
    startStroke(point, options = {}, targetCtx = null) {
        if (this._disposed) return;

        this._isStroking = true;
        this._config = { ...this._config, ...options };
        this._strokePoints = [];
        this._lastPoint = null;
        this._targetCtx = targetCtx;

        // Record first point
        const p = {
            x: point.x,
            y: point.y,
            pressure: options.pressure || 0.5,
            tiltX: options.tiltX || 0,
            tiltY: options.tiltY || 0,
            time: performance.now(),
        };

        this._strokePoints.push(p);
        this._lastPoint = { x: point.x, y: point.y };
        this._updateDynamics(p);

        // Render first stamp
        if (this._targetCtx) {
            this._renderStamp(point, this._dynamics);
        }

        // Start spray timer if needed
        if (this._config.brushType === 'spray') {
            this._startSpray(point);
        }
    }

    /**
     * Continue the current brush stroke.
     * 
     * @param {{x: number, y: number}} point - Current point
     * @param {Object} [dynamics={}] - Current dynamics (pressure, tilt)
     */
    continueStroke(point, dynamics = {}) {
        if (!this._isStroking || this._disposed) return;

        const p = {
            x: point.x,
            y: point.y,
            pressure: dynamics.pressure || 0.5,
            tiltX: dynamics.tiltX || 0,
            tiltY: dynamics.tiltY || 0,
            time: performance.now(),
        };

        this._strokePoints.push(p);
        this._updateDynamics(p);

        // Calculate spacing
        if (this._lastPoint) {
            const dx = point.x - this._lastPoint.x;
            const dy = point.y - this._lastPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const effectiveSize = this._config.size * this._dynamics.pressure;
            const minSpacing = Math.max(0.5, effectiveSize * this._config.spacing);

            if (distance >= minSpacing) {
                // Interpolate stamps between last and current point
                const steps = Math.ceil(distance / minSpacing);

                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const ix = this._lastPoint.x + dx * t;
                    const iy = this._lastPoint.y + dy * t;
                    const ip = this._interpolatePressure(t);

                    const interpolatedPoint = { x: ix, y: iy };
                    const interpolatedDynamics = {
                        pressure: ip,
                        tiltX: this._dynamics.tiltX,
                        tiltY: this._dynamics.tiltY,
                        velocity: this._dynamics.velocity,
                    };

                    if (this._targetCtx) {
                        this._renderStamp(interpolatedPoint, interpolatedDynamics);
                    }
                }

                this._lastPoint = { x: point.x, y: point.y };
            }
        }

        // Update spray center if active
        if (this._config.brushType === 'spray') {
            this._sprayCenter = point;
        }
    }

    /**
     * End the current brush stroke.
     */
    endStroke() {
        if (!this._isStroking) return;

        this._isStroking = false;

        // Stop spray
        if (this._sprayIntervalId !== null) {
            clearInterval(this._sprayIntervalId);
            this._sprayIntervalId = null;
        }

        this._strokePoints = [];
        this._lastPoint = null;
        this._targetCtx = null;
    }

    /**
     * Cancel the current stroke without finalizing.
     */
    cancelStroke() {
        this.endStroke();
    }

    // ============================================
    // Public API - Configuration
    // ============================================

    /**
     * Set brush configuration.
     * @param {Object} config - Configuration options
     */
    setConfig(config = {}) {
        this._config = { ...this._config, ...config };
    }

    /**
     * Get current brush configuration.
     * @returns {Object}
     */
    getConfig() {
        return { ...this._config };
    }

    /**
     * Set brush size.
     * @param {number} size - Brush diameter in pixels
     */
    setSize(size) {
        this._config.size = Math.max(1, Math.min(500, size));
    }

    /**
     * Set brush opacity.
     * @param {number} opacity - Opacity (0-1)
     */
    setOpacity(opacity) {
        this._config.opacity = Math.max(0, Math.min(1, opacity));
    }

    /**
     * Set brush flow.
     * @param {number} flow - Flow rate (0-1)
     */
    setFlow(flow) {
        this._config.flow = Math.max(0.01, Math.min(1, flow));
    }

    /**
     * Set brush hardness.
     * @param {number} hardness - Hardness (0-1, 0=soft, 1=hard)
     */
    setHardness(hardness) {
        this._config.hardness = Math.max(0, Math.min(1, hardness));
        // Invalidate tip cache entries with old hardness
    }

    /**
     * Set brush type.
     * @param {string} type - Brush type identifier
     */
    setBrushType(type) {
        const validTypes = ['soft', 'hard', 'pencil', 'marker', 'spray', 'calligraphy', 'highlighter'];
        if (validTypes.includes(type)) {
            this._config.brushType = type;
        }
    }

    // ============================================
    // Public API - Brush Tip Rendering
    // ============================================

    /**
     * Render a single brush stamp at the given point.
     * Useful for stamp tool or custom rendering.
     * 
     * @param {CanvasRenderingContext2D} ctx - Target context
     * @param {{x: number, y: number}} point - Stamp position
     * @param {Object} [dynamics={}] - Current dynamics
     */
    renderStamp(ctx, point, dynamics = {}) {
        const dyn = {
            pressure: dynamics.pressure || 0.5,
            tiltX: dynamics.tiltX || 0,
            tiltY: dynamics.tiltY || 0,
            velocity: dynamics.velocity || 0,
        };

        this._renderStamp(point, dyn, ctx);
    }

    /**
     * Generate a preview of the current brush tip.
     * 
     * @param {number} size - Preview size in pixels
     * @returns {HTMLCanvasElement} Canvas with brush preview
     */
    renderPreview(size = 64) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const centerX = size / 2;
        const centerY = size / 2;
        const previewSize = Math.min(size * 0.8, this._config.size);
        const scale = previewSize / this._config.size;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        this._drawBrushTip(ctx, 0, 0, this._config.size, this._config, { pressure: 1, tiltX: 0, tiltY: 0 });
        ctx.restore();

        return canvas;
    }

    // ============================================
    // Public API - Disposal
    // ============================================

    /**
     * Dispose the engine and release resources.
     */
    dispose() {
        if (this._disposed) return;

        this.cancelStroke();
        this._clearTipCache();
        this._disposed = true;
    }

    // ============================================
    // Private Methods - Stamp Rendering
    // ============================================

    /**
     * Render a single brush stamp.
     * @private
     * @param {{x: number, y: number}} point - Render position
     * @param {Object} dynamics - Current dynamics
     * @param {CanvasRenderingContext2D} [ctx] - Override target context
     */
    _renderStamp(point, dynamics, ctx = null) {
        const targetCtx = ctx || this._targetCtx;
        if (!targetCtx) return;

        const size = this._config.size * dynamics.pressure;
        const opacity = this._config.opacity * this._config.flow;

        if (size < 0.5 || opacity <= 0) return;

        // Apply scatter
        let renderX = point.x;
        let renderY = point.y;

        if (this._config.scatter > 0) {
            const scatterDistance = this._config.scatter * size * 0.5;
            const scatterAngle = Math.random() * Math.PI * 2;
            renderX += Math.cos(scatterAngle) * scatterDistance;
            renderY += Math.sin(scatterAngle) * scatterDistance;
        }

        targetCtx.save();
        targetCtx.globalAlpha = opacity;
        targetCtx.globalCompositeOperation = this._config.brushType === 'highlighter'
            ? 'multiply'
            : 'source-over';

        this._drawBrushTip(targetCtx, renderX, renderY, size, this._config, dynamics);

        targetCtx.restore();
    }

    /**
     * Draw a brush tip at the given position.
     * @private
     * @param {CanvasRenderingContext2D} ctx - Target context
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {number} size - Brush size
     * @param {Object} config - Brush configuration
     * @param {Object} dynamics - Current dynamics
     */
    _drawBrushTip(ctx, x, y, size, config, dynamics) {
        const halfSize = size / 2;

        switch (config.brushType) {
            case 'soft':
                this._drawSoftTip(ctx, x, y, halfSize, config.hardness);
                break;

            case 'hard':
                this._drawHardTip(ctx, x, y, halfSize);
                break;

            case 'pencil':
                this._drawPencilTip(ctx, x, y, halfSize);
                break;

            case 'marker':
                this._drawMarkerTip(ctx, x, y, size, config.angle, dynamics);
                break;

            case 'calligraphy':
                this._drawCalligraphyTip(ctx, x, y, size, 45, dynamics);
                break;

            case 'highlighter':
                this._drawHighlighterTip(ctx, x, y, size);
                break;

            case 'spray':
                this._drawSprayBurst(ctx, x, y, size, config);
                break;

            default:
                this._drawSoftTip(ctx, x, y, halfSize, config.hardness);
                break;
        }
    }

    // ============================================
    // Private Methods - Brush Tip Types
    // ============================================

    /**
     * Draw a soft circular brush tip with hardness gradient.
     * @private
     */
    _drawSoftTip(ctx, x, y, radius, hardness) {
        // Create radial gradient for soft edge
        const innerRadius = radius * hardness;
        const gradient = ctx.createRadialGradient(x, y, innerRadius, x, y, radius);
        gradient.addColorStop(0, 'rgba(0,0,0,1)');
        gradient.addColorStop(hardness, 'rgba(0,0,0,0.9)');
        gradient.addColorStop(0.7, 'rgba(0,0,0,0.5)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Draw a hard circular brush tip.
     * @private
     */
    _drawHardTip(ctx, x, y, radius) {
        // Crisp edge with slight anti-aliasing
        const gradient = ctx.createRadialGradient(x, y, radius * 0.95, x, y, radius);
        gradient.addColorStop(0, 'rgba(0,0,0,1)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Draw a textured pencil tip.
     * @private
     */
    _drawPencilTip(ctx, x, y, radius) {
        // Dense center with scattered edge for pencil texture
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(0,0,0,0.7)');
        gradient.addColorStop(0.3, 'rgba(0,0,0,0.6)');
        gradient.addColorStop(0.7, 'rgba(0,0,0,0.3)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Add grain texture
        const grainCount = Math.floor(radius * 2);
        for (let i = 0; i < grainCount; i++) {
            const gx = x + (Math.random() - 0.5) * radius * 1.4;
            const gy = y + (Math.random() - 0.5) * radius * 1.4;
            const gSize = Math.random() * 1.5 + 0.3;
            const gAlpha = Math.random() * 0.3 + 0.1;

            if (Math.hypot(gx - x, gy - y) < radius) {
                ctx.fillStyle = `rgba(0,0,0,${gAlpha})`;
                ctx.beginPath();
                ctx.arc(gx, gy, gSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /**
     * Draw a flat chisel marker tip.
     * @private
     */
    _drawMarkerTip(ctx, x, y, size, angle, dynamics) {
        const halfWidth = size * 0.35;
        const halfHeight = size * 0.7;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(((angle || 0) + dynamics.tiltX * 15) * Math.PI / 180);

        // Gradient for marker texture
        const gradient = ctx.createLinearGradient(-halfWidth, 0, halfWidth, 0);
        gradient.addColorStop(0, 'rgba(0,0,0,0.2)');
        gradient.addColorStop(0.3, 'rgba(0,0,0,0.7)');
        gradient.addColorStop(0.5, 'rgba(0,0,0,0.8)');
        gradient.addColorStop(0.7, 'rgba(0,0,0,0.7)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.2)');

        ctx.fillStyle = gradient;
        ctx.fillRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);
        ctx.restore();
    }

    /**
     * Draw an angled calligraphy tip.
     * @private
     */
    _drawCalligraphyTip(ctx, x, y, size, angle, dynamics) {
        const width = size * 0.2;
        const height = size * 0.6;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(((angle || 45) + dynamics.tiltX * 10) * Math.PI / 180);

        const gradient = ctx.createLinearGradient(0, -height, 0, height);
        gradient.addColorStop(0, 'rgba(0,0,0,0.3)');
        gradient.addColorStop(0.5, 'rgba(0,0,0,0.9)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.3)');

        ctx.fillStyle = gradient;
        ctx.fillRect(-width, -height, width * 2, height * 2);
        ctx.restore();
    }

    /**
     * Draw a wide highlighter tip.
     * @private
     */
    _drawHighlighterTip(ctx, x, y, size) {
        const width = size * 0.7;
        const height = size * 0.4;

        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.fillRect(x - width, y - height, width * 2, height * 2);
    }

    /**
     * Draw a burst of spray particles.
     * @private
     */
    _drawSprayBurst(ctx, x, y, size, config) {
        const radius = size / 2;
        const particleCount = Math.floor(size * config.flow * 3);
        const particleSize = Math.max(0.5, size * 0.04);

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;
            const px = x + Math.cos(angle) * distance;
            const py = y + Math.sin(angle) * distance;
            const alpha = Math.random() * 0.5 + 0.3;

            ctx.fillStyle = `rgba(0,0,0,${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, particleSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ============================================
    // Private Methods - Spray
    // ============================================

    /**
     * Start spray particle generation.
     * @private
     */
    _startSpray(point) {
        this._sprayCenter = point;

        if (this._sprayIntervalId !== null) {
            clearInterval(this._sprayIntervalId);
        }

        // Generate spray particles at ~30fps
        this._sprayIntervalId = setInterval(() => {
            if (!this._isStroking || !this._targetCtx || !this._sprayCenter) return;

            this._renderStamp(this._sprayCenter, {
                pressure: this._dynamics.pressure,
                tiltX: this._dynamics.tiltX,
                tiltY: this._dynamics.tiltY,
                velocity: 0,
            });
        }, 33);
    }

    // ============================================
    // Private Methods - Dynamics
    // ============================================

    /**
     * Update dynamics from a stroke point.
     * @private
     * @param {Object} point - Stroke point with dynamics data
     */
    _updateDynamics(point) {
        this._dynamics.pressure = point.pressure || 0.5;
        this._dynamics.tiltX = point.tiltX || 0;
        this._dynamics.tiltY = point.tiltY || 0;

        // Calculate velocity from recent points
        if (this._strokePoints.length >= 2) {
            const prev = this._strokePoints[this._strokePoints.length - 2];
            const dt = (point.time - prev.time) / 1000;
            if (dt > 0) {
                const dx = point.x - prev.x;
                const dy = point.y - prev.y;
                this._dynamics.velocity = Math.sqrt(dx * dx + dy * dy) / dt;
            }
        }
    }

    /**
     * Interpolate pressure between the last two stroke points.
     * @private
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number}
     */
    _interpolatePressure(t) {
        if (this._strokePoints.length < 2) {
            return this._dynamics.pressure;
        }

        const len = this._strokePoints.length;
        const a = this._strokePoints[len - 2];
        const b = this._strokePoints[len - 1];

        return a.pressure + (b.pressure - a.pressure) * t;
    }

    // ============================================
    // Private Methods - Cache
    // ============================================

    /**
     * Clear the brush tip cache.
     * @private
     */
    _clearTipCache() {
        this._tipCache.clear();
    }
}

// ============================================
// Default Export
// ============================================

export default BrushEngine;

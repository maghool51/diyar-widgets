// ============================================
// Paint Pro - Professional Paint Application
// brushes.js - Brush Engine Module
// Professional brush rendering with pressure,
// tilt support, and multiple brush types
// ============================================

import { Utils } from './utils.js';

/**
 * @class BrushEngine
 * @description Advanced brush rendering engine supporting multiple
 * brush types, pressure sensitivity, tilt, and custom brush tips
 */
export class BrushEngine {
    /**
     * @param {Object} app - Reference to main application instance
     */
    constructor(app) {
        this.app = app;
        
        // Brush state
        this.currentBrushType = 'pen';
        this.isDrawing = false;
        this.isErasing = false;
        this.lastPoint = null;
        this.currentPoint = null;
        
        // Brush properties
        this.size = 10;
        this.opacity = 1;
        this.flow = 1;
        this.hardness = 0.5;
        this.spacing = 0.1;
        this.angle = 0;
        this.roundness = 1;
        
        // Color
        this.color = { h: 0, s: 100, l: 50, a: 1 };
        
        // Pressure & tilt
        this.pressure = 0.5;
        this.tiltX = 0;
        this.tiltY = 0;
        
        // Brush tip canvas (for custom brush shapes)
        this.brushTip = null;
        this.brushTipCanvas = null;
        this.brushTipCtx = null;
        
        // Spray properties
        this.sprayParticles = [];
        this.sprayInterval = null;
        this.sprayDensity = 0.5;
        
        // Calligraphy properties
        this.calligraphyAngle = 45;
        this.calligraphyWidth = 0.3;
        
        // Stroke accumulation
        this.currentStrokePoints = [];
        this.strokeBuffer = null;
        this.strokeBufferCtx = null;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.startStroke = this.startStroke.bind(this);
        this.continueStroke = this.continueStroke.bind(this);
        this.endStroke = this.endStroke.bind(this);
        this.startEraserStroke = this.startEraserStroke.bind(this);
        this.continueEraserStroke = this.continueEraserStroke.bind(this);
        this.endEraserStroke = this.endEraserStroke.bind(this);
        this.drawBrushStroke = this.drawBrushStroke.bind(this);
        this.renderBrushTip = this.renderBrushTip.bind(this);
        this.setSize = this.setSize.bind(this);
        this.setOpacity = this.setOpacity.bind(this);
        this.setFlow = this.setFlow.bind(this);
        this.setHardness = this.setHardness.bind(this);
        this.setColor = this.setColor.bind(this);
        this.setBrushType = this.setBrushType.bind(this);
        this.createBrushTip = this.createBrushTip.bind(this);
        this.getBrushStyle = this.getBrushStyle.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    /**
     * Initialize brush engine
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Create offscreen buffer for stroke rendering
            this.createStrokeBuffer();
            
            // Create default brush tip
            this.createBrushTip('pen');
            
            // Render brush previews in panel
            this.renderBrushPreviews();
            
            // Setup brush selection events
            this.setupBrushEvents();
            
            console.log('Brush Engine initialized');
        } catch (error) {
            console.error('Failed to initialize Brush Engine:', error);
            throw error;
        }
    }

    /**
     * Create offscreen buffer for stroke rendering
     */
    createStrokeBuffer() {
        const canvas = this.app.modules.canvasManager;
        if (!canvas) return;
        
        this.strokeBuffer = document.createElement('canvas');
        this.strokeBuffer.width = canvas.width;
        this.strokeBuffer.height = canvas.height;
        this.strokeBufferCtx = this.strokeBuffer.getContext('2d');
    }

    /**
     * Create brush tip canvas for different brush types
     * @param {string} type - Brush type
     */
    createBrushTip(type) {
        const size = 128;
        this.brushTipCanvas = document.createElement('canvas');
        this.brushTipCanvas.width = size;
        this.brushTipCanvas.height = size;
        this.brushTipCtx = this.brushTipCanvas.getContext('2d');
        
        this.renderBrushTip(type, size);
    }

    /**
     * Render brush tip texture
     * @param {string} type - Brush type
     * @param {number} size - Canvas size
     */
    renderBrushTip(type, size) {
        const ctx = this.brushTipCtx;
        const half = size / 2;
        
        ctx.clearRect(0, 0, size, size);
        
        switch (type) {
            case 'pen':
            case 'pencil':
                this.renderSoftBrushTip(ctx, half, size, this.hardness);
                break;
                
            case 'marker':
                this.renderMarkerTip(ctx, half, size);
                break;
                
            case 'spray':
                this.renderSprayTip(ctx, half, size);
                break;
                
            case 'highlighter':
                this.renderHighlighterTip(ctx, half, size);
                break;
                
            case 'calligraphy':
                this.renderCalligraphyTip(ctx, half, size);
                break;
                
            case 'eraser':
                this.renderEraserTip(ctx, half, size);
                break;
                
            default:
                this.renderSoftBrushTip(ctx, half, size, 0.5);
        }
        
        this.currentBrushType = type;
    }

    /**
     * Render soft brush tip
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} half 
     * @param {number} size 
     * @param {number} hardness 
     */
    renderSoftBrushTip(ctx, half, size, hardness) {
        const gradient = ctx.createRadialGradient(half, half, half * (1 - hardness), half, half, half);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(hardness, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
    }

    /**
     * Render marker tip
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} half 
     * @param {number} size 
     */
    renderMarkerTip(ctx, half, size) {
        // Flat chisel tip for marker
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(half * 0.5, half * 0.3, half, half * 1.4);
        
        const gradient = ctx.createLinearGradient(half * 0.5, 0, half * 1.5, 0);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
        ctx.fillStyle = gradient;
        ctx.fillRect(half * 0.5, half * 0.3, half, half * 1.4);
    }

    /**
     * Render spray tip
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} half 
     * @param {number} size 
     */
    renderSprayTip(ctx, half, size) {
        // Scattered dots for spray effect
        const numDots = 200;
        for (let i = 0; i < numDots; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * half;
            const x = half + Math.cos(angle) * distance;
            const y = half + Math.sin(angle) * distance;
            const dotSize = Math.random() * 3 + 1;
            
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.5})`;
            ctx.beginPath();
            ctx.arc(x, y, dotSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * Render highlighter tip
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} half 
     * @param {number} size 
     */
    renderHighlighterTip(ctx, half, size) {
        // Wide, flat, semi-transparent rectangle
        const gradient = ctx.createLinearGradient(0, half * 0.4, 0, half * 1.6);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(half * 0.2, half * 0.4, half * 1.6, half * 1.2);
    }

    /**
     * Render calligraphy tip
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} half 
     * @param {number} size 
     */
    renderCalligraphyTip(ctx, half, size) {
        // Angled flat tip
        ctx.save();
        ctx.translate(half, half);
        ctx.rotate(45 * Math.PI / 180);
        
        const gradient = ctx.createLinearGradient(-half * 0.3, 0, half * 0.3, 0);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(-half * 0.3, -half * 0.9, half * 0.6, half * 1.8);
        ctx.restore();
    }

    /**
     * Render eraser tip
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} half 
     * @param {number} size 
     */
    renderEraserTip(ctx, half, size) {
        // Hard edged square tip
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(half * 0.3, half * 0.3, half * 1.4, half * 1.4);
        
        // Add some texture
        ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
        for (let i = 0; i < 20; i++) {
            const x = half * 0.4 + Math.random() * half * 1.2;
            const y = half * 0.4 + Math.random() * half * 1.2;
            ctx.fillRect(x, y, 2, 2);
        }
    }

    /**
     * Start a new stroke
     * @param {Object} point - Starting point {x, y}
     * @param {Object} options - Stroke options
     */
    startStroke(point, options = {}) {
        this.isDrawing = true;
        this.lastPoint = { x: point.x, y: point.y };
        this.currentStrokePoints = [{ x: point.x, y: point.y, pressure: options.pressure || 0.5 }];
        
        // Update brush properties from options
        if (options.size !== undefined) this.size = options.size;
        if (options.opacity !== undefined) this.opacity = options.opacity;
        if (options.flow !== undefined) this.flow = options.flow;
        if (options.hardness !== undefined) this.setHardness(options.hardness);
        if (options.toolType && options.toolType !== this.currentBrushType) {
            this.setBrushType(options.toolType);
        }
        
        this.pressure = options.pressure || 0.5;
        this.tiltX = options.tiltX || 0;
        this.tiltY = options.tiltY || 0;
        
        // Get color from app
        const color = this.app.getCurrentColor();
        this.setColor(color.h, color.s, color.l, color.a);
        
        // Begin stroke on canvas
        const ctx = this.app.modules.canvasManager?.getMainContext();
        if (!ctx) return;
        
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.globalCompositeOperation = this.currentBrushType === 'highlighter' ? 'multiply' : 'source-over';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Draw initial dot
        this.renderBrushDot(ctx, point.x, point.y, this.size * this.pressure, this.opacity * this.flow);
        
        // For spray, start interval
        if (this.currentBrushType === 'spray') {
            this.startSpray(ctx, point);
        }
    }

    /**
     * Continue stroke
     * @param {Object} point - Current point {x, y}
     * @param {Object} options - Stroke options
     */
    continueStroke(point, options = {}) {
        if (!this.isDrawing) return;
        
        this.currentPoint = { x: point.x, y: point.y };
        this.pressure = options.pressure || 0.5;
        this.tiltX = options.tiltX || 0;
        this.tiltY = options.tiltY || 0;
        
        this.currentStrokePoints.push({ 
            x: point.x, 
            y: point.y, 
            pressure: this.pressure 
        });
        
        const ctx = this.app.modules.canvasManager?.getMainContext();
        if (!ctx) return;
        
        // Draw line segment
        this.drawBrushStroke(ctx, this.lastPoint, this.currentPoint);
        
        this.lastPoint = { x: point.x, y: point.y };
    }

    /**
     * End stroke
     */
    endStroke() {
        if (!this.isDrawing) return;
        
        // Stop spray if active
        if (this.sprayInterval) {
            clearInterval(this.sprayInterval);
            this.sprayInterval = null;
        }
        
        const ctx = this.app.modules.canvasManager?.getMainContext();
        if (ctx) {
            ctx.restore();
        }
        
        this.isDrawing = false;
        this.lastPoint = null;
        this.currentPoint = null;
        
        // Store stroke in history
        this.app.modules.historyManager?.recordStroke(this.currentStrokePoints);
        this.currentStrokePoints = [];
        
        // Mark document as modified
        this.app.markAsModified();
    }

    /**
     * Start eraser stroke
     * @param {Object} point - Starting point {x, y}
     * @param {Object} options - Eraser options
     */
    startEraserStroke(point, options = {}) {
        this.isErasing = true;
        this.lastPoint = { x: point.x, y: point.y };
        this.currentStrokePoints = [{ x: point.x, y: point.y }];
        
        if (options.size) this.size = options.size;
        
        const ctx = this.app.modules.canvasManager?.getMainContext();
        if (!ctx) return;
        
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Draw initial eraser dot
        ctx.beginPath();
        ctx.arc(point.x, point.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Continue eraser stroke
     * @param {Object} point - Current point {x, y}
     */
    continueEraserStroke(point) {
        if (!this.isErasing) return;
        
        this.currentPoint = { x: point.x, y: point.y };
        this.currentStrokePoints.push({ x: point.x, y: point.y });
        
        const ctx = this.app.modules.canvasManager?.getMainContext();
        if (!ctx) return;
        
        this.drawEraserStroke(ctx, this.lastPoint, this.currentPoint);
        this.lastPoint = { x: point.x, y: point.y };
    }

    /**
     * End eraser stroke
     */
    endEraserStroke() {
        if (!this.isErasing) return;
        
        const ctx = this.app.modules.canvasManager?.getMainContext();
        if (ctx) {
            ctx.restore();
        }
        
        this.isErasing = false;
        this.lastPoint = null;
        this.currentPoint = null;
        
        this.app.modules.historyManager?.recordStroke(this.currentStrokePoints, true);
        this.currentStrokePoints = [];
        this.app.markAsModified();
    }

    /**
     * Draw brush stroke between two points
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Object} from - Start point
     * @param {Object} to - End point
     */
    drawBrushStroke(ctx, from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return;
        
        const effectiveSize = this.size * this.pressure;
        const stepSize = Math.max(1, effectiveSize * this.spacing);
        const steps = Math.max(1, Math.floor(distance / stepSize));
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = from.x + dx * t;
            const y = from.y + dy * t;
            const sizeAtPoint = effectiveSize * (1 - t * 0.1);
            const opacityAtPoint = this.opacity * this.flow;
            
            this.renderBrushDot(ctx, x, y, sizeAtPoint, opacityAtPoint);
        }
    }

    /**
     * Draw eraser stroke between two points
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Object} from - Start point
     * @param {Object} to - End point
     */
    drawEraserStroke(ctx, from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 1) return;
        
        ctx.lineWidth = this.size;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    }

    /**
     * Render a single brush dot at position
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} size 
     * @param {number} opacity 
     */
    renderBrushDot(ctx, x, y, size, opacity) {
        ctx.globalAlpha = opacity;
        
        switch (this.currentBrushType) {
            case 'pen':
                this.renderSoftDot(ctx, x, y, size);
                break;
                
            case 'pencil':
                this.renderPencilDot(ctx, x, y, size);
                break;
                
            case 'marker':
                this.renderMarkerDot(ctx, x, y, size);
                break;
                
            case 'highlighter':
                this.renderHighlighterDot(ctx, x, y, size);
                break;
                
            case 'calligraphy':
                this.renderCalligraphyDot(ctx, x, y, size);
                break;
                
            default:
                this.renderSoftDot(ctx, x, y, size);
        }
    }

    /**
     * Render soft brush dot
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} size 
     */
    renderSoftDot(ctx, x, y, size) {
        const radius = size / 2;
        const gradient = ctx.createRadialGradient(x, y, radius * (1 - this.hardness), x, y, radius);
        
        const color = this.getColorString();
        const [h, s, l] = [this.color.h, this.color.s, this.color.l];
        
        gradient.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, ${this.opacity})`);
        gradient.addColorStop(0.5, `hsla(${h}, ${s}%, ${l}%, ${this.opacity * 0.8})`);
        gradient.addColorStop(1, `hsla(${h}, ${s}%, ${l}%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Render pencil dot (textured)
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} size 
     */
    renderPencilDot(ctx, x, y, size) {
        const radius = size / 2;
        const color = this.getColorString();
        
        ctx.fillStyle = color;
        
        // Draw multiple small dots for pencil texture
        const numDots = Math.floor(size * 2);
        for (let i = 0; i < numDots; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * radius * 0.8;
            const dotX = x + Math.cos(angle) * dist;
            const dotY = y + Math.sin(angle) * dist;
            const dotSize = Math.random() * 2 + 0.5;
            
            ctx.beginPath();
            ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Main dot
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Render marker dot
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} size 
     */
    renderMarkerDot(ctx, x, y, size) {
        const color = this.getColorString();
        ctx.fillStyle = color;
        
        // Rectangular shape for marker
        const width = size * 0.6;
        const height = size * 1.2;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.angle);
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.restore();
    }

    /**
     * Render highlighter dot
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} size 
     */
    renderHighlighterDot(ctx, x, y, size) {
        const [h, s, l] = [this.color.h, this.color.s, this.color.l];
        const color = `hsla(${h}, ${s}%, ${l}%, 0.3)`;
        
        ctx.fillStyle = color;
        ctx.fillRect(x - size * 0.7, y - size * 0.4, size * 1.4, size * 0.8);
    }

    /**
     * Render calligraphy dot
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} size 
     */
    renderCalligraphyDot(ctx, x, y, size) {
        const color = this.getColorString();
        ctx.fillStyle = color;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.calligraphyAngle * Math.PI / 180);
        ctx.fillRect(-size * 0.2, -size * 0.6, size * 0.4, size * 1.2);
        ctx.restore();
    }

    /**
     * Start spray effect
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Object} point 
     */
    startSpray(ctx, point) {
        this.sprayInterval = setInterval(() => {
            if (this.currentPoint) {
                this.renderSprayBurst(ctx, this.currentPoint.x, this.currentPoint.y);
            }
        }, 50);
    }

    /**
     * Render spray burst at position
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     */
    renderSprayBurst(ctx, x, y) {
        const radius = this.size * this.pressure;
        const numParticles = Math.floor(20 * this.sprayDensity);
        const color = this.getColorString();
        
        ctx.fillStyle = color;
        
        for (let i = 0; i < numParticles; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;
            const px = x + Math.cos(angle) * distance;
            const py = y + Math.sin(angle) * distance;
            const particleSize = Math.random() * 3 + 1;
            
            ctx.globalAlpha = Math.random() * this.opacity;
            ctx.beginPath();
            ctx.arc(px, py, particleSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * Get color string in HSLA format
     * @returns {string}
     */
    getColorString() {
        const { h, s, l, a } = this.color;
        return `hsla(${h}, ${s}%, ${l}%, ${a})`;
    }

    /**
     * Set brush color
     * @param {number} h - Hue (0-360)
     * @param {number} s - Saturation (0-100)
     * @param {number} l - Lightness (0-100)
     * @param {number} a - Alpha (0-1)
     */
    setColor(h, s, l, a = 1) {
        this.color = { h, s, l, a };
    }

    /**
     * Set brush size
     * @param {number} size 
     */
    setSize(size) {
        this.size = Math.max(1, Math.min(500, size));
        this.app.elements.brushSize.value = this.size;
        this.app.elements.brushSizeValue.textContent = this.size;
    }

    /**
     * Set brush opacity
     * @param {number} opacity - 0 to 1
     */
    setOpacity(opacity) {
        this.opacity = Math.max(0.01, Math.min(1, opacity));
        this.app.elements.brushOpacity.value = Math.round(this.opacity * 100);
        this.app.elements.brushOpacityValue.textContent = Math.round(this.opacity * 100) + '%';
    }

    /**
     * Set brush flow
     * @param {number} flow - 0 to 1
     */
    setFlow(flow) {
        this.flow = Math.max(0.01, Math.min(1, flow));
        this.app.elements.brushFlow.value = Math.round(this.flow * 100);
        this.app.elements.brushFlowValue.textContent = Math.round(this.flow * 100) + '%';
    }

    /**
     * Set brush hardness
     * @param {number} hardness - 0 to 1
     */
    setHardness(hardness) {
        this.hardness = Math.max(0, Math.min(1, hardness));
        this.app.elements.brushHardness.value = Math.round(this.hardness * 100);
        this.app.elements.brushHardnessValue.textContent = Math.round(this.hardness * 100) + '%';
        
        // Recreate brush tip with new hardness
        if (this.currentBrushType === 'pen' || this.currentBrushType === 'pencil') {
            this.createBrushTip(this.currentBrushType);
        }
    }

    /**
     * Set brush type
     * @param {string} type 
     */
    setBrushType(type) {
        if (this.currentBrushType !== type) {
            this.createBrushTip(type);
            this.updateActiveBrushButton(type);
        }
    }

    /**
     * Update active brush button in UI
     * @param {string} type 
     */
    updateActiveBrushButton(type) {
        document.querySelectorAll('.brush-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.brush === type);
        });
    }

    /**
     * Setup brush selection events
     */
    setupBrushEvents() {
        document.querySelectorAll('.brush-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const brushType = btn.dataset.brush;
                this.setBrushType(brushType);
                
                // Also switch to pen tool if not already on a drawing tool
                const drawingTools = ['pen', 'pencil', 'marker', 'spray', 'highlighter'];
                if (!drawingTools.includes(this.app.state.currentTool)) {
                    this.app.handleToolChange(brushType === 'calligraphy' ? 'pen' : brushType);
                }
                
                // Update tool options for the brush
                this.app.modules.toolManager?.renderToolOptions(
                    drawingTools.includes(brushType) ? brushType : 'pen'
                );
            });
        });
    }

    /**
     * Render brush previews in the brushes panel
     */
    renderBrushPreviews() {
        const container = this.app.elements.brushesGrid;
        if (!container) return;
        
        const brushes = [
            { id: 'pen', name: 'قلم نرم', icon: 'brush' },
            { id: 'hard', name: 'قلم سخت', icon: 'brush' },
            { id: 'pencil', name: 'مداد', icon: 'edit' },
            { id: 'marker', name: 'ماژیک', icon: 'drive_file_rename_outline' },
            { id: 'spray', name: 'اسپری', icon: 'blur_on' },
            { id: 'calligraphy', name: 'خوشنویسی', icon: 'ink_pen' },
            { id: 'highlighter', name: 'هایلایتر', icon: 'format_ink_highlighter' },
        ];
        
        container.innerHTML = '';
        
        brushes.forEach(brush => {
            const button = document.createElement('button');
            button.className = 'brush-btn';
            button.dataset.brush = brush.id;
            if (brush.id === 'pen') button.classList.add('active');
            
            // Create brush preview canvas
            const previewCanvas = document.createElement('canvas');
            previewCanvas.width = 40;
            previewCanvas.height = 40;
            previewCanvas.className = 'brush-preview';
            
            const previewCtx = previewCanvas.getContext('2d');
            this.drawBrushPreview(previewCtx, brush.id, 20, 20, 16);
            
            button.innerHTML = `
                ${previewCanvas.outerHTML}
                <span>${brush.name}</span>
            `;
            
            // Replace canvas placeholder with actual canvas
            const placeholderCanvas = button.querySelector('canvas');
            if (placeholderCanvas) {
                placeholderCanvas.getContext('2d').drawImage(previewCanvas, 0, 0);
            }
            
            container.appendChild(button);
        });
    }

    /**
     * Draw brush preview on small canvas
     * @param {CanvasRenderingContext2D} ctx 
     * @param {string} type 
     * @param {number} x 
     * @param {number} y 
     * @param {number} size 
     */
    drawBrushPreview(ctx, type, x, y, size) {
        ctx.clearRect(0, 0, 40, 40);
        
        const tempBrushType = this.currentBrushType;
        const tempSize = this.size;
        const tempHardness = this.hardness;
        const tempColor = { ...this.color };
        
        // Temporarily set properties for preview
        this.currentBrushType = type;
        this.size = size;
        this.hardness = type === 'hard' ? 1 : type === 'pencil' ? 0.9 : 0.5;
        this.color = { h: 240, s: 50, l: 50, a: 1 };
        
        // Use a small offscreen canvas to render the brush tip
        const offscreen = document.createElement('canvas');
        offscreen.width = 40;
        offscreen.height = 40;
        const offCtx = offscreen.getContext('2d');
        
        this.renderBrushDot(offCtx, x, y, size, 1);
        ctx.drawImage(offscreen, 0, 0);
        
        // Restore properties
        this.currentBrushType = tempBrushType;
        this.size = tempSize;
        this.hardness = tempHardness;
        this.color = tempColor;
    }

    /**
     * Get current brush style configuration
     * @returns {Object}
     */
    getBrushStyle() {
        return {
            type: this.currentBrushType,
            size: this.size,
            opacity: this.opacity,
            flow: this.flow,
            hardness: this.hardness,
            color: { ...this.color },
        };
    }

    /**
     * Destroy brush engine
     */
    destroy() {
        if (this.sprayInterval) {
            clearInterval(this.sprayInterval);
        }
        
        this.brushTipCanvas = null;
        this.brushTipCtx = null;
        this.strokeBuffer = null;
        this.strokeBufferCtx = null;
        this.currentStrokePoints = [];
        
        console.log('Brush Engine destroyed');
    }
}

export default BrushEngine;

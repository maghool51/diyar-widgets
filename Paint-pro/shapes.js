// ============================================
// Paint Pro - Professional Paint Application
// shapes.js - Shape Renderer Module
// Renders all vector shapes: lines, rectangles,
// circles, ellipses, triangles, polygons, arrows, curves
// ============================================

import { Utils } from './utils.js';

/**
 * @class ShapeRenderer
 * @description Handles rendering of all vector shapes
 * with support for stroke, fill, dashed lines, and rounded corners
 */
export class ShapeRenderer {
    /**
     * @param {Object} app - Reference to main application instance
     */
    constructor(app) {
        this.app = app;
        
        // Shape defaults
        this.defaultOptions = {
            strokeColor: '#000000',
            fillColor: null,
            lineWidth: 2,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
            dashPattern: [],
            rounded: 0,
            sides: 6,
            arrowSize: 10,
        };
        
        // Bind methods
        this.init = this.init.bind(this);
        this.drawShape = this.drawShape.bind(this);
        this.drawShapePreview = this.drawShapePreview.bind(this);
        this.drawLine = this.drawLine.bind(this);
        this.drawArrow = this.drawArrow.bind(this);
        this.drawRectangle = this.drawRectangle.bind(this);
        this.drawSquare = this.drawSquare.bind(this);
        this.drawCircle = this.drawCircle.bind(this);
        this.drawEllipse = this.drawEllipse.bind(this);
        this.drawTriangle = this.drawTriangle.bind(this);
        this.drawPolygon = this.drawPolygon.bind(this);
        this.drawBezierCurve = this.drawBezierCurve.bind(this);
        this.drawRoundedRect = this.drawRoundedRect.bind(this);
        this.renderShapePreview = this.renderShapePreview.bind(this);
        this.applyStyle = this.applyStyle.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    /**
     * Initialize shape renderer
     * @returns {Promise<void>}
     */
    async init() {
        try {
            console.log('Shape Renderer initialized');
        } catch (error) {
            console.error('Failed to initialize Shape Renderer:', error);
            throw error;
        }
    }

    /**
     * Draw a shape on canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} type - Shape type
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {Object} options - Shape options
     */
    drawShape(ctx, type, x1, y1, x2, y2, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        
        ctx.save();
        this.applyStyle(ctx, opts);
        
        switch (type) {
            case 'line':
                this.drawLine(ctx, x1, y1, x2, y2, opts);
                break;
                
            case 'arrow':
                this.drawArrow(ctx, x1, y1, x2, y2, opts);
                break;
                
            case 'rectangle':
                this.drawRectangle(ctx, x1, y1, x2, y2, opts);
                break;
                
            case 'square':
                this.drawSquare(ctx, x1, y1, x2, y2, opts);
                break;
                
            case 'circle':
                this.drawCircle(ctx, x1, y1, x2, y2, opts);
                break;
                
            case 'ellipse':
                this.drawEllipse(ctx, x1, y1, x2, y2, opts);
                break;
                
            case 'triangle':
                this.drawTriangle(ctx, x1, y1, x2, y2, opts);
                break;
                
            case 'polygon':
                this.drawPolygon(ctx, x1, y1, x2, y2, opts);
                break;
                
            default:
                console.warn('Unknown shape type:', type);
        }
        
        ctx.restore();
    }

    /**
     * Draw shape preview (lighter, dashed)
     * @param {CanvasRenderingContext2D} ctx 
     * @param {string} type 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @param {Object} options 
     */
    drawShapePreview(ctx, type, x1, y1, x2, y2, options = {}) {
        const previewOpts = {
            ...options,
            dashPattern: [5, 5],
            opacity: Math.min(options.opacity || 1, 0.6),
        };
        
        this.drawShape(ctx, type, x1, y1, x2, y2, previewOpts);
    }

    /**
     * Apply stroke and fill styles to context
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Object} opts 
     */
    applyStyle(ctx, opts) {
        ctx.globalAlpha = opts.opacity || 1;
        ctx.lineWidth = opts.lineWidth || 2;
        ctx.lineCap = opts.lineCap || 'round';
        ctx.lineJoin = opts.lineJoin || 'round';
        
        if (opts.dashPattern && opts.dashPattern.length > 0) {
            ctx.setLineDash(opts.dashPattern);
        } else {
            ctx.setLineDash([]);
        }
        
        if (opts.strokeColor) {
            ctx.strokeStyle = opts.strokeColor;
        }
        
        if (opts.fillColor) {
            ctx.fillStyle = opts.fillColor;
        }
    }

    /**
     * Draw a straight line
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @param {Object} opts 
     */
    drawLine(ctx, x1, y1, x2, y2, opts) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    /**
     * Draw an arrow (line with arrowhead)
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @param {Object} opts 
     */
    drawArrow(ctx, x1, y1, x2, y2, opts) {
        const arrowSize = opts.arrowSize || 10;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        
        // Draw line
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        
        // Draw arrowhead
        const arrowAngle = Math.PI / 6; // 30 degrees
        
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
            x2 - arrowSize * Math.cos(angle - arrowAngle),
            y2 - arrowSize * Math.sin(angle - arrowAngle)
        );
        ctx.lineTo(
            x2 - arrowSize * Math.cos(angle + arrowAngle),
            y2 - arrowSize * Math.sin(angle + arrowAngle)
        );
        ctx.closePath();
        
        if (opts.fillColor) {
            ctx.fill();
        } else {
            ctx.fillStyle = opts.strokeColor || '#000000';
            ctx.fill();
        }
        ctx.stroke();
    }

    /**
     * Draw a rectangle
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @param {Object} opts 
     */
    drawRectangle(ctx, x1, y1, x2, y2, opts) {
        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        
        if (opts.rounded && opts.rounded > 0) {
            this.drawRoundedRect(ctx, x, y, width, height, opts.rounded, opts);
        } else {
            ctx.beginPath();
            ctx.rect(x, y, width, height);
            
            if (opts.fillColor) {
                ctx.fill();
            }
            ctx.stroke();
        }
    }

    /**
     * Draw a square (constrained rectangle)
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @param {Object} opts 
     */
    drawSquare(ctx, x1, y1, x2, y2, opts) {
        const size = Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1));
        const x = x2 > x1 ? x1 : x1 - size;
        const y = y2 > y1 ? y1 : y1 - size;
        
        ctx.beginPath();
        ctx.rect(x, y, size, size);
        
        if (opts.fillColor) {
            ctx.fill();
        }
        ctx.stroke();
    }

    /**
     * Draw a circle
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @param {Object} opts 
     */
    drawCircle(ctx, x1, y1, x2, y2, opts) {
        const radius = Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2;
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        
        if (opts.fillColor) {
            ctx.fill();
        }
        ctx.stroke();
    }

    /**
     * Draw an ellipse
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @param {Object} opts 
     */
    drawEllipse(ctx, x1, y1, x2, y2, opts) {
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        const radiusX = Math.abs(x2 - x1) / 2;
        const radiusY = Math.abs(y2 - y1) / 2;
        
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        
        if (opts.fillColor) {
            ctx.fill();
        }
        ctx.stroke();
    }

    /**
     * Draw a triangle
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @param {Object} opts 
     */
    drawTriangle(ctx, x1, y1, x2, y2, opts) {
        const midX = (x1 + x2) / 2;
        
        ctx.beginPath();
        ctx.moveTo(midX, y1); // Top point
        ctx.lineTo(x2, y2);   // Bottom right
        ctx.lineTo(x1, y2);   // Bottom left
        ctx.closePath();
        
        if (opts.fillColor) {
            ctx.fill();
        }
        ctx.stroke();
    }

    /**
     * Draw a regular polygon
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @param {Object} opts 
     */
    drawPolygon(ctx, x1, y1, x2, y2, opts) {
        const sides = opts.sides || 6;
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        const radius = Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2;
        
        ctx.beginPath();
        
        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.closePath();
        
        if (opts.fillColor) {
            ctx.fill();
        }
        ctx.stroke();
    }

    /**
     * Draw a rounded rectangle
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     * @param {number} radius 
     * @param {Object} opts 
     */
    drawRoundedRect(ctx, x, y, width, height, radius, opts) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        
        if (opts.fillColor) {
            ctx.fill();
        }
        ctx.stroke();
    }

    /**
     * Draw a Bezier curve
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Object} p0 - Start point {x, y}
     * @param {Object} p1 - Control point 1 {x, y}
     * @param {Object} p2 - Control point 2 {x, y}
     * @param {Object} p3 - End point {x, y}
     * @param {Object} opts - Drawing options
     */
    drawBezierCurve(ctx, p0, p1, p2, p3, opts = {}) {
        const options = { ...this.defaultOptions, ...opts };
        
        ctx.save();
        this.applyStyle(ctx, options);
        
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        ctx.stroke();
        
        // Optionally draw control points
        if (options.showControlPoints) {
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            
            // Draw control lines
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.moveTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.stroke();
            
            // Draw control points
            [p1, p2].forEach(point => {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        }
        
        ctx.restore();
    }

    /**
     * Draw a star shape
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} centerX 
     * @param {number} centerY 
     * @param {number} outerRadius 
     * @param {number} innerRadius 
     * @param {number} points 
     * @param {Object} opts 
     */
    drawStar(ctx, centerX, centerY, outerRadius, innerRadius, points, opts = {}) {
        const options = { ...this.defaultOptions, ...opts };
        
        ctx.save();
        this.applyStyle(ctx, options);
        
        ctx.beginPath();
        
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI / points) - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.closePath();
        
        if (options.fillColor) {
            ctx.fill();
        }
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Draw a heart shape
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} size 
     * @param {Object} opts 
     */
    drawHeart(ctx, x, y, size, opts = {}) {
        const options = { ...this.defaultOptions, ...opts };
        
        ctx.save();
        this.applyStyle(ctx, options);
        
        const s = size / 2;
        
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.4);
        ctx.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.4);
        ctx.bezierCurveTo(x - s, y + s * 1.2, x, y + s * 1.6, x, y + s * 2);
        ctx.bezierCurveTo(x, y + s * 1.6, x + s, y + s * 1.2, x + s, y + s * 0.4);
        ctx.bezierCurveTo(x + s, y, x, y, x, y + s * 0.4);
        ctx.closePath();
        
        if (options.fillColor) {
            ctx.fill();
        }
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Draw a lightning bolt
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @param {Object} opts 
     */
    drawLightning(ctx, x1, y1, x2, y2, opts = {}) {
        const options = { ...this.defaultOptions, ...opts };
        
        ctx.save();
        this.applyStyle(ctx, options);
        
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(midX, midY - (y2 - y1) * 0.1);
        ctx.lineTo(x1 + (x2 - x1) * 0.4, midY);
        ctx.lineTo(midX, midY + (y2 - y1) * 0.1);
        ctx.lineTo(x2, y2);
        
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Draw a speech bubble
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     * @param {Object} opts 
     */
    drawSpeechBubble(ctx, x, y, width, height, opts = {}) {
        const options = { ...this.defaultOptions, ...opts, rounded: 10 };
        
        ctx.save();
        this.applyStyle(ctx, options);
        
        const tailHeight = height * 0.2;
        const tailWidth = width * 0.15;
        
        ctx.beginPath();
        
        // Rounded rectangle body
        this.drawRoundedRectPath(ctx, x, y, width, height - tailHeight, options.rounded || 10);
        
        // Tail
        ctx.moveTo(x + width * 0.2, y + height - tailHeight);
        ctx.lineTo(x + width * 0.3, y + height);
        ctx.lineTo(x + width * 0.4, y + height - tailHeight);
        
        ctx.closePath();
        
        if (options.fillColor) {
            ctx.fill();
        }
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Create rounded rectangle path (helper for custom shapes)
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     * @param {number} radius 
     */
    drawRoundedRectPath(ctx, x, y, width, height, radius) {
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
    }

    /**
     * Draw grid lines
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} width 
     * @param {number} height 
     * @param {number} gridSize 
     * @param {Object} opts 
     */
    drawGrid(ctx, width, height, gridSize, opts = {}) {
        const options = {
            strokeColor: 'rgba(128, 128, 128, 0.3)',
            lineWidth: 0.5,
            ...opts,
        };
        
        ctx.save();
        this.applyStyle(ctx, options);
        
        // Vertical lines
        for (let x = 0; x <= width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Major grid lines
        ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)';
        ctx.lineWidth = 1;
        
        for (let x = 0; x <= width; x += gridSize * 5) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        for (let y = 0; y <= height; y += gridSize * 5) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    /**
     * Draw crosshair at position
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} size 
     * @param {Object} opts 
     */
    drawCrosshair(ctx, x, y, size = 10, opts = {}) {
        const options = {
            strokeColor: 'rgba(0, 0, 0, 0.5)',
            lineWidth: 1,
            ...opts,
        };
        
        ctx.save();
        this.applyStyle(ctx, options);
        
        ctx.setLineDash([]);
        
        ctx.beginPath();
        ctx.moveTo(x - size, y);
        ctx.lineTo(x + size, y);
        ctx.moveTo(x, y - size);
        ctx.lineTo(x, y + size);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(x, y, size / 3, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }

    /**
     * Draw dashed selection rectangle
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     * @param {Object} opts 
     */
    drawSelectionRect(ctx, x, y, width, height, opts = {}) {
        const options = {
            strokeColor: '#000000',
            lineWidth: 1,
            dashPattern: [5, 3],
            fillColor: 'rgba(0, 120, 215, 0.1)',
            ...opts,
        };
        
        ctx.save();
        this.applyStyle(ctx, options);
        
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        
        if (options.fillColor) {
            ctx.fill();
        }
        ctx.stroke();
        
        ctx.restore();
    }

    /**
     * Render shape preview while drawing
     * @param {CanvasRenderingContext2D} ctx 
     * @param {string} type 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @param {Object} opts 
     */
    renderShapePreview(ctx, type, x1, y1, x2, y2, opts = {}) {
        this.drawShapePreview(ctx, type, x1, y1, x2, y2, opts);
    }

    /**
     * Get shape bounding box
     * @param {string} type 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @returns {Object} Bounding box {x, y, width, height}
     */
    getShapeBounds(type, x1, y1, x2, y2) {
        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        
        return { x, y, width, height };
    }

    /**
     * Check if point is inside shape
     * @param {string} type 
     * @param {number} px 
     * @param {number} py 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @returns {boolean}
     */
    isPointInShape(type, px, py, x1, y1, x2, y2) {
        const bounds = this.getShapeBounds(type, x1, y1, x2, y2);
        
        // Add some padding for thin lines
        const padding = 5;
        const expandedBounds = {
            x: bounds.x - padding,
            y: bounds.y - padding,
            width: bounds.width + padding * 2,
            height: bounds.height + padding * 2,
        };
        
        return px >= expandedBounds.x && 
               px <= expandedBounds.x + expandedBounds.width &&
               py >= expandedBounds.y && 
               py <= expandedBounds.y + expandedBounds.height;
    }

    /**
     * Destroy shape renderer
     */
    destroy() {
        console.log('Shape Renderer destroyed');
    }
}

export default ShapeRenderer;

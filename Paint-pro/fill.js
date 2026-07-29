// ============================================
// Paint Pro - Professional Paint Application
// fill.js - Fill Engine Module
// Flood fill, pattern fill, gradient fill
// with tolerance and anti-aliasing support
// ============================================

import { Utils } from './utils.js';

/**
 * @class FillEngine
 * @description Advanced fill engine supporting flood fill,
 * pattern fill, gradient fill with configurable tolerance
 * and optimization for large areas
 */
export class FillEngine {
    /**
     * @param {Object} app - Reference to main application instance
     */
    constructor(app) {
        this.app = app;
        
        // Fill settings
        this.tolerance = 0;
        this.antiAlias = true;
        this.contiguous = true;
        this.opacity = 1;
        
        // Performance
        this.maxFillPixels = 10000000; // 10 million pixels max
        this.useQueue = true;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.floodFill = this.floodFill.bind(this);
        this.scanlineFill = this.scanlineFill.bind(this);
        this.queueFill = this.queueFill.bind(this);
        this.fillGradient = this.fillGradient.bind(this);
        this.fillPattern = this.fillPattern.bind(this);
        this.replaceColor = this.replaceColor.bind(this);
        this.colorMatch = this.colorMatch.bind(this);
        this.getPixelColor = this.getPixelColor.bind(this);
        this.setPixelColor = this.setPixelColor.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    /**
     * Initialize fill engine
     * @returns {Promise<void>}
     */
    async init() {
        try {
            console.log('Fill Engine initialized');
        } catch (error) {
            console.error('Failed to initialize Fill Engine:', error);
            throw error;
        }
    }

    /**
     * Main flood fill entry point
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} startX - Starting X coordinate
     * @param {number} startY - Starting Y coordinate
     * @param {Object} fillColor - Fill color {h, s, l, a}
     */
    floodFill(ctx, startX, startY, fillColor) {
        const canvas = ctx.canvas;
        const width = canvas.width;
        const height = canvas.height;
        
        // Validate coordinates
        startX = Math.floor(startX);
        startY = Math.floor(startY);
        
        if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
            return;
        }
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Get target color (color at click point)
        const targetColor = this.getPixelColor(data, width, startX, startY);
        
        // Convert fill color to RGBA
        const fillRGBA = Utils.hslToRgb(fillColor.h, fillColor.s, fillColor.l);
        const fillR = fillRGBA.r;
        const fillG = fillRGBA.g;
        const fillB = fillRGBA.b;
        const fillA = Math.round((fillColor.a || 1) * 255 * this.opacity);
        
        // Check if target color is same as fill color
        if (this.colorMatch(targetColor, { r: fillR, g: fillG, b: fillB, a: fillA }, 0)) {
            return;
        }
        
        // Use scanline fill for better performance
        this.scanlineFill(data, width, height, startX, startY, targetColor, fillR, fillG, fillB, fillA);
        
        // Put image data back
        ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Optimized scanline flood fill algorithm
     * @param {Uint8ClampedArray} data - Image data
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {number} startX - Start X
     * @param {number} startY - Start Y
     * @param {Object} targetColor - Target color to replace
     * @param {number} fillR - Fill red
     * @param {number} fillG - Fill green
     * @param {number} fillB - Fill blue
     * @param {number} fillA - Fill alpha
     */
    scanlineFill(data, width, height, startX, startY, targetColor, fillR, fillG, fillB, fillA) {
        const stack = [];
        let filledPixels = 0;
        
        stack.push(startX, startY);
        
        while (stack.length > 0 && filledPixels < this.maxFillPixels) {
            const y = stack.pop();
            const x = stack.pop();
            
            let x1 = x;
            
            // Go left as far as possible
            while (x1 >= 0 && this.colorMatch(this.getPixelColor(data, width, x1, y), targetColor, this.tolerance)) {
                x1--;
            }
            x1++;
            
            let spanAbove = false;
            let spanBelow = false;
            
            // Go right as far as possible
            while (x1 < width && this.colorMatch(this.getPixelColor(data, width, x1, y), targetColor, this.tolerance)) {
                this.setPixelColor(data, width, x1, y, fillR, fillG, fillB, fillA);
                filledPixels++;
                
                // Check pixel above
                if (y > 0) {
                    const aboveMatch = this.colorMatch(this.getPixelColor(data, width, x1, y - 1), targetColor, this.tolerance);
                    if (!spanAbove && aboveMatch) {
                        stack.push(x1, y - 1);
                        spanAbove = true;
                    } else if (spanAbove && !aboveMatch) {
                        spanAbove = false;
                    }
                }
                
                // Check pixel below
                if (y < height - 1) {
                    const belowMatch = this.colorMatch(this.getPixelColor(data, width, x1, y + 1), targetColor, this.tolerance);
                    if (!spanBelow && belowMatch) {
                        stack.push(x1, y + 1);
                        spanBelow = true;
                    } else if (spanBelow && !belowMatch) {
                        spanBelow = false;
                    }
                }
                
                x1++;
            }
        }
        
        if (filledPixels >= this.maxFillPixels) {
            console.warn('Fill limit reached:', filledPixels, 'pixels');
        }
    }

    /**
     * Queue-based flood fill (alternative algorithm)
     * @param {Uint8ClampedArray} data - Image data
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {number} startX - Start X
     * @param {number} startY - Start Y
     * @param {Object} targetColor - Target color
     * @param {number} fillR - Fill red
     * @param {number} fillG - Fill green
     * @param {number} fillB - Fill blue
     * @param {number} fillA - Fill alpha
     */
    queueFill(data, width, height, startX, startY, targetColor, fillR, fillG, fillB, fillA) {
        const queue = [];
        let queueStart = 0;
        let filledPixels = 0;
        
        // Visited array for better performance
        const visited = new Uint8Array(width * height);
        
        const index = startY * width + startX;
        queue.push(startX, startY);
        visited[index] = 1;
        
        while (queueStart < queue.length && filledPixels < this.maxFillPixels) {
            const x = queue[queueStart++];
            const y = queue[queueStart++];
            
            this.setPixelColor(data, width, x, y, fillR, fillG, fillB, fillA);
            filledPixels++;
            
            // Check 4-connected neighbors
            const neighbors = [
                [x + 1, y], [x - 1, y],
                [x, y + 1], [x, y - 1],
            ];
            
            for (const [nx, ny] of neighbors) {
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIndex = ny * width + nx;
                    if (!visited[nIndex] && 
                        this.colorMatch(this.getPixelColor(data, width, nx, ny), targetColor, this.tolerance)) {
                        visited[nIndex] = 1;
                        queue.push(nx, ny);
                    }
                }
            }
        }
    }

    /**
     * Fill area with gradient
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @param {string} type - 'linear' or 'radial'
     * @param {Array} colorStops - Array of {offset, color} objects
     */
    fillGradient(ctx, x1, y1, x2, y2, type = 'linear', colorStops = []) {
        let gradient;
        
        if (type === 'radial') {
            const centerX = (x1 + x2) / 2;
            const centerY = (y1 + y2) / 2;
            const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) / 2;
            gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        } else {
            gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        }
        
        // Add color stops
        if (colorStops.length === 0) {
            // Default gradient
            const currentColor = this.app.getCurrentColor();
            gradient.addColorStop(0, `hsla(${currentColor.h}, ${currentColor.s}%, ${currentColor.l}%, ${currentColor.a})`);
            gradient.addColorStop(1, `hsla(${currentColor.h}, ${currentColor.s}%, ${Math.min(100, currentColor.l + 30)}%, ${currentColor.a * 0.5})`);
        } else {
            colorStops.forEach(stop => {
                gradient.addColorStop(stop.offset, stop.color);
            });
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    }

    /**
     * Fill area with pattern
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     * @param {string} patternType - Pattern type identifier
     */
    fillPattern(ctx, x, y, width, height, patternType = 'dots') {
        const patternCanvas = document.createElement('canvas');
        const patternSize = 20;
        patternCanvas.width = patternSize;
        patternCanvas.height = patternSize;
        const patternCtx = patternCanvas.getContext('2d');
        
        // Fill background
        patternCtx.fillStyle = '#FFFFFF';
        patternCtx.fillRect(0, 0, patternSize, patternSize);
        
        const currentColor = this.app.getCurrentColor();
        const colorStr = `hsla(${currentColor.h}, ${currentColor.s}%, ${currentColor.l}%, ${currentColor.a})`;
        
        patternCtx.fillStyle = colorStr;
        patternCtx.strokeStyle = colorStr;
        
        switch (patternType) {
            case 'dots':
                this.drawDotPattern(patternCtx, patternSize);
                break;
                
            case 'lines':
                this.drawLinePattern(patternCtx, patternSize);
                break;
                
            case 'crosshatch':
                this.drawCrosshatchPattern(patternCtx, patternSize);
                break;
                
            case 'grid':
                this.drawGridPattern(patternCtx, patternSize);
                break;
                
            case 'diagonal':
                this.drawDiagonalPattern(patternCtx, patternSize);
                break;
                
            default:
                this.drawDotPattern(patternCtx, patternSize);
        }
        
        const pattern = ctx.createPattern(patternCanvas, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(x, y, width, height);
    }

    /**
     * Draw dot pattern
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} size 
     */
    drawDotPattern(ctx, size) {
        const spacing = size / 4;
        for (let x = spacing; x < size; x += spacing) {
            for (let y = spacing; y < size; y += spacing) {
                ctx.beginPath();
                ctx.arc(x, y, size / 10, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /**
     * Draw line pattern
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} size 
     */
    drawLinePattern(ctx, size) {
        ctx.lineWidth = 1;
        for (let y = 0; y < size; y += size / 3) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
        }
    }

    /**
     * Draw crosshatch pattern
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} size 
     */
    drawCrosshatchPattern(ctx, size) {
        ctx.lineWidth = 0.5;
        // Horizontal lines
        for (let y = 0; y < size; y += size / 4) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
        }
        // Vertical lines
        for (let x = 0; x < size; x += size / 4) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, size);
            ctx.stroke();
        }
    }

    /**
     * Draw grid pattern
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} size 
     */
    drawGridPattern(ctx, size) {
        ctx.lineWidth = 1;
        ctx.strokeRect(1, 1, size - 2, size - 2);
        ctx.beginPath();
        ctx.moveTo(size / 2, 0);
        ctx.lineTo(size / 2, size);
        ctx.moveTo(0, size / 2);
        ctx.lineTo(size, size / 2);
        ctx.stroke();
    }

    /**
     * Draw diagonal pattern
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} size 
     */
    drawDiagonalPattern(ctx, size) {
        ctx.lineWidth = 1;
        for (let i = -size; i < size * 2; i += size / 3) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + size, size);
            ctx.stroke();
        }
    }

    /**
     * Replace all pixels of one color with another
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Object} targetColor - Color to replace {r, g, b, a}
     * @param {Object} replacementColor - New color {r, g, b, a}
     * @param {number} tolerance - Color matching tolerance
     */
    replaceColor(ctx, targetColor, replacementColor, tolerance = 0) {
        const canvas = ctx.canvas;
        const width = canvas.width;
        const height = canvas.height;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            if (this.colorMatch({ r, g, b, a }, targetColor, tolerance)) {
                data[i] = replacementColor.r;
                data[i + 1] = replacementColor.g;
                data[i + 2] = replacementColor.b;
                data[i + 3] = replacementColor.a !== undefined ? replacementColor.a : a;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Check if two colors match within tolerance
     * @param {Object} color1 - First color {r, g, b, a}
     * @param {Object} color2 - Second color {r, g, b, a}
     * @param {number} tolerance - Matching tolerance (0-255)
     * @returns {boolean}
     */
    colorMatch(color1, color2, tolerance = 0) {
        if (!color1 || !color2) return false;
        
        const dr = Math.abs(color1.r - color2.r);
        const dg = Math.abs(color1.g - color2.g);
        const db = Math.abs(color1.b - color2.b);
        const da = Math.abs((color1.a || 255) - (color2.a || 255));
        
        if (tolerance === 0) {
            return dr === 0 && dg === 0 && db === 0 && da === 0;
        }
        
        return dr <= tolerance && dg <= tolerance && db <= tolerance && da <= tolerance;
    }

    /**
     * Get pixel color at coordinates
     * @param {Uint8ClampedArray} data - Image data array
     * @param {number} width - Image width
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Object} Color object {r, g, b, a}
     */
    getPixelColor(data, width, x, y) {
        const index = (y * width + x) * 4;
        return {
            r: data[index],
            g: data[index + 1],
            b: data[index + 2],
            a: data[index + 3],
        };
    }

    /**
     * Set pixel color at coordinates
     * @param {Uint8ClampedArray} data - Image data array
     * @param {number} width - Image width
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} r - Red
     * @param {number} g - Green
     * @param {number} b - Blue
     * @param {number} a - Alpha
     */
    setPixelColor(data, width, x, y, r, g, b, a) {
        const index = (y * width + x) * 4;
        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        
        if (this.antiAlias) {
            // Blend with existing alpha
            const existingAlpha = data[index + 3] / 255;
            const newAlpha = a / 255;
            const blendedAlpha = newAlpha + existingAlpha * (1 - newAlpha);
            data[index + 3] = Math.round(blendedAlpha * 255);
        } else {
            data[index + 3] = a;
        }
    }

    /**
     * Fill entire layer with solid color
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Object} color - Fill color {h, s, l, a}
     */
    fillLayer(ctx, color) {
        const canvas = ctx.canvas;
        ctx.save();
        ctx.fillStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, ${color.a || 1})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    /**
     * Fill with checkerboard pattern (transparency indicator)
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     * @param {number} squareSize 
     */
    fillCheckerboard(ctx, x, y, width, height, squareSize = 8) {
        ctx.save();
        
        for (let row = 0; row < Math.ceil(height / squareSize); row++) {
            for (let col = 0; col < Math.ceil(width / squareSize); col++) {
                const isWhite = (row + col) % 2 === 0;
                ctx.fillStyle = isWhite ? '#FFFFFF' : '#CCCCCC';
                ctx.fillRect(
                    x + col * squareSize,
                    y + row * squareSize,
                    Math.min(squareSize, width - col * squareSize),
                    Math.min(squareSize, height - row * squareSize)
                );
            }
        }
        
        ctx.restore();
    }

    /**
     * Set fill tolerance
     * @param {number} tolerance - 0 to 255
     */
    setTolerance(tolerance) {
        this.tolerance = Math.max(0, Math.min(255, Math.round(tolerance)));
    }

    /**
     * Set fill opacity
     * @param {number} opacity - 0 to 1
     */
    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, opacity));
    }

    /**
     * Set anti-aliasing
     * @param {boolean} enabled 
     */
    setAntiAlias(enabled) {
        this.antiAlias = enabled;
    }

    /**
     * Set contiguous mode (fill only connected pixels)
     * @param {boolean} contiguous 
     */
    setContiguous(contiguous) {
        this.contiguous = contiguous;
    }

    /**
     * Get current fill settings
     * @returns {Object}
     */
    getSettings() {
        return {
            tolerance: this.tolerance,
            antiAlias: this.antiAlias,
            contiguous: this.contiguous,
            opacity: this.opacity,
        };
    }

    /**
     * Destroy fill engine
     */
    destroy() {
        console.log('Fill Engine destroyed');
    }
}

export default FillEngine;

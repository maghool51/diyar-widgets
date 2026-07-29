// ============================================
// Paint Pro - Professional Paint Application
// utils.js - Utility Functions Module
// Common helper functions used across modules
// Color conversions, math helpers, UUID, etc.
// ============================================

/**
 * @class Utils
 * @description Static utility functions for color conversion,
 * math operations, string manipulation, UUID generation,
 * and other common tasks used throughout the application
 */
export class Utils {
    /**
     * Initialize utility module
     */
    static init() {
        // Pre-calculate common values
        Utils._uuidCounter = 0;
        Utils._lastUUIDTime = Date.now();
        
        console.log('Utilities initialized');
    }

    /**
     * Generate a unique identifier (UUID v4)
     * @returns {string} UUID string
     */
    static generateUUID() {
        const timestamp = Date.now();
        
        // Increment counter, reset if time changes
        if (timestamp === Utils._lastUUIDTime) {
            Utils._uuidCounter++;
        } else {
            Utils._uuidCounter = 0;
            Utils._lastUUIDTime = timestamp;
        }
        
        const timeHex = timestamp.toString(16).padStart(12, '0');
        const counterHex = Utils._uuidCounter.toString(16).padStart(4, '0');
        const randomHex = Math.random().toString(16).substring(2, 14);
        
        return `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-4${counterHex.slice(0, 3)}-${randomHex.slice(0, 4)}-${randomHex.slice(4, 16)}`;
    }

    /**
     * Convert HSL color values to RGB
     * @param {number} h - Hue (0-360)
     * @param {number} s - Saturation (0-100)
     * @param {number} l - Lightness (0-100)
     * @returns {Object} RGB object {r, g, b}
     */
    static hslToRgb(h, s, l) {
        h = h % 360;
        if (h < 0) h += 360;
        s = Math.max(0, Math.min(100, s)) / 100;
        l = Math.max(0, Math.min(100, l)) / 100;
        
        if (s === 0) {
            const value = Math.round(l * 255);
            return { r: value, g: value, b: value };
        }
        
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hNormalized = h / 360;
        
        return {
            r: Math.round(hue2rgb(p, q, hNormalized + 1/3) * 255),
            g: Math.round(hue2rgb(p, q, hNormalized) * 255),
            b: Math.round(hue2rgb(p, q, hNormalized - 1/3) * 255),
        };
    }

    /**
     * Convert RGB color values to HSL
     * @param {number} r - Red (0-255)
     * @param {number} g - Green (0-255)
     * @param {number} b - Blue (0-255)
     * @returns {Array} HSL array [h, s, l]
     */
    static rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;
        
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;
        
        if (diff !== 0) {
            s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
            
            switch (max) {
                case r:
                    h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
                    break;
                case g:
                    h = ((b - r) / diff + 2) / 6;
                    break;
                case b:
                    h = ((r - g) / diff + 4) / 6;
                    break;
            }
        }
        
        return [
            Math.round(h * 360),
            Math.round(s * 100),
            Math.round(l * 100),
        ];
    }

    /**
     * Convert RGB values to hex string
     * @param {number} r - Red (0-255)
     * @param {number} g - Green (0-255)
     * @param {number} b - Blue (0-255)
     * @returns {string} Hex color string (e.g., "#FF0000")
     */
    static rgbToHex(r, g, b) {
        const toHex = (value) => {
            const hex = Math.max(0, Math.min(255, Math.round(value))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    }

    /**
     * Convert HSL values to hex string
     * @param {number} h - Hue (0-360)
     * @param {number} s - Saturation (0-100)
     * @param {number} l - Lightness (0-100)
     * @returns {string} Hex color string
     */
    static hslToHex(h, s, l) {
        const { r, g, b } = Utils.hslToRgb(h, s, l);
        return Utils.rgbToHex(r, g, b);
    }

    /**
     * Parse a color string into components
     * Supports hex, rgb, rgba, hsl, hsla formats
     * @param {string} colorStr - Color string
     * @returns {Object|null} Color object {r, g, b, a} or null
     */
    static parseColor(colorStr) {
        if (!colorStr || typeof colorStr !== 'string') return null;
        
        const str = colorStr.trim().toLowerCase();
        
        // Hex format
        if (str.startsWith('#')) {
            return Utils.parseHexColor(str);
        }
        
        // RGB/RGBA format
        const rgbMatch = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
        if (rgbMatch) {
            return {
                r: parseInt(rgbMatch[1]),
                g: parseInt(rgbMatch[2]),
                b: parseInt(rgbMatch[3]),
                a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1,
            };
        }
        
        // HSL/HSLA format
        const hslMatch = str.match(/hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*([\d.]+)\s*)?\)/);
        if (hslMatch) {
            const rgb = Utils.hslToRgb(
                parseInt(hslMatch[1]),
                parseInt(hslMatch[2]),
                parseInt(hslMatch[3])
            );
            return {
                ...rgb,
                a: hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : 1,
            };
        }
        
        // Named colors
        return Utils.parseNamedColor(str);
    }

    /**
     * Parse hex color string
     * @param {string} hex - Hex color string
     * @returns {Object|null} Color object {r, g, b, a} or null
     */
    static parseHexColor(hex) {
        hex = hex.replace('#', '');
        
        let r, g, b, a = 1;
        
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 4) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
            a = parseInt(hex[3] + hex[3], 16) / 255;
        } else if (hex.length === 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else if (hex.length === 8) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
            a = parseInt(hex.substring(6, 8), 16) / 255;
        } else {
            return null;
        }
        
        if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
        
        return { r, g, b, a };
    }

    /**
     * Parse named CSS color
     * @param {string} name - Color name
     * @returns {Object|null} Color object or null
     */
    static parseNamedColor(name) {
        const namedColors = {
            'black': { r: 0, g: 0, b: 0, a: 1 },
            'white': { r: 255, g: 255, b: 255, a: 1 },
            'red': { r: 255, g: 0, b: 0, a: 1 },
            'green': { r: 0, g: 128, b: 0, a: 1 },
            'blue': { r: 0, g: 0, b: 255, a: 1 },
            'yellow': { r: 255, g: 255, b: 0, a: 1 },
            'cyan': { r: 0, g: 255, b: 255, a: 1 },
            'magenta': { r: 255, g: 0, b: 255, a: 1 },
            'gray': { r: 128, g: 128, b: 128, a: 1 },
            'grey': { r: 128, g: 128, b: 128, a: 1 },
            'transparent': { r: 0, g: 0, b: 0, a: 0 },
            'orange': { r: 255, g: 165, b: 0, a: 1 },
            'purple': { r: 128, g: 0, b: 128, a: 1 },
            'pink': { r: 255, g: 192, b: 203, a: 1 },
            'brown': { r: 165, g: 42, b: 42, a: 1 },
        };
        
        return namedColors[name] || null;
    }

    /**
     * Parse color from CSS style value
     * @param {string} style - CSS color style string
     * @returns {Object|null} Color object or null
     */
    static parseColorFromStyle(style) {
        if (!style) return null;
        
        // Handle "rgba(r, g, b, a)" and "rgb(r, g, b)" formats
        return Utils.parseColor(style);
    }

    /**
     * Create a deep clone of an object
     * @param {*} obj - Object to clone
     * @returns {*} Cloned object
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => Utils.deepClone(item));
        if (obj instanceof Map) {
            const clonedMap = new Map();
            obj.forEach((value, key) => clonedMap.set(key, Utils.deepClone(value)));
            return clonedMap;
        }
        if (obj instanceof Set) {
            const clonedSet = new Set();
            obj.forEach(value => clonedSet.add(Utils.deepClone(value)));
            return clonedSet;
        }
        if (obj instanceof Uint8ClampedArray) return new Uint8ClampedArray(obj);
        if (obj instanceof ImageData) {
            return new ImageData(
                new Uint8ClampedArray(obj.data),
                obj.width,
                obj.height
            );
        }
        
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = Utils.deepClone(obj[key]);
            }
        }
        
        return clonedObj;
    }

    /**
     * Linear interpolation between two values
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number}
     */
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }

    /**
     * Clamp a value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number}
     */
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Map a value from one range to another
     * @param {number} value - Input value
     * @param {number} inMin - Input range minimum
     * @param {number} inMax - Input range maximum
     * @param {number} outMin - Output range minimum
     * @param {number} outMax - Output range maximum
     * @returns {number}
     */
    static mapRange(value, inMin, inMax, outMin, outMax) {
        return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
    }

    /**
     * Convert degrees to radians
     * @param {number} degrees 
     * @returns {number}
     */
    static degToRad(degrees) {
        return degrees * Math.PI / 180;
    }

    /**
     * Convert radians to degrees
     * @param {number} radians 
     * @returns {number}
     */
    static radToDeg(radians) {
        return radians * 180 / Math.PI;
    }

    /**
     * Calculate distance between two points
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @returns {number}
     */
    static distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate angle between two points
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @returns {number} Angle in radians
     */
    static angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    }

    /**
     * Format file size for display
     * @param {number} bytes 
     * @returns {string}
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
    }

    /**
     * Format a timestamp for display
     * @param {number} timestamp 
     * @returns {string}
     */
    static formatDate(timestamp) {
        const date = new Date(timestamp);
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        };
        
        return date.toLocaleDateString('fa-IR', options);
    }

    /**
     * Debounce a function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function}
     */
    static debounce(func, wait = 100) {
        let timeout;
        
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle a function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Throttle interval in milliseconds
     * @returns {Function}
     */
    static throttle(func, limit = 100) {
        let inThrottle;
        let lastFunc;
        let lastRan;
        
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                lastRan = Date.now();
                inThrottle = true;
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(() => {
                    if (Date.now() - lastRan >= limit) {
                        func(...args);
                        lastRan = Date.now();
                    }
                }, limit - (Date.now() - lastRan));
            }
        };
    }

    /**
     * Generate a random integer between min and max (inclusive)
     * @param {number} min 
     * @param {number} max 
     * @returns {number}
     */
    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Generate a random float between min and max
     * @param {number} min 
     * @param {number} max 
     * @returns {number}
     */
    static randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }

    /**
     * Check if a value is within a range
     * @param {number} value 
     * @param {number} min 
     * @param {number} max 
     * @returns {boolean}
     */
    static inRange(value, min, max) {
        return value >= min && value <= max;
    }

    /**
     * Smooth step interpolation
     * @param {number} edge0 
     * @param {number} edge1 
     * @param {number} x 
     * @returns {number}
     */
    static smoothStep(edge0, edge1, x) {
        const t = Utils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
        return t * t * (3 - 2 * t);
    }

    /**
     * Get bounding box of multiple points
     * @param {Array} points - Array of {x, y} objects
     * @returns {Object} Bounding box {x, y, width, height}
     */
    static getBoundingBox(points) {
        if (!points || points.length === 0) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        points.forEach(point => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        });
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    /**
     * Check if two rectangles intersect
     * @param {Object} rect1 - {x, y, width, height}
     * @param {Object} rect2 - {x, y, width, height}
     * @returns {boolean}
     */
    static rectsIntersect(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    /**
     * Convert canvas to blob
     * @param {HTMLCanvasElement} canvas 
     * @param {string} [type='image/png'] 
     * @param {number} [quality=1] 
     * @returns {Promise<Blob>}
     */
    static canvasToBlob(canvas, type = 'image/png', quality = 1) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                },
                type,
                quality
            );
        });
    }

    /**
     * Load image from URL
     * @param {string} url 
     * @returns {Promise<HTMLImageElement>}
     */
    static loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = url;
        });
    }

    /**
     * Create an offscreen canvas with content
     * @param {number} width 
     * @param {number} height 
     * @param {Function} drawFn - Drawing function(ctx)
     * @returns {HTMLCanvasElement}
     */
    static createOffscreenCanvas(width, height, drawFn = null) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        if (drawFn) {
            const ctx = canvas.getContext('2d');
            drawFn(ctx);
        }
        
        return canvas;
    }

    /**
     * Memoize a function (cache results)
     * @param {Function} fn 
     * @returns {Function}
     */
    static memoize(fn) {
        const cache = new Map();
        
        return function memoized(...args) {
            const key = JSON.stringify(args);
            
            if (cache.has(key)) {
                return cache.get(key);
            }
            
            const result = fn.apply(this, args);
            cache.set(key, result);
            
            return result;
        };
    }

    /**
     * Escape HTML string
     * @param {string} str 
     * @returns {string}
     */
    static escapeHtml(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    /**
     * Check if device is mobile
     * @returns {boolean}
     */
    static isMobileDevice() {
        return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Check if device supports touch
     * @returns {boolean}
     */
    static isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    /**
     * Get device pixel ratio
     * @returns {number}
     */
    static getDevicePixelRatio() {
        return Math.min(window.devicePixelRatio || 1, 2);
    }
}

export default Utils;

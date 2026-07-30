// ============================================
// Paint Pro - Professional Web Graphics Application
// src/domain/canvas/CoordinateSystem.js
// Multi-Space Coordinate Transformation System
// ============================================

/**
 * @module domain/canvas/CoordinateSystem
 * @description Complete coordinate transformation system for converting
 * between screen space, canvas space, and layer space. Handles zoom, pan,
 * rotation, and DPI scaling with pixel-perfect precision.
 * 
 * Coordinate Spaces:
 * 
 * 1. Screen Space (CSS Pixels)
 *    - Origin: Top-left of the browser viewport
 *    - Unit: CSS pixels (device-independent pixels)
 *    - Used for: Mouse/touch events, DOM element positions
 * 
 * 2. Canvas Space (Document Pixels)
 *    - Origin: Top-left of the document canvas
 *    - Unit: Document pixels (at 100% zoom, 1 canvas pixel = 1 screen pixel)
 *    - Used for: Drawing operations, layer coordinates
 * 
 * 3. Layer Space (Layer Pixels)
 *    - Origin: Top-left of a specific layer
 *    - Unit: Layer pixels (respects layer offset, rotation, scale)
 *    - Used for: Layer-specific operations
 * 
 * Transformation Chain:
 * Screen ←→ Canvas ←→ Layer
 * 
 * All transformations account for:
 * - Device Pixel Ratio (Retina/HiDPI)
 * - Zoom level (0.1x to 32x)
 * - Pan offset (X and Y)
 * - Canvas rotation (future)
 * - Layer transforms (future)
 */

// ============================================
// Point & Rect Value Objects
// ============================================

/**
 * @class Point
 * @description Immutable 2D point with utility methods.
 */
export class Point {
    /**
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    constructor(x = 0, y = 0) {
        /**
         * X coordinate.
         * @type {number}
         */
        this.x = x;

        /**
         * Y coordinate.
         * @type {number}
         */
        this.y = y;

        Object.freeze(this);
    }

    /**
     * Create a new point with offset.
     * @param {number} dx - X offset
     * @param {number} dy - Y offset
     * @returns {Point}
     */
    translate(dx, dy) {
        return new Point(this.x + dx, this.y + dy);
    }

    /**
     * Create a new point scaled by a factor.
     * @param {number} sx - X scale
     * @param {number} [sy] - Y scale (defaults to sx)
     * @returns {Point}
     */
    scale(sx, sy = sx) {
        return new Point(this.x * sx, this.y * sy);
    }

    /**
     * Calculate distance to another point.
     * @param {Point} other - Other point
     * @returns {number}
     */
    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate angle to another point (radians).
     * @param {Point} other - Other point
     * @returns {number}
     */
    angleTo(other) {
        return Math.atan2(other.y - this.y, other.x - this.x);
    }

    /**
     * Round coordinates to nearest integer.
     * @returns {Point}
     */
    round() {
        return new Point(Math.round(this.x), Math.round(this.y));
    }

    /**
     * Floor coordinates.
     * @returns {Point}
     */
    floor() {
        return new Point(Math.floor(this.x), Math.floor(this.y));
    }

    /**
     * Ceil coordinates.
     * @returns {Point}
     */
    ceil() {
        return new Point(Math.ceil(this.x), Math.ceil(this.y));
    }

    /**
     * Check if point is equal to another within tolerance.
     * @param {Point} other - Other point
     * @param {number} [epsilon=0.001] - Tolerance
     * @returns {boolean}
     */
    equals(other, epsilon = 0.001) {
        return Math.abs(this.x - other.x) < epsilon &&
               Math.abs(this.y - other.y) < epsilon;
    }

    /**
     * Create a copy.
     * @returns {Point}
     */
    clone() {
        return new Point(this.x, this.y);
    }

    /**
     * Serialize to plain object.
     * @returns {{x: number, y: number}}
     */
    toJSON() {
        return { x: this.x, y: this.y };
    }

    /**
     * Create from plain object.
     * @param {{x: number, y: number}} json
     * @returns {Point}
     */
    static fromJSON(json) {
        return new Point(json?.x ?? 0, json?.y ?? 0);
    }

    /**
     * Zero point (0, 0).
     * @returns {Point}
     */
    static get ZERO() {
        return new Point(0, 0);
    }

    /** @returns {string} */
    toString() {
        return `Point(${this.x}, ${this.y})`;
    }
}

/**
 * @class Rect
 * @description Immutable 2D rectangle with utility methods.
 */
export class Rect {
    /**
     * @param {number} x - Left edge
     * @param {number} y - Top edge
     * @param {number} width - Width (must be >= 0)
     * @param {number} height - Height (must be >= 0)
     */
    constructor(x = 0, y = 0, width = 0, height = 0) {
        /**
         * Left edge X coordinate.
         * @type {number}
         */
        this.x = x;

        /**
         * Top edge Y coordinate.
         * @type {number}
         */
        this.y = y;

        /**
         * Rectangle width.
         * @type {number}
         */
        this.width = Math.max(0, width);

        /**
         * Rectangle height.
         * @type {number}
         */
        this.height = Math.max(0, height);

        Object.freeze(this);
    }

    /** @returns {number} Right edge X */
    get right() { return this.x + this.width; }

    /** @returns {number} Bottom edge Y */
    get bottom() { return this.y + this.height; }

    /** @returns {Point} Center point */
    get center() {
        return new Point(this.x + this.width / 2, this.y + this.height / 2);
    }

    /** @returns {Point} Top-left point */
    get topLeft() { return new Point(this.x, this.y); }

    /** @returns {Point} Top-right point */
    get topRight() { return new Point(this.right, this.y); }

    /** @returns {Point} Bottom-left point */
    get bottomLeft() { return new Point(this.x, this.bottom); }

    /** @returns {Point} Bottom-right point */
    get bottomRight() { return new Point(this.right, this.bottom); }

    /** @returns {boolean} Whether the rectangle is empty */
    get isEmpty() { return this.width === 0 || this.height === 0; }

    /** @returns {number} Area of the rectangle */
    get area() { return this.width * this.height; }

    /**
     * Check if this rectangle contains a point.
     * @param {Point|{x: number, y: number}} point - Point to check
     * @returns {boolean}
     */
    containsPoint(point) {
        return point.x >= this.x && point.x <= this.right &&
               point.y >= this.y && point.y <= this.bottom;
    }

    /**
     * Check if this rectangle contains another rectangle entirely.
     * @param {Rect} other - Other rectangle
     * @returns {boolean}
     */
    containsRect(other) {
        return other.x >= this.x && other.right <= this.right &&
               other.y >= this.y && other.bottom <= this.bottom;
    }

    /**
     * Check if this rectangle intersects another.
     * @param {Rect} other - Other rectangle
     * @returns {boolean}
     */
    intersects(other) {
        return this.x < other.right && this.right > other.x &&
               this.y < other.bottom && this.bottom > other.y;
    }

    /**
     * Get the intersection of two rectangles.
     * @param {Rect} other - Other rectangle
     * @returns {Rect|null} Intersection rectangle or null
     */
    intersection(other) {
        if (!this.intersects(other)) return null;

        const x = Math.max(this.x, other.x);
        const y = Math.max(this.y, other.y);
        const right = Math.min(this.right, other.right);
        const bottom = Math.min(this.bottom, other.bottom);

        return new Rect(x, y, right - x, bottom - y);
    }

    /**
     * Get the union of two rectangles.
     * @param {Rect} other - Other rectangle
     * @returns {Rect}
     */
    union(other) {
        if (this.isEmpty) return other;
        if (other.isEmpty) return this;

        const x = Math.min(this.x, other.x);
        const y = Math.min(this.y, other.y);
        const right = Math.max(this.right, other.right);
        const bottom = Math.max(this.bottom, other.bottom);

        return new Rect(x, y, right - x, bottom - y);
    }

    /**
     * Expand the rectangle by padding.
     * @param {number} padding - Padding amount
     * @returns {Rect}
     */
    expand(padding) {
        return new Rect(
            this.x - padding,
            this.y - padding,
            this.width + padding * 2,
            this.height + padding * 2
        );
    }

    /**
     * Inset the rectangle.
     * @param {number} dx - Horizontal inset
     * @param {number} dy - Vertical inset
     * @returns {Rect}
     */
    inset(dx, dy = dx) {
        return new Rect(
            this.x + dx,
            this.y + dy,
            Math.max(0, this.width - dx * 2),
            Math.max(0, this.height - dy * 2)
        );
    }

    /**
     * Scale the rectangle from its center.
     * @param {number} sx - Horizontal scale
     * @param {number} [sy] - Vertical scale (defaults to sx)
     * @returns {Rect}
     */
    scale(sx, sy = sx) {
        const center = this.center;
        const newWidth = this.width * sx;
        const newHeight = this.height * sy;
        return new Rect(
            center.x - newWidth / 2,
            center.y - newHeight / 2,
            newWidth,
            newHeight
        );
    }

    /**
     * Create a copy.
     * @returns {Rect}
     */
    clone() {
        return new Rect(this.x, this.y, this.width, this.height);
    }

    /**
     * Serialize to plain object.
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    toJSON() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    /**
     * Create from plain object.
     * @param {{x: number, y: number, width: number, height: number}} json
     * @returns {Rect}
     */
    static fromJSON(json) {
        return new Rect(json?.x ?? 0, json?.y ?? 0, json?.width ?? 0, json?.height ?? 0);
    }

    /**
     * Create from two points.
     * @param {Point} p1 - First corner
     * @param {Point} p2 - Opposite corner
     * @returns {Rect}
     */
    static fromPoints(p1, p2) {
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const width = Math.abs(p2.x - p1.x);
        const height = Math.abs(p2.y - p1.y);
        return new Rect(x, y, width, height);
    }

    /**
     * Create from center and size.
     * @param {Point} center - Center point
     * @param {number} width - Width
     * @param {number} height - Height
     * @returns {Rect}
     */
    static fromCenter(center, width, height) {
        return new Rect(center.x - width / 2, center.y - height / 2, width, height);
    }

    /** @returns {string} */
    toString() {
        return `Rect(${this.x}, ${this.y}, ${this.width}×${this.height})`;
    }
}

// ============================================
// Transform Matrix
// ============================================

/**
 * @class Transform
 * @description 2D affine transformation matrix for coordinate conversions.
 * Represents zoom, pan, and rotation as a single matrix.
 * 
 * Matrix form (column-major for Canvas API compatibility):
 * | a  c  e |   | scaleX  skewX   translateX |
 * | b  d  f | = | skewY   scaleY  translateY |
 * | 0  0  1 |   | 0       0       1          |
 */
export class Transform {
    /**
     * @param {number} [a=1] - Scale X
     * @param {number} [b=0] - Skew Y
     * @param {number} [c=0] - Skew X
     * @param {number} [d=1] - Scale Y
     * @param {number} [e=0] - Translate X
     * @param {number} [f=0] - Translate Y
     */
    constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
        /** @type {number} */ this.a = a; // Scale X
        /** @type {number} */ this.b = b; // Skew Y
        /** @type {number} */ this.c = c; // Skew X
        /** @type {number} */ this.d = d; // Scale Y
        /** @type {number} */ this.e = e; // Translate X
        /** @type {number} */ this.f = f; // Translate Y

        Object.freeze(this);
    }

    /**
     * Create identity transform.
     * @returns {Transform}
     */
    static identity() {
        return new Transform(1, 0, 0, 1, 0, 0);
    }

    /**
     * Create translation transform.
     * @param {number} tx - Translate X
     * @param {number} ty - Translate Y
     * @returns {Transform}
     */
    static translate(tx, ty) {
        return new Transform(1, 0, 0, 1, tx, ty);
    }

    /**
     * Create scale transform.
     * @param {number} sx - Scale X
     * @param {number} [sy] - Scale Y (defaults to sx)
     * @returns {Transform}
     */
    static scale(sx, sy = sx) {
        return new Transform(sx, 0, 0, sy, 0, 0);
    }

    /**
     * Create rotation transform.
     * @param {number} radians - Rotation angle in radians
     * @returns {Transform}
     */
    static rotate(radians) {
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        return new Transform(cos, sin, -sin, cos, 0, 0);
    }

    /**
     * Compose with another transform (this * other).
     * @param {Transform} other - Transform to compose with
     * @returns {Transform}
     */
    compose(other) {
        return new Transform(
            this.a * other.a + this.c * other.b,
            this.b * other.a + this.d * other.b,
            this.a * other.c + this.c * other.d,
            this.b * other.c + this.d * other.d,
            this.a * other.e + this.c * other.f + this.e,
            this.b * other.e + this.d * other.f + this.f
        );
    }

    /**
     * Get the inverse transform.
     * @returns {Transform}
     * @throws {Error} If the transform is not invertible
     */
    inverse() {
        const det = this.a * this.d - this.b * this.c;

        if (Math.abs(det) < 1e-10) {
            throw new Error('Transform is not invertible (determinant is zero)');
        }

        const invDet = 1 / det;

        return new Transform(
            this.d * invDet,
            -this.b * invDet,
            -this.c * invDet,
            this.a * invDet,
            (this.c * this.f - this.d * this.e) * invDet,
            (this.b * this.e - this.a * this.f) * invDet
        );
    }

    /**
     * Transform a point.
     * @param {Point|{x: number, y: number}} point - Point to transform
     * @returns {Point}
     */
    transformPoint(point) {
        return new Point(
            this.a * point.x + this.c * point.y + this.e,
            this.b * point.x + this.d * point.y + this.f
        );
    }

    /**
     * Transform a distance/vector (no translation).
     * @param {number} dx - X distance
     * @param {number} dy - Y distance
     * @returns {{dx: number, dy: number}}
     */
    transformDistance(dx, dy) {
        return {
            dx: this.a * dx + this.c * dy,
            dy: this.b * dx + this.d * dy,
        };
    }

    /**
     * Apply this transform to a Canvas context.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    applyToContext(ctx) {
        ctx.transform(this.a, this.b, this.c, this.d, this.e, this.f);
    }

    /**
     * Set this transform on a Canvas context (replaces existing).
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    setOnContext(ctx) {
        ctx.setTransform(this.a, this.b, this.c, this.d, this.e, this.f);
    }

    /**
     * Get CSS transform string.
     * @returns {string}
     */
    toCSS() {
        return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
    }

    /**
     * Check if this is an identity transform.
     * @returns {boolean}
     */
    isIdentity() {
        return this.a === 1 && this.b === 0 && this.c === 0 &&
               this.d === 1 && this.e === 0 && this.f === 0;
    }

    /**
     * Serialize to plain object.
     * @returns {{a: number, b: number, c: number, d: number, e: number, f: number}}
     */
    toJSON() {
        return { a: this.a, b: this.b, c: this.c, d: this.d, e: this.e, f: this.f };
    }

    /**
     * Create from plain object.
     * @param {Object} json
     * @returns {Transform}
     */
    static fromJSON(json = {}) {
        return new Transform(
            json.a ?? 1, json.b ?? 0, json.c ?? 0,
            json.d ?? 1, json.e ?? 0, json.f ?? 0
        );
    }

    /** @returns {string} */
    toString() {
        return `Transform(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
    }
}

// ============================================
// Coordinate System
// ============================================

/**
 * @class CoordinateSystem
 * @description Manages coordinate transformations between screen, canvas,
 * and layer spaces. Handles zoom, pan, DPI scaling, and container offset.
 * 
 * This is the single source of truth for all spatial transformations.
 * Every pointer event and rendering operation uses this system.
 * 
 * @example
 * const coords = new CoordinateSystem();
 * coords.setViewport(2.0, 100, 50); // zoom 2x, pan (100, 50)
 * coords.setDPR(2);                 // Retina display
 * coords.setContainerRect({ left: 200, top: 100, width: 800, height: 600 });
 * 
 * // Convert screen click to canvas coordinates
 * const canvasPoint = coords.screenToCanvas(500, 400);
 */
export class CoordinateSystem {
    /**
     * @param {Object} [options={}] - Initial configuration
     * @param {number} [options.dpr=1] - Device pixel ratio
     * @param {number} [options.zoom=1] - Initial zoom level
     * @param {number} [options.panX=0] - Initial pan X
     * @param {number} [options.panY=0] - Initial pan Y
     */
    constructor(options = {}) {
        /**
         * Device pixel ratio.
         * @private
         * @type {number}
         */
        this._dpr = Math.max(0.5, options.dpr || 1);

        /**
         * Current zoom level.
         * @private
         * @type {number}
         */
        this._zoom = Math.max(0.1, Math.min(32, options.zoom || 1));

        /**
         * Horizontal pan offset in screen pixels.
         * @private
         * @type {number}
         */
        this._panX = options.panX || 0;

        /**
         * Vertical pan offset in screen pixels.
         * @private
         * @type {number}
         */
        this._panY = options.panY || 0;

        /**
         * Canvas rotation in radians.
         * @private
         * @type {number}
         */
        this._rotation = 0;

        /**
         * Canvas dimensions in document pixels.
         * @private
         * @type {{width: number, height: number}}
         */
        this._canvasSize = { width: 1920, height: 1080 };

        /**
         * Container bounding rect in screen coordinates.
         * @private
         * @type {{left: number, top: number, width: number, height: number}}
         */
        this._containerRect = { left: 0, top: 0, width: 800, height: 600 };

        /**
         * Cached transforms for performance.
         * @private
         */
        this._cache = {
            screenToCanvas: null,
            canvasToScreen: null,
            lastZoom: -1,
            lastPanX: Infinity,
            lastPanY: Infinity,
            lastDpr: -1,
            lastRotation: -1,
        };

        /**
         * Whether to use caching (disable for debugging).
         * @private
         * @type {boolean}
         */
        this._useCache = true;
    }

    // ============================================
    // Getters
    // ============================================

    /** @returns {number} */
    get dpr() { return this._dpr; }

    /** @returns {number} */
    get zoom() { return this._zoom; }

    /** @returns {number} */
    get panX() { return this._panX; }

    /** @returns {number} */
    get panY() { return this._panY; }

    /** @returns {number} */
    get rotation() { return this._rotation; }

    /**
     * Get the effective scale factor (zoom * dpr).
     * @returns {number}
     */
    get effectiveScale() {
        return this._zoom * this._dpr;
    }

    // ============================================
    // Public API - Configuration
    // ============================================

    /**
     * Set the device pixel ratio.
     * @param {number} dpr - Device pixel ratio (0.5 to 4)
     */
    setDPR(dpr) {
        this._dpr = Math.max(0.5, Math.min(4, dpr));
        this._invalidateCache();
    }

    /**
     * Set the zoom level.
     * @param {number} zoom - Zoom level (0.1 to 32)
     */
    setZoom(zoom) {
        this._zoom = Math.max(0.1, Math.min(32, zoom));
        this._invalidateCache();
    }

    /**
     * Set the pan offset.
     * @param {number} panX - Horizontal pan in screen pixels
     * @param {number} panY - Vertical pan in screen pixels
     */
    setPan(panX, panY) {
        this._panX = panX;
        this._panY = panY;
        this._invalidateCache();
    }

    /**
     * Set the viewport (zoom and pan together).
     * @param {number} zoom - Zoom level
     * @param {number} panX - Horizontal pan
     * @param {number} panY - Vertical pan
     */
    setViewport(zoom, panX, panY) {
        this._zoom = Math.max(0.1, Math.min(32, zoom));
        this._panX = panX;
        this._panY = panY;
        this._invalidateCache();
    }

    /**
     * Set the canvas rotation.
     * @param {number} radians - Rotation in radians
     */
    setRotation(radians) {
        this._rotation = radians;
        this._invalidateCache();
    }

    /**
     * Set the canvas dimensions.
     * @param {number} width - Canvas width in document pixels
     * @param {number} height - Canvas height in document pixels
     */
    setCanvasSize(width, height) {
        this._canvasSize.width = width;
        this._canvasSize.height = height;
    }

    /**
     * Set the container bounding rectangle.
     * @param {Object} rect - Container bounding rect
     * @param {number} rect.left - Left edge in screen coordinates
     * @param {number} rect.top - Top edge in screen coordinates
     * @param {number} rect.width - Width in screen pixels
     * @param {number} rect.height - Height in screen pixels
     */
    setContainerRect(rect) {
        this._containerRect = {
            left: rect.left || 0,
            top: rect.top || 0,
            width: rect.width || 800,
            height: rect.height || 600,
        };
        this._invalidateCache();
    }

    /**
     * Enable or disable transform caching.
     * @param {boolean} enabled
     */
    setCaching(enabled) {
        this._useCache = enabled;
        if (!enabled) {
            this._cache = {
                screenToCanvas: null,
                canvasToScreen: null,
                lastZoom: -1,
                lastPanX: Infinity,
                lastPanY: Infinity,
                lastDpr: -1,
                lastRotation: -1,
            };
        }
    }

    // ============================================
    // Public API - Coordinate Conversion
    // ============================================

    /**
     * Convert screen coordinates to canvas coordinates.
     * 
     * @param {number} screenX - X in screen space (CSS pixels from viewport left)
     * @param {number} screenY - Y in screen space (CSS pixels from viewport top)
     * @returns {Point} Point in canvas space (document pixels)
     * 
     * @example
     * // User clicks at screen position (500, 400)
     * const canvasPos = coords.screenToCanvas(500, 400);
     * // canvasPos is where the click lands on the document
     */
    screenToCanvas(screenX, screenY) {
        // Get the container center in screen space
        const containerCenterX = this._containerRect.left + this._containerRect.width / 2;
        const containerCenterY = this._containerRect.top + this._containerRect.height / 2;

        // Canvas center should map to container center
        const canvasCenterX = this._canvasSize.width / 2;
        const canvasCenterY = this._canvasSize.height / 2;

        // Remove pan offset and convert through zoom
        const x = (screenX - containerCenterX - this._panX) / (this._zoom * this._dpr) + canvasCenterX;
        const y = (screenY - containerCenterY - this._panY) / (this._zoom * this._dpr) + canvasCenterY;

        // Apply rotation if needed
        if (this._rotation !== 0) {
            return this._applyInverseRotation(x, y, canvasCenterX, canvasCenterY);
        }

        return new Point(x, y);
    }

    /**
     * Convert canvas coordinates to screen coordinates.
     * 
     * @param {number} canvasX - X in canvas space (document pixels)
     * @param {number} canvasY - Y in canvas space (document pixels)
     * @returns {Point} Point in screen space (CSS pixels)
     */
    canvasToScreen(canvasX, canvasY) {
        const canvasCenterX = this._canvasSize.width / 2;
        const canvasCenterY = this._canvasSize.height / 2;

        // Apply rotation if needed
        let x = canvasX;
        let y = canvasY;

        if (this._rotation !== 0) {
            const rotated = this._applyRotation(canvasX, canvasY, canvasCenterX, canvasCenterY);
            x = rotated.x;
            y = rotated.y;
        }

        const containerCenterX = this._containerRect.left + this._containerRect.width / 2;
        const containerCenterY = this._containerRect.top + this._containerRect.height / 2;

        const screenX = (x - canvasCenterX) * this._zoom * this._dpr + containerCenterX + this._panX;
        const screenY = (y - canvasCenterY) * this._zoom * this._dpr + containerCenterY + this._panY;

        return new Point(screenX, screenY);
    }

    /**
     * Convert screen distance to canvas distance.
     * 
     * @param {number} screenDx - X distance in screen pixels
     * @param {number} screenDy - Y distance in screen pixels
     * @returns {{dx: number, dy: number}} Distance in canvas pixels
     */
    screenToCanvasDistance(screenDx, screenDy) {
        const scale = this._zoom * this._dpr;
        return {
            dx: screenDx / scale,
            dy: screenDy / scale,
        };
    }

    /**
     * Convert canvas distance to screen distance.
     * 
     * @param {number} canvasDx - X distance in canvas pixels
     * @param {number} canvasDy - Y distance in canvas pixels
     * @returns {{dx: number, dy: number}} Distance in screen pixels
     */
    canvasToScreenDistance(canvasDx, canvasDy) {
        const scale = this._zoom * this._dpr;
        return {
            dx: canvasDx * scale,
            dy: canvasDy * scale,
        };
    }

    /**
     * Convert a screen rectangle to a canvas rectangle.
     * @param {Rect} screenRect - Rectangle in screen space
     * @returns {Rect} Rectangle in canvas space
     */
    screenToCanvasRect(screenRect) {
        const topLeft = this.screenToCanvas(screenRect.x, screenRect.y);
        const bottomRight = this.screenToCanvas(screenRect.right, screenRect.bottom);

        return Rect.fromPoints(topLeft, bottomRight);
    }

    /**
     * Convert a canvas rectangle to a screen rectangle.
     * @param {Rect} canvasRect - Rectangle in canvas space
     * @returns {Rect} Rectangle in screen space
     */
    canvasToScreenRect(canvasRect) {
        const topLeft = this.canvasToScreen(canvasRect.x, canvasRect.y);
        const bottomRight = this.canvasToScreen(canvasRect.right, canvasRect.bottom);

        return Rect.fromPoints(topLeft, bottomRight);
    }

    // ============================================
    // Public API - Transform Access
    // ============================================

    /**
     * Get the screen-to-canvas transform.
     * @returns {Transform}
     */
    getScreenToCanvasTransform() {
        if (this._useCache && this._isCacheValid('screenToCanvas')) {
            return this._cache.screenToCanvas;
        }

        const containerCenterX = this._containerRect.left + this._containerRect.width / 2;
        const containerCenterY = this._containerRect.top + this._containerRect.height / 2;
        const canvasCenterX = this._canvasSize.width / 2;
        const canvasCenterY = this._canvasSize.height / 2;
        const scale = this._zoom * this._dpr;

        // Build transform:
        // 1. Translate from screen origin to container center
        // 2. Subtract pan offset
        // 3. Scale down by zoom/DPR
        // 4. Translate to canvas center
        const t = Transform.translate(-containerCenterX, -containerCenterY)
            .compose(Transform.translate(-this._panX, -this._panY))
            .compose(Transform.scale(1 / scale, 1 / scale))
            .compose(Transform.translate(canvasCenterX, canvasCenterY));

        if (this._rotation !== 0) {
            const rot = Transform.translate(canvasCenterX, canvasCenterY)
                .compose(Transform.rotate(-this._rotation))
                .compose(Transform.translate(-canvasCenterX, -canvasCenterY));
            const combined = t.compose(rot);
            this._cache.screenToCanvas = combined;
        } else {
            this._cache.screenToCanvas = t;
        }

        this._updateCacheMeta();
        return this._cache.screenToCanvas;
    }

    /**
     * Get the canvas-to-screen transform.
     * @returns {Transform}
     */
    getCanvasToScreenTransform() {
        return this.getScreenToCanvasTransform().inverse();
    }

    /**
     * Get the CSS transform for the canvas wrapper element.
     * @returns {string} CSS transform value
     */
    getCSSViewportTransform() {
        const containerCenterX = this._containerRect.left + this._containerRect.width / 2;
        const containerCenterY = this._containerRect.top + this._containerRect.height / 2;

        return `translate(${containerCenterX + this._panX}px, ${containerCenterY + this._panY}px) ` +
               `scale(${this._zoom})`;
    }

    // ============================================
    // Public API - Viewport Utilities
    // ============================================

    /**
     * Get the visible area of the canvas in canvas coordinates.
     * @returns {Rect}
     */
    getVisibleCanvasArea() {
        const topLeft = this.screenToCanvas(
            this._containerRect.left,
            this._containerRect.top
        );
        const bottomRight = this.screenToCanvas(
            this._containerRect.left + this._containerRect.width,
            this._containerRect.top + this._containerRect.height
        );

        return Rect.fromPoints(topLeft, bottomRight);
    }

    /**
     * Check if a canvas point is visible on screen.
     * @param {number} canvasX - X in canvas space
     * @param {number} canvasY - Y in canvas space
     * @returns {boolean}
     */
    isCanvasPointVisible(canvasX, canvasY) {
        const screenPoint = this.canvasToScreen(canvasX, canvasY);
        return screenPoint.x >= this._containerRect.left &&
               screenPoint.x <= this._containerRect.left + this._containerRect.width &&
               screenPoint.y >= this._containerRect.top &&
               screenPoint.y <= this._containerRect.top + this._containerRect.height;
    }

    /**
     * Check if a canvas rectangle is visible on screen (or partially visible).
     * @param {Rect} canvasRect - Rectangle in canvas space
     * @returns {boolean}
     */
    isCanvasRectVisible(canvasRect) {
        const screenRect = this.canvasToScreenRect(canvasRect);
        const containerRect = new Rect(
            this._containerRect.left,
            this._containerRect.top,
            this._containerRect.width,
            this._containerRect.height
        );
        return screenRect.intersects(containerRect);
    }

    /**
     * Calculate zoom level to fit the entire canvas in the container.
     * @param {number} [padding=0.9] - Padding ratio (0-1)
     * @returns {number} Recommended zoom level
     */
    calculateFitZoom(padding = 0.9) {
        const availableWidth = this._containerRect.width * padding;
        const availableHeight = this._containerRect.height * padding;

        const scaleX = availableWidth / this._canvasSize.width;
        const scaleY = availableHeight / this._canvasSize.height;

        return Math.min(scaleX, scaleY, 1);
    }

    /**
     * Center the canvas in the container.
     * Calculates pan values to center the canvas.
     */
    centerCanvas() {
        this._panX = 0;
        this._panY = 0;
        this._invalidateCache();
    }

    // ============================================
    // Public API - Serialization
    // ============================================

    /**
     * Serialize the coordinate system state.
     * @returns {Object}
     */
    toJSON() {
        return {
            dpr: this._dpr,
            zoom: this._zoom,
            panX: this._panX,
            panY: this._panY,
            rotation: this._rotation,
            canvasSize: { ...this._canvasSize },
        };
    }

    /**
     * Restore from serialized state.
     * @param {Object} json - Serialized state
     */
    fromJSON(json = {}) {
        this._dpr = json.dpr || 1;
        this._zoom = json.zoom || 1;
        this._panX = json.panX || 0;
        this._panY = json.panY || 0;
        this._rotation = json.rotation || 0;
        if (json.canvasSize) {
            this._canvasSize = { ...json.canvasSize };
        }
        this._invalidateCache();
    }

    // ============================================
    // Private Methods
    // ============================================

    /**
     * Apply rotation to a point around a center.
     * @private
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @returns {{x: number, y: number}}
     */
    _applyRotation(x, y, cx, cy) {
        const cos = Math.cos(this._rotation);
        const sin = Math.sin(this._rotation);
        const dx = x - cx;
        const dy = y - cy;
        return {
            x: cx + dx * cos - dy * sin,
            y: cy + dx * sin + dy * cos,
        };
    }

    /**
     * Apply inverse rotation to a point around a center.
     * @private
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @returns {Point}
     */
    _applyInverseRotation(x, y, cx, cy) {
        const cos = Math.cos(-this._rotation);
        const sin = Math.sin(-this._rotation);
        const dx = x - cx;
        const dy = y - cy;
        return new Point(
            cx + dx * cos - dy * sin,
            cy + dx * sin + dy * cos
        );
    }

    /**
     * Invalidate cached transforms.
     * @private
     */
    _invalidateCache() {
        this._cache.lastZoom = -1;
        this._cache.lastPanX = Infinity;
        this._cache.lastPanY = Infinity;
        this._cache.lastDpr = -1;
        this._cache.lastRotation = -1;
    }

    /**
     * Check if cached transform is still valid.
     * @private
     * @param {string} _transformName - Which transform to check
     * @returns {boolean}
     */
    _isCacheValid(_transformName) {
        return this._cache.lastZoom === this._zoom &&
               this._cache.lastPanX === this._panX &&
               this._cache.lastPanY === this._panY &&
               this._cache.lastDpr === this._dpr &&
               this._cache.lastRotation === this._rotation &&
               this._cache.screenToCanvas !== null;
    }

    /**
     * Update cache metadata after computing a transform.
     * @private
     */
    _updateCacheMeta() {
        this._cache.lastZoom = this._zoom;
        this._cache.lastPanX = this._panX;
        this._cache.lastPanY = this._panY;
        this._cache.lastDpr = this._dpr;
        this._cache.lastRotation = this._rotation;
    }
}

// ============================================
// Exports
// ============================================

export default CoordinateSystem;

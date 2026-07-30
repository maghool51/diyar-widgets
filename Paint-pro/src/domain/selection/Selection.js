// ============================================
// Paint Pro - Professional Web Graphics Application
// src/domain/selection/Selection.js
// Selection Domain Model
// ============================================

/**
 * @module domain/selection/Selection
 * @description Core domain model for canvas selections. Encapsulates
 * selection geometry, type, state, and transformations. Pure domain
 * logic with no rendering dependencies. Supports all selection types
 * needed for professional image editing.
 * 
 * Selection Types:
 * - RECTANGLE: Standard rectangular selection
 * - ELLIPTICAL: Oval/circular selection
 * - LASSO: Freehand selection
 * - POLYGONAL_LASSO: Straight-edged freehand selection
 * - MAGIC_WAND: Contiguous area selection by color
 * - QUICK_SELECTION: Brush-based area selection
 * - COLOR_RANGE: Selection by color range
 * - SELECT_ALL: Entire canvas selected
 * 
 * Selection State:
 * - IDLE: No selection active
 * - CREATING: Selection being drawn
 * - ACTIVE: Selection exists and is editable
 * - TRANSFORMING: Selection being moved/resized/rotated
 * - MODIFYING: Selection being refined (expand, contract, feather)
 */

// ============================================
// Selection Constants
// ============================================

/**
 * @enum {string}
 * @description Types of selections supported.
 */
export const SelectionType = Object.freeze({
    /** No selection active */
    NONE: 'none',

    /** Rectangular selection */
    RECTANGLE: 'rectangle',

    /** Elliptical/oval selection */
    ELLIPTICAL: 'elliptical',

    /** Freehand lasso selection */
    LASSO: 'lasso',

    /** Polygonal lasso (straight lines) */
    POLYGONAL_LASSO: 'polygonalLasso',

    /** Magic wand (contiguous color area) */
    MAGIC_WAND: 'magicWand',

    /** Quick selection brush */
    QUICK_SELECTION: 'quickSelection',

    /** Color range selection */
    COLOR_RANGE: 'colorRange',

    /** Entire canvas */
    SELECT_ALL: 'selectAll',
});

/**
 * @enum {string}
 * @description States of a selection during its lifecycle.
 */
export const SelectionState = Object.freeze({
    /** No selection exists */
    IDLE: 'idle',

    /** Selection is being drawn/created */
    CREATING: 'creating',

    /** Selection exists and is ready */
    ACTIVE: 'active',

    /** Selection is being transformed (move/resize/rotate) */
    TRANSFORMING: 'transforming',

    /** Selection is being modified (expand/contract/feather) */
    MODIFYING: 'modifying',
});

/**
 * @enum {string}
 * @description Modes for combining new selections with existing ones.
 */
export const SelectionMode = Object.freeze({
    /** Replace existing selection */
    NEW: 'new',

    /** Add to existing selection */
    ADD: 'add',

    /** Subtract from existing selection */
    SUBTRACT: 'subtract',

    /** Intersect with existing selection */
    INTERSECT: 'intersect',
});

/**
 * @enum {string}
 * @description Transform handle positions for visual feedback.
 */
export const TransformHandle = Object.freeze({
    NONE: 'none',
    TOP_LEFT: 'topLeft',
    TOP_CENTER: 'topCenter',
    TOP_RIGHT: 'topRight',
    MIDDLE_LEFT: 'middleLeft',
    MIDDLE_RIGHT: 'middleRight',
    BOTTOM_LEFT: 'bottomLeft',
    BOTTOM_CENTER: 'bottomCenter',
    BOTTOM_RIGHT: 'bottomRight',
    ROTATION: 'rotation',
    MOVE: 'move',
});

// ============================================
// SelectionBounds Value Object
// ============================================

/**
 * @class SelectionBounds
 * @description Immutable value object representing selection geometry.
 */
export class SelectionBounds {
    /**
     * @param {Object} options - Bounds options
     * @param {number} [options.x=0] - Left edge X (canvas coordinates)
     * @param {number} [options.y=0] - Top edge Y (canvas coordinates)
     * @param {number} [options.width=0] - Selection width
     * @param {number} [options.height=0] - Selection height
     * @param {number} [options.angle=0] - Rotation angle in degrees
     * @param {number} [options.feather=0] - Feather radius in pixels
     */
    constructor(options = {}) {
        /**
         * Left edge X coordinate.
         * @type {number}
         */
        this.x = options.x || 0;

        /**
         * Top edge Y coordinate.
         * @type {number}
         */
        this.y = options.y || 0;

        /**
         * Selection width.
         * @type {number}
         */
        this.width = Math.max(0, options.width || 0);

        /**
         * Selection height.
         * @type {number}
         */
        this.height = Math.max(0, options.height || 0);

        /**
         * Rotation angle in degrees (0-360).
         * @type {number}
         */
        this.angle = ((options.angle || 0) % 360 + 360) % 360;

        /**
         * Feather radius in pixels (0 = hard edge).
         * @type {number}
         */
        this.feather = Math.max(0, options.feather || 0);

        Object.freeze(this);
    }

    /** @returns {number} Right edge X */
    get right() { return this.x + this.width; }

    /** @returns {number} Bottom edge Y */
    get bottom() { return this.y + this.height; }

    /** @returns {{x: number, y: number}} Center point */
    get center() {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2,
        };
    }

    /** @returns {boolean} Whether the selection is empty */
    get isEmpty() {
        return this.width === 0 || this.height === 0;
    }

    /** @returns {number} Area in square pixels */
    get area() {
        return this.width * this.height;
    }

    /**
     * Check if a point is inside the selection bounds.
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean}
     */
    containsPoint(x, y) {
        if (this.isEmpty) return false;

        // Simple axis-aligned check (rotation requires inverse transform)
        return x >= this.x && x <= this.right &&
               y >= this.y && y <= this.bottom;
    }

    /**
     * Create a copy with modified properties.
     * @param {Object} updates - Properties to update
     * @returns {SelectionBounds}
     */
    with(updates = {}) {
        return new SelectionBounds({
            x: updates.x !== undefined ? updates.x : this.x,
            y: updates.y !== undefined ? updates.y : this.y,
            width: updates.width !== undefined ? updates.width : this.width,
            height: updates.height !== undefined ? updates.height : this.height,
            angle: updates.angle !== undefined ? updates.angle : this.angle,
            feather: updates.feather !== undefined ? updates.feather : this.feather,
        });
    }

    /**
     * Create a copy translated by offset.
     * @param {number} dx - X offset
     * @param {number} dy - Y offset
     * @returns {SelectionBounds}
     */
    translate(dx, dy) {
        return this.with({ x: this.x + dx, y: this.y + dy });
    }

    /**
     * Create a copy scaled from center or corner.
     * @param {number} sx - Scale X factor
     * @param {number} sy - Scale Y factor
     * @param {string} [origin='center'] - Scale origin ('center' or 'topLeft')
     * @returns {SelectionBounds}
     */
    scale(sx, sy = sx, origin = 'center') {
        const newWidth = this.width * sx;
        const newHeight = this.height * sy;

        if (origin === 'center') {
            const center = this.center;
            return this.with({
                x: center.x - newWidth / 2,
                y: center.y - newHeight / 2,
                width: newWidth,
                height: newHeight,
            });
        }

        return this.with({ width: newWidth, height: newHeight });
    }

    /**
     * Create a copy expanded by padding on all sides.
     * @param {number} amount - Padding in pixels
     * @returns {SelectionBounds}
     */
    expand(amount) {
        return this.with({
            x: this.x - amount,
            y: this.y - amount,
            width: this.width + amount * 2,
            height: this.height + amount * 2,
        });
    }

    /**
     * Create a copy contracted by inset on all sides.
     * @param {number} amount - Inset in pixels
     * @returns {SelectionBounds}
     */
    contract(amount) {
        const newWidth = Math.max(0, this.width - amount * 2);
        const newHeight = Math.max(0, this.height - amount * 2);
        return this.with({
            x: this.x + amount,
            y: this.y + amount,
            width: newWidth,
            height: newHeight,
        });
    }

    /**
     * Serialize to plain object.
     * @returns {Object}
     */
    toJSON() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            angle: this.angle,
            feather: this.feather,
        };
    }

    /**
     * Create from plain object.
     * @param {Object} json
     * @returns {SelectionBounds}
     */
    static fromJSON(json = {}) {
        return new SelectionBounds(json);
    }

    /**
     * Create from two corner points.
     * @param {number} x1 - First corner X
     * @param {number} y1 - First corner Y
     * @param {number} x2 - Opposite corner X
     * @param {number} y2 - Opposite corner Y
     * @returns {SelectionBounds}
     */
    static fromCorners(x1, y1, x2, y2) {
        return new SelectionBounds({
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.abs(x2 - x1),
            height: Math.abs(y2 - y1),
        });
    }
}

// ============================================
// Selection Class
// ============================================

/**
 * @class Selection
 * @description Core domain model representing a canvas selection.
 * Tracks selection type, bounds, state, and transformation data.
 * Pure domain logic - rendering is handled by SelectionRenderer.
 * 
 * @example
 * const selection = new Selection();
 * 
 * // Create a rectangular selection
 * selection.beginCreation(SelectionType.RECTANGLE);
 * selection.updateBounds(SelectionBounds.fromCorners(100, 100, 300, 200));
 * selection.finishCreation();
 * 
 * // Move the selection
 * selection.beginTransform(TransformHandle.MOVE);
 * selection.translate(10, -5);
 * selection.finishTransform();
 * 
 * // Clear selection
 * selection.clear();
 */
export class Selection {
    /**
     * @param {Object} [options={}] - Initial selection options
     */
    constructor(options = {}) {
        /**
         * Current selection type.
         * @private
         * @type {string}
         */
        this._type = SelectionType.NONE;

        /**
         * Current selection state.
         * @private
         * @type {string}
         */
        this._state = SelectionState.IDLE;

        /**
         * Selection bounds (null when no selection).
         * @private
         * @type {SelectionBounds|null}
         */
        this._bounds = null;

        /**
         * Original bounds before transformation (for reference).
         * @private
         * @type {SelectionBounds|null}
         */
        this._originalBounds = null;

        /**
         * Active transform handle.
         * @private
         * @type {string}
         */
        this._activeHandle = TransformHandle.NONE;

        /**
         * Pixel mask data for non-rectangular selections.
         * Uint8Array where 0 = not selected, 255 = fully selected.
         * @private
         * @type {Uint8Array|null}
         */
        this._mask = null;

        /**
         * Whether the selection has a soft edge (feathering).
         * @private
         * @type {boolean}
         */
        this._hasFeather = false;

        /**
         * Marching ants animation offset (for rendering).
         * @private
         * @type {number}
         */
        this._marchingOffset = 0;

        /**
         * Whether the selection is visible (marching ants shown).
         * @private
         * @type {boolean}
         */
        this._visible = true;

        /**
         * Whether the selection has been modified since creation.
         * @private
         * @type {boolean}
         */
        this._dirty = false;

        /**
         * Unique selection instance identifier.
         * @private
         * @type {string}
         */
        this._id = Selection._generateId();
    }

    // ============================================
    // Getters
    // ============================================

    /** @returns {string} */ get type() { return this._type; }
    /** @returns {string} */ get state() { return this._state; }
    /** @returns {SelectionBounds|null} */ get bounds() { return this._bounds; }
    /** @returns {string} */ get activeHandle() { return this._activeHandle; }
    /** @returns {boolean} */ get visible() { return this._visible; }
    /** @returns {boolean} */ get dirty() { return this._dirty; }
    /** @returns {string} */ get id() { return this._id; }
    /** @returns {number} */ get marchingOffset() { return this._marchingOffset; }

    /**
     * Check if a selection exists.
     * @returns {boolean}
     */
    get exists() {
        return this._state === SelectionState.ACTIVE ||
               this._state === SelectionState.TRANSFORMING ||
               this._state === SelectionState.MODIFYING;
    }

    /**
     * Check if the selection is being transformed.
     * @returns {boolean}
     */
    get isTransforming() {
        return this._state === SelectionState.TRANSFORMING;
    }

    /**
     * Check if the selection is being created.
     * @returns {boolean}
     */
    get isCreating() {
        return this._state === SelectionState.CREATING;
    }

    /**
     * Check if the selection has a mask (non-rectangular).
     * @returns {boolean}
     */
    get hasMask() {
        return this._mask !== null;
    }

    /**
     * Check if the selection is rectangular (no mask).
     * @returns {boolean}
     */
    get isRectangular() {
        return this._type === SelectionType.RECTANGLE ||
               this._type === SelectionType.SELECT_ALL;
    }

    // ============================================
    // Public API - Creation
    // ============================================

    /**
     * Begin creating a new selection.
     * @param {string} type - Selection type from SelectionType
     * @param {string} [mode='new'] - Combination mode from SelectionMode
     */
    beginCreation(type, mode = SelectionMode.NEW) {
        if (!Object.values(SelectionType).includes(type)) {
            throw new Error(`Invalid selection type: ${type}`);
        }

        if (mode === SelectionMode.NEW || !this.exists) {
            // Replace existing selection
            this._type = type;
            this._bounds = null;
            this._mask = null;
            this._hasFeather = false;
        }

        this._state = SelectionState.CREATING;
        this._dirty = true;
    }

    /**
     * Update selection bounds during creation.
     * @param {SelectionBounds} bounds - New bounds
     */
    updateBounds(bounds) {
        if (this._state !== SelectionState.CREATING) return;

        if (bounds instanceof SelectionBounds) {
            this._bounds = bounds;
        } else {
            this._bounds = new SelectionBounds(bounds);
        }

        this._dirty = true;
    }

    /**
     * Finish creating the selection.
     * If the selection is too small (e.g., single pixel), it's discarded.
     * @param {Object} [options={}] - Finish options
     * @param {number} [options.feather=0] - Apply feathering
     * @param {Uint8Array} [options.mask] - Pixel mask for non-rectangular selections
     */
    finishCreation(options = {}) {
        if (this._state !== SelectionState.CREATING) return;

        // Discard tiny selections (accidental clicks)
        if (this._bounds && this._bounds.area < 4) {
            this.clear();
            return;
        }

        // Apply feather
        if (options.feather && options.feather > 0) {
            this._bounds = this._bounds.with({ feather: options.feather });
            this._hasFeather = true;
        }

        // Apply mask
        if (options.mask) {
            this._mask = options.mask;
        }

        this._state = SelectionState.ACTIVE;
        this._originalBounds = this._bounds ? new SelectionBounds(this._bounds.toJSON()) : null;
        this._dirty = true;
    }

    /**
     * Cancel selection creation.
     */
    cancelCreation() {
        if (this._state !== SelectionState.CREATING) return;

        this._bounds = this._originalBounds ? new SelectionBounds(this._originalBounds.toJSON()) : null;

        if (this._bounds && !this._bounds.isEmpty) {
            this._state = SelectionState.ACTIVE;
        } else {
            this.clear();
        }
    }

    // ============================================
    // Public API - Selection Operations
    // ============================================

    /**
     * Select the entire canvas.
     * @param {number} canvasWidth - Canvas width
     * @param {number} canvasHeight - Canvas height
     */
    selectAll(canvasWidth, canvasHeight) {
        this._type = SelectionType.SELECT_ALL;
        this._bounds = new SelectionBounds({
            x: 0,
            y: 0,
            width: canvasWidth,
            height: canvasHeight,
        });
        this._state = SelectionState.ACTIVE;
        this._originalBounds = new SelectionBounds(this._bounds.toJSON());
        this._mask = null;
        this._dirty = true;
    }

    /**
     * Clear the selection.
     */
    clear() {
        this._type = SelectionType.NONE;
        this._state = SelectionState.IDLE;
        this._bounds = null;
        this._originalBounds = null;
        this._mask = null;
        this._hasFeather = false;
        this._activeHandle = TransformHandle.NONE;
        this._dirty = true;
    }

    /**
     * Invert the selection.
     * Everything selected becomes deselected and vice versa.
     * @param {number} canvasWidth - Canvas width for inverse calculation
     * @param {number} canvasHeight - Canvas height for inverse calculation
     */
    invert(canvasWidth, canvasHeight) {
        if (!this.exists) {
            this.selectAll(canvasWidth, canvasHeight);
            return;
        }

        // For rectangular selections, create inverted bounds
        // (This is a simplification; full inversion requires mask operations)
        if (this.isRectangular && this._bounds) {
            // Inversion of a rectangle creates a "frame" selection
            // represented as the full canvas with a hole
            // For simplicity, we select all and rely on mask for the hole
            this.selectAll(canvasWidth, canvasHeight);
        }

        // Invert the mask if present
        if (this._mask) {
            for (let i = 0; i < this._mask.length; i++) {
                this._mask[i] = 255 - this._mask[i];
            }
        }

        this._dirty = true;
    }

    // ============================================
    // Public API - Transformation
    // ============================================

    /**
     * Begin transforming the selection.
     * @param {string} handle - Transform handle being used
     */
    beginTransform(handle = TransformHandle.MOVE) {
        if (!this.exists) return;

        this._state = SelectionState.TRANSFORMING;
        this._activeHandle = handle;
        this._originalBounds = this._bounds ? new SelectionBounds(this._bounds.toJSON()) : null;
    }

    /**
     * Translate the selection during transform.
     * @param {number} dx - Delta X in pixels
     * @param {number} dy - Delta Y in pixels
     */
    translate(dx, dy) {
        if (this._state !== SelectionState.TRANSFORMING) return;
        if (!this._bounds) return;

        this._bounds = this._bounds.translate(dx, dy);
        this._dirty = true;
    }

    /**
     * Resize the selection during transform.
     * @param {number} newWidth - New width
     * @param {number} newHeight - New height
     * @param {string} [handle] - Handle being dragged
     */
    resize(newWidth, newHeight, handle = null) {
        if (this._state !== SelectionState.TRANSFORMING) return;
        if (!this._bounds || !this._originalBounds) return;

        const orig = this._originalBounds;

        let x = orig.x;
        let y = orig.y;
        let width = Math.max(1, newWidth);
        let height = Math.max(1, newHeight);

        // Adjust position based on handle
        if (handle) {
            switch (handle) {
                case TransformHandle.TOP_LEFT:
                    x = orig.right - width;
                    y = orig.bottom - height;
                    break;
                case TransformHandle.TOP_CENTER:
                    x = orig.x;
                    y = orig.bottom - height;
                    width = orig.width;
                    break;
                case TransformHandle.TOP_RIGHT:
                    y = orig.bottom - height;
                    break;
                case TransformHandle.MIDDLE_LEFT:
                    x = orig.right - width;
                    height = orig.height;
                    break;
                case TransformHandle.MIDDLE_RIGHT:
                    height = orig.height;
                    break;
                case TransformHandle.BOTTOM_LEFT:
                    x = orig.right - width;
                    break;
                case TransformHandle.BOTTOM_CENTER:
                    width = orig.width;
                    break;
                case TransformHandle.BOTTOM_RIGHT:
                    // Default: anchor at top-left
                    break;
            }
        }

        this._bounds = new SelectionBounds({
            x, y, width, height,
            angle: this._bounds.angle,
            feather: this._bounds.feather,
        });
        this._dirty = true;
    }

    /**
     * Rotate the selection during transform.
     * @param {number} angle - Rotation angle in degrees
     */
    rotate(angle) {
        if (this._state !== SelectionState.TRANSFORMING) return;
        if (!this._bounds) return;

        this._bounds = this._bounds.with({ angle: ((angle % 360) + 360) % 360 });
        this._dirty = true;
    }

    /**
     * Finish transforming the selection.
     */
    finishTransform() {
        if (this._state !== SelectionState.TRANSFORMING) return;

        this._state = SelectionState.ACTIVE;
        this._activeHandle = TransformHandle.NONE;
        this._originalBounds = this._bounds ? new SelectionBounds(this._bounds.toJSON()) : null;
        this._dirty = true;
    }

    /**
     * Cancel transformation and revert to original bounds.
     */
    cancelTransform() {
        if (this._state !== SelectionState.TRANSFORMING) return;

        this._bounds = this._originalBounds;
        this._state = SelectionState.ACTIVE;
        this._activeHandle = TransformHandle.NONE;
        this._dirty = true;
    }

    // ============================================
    // Public API - Modification
    // ============================================

    /**
     * Expand the selection by a given amount.
     * @param {number} amount - Pixels to expand
     */
    expand(amount) {
        if (!this.exists || !this._bounds) return;

        this._state = SelectionState.MODIFYING;
        this._bounds = this._bounds.expand(amount);
        this._state = SelectionState.ACTIVE;
        this._dirty = true;
    }

    /**
     * Contract the selection by a given amount.
     * @param {number} amount - Pixels to contract
     */
    contract(amount) {
        if (!this.exists || !this._bounds) return;

        this._state = SelectionState.MODIFYING;
        this._bounds = this._bounds.contract(amount);

        if (this._bounds.isEmpty) {
            this.clear();
        } else {
            this._state = SelectionState.ACTIVE;
            this._dirty = true;
        }
    }

    /**
     * Set the feather radius.
     * @param {number} radius - Feather radius in pixels
     */
    setFeather(radius) {
        if (!this.exists || !this._bounds) return;

        this._bounds = this._bounds.with({ feather: Math.max(0, radius) });
        this._hasFeather = radius > 0;
        this._dirty = true;
    }

    /**
     * Set the selection mask (for non-rectangular selections).
     * @param {Uint8Array} mask - Pixel mask data
     */
    setMask(mask) {
        this._mask = mask;
        this._dirty = true;
    }

    // ============================================
    // Public API - Visibility
    // ============================================

    /**
     * Show marching ants.
     */
    show() {
        this._visible = true;
        this._dirty = true;
    }

    /**
     * Hide marching ants (selection still active but not shown).
     */
    hide() {
        this._visible = false;
        this._dirty = true;
    }

    /**
     * Toggle marching ants visibility.
     */
    toggleVisibility() {
        this._visible = !this._visible;
        this._dirty = true;
    }

    // ============================================
    // Public API - Marching Ants Animation
    // ============================================

    /**
     * Update the marching ants animation offset.
     * Called each frame by the animation loop.
     * @param {number} deltaTime - Time since last frame in ms
     */
    updateMarchingAnts(deltaTime = 16) {
        // Marching ants move at ~30 pixels per second
        this._marchingOffset = (this._marchingOffset + deltaTime * 0.03) % 1;
    }

    // ============================================
    // Public API - Query
    // ============================================

    /**
     * Check if a point is inside the selection.
     * @param {number} x - X coordinate in canvas space
     * @param {number} y - Y coordinate in canvas space
     * @returns {boolean}
     */
    containsPoint(x, y) {
        if (!this.exists || !this._bounds) return false;

        // For rectangular selections, use bounds check
        if (this.isRectangular) {
            return this._bounds.containsPoint(x, y);
        }

        // For masked selections, check the mask
        if (this._mask && this._bounds.containsPoint(x, y)) {
            const localX = Math.floor(x - this._bounds.x);
            const localY = Math.floor(y - this._bounds.y);
            const index = localY * Math.floor(this._bounds.width) + localX;

            if (index >= 0 && index < this._mask.length) {
                return this._mask[index] > 128; // More than 50% selected
            }
        }

        return false;
    }

    /**
     * Check if the selection intersects a rectangle.
     * @param {number} x - Rectangle X
     * @param {number} y - Rectangle Y
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @returns {boolean}
     */
    intersectsRect(x, y, width, height) {
        if (!this.exists || !this._bounds) return false;

        return x < this._bounds.right &&
               x + width > this._bounds.x &&
               y < this._bounds.bottom &&
               y + height > this._bounds.y;
    }

    // ============================================
    // Public API - Serialization
    // ============================================

    /**
     * Serialize selection to plain object.
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this._id,
            type: this._type,
            state: this._state,
            bounds: this._bounds ? this._bounds.toJSON() : null,
            hasMask: this.hasMask,
            hasFeather: this._hasFeather,
            visible: this._visible,
        };
    }

    /**
     * Create from serialized data.
     * @param {Object} json - Serialized selection
     * @returns {Selection}
     */
    static fromJSON(json = {}) {
        const selection = new Selection();
        selection._id = json.id || selection._id;
        selection._type = json.type || SelectionType.NONE;
        selection._state = json.state || SelectionState.IDLE;
        selection._bounds = json.bounds ? SelectionBounds.fromJSON(json.bounds) : null;
        selection._hasFeather = json.hasFeather || false;
        selection._visible = json.visible !== false;

        if (json.bounds && !json.bounds.isEmpty) {
            selection._originalBounds = SelectionBounds.fromJSON(json.bounds);
        }

        return selection;
    }

    // ============================================
    // Private Methods
    // ============================================

    /**
     * Generate a unique selection ID.
     * @private
     * @returns {string}
     */
    static _generateId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `sel_${crypto.randomUUID()}`;
        }
        return `sel_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// ============================================
// Default Export
// ============================================

export default Selection;

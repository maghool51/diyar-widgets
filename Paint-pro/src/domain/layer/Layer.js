// ============================================
// Paint Pro - Professional Web Graphics Application
// src/domain/layer/Layer.js
// Layer Domain Model
// ============================================

/**
 * @module domain/layer/Layer
 * @description Core domain model for a single layer. Encapsulates all
 * layer state including visibility, opacity, blend mode, locking, and
 * pixel data reference. Designed as a pure domain object with no rendering
 * logic, enabling multiple renderer implementations and serialization.
 * 
 * Layer Types:
 * - PIXEL: Raster layer with pixel data
 * - TEXT: Editable text layer
 * - VECTOR: Vector shape layer
 * - ADJUSTMENT: Non-destructive adjustment layer
 * - GROUP: Container for other layers
 * - SMART_OBJECT: Embedded document reference
 * 
 * Blend Modes (subset of Photoshop standard):
 * - Normal, Multiply, Screen, Overlay, Darken, Lighten
 * - ColorDodge, ColorBurn, HardLight, SoftLight
 * - Difference, Exclusion, Hue, Saturation, Color, Luminosity
 */

// ============================================
// Layer Type Constants
// ============================================

/**
 * @enum {string}
 * @description Types of layers supported by the application.
 */
export const LayerType = Object.freeze({
    /** Standard raster/pixel layer */
    PIXEL: 'pixel',

    /** Editable text layer */
    TEXT: 'text',

    /** Vector shape layer */
    VECTOR: 'vector',

    /** Non-destructive adjustment layer */
    ADJUSTMENT: 'adjustment',

    /** Group container for child layers */
    GROUP: 'group',

    /** Embedded smart object */
    SMART_OBJECT: 'smartObject',
});

// ============================================
// Blend Mode Constants
// ============================================

/**
 * @enum {string}
 * @description Standard blend modes for layer compositing.
 */
export const BlendMode = Object.freeze({
    /** No blending, fully opaque */
    NORMAL: 'normal',

    /** Multiplies the colors */
    MULTIPLY: 'multiply',

    /** Screens the colors (inverse of multiply) */
    SCREEN: 'screen',

    /** Combines multiply and screen */
    OVERLAY: 'overlay',

    /** Selects the darker of the colors */
    DARKEN: 'darken',

    /** Selects the lighter of the colors */
    LIGHTEN: 'lighten',

    /** Brightens the base color to reflect the blend color */
    COLOR_DODGE: 'colorDodge',

    /** Darkens the base color to reflect the blend color */
    COLOR_BURN: 'colorBurn',

    /** Multiplies or screens depending on blend color */
    HARD_LIGHT: 'hardLight',

    /** Darkens or lightens depending on blend color */
    SOFT_LIGHT: 'softLight',

    /** Subtracts the darker from the lighter */
    DIFFERENCE: 'difference',

    /** Similar to difference but lower contrast */
    EXCLUSION: 'exclusion',

    /** Creates color with hue of blend color */
    HUE: 'hue',

    /** Creates color with saturation of blend color */
    SATURATION: 'saturation',

    /** Creates color with hue and saturation of blend color */
    COLOR: 'color',

    /** Creates color with luminosity of blend color */
    LUMINOSITY: 'luminosity',

    /** Pass-through for group layers */
    PASS_THROUGH: 'passThrough',
});

// ============================================
// Layer Flags
// ============================================

/**
 * @enum {string}
 * @description Flags representing layer capabilities and states.
 */
export const LayerFlags = Object.freeze({
    /** Layer is visible */
    VISIBLE: 'visible',

    /** Layer is locked (cannot be edited) */
    LOCKED: 'locked',

    /** Layer position is locked */
    LOCK_POSITION: 'lockPosition',

    /** Layer transparency is locked */
    LOCK_TRANSPARENCY: 'lockTransparency',

    /** Layer is a background layer (special behavior) */
    BACKGROUND: 'background',

    /** Layer has been modified since last save */
    DIRTY: 'dirty',

    /** Layer has a mask */
    HAS_MASK: 'hasMask',

    /** Layer has layer effects */
    HAS_EFFECTS: 'hasEffects',
});

// ============================================
// Layer Mask
// ============================================

/**
 * @class LayerMask
 * @description Represents a layer mask that controls layer visibility.
 * A mask is a grayscale image where white = visible, black = hidden.
 */
export class LayerMask {
    /**
     * @param {Object} [options={}] - Mask options
     * @param {number} [options.width] - Mask width (defaults to layer width)
     * @param {number} [options.height] - Mask height (defaults to layer height)
     * @param {boolean} [options.enabled=true] - Whether mask is active
     * @param {boolean} [options.linked=true] - Whether mask moves with layer
     * @param {ImageData|null} [options.data=null] - Mask pixel data
     */
    constructor(options = {}) {
        /**
         * Whether the mask is enabled.
         * @type {boolean}
         */
        this.enabled = options.enabled !== false;

        /**
         * Whether the mask is linked to the layer (moves together).
         * @type {boolean}
         */
        this.linked = options.linked !== false;

        /**
         * Mask dimensions.
         * @type {{width: number, height: number}}
         */
        this.dimensions = {
            width: options.width || 0,
            height: options.height || 0,
        };

        /**
         * Mask pixel data (grayscale ImageData).
         * @type {ImageData|null}
         */
        this.data = options.data || null;

        /**
         * Unique mask identifier.
         * @type {string}
         */
        this.id = LayerMask._generateId();
    }

    /**
     * Check if mask has pixel data.
     * @returns {boolean}
     */
    get hasData() {
        return this.data !== null;
    }

    /**
     * Resize the mask.
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width, height) {
        this.dimensions.width = width;
        this.dimensions.height = height;
        // Note: Actual pixel data resizing is handled by the rendering system
    }

    /**
     * Toggle mask enabled state.
     */
    toggle() {
        this.enabled = !this.enabled;
    }

    /**
     * Create a copy of the mask.
     * @returns {LayerMask}
     */
    clone() {
        return new LayerMask({
            enabled: this.enabled,
            linked: this.linked,
            width: this.dimensions.width,
            height: this.dimensions.height,
            data: this.data ? new ImageData(
                new Uint8ClampedArray(this.data.data),
                this.data.width,
                this.data.height
            ) : null,
        });
    }

    /**
     * Serialize to plain object.
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            enabled: this.enabled,
            linked: this.linked,
            width: this.dimensions.width,
            height: this.dimensions.height,
            hasData: this.hasData,
        };
    }

    /**
     * Create from plain object (pixel data loaded separately).
     * @param {Object} json
     * @returns {LayerMask}
     */
    static fromJSON(json = {}) {
        const mask = new LayerMask({
            enabled: json.enabled,
            linked: json.linked,
            width: json.width,
            height: json.height,
        });
        mask.id = json.id || mask.id;
        return mask;
    }

    /**
     * Generate a unique mask ID.
     * @private
     * @returns {string}
     */
    static _generateId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `mask_${crypto.randomUUID()}`;
        }
        return `mask_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// ============================================
// Layer Class
// ============================================

/**
 * @class Layer
 * @description Core domain model for a single layer.
 * Encapsulates all layer properties and state.
 * 
 * @example
 * const layer = new Layer({
 *     name: 'Background',
 *     type: LayerType.PIXEL,
 *     width: 1920,
 *     height: 1080,
 * });
 * 
 * layer.setOpacity(0.8);
 * layer.setBlendMode(BlendMode.MULTIPLY);
 * layer.lock();
 */
export class Layer {
    /**
     * @param {Object} options - Layer configuration
     * @param {string} [options.id] - Unique layer ID (auto-generated)
     * @param {string} [options.name='Layer'] - Layer display name
     * @param {string} [options.type='pixel'] - Layer type from LayerType
     * @param {number} [options.width] - Layer width in pixels
     * @param {number} [options.height] - Layer height in pixels
     * @param {number} [options.opacity=1] - Layer opacity (0-1)
     * @param {string} [options.blendMode='normal'] - Blend mode
     * @param {boolean} [options.visible=true] - Whether layer is visible
     * @param {boolean} [options.locked=false] - Whether layer is locked
     * @param {number} [options.order=0] - Z-order position
     * @param {LayerMask|null} [options.mask=null] - Layer mask
     */
    constructor(options = {}) {
        /**
         * Unique layer identifier.
         * @private
         * @type {string}
         */
        this._id = options.id || Layer._generateId();

        /**
         * Layer display name.
         * @private
         * @type {string}
         */
        this._name = options.name || 'Layer';

        /**
         * Layer type.
         * @private
         * @type {string}
         */
        this._type = Object.values(LayerType).includes(options.type)
            ? options.type
            : LayerType.PIXEL;

        /**
         * Layer dimensions in pixels.
         * @private
         * @type {{width: number, height: number}}
         */
        this._dimensions = {
            width: Math.max(1, options.width || 1),
            height: Math.max(1, options.height || 1),
        };

        /**
         * Layer opacity (0 = fully transparent, 1 = fully opaque).
         * @private
         * @type {number}
         */
        this._opacity = Math.max(0, Math.min(1, options.opacity ?? 1));

        /**
         * Blend mode.
         * @private
         * @type {string}
         */
        this._blendMode = Object.values(BlendMode).includes(options.blendMode)
            ? options.blendMode
            : BlendMode.NORMAL;

        /**
         * Whether the layer is visible.
         * @private
         * @type {boolean}
         */
        this._visible = options.visible !== false;

        /**
         * Whether the layer is locked.
         * @private
         * @type {boolean}
         */
        this._locked = options.locked || false;

        /**
         * Whether layer position is locked.
         * @private
         * @type {boolean}
         */
        this._lockPosition = false;

        /**
         * Whether layer transparency is locked.
         * @private
         * @type {boolean}
         */
        this._lockTransparency = false;

        /**
         * Z-order position (higher = on top).
         * @private
         * @type {number}
         */
        this._order = options.order || 0;

        /**
         * Layer position offset (for moving layer content).
         * @private
         * @type {{x: number, y: number}}
         */
        this._offset = { x: 0, y: 0 };

        /**
         * Layer mask.
         * @private
         * @type {LayerMask|null}
         */
        this._mask = options.mask || null;

        /**
         * Whether the layer is a background layer.
         * @private
         * @type {boolean}
         */
        this._isBackground = false;

        /**
         * Creation timestamp.
         * @private
         * @type {number}
         */
        this._createdAt = Date.now();

        /**
         * Last modification timestamp.
         * @private
         * @type {number}
         */
        this._modifiedAt = Date.now();

        /**
         * Custom user metadata.
         * @private
         * @type {Object}
         */
        this._metadata = {};

        /**
         * Whether the layer has been disposed.
         * @private
         * @type {boolean}
         */
        this._disposed = false;
    }

    // ============================================
    // Getters
    // ============================================

    /** @returns {string} */ get id() { return this._id; }
    /** @returns {string} */ get name() { return this._name; }
    /** @returns {string} */ get type() { return this._type; }
    /** @returns {number} */ get width() { return this._dimensions.width; }
    /** @returns {number} */ get height() { return this._dimensions.height; }
    /** @returns {number} */ get opacity() { return this._opacity; }
    /** @returns {string} */ get blendMode() { return this._blendMode; }
    /** @returns {boolean} */ get visible() { return this._visible; }
    /** @returns {boolean} */ get locked() { return this._locked; }
    /** @returns {number} */ get order() { return this._order; }
    /** @returns {number} */ get offsetX() { return this._offset.x; }
    /** @returns {number} */ get offsetY() { return this._offset.y; }
    /** @returns {LayerMask|null} */ get mask() { return this._mask; }
    /** @returns {boolean} */ get isBackground() { return this._isBackground; }
    /** @returns {boolean} */ get hasMask() { return this._mask !== null && this._mask.enabled; }
    /** @returns {number} */ get createdAt() { return this._createdAt; }
    /** @returns {number} */ get modifiedAt() { return this._modifiedAt; }
    /** @returns {boolean} */ get isDisposed() { return this._disposed; }

    /**
     * Get layer dimensions.
     * @returns {{width: number, height: number}}
     */
    get dimensions() {
        return { ...this._dimensions };
    }

    /**
     * Get layer offset.
     * @returns {{x: number, y: number}}
     */
    get offset() {
        return { ...this._offset };
    }

    /**
     * Check if the layer can be edited.
     * @returns {boolean}
     */
    get isEditable() {
        return !this._locked && !this._disposed && this._visible;
    }

    // ============================================
    // Public API - Basic Properties
    // ============================================

    /**
     * Rename the layer.
     * @param {string} name - New layer name
     */
    setName(name) {
        this._checkNotDisposed();
        if (typeof name !== 'string' || name.trim().length === 0) {
            throw new Error('Layer name must be a non-empty string');
        }
        this._name = name.trim();
        this._touch();
    }

    /**
     * Set layer opacity.
     * @param {number} opacity - Opacity value (0-1)
     */
    setOpacity(opacity) {
        this._checkNotDisposed();
        this._opacity = Math.max(0, Math.min(1, opacity));
        this._touch();
    }

    /**
     * Set blend mode.
     * @param {string} blendMode - Blend mode from BlendMode
     */
    setBlendMode(blendMode) {
        this._checkNotDisposed();
        if (!Object.values(BlendMode).includes(blendMode)) {
            throw new Error(`Invalid blend mode: ${blendMode}`);
        }
        this._blendMode = blendMode;
        this._touch();
    }

    /**
     * Set layer visibility.
     * @param {boolean} visible - Visibility state
     */
    setVisible(visible) {
        this._checkNotDisposed();
        this._visible = !!visible;
        this._touch();
    }

    /**
     * Toggle layer visibility.
     */
    toggleVisibility() {
        this.setVisible(!this._visible);
    }

    /**
     * Set layer type.
     * @param {string} type - Layer type from LayerType
     */
    setType(type) {
        this._checkNotDisposed();
        if (!Object.values(LayerType).includes(type)) {
            throw new Error(`Invalid layer type: ${type}`);
        }
        this._type = type;
        this._touch();
    }

    // ============================================
    // Public API - Locking
    // ============================================

    /**
     * Lock the layer (prevent editing).
     */
    lock() {
        this._locked = true;
    }

    /**
     * Unlock the layer.
     */
    unlock() {
        this._locked = false;
    }

    /**
     * Lock layer position only.
     */
    lockPosition() {
        this._lockPosition = true;
    }

    /**
     * Unlock layer position.
     */
    unlockPosition() {
        this._lockPosition = false;
    }

    /**
     * Lock layer transparency (alpha channel).
     */
    lockTransparency() {
        this._lockTransparency = true;
    }

    /**
     * Unlock layer transparency.
     */
    unlockTransparency() {
        this._lockTransparency = false;
    }

    // ============================================
    // Public API - Position & Size
    // ============================================

    /**
     * Set layer offset position.
     * @param {number} x - X offset in pixels
     * @param {number} y - Y offset in pixels
     */
    setOffset(x, y) {
        this._checkNotDisposed();
        if (this._lockPosition) return;
        this._offset = { x, y };
        this._touch();
    }

    /**
     * Move layer by delta.
     * @param {number} dx - Delta X
     * @param {number} dy - Delta Y
     */
    moveBy(dx, dy) {
        this.setOffset(this._offset.x + dx, this._offset.y + dy);
    }

    /**
     * Resize the layer.
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width, height) {
        this._checkNotDisposed();
        this._dimensions = {
            width: Math.max(1, Math.round(width)),
            height: Math.max(1, Math.round(height)),
        };

        // Resize mask if present
        if (this._mask) {
            this._mask.resize(width, height);
        }

        this._touch();
    }

    /**
     * Set the layer order (Z-index).
     * @param {number} order - New order value
     */
    setOrder(order) {
        this._order = order;
    }

    // ============================================
    // Public API - Mask
    // ============================================

    /**
     * Add a mask to the layer.
     * @param {Object} [options={}] - Mask options
     * @returns {LayerMask}
     */
    addMask(options = {}) {
        this._checkNotDisposed();

        this._mask = new LayerMask({
            width: this._dimensions.width,
            height: this._dimensions.height,
            ...options,
        });

        this._touch();
        return this._mask;
    }

    /**
     * Remove the layer mask.
     */
    removeMask() {
        this._mask = null;
        this._touch();
    }

    /**
     * Toggle mask enabled state.
     */
    toggleMask() {
        if (this._mask) {
            this._mask.toggle();
            this._touch();
        }
    }

    // ============================================
    // Public API - Flags
    // ============================================

    /**
     * Mark as background layer.
     */
    markAsBackground() {
        this._isBackground = true;
        this._locked = true;
        this._lockPosition = true;
    }

    /**
     * Set custom metadata.
     * @param {string} key - Metadata key
     * @param {*} value - Metadata value
     */
    setMetadata(key, value) {
        this._metadata[key] = value;
    }

    /**
     * Get custom metadata.
     * @param {string} key - Metadata key
     * @returns {*}
     */
    getMetadata(key) {
        return this._metadata[key];
    }

    // ============================================
    // Public API - Lifecycle
    // ============================================

    /**
     * Clone the layer.
     * @param {boolean} [deep=true] - Deep clone including pixel data
     * @returns {Layer}
     */
    clone(deep = true) {
        const clone = new Layer({
            name: `${this._name} (Copy)`,
            type: this._type,
            width: this._dimensions.width,
            height: this._dimensions.height,
            opacity: this._opacity,
            blendMode: this._blendMode,
            visible: this._visible,
            locked: false,
            order: this._order + 1,
        });

        clone._offset = { ...this._offset };
        clone._metadata = { ...this._metadata };

        if (deep && this._mask) {
            clone._mask = this._mask.clone();
        }

        return clone;
    }

    /**
     * Dispose the layer and release resources.
     */
    dispose() {
        if (this._disposed) return;

        this._mask = null;
        this._metadata = {};
        this._disposed = true;
    }

    // ============================================
    // Public API - Serialization
    // ============================================

    /**
     * Serialize the layer to a plain object (without pixel data).
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this._id,
            name: this._name,
            type: this._type,
            width: this._dimensions.width,
            height: this._dimensions.height,
            opacity: this._opacity,
            blendMode: this._blendMode,
            visible: this._visible,
            locked: this._locked,
            lockPosition: this._lockPosition,
            lockTransparency: this._lockTransparency,
            order: this._order,
            offsetX: this._offset.x,
            offsetY: this._offset.y,
            isBackground: this._isBackground,
            mask: this._mask ? this._mask.toJSON() : null,
            createdAt: this._createdAt,
            modifiedAt: this._modifiedAt,
        };
    }

    /**
     * Create a Layer from serialized data.
     * @param {Object} json - Serialized layer data
     * @returns {Layer}
     */
    static fromJSON(json = {}) {
        const layer = new Layer({
            id: json.id,
            name: json.name,
            type: json.type,
            width: json.width,
            height: json.height,
            opacity: json.opacity,
            blendMode: json.blendMode,
            visible: json.visible,
            locked: json.locked,
            order: json.order,
        });

        layer._lockPosition = json.lockPosition || false;
        layer._lockTransparency = json.lockTransparency || false;
        layer._offset = { x: json.offsetX || 0, y: json.offsetY || 0 };
        layer._isBackground = json.isBackground || false;
        layer._createdAt = json.createdAt || Date.now();
        layer._modifiedAt = json.modifiedAt || Date.now();

        if (json.mask) {
            layer._mask = LayerMask.fromJSON(json.mask);
        }

        return layer;
    }

    // ============================================
    // Private Methods
    // ============================================

    /**
     * Update modification timestamp.
     * @private
     */
    _touch() {
        this._modifiedAt = Date.now();
    }

    /**
     * Check that the layer has not been disposed.
     * @private
     * @throws {Error} If disposed
     */
    _checkNotDisposed() {
        if (this._disposed) {
            throw new Error('Cannot modify a disposed layer');
        }
    }

    /**
     * Generate a unique layer ID.
     * @private
     * @returns {string}
     */
    static _generateId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `layer_${crypto.randomUUID()}`;
        }
        return `layer_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// ============================================
// Exports
// ============================================

export default Layer;

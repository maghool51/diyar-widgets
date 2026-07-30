// ============================================
// Paint Pro - Professional Web Graphics Application
// src/domain/document/Document.js
// Document Domain Model
// ============================================

/**
 * @module domain/document/Document
 * @description Domain model for a single paint document. Encapsulates
 * all document-level state and provides a clean API for manipulation.
 * Supports multiple simultaneous documents with complete isolation.
 * 
 * Design Principles:
 * - Pure domain logic - no UI, no rendering, no persistence
 * - Immutable operations where beneficial
 * - Validation on all state changes
 * - Observable changes via callbacks
 * - Self-contained with no external dependencies
 * 
 * Document State Includes:
 * - Metadata (name, timestamps, dimensions)
 * - Viewport (zoom, pan, rotation)
 * - Canvas properties (size, background, DPI)
 * - Guides and grid settings
 * - Modified/unsaved tracking
 * - Selection state reference
 */

// ============================================
// Document State Constants
// ============================================

/**
 * @enum {string}
 * @description Possible states of a document.
 */
export const DocumentState = Object.freeze({
    /** Document is empty (no content, no layers with data) */
    EMPTY: 'empty',

    /** Document has content and is ready for editing */
    READY: 'ready',

    /** Document has unsaved modifications */
    MODIFIED: 'modified',

    /** Document is being saved */
    SAVING: 'saving',

    /** Document is being loaded */
    LOADING: 'loading',

    /** Document has an error */
    ERROR: 'error',

    /** Document is closed/disposed */
    CLOSED: 'closed',
});

/**
 * @enum {string}
 * @description Color space modes for the document.
 */
export const ColorSpace = Object.freeze({
    /** Standard RGB (sRGB) */
    SRGB: 'srgb',

    /** Adobe RGB (wider gamut) */
    ADOBE_RGB: 'adobeRgb',

    /** Display P3 */
    DISPLAY_P3: 'displayP3',

    /** CMYK for print */
    CMYK: 'cmyk',
});

/**
 * @enum {string}
 * @description Resolution units for the document.
 */
export const ResolutionUnit = Object.freeze({
    PIXELS_PER_INCH: 'ppi',
    PIXELS_PER_CM: 'ppcm',
});

// ============================================
// Document Metadata
// ============================================

/**
 * @class DocumentMetadata
 * @description Immutable metadata value object for a document.
 */
export class DocumentMetadata {
    /**
     * @param {Object} options - Metadata options
     * @param {string} [options.name='Untitled'] - Document name
     * @param {string} [options.author=''] - Author name
     * @param {string} [options.description=''] - Document description
     * @param {string[]} [options.tags=[]] - Search tags
     * @param {string} [options.copyright=''] - Copyright information
     */
    constructor(options = {}) {
        /**
         * Document display name.
         * @type {string}
         */
        this.name = options.name || 'Untitled';

        /**
         * Author name.
         * @type {string}
         */
        this.author = options.author || '';

        /**
         * Document description.
         * @type {string}
         */
        this.description = options.description || '';

        /**
         * Search tags.
         * @type {string[]}
         */
        this.tags = Object.freeze([...(options.tags || [])]);

        /**
         * Copyright notice.
         * @type {string}
         */
        this.copyright = options.copyright || '';

        Object.freeze(this);
    }

    /**
     * Create a copy with modified properties.
     * @param {Object} updates - Properties to update
     * @returns {DocumentMetadata}
     */
    with(updates = {}) {
        return new DocumentMetadata({
            name: updates.name !== undefined ? updates.name : this.name,
            author: updates.author !== undefined ? updates.author : this.author,
            description: updates.description !== undefined ? updates.description : this.description,
            tags: updates.tags !== undefined ? updates.tags : [...this.tags],
            copyright: updates.copyright !== undefined ? updates.copyright : this.copyright,
        });
    }

    /**
     * Serialize to plain object.
     * @returns {Object}
     */
    toJSON() {
        return {
            name: this.name,
            author: this.author,
            description: this.description,
            tags: [...this.tags],
            copyright: this.copyright,
        };
    }

    /**
     * Create from plain object.
     * @param {Object} json - Serialized metadata
     * @returns {DocumentMetadata}
     */
    static fromJSON(json = {}) {
        return new DocumentMetadata(json);
    }
}

// ============================================
// Canvas Properties
// ============================================

/**
 * @class CanvasProperties
 * @description Canvas configuration for a document.
 */
export class CanvasProperties {
    /**
     * @param {Object} options - Canvas options
     * @param {number} [options.width=1920] - Canvas width in pixels
     * @param {number} [options.height=1080] - Canvas height in pixels
     * @param {number} [options.dpi=72] - Canvas resolution (DPI)
     * @param {string} [options.resolutionUnit='ppi'] - Resolution unit
     * @param {string} [options.colorSpace='srgb'] - Color space
     * @param {string} [options.backgroundColor='#FFFFFF'] - Background color
     * @param {number} [options.backgroundAlpha=1] - Background opacity
     */
    constructor(options = {}) {
        /**
         * Canvas width in pixels.
         * @type {number}
         */
        this.width = Math.max(1, Math.min(32767, options.width || 1920));

        /**
         * Canvas height in pixels.
         * @type {number}
         */
        this.height = Math.max(1, Math.min(32767, options.height || 1080));

        /**
         * Resolution in DPI or DPCM.
         * @type {number}
         */
        this.dpi = Math.max(1, Math.min(1200, options.dpi || 72));

        /**
         * Resolution unit.
         * @type {string}
         */
        this.resolutionUnit = options.resolutionUnit || ResolutionUnit.PIXELS_PER_INCH;

        /**
         * Color space.
         * @type {string}
         */
        this.colorSpace = options.colorSpace || ColorSpace.SRGB;

        /**
         * Background color (hex string).
         * @type {string}
         */
        this.backgroundColor = options.backgroundColor || '#FFFFFF';

        /**
         * Background alpha (0-1).
         * @type {number}
         */
        this.backgroundAlpha = Math.max(0, Math.min(1, options.backgroundAlpha ?? 1));

        Object.freeze(this);
    }

    /**
     * Create a copy with modified properties.
     * @param {Object} updates - Properties to update
     * @returns {CanvasProperties}
     */
    with(updates = {}) {
        return new CanvasProperties({
            width: updates.width !== undefined ? updates.width : this.width,
            height: updates.height !== undefined ? updates.height : this.height,
            dpi: updates.dpi !== undefined ? updates.dpi : this.dpi,
            resolutionUnit: updates.resolutionUnit !== undefined ? updates.resolutionUnit : this.resolutionUnit,
            colorSpace: updates.colorSpace !== undefined ? updates.colorSpace : this.colorSpace,
            backgroundColor: updates.backgroundColor !== undefined ? updates.backgroundColor : this.backgroundColor,
            backgroundAlpha: updates.backgroundAlpha !== undefined ? updates.backgroundAlpha : this.backgroundAlpha,
        });
    }

    /**
     * Calculate physical dimensions.
     * @returns {{ widthInches: number, heightInches: number }}
     */
    getPhysicalDimensions() {
        return {
            widthInches: this.width / this.dpi,
            heightInches: this.height / this.dpi,
        };
    }

    /**
     * Serialize to plain object.
     * @returns {Object}
     */
    toJSON() {
        return {
            width: this.width,
            height: this.height,
            dpi: this.dpi,
            resolutionUnit: this.resolutionUnit,
            colorSpace: this.colorSpace,
            backgroundColor: this.backgroundColor,
            backgroundAlpha: this.backgroundAlpha,
        };
    }

    /**
     * Create from plain object.
     * @param {Object} json - Serialized properties
     * @returns {CanvasProperties}
     */
    static fromJSON(json = {}) {
        return new CanvasProperties(json);
    }
}

// ============================================
// Viewport State
// ============================================

/**
 * @class ViewportState
 * @description Viewport configuration for a document (zoom and pan).
 */
export class ViewportState {
    /**
     * @param {Object} options - Viewport options
     * @param {number} [options.zoom=1] - Zoom level (0.1 to 32)
     * @param {number} [options.panX=0] - Horizontal pan offset
     * @param {number} [options.panY=0] - Vertical pan offset
     * @param {number} [options.rotation=0] - Canvas rotation (degrees)
     */
    constructor(options = {}) {
        /**
         * Zoom level.
         * @type {number}
         */
        this.zoom = Math.max(0.1, Math.min(32, options.zoom || 1));

        /**
         * Horizontal pan offset in screen pixels.
         * @type {number}
         */
        this.panX = options.panX || 0;

        /**
         * Vertical pan offset in screen pixels.
         * @type {number}
         */
        this.panY = options.panY || 0;

        /**
         * Canvas rotation in degrees.
         * @type {number}
         */
        this.rotation = ((options.rotation || 0) % 360 + 360) % 360;

        Object.freeze(this);
    }

    /**
     * Create a copy with modified properties.
     * @param {Object} updates - Properties to update
     * @returns {ViewportState}
     */
    with(updates = {}) {
        return new ViewportState({
            zoom: updates.zoom !== undefined ? updates.zoom : this.zoom,
            panX: updates.panX !== undefined ? updates.panX : this.panX,
            panY: updates.panY !== undefined ? updates.panY : this.panY,
            rotation: updates.rotation !== undefined ? updates.rotation : this.rotation,
        });
    }

    /**
     * Check if viewport is at default state.
     * @returns {boolean}
     */
    isDefault() {
        return this.zoom === 1 && this.panX === 0 && this.panY === 0 && this.rotation === 0;
    }

    /**
     * Reset to default viewport.
     * @returns {ViewportState}
     */
    reset() {
        return new ViewportState();
    }

    /**
     * Serialize to plain object.
     * @returns {Object}
     */
    toJSON() {
        return {
            zoom: this.zoom,
            panX: this.panX,
            panY: this.panY,
            rotation: this.rotation,
        };
    }

    /**
     * Create from plain object.
     * @param {Object} json - Serialized viewport
     * @returns {ViewportState}
     */
    static fromJSON(json = {}) {
        return new ViewportState(json);
    }
}

// ============================================
// Guide
// ============================================

/**
 * @class Guide
 * @description A single guide line on the canvas.
 */
export class Guide {
    /**
     * @param {Object} options - Guide options
     * @param {string} options.id - Unique identifier
     * @param {'horizontal'|'vertical'} options.orientation - Guide orientation
     * @param {number} options.position - Position in canvas pixels
     * @param {string} [options.color='#00FFFF'] - Guide color
     * @param {boolean} [options.locked=false] - Whether guide is locked
     */
    constructor(options = {}) {
        /**
         * Unique identifier.
         * @type {string}
         */
        this.id = options.id || `guide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        /**
         * Guide orientation.
         * @type {'horizontal'|'vertical'}
         */
        this.orientation = options.orientation === 'vertical' ? 'vertical' : 'horizontal';

        /**
         * Position in canvas pixels.
         * @type {number}
         */
        this.position = Math.max(0, options.position || 0);

        /**
         * Guide color.
         * @type {string}
         */
        this.color = options.color || '#00FFFF';

        /**
         * Whether the guide is locked.
         * @type {boolean}
         */
        this.locked = options.locked || false;

        Object.freeze(this);
    }

    /**
     * Move the guide to a new position.
     * @param {number} newPosition - New position
     * @returns {Guide}
     */
    moveTo(newPosition) {
        if (this.locked) return this;
        return new Guide({ ...this.toJSON(), position: newPosition });
    }

    /**
     * Serialize to plain object.
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            orientation: this.orientation,
            position: this.position,
            color: this.color,
            locked: this.locked,
        };
    }

    /**
     * Create from plain object.
     * @param {Object} json - Serialized guide
     * @returns {Guide}
     */
    static fromJSON(json = {}) {
        return new Guide(json);
    }
}

// ============================================
// Grid Settings
// ============================================

/**
 * @class GridSettings
 * @description Grid configuration for a document.
 */
export class GridSettings {
    /**
     * @param {Object} options - Grid options
     * @param {boolean} [options.visible=false] - Whether grid is shown
     * @param {number} [options.size=20] - Grid cell size in pixels
     * @param {number} [options.subdivisions=5] - Number of subdivisions
     * @param {string} [options.color='rgba(128,128,128,0.3)'] - Grid color
     * @param {boolean} [options.snapToGrid=false] - Snap to grid
     * @param {number} [options.snapThreshold=10] - Snap distance in pixels
     */
    constructor(options = {}) {
        /**
         * Whether the grid is visible.
         * @type {boolean}
         */
        this.visible = options.visible || false;

        /**
         * Grid cell size in pixels.
         * @type {number}
         */
        this.size = Math.max(1, options.size || 20);

        /**
         * Number of subdivisions per cell.
         * @type {number}
         */
        this.subdivisions = Math.max(1, Math.min(20, options.subdivisions || 5));

        /**
         * Grid line color.
         * @type {string}
         */
        this.color = options.color || 'rgba(128, 128, 128, 0.3)';

        /**
         * Whether to snap to grid.
         * @type {boolean}
         */
        this.snapToGrid = options.snapToGrid || false;

        /**
         * Snap distance threshold in pixels.
         * @type {number}
         */
        this.snapThreshold = Math.max(1, options.snapThreshold || 10);

        Object.freeze(this);
    }

    /**
     * Create a copy with modified properties.
     * @param {Object} updates - Properties to update
     * @returns {GridSettings}
     */
    with(updates = {}) {
        return new GridSettings({
            visible: updates.visible !== undefined ? updates.visible : this.visible,
            size: updates.size !== undefined ? updates.size : this.size,
            subdivisions: updates.subdivisions !== undefined ? updates.subdivisions : this.subdivisions,
            color: updates.color !== undefined ? updates.color : this.color,
            snapToGrid: updates.snapToGrid !== undefined ? updates.snapToGrid : this.snapToGrid,
            snapThreshold: updates.snapThreshold !== undefined ? updates.snapThreshold : this.snapThreshold,
        });
    }

    /**
     * Toggle grid visibility.
     * @returns {GridSettings}
     */
    toggle() {
        return this.with({ visible: !this.visible });
    }

    /**
     * Snap a value to the nearest grid line.
     * @param {number} value - Value to snap
     * @returns {number}
     */
    snap(value) {
        if (!this.snapToGrid) return value;

        const snapped = Math.round(value / this.size) * this.size;
        const distance = Math.abs(snapped - value);

        return distance <= this.snapThreshold ? snapped : value;
    }

    /**
     * Snap a point to the nearest grid intersection.
     * @param {{x: number, y: number}} point - Point to snap
     * @returns {{x: number, y: number}}
     */
    snapPoint(point) {
        return {
            x: this.snap(point.x),
            y: this.snap(point.y),
        };
    }

    /**
     * Serialize to plain object.
     * @returns {Object}
     */
    toJSON() {
        return {
            visible: this.visible,
            size: this.size,
            subdivisions: this.subdivisions,
            color: this.color,
            snapToGrid: this.snapToGrid,
            snapThreshold: this.snapThreshold,
        };
    }

    /**
     * Create from plain object.
     * @param {Object} json - Serialized grid settings
     * @returns {GridSettings}
     */
    static fromJSON(json = {}) {
        return new GridSettings(json);
    }
}

// ============================================
// Document Class
// ============================================

/**
 * @class Document
 * @description Core document domain model representing a single open project.
 * Encapsulates all document state and provides methods for state transitions.
 * Supports change notification via an onChange callback.
 * 
 * @example
 * const doc = new Document({ name: 'My Artwork', canvas: { width: 1920, height: 1080 } });
 * 
 * doc.onChange((event, doc) => {
 *     console.log(`Document changed: ${event}`);
 * });
 * 
 * doc.setZoom(2);
 * doc.addGuide({ orientation: 'vertical', position: 500 });
 * doc.markModified();
 */
export class Document {
    /**
     * @param {Object} options - Document options
     * @param {string} [options.id] - Unique document ID (generated if not provided)
     * @param {DocumentMetadata|Object} [options.metadata] - Document metadata
     * @param {CanvasProperties|Object} [options.canvas] - Canvas properties
     * @param {ViewportState|Object} [options.viewport] - Initial viewport state
     * @param {GridSettings|Object} [options.grid] - Grid settings
     */
    constructor(options = {}) {
        /**
         * Unique document identifier.
         * @private
         * @type {string}
         */
        this._id = options.id || Document._generateId();

        /**
         * Document metadata.
         * @private
         * @type {DocumentMetadata}
         */
        this._metadata = options.metadata instanceof DocumentMetadata
            ? options.metadata
            : new DocumentMetadata(options.metadata);

        /**
         * Canvas properties.
         * @private
         * @type {CanvasProperties}
         */
        this._canvas = options.canvas instanceof CanvasProperties
            ? options.canvas
            : new CanvasProperties(options.canvas);

        /**
         * Current viewport state.
         * @private
         * @type {ViewportState}
         */
        this._viewport = options.viewport instanceof ViewportState
            ? options.viewport
            : new ViewportState(options.viewport);

        /**
         * Grid settings.
         * @private
         * @type {GridSettings}
         */
        this._grid = options.grid instanceof GridSettings
            ? options.grid
            : new GridSettings(options.grid);

        /**
         * Document guides.
         * @private
         * @type {Guide[]}
         */
        this._guides = [];

        /**
         * Current document state.
         * @private
         * @type {string}
         */
        this._state = DocumentState.EMPTY;

        /**
         * Whether the document has unsaved changes.
         * @private
         * @type {boolean}
         */
        this._isModified = false;

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
         * Change listeners.
         * @private
         * @type {Set<Function>}
         */
        this._listeners = new Set();

        /**
         * Whether the document has been closed.
         * @private
         * @type {boolean}
         */
        this._isClosed = false;

        // Freeze initial state
        this._freezeState();
    }

    // ============================================
    // Getters
    // ============================================

    /** @returns {string} */
    get id() { return this._id; }

    /** @returns {string} */
    get name() { return this._metadata.name; }

    /** @returns {DocumentMetadata} */
    get metadata() { return this._metadata; }

    /** @returns {CanvasProperties} */
    get canvas() { return this._canvas; }

    /** @returns {ViewportState} */
    get viewport() { return this._viewport; }

    /** @returns {GridSettings} */
    get grid() { return this._grid; }

    /** @returns {Guide[]} */
    get guides() { return [...this._guides]; }

    /** @returns {string} */
    get state() { return this._state; }

    /** @returns {boolean} */
    get isModified() { return this._isModified; }

    /** @returns {boolean} */
    get isClosed() { return this._isClosed; }

    /** @returns {number} */
    get createdAt() { return this._createdAt; }

    /** @returns {number} */
    get modifiedAt() { return this._modifiedAt; }

    // ============================================
    // Public API - Name & Metadata
    // ============================================

    /**
     * Rename the document.
     * @param {string} name - New document name
     */
    setName(name) {
        this._checkNotClosed();
        if (typeof name !== 'string' || name.trim().length === 0) {
            throw new Error('Document name must be a non-empty string');
        }

        this._metadata = this._metadata.with({ name: name.trim() });
        this._touch();
        this._notify('nameChanged', { name: this._metadata.name });
    }

    /**
     * Update document metadata.
     * @param {Object} updates - Metadata updates
     */
    updateMetadata(updates) {
        this._checkNotClosed();
        this._metadata = this._metadata.with(updates);
        this._touch();
        this._notify('metadataChanged', { metadata: this._metadata });
    }

    // ============================================
    // Public API - Canvas
    // ============================================

    /**
     * Resize the canvas.
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resizeCanvas(width, height) {
        this._checkNotClosed();

        if (typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Width and height must be numbers');
        }

        this._canvas = this._canvas.with({
            width: Math.max(1, Math.min(32767, Math.round(width))),
            height: Math.max(1, Math.min(32767, Math.round(height))),
        });

        this._touch();
        this._notify('canvasResized', { canvas: this._canvas });
    }

    /**
     * Set canvas background color.
     * @param {string} color - Hex color string
     */
    setBackgroundColor(color) {
        this._checkNotClosed();

        if (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
            throw new Error('Background color must be a valid hex color (e.g., #FFFFFF)');
        }

        this._canvas = this._canvas.with({ backgroundColor: color.toUpperCase() });
        this._touch();
        this._notify('backgroundChanged', { backgroundColor: this._canvas.backgroundColor });
    }

    // ============================================
    // Public API - Viewport
    // ============================================

    /**
     * Set the zoom level.
     * @param {number} zoom - Zoom level (0.1 to 32)
     */
    setZoom(zoom) {
        this._checkNotClosed();

        const clampedZoom = Math.max(0.1, Math.min(32, zoom));
        this._viewport = this._viewport.with({ zoom: clampedZoom });
        this._notify('zoomChanged', { zoom: clampedZoom });
    }

    /**
     * Set the pan position.
     * @param {number} panX - Horizontal pan
     * @param {number} panY - Vertical pan
     */
    setPan(panX, panY) {
        this._checkNotClosed();

        this._viewport = this._viewport.with({ panX, panY });
        this._notify('panChanged', { panX, panY });
    }

    /**
     * Reset the viewport to default.
     */
    resetViewport() {
        this._checkNotClosed();

        this._viewport = this._viewport.reset();
        this._notify('viewportReset', { viewport: this._viewport });
    }

    /**
     * Fit the entire canvas in view.
     * @param {number} containerWidth - Container width in pixels
     * @param {number} containerHeight - Container height in pixels
     */
    fitToScreen(containerWidth, containerHeight) {
        this._checkNotClosed();

        const scaleX = (containerWidth * 0.9) / this._canvas.width;
        const scaleY = (containerHeight * 0.9) / this._canvas.height;
        const zoom = Math.min(scaleX, scaleY, 1);

        this._viewport = this._viewport.with({ zoom, panX: 0, panY: 0 });
        this._notify('viewportChanged', { viewport: this._viewport });
    }

    // ============================================
    // Public API - Grid
    // ============================================

    /**
     * Set grid visibility.
     * @param {boolean} visible - Whether grid is visible
     */
    setGridVisible(visible) {
        this._checkNotClosed();

        this._grid = this._grid.with({ visible: !!visible });
        this._notify('gridChanged', { grid: this._grid });
    }

    /**
     * Toggle grid visibility.
     */
    toggleGrid() {
        this.setGridVisible(!this._grid.visible);
    }

    /**
     * Update grid settings.
     * @param {Object} updates - Grid setting updates
     */
    updateGrid(updates) {
        this._checkNotClosed();

        this._grid = this._grid.with(updates);
        this._notify('gridChanged', { grid: this._grid });
    }

    // ============================================
    // Public API - Guides
    // ============================================

    /**
     * Add a guide to the document.
     * @param {Object} options - Guide options
     * @returns {Guide} The created guide
     */
    addGuide(options = {}) {
        this._checkNotClosed();

        const guide = new Guide(options);
        this._guides.push(guide);
        this._touch();
        this._notify('guideAdded', { guide });
        return guide;
    }

    /**
     * Remove a guide by ID.
     * @param {string} guideId - Guide identifier
     * @returns {boolean} True if guide was found and removed
     */
    removeGuide(guideId) {
        this._checkNotClosed();

        const index = this._guides.findIndex(g => g.id === guideId);
        if (index === -1) return false;

        const removed = this._guides.splice(index, 1)[0];
        this._touch();
        this._notify('guideRemoved', { guide: removed });
        return true;
    }

    /**
     * Move a guide to a new position.
     * @param {string} guideId - Guide identifier
     * @param {number} newPosition - New position
     * @returns {boolean} True if guide was found and moved
     */
    moveGuide(guideId, newPosition) {
        this._checkNotClosed();

        const index = this._guides.findIndex(g => g.id === guideId);
        if (index === -1) return false;

        const guide = this._guides[index];
        this._guides[index] = guide.moveTo(newPosition);
        this._touch();
        this._notify('guideMoved', { guide: this._guides[index] });
        return true;
    }

    /**
     * Clear all guides.
     */
    clearGuides() {
        this._checkNotClosed();

        const count = this._guides.length;
        this._guides = [];
        this._touch();
        this._notify('guidesCleared', { count });
    }

    // ============================================
    // Public API - State Management
    // ============================================

    /**
     * Mark the document as modified.
     */
    markModified() {
        this._checkNotClosed();

        if (!this._isModified) {
            this._isModified = true;
            this._state = DocumentState.MODIFIED;
            this._modifiedAt = Date.now();
            this._notify('modifiedStateChanged', { isModified: true });
        }
    }

    /**
     * Mark the document as saved.
     */
    markSaved() {
        this._checkNotClosed();

        if (this._isModified) {
            this._isModified = false;
            this._state = DocumentState.READY;
            this._notify('modifiedStateChanged', { isModified: false });
        }
    }

    /**
     * Set the document state.
     * @param {string} state - New state from DocumentState
     */
    setState(state) {
        this._checkNotClosed();

        if (!Object.values(DocumentState).includes(state)) {
            throw new Error(`Invalid document state: ${state}`);
        }

        const previousState = this._state;
        this._state = state;
        this._notify('stateChanged', { state, previousState });
    }

    // ============================================
    // Public API - Change Notification
    // ============================================

    /**
     * Register a change listener.
     * @param {Function} listener - Callback(eventName, document)
     * @returns {Function} Unsubscribe function
     */
    onChange(listener) {
        this._listeners.add(listener);

        return () => {
            this._listeners.delete(listener);
        };
    }

    // ============================================
    // Public API - Lifecycle
    // ============================================

    /**
     * Close the document.
     * After closing, the document cannot be modified.
     */
    close() {
        if (this._isClosed) return;

        this._isClosed = true;
        this._state = DocumentState.CLOSED;
        this._notify('closed', {});
        this._listeners.clear();
    }

    // ============================================
    // Public API - Serialization
    // ============================================

    /**
     * Serialize the document to a plain object.
     * Does not include layer data (handled by LayerManager).
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this._id,
            metadata: this._metadata.toJSON(),
            canvas: this._canvas.toJSON(),
            viewport: this._viewport.toJSON(),
            grid: this._grid.toJSON(),
            guides: this._guides.map(g => g.toJSON()),
            state: this._state,
            isModified: this._isModified,
            createdAt: this._createdAt,
            modifiedAt: this._modifiedAt,
        };
    }

    /**
     * Create a Document from a plain object.
     * @param {Object} json - Serialized document
     * @returns {Document}
     */
    static fromJSON(json = {}) {
        const doc = new Document({
            id: json.id,
            metadata: DocumentMetadata.fromJSON(json.metadata),
            canvas: CanvasProperties.fromJSON(json.canvas),
            viewport: ViewportState.fromJSON(json.viewport),
            grid: GridSettings.fromJSON(json.grid),
        });

        // Restore guides
        if (Array.isArray(json.guides)) {
            doc._guides = json.guides.map(g => Guide.fromJSON(g));
        }

        // Restore state
        doc._state = json.state || DocumentState.EMPTY;
        doc._isModified = json.isModified || false;
        doc._createdAt = json.createdAt || Date.now();
        doc._modifiedAt = json.modifiedAt || Date.now();

        return doc;
    }

    // ============================================
    // Private Methods
    // ============================================

    /**
     * Update modification timestamp and mark as modified.
     * @private
     */
    _touch() {
        this._modifiedAt = Date.now();
        this.markModified();
    }

    /**
     * Notify all listeners of a change.
     * @private
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    _notify(event, data) {
        for (const listener of this._listeners) {
            try {
                listener(event, { ...data, document: this });
            } catch (error) {
                console.error(`Document listener error for "${event}":`, error);
            }
        }
    }

    /**
     * Freeze state objects to prevent mutation.
     * @private
     */
    _freezeState() {
        // Metadata, canvas, viewport, and grid are already frozen by their constructors
    }

    /**
     * Check that the document is not closed.
     * @private
     * @throws {Error} If the document is closed
     */
    _checkNotClosed() {
        if (this._isClosed) {
            throw new Error('Cannot modify a closed document');
        }
    }

    /**
     * Generate a unique document ID.
     * @private
     * @returns {string}
     */
    static _generateId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `doc_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// ============================================
// Exports
// ============================================

export default Document;

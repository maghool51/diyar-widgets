// ============================================
// Paint Pro - Professional Web Graphics Application
// src/domain/layer/LayerManager.js
// Layer Hierarchy Manager
// ============================================

import { Layer, LayerType } from './Layer.js';
import { LayerEvents } from '../../core/event-bus/EventTypes.js';

/**
 * @class LayerManager
 * @description Manages the complete layer hierarchy for a single document.
 * Provides CRUD operations, ordering, grouping, merging, flattening, and
 * layer selection tracking. This is the authoritative source for the layer
 * list that renderers and tools query.
 * 
 * Layer Ordering:
 * Layers are maintained in z-order from bottom (index 0) to top (index N-1).
 * The active layer is the one currently being edited.
 * 
 * Constraints:
 * - Always at least one layer exists
 * - Only one layer can be active at a time
 * - Background layer (if present) is always at the bottom
 * - Layer names must be unique within a document
 * 
 * @example
 * const layerManager = new LayerManager(eventBus, { canvasWidth: 1920, canvasHeight: 1080 });
 * 
 * // Add a new layer
 * const newLayer = layerManager.addLayer({ name: 'My Layer' });
 * 
 * // Move layer up
 * layerManager.moveLayerUp(newLayer.id);
 * 
 * // Delete a layer
 * layerManager.deleteLayer(newLayer.id);
 */
export class LayerManager {
    /**
     * @param {EventBus} eventBus - Event bus for layer events
     * @param {Object} [options={}] - Configuration options
     * @param {number} [options.canvasWidth=1920] - Default canvas width for new layers
     * @param {number} [options.canvasHeight=1080] - Default canvas height for new layers
     * @param {number} [options.maxLayers=999] - Maximum number of layers allowed
     * @param {boolean} [options.autoName=true] - Auto-generate unique layer names
     */
    constructor(eventBus, options = {}) {
        if (!eventBus) {
            throw new Error('LayerManager requires an EventBus instance');
        }

        /**
         * Event bus for layer lifecycle events.
         * @private
         * @type {EventBus}
         */
        this._eventBus = eventBus;

        /**
         * Array of layers in z-order (index 0 = bottom, last = top).
         * @private
         * @type {Layer[]}
         */
        this._layers = [];

        /**
         * Map for fast layer lookup by ID.
         * @private
         * @type {Map<string, Layer>}
         */
        this._layerMap = new Map();

        /**
         * ID of the currently active (selected) layer.
         * @private
         * @type {string|null}
         */
        this._activeLayerId = null;

        /**
         * Configuration options.
         * @private
         * @type {Object}
         */
        this._options = Object.freeze({
            canvasWidth: options.canvasWidth || 1920,
            canvasHeight: options.canvasHeight || 1080,
            maxLayers: options.maxLayers || 999,
            autoName: options.autoName !== false,
        });

        /**
         * Auto-incrementing layer name counter.
         * @private
         * @type {number}
         */
        this._layerNameCounter = 0;

        /**
         * Whether the manager has been disposed.
         * @private
         * @type {boolean}
         */
        this._disposed = false;

        // Create the default background layer
        this._createInitialLayer();
    }

    // ============================================
    // Getters
    // ============================================

    /**
     * Get all layers in z-order (bottom to top).
     * Returns a frozen copy to prevent external mutation.
     * @returns {ReadonlyArray<Layer>}
     */
    get layers() {
        return Object.freeze([...this._layers]);
    }

    /**
     * Get the number of layers.
     * @returns {number}
     */
    get layerCount() {
        return this._layers.length;
    }

    /**
     * Get the active layer.
     * @returns {Layer|null}
     */
    get activeLayer() {
        if (!this._activeLayerId) return null;
        return this._layerMap.get(this._activeLayerId) || null;
    }

    /**
     * Get the active layer ID.
     * @returns {string|null}
     */
    get activeLayerId() {
        return this._activeLayerId;
    }

    /**
     * Get the background layer (if any).
     * @returns {Layer|null}
     */
    get backgroundLayer() {
        return this._layers.find(l => l.isBackground) || null;
    }

    /**
     * Check if another layer can be added.
     * @returns {boolean}
     */
    get canAddLayer() {
        return this._layers.length < this._options.maxLayers;
    }

    // ============================================
    // Public API - Layer Creation
    // ============================================

    /**
     * Add a new empty layer above the active layer.
     * 
     * @param {Object} [options={}] - Layer options
     * @param {string} [options.name] - Layer name (auto-generated if not provided)
     * @param {string} [options.type='pixel'] - Layer type
     * @param {number} [options.opacity=1] - Initial opacity
     * @param {string} [options.blendMode='normal'] - Blend mode
     * @param {boolean} [options.makeActive=true] - Make this the active layer
     * @returns {Layer} The created layer
     * @throws {Error} If maximum layer count is reached
     */
    addLayer(options = {}) {
        this._validateNotDisposed();

        if (!this.canAddLayer) {
            throw new Error(
                `Maximum number of layers reached (${this._options.maxLayers}). ` +
                'Delete some layers before adding new ones.'
            );
        }

        // Generate layer name
        const name = options.name || this._generateLayerName();

        // Determine insertion index (above active layer or at top)
        const activeIndex = this._activeLayerId
            ? this._getLayerIndex(this._activeLayerId)
            : this._layers.length - 1;
        const insertIndex = activeIndex >= 0 ? activeIndex + 1 : this._layers.length;

        // Create the layer
        const layer = new Layer({
            name,
            type: options.type || LayerType.PIXEL,
            width: this._options.canvasWidth,
            height: this._options.canvasHeight,
            opacity: options.opacity ?? 1,
            blendMode: options.blendMode || 'normal',
            visible: true,
            locked: false,
            order: insertIndex,
        });

        // Insert into layer list
        this._layers.splice(insertIndex, 0, layer);
        this._layerMap.set(layer.id, layer);

        // Reorder all layers after insertion point
        this._reorderFromIndex(insertIndex);

        // Set as active if requested
        if (options.makeActive !== false) {
            this._setActiveLayer(layer.id);
        }

        // Emit event
        this._eventBus.emitSync(LayerEvents.ADDED, {
            layerId: layer.id,
            layer: layer.toJSON(),
            index: insertIndex,
        });

        return layer;
    }

    /**
     * Duplicate an existing layer.
     * 
     * @param {string} layerId - ID of layer to duplicate
     * @param {Object} [options={}] - Override options for the new layer
     * @returns {Layer|null} The duplicated layer or null if source not found
     */
    duplicateLayer(layerId, options = {}) {
        const sourceLayer = this._layerMap.get(layerId);
        if (!sourceLayer) return null;

        const newLayer = this.addLayer({
            name: options.name || `${sourceLayer.name} (Copy)`,
            type: sourceLayer.type,
            opacity: sourceLayer.opacity,
            blendMode: sourceLayer.blendMode,
            ...options,
        });

        // Note: Actual pixel data duplication is handled by the rendering system
        // via events. This method creates the layer structure only.

        this._eventBus.emitSync(LayerEvents.DUPLICATED, {
            sourceLayerId: layerId,
            newLayerId: newLayer.id,
        });

        return newLayer;
    }

    // ============================================
    // Public API - Layer Deletion
    // ============================================

    /**
     * Delete a layer by ID.
     * At least one layer must remain. Background layer cannot be deleted.
     * 
     * @param {string} layerId - ID of layer to delete
     * @returns {boolean} True if the layer was deleted
     */
    deleteLayer(layerId) {
        this._validateNotDisposed();

        const layer = this._layerMap.get(layerId);
        if (!layer) return false;

        // Prevent deleting the only remaining layer
        if (this._layers.length <= 1) {
            return false;
        }

        // Prevent deleting background layer directly
        if (layer.isBackground) {
            return false;
        }

        const index = this._getLayerIndex(layerId);
        if (index === -1) return false;

        // If deleting active layer, activate another layer first
        if (layerId === this._activeLayerId) {
            const newActiveIndex = Math.max(0, index - 1);
            this._setActiveLayer(this._layers[newActiveIndex].id);
        }

        // Remove the layer
        this._layers.splice(index, 1);
        this._layerMap.delete(layerId);

        // Reorder remaining layers
        this._reorderFromIndex(index);

        // Dispose the layer
        const layerData = layer.toJSON();
        layer.dispose();

        // Emit event
        this._eventBus.emitSync(LayerEvents.REMOVED, {
            layerId,
            layer: layerData,
            index,
        });

        return true;
    }

    /**
     * Clear all layers and create a fresh default layer.
     */
    clearAllLayers() {
        this._validateNotDisposed();

        const oldLayers = [...this._layers];

        // Dispose all existing layers
        for (const layer of oldLayers) {
            layer.dispose();
        }

        // Reset
        this._layers = [];
        this._layerMap.clear();
        this._activeLayerId = null;
        this._layerNameCounter = 0;

        // Create fresh default layer
        this._createInitialLayer();

        // Emit event
        this._eventBus.emitSync(LayerEvents.FLATTENED, {
            previousCount: oldLayers.length,
        });
    }

    // ============================================
    // Public API - Layer Access
    // ============================================

    /**
     * Get a layer by ID.
     * @param {string} layerId - Layer identifier
     * @returns {Layer|undefined}
     */
    getLayer(layerId) {
        return this._layerMap.get(layerId);
    }

    /**
     * Get the index of a layer in the z-order.
     * @param {string} layerId - Layer identifier
     * @returns {number} Layer index or -1 if not found
     */
    getLayerIndex(layerId) {
        return this._getLayerIndex(layerId);
    }

    /**
     * Check if a layer exists.
     * @param {string} layerId - Layer identifier
     * @returns {boolean}
     */
    hasLayer(layerId) {
        return this._layerMap.has(layerId);
    }

    /**
     * Get layers above a given layer.
     * @param {string} layerId - Reference layer ID
     * @returns {Layer[]}
     */
    getLayersAbove(layerId) {
        const index = this._getLayerIndex(layerId);
        if (index === -1) return [];
        return this._layers.slice(index + 1);
    }

    /**
     * Get layers below a given layer.
     * @param {string} layerId - Reference layer ID
     * @returns {Layer[]}
     */
    getLayersBelow(layerId) {
        const index = this._getLayerIndex(layerId);
        if (index === -1) return [];
        return this._layers.slice(0, index);
    }

    // ============================================
    // Public API - Active Layer
    // ============================================

    /**
     * Set the active (selected) layer by ID.
     * @param {string} layerId - Layer to activate
     * @returns {boolean} True if the layer was found and activated
     */
    setActiveLayer(layerId) {
        this._validateNotDisposed();
        return this._setActiveLayer(layerId);
    }

    /**
     * Activate the layer above the current active layer.
     * @returns {boolean} True if switched
     */
    activateLayerAbove() {
        const currentIndex = this._getLayerIndex(this._activeLayerId);
        if (currentIndex < this._layers.length - 1) {
            return this._setActiveLayer(this._layers[currentIndex + 1].id);
        }
        return false;
    }

    /**
     * Activate the layer below the current active layer.
     * @returns {boolean} True if switched
     */
    activateLayerBelow() {
        const currentIndex = this._getLayerIndex(this._activeLayerId);
        if (currentIndex > 0) {
            return this._setActiveLayer(this._layers[currentIndex - 1].id);
        }
        return false;
    }

    // ============================================
    // Public API - Layer Ordering
    // ============================================

    /**
     * Move a layer up in the z-order (toward the top).
     * @param {string} layerId - Layer to move
     * @returns {boolean} True if moved
     */
    moveLayerUp(layerId) {
        const index = this._getLayerIndex(layerId);
        if (index === -1 || index >= this._layers.length - 1) return false;

        const layer = this._layers[index];
        if (layer.isBackground) return false; // Background always at bottom

        // Swap with layer above
        this._layers[index] = this._layers[index + 1];
        this._layers[index + 1] = layer;
        this._reorderFromIndex(index);

        this._eventBus.emitSync(LayerEvents.REORDERED, {
            layerId,
            fromIndex: index,
            toIndex: index + 1,
        });

        return true;
    }

    /**
     * Move a layer down in the z-order (toward the bottom).
     * @param {string} layerId - Layer to move
     * @returns {boolean} True if moved
     */
    moveLayerDown(layerId) {
        const index = this._getLayerIndex(layerId);
        if (index <= 0) return false;

        const targetLayer = this._layers[index - 1];
        if (targetLayer.isBackground) return false; // Cannot go below background

        // Swap with layer below
        const layer = this._layers[index];
        this._layers[index] = this._layers[index - 1];
        this._layers[index - 1] = layer;
        this._reorderFromIndex(index - 1);

        this._eventBus.emitSync(LayerEvents.REORDERED, {
            layerId,
            fromIndex: index,
            toIndex: index - 1,
        });

        return true;
    }

    /**
     * Move a layer to a specific index.
     * @param {string} layerId - Layer to move
     * @param {number} targetIndex - Target z-order index
     * @returns {boolean} True if moved
     */
    moveLayerTo(layerId, targetIndex) {
        const currentIndex = this._getLayerIndex(layerId);
        if (currentIndex === -1) return false;

        const layer = this._layers[currentIndex];
        if (layer.isBackground && targetIndex !== 0) return false;

        // Clamp target index
        const clampedIndex = Math.max(0, Math.min(this._layers.length - 1, targetIndex));
        if (clampedIndex === currentIndex) return false;

        // Don't allow moving below background
        if (clampedIndex === 0 && this._layers[0].isBackground && !layer.isBackground) {
            return false;
        }

        // Remove and insert
        this._layers.splice(currentIndex, 1);
        this._layers.splice(clampedIndex, 0, layer);
        this._reorderFromIndex(Math.min(currentIndex, clampedIndex));

        this._eventBus.emitSync(LayerEvents.REORDERED, {
            layerId,
            fromIndex: currentIndex,
            toIndex: clampedIndex,
        });

        return true;
    }

    /**
     * Bring layer to the front (top of z-order).
     * @param {string} layerId - Layer to bring to front
     * @returns {boolean} True if moved
     */
    bringToFront(layerId) {
        return this.moveLayerTo(layerId, this._layers.length - 1);
    }

    /**
     * Send layer to the back (bottom of z-order).
     * @param {string} layerId - Layer to send to back
     * @returns {boolean} True if moved
     */
    sendToBack(layerId) {
        const targetIndex = this._layers[0]?.isBackground ? 1 : 0;
        return this.moveLayerTo(layerId, targetIndex);
    }

    // ============================================
    // Public API - Layer Operations
    // ============================================

    /**
     * Merge the active layer down into the layer below.
     * The active layer is removed after merging.
     * @returns {boolean} True if merged
     */
    mergeDown() {
        if (!this._activeLayerId) return false;

        const activeIndex = this._getLayerIndex(this._activeLayerId);
        if (activeIndex <= 0) return false;

        const topLayer = this._layers[activeIndex];
        const bottomLayer = this._layers[activeIndex - 1];

        if (bottomLayer.isBackground && bottomLayer.locked) return false;

        this._eventBus.emitSync(LayerEvents.MERGED, {
            topLayerId: topLayer.id,
            bottomLayerId: bottomLayer.id,
            topLayer: topLayer.toJSON(),
            bottomLayer: bottomLayer.toJSON(),
        });

        // Delete the top layer (actual pixel merging handled by renderer)
        this.deleteLayer(topLayer.id);

        return true;
    }

    /**
     * Merge all visible layers into a single layer.
     * @returns {Layer} The merged layer
     */
    flattenImage() {
        this._eventBus.emitSync(LayerEvents.FLATTENED, {
            layerCount: this._layers.length,
        });

        // Keep only the first visible layer, dispose the rest
        const visibleLayers = this._layers.filter(l => l.visible);
        const firstLayer = visibleLayers[0];

        if (!firstLayer) return this._layers[0];

        // Dispose all other layers
        for (const layer of this._layers) {
            if (layer.id !== firstLayer.id) {
                this._layerMap.delete(layer.id);
                layer.dispose();
            }
        }

        this._layers = [firstLayer];
        firstLayer.setOrder(0);
        this._setActiveLayer(firstLayer.id);

        return firstLayer;
    }

    /**
     * Rasterize a layer (convert text/vector to pixel layer).
     * @param {string} layerId - Layer to rasterize
     * @returns {boolean} True if rasterized
     */
    rasterizeLayer(layerId) {
        const layer = this._layerMap.get(layerId);
        if (!layer) return false;
        if (layer.type === LayerType.PIXEL) return true; // Already raster

        layer.setType(LayerType.PIXEL);
        this._eventBus.emitSync(LayerEvents.CONTENT_CHANGED, {
            layerId,
            change: 'rasterized',
        });

        return true;
    }

    // ============================================
    // Public API - Layer Properties
    // ============================================

    /**
     * Rename a layer.
     * @param {string} layerId - Layer identifier
     * @param {string} newName - New layer name
     * @returns {boolean} True if renamed
     */
    renameLayer(layerId, newName) {
        const layer = this._layerMap.get(layerId);
        if (!layer) return false;

        // Check for duplicate names
        if (this._isNameTaken(newName, layerId)) {
            return false;
        }

        layer.setName(newName);

        this._eventBus.emitSync(LayerEvents.RENAMED, {
            layerId,
            name: newName,
        });

        return true;
    }

    /**
     * Set layer visibility.
     * @param {string} layerId - Layer identifier
     * @param {boolean} visible - Visibility state
     */
    setLayerVisibility(layerId, visible) {
        const layer = this._layerMap.get(layerId);
        if (layer) {
            layer.setVisible(visible);

            this._eventBus.emitSync(LayerEvents.VISIBILITY_CHANGED, {
                layerId,
                visible,
            });
        }
    }

    /**
     * Set layer opacity.
     * @param {string} layerId - Layer identifier
     * @param {number} opacity - Opacity (0-1)
     */
    setLayerOpacity(layerId, opacity) {
        const layer = this._layerMap.get(layerId);
        if (layer) {
            layer.setOpacity(opacity);

            this._eventBus.emitSync(LayerEvents.OPACITY_CHANGED, {
                layerId,
                opacity,
            });
        }
    }

    /**
     * Set layer blend mode.
     * @param {string} layerId - Layer identifier
     * @param {string} blendMode - Blend mode
     */
    setLayerBlendMode(layerId, blendMode) {
        const layer = this._layerMap.get(layerId);
        if (layer) {
            layer.setBlendMode(blendMode);

            this._eventBus.emitSync(LayerEvents.BLEND_MODE_CHANGED, {
                layerId,
                blendMode,
            });
        }
    }

    /**
     * Lock/unlock a layer.
     * @param {string} layerId - Layer identifier
     * @param {boolean} locked - Lock state
     */
    setLayerLock(layerId, locked) {
        const layer = this._layerMap.get(layerId);
        if (layer) {
            if (locked) layer.lock();
            else layer.unlock();

            this._eventBus.emitSync(LayerEvents.LOCK_CHANGED, {
                layerId,
                locked,
            });
        }
    }

    // ============================================
    // Public API - Queries
    // ============================================

    /**
     * Get visible layers in z-order.
     * @returns {Layer[]}
     */
    getVisibleLayers() {
        return this._layers.filter(l => l.visible);
    }

    /**
     * Get editable layers (visible and unlocked).
     * @returns {Layer[]}
     */
    getEditableLayers() {
        return this._layers.filter(l => l.isEditable);
    }

    /**
     * Find a layer by name (case-insensitive).
     * @param {string} name - Layer name to find
     * @returns {Layer|undefined}
     */
    findLayerByName(name) {
        const lowerName = name.toLowerCase();
        return this._layers.find(l => l.name.toLowerCase() === lowerName);
    }

    /**
     * Get layer summary list for UI display.
     * @returns {Array<Object>}
     */
    getLayerSummaries() {
        return this._layers.map((layer, index) => ({
            id: layer.id,
            name: layer.name,
            type: layer.type,
            visible: layer.visible,
            locked: layer.locked,
            opacity: layer.opacity,
            blendMode: layer.blendMode,
            isActive: layer.id === this._activeLayerId,
            isBackground: layer.isBackground,
            hasMask: layer.hasMask,
            index,
        }));
    }

    // ============================================
    // Public API - Serialization
    // ============================================

    /**
     * Serialize all layers to an array of plain objects.
     * Pixel data is not included (handled separately by renderer).
     * @returns {Object[]}
     */
    serialize() {
        return this._layers.map(layer => layer.toJSON());
    }

    /**
     * Restore layers from serialized data.
     * @param {Object[]} data - Array of serialized layer objects
     */
    deserialize(data) {
        if (!Array.isArray(data)) return;

        // Dispose existing layers
        for (const layer of this._layers) {
            layer.dispose();
        }

        this._layers = [];
        this._layerMap.clear();
        this._activeLayerId = null;

        // Restore layers
        for (const layerData of data) {
            const layer = Layer.fromJSON(layerData);
            this._layers.push(layer);
            this._layerMap.set(layer.id, layer);
        }

        // Sort by order
        this._layers.sort((a, b) => a.order - b.order);
        this._reorderFromIndex(0);

        // Set active to topmost visible layer
        const topVisible = [...this._layers].reverse().find(l => l.visible);
        if (topVisible) {
            this._setActiveLayer(topVisible.id);
        } else if (this._layers.length > 0) {
            this._setActiveLayer(this._layers[this._layers.length - 1].id);
        }
    }

    // ============================================
    // Public API - Disposal
    // ============================================

    /**
     * Dispose the layer manager and all layers.
     */
    dispose() {
        if (this._disposed) return;

        for (const layer of this._layers) {
            layer.dispose();
        }

        this._layers = [];
        this._layerMap.clear();
        this._activeLayerId = null;
        this._disposed = true;
    }

    // ============================================
    // Private Methods - Initialization
    // ============================================

    /**
     * Create the initial default background layer.
     * @private
     */
    _createInitialLayer() {
        const layer = new Layer({
            name: 'Background',
            type: LayerType.PIXEL,
            width: this._options.canvasWidth,
            height: this._options.canvasHeight,
            opacity: 1,
            blendMode: 'normal',
            visible: true,
            locked: true,
            order: 0,
        });

        layer.markAsBackground();

        this._layers.push(layer);
        this._layerMap.set(layer.id, layer);
        this._activeLayerId = layer.id;
    }

    // ============================================
    // Private Methods - Internal
    // ============================================

    /**
     * Set the active layer internally.
     * @private
     * @param {string} layerId - Layer ID to activate
     * @returns {boolean}
     */
    _setActiveLayer(layerId) {
        if (!this._layerMap.has(layerId)) return false;
        if (this._activeLayerId === layerId) return true;

        const previousId = this._activeLayerId;
        this._activeLayerId = layerId;

        this._eventBus.emitSync(LayerEvents.ACTIVE_CHANGED, {
            previousLayerId: previousId,
            activeLayerId: layerId,
        });

        return true;
    }

    /**
     * Get the array index of a layer by ID.
     * @private
     * @param {string} layerId - Layer identifier
     * @returns {number}
     */
    _getLayerIndex(layerId) {
        return this._layers.findIndex(l => l.id === layerId);
    }

    /**
     * Reorder layers starting from a given index.
     * @private
     * @param {number} fromIndex - Starting index for reorder
     */
    _reorderFromIndex(fromIndex) {
        for (let i = fromIndex; i < this._layers.length; i++) {
            this._layers[i].setOrder(i);
        }
    }

    /**
     * Generate a unique layer name.
     * @private
     * @returns {string}
     */
    _generateLayerName() {
        this._layerNameCounter++;
        let name = `Layer ${this._layerNameCounter}`;

        while (this._isNameTaken(name)) {
            this._layerNameCounter++;
            name = `Layer ${this._layerNameCounter}`;
        }

        return name;
    }

    /**
     * Check if a layer name is already in use.
     * @private
     * @param {string} name - Name to check
     * @param {string} [excludeId] - Layer ID to exclude from check
     * @returns {boolean}
     */
    _isNameTaken(name, excludeId = null) {
        return this._layers.some(l => l.name === name && l.id !== excludeId);
    }

    /**
     * Validate that the manager has not been disposed.
     * @private
     * @throws {Error} If disposed
     */
    _validateNotDisposed() {
        if (this._disposed) {
            throw new Error('LayerManager has been disposed and cannot be used');
        }
    }
}

// ============================================
// Default Export
// ============================================

export default LayerManager;

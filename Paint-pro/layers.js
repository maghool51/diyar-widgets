// ============================================
// Paint Pro - Professional Paint Application
// layers.js - Layer Manager Module
// Unlimited layers with full management:
// add, delete, duplicate, merge, reorder,
// hide, lock, opacity, blend modes
// ============================================

import { Utils } from './utils.js';

/**
 * @class LayerManager
 * @description Manages all layers including creation,
 * deletion, duplication, merging, reordering, visibility,
 * locking, opacity, blend modes, and compositing
 */
export class LayerManager {
    /**
     * @param {Object} app - Reference to main application instance
     */
    constructor(app) {
        this.app = app;
        
        // Layers array
        this.layers = [];
        this.activeLayerIndex = -1;
        
        // Layer ID counter
        this.layerIdCounter = 0;
        
        // Layer defaults
        this.defaultLayerName = 'لایه';
        
        // Blend modes
        this.blendModes = [
            'normal',
            'multiply',
            'screen',
            'overlay',
            'darken',
            'lighten',
            'color-dodge',
            'color-burn',
            'hard-light',
            'soft-light',
            'difference',
            'exclusion',
            'hue',
            'saturation',
            'color',
            'luminosity',
        ];
        
        // Canvas for compositing
        this.compositeCanvas = null;
        this.compositeCtx = null;
        
        // Page-layer mapping
        this.pageLayers = new Map(); // pageId -> [layerIds]
        
        // Bind methods
        this.init = this.init.bind(this);
        this.addLayer = this.addLayer.bind(this);
        this.deleteActiveLayer = this.deleteActiveLayer.bind(this);
        this.duplicateActiveLayer = this.duplicateActiveLayer.bind(this);
        this.mergeActiveLayer = this.mergeActiveLayer.bind(this);
        this.mergeAllLayers = this.mergeAllLayers.bind(this);
        this.setActiveLayer = this.setActiveLayer.bind(this);
        this.moveLayer = this.moveLayer.bind(this);
        this.setLayerVisibility = this.setLayerVisibility.bind(this);
        this.setLayerLock = this.setLayerLock.bind(this);
        this.setLayerOpacity = this.setLayerOpacity.bind(this);
        this.setLayerBlendMode = this.setLayerBlendMode.bind(this);
        this.renameLayer = this.renameLayer.bind(this);
        this.getActiveLayer = this.getActiveLayer.bind(this);
        this.compositeLayers = this.compositeLayers.bind(this);
        this.renderLayerList = this.renderLayerList.bind(this);
        this.initializeForPage = this.initializeForPage.bind(this);
        this.switchToPage = this.switchToPage.bind(this);
        this.removePageLayers = this.removePageLayers.bind(this);
        this.duplicatePageLayers = this.duplicatePageLayers.bind(this);
        this.serialize = this.serialize.bind(this);
        this.deserialize = this.deserialize.bind(this);
        this.setActiveLayerOpacity = this.setActiveLayerOpacity.bind(this);
        this.bringToFront = this.bringToFront.bind(this);
        this.sendToBack = this.sendToBack.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    /**
     * Initialize layer manager
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Create composite canvas
            this.createCompositeCanvas();
            
            console.log('Layer Manager initialized');
        } catch (error) {
            console.error('Failed to initialize Layer Manager:', error);
            throw error;
        }
    }

    /**
     * Create composite canvas for layer merging
     */
    createCompositeCanvas() {
        const dimensions = this.app.modules.canvasManager?.getCanvasDimensions();
        const width = dimensions?.width || 1920;
        const height = dimensions?.height || 1080;
        
        this.compositeCanvas = document.createElement('canvas');
        this.compositeCanvas.width = width;
        this.compositeCanvas.height = height;
        this.compositeCtx = this.compositeCanvas.getContext('2d');
    }

    /**
     * Initialize layers for a page
     * @param {string} pageId 
     */
    initializeForPage(pageId) {
        // Create default background layer
        const backgroundLayer = this.addLayer('پس‌زمینه', false);
        backgroundLayer.isBackground = true;
        
        // Fill with white
        const ctx = backgroundLayer.canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, backgroundLayer.canvas.width, backgroundLayer.canvas.height);
        
        // Store page-layer mapping
        this.pageLayers.set(pageId, this.layers.map(l => l.id));
    }

    /**
     * Switch to a different page
     * @param {string} pageId 
     */
    switchToPage(pageId) {
        // Save current layers to current page
        const currentPage = this.app.modules.canvasManager?.getCurrentPage();
        if (currentPage) {
            this.pageLayers.set(currentPage.id, this.layers.map(l => l.id));
        }
        
        // Load layers for new page
        const layerIds = this.pageLayers.get(pageId);
        if (layerIds) {
            // This would restore layers from stored data
            // For now, reinitialize
            this.layers = [];
            this.initializeForPage(pageId);
        } else {
            this.layers = [];
            this.initializeForPage(pageId);
        }
        
        this.renderLayerList();
    }

    /**
     * Remove layers associated with a page
     * @param {string} pageId 
     */
    removePageLayers(pageId) {
        this.pageLayers.delete(pageId);
    }

    /**
     * Duplicate layers for a new page
     * @param {string} sourcePageId 
     * @param {string} newPageId 
     */
    duplicatePageLayers(sourcePageId, newPageId) {
        const sourceLayerIds = this.pageLayers.get(sourcePageId);
        if (sourceLayerIds) {
            this.pageLayers.set(newPageId, [...sourceLayerIds]);
        }
    }

    /**
     * Add a new layer
     * @param {string} [name] - Layer name
     * @param {boolean} [select=true] - Select the new layer
     * @returns {Object} New layer object
     */
    addLayer(name = null, select = true) {
        const dimensions = this.app.modules.canvasManager?.getCanvasDimensions() || 
                          { width: 1920, height: 1080 };
        
        // Create offscreen canvas for this layer
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = dimensions.width;
        layerCanvas.height = dimensions.height;
        
        const layer = {
            id: Utils.generateUUID(),
            name: name || `${this.defaultLayerName} ${this.layers.length + 1}`,
            canvas: layerCanvas,
            ctx: layerCanvas.getContext('2d', { alpha: true }),
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: 'normal',
            isBackground: false,
            thumbnail: null,
            order: this.layers.length,
        };
        
        // Clear layer to transparent
        layer.ctx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
        
        this.layers.push(layer);
        
        if (select) {
            this.setActiveLayer(this.layers.length - 1);
        }
        
        this.renderLayerList();
        this.generateThumbnail(layer);
        
        return layer;
    }

    /**
     * Delete the active layer
     */
    deleteActiveLayer() {
        if (this.layers.length <= 1) {
            this.app.showToast('حداقل یک لایه باید وجود داشته باشد', 'warning');
            return;
        }
        
        if (this.activeLayerIndex < 0 || this.activeLayerIndex >= this.layers.length) return;
        
        const layerToDelete = this.layers[this.activeLayerIndex];
        
        if (layerToDelete.isBackground) {
            this.app.showToast('نمی‌توان لایه پس‌زمینه را حذف کرد', 'warning');
            return;
        }
        
        this.app.modules.historyManager?.beginOperation({
            type: 'deleteLayer',
            layerId: layerToDelete.id,
        });
        
        this.layers.splice(this.activeLayerIndex, 1);
        
        // Adjust active index
        if (this.activeLayerIndex >= this.layers.length) {
            this.activeLayerIndex = this.layers.length - 1;
        }
        
        // Reorder
        this.reorderLayers();
        
        this.app.modules.historyManager?.endOperation();
        this.app.markAsModified();
        
        this.renderLayerList();
        this.compositeLayers();
        this.app.showToast('لایه حذف شد', 'info');
    }

    /**
     * Duplicate the active layer
     */
    duplicateActiveLayer() {
        if (this.activeLayerIndex < 0) return;
        
        const sourceLayer = this.layers[this.activeLayerIndex];
        
        // Create new layer
        const newLayer = this.addLayer(`${sourceLayer.name} (کپی)`, false);
        
        // Copy content
        newLayer.ctx.drawImage(sourceLayer.canvas, 0, 0);
        newLayer.opacity = sourceLayer.opacity;
        newLayer.blendMode = sourceLayer.blendMode;
        newLayer.visible = sourceLayer.visible;
        
        // Insert after source layer
        const sourceIndex = this.layers.indexOf(sourceLayer);
        this.layers.splice(sourceIndex, 1); // Remove
        this.layers.splice(sourceIndex, 0, newLayer); // Insert copy
        this.layers.splice(sourceIndex + 1, 0, sourceLayer); // Reinsert original
        
        this.reorderLayers();
        this.setActiveLayer(sourceIndex);
        
        this.app.markAsModified();
        this.renderLayerList();
        this.compositeLayers();
        this.app.showToast('لایه کپی شد', 'success');
    }

    /**
     * Merge active layer with the layer below
     */
    mergeActiveLayer() {
        if (this.activeLayerIndex <= 0) {
            this.app.showToast('لایه زیرین وجود ندارد', 'warning');
            return;
        }
        
        const topLayer = this.layers[this.activeLayerIndex];
        const bottomLayer = this.layers[this.activeLayerIndex - 1];
        
        if (bottomLayer.isBackground && bottomLayer.locked) {
            this.app.showToast('نمی‌توان با لایه قفل شده ادغام کرد', 'warning');
            return;
        }
        
        this.app.modules.historyManager?.beginOperation({
            type: 'mergeLayer',
            topLayerId: topLayer.id,
            bottomLayerId: bottomLayer.id,
        });
        
        // Draw top layer onto bottom layer
        bottomLayer.ctx.save();
        bottomLayer.ctx.globalAlpha = topLayer.opacity;
        bottomLayer.ctx.globalCompositeOperation = topLayer.blendMode;
        bottomLayer.ctx.drawImage(topLayer.canvas, 0, 0);
        bottomLayer.ctx.restore();
        
        // Remove top layer
        this.layers.splice(this.activeLayerIndex, 1);
        this.activeLayerIndex--;
        
        this.reorderLayers();
        
        this.app.modules.historyManager?.endOperation();
        this.app.markAsModified();
        
        this.renderLayerList();
        this.compositeLayers();
        this.app.showToast('لایه‌ها ادغام شدند', 'success');
    }

    /**
     * Merge all visible layers into one
     */
    mergeAllLayers() {
        if (this.layers.length <= 1) return;
        
        this.app.modules.historyManager?.beginOperation({
            type: 'mergeAllLayers',
        });
        
        // Create new merged layer
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = this.compositeCanvas.width;
        mergedCanvas.height = this.compositeCanvas.height;
        const mergedCtx = mergedCanvas.getContext('2d');
        
        // Composite all visible layers
        this.layers.forEach(layer => {
            if (!layer.visible) return;
            
            mergedCtx.save();
            mergedCtx.globalAlpha = layer.opacity;
            mergedCtx.globalCompositeOperation = layer.blendMode;
            mergedCtx.drawImage(layer.canvas, 0, 0);
            mergedCtx.restore();
        });
        
        // Replace all layers with merged layer
        const backgroundLayer = this.layers.find(l => l.isBackground);
        this.layers = [backgroundLayer || this.layers[0]];
        
        // Add merged content as new layer
        const mergedLayer = this.addLayer('ادغام شده', false);
        mergedLayer.ctx.drawImage(mergedCanvas, 0, 0);
        
        this.setActiveLayer(this.layers.length - 1);
        
        this.app.modules.historyManager?.endOperation();
        this.app.markAsModified();
        
        this.renderLayerList();
        this.compositeLayers();
        this.app.showToast('همه لایه‌ها ادغام شدند', 'success');
    }

    /**
     * Set active layer by index
     * @param {number} index 
     */
    setActiveLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        
        this.activeLayerIndex = index;
        this.renderLayerList();
        
        // Update layer opacity slider
        const activeLayer = this.getActiveLayer();
        if (activeLayer) {
            this.app.elements.layerOpacity.value = Math.round(activeLayer.opacity * 100);
            this.app.elements.opacityValue.textContent = Math.round(activeLayer.opacity * 100) + '%';
        }
    }

    /**
     * Move layer to new index
     * @param {number} fromIndex 
     * @param {number} toIndex 
     */
    moveLayer(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.layers.length ||
            toIndex < 0 || toIndex >= this.layers.length) return;
        
        const layer = this.layers.splice(fromIndex, 1)[0];
        this.layers.splice(toIndex, 0, layer);
        
        // Update active index
        if (this.activeLayerIndex === fromIndex) {
            this.activeLayerIndex = toIndex;
        } else if (fromIndex < this.activeLayerIndex && toIndex >= this.activeLayerIndex) {
            this.activeLayerIndex--;
        } else if (fromIndex > this.activeLayerIndex && toIndex <= this.activeLayerIndex) {
            this.activeLayerIndex++;
        }
        
        this.reorderLayers();
        this.renderLayerList();
        this.compositeLayers();
    }

    /**
     * Set layer visibility
     * @param {number} index 
     * @param {boolean} visible 
     */
    setLayerVisibility(index, visible) {
        if (index < 0 || index >= this.layers.length) return;
        
        this.layers[index].visible = visible;
        this.renderLayerList();
        this.compositeLayers();
    }

    /**
     * Set layer lock state
     * @param {number} index 
     * @param {boolean} locked 
     */
    setLayerLock(index, locked) {
        if (index < 0 || index >= this.layers.length) return;
        
        this.layers[index].locked = locked;
        this.renderLayerList();
    }

    /**
     * Set layer opacity
     * @param {number} index 
     * @param {number} opacity - 0 to 1
     */
    setLayerOpacity(index, opacity) {
        if (index < 0 || index >= this.layers.length) return;
        
        this.layers[index].opacity = Math.max(0, Math.min(1, opacity));
        
        if (index === this.activeLayerIndex) {
            this.app.elements.layerOpacity.value = Math.round(opacity * 100);
            this.app.elements.opacityValue.textContent = Math.round(opacity * 100) + '%';
        }
        
        this.compositeLayers();
    }

    /**
     * Set active layer opacity
     * @param {number} opacity - 0 to 1
     */
    setActiveLayerOpacity(opacity) {
        this.setLayerOpacity(this.activeLayerIndex, opacity);
    }

    /**
     * Set layer blend mode
     * @param {number} index 
     * @param {string} blendMode 
     */
    setLayerBlendMode(index, blendMode) {
        if (index < 0 || index >= this.layers.length) return;
        if (!this.blendModes.includes(blendMode)) return;
        
        this.layers[index].blendMode = blendMode;
        this.compositeLayers();
    }

    /**
     * Rename a layer
     * @param {number} index 
     * @param {string} newName 
     */
    renameLayer(index, newName) {
        if (index < 0 || index >= this.layers.length) return;
        
        this.layers[index].name = newName.trim() || `${this.defaultLayerName} ${index + 1}`;
        this.renderLayerList();
    }

    /**
     * Bring layer to front
     */
    bringToFront() {
        if (this.activeLayerIndex < 0 || this.activeLayerIndex >= this.layers.length - 1) return;
        this.moveLayer(this.activeLayerIndex, this.layers.length - 1);
    }

    /**
     * Send layer to back
     */
    sendToBack() {
        if (this.activeLayerIndex <= 0) return;
        this.moveLayer(this.activeLayerIndex, 0);
    }

    /**
     * Get active layer
     * @returns {Object|null}
     */
    getActiveLayer() {
        if (this.activeLayerIndex < 0 || this.activeLayerIndex >= this.layers.length) {
            return null;
        }
        return this.layers[this.activeLayerIndex];
    }

    /**
     * Get active layer canvas context
     * @returns {CanvasRenderingContext2D|null}
     */
    getActiveContext() {
        const layer = this.getActiveLayer();
        return layer ? layer.ctx : null;
    }

    /**
     * Composite all layers onto target context
     * @param {CanvasRenderingContext2D} [targetCtx] - Target context (defaults to main canvas)
     */
    compositeLayers(targetCtx = null) {
        const ctx = targetCtx || this.app.modules.canvasManager?.getMainContext();
        if (!ctx) return;
        
        // Clear target
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Composite each visible layer
        this.layers.forEach(layer => {
            if (!layer.visible) return;
            
            ctx.save();
            ctx.globalAlpha = layer.opacity;
            ctx.globalCompositeOperation = layer.blendMode;
            ctx.drawImage(layer.canvas, 0, 0);
            ctx.restore();
        });
    }

    /**
     * Generate thumbnail for a layer
     * @param {Object} layer 
     */
    generateThumbnail(layer) {
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 40;
        thumbCanvas.height = 40;
        const thumbCtx = thumbCanvas.getContext('2d');
        
        // Scale down layer content
        thumbCtx.drawImage(
            layer.canvas,
            0, 0,
            layer.canvas.width, layer.canvas.height,
            0, 0,
            40, 40
        );
        
        layer.thumbnail = thumbCanvas.toDataURL();
    }

    /**
     * Reorder layers after changes
     */
    reorderLayers() {
        this.layers.forEach((layer, index) => {
            layer.order = index;
        });
    }

    /**
     * Render layer list in panel
     */
    renderLayerList() {
        const container = this.app.elements.layersList;
        if (!container) return;
        
        container.innerHTML = '';
        
        // Render in reverse order (top layer first in list)
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            const isActive = i === this.activeLayerIndex;
            
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            if (isActive) layerItem.classList.add('active');
            if (!layer.visible) layerItem.style.opacity = '0.5';
            
            layerItem.innerHTML = `
                <div class="layer-thumbnail" style="background-image: url(${layer.thumbnail || ''}); background-size: cover;">
                    ${!layer.thumbnail ? '<span style="font-size: 10px;">لایه</span>' : ''}
                </div>
                <div class="layer-info">
                    <div class="layer-name">${layer.name}</div>
                    <div class="layer-details">
                        ${layer.locked ? '🔒 ' : ''}
                        شفافیت: ${Math.round(layer.opacity * 100)}%
                    </div>
                </div>
                <div class="layer-controls">
                    <button class="layer-visibility-btn" title="${layer.visible ? 'پنهان' : 'نمایش'}">
                        <span class="material-symbols-outlined" style="font-size: 16px;">
                            ${layer.visible ? 'visibility' : 'visibility_off'}
                        </span>
                    </button>
                    <button class="layer-lock-btn" title="${layer.locked ? 'باز کردن' : 'قفل'}">
                        <span class="material-symbols-outlined" style="font-size: 16px;">
                            ${layer.locked ? 'lock' : 'lock_open'}
                        </span>
                    </button>
                </div>
            `;
            
            // Click to select
            layerItem.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    this.setActiveLayer(i);
                }
            });
            
            // Double-click to rename
            layerItem.addEventListener('dblclick', (e) => {
                if (!e.target.closest('button')) {
                    const newName = prompt('نام جدید لایه:', layer.name);
                    if (newName && newName.trim()) {
                        this.renameLayer(i, newName);
                    }
                }
            });
            
            // Visibility toggle
            layerItem.querySelector('.layer-visibility-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.setLayerVisibility(i, !layer.visible);
            });
            
            // Lock toggle
            layerItem.querySelector('.layer-lock-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.setLayerLock(i, !layer.locked);
            });
            
            // Drag and drop for reordering
            layerItem.draggable = true;
            
            layerItem.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', i.toString());
                layerItem.classList.add('dragging');
            });
            
            layerItem.addEventListener('dragend', () => {
                layerItem.classList.remove('dragging');
            });
            
            layerItem.addEventListener('dragover', (e) => {
                e.preventDefault();
                layerItem.classList.add('drag-over');
            });
            
            layerItem.addEventListener('dragleave', () => {
                layerItem.classList.remove('drag-over');
            });
            
            layerItem.addEventListener('drop', (e) => {
                e.preventDefault();
                layerItem.classList.remove('drag-over');
                
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                if (!isNaN(fromIndex) && fromIndex !== i) {
                    this.moveLayer(fromIndex, i);
                }
            });
            
            container.appendChild(layerItem);
        }
    }

    /**
     * Get all layers
     * @returns {Array}
     */
    getLayers() {
        return this.layers;
    }

    /**
     * Serialize layers for saving
     * @returns {Array}
     */
    serialize() {
        return this.layers.map(layer => ({
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            locked: layer.locked,
            opacity: layer.opacity,
            blendMode: layer.blendMode,
            isBackground: layer.isBackground,
            order: layer.order,
            canvasData: layer.canvas.toDataURL('image/png'),
        }));
    }

    /**
     * Deserialize layers from saved data
     * @param {Array} data 
     * @returns {Promise<void>}
     */
    async deserialize(data) {
        this.layers = [];
        
        for (const layerData of data) {
            const layer = {
                id: layerData.id || Utils.generateUUID(),
                name: layerData.name || 'لایه',
                canvas: document.createElement('canvas'),
                ctx: null,
                visible: layerData.visible !== false,
                locked: layerData.locked || false,
                opacity: layerData.opacity || 1,
                blendMode: layerData.blendMode || 'normal',
                isBackground: layerData.isBackground || false,
                order: layerData.order || 0,
                thumbnail: null,
            };
            
            // Set canvas dimensions
            const dimensions = this.app.modules.canvasManager?.getCanvasDimensions() ||
                              { width: 1920, height: 1080 };
            layer.canvas.width = dimensions.width;
            layer.canvas.height = dimensions.height;
            layer.ctx = layer.canvas.getContext('2d');
            
            // Restore canvas data
            if (layerData.canvasData) {
                await this.loadCanvasData(layer, layerData.canvasData);
            }
            
            this.layers.push(layer);
        }
        
        // Sort by order
        this.layers.sort((a, b) => a.order - b.order);
        this.reorderLayers();
        
        // Set active layer
        if (this.layers.length > 0) {
            this.setActiveLayer(this.layers.length - 1);
        }
        
        this.renderLayerList();
        this.compositeLayers();
    }

    /**
     * Load canvas data from base64 string
     * @param {Object} layer 
     * @param {string} dataUrl 
     * @returns {Promise<void>}
     */
    async loadCanvasData(layer, dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
                layer.ctx.drawImage(img, 0, 0);
                this.generateThumbnail(layer);
                resolve();
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    /**
     * Destroy layer manager
     */
    destroy() {
        this.layers = [];
        this.compositeCanvas = null;
        this.compositeCtx = null;
        this.pageLayers.clear();
        
        console.log('Layer Manager destroyed');
    }
}

export default LayerManager;

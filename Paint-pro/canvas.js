// ============================================
// Paint Pro - Professional Paint Application
// canvas.js - Canvas Manager Module
// Handles main canvas, pages, rendering, zoom/pan
// ============================================

import { Utils } from './utils.js';

/**
 * @class CanvasManager
 * @description Manages all canvas-related operations including
 * main canvas, offscreen canvases, page management, zoom, pan,
 * grid rendering, and coordinate transformations.
 */
export class CanvasManager {
    /**
     * @param {Object} app - Reference to main application instance
     */
    constructor(app) {
        this.app = app;
        
        // Canvas references
        this.mainCanvas = null;
        this.previewCanvas = null;
        this.selectionCanvas = null;
        this.gridCanvas = null;
        
        // Contexts
        this.mainCtx = null;
        this.previewCtx = null;
        this.selectionCtx = null;
        this.gridCtx = null;
        
        // Canvas state
        this.width = 1920;
        this.height = 1080;
        this.originalWidth = 1920;
        this.originalHeight = 1080;
        this.dpr = window.devicePixelRatio || 1;
        
        // Page management
        this.pages = [];
        this.currentPageIndex = 0;
        this.totalPages = 0;
        
        // Zoom & Pan
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.minZoom = 0.1;
        this.maxZoom = 8;
        
        // Grid settings
        this.gridSize = 20;
        this.gridColor = 'rgba(128, 128, 128, 0.3)';
        this.gridVisible = false;
        
        // Rulers
        this.rulersVisible = false;
        this.rulerSize = 20;
        
        // Guides
        this.guides = [];
        this.guidesVisible = false;
        
        // Performance
        this.renderScheduled = false;
        this.dirtyRect = null;
        
        // Background
        this.backgroundColor = '#FFFFFF';
        this.backgroundAlpha = 1;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.render = this.render.bind(this);
        this.scheduleRender = this.scheduleRender.bind(this);
        this.handleContainerResize = this.handleContainerResize.bind(this);
        this.updateZoom = this.updateZoom.bind(this);
        this.screenToCanvas = this.screenToCanvas.bind(this);
        this.canvasToScreen = this.canvasToScreen.bind(this);
        this.addPage = this.addPage.bind(this);
        this.deleteCurrentPage = this.deleteCurrentPage.bind(this);
        this.duplicateCurrentPage = this.duplicateCurrentPage.bind(this);
        this.switchToPage = this.switchToPage.bind(this);
        this.renderPageList = this.renderPageList.bind(this);
        this.renderGrid = this.renderGrid.bind(this);
        this.getCanvasDimensions = this.getCanvasDimensions.bind(this);
        this.clearCanvas = this.clearCanvas.bind(this);
        this.getMainContext = this.getMainContext.bind(this);
        this.getCompositeCanvas = this.getCompositeCanvas.bind(this);
        this.exportCanvas = this.exportCanvas.bind(this);
        this.resizeCanvas = this.resizeCanvas.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    /**
     * Initialize canvas manager
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Cache canvas elements
            this.mainCanvas = this.app.elements.mainCanvas;
            this.previewCanvas = this.app.elements.previewCanvas;
            this.selectionCanvas = this.app.elements.selectionCanvas;
            this.gridCanvas = this.app.elements.gridCanvas;
            
            // Get contexts
            this.mainCtx = this.mainCanvas.getContext('2d', {
                alpha: true,
                desynchronized: true,
                willReadFrequently: false,
            });
            
            this.previewCtx = this.previewCanvas.getContext('2d', {
                alpha: true,
                desynchronized: true,
            });
            
            this.selectionCtx = this.selectionCanvas.getContext('2d', {
                alpha: true,
                desynchronized: true,
            });
            
            this.gridCtx = this.gridCanvas.getContext('2d', {
                alpha: true,
                desynchronized: true,
            });
            
            // Setup high-DPI canvas
            this.setupHiDPI();
            
            // Initialize pages
            this.pages = [];
            this.addInitialPage();
            
            // Setup canvas event listeners
            this.setupCanvasEvents();
            
            // Initial render
            this.render();
            
            console.log('Canvas Manager initialized');
        } catch (error) {
            console.error('Failed to initialize Canvas Manager:', error);
            throw error;
        }
    }

    /**
     * Setup high-DPI canvas for retina displays
     */
    setupHiDPI() {
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        
        // Set display size
        this.mainCanvas.style.width = this.width + 'px';
        this.mainCanvas.style.height = this.height + 'px';
        this.previewCanvas.style.width = this.width + 'px';
        this.previewCanvas.style.height = this.height + 'px';
        this.selectionCanvas.style.width = this.width + 'px';
        this.selectionCanvas.style.height = this.height + 'px';
        this.gridCanvas.style.width = this.width + 'px';
        this.gridCanvas.style.height = this.height + 'px';
        
        // Set actual size scaled by DPR
        this.mainCanvas.width = this.width * this.dpr;
        this.mainCanvas.height = this.height * this.dpr;
        this.previewCanvas.width = this.width * this.dpr;
        this.previewCanvas.height = this.height * this.dpr;
        this.selectionCanvas.width = this.width * this.dpr;
        this.selectionCanvas.height = this.height * this.dpr;
        this.gridCanvas.width = this.width * this.dpr;
        this.gridCanvas.height = this.height * this.dpr;
        
        // Scale all contexts
        [this.mainCtx, this.previewCtx, this.selectionCtx, this.gridCtx].forEach(ctx => {
            if (ctx) {
                ctx.scale(this.dpr, this.dpr);
            }
        });
        
        // Update document dimensions display
        this.app.elements.docDimensions.textContent = `${this.width}×${this.height}`;
    }

    /**
     * Add initial blank page
     */
    addInitialPage() {
        const page = {
            id: Utils.generateUUID(),
            name: 'صفحه ۱',
            thumbnail: null,
            canvasData: null,
            layers: [],
            backgroundColor: this.backgroundColor,
            width: this.width,
            height: this.height,
            order: 0,
        };
        
        this.pages.push(page);
        this.totalPages = 1;
        this.currentPageIndex = 0;
        
        // Initialize layers for this page
        this.app.modules.layerManager?.initializeForPage(page.id);
    }

    /**
     * Add a new page
     * @param {Object} options - Page options
     * @returns {Object} New page object
     */
    addPage(options = {}) {
        const pageNumber = this.totalPages + 1;
        const page = {
            id: Utils.generateUUID(),
            name: options.name || `صفحه ${pageNumber}`,
            thumbnail: null,
            canvasData: null,
            layers: [],
            backgroundColor: options.backgroundColor || this.backgroundColor,
            width: options.width || this.width,
            height: options.height || this.height,
            order: this.totalPages,
        };
        
        this.pages.push(page);
        this.totalPages++;
        
        // Save current page state before switching
        this.saveCurrentPageState();
        
        // Switch to new page
        this.switchToPage(this.totalPages - 1);
        
        // Initialize layers for this page
        this.app.modules.layerManager?.initializeForPage(page.id);
        
        this.renderPageList();
        this.app.showToast(`صفحه ${pageNumber} اضافه شد`, 'success');
        
        return page;
    }

    /**
     * Delete current page
     */
    deleteCurrentPage() {
        if (this.totalPages <= 1) {
            this.app.showToast('حداقل یک صفحه باید وجود داشته باشد', 'warning');
            return;
        }
        
        const pageToDelete = this.pages[this.currentPageIndex];
        
        // Remove page
        this.pages.splice(this.currentPageIndex, 1);
        this.totalPages--;
        
        // Remove layers for this page
        this.app.modules.layerManager?.removePageLayers(pageToDelete.id);
        
        // Adjust current page index
        if (this.currentPageIndex >= this.totalPages) {
            this.currentPageIndex = this.totalPages - 1;
        }
        
        // Restore page state
        this.restorePageState(this.pages[this.currentPageIndex]);
        
        // Update page order
        this.reorderPages();
        
        this.renderPageList();
        this.render();
        this.app.showToast('صفحه حذف شد', 'info');
    }

    /**
     * Duplicate current page
     */
    duplicateCurrentPage() {
        const sourcePage = this.pages[this.currentPageIndex];
        const newPage = Utils.deepClone(sourcePage);
        newPage.id = Utils.generateUUID();
        newPage.name = `${sourcePage.name} (کپی)`;
        newPage.order = this.totalPages;
        
        this.pages.splice(this.currentPageIndex + 1, 0, newPage);
        this.totalPages++;
        
        // Duplicate layers for new page
        this.app.modules.layerManager?.duplicatePageLayers(sourcePage.id, newPage.id);
        
        // Switch to new page
        this.switchToPage(this.currentPageIndex + 1);
        
        this.renderPageList();
        this.app.showToast('صفحه کپی شد', 'success');
    }

    /**
     * Switch to a specific page
     * @param {number} index - Page index
     */
    switchToPage(index) {
        if (index < 0 || index >= this.totalPages) return;
        
        // Save current page state
        this.saveCurrentPageState();
        
        // Update index
        this.currentPageIndex = index;
        
        // Restore new page state
        this.restorePageState(this.pages[index]);
        
        // Update layers
        this.app.modules.layerManager?.switchToPage(this.pages[index].id);
        
        this.renderPageList();
        this.render();
    }

    /**
     * Save current page canvas state
     */
    saveCurrentPageState() {
        if (this.currentPageIndex < 0 || this.currentPageIndex >= this.pages.length) return;
        
        const page = this.pages[this.currentPageIndex];
        page.canvasData = this.mainCanvas.toDataURL('image/png');
        page.width = this.width;
        page.height = this.height;
        page.backgroundColor = this.backgroundColor;
    }

    /**
     * Restore page canvas state
     * @param {Object} page - Page object
     */
    restorePageState(page) {
        if (!page) return;
        
        // Restore dimensions
        this.width = page.width || this.originalWidth;
        this.height = page.height || this.originalHeight;
        this.backgroundColor = page.backgroundColor || '#FFFFFF';
        
        // Resize canvas
        this.resizeCanvas(this.width, this.height);
        
        // Restore canvas data
        if (page.canvasData) {
            const img = new Image();
            img.onload = () => {
                this.clearCanvas();
                this.mainCtx.drawImage(img, 0, 0);
            };
            img.src = page.canvasData;
        } else {
            this.clearCanvas();
        }
        
        // Update display
        this.app.elements.docDimensions.textContent = `${this.width}×${this.height}`;
        this.app.elements.docName.textContent = page.name || 'بدون عنوان';
    }

    /**
     * Reorder pages after deletion
     */
    reorderPages() {
        this.pages.forEach((page, index) => {
            page.order = index;
        });
    }

    /**
     * Render page list in panel
     */
    renderPageList() {
        const container = this.app.elements.pagesList;
        if (!container) return;
        
        container.innerHTML = '';
        
        this.pages.forEach((page, index) => {
            const pageItem = document.createElement('div');
            pageItem.className = 'page-item';
            if (index === this.currentPageIndex) {
                pageItem.classList.add('active');
            }
            
            pageItem.innerHTML = `
                <div class="page-thumbnail" style="width: 40px; height: 40px; background: #fff; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                    ${page.name.charAt(0)}
                </div>
                <div class="page-info">
                    <div class="page-name">${page.name}</div>
                    <div class="page-details">${page.width}×${page.height}</div>
                </div>
            `;
            
            pageItem.addEventListener('click', () => {
                if (index !== this.currentPageIndex) {
                    this.switchToPage(index);
                }
            });
            
            // Double-click to rename
            pageItem.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.renamePage(index);
            });
            
            // Drag and drop for reordering
            pageItem.draggable = true;
            pageItem.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', index.toString());
                pageItem.classList.add('dragging');
            });
            
            pageItem.addEventListener('dragend', () => {
                pageItem.classList.remove('dragging');
            });
            
            pageItem.addEventListener('dragover', (e) => {
                e.preventDefault();
                pageItem.classList.add('drag-over');
            });
            
            pageItem.addEventListener('dragleave', () => {
                pageItem.classList.remove('drag-over');
            });
            
            pageItem.addEventListener('drop', (e) => {
                e.preventDefault();
                pageItem.classList.remove('drag-over');
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;
                
                if (fromIndex !== toIndex && !isNaN(fromIndex)) {
                    this.movePage(fromIndex, toIndex);
                }
            });
            
            container.appendChild(pageItem);
        });
    }

    /**
     * Rename a page
     * @param {number} index - Page index
     */
    renamePage(index) {
        const page = this.pages[index];
        const newName = prompt('نام جدید صفحه:', page.name);
        
        if (newName && newName.trim()) {
            page.name = newName.trim();
            this.renderPageList();
            
            if (index === this.currentPageIndex) {
                this.app.elements.docName.textContent = page.name;
            }
        }
    }

    /**
     * Move page from one index to another
     * @param {number} fromIndex 
     * @param {number} toIndex 
     */
    movePage(fromIndex, toIndex) {
        const page = this.pages.splice(fromIndex, 1)[0];
        this.pages.splice(toIndex, 0, page);
        
        // Update current page index if needed
        if (this.currentPageIndex === fromIndex) {
            this.currentPageIndex = toIndex;
        } else if (fromIndex < this.currentPageIndex && toIndex >= this.currentPageIndex) {
            this.currentPageIndex--;
        } else if (fromIndex > this.currentPageIndex && toIndex <= this.currentPageIndex) {
            this.currentPageIndex++;
        }
        
        this.reorderPages();
        this.renderPageList();
    }

    /**
     * Setup canvas event listeners
     */
    setupCanvasEvents() {
        // Pointer events for drawing
        this.mainCanvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        this.mainCanvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        this.mainCanvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        this.mainCanvas.addEventListener('pointerleave', (e) => this.handlePointerUp(e));
        this.mainCanvas.addEventListener('pointercancel', (e) => this.handlePointerUp(e));
        
        // Prevent default touch actions
        this.mainCanvas.addEventListener('touchstart', (e) => {
            if (e.target === this.mainCanvas) {
                e.preventDefault();
            }
        }, { passive: false });
        
        this.mainCanvas.addEventListener('touchmove', (e) => {
            if (e.target === this.mainCanvas) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Drop events for images
        this.mainCanvas.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        this.mainCanvas.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleImageDrop(e);
        });
        
        // Paste event
        document.addEventListener('paste', (e) => this.handlePaste(e));
    }

    /**
     * Handle pointer down event
     * @param {PointerEvent} e 
     */
    handlePointerDown(e) {
        const pos = this.screenToCanvas(e.clientX, e.clientY);
        
        // Handle based on current tool
        const toolId = this.app.state.currentTool;
        
        if (toolId === 'hand') {
            this.startPan(e);
            return;
        }
        
        if (toolId === 'zoom') {
            this.handleZoomClick(e);
            return;
        }
        
        // Capture pointer for smooth drawing
        this.mainCanvas.setPointerCapture(e.pointerId);
        
        // Notify tool manager
        this.app.modules.toolManager?.handlePointerDown(pos, e);
        
        // Update cursor position
        this.app.updateCursorPosition(pos.x, pos.y);
    }

    /**
     * Handle pointer move event
     * @param {PointerEvent} e 
     */
    handlePointerMove(e) {
        const pos = this.screenToCanvas(e.clientX, e.clientY);
        
        // Update cursor position in status bar
        this.app.updateCursorPosition(pos.x, pos.y);
        
        // Handle panning
        if (this.app.state.isPanning) {
            this.updatePan(e);
            return;
        }
        
        // Notify tool manager
        this.app.modules.toolManager?.handlePointerMove(pos, e);
        
        // Update selection size display
        if (this.app.modules.selectionManager?.isSelecting()) {
            const selection = this.app.modules.selectionManager.getSelectionBounds();
            if (selection) {
                this.app.updateSelectionSize(selection.width, selection.height);
            }
        }
    }

    /**
     * Handle pointer up event
     * @param {PointerEvent} e 
     */
    handlePointerUp(e) {
        const pos = this.screenToCanvas(e.clientX, e.clientY);
        
        // End panning
        if (this.app.state.isPanning) {
            this.endPan(e);
            return;
        }
        
        // Release pointer capture
        if (this.mainCanvas.hasPointerCapture(e.pointerId)) {
            this.mainCanvas.releasePointerCapture(e.pointerId);
        }
        
        // Notify tool manager
        this.app.modules.toolManager?.handlePointerUp(pos, e);
    }

    /**
     * Start panning
     * @param {PointerEvent} e 
     */
    startPan(e) {
        this.app.state.isPanning = true;
        this.panStartX = e.clientX - this.panX;
        this.panStartY = e.clientY - this.panY;
        this.mainCanvas.style.cursor = 'grabbing';
    }

    /**
     * Update panning
     * @param {PointerEvent} e 
     */
    updatePan(e) {
        if (!this.app.state.isPanning) return;
        
        this.panX = e.clientX - this.panStartX;
        this.panY = e.clientY - this.panStartY;
        
        this.updateTransform();
    }

    /**
     * End panning
     * @param {PointerEvent} e 
     */
    endPan(e) {
        this.app.state.isPanning = false;
        this.mainCanvas.style.cursor = this.app.state.currentTool === 'hand' ? 'grab' : 'default';
    }

    /**
     * Handle zoom tool click
     * @param {PointerEvent} e 
     */
    handleZoomClick(e) {
        const currentZoom = this.app.state.zoom;
        
        if (e.altKey) {
            this.app.zoomOut();
        } else {
            this.app.zoomIn();
        }
    }

    /**
     * Handle image drop on canvas
     * @param {DragEvent} e 
     */
    handleImageDrop(e) {
        const files = e.dataTransfer.files;
        
        if (files.length > 0) {
            const file = files[0];
            
            if (file.type.startsWith('image/')) {
                this.app.modules.imageProcessor?.loadImageFromFile(file);
            }
        }
    }

    /**
     * Handle paste event
     * @param {ClipboardEvent} e 
     */
    handlePaste(e) {
        const items = e.clipboardData?.items;
        
        if (items) {
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                    const blob = items[i].getAsFile();
                    this.app.modules.imageProcessor?.loadImageFromBlob(blob);
                    break;
                }
            }
        }
    }

    /**
     * Convert screen coordinates to canvas coordinates
     * @param {number} screenX 
     * @param {number} screenY 
     * @returns {Object} Canvas coordinates {x, y}
     */
    screenToCanvas(screenX, screenY) {
        const rect = this.mainCanvas.getBoundingClientRect();
        const x = (screenX - rect.left - this.panX) / this.zoom;
        const y = (screenY - rect.top - this.panY) / this.zoom;
        
        return { x, y };
    }

    /**
     * Convert canvas coordinates to screen coordinates
     * @param {number} canvasX 
     * @param {number} canvasY 
     * @returns {Object} Screen coordinates {x, y}
     */
    canvasToScreen(canvasX, canvasY) {
        const rect = this.mainCanvas.getBoundingClientRect();
        const x = canvasX * this.zoom + rect.left + this.panX;
        const y = canvasY * this.zoom + rect.top + this.panY;
        
        return { x, y };
    }

    /**
     * Update zoom level
     * @param {number} zoom 
     */
    updateZoom(zoom) {
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
        this.updateTransform();
        this.renderGrid();
    }

    /**
     * Update canvas transform
     */
    updateTransform() {
        const wrapper = this.app.elements.canvasWrapper;
        if (wrapper) {
            wrapper.style.transform = `translate(-50%, -50%) scale(${this.zoom})`;
        }
    }

    /**
     * Handle container resize
     * @param {number} containerWidth 
     * @param {number} containerHeight 
     */
    handleContainerResize(containerWidth, containerHeight) {
        // Adjust pan to keep canvas centered if needed
        this.updateTransform();
    }

    /**
     * Resize canvas dimensions
     * @param {number} width 
     * @param {number} height 
     */
    resizeCanvas(width, height) {
        if (width === this.width && height === this.height) return;
        
        // Save current content
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.mainCanvas, 0, 0);
        
        // Update dimensions
        this.width = width;
        this.height = height;
        
        // Update display size
        this.mainCanvas.style.width = this.width + 'px';
        this.mainCanvas.style.height = this.height + 'px';
        this.previewCanvas.style.width = this.width + 'px';
        this.previewCanvas.style.height = this.height + 'px';
        this.selectionCanvas.style.width = this.width + 'px';
        this.selectionCanvas.style.height = this.height + 'px';
        this.gridCanvas.style.width = this.width + 'px';
        this.gridCanvas.style.height = this.height + 'px';
        
        // Update actual size
        this.mainCanvas.width = this.width * this.dpr;
        this.mainCanvas.height = this.height * this.dpr;
        this.previewCanvas.width = this.width * this.dpr;
        this.previewCanvas.height = this.height * this.dpr;
        this.selectionCanvas.width = this.width * this.dpr;
        this.selectionCanvas.height = this.height * this.dpr;
        this.gridCanvas.width = this.width * this.dpr;
        this.gridCanvas.height = this.height * this.dpr;
        
        // Reapply DPR scaling
        [this.mainCtx, this.previewCtx, this.selectionCtx, this.gridCtx].forEach(ctx => {
            if (ctx) {
                ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            }
        });
        
        // Restore content
        this.mainCtx.drawImage(tempCanvas, 0, 0);
        
        // Update display
        this.app.elements.docDimensions.textContent = `${this.width}×${this.height}`;
        
        // Mark as modified
        this.app.markAsModified();
    }

    /**
     * Clear main canvas
     */
    clearCanvas() {
        this.mainCtx.clearRect(0, 0, this.width, this.height);
        this.mainCtx.fillStyle = this.backgroundColor;
        this.mainCtx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Schedule a render frame
     */
    scheduleRender() {
        if (!this.renderScheduled) {
            this.renderScheduled = true;
            requestAnimationFrame(() => {
                this.render();
                this.renderScheduled = false;
            });
        }
    }

    /**
     * Render all canvas layers
     */
    render() {
        // Clear preview canvas
        this.previewCtx.clearRect(0, 0, this.width, this.height);
        
        // Render layers if layer manager exists
        if (this.app.modules.layerManager) {
            this.app.modules.layerManager.compositeLayers(this.mainCtx);
        }
        
        // Render grid if enabled
        if (this.gridVisible) {
            this.renderGrid();
        }
        
        // Render selection if active
        if (this.app.modules.selectionManager?.isSelecting()) {
            this.app.modules.selectionManager.renderSelection(this.selectionCtx);
        }
    }

    /**
     * Render grid on grid canvas
     */
    renderGrid() {
        if (!this.gridVisible) {
            this.gridCtx.clearRect(0, 0, this.width, this.height);
            this.gridCanvas.style.display = 'none';
            return;
        }
        
        this.gridCanvas.style.display = 'block';
        this.gridCtx.clearRect(0, 0, this.width, this.height);
        
        const gridSize = this.gridSize * this.zoom;
        const effectiveGridSize = gridSize < 5 ? this.gridSize * 5 / this.zoom : this.gridSize;
        
        this.gridCtx.strokeStyle = this.gridColor;
        this.gridCtx.lineWidth = 0.5;
        
        // Draw vertical lines
        for (let x = 0; x <= this.width; x += effectiveGridSize) {
            this.gridCtx.beginPath();
            this.gridCtx.moveTo(x, 0);
            this.gridCtx.lineTo(x, this.height);
            this.gridCtx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= this.height; y += effectiveGridSize) {
            this.gridCtx.beginPath();
            this.gridCtx.moveTo(0, y);
            this.gridCtx.lineTo(this.width, y);
            this.gridCtx.stroke();
        }
        
        // Draw major grid lines
        this.gridCtx.strokeStyle = 'rgba(128, 128, 128, 0.5)';
        this.gridCtx.lineWidth = 1;
        
        for (let x = 0; x <= this.width; x += effectiveGridSize * 5) {
            this.gridCtx.beginPath();
            this.gridCtx.moveTo(x, 0);
            this.gridCtx.lineTo(x, this.height);
            this.gridCtx.stroke();
        }
        
        for (let y = 0; y <= this.height; y += effectiveGridSize * 5) {
            this.gridCtx.beginPath();
            this.gridCtx.moveTo(0, y);
            this.gridCtx.lineTo(this.width, y);
            this.gridCtx.stroke();
        }
    }

    /**
     * Get composite canvas with all layers merged
     * @returns {HTMLCanvasElement} Composite canvas
     */
    getCompositeCanvas() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Composite all layers
        if (this.app.modules.layerManager) {
            this.app.modules.layerManager.compositeLayers(tempCtx);
        } else {
            tempCtx.drawImage(this.mainCanvas, 0, 0);
        }
        
        return tempCanvas;
    }

    /**
     * Export canvas to data URL
     * @param {string} format - Image format
     * @param {number} quality - Image quality (0-1)
     * @returns {string} Data URL
     */
    exportCanvas(format = 'image/png', quality = 1) {
        const composite = this.getCompositeCanvas();
        return composite.toDataURL(format, quality);
    }

    /**
     * Get main canvas context
     * @returns {CanvasRenderingContext2D}
     */
    getMainContext() {
        return this.mainCtx;
    }

    /**
     * Get canvas dimensions
     * @returns {Object} {width, height}
     */
    getCanvasDimensions() {
        return {
            width: this.width,
            height: this.height,
        };
    }

    /**
     * Get current page
     * @returns {Object} Current page object
     */
    getCurrentPage() {
        return this.pages[this.currentPageIndex];
    }

    /**
     * Get all pages
     * @returns {Array} Array of page objects
     */
    getPages() {
        return this.pages;
    }

    /**
     * Set background color
     * @param {string} color - CSS color value
     */
    setBackgroundColor(color) {
        this.backgroundColor = color;
        this.clearCanvas();
        this.render();
    }

    /**
     * Toggle grid visibility
     * @param {boolean} visible 
     */
    setGridVisible(visible) {
        this.gridVisible = visible;
        this.renderGrid();
    }

    /**
     * Set grid size
     * @param {number} size 
     */
    setGridSize(size) {
        this.gridSize = Math.max(1, size);
        if (this.gridVisible) {
            this.renderGrid();
        }
    }

    /**
     * Add a guide
     * @param {string} orientation - 'horizontal' or 'vertical'
     * @param {number} position - Position in canvas coordinates
     */
    addGuide(orientation, position) {
        this.guides.push({
            orientation,
            position,
            id: Utils.generateUUID(),
        });
    }

    /**
     * Remove a guide
     * @param {string} guideId 
     */
    removeGuide(guideId) {
        this.guides = this.guides.filter(g => g.id !== guideId);
    }

    /**
     * Clear all guides
     */
    clearGuides() {
        this.guides = [];
    }

    /**
     * Destroy canvas manager and clean up
     */
    destroy() {
        // Save current page state
        this.saveCurrentPageState();
        
        // Clear canvases
        this.clearCanvas();
        
        // Remove event listeners
        // (Event listeners are cleaned up by garbage collection when elements are removed)
        
        // Clear references
        this.mainCanvas = null;
        this.previewCanvas = null;
        this.selectionCanvas = null;
        this.gridCanvas = null;
        this.mainCtx = null;
        this.previewCtx = null;
        this.selectionCtx = null;
        this.gridCtx = null;
        this.pages = [];
        
        console.log('Canvas Manager destroyed');
    }
}

export default CanvasManager;

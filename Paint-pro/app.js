// ============================================
// Paint Pro - Professional Paint Application
// app.js - Main Application Entry Point
// Module Orchestrator & State Management
// ============================================

import { CanvasManager } from './canvas.js';
import { ToolManager } from './tools.js';
import { BrushEngine } from './brushes.js';
import { ShapeRenderer } from './shapes.js';
import { FillEngine } from './fill.js';
import { TextEngine } from './text.js';
import { SelectionManager } from './selection.js';
import { LayerManager } from './layers.js';
import { HistoryManager } from './history.js';
import { ImageProcessor } from './image.js';
import { ExportManager } from './export.js';
import { StorageManager } from './storage.js';
import { SettingsManager } from './settings.js';
import { TouchHandler } from './touch.js';
import { Utils } from './utils.js';

/**
 * @class PaintProApplication
 * @description Main application class that orchestrates all modules
 * Handles initialization, state management, and inter-module communication
 */
class PaintProApplication {
    constructor() {
        // Application state
        this.state = {
            currentTool: 'pen',
            previousTool: 'pen',
            activePanel: 'tools-panel',
            theme: 'dark',
            zoom: 1,
            panX: 0,
            panY: 0,
            isPanning: false,
            spacePressed: false,
            clipboard: null,
            isModified: false,
            documentName: 'بدون عنوان',
            gridEnabled: false,
            snapEnabled: false,
            rulersEnabled: false,
            guidesEnabled: false,
            guides: [],
            memoryUsage: 0,
            autoSaveEnabled: true,
            autoSaveInterval: 60000, // 60 seconds
            lastAutoSave: Date.now(),
            performanceMode: false,
            maxUndoSteps: 1000,
        };

        // Module references
        this.modules = {};
        
        // UI element references
        this.elements = {};
        
        // Performance metrics
        this.fps = 60;
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        this.fpsUpdateInterval = 1000;
        this.lastFpsUpdate = performance.now();

        // Bind methods
        this.init = this.init.bind(this);
        this.setupEventListeners = this.setupEventListeners.bind(this);
        this.setupKeyboardShortcuts = this.setupKeyboardShortcuts.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleThemeToggle = this.handleThemeToggle.bind(this);
        this.handlePanelToggle = this.handlePanelToggle.bind(this);
        this.handleToolChange = this.handleToolChange.bind(this);
        this.handleZoomChange = this.handleZoomChange.bind(this);
        this.handleUndo = this.handleUndo.bind(this);
        this.handleRedo = this.handleRedo.bind(this);
        this.showToast = this.showToast.bind(this);
        this.showModal = this.showModal.bind(this);
        this.hideModal = this.hideModal.bind(this);
        this.updateStatusBar = this.updateStatusBar.bind(this);
        this.updateMemoryUsage = this.updateMemoryUsage.bind(this);
        this.autoSave = this.autoSave.bind(this);
        this.gameLoop = this.gameLoop.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);
    }

    /**
     * Initialize the entire application
     * @returns {Promise<void>}
     */
    async init() {
        try {
            console.log('🎨 Paint Pro - Initializing...');
            
            // Cache DOM elements
            this.cacheElements();
            
            // Initialize utility module first
            Utils.init();
            
            // Set initial theme
            this.applyTheme(this.state.theme);
            
            // Initialize all modules in correct order
            await this.initializeModules();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            // Load saved settings
            await this.loadSavedState();
            
            // Update UI
            this.updateUI();
            
            // Start game loop for performance monitoring
            this.gameLoop();
            
            // Setup auto-save
            if (this.state.autoSaveEnabled) {
                this.startAutoSave();
            }
            
            // Initial memory measurement
            this.updateMemoryUsage();
            
            console.log('✅ Paint Pro initialized successfully');
            this.showToast('نرم‌افزار آماده است', 'success');
            
        } catch (error) {
            console.error('❌ Failed to initialize Paint Pro:', error);
            this.showToast('خطا در راه‌اندازی نرم‌افزار', 'error');
        }
    }

    /**
     * Cache all frequently accessed DOM elements
     */
    cacheElements() {
        this.elements = {
            appContainer: document.getElementById('app-container'),
            mainHeader: document.getElementById('main-header'),
            menuBtn: document.getElementById('menu-btn'),
            docName: document.getElementById('doc-name'),
            docZoom: document.getElementById('doc-zoom'),
            docDimensions: document.getElementById('doc-dimensions'),
            undoBtn: document.getElementById('undo-btn'),
            redoBtn: document.getElementById('redo-btn'),
            saveBtn: document.getElementById('save-btn'),
            themeToggle: document.getElementById('theme-toggle'),
            settingsBtn: document.getElementById('settings-btn'),
            sidePanel: document.getElementById('side-panel'),
            panelContent: document.getElementById('panel-content'),
            toolsPanel: document.getElementById('tools-panel'),
            layersPanel: document.getElementById('layers-panel'),
            pagesPanel: document.getElementById('pages-panel'),
            colorPanel: document.getElementById('color-panel'),
            brushesPanel: document.getElementById('brushes-panel'),
            toolsGrid: document.getElementById('tools-grid'),
            toolOptions: document.getElementById('tool-options'),
            brushesGrid: document.getElementById('brushes-grid'),
            layersList: document.getElementById('layers-list'),
            pagesList: document.getElementById('pages-list'),
            canvasContainer: document.getElementById('canvas-container'),
            canvasWrapper: document.getElementById('canvas-wrapper'),
            mainCanvas: document.getElementById('main-canvas'),
            previewCanvas: document.getElementById('preview-canvas'),
            selectionCanvas: document.getElementById('selection-canvas'),
            gridCanvas: document.getElementById('grid-canvas'),
            textEditor: document.getElementById('text-editor'),
            zoomOutBtn: document.getElementById('zoom-out-btn'),
            zoomInBtn: document.getElementById('zoom-in-btn'),
            zoomSelect: document.getElementById('zoom-select'),
            fitToScreenBtn: document.getElementById('fit-to-screen-btn'),
            statusBar: document.getElementById('status-bar'),
            cursorPosition: document.getElementById('cursor-position'),
            toolStatus: document.getElementById('tool-status'),
            selectionSize: document.getElementById('selection-size'),
            memoryUsage: document.getElementById('memory-usage'),
            autoSaveStatus: document.getElementById('auto-save-status'),
            contextMenu: document.getElementById('context-menu'),
            toastContainer: document.getElementById('toast-container'),
            modalContainer: document.getElementById('modal-container'),
            colorWheel: document.getElementById('color-wheel'),
            hueSlider: document.getElementById('hue-slider'),
            saturationSlider: document.getElementById('saturation-slider'),
            lightnessSlider: document.getElementById('lightness-slider'),
            alphaSlider: document.getElementById('alpha-slider'),
            currentColor: document.getElementById('current-color'),
            previousColor: document.getElementById('previous-color'),
            hexInput: document.getElementById('hex-input'),
            recentColors: document.getElementById('recent-colors'),
            colorPaletteGrid: document.getElementById('color-palette-grid'),
            brushSize: document.getElementById('brush-size'),
            brushOpacity: document.getElementById('brush-opacity'),
            brushFlow: document.getElementById('brush-flow'),
            brushHardness: document.getElementById('brush-hardness'),
            brushSizeValue: document.getElementById('brush-size-value'),
            brushOpacityValue: document.getElementById('brush-opacity-value'),
            brushFlowValue: document.getElementById('brush-flow-value'),
            brushHardnessValue: document.getElementById('brush-hardness-value'),
            layerOpacity: document.getElementById('layer-opacity'),
            opacityValue: document.getElementById('opacity-value'),
            hueValue: document.getElementById('hue-value'),
            saturationValue: document.getElementById('saturation-value'),
            lightnessValue: document.getElementById('lightness-value'),
            alphaValue: document.getElementById('alpha-value'),
        };
    }

    /**
     * Initialize all application modules
     * @returns {Promise<void>}
     */
    async initializeModules() {
        // Canvas Manager - handles all canvas operations
        this.modules.canvasManager = new CanvasManager(this);
        await this.modules.canvasManager.init();
        
        // History Manager - undo/redo system
        this.modules.historyManager = new HistoryManager(this);
        await this.modules.historyManager.init();
        
        // Layer Manager - layer management
        this.modules.layerManager = new LayerManager(this);
        await this.modules.layerManager.init();
        
        // Brush Engine - brush rendering
        this.modules.brushEngine = new BrushEngine(this);
        await this.modules.brushEngine.init();
        
        // Shape Renderer - shape drawing
        this.modules.shapeRenderer = new ShapeRenderer(this);
        await this.modules.shapeRenderer.init();
        
        // Fill Engine - flood fill
        this.modules.fillEngine = new FillEngine(this);
        await this.modules.fillEngine.init();
        
        // Text Engine - text rendering
        this.modules.textEngine = new TextEngine(this);
        await this.modules.textEngine.init();
        
        // Selection Manager - selection operations
        this.modules.selectionManager = new SelectionManager(this);
        await this.modules.selectionManager.init();
        
        // Image Processor - image operations
        this.modules.imageProcessor = new ImageProcessor(this);
        await this.modules.imageProcessor.init();
        
        // Export Manager - file export
        this.modules.exportManager = new ExportManager(this);
        await this.modules.exportManager.init();
        
        // Storage Manager - save/load projects
        this.modules.storageManager = new StorageManager(this);
        await this.modules.storageManager.init();
        
        // Settings Manager - application settings
        this.modules.settingsManager = new SettingsManager(this);
        await this.modules.settingsManager.init();
        
        // Touch Handler - touch input
        this.modules.touchHandler = new TouchHandler(this);
        await this.modules.touchHandler.init();
        
        // Tool Manager - tool management (initialized last as it depends on others)
        this.modules.toolManager = new ToolManager(this);
        await this.modules.toolManager.init();
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Window events
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('beforeunload', (e) => this.handleBeforeUnload(e));
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Menu button
        this.elements.menuBtn.addEventListener('click', () => this.toggleSidePanel());
        
        // Theme toggle
        this.elements.themeToggle.addEventListener('click', this.handleThemeToggle);
        
        // Undo/Redo
        this.elements.undoBtn.addEventListener('click', this.handleUndo);
        this.elements.redoBtn.addEventListener('click', this.handleRedo);
        
        // Save
        this.elements.saveBtn.addEventListener('click', () => this.handleSave());
        
        // Settings
        this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        
        // Panel tabs
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.handlePanelToggle(e));
        });
        
        // Zoom controls
        this.elements.zoomOutBtn.addEventListener('click', () => this.zoomOut());
        this.elements.zoomInBtn.addEventListener('click', () => this.zoomIn());
        this.elements.zoomSelect.addEventListener('change', (e) => this.handleZoomChange(e));
        this.elements.fitToScreenBtn.addEventListener('click', () => this.fitToScreen());
        
        // Canvas container events for pan/zoom
        this.elements.canvasContainer.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        this.elements.canvasContainer.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        this.elements.canvasContainer.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        
        // Close context menu on click outside
        document.addEventListener('click', (e) => {
            if (!this.elements.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
        
        // Context menu actions
        this.elements.contextMenu.querySelectorAll('li[data-action]').forEach(item => {
            item.addEventListener('click', (e) => this.handleContextMenuAction(e));
        });
        
        // Layer controls
        document.getElementById('add-layer-btn')?.addEventListener('click', () => this.modules.layerManager.addLayer());
        document.getElementById('delete-layer-btn')?.addEventListener('click', () => this.modules.layerManager.deleteActiveLayer());
        document.getElementById('duplicate-layer-btn')?.addEventListener('click', () => this.modules.layerManager.duplicateActiveLayer());
        document.getElementById('merge-layer-btn')?.addEventListener('click', () => this.modules.layerManager.mergeActiveLayer());
        this.elements.layerOpacity.addEventListener('input', (e) => {
            this.modules.layerManager.setActiveLayerOpacity(parseInt(e.target.value) / 100);
            this.elements.opacityValue.textContent = e.target.value + '%';
        });
        
        // Page controls
        document.getElementById('add-page-btn')?.addEventListener('click', () => this.modules.canvasManager.addPage());
        document.getElementById('delete-page-btn')?.addEventListener('click', () => this.modules.canvasManager.deleteCurrentPage());
        document.getElementById('duplicate-page-btn')?.addEventListener('click', () => this.modules.canvasManager.duplicateCurrentPage());
        
        // Color controls
        this.elements.hueSlider.addEventListener('input', () => this.updateColorFromSliders());
        this.elements.saturationSlider.addEventListener('input', () => this.updateColorFromSliders());
        this.elements.lightnessSlider.addEventListener('input', () => this.updateColorFromSliders());
        this.elements.alphaSlider.addEventListener('input', () => this.updateColorFromSliders());
        this.elements.hexInput.addEventListener('change', () => this.updateColorFromHex());
        this.elements.previousColor.addEventListener('click', () => this.swapColors());
        
        // Brush controls
        this.elements.brushSize.addEventListener('input', (e) => {
            this.modules.brushEngine.setSize(parseInt(e.target.value));
            this.elements.brushSizeValue.textContent = e.target.value;
        });
        this.elements.brushOpacity.addEventListener('input', (e) => {
            this.modules.brushEngine.setOpacity(parseInt(e.target.value) / 100);
            this.elements.brushOpacityValue.textContent = e.target.value + '%';
        });
        this.elements.brushFlow.addEventListener('input', (e) => {
            this.modules.brushEngine.setFlow(parseInt(e.target.value) / 100);
            this.elements.brushFlowValue.textContent = e.target.value + '%';
        });
        this.elements.brushHardness.addEventListener('input', (e) => {
            this.modules.brushEngine.setHardness(parseInt(e.target.value) / 100);
            this.elements.brushHardnessValue.textContent = e.target.value + '%';
        });
        
        // Draw color wheel
        this.drawColorWheel();
        this.elements.colorWheel.addEventListener('click', (e) => this.handleColorWheelClick(e));
        
        // Update recent colors
        this.updateRecentColors();
        
        // Generate color palettes
        this.generateColorPalettes();
        
        // Handle initial resize
        this.handleResize();
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        this.keyboardShortcuts = new Map([
            ['z', { ctrl: true, shift: false, handler: this.handleUndo }],
            ['y', { ctrl: true, shift: false, handler: this.handleRedo }],
            ['z', { ctrl: true, shift: true, handler: this.handleRedo }],
            ['s', { ctrl: true, shift: false, handler: () => this.handleSave() }],
            ['o', { ctrl: true, shift: false, handler: () => this.handleOpen() }],
            ['c', { ctrl: true, shift: false, handler: () => this.handleCopy() }],
            ['v', { ctrl: true, shift: false, handler: () => this.handlePaste() }],
            ['x', { ctrl: true, shift: false, handler: () => this.handleCut() }],
            ['a', { ctrl: true, shift: false, handler: () => this.handleSelectAll() }],
            ['d', { ctrl: true, shift: false, handler: () => this.handleDeselect() }],
            ['Delete', { ctrl: false, shift: false, handler: () => this.handleDelete() }],
            ['Escape', { ctrl: false, shift: false, handler: () => this.handleEscape() }],
            ['g', { ctrl: true, shift: false, handler: () => this.toggleGrid() }],
            ['r', { ctrl: true, shift: false, handler: () => this.toggleRulers() }],
            ['=', { ctrl: true, shift: false, handler: () => this.zoomIn() }],
            ['-', { ctrl: true, shift: false, handler: () => this.zoomOut() }],
            ['0', { ctrl: true, shift: false, handler: () => this.resetZoom() }],
            ['1', { ctrl: true, shift: false, handler: () => this.setZoom(1) }],
            ['2', { ctrl: true, shift: false, handler: () => this.setZoom(2) }],
            ['b', { ctrl: false, shift: false, handler: () => this.handleToolChange('pen') }],
            ['p', { ctrl: false, shift: false, handler: () => this.handleToolChange('pencil') }],
            ['m', { ctrl: false, shift: false, handler: () => this.handleToolChange('marker') }],
            ['e', { ctrl: false, shift: false, handler: () => this.handleToolChange('eraser') }],
            ['g', { ctrl: false, shift: false, handler: () => this.handleToolChange('fill') }],
            ['i', { ctrl: false, shift: false, handler: () => this.handleToolChange('eyedropper') }],
            ['t', { ctrl: false, shift: false, handler: () => this.handleToolChange('text') }],
            ['h', { ctrl: false, shift: false, handler: () => this.handleToolChange('hand') }],
            ['l', { ctrl: false, shift: false, handler: () => this.handleToolChange('line') }],
            ['u', { ctrl: false, shift: false, handler: () => this.handleToolChange('rectangle') }],
        ]);
    }

    /**
     * Handle keydown events
     * @param {KeyboardEvent} e 
     */
    handleKeyDown(e) {
        // Prevent default for shortcuts
        const key = e.key.toLowerCase();
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        
        // Handle space for hand tool
        if (key === ' ' && !this.state.spacePressed) {
            this.state.spacePressed = true;
            if (this.state.currentTool !== 'hand') {
                this.state.previousTool = this.state.currentTool;
                this.handleToolChange('hand');
            }
            e.preventDefault();
            return;
        }
        
        // Check for registered shortcuts
        for (const [shortcutKey, shortcut] of this.keyboardShortcuts) {
            if (key === shortcutKey && 
                ctrl === shortcut.ctrl && 
                shift === shortcut.shift) {
                e.preventDefault();
                shortcut.handler();
                return;
            }
        }
        
        // Number keys for tool switching
        if (!ctrl && !shift && key >= '1' && key <= '9') {
            const toolIndex = parseInt(key) - 1;
            const tools = this.modules.toolManager?.getToolList();
            if (tools && tools[toolIndex]) {
                e.preventDefault();
                this.handleToolChange(tools[toolIndex].id);
            }
        }
    }

    /**
     * Handle keyup events
     * @param {KeyboardEvent} e 
     */
    handleKeyUp(e) {
        if (e.key === ' ' && this.state.spacePressed) {
            this.state.spacePressed = false;
            if (this.state.currentTool === 'hand' && this.state.previousTool) {
                this.handleToolChange(this.state.previousTool);
            }
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        const containerWidth = this.elements.canvasContainer.clientWidth;
        const containerHeight = this.elements.canvasContainer.clientHeight;
        
        // Update canvas dimensions if needed
        if (this.modules.canvasManager) {
            this.modules.canvasManager.handleContainerResize(containerWidth, containerHeight);
        }
        
        this.updateUI();
    }

    /**
     * Handle theme toggle
     */
    handleThemeToggle() {
        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(this.state.theme);
        this.modules.settingsManager?.setSetting('theme', this.state.theme);
        
        const icon = this.elements.themeToggle.querySelector('.material-symbols-outlined');
        if (icon) {
            icon.textContent = this.state.theme === 'dark' ? 'dark_mode' : 'light_mode';
        }
    }

    /**
     * Apply theme to application
     * @param {string} theme - 'dark' or 'light'
     */
    applyTheme(theme) {
        document.body.classList.remove('dark-mode', 'light-mode');
        document.body.classList.add(theme === 'dark' ? 'dark-mode' : 'light-mode');
        
        // Update theme color meta tag
        const themeColor = document.querySelector('meta[name="theme-color"]');
        if (themeColor) {
            themeColor.content = theme === 'dark' ? '#1a1a2e' : '#fef7ff';
        }
    }

    /**
     * Handle panel tab switching
     * @param {Event} e 
     */
    handlePanelToggle(e) {
        const tab = e.currentTarget;
        const panelId = tab.dataset.panel;
        
        // Update active tab
        document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Show corresponding panel
        document.querySelectorAll('.panel-section').forEach(s => s.classList.remove('active'));
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.add('active');
        }
        
        this.state.activePanel = panelId;
        
        // Expand side panel if collapsed
        if (this.elements.sidePanel.classList.contains('panel-collapsed')) {
            this.expandSidePanel();
        }
    }

    /**
     * Toggle side panel visibility
     */
    toggleSidePanel() {
        this.elements.sidePanel.classList.toggle('panel-collapsed');
    }

    /**
     * Expand side panel
     */
    expandSidePanel() {
        this.elements.sidePanel.classList.remove('panel-collapsed');
    }

    /**
     * Handle tool change
     * @param {string} toolId 
     */
    handleToolChange(toolId) {
        if (this.state.currentTool !== toolId) {
            this.state.previousTool = this.state.currentTool;
            this.state.currentTool = toolId;
            
            // Update tool buttons
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === toolId);
            });
            
            // Notify tool manager
            this.modules.toolManager?.selectTool(toolId);
            
            // Update cursor
            this.updateCursor(toolId);
            
            // Update status bar
            this.updateStatusBar();
            
            // Update tool options
            this.updateToolOptions(toolId);
        }
    }

    /**
     * Update cursor based on current tool
     * @param {string} toolId 
     */
    updateCursor(toolId) {
        const cursors = {
            pen: 'crosshair',
            pencil: 'crosshair',
            marker: 'crosshair',
            spray: 'crosshair',
            highlighter: 'crosshair',
            eraser: 'cell',
            eyedropper: 'crosshair',
            fill: 'crosshair',
            line: 'crosshair',
            arrow: 'crosshair',
            rectangle: 'crosshair',
            square: 'crosshair',
            circle: 'crosshair',
            ellipse: 'crosshair',
            triangle: 'crosshair',
            polygon: 'crosshair',
            bezier: 'crosshair',
            text: 'text',
            selection: 'crosshair',
            move: 'move',
            hand: 'grab',
            zoom: 'zoom-in',
            crop: 'crosshair',
        };
        
        this.elements.mainCanvas.style.cursor = cursors[toolId] || 'default';
    }

    /**
     * Update tool options panel
     * @param {string} toolId 
     */
    updateToolOptions(toolId) {
        // This will be handled by the ToolManager
        this.modules.toolManager?.renderToolOptions(toolId);
    }

    /**
     * Handle zoom change from select
     * @param {Event} e 
     */
    handleZoomChange(e) {
        const zoom = parseFloat(e.target.value);
        this.setZoom(zoom);
    }

    /**
     * Set zoom level
     * @param {number} zoom 
     */
    setZoom(zoom) {
        this.state.zoom = Math.max(0.1, Math.min(8, zoom));
        this.elements.zoomSelect.value = this.state.zoom;
        this.elements.docZoom.textContent = Math.round(this.state.zoom * 100) + '%';
        
        // Apply zoom to canvas wrapper
        this.elements.canvasWrapper.style.transform = `translate(-50%, -50%) scale(${this.state.zoom})`;
        
        // Notify canvas manager
        this.modules.canvasManager?.updateZoom(this.state.zoom);
    }

    /**
     * Zoom in
     */
    zoomIn() {
        const currentZoom = this.state.zoom;
        let newZoom;
        
        if (currentZoom < 0.5) newZoom = Math.min(0.5, currentZoom * 2);
        else if (currentZoom < 1) newZoom = 1;
        else if (currentZoom < 2) newZoom = 2;
        else if (currentZoom < 4) newZoom = 4;
        else newZoom = 8;
        
        this.setZoom(newZoom);
    }

    /**
     * Zoom out
     */
    zoomOut() {
        const currentZoom = this.state.zoom;
        let newZoom;
        
        if (currentZoom > 4) newZoom = 4;
        else if (currentZoom > 2) newZoom = 2;
        else if (currentZoom > 1) newZoom = 1;
        else if (currentZoom > 0.5) newZoom = 0.5;
        else if (currentZoom > 0.25) newZoom = 0.25;
        else newZoom = 0.1;
        
        this.setZoom(newZoom);
    }

    /**
     * Reset zoom to 100%
     */
    resetZoom() {
        this.setZoom(1);
    }

    /**
     * Fit canvas to screen
     */
    fitToScreen() {
        const containerWidth = this.elements.canvasContainer.clientWidth;
        const containerHeight = this.elements.canvasContainer.clientHeight;
        const canvasWidth = this.elements.mainCanvas.width;
        const canvasHeight = this.elements.mainCanvas.height;
        
        const scaleX = (containerWidth * 0.9) / canvasWidth;
        const scaleY = (containerHeight * 0.9) / canvasHeight;
        const zoom = Math.min(scaleX, scaleY, 1);
        
        this.setZoom(zoom);
    }

    /**
     * Handle mouse wheel for zoom
     * @param {WheelEvent} e 
     */
    handleWheel(e) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = -e.deltaY;
            const zoomFactor = delta > 0 ? 1.1 : 0.9;
            const newZoom = Math.max(0.1, Math.min(8, this.state.zoom * zoomFactor));
            this.setZoom(newZoom);
        }
    }

    /**
     * Handle canvas mouse down (for panning)
     * @param {MouseEvent} e 
     */
    handleCanvasMouseDown(e) {
        if (e.button === 1 || (e.button === 0 && this.state.currentTool === 'hand')) {
            this.state.isPanning = true;
            this.elements.mainCanvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    }

    /**
     * Handle context menu
     * @param {MouseEvent} e 
     */
    handleContextMenu(e) {
        e.preventDefault();
        this.showContextMenu(e.clientX, e.clientY);
    }

    /**
     * Show context menu
     * @param {number} x 
     * @param {number} y 
     */
    showContextMenu(x, y) {
        const menu = this.elements.contextMenu;
        menu.style.display = 'block';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        
        // Adjust position if off-screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (y - rect.height) + 'px';
        }
    }

    /**
     * Hide context menu
     */
    hideContextMenu() {
        this.elements.contextMenu.style.display = 'none';
    }

    /**
     * Handle context menu action
     * @param {MouseEvent} e 
     */
    handleContextMenuAction(e) {
        const action = e.currentTarget.dataset.action;
        this.hideContextMenu();
        
        switch (action) {
            case 'cut': this.handleCut(); break;
            case 'copy': this.handleCopy(); break;
            case 'paste': this.handlePaste(); break;
            case 'delete': this.handleDelete(); break;
            case 'select-all': this.handleSelectAll(); break;
            case 'deselect': this.handleDeselect(); break;
            case 'bring-to-front': this.modules.layerManager?.bringToFront(); break;
            case 'send-to-back': this.modules.layerManager?.sendToBack(); break;
        }
    }

    /**
     * Handle undo
     */
    handleUndo() {
        this.modules.historyManager?.undo();
        this.updateUI();
    }

    /**
     * Handle redo
     */
    handleRedo() {
        this.modules.historyManager?.redo();
        this.updateUI();
    }

    /**
     * Handle save
     */
    async handleSave() {
        try {
            await this.modules.storageManager?.saveProject();
            this.state.isModified = false;
            this.showToast('پروژه ذخیره شد', 'success');
        } catch (error) {
            console.error('Save failed:', error);
            this.showToast('خطا در ذخیره‌سازی', 'error');
        }
    }

    /**
     * Handle open project
     */
    async handleOpen() {
        try {
            await this.modules.storageManager?.openProject();
            this.showToast('پروژه باز شد', 'success');
        } catch (error) {
            console.error('Open failed:', error);
            this.showToast('خطا در باز کردن پروژه', 'error');
        }
    }

    /**
     * Handle copy
     */
    handleCopy() {
        this.modules.selectionManager?.copy();
    }

    /**
     * Handle paste
     */
    handlePaste() {
        this.modules.selectionManager?.paste();
    }

    /**
     * Handle cut
     */
    handleCut() {
        this.modules.selectionManager?.cut();
    }

    /**
     * Handle delete
     */
    handleDelete() {
        this.modules.selectionManager?.deleteSelection();
    }

    /**
     * Handle select all
     */
    handleSelectAll() {
        this.handleToolChange('selection');
        this.modules.selectionManager?.selectAll();
    }

    /**
     * Handle deselect
     */
    handleDeselect() {
        this.modules.selectionManager?.deselect();
    }

    /**
     * Handle escape key
     */
    handleEscape() {
        this.modules.selectionManager?.deselect();
        this.modules.textEngine?.finishEditing();
        this.handleToolChange('pen');
    }

    /**
     * Toggle grid
     */
    toggleGrid() {
        this.state.gridEnabled = !this.state.gridEnabled;
        this.modules.settingsManager?.setSetting('gridEnabled', this.state.gridEnabled);
        this.updateGrid();
        this.showToast(this.state.gridEnabled ? 'شبکه فعال شد' : 'شبکه غیرفعال شد', 'info');
    }

    /**
     * Toggle rulers
     */
    toggleRulers() {
        this.state.rulersEnabled = !this.state.rulersEnabled;
        this.modules.settingsManager?.setSetting('rulersEnabled', this.state.rulersEnabled);
        this.showToast(this.state.rulersEnabled ? 'خط‌کش فعال شد' : 'خط‌کش غیرفعال شد', 'info');
    }

    /**
     * Update grid display
     */
    updateGrid() {
        if (this.modules.canvasManager) {
            this.modules.canvasManager.renderGrid();
        }
    }

    /**
     * Open settings modal
     */
    openSettings() {
        this.modules.settingsManager?.openSettingsModal();
    }

    /**
     * Show toast notification
     * @param {string} message 
     * @param {string} type - 'success', 'error', 'info', 'warning'
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        this.elements.toastContainer.appendChild(toast);
        
        // Remove after animation
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    /**
     * Show modal dialog
     * @param {Object} options - Modal configuration
     * @returns {HTMLElement} Modal element
     */
    showModal(options = {}) {
        const {
            title = '',
            content = '',
            footer = '',
            onClose = null,
            size = 'medium',
        } = options;
        
        const modalWrapper = document.createElement('div');
        modalWrapper.className = 'modal-wrapper';
        
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.addEventListener('click', () => this.hideModal(modalWrapper));
        
        const modal = document.createElement('div');
        modal.className = `modal modal-${size}`;
        
        modal.innerHTML = `
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="modal-close-btn" aria-label="بستن">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="modal-body">${content}</div>
            ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
        `;
        
        modal.querySelector('.modal-close-btn').addEventListener('click', () => {
            this.hideModal(modalWrapper);
            if (onClose) onClose();
        });
        
        modalWrapper.appendChild(backdrop);
        modalWrapper.appendChild(modal);
        this.elements.modalContainer.appendChild(modalWrapper);
        
        return modal;
    }

    /**
     * Hide modal dialog
     * @param {HTMLElement} modalWrapper 
     */
    hideModal(modalWrapper) {
        if (modalWrapper && modalWrapper.parentNode) {
            modalWrapper.parentNode.removeChild(modalWrapper);
        }
    }

    /**
     * Update status bar
     */
    updateStatusBar() {
        this.elements.toolStatus.textContent = this.getToolDisplayName(this.state.currentTool);
        this.elements.autoSaveStatus.textContent = this.state.autoSaveEnabled ? 
            'ذخیره خودکار: فعال' : 'ذخیره خودکار: غیرفعال';
        
        // Update undo/redo button states
        this.elements.undoBtn.disabled = !this.modules.historyManager?.canUndo();
        this.elements.redoBtn.disabled = !this.modules.historyManager?.canRedo();
    }

    /**
     * Get display name for tool
     * @param {string} toolId 
     * @returns {string}
     */
    getToolDisplayName(toolId) {
        const names = {
            pen: 'قلم',
            pencil: 'مداد',
            marker: 'ماژیک',
            spray: 'اسپری',
            highlighter: 'هایلایتر',
            eraser: 'پاک‌کن',
            eyedropper: 'قطره‌چکان',
            fill: 'سطل رنگ',
            line: 'خط',
            arrow: 'پیکان',
            rectangle: 'مستطیل',
            square: 'مربع',
            circle: 'دایره',
            ellipse: 'بیضی',
            triangle: 'مثلث',
            polygon: 'چندضلعی',
            bezier: 'منحنی',
            text: 'متن',
            selection: 'انتخاب',
            move: 'جابجایی',
            hand: 'دست',
            zoom: 'بزرگ‌نمایی',
            crop: 'برش',
        };
        return names[toolId] || toolId;
    }

    /**
     * Update memory usage display
     */
    updateMemoryUsage() {
        if (performance.memory) {
            const usedMB = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
            const totalMB = Math.round(performance.memory.totalJSHeapSize / (1024 * 1024));
            this.state.memoryUsage = usedMB;
            this.elements.memoryUsage.textContent = `حافظه: ${usedMB}MB / ${totalMB}MB`;
        } else {
            this.elements.memoryUsage.textContent = 'حافظه: --';
        }
    }

    /**
     * Update all UI elements
     */
    updateUI() {
        this.updateStatusBar();
        this.updateMemoryUsage();
        
        if (this.modules.canvasManager) {
            const dimensions = this.modules.canvasManager.getCanvasDimensions();
            this.elements.docDimensions.textContent = `${dimensions.width}×${dimensions.height}`;
        }
        
        if (this.modules.layerManager) {
            this.modules.layerManager.renderLayerList();
        }
        
        if (this.modules.canvasManager) {
            this.modules.canvasManager.renderPageList();
        }
    }

    /**
     * Update cursor position in status bar
     * @param {number} x 
     * @param {number} y 
     */
    updateCursorPosition(x, y) {
        this.elements.cursorPosition.textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
    }

    /**
     * Update selection size in status bar
     * @param {number} width 
     * @param {number} height 
     */
    updateSelectionSize(width, height) {
        if (width > 0 && height > 0) {
            this.elements.selectionSize.style.display = 'inline';
            this.elements.selectionSize.textContent = `W: ${Math.round(width)}, H: ${Math.round(height)}`;
        } else {
            this.elements.selectionSize.style.display = 'none';
        }
    }

    /**
     * Load saved state from settings
     */
    async loadSavedState() {
        try {
            const settings = await this.modules.settingsManager?.loadSettings();
            if (settings) {
                this.state.theme = settings.theme || 'dark';
                this.state.gridEnabled = settings.gridEnabled || false;
                this.state.snapEnabled = settings.snapEnabled || false;
                this.state.rulersEnabled = settings.rulersEnabled || false;
                this.state.autoSaveEnabled = settings.autoSaveEnabled !== false;
                this.state.autoSaveInterval = settings.autoSaveInterval || 60000;
                this.state.maxUndoSteps = settings.maxUndoSteps || 1000;
                
                this.applyTheme(this.state.theme);
                
                if (this.modules.historyManager) {
                    this.modules.historyManager.setMaxSteps(this.state.maxUndoSteps);
                }
            }
        } catch (error) {
            console.warn('Could not load settings:', error);
        }
    }

    /**
     * Start auto-save functionality
     */
    startAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            if (this.state.isModified) {
                this.autoSave();
            }
        }, this.state.autoSaveInterval);
    }

    /**
     * Stop auto-save functionality
     */
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * Perform auto-save
     */
    async autoSave() {
        try {
            await this.modules.storageManager?.autoSave();
            this.state.lastAutoSave = Date.now();
            this.showToast('ذخیره خودکار انجام شد', 'info');
        } catch (error) {
            console.warn('Auto-save failed:', error);
        }
    }

    /**
     * Handle before unload event
     * @param {BeforeUnloadEvent} e 
     */
    handleBeforeUnload(e) {
        if (this.state.isModified) {
            // Perform emergency save
            this.modules.storageManager?.emergencySave();
            
            e.preventDefault();
            e.returnValue = 'تغییرات ذخیره نشده‌اند. آیا مطمئن هستید که می‌خواهید خارج شوید؟';
            return e.returnValue;
        }
    }

    /**
     * Game loop for performance monitoring
     */
    gameLoop() {
        this.frameCount++;
        const now = performance.now();
        
        // Calculate FPS
        if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = now;
            
            // Update memory usage periodically
            this.updateMemoryUsage();
        }
        
        this.lastFrameTime = now;
        requestAnimationFrame(() => this.gameLoop());
    }

    /**
     * Draw color wheel on canvas
     */
    drawColorWheel() {
        const canvas = this.elements.colorWheel;
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 5;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw color wheel
        for (let angle = 0; angle < 360; angle++) {
            const startAngle = (angle - 1) * Math.PI / 180;
            const endAngle = (angle + 1) * Math.PI / 180;
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            
            const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            gradient.addColorStop(0, 'white');
            gradient.addColorStop(0.5, `hsl(${angle}, 100%, 50%)`);
            gradient.addColorStop(1, 'black');
            
            ctx.fillStyle = gradient;
            ctx.fill();
        }
        
        // Draw center circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    /**
     * Handle color wheel click
     * @param {MouseEvent} e 
     */
    handleColorWheelClick(e) {
        const canvas = this.elements.colorWheel;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const radius = Math.min(centerX, centerY) - 5;
        
        // Check if click is inside the wheel
        if (distance <= radius) {
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const hue = ((angle + 360) % 360);
            const saturation = Math.min(100, (distance / radius) * 100);
            
            this.elements.hueSlider.value = Math.round(hue);
            this.elements.saturationSlider.value = Math.round(saturation);
            this.updateColorFromSliders();
        }
    }

    /**
     * Update color from HSL sliders
     */
    updateColorFromSliders() {
        const h = parseInt(this.elements.hueSlider.value);
        const s = parseInt(this.elements.saturationSlider.value);
        const l = parseInt(this.elements.lightnessSlider.value);
        const a = parseInt(this.elements.alphaSlider.value) / 100;
        
        this.elements.hueValue.textContent = h;
        this.elements.saturationValue.textContent = s;
        this.elements.lightnessValue.textContent = l;
        this.elements.alphaValue.textContent = Math.round(a * 100);
        
        const color = Utils.hslToHex(h, s, l);
        this.elements.hexInput.value = color;
        this.elements.currentColor.style.backgroundColor = `hsla(${h}, ${s}%, ${l}%, ${a})`;
        
        // Update brush color
        this.modules.brushEngine?.setColor(h, s, l, a);
    }

    /**
     * Update color from hex input
     */
    updateColorFromHex() {
        const hex = this.elements.hexInput.value.trim();
        const color = Utils.parseColor(hex);
        
        if (color) {
            const [h, s, l] = Utils.rgbToHsl(color.r, color.g, color.b);
            
            this.elements.hueSlider.value = Math.round(h);
            this.elements.saturationSlider.value = Math.round(s);
            this.elements.lightnessSlider.value = Math.round(l);
            
            if (color.a !== undefined) {
                this.elements.alphaSlider.value = Math.round(color.a * 100);
            }
            
            this.updateColorFromSliders();
        }
    }

    /**
     * Swap current and previous colors
     */
    swapColors() {
        const currentBg = this.elements.currentColor.style.backgroundColor;
        const prevBg = this.elements.previousColor.style.backgroundColor;
        
        this.elements.currentColor.style.backgroundColor = prevBg;
        this.elements.previousColor.style.backgroundColor = currentBg;
        
        // Update brush color from swapped current color
        const color = Utils.parseColorFromStyle(prevBg);
        if (color) {
            const [h, s, l] = Utils.rgbToHsl(color.r, color.g, color.b);
            this.modules.brushEngine?.setColor(h, s, l, color.a || 1);
        }
    }

    /**
     * Update recent colors display
     */
    updateRecentColors() {
        const recentColors = this.modules.settingsManager?.getRecentColors() || [];
        const container = this.elements.recentColors;
        container.innerHTML = '';
        
        recentColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'recent-color-swatch';
            swatch.style.backgroundColor = color;
            swatch.title = color;
            swatch.addEventListener('click', () => {
                this.elements.hexInput.value = color;
                this.updateColorFromHex();
            });
            container.appendChild(swatch);
        });
    }

    /**
     * Generate color palettes
     */
    generateColorPalettes() {
        const container = this.elements.colorPaletteGrid;
        container.innerHTML = '';
        
        // Generate Material Design color palette
        const materialColors = [
            '#F44336', '#E91E63', '#9C27B0', '#673AB7',
            '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
            '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
            '#FFEB3B', '#FFC107', '#FF9800', '#FF5722',
            '#795548', '#607D8B', '#9E9E9E', '#000000',
            '#FFFFFF', '#FFCDD2', '#F8BBD0', '#E1BEE7',
            '#D1C4E9', '#C5CAE9', '#BBDEFB', '#B3E5FC',
            '#B2EBF2', '#B2DFDB', '#C8E6C9', '#DCEDC8',
            '#F0F4C3', '#FFF9C4', '#FFECB3', '#FFE0B2',
            '#FFCCBC', '#D7CCC8', '#CFD8DC', '#F5F5F5',
        ];
        
        materialColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'palette-swatch';
            swatch.style.backgroundColor = color;
            swatch.title = color;
            swatch.addEventListener('click', () => {
                this.elements.hexInput.value = color;
                this.updateColorFromHex();
            });
            container.appendChild(swatch);
        });
    }

    /**
     * Mark document as modified
     */
    markAsModified() {
        this.state.isModified = true;
    }

    /**
     * Get current color object
     * @returns {Object} Color object {h, s, l, a, hex}
     */
    getCurrentColor() {
        return {
            h: parseInt(this.elements.hueSlider.value),
            s: parseInt(this.elements.saturationSlider.value),
            l: parseInt(this.elements.lightnessSlider.value),
            a: parseInt(this.elements.alphaSlider.value) / 100,
            hex: this.elements.hexInput.value,
        };
    }

    /**
     * Get current brush settings
     * @returns {Object} Brush settings
     */
    getBrushSettings() {
        return {
            size: parseInt(this.elements.brushSize.value),
            opacity: parseInt(this.elements.brushOpacity.value) / 100,
            flow: parseInt(this.elements.brushFlow.value) / 100,
            hardness: parseInt(this.elements.brushHardness.value) / 100,
        };
    }

    /**
     * Clean up and destroy application
     */
    destroy() {
        this.stopAutoSave();
        window.removeEventListener('resize', this.handleResize);
        
        // Destroy all modules
        Object.values(this.modules).forEach(module => {
            if (module && typeof module.destroy === 'function') {
                module.destroy();
            }
        });
        
        console.log('Paint Pro destroyed');
    }
}

// Create and initialize application when DOM is ready
const app = new PaintProApplication();

document.addEventListener('DOMContentLoaded', () => {
    app.init().catch(error => {
        console.error('Failed to initialize application:', error);
    });
});

// Export for debugging
window.PaintProApp = app;

export default app;

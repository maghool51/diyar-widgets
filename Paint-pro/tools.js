// ============================================
// Paint Pro - Professional Paint Application
// tools.js - Tool Manager Module
// Manages all drawing tools, tool switching, 
// tool options, and coordinates tool operations
// ============================================

import { Utils } from './utils.js';

/**
 * @class ToolManager
 * @description Manages all drawing and editing tools
 * Handles tool registration, switching, options rendering,
 * and delegates operations to appropriate modules
 */
export class ToolManager {
    /**
     * @param {Object} app - Reference to main application instance
     */
    constructor(app) {
        this.app = app;
        
        // Tool definitions
        this.tools = [];
        this.activeTool = null;
        this.activeToolId = 'pen';
        
        // Tool state
        this.isDrawing = false;
        this.startPoint = null;
        this.currentPoint = null;
        this.lastPoint = null;
        
        // Shape drawing state
        this.shapeInProgress = null;
        
        // Pointer tracking
        this.pointerId = null;
        
        // Tool options state
        this.toolOptions = {
            pen: {
                size: 10,
                opacity: 1,
                flow: 1,
                hardness: 0.5,
            },
            pencil: {
                size: 3,
                opacity: 0.9,
                flow: 1,
                hardness: 1,
            },
            marker: {
                size: 20,
                opacity: 0.5,
                flow: 0.8,
                hardness: 0.2,
            },
            spray: {
                size: 50,
                opacity: 0.3,
                flow: 0.5,
                density: 0.5,
            },
            highlighter: {
                size: 30,
                opacity: 0.3,
                flow: 1,
                hardness: 0.1,
            },
            eraser: {
                size: 30,
                opacity: 1,
                hardness: 0.5,
            },
            line: {
                size: 2,
                opacity: 1,
            },
            arrow: {
                size: 2,
                opacity: 1,
            },
            rectangle: {
                size: 2,
                opacity: 1,
                fill: false,
                rounded: 0,
            },
            square: {
                size: 2,
                opacity: 1,
                fill: false,
            },
            circle: {
                size: 2,
                opacity: 1,
                fill: false,
            },
            ellipse: {
                size: 2,
                opacity: 1,
                fill: false,
            },
            triangle: {
                size: 2,
                opacity: 1,
                fill: false,
            },
            polygon: {
                sides: 6,
                size: 2,
                opacity: 1,
                fill: false,
            },
            bezier: {
                size: 2,
                opacity: 1,
            },
            text: {
                fontSize: 24,
                fontFamily: 'Vazirmatn',
                bold: false,
                italic: false,
                underline: false,
                align: 'right',
            },
        };
        
        // Bind methods
        this.init = this.init.bind(this);
        this.registerTools = this.registerTools.bind(this);
        this.selectTool = this.selectTool.bind(this);
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.renderToolOptions = this.renderToolOptions.bind(this);
        this.getToolList = this.getToolList.bind(this);
        this.getActiveToolConfig = this.getActiveToolConfig.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    /**
     * Initialize tool manager
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Register all tools
            this.registerTools();
            
            // Render tools in the toolbar
            this.renderToolbar();
            
            // Select default tool
            this.selectTool('pen');
            
            // Render initial tool options
            this.renderToolOptions('pen');
            
            console.log('Tool Manager initialized with', this.tools.length, 'tools');
        } catch (error) {
            console.error('Failed to initialize Tool Manager:', error);
            throw error;
        }
    }

    /**
     * Register all available tools
     */
    registerTools() {
        this.tools = [
            {
                id: 'pen',
                name: 'قلم',
                icon: 'brush',
                category: 'drawing',
                shortcut: 'B',
                cursor: 'crosshair',
            },
            {
                id: 'pencil',
                name: 'مداد',
                icon: 'edit',
                category: 'drawing',
                shortcut: 'P',
                cursor: 'crosshair',
            },
            {
                id: 'marker',
                name: 'ماژیک',
                icon: 'drive_file_rename_outline',
                category: 'drawing',
                shortcut: 'M',
                cursor: 'crosshair',
            },
            {
                id: 'spray',
                name: 'اسپری',
                icon: 'blur_on',
                category: 'drawing',
                shortcut: null,
                cursor: 'crosshair',
            },
            {
                id: 'highlighter',
                name: 'هایلایتر',
                icon: 'format_ink_highlighter',
                category: 'drawing',
                shortcut: null,
                cursor: 'crosshair',
            },
            {
                id: 'eraser',
                name: 'پاک‌کن',
                icon: 'ink_eraser',
                category: 'drawing',
                shortcut: 'E',
                cursor: 'cell',
            },
            {
                id: 'eyedropper',
                name: 'قطره‌چکان',
                icon: 'colorize',
                category: 'utility',
                shortcut: 'I',
                cursor: 'crosshair',
            },
            {
                id: 'fill',
                name: 'سطل رنگ',
                icon: 'format_color_fill',
                category: 'utility',
                shortcut: 'G',
                cursor: 'crosshair',
            },
            {
                id: 'line',
                name: 'خط',
                icon: 'show_chart',
                category: 'shape',
                shortcut: 'L',
                cursor: 'crosshair',
            },
            {
                id: 'arrow',
                name: 'پیکان',
                icon: 'arrow_forward',
                category: 'shape',
                shortcut: null,
                cursor: 'crosshair',
            },
            {
                id: 'rectangle',
                name: 'مستطیل',
                icon: 'rectangle',
                category: 'shape',
                shortcut: 'U',
                cursor: 'crosshair',
            },
            {
                id: 'square',
                name: 'مربع',
                icon: 'crop_square',
                category: 'shape',
                shortcut: null,
                cursor: 'crosshair',
            },
            {
                id: 'circle',
                name: 'دایره',
                icon: 'circle',
                category: 'shape',
                shortcut: null,
                cursor: 'crosshair',
            },
            {
                id: 'ellipse',
                name: 'بیضی',
                icon: 'shape_line',
                category: 'shape',
                shortcut: null,
                cursor: 'crosshair',
            },
            {
                id: 'triangle',
                name: 'مثلث',
                icon: 'change_history',
                category: 'shape',
                shortcut: null,
                cursor: 'crosshair',
            },
            {
                id: 'polygon',
                name: 'چندضلعی',
                icon: 'hexagon',
                category: 'shape',
                shortcut: null,
                cursor: 'crosshair',
            },
            {
                id: 'bezier',
                name: 'منحنی',
                icon: 'timeline',
                category: 'shape',
                shortcut: null,
                cursor: 'crosshair',
            },
            {
                id: 'text',
                name: 'متن',
                icon: 'text_fields',
                category: 'utility',
                shortcut: 'T',
                cursor: 'text',
            },
            {
                id: 'selection',
                name: 'انتخاب',
                icon: 'highlight_alt',
                category: 'edit',
                shortcut: null,
                cursor: 'crosshair',
            },
            {
                id: 'move',
                name: 'جابجایی',
                icon: 'pan_tool',
                category: 'edit',
                shortcut: null,
                cursor: 'move',
            },
            {
                id: 'hand',
                name: 'دست',
                icon: 'pan_tool_alt',
                category: 'navigation',
                shortcut: 'H',
                cursor: 'grab',
            },
            {
                id: 'zoom',
                name: 'بزرگ‌نمایی',
                icon: 'zoom_in',
                category: 'navigation',
                shortcut: null,
                cursor: 'zoom-in',
            },
            {
                id: 'crop',
                name: 'برش',
                icon: 'crop',
                category: 'edit',
                shortcut: null,
                cursor: 'crosshair',
            },
        ];
    }

    /**
     * Render toolbar buttons
     */
    renderToolbar() {
        const container = this.app.elements.toolsGrid;
        if (!container) return;
        
        container.innerHTML = '';
        
        // Group tools by category
        const categories = {
            drawing: { name: 'طراحی', tools: [] },
            shape: { name: 'اشکال', tools: [] },
            utility: { name: 'ابزارها', tools: [] },
            edit: { name: 'ویرایش', tools: [] },
            navigation: { name: 'پیمایش', tools: [] },
        };
        
        this.tools.forEach(tool => {
            if (categories[tool.category]) {
                categories[tool.category].tools.push(tool);
            }
        });
        
        // Render tools
        Object.values(categories).forEach(category => {
            category.tools.forEach(tool => {
                const button = document.createElement('button');
                button.className = 'tool-btn';
                button.dataset.tool = tool.id;
                button.title = `${tool.name}${tool.shortcut ? ` (${tool.shortcut})` : ''}`;
                
                button.innerHTML = `
                    <span class="material-symbols-outlined">${tool.icon}</span>
                    <span class="tool-label">${tool.name}</span>
                `;
                
                button.addEventListener('click', () => {
                    this.selectTool(tool.id);
                });
                
                container.appendChild(button);
            });
        });
        
        // Highlight active tool
        this.updateToolButtonHighlight();
    }

    /**
     * Select and activate a tool
     * @param {string} toolId - Tool identifier
     */
    selectTool(toolId) {
        const tool = this.tools.find(t => t.id === toolId);
        if (!tool) return;
        
        // Deactivate current tool
        if (this.activeToolId === toolId) return;
        
        // Finish any in-progress operations
        this.finishCurrentOperation();
        
        // Update active tool
        this.activeToolId = toolId;
        this.activeTool = tool;
        
        // Update app state
        this.app.state.currentTool = toolId;
        
        // Update cursor
        this.app.elements.mainCanvas.style.cursor = tool.cursor || 'default';
        
        // Update UI
        this.updateToolButtonHighlight();
        this.renderToolOptions(toolId);
        this.app.updateStatusBar();
        
        // Notify other modules
        this.app.modules.selectionManager?.onToolChange(toolId);
        this.app.modules.textEngine?.onToolChange(toolId);
    }

    /**
     * Update tool button highlight
     */
    updateToolButtonHighlight() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === this.activeToolId);
        });
    }

    /**
     * Handle pointer down event
     * @param {Object} pos - Canvas position {x, y}
     * @param {PointerEvent} e - Original pointer event
     */
    handlePointerDown(pos, e) {
        this.isDrawing = true;
        this.startPoint = { x: pos.x, y: pos.y };
        this.currentPoint = { x: pos.x, y: pos.y };
        this.lastPoint = { x: pos.x, y: pos.y };
        this.pointerId = e.pointerId;
        
        const toolId = this.activeToolId;
        
        switch (toolId) {
            case 'pen':
            case 'pencil':
            case 'marker':
            case 'spray':
            case 'highlighter':
                this.startDrawingStroke(toolId, pos, e);
                break;
                
            case 'eraser':
                this.startErasing(pos, e);
                break;
                
            case 'eyedropper':
                this.sampleColor(pos);
                break;
                
            case 'fill':
                this.performFill(pos);
                break;
                
            case 'line':
            case 'arrow':
            case 'rectangle':
            case 'square':
            case 'circle':
            case 'ellipse':
            case 'triangle':
            case 'polygon':
                this.startShape(toolId, pos);
                break;
                
            case 'bezier':
                this.startBezier(pos);
                break;
                
            case 'text':
                this.startText(pos);
                break;
                
            case 'selection':
                this.app.modules.selectionManager?.startSelection(pos);
                break;
                
            case 'move':
                this.app.modules.selectionManager?.startMove(pos);
                break;
                
            case 'crop':
                this.startCrop(pos);
                break;
        }
    }

    /**
     * Handle pointer move event
     * @param {Object} pos - Canvas position {x, y}
     * @param {PointerEvent} e - Original pointer event
     */
    handlePointerMove(pos, e) {
        if (!this.isDrawing) return;
        
        this.currentPoint = { x: pos.x, y: pos.y };
        
        const toolId = this.activeToolId;
        
        switch (toolId) {
            case 'pen':
            case 'pencil':
            case 'marker':
            case 'spray':
            case 'highlighter':
                this.continueDrawingStroke(toolId, pos, e);
                break;
                
            case 'eraser':
                this.continueErasing(pos, e);
                break;
                
            case 'line':
            case 'arrow':
            case 'rectangle':
            case 'square':
            case 'circle':
            case 'ellipse':
            case 'triangle':
            case 'polygon':
                this.previewShape(toolId, pos);
                break;
                
            case 'bezier':
                this.previewBezier(pos);
                break;
                
            case 'selection':
                this.app.modules.selectionManager?.updateSelection(pos);
                break;
                
            case 'move':
                this.app.modules.selectionManager?.updateMove(pos);
                break;
                
            case 'crop':
                this.updateCrop(pos);
                break;
        }
        
        this.lastPoint = { x: pos.x, y: pos.y };
    }

    /**
     * Handle pointer up event
     * @param {Object} pos - Canvas position {x, y}
     * @param {PointerEvent} e - Original pointer event
     */
    handlePointerUp(pos, e) {
        if (!this.isDrawing) return;
        
        const toolId = this.activeToolId;
        
        switch (toolId) {
            case 'pen':
            case 'pencil':
            case 'marker':
            case 'spray':
            case 'highlighter':
                this.endDrawingStroke(toolId);
                break;
                
            case 'eraser':
                this.endErasing();
                break;
                
            case 'line':
            case 'arrow':
            case 'rectangle':
            case 'square':
            case 'circle':
            case 'ellipse':
            case 'triangle':
            case 'polygon':
                this.finishShape(toolId);
                break;
                
            case 'bezier':
                this.finishBezier();
                break;
                
            case 'selection':
                this.app.modules.selectionManager?.endSelection();
                break;
                
            case 'move':
                this.app.modules.selectionManager?.endMove();
                break;
                
            case 'crop':
                this.finishCrop();
                break;
        }
        
        this.isDrawing = false;
        this.startPoint = null;
        this.currentPoint = null;
        this.pointerId = null;
    }

    /**
     * Start drawing stroke with brush-based tools
     * @param {string} toolId 
     * @param {Object} pos 
     * @param {PointerEvent} e 
     */
    startDrawingStroke(toolId, pos, e) {
        const config = this.getToolConfig(toolId);
        const pressure = e.pressure || 0.5;
        const tiltX = e.tiltX || 0;
        const tiltY = e.tiltY || 0;
        
        this.app.modules.brushEngine?.startStroke(pos, {
            ...config,
            pressure,
            tiltX,
            tiltY,
            toolType: toolId,
        });
        
        // Save state for undo
        this.app.modules.historyManager?.beginOperation({
            type: 'draw',
            tool: toolId,
        });
    }

    /**
     * Continue drawing stroke
     * @param {string} toolId 
     * @param {Object} pos 
     * @param {PointerEvent} e 
     */
    continueDrawingStroke(toolId, pos, e) {
        const pressure = e.pressure || 0.5;
        const tiltX = e.tiltX || 0;
        const tiltY = e.tiltY || 0;
        
        this.app.modules.brushEngine?.continueStroke(pos, {
            pressure,
            tiltX,
            tiltY,
        });
    }

    /**
     * End drawing stroke
     * @param {string} toolId 
     */
    endDrawingStroke(toolId) {
        this.app.modules.brushEngine?.endStroke();
        
        // Save operation in history
        this.app.modules.historyManager?.endOperation();
        
        // Mark as modified
        this.app.markAsModified();
        
        // Update preview
        this.app.modules.canvasManager?.scheduleRender();
    }

    /**
     * Start erasing
     * @param {Object} pos 
     * @param {PointerEvent} e 
     */
    startErasing(pos, e) {
        const config = this.getToolConfig('eraser');
        
        this.app.modules.brushEngine?.startEraserStroke(pos, config);
        
        this.app.modules.historyManager?.beginOperation({
            type: 'erase',
        });
    }

    /**
     * Continue erasing
     * @param {Object} pos 
     * @param {PointerEvent} e 
     */
    continueErasing(pos, e) {
        this.app.modules.brushEngine?.continueEraserStroke(pos);
    }

    /**
     * End erasing
     */
    endErasing() {
        this.app.modules.brushEngine?.endEraserStroke();
        this.app.modules.historyManager?.endOperation();
        this.app.markAsModified();
        this.app.modules.canvasManager?.scheduleRender();
    }

    /**
     * Sample color from canvas
     * @param {Object} pos 
     */
    sampleColor(pos) {
        const color = this.app.modules.canvasManager?.getMainContext()?.getImageData(
            Math.round(pos.x), Math.round(pos.y), 1, 1
        ).data;
        
        if (color) {
            const [r, g, b, a] = color;
            const [h, s, l] = Utils.rgbToHsl(r, g, b);
            
            // Update color picker
            this.app.elements.hueSlider.value = Math.round(h);
            this.app.elements.saturationSlider.value = Math.round(s);
            this.app.elements.lightnessSlider.value = Math.round(l);
            this.app.elements.alphaSlider.value = Math.round(a / 255 * 100);
            
            // Update hex input
            const hex = Utils.rgbToHex(r, g, b);
            this.app.elements.hexInput.value = hex;
            this.app.elements.currentColor.style.backgroundColor = `rgba(${r},${g},${b},${a / 255})`;
            
            // Update brush color
            this.app.modules.brushEngine?.setColor(h, s, l, a / 255);
            
            this.app.showToast(`رنگ ${hex} نمونه‌برداری شد`, 'info');
            
            // Switch back to previous tool
            if (this.app.state.previousTool && this.app.state.previousTool !== 'eyedropper') {
                setTimeout(() => {
                    this.selectTool(this.app.state.previousTool);
                }, 100);
            }
        }
    }

    /**
     * Perform flood fill
     * @param {Object} pos 
     */
    performFill(pos) {
        const color = this.app.getCurrentColor();
        const ctx = this.app.modules.canvasManager?.getMainContext();
        
        if (ctx) {
            this.app.modules.historyManager?.beginOperation({
                type: 'fill',
            });
            
            this.app.modules.fillEngine?.floodFill(
                ctx,
                Math.round(pos.x),
                Math.round(pos.y),
                color
            );
            
            this.app.modules.historyManager?.endOperation();
            this.app.markAsModified();
            this.app.modules.canvasManager?.scheduleRender();
        }
    }

    /**
     * Start drawing a shape
     * @param {string} toolId 
     * @param {Object} pos 
     */
    startShape(toolId, pos) {
        this.shapeInProgress = {
            type: toolId,
            startX: pos.x,
            startY: pos.y,
            currentX: pos.x,
            currentY: pos.y,
        };
        
        // Show shape on preview canvas
        this.app.modules.canvasManager?.previewCtx?.clearRect(
            0, 0,
            this.app.modules.canvasManager.width,
            this.app.modules.canvasManager.height
        );
    }

    /**
     * Preview shape while drawing
     * @param {string} toolId 
     * @param {Object} pos 
     */
    previewShape(toolId, pos) {
        if (!this.shapeInProgress) return;
        
        this.shapeInProgress.currentX = pos.x;
        this.shapeInProgress.currentY = pos.y;
        
        const previewCtx = this.app.modules.canvasManager?.previewCtx;
        if (!previewCtx) return;
        
        // Clear preview
        const canvasWidth = this.app.modules.canvasManager.width;
        const canvasHeight = this.app.modules.canvasManager.height;
        previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        // Get configuration
        const config = this.getToolConfig(toolId);
        const color = this.app.getCurrentColor();
        const strokeColor = `hsla(${color.h}, ${color.s}%, ${color.l}%, ${color.a})`;
        
        // Draw shape preview
        this.app.modules.shapeRenderer?.drawShapePreview(
            previewCtx,
            toolId,
            this.shapeInProgress.startX,
            this.shapeInProgress.startY,
            pos.x,
            pos.y,
            {
                strokeColor,
                fillColor: config.fill ? `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.3)` : null,
                lineWidth: config.size,
                opacity: config.opacity,
            }
        );
    }

    /**
     * Finish drawing a shape
     * @param {string} toolId 
     */
    finishShape(toolId) {
        if (!this.shapeInProgress) return;
        
        const config = this.getToolConfig(toolId);
        const color = this.app.getCurrentColor();
        const mainCtx = this.app.modules.canvasManager?.getMainContext();
        
        if (mainCtx) {
            this.app.modules.historyManager?.beginOperation({
                type: 'shape',
                tool: toolId,
            });
            
            this.app.modules.shapeRenderer?.drawShape(
                mainCtx,
                toolId,
                this.shapeInProgress.startX,
                this.shapeInProgress.startY,
                this.shapeInProgress.currentX,
                this.shapeInProgress.currentY,
                {
                    strokeColor: `hsla(${color.h}, ${color.s}%, ${color.l}%, ${color.a})`,
                    fillColor: config.fill ? `hsla(${color.h}, ${color.s}%, ${color.l}%, ${color.a * 0.5})` : null,
                    lineWidth: config.size,
                    opacity: config.opacity,
                }
            );
            
            this.app.modules.historyManager?.endOperation();
            this.app.markAsModified();
        }
        
        // Clear preview
        const previewCtx = this.app.modules.canvasManager?.previewCtx;
        if (previewCtx) {
            previewCtx.clearRect(
                0, 0,
                this.app.modules.canvasManager.width,
                this.app.modules.canvasManager.height
            );
        }
        
        this.shapeInProgress = null;
        this.app.modules.canvasManager?.scheduleRender();
    }

    /**
     * Start bezier curve drawing
     * @param {Object} pos 
     */
    startBezier(pos) {
        if (!this.bezierPoints) {
            this.bezierPoints = [];
        }
        
        this.bezierPoints.push({ x: pos.x, y: pos.y });
        
        // If we have 4 points, draw the curve
        if (this.bezierPoints.length === 4) {
            this.finishBezier();
        }
    }

    /**
     * Preview bezier curve
     * @param {Object} pos 
     */
    previewBezier(pos) {
        if (!this.bezierPoints || this.bezierPoints.length === 0) return;
        
        const previewCtx = this.app.modules.canvasManager?.previewCtx;
        if (!previewCtx) return;
        
        const canvasWidth = this.app.modules.canvasManager.width;
        const canvasHeight = this.app.modules.canvasManager.height;
        previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        const color = this.app.getCurrentColor();
        const config = this.getToolConfig('bezier');
        
        // Draw preview with current points
        const points = [...this.bezierPoints, { x: pos.x, y: pos.y }];
        
        if (points.length === 2) {
            // Draw line preview
            previewCtx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.5)`;
            previewCtx.lineWidth = config.size;
            previewCtx.setLineDash([5, 5]);
            previewCtx.beginPath();
            previewCtx.moveTo(points[0].x, points[0].y);
            previewCtx.lineTo(pos.x, pos.y);
            previewCtx.stroke();
            previewCtx.setLineDash([]);
        } else if (points.length === 3) {
            // Draw quadratic preview
            previewCtx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.5)`;
            previewCtx.lineWidth = config.size;
            previewCtx.setLineDash([5, 5]);
            previewCtx.beginPath();
            previewCtx.moveTo(points[0].x, points[0].y);
            previewCtx.quadraticCurveTo(points[1].x, points[1].y, pos.x, pos.y);
            previewCtx.stroke();
            previewCtx.setLineDash([]);
        }
    }

    /**
     * Finish bezier curve
     */
    finishBezier() {
        if (!this.bezierPoints || this.bezierPoints.length < 4) return;
        
        const color = this.app.getCurrentColor();
        const config = this.getToolConfig('bezier');
        const mainCtx = this.app.modules.canvasManager?.getMainContext();
        
        if (mainCtx) {
            this.app.modules.historyManager?.beginOperation({
                type: 'bezier',
            });
            
            this.app.modules.shapeRenderer?.drawBezierCurve(
                mainCtx,
                this.bezierPoints[0],
                this.bezierPoints[1],
                this.bezierPoints[2],
                this.bezierPoints[3],
                {
                    strokeColor: `hsla(${color.h}, ${color.s}%, ${color.l}%, ${color.a})`,
                    lineWidth: config.size,
                    opacity: config.opacity,
                }
            );
            
            this.app.modules.historyManager?.endOperation();
            this.app.markAsModified();
        }
        
        // Clear preview
        const previewCtx = this.app.modules.canvasManager?.previewCtx;
        if (previewCtx) {
            previewCtx.clearRect(
                0, 0,
                this.app.modules.canvasManager.width,
                this.app.modules.canvasManager.height
            );
        }
        
        this.bezierPoints = [];
        this.app.modules.canvasManager?.scheduleRender();
    }

    /**
     * Start text tool
     * @param {Object} pos 
     */
    startText(pos) {
        this.app.modules.textEngine?.startTextAt(pos);
    }

    /**
     * Start crop tool
     * @param {Object} pos 
     */
    startCrop(pos) {
        this.app.modules.selectionManager?.startSelection(pos);
    }

    /**
     * Update crop selection
     * @param {Object} pos 
     */
    updateCrop(pos) {
        this.app.modules.selectionManager?.updateSelection(pos);
    }

    /**
     * Finish crop operation
     */
    finishCrop() {
        const selection = this.app.modules.selectionManager?.getSelectionBounds();
        if (selection && selection.width > 10 && selection.height > 10) {
            this.app.modules.imageProcessor?.cropToSelection(selection);
            this.app.modules.selectionManager?.deselect();
            this.app.showToast('تصویر برش خورد', 'success');
        }
    }

    /**
     * Finish any current operation (for tool switching)
     */
    finishCurrentOperation() {
        if (this.isDrawing) {
            // End current stroke if drawing
            const toolId = this.activeToolId;
            
            if (['pen', 'pencil', 'marker', 'spray', 'highlighter'].includes(toolId)) {
                this.endDrawingStroke(toolId);
            } else if (toolId === 'eraser') {
                this.endErasing();
            }
            
            this.isDrawing = false;
        }
        
        if (this.bezierPoints && this.bezierPoints.length > 0) {
            this.bezierPoints = [];
        }
        
        if (this.shapeInProgress) {
            this.shapeInProgress = null;
        }
        
        // Clear preview canvas
        const previewCtx = this.app.modules.canvasManager?.previewCtx;
        if (previewCtx) {
            const canvasWidth = this.app.modules.canvasManager.width;
            const canvasHeight = this.app.modules.canvasManager.height;
            previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        }
    }

    /**
     * Get configuration for a specific tool
     * @param {string} toolId 
     * @returns {Object} Tool configuration
     */
    getToolConfig(toolId) {
        return this.toolOptions[toolId] || {};
    }

    /**
     * Get active tool configuration
     * @returns {Object}
     */
    getActiveToolConfig() {
        return this.getToolConfig(this.activeToolId);
    }

    /**
     * Update tool options
     * @param {string} toolId 
     * @param {Object} options 
     */
    updateToolOptions(toolId, options) {
        if (this.toolOptions[toolId]) {
            Object.assign(this.toolOptions[toolId], options);
        }
    }

    /**
     * Render tool options panel
     * @param {string} toolId 
     */
    renderToolOptions(toolId) {
        const container = this.app.elements.toolOptions;
        if (!container) return;
        
        const config = this.getToolConfig(toolId);
        
        let html = '<div class="tool-options-content">';
        
        // Common size option for drawing tools
        if (['pen', 'pencil', 'marker', 'spray', 'highlighter', 'eraser'].includes(toolId)) {
            html += `
                <div class="slider-group">
                    <label>اندازه: <span>${config.size || 10}</span>px</label>
                    <input type="range" min="1" max="500" value="${config.size || 10}" 
                           onchange="window.PaintProApp.modules.toolManager.updateToolOption('${toolId}', 'size', parseInt(this.value))">
                </div>
            `;
        }
        
        // Shape options
        if (['rectangle', 'square', 'circle', 'ellipse', 'triangle', 'polygon'].includes(toolId)) {
            html += `
                <div class="slider-group">
                    <label>ضخامت خط: <span>${config.size || 2}</span>px</label>
                    <input type="range" min="1" max="100" value="${config.size || 2}"
                           onchange="window.PaintProApp.modules.toolManager.updateToolOption('${toolId}', 'size', parseInt(this.value))">
                </div>
                <div class="checkbox-group">
                    <label>
                        <input type="checkbox" ${config.fill ? 'checked' : ''} 
                               onchange="window.PaintProApp.modules.toolManager.updateToolOption('${toolId}', 'fill', this.checked)">
                        پر کردن
                    </label>
                </div>
            `;
        }
        
        // Polygon sides option
        if (toolId === 'polygon') {
            html += `
                <div class="slider-group">
                    <label>تعداد اضلاع: <span>${config.sides || 6}</span></label>
                    <input type="range" min="3" max="12" value="${config.sides || 6}"
                           onchange="window.PaintProApp.modules.toolManager.updateToolOption('${toolId}', 'sides', parseInt(this.value))">
                </div>
            `;
        }
        
        // Text options
        if (toolId === 'text') {
            html += `
                <div class="slider-group">
                    <label>اندازه قلم: <span>${config.fontSize || 24}</span>px</label>
                    <input type="range" min="8" max="200" value="${config.fontSize || 24}"
                           onchange="window.PaintProApp.modules.toolManager.updateToolOption('${toolId}', 'fontSize', parseInt(this.value))">
                </div>
                <div class="select-group">
                    <label>فونت:</label>
                    <select onchange="window.PaintProApp.modules.toolManager.updateToolOption('${toolId}', 'fontFamily', this.value)">
                        <option value="Vazirmatn" ${config.fontFamily === 'Vazirmatn' ? 'selected' : ''}>وزیرمتن</option>
                        <option value="Arial" ${config.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                        <option value="Tahoma" ${config.fontFamily === 'Tahoma' ? 'selected' : ''}>Tahoma</option>
                        <option value="Times New Roman" ${config.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                        <option value="monospace" ${config.fontFamily === 'monospace' ? 'selected' : ''}>Monospace</option>
                    </select>
                </div>
                <div class="button-group">
                    <button class="icon-btn-sm ${config.bold ? 'active' : ''}" 
                            onclick="window.PaintProApp.modules.toolManager.toggleTextStyle('bold')" title="ضخیم">
                        <strong>B</strong>
                    </button>
                    <button class="icon-btn-sm ${config.italic ? 'active' : ''}" 
                            onclick="window.PaintProApp.modules.toolManager.toggleTextStyle('italic')" title="کج">
                        <em>I</em>
                    </button>
                    <button class="icon-btn-sm ${config.underline ? 'active' : ''}" 
                            onclick="window.PaintProApp.modules.toolManager.toggleTextStyle('underline')" title="زیرخط">
                        <u>U</u>
                    </button>
                </div>
                <div class="button-group">
                    <button class="icon-btn-sm ${config.align === 'right' ? 'active' : ''}" 
                            onclick="window.PaintProApp.modules.toolManager.updateToolOption('${toolId}', 'align', 'right')" title="راست‌چین">
                        <span class="material-symbols-outlined">format_align_right</span>
                    </button>
                    <button class="icon-btn-sm ${config.align === 'center' ? 'active' : ''}" 
                            onclick="window.PaintProApp.modules.toolManager.updateToolOption('${toolId}', 'align', 'center')" title="وسط‌چین">
                        <span class="material-symbols-outlined">format_align_center</span>
                    </button>
                    <button class="icon-btn-sm ${config.align === 'left' ? 'active' : ''}" 
                            onclick="window.PaintProApp.modules.toolManager.updateToolOption('${toolId}', 'align', 'left')" title="چپ‌چین">
                        <span class="material-symbols-outlined">format_align_left</span>
                    </button>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * Update a specific tool option
     * @param {string} toolId 
     * @param {string} key 
     * @param {*} value 
     */
    updateToolOption(toolId, key, value) {
        if (this.toolOptions[toolId]) {
            this.toolOptions[toolId][key] = value;
        }
        
        // Update brush engine if needed
        if (['pen', 'pencil', 'marker', 'spray', 'highlighter'].includes(toolId)) {
            if (key === 'size') {
                this.app.elements.brushSize.value = value;
                this.app.elements.brushSizeValue.textContent = value;
                this.app.modules.brushEngine?.setSize(value);
            } else if (key === 'opacity') {
                this.app.elements.brushOpacity.value = value * 100;
                this.app.elements.brushOpacityValue.textContent = Math.round(value * 100) + '%';
                this.app.modules.brushEngine?.setOpacity(value);
            }
        }
        
        // Re-render options
        this.renderToolOptions(toolId);
    }

    /**
     * Toggle text style (bold, italic, underline)
     * @param {string} style 
     */
    toggleTextStyle(style) {
        const config = this.getToolConfig('text');
        config[style] = !config[style];
        this.renderToolOptions('text');
    }

    /**
     * Get list of all tools
     * @returns {Array}
     */
    getToolList() {
        return this.tools;
    }

    /**
     * Get active tool
     * @returns {Object|null}
     */
    getActiveTool() {
        return this.activeTool;
    }

    /**
     * Check if a drawing operation is in progress
     * @returns {boolean}
     */
    isOperationInProgress() {
        return this.isDrawing || this.shapeInProgress !== null;
    }

    /**
     * Destroy tool manager
     */
    destroy() {
        this.finishCurrentOperation();
        this.tools = [];
        this.activeTool = null;
        this.toolOptions = {};
        
        console.log('Tool Manager destroyed');
    }
}

export default ToolManager;

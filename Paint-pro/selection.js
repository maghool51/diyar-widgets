// ============================================
// Paint Pro - Professional Paint Application
// selection.js - Selection Manager Module
// Rectangle, lasso, magic wand selection,
// move, resize, rotate, copy, paste, cut
// ============================================

import { Utils } from './utils.js';

/**
 * @class SelectionManager
 * @description Manages all selection operations including
 * rectangular, lasso, and magic wand selection tools,
 * plus move, resize, rotate, copy, paste, and cut
 */
export class SelectionManager {
    /**
     * @param {Object} app - Reference to main application instance
     */
    constructor(app) {
        this.app = app;
        
        // Selection state
        this.selection = null;
        this.selectionType = 'rectangle'; // 'rectangle', 'lasso', 'magic-wand'
        this.isSelecting = false;
        this.isMoving = false;
        this.isResizing = false;
        this.isRotating = false;
        
        // Selection data
        this.selectionBounds = null; // {x, y, width, height}
        this.selectionData = null; // ImageData of selected area
        this.selectionMask = null; // For irregular selections
        this.selectionPoints = []; // For lasso selection
        
        // Transform state
        this.startPoint = null;
        this.currentPoint = null;
        this.dragOffset = { x: 0, y: 0 };
        this.rotationAngle = 0;
        this.resizeHandle = null;
        this.handleSize = 8;
        
        // Clipboard
        this.clipboard = null;
        
        // Handles for resize/rotate
        this.handles = [];
        this.activeHandle = null;
        
        // Floating selection (for move operations)
        this.floatingSelection = null;
        this.floatingCanvas = null;
        this.floatingCtx = null;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.startSelection = this.startSelection.bind(this);
        this.updateSelection = this.updateSelection.bind(this);
        this.endSelection = this.endSelection.bind(this);
        this.selectAll = this.selectAll.bind(this);
        this.deselect = this.deselect.bind(this);
        this.deleteSelection = this.deleteSelection.bind(this);
        this.copy = this.copy.bind(this);
        this.cut = this.cut.bind(this);
        this.paste = this.paste.bind(this);
        this.startMove = this.startMove.bind(this);
        this.updateMove = this.updateMove.bind(this);
        this.endMove = this.endMove.bind(this);
        this.renderSelection = this.renderSelection.bind(this);
        this.drawHandles = this.drawHandles.bind(this);
        this.getSelectionBounds = this.getSelectionBounds.bind(this);
        this.isPointInSelection = this.isPointInSelection.bind(this);
        this.onToolChange = this.onToolChange.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    /**
     * Initialize selection manager
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Create floating canvas for move operations
            this.createFloatingCanvas();
            
            console.log('Selection Manager initialized');
        } catch (error) {
            console.error('Failed to initialize Selection Manager:', error);
            throw error;
        }
    }

    /**
     * Create floating canvas for moving selections
     */
    createFloatingCanvas() {
        this.floatingCanvas = document.createElement('canvas');
        this.floatingCtx = this.floatingCanvas.getContext('2d');
    }

    /**
     * Start rectangle selection
     * @param {Object} pos - Starting position {x, y}
     */
    startSelection(pos) {
        this.deselect();
        this.isSelecting = true;
        this.selectionType = 'rectangle';
        this.startPoint = { x: pos.x, y: pos.y };
        this.currentPoint = { x: pos.x, y: pos.y };
        this.selectionBounds = {
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
        };
    }

    /**
     * Start lasso selection
     * @param {Object} pos - Starting position {x, y}
     */
    startLassoSelection(pos) {
        this.deselect();
        this.isSelecting = true;
        this.selectionType = 'lasso';
        this.selectionPoints = [{ x: pos.x, y: pos.y }];
    }

    /**
     * Update selection while dragging
     * @param {Object} pos - Current position {x, y}
     */
    updateSelection(pos) {
        if (!this.isSelecting) return;
        
        this.currentPoint = { x: pos.x, y: pos.y };
        
        if (this.selectionType === 'rectangle') {
            this.updateRectangleSelection(pos);
        } else if (this.selectionType === 'lasso') {
            this.updateLassoSelection(pos);
        }
        
        // Render selection preview
        this.renderSelectionPreview();
        
        // Update selection size in status bar
        if (this.selectionBounds) {
            this.app.updateSelectionSize(
                this.selectionBounds.width,
                this.selectionBounds.height
            );
        }
    }

    /**
     * Update rectangle selection bounds
     * @param {Object} pos 
     */
    updateRectangleSelection(pos) {
        const x = Math.min(this.startPoint.x, pos.x);
        const y = Math.min(this.startPoint.y, pos.y);
        const width = Math.abs(pos.x - this.startPoint.x);
        const height = Math.abs(pos.y - this.startPoint.y);
        
        this.selectionBounds = { x, y, width, height };
    }

    /**
     * Update lasso selection points
     * @param {Object} pos 
     */
    updateLassoSelection(pos) {
        this.selectionPoints.push({ x: pos.x, y: pos.y });
        
        // Calculate bounding box
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        this.selectionPoints.forEach(point => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        });
        
        this.selectionBounds = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    /**
     * End selection
     */
    endSelection() {
        if (!this.isSelecting) return;
        
        this.isSelecting = false;
        
        // Check if selection has minimum size
        if (this.selectionBounds && 
            this.selectionBounds.width < 5 && 
            this.selectionBounds.height < 5) {
            this.deselect();
            return;
        }
        
        // Capture selection data
        this.captureSelectionData();
        
        // Render selection
        this.renderSelection();
        
        // Clear preview
        this.clearPreview();
        
        // Update handles
        this.updateHandles();
    }

    /**
     * Capture selected area image data
     */
    captureSelectionData() {
        if (!this.selectionBounds) return;
        
        const ctx = this.app.modules.canvasManager?.getMainContext();
        if (!ctx) return;
        
        const { x, y, width, height } = this.selectionBounds;
        
        try {
            this.selectionData = ctx.getImageData(
                Math.round(x),
                Math.round(y),
                Math.round(width),
                Math.round(height)
            );
        } catch (error) {
            console.warn('Failed to capture selection data:', error);
            this.selectionData = null;
        }
    }

    /**
     * Select entire canvas
     */
    selectAll() {
        const dimensions = this.app.modules.canvasManager?.getCanvasDimensions();
        if (!dimensions) return;
        
        this.deselect();
        
        this.selectionType = 'rectangle';
        this.selectionBounds = {
            x: 0,
            y: 0,
            width: dimensions.width,
            height: dimensions.height,
        };
        
        this.captureSelectionData();
        this.updateHandles();
        this.renderSelection();
    }

    /**
     * Deselect current selection
     */
    deselect() {
        // Commit floating selection if active
        if (this.floatingSelection) {
            this.commitFloatingSelection();
        }
        
        this.selection = null;
        this.selectionBounds = null;
        this.selectionData = null;
        this.selectionMask = null;
        this.selectionPoints = [];
        this.isSelecting = false;
        this.isMoving = false;
        this.isResizing = false;
        this.isRotating = false;
        this.activeHandle = null;
        this.handles = [];
        this.floatingSelection = null;
        
        // Clear selection canvas
        this.clearSelectionCanvas();
        
        // Update status bar
        this.app.updateSelectionSize(0, 0);
    }

    /**
     * Delete selected content
     */
    deleteSelection() {
        if (!this.selectionBounds) return;
        
        const ctx = this.app.modules.canvasManager?.getMainContext();
        if (!ctx) return;
        
        // Record for undo
        this.app.modules.historyManager?.beginOperation({
            type: 'delete',
            bounds: { ...this.selectionBounds },
        });
        
        // Clear selected area
        ctx.clearRect(
            this.selectionBounds.x,
            this.selectionBounds.y,
            this.selectionBounds.width,
            this.selectionBounds.height
        );
        
        this.app.modules.historyManager?.endOperation();
        this.app.markAsModified();
        
        this.deselect();
        this.app.modules.canvasManager?.scheduleRender();
    }

    /**
     * Copy selection to clipboard
     */
    copy() {
        if (!this.selectionData) return;
        
        // Create canvas for clipboard
        const copyCanvas = document.createElement('canvas');
        copyCanvas.width = this.selectionBounds.width;
        copyCanvas.height = this.selectionBounds.height;
        const copyCtx = copyCanvas.getContext('2d');
        copyCtx.putImageData(this.selectionData, 0, 0);
        
        this.clipboard = {
            data: this.selectionData,
            bounds: { ...this.selectionBounds },
            canvas: copyCanvas,
        };
        
        // Also copy to system clipboard
        copyCanvas.toBlob(blob => {
            if (blob) {
                navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]).catch(() => {
                    // Fallback: clipboard API not supported
                });
            }
        });
        
        this.app.showToast('کپی شد', 'info');
    }

    /**
     * Cut selection to clipboard
     */
    cut() {
        this.copy();
        this.deleteSelection();
        this.app.showToast('برش داده شد', 'info');
    }

    /**
     * Paste from clipboard
     */
    paste() {
        if (!this.clipboard) {
            // Try to paste from system clipboard
            this.pasteFromSystem();
            return;
        }
        
        this.deselect();
        
        // Create new selection from clipboard
        const pasteX = 10;
        const pasteY = 10;
        
        this.selectionBounds = {
            x: pasteX,
            y: pasteY,
            width: this.clipboard.bounds.width,
            height: this.clipboard.bounds.height,
        };
        
        this.selectionData = new ImageData(
            new Uint8ClampedArray(this.clipboard.data.data),
            this.clipboard.data.width,
            this.clipboard.data.height
        );
        
        // Start floating selection for placement
        this.startFloatingSelection();
        
        this.app.markAsModified();
    }

    /**
     * Paste from system clipboard
     */
    async pasteFromSystem() {
        try {
            const clipboardItems = await navigator.clipboard.read();
            
            for (const item of clipboardItems) {
                for (const type of item.types) {
                    if (type.startsWith('image/')) {
                        const blob = await item.getType(type);
                        const bitmap = await createImageBitmap(blob);
                        
                        this.deselect();
                        
                        // Create selection from pasted image
                        this.selectionBounds = {
                            x: 10,
                            y: 10,
                            width: bitmap.width,
                            height: bitmap.height,
                        };
                        
                        // Draw to temp canvas to get ImageData
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = bitmap.width;
                        tempCanvas.height = bitmap.height;
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCtx.drawImage(bitmap, 0, 0);
                        
                        this.selectionData = tempCtx.getImageData(
                            0, 0, bitmap.width, bitmap.height
                        );
                        
                        this.startFloatingSelection();
                        this.app.markAsModified();
                        return;
                    }
                }
            }
        } catch (error) {
            console.warn('Paste from system failed:', error);
        }
    }

    /**
     * Start floating selection (for move/placement)
     */
    startFloatingSelection() {
        if (!this.selectionData || !this.selectionBounds) return;
        
        // Create floating canvas
        this.floatingCanvas.width = this.selectionBounds.width;
        this.floatingCanvas.height = this.selectionBounds.height;
        this.floatingCtx.putImageData(this.selectionData, 0, 0);
        
        this.floatingSelection = {
            x: this.selectionBounds.x,
            y: this.selectionBounds.y,
            width: this.selectionBounds.width,
            height: this.selectionBounds.height,
        };
        
        // Clear original area
        const ctx = this.app.modules.canvasManager?.getMainContext();
        if (ctx) {
            ctx.clearRect(
                this.selectionBounds.x,
                this.selectionBounds.y,
                this.selectionBounds.width,
                this.selectionBounds.height
            );
        }
        
        this.updateHandles();
        this.renderSelection();
    }

    /**
     * Commit floating selection to main canvas
     */
    commitFloatingSelection() {
        if (!this.floatingSelection || !this.floatingCanvas) return;
        
        const ctx = this.app.modules.canvasManager?.getMainContext();
        if (!ctx) return;
        
        // Record for undo
        this.app.modules.historyManager?.beginOperation({
            type: 'paste',
            bounds: { ...this.floatingSelection },
        });
        
        ctx.drawImage(
            this.floatingCanvas,
            this.floatingSelection.x,
            this.floatingSelection.y
        );
        
        this.app.modules.historyManager?.endOperation();
        
        // Update selection bounds
        this.selectionBounds = { ...this.floatingSelection };
        this.captureSelectionData();
        this.floatingSelection = null;
        
        this.updateHandles();
        this.renderSelection();
    }

    /**
     * Start moving selection
     * @param {Object} pos - Current position {x, y}
     */
    startMove(pos) {
        if (!this.selectionBounds) return;
        
        // Check if clicking on a handle
        const handle = this.getHandleAtPoint(pos.x, pos.y);
        if (handle) {
            this.activeHandle = handle;
            
            if (handle.type === 'rotate') {
                this.isRotating = true;
            } else {
                this.isResizing = true;
            }
            
            this.startPoint = { x: pos.x, y: pos.y };
            return;
        }
        
        // Check if clicking inside selection
        if (this.isPointInSelection(pos.x, pos.y)) {
            if (!this.floatingSelection) {
                this.startFloatingSelection();
            }
            
            this.isMoving = true;
            this.startPoint = { x: pos.x, y: pos.y };
            this.dragOffset = {
                x: pos.x - this.floatingSelection.x,
                y: pos.y - this.floatingSelection.y,
            };
        } else {
            // Clicked outside selection - deselect
            this.commitFloatingSelection();
            this.deselect();
        }
    }

    /**
     * Update move operation
     * @param {Object} pos - Current position {x, y}
     */
    updateMove(pos) {
        if (this.isMoving && this.floatingSelection) {
            this.floatingSelection.x = pos.x - this.dragOffset.x;
            this.floatingSelection.y = pos.y - this.dragOffset.y;
            
            this.selectionBounds.x = this.floatingSelection.x;
            this.selectionBounds.y = this.floatingSelection.y;
            
            this.updateHandles();
            this.renderSelection();
        } else if (this.isResizing && this.activeHandle) {
            this.updateResize(pos);
        } else if (this.isRotating && this.activeHandle) {
            this.updateRotate(pos);
        }
    }

    /**
     * Update resize operation
     * @param {Object} pos 
     */
    updateResize(pos) {
        if (!this.floatingSelection || !this.activeHandle) return;
        
        const dx = pos.x - this.startPoint.x;
        const dy = pos.y - this.startPoint.y;
        const handle = this.activeHandle;
        
        let newX = this.floatingSelection.x;
        let newY = this.floatingSelection.y;
        let newWidth = this.floatingSelection.width;
        let newHeight = this.floatingSelection.height;
        
        switch (handle.position) {
            case 'nw':
                newX += dx;
                newY += dy;
                newWidth -= dx;
                newHeight -= dy;
                break;
            case 'n':
                newY += dy;
                newHeight -= dy;
                break;
            case 'ne':
                newY += dy;
                newWidth += dx;
                newHeight -= dy;
                break;
            case 'e':
                newWidth += dx;
                break;
            case 'se':
                newWidth += dx;
                newHeight += dy;
                break;
            case 's':
                newHeight += dy;
                break;
            case 'sw':
                newX += dx;
                newWidth -= dx;
                newHeight += dy;
                break;
            case 'w':
                newX += dx;
                newWidth -= dx;
                break;
        }
        
        // Maintain minimum size
        if (newWidth < 10) {
            if (handle.position.includes('w')) {
                newX = this.floatingSelection.x + this.floatingSelection.width - 10;
            }
            newWidth = 10;
        }
        
        if (newHeight < 10) {
            if (handle.position.includes('n')) {
                newY = this.floatingSelection.y + this.floatingSelection.height - 10;
            }
            newHeight = 10;
        }
        
        this.floatingSelection.x = newX;
        this.floatingSelection.y = newY;
        this.floatingSelection.width = newWidth;
        this.floatingSelection.height = newHeight;
        
        // Resize the floating canvas content
        this.resizeFloatingContent(newWidth, newHeight);
        
        this.selectionBounds = { ...this.floatingSelection };
        this.updateHandles();
        this.renderSelection();
    }

    /**
     * Resize floating canvas content
     * @param {number} newWidth 
     * @param {number} newHeight 
     */
    resizeFloatingContent(newWidth, newHeight) {
        if (!this.floatingCanvas || !this.floatingSelection) return;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.floatingCanvas.width;
        tempCanvas.height = this.floatingCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.floatingCanvas, 0, 0);
        
        this.floatingCanvas.width = newWidth;
        this.floatingCanvas.height = newHeight;
        this.floatingCtx.clearRect(0, 0, newWidth, newHeight);
        this.floatingCtx.drawImage(
            tempCanvas,
            0, 0,
            this.floatingSelection.width,
            this.floatingSelection.height,
            0, 0,
            newWidth, newHeight
        );
    }

    /**
     * Update rotate operation
     * @param {Object} pos 
     */
    updateRotate(pos) {
        if (!this.floatingSelection) return;
        
        const centerX = this.floatingSelection.x + this.floatingSelection.width / 2;
        const centerY = this.floatingSelection.y + this.floatingSelection.height / 2;
        
        const startAngle = Math.atan2(
            this.startPoint.y - centerY,
            this.startPoint.x - centerX
        );
        
        const currentAngle = Math.atan2(
            pos.y - centerY,
            pos.x - centerX
        );
        
        this.rotationAngle = (currentAngle - startAngle) * 180 / Math.PI;
        
        // Apply rotation to floating canvas
        this.renderRotatedSelection();
    }

    /**
     * Render rotated floating selection
     */
    renderRotatedSelection() {
        if (!this.floatingCanvas) return;
        
        const ctx = this.app.modules.canvasManager?.getMainContext();
        if (!ctx) return;
        
        // Redraw everything
        this.app.modules.canvasManager?.render();
        
        // Draw rotated selection
        ctx.save();
        
        const centerX = this.floatingSelection.x + this.floatingSelection.width / 2;
        const centerY = this.floatingSelection.y + this.floatingSelection.height / 2;
        
        ctx.translate(centerX, centerY);
        ctx.rotate(this.rotationAngle * Math.PI / 180);
        ctx.drawImage(
            this.floatingCanvas,
            -this.floatingSelection.width / 2,
            -this.floatingSelection.height / 2
        );
        
        ctx.restore();
    }

    /**
     * End move operation
     */
    endMove() {
        this.isMoving = false;
        this.isResizing = false;
        this.isRotating = false;
        this.activeHandle = null;
        this.rotationAngle = 0;
        
        this.renderSelection();
    }

    /**
     * Render selection preview (while drawing)
     */
    renderSelectionPreview() {
        const ctx = this.app.modules.canvasManager?.previewCtx;
        if (!ctx || !this.selectionBounds) return;
        
        const canvas = ctx.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw selection rectangle
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
            this.selectionBounds.x,
            this.selectionBounds.y,
            this.selectionBounds.width,
            this.selectionBounds.height
        );
        ctx.setLineDash([]);
        
        // Draw semi-transparent fill
        ctx.fillStyle = 'rgba(0, 120, 215, 0.1)';
        ctx.fillRect(
            this.selectionBounds.x,
            this.selectionBounds.y,
            this.selectionBounds.width,
            this.selectionBounds.height
        );
    }

    /**
     * Clear preview canvas
     */
    clearPreview() {
        const ctx = this.app.modules.canvasManager?.previewCtx;
        if (ctx) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
    }

    /**
     * Render selection on selection canvas
     */
    renderSelection() {
        const ctx = this.app.modules.canvasManager?.selectionCtx;
        if (!ctx) return;
        
        this.clearSelectionCanvas();
        
        if (this.floatingSelection) {
            this.renderFloatingSelection(ctx);
        } else if (this.selectionBounds) {
            this.renderStaticSelection(ctx);
        }
    }

    /**
     * Render floating selection
     * @param {CanvasRenderingContext2D} ctx 
     */
    renderFloatingSelection(ctx) {
        if (!this.floatingCanvas || !this.floatingSelection) return;
        
        // Draw the floating content
        ctx.drawImage(
            this.floatingCanvas,
            this.floatingSelection.x,
            this.floatingSelection.y
        );
        
        // Draw selection border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
            this.floatingSelection.x,
            this.floatingSelection.y,
            this.floatingSelection.width,
            this.floatingSelection.height
        );
        ctx.setLineDash([]);
        
        // Draw handles
        this.drawHandles(ctx, this.floatingSelection);
    }

    /**
     * Render static selection
     * @param {CanvasRenderingContext2D} ctx 
     */
    renderStaticSelection(ctx) {
        if (!this.selectionBounds) return;
        
        // Draw selection border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
            this.selectionBounds.x,
            this.selectionBounds.y,
            this.selectionBounds.width,
            this.selectionBounds.height
        );
        ctx.setLineDash([]);
        
        // Draw handles
        this.drawHandles(ctx, this.selectionBounds);
    }

    /**
     * Draw resize/rotate handles
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Object} bounds 
     */
    drawHandles(ctx, bounds) {
        const { x, y, width, height } = bounds;
        const h = this.handleSize;
        
        // Handle positions
        const positions = [
            { x: x - h/2, y: y - h/2, cursor: 'nw-resize', position: 'nw' },
            { x: x + width/2 - h/2, y: y - h/2, cursor: 'n-resize', position: 'n' },
            { x: x + width - h/2, y: y - h/2, cursor: 'ne-resize', position: 'ne' },
            { x: x + width - h/2, y: y + height/2 - h/2, cursor: 'e-resize', position: 'e' },
            { x: x + width - h/2, y: y + height - h/2, cursor: 'se-resize', position: 'se' },
            { x: x + width/2 - h/2, y: y + height - h/2, cursor: 's-resize', position: 's' },
            { x: x - h/2, y: y + height - h/2, cursor: 'sw-resize', position: 'sw' },
            { x: x - h/2, y: y + height/2 - h/2, cursor: 'w-resize', position: 'w' },
        ];
        
        this.handles = positions;
        
        positions.forEach(handle => {
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.setLineDash([]);
            
            ctx.fillRect(handle.x, handle.y, h, h);
            ctx.strokeRect(handle.x, handle.y, h, h);
        });
        
        // Draw rotation handle at top center
        const rotHandleX = x + width / 2 - h / 2;
        const rotHandleY = y - h * 3;
        
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(rotHandleX + h/2, rotHandleY + h/2, h/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.stroke();
        
        // Line connecting rotation handle
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(rotHandleX + h/2, rotHandleY + h/2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        this.handles.push({
            x: rotHandleX,
            y: rotHandleY,
            cursor: 'crosshair',
            position: 'rotate',
            type: 'rotate',
        });
    }

    /**
     * Get handle at specific point
     * @param {number} px 
     * @param {number} py 
     * @returns {Object|null}
     */
    getHandleAtPoint(px, py) {
        for (const handle of this.handles) {
            if (px >= handle.x - 4 && px <= handle.x + this.handleSize + 4 &&
                py >= handle.y - 4 && py <= handle.y + this.handleSize + 4) {
                return handle;
            }
        }
        return null;
    }

    /**
     * Update handle positions based on current bounds
     */
    updateHandles() {
        const bounds = this.floatingSelection || this.selectionBounds;
        if (!bounds) return;
        
        // Handles are calculated in drawHandles
        this.renderSelection();
    }

    /**
     * Clear selection canvas
     */
    clearSelectionCanvas() {
        const ctx = this.app.modules.canvasManager?.selectionCtx;
        if (ctx) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
        this.app.modules.canvasManager?.selectionCanvas.style.display = 'none';
    }

    /**
     * Check if point is within current selection
     * @param {number} x 
     * @param {number} y 
     * @returns {boolean}
     */
    isPointInSelection(x, y) {
        const bounds = this.floatingSelection || this.selectionBounds;
        if (!bounds) return false;
        
        return x >= bounds.x && 
               x <= bounds.x + bounds.width &&
               y >= bounds.y && 
               y <= bounds.y + bounds.height;
    }

    /**
     * Get current selection bounds
     * @returns {Object|null}
     */
    getSelectionBounds() {
        return this.floatingSelection || this.selectionBounds;
    }

    /**
     * Check if actively selecting
     * @returns {boolean}
     */
    isSelecting() {
        return this.isSelecting || this.isMoving || this.isResizing || this.isRotating;
    }

    /**
     * Handle tool change
     * @param {string} toolId 
     */
    onToolChange(toolId) {
        if (toolId !== 'selection' && toolId !== 'move' && toolId !== 'crop') {
            // Commit any floating selection
            if (this.floatingSelection) {
                this.commitFloatingSelection();
            }
        }
    }

    /**
     * Destroy selection manager
     */
    destroy() {
        this.deselect();
        this.floatingCanvas = null;
        this.floatingCtx = null;
        
        console.log('Selection Manager destroyed');
    }
}

export default SelectionManager;

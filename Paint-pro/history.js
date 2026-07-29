// ============================================
// Paint Pro - Professional Paint Application
// history.js - History Manager Module
// Unlimited undo/redo using Command Pattern
// with memory-efficient state management
// ============================================

import { Utils } from './utils.js';

/**
 * @class HistoryManager
 * @description Implements undo/redo functionality using
 * the Command Pattern. Stores operations rather than full
 * canvas snapshots for memory efficiency.
 */
export class HistoryManager {
    /**
     * @param {Object} app - Reference to main application instance
     */
    constructor(app) {
        this.app = app;
        
        // History stacks
        this.undoStack = [];
        this.redoStack = [];
        
        // Maximum history size
        this.maxSteps = 1000;
        
        // Current operation being recorded
        this.currentOperation = null;
        
        // State snapshots for complex operations
        this.snapshots = new Map();
        
        // Operation types
        this.operationTypes = {
            DRAW: 'draw',
            ERASE: 'erase',
            SHAPE: 'shape',
            TEXT: 'text',
            FILL: 'fill',
            PASTE: 'paste',
            DELETE: 'delete',
            CROP: 'crop',
            TRANSFORM: 'transform',
            FILTER: 'filter',
            LAYER_ADD: 'layerAdd',
            LAYER_DELETE: 'layerDelete',
            LAYER_MERGE: 'layerMerge',
            LAYER_ORDER: 'layerOrder',
            CLEAR: 'clear',
            IMAGE: 'image',
            COMPOSITE: 'composite',
        };
        
        // Performance optimization
        this.batchMode = false;
        this.batchOperations = [];
        
        // Bind methods
        this.init = this.init.bind(this);
        this.beginOperation = this.beginOperation.bind(this);
        this.endOperation = this.endOperation.bind(this);
        this.recordOperation = this.recordOperation.bind(this);
        this.undo = this.undo.bind(this);
        this.redo = this.redo.bind(this);
        this.canUndo = this.canUndo.bind(this);
        this.canRedo = this.canRedo.bind(this);
        this.clear = this.clear.bind(this);
        this.takeSnapshot = this.takeSnapshot.bind(this);
        this.restoreSnapshot = this.restoreSnapshot.bind(this);
        this.recordStroke = this.recordStroke.bind(this);
        this.setMaxSteps = this.setMaxSteps.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    /**
     * Initialize history manager
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Take initial snapshot for reference
            this.takeInitialSnapshot();
            
            console.log('History Manager initialized');
        } catch (error) {
            console.error('Failed to initialize History Manager:', error);
            throw error;
        }
    }

    /**
     * Take initial canvas snapshot
     */
    takeInitialSnapshot() {
        const canvas = this.app.modules.canvasManager?.mainCanvas;
        if (canvas) {
            const snapshot = canvas.toDataURL('image/png');
            this.snapshots.set('initial', snapshot);
        }
    }

    /**
     * Begin recording an operation
     * @param {Object} metadata - Operation metadata
     */
    beginOperation(metadata = {}) {
        if (this.batchMode) {
            this.currentOperation = {
                id: Utils.generateUUID(),
                type: metadata.type || 'unknown',
                metadata: { ...metadata },
                timestamp: Date.now(),
                preState: null,
                postState: null,
                data: null,
            };
        } else {
            // Take pre-operation snapshot
            const preState = this.captureState();
            
            this.currentOperation = {
                id: Utils.generateUUID(),
                type: metadata.type || 'unknown',
                metadata: { ...metadata },
                timestamp: Date.now(),
                preState: preState,
                postState: null,
                data: null,
            };
        }
    }

    /**
     * End recording and push to undo stack
     * @param {Object} [additionalData] - Additional operation data
     */
    endOperation(additionalData = null) {
        if (!this.currentOperation) return;
        
        if (this.batchMode) {
            if (additionalData) {
                this.currentOperation.data = additionalData;
            }
            this.batchOperations.push(this.currentOperation);
            this.currentOperation = null;
        } else {
            // Take post-operation snapshot
            const postState = this.captureState();
            this.currentOperation.postState = postState;
            
            if (additionalData) {
                this.currentOperation.data = additionalData;
            }
            
            // Push to undo stack
            this.undoStack.push(this.currentOperation);
            
            // Clear redo stack (new action invalidates redo)
            this.redoStack = [];
            
            // Enforce max steps
            this.enforceMaxSteps();
            
            this.currentOperation = null;
            
            // Update UI
            this.updateUI();
            
            // Mark as modified
            this.app.markAsModified();
        }
    }

    /**
     * Record a complete operation directly
     * @param {Object} operation - Complete operation object
     */
    recordOperation(operation) {
        if (!operation || !operation.type) return;
        
        const op = {
            id: Utils.generateUUID(),
            type: operation.type,
            metadata: operation.metadata || {},
            timestamp: Date.now(),
            preState: operation.preState || this.captureState(),
            postState: operation.postState || null,
            data: operation.data || null,
        };
        
        this.undoStack.push(op);
        this.redoStack = [];
        
        this.enforceMaxSteps();
        this.updateUI();
        this.app.markAsModified();
    }

    /**
     * Undo last operation
     */
    undo() {
        if (this.undoStack.length === 0) return;
        
        const operation = this.undoStack.pop();
        
        // Restore pre-operation state
        if (operation.preState) {
            this.restoreState(operation.preState);
        }
        
        // Push to redo stack
        this.redoStack.push(operation);
        
        // Update UI
        this.updateUI();
        this.app.modules.canvasManager?.scheduleRender();
        this.app.markAsModified();
    }

    /**
     * Redo last undone operation
     */
    redo() {
        if (this.redoStack.length === 0) return;
        
        const operation = this.redoStack.pop();
        
        // Restore post-operation state
        if (operation.postState) {
            this.restoreState(operation.postState);
        }
        
        // Push back to undo stack
        this.undoStack.push(operation);
        
        // Update UI
        this.updateUI();
        this.app.modules.canvasManager?.scheduleRender();
        this.app.markAsModified();
    }

    /**
     * Record a brush stroke
     * @param {Array} points - Stroke points
     * @param {boolean} isEraser - Whether this is an eraser stroke
     */
    recordStroke(points, isEraser = false) {
        if (!points || points.length === 0) return;
        
        this.recordOperation({
            type: isEraser ? this.operationTypes.ERASE : this.operationTypes.DRAW,
            metadata: {
                pointCount: points.length,
                isEraser: isEraser,
                brushType: this.app.modules.brushEngine?.currentBrushType || 'pen',
            },
            preState: this.captureState(),
            postState: null,
            data: { points },
        });
    }

    /**
     * Capture current canvas state as base64
     * @returns {string} Base64 encoded image data
     */
    captureState() {
        const canvas = this.app.modules.canvasManager?.getCompositeCanvas();
        if (canvas) {
            return canvas.toDataURL('image/png', 0.5);
        }
        return null;
    }

    /**
     * Restore canvas state from base64
     * @param {string} state - Base64 encoded image data
     */
    restoreState(state) {
        if (!state) return;
        
        const ctx = this.app.modules.canvasManager?.getMainContext();
        if (!ctx) return;
        
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.drawImage(img, 0, 0);
            this.app.modules.canvasManager?.render();
        };
        img.src = state;
    }

    /**
     * Take a named snapshot for later restoration
     * @param {string} name - Snapshot identifier
     * @returns {string} Snapshot data
     */
    takeSnapshot(name) {
        const state = this.captureState();
        if (state) {
            this.snapshots.set(name, state);
        }
        return state;
    }

    /**
     * Restore a named snapshot
     * @param {string} name - Snapshot identifier
     */
    restoreSnapshot(name) {
        const state = this.snapshots.get(name);
        if (state) {
            this.restoreState(state);
        }
    }

    /**
     * Check if undo is available
     * @returns {boolean}
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * Check if redo is available
     * @returns {boolean}
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * Clear all history
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.currentOperation = null;
        this.batchOperations = [];
        this.snapshots.clear();
        
        this.takeInitialSnapshot();
        this.updateUI();
    }

    /**
     * Enforce maximum history steps
     */
    enforceMaxSteps() {
        while (this.undoStack.length > this.maxSteps) {
            this.undoStack.shift();
        }
        
        // Also limit redo stack
        while (this.redoStack.length > this.maxSteps) {
            this.redoStack.shift();
        }
    }

    /**
     * Set maximum number of undo steps
     * @param {number} steps 
     */
    setMaxSteps(steps) {
        this.maxSteps = Math.max(10, Math.min(10000, steps));
        this.enforceMaxSteps();
    }

    /**
     * Start batch mode (group multiple operations)
     */
    startBatch() {
        this.batchMode = true;
        this.batchOperations = [];
    }

    /**
     * End batch mode and record as single operation
     */
    endBatch() {
        if (this.batchOperations.length === 0) {
            this.batchMode = false;
            return;
        }
        
        const batchOperation = {
            id: Utils.generateUUID(),
            type: 'batch',
            metadata: {
                operationCount: this.batchOperations.length,
                types: this.batchOperations.map(op => op.type),
            },
            timestamp: Date.now(),
            preState: this.batchOperations[0].preState || this.captureState(),
            postState: this.captureState(),
            data: {
                operations: this.batchOperations,
            },
        };
        
        this.undoStack.push(batchOperation);
        this.redoStack = [];
        
        this.batchOperations = [];
        this.batchMode = false;
        
        this.enforceMaxSteps();
        this.updateUI();
        this.app.markAsModified();
    }

    /**
     * Update undo/redo button states
     */
    updateUI() {
        if (this.app.elements.undoBtn) {
            this.app.elements.undoBtn.disabled = !this.canUndo();
        }
        
        if (this.app.elements.redoBtn) {
            this.app.elements.redoBtn.disabled = !this.canRedo();
        }
    }

    /**
     * Get history statistics
     * @returns {Object}
     */
    getStats() {
        return {
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
            maxSteps: this.maxSteps,
            snapshotCount: this.snapshots.size,
            memoryUsage: this.estimateMemoryUsage(),
        };
    }

    /**
     * Estimate memory usage of history
     * @returns {number} Estimated bytes
     */
    estimateMemoryUsage() {
        let totalBytes = 0;
        
        // Estimate based on operation count and average snapshot size
        const avgSnapshotSize = 500000; // ~500KB per snapshot
        
        this.undoStack.forEach(() => {
            totalBytes += avgSnapshotSize;
        });
        
        this.redoStack.forEach(() => {
            totalBytes += avgSnapshotSize;
        });
        
        return totalBytes;
    }

    /**
     * Serialize history for project saving
     * @returns {Object}
     */
    serialize() {
        return {
            undoStack: this.undoStack.map(op => ({
                id: op.id,
                type: op.type,
                metadata: op.metadata,
                timestamp: op.timestamp,
                // Don't include full state data to save space
                hasPreState: !!op.preState,
                hasPostState: !!op.postState,
            })),
            redoStack: this.redoStack.map(op => ({
                id: op.id,
                type: op.type,
                metadata: op.metadata,
                timestamp: op.timestamp,
            })),
            maxSteps: this.maxSteps,
        };
    }

    /**
     * Deserialize history from saved data
     * @param {Object} data 
     */
    deserialize(data) {
        if (!data) return;
        
        this.maxSteps = data.maxSteps || 1000;
        
        // Note: Full state restoration is not possible from serialized data
        // Only metadata is preserved
        this.undoStack = (data.undoStack || []).map(op => ({
            id: op.id,
            type: op.type,
            metadata: op.metadata || {},
            timestamp: op.timestamp,
            preState: null, // Can't restore actual state data
            postState: null,
            data: null,
        }));
        
        this.redoStack = [];
        this.updateUI();
    }

    /**
     * Destroy history manager
     */
    destroy() {
        this.clear();
        
        console.log('History Manager destroyed');
    }
}

export default HistoryManager;

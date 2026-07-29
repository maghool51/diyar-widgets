// ============================================
// Paint Pro - Professional Paint Application
// touch.js - Touch Handler Module
// Multi-touch, gestures, stylus support,
// palm rejection, and touch optimization
// ============================================

import { Utils } from './utils.js';

/**
 * @class TouchHandler
 * @description Handles all touch interactions including
 * multi-touch gestures (pinch zoom, rotate), stylus input,
 * palm rejection, and touch event normalization
 */
export class TouchHandler {
    /**
     * @param {Object} app - Reference to main application instance
     */
    constructor(app) {
        this.app = app;
        
        // Touch state
        this.activeTouches = new Map();
        this.touchStartTime = 0;
        this.touchMoved = false;
        
        // Gesture state
        this.initialDistance = 0;
        this.initialAngle = 0;
        this.initialZoom = 1;
        this.isPinching = false;
        this.isRotating = false;
        this.pinchCenter = null;
        
        // Stylus state
        this.isStylus = false;
        this.stylusPressure = 0;
        this.stylusTiltX = 0;
        this.stylusTiltY = 0;
        this.stylusType = null;
        
        // Palm rejection
        this.palmRejectionEnabled = true;
        this.palmTouchId = null;
        this.touchRadiusThreshold = 20; // px
        
        // Touch settings
        this.tapTimeout = 300; // ms for double-tap detection
        this.longPressTimeout = 500; // ms
        this.lastTapTime = 0;
        this.lastTapPosition = null;
        this.doubleTapDistance = 30; // px
        
        // Performance
        this.touchMoveThrottle = 16; // ~60fps
        this.lastTouchMoveTime = 0;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.handleTouchCancel = this.handleTouchCancel.bind(this);
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.normalizeTouchEvent = this.normalizeTouchEvent.bind(this);
        this.handlePinchGesture = this.handlePinchGesture.bind(this);
        this.handleRotateGesture = this.handleRotateGesture.bind(this);
        this.detectPalm = this.detectPalm.bind(this);
        this.isPalmTouch = this.isPalmTouch.bind(this);
        this.getTouchCenter = this.getTouchCenter.bind(this);
        this.getTouchDistance = this.getTouchDistance.bind(this);
        this.getTouchAngle = this.getTouchAngle.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    /**
     * Initialize touch handler
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Setup touch event listeners
            this.setupTouchListeners();
            
            // Setup pointer event listeners (for stylus)
            this.setupPointerListeners();
            
            console.log('Touch Handler initialized');
        } catch (error) {
            console.error('Failed to initialize Touch Handler:', error);
            throw error;
        }
    }

    /**
     * Setup touch event listeners on canvas
     */
    setupTouchListeners() {
        const canvas = this.app.modules.canvasManager?.mainCanvas;
        if (!canvas) return;
        
        canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', this.handleTouchEnd);
        canvas.addEventListener('touchcancel', this.handleTouchCancel);
        
        // Also listen on canvas container for gestures
        const container = this.app.elements.canvasContainer;
        if (container) {
            container.addEventListener('touchstart', this.handleTouchStart, { passive: false });
            container.addEventListener('touchmove', this.handleTouchMove, { passive: false });
            container.addEventListener('touchend', this.handleTouchEnd);
        }
    }

    /**
     * Setup pointer event listeners for stylus support
     */
    setupPointerListeners() {
        const canvas = this.app.modules.canvasManager?.mainCanvas;
        if (!canvas) return;
        
        canvas.addEventListener('pointerdown', this.handlePointerDown);
        canvas.addEventListener('pointermove', this.handlePointerMove);
        canvas.addEventListener('pointerup', this.handlePointerUp);
        canvas.addEventListener('pointerleave', this.handlePointerUp);
        canvas.addEventListener('pointercancel', this.handlePointerUp);
    }

    /**
     * Handle touch start event
     * @param {TouchEvent} e 
     */
    handleTouchStart(e) {
        e.preventDefault();
        
        const touches = e.touches;
        this.touchStartTime = Date.now();
        this.touchMoved = false;
        
        // Process each touch point
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            
            // Check for palm rejection
            if (this.palmRejectionEnabled && this.isPalmTouch(touch)) {
                this.palmTouchId = touch.identifier;
                continue;
            }
            
            this.activeTouches.set(touch.identifier, {
                id: touch.identifier,
                startX: touch.clientX,
                startY: touch.clientY,
                currentX: touch.clientX,
                currentY: touch.clientY,
                radiusX: touch.radiusX || 0,
                radiusY: touch.radiusY || 0,
                force: touch.force || 0,
                startTime: Date.now(),
            });
        }
        
        // Handle multi-touch gestures
        if (this.activeTouches.size === 2) {
            this.initialDistance = this.getTouchDistance();
            this.initialAngle = this.getTouchAngle();
            this.initialZoom = this.app.state.zoom;
            this.isPinching = true;
            this.pinchCenter = this.getTouchCenter();
        } else if (this.activeTouches.size === 1 && !this.isPinching) {
            // Single touch - handle as drawing input
            const touch = Array.from(this.activeTouches.values())[0];
            const pos = this.app.modules.canvasManager?.screenToCanvas(touch.currentX, touch.currentY);
            
            if (pos) {
                // Create synthetic pointer event
                const syntheticEvent = {
                    clientX: touch.currentX,
                    clientY: touch.currentY,
                    pointerId: touch.id,
                    pressure: touch.force || 0.5,
                    pointerType: 'touch',
                    tiltX: 0,
                    tiltY: 0,
                };
                
                this.app.modules.toolManager?.handlePointerDown(pos, syntheticEvent);
            }
        }
        
        // Check for double tap
        if (touches.length === 1) {
            const touch = touches[0];
            const now = Date.now();
            
            if (this.lastTapPosition && 
                now - this.lastTapTime < this.tapTimeout &&
                Math.abs(touch.clientX - this.lastTapPosition.x) < this.doubleTapDistance &&
                Math.abs(touch.clientY - this.lastTapPosition.y) < this.doubleTapDistance) {
                // Double tap detected
                this.handleDoubleTap(touch);
            }
            
            this.lastTapTime = now;
            this.lastTapPosition = { x: touch.clientX, y: touch.clientY };
        }
    }

    /**
     * Handle touch move event
     * @param {TouchEvent} e 
     */
    handleTouchMove(e) {
        e.preventDefault();
        
        const now = Date.now();
        
        // Throttle touch move events
        if (now - this.lastTouchMoveTime < this.touchMoveThrottle) return;
        this.lastTouchMoveTime = now;
        
        this.touchMoved = true;
        const touches = e.touches;
        
        // Update active touches
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            
            // Skip palm touch
            if (touch.identifier === this.palmTouchId) continue;
            
            if (this.activeTouches.has(touch.identifier)) {
                const activeTouch = this.activeTouches.get(touch.identifier);
                activeTouch.currentX = touch.clientX;
                activeTouch.currentY = touch.clientY;
            }
        }
        
        // Handle pinch gesture
        if (this.isPinching && this.activeTouches.size >= 2) {
            this.handlePinchGesture();
            return;
        }
        
        // Handle single touch drawing
        if (this.activeTouches.size === 1 && !this.isPinching) {
            const touch = Array.from(this.activeTouches.values())[0];
            const pos = this.app.modules.canvasManager?.screenToCanvas(touch.currentX, touch.currentY);
            
            if (pos) {
                const syntheticEvent = {
                    clientX: touch.currentX,
                    clientY: touch.currentY,
                    pointerId: touch.id,
                    pressure: touch.force || 0.5,
                    pointerType: 'touch',
                    tiltX: 0,
                    tiltY: 0,
                };
                
                this.app.modules.toolManager?.handlePointerMove(pos, syntheticEvent);
            }
        }
    }

    /**
     * Handle touch end event
     * @param {TouchEvent} e 
     */
    handleTouchEnd(e) {
        const changedTouches = e.changedTouches;
        
        for (let i = 0; i < changedTouches.length; i++) {
            const touch = changedTouches[i];
            
            // Clear palm touch
            if (touch.identifier === this.palmTouchId) {
                this.palmTouchId = null;
                continue;
            }
            
            if (this.activeTouches.has(touch.identifier)) {
                const activeTouch = this.activeTouches.get(touch.identifier);
                
                // If drawing, end stroke
                if (this.activeTouches.size === 1 && !this.isPinching) {
                    const pos = this.app.modules.canvasManager?.screenToCanvas(
                        activeTouch.currentX,
                        activeTouch.currentY
                    );
                    
                    if (pos) {
                        const syntheticEvent = {
                            clientX: activeTouch.currentX,
                            clientY: activeTouch.currentY,
                            pointerId: activeTouch.id,
                            pressure: activeTouch.force || 0.5,
                            pointerType: 'touch',
                            tiltX: 0,
                            tiltY: 0,
                        };
                        
                        this.app.modules.toolManager?.handlePointerUp(pos, syntheticEvent);
                    }
                }
                
                this.activeTouches.delete(touch.identifier);
            }
        }
        
        // End pinch gesture
        if (this.activeTouches.size < 2) {
            this.isPinching = false;
            this.isRotating = false;
            this.pinchCenter = null;
        }
        
        // Check for long press
        if (!this.touchMoved && changedTouches.length === 1) {
            const pressDuration = Date.now() - this.touchStartTime;
            if (pressDuration >= this.longPressTimeout) {
                const touch = changedTouches[0];
                this.handleLongPress(touch);
            }
        }
    }

    /**
     * Handle touch cancel event
     * @param {TouchEvent} e 
     */
    handleTouchCancel(e) {
        // Cancel all active touches
        this.activeTouches.clear();
        this.isPinching = false;
        this.isRotating = false;
        this.pinchCenter = null;
        this.palmTouchId = null;
        
        // Cancel current drawing operation
        this.app.modules.toolManager?.finishCurrentOperation();
    }

    /**
     * Handle pointer down (for stylus)
     * @param {PointerEvent} e 
     */
    handlePointerDown(e) {
        // Check if this is a stylus
        if (e.pointerType === 'pen') {
            this.isStylus = true;
            this.stylusPressure = e.pressure || 0.5;
            this.stylusTiltX = e.tiltX || 0;
            this.stylusTiltY = e.tiltY || 0;
            this.stylusType = e.pointerType;
            
            // Stylus events are handled by the main pointer event handlers
            // This provides additional stylus-specific processing
            this.app.elements.mainCanvas.style.cursor = 'none'; // Hide cursor for stylus
        }
    }

    /**
     * Handle pointer move (for stylus)
     * @param {PointerEvent} e 
     */
    handlePointerMove(e) {
        if (e.pointerType === 'pen') {
            this.stylusPressure = e.pressure || 0.5;
            this.stylusTiltX = e.tiltX || 0;
            this.stylusTiltY = e.tiltY || 0;
            
            // Update brush engine with stylus data
            if (this.app.modules.brushEngine?.isDrawing) {
                this.app.modules.brushEngine.pressure = this.stylusPressure;
                this.app.modules.brushEngine.tiltX = this.stylusTiltX;
                this.app.modules.brushEngine.tiltY = this.stylusTiltY;
            }
        }
    }

    /**
     * Handle pointer up (for stylus)
     * @param {PointerEvent} e 
     */
    handlePointerUp(e) {
        if (e.pointerType === 'pen') {
            this.isStylus = false;
            this.stylusPressure = 0;
            this.app.elements.mainCanvas.style.cursor = 'crosshair';
        }
    }

    /**
     * Normalize touch event to pointer-like event
     * @param {Touch} touch 
     * @returns {Object}
     */
    normalizeTouchEvent(touch) {
        return {
            clientX: touch.clientX,
            clientY: touch.clientY,
            pointerId: touch.identifier,
            pressure: touch.force || 0.5,
            pointerType: 'touch',
            tiltX: 0,
            tiltY: 0,
            width: touch.radiusX * 2 || 10,
            height: touch.radiusY * 2 || 10,
        };
    }

    /**
     * Handle pinch gesture for zooming
     */
    handlePinchGesture() {
        if (!this.isPinching) return;
        
        const currentDistance = this.getTouchDistance();
        
        if (this.initialDistance > 0 && currentDistance > 0) {
            const scale = currentDistance / this.initialDistance;
            const newZoom = Math.max(0.1, Math.min(8, this.initialZoom * scale));
            
            this.app.setZoom(newZoom);
        }
        
        // Also check for rotation
        const currentAngle = this.getTouchAngle();
        const angleDiff = currentAngle - this.initialAngle;
        
        if (Math.abs(angleDiff) > 5 && this.activeTouches.size >= 2) {
            this.handleRotateGesture(angleDiff);
        }
    }

    /**
     * Handle rotate gesture
     * @param {number} angleDiff - Angle difference in degrees
     */
    handleRotateGesture(angleDiff) {
        this.isRotating = true;
        
        // Rotate canvas or selection if applicable
        const selection = this.app.modules.selectionManager;
        if (selection?.getSelectionBounds()) {
            // Rotate selection
            selection.rotationAngle = angleDiff;
            selection.renderSelection();
        }
    }

    /**
     * Handle double tap gesture
     * @param {Touch} touch 
     */
    handleDoubleTap(touch) {
        const pos = this.app.modules.canvasManager?.screenToCanvas(touch.clientX, touch.clientY);
        if (!pos) return;
        
        // Toggle zoom on double tap
        if (this.app.state.zoom === 1) {
            this.app.setZoom(2);
            this.app.panX = -pos.x;
            this.app.panY = -pos.y;
        } else {
            this.app.resetZoom();
        }
    }

    /**
     * Handle long press gesture
     * @param {Touch} touch 
     */
    handleLongPress(touch) {
        const pos = this.app.modules.canvasManager?.screenToCanvas(touch.clientX, touch.clientY);
        if (!pos) return;
        
        // Sample color with eyedropper on long press
        const toolId = this.app.state.currentTool;
        
        if (['pen', 'pencil', 'marker', 'brush'].includes(toolId)) {
            this.app.modules.toolManager?.sampleColor(pos);
        }
    }

    /**
     * Detect if a touch is from palm
     * @param {Touch} touch 
     * @returns {boolean}
     */
    detectPalm(touch) {
        return this.isPalmTouch(touch);
    }

    /**
     * Check if touch is likely a palm touch
     * @param {Touch} touch 
     * @returns {boolean}
     */
    isPalmTouch(touch) {
        if (!this.palmRejectionEnabled) return false;
        
        // Check touch radius (palm touches have larger contact area)
        const radiusX = touch.radiusX || 0;
        const radiusY = touch.radiusY || 0;
        
        if (radiusX > this.touchRadiusThreshold || radiusY > this.touchRadiusThreshold) {
            return true;
        }
        
        // Check force (palm has higher force)
        if (touch.force && touch.force > 0.8) {
            return true;
        }
        
        return false;
    }

    /**
     * Get center point of all active touches
     * @returns {Object|null} Center point {x, y}
     */
    getTouchCenter() {
        const touches = Array.from(this.activeTouches.values());
        
        if (touches.length === 0) return null;
        
        let sumX = 0, sumY = 0;
        
        touches.forEach(touch => {
            sumX += touch.currentX;
            sumY += touch.currentY;
        });
        
        return {
            x: sumX / touches.length,
            y: sumY / touches.length,
        };
    }

    /**
     * Get distance between first two active touches
     * @returns {number}
     */
    getTouchDistance() {
        const touches = Array.from(this.activeTouches.values());
        
        if (touches.length < 2) return 0;
        
        const t1 = touches[0];
        const t2 = touches[1];
        
        const dx = t2.currentX - t1.currentX;
        const dy = t2.currentY - t1.currentY;
        
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get angle between first two active touches
     * @returns {number} Angle in degrees
     */
    getTouchAngle() {
        const touches = Array.from(this.activeTouches.values());
        
        if (touches.length < 2) return 0;
        
        const t1 = touches[0];
        const t2 = touches[1];
        
        const dx = t2.currentX - t1.currentX;
        const dy = t2.currentY - t1.currentY;
        
        return Math.atan2(dy, dx) * 180 / Math.PI;
    }

    /**
     * Enable palm rejection
     */
    enablePalmRejection() {
        this.palmRejectionEnabled = true;
    }

    /**
     * Disable palm rejection
     */
    disablePalmRejection() {
        this.palmRejectionEnabled = false;
    }

    /**
     * Set palm rejection sensitivity
     * @param {number} threshold - Radius threshold in pixels
     */
    setPalmThreshold(threshold) {
        this.touchRadiusThreshold = Math.max(5, Math.min(50, threshold));
    }

    /**
     * Check if currently using stylus
     * @returns {boolean}
     */
    isUsingStylus() {
        return this.isStylus;
    }

    /**
     * Get stylus data
     * @returns {Object}
     */
    getStylusData() {
        return {
            pressure: this.stylusPressure,
            tiltX: this.stylusTiltX,
            tiltY: this.stylusTiltY,
            type: this.stylusType,
            isActive: this.isStylus,
        };
    }

    /**
     * Destroy touch handler
     */
    destroy() {
        // Remove event listeners
        const canvas = this.app.modules.canvasManager?.mainCanvas;
        if (canvas) {
            canvas.removeEventListener('touchstart', this.handleTouchStart);
            canvas.removeEventListener('touchmove', this.handleTouchMove);
            canvas.removeEventListener('touchend', this.handleTouchEnd);
            canvas.removeEventListener('touchcancel', this.handleTouchCancel);
            canvas.removeEventListener('pointerdown', this.handlePointerDown);
            canvas.removeEventListener('pointermove', this.handlePointerMove);
            canvas.removeEventListener('pointerup', this.handlePointerUp);
        }
        
        this.activeTouches.clear();
        
        console.log('Touch Handler destroyed');
    }
}

export default TouchHandler;

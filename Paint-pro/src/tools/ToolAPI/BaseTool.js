// ============================================
// Paint Pro - Professional Web Graphics Application
// src/tools/ToolAPI/BaseTool.js
// Abstract Base Tool Class
// ============================================

import { ToolEvents } from '../../core/event-bus/EventTypes.js';

/**
 * @class BaseTool
 * @abstract
 * @description Abstract base class that all tools must extend. Defines the
 * standard tool lifecycle, pointer event handling, cursor management, and
 * configuration API. This is the foundation of the plugin-based tool system.
 * 
 * Tool Lifecycle:
 * 1. constructor() - Tool is instantiated with its configuration
 * 2. initialize() - One-time setup, register event listeners
 * 3. activate() - Tool becomes active, setup UI, bind shortcuts
 * 4. [active state] - Tool handles pointer events
 * 5. deactivate() - Tool becomes inactive, cleanup temporary state
 * 6. dispose() - Tool is destroyed, release all resources
 * 
 * Pointer Event Flow:
 * - onPointerDown(point, event) → start operation
 * - onPointerMove(point, event) → continue operation
 * - onPointerUp(point, event) → finish operation
 * - onPointerCancel() → abort operation
 * 
 * Each pointer event receives:
 * - point: {x, y} in canvas coordinates
 * - event: Original PointerEvent with pressure, tilt, etc.
 * 
 * @example
 * class PenTool extends BaseTool {
 *     get id() { return 'pen'; }
 *     get name() { return 'Pen'; }
 *     get icon() { return 'brush'; }
 *     
 *     onPointerDown(point, event) {
 *         this._brushEngine.startStroke(point, this.getBrushSettings());
 *     }
 *     
 *     onPointerMove(point, event) {
 *         this._brushEngine.continueStroke(point);
 *     }
 *     
 *     onPointerUp(point, event) {
 *         this._brushEngine.endStroke();
 *     }
 * }
 */
export class BaseTool {
    /**
     * @param {Object} options - Tool configuration
     * @param {EventBus} options.eventBus - Event bus for tool events
     * @param {string} [options.cursor='crosshair'] - Default CSS cursor
     * @param {number} [options.cursorPriority=0] - Cursor priority (higher = more important)
     * @param {boolean} [options.supportsPressure=true] - Whether tool uses pen pressure
     * @param {boolean} [options.supportsTilt=false] - Whether tool uses pen tilt
     * @param {Object} [options.defaultOptions={}] - Default tool options
     */
    constructor(options = {}) {
        if (!options.eventBus) {
            throw new Error(`${this.constructor.name} requires an EventBus instance`);
        }

        if (this.constructor === BaseTool) {
            throw new Error('BaseTool is abstract and cannot be instantiated directly');
        }

        /**
         * Event bus for tool events.
         * @protected
         * @type {EventBus}
         */
        this._eventBus = options.eventBus;

        /**
         * Whether the tool has been initialized.
         * @protected
         * @type {boolean}
         */
        this._initialized = false;

        /**
         * Whether the tool is currently active.
         * @protected
         * @type {boolean}
         */
        this._active = false;

        /**
         * Whether a pointer interaction is in progress.
         * @protected
         * @type {boolean}
         */
        this._isInteracting = false;

        /**
         * The pointer ID of the current interaction.
         * @protected
         * @type {number|null}
         */
        this._activePointerId = null;

        /**
         * Start point of the current interaction.
         * @protected
         * @type {{x: number, y: number}|null}
         */
        this._startPoint = null;

        /**
         * Current point during interaction.
         * @protected
         * @type {{x: number, y: number}|null}
         */
        this._currentPoint = null;

        /**
         * Previous point during interaction.
         * @protected
         * @type {{x: number, y: number}|null}
         */
        this._previousPoint = null;

        /**
         * Default CSS cursor for this tool.
         * @protected
         * @type {string}
         */
        this._cursor = options.cursor || 'crosshair';

        /**
         * Cursor priority for resolving conflicts.
         * @protected
         * @type {number}
         */
        this._cursorPriority = options.cursorPriority || 0;

        /**
         * Whether the tool supports pressure sensitivity.
         * @protected
         * @type {boolean}
         */
        this._supportsPressure = options.supportsPressure !== false;

        /**
         * Whether the tool supports pen tilt.
         * @protected
         * @type {boolean}
         */
        this._supportsTilt = options.supportsTilt || false;

        /**
         * Tool configuration options.
         * @protected
         * @type {Object}
         */
        this._options = Object.freeze({
            ...this._getDefaultOptions(),
            ...(options.defaultOptions || {}),
        });

        /**
         * Whether the tool has been disposed.
         * @protected
         * @type {boolean}
         */
        this._disposed = false;
    }

    // ============================================
    // Abstract Getters - Must Override
    // ============================================

    /**
     * Unique tool identifier (e.g., 'pen', 'rectangle', 'text').
     * @abstract
     * @returns {string}
     */
    get id() {
        throw new Error(`${this.constructor.name} must implement get id()`);
    }

    /**
     * Human-readable tool name for UI display.
     * @abstract
     * @returns {string}
     */
    get name() {
        throw new Error(`${this.constructor.name} must implement get name()`);
    }

    /**
     * Material Symbols icon name for the toolbar button.
     * @abstract
     * @returns {string}
     */
    get icon() {
        throw new Error(`${this.constructor.name} must implement get icon()`);
    }

    /**
     * Tool category for grouping in the toolbar.
     * @abstract
     * @returns {string}
     */
    get category() {
        throw new Error(`${this.constructor.name} must implement get category()`);
    }

    /**
     * Keyboard shortcut for activating this tool.
     * @abstract
     * @returns {string|null}
     */
    get shortcut() {
        return null;
    }

    /**
     * Description of the tool for tooltips.
     * @abstract
     * @returns {string}
     */
    get description() {
        throw new Error(`${this.constructor.name} must implement get description()`);
    }

    // ============================================
    // Public Getters
    // ============================================

    /** @returns {string} */
    get cursor() { return this._cursor; }

    /** @returns {number} */
    get cursorPriority() { return this._cursorPriority; }

    /** @returns {boolean} */
    get isActive() { return this._active; }

    /** @returns {boolean} */
    get isInteracting() { return this._isInteracting; }

    /** @returns {boolean} */
    get isInitialized() { return this._initialized; }

    /** @returns {boolean} */
    get isDisposed() { return this._disposed; }

    /** @returns {Object} */
    get options() { return { ...this._options }; }

    // ============================================
    // Public API - Lifecycle
    // ============================================

    /**
     * Initialize the tool.
     * Called once when the tool is first registered.
     * Override to set up resources, create engines, etc.
     * 
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initialized || this._disposed) return;

        await this._onInitialize();
        this._initialized = true;
    }

    /**
     * Activate the tool (user selected this tool).
     * Setup cursor, bind events, show tool UI.
     * 
     * @returns {Promise<void>}
     */
    async activate() {
        if (this._active || this._disposed) return;
        if (!this._initialized) {
            await this.initialize();
        }

        this._active = true;

        await this._onActivate();

        this._eventBus.emitSync(ToolEvents.ACTIVATED, {
            toolId: this.id,
            toolName: this.name,
        });
    }

    /**
     * Deactivate the tool (user switched to another tool).
     * Cleanup temporary state, hide tool UI.
     * 
     * @returns {Promise<void>}
     */
    async deactivate() {
        if (!this._active) return;

        // Cancel any ongoing interaction
        if (this._isInteracting) {
            this.onPointerCancel();
        }

        this._active = false;

        await this._onDeactivate();

        this._eventBus.emitSync(ToolEvents.DEACTIVATED, {
            toolId: this.id,
        });
    }

    /**
     * Dispose the tool and release all resources.
     * Called when the tool is unregistered or application shuts down.
     */
    dispose() {
        if (this._disposed) return;

        if (this._active) {
            this.deactivate().catch(() => {});
        }

        this._onDispose();
        this._disposed = true;
        this._initialized = false;
    }

    // ============================================
    // Public API - Pointer Events
    // ============================================

    /**
     * Handle pointer down event.
     * 
     * @param {{x: number, y: number}} point - Point in canvas coordinates
     * @param {PointerEvent} event - Original pointer event
     */
    onPointerDown(point, event) {
        if (!this._active || this._disposed) return;

        this._isInteracting = true;
        this._activePointerId = event.pointerId;
        this._startPoint = { x: point.x, y: point.y };
        this._currentPoint = { x: point.x, y: point.y };
        this._previousPoint = { x: point.x, y: point.y };

        this._onPointerDown(point, event);
    }

    /**
     * Handle pointer move event.
     * 
     * @param {{x: number, y: number}} point - Point in canvas coordinates
     * @param {PointerEvent} event - Original pointer event
     */
    onPointerMove(point, event) {
        if (!this._active || !this._isInteracting || this._disposed) return;

        // Only respond to the active pointer
        if (event.pointerId !== this._activePointerId) return;

        this._previousPoint = this._currentPoint;
        this._currentPoint = { x: point.x, y: point.y };

        this._onPointerMove(point, event);
    }

    /**
     * Handle pointer up event.
     * 
     * @param {{x: number, y: number}} point - Point in canvas coordinates
     * @param {PointerEvent} event - Original pointer event
     */
    onPointerUp(point, event) {
        if (!this._active || !this._isInteracting || this._disposed) return;

        // Only respond to the active pointer
        if (event.pointerId !== this._activePointerId) return;

        this._currentPoint = { x: point.x, y: point.y };

        this._onPointerUp(point, event);

        this._resetInteractionState();
    }

    /**
     * Handle pointer cancel event (e.g., palm rejection, context menu).
     */
    onPointerCancel() {
        if (!this._isInteracting) return;

        this._onPointerCancel();
        this._resetInteractionState();
    }

    /**
     * Handle pointer hover event (move without button pressed).
     * 
     * @param {{x: number, y: number}} point - Point in canvas coordinates
     * @param {PointerEvent} event - Original pointer event
     */
    onPointerHover(point, event) {
        if (!this._active || this._disposed) return;

        this._onPointerHover(point, event);
    }

    /**
     * Handle keyboard shortcut while tool is active.
     * 
     * @param {KeyboardEvent} event - Keyboard event
     * @returns {boolean} True if the tool handled the shortcut
     */
    onKeyboardEvent(event) {
        if (!this._active || this._disposed) return false;

        return this._onKeyboardEvent(event);
    }

    // ============================================
    // Public API - Options
    // ============================================

    /**
     * Get a specific tool option.
     * @param {string} key - Option key
     * @param {*} [defaultValue] - Default if not set
     * @returns {*}
     */
    getOption(key, defaultValue = undefined) {
        return this._options[key] !== undefined ? this._options[key] : defaultValue;
    }

    /**
     * Set tool options.
     * @param {Object} updates - Option updates
     */
    setOptions(updates = {}) {
        this._options = Object.freeze({
            ...this._options,
            ...updates,
        });

        this._onOptionsChanged(updates);

        this._eventBus.emitSync(ToolEvents.OPTIONS_CHANGED, {
            toolId: this.id,
            options: this._options,
            changes: updates,
        });
    }

    /**
     * Get all current tool options.
     * @returns {Object}
     */
    getOptions() {
        return { ...this._options };
    }

    // ============================================
    // Public API - Cursor
    // ============================================

    /**
     * Get the CSS cursor for a given state.
     * Override to provide context-sensitive cursors.
     * 
     * @returns {string} CSS cursor value
     */
    getCursor() {
        return this._cursor;
    }

    /**
     * Get a custom cursor image URL.
     * Override for custom cursor icons.
     * 
     * @returns {string|null}
     */
    getCustomCursor() {
        return null;
    }

    // ============================================
    // Public API - Tool Options UI
    // ============================================

    /**
     * Get the HTML content for the tool options panel.
     * Override to provide tool-specific UI controls.
     * 
     * @returns {string} HTML string
     */
    getOptionsHTML() {
        return '';
    }

    /**
     * Get the tool description for the status bar.
     * @returns {string}
     */
    getStatusText() {
        return this.name;
    }

    // ============================================
    // Protected Hooks - Override in Subclasses
    // ============================================

    /**
     * Called during initialization.
     * Override for one-time setup (create engines, load resources).
     * @protected
     * @returns {Promise<void>}
     */
    async _onInitialize() {
        // Default: no-op
    }

    /**
     * Called when the tool is activated.
     * Override to setup UI, register listeners, show cursor.
     * @protected
     * @returns {Promise<void>}
     */
    async _onActivate() {
        // Default: no-op
    }

    /**
     * Called when the tool is deactivated.
     * Override to clean up UI, remove listeners.
     * @protected
     * @returns {Promise<void>}
     */
    async _onDeactivate() {
        // Default: no-op
    }

    /**
     * Called during disposal.
     * Override to release all resources permanently.
     * @protected
     */
    _onDispose() {
        // Default: no-op
    }

    /**
     * Called when tool options change.
     * Override to react to option changes.
     * @protected
     * @param {Object} changes - The changes made
     */
    _onOptionsChanged(changes) {
        // Default: no-op
    }

    /**
     * Pointer down hook.
     * @protected
     * @param {{x: number, y: number}} point - Canvas point
     * @param {PointerEvent} event - Pointer event
     */
    _onPointerDown(point, event) {
        // Override in subclasses
    }

    /**
     * Pointer move hook.
     * @protected
     * @param {{x: number, y: number}} point - Canvas point
     * @param {PointerEvent} event - Pointer event
     */
    _onPointerMove(point, event) {
        // Override in subclasses
    }

    /**
     * Pointer up hook.
     * @protected
     * @param {{x: number, y: number}} point - Canvas point
     * @param {PointerEvent} event - Pointer event
     */
    _onPointerUp(point, event) {
        // Override in subclasses
    }

    /**
     * Pointer cancel hook.
     * @protected
     */
    _onPointerCancel() {
        // Override in subclasses
    }

    /**
     * Pointer hover hook.
     * @protected
     * @param {{x: number, y: number}} point - Canvas point
     * @param {PointerEvent} event - Pointer event
     */
    _onPointerHover(point, event) {
        // Override in subclasses
    }

    /**
     * Keyboard event hook.
     * @protected
     * @param {KeyboardEvent} event - Keyboard event
     * @returns {boolean} True if handled
     */
    _onKeyboardEvent(event) {
        return false;
    }

    // ============================================
    // Protected Methods - Helpers
    // ============================================

    /**
     * Get default options for this tool.
     * Override to provide tool-specific defaults.
     * @protected
     * @returns {Object}
     */
    _getDefaultOptions() {
        return {};
    }

    /**
     * Reset interaction state.
     * @protected
     */
    _resetInteractionState() {
        this._isInteracting = false;
        this._activePointerId = null;
        this._startPoint = null;
        this._currentPoint = null;
        this._previousPoint = null;
    }

    /**
     * Get the current interaction delta.
     * @protected
     * @returns {{dx: number, dy: number, distance: number, angle: number}}
     */
    _getInteractionDelta() {
        if (!this._startPoint || !this._currentPoint) {
            return { dx: 0, dy: 0, distance: 0, angle: 0 };
        }

        const dx = this._currentPoint.x - this._startPoint.x;
        const dy = this._currentPoint.y - this._startPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        return { dx, dy, distance, angle };
    }

    /**
     * Get the distance moved since the last pointer event.
     * @protected
     * @returns {number}
     */
    _getLastMoveDistance() {
        if (!this._previousPoint || !this._currentPoint) return 0;

        const dx = this._currentPoint.x - this._previousPoint.x;
        const dy = this._currentPoint.y - this._previousPoint.y;

        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Constrain a point by a modifier key (e.g., Shift for straight lines).
     * @protected
     * @param {{x: number, y: number}} point - Current point
     * @param {{x: number, y: number}} startPoint - Start point
     * @param {boolean} constrain - Whether to constrain
     * @returns {{x: number, y: number}}
     */
    _constrainPoint(point, startPoint, constrain = false) {
        if (!constrain) return point;

        const dx = point.x - startPoint.x;
        const dy = point.y - startPoint.y;
        const angle = Math.atan2(dy, dx);
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Snap to nearest 45-degree angle
        const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);

        return {
            x: startPoint.x + Math.cos(snappedAngle) * distance,
            y: startPoint.y + Math.sin(snappedAngle) * distance,
        };
    }

    /**
     * Check if the tool is in a valid state for interaction.
     * @protected
     * @returns {boolean}
     */
    _canInteract() {
        return this._active && !this._disposed;
    }

    // ============================================
    // Serialization
    // ============================================

    /**
     * Serialize tool state for saving.
     * @returns {Object}
     */
    serialize() {
        return {
            id: this.id,
            options: { ...this._options },
        };
    }

    /**
     * Restore tool state from saved data.
     * @param {Object} data - Serialized tool state
     */
    deserialize(data = {}) {
        if (data.options) {
            this._options = Object.freeze({
                ...this._options,
                ...data.options,
            });
        }
    }
}

// ============================================
// Default Export
// ============================================

export default BaseTool;

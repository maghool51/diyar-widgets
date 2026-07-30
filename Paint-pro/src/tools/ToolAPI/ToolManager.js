// ============================================
// Paint Pro - Professional Web Graphics Application
// src/tools/ToolAPI/ToolManager.js
// Tool Registry & Lifecycle Manager
// ============================================

import { BaseTool } from './BaseTool.js';
import { ToolEvents } from '../../core/event-bus/EventTypes.js';

/**
 * @class ToolManager
 * @description Central registry and lifecycle manager for all tools.
 * Handles tool registration, activation/deactivation, cursor management,
 * and keyboard shortcut routing. Only one tool can be active at a time.
 * 
 * Responsibilities:
 * - Tool registration and discovery
 * - Active tool tracking and switching
 * - Pointer event delegation to active tool
 * - Keyboard event routing to active tool
 * - Cursor management (querying active tool cursor)
 * - Tool option persistence
 * 
 * @example
 * const toolManager = new ToolManager(eventBus);
 * 
 * // Register tools
 * toolManager.registerTool(new PenTool({ eventBus }));
 * toolManager.registerTool(new RectangleTool({ eventBus }));
 * 
 * // Activate a tool
 * toolManager.activateTool('pen');
 * 
 * // Delegate pointer events
 * canvas.addEventListener('pointerdown', (e) => {
 *     const point = coords.screenToCanvas(e.clientX, e.clientY);
 *     toolManager.handlePointerDown(point, e);
 * });
 */
export class ToolManager {
    /**
     * @param {EventBus} eventBus - Event bus for tool events
     * @param {Object} [options={}] - Configuration options
     * @param {boolean} [options.autoInitialize=true] - Auto-initialize tools on register
     * @param {string} [options.defaultTool='pen'] - Tool to activate on startup
     */
    constructor(eventBus, options = {}) {
        if (!eventBus) {
            throw new Error('ToolManager requires an EventBus instance');
        }

        /**
         * Event bus for tool events.
         * @private
         * @type {EventBus}
         */
        this._eventBus = eventBus;

        /**
         * Map of registered tools by ID.
         * @private
         * @type {Map<string, BaseTool>}
         */
        this._tools = new Map();

        /**
         * Currently active tool.
         * @private
         * @type {BaseTool|null}
         */
        this._activeTool = null;

        /**
         * ID of the previously active tool (for temporary switches).
         * @private
         * @type {string|null}
         */
        this._previousToolId = null;

        /**
         * Configuration options.
         * @private
         * @type {Object}
         */
        this._options = Object.freeze({
            autoInitialize: options.autoInitialize !== false,
            defaultTool: options.defaultTool || 'pen',
        });

        /**
         * Saved tool options for persistence.
         * @private
         * @type {Map<string, Object>}
         */
        this._savedOptions = new Map();

        /**
         * Whether the manager has been disposed.
         * @private
         * @type {boolean}
         */
        this._disposed = false;

        /**
         * Bound handlers for cleanup.
         * @private
         */
        this._boundHandlers = {};
    }

    // ============================================
    // Getters
    // ============================================

    /**
     * Get the currently active tool.
     * @returns {BaseTool|null}
     */
    get activeTool() {
        return this._activeTool;
    }

    /**
     * Get the ID of the active tool.
     * @returns {string|null}
     */
    get activeToolId() {
        return this._activeTool ? this._activeTool.id : null;
    }

    /**
     * Get the number of registered tools.
     * @returns {number}
     */
    get toolCount() {
        return this._tools.size;
    }

    // ============================================
    // Public API - Tool Registration
    // ============================================

    /**
     * Register a tool with the manager.
     * 
     * @param {BaseTool} tool - Tool instance to register
     * @param {Object} [options={}] - Registration options
     * @param {boolean} [options.initialize=true] - Initialize the tool immediately
     * @returns {Promise<boolean>} True if registered successfully
     * @throws {Error} If a tool with the same ID is already registered
     */
    async registerTool(tool, options = {}) {
        this._validateNotDisposed();

        if (!(tool instanceof BaseTool)) {
            throw new Error('Tool must extend BaseTool');
        }

        if (this._tools.has(tool.id)) {
            throw new Error(`Tool with ID "${tool.id}" is already registered`);
        }

        // Store tool
        this._tools.set(tool.id, tool);

        // Initialize if requested
        if (options.initialize !== false && this._options.autoInitialize) {
            await tool.initialize();
        }

        // Restore saved options if available
        const savedOpts = this._savedOptions.get(tool.id);
        if (savedOpts) {
            tool.setOptions(savedOpts);
        }

        this._log('debug', `Tool registered: "${tool.name}" (${tool.id})`);

        return true;
    }

    /**
     * Register multiple tools at once.
     * @param {BaseTool[]} tools - Array of tools
     * @returns {Promise<void>}
     */
    async registerTools(tools) {
        for (const tool of tools) {
            await this.registerTool(tool);
        }
    }

    /**
     * Unregister a tool by ID.
     * @param {string} toolId - Tool to remove
     * @returns {boolean} True if unregistered
     */
    unregisterTool(toolId) {
        this._validateNotDisposed();

        const tool = this._tools.get(toolId);
        if (!tool) return false;

        // Deactivate if active
        if (this._activeTool && this._activeTool.id === toolId) {
            this._activeTool.deactivate().catch(err => {
                this._log('error', `Error deactivating tool "${toolId}":`, err);
            });
            this._activeTool = null;
        }

        // Save options before removing
        this._savedOptions.set(toolId, tool.getOptions());

        // Dispose tool
        tool.dispose();

        // Remove from registry
        this._tools.delete(toolId);

        this._log('debug', `Tool unregistered: "${toolId}"`);

        return true;
    }

    /**
     * Check if a tool is registered.
     * @param {string} toolId - Tool ID
     * @returns {boolean}
     */
    hasTool(toolId) {
        return this._tools.has(toolId);
    }

    /**
     * Get a registered tool by ID.
     * @param {string} toolId - Tool ID
     * @returns {BaseTool|undefined}
     */
    getTool(toolId) {
        return this._tools.get(toolId);
    }

    /**
     * Get all registered tools.
     * @returns {BaseTool[]}
     */
    getAllTools() {
        return Array.from(this._tools.values());
    }

    /**
     * Get tools grouped by category for toolbar display.
     * @returns {Object<string, BaseTool[]>}
     */
    getToolsByCategory() {
        const categories = {};

        for (const tool of this._tools.values()) {
            const category = tool.category;
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(tool);
        }

        return categories;
    }

    // ============================================
    // Public API - Tool Activation
    // ============================================

    /**
     * Activate a tool by ID.
     * Deactivates the currently active tool first.
     * 
     * @param {string} toolId - Tool to activate
     * @returns {Promise<boolean>} True if activated
     */
    async activateTool(toolId) {
        this._validateNotDisposed();

        const tool = this._tools.get(toolId);
        if (!tool) {
            this._log('warn', `Tool not found: "${toolId}"`);
            return false;
        }

        // Already active
        if (this._activeTool && this._activeTool.id === toolId) {
            return true;
        }

        // Deactivate current tool
        if (this._activeTool) {
            this._previousToolId = this._activeTool.id;
            await this._activeTool.deactivate();
        }

        // Activate new tool
        await tool.activate();
        this._activeTool = tool;

        // Emit event
        this._eventBus.emitSync(ToolEvents.ACTIVATED, {
            toolId: tool.id,
            toolName: tool.name,
            previousToolId: this._previousToolId,
        });

        return true;
    }

    /**
     * Activate a tool by keyboard shortcut.
     * @param {string} shortcutKey - Keyboard key pressed
     * @returns {Promise<boolean>} True if a tool was activated
     */
    async activateToolByShortcut(shortcutKey) {
        for (const tool of this._tools.values()) {
            if (tool.shortcut && tool.shortcut.toLowerCase() === shortcutKey.toLowerCase()) {
                return this.activateTool(tool.id);
            }
        }

        return false;
    }

    /**
     * Temporarily switch to a tool (e.g., eyedropper while holding Alt).
     * The previous tool is restored when switchBack() is called.
     * 
     * @param {string} toolId - Tool to temporarily activate
     * @returns {Promise<boolean>}
     */
    async temporarySwitch(toolId) {
        const tool = this._tools.get(toolId);
        if (!tool) return false;

        if (this._activeTool && this._activeTool.id === toolId) {
            return true;
        }

        // Save current tool ID
        this._previousToolId = this._activeTool ? this._activeTool.id : null;

        return this.activateTool(toolId);
    }

    /**
     * Switch back to the previous tool after a temporary switch.
     * @returns {Promise<boolean>}
     */
    async switchBack() {
        if (!this._previousToolId) {
            return false;
        }

        const previousId = this._previousToolId;
        this._previousToolId = null;

        return this.activateTool(previousId);
    }

    /**
     * Deactivate any active tool (no tool active).
     * @returns {Promise<void>}
     */
    async deactivateAll() {
        if (this._activeTool) {
            await this._activeTool.deactivate();
            this._activeTool = null;
        }
    }

    // ============================================
    // Public API - Event Delegation
    // ============================================

    /**
     * Handle pointer down by delegating to active tool.
     * @param {{x: number, y: number}} point - Canvas coordinates
     * @param {PointerEvent} event - Original pointer event
     */
    handlePointerDown(point, event) {
        if (!this._activeTool) return;
        this._activeTool.onPointerDown(point, event);
    }

    /**
     * Handle pointer move by delegating to active tool.
     * @param {{x: number, y: number}} point - Canvas coordinates
     * @param {PointerEvent} event - Original pointer event
     */
    handlePointerMove(point, event) {
        if (!this._activeTool) return;
        this._activeTool.onPointerMove(point, event);
    }

    /**
     * Handle pointer up by delegating to active tool.
     * @param {{x: number, y: number}} point - Canvas coordinates
     * @param {PointerEvent} event - Original pointer event
     */
    handlePointerUp(point, event) {
        if (!this._activeTool) return;
        this._activeTool.onPointerUp(point, event);
    }

    /**
     * Handle pointer cancel by delegating to active tool.
     */
    handlePointerCancel() {
        if (!this._activeTool) return;
        this._activeTool.onPointerCancel();
    }

    /**
     * Handle pointer hover by delegating to active tool.
     * @param {{x: number, y: number}} point - Canvas coordinates
     * @param {PointerEvent} event - Original pointer event
     */
    handlePointerHover(point, event) {
        if (!this._activeTool) return;
        this._activeTool.onPointerHover(point, event);
    }

    /**
     * Handle keyboard event by routing to active tool first,
     * then checking for tool shortcuts.
     * 
     * @param {KeyboardEvent} event - Keyboard event
     * @returns {boolean} True if the event was handled
     */
    handleKeyboardEvent(event) {
        // Let active tool handle first
        if (this._activeTool && this._activeTool.onKeyboardEvent(event)) {
            return true;
        }

        // Check for tool activation shortcuts
        // Only handle if no modifier keys (except Shift for some tools)
        if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            const key = event.key;
            for (const tool of this._tools.values()) {
                if (tool.shortcut && tool.shortcut.toLowerCase() === key.toLowerCase()) {
                    this.activateTool(tool.id).catch(err => {
                        this._log('error', `Error activating tool by shortcut:`, err);
                    });
                    return true;
                }
            }
        }

        return false;
    }

    // ============================================
    // Public API - Cursor
    // ============================================

    /**
     * Get the CSS cursor for the active tool.
     * @returns {string}
     */
    getActiveCursor() {
        if (!this._activeTool) return 'default';
        return this._activeTool.getCursor();
    }

    /**
     * Get a custom cursor URL for the active tool.
     * @returns {string|null}
     */
    getActiveCustomCursor() {
        if (!this._activeTool) return null;
        return this._activeTool.getCustomCursor();
    }

    // ============================================
    // Public API - Options
    // ============================================

    /**
     * Get options for a specific tool.
     * @param {string} toolId - Tool ID
     * @returns {Object|null}
     */
    getToolOptions(toolId) {
        const tool = this._tools.get(toolId);
        return tool ? tool.getOptions() : null;
    }

    /**
     * Set options for the active tool.
     * @param {Object} options - Option updates
     */
    setActiveToolOptions(options) {
        if (this._activeTool) {
            this._activeTool.setOptions(options);
        }
    }

    // ============================================
    // Public API - Status
    // ============================================

    /**
     * Get status bar text for the active tool.
     * @returns {string}
     */
    getStatusText() {
        if (!this._activeTool) return '';
        return this._activeTool.getStatusText();
    }

    /**
     * Get options HTML for the active tool.
     * @returns {string}
     */
    getOptionsHTML() {
        if (!this._activeTool) return '';
        return this._activeTool.getOptionsHTML();
    }

    /**
     * Get tool summaries for UI display.
     * @returns {Array<Object>}
     */
    getToolSummaries() {
        return this.getAllTools().map(tool => ({
            id: tool.id,
            name: tool.name,
            icon: tool.icon,
            category: tool.category,
            shortcut: tool.shortcut,
            isActive: this._activeTool ? tool.id === this._activeTool.id : false,
        }));
    }

    // ============================================
    // Public API - Serialization
    // ============================================

    /**
     * Serialize all tool options for persistence.
     * @returns {Object}
     */
    serializeOptions() {
        const options = {};

        for (const [toolId, tool] of this._tools) {
            options[toolId] = tool.getOptions();
        }

        return options;
    }

    /**
     * Restore tool options from saved data.
     * @param {Object} data - Serialized options
     */
    deserializeOptions(data = {}) {
        for (const [toolId, options] of Object.entries(data)) {
            const tool = this._tools.get(toolId);
            if (tool) {
                tool.setOptions(options);
            } else {
                this._savedOptions.set(toolId, options);
            }
        }
    }

    // ============================================
    // Public API - Disposal
    // ============================================

    /**
     * Dispose the tool manager and all registered tools.
     */
    async dispose() {
        if (this._disposed) return;

        // Deactivate and dispose all tools
        await this.deactivateAll();

        for (const tool of this._tools.values()) {
            tool.dispose();
        }

        this._tools.clear();
        this._savedOptions.clear();
        this._activeTool = null;
        this._disposed = true;

        this._log('info', 'ToolManager disposed');
    }

    // ============================================
    // Private Methods
    // ============================================

    /**
     * Validate that the manager has not been disposed.
     * @private
     * @throws {Error} If disposed
     */
    _validateNotDisposed() {
        if (this._disposed) {
            throw new Error('ToolManager has been disposed and cannot be used');
        }
    }

    /**
     * Log a message if debug mode is enabled.
     * @private
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {...*} args - Additional arguments
     */
    _log(level, message, ...args) {
        const prefix = '[ToolManager]';

        switch (level) {
            case 'error':
                console.error(prefix, message, ...args);
                break;
            case 'warn':
                console.warn(prefix, message, ...args);
                break;
            case 'info':
                console.info(prefix, message, ...args);
                break;
            case 'debug':
            default:
                console.debug(prefix, message, ...args);
                break;
        }
    }
}

// ============================================
// Default Export
// ============================================

export default ToolManager;

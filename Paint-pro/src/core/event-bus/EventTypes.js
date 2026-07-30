// ============================================
// Paint Pro - Professional Web Graphics Application
// src/core/event-bus/EventTypes.js
// Centralized Event Type Definitions
// ============================================

/**
 * @module core/event-bus/EventTypes
 * @description Complete catalog of all application events organized by domain.
 * Each event has a unique namespaced string identifier and documented payload shape.
 * 
 * Event Naming Convention:
 * {domain}:{action}{PastTense}
 * 
 * Examples:
 * - canvas:zoomChanged
 * - layer:added
 * - document:saved
 * - tool:activated
 * 
 * This module eliminates magic strings and provides a single source of truth
 * for all event-based communication across the entire application.
 */

// ============================================
// Application Lifecycle Events
// ============================================

/**
 * Application-level lifecycle events.
 * @namespace ApplicationEvents
 */
export const ApplicationEvents = Object.freeze({
    /** Application has completed initialization and is ready */
    READY: 'app:ready',
    
    /** Application is about to shut down */
    BEFORE_SHUTDOWN: 'app:beforeShutdown',
    
    /** Application has shut down */
    SHUTDOWN: 'app:shutdown',
    
    /** An unhandled error occurred */
    ERROR: 'app:error',
    
    /** Application is being suspended (mobile/background) */
    SUSPEND: 'app:suspend',
    
    /** Application resumed from suspension */
    RESUME: 'app:resume',
    
    /** A fatal error requires application restart */
    FATAL_ERROR: 'app:fatalError',
});

// ============================================
// Document Events
// ============================================

/**
 * Document management events.
 * @namespace DocumentEvents
 */
export const DocumentEvents = Object.freeze({
    /** New document created */
    CREATED: 'document:created',
    
    /** Document opened from storage */
    OPENED: 'document:opened',
    
    /** Document closed */
    CLOSED: 'document:closed',
    
    /** Active document switched */
    SWITCHED: 'document:switched',
    
    /** Document saved */
    SAVED: 'document:saved',
    
    /** Document metadata changed (name, dimensions) */
    METADATA_CHANGED: 'document:metadataChanged',
    
    /** Document marked as modified/clean */
    MODIFIED_STATE_CHANGED: 'document:modifiedStateChanged',
    
    /** Document content changed (any edit) */
    CONTENT_CHANGED: 'document:contentChanged',
    
    /** Document about to be closed (checkpoint for save prompts) */
    BEFORE_CLOSE: 'document:beforeClose',
    
    /** Document import started */
    IMPORT_STARTED: 'document:importStarted',
    
    /** Document import completed */
    IMPORT_COMPLETED: 'document:importCompleted',
    
    /** Document import failed */
    IMPORT_FAILED: 'document:importFailed',
    
    /** Document export started */
    EXPORT_STARTED: 'document:exportStarted',
    
    /** Document export completed */
    EXPORT_COMPLETED: 'document:exportCompleted',
    
    /** Document export failed */
    EXPORT_FAILED: 'document:exportFailed',
});

// ============================================
// Canvas Events
// ============================================

/**
 * Canvas and viewport events.
 * @namespace CanvasEvents
 */
export const CanvasEvents = Object.freeze({
    /** Canvas dimensions changed */
    RESIZED: 'canvas:resized',
    
    /** Zoom level changed */
    ZOOM_CHANGED: 'canvas:zoomChanged',
    
    /** Pan position changed */
    PAN_CHANGED: 'canvas:panChanged',
    
    /** Viewport changed (zoom or pan) */
    VIEWPORT_CHANGED: 'canvas:viewportChanged',
    
    /** Canvas background color changed */
    BACKGROUND_CHANGED: 'canvas:backgroundChanged',
    
    /** Canvas DPI changed */
    DPI_CHANGED: 'canvas:dpiChanged',
    
    /** Grid visibility toggled */
    GRID_VISIBILITY_CHANGED: 'canvas:gridVisibilityChanged',
    
    /** Grid settings changed */
    GRID_CHANGED: 'canvas:gridChanged',
    
    /** Guide added */
    GUIDE_ADDED: 'canvas:guideAdded',
    
    /** Guide removed */
    GUIDE_REMOVED: 'canvas:guideRemoved',
    
    /** All guides cleared */
    GUIDES_CLEARED: 'canvas:guidesCleared',
    
    /** Ruler visibility toggled */
    RULER_VISIBILITY_CHANGED: 'canvas:rulerVisibilityChanged',
    
    /** Snap settings changed */
    SNAP_CHANGED: 'canvas:snapChanged',
    
    /** Canvas rendering completed */
    RENDERED: 'canvas:rendered',
    
    /** Canvas dirty regions updated */
    DIRTY_REGIONS_UPDATED: 'canvas:dirtyRegionsUpdated',
});

// ============================================
// Layer Events
// ============================================

/**
 * Layer management events.
 * @namespace LayerEvents
 */
export const LayerEvents = Object.freeze({
    /** New layer added */
    ADDED: 'layer:added',
    
    /** Layer removed/deleted */
    REMOVED: 'layer:removed',
    
    /** Layer duplicated */
    DUPLICATED: 'layer:duplicated',
    
    /** Layer order changed (moved up/down) */
    REORDERED: 'layer:reordered',
    
    /** Active layer changed */
    ACTIVE_CHANGED: 'layer:activeChanged',
    
    /** Layer visibility toggled */
    VISIBILITY_CHANGED: 'layer:visibilityChanged',
    
    /** Layer locked/unlocked */
    LOCK_CHANGED: 'layer:lockChanged',
    
    /** Layer opacity changed */
    OPACITY_CHANGED: 'layer:opacityChanged',
    
    /** Layer blend mode changed */
    BLEND_MODE_CHANGED: 'layer:blendModeChanged',
    
    /** Layer renamed */
    RENAMED: 'layer:renamed',
    
    /** Layer content changed (pixels modified) */
    CONTENT_CHANGED: 'layer:contentChanged',
    
    /** Layer mask added */
    MASK_ADDED: 'layer:maskAdded',
    
    /** Layer mask removed */
    MASK_REMOVED: 'layer:maskRemoved',
    
    /** Layer mask updated */
    MASK_UPDATED: 'layer:maskUpdated',
    
    /** Layers merged */
    MERGED: 'layer:merged',
    
    /** All layers flattened */
    FLATTENED: 'layer:flattened',
    
    /** Layer group created */
    GROUP_CREATED: 'layer:groupCreated',
    
    /** Layer group ungrouped */
    GROUP_UNGROUPED: 'layer:groupUngrouped',
    
    /** Layer thumbnail updated */
    THUMBNAIL_UPDATED: 'layer:thumbnailUpdated',
});

// ============================================
// Selection Events
// ============================================

/**
 * Selection management events.
 * @namespace SelectionEvents
 */
export const SelectionEvents = Object.freeze({
    /** Selection created (new selection made) */
    CREATED: 'selection:created',
    
    /** Selection modified (transformed, expanded) */
    MODIFIED: 'selection:modified',
    
    /** Selection moved */
    MOVED: 'selection:moved',
    
    /** Selection resized */
    RESIZED: 'selection:resized',
    
    /** Selection rotated */
    ROTATED: 'selection:rotated',
    
    /** Selection deselected/cleared */
    DESELECTED: 'selection:deselected',
    
    /** Selection bounds changed */
    BOUNDS_CHANGED: 'selection:boundsChanged',
    
    /** Selection feather changed */
    FEATHER_CHANGED: 'selection:featherChanged',
    
    /** Selection inverted */
    INVERTED: 'selection:inverted',
    
    /** Select all */
    ALL_SELECTED: 'selection:allSelected',
    
    /** Selection content copied */
    COPIED: 'selection:copied',
    
    /** Selection content cut */
    CUT: 'selection:cut',
    
    /** Content pasted */
    PASTED: 'selection:pasted',
    
    /** Selection content deleted */
    DELETED: 'selection:deleted',
    
    /** Selection filled */
    FILLED: 'selection:filled',
    
    /** Selection stroked */
    STROKED: 'selection:stroked',
});

// ============================================
// Tool Events
// ============================================

/**
 * Tool management events.
 * @namespace ToolEvents
 */
export const ToolEvents = Object.freeze({
    /** Tool activated (selected by user) */
    ACTIVATED: 'tool:activated',
    
    /** Tool deactivated (deselected) */
    DEACTIVATED: 'tool:deactivated',
    
    /** Tool options changed (size, opacity, etc.) */
    OPTIONS_CHANGED: 'tool:optionsChanged',
    
    /** Tool preset loaded */
    PRESET_LOADED: 'tool:presetLoaded',
    
    /** Tool preset saved */
    PRESET_SAVED: 'tool:presetSaved',
    
    /** Tool preset deleted */
    PRESET_DELETED: 'tool:presetDeleted',
    
    /** Drawing started (pointer down) */
    DRAWING_STARTED: 'tool:drawingStarted',
    
    /** Drawing in progress (pointer move) */
    DRAWING_PROGRESS: 'tool:drawingProgress',
    
    /** Drawing ended (pointer up) */
    DRAWING_ENDED: 'tool:drawingEnded',
    
    /** Drawing cancelled (escape, context loss) */
    DRAWING_CANCELLED: 'tool:drawingCancelled',
    
    /** Cursor position updated */
    CURSOR_MOVED: 'tool:cursorMoved',
});

// ============================================
// Brush Events
// ============================================

/**
 * Brush-specific events.
 * @namespace BrushEvents
 */
export const BrushEvents = Object.freeze({
    /** Brush type changed */
    TYPE_CHANGED: 'brush:typeChanged',
    
    /** Brush size changed */
    SIZE_CHANGED: 'brush:sizeChanged',
    
    /** Brush opacity changed */
    OPACITY_CHANGED: 'brush:opacityChanged',
    
    /** Brush flow changed */
    FLOW_CHANGED: 'brush:flowChanged',
    
    /** Brush hardness changed */
    HARDNESS_CHANGED: 'brush:hardnessChanged',
    
    /** Brush spacing changed */
    SPACING_CHANGED: 'brush:spacingChanged',
    
    /** Brush angle changed */
    ANGLE_CHANGED: 'brush:angleChanged',
    
    /** Brush roundness changed */
    ROUNDNESS_CHANGED: 'brush:roundnessChanged',
    
    /** Brush texture changed */
    TEXTURE_CHANGED: 'brush:textureChanged',
    
    /** Brush dual brush settings changed */
    DUAL_BRUSH_CHANGED: 'brush:dualBrushChanged',
});

// ============================================
// Color Events
// ============================================

/**
 * Color management events.
 * @namespace ColorEvents
 */
export const ColorEvents = Object.freeze({
    /** Foreground/stroke color changed */
    FOREGROUND_CHANGED: 'color:foregroundChanged',
    
    /** Background/fill color changed */
    BACKGROUND_CHANGED: 'color:backgroundColorChanged',
    
    /** Colors swapped */
    SWAPPED: 'color:swapped',
    
    /** Color added to recent colors */
    RECENT_ADDED: 'color:recentAdded',
    
    /** Swatch added to palette */
    SWATCH_ADDED: 'color:swatchAdded',
    
    /** Swatch removed from palette */
    SWATCH_REMOVED: 'color:swatchRemoved',
    
    /** Palette loaded */
    PALETTE_LOADED: 'color:paletteLoaded',
    
    /** Palette saved */
    PALETTE_SAVED: 'color:paletteSaved',
    
    /** Gradient editor opened */
    GRADIENT_EDITOR_OPENED: 'color:gradientEditorOpened',
    
    /** Gradient changed */
    GRADIENT_CHANGED: 'color:gradientChanged',
});

// ============================================
// History Events
// ============================================

/**
 * History/Undo events.
 * @namespace HistoryEvents
 */
export const HistoryEvents = Object.freeze({
    /** Command executed */
    EXECUTED: 'history:executed',
    
    /** Undo performed */
    UNDO: 'history:undo',
    
    /** Redo performed */
    REDO: 'history:redo',
    
    /** History state changed (canUndo/canRedo) */
    STATE_CHANGED: 'history:stateChanged',
    
    /** History cleared */
    CLEARED: 'history:cleared',
    
    /** History compression performed */
    COMPRESSED: 'history:compressed',
    
    /** Transaction started */
    TRANSACTION_STARTED: 'history:transactionStarted',
    
    /** Transaction committed */
    TRANSACTION_COMMITTED: 'history:transactionCommitted',
    
    /** Transaction rolled back */
    TRANSACTION_ROLLED_BACK: 'history:transactionRolledBack',
});

// ============================================
// Storage Events
// ============================================

/**
 * Storage and auto-save events.
 * @namespace StorageEvents
 */
export const StorageEvents = Object.freeze({
    /** Save started */
    SAVE_STARTED: 'storage:saveStarted',
    
    /** Save completed */
    SAVE_COMPLETED: 'storage:saveCompleted',
    
    /** Save failed */
    SAVE_FAILED: 'storage:saveFailed',
    
    /** Load started */
    LOAD_STARTED: 'storage:loadStarted',
    
    /** Load completed */
    LOAD_COMPLETED: 'storage:loadCompleted',
    
    /** Load failed */
    LOAD_FAILED: 'storage:loadFailed',
    
    /** Auto-save performed */
    AUTO_SAVE: 'storage:autoSave',
    
    /** Recovery data found */
    RECOVERY_FOUND: 'storage:recoveryFound',
    
    /** Recovery completed */
    RECOVERY_COMPLETED: 'storage:recoveryCompleted',
    
    /** Storage quota warning */
    QUOTA_WARNING: 'storage:quotaWarning',
    
    /** Storage quota exceeded */
    QUOTA_EXCEEDED: 'storage:quotaExceeded',
});

// ============================================
// UI Events
// ============================================

/**
 * User interface events.
 * @namespace UIEvents
 */
export const UIEvents = Object.freeze({
    /** Theme changed (dark/light) */
    THEME_CHANGED: 'ui:themeChanged',
    
    /** Panel opened */
    PANEL_OPENED: 'ui:panelOpened',
    
    /** Panel closed */
    PANEL_CLOSED: 'ui:panelClosed',
    
    /** Panel toggled */
    PANEL_TOGGLED: 'ui:panelToggled',
    
    /** Dialog opened */
    DIALOG_OPENED: 'ui:dialogOpened',
    
    /** Dialog closed */
    DIALOG_CLOSED: 'ui:dialogClosed',
    
    /** Status bar message changed */
    STATUS_MESSAGE_CHANGED: 'ui:statusMessageChanged',
    
    /** Toast notification shown */
    TOAST_SHOWN: 'ui:toastShown',
    
    /** Fullscreen mode toggled */
    FULLSCREEN_TOGGLED: 'ui:fullscreenToggled',
    
    /** Sidebar collapsed/expanded */
    SIDEBAR_TOGGLED: 'ui:sidebarToggled',
    
    /** Window resized */
    WINDOW_RESIZED: 'ui:windowResized',
    
    /** Language/locale changed */
    LOCALE_CHANGED: 'ui:localeChanged',
    
    /** Direction changed (RTL/LTR) */
    DIRECTION_CHANGED: 'ui:directionChanged',
});

// ============================================
// Keyboard & Shortcut Events
// ============================================

/**
 * Keyboard and shortcut events.
 * @namespace KeyboardEvents
 */
export const KeyboardEvents = Object.freeze({
    /** Key pressed */
    KEY_DOWN: 'keyboard:keyDown',
    
    /** Key released */
    KEY_UP: 'keyboard:keyUp',
    
    /** Shortcut triggered */
    SHORTCUT_TRIGGERED: 'keyboard:shortcutTriggered',
    
    /** Shortcut conflict detected */
    SHORTCUT_CONFLICT: 'keyboard:shortcutConflict',
    
    /** Shortcut profile changed */
    SHORTCUT_PROFILE_CHANGED: 'keyboard:shortcutProfileChanged',
});

// ============================================
// Pointer & Touch Events
// ============================================

/**
 * Pointer and touch input events.
 * @namespace PointerEvents
 */
export const PointerEvents = Object.freeze({
    /** Pointer down */
    DOWN: 'pointer:down',
    
    /** Pointer moved */
    MOVE: 'pointer:move',
    
    /** Pointer up */
    UP: 'pointer:up',
    
    /** Pointer cancelled */
    CANCEL: 'pointer:cancel',
    
    /** Pinch gesture started */
    PINCH_STARTED: 'pointer:pinchStarted',
    
    /** Pinch gesture in progress */
    PINCH_PROGRESS: 'pointer:pinchProgress',
    
    /** Pinch gesture ended */
    PINCH_ENDED: 'pointer:pinchEnded',
    
    /** Rotate gesture started */
    ROTATE_STARTED: 'pointer:rotateStarted',
    
    /** Rotate gesture in progress */
    ROTATE_PROGRESS: 'pointer:rotateProgress',
    
    /** Rotate gesture ended */
    ROTATE_ENDED: 'pointer:rotateEnded',
    
    /** Long press detected */
    LONG_PRESS: 'pointer:longPress',
    
    /** Double tap detected */
    DOUBLE_TAP: 'pointer:doubleTap',
    
    /** Stylus detected */
    STYLUS_DETECTED: 'pointer:stylusDetected',
    
    /** Stylus removed */
    STYLUS_REMOVED: 'pointer:stylusRemoved',
});

// ============================================
// Clipboard Events
// ============================================

/**
 * Clipboard operation events.
 * @namespace ClipboardEvents
 */
export const ClipboardEvents = Object.freeze({
    /** Content copied to clipboard */
    COPIED: 'clipboard:copied',
    
    /** Content cut to clipboard */
    CUT: 'clipboard:cut',
    
    /** Content pasted from clipboard */
    PASTED: 'clipboard:pasted',
    
    /** Clipboard content changed (external) */
    EXTERNAL_CHANGE: 'clipboard:externalChange',
});

// ============================================
// Plugin Events
// ============================================

/**
 * Plugin system events.
 * @namespace PluginEvents
 */
export const PluginEvents = Object.freeze({
    /** Plugin loaded */
    LOADED: 'plugin:loaded',
    
    /** Plugin unloaded */
    UNLOADED: 'plugin:unloaded',
    
    /** Plugin activated */
    ACTIVATED: 'plugin:activated',
    
    /** Plugin deactivated */
    DEACTIVATED: 'plugin:deactivated',
    
    /** Plugin error */
    ERROR: 'plugin:error',
    
    /** Plugin registered with system */
    REGISTERED: 'plugin:registered',
    
    /** Plugin unregistered */
    UNREGISTERED: 'plugin:unregistered',
});

// ============================================
// Worker Events
// ============================================

/**
 * Web Worker events.
 * @namespace WorkerEvents
 */
export const WorkerEvents = Object.freeze({
    /** Worker started */
    STARTED: 'worker:started',
    
    /** Worker completed task */
    COMPLETED: 'worker:completed',
    
    /** Worker failed */
    FAILED: 'worker:failed',
    
    /** Worker progress update */
    PROGRESS: 'worker:progress',
    
    /** Worker terminated */
    TERMINATED: 'worker:terminated',
});

// ============================================
// Performance Events
// ============================================

/**
 * Performance monitoring events.
 * @namespace PerformanceEvents
 */
export const PerformanceEvents = Object.freeze({
    /** FPS dropped below threshold */
    FPS_DROP: 'performance:fpsDrop',
    
    /** Memory usage exceeded warning level */
    MEMORY_WARNING: 'performance:memoryWarning',
    
    /** Memory usage critical */
    MEMORY_CRITICAL: 'performance:memoryCritical',
    
    /** Long task detected (>50ms) */
    LONG_TASK: 'performance:longTask',
    
    /** Render frame completed */
    FRAME_RENDERED: 'performance:frameRendered',
});

// ============================================
// Event Factory Functions
// ============================================

/**
 * Create a standardized event payload object.
 * Ensures all events have consistent metadata.
 * 
 * @param {string} type - Event type from one of the event namespaces
 * @param {*} [data={}] - Event-specific payload data
 * @param {Object} [options={}] - Additional options
 * @param {string} [options.source] - Module that emitted the event
 * @param {number} [options.timestamp] - Custom timestamp (defaults to now)
 * @returns {Object} Standardized event object
 */
export function createEvent(type, data = {}, options = {}) {
    return Object.freeze({
        /** Event type identifier */
        type,
        
        /** Event payload data */
        data: Object.freeze({ ...data }),
        
        /** Module or component that emitted the event */
        source: options.source ?? 'unknown',
        
        /** Timestamp when the event was created */
        timestamp: options.timestamp ?? Date.now(),
        
        /** Unique event ID for tracing */
        id: _generateEventId(),
    });
}

/**
 * Create an error event payload.
 * @param {Error|string} error - Error object or message
 * @param {string} [source] - Module that reported the error
 * @param {Object} [context={}] - Additional error context
 * @returns {Object} Error event object
 */
export function createErrorEvent(error, source = 'unknown', context = {}) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    return createEvent(ApplicationEvents.ERROR, {
        message: errorObj.message,
        stack: errorObj.stack,
        name: errorObj.name,
        context,
    }, { source });
}

// ============================================
// Event Validation
// ============================================

/**
 * Check if an event type string is a known valid event.
 * Useful for debugging and validation.
 * 
 * @param {string} eventType - Event type string to validate
 * @returns {boolean} True if the event type is known
 */
export function isValidEventType(eventType) {
    const allEvents = new Set([
        ...Object.values(ApplicationEvents),
        ...Object.values(DocumentEvents),
        ...Object.values(CanvasEvents),
        ...Object.values(LayerEvents),
        ...Object.values(SelectionEvents),
        ...Object.values(ToolEvents),
        ...Object.values(BrushEvents),
        ...Object.values(ColorEvents),
        ...Object.values(HistoryEvents),
        ...Object.values(StorageEvents),
        ...Object.values(UIEvents),
        ...Object.values(KeyboardEvents),
        ...Object.values(PointerEvents),
        ...Object.values(ClipboardEvents),
        ...Object.values(PluginEvents),
        ...Object.values(WorkerEvents),
        ...Object.values(PerformanceEvents),
    ]);

    return allEvents.has(eventType);
}

/**
 * Get the domain of an event type.
 * @param {string} eventType - Event type string
 * @returns {string} Domain name (e.g., 'canvas', 'layer')
 */
export function getEventDomain(eventType) {
    const colonIndex = eventType.indexOf(':');
    if (colonIndex === -1) return 'unknown';
    return eventType.substring(0, colonIndex);
}

/**
 * Get all events in a specific domain.
 * @param {string} domain - Domain name
 * @returns {string[]} Array of event types
 */
export function getEventsByDomain(domain) {
    const allEvents = [
        ...Object.values(ApplicationEvents),
        ...Object.values(DocumentEvents),
        ...Object.values(CanvasEvents),
        ...Object.values(LayerEvents),
        ...Object.values(SelectionEvents),
        ...Object.values(ToolEvents),
        ...Object.values(BrushEvents),
        ...Object.values(ColorEvents),
        ...Object.values(HistoryEvents),
        ...Object.values(StorageEvents),
        ...Object.values(UIEvents),
        ...Object.values(KeyboardEvents),
        ...Object.values(PointerEvents),
        ...Object.values(ClipboardEvents),
        ...Object.values(PluginEvents),
        ...Object.values(WorkerEvents),
        ...Object.values(PerformanceEvents),
    ];

    return allEvents.filter(event => getEventDomain(event) === domain);
}

// ============================================
// Private Helpers
// ============================================

/**
 * Auto-incrementing counter for event IDs.
 * @private
 * @type {number}
 */
let _eventIdCounter = 0;

/**
 * Generate a unique event ID.
 * @private
 * @returns {string}
 */
function _generateEventId() {
    _eventIdCounter++;
    const timestamp = Date.now().toString(36);
    const counter = _eventIdCounter.toString(36).padStart(4, '0');
    const random = Math.random().toString(36).substring(2, 6);
    return `evt_${timestamp}_${counter}_${random}`;
}

// ============================================
// Aggregate Export for Convenience
// ============================================

/**
 * All event types in a single object for convenient imports.
 * @type {Readonly<Object>}
 */
export const AllEvents = Object.freeze({
    ...ApplicationEvents,
    ...DocumentEvents,
    ...CanvasEvents,
    ...LayerEvents,
    ...SelectionEvents,
    ...ToolEvents,
    ...BrushEvents,
    ...ColorEvents,
    ...HistoryEvents,
    ...StorageEvents,
    ...UIEvents,
    ...KeyboardEvents,
    ...PointerEvents,
    ...ClipboardEvents,
    ...PluginEvents,
    ...WorkerEvents,
    ...PerformanceEvents,
});

// ============================================
// Exports
// ============================================

export default {
    ApplicationEvents,
    DocumentEvents,
    CanvasEvents,
    LayerEvents,
    SelectionEvents,
    ToolEvents,
    BrushEvents,
    ColorEvents,
    HistoryEvents,
    StorageEvents,
    UIEvents,
    KeyboardEvents,
    PointerEvents,
    ClipboardEvents,
    PluginEvents,
    WorkerEvents,
    PerformanceEvents,
    AllEvents,
    createEvent,
    createErrorEvent,
    isValidEventType,
    getEventDomain,
    getEventsByDomain,
};

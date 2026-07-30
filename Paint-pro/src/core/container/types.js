// ============================================
// Paint Pro - Professional Web Graphics Application
// src/core/container/types.js
// Service Container Type Definitions & Contracts
// ============================================

/**
 * @module core/container/types
 * @description Core type definitions for the dependency injection container.
 * These types establish the contracts that all services must follow.
 * No runtime dependencies - pure interface definitions and constants.
 */

// ============================================
// Symbol Constants (Unique Identifiers)
// ============================================

/**
 * Symbol keys for service identifiers to prevent naming collisions.
 * Using Symbols ensures no two services can have the same identifier
 * even if they share the same string name.
 */
export const ServiceTokens = Object.freeze({
    // Core Services
    APPLICATION: Symbol('application'),
    EVENT_BUS: Symbol('eventBus'),
    COMMAND_BUS: Symbol('commandBus'),
    STORE: Symbol('store'),

    // Domain Services
    DOCUMENT_MANAGER: Symbol('documentManager'),
    CANVAS_MANAGER: Symbol('canvasManager'),
    LAYER_MANAGER: Symbol('layerManager'),
    HISTORY_MANAGER: Symbol('historyManager'),
    SELECTION_MANAGER: Symbol('selectionManager'),
    COLOR_MANAGER: Symbol('colorManager'),

    // Rendering Services
    RENDER_SCHEDULER: Symbol('renderScheduler'),
    RENDER_QUEUE: Symbol('renderQueue'),
    DIRTY_REGION_MANAGER: Symbol('dirtyRegionManager'),
    CANVAS_RENDERER: Symbol('canvasRenderer'),
    LAYER_RENDERER: Symbol('layerRenderer'),
    SELECTION_RENDERER: Symbol('selectionRenderer'),
    GRID_RENDERER: Symbol('gridRenderer'),
    GUIDE_RENDERER: Symbol('guideRenderer'),
    PREVIEW_RENDERER: Symbol('previewRenderer'),
    OVERLAY_RENDERER: Symbol('overlayRenderer'),
    THUMBNAIL_RENDERER: Symbol('thumbnailRenderer'),
    EXPORT_RENDERER: Symbol('exportRenderer'),

    // Tool Services
    TOOL_MANAGER: Symbol('toolManager'),
    TOOL_REGISTRY: Symbol('toolRegistry'),
    BRUSH_ENGINE: Symbol('brushEngine'),

    // IO Services
    IMPORT_MANAGER: Symbol('importManager'),
    EXPORT_MANAGER: Symbol('exportManager'),
    CLIPBOARD_MANAGER: Symbol('clipboardManager'),
    STORAGE_MANAGER: Symbol('storageManager'),

    // UI Services
    UI_MANAGER: Symbol('uiManager'),
    DIALOG_MANAGER: Symbol('dialogManager'),
    THEME_MANAGER: Symbol('themeManager'),
    SHORTCUT_MANAGER: Symbol('shortcutManager'),
    KEYBOARD_MANAGER: Symbol('keyboardManager'),
    TOUCH_MANAGER: Symbol('touchManager'),
    POINTER_MANAGER: Symbol('pointerManager'),

    // Asset Services
    ASSET_MANAGER: Symbol('assetManager'),
    RESOURCE_MANAGER: Symbol('resourceManager'),
    FONT_LOADER: Symbol('fontLoader'),

    // Plugin Services
    PLUGIN_MANAGER: Symbol('pluginManager'),

    // Internationalization
    I18N_MANAGER: Symbol('i18nManager'),

    // Worker Services
    WORKER_MANAGER: Symbol('workerManager'),
});

// ============================================
// Service Lifecycle Interfaces
// ============================================

/**
 * @interface IInitializable
 * @description Contract for services that require initialization.
 * Called once when the service is first created by the container.
 */
export class IInitializable {
    /**
     * Initialize the service.
     * Called once during application bootstrap.
     * Services should perform setup that doesn't depend on other services here.
     * @returns {Promise<void>}
     */
    async initialize() {
        throw new Error('IInitializable.initialize() must be implemented');
    }
}

/**
 * @interface IActivatable
 * @description Contract for services that can be activated and deactivated.
 * Used for tools, panels, and other features that have on/off states.
 */
export class IActivatable {
    /**
     * Activate the service.
     * Called when the service becomes active (e.g., tool selected).
     * @returns {Promise<void>}
     */
    async activate() {
        throw new Error('IActivatable.activate() must be implemented');
    }

    /**
     * Deactivate the service.
     * Called when the service becomes inactive (e.g., tool deselected).
     * Should clean up temporary resources.
     * @returns {Promise<void>}
     */
    async deactivate() {
        throw new Error('IActivatable.deactivate() must be implemented');
    }
}

/**
 * @interface IDisposable
 * @description Contract for services that need cleanup.
 * Called when the service is being destroyed.
 * Must release all resources: event listeners, timers, workers, canvases, etc.
 */
export class IDisposable {
    /**
     * Dispose the service.
     * Release all resources. After disposal, the service should not be used.
     * Must be idempotent (safe to call multiple times).
     * @returns {void | Promise<void>}
     */
    dispose() {
        throw new Error('IDisposable.dispose() must be implemented');
    }
}

// ============================================
// Service Provider Interface
// ============================================

/**
 * @interface IServiceProvider
 * @description Contract for service provider classes.
 * Service providers are responsible for constructing and configuring
 * one or more related services. They act as factories with lifecycle hooks.
 */
export class IServiceProvider {
    /**
     * Register services with the container.
     * Called during bootstrap to tell the container what services exist.
     * @param {import('./ServiceContainer.js').ServiceContainer} container
     */
    register(container) {
        throw new Error('IServiceProvider.register() must be implemented');
    }

    /**
     * Boot the registered services.
     * Called after all services are registered but before they are used.
     * Services can resolve and configure other services here.
     * @param {import('./ServiceContainer.js').ServiceContainer} container
     * @returns {Promise<void>}
     */
    async boot(container) {
        throw new Error('IServiceProvider.boot() must be implemented');
    }
}

// ============================================
// Service Definition
// ============================================

/**
 * @typedef {Object} ServiceDefinition
 * @description Configuration object that describes how a service should be created.
 * 
 * @property {Symbol} token - Unique service identifier (from ServiceTokens)
 * @property {Function} factory - Factory function that creates the service instance
 * @property {'singleton'|'transient'|'scoped'} [lifetime='singleton'] - Service lifetime
 * @property {Symbol[]} [dependencies=[]] - Tokens of services this service depends on
 * @property {boolean} [lazy=false] - If true, service is only created when first requested
 * @property {Function[]} [interfaces=[]] - Interface classes this service implements
 * 
 * Lifetime options:
 * - singleton: One instance for the entire application (most common)
 * - transient: New instance every time it's requested
 * - scoped: One instance per scope (e.g., per document)
 */

// ============================================
// Service Lifetime Enum
// ============================================

/**
 * @enum {string}
 * @description Defines the possible lifetimes of a service instance.
 */
export const ServiceLifetime = Object.freeze({
    /** One instance shared across the entire application */
    SINGLETON: 'singleton',
    
    /** New instance created each time the service is requested */
    TRANSIENT: 'transient',
    
    /** One instance per scope (e.g., per document, per session) */
    SCOPED: 'scoped',
});

// ============================================
// Container Events
// ============================================

/**
 * @enum {string}
 * @description Events emitted by the ServiceContainer.
 */
export const ContainerEvents = Object.freeze({
    /** Fired when a service is registered */
    SERVICE_REGISTERED: 'container:serviceRegistered',
    
    /** Fired when a service instance is created */
    SERVICE_CREATED: 'container:serviceCreated',
    
    /** Fired when a service is disposed */
    SERVICE_DISPOSED: 'container:serviceDisposed',
    
    /** Fired when a service fails to initialize */
    SERVICE_ERROR: 'container:serviceError',
    
    /** Fired when all services are registered */
    BOOTSTRAP_REGISTERED: 'container:bootstrapRegistered',
    
    /** Fired when all services are booted */
    BOOTSTRAP_BOOTED: 'container:bootstrapBooted',
    
    /** Fired when the container is shutting down */
    SHUTDOWN: 'container:shutdown',
});

// ============================================
// Error Types
// ============================================

/**
 * @class ServiceNotFoundError
 * @description Thrown when attempting to resolve a service that was not registered.
 */
export class ServiceNotFoundError extends Error {
    /**
     * @param {Symbol} token - The service token that was not found
     */
    constructor(token) {
        super(`Service not found: ${token.toString()}`);
        this.name = 'ServiceNotFoundError';
        this.token = token;
    }
}

/**
 * @class CircularDependencyError
 * @description Thrown when a circular dependency is detected between services.
 */
export class CircularDependencyError extends Error {
    /**
     * @param {Symbol[]} chain - The dependency chain that formed the circle
     */
    constructor(chain) {
        const chainStr = chain.map(s => s.toString()).join(' -> ');
        super(`Circular dependency detected: ${chainStr}`);
        this.name = 'CircularDependencyError';
        this.chain = chain;
    }
}

/**
 * @class ServiceInitializationError
 * @description Thrown when a service fails to initialize properly.
 */
export class ServiceInitializationError extends Error {
    /**
     * @param {Symbol} token - The service that failed
     * @param {Error} cause - The underlying error
     */
    constructor(token, cause) {
        super(`Failed to initialize service: ${token.toString()}`);
        this.name = 'ServiceInitializationError';
        this.token = token;
        this.cause = cause;
    }
}

/**
 * @class ServiceAlreadyRegisteredError
 * @description Thrown when attempting to register a service with a duplicate token.
 */
export class ServiceAlreadyRegisteredError extends Error {
    /**
     * @param {Symbol} token - The duplicate service token
     */
    constructor(token) {
        super(`Service already registered: ${token.toString()}`);
        this.name = 'ServiceAlreadyRegisteredError';
        this.token = token;
    }
}

// ============================================
// Utility Types
// ============================================

/**
 * @typedef {Object} ResolutionContext
 * @description Context passed during service resolution.
 * Contains information about the resolution chain for debugging and circular detection.
 * 
 * @property {Symbol} requestingToken - The service requesting the dependency
 * @property {Symbol[]} resolutionChain - Chain of services being resolved
 * @property {number} depth - Current resolution depth
 */

/**
 * @typedef {Object} ServiceMetadata
 * @description Metadata about a registered service for debugging and introspection.
 * 
 * @property {Symbol} token - Service token
 * @property {string} lifetime - Service lifetime type
 * @property {number} createdAt - Timestamp of registration
 * @property {boolean} isInitialized - Whether the service has been initialized
 * @property {number} [instanceCount] - Number of instances created (for transient)
 * @property {Symbol[]} dependents - Services that depend on this service
 */

/**
 * @typedef {Object} ContainerConfig
 * @description Configuration options for the ServiceContainer.
 * 
 * @property {boolean} [debug=false] - Enable debug logging
 * @property {boolean} [strictMode=true] - Throw on circular dependencies
 * @property {number} [maxResolutionDepth=50] - Maximum dependency resolution depth
 * @property {boolean} [validateOnRegister=true] - Validate service definitions on registration
 * @property {Function} [logger] - Custom logger function
 */

// ============================================
// Guard Utilities
// ============================================

/**
 * Check if an object implements a specific interface.
 * @param {Object} obj - Object to check
 * @param {Function} interfaceClass - Interface class to check against
 * @returns {boolean}
 */
export function implementsInterface(obj, interfaceClass) {
    if (!obj || typeof obj !== 'object') return false;
    
    const proto = Object.getPrototypeOf(interfaceClass);
    const methods = Object.getOwnPropertyNames(proto).filter(
        name => name !== 'constructor' && typeof proto[name] === 'function'
    );
    
    return methods.every(method => 
        typeof obj[method] === 'function'
    );
}

/**
 * Check if a value is a valid service token (Symbol).
 * @param {*} value - Value to check
 * @returns {boolean}
 */
export function isValidToken(value) {
    return typeof value === 'symbol';
}

/**
 * Validate a service definition object.
 * @param {ServiceDefinition} definition - Definition to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateServiceDefinition(definition) {
    const errors = [];
    
    if (!definition || typeof definition !== 'object') {
        errors.push('Service definition must be an object');
        return { valid: false, errors };
    }
    
    if (!isValidToken(definition.token)) {
        errors.push('Service token must be a Symbol');
    }
    
    if (typeof definition.factory !== 'function') {
        errors.push('Service factory must be a function');
    }
    
    if (definition.lifetime && 
        !Object.values(ServiceLifetime).includes(definition.lifetime)) {
        errors.push(`Invalid lifetime: ${definition.lifetime}`);
    }
    
    if (definition.dependencies && !Array.isArray(definition.dependencies)) {
        errors.push('Dependencies must be an array of Symbols');
    } else if (definition.dependencies) {
        definition.dependencies.forEach((dep, index) => {
            if (!isValidToken(dep)) {
                errors.push(`Dependency at index ${index} must be a Symbol`);
            }
        });
    }
    
    return {
        valid: errors.length === 0,
        errors,
    };
}

// ============================================
// Factory Helpers
// ============================================

/**
 * Create a service definition object.
 * @param {Object} options - Service definition options
 * @param {Symbol} options.token - Service token
 * @param {Function} options.factory - Factory function
 * @param {string} [options.lifetime='singleton'] - Service lifetime
 * @param {Symbol[]} [options.dependencies=[]] - Dependencies
 * @param {boolean} [options.lazy=false] - Lazy loading
 * @returns {ServiceDefinition}
 */
export function createServiceDefinition({
    token,
    factory,
    lifetime = ServiceLifetime.SINGLETON,
    dependencies = [],
    lazy = false,
}) {
    const definition = {
        token,
        factory,
        lifetime,
        dependencies,
        lazy,
        interfaces: [],
    };
    
    const validation = validateServiceDefinition(definition);
    if (!validation.valid) {
        throw new Error(
            `Invalid service definition for ${token.toString()}: ${validation.errors.join(', ')}`
        );
    }
    
    return definition;
}

// ============================================
// Exports
// ============================================

export default {
    ServiceTokens,
    ServiceLifetime,
    ContainerEvents,
    IInitializable,
    IActivatable,
    IDisposable,
    IServiceProvider,
    ServiceNotFoundError,
    CircularDependencyError,
    ServiceInitializationError,
    ServiceAlreadyRegisteredError,
    implementsInterface,
    isValidToken,
    validateServiceDefinition,
    createServiceDefinition,
};

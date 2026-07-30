// ============================================
// Paint Pro - Professional Web Graphics Application
// src/core/container/ServiceContainer.js
// Dependency Injection Container - IoC Core
// ============================================

import {
    ServiceLifetime,
    ContainerEvents,
    ServiceNotFoundError,
    CircularDependencyError,
    ServiceInitializationError,
    ServiceAlreadyRegisteredError,
    IInitializable,
    IDisposable,
    isValidToken,
    validateServiceDefinition,
} from './types.js';

/**
 * @class ServiceContainer
 * @description Lightweight Inversion of Control (IoC) container for managing
 * application services. Handles registration, resolution, lifecycle management,
 * and dependency injection. Ensures no circular dependencies exist and all
 * services follow their defined lifetimes.
 * 
 * Features:
 * - Singleton, Transient, and Scoped lifetimes
 * - Lazy service instantiation
 * - Circular dependency detection
 * - Automatic initialization of IInitializable services
 * - Automatic disposal of IDisposable services
 * - Event emission for debugging and monitoring
 * - Strict mode for development safety
 * 
 * @implements {IDisposable}
 */
export class ServiceContainer {
    /**
     * @param {import('./types.js').ContainerConfig} [config={}] - Container configuration
     */
    constructor(config = {}) {
        /**
         * Map of registered service definitions.
         * @private
         * @type {Map<Symbol, import('./types.js').ServiceDefinition>}
         */
        this._definitions = new Map();

        /**
         * Map of instantiated service instances (singletons and scoped).
         * @private
         * @type {Map<Symbol, Object>}
         */
        this._instances = new Map();

        /**
         * Map of resolved instances for current resolution chain.
         * Used for circular dependency detection.
         * @private
         * @type {Map<Symbol, Object>}
         */
        this._resolving = new Map();

        /**
         * Map of service metadata for debugging.
         * @private
         * @type {Map<Symbol, import('./types.js').ServiceMetadata>}
         */
        this._metadata = new Map();

        /**
         * Set of services that have been fully initialized.
         * @private
         * @type {Set<Symbol>}
         */
        this._initialized = new Set();

        /**
         * Set of services currently being initialized.
         * Used to prevent double initialization.
         * @private
         * @type {Set<Symbol>}
         */
        this._initializing = new Set();

        /**
         * Whether the container is being disposed.
         * @private
         * @type {boolean}
         */
        this._isDisposing = false;

        /**
         * Whether the container has been disposed.
         * @private
         * @type {boolean}
         */
        this._isDisposed = false;

        /**
         * Event listeners for container events.
         * @private
         * @type {Map<string, Set<Function>>}
         */
        this._listeners = new Map();

        /**
         * Container configuration.
         * @private
         * @type {import('./types.js').ContainerConfig}
         */
        this._config = Object.freeze({
            debug: false,
            strictMode: true,
            maxResolutionDepth: 50,
            validateOnRegister: true,
            logger: null,
            ...config,
        });

        this._log('debug', 'ServiceContainer created');
    }

    // ============================================
    // Public API - Registration
    // ============================================

    /**
     * Register a service definition with the container.
     * Services must be registered before they can be resolved.
     * 
     * @param {import('./types.js').ServiceDefinition} definition - Service definition
     * @throws {ServiceAlreadyRegisteredError} If token is already registered
     * @throws {Error} If definition validation fails
     * 
     * @example
     * container.register({
     *     token: ServiceTokens.EVENT_BUS,
     *     factory: () => new EventBus(),
     *     lifetime: ServiceLifetime.SINGLETON,
     * });
     */
    register(definition) {
        if (this._isDisposed || this._isDisposing) {
            throw new Error('Cannot register services on a disposed container');
        }

        // Validate definition
        if (this._config.validateOnRegister) {
            const validation = validateServiceDefinition(definition);
            if (!validation.valid) {
                throw new Error(
                    `Invalid service definition for ${definition.token?.toString()}: ${validation.errors.join(', ')}`
                );
            }
        }

        // Check for duplicate registration
        if (this._definitions.has(definition.token)) {
            throw new ServiceAlreadyRegisteredError(definition.token);
        }

        // Store definition
        this._definitions.set(definition.token, Object.freeze({ ...definition }));

        // Store metadata
        this._metadata.set(definition.token, {
            token: definition.token,
            lifetime: definition.lifetime,
            createdAt: Date.now(),
            isInitialized: false,
            instanceCount: 0,
            dependents: [],
        });

        // Update dependents metadata
        if (definition.dependencies && definition.dependencies.length > 0) {
            for (const depToken of definition.dependencies) {
                const depMetadata = this._metadata.get(depToken);
                if (depMetadata) {
                    depMetadata.dependents.push(definition.token);
                }
            }
        }

        this._emit(ContainerEvents.SERVICE_REGISTERED, { token: definition.token });
        this._log('debug', `Service registered: ${definition.token.toString()}`);
    }

    /**
     * Register multiple service definitions at once.
     * @param {import('./types.js').ServiceDefinition[]} definitions - Array of service definitions
     */
    registerAll(definitions) {
        if (!Array.isArray(definitions)) {
            throw new Error('registerAll requires an array of service definitions');
        }

        for (const definition of definitions) {
            this.register(definition);
        }
    }

    /**
     * Check if a service is registered.
     * @param {Symbol} token - Service token
     * @returns {boolean}
     */
    has(token) {
        if (!isValidToken(token)) {
            return false;
        }
        return this._definitions.has(token);
    }

    // ============================================
    // Public API - Resolution
    // ============================================

    /**
     * Resolve a service by its token.
     * Creates the service if it hasn't been created yet (for singletons).
     * Injects all declared dependencies automatically.
     * 
     * @param {Symbol} token - Service token to resolve
     * @returns {*} The service instance
     * @throws {ServiceNotFoundError} If service is not registered
     * @throws {CircularDependencyError} If circular dependency is detected
     * @throws {ServiceInitializationError} If initialization fails
     * 
     * @example
     * const eventBus = container.resolve(ServiceTokens.EVENT_BUS);
     */
    resolve(token) {
        if (!isValidToken(token)) {
            throw new Error(`Invalid service token: ${String(token)}`);
        }

        if (this._isDisposed || this._isDisposing) {
            throw new Error('Cannot resolve services from a disposed container');
        }

        const definition = this._definitions.get(token);

        if (!definition) {
            throw new ServiceNotFoundError(token);
        }

        // Check circular dependency
        if (this._resolving.has(token)) {
            const chain = Array.from(this._resolving.keys());
            chain.push(token);
            throw new CircularDependencyError(chain);
        }

        // Return existing instance for singletons
        if (definition.lifetime === ServiceLifetime.SINGLETON && this._instances.has(token)) {
            return this._instances.get(token);
        }

        // For transient services, always create new instance
        if (definition.lifetime === ServiceLifetime.TRANSIENT) {
            return this._createInstance(token, definition);
        }

        // For singletons, create once and cache
        if (!this._instances.has(token)) {
            const instance = this._createInstance(token, definition);
            this._instances.set(token, instance);
            this._metadata.get(token).instanceCount = 1;
        }

        return this._instances.get(token);
    }

    /**
     * Resolve all services that match a predicate.
     * Useful for resolving all tools, all filters, etc.
     * 
     * @param {Function} predicate - Filter function (token, definition) => boolean
     * @returns {Array<{token: Symbol, instance: *}>}
     */
    resolveAll(predicate = null) {
        const results = [];

        for (const [token, definition] of this._definitions) {
            if (!predicate || predicate(token, definition)) {
                try {
                    const instance = this.resolve(token);
                    results.push({ token, instance });
                } catch (error) {
                    this._log('error', `Failed to resolve ${token.toString()}:`, error);
                }
            }
        }

        return results;
    }

    /**
     * Resolve a service lazily.
     * Returns a function that resolves the service on first call.
     * Useful for breaking circular dependencies or deferring expensive creation.
     * 
     * @param {Symbol} token - Service token
     * @returns {Function} Function that returns the service
     */
    lazy(token) {
        let resolved = false;
        let instance = null;

        return () => {
            if (!resolved) {
                instance = this.resolve(token);
                resolved = true;
            }
            return instance;
        };
    }

    // ============================================
    // Public API - Initialization
    // ============================================

    /**
     * Initialize all registered services.
     * Calls initialize() on all services that implement IInitializable.
     * Services are initialized in dependency order.
     * 
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._isDisposed || this._isDisposing) {
            throw new Error('Cannot initialize a disposed container');
        }

        this._log('info', 'Initializing all services...');

        const initializationOrder = this._getInitializationOrder();
        const errors = [];

        for (const token of initializationOrder) {
            try {
                await this._initializeService(token);
            } catch (error) {
                errors.push({ token, error });
                this._emit(ContainerEvents.SERVICE_ERROR, { token, error });

                if (this._config.strictMode) {
                    throw new ServiceInitializationError(token, error);
                }
            }
        }

        if (errors.length > 0) {
            this._log('warn', `${errors.length} service(s) failed to initialize`);
        }

        this._emit(ContainerEvents.BOOTSTRAP_BOOTED, { errors });
        this._log('info', 'All services initialized');
    }

    /**
     * Initialize a single service by token.
     * @param {Symbol} token - Service token
     * @returns {Promise<void>}
     */
    async initializeService(token) {
        if (this._isDisposed || this._isDisposing) {
            throw new Error('Cannot initialize service on disposed container');
        }

        await this._initializeService(token);
    }

    // ============================================
    // Public API - Disposal
    // ============================================

    /**
     * Dispose the container and all managed services.
     * Services are disposed in reverse dependency order.
     * Container cannot be used after disposal.
     * 
     * @returns {Promise<void>}
     */
    async dispose() {
        if (this._isDisposed) return;
        if (this._isDisposing) return;

        this._isDisposing = true;
        this._emit(ContainerEvents.SHUTDOWN, {});

        this._log('info', 'Disposing ServiceContainer...');

        // Dispose in reverse initialization order
        const disposalOrder = this._getDisposalOrder();

        for (const token of disposalOrder) {
            try {
                await this._disposeService(token);
            } catch (error) {
                this._log('error', `Error disposing ${token.toString()}:`, error);
            }
        }

        // Clear all maps
        this._definitions.clear();
        this._instances.clear();
        this._resolving.clear();
        this._metadata.clear();
        this._initialized.clear();
        this._initializing.clear();

        // Clear listeners
        for (const [, listeners] of this._listeners) {
            listeners.clear();
        }
        this._listeners.clear();

        this._isDisposed = true;
        this._isDisposing = false;

        this._log('info', 'ServiceContainer disposed');
    }

    // ============================================
    // Public API - Events
    // ============================================

    /**
     * Listen for container events.
     * @param {string} event - Event name from ContainerEvents
     * @param {Function} listener - Callback function
     * @returns {Function} Unsubscribe function
     */
    on(event, listener) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(listener);

        return () => {
            const listeners = this._listeners.get(event);
            if (listeners) {
                listeners.delete(listener);
            }
        };
    }

    /**
     * Remove an event listener.
     * @param {string} event - Event name
     * @param {Function} listener - Listener to remove
     */
    off(event, listener) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            listeners.delete(listener);
        }
    }

    // ============================================
    // Public API - Introspection
    // ============================================

    /**
     * Get metadata for a registered service.
     * @param {Symbol} token - Service token
     * @returns {import('./types.js').ServiceMetadata|undefined}
     */
    getMetadata(token) {
        return this._metadata.get(token);
    }

    /**
     * Get all registered service tokens.
     * @returns {Symbol[]}
     */
    getRegisteredTokens() {
        return Array.from(this._definitions.keys());
    }

    /**
     * Check if a service has been initialized.
     * @param {Symbol} token - Service token
     * @returns {boolean}
     */
    isInitialized(token) {
        return this._initialized.has(token);
    }

    /**
     * Get the number of registered services.
     * @returns {number}
     */
    size() {
        return this._definitions.size;
    }

    // ============================================
    // Private Methods - Instance Creation
    // ============================================

    /**
     * Create a service instance and inject its dependencies.
     * @private
     * @param {Symbol} token - Service token
     * @param {import('./types.js').ServiceDefinition} definition - Service definition
     * @returns {*} The created instance
     */
    _createInstance(token, definition) {
        // Mark as resolving for circular detection
        this._resolving.set(token, true);

        try {
            // Resolve all dependencies
            const dependencies = (definition.dependencies || []).map(depToken => {
                this._checkResolutionDepth(token);
                return this.resolve(depToken);
            });

            // Create instance using factory
            const instance = definition.factory(this, ...dependencies);

            if (instance === null || instance === undefined) {
                throw new Error(
                    `Factory for ${token.toString()} returned ${instance}. Must return a valid instance.`
                );
            }

            // Update metadata
            const metadata = this._metadata.get(token);
            if (metadata) {
                metadata.instanceCount++;
            }

            this._emit(ContainerEvents.SERVICE_CREATED, { token, instance });

            return instance;
        } finally {
            // Remove from resolving set
            this._resolving.delete(token);
        }
    }

    /**
     * Initialize a single service if it implements IInitializable.
     * @private
     * @param {Symbol} token - Service token
     * @returns {Promise<void>}
     */
    async _initializeService(token) {
        // Skip if already initialized or being initialized
        if (this._initialized.has(token)) return;
        if (this._initializing.has(token)) return;

        // Ensure service is created first (for lazy services)
        const instance = this.resolve(token);

        // Check if service needs initialization
        if (typeof instance.initialize !== 'function') {
            this._initialized.add(token);
            return;
        }

        // Initialize dependencies first
        const definition = this._definitions.get(token);
        if (definition && definition.dependencies) {
            for (const depToken of definition.dependencies) {
                await this._initializeService(depToken);
            }
        }

        // Initialize the service
        this._initializing.add(token);

        try {
            this._log('debug', `Initializing: ${token.toString()}`);
            await instance.initialize();
            this._initialized.add(token);

            const metadata = this._metadata.get(token);
            if (metadata) {
                metadata.isInitialized = true;
            }
        } finally {
            this._initializing.delete(token);
        }
    }

    /**
     * Dispose a single service if it implements IDisposable.
     * @private
     * @param {Symbol} token - Service token
     * @returns {Promise<void>}
     */
    async _disposeService(token) {
        const instance = this._instances.get(token);

        if (instance && typeof instance.dispose === 'function') {
            try {
                this._log('debug', `Disposing: ${token.toString()}`);
                const result = instance.dispose();
                if (result instanceof Promise) {
                    await result;
                }
            } catch (error) {
                this._log('error', `Error disposing ${token.toString()}:`, error);
            }
        }

        this._instances.delete(token);
        this._initialized.delete(token);

        this._emit(ContainerEvents.SERVICE_DISPOSED, { token });
    }

    // ============================================
    // Private Methods - Ordering
    // ============================================

    /**
     * Get services in dependency order for initialization.
     * Uses topological sort to ensure dependencies are initialized first.
     * @private
     * @returns {Symbol[]}
     */
    _getInitializationOrder() {
        const visited = new Set();
        const ordered = [];

        const visit = (token) => {
            if (visited.has(token)) return;
            visited.add(token);

            const definition = this._definitions.get(token);
            if (definition && definition.dependencies) {
                for (const depToken of definition.dependencies) {
                    if (this._definitions.has(depToken)) {
                        visit(depToken);
                    }
                }
            }

            ordered.push(token);
        };

        for (const token of this._definitions.keys()) {
            visit(token);
        }

        return ordered;
    }

    /**
     * Get services in reverse dependency order for disposal.
     * Ensures dependents are disposed before their dependencies.
     * @private
     * @returns {Symbol[]}
     */
    _getDisposalOrder() {
        const initializationOrder = this._getInitializationOrder();
        return initializationOrder.reverse();
    }

    // ============================================
    // Private Methods - Validation
    // ============================================

    /**
     * Check that the resolution depth hasn't exceeded the maximum.
     * Prevents infinite recursion from circular dependencies.
     * @private
     * @param {Symbol} token - Token being resolved
     */
    _checkResolutionDepth(token) {
        if (this._resolving.size > this._config.maxResolutionDepth) {
            const chain = Array.from(this._resolving.keys());
            chain.push(token);
            throw new CircularDependencyError(chain);
        }
    }

    // ============================================
    // Private Methods - Event & Logging
    // ============================================

    /**
     * Emit a container event to all listeners.
     * @private
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    _emit(event, data) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            for (const listener of listeners) {
                try {
                    listener(data);
                } catch (error) {
                    this._log('error', `Event listener error for ${event}:`, error);
                }
            }
        }
    }

    /**
     * Log a message if debugging is enabled.
     * @private
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {...*} args - Additional arguments
     */
    _log(level, message, ...args) {
        if (!this._config.debug) return;

        const logger = this._config.logger || console;
        const prefix = '[ServiceContainer]';

        switch (level) {
            case 'error':
                logger.error(prefix, message, ...args);
                break;
            case 'warn':
                logger.warn(prefix, message, ...args);
                break;
            case 'info':
                logger.info(prefix, message, ...args);
                break;
            case 'debug':
            default:
                logger.debug(prefix, message, ...args);
                break;
        }
    }
}

// ============================================
// Default Export
// ============================================

export default ServiceContainer;

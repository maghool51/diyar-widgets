// ============================================
// Paint Pro - Professional Web Graphics Application
// src/core/state/Store.js
// Centralized Immutable State Management
// ============================================

/**
 * @module core/state/Store
 * @description Centralized state management system providing a single source
 * of truth for all application state. Implements a Redux-inspired pattern with
 * immutable state updates, middleware support, selector-based subscriptions,
 * and time-travel debugging capabilities.
 * 
 * Key Features:
 * - Immutable state (enforced via Object.freeze)
 * - Action-based state mutations (predictable)
 * - Middleware pipeline for side effects
 * - Selector-based subscriptions (no unnecessary re-renders)
 * - State snapshots for debugging
 * - Batched updates
 * - State validation
 * 
 * Design Principles:
 * - State is never mutated directly
 * - All changes go through dispatch()
 * - Subscribers are notified only when their selected data changes
 * - Middleware can intercept, modify, or cancel actions
 */

// ============================================
// Action Types
// ============================================

/**
 * @typedef {Object} Action
 * @description An action that describes a state change.
 * @property {string} type - Action type identifier (e.g., 'ZOOM_CHANGED')
 * @property {*} [payload] - Data needed for the state change
 * @property {Object} [meta] - Metadata about the action
 * @property {string} [meta.source] - Source of the action
 * @property {number} [meta.timestamp] - When the action was created
 */

// ============================================
// Middleware Interface
// ============================================

/**
 * @callback Middleware
 * @description Middleware function that wraps the dispatch pipeline.
 * @param {Store} store - Reference to the store
 * @returns {Function} Next middleware or dispatch function
 * 
 * @example
 * const loggerMiddleware = (store) => (next) => (action) => {
 *     console.log('Before:', store.getState());
 *     console.log('Action:', action);
 *     const result = next(action);
 *     console.log('After:', store.getState());
 *     return result;
 * };
 */

// ============================================
// Reducer Interface
// ============================================

/**
 * @callback Reducer
 * @description Pure function that produces new state from current state and an action.
 * Must not mutate the previous state.
 * @param {Object} state - Current state (immutable)
 * @param {Action} action - Dispatched action
 * @returns {Object} New state (must be a new object)
 */

// ============================================
// Selector Interface
// ============================================

/**
 * @callback Selector
 * @description Function that extracts derived data from state.
 * Should be memoized for performance.
 * @param {Object} state - Current state
 * @returns {*} Derived data
 * 
 * @example
 * const selectZoom = (state) => state.canvas.viewport.zoom;
 * const selectActiveLayer = (state) => state.layers.byId[state.layers.activeId];
 */

// ============================================
// Store Class
// ============================================

/**
 * @class Store
 * @description Centralized state container for the entire application.
 * All state reads go through selectors, all state writes go through dispatch.
 * 
 * @example
 * const store = new Store(eventBus, rootReducer, initialState);
 * 
 * // Dispatch an action
 * store.dispatch({ type: 'ZOOM_CHANGED', payload: { zoom: 2 } });
 * 
 * // Subscribe to state changes
 * const unsubscribe = store.subscribe(
 *     (state) => state.canvas.zoom,
 *     (newZoom, oldZoom) => console.log('Zoom changed:', newZoom)
 * );
 */
export class Store {
    /**
     * @param {EventBus} eventBus - Event bus for store events
     * @param {Reducer} rootReducer - Root reducer function
     * @param {Object} [initialState={}] - Initial application state
     * @param {Object} [options={}] - Store configuration
     * @param {boolean} [options.debug=false] - Enable debug logging
     * @param {number} [options.maxSnapshots=50] - Maximum state snapshots for debugging
     * @param {boolean} [options.strictMode=true] - Throw on state mutation
     */
    constructor(eventBus, rootReducer, initialState = {}, options = {}) {
        if (!eventBus) {
            throw new Error('Store requires an EventBus instance');
        }

        if (typeof rootReducer !== 'function') {
            throw new Error('Store requires a rootReducer function');
        }

        /**
         * Event bus for store events.
         * @private
         * @type {EventBus}
         */
        this._eventBus = eventBus;

        /**
         * Root reducer function.
         * @private
         * @type {Reducer}
         */
        this._rootReducer = rootReducer;

        /**
         * Current application state (frozen/immutable).
         * @private
         * @type {Object}
         */
        this._state = Object.freeze({ ...initialState });

        /**
         * Middleware chain.
         * @private
         * @type {Middleware[]}
         */
        this._middleware = [];

        /**
         * Cached dispatch function with middleware applied.
         * @private
         * @type {Function}
         */
        this._dispatch = null;

        /**
         * Map of selector string to subscription info.
         * @private
         * @type {Map<string, {selector: Selector, listeners: Set<Function>, lastValue: *}>}
         */
        this._subscriptions = new Map();

        /**
         * State snapshots for time-travel debugging.
         * @private
         * @type {Array<{state: Object, action: Action}>}
         */
        this._snapshots = [];

        /**
         * Whether the store is currently dispatching.
         * @private
         * @type {boolean}
         */
        this._isDispatching = false;

        /**
         * Batch queue for batched updates.
         * @private
         * @type {Action[]}
         */
        this._batchQueue = [];

        /**
         * Whether batch mode is active.
         * @private
         * @type {boolean}
         */
        this._isBatching = false;

        /**
         * Configuration options.
         * @private
         * @type {Object}
         */
        this._options = Object.freeze({
            debug: false,
            maxSnapshots: 50,
            strictMode: true,
            ...options,
        });

        /**
         * Whether the store has been disposed.
         * @private
         * @type {boolean}
         */
        this._disposed = false;

        // Initialize dispatch chain
        this._rebuildDispatchChain();

        this._log('debug', 'Store initialized with state:', this._state);
    }

    // ============================================
    // Public API - State Access
    // ============================================

    /**
     * Get the current state.
     * Returns a frozen snapshot. Do not attempt to mutate.
     * 
     * @returns {Object} Current immutable state
     */
    getState() {
        return this._state;
    }

    /**
     * Select derived data from the current state.
     * 
     * @param {Selector|Function} selector - Selector function
     * @returns {*} Selected data
     * 
     * @example
     * const zoom = store.select(state => state.canvas.viewport.zoom);
     */
    select(selector) {
        if (typeof selector !== 'function') {
            throw new Error('Selector must be a function');
        }

        return selector(this._state);
    }

    /**
     * Get a value from state using a dot-notation path.
     * 
     * @param {string} path - Dot-notation path (e.g., 'canvas.viewport.zoom')
     * @param {*} [defaultValue] - Default value if path doesn't exist
     * @returns {*} Value at path
     * 
     * @example
     * const zoom = store.get('canvas.viewport.zoom', 1);
     */
    get(path, defaultValue = undefined) {
        if (typeof path !== 'string') {
            throw new Error('Path must be a string');
        }

        const keys = path.split('.');
        let value = this._state;

        for (const key of keys) {
            if (value === null || value === undefined) {
                return defaultValue;
            }
            value = value[key];
        }

        return value !== undefined ? value : defaultValue;
    }

    // ============================================
    // Public API - Dispatch
    // ============================================

    /**
     * Dispatch an action to modify the state.
     * 
     * @param {Action|Object} action - Action to dispatch
     * @returns {Action} The dispatched action (after middleware)
     * @throws {Error} If dispatching during another dispatch (reentrancy)
     * 
     * @example
     * store.dispatch({
     *     type: 'ZOOM_CHANGED',
     *     payload: { zoom: 2 },
     *     meta: { source: 'zoomTool' }
     * });
     */
    dispatch(action) {
        this._validateNotDisposed();

        if (typeof action !== 'object' || action === null) {
            throw new Error('Action must be a non-null object');
        }

        if (typeof action.type !== 'string' || action.type.length === 0) {
            throw new Error('Action must have a non-empty string type');
        }

        // If batching, queue the action
        if (this._isBatching) {
            this._batchQueue.push(action);
            return action;
        }

        if (this._isDispatching) {
            throw new Error(
                'Cannot dispatch action while another dispatch is in progress. ' +
                `Attempted to dispatch: ${action.type}`
            );
        }

        this._isDispatching = true;

        try {
            // Add timestamp if not present
            if (!action.meta) {
                action.meta = {};
            }
            if (!action.meta.timestamp) {
                action.meta.timestamp = Date.now();
            }

            // Run through dispatch chain (including middleware)
            const result = this._dispatch(action);

            return result;
        } finally {
            this._isDispatching = false;

            // Process any batched actions that were queued during dispatch
            if (this._batchQueue.length > 0 && !this._isBatching) {
                const queuedActions = this._batchQueue.splice(0);
                for (const queuedAction of queuedActions) {
                    this.dispatch(queuedAction);
                }
            }
        }
    }

    /**
     * The core dispatch implementation.
     * @private
     * @param {Action} action - Action to process
     * @returns {Action} The action
     */
    _coreDispatch(action) {
        const previousState = this._state;

        // Run through reducer
        const newState = this._rootReducer(previousState, action);

        // Validate new state
        if (newState === undefined) {
            throw new Error(
                `Reducer returned undefined for action: ${action.type}. ` +
                'Reducer must always return a state object.'
            );
        }

        if (newState === previousState && this._options.strictMode) {
            this._log('warn', `Reducer returned same reference for action: ${action.type}`);
        }

        // Freeze new state
        const frozenState = Object.freeze(newState);

        // Update state
        this._state = frozenState;

        // Add to snapshots
        this._addSnapshot(action, previousState, frozenState);

        // Notify subscribers
        this._notifySubscribers(previousState, frozenState);

        this._log('debug', `Action dispatched: ${action.type}`);

        return action;
    }

    // ============================================
    // Public API - Batching
    // ============================================

    /**
     * Start batching actions.
     * Actions are queued and dispatched together when endBatch() is called.
     * Subscribers are only notified once after the batch completes.
     */
    beginBatch() {
        this._isBatching = true;
        this._batchQueue = [];
    }

    /**
     * End batching and dispatch all queued actions.
     * Subscribers are notified once after all actions are processed.
     */
    endBatch() {
        if (!this._isBatching) return;

        this._isBatching = false;
        const actions = this._batchQueue;
        this._batchQueue = [];

        if (actions.length === 0) return;

        const previousState = this._state;
        let currentState = previousState;

        // Process all actions
        for (const action of actions) {
            currentState = this._rootReducer(currentState, action);

            if (currentState === undefined) {
                throw new Error(`Reducer returned undefined for batched action: ${action.type}`);
            }
        }

        // Freeze and update
        const frozenState = Object.freeze(currentState);
        this._state = frozenState;

        // Single snapshot for the batch
        this._addSnapshot(
            { type: '@@BATCH', payload: { actions: actions.map(a => a.type) } },
            previousState,
            frozenState
        );

        // Notify subscribers once
        this._notifySubscribers(previousState, frozenState);

        this._log('debug', `Batch dispatched: ${actions.length} actions`);
    }

    // ============================================
    // Public API - Subscription
    // ============================================

    /**
     * Subscribe to state changes filtered by a selector.
     * The listener is only called when the selected data actually changes.
     * 
     * @param {Selector|Function} selector - Selector function
     * @param {Function} listener - Callback(newValue, oldValue, state)
     * @param {Object} [options={}] - Subscription options
     * @param {boolean} [options.immediate=false] - Call listener immediately
     * @returns {Function} Unsubscribe function
     * 
     * @example
     * const unsubscribe = store.subscribe(
     *     state => state.canvas.viewport.zoom,
     *     (newZoom, oldZoom) => {
     *         console.log(`Zoom changed from ${oldZoom} to ${newZoom}`);
     *     }
     * );
     */
    subscribe(selector, listener, options = {}) {
        if (typeof selector !== 'function') {
            throw new Error('Selector must be a function');
        }

        if (typeof listener !== 'function') {
            throw new Error('Listener must be a function');
        }

        const key = Store._selectorToKey(selector);
        let subscription = this._subscriptions.get(key);

        if (!subscription) {
            subscription = {
                selector,
                listeners: new Set(),
                lastValue: selector(this._state),
            };
            this._subscriptions.set(key, subscription);
        }

        subscription.listeners.add(listener);

        // Call immediately if requested
        if (options.immediate) {
            try {
                listener(subscription.lastValue, undefined, this._state);
            } catch (error) {
                this._log('error', 'Immediate listener error:', error);
            }
        }

        // Return unsubscribe function
        return () => {
            subscription.listeners.delete(listener);

            // Clean up if no more listeners
            if (subscription.listeners.size === 0) {
                this._subscriptions.delete(key);
            }
        };
    }

    /**
     * Subscribe to all state changes (no selector).
     * Use sparingly - prefer selector-based subscriptions.
     * 
     * @param {Function} listener - Callback(newState, oldState)
     * @returns {Function} Unsubscribe function
     */
    subscribeToAll(listener) {
        return this.subscribe(
            state => state,
            listener
        );
    }

    /**
     * Create a one-time subscription.
     * @param {Selector} selector - Selector function
     * @param {Function} listener - Callback
     * @returns {Function} Unsubscribe function
     */
    once(selector, listener) {
        const unsubscribe = this.subscribe(selector, (newValue, oldValue, state) => {
            unsubscribe();
            listener(newValue, oldValue, state);
        });

        return unsubscribe;
    }

    /**
     * Wait for a condition to be true, then resolve.
     * @param {Selector} selector - Selector that returns boolean
     * @param {number} [timeout=0] - Timeout in ms (0 = no timeout)
     * @returns {Promise<*>}
     */
    waitFor(selector, timeout = 0) {
        return new Promise((resolve, reject) => {
            // Check immediately
            const currentValue = selector(this._state);
            if (currentValue) {
                resolve(currentValue);
                return;
            }

            let timeoutId = null;
            const unsubscribe = this.subscribe(selector, (newValue) => {
                if (newValue) {
                    if (timeoutId) clearTimeout(timeoutId);
                    unsubscribe();
                    resolve(newValue);
                }
            });

            if (timeout > 0) {
                timeoutId = setTimeout(() => {
                    unsubscribe();
                    reject(new Error('waitFor timed out'));
                }, timeout);
            }
        });
    }

    // ============================================
    // Public API - Middleware
    // ============================================

    /**
     * Add middleware to the dispatch pipeline.
     * Middleware is applied in the order it was added.
     * 
     * @param {Middleware} middleware - Middleware function
     * @returns {Function} Function to remove the middleware
     * 
     * @example
     * store.addMiddleware(loggerMiddleware);
     */
    addMiddleware(middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('Middleware must be a function');
        }

        this._middleware.push(middleware);
        this._rebuildDispatchChain();

        return () => {
            const index = this._middleware.indexOf(middleware);
            if (index !== -1) {
                this._middleware.splice(index, 1);
                this._rebuildDispatchChain();
            }
        };
    }

    // ============================================
    // Public API - Debugging
    // ============================================

    /**
     * Get state snapshots for time-travel debugging.
     * @returns {Array<{state: Object, action: Action}>}
     */
    getSnapshots() {
        return [...this._snapshots];
    }

    /**
     * Get the number of active subscribers.
     * @returns {number}
     */
    getSubscriberCount() {
        let count = 0;
        for (const subscription of this._subscriptions.values()) {
            count += subscription.listeners.size;
        }
        return count;
    }

    /**
     * Get store statistics.
     * @returns {Object}
     */
    getStats() {
        return {
            subscriberCount: this.getSubscriberCount(),
            snapshotCount: this._snapshots.length,
            middlewareCount: this._middleware.length,
            stateKeys: Object.keys(this._state).length,
            isBatching: this._isBatching,
            batchQueueSize: this._batchQueue.length,
        };
    }

    // ============================================
    // Public API - Disposal
    // ============================================

    /**
     * Dispose the store and release all resources.
     */
    dispose() {
        if (this._disposed) return;

        // Clear all subscriptions
        this._subscriptions.clear();

        // Clear snapshots
        this._snapshots = [];

        // Clear middleware
        this._middleware = [];
        this._dispatch = null;

        // Clear batch queue
        this._batchQueue = [];

        // Release state reference
        this._state = Object.freeze({});

        this._disposed = true;
        this._log('info', 'Store disposed');
    }

    // ============================================
    // Private Methods - Dispatch Chain
    // ============================================

    /**
     * Rebuild the middleware dispatch chain.
     * @private
     */
    _rebuildDispatchChain() {
        let dispatch = this._coreDispatch.bind(this);

        // Apply middleware in reverse order (so first added is outermost)
        for (let i = this._middleware.length - 1; i >= 0; i--) {
            const middleware = this._middleware[i];
            dispatch = middleware(this)(dispatch);
        }

        this._dispatch = dispatch;
    }

    // ============================================
    // Private Methods - Subscriptions
    // ============================================

    /**
     * Notify all relevant subscribers of a state change.
     * @private
     * @param {Object} previousState - State before change
     * @param {Object} newState - State after change
     */
    _notifySubscribers(previousState, newState) {
        if (this._subscriptions.size === 0) return;

        for (const [key, subscription] of this._subscriptions) {
            try {
                const newValue = subscription.selector(newState);
                const oldValue = subscription.lastValue;

                // Check if value actually changed
                if (!Store._isEqual(newValue, oldValue)) {
                    subscription.lastValue = newValue;

                    for (const listener of subscription.listeners) {
                        try {
                            listener(newValue, oldValue, newState);
                        } catch (error) {
                            this._log('error',
                                `Subscriber error for selector "${key}":`, error
                            );
                        }
                    }
                }
            } catch (error) {
                this._log('error',
                    `Selector error for "${key}":`, error
                );
            }
        }
    }

    // ============================================
    // Private Methods - Snapshots
    // ============================================

    /**
     * Add a state snapshot for debugging.
     * @private
     * @param {Action} action - The action that caused the change
     * @param {Object} previousState - State before the action
     * @param {Object} newState - State after the action
     */
    _addSnapshot(action, previousState, newState) {
        this._snapshots.push({
            action: { type: action.type, payload: action.payload, meta: action.meta },
            previousState,
            newState,
            timestamp: Date.now(),
        });

        // Trim snapshots
        if (this._snapshots.length > this._options.maxSnapshots) {
            this._snapshots = this._snapshots.slice(-this._options.maxSnapshots);
        }
    }

    // ============================================
    // Private Methods - Validation
    // ============================================

    /**
     * Validate that the store has not been disposed.
     * @private
     * @throws {Error} If disposed
     */
    _validateNotDisposed() {
        if (this._disposed) {
            throw new Error('Store has been disposed and cannot be used');
        }
    }

    // ============================================
    // Private Methods - Logging
    // ============================================

    /**
     * Log a message if debug mode is enabled.
     * @private
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {...*} args - Additional arguments
     */
    _log(level, message, ...args) {
        if (!this._options.debug) return;

        const prefix = '[Store]';

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

    // ============================================
    // Private Static Methods
    // ============================================

    /**
     * Convert a selector function to a unique key string.
     * Uses the function source or a hash for identification.
     * @private
     * @param {Function} selector - Selector function
     * @returns {string} Unique key
     */
    static _selectorToKey(selector) {
        // Use function source as key if available
        const source = selector.toString();
        // Simple hash for the source string
        let hash = 0;
        for (let i = 0; i < source.length; i++) {
            const char = source.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `selector_${Math.abs(hash)}`;
    }

    /**
     * Check if two values are equal (shallow comparison for objects).
     * @private
     * @param {*} a - First value
     * @param {*} b - Second value
     * @returns {boolean}
     */
    static _isEqual(a, b) {
        // Same reference or both primitives equal
        if (a === b) return true;

        // One is null/undefined but not both
        if (a == null || b == null) return false;

        // Both are objects - do shallow comparison
        if (typeof a === 'object' && typeof b === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);

            if (keysA.length !== keysB.length) return false;

            for (const key of keysA) {
                if (a[key] !== b[key]) return false;
            }

            return true;
        }

        return false;
    }
}

// ============================================
// Built-in Middleware
// ============================================

/**
 * Logger middleware - logs all actions and state changes.
 * @param {Store} store - The store instance
 * @returns {Middleware}
 */
export function createLoggerMiddleware(store) {
    return (next) => (action) => {
        const prevState = store.getState();
        const result = next(action);
        const nextState = store.getState();

        console.group(`Action: ${action.type}`);
        console.log('Previous State:', prevState);
        console.log('Action:', action);
        console.log('Next State:', nextState);
        console.groupEnd();

        return result;
    };
}

/**
 * Thunk middleware - allows dispatching functions for async operations.
 * @param {Store} store - The store instance
 * @returns {Middleware}
 * 
 * @example
 * store.dispatch(async (dispatch, getState) => {
 *     const data = await fetchData();
 *     dispatch({ type: 'DATA_LOADED', payload: data });
 * });
 */
export function createThunkMiddleware(store) {
    return (next) => (action) => {
        if (typeof action === 'function') {
            return action(store.dispatch.bind(store), store.getState.bind(store));
        }
        return next(action);
    };
}

/**
 * Validation middleware - validates actions against a schema.
 * @param {Store} store - The store instance
 * @param {Object} actionSchema - Schema defining valid actions
 * @returns {Middleware}
 */
export function createValidationMiddleware(store, actionSchema = {}) {
    return (next) => (action) => {
        if (actionSchema[action.type]) {
            const validator = actionSchema[action.type];
            const errors = validator(action);
            if (errors && errors.length > 0) {
                console.error(`Action validation failed for ${action.type}:`, errors);
                return action;
            }
        }
        return next(action);
    };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create an action creator function.
 * @param {string} type - Action type
 * @returns {Function} Action creator (payload, meta) => Action
 * 
 * @example
 * const zoomChanged = createAction('ZOOM_CHANGED');
 * store.dispatch(zoomChanged({ zoom: 2 }));
 */
export function createAction(type) {
    return (payload = {}, meta = {}) => ({
        type,
        payload,
        meta: { ...meta, timestamp: Date.now() },
    });
}

/**
 * Combine multiple reducers into a single root reducer.
 * @param {Object<string, Reducer>} reducers - Map of state keys to reducers
 * @returns {Reducer} Combined root reducer
 * 
 * @example
 * const rootReducer = combineReducers({
 *     canvas: canvasReducer,
 *     layers: layersReducer,
 *     tools: toolsReducer,
 * });
 */
export function combineReducers(reducers) {
    const reducerKeys = Object.keys(reducers);

    return (state = {}, action) => {
        const nextState = {};
        let hasChanged = false;

        for (const key of reducerKeys) {
            const previousStateForKey = state[key];
            const nextStateForKey = reducers[key](previousStateForKey, action);

            if (nextStateForKey === undefined) {
                throw new Error(`Reducer for "${key}" returned undefined`);
            }

            nextState[key] = nextStateForKey;
            hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
        }

        return hasChanged ? nextState : state;
    };
}

// ============================================
// Default Export
// ============================================

export default Store;

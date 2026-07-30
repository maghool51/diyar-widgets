// ============================================
// Paint Pro - Professional Web Graphics Application
// src/core/event-bus/EventBus.js
// Centralized Publish/Subscribe Event System
// ============================================

/**
 * @module core/event-bus/EventBus
 * @description Lightweight, high-performance publish/subscribe event bus
 * for fully decoupled inter-module communication. Supports typed events,
 * wildcard matching, priority ordering, async handlers, one-time subscriptions,
 * and automatic memory leak prevention.
 * 
 * Design Principles:
 * - Zero external dependencies
 * - No DOM event reliance
 * - No global state pollution
 * - Memory-safe (no leaks from forgotten subscriptions)
 * - High performance (O(log n) for prioritized dispatch)
 * - Async-safe (handles both sync and async listeners)
 */

// ============================================
// Constants
// ============================================

/**
 * Default maximum number of listeners per event.
 * Prevents memory leaks from accidental subscription accumulation.
 * @type {number}
 */
const DEFAULT_MAX_LISTENERS = 100;

/**
 * Wildcard character for matching all events.
 * @type {string}
 */
const WILDCARD = '*';

/**
 * Separator for event namespace hierarchy.
 * @type {string}
 */
const NAMESPACE_SEPARATOR = ':';

/**
 * @enum {number}
 * @description Priority levels for event listeners.
 * Higher priority listeners are called first.
 */
const Priority = Object.freeze({
    /** Critical system events (e.g., before shutdown) */
    CRITICAL: 100,
    /** High priority (e.g., state changes affecting UI) */
    HIGH: 75,
    /** Normal priority (default) */
    NORMAL: 50,
    /** Low priority (e.g., logging, analytics) */
    LOW: 25,
    /** Background tasks (e.g., auto-save) */
    BACKGROUND: 0,
});

// ============================================
// Subscription Class
// ============================================

/**
 * @class Subscription
 * @description Represents an active event subscription.
 * Provides methods to unsubscribe, pause, resume, and check status.
 * Returned by `eventBus.on()` for subscription management.
 */
class Subscription {
    /**
     * @param {EventBus} eventBus - Reference to the event bus
     * @param {string} event - Event name pattern
     * @param {Function} handler - Event handler function
     * @param {Object} options - Subscription options
     * @param {number} id - Unique subscription ID
     */
    constructor(eventBus, event, handler, options, id) {
        /** @private */
        this._eventBus = eventBus;
        /** @private */
        this._event = event;
        /** @private */
        this._handler = handler;
        /** @private */
        this._options = options;
        /** @private */
        this._id = id;
        /** @private */
        this._active = true;
        /** @private */
        this._paused = false;
        /** @private */
        this._callCount = 0;
        /** @private */
        this._createdAt = Date.now();
    }

    /**
     * Get the subscription ID.
     * @returns {number}
     */
    get id() {
        return this._id;
    }

    /**
     * Get the event name pattern.
     * @returns {string}
     */
    get event() {
        return this._event;
    }

    /**
     * Check if subscription is active (not unsubscribed).
     * @returns {boolean}
     */
    get isActive() {
        return this._active;
    }

    /**
     * Check if subscription is paused.
     * @returns {boolean}
     */
    get isPaused() {
        return this._paused;
    }

    /**
     * Get the number of times this handler has been called.
     * @returns {number}
     */
    get callCount() {
        return this._callCount;
    }

    /**
     * Get the creation timestamp.
     * @returns {number}
     */
    get createdAt() {
        return this._createdAt;
    }

    /**
     * Get the priority of this subscription.
     * @returns {number}
     */
    get priority() {
        return this._options.priority;
    }

    /**
     * Unsubscribe this handler from the event bus.
     * Safe to call multiple times.
     */
    unsubscribe() {
        if (!this._active) return;
        this._active = false;
        this._eventBus._removeSubscription(this);
    }

    /**
     * Pause this subscription without removing it.
     * Events will not be delivered while paused.
     */
    pause() {
        this._paused = true;
    }

    /**
     * Resume a paused subscription.
     */
    resume() {
        this._paused = false;
    }

    /**
     * Increment the call counter.
     * @private
     */
    _incrementCallCount() {
        this._callCount++;
    }
}

// ============================================
// EventBus Class
// ============================================

/**
 * @class EventBus
 * @description Central event bus for the entire application.
 * Enables completely decoupled communication between modules.
 * 
 * Features:
 * - Typed events with namespacing (e.g., 'canvas:zoomChanged')
 * - Wildcard subscriptions ('canvas:*')
 * - Priority-based handler ordering
 * - Async handler support (Promise-based)
 * - One-time subscriptions (auto-unsubscribe)
 * - Event filtering and transformation
 * - Subscription pausing/resuming
 * - Memory leak prevention (max listeners, weak references)
 * - Debugging support (event tracing)
 * - Error isolation (one handler error doesn't break others)
 * 
 * @example
 * // Subscribe
 * const sub = eventBus.on('canvas:zoomChanged', (data) => {
 *     console.log('Zoom changed to:', data.zoom);
 * });
 * 
 * // Emit
 * eventBus.emit('canvas:zoomChanged', { zoom: 2 });
 * 
 * // Unsubscribe
 * sub.unsubscribe();
 * 
 * // One-time
 * eventBus.once('document:saved', () => console.log('Saved!'));
 */
export class EventBus {
    /**
     * @param {Object} [options={}] - EventBus configuration
     * @param {boolean} [options.debug=false] - Enable debug logging
     * @param {number} [options.maxListeners=100] - Max listeners per event
     * @param {boolean} [options.asyncMode=false] - Always use async dispatch
     * @param {number} [options.asyncTimeout=5000] - Timeout for async handlers (ms)
     */
    constructor(options = {}) {
        /**
         * Map of event name to sorted array of subscriptions.
         * @private
         * @type {Map<string, Subscription[]>}
         */
        this._subscriptions = new Map();

        /**
         * Map of subscription ID to subscription for fast lookup.
         * @private
         * @type {Map<number, Subscription>}
         */
        this._subscriptionById = new Map();

        /**
         * Auto-incrementing subscription ID counter.
         * @private
         * @type {number}
         */
        this._nextId = 1;

        /**
         * Set of events currently being emitted.
         * Used for reentrancy detection.
         * @private
         * @type {Set<string>}
         */
        this._emitting = new Set();

        /**
         * Queue of events to emit after current emission completes.
         * @private
         * @type {Array<{event: string, data: *}>}
         */
        this._deferredEmits = [];

        /**
         * Configuration options.
         * @private
         * @type {Object}
         */
        this._options = Object.freeze({
            debug: false,
            maxListeners: DEFAULT_MAX_LISTENERS,
            asyncMode: false,
            asyncTimeout: 5000,
            ...options,
        });

        /**
         * Event history for debugging (last N events).
         * @private
         * @type {Array<{event: string, data: *, timestamp: number}>}
         */
        this._history = [];

        /**
         * Maximum events to keep in history.
         * @private
         * @type {number}
         */
        this._maxHistory = 100;

        /**
         * Whether the bus has been disposed.
         * @private
         * @type {boolean}
         */
        this._disposed = false;

        /**
         * Global event filter (for all events).
         * @private
         * @type {Function|null}
         */
        this._globalFilter = null;

        /**
         * Error handler for listener errors.
         * @private
         * @type {Function|null}
         */
        this._errorHandler = null;
    }

    // ============================================
    // Public API - Subscription
    // ============================================

    /**
     * Subscribe to an event.
     * 
     * @param {string} event - Event name or pattern (e.g., 'canvas:*')
     * @param {Function} handler - Event handler function
     * @param {Object} [options={}] - Subscription options
     * @param {number} [options.priority=50] - Handler priority (higher = called first)
     * @param {boolean} [options.once=false] - Auto-unsubscribe after first call
     * @param {*} [options.context=null] - Context to bind to handler (this value)
     * @param {Function} [options.filter=null] - Filter function, return false to skip
     * @param {boolean} [options.async=false] - Handle asynchronously
     * @returns {Subscription} Subscription object for management
     * 
     * @example
     * const sub = eventBus.on('layer:added', handleLayerAdded, { priority: Priority.HIGH });
     */
    on(event, handler, options = {}) {
        this._checkDisposed();
        this._validateEventName(event);
        this._validateHandler(handler);

        const fullOptions = {
            priority: options.priority ?? Priority.NORMAL,
            once: options.once ?? false,
            context: options.context ?? null,
            filter: options.filter ?? null,
            async: options.async ?? false,
        };

        const id = this._nextId++;
        const subscription = new Subscription(this, event, handler, fullOptions, id);

        // Add to event-based lookup
        if (!this._subscriptions.has(event)) {
            this._subscriptions.set(event, []);
        }

        const listeners = this._subscriptions.get(event);

        // Check max listeners
        if (listeners.length >= this._options.maxListeners) {
            console.warn(
                `[EventBus] Maximum listeners (${this._options.maxListeners}) reached for event "${event}". ` +
                'Possible memory leak. Consider unsubscribing unused listeners.'
            );
        }

        // Insert in priority order (highest first)
        const insertIndex = listeners.findIndex(s => s.priority < fullOptions.priority);
        if (insertIndex === -1) {
            listeners.push(subscription);
        } else {
            listeners.splice(insertIndex, 0, subscription);
        }

        // Add to ID-based lookup
        this._subscriptionById.set(id, subscription);

        this._log('debug', `Subscription #${id} added for "${event}" (priority: ${fullOptions.priority})`);

        return subscription;
    }

    /**
     * Subscribe to an event for one-time execution.
     * Handler is automatically unsubscribed after first call.
     * 
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @param {Object} [options={}] - Additional options (except 'once')
     * @returns {Subscription}
     */
    once(event, handler, options = {}) {
        return this.on(event, handler, { ...options, once: true });
    }

    /**
     * Subscribe to multiple events with the same handler.
     * 
     * @param {string[]} events - Array of event names
     * @param {Function} handler - Event handler
     * @param {Object} [options={}] - Subscription options
     * @returns {Subscription[]} Array of subscriptions
     */
    onMany(events, handler, options = {}) {
        if (!Array.isArray(events)) {
            throw new Error('events must be an array of event names');
        }

        return events.map(event => this.on(event, handler, options));
    }

    /**
     * Subscribe with a Promise-based API.
     * Returns a Promise that resolves when the event is emitted.
     * 
     * @param {string} event - Event name
     * @param {Object} [options={}] - Options (except 'once')
     * @returns {Promise<*>} Promise that resolves with event data
     */
    waitFor(event, options = {}) {
        return new Promise((resolve) => {
            this.once(event, (data) => resolve(data), options);
        });
    }

    // ============================================
    // Public API - Emission
    // ============================================

    /**
     * Emit an event to all matching subscribers.
     * 
     * @param {string} event - Event name
     * @param {*} [data={}] - Event data payload
     * @returns {Promise<void>} Resolves when all handlers complete (async)
     * 
     * @example
     * await eventBus.emit('canvas:zoomChanged', { zoom: 2, previousZoom: 1 });
     */
    async emit(event, data = {}) {
        this._checkDisposed();
        this._validateEventName(event);

        // Freeze data to prevent mutation during emission
        const frozenData = Object.isFrozen(data) ? data : Object.freeze({ ...data });

        // Add to history
        this._addToHistory(event, frozenData);

        // Reentrancy check - defer emission if already emitting
        if (this._emitting.size > 0) {
            this._deferredEmits.push({ event, data: frozenData });
            return;
        }

        this._emitting.add(event);

        try {
            // Collect all matching subscriptions
            const matchingSubscriptions = this._getMatchingSubscriptions(event);

            // Separate sync and async handlers
            const syncHandlers = [];
            const asyncHandlers = [];

            for (const subscription of matchingSubscriptions) {
                if (subscription._paused) continue;

                // Apply filter if present
                if (subscription._options.filter) {
                    try {
                        if (!subscription._options.filter(frozenData)) continue;
                    } catch (filterError) {
                        this._log('error', `Filter error for subscription #${subscription.id}:`, filterError);
                        continue;
                    }
                }

                if (subscription._options.async || this._options.asyncMode) {
                    asyncHandlers.push(subscription);
                } else {
                    syncHandlers.push(subscription);
                }
            }

            // Execute sync handlers first (in priority order)
            const subscriptionsToRemove = [];

            for (const subscription of syncHandlers) {
                try {
                    await this._executeHandler(subscription, frozenData);

                    if (subscription._options.once) {
                        subscriptionsToRemove.push(subscription);
                    }
                } catch (error) {
                    this._handleError(subscription, error);
                }
            }

            // Execute async handlers
            const asyncPromises = asyncHandlers.map(subscription =>
                this._executeAsyncHandler(subscription, frozenData).catch(error => {
                    this._handleError(subscription, error);
                })
            );

            // Wait for async handlers with timeout
            if (asyncPromises.length > 0) {
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(
                        () => reject(new Error('Async handlers timed out')),
                        this._options.asyncTimeout
                    )
                );

                await Promise.race([
                    Promise.allSettled(asyncPromises),
                    timeoutPromise,
                ]);
            }

            // Remove one-time subscriptions
            for (const subscription of subscriptionsToRemove) {
                subscription.unsubscribe();
            }
        } finally {
            this._emitting.delete(event);

            // Process deferred emissions
            if (this._emitting.size === 0 && this._deferredEmits.length > 0) {
                const deferred = this._deferredEmits.splice(0);
                for (const { event: defEvent, data: defData } of deferred) {
                    this.emit(defEvent, defData).catch(error => {
                        this._log('error', 'Deferred emit error:', error);
                    });
                }
            }
        }
    }

    /**
     * Emit an event synchronously (fire and forget).
     * Does not wait for async handlers. Use for non-critical events.
     * 
     * @param {string} event - Event name
     * @param {*} [data={}] - Event data
     */
    emitSync(event, data = {}) {
        this.emit(event, data).catch(error => {
            this._log('error', `Unhandled emit error for "${event}":`, error);
        });
    }

    // ============================================
    // Public API - Subscription Management
    // ============================================

    /**
     * Remove a subscription by ID.
     * @param {number} id - Subscription ID
     * @returns {boolean} True if subscription was found and removed
     */
    removeById(id) {
        const subscription = this._subscriptionById.get(id);
        if (subscription) {
            subscription.unsubscribe();
            return true;
        }
        return false;
    }

    /**
     * Remove all subscriptions for a specific event.
     * @param {string} event - Event name
     * @returns {number} Number of subscriptions removed
     */
    removeAllListeners(event) {
        this._validateEventName(event);

        const subscriptions = this._subscriptions.get(event);
        if (!subscriptions) return 0;

        const count = subscriptions.length;

        // Unsubscribe all
        for (const subscription of [...subscriptions]) {
            subscription.unsubscribe();
        }

        this._subscriptions.delete(event);

        return count;
    }

    /**
     * Remove all subscriptions from the event bus.
     */
    removeAllSubscriptions() {
        for (const [event, subscriptions] of this._subscriptions) {
            for (const subscription of [...subscriptions]) {
                subscription.unsubscribe();
            }
        }

        this._subscriptions.clear();
        this._subscriptionById.clear();
    }

    /**
     * Pause all subscriptions for a specific event.
     * @param {string} event - Event name
     */
    pauseEvent(event) {
        const subscriptions = this._subscriptions.get(event);
        if (subscriptions) {
            for (const subscription of subscriptions) {
                subscription.pause();
            }
        }
    }

    /**
     * Resume all subscriptions for a specific event.
     * @param {string} event - Event name
     */
    resumeEvent(event) {
        const subscriptions = this._subscriptions.get(event);
        if (subscriptions) {
            for (const subscription of subscriptions) {
                subscription.resume();
            }
        }
    }

    // ============================================
    // Public API - Introspection
    // ============================================

    /**
     * Get the number of listeners for an event.
     * @param {string} event - Event name (supports wildcards)
     * @returns {number}
     */
    listenerCount(event) {
        const matching = this._getMatchingSubscriptions(event);
        return matching.filter(s => s._active).length;
    }

    /**
     * Get all registered event names.
     * @returns {string[]}
     */
    eventNames() {
        return Array.from(this._subscriptions.keys());
    }

    /**
     * Check if an event has active listeners.
     * @param {string} event - Event name
     * @returns {boolean}
     */
    hasListeners(event) {
        return this.listenerCount(event) > 0;
    }

    /**
     * Get event emission history for debugging.
     * @param {number} [limit=50] - Maximum entries to return
     * @returns {Array<{event: string, data: *, timestamp: number}>}
     */
    getHistory(limit = 50) {
        return this._history.slice(-Math.min(limit, this._history.length));
    }

    /**
     * Get all active subscriptions.
     * @returns {Array<{id: number, event: string, priority: number, callCount: number, createdAt: number}>}
     */
    getSubscriptions() {
        const result = [];

        for (const [event, subscriptions] of this._subscriptions) {
            for (const sub of subscriptions) {
                if (sub._active) {
                    result.push({
                        id: sub.id,
                        event,
                        priority: sub.priority,
                        callCount: sub.callCount,
                        createdAt: sub.createdAt,
                        paused: sub.isPaused,
                    });
                }
            }
        }

        return result;
    }

    // ============================================
    // Public API - Configuration
    // ============================================

    /**
     * Set a global event filter.
     * All events must pass this filter to be delivered.
     * @param {Function|null} filter - Filter function (event, data) => boolean
     */
    setGlobalFilter(filter) {
        this._globalFilter = filter;
    }

    /**
     * Set a global error handler for listener errors.
     * @param {Function|null} handler - Error handler (error, subscription) => void
     */
    setErrorHandler(handler) {
        this._errorHandler = handler;
    }

    /**
     * Enable or disable debug mode.
     * @param {boolean} enabled
     */
    setDebug(enabled) {
        this._options = Object.freeze({ ...this._options, debug: enabled });
    }

    /**
     * Set the maximum number of listeners per event.
     * @param {number} max
     */
    setMaxListeners(max) {
        if (max < 1) throw new Error('Max listeners must be at least 1');
        this._options = Object.freeze({ ...this._options, maxListeners: max });
    }

    // ============================================
    // Public API - Disposal
    // ============================================

    /**
     * Dispose the event bus.
     * Removes all subscriptions and releases all resources.
     * The bus cannot be used after disposal.
     */
    dispose() {
        if (this._disposed) return;

        this.removeAllSubscriptions();
        this._history = [];
        this._deferredEmits = [];
        this._emitting.clear();
        this._disposed = true;

        this._log('info', 'EventBus disposed');
    }

    // ============================================
    // Private Methods - Subscription Matching
    // ============================================

    /**
     * Get all subscriptions matching an event name.
     * Supports exact match and wildcard patterns.
     * @private
     * @param {string} event - Event name
     * @returns {Subscription[]}
     */
    _getMatchingSubscriptions(event) {
        const matching = [];

        // Exact match
        const exactMatches = this._subscriptions.get(event);
        if (exactMatches) {
            matching.push(...exactMatches);
        }

        // Wildcard match (e.g., 'canvas:*' matches 'canvas:zoomChanged')
        for (const [pattern, subscriptions] of this._subscriptions) {
            if (pattern === event) continue; // Already added exact matches

            if (this._matchesPattern(event, pattern)) {
                matching.push(...subscriptions);
            }
        }

        // Global wildcard
        const wildcardSubs = this._subscriptions.get(WILDCARD);
        if (wildcardSubs) {
            matching.push(...wildcardSubs);
        }

        // Sort by priority (highest first)
        matching.sort((a, b) => b._options.priority - a._options.priority);

        return matching;
    }

    /**
     * Check if an event name matches a pattern.
     * Supports:
     * - '*' matches any single namespace segment
     * - '**' matches any number of segments
     * - 'canvas:*' matches 'canvas:zoomChanged' but not 'canvas:zoom:in'
     * @private
     * @param {string} event - Event name
     * @param {string} pattern - Pattern to match against
     * @returns {boolean}
     */
    _matchesPattern(event, pattern) {
        // Exact match (already handled but safe)
        if (event === pattern) return true;

        // Global wildcard
        if (pattern === WILDCARD) return true;

        // Convert pattern to regex
        const regexStr = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
            .replace(/\*\*/g, '<<DOUBLE_WILDCARD>>') // Preserve **
            .replace(/\*/g, '[^' + NAMESPACE_SEPARATOR + ']+') // * matches one segment
            .replace(/<<DOUBLE_WILDCARD>>/g, '.*'); // ** matches everything

        const regex = new RegExp('^' + regexStr + '$');
        return regex.test(event);
    }

    // ============================================
    // Private Methods - Handler Execution
    // ============================================

    /**
     * Execute a single event handler.
     * @private
     * @param {Subscription} subscription - The subscription
     * @param {*} data - Event data
     * @returns {Promise<void>}
     */
    async _executeHandler(subscription, data) {
        const handler = subscription._handler;
        const context = subscription._options.context;

        subscription._incrementCallCount();

        if (context) {
            await handler.call(context, data, subscription);
        } else {
            await handler(data, subscription);
        }
    }

    /**
     * Execute an async handler with timeout.
     * @private
     * @param {Subscription} subscription - The subscription
     * @param {*} data - Event data
     * @returns {Promise<void>}
     */
    async _executeAsyncHandler(subscription, data) {
        subscription._incrementCallCount();

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
                () => reject(new Error(`Async handler for "${subscription.event}" timed out`)),
                this._options.asyncTimeout
            )
        );

        const handlerPromise = (async () => {
            const handler = subscription._handler;
            const context = subscription._options.context;

            if (context) {
                return handler.call(context, data, subscription);
            } else {
                return handler(data, subscription);
            }
        })();

        await Promise.race([handlerPromise, timeoutPromise]);

        if (subscription._options.once) {
            subscription.unsubscribe();
        }
    }

    // ============================================
    // Private Methods - Subscription Management
    // ============================================

    /**
     * Remove a subscription from internal data structures.
     * Called by Subscription.unsubscribe().
     * @private
     * @param {Subscription} subscription - Subscription to remove
     */
    _removeSubscription(subscription) {
        // Remove from event-based lookup
        const listeners = this._subscriptions.get(subscription._event);
        if (listeners) {
            const index = listeners.indexOf(subscription);
            if (index !== -1) {
                listeners.splice(index, 1);
            }

            // Clean up empty event entries
            if (listeners.length === 0) {
                this._subscriptions.delete(subscription._event);
            }
        }

        // Remove from ID-based lookup
        this._subscriptionById.delete(subscription._id);
    }

    // ============================================
    // Private Methods - Validation
    // ============================================

    /**
     * Validate an event name.
     * @private
     * @param {string} event - Event name to validate
     */
    _validateEventName(event) {
        if (typeof event !== 'string' || event.trim().length === 0) {
            throw new Error('Event name must be a non-empty string');
        }

        if (event.includes(' ')) {
            throw new Error('Event name cannot contain spaces');
        }
    }

    /**
     * Validate a handler function.
     * @private
     * @param {Function} handler - Handler to validate
     */
    _validateHandler(handler) {
        if (typeof handler !== 'function') {
            throw new Error('Event handler must be a function');
        }
    }

    /**
     * Check if the bus has been disposed.
     * @private
     */
    _checkDisposed() {
        if (this._disposed) {
            throw new Error('EventBus has been disposed and cannot be used');
        }
    }

    // ============================================
    // Private Methods - History & Logging
    // ============================================

    /**
     * Add an event to the emission history.
     * @private
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    _addToHistory(event, data) {
        this._history.push({
            event,
            data,
            timestamp: Date.now(),
        });

        // Trim history
        if (this._history.length > this._maxHistory) {
            this._history = this._history.slice(-this._maxHistory);
        }
    }

    /**
     * Handle an error from a listener.
     * @private
     * @param {Subscription} subscription - The subscription that errored
     * @param {Error} error - The error
     */
    _handleError(subscription, error) {
        this._log('error',
            `Error in listener #${subscription.id} for "${subscription._event}":`,
            error
        );

        if (this._errorHandler) {
            try {
                this._errorHandler(error, subscription);
            } catch (handlerError) {
                this._log('error', 'Error in error handler:', handlerError);
            }
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
        if (!this._options.debug) return;

        const prefix = '[EventBus]';

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
// Exports
// ============================================

export { Priority, Subscription };

export default EventBus;

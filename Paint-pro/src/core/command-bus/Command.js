// ============================================
// Paint Pro - Professional Web Graphics Application
// src/core/command-bus/Command.js
// Base Command Interface & Abstract Class
// ============================================

/**
 * @module core/command-bus/Command
 * @description Defines the Command pattern contracts for all editing operations.
 * Every user action is encapsulated as a Command, enabling:
 * - Unlimited undo/redo
 * - Transaction grouping
 * - Command merging (e.g., consecutive brush strokes)
 * - Memory-efficient state management
 * - Serialization for collaborative editing
 * - Macro recording and playback
 * 
 * Design Principles:
 * - Commands are immutable once created
 * - Commands own their own state for undo
 * - Commands can be serialized/deserialized
 * - Commands are self-contained (no external references needed for undo)
 * - Commands implement IDisposable for cleanup
 */

// ============================================
// Command State Constants
// ============================================

/**
 * @enum {string}
 * @description Possible states of a command during its lifecycle.
 */
export const CommandState = Object.freeze({
    /** Command created but not yet executed */
    PENDING: 'pending',
    
    /** Command successfully executed */
    EXECUTED: 'executed',
    
    /** Command has been undone */
    UNDONE: 'undone',
    
    /** Command has been redone after undo */
    REDONE: 'redone',
    
    /** Command execution failed */
    FAILED: 'failed',
    
    /** Command has been merged into another command */
    MERGED: 'merged',
    
    /** Command has been disposed */
    DISPOSED: 'disposed',
});

// ============================================
// Command Type Categories
// ============================================

/**
 * @enum {string}
 * @description Categories of commands for organization and filtering.
 */
export const CommandCategory = Object.freeze({
    /** Drawing operations (brush strokes, pencil, eraser) */
    DRAWING: 'drawing',
    
    /** Shape operations (rectangles, circles, lines) */
    SHAPE: 'shape',
    
    /** Text operations (create, edit, format) */
    TEXT: 'text',
    
    /** Fill operations (flood fill, gradient, pattern) */
    FILL: 'fill',
    
    /** Transform operations (move, resize, rotate, flip) */
    TRANSFORM: 'transform',
    
    /** Selection operations (select, deselect, modify) */
    SELECTION: 'selection',
    
    /** Layer operations (add, delete, reorder, merge) */
    LAYER: 'layer',
    
    /** Filter operations (blur, sharpen, color adjustment) */
    FILTER: 'filter',
    
    /** Image operations (import, place, crop) */
    IMAGE: 'image',
    
    /** Canvas operations (resize, rotate canvas) */
    CANVAS: 'canvas',
    
    /** Clipboard operations (copy, paste, cut) */
    CLIPBOARD: 'clipboard',
    
    /** Composite operation (contains multiple sub-commands) */
    COMPOSITE: 'composite',
    
    /** Other/uncategorized */
    OTHER: 'other',
});

// ============================================
// Command Interface (Protocol)
// ============================================

/**
 * @interface ICommand
 * @description Protocol that all commands must implement.
 * 
 * Lifecycle:
 * 1. Construction: Command is created with all data needed for execution
 * 2. execute(): Perform the operation, store state needed for undo
 * 3. undo(): Reverse the operation using stored state
 * 4. redo(): Re-execute (may be optimized if command stored result state)
 * 5. dispose(): Release all resources
 * 
 * Merging:
 * Commands of the same type executed in quick succession can be merged
 * to prevent history bloat. Example: 100 brush strokes in 2 seconds
 * merge into a single DrawStrokeCommand.
 */
export class ICommand {
    /**
     * Execute the command.
     * Must be idempotent if already executed.
     * @returns {Promise<void>}
     */
    async execute() {
        throw new Error('ICommand.execute() must be implemented');
    }

    /**
     * Undo the command.
     * Reverses all changes made by execute().
     * Must restore state exactly as it was before execution.
     * @returns {Promise<void>}
     */
    async undo() {
        throw new Error('ICommand.undo() must be implemented');
    }

    /**
     * Redo the command.
     * Re-applies the command after it was undone.
     * May be more efficient than execute() since state is already known.
     * @returns {Promise<void>}
     */
    async redo() {
        throw new Error('ICommand.redo() must be implemented');
    }

    /**
     * Check if this command can be merged with another command.
     * Used to combine consecutive similar operations into one history entry.
     * 
     * @param {ICommand} other - The next command to potentially merge with
     * @returns {boolean} True if commands can be merged
     * 
     * @example
     * // Two brush strokes within 500ms of each other can be merged
     * canMerge(other) {
     *     return other instanceof DrawStrokeCommand
     *         && other.timestamp - this.timestamp < 500;
     * }
     */
    canMerge(other) {
        return false;
    }

    /**
     * Merge another command into this one.
     * Called only if canMerge() returned true.
     * The other command will not be added to history separately.
     * 
     * @param {ICommand} other - Command to merge into this one
     * @returns {Promise<void>}
     */
    async merge(other) {
        throw new Error('ICommand.merge() must be implemented if canMerge() returns true');
    }

    /**
     * Dispose the command and release all resources.
     * Called when the command is removed from history.
     * Must be idempotent (safe to call multiple times).
     * @returns {void}
     */
    dispose() {
        throw new Error('ICommand.dispose() must be implemented');
    }

    /**
     * Get the command type identifier.
     * @returns {string}
     */
    get type() {
        throw new Error('ICommand.type getter must be implemented');
    }

    /**
     * Get the command category.
     * @returns {string}
     */
    get category() {
        throw new Error('ICommand.category getter must be implemented');
    }

    /**
     * Get the current state of the command.
     * @returns {string}
     */
    get state() {
        throw new Error('ICommand.state getter must be implemented');
    }

    /**
     * Get the timestamp when the command was created.
     * @returns {number}
     */
    get timestamp() {
        throw new Error('ICommand.timestamp getter must be implemented');
    }

    /**
     * Get a human-readable description of the command.
     * Used for history panel display.
     * @returns {string}
     */
    get description() {
        throw new Error('ICommand.description getter must be implemented');
    }

    /**
     * Get the estimated memory usage of this command in bytes.
     * Used for memory management and history compression.
     * @returns {number}
     */
    get memoryUsage() {
        throw new Error('ICommand.memoryUsage getter must be implemented');
    }

    /**
     * Serialize the command to a plain object for storage/transmission.
     * Must include all data needed to reconstruct the command.
     * @returns {Object}
     */
    serialize() {
        throw new Error('ICommand.serialize() must be implemented');
    }
}

// ============================================
// Base Command Abstract Class
// ============================================

/**
 * @abstract
 * @class BaseCommand
 * @description Abstract base class implementing common command functionality.
 * All concrete commands should extend this class.
 * Provides default implementations for state management, timestamps,
 * descriptions, and validation.
 * 
 * @implements {ICommand}
 * 
 * @example
 * class DrawStrokeCommand extends BaseCommand {
 *     constructor(layerId, points, brushSettings) {
 *         super('drawStroke', CommandCategory.DRAWING);
 *         this._layerId = layerId;
 *         this._points = points;
 *         this._brushSettings = brushSettings;
 *     }
 * }
 */
export class BaseCommand {
    /**
     * @param {string} type - Command type identifier (unique per command class)
     * @param {string} category - Command category from CommandCategory
     * @param {Object} [options={}] - Additional options
     * @param {string} [options.description] - Human-readable description
     * @param {Object} [options.metadata] - Additional metadata for the command
     */
    constructor(type, category, options = {}) {
        /**
         * Command type identifier.
         * @protected
         * @type {string}
         */
        this._type = type;

        /**
         * Command category.
         * @protected
         * @type {string}
         */
        this._category = category;

        /**
         * Current state of the command.
         * @protected
         * @type {string}
         */
        this._state = CommandState.PENDING;

        /**
         * Timestamp when the command was created.
         * @protected
         * @type {number}
         */
        this._timestamp = Date.now();

        /**
         * Human-readable description.
         * @protected
         * @type {string}
         */
        this._description = options.description || this._generateDefaultDescription();

        /**
         * Additional metadata.
         * @protected
         * @type {Object}
         */
        this._metadata = Object.freeze({ ...options.metadata });

        /**
         * Whether the command has been disposed.
         * @protected
         * @type {boolean}
         */
        this._disposed = false;

        /**
         * Unique command ID for tracking.
         * @protected
         * @type {string}
         */
        this._id = BaseCommand._generateId();
    }

    // ============================================
    // Getters
    // ============================================

    /** @returns {string} */
    get type() {
        return this._type;
    }

    /** @returns {string} */
    get category() {
        return this._category;
    }

    /** @returns {string} */
    get state() {
        return this._state;
    }

    /** @returns {number} */
    get timestamp() {
        return this._timestamp;
    }

    /** @returns {string} */
    get description() {
        return this._description;
    }

    /** @returns {string} */
    get id() {
        return this._id;
    }

    /** @returns {Object} */
    get metadata() {
        return this._metadata;
    }

    /** @returns {boolean} */
    get isDisposed() {
        return this._disposed;
    }

    /**
     * Get estimated memory usage in bytes.
     * Default implementation returns 0. Override in subclasses.
     * @returns {number}
     */
    get memoryUsage() {
        return 0;
    }

    // ============================================
    // Public Methods - Lifecycle
    // ============================================

    /**
     * Execute the command.
     * Validates state before execution.
     * @returns {Promise<void>}
     */
    async execute() {
        this._validateNotDisposed();

        if (this._state === CommandState.EXECUTED || this._state === CommandState.REDONE) {
            // Already executed, skip
            return;
        }

        try {
            await this._execute();
            this._state = CommandState.EXECUTED;
        } catch (error) {
            this._state = CommandState.FAILED;
            throw error;
        }
    }

    /**
     * Undo the command.
     * Validates state before undoing.
     * @returns {Promise<void>}
     */
    async undo() {
        this._validateNotDisposed();

        if (this._state === CommandState.UNDONE) {
            // Already undone
            return;
        }

        if (this._state !== CommandState.EXECUTED && this._state !== CommandState.REDONE) {
            throw new Error(
                `Cannot undo command in "${this._state}" state. ` +
                `Command must be in "executed" or "redone" state to undo.`
            );
        }

        try {
            await this._undo();
            this._state = CommandState.UNDONE;
        } catch (error) {
            this._state = CommandState.FAILED;
            throw error;
        }
    }

    /**
     * Redo the command.
     * Validates state before redoing.
     * @returns {Promise<void>}
     */
    async redo() {
        this._validateNotDisposed();

        if (this._state !== CommandState.UNDONE) {
            throw new Error(
                `Cannot redo command in "${this._state}" state. ` +
                `Command must be in "undone" state to redo.`
            );
        }

        try {
            await this._redo();
            this._state = CommandState.REDONE;
        } catch (error) {
            this._state = CommandState.FAILED;
            throw error;
        }
    }

    /**
     * Check if this command can be merged with another.
     * Default implementation returns false.
     * @param {ICommand} other - The next command
     * @returns {boolean}
     */
    canMerge(other) {
        return false;
    }

    /**
     * Merge another command into this one.
     * Default implementation throws (override if canMerge returns true).
     * @param {ICommand} other - Command to merge
     * @returns {Promise<void>}
     */
    async merge(other) {
        throw new Error(
            `${this.constructor.name} does not support merging. ` +
            `Override canMerge() and merge() to enable merging.`
        );
    }

    /**
     * Dispose the command and release all resources.
     * Idempotent - safe to call multiple times.
     * @returns {void}
     */
    dispose() {
        if (this._disposed) return;

        this._disposed = true;
        this._state = CommandState.DISPOSED;

        this._dispose();
    }

    // ============================================
    // Serialization
    // ============================================

    /**
     * Serialize the command to a plain object.
     * @returns {Object}
     */
    serialize() {
        return {
            type: this._type,
            category: this._category,
            id: this._id,
            timestamp: this._timestamp,
            description: this._description,
            metadata: { ...this._metadata },
            state: this._state,
        };
    }

    /**
     * Create a human-readable string representation.
     * @returns {string}
     */
    toString() {
        return `[${this.constructor.name}] ${this._description} (${this._state})`;
    }

    // ============================================
    // Protected Methods - Override in Subclasses
    // ============================================

    /**
     * Perform the actual execution logic.
     * Override in subclasses.
     * @protected
     * @returns {Promise<void>}
     */
    async _execute() {
        throw new Error(`${this.constructor.name}._execute() must be implemented`);
    }

    /**
     * Perform the actual undo logic.
     * Override in subclasses.
     * @protected
     * @returns {Promise<void>}
     */
    async _undo() {
        throw new Error(`${this.constructor.name}._undo() must be implemented`);
    }

    /**
     * Perform the actual redo logic.
     * Default implementation calls _execute().
     * Override if redo can be optimized differently.
     * @protected
     * @returns {Promise<void>}
     */
    async _redo() {
        await this._execute();
    }

    /**
     * Release resources held by the command.
     * Override in subclasses to clean up canvases, image data, etc.
     * @protected
     * @returns {void}
     */
    _dispose() {
        // Default: nothing to clean up
    }

    // ============================================
    // Protected Methods - State Management
    // ============================================

    /**
     * Update the command description.
     * @protected
     * @param {string} description - New description
     */
    _setDescription(description) {
        this._description = description;
    }

    /**
     * Update the command state.
     * @protected
     * @param {string} state - New state
     */
    _setState(state) {
        if (!Object.values(CommandState).includes(state)) {
            throw new Error(`Invalid command state: ${state}`);
        }
        this._state = state;
    }

    // ============================================
    // Protected Methods - Validation
    // ============================================

    /**
     * Validate that the command has not been disposed.
     * @protected
     * @throws {Error} If the command is disposed
     */
    _validateNotDisposed() {
        if (this._disposed) {
            throw new Error(
                `Cannot operate on disposed command: ${this.constructor.name}`
            );
        }
    }

    /**
     * Validate that the command is in a specific state.
     * @protected
     * @param {string} expectedState - Expected state
     * @throws {Error} If the command is not in the expected state
     */
    _validateState(expectedState) {
        if (this._state !== expectedState) {
            throw new Error(
                `Expected command state "${expectedState}" but got "${this._state}"`
            );
        }
    }

    // ============================================
    // Private Methods
    // ============================================

    /**
     * Generate a default description from the command type.
     * @private
     * @returns {string}
     */
    _generateDefaultDescription() {
        // Convert camelCase to readable text
        const readable = this._type
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();

        return readable;
    }

    /**
     * Generate a unique command ID.
     * @private
     * @returns {string}
     */
    static _generateId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `cmd_${timestamp}_${random}`;
    }
}

// ============================================
// Composite Command
// ============================================

/**
 * @class CompositeCommand
 * @description A command that contains multiple sub-commands.
 * Executes, undoes, and redoes all sub-commands in order.
 * Useful for transactions and batch operations.
 * 
 * @extends {BaseCommand}
 * 
 * @example
 * const composite = new CompositeCommand([
 *     new AddLayerCommand(),
 *     new DrawStrokeCommand(layerId, points),
 *     new SetLayerOpacityCommand(layerId, 0.5),
 * ]);
 * commandBus.execute(composite); // All three as one undoable operation
 */
export class CompositeCommand extends BaseCommand {
    /**
     * @param {ICommand[]} commands - Array of sub-commands
     * @param {Object} [options={}] - BaseCommand options
     */
    constructor(commands = [], options = {}) {
        super('composite', CommandCategory.COMPOSITE, {
            description: options.description || `Composite (${commands.length} commands)`,
            ...options,
        });

        /**
         * Sub-commands in execution order.
         * @private
         * @type {ICommand[]}
         */
        this._commands = [...commands];

        /**
         * Whether to stop on first error.
         * @private
         * @type {boolean}
         */
        this._stopOnError = options.stopOnError ?? true;
    }

    /**
     * Get the number of sub-commands.
     * @returns {number}
     */
    get count() {
        return this._commands.length;
    }

    /**
     * Get the sub-commands.
     * @returns {ICommand[]}
     */
    get commands() {
        return [...this._commands];
    }

    /** @override */
    get memoryUsage() {
        return this._commands.reduce((total, cmd) => total + (cmd.memoryUsage || 0), 0);
    }

    /**
     * Add a sub-command to the composite.
     * @param {ICommand} command - Command to add
     */
    addCommand(command) {
        this._validateNotDisposed();
        this._commands.push(command);
    }

    /** @override */
    async _execute() {
        const executedCommands = [];

        try {
            for (const command of this._commands) {
                await command.execute();
                executedCommands.push(command);
            }
        } catch (error) {
            if (this._stopOnError) {
                // Roll back executed commands
                for (const command of executedCommands.reverse()) {
                    try {
                        await command.undo();
                    } catch (undoError) {
                        console.error('Error during composite rollback:', undoError);
                    }
                }
                throw error;
            } else {
                // Continue despite error, but re-throw at end
                throw error;
            }
        }
    }

    /** @override */
    async _undo() {
        // Undo in reverse order
        const reversed = [...this._commands].reverse();

        for (const command of reversed) {
            await command.undo();
        }
    }

    /** @override */
    async _redo() {
        // Redo in original order
        for (const command of this._commands) {
            await command.redo();
        }
    }

    /** @override */
    _dispose() {
        for (const command of this._commands) {
            command.dispose();
        }
        this._commands = [];
    }

    /** @override */
    serialize() {
        return {
            ...super.serialize(),
            stopOnError: this._stopOnError,
            commands: this._commands.map(cmd => cmd.serialize()),
        };
    }
}

// ============================================
// Command Factory
// ============================================

/**
 * @namespace CommandFactory
 * @description Factory functions for creating common command types.
 */
export const CommandFactory = {
    /**
     * Create a composite command from an array of commands.
     * @param {ICommand[]} commands - Sub-commands
     * @param {Object} [options] - Options
     * @returns {CompositeCommand}
     */
    composite(commands, options = {}) {
        return new CompositeCommand(commands, options);
    },

    /**
     * Create a no-op command (does nothing).
     * Useful as a placeholder or for testing.
     * @returns {BaseCommand}
     */
    noop() {
        return new (class NoOpCommand extends BaseCommand {
            constructor() {
                super('noop', CommandCategory.OTHER, { description: 'No Operation' });
            }
            async _execute() { /* no-op */ }
            async _undo() { /* no-op */ }
        })();
    },
};

// ============================================
// Exports
// ============================================

export default {
    ICommand,
    BaseCommand,
    CompositeCommand,
    CommandState,
    CommandCategory,
    CommandFactory,
};

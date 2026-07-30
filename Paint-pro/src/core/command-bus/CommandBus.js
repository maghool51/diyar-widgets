// ============================================
// Paint Pro - Professional Web Graphics Application
// src/core/command-bus/CommandBus.js
// Command Execution Engine & History Manager
// ============================================

import { CommandState, CommandCategory, CompositeCommand } from './Command.js';
import { HistoryEvents } from '../event-bus/EventTypes.js';

/**
 * @class CommandBus
 * @description Central command execution engine that manages the complete
 * lifecycle of all editing commands. Provides unlimited undo/redo through
 * a dual-stack history system with intelligent command merging, memory-aware
 * history compression, and transactional support.
 * 
 * Architecture:
 * - undoStack: Commands that have been executed (can be undone)
 * - redoStack: Commands that have been undone (can be redone)
 * - activeTransaction: Currently open transaction (CompositeCommand)
 * 
 * Key Features:
 * - Command merging for consecutive similar operations
 * - Memory-based history compression
 * - Transaction support (group multiple commands as one)
 * - Maximum history size enforcement
 * - Event emission for UI updates
 * - Serialization of entire history state
 * 
 * @example
 * const commandBus = new CommandBus(eventBus, { maxStackSize: 500 });
 * 
 * // Execute a command
 * await commandBus.execute(new DrawStrokeCommand(layerId, points));
 * 
 * // Undo
 * await commandBus.undo();
 * 
 * // Transaction
 * commandBus.beginTransaction('Complex Operation');
 * await commandBus.execute(cmd1);
 * await commandBus.execute(cmd2);
 * await commandBus.execute(cmd3);
 * await commandBus.commitTransaction(); // All three as one undoable unit
 */
export class CommandBus {
    /**
     * @param {EventBus} eventBus - Event bus for emitting history events
     * @param {Object} [options={}] - Configuration options
     * @param {number} [options.maxStackSize=1000] - Maximum commands in undo stack
     * @param {number} [options.maxMemoryMB=100] - Maximum memory for history (MB)
     * @param {number} [options.mergeWindowMs=1000] - Time window for command merging (ms)
     * @param {boolean} [options.debug=false] - Enable debug logging
     */
    constructor(eventBus, options = {}) {
        if (!eventBus) {
            throw new Error('CommandBus requires an EventBus instance');
        }

        /**
         * Event bus for emitting history state changes.
         * @private
         * @type {EventBus}
         */
        this._eventBus = eventBus;

        /**
         * Stack of executed commands (can be undone).
         * @private
         * @type {Array<ICommand>}
         */
        this._undoStack = [];

        /**
         * Stack of undone commands (can be redone).
         * @private
         * @type {Array<ICommand>}
         */
        this._redoStack = [];

        /**
         * Currently active transaction (if any).
         * @private
         * @type {CompositeCommand|null}
         */
        this._activeTransaction = null;

        /**
         * Nested transaction depth counter.
         * @private
         * @type {number}
         */
        this._transactionDepth = 0;

        /**
         * Configuration options.
         * @private
         * @type {Object}
         */
        this._options = Object.freeze({
            maxStackSize: 1000,
            maxMemoryMB: 100,
            mergeWindowMs: 1000,
            debug: false,
            ...options,
        });

        /**
         * Estimated current memory usage in bytes.
         * @private
         * @type {number}
         */
        this._estimatedMemory = 0;

        /**
         * Whether the bus is currently executing a command.
         * Prevents reentrant execution.
         * @private
         * @type {boolean}
         */
        this._isExecuting = false;

        /**
         * Whether the bus has been disposed.
         * @private
         * @type {boolean}
         */
        this._disposed = false;

        /**
         * Bound methods for event handlers.
         * @private
         */
        this._boundHandlers = {};

        this._log('debug', 'CommandBus initialized');
    }

    // ============================================
    // Public API - Execute
    // ============================================

    /**
     * Execute a command and add it to the undo stack.
     * Clears the redo stack (new action invalidates redo history).
     * If a transaction is active, adds the command to the transaction instead.
     * 
     * @param {ICommand} command - The command to execute
     * @returns {Promise<void>}
     * @throws {Error} If command execution fails
     * 
     * @example
     * await commandBus.execute(new DrawStrokeCommand(layerId, points));
     */
    async execute(command) {
        this._validateNotDisposed();

        if (!command || typeof command.execute !== 'function') {
            throw new Error('Invalid command: must implement ICommand interface');
        }

        // If inside a transaction, delegate to transaction
        if (this._activeTransaction) {
            this._log('debug', 'Adding command to active transaction');
            this._activeTransaction.addCommand(command);
            await command.execute();
            return;
        }

        if (this._isExecuting) {
            throw new Error('Cannot execute command while another command is executing');
        }

        this._isExecuting = true;

        try {
            // Execute the command
            await command.execute();

            // Check if we can merge with the last command
            const merged = this._tryMergeWithLast(command);

            if (!merged) {
                // Add to undo stack
                this._undoStack.push(command);
                this._estimatedMemory += command.memoryUsage || 0;

                // Clear redo stack
                this._clearRedoStack();

                // Enforce size limit
                this._enforceStackLimits();

                // Emit event
                this._emitHistoryEvent(HistoryEvents.EXECUTED, { command });
            }

            // Always update state
            this._emitStateChange();
        } catch (error) {
            this._log('error', 'Command execution failed:', error);
            this._emitHistoryEvent(HistoryEvents.EXECUTED, {
                command,
                error: error.message,
            });
            throw error;
        } finally {
            this._isExecuting = false;
        }
    }

    /**
     * Execute multiple commands as a single composite operation.
     * Automatically wraps them in a transaction.
     * 
     * @param {ICommand[]} commands - Array of commands to execute
     * @param {string} [description] - Description for the composite command
     * @returns {Promise<void>}
     */
    async executeBatch(commands, description = 'Batch Operation') {
        if (!Array.isArray(commands) || commands.length === 0) return;

        this.beginTransaction(description);

        try {
            for (const command of commands) {
                await this.execute(command);
            }
            await this.commitTransaction();
        } catch (error) {
            await this.rollbackTransaction();
            throw error;
        }
    }

    // ============================================
    // Public API - Undo / Redo
    // ============================================

    /**
     * Undo the last executed command.
     * Moves it from the undo stack to the redo stack.
     * 
     * @returns {Promise<boolean>} True if an undo was performed
     */
    async undo() {
        this._validateNotDisposed();

        if (this._activeTransaction) {
            throw new Error('Cannot undo while a transaction is active');
        }

        if (this._undoStack.length === 0) {
            return false;
        }

        const command = this._undoStack.pop();
        this._estimatedMemory -= command.memoryUsage || 0;

        try {
            await command.undo();
            this._redoStack.push(command);

            this._emitHistoryEvent(HistoryEvents.UNDO, { command });
            this._emitStateChange();

            return true;
        } catch (error) {
            // Re-add to undo stack on failure
            this._undoStack.push(command);
            this._estimatedMemory += command.memoryUsage || 0;
            this._log('error', 'Undo failed:', error);
            throw error;
        }
    }

    /**
     * Redo the last undone command.
     * Moves it from the redo stack back to the undo stack.
     * 
     * @returns {Promise<boolean>} True if a redo was performed
     */
    async redo() {
        this._validateNotDisposed();

        if (this._activeTransaction) {
            throw new Error('Cannot redo while a transaction is active');
        }

        if (this._redoStack.length === 0) {
            return false;
        }

        const command = this._redoStack.pop();

        try {
            await command.redo();
            this._undoStack.push(command);
            this._estimatedMemory += command.memoryUsage || 0;

            this._enforceStackLimits();

            this._emitHistoryEvent(HistoryEvents.REDO, { command });
            this._emitStateChange();

            return true;
        } catch (error) {
            // Re-add to redo stack on failure
            this._redoStack.push(command);
            this._log('error', 'Redo failed:', error);
            throw error;
        }
    }

    /**
     * Undo multiple commands at once.
     * @param {number} count - Number of commands to undo
     * @returns {Promise<number>} Number of commands actually undone
     */
    async undoMultiple(count = 1) {
        let undone = 0;

        for (let i = 0; i < count; i++) {
            const result = await this.undo();
            if (!result) break;
            undone++;
        }

        return undone;
    }

    /**
     * Redo multiple commands at once.
     * @param {number} count - Number of commands to redo
     * @returns {Promise<number>} Number of commands actually redone
     */
    async redoMultiple(count = 1) {
        let redone = 0;

        for (let i = 0; i < count; i++) {
            const result = await this.redo();
            if (!result) break;
            redone++;
        }

        return redone;
    }

    // ============================================
    // Public API - Transactions
    // ============================================

    /**
     * Begin a transaction.
     * All commands executed between beginTransaction and commitTransaction
     * will be grouped as a single undoable operation.
     * Supports nested transactions.
     * 
     * @param {string} [description='Transaction'] - Description for the composite
     */
    beginTransaction(description = 'Transaction') {
        this._validateNotDisposed();

        this._transactionDepth++;

        if (!this._activeTransaction) {
            this._activeTransaction = new CompositeCommand([], {
                description,
                stopOnError: true,
            });
            this._log('debug', `Transaction started: "${description}"`);
        } else {
            this._log('debug', `Nested transaction (depth: ${this._transactionDepth})`);
        }
    }

    /**
     * Commit the active transaction.
     * The composite command is added to the undo stack as a single unit.
     * 
     * @returns {Promise<void>}
     */
    async commitTransaction() {
        this._validateNotDisposed();

        if (!this._activeTransaction) {
            throw new Error('No active transaction to commit');
        }

        this._transactionDepth--;

        if (this._transactionDepth > 0) {
            this._log('debug', `Nested transaction committed (depth: ${this._transactionDepth})`);
            return;
        }

        const transaction = this._activeTransaction;
        this._activeTransaction = null;

        if (transaction.count === 0) {
            this._log('debug', 'Empty transaction discarded');
            transaction.dispose();
            return;
        }

        // Add composite to undo stack
        this._undoStack.push(transaction);
        this._estimatedMemory += transaction.memoryUsage || 0;

        // Clear redo stack
        this._clearRedoStack();

        // Enforce limits
        this._enforceStackLimits();

        this._emitHistoryEvent(HistoryEvents.TRANSACTION_COMMITTED, {
            command: transaction,
            subCommandCount: transaction.count,
        });
        this._emitStateChange();

        this._log('debug', `Transaction committed: ${transaction.count} commands`);
    }

    /**
     * Rollback the active transaction.
     * All commands in the transaction are undone and discarded.
     * 
     * @returns {Promise<void>}
     */
    async rollbackTransaction() {
        this._validateNotDisposed();

        if (!this._activeTransaction) {
            throw new Error('No active transaction to rollback');
        }

        this._transactionDepth = 0;
        const transaction = this._activeTransaction;
        this._activeTransaction = null;

        if (transaction.count > 0) {
            try {
                // Undo all commands in the transaction
                // CompositeCommand._undo() handles reverse order
                await transaction.undo();
            } catch (error) {
                this._log('error', 'Transaction rollback error:', error);
            }
        }

        transaction.dispose();

        this._emitHistoryEvent(HistoryEvents.TRANSACTION_ROLLED_BACK, {
            subCommandCount: transaction.count,
        });

        this._log('debug', 'Transaction rolled back');
    }

    /**
     * Check if a transaction is currently active.
     * @returns {boolean}
     */
    isTransactionActive() {
        return this._activeTransaction !== null;
    }

    // ============================================
    // Public API - Stack Management
    // ============================================

    /**
     * Clear the entire history (both undo and redo stacks).
     * Disposes all commands.
     */
    clear() {
        this._validateNotDisposed();

        // Dispose all commands
        for (const command of this._undoStack) {
            command.dispose();
        }
        for (const command of this._redoStack) {
            command.dispose();
        }

        // Clear stacks
        this._undoStack = [];
        this._redoStack = [];
        this._estimatedMemory = 0;

        // Clear any active transaction
        if (this._activeTransaction) {
            this._activeTransaction.dispose();
            this._activeTransaction = null;
            this._transactionDepth = 0;
        }

        this._emitHistoryEvent(HistoryEvents.CLEARED, {});
        this._emitStateChange();

        this._log('debug', 'History cleared');
    }

    /**
     * Clear only the redo stack.
     * Useful when new actions should invalidate redo history.
     * @private
     */
    _clearRedoStack() {
        for (const command of this._redoStack) {
            command.dispose();
        }
        this._redoStack = [];
    }

    /**
     * Compress the history by removing old commands that can be safely discarded.
     * Keeps the most recent commands up to the configured limit.
     * 
     * @param {number} [targetSize] - Target number of commands to keep
     */
    compress(targetSize) {
        const maxSize = targetSize || Math.floor(this._options.maxStackSize * 0.7);

        if (this._undoStack.length <= maxSize) return;

        const removeCount = this._undoStack.length - maxSize;
        const removed = this._undoStack.splice(0, removeCount);

        for (const command of removed) {
            this._estimatedMemory -= command.memoryUsage || 0;
            command.dispose();
        }

        this._emitHistoryEvent(HistoryEvents.COMPRESSED, {
            removedCount: removeCount,
            remainingCount: this._undoStack.length,
        });

        this._log('debug', `History compressed: removed ${removeCount} commands`);
    }

    // ============================================
    // Public API - Query
    // ============================================

    /**
     * Check if undo is available.
     * @returns {boolean}
     */
    canUndo() {
        return this._undoStack.length > 0;
    }

    /**
     * Check if redo is available.
     * @returns {boolean}
     */
    canRedo() {
        return this._redoStack.length > 0;
    }

    /**
     * Get the number of commands in the undo stack.
     * @returns {number}
     */
    get undoCount() {
        return this._undoStack.length;
    }

    /**
     * Get the number of commands in the redo stack.
     * @returns {number}
     */
    get redoCount() {
        return this._redoStack.length;
    }

    /**
     * Get the estimated memory usage in bytes.
     * @returns {number}
     */
    get estimatedMemory() {
        return this._estimatedMemory;
    }

    /**
     * Get the description of the next undo command.
     * @returns {string|null}
     */
    get nextUndoDescription() {
        if (this._undoStack.length === 0) return null;
        return this._undoStack[this._undoStack.length - 1].description;
    }

    /**
     * Get the description of the next redo command.
     * @returns {string|null}
     */
    get nextRedoDescription() {
        if (this._redoStack.length === 0) return null;
        return this._redoStack[this._redoStack.length - 1].description;
    }

    /**
     * Get a snapshot of the current history state.
     * @returns {Object}
     */
    getState() {
        return {
            undoCount: this._undoStack.length,
            redoCount: this._redoStack.length,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            nextUndo: this.nextUndoDescription,
            nextRedo: this.nextRedoDescription,
            estimatedMemory: this._estimatedMemory,
            estimatedMemoryMB: Math.round(this._estimatedMemory / (1024 * 1024) * 100) / 100,
            transactionActive: this.isTransactionActive(),
            transactionDepth: this._transactionDepth,
        };
    }

    /**
     * Get all commands in the undo stack (for debugging).
     * @returns {Array<Object>} Lightweight command descriptions
     */
    getUndoStack() {
        return this._undoStack.map(cmd => ({
            type: cmd.type,
            description: cmd.description,
            timestamp: cmd.timestamp,
            state: cmd.state,
            memoryUsage: cmd.memoryUsage,
        }));
    }

    // ============================================
    // Public API - Serialization
    // ============================================

    /**
     * Serialize the history state for project saving.
     * Only serializes metadata, not the full command state.
     * (Full command state serialization is handled by individual commands)
     * 
     * @returns {Object}
     */
    serialize() {
        return {
            undoStack: this._undoStack.map(cmd => ({
                type: cmd.type,
                category: cmd.category,
                description: cmd.description,
                timestamp: cmd.timestamp,
                serialized: cmd.serialize(),
            })),
            redoStack: this._redoStack.map(cmd => ({
                type: cmd.type,
                category: cmd.category,
                description: cmd.description,
                timestamp: cmd.timestamp,
                serialized: cmd.serialize(),
            })),
            undoCount: this._undoStack.length,
            redoCount: this._redoStack.length,
        };
    }

    // ============================================
    // Public API - Configuration
    // ============================================

    /**
     * Set the maximum stack size.
     * @param {number} size - Maximum number of commands
     */
    setMaxStackSize(size) {
        if (size < 10) throw new Error('Max stack size must be at least 10');
        this._options = Object.freeze({ ...this._options, maxStackSize: size });
        this._enforceStackLimits();
    }

    /**
     * Set the maximum memory for history.
     * @param {number} mb - Maximum memory in MB
     */
    setMaxMemory(mb) {
        if (mb < 1) throw new Error('Max memory must be at least 1 MB');
        this._options = Object.freeze({ ...this._options, maxMemoryMB: mb });
        this._enforceStackLimits();
    }

    /**
     * Set the merge window for command merging.
     * @param {number} ms - Merge window in milliseconds
     */
    setMergeWindow(ms) {
        if (ms < 0) throw new Error('Merge window must be non-negative');
        this._options = Object.freeze({ ...this._options, mergeWindowMs: ms });
    }

    // ============================================
    // Public API - Disposal
    // ============================================

    /**
     * Dispose the command bus and all managed commands.
     */
    dispose() {
        if (this._disposed) return;

        // Rollback any active transaction
        if (this._activeTransaction) {
            this._activeTransaction.dispose();
            this._activeTransaction = null;
        }

        // Clear all stacks
        this.clear();

        this._disposed = true;
        this._log('info', 'CommandBus disposed');
    }

    // ============================================
    // Private Methods - Command Merging
    // ============================================

    /**
     * Try to merge the new command with the last command in the undo stack.
     * @private
     * @param {ICommand} command - Newly executed command
     * @returns {boolean} True if merged successfully
     */
    _tryMergeWithLast(command) {
        if (this._undoStack.length === 0) return false;

        const lastCommand = this._undoStack[this._undoStack.length - 1];

        // Check time window
        if (command.timestamp - lastCommand.timestamp > this._options.mergeWindowMs) {
            return false;
        }

        // Check if commands can merge
        if (!lastCommand.canMerge || !lastCommand.canMerge(command)) {
            return false;
        }

        try {
            // Perform merge synchronously if possible
            const mergeResult = lastCommand.merge(command);

            if (mergeResult instanceof Promise) {
                // Async merge - can't block here, so skip merging
                this._log('warn', 'Async merge not supported, skipping merge');
                return false;
            }

            // Update memory estimate
            this._estimatedMemory -= command.memoryUsage || 0;
            this._estimatedMemory += lastCommand.memoryUsage || 0;

            // Dispose the merged command
            command.dispose();

            this._log('debug', `Merged command: ${command.type} into ${lastCommand.type}`);
            return true;
        } catch (error) {
            this._log('warn', 'Command merge failed:', error);
            return false;
        }
    }

    // ============================================
    // Private Methods - Stack Management
    // ============================================

    /**
     * Enforce stack size and memory limits.
     * Removes oldest commands when limits are exceeded.
     * @private
     */
    _enforceStackLimits() {
        // Enforce count limit
        while (this._undoStack.length > this._options.maxStackSize) {
            const removed = this._undoStack.shift();
            this._estimatedMemory -= removed.memoryUsage || 0;
            removed.dispose();
        }

        // Enforce memory limit
        const maxBytes = this._options.maxMemoryMB * 1024 * 1024;

        while (this._estimatedMemory > maxBytes && this._undoStack.length > 1) {
            const removed = this._undoStack.shift();
            this._estimatedMemory -= removed.memoryUsage || 0;
            removed.dispose();
        }

        // Also limit redo stack
        while (this._redoStack.length > this._options.maxStackSize) {
            const removed = this._redoStack.shift();
            removed.dispose();
        }
    }

    // ============================================
    // Private Methods - Events
    // ============================================

    /**
     * Emit a history-specific event.
     * @private
     * @param {string} eventType - Event type from HistoryEvents
     * @param {Object} data - Event data
     */
    _emitHistoryEvent(eventType, data) {
        this._eventBus.emitSync(eventType, {
            ...data,
            undoCount: this._undoStack.length,
            redoCount: this._redoStack.length,
            estimatedMemory: this._estimatedMemory,
        });
    }

    /**
     * Emit state change event for UI updates.
     * @private
     */
    _emitStateChange() {
        this._eventBus.emitSync(HistoryEvents.STATE_CHANGED, this.getState());
    }

    // ============================================
    // Private Methods - Validation
    // ============================================

    /**
     * Validate that the bus has not been disposed.
     * @private
     * @throws {Error} If disposed
     */
    _validateNotDisposed() {
        if (this._disposed) {
            throw new Error('CommandBus has been disposed and cannot be used');
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

        const prefix = '[CommandBus]';

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

export default CommandBus;

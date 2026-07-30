// ============================================
// Paint Pro - Professional Web Graphics Application
// src/domain/document/DocumentManager.js
// Multi-Document Lifecycle Manager
// ============================================

import { Document, DocumentState } from './Document.js';
import { DocumentEvents } from '../../core/event-bus/EventTypes.js';

/**
 * @class DocumentManager
 * @description Manages the lifecycle of multiple open documents.
 * Provides operations for creating, opening, closing, switching,
 * and querying documents. Ensures only one document is active at a time
 * and emits events for all document lifecycle changes.
 * 
 * Responsibilities:
 * - Document registry (all open documents)
 * - Active document tracking
 * - Document creation with defaults
 * - Document closing with unsaved change detection
 * - Document switching
 * - Integration with EventBus for lifecycle events
 * 
 * @example
 * const docManager = new DocumentManager(eventBus);
 * 
 * // Create a new document
 * const doc = docManager.createDocument({ name: 'My Artwork' });
 * 
 * // Switch to another document
 * docManager.setActiveDocument(doc2.id);
 * 
 * // Close a document
 * await docManager.closeDocument(doc.id);
 */
export class DocumentManager {
    /**
     * @param {EventBus} eventBus - Event bus for document events
     * @param {Object} [options={}] - Configuration options
     * @param {Object} [options.defaultCanvas] - Default canvas properties
     * @param {number} [options.defaultCanvas.width=1920] - Default canvas width
     * @param {number} [options.defaultCanvas.height=1080] - Default canvas height
     * @param {number} [options.maxOpenDocuments=10] - Maximum simultaneous documents
     * @param {boolean} [options.confirmBeforeClose=true] - Confirm closing modified documents
     */
    constructor(eventBus, options = {}) {
        if (!eventBus) {
            throw new Error('DocumentManager requires an EventBus instance');
        }

        /**
         * Event bus for document lifecycle events.
         * @private
         * @type {EventBus}
         */
        this._eventBus = eventBus;

        /**
         * Map of all open documents by ID.
         * @private
         * @type {Map<string, Document>}
         */
        this._documents = new Map();

        /**
         * ID of the currently active document.
         * @private
         * @type {string|null}
         */
        this._activeDocumentId = null;

        /**
         * Ordered list of document IDs (for tab ordering).
         * @private
         * @type {string[]}
         */
        this._documentOrder = [];

        /**
         * Configuration options.
         * @private
         * @type {Object}
         */
        this._options = Object.freeze({
            defaultCanvas: Object.freeze({
                width: options.defaultCanvas?.width || 1920,
                height: options.defaultCanvas?.height || 1080,
            }),
            maxOpenDocuments: options.maxOpenDocuments || 10,
            confirmBeforeClose: options.confirmBeforeClose !== false,
        });

        /**
         * Default document counter for naming.
         * @private
         * @type {number}
         */
        this._untitledCounter = 0;

        /**
         * Change listener cleanup functions for each document.
         * @private
         * @type {Map<string, Function>}
         */
        this._documentListeners = new Map();

        /**
         * Whether the manager has been disposed.
         * @private
         * @type {boolean}
         */
        this._disposed = false;

        this._log('debug', 'DocumentManager initialized');
    }

    // ============================================
    // Getters
    // ============================================

    /**
     * Get the currently active document.
     * @returns {Document|null}
     */
    get activeDocument() {
        if (!this._activeDocumentId) return null;
        return this._documents.get(this._activeDocumentId) || null;
    }

    /**
     * Get the active document ID.
     * @returns {string|null}
     */
    get activeDocumentId() {
        return this._activeDocumentId;
    }

    /**
     * Get the total number of open documents.
     * @returns {number}
     */
    get documentCount() {
        return this._documents.size;
    }

    /**
     * Check if any document has unsaved changes.
     * @returns {boolean}
     */
    get hasUnsavedChanges() {
        for (const doc of this._documents.values()) {
            if (doc.isModified) return true;
        }
        return false;
    }

    /**
     * Check if another document can be opened.
     * @returns {boolean}
     */
    get canOpenMoreDocuments() {
        return this._documents.size < this._options.maxOpenDocuments;
    }

    // ============================================
    // Public API - Document Creation
    // ============================================

    /**
     * Create a new empty document.
     * 
     * @param {Object} [options={}] - Document options
     * @param {string} [options.name] - Document name (auto-generated if not provided)
     * @param {number} [options.width] - Canvas width
     * @param {number} [options.height] - Canvas height
     * @param {string} [options.backgroundColor='#FFFFFF'] - Background color
     * @param {boolean} [options.makeActive=true] - Make this the active document
     * @returns {Document} The created document
     * @throws {Error} If maximum document limit is reached
     */
    createDocument(options = {}) {
        this._validateNotDisposed();

        if (!this.canOpenMoreDocuments) {
            throw new Error(
                `Maximum number of open documents reached (${this._options.maxOpenDocuments}). ` +
                'Please close a document before creating a new one.'
            );
        }

        // Generate document name
        const name = options.name || this._generateDocumentName();

        // Create the document
        const doc = new Document({
            name,
            canvas: {
                width: options.width || this._options.defaultCanvas.width,
                height: options.height || this._options.defaultCanvas.height,
                backgroundColor: options.backgroundColor || '#FFFFFF',
            },
        });

        // Register the document
        this._documents.set(doc.id, doc);
        this._documentOrder.push(doc.id);

        // Listen for document changes
        this._setupDocumentListener(doc);

        // Set as active if requested
        if (options.makeActive !== false) {
            this._setActiveDocumentInternal(doc.id);
        }

        // Mark as ready
        doc.setState(DocumentState.READY);

        // Emit event
        this._eventBus.emitSync(DocumentEvents.CREATED, {
            documentId: doc.id,
            document: doc.toJSON(),
        });

        this._log('info', `Document created: "${name}" (${doc.id})`);

        return doc;
    }

    /**
     * Create a document from serialized data (opening a saved project).
     * 
     * @param {Object} data - Serialized document data
     * @param {boolean} [makeActive=true] - Make this the active document
     * @returns {Document} The restored document
     */
    createDocumentFromData(data, makeActive = true) {
        this._validateNotDisposed();

        if (!this.canOpenMoreDocuments) {
            throw new Error('Maximum number of open documents reached');
        }

        const doc = Document.fromJSON(data);

        this._documents.set(doc.id, doc);
        this._documentOrder.push(doc.id);

        this._setupDocumentListener(doc);

        if (makeActive) {
            this._setActiveDocumentInternal(doc.id);
        }

        doc.setState(DocumentState.READY);

        this._eventBus.emitSync(DocumentEvents.OPENED, {
            documentId: doc.id,
            document: doc.toJSON(),
        });

        this._log('info', `Document opened: "${doc.name}" (${doc.id})`);

        return doc;
    }

    // ============================================
    // Public API - Document Access
    // ============================================

    /**
     * Get a document by ID.
     * @param {string} documentId - Document identifier
     * @returns {Document|undefined}
     */
    getDocument(documentId) {
        return this._documents.get(documentId);
    }

    /**
     * Check if a document is open.
     * @param {string} documentId - Document identifier
     * @returns {boolean}
     */
    hasDocument(documentId) {
        return this._documents.has(documentId);
    }

    /**
     * Get all open documents in tab order.
     * @returns {Document[]}
     */
    getAllDocuments() {
        return this._documentOrder
            .map(id => this._documents.get(id))
            .filter(doc => doc !== undefined);
    }

    /**
     * Get a summary of all open documents.
     * @returns {Array<{id: string, name: string, isActive: boolean, isModified: boolean, state: string}>}
     */
    getDocumentSummaries() {
        return this._documentOrder.map(id => {
            const doc = this._documents.get(id);
            if (!doc) return null;
            return {
                id: doc.id,
                name: doc.name,
                isActive: doc.id === this._activeDocumentId,
                isModified: doc.isModified,
                state: doc.state,
                canvasWidth: doc.canvas.width,
                canvasHeight: doc.canvas.height,
            };
        }).filter(Boolean);
    }

    // ============================================
    // Public API - Active Document
    // ============================================

    /**
     * Set the active document by ID.
     * 
     * @param {string} documentId - Document to activate
     * @returns {boolean} True if the document was found and activated
     */
    setActiveDocument(documentId) {
        this._validateNotDisposed();

        const doc = this._documents.get(documentId);
        if (!doc) {
            this._log('warn', `Document not found: ${documentId}`);
            return false;
        }

        if (documentId === this._activeDocumentId) {
            return true; // Already active
        }

        return this._setActiveDocumentInternal(documentId);
    }

    /**
     * Activate the next document in tab order.
     * @returns {boolean} True if switched successfully
     */
    activateNextDocument() {
        if (this._documentOrder.length <= 1) return false;

        const currentIndex = this._documentOrder.indexOf(this._activeDocumentId);
        const nextIndex = (currentIndex + 1) % this._documentOrder.length;

        return this.setActiveDocument(this._documentOrder[nextIndex]);
    }

    /**
     * Activate the previous document in tab order.
     * @returns {boolean} True if switched successfully
     */
    activatePreviousDocument() {
        if (this._documentOrder.length <= 1) return false;

        const currentIndex = this._documentOrder.indexOf(this._activeDocumentId);
        const prevIndex = (currentIndex - 1 + this._documentOrder.length) % this._documentOrder.length;

        return this.setActiveDocument(this._documentOrder[prevIndex]);
    }

    // ============================================
    // Public API - Document Closing
    // ============================================

    /**
     * Close a document.
     * If the document has unsaved changes and confirmBeforeClose is enabled,
     * the close will be rejected. The caller should prompt the user first.
     * 
     * @param {string} documentId - Document to close
     * @param {Object} [options={}] - Close options
     * @param {boolean} [options.force=false] - Force close even with unsaved changes
     * @param {boolean} [options.skipConfirm=false] - Skip unsaved changes confirmation
     * @returns {Promise<boolean>} True if the document was closed
     */
    async closeDocument(documentId, options = {}) {
        this._validateNotDisposed();

        const doc = this._documents.get(documentId);
        if (!doc) {
            return false;
        }

        // Check for unsaved changes
        if (doc.isModified && !options.force && !options.skipConfirm && this._options.confirmBeforeClose) {
            this._eventBus.emitSync(DocumentEvents.BEFORE_CLOSE, {
                documentId,
                documentName: doc.name,
            });
            return false; // Caller should handle confirmation
        }

        // Emit before close event
        this._eventBus.emitSync(DocumentEvents.BEFORE_CLOSE, {
            documentId,
            documentName: doc.name,
            hasUnsavedChanges: doc.isModified,
        });

        // If this is the active document, switch to another
        if (documentId === this._activeDocumentId) {
            const remainingDocs = this._documentOrder.filter(id => id !== documentId);
            if (remainingDocs.length > 0) {
                this._setActiveDocumentInternal(remainingDocs[0]);
            } else {
                this._activeDocumentId = null;
            }
        }

        // Remove document listeners
        const cleanup = this._documentListeners.get(documentId);
        if (cleanup) {
            cleanup();
            this._documentListeners.delete(documentId);
        }

        // Close the document
        doc.close();

        // Remove from registry
        this._documents.delete(documentId);
        this._documentOrder = this._documentOrder.filter(id => id !== documentId);

        // Emit event
        this._eventBus.emitSync(DocumentEvents.CLOSED, {
            documentId,
            documentName: doc.name,
        });

        this._log('info', `Document closed: "${doc.name}" (${documentId})`);

        return true;
    }

    /**
     * Close all open documents.
     * @param {Object} [options={}] - Close options
     * @param {boolean} [options.force=false] - Force close all
     * @returns {Promise<number>} Number of documents closed
     */
    async closeAllDocuments(options = {}) {
        const documentIds = [...this._documentOrder];
        let closedCount = 0;

        for (const id of documentIds) {
            const result = await this.closeDocument(id, options);
            if (result) closedCount++;
        }

        return closedCount;
    }

    // ============================================
    // Public API - Document Operations
    // ============================================

    /**
     * Mark the active document as saved.
     */
    markActiveDocumentSaved() {
        const doc = this.activeDocument;
        if (doc) {
            doc.markSaved();
            this._eventBus.emitSync(DocumentEvents.SAVED, {
                documentId: doc.id,
                documentName: doc.name,
            });
        }
    }

    /**
     * Reorder documents in the tab order.
     * @param {string} documentId - Document to move
     * @param {number} newIndex - New position in tab order
     */
    reorderDocument(documentId, newIndex) {
        const currentIndex = this._documentOrder.indexOf(documentId);
        if (currentIndex === -1) return;

        this._documentOrder.splice(currentIndex, 1);
        this._documentOrder.splice(
            Math.max(0, Math.min(this._documentOrder.length, newIndex)),
            0,
            documentId
        );
    }

    // ============================================
    // Public API - State
    // ============================================

    /**
     * Get the state of all documents for serialization.
     * @returns {Object}
     */
    getState() {
        return {
            activeDocumentId: this._activeDocumentId,
            documentOrder: [...this._documentOrder],
            documents: this.getAllDocuments().map(doc => doc.toJSON()),
        };
    }

    // ============================================
    // Public API - Disposal
    // ============================================

    /**
     * Dispose the document manager and close all documents.
     * @param {boolean} [force=true] - Force close all documents
     * @returns {Promise<void>}
     */
    async dispose(force = true) {
        if (this._disposed) return;

        // Close all documents
        await this.closeAllDocuments({ force, skipConfirm: true });

        // Clear all listeners
        for (const cleanup of this._documentListeners.values()) {
            cleanup();
        }
        this._documentListeners.clear();

        this._documents.clear();
        this._documentOrder = [];
        this._activeDocumentId = null;
        this._disposed = true;

        this._log('info', 'DocumentManager disposed');
    }

    // ============================================
    // Private Methods
    // ============================================

    /**
     * Internal method to set the active document.
     * @private
     * @param {string} documentId - Document to activate
     * @returns {boolean}
     */
    _setActiveDocumentInternal(documentId) {
        const previousId = this._activeDocumentId;
        const previousDoc = previousId ? this._documents.get(previousId) : null;
        const newDoc = this._documents.get(documentId);

        if (!newDoc) return false;

        // Deactivate previous document
        if (previousDoc) {
            this._eventBus.emitSync(DocumentEvents.SWITCHED, {
                previousDocumentId: previousId,
                newDocumentId: documentId,
                previousDocument: previousDoc.toJSON(),
                newDocument: newDoc.toJSON(),
            });
        }

        // Set new active
        this._activeDocumentId = documentId;

        // Move to front of order (or maintain position)
        // Current implementation maintains position

        this._log('debug', `Active document switched to: "${newDoc.name}" (${documentId})`);

        return true;
    }

    /**
     * Setup change listener for a document.
     * @private
     * @param {Document} doc - Document to listen to
     */
    _setupDocumentListener(doc) {
        const cleanup = doc.onChange((event, data) => {
            // Propagate document changes to EventBus
            switch (event) {
                case 'nameChanged':
                    this._eventBus.emitSync(DocumentEvents.METADATA_CHANGED, {
                        documentId: doc.id,
                        change: 'name',
                        value: data.name,
                    });
                    break;

                case 'modifiedStateChanged':
                    this._eventBus.emitSync(DocumentEvents.MODIFIED_STATE_CHANGED, {
                        documentId: doc.id,
                        isModified: data.isModified,
                    });
                    break;

                case 'contentChanged':
                    this._eventBus.emitSync(DocumentEvents.CONTENT_CHANGED, {
                        documentId: doc.id,
                    });
                    break;

                default:
                    // Other changes are internal
                    break;
            }
        });

        this._documentListeners.set(doc.id, cleanup);
    }

    /**
     * Generate a unique untitled document name.
     * @private
     * @returns {string}
     */
    _generateDocumentName() {
        this._untitledCounter++;

        // Check for existing untitled documents with this number
        let name = `Untitled-${this._untitledCounter}`;
        let attempts = 0;

        while (this._isDocumentNameTaken(name) && attempts < 1000) {
            this._untitledCounter++;
            name = `Untitled-${this._untitledCounter}`;
            attempts++;
        }

        return name;
    }

    /**
     * Check if a document name is already in use.
     * @private
     * @param {string} name - Name to check
     * @returns {boolean}
     */
    _isDocumentNameTaken(name) {
        for (const doc of this._documents.values()) {
            if (doc.name === name) return true;
        }
        return false;
    }

    /**
     * Validate that the manager has not been disposed.
     * @private
     * @throws {Error} If disposed
     */
    _validateNotDisposed() {
        if (this._disposed) {
            throw new Error('DocumentManager has been disposed and cannot be used');
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
        const prefix = '[DocumentManager]';

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

export default DocumentManager;

// ============================================
// Paint Pro - Professional Paint Application
// text.js - Text Engine Module
// Text rendering, editing, formatting,
// font management, and text manipulation
// ============================================

import { Utils } from './utils.js';

/**
 * @class TextEngine
 * @description Handles all text operations including
 * rendering, editing, formatting, and text layer management
 */
export class TextEngine {
    /**
     * @param {Object} app - Reference to main application instance
     */
    constructor(app) {
        this.app = app;
        
        // Text state
        this.textObjects = [];
        this.activeTextObject = null;
        this.isEditing = false;
        this.editingIndex = -1;
        
        // Default text settings
        this.defaultSettings = {
            fontFamily: 'Vazirmatn',
            fontSize: 24,
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none',
            textAlign: 'right',
            color: '#000000',
            opacity: 1,
            lineHeight: 1.5,
            letterSpacing: 0,
            rotation: 0,
            bold: false,
            italic: false,
            underline: false,
        };
        
        // Text editor element
        this.textEditor = null;
        
        // Available fonts
        this.availableFonts = [
            { name: 'وزیرمتن', family: 'Vazirmatn', category: 'sans-serif' },
            { name: 'Arial', family: 'Arial', category: 'sans-serif' },
            { name: 'Tahoma', family: 'Tahoma', category: 'sans-serif' },
            { name: 'Times New Roman', family: 'Times New Roman', category: 'serif' },
            { name: 'Georgia', family: 'Georgia', category: 'serif' },
            { name: 'Courier New', family: 'Courier New', category: 'monospace' },
            { name: 'Verdana', family: 'Verdana', category: 'sans-serif' },
            { name: 'Impact', family: 'Impact', category: 'sans-serif' },
            { name: 'Comic Sans MS', family: 'Comic Sans MS', category: 'cursive' },
        ];
        
        // Bind methods
        this.init = this.init.bind(this);
        this.startTextAt = this.startTextAt.bind(this);
        this.createTextObject = this.createTextObject.bind(this);
        this.renderText = this.renderText.bind(this);
        this.renderAllText = this.renderAllText.bind(this);
        this.editText = this.editText.bind(this);
        this.finishEditing = this.finishEditing.bind(this);
        this.deleteText = this.deleteText.bind(this);
        this.moveText = this.moveText.bind(this);
        this.resizeText = this.resizeText.bind(this);
        this.rotateText = this.rotateText.bind(this);
        this.updateTextStyle = this.updateTextStyle.bind(this);
        this.getTextAtPoint = this.getTextAtPoint.bind(this);
        this.onToolChange = this.onToolChange.bind(this);
        this.setupTextEditor = this.setupTextEditor.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    /**
     * Initialize text engine
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Get text editor element
            this.textEditor = this.app.elements.textEditor;
            
            // Setup text editor events
            this.setupTextEditor();
            
            // Load fonts
            await this.loadFonts();
            
            console.log('Text Engine initialized');
        } catch (error) {
            console.error('Failed to initialize Text Engine:', error);
            throw error;
        }
    }

    /**
     * Load custom fonts
     * @returns {Promise<void>}
     */
    async loadFonts() {
        // Fonts are loaded via CSS @import in index.html
        // This method ensures fonts are ready
        try {
            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
                console.log('Fonts loaded successfully');
            }
        } catch (error) {
            console.warn('Font loading warning:', error);
        }
    }

    /**
     * Setup text editor element
     */
    setupTextEditor() {
        if (!this.textEditor) return;
        
        // Handle text input
        this.textEditor.addEventListener('input', (e) => {
            if (this.isEditing && this.activeTextObject) {
                this.activeTextObject.text = this.textEditor.innerText;
                this.updateTextEditorSize();
            }
        });
        
        // Handle blur (finish editing when clicking outside)
        this.textEditor.addEventListener('blur', () => {
            if (this.isEditing) {
                setTimeout(() => {
                    if (!this.textEditor.matches(':focus')) {
                        this.finishEditing();
                    }
                }, 200);
            }
        });
        
        // Handle keyboard shortcuts
        this.textEditor.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.finishEditing();
            } else if (e.key === 'Enter' && !e.shiftKey) {
                // Allow Enter for new lines
            }
            
            // Prevent canvas shortcuts while editing
            e.stopPropagation();
        });
        
        // Handle paste (clean HTML)
        this.textEditor.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        });
    }

    /**
     * Start text tool at position
     * @param {Object} pos - Position {x, y}
     */
    startTextAt(pos) {
        // If already editing, finish current text
        if (this.isEditing) {
            this.finishEditing();
        }
        
        // Check if clicking on existing text
        const existingText = this.getTextAtPoint(pos.x, pos.y);
        
        if (existingText) {
            // Edit existing text
            this.editText(existingText);
        } else {
            // Create new text
            const settings = this.getCurrentTextSettings();
            const textObject = this.createTextObject('متن جدید', pos.x, pos.y, settings);
            this.textObjects.push(textObject);
            this.activeTextObject = textObject;
            this.editingIndex = this.textObjects.length - 1;
            
            // Start editing
            this.startEditing(textObject);
        }
        
        // Record for undo
        this.app.modules.historyManager?.beginOperation({
            type: 'text',
            action: 'add',
        });
    }

    /**
     * Create a text object
     * @param {string} text - Text content
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} settings - Text settings
     * @returns {Object} Text object
     */
    createTextObject(text, x, y, settings = {}) {
        const mergedSettings = { ...this.defaultSettings, ...settings };
        
        return {
            id: Utils.generateUUID(),
            text: text,
            x: x,
            y: y,
            width: 0,
            height: 0,
            settings: mergedSettings,
            rotation: mergedSettings.rotation || 0,
            scaleX: 1,
            scaleY: 1,
            visible: true,
            locked: false,
            opacity: mergedSettings.opacity || 1,
        };
    }

    /**
     * Start editing a text object
     * @param {Object} textObject 
     */
    startEditing(textObject) {
        this.isEditing = true;
        this.activeTextObject = textObject;
        
        // Show text editor
        if (this.textEditor) {
            this.textEditor.style.display = 'block';
            this.textEditor.innerText = textObject.text;
            
            // Position the editor
            this.positionTextEditor(textObject);
            
            // Apply text styles to editor
            this.applyEditorStyles(textObject.settings);
            
            // Focus editor
            setTimeout(() => {
                this.textEditor.focus();
                
                // Select all text for easy replacement
                const range = document.createRange();
                range.selectNodeContents(this.textEditor);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }, 50);
        }
        
        // Render text objects (excluding the one being edited)
        this.renderAllText();
    }

    /**
     * Position the text editor at text object location
     * @param {Object} textObject 
     */
    positionTextEditor(textObject) {
        if (!this.textEditor) return;
        
        const screenPos = this.app.modules.canvasManager?.canvasToScreen(
            textObject.x, 
            textObject.y
        );
        
        if (screenPos) {
            this.textEditor.style.left = screenPos.x + 'px';
            this.textEditor.style.top = screenPos.y + 'px';
            this.textEditor.style.minWidth = '50px';
            this.textEditor.style.minHeight = '30px';
        }
    }

    /**
     * Apply styles to text editor
     * @param {Object} settings 
     */
    applyEditorStyles(settings) {
        if (!this.textEditor) return;
        
        const fontWeight = settings.bold ? 'bold' : (settings.fontWeight || 'normal');
        const fontStyle = settings.italic ? 'italic' : (settings.fontStyle || 'normal');
        const textDecoration = settings.underline ? 'underline' : (settings.textDecoration || 'none');
        
        this.textEditor.style.fontFamily = settings.fontFamily + ', sans-serif';
        this.textEditor.style.fontSize = settings.fontSize + 'px';
        this.textEditor.style.fontWeight = fontWeight;
        this.textEditor.style.fontStyle = fontStyle;
        this.textEditor.style.textDecoration = textDecoration;
        this.textEditor.style.textAlign = settings.textAlign;
        this.textEditor.style.color = settings.color;
        this.textEditor.style.opacity = settings.opacity;
        this.textEditor.style.direction = 'rtl';
        this.textEditor.style.lineHeight = settings.lineHeight;
        this.textEditor.style.letterSpacing = settings.letterSpacing + 'px';
    }

    /**
     * Update text editor size based on content
     */
    updateTextEditorSize() {
        if (!this.textEditor || !this.activeTextObject) return;
        
        const rect = this.textEditor.getBoundingClientRect();
        this.activeTextObject.width = rect.width / this.app.modules.canvasManager.zoom;
        this.activeTextObject.height = rect.height / this.app.modules.canvasManager.zoom;
    }

    /**
     * Finish editing current text
     */
    finishEditing() {
        if (!this.isEditing || !this.activeTextObject) return;
        
        // Update text object with final content
        this.activeTextObject.text = this.textEditor?.innerText || this.activeTextObject.text;
        
        // Update dimensions
        this.updateTextEditorSize();
        
        // Hide editor
        if (this.textEditor) {
            this.textEditor.style.display = 'none';
            this.textEditor.innerText = '';
        }
        
        // Remove empty text objects
        if (!this.activeTextObject.text || this.activeTextObject.text.trim() === '') {
            this.textObjects = this.textObjects.filter(obj => obj.id !== this.activeTextObject.id);
        }
        
        // Record in history
        this.app.modules.historyManager?.endOperation();
        
        // Mark as modified
        this.app.markAsModified();
        
        this.isEditing = false;
        this.activeTextObject = null;
        this.editingIndex = -1;
        
        // Render all text
        this.renderAllText();
        this.app.modules.canvasManager?.scheduleRender();
    }

    /**
     * Edit existing text object
     * @param {Object} textObject 
     */
    editText(textObject) {
        this.activeTextObject = textObject;
        this.editingIndex = this.textObjects.indexOf(textObject);
        this.startEditing(textObject);
    }

    /**
     * Render a single text object on canvas
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Object} textObject 
     */
    renderText(ctx, textObject) {
        if (!textObject.visible) return;
        
        ctx.save();
        
        // Apply transform
        ctx.translate(textObject.x, textObject.y);
        
        if (textObject.rotation !== 0) {
            ctx.rotate(textObject.rotation * Math.PI / 180);
        }
        
        ctx.scale(textObject.scaleX, textObject.scaleY);
        ctx.globalAlpha = textObject.opacity;
        
        // Build font string
        const settings = textObject.settings;
        const fontWeight = settings.bold ? 'bold' : (settings.fontWeight || 'normal');
        const fontStyle = settings.italic ? 'italic' : (settings.fontStyle || 'normal');
        const fontString = `${fontStyle} ${fontWeight} ${settings.fontSize}px ${settings.fontFamily}`;
        
        ctx.font = fontString;
        ctx.fillStyle = settings.color || '#000000';
        ctx.textAlign = settings.textAlign || 'right';
        ctx.textBaseline = 'top';
        ctx.direction = 'rtl';
        
        // Apply text decoration
        if (settings.underline) {
            ctx.textDecoration = 'underline';
        }
        
        // Draw text with line breaks
        const lines = textObject.text.split('\n');
        const lineHeight = settings.fontSize * settings.lineHeight;
        const letterSpacing = settings.letterSpacing || 0;
        
        lines.forEach((line, index) => {
            let y = index * lineHeight;
            
            // Apply letter spacing (render character by character)
            if (letterSpacing !== 0) {
                let xOffset = 0;
                const dir = settings.textAlign === 'left' ? 1 : 
                           settings.textAlign === 'right' ? -1 : 0;
                
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    const metrics = ctx.measureText(char);
                    ctx.fillText(char, xOffset, y);
                    xOffset += (metrics.width + letterSpacing) * dir;
                }
            } else {
                ctx.fillText(line, 0, y);
            }
            
            // Draw underline manually for better control
            if (settings.underline) {
                const textWidth = ctx.measureText(line).width;
                const underlineY = y + settings.fontSize * 1.1;
                const startX = settings.textAlign === 'center' ? -textWidth / 2 :
                              settings.textAlign === 'right' ? -textWidth : 0;
                
                ctx.strokeStyle = settings.color || '#000000';
                ctx.lineWidth = Math.max(1, settings.fontSize / 16);
                ctx.beginPath();
                ctx.moveTo(startX, underlineY);
                ctx.lineTo(startX + textWidth, underlineY);
                ctx.stroke();
            }
        });
        
        ctx.restore();
    }

    /**
     * Render all text objects on canvas
     * @param {CanvasRenderingContext2D} [ctx] - Optional canvas context
     */
    renderAllText(ctx = null) {
        const context = ctx || this.app.modules.canvasManager?.getMainContext();
        if (!context) return;
        
        this.textObjects.forEach(textObject => {
            if (textObject !== this.activeTextObject || !this.isEditing) {
                this.renderText(context, textObject);
            }
        });
    }

    /**
     * Delete a text object
     * @param {Object} textObject 
     */
    deleteText(textObject) {
        const index = this.textObjects.indexOf(textObject);
        if (index !== -1) {
            this.textObjects.splice(index, 1);
            
            if (this.activeTextObject === textObject) {
                this.finishEditing();
            }
            
            this.app.markAsModified();
            this.renderAllText();
            this.app.modules.canvasManager?.scheduleRender();
        }
    }

    /**
     * Delete all text objects
     */
    deleteAllText() {
        this.textObjects = [];
        this.finishEditing();
        this.app.markAsModified();
        this.app.modules.canvasManager?.scheduleRender();
    }

    /**
     * Move text object
     * @param {Object} textObject 
     * @param {number} dx 
     * @param {number} dy 
     */
    moveText(textObject, dx, dy) {
        textObject.x += dx;
        textObject.y += dy;
        this.renderAllText();
        this.app.modules.canvasManager?.scheduleRender();
    }

    /**
     * Resize text object
     * @param {Object} textObject 
     * @param {number} scaleX 
     * @param {number} scaleY 
     */
    resizeText(textObject, scaleX, scaleY) {
        textObject.scaleX = scaleX;
        textObject.scaleY = scaleY;
        this.renderAllText();
        this.app.modules.canvasManager?.scheduleRender();
    }

    /**
     * Rotate text object
     * @param {Object} textObject 
     * @param {number} angle - Rotation in degrees
     */
    rotateText(textObject, angle) {
        textObject.rotation = angle % 360;
        this.renderAllText();
        this.app.modules.canvasManager?.scheduleRender();
    }

    /**
     * Update text style
     * @param {Object} textObject 
     * @param {Object} newSettings 
     */
    updateTextStyle(textObject, newSettings) {
        Object.assign(textObject.settings, newSettings);
        
        // Update editor styles if currently editing this object
        if (this.isEditing && this.activeTextObject === textObject) {
            this.applyEditorStyles(textObject.settings);
        }
        
        this.renderAllText();
        this.app.modules.canvasManager?.scheduleRender();
    }

    /**
     * Get text object at a specific point
     * @param {number} x 
     * @param {number} y 
     * @returns {Object|null} Text object or null
     */
    getTextAtPoint(x, y) {
        // Check in reverse order (top-most first)
        for (let i = this.textObjects.length - 1; i >= 0; i--) {
            const obj = this.textObjects[i];
            if (!obj.visible) continue;
            
            // Create temporary canvas to measure text
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            const settings = obj.settings;
            const fontWeight = settings.bold ? 'bold' : (settings.fontWeight || 'normal');
            const fontStyle = settings.italic ? 'italic' : (settings.fontStyle || 'normal');
            tempCtx.font = `${fontStyle} ${fontWeight} ${settings.fontSize}px ${settings.fontFamily}`;
            
            const lines = obj.text.split('\n');
            const lineHeight = settings.fontSize * settings.lineHeight;
            const totalHeight = lines.length * lineHeight;
            
            let maxWidth = 0;
            lines.forEach(line => {
                const metrics = tempCtx.measureText(line);
                maxWidth = Math.max(maxWidth, metrics.width);
            });
            
            // Calculate text bounds
            const textAlign = settings.textAlign || 'right';
            let textX = obj.x;
            
            if (textAlign === 'center') {
                textX -= maxWidth / 2;
            } else if (textAlign === 'right') {
                textX -= maxWidth;
            }
            
            const textY = obj.y;
            const textWidth = maxWidth;
            const textHeight = totalHeight;
            
            // Check if point is within bounds (with some padding)
            const padding = 5;
            if (x >= textX - padding && 
                x <= textX + textWidth + padding &&
                y >= textY - padding && 
                y <= textY + textHeight + padding) {
                return obj;
            }
        }
        
        return null;
    }

    /**
     * Handle tool change event
     * @param {string} toolId 
     */
    onToolChange(toolId) {
        if (toolId !== 'text' && this.isEditing) {
            this.finishEditing();
        }
    }

    /**
     * Get current text settings from tool options
     * @returns {Object}
     */
    getCurrentTextSettings() {
        const toolConfig = this.app.modules.toolManager?.getToolConfig('text') || {};
        
        return {
            fontFamily: toolConfig.fontFamily || this.defaultSettings.fontFamily,
            fontSize: toolConfig.fontSize || this.defaultSettings.fontSize,
            bold: toolConfig.bold || false,
            italic: toolConfig.italic || false,
            underline: toolConfig.underline || false,
            textAlign: toolConfig.align || this.defaultSettings.textAlign,
            color: this.app.elements.hexInput.value || this.defaultSettings.color,
            opacity: parseInt(this.app.elements.alphaSlider.value) / 100,
            lineHeight: this.defaultSettings.lineHeight,
            letterSpacing: this.defaultSettings.letterSpacing,
        };
    }

    /**
     * Get all text objects
     * @returns {Array}
     */
    getTextObjects() {
        return this.textObjects;
    }

    /**
     * Set text objects (for loading projects)
     * @param {Array} objects 
     */
    setTextObjects(objects) {
        this.textObjects = objects || [];
        this.renderAllText();
    }

    /**
     * Clear all text objects
     */
    clearAll() {
        this.finishEditing();
        this.textObjects = [];
    }

    /**
     * Serialize text objects for saving
     * @returns {Array}
     */
    serialize() {
        return this.textObjects.map(obj => ({
            ...obj,
            // Don't serialize functions or circular references
            settings: { ...obj.settings },
        }));
    }

    /**
     * Deserialize text objects from saved data
     * @param {Array} data 
     */
    deserialize(data) {
        this.textObjects = data.map(item => ({
            ...item,
            settings: { ...this.defaultSettings, ...item.settings },
        }));
        this.renderAllText();
    }

    /**
     * Destroy text engine
     */
    destroy() {
        this.finishEditing();
        this.textObjects = [];
        this.textEditor = null;
        
        console.log('Text Engine destroyed');
    }
}

export default TextEngine;

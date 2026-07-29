// ============================================
// Paint Pro - Professional Paint Application
// image.js - Image Processor Module
// Image loading, manipulation, filters,
// transforms, and effects
// ============================================

import { Utils } from './utils.js';

/**
 * @class ImageProcessor
 * @description Handles all image operations including
 * loading, pasting, drag-drop, resize, rotate, flip,
 * crop, filters, and adjustments
 */
export class ImageProcessor {
    /**
     * @param {Object} app - Reference to main application instance
     */
    constructor(app) {
        this.app = app;
        
        // Image state
        this.loadedImages = [];
        this.currentImage = null;
        
        // Filter presets
        this.filters = {
            blur: { type: 'blur', radius: 5 },
            sharpen: { type: 'sharpen', amount: 50 },
            grayscale: { type: 'grayscale' },
            invert: { type: 'invert' },
            sepia: { type: 'sepia' },
            brightness: { type: 'brightness', value: 20 },
            contrast: { type: 'contrast', value: 20 },
            hue: { type: 'hue', value: 180 },
            saturation: { type: 'saturation', value: 50 },
        };
        
        // Bind methods
        this.init = this.init.bind(this);
        this.loadImageFromFile = this.loadImageFromFile.bind(this);
        this.loadImageFromBlob = this.loadImageFromBlob.bind(this);
        this.loadImageFromUrl = this.loadImageFromUrl.bind(this);
        this.pasteImage = this.pasteImage.bind(this);
        this.handleImageDrop = this.handleImageDrop.bind(this);
        this.resizeImage = this.resizeImage.bind(this);
        this.rotateImage = this.rotateImage.bind(this);
        this.flipImage = this.flipImage.bind(this);
        this.cropToSelection = this.cropToSelection.bind(this);
        this.cropImage = this.cropImage.bind(this);
        this.applyFilter = this.applyFilter.bind(this);
        this.applyBlur = this.applyBlur.bind(this);
        this.applySharpen = this.applySharpen.bind(this);
        this.applyGrayscale = this.applyGrayscale.bind(this);
        this.applyInvert = this.applyInvert.bind(this);
        this.applySepia = this.applySepia.bind(this);
        this.applyBrightness = this.applyBrightness.bind(this);
        this.applyContrast = this.applyContrast.bind(this);
        this.applyHueRotation = this.applyHueRotation.bind(this);
        this.applySaturation = this.applySaturation.bind(this);
        this.getConvolutionMatrix = this.getConvolutionMatrix.bind(this);
        this.applyConvolution = this.applyConvolution.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    /**
     * Initialize image processor
     * @returns {Promise<void>}
     */
    async init() {
        try {
            console.log('Image Processor initialized');
        } catch (error) {
            console.error('Failed to initialize Image Processor:', error);
            throw error;
        }
    }

    /**
     * Load image from file input
     * @param {File} file - Image file
     * @returns {Promise<HTMLImageElement>}
     */
    async loadImageFromFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            this.app.showToast('فایل تصویری معتبر نیست', 'error');
            return null;
        }
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.placeImageOnCanvas(img);
                    this.app.showToast('تصویر بارگذاری شد', 'success');
                    resolve(img);
                };
                img.onerror = () => {
                    this.app.showToast('خطا در بارگذاری تصویر', 'error');
                    reject(new Error('Failed to load image'));
                };
                img.src = e.target.result;
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsDataURL(file);
        });
    }

    /**
     * Load image from blob
     * @param {Blob} blob - Image blob
     * @returns {Promise<HTMLImageElement>}
     */
    async loadImageFromBlob(blob) {
        if (!blob) return null;
        
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                this.placeImageOnCanvas(img);
                this.app.showToast('تصویر جای‌گذاری شد', 'success');
                resolve(img);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image from blob'));
            };
            
            img.src = url;
        });
    }

    /**
     * Load image from URL
     * @param {string} url - Image URL
     * @returns {Promise<HTMLImageElement>}
     */
    async loadImageFromUrl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                this.placeImageOnCanvas(img);
                resolve(img);
            };
            
            img.onerror = () => {
                reject(new Error('Failed to load image from URL'));
            };
            
            img.src = url;
        });
    }

    /**
     * Place loaded image onto canvas
     * @param {HTMLImageElement} img - Image element
     * @param {Object} [options] - Placement options
     */
    placeImageOnCanvas(img, options = {}) {
        const ctx = this.app.modules.canvasManager?.getMainContext();
        if (!ctx) return;
        
        const canvasWidth = this.app.modules.canvasManager.width;
        const canvasHeight = this.app.modules.canvasManager.height;
        
        // Calculate placement
        let x = options.x || canvasWidth / 2 - img.width / 2;
        let y = options.y || canvasHeight / 2 - img.height / 2;
        let width = img.width;
        let height = img.height;
        
        // Scale down if image is larger than canvas
        if (width > canvasWidth || height > canvasHeight) {
            const scale = Math.min(
                (canvasWidth * 0.8) / width,
                (canvasHeight * 0.8) / height
            );
            width *= scale;
            height *= scale;
            x = canvasWidth / 2 - width / 2;
            y = canvasHeight / 2 - height / 2;
        }
        
        // Record for undo
        this.app.modules.historyManager?.beginOperation({
            type: 'image',
            action: 'place',
        });
        
        // Draw image
        ctx.drawImage(img, x, y, width, height);
        
        this.app.modules.historyManager?.endOperation();
        this.app.markAsModified();
        this.app.modules.canvasManager?.scheduleRender();
    }

    /**
     * Paste image onto canvas (centered or at specific position)
     * @param {HTMLImageElement} img 
     * @param {number} [x] 
     * @param {number} [y] 
     */
    pasteImage(img, x = null, y = null) {
        this.placeImageOnCanvas(img, { x, y });
    }

    /**
     * Handle image drop event
     * @param {DragEvent} e 
     */
    handleImageDrop(e) {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                this.loadImageFromFile(file);
            }
        }
    }

    /**
     * Resize current selection or entire canvas
     * @param {number} newWidth 
     * @param {number} newHeight 
     * @param {boolean} maintainAspectRatio 
     */
    resizeImage(newWidth, newHeight, maintainAspectRatio = true) {
        const canvas = this.app.modules.canvasManager;
        if (!canvas) return;
        
        const currentWidth = canvas.width;
        const currentHeight = canvas.height;
        
        if (maintainAspectRatio) {
            const ratio = currentWidth / currentHeight;
            if (newWidth / newHeight > ratio) {
                newWidth = Math.round(newHeight * ratio);
            } else {
                newHeight = Math.round(newWidth / ratio);
            }
        }
        
        // Get current content
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = currentWidth;
        tempCanvas.height = currentHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas.mainCanvas, 0, 0);
        
        // Record for undo
        this.app.modules.historyManager?.beginOperation({
            type: 'transform',
            action: 'resize',
            oldWidth: currentWidth,
            oldHeight: currentHeight,
            newWidth,
            newHeight,
        });
        
        // Resize canvas
        canvas.resizeCanvas(newWidth, newHeight);
        
        // Draw scaled content
        const ctx = canvas.getMainContext();
        ctx.drawImage(tempCanvas, 0, 0, currentWidth, currentHeight, 0, 0, newWidth, newHeight);
        
        this.app.modules.historyManager?.endOperation();
        this.app.markAsModified();
        this.app.showToast(`تصویر به ${newWidth}×${newHeight} تغییر اندازه یافت`, 'success');
    }

    /**
     * Rotate image by specified degrees
     * @param {number} degrees - Rotation angle
     * @param {boolean} [clockwise=true] - Rotation direction
     */
    rotateImage(degrees, clockwise = true) {
        const canvas = this.app.modules.canvasManager;
        if (!canvas) return;
        
        const angle = clockwise ? degrees : -degrees;
        const radians = angle * Math.PI / 180;
        
        // Get current content
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas.mainCanvas, 0, 0);
        
        // Calculate new dimensions after rotation
        const sin = Math.abs(Math.sin(radians));
        const cos = Math.abs(Math.cos(radians));
        const newWidth = Math.round(canvas.height * sin + canvas.width * cos);
        const newHeight = Math.round(canvas.height * cos + canvas.width * sin);
        
        // Record for undo
        this.app.modules.historyManager?.beginOperation({
            type: 'transform',
            action: 'rotate',
            angle,
        });
        
        // Resize canvas
        canvas.resizeCanvas(newWidth, newHeight);
        
        // Draw rotated content
        const ctx = canvas.getMainContext();
        ctx.save();
        ctx.translate(newWidth / 2, newHeight / 2);
        ctx.rotate(radians);
        ctx.drawImage(tempCanvas, -canvas.width / 2, -canvas.height / 2);
        ctx.restore();
        
        this.app.modules.historyManager?.endOperation();
        this.app.markAsModified();
        this.app.showToast(`تصویر ${degrees} درجه چرخانده شد`, 'success');
    }

    /**
     * Flip image horizontally or vertically
     * @param {string} direction - 'horizontal' or 'vertical'
     */
    flipImage(direction = 'horizontal') {
        const canvas = this.app.modules.canvasManager;
        if (!canvas) return;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas.mainCanvas, 0, 0);
        
        // Record for undo
        this.app.modules.historyManager?.beginOperation({
            type: 'transform',
            action: 'flip',
            direction,
        });
        
        const ctx = canvas.getMainContext();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        
        if (direction === 'horizontal') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(0, canvas.height);
            ctx.scale(1, -1);
        }
        
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
        
        this.app.modules.historyManager?.endOperation();
        this.app.markAsModified();
        this.app.showToast(`تصویر ${direction === 'horizontal' ? 'افقی' : 'عمودی'} برگردانده شد`, 'success');
    }

    /**
     * Crop canvas to selection bounds
     * @param {Object} bounds - Selection bounds {x, y, width, height}
     */
    cropToSelection(bounds) {
        if (!bounds || bounds.width < 1 || bounds.height < 1) return;
        
        const canvas = this.app.modules.canvasManager;
        if (!canvas) return;
        
        // Get cropped content
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = bounds.width;
        croppedCanvas.height = bounds.height;
        const croppedCtx = croppedCanvas.getContext('2d');
        
        croppedCtx.drawImage(
            canvas.mainCanvas,
            bounds.x, bounds.y,
            bounds.width, bounds.height,
            0, 0,
            bounds.width, bounds.height
        );
        
        // Record for undo
        this.app.modules.historyManager?.beginOperation({
            type: 'crop',
            oldWidth: canvas.width,
            oldHeight: canvas.height,
            newWidth: bounds.width,
            newHeight: bounds.height,
        });
        
        // Resize and restore
        canvas.resizeCanvas(bounds.width, bounds.height);
        const ctx = canvas.getMainContext();
        ctx.drawImage(croppedCanvas, 0, 0);
        
        this.app.modules.historyManager?.endOperation();
        this.app.markAsModified();
        this.app.showToast('تصویر برش خورد', 'success');
    }

    /**
     * Crop image to specified rectangle
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     */
    cropImage(x, y, width, height) {
        this.cropToSelection({ x, y, width, height });
    }

    /**
     * Apply a filter to the entire canvas
     * @param {string} filterType - Filter type identifier
     * @param {Object} [options] - Filter options
     */
    applyFilter(filterType, options = {}) {
        const filterConfig = this.filters[filterType];
        if (!filterConfig) {
            this.app.showToast('فیلتر نامعتبر است', 'error');
            return;
        }
        
        const ctx = this.app.modules.canvasManager?.getMainContext();
        if (!ctx) return;
        
        const canvas = ctx.canvas;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Record for undo
        this.app.modules.historyManager?.beginOperation({
            type: 'filter',
            filterType,
            options,
        });
        
        let processedData;
        
        switch (filterType) {
            case 'blur':
                processedData = this.applyBlur(imageData, options.radius || filterConfig.radius);
                break;
            case 'sharpen':
                processedData = this.applySharpen(imageData, options.amount || filterConfig.amount);
                break;
            case 'grayscale':
                processedData = this.applyGrayscale(imageData);
                break;
            case 'invert':
                processedData = this.applyInvert(imageData);
                break;
            case 'sepia':
                processedData = this.applySepia(imageData);
                break;
            case 'brightness':
                processedData = this.applyBrightness(imageData, options.value || filterConfig.value);
                break;
            case 'contrast':
                processedData = this.applyContrast(imageData, options.value || filterConfig.value);
                break;
            case 'hue':
                processedData = this.applyHueRotation(imageData, options.value || filterConfig.value);
                break;
            case 'saturation':
                processedData = this.applySaturation(imageData, options.value || filterConfig.value);
                break;
            default:
                processedData = imageData;
        }
        
        ctx.putImageData(processedData, 0, 0);
        
        this.app.modules.historyManager?.endOperation();
        this.app.markAsModified();
        this.app.modules.canvasManager?.scheduleRender();
        this.app.showToast(`فیلتر ${filterType} اعمال شد`, 'success');
    }

    /**
     * Apply blur filter using convolution
     * @param {ImageData} imageData 
     * @param {number} radius - Blur radius
     * @returns {ImageData}
     */
    applyBlur(imageData, radius = 5) {
        // Box blur approximation
        const kernel = this.createBlurKernel(radius);
        return this.applyConvolution(imageData, kernel);
    }

    /**
     * Create blur kernel matrix
     * @param {number} radius 
     * @returns {Float32Array}
     */
    createBlurKernel(radius) {
        const size = Math.floor(radius) * 2 + 1;
        const kernel = new Float32Array(size * size);
        const value = 1 / (size * size);
        kernel.fill(value);
        return kernel;
    }

    /**
     * Apply sharpen filter
     * @param {ImageData} imageData 
     * @param {number} amount - Sharpen intensity (0-100)
     * @returns {ImageData}
     */
    applySharpen(imageData, amount = 50) {
        const factor = amount / 50; // Normalize to 0-2
        const center = 1 + 4 * factor;
        const edge = -factor;
        
        const kernel = new Float32Array([
            0, edge, 0,
            edge, center, edge,
            0, edge, 0,
        ]);
        
        return this.applyConvolution(imageData, kernel, 3);
    }

    /**
     * Apply grayscale filter
     * @param {ImageData} imageData 
     * @returns {ImageData}
     */
    applyGrayscale(imageData) {
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }
        
        return imageData;
    }

    /**
     * Apply invert filter
     * @param {ImageData} imageData 
     * @returns {ImageData}
     */
    applyInvert(imageData) {
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
        }
        
        return imageData;
    }

    /**
     * Apply sepia filter
     * @param {ImageData} imageData 
     * @returns {ImageData}
     */
    applySepia(imageData) {
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
            data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
            data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
        }
        
        return imageData;
    }

    /**
     * Apply brightness adjustment
     * @param {ImageData} imageData 
     * @param {number} value - Brightness adjustment (-255 to 255)
     * @returns {ImageData}
     */
    applyBrightness(imageData, value = 0) {
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.max(0, Math.min(255, data[i] + value));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + value));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + value));
        }
        
        return imageData;
    }

    /**
     * Apply contrast adjustment
     * @param {ImageData} imageData 
     * @param {number} value - Contrast value (-100 to 100)
     * @returns {ImageData}
     */
    applyContrast(imageData, value = 0) {
        const data = imageData.data;
        const factor = (259 * (value + 255)) / (255 * (259 - value));
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
            data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
            data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
        }
        
        return imageData;
    }

    /**
     * Apply hue rotation
     * @param {ImageData} imageData 
     * @param {number} degrees - Rotation angle (0-360)
     * @returns {ImageData}
     */
    applyHueRotation(imageData, degrees = 0) {
        const data = imageData.data;
        const angle = degrees * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i] / 255;
            const g = data[i + 1] / 255;
            const b = data[i + 2] / 255;
            
            // Convert to YIQ, rotate, and convert back
            const y = 0.299 * r + 0.587 * g + 0.114 * b;
            const u = -0.14713 * r - 0.28886 * g + 0.436 * b;
            const v = 0.615 * r - 0.51499 * g - 0.10001 * b;
            
            const newU = u * cos - v * sin;
            const newV = u * sin + v * cos;
            
            data[i] = Math.max(0, Math.min(255, Math.round((y + 1.13983 * newV) * 255)));
            data[i + 1] = Math.max(0, Math.min(255, Math.round((y - 0.39465 * newU - 0.5806 * newV) * 255)));
            data[i + 2] = Math.max(0, Math.min(255, Math.round((y + 2.03211 * newU) * 255)));
        }
        
        return imageData;
    }

    /**
     * Apply saturation adjustment
     * @param {ImageData} imageData 
     * @param {number} value - Saturation value (-100 to 100)
     * @returns {ImageData}
     */
    applySaturation(imageData, value = 0) {
        const data = imageData.data;
        const factor = 1 + value / 100;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Convert to HSL, adjust saturation, convert back
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            
            data[i] = Math.max(0, Math.min(255, gray + factor * (r - gray)));
            data[i + 1] = Math.max(0, Math.min(255, gray + factor * (g - gray)));
            data[i + 2] = Math.max(0, Math.min(255, gray + factor * (b - gray)));
        }
        
        return imageData;
    }

    /**
     * Apply convolution filter to image data
     * @param {ImageData} imageData 
     * @param {Float32Array} kernel - Convolution kernel
     * @param {number} [kernelSize] - Kernel size (must be odd)
     * @returns {ImageData}
     */
    applyConvolution(imageData, kernel, kernelSize = null) {
        const srcData = new Uint8ClampedArray(imageData.data);
        const width = imageData.width;
        const height = imageData.height;
        const size = kernelSize || Math.sqrt(kernel.length);
        const half = Math.floor(size / 2);
        const output = new ImageData(width, height);
        const dstData = output.data;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, a = 0;
                
                for (let ky = 0; ky < size; ky++) {
                    for (let kx = 0; kx < size; kx++) {
                        const px = Math.min(Math.max(x + kx - half, 0), width - 1);
                        const py = Math.min(Math.max(y + ky - half, 0), height - 1);
                        const srcIndex = (py * width + px) * 4;
                        const kernelValue = kernel[ky * size + kx];
                        
                        r += srcData[srcIndex] * kernelValue;
                        g += srcData[srcIndex + 1] * kernelValue;
                        b += srcData[srcIndex + 2] * kernelValue;
                        a += srcData[srcIndex + 3] * kernelValue;
                    }
                }
                
                const dstIndex = (y * width + x) * 4;
                dstData[dstIndex] = Math.max(0, Math.min(255, r));
                dstData[dstIndex + 1] = Math.max(0, Math.min(255, g));
                dstData[dstIndex + 2] = Math.max(0, Math.min(255, b));
                dstData[dstIndex + 3] = Math.max(0, Math.min(255, a));
            }
        }
        
        return output;
    }

    /**
     * Get convolution kernel for common filters
     * @param {string} type 
     * @returns {Float32Array|null}
     */
    getConvolutionMatrix(type) {
        const matrices = {
            'edge-detect': new Float32Array([
                -1, -1, -1,
                -1, 8, -1,
                -1, -1, -1,
            ]),
            'emboss': new Float32Array([
                -2, -1, 0,
                -1, 1, 1,
                0, 1, 2,
            ]),
            'mean-removal': new Float32Array([
                -1, -1, -1,
                -1, 9, -1,
                -1, -1, -1,
            ]),
        };
        
        return matrices[type] || null;
    }

    /**
     * Destroy image processor
     */
    destroy() {
        this.loadedImages = [];
        this.currentImage = null;
        
        console.log('Image Processor destroyed');
    }
}

export default ImageProcessor;

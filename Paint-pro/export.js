// ============================================
// Paint Pro - Professional Paint Application
// export.js - Export Manager Module
// Export to PNG, JPEG, WEBP, PDF with
// quality settings and multi-page support
// ============================================

import { Utils } from './utils.js';

/**
 * @class ExportManager
 * @description Handles all export operations including
 * raster formats (PNG, JPEG, WEBP), PDF export,
 * quality settings, and batch export
 */
export class ExportManager {
    /**
     * @param {Object} app - Reference to main application instance
     */
    constructor(app) {
        this.app = app;
        
        // Export settings
        this.settings = {
            format: 'png',
            quality: 1,
            backgroundColor: '#FFFFFF',
            includeBackground: true,
            scale: 1,
            exportAllPages: false,
        };
        
        // Supported formats
        this.formats = {
            png: {
                mimeType: 'image/png',
                extension: 'png',
                lossless: true,
                supportsAlpha: true,
            },
            jpeg: {
                mimeType: 'image/jpeg',
                extension: 'jpg',
                lossless: false,
                supportsAlpha: false,
                quality: 0.92,
            },
            webp: {
                mimeType: 'image/webp',
                extension: 'webp',
                lossless: false,
                supportsAlpha: true,
                quality: 0.92,
            },
        };
        
        // Bind methods
        this.init = this.init.bind(this);
        this.exportImage = this.exportImage.bind(this);
        this.exportPNG = this.exportPNG.bind(this);
        this.exportJPEG = this.exportJPEG.bind(this);
        this.exportWEBP = this.exportWEBP.bind(this);
        this.exportPDF = this.exportPDF.bind(this);
        this.exportMultiPagePDF = this.exportMultiPagePDF.bind(this);
        this.downloadFile = this.downloadFile.bind(this);
        this.copyToClipboard = this.copyToClipboard.bind(this);
        this.getExportCanvas = this.getExportCanvas.bind(this);
        this.showExportDialog = this.showExportDialog.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    /**
     * Initialize export manager
     * @returns {Promise<void>}
     */
    async init() {
        try {
            console.log('Export Manager initialized');
        } catch (error) {
            console.error('Failed to initialize Export Manager:', error);
            throw error;
        }
    }

    /**
     * Export image in specified format
     * @param {Object} [options] - Export options
     * @returns {Promise<Blob>}
     */
    async exportImage(options = {}) {
        const settings = { ...this.settings, ...options };
        const format = this.formats[settings.format];
        
        if (!format) {
            throw new Error(`Unsupported format: ${settings.format}`);
        }
        
        const exportCanvas = this.getExportCanvas(settings);
        
        return new Promise((resolve, reject) => {
            if (settings.format === 'jpeg') {
                // For JPEG, we need to handle the background
                const jpegCanvas = document.createElement('canvas');
                jpegCanvas.width = exportCanvas.width;
                jpegCanvas.height = exportCanvas.height;
                const jpegCtx = jpegCanvas.getContext('2d');
                
                // Fill background
                jpegCtx.fillStyle = settings.backgroundColor || '#FFFFFF';
                jpegCtx.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
                
                // Draw content
                jpegCtx.drawImage(exportCanvas, 0, 0);
                
                jpegCanvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to create JPEG blob'));
                        }
                    },
                    format.mimeType,
                    settings.quality || format.quality || 0.92
                );
            } else {
                exportCanvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to create blob'));
                        }
                    },
                    format.mimeType,
                    settings.quality || format.quality || 1
                );
            }
        });
    }

    /**
     * Export as PNG
     * @param {Object} [options] - Export options
     * @returns {Promise<void>}
     */
    async exportPNG(options = {}) {
        try {
            const blob = await this.exportImage({ ...options, format: 'png' });
            this.downloadFile(blob, this.generateFilename('png'));
            this.app.showToast('تصویر PNG ذخیره شد', 'success');
        } catch (error) {
            console.error('PNG export failed:', error);
            this.app.showToast('خطا در خروجی PNG', 'error');
        }
    }

    /**
     * Export as JPEG
     * @param {Object} [options] - Export options
     * @returns {Promise<void>}
     */
    async exportJPEG(options = {}) {
        try {
            const blob = await this.exportImage({ ...options, format: 'jpeg' });
            this.downloadFile(blob, this.generateFilename('jpg'));
            this.app.showToast('تصویر JPEG ذخیره شد', 'success');
        } catch (error) {
            console.error('JPEG export failed:', error);
            this.app.showToast('خطا در خروجی JPEG', 'error');
        }
    }

    /**
     * Export as WEBP
     * @param {Object} [options] - Export options
     * @returns {Promise<void>}
     */
    async exportWEBP(options = {}) {
        try {
            const blob = await this.exportImage({ ...options, format: 'webp' });
            this.downloadFile(blob, this.generateFilename('webp'));
            this.app.showToast('تصویر WEBP ذخیره شد', 'success');
        } catch (error) {
            console.error('WEBP export failed:', error);
            this.app.showToast('خطا در خروجی WEBP', 'error');
        }
    }

    /**
     * Export as PDF
     * @param {Object} [options] - PDF options
     * @returns {Promise<void>}
     */
    async exportPDF(options = {}) {
        try {
            const pages = this.app.modules.canvasManager?.getPages();
            
            if (options.exportAllPages && pages && pages.length > 1) {
                await this.exportMultiPagePDF(pages, options);
            } else {
                await this.exportSinglePagePDF(options);
            }
            
            this.app.showToast('فایل PDF ذخیره شد', 'success');
        } catch (error) {
            console.error('PDF export failed:', error);
            this.app.showToast('خطا در خروجی PDF', 'error');
        }
    }

    /**
     * Export single page as PDF
     * @param {Object} [options] - PDF options
     * @returns {Promise<void>}
     */
    async exportSinglePagePDF(options = {}) {
        const exportCanvas = this.getExportCanvas(options);
        const imgData = exportCanvas.toDataURL('image/jpeg', 0.95);
        
        // Create PDF using jsPDF-like approach (basic implementation)
        const pdfContent = this.generatePDFContent(imgData, {
            width: exportCanvas.width,
            height: exportCanvas.height,
            title: options.title || this.app.state.documentName || 'بدون عنوان',
        });
        
        const blob = new Blob([pdfContent], { type: 'application/pdf' });
        this.downloadFile(blob, this.generateFilename('pdf'));
    }

    /**
     * Export multiple pages as PDF
     * @param {Array} pages - Array of page objects
     * @param {Object} [options] - PDF options
     * @returns {Promise<void>}
     */
    async exportMultiPagePDF(pages, options = {}) {
        const images = [];
        
        for (const page of pages) {
            // Switch to page temporarily to get its content
            // This is a simplified approach; in production, you'd render each page
            const pageCanvas = await this.renderPageToCanvas(page);
            const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
            images.push(imgData);
        }
        
        const pdfContent = this.generateMultiPagePDFContent(images, {
            width: this.app.modules.canvasManager.width,
            height: this.app.modules.canvasManager.height,
            title: options.title || 'Paint Pro Document',
        });
        
        const blob = new Blob([pdfContent], { type: 'application/pdf' });
        this.downloadFile(blob, this.generateFilename('pdf'));
    }

    /**
     * Render a page to canvas
     * @param {Object} page - Page object
     * @returns {Promise<HTMLCanvasElement>}
     */
    async renderPageToCanvas(page) {
        const canvas = document.createElement('canvas');
        canvas.width = page.width || 1920;
        canvas.height = page.height || 1080;
        const ctx = canvas.getContext('2d');
        
        // Fill background
        ctx.fillStyle = page.backgroundColor || '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw page content if available
        if (page.canvasData) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas);
                };
                img.src = page.canvasData;
            });
        }
        
        return canvas;
    }

    /**
     * Generate basic PDF content
     * @param {string} imgData - Base64 image data
     * @param {Object} dimensions - Page dimensions
     * @returns {string} PDF content as string
     */
    generatePDFContent(imgData, dimensions) {
        // Simple PDF generation (basic implementation)
        // For production, consider using a PDF library
        const { width, height, title } = dimensions;
        
        // Convert pixels to points (72 DPI approximation)
        const ptWidth = (width / 96) * 72;
        const ptHeight = (height / 96) * 72;
        
        const pdf = [
            '%PDF-1.4',
            '1 0 obj',
            '<<',
            '/Type /Catalog',
            '/Pages 2 0 R',
            '>>',
            'endobj',
            '2 0 obj',
            '<<',
            '/Type /Pages',
            '/Kids [3 0 R]',
            '/Count 1',
            '>>',
            'endobj',
            '3 0 obj',
            '<<',
            '/Type /Page',
            '/Parent 2 0 R',
            `/MediaBox [0 0 ${ptWidth} ${ptHeight}]`,
            '/Resources << /XObject << /Img0 4 0 R >> >>',
            '/Contents 5 0 R',
            '>>',
            'endobj',
            '4 0 obj',
            '<<',
            '/Type /XObject',
            '/Subtype /Image',
            `/Width ${width}`,
            `/Height ${height}`,
            '/ColorSpace /DeviceRGB',
            '/BitsPerComponent 8',
            '/Filter /DCTDecode',
            `/Length ${imgData.length}`,
            '>>',
            'stream',
            imgData,
            'endstream',
            'endobj',
            '5 0 obj',
            '<< /Length 44 >>',
            'stream',
            'q',
            `${ptWidth} 0 0 ${ptHeight} 0 0 cm`,
            '/Img0 Do',
            'Q',
            'endstream',
            'endobj',
            'xref',
            '0 6',
            '0000000000 65535 f',
            '0000000009 00000 n',
            '0000000058 00000 n',
            '0000000115 00000 n',
            '0000000266 00000 n',
            '0000000432 00000 n',
            'trailer',
            '<<',
            '/Size 6',
            '/Root 1 0 R',
            '>>',
            'startxref',
            '500',
            '%%EOF',
        ].join('\n');
        
        return pdf;
    }

    /**
     * Generate multi-page PDF content
     * @param {Array} images - Array of base64 image data
     * @param {Object} dimensions - Page dimensions
     * @returns {string} PDF content
     */
    generateMultiPagePDFContent(images, dimensions) {
        // Simplified multi-page PDF (for demonstration)
        // Each page contains one image
        const parts = ['%PDF-1.4'];
        const pageCount = images.length;
        
        // Catalog
        parts.push('1 0 obj', '<<', '/Type /Catalog', '/Pages 2 0 R', '>>', 'endobj');
        
        // Pages
        const kids = Array.from({ length: pageCount }, (_, i) => `${i + 3} 0 R`).join(' ');
        parts.push('2 0 obj', '<<', '/Type /Pages', `/Kids [${kids}]`, `/Count ${pageCount}`, '>>', 'endobj');
        
        // Individual pages and images
        for (let i = 0; i < pageCount; i++) {
            const imgObjNum = 3 + pageCount + i;
            const contentObjNum = imgObjNum + pageCount;
            
            parts.push(
                `${3 + i} 0 obj`,
                '<<',
                '/Type /Page',
                '/Parent 2 0 R',
                `/MediaBox [0 0 ${dimensions.width} ${dimensions.height}]`,
                `/Resources << /XObject << /Img${i} ${imgObjNum} 0 R >> >>`,
                `/Contents ${contentObjNum} 0 R`,
                '>>',
                'endobj'
            );
        }
        
        // This is a simplified representation
        // A full PDF generator would include proper xref tables and stream objects
        
        return parts.join('\n');
    }

    /**
     * Get export canvas with all layers composited
     * @param {Object} settings - Export settings
     * @returns {HTMLCanvasElement}
     */
    getExportCanvas(settings = {}) {
        const scale = settings.scale || 1;
        const canvas = this.app.modules.canvasManager;
        
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = Math.round(canvas.width * scale);
        exportCanvas.height = Math.round(canvas.height * scale);
        const exportCtx = exportCanvas.getContext('2d');
        
        // Scale context
        exportCtx.scale(scale, scale);
        
        // Fill background if required
        if (settings.includeBackground !== false) {
            exportCtx.fillStyle = settings.backgroundColor || '#FFFFFF';
            exportCtx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Composite all layers
        if (this.app.modules.layerManager) {
            this.app.modules.layerManager.compositeLayers(exportCtx);
        } else {
            exportCtx.drawImage(canvas.mainCanvas, 0, 0);
        }
        
        return exportCanvas;
    }

    /**
     * Download file to user's device
     * @param {Blob} blob - File blob
     * @param {string} filename - File name
     */
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * Copy image to clipboard
     * @param {Object} [options] - Export options
     * @returns {Promise<void>}
     */
    async copyToClipboard(options = {}) {
        try {
            const exportCanvas = this.getExportCanvas(options);
            const blob = await new Promise(resolve => {
                exportCanvas.toBlob(resolve, 'image/png');
            });
            
            if (blob) {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                this.app.showToast('تصویر در کلیپ‌بورد کپی شد', 'success');
            }
        } catch (error) {
            console.error('Copy to clipboard failed:', error);
            this.app.showToast('خطا در کپی به کلیپ‌بورد', 'error');
        }
    }

    /**
     * Generate filename based on document name and format
     * @param {string} extension - File extension
     * @returns {string}
     */
    generateFilename(extension) {
        const docName = this.app.state.documentName || 'بدون عنوان';
        const safeName = docName.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '_');
        const date = new Date().toISOString().slice(0, 10);
        
        return `${safeName}_${date}.${extension}`;
    }

    /**
     * Show export dialog
     */
    showExportDialog() {
        const content = `
            <div class="export-options">
                <div class="format-buttons">
                    <h4>فرمت خروجی</h4>
                    <div class="button-group">
                        <button class="btn" onclick="window.PaintProApp.modules.exportManager.exportPNG()">
                            <span class="material-symbols-outlined">image</span>
                            PNG
                        </button>
                        <button class="btn" onclick="window.PaintProApp.modules.exportManager.exportJPEG()">
                            <span class="material-symbols-outlined">photo</span>
                            JPEG
                        </button>
                        <button class="btn" onclick="window.PaintProApp.modules.exportManager.exportWEBP()">
                            <span class="material-symbols-outlined">photo_library</span>
                            WEBP
                        </button>
                        <button class="btn" onclick="window.PaintProApp.modules.exportManager.exportPDF()">
                            <span class="material-symbols-outlined">picture_as_pdf</span>
                            PDF
                        </button>
                    </div>
                </div>
                <div class="quality-settings" style="margin-top: 16px;">
                    <h4>کیفیت</h4>
                    <div class="slider-group">
                        <label>کیفیت: <span id="export-quality-value">100%</span></label>
                        <input type="range" id="export-quality" min="10" max="100" value="100"
                               oninput="document.getElementById('export-quality-value').textContent = this.value + '%'">
                    </div>
                </div>
                <div class="scale-settings" style="margin-top: 16px;">
                    <h4>مقیاس</h4>
                    <div class="slider-group">
                        <label>مقیاس: <span id="export-scale-value">1x</span></label>
                        <input type="range" id="export-scale" min="1" max="4" value="1"
                               oninput="document.getElementById('export-scale-value').textContent = this.value + 'x'">
                    </div>
                </div>
            </div>
        `;
        
        const footer = `
            <button class="btn" onclick="this.closest('.modal-wrapper').remove()">انصراف</button>
            <button class="btn btn-primary" onclick="window.PaintProApp.modules.exportManager.exportWithDialogSettings()">
                خروجی
            </button>
        `;
        
        this.app.showModal({
            title: 'خروجی تصویر',
            content,
            footer,
        });
    }

    /**
     * Export with settings from dialog
     */
    exportWithDialogSettings() {
        const qualitySlider = document.getElementById('export-quality');
        const scaleSlider = document.getElementById('export-scale');
        
        const quality = qualitySlider ? parseInt(qualitySlider.value) / 100 : 1;
        const scale = scaleSlider ? parseInt(scaleSlider.value) : 1;
        
        this.exportImage({ quality, scale }).then(blob => {
            const format = this.settings.format;
            const ext = this.formats[format]?.extension || 'png';
            this.downloadFile(blob, this.generateFilename(ext));
            this.app.showToast('فایل با موفقیت ذخیره شد', 'success');
            
            // Close modal
            const modalWrapper = document.querySelector('.modal-wrapper');
            if (modalWrapper) {
                modalWrapper.remove();
            }
        }).catch(error => {
            console.error('Export failed:', error);
            this.app.showToast('خطا در خروجی فایل', 'error');
        });
    }

    /**
     * Set export format
     * @param {string} format - 'png', 'jpeg', or 'webp'
     */
    setFormat(format) {
        if (this.formats[format]) {
            this.settings.format = format;
        }
    }

    /**
     * Set export quality
     * @param {number} quality - 0 to 1
     */
    setQuality(quality) {
        this.settings.quality = Math.max(0, Math.min(1, quality));
    }

    /**
     * Get export settings
     * @returns {Object}
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Destroy export manager
     */
    destroy() {
        console.log('Export Manager destroyed');
    }
}

export default ExportManager;

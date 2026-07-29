// ============================================
// Paint Pro - Professional Paint Application
// settings.js - Settings Manager Module
// Application settings, preferences,
// configuration management with persistence
// ============================================

import { Utils } from './utils.js';

/**
 * @class SettingsManager
 * @description Manages all application settings and preferences
 * including theme, grid, rulers, guides, keyboard shortcuts,
 * and performance options with persistent storage
 */
export class SettingsManager {
    /**
     * @param {Object} app - Reference to main application instance
     */
    constructor(app) {
        this.app = app;
        
        // Default settings
        this.defaults = {
            // Appearance
            theme: 'dark',
            language: 'fa',
            direction: 'rtl',
            fontSize: 'medium',
            
            // Canvas
            defaultCanvasWidth: 1920,
            defaultCanvasHeight: 1080,
            backgroundColor: '#FFFFFF',
            backgroundAlpha: 1,
            
            // Grid & Guides
            gridEnabled: false,
            gridSize: 20,
            gridColor: 'rgba(128, 128, 128, 0.3)',
            snapEnabled: false,
            snapThreshold: 10,
            rulersEnabled: false,
            guidesEnabled: false,
            
            // Performance
            performanceMode: false,
            maxUndoSteps: 1000,
            autoSaveEnabled: true,
            autoSaveInterval: 60000,
            
            // Brush defaults
            defaultBrushSize: 10,
            defaultBrushOpacity: 1,
            defaultBrushFlow: 1,
            defaultBrushHardness: 0.5,
            
            // Export
            defaultExportFormat: 'png',
            defaultExportQuality: 1,
            defaultExportScale: 1,
            
            // UI
            showStatusBar: true,
            showToolbar: true,
            showSidePanel: true,
            compactMode: false,
            
            // Touch
            palmRejection: true,
            touchSensitivity: 0.5,
            
            // Recent
            recentColors: [],
            maxRecentColors: 20,
            recentFiles: [],
            maxRecentFiles: 10,
        };
        
        // Current settings (merged with defaults)
        this.settings = { ...this.defaults };
        
        // Settings change listeners
        this.listeners = new Map();
        
        // Bind methods
        this.init = this.init.bind(this);
        this.loadSettings = this.loadSettings.bind(this);
        this.saveSettings = this.saveSettings.bind(this);
        this.getSetting = this.getSetting.bind(this);
        this.setSetting = this.setSetting.bind(this);
        this.resetSetting = this.resetSetting.bind(this);
        this.resetAllSettings = this.resetAllSettings.bind(this);
        this.openSettingsModal = this.openSettingsModal.bind(this);
        this.addChangeListener = this.addChangeListener.bind(this);
        this.removeChangeListener = this.removeChangeListener.bind(this);
        this.getRecentColors = this.getRecentColors.bind(this);
        this.addRecentColor = this.addRecentColor.bind(this);
        this.getRecentFiles = this.getRecentFiles.bind(this);
        this.addRecentFile = this.addRecentFile.bind(this);
        this.exportSettings = this.exportSettings.bind(this);
        this.importSettings = this.importSettings.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    /**
     * Initialize settings manager
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Load saved settings
            await this.loadSettings();
            
            // Apply loaded settings
            this.applySettings();
            
            console.log('Settings Manager initialized');
        } catch (error) {
            console.error('Failed to initialize Settings Manager:', error);
            throw error;
        }
    }

    /**
     * Load settings from storage
     * @returns {Promise<void>}
     */
    async loadSettings() {
        try {
            const saved = this.app.modules.storageManager?.loadSettingsFromLocal();
            
            if (saved && saved.settings) {
                // Merge saved settings with defaults
                this.settings = { ...this.defaults, ...saved.settings };
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
            this.settings = { ...this.defaults };
        }
    }

    /**
     * Save settings to storage
     * @returns {Promise<void>}
     */
    async saveSettings() {
        try {
            await this.app.modules.storageManager?.saveSettings('settings', this.settings);
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }

    /**
     * Apply loaded settings to application
     */
    applySettings() {
        // Apply theme
        if (this.settings.theme) {
            this.app.applyTheme(this.settings.theme);
        }
        
        // Apply grid
        if (this.settings.gridEnabled) {
            this.app.state.gridEnabled = this.settings.gridEnabled;
            this.app.modules.canvasManager?.setGridVisible(this.settings.gridEnabled);
            this.app.modules.canvasManager?.setGridSize(this.settings.gridSize);
        }
        
        // Apply performance settings
        if (this.settings.maxUndoSteps) {
            this.app.modules.historyManager?.setMaxSteps(this.settings.maxUndoSteps);
        }
        
        // Apply auto-save
        if (this.app.modules.storageManager) {
            this.app.modules.storageManager.setAutoSaveEnabled(this.settings.autoSaveEnabled);
            this.app.modules.storageManager.setAutoSaveInterval(this.settings.autoSaveInterval);
        }
        
        // Apply UI settings
        if (!this.settings.showStatusBar) {
            this.app.elements.statusBar.style.display = 'none';
        }
        
        if (this.settings.compactMode) {
            document.body.classList.add('compact-mode');
        }
    }

    /**
     * Get a setting value
     * @param {string} key - Setting key
     * @param {*} [defaultValue] - Default value if not found
     * @returns {*}
     */
    getSetting(key, defaultValue = null) {
        return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    }

    /**
     * Set a setting value
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     * @returns {Promise<void>}
     */
    async setSetting(key, value) {
        const oldValue = this.settings[key];
        this.settings[key] = value;
        
        // Notify listeners
        this.notifyListeners(key, value, oldValue);
        
        // Auto-save settings
        await this.saveSettings();
        
        // Apply setting immediately if needed
        this.applySettingChange(key, value);
    }

    /**
     * Apply a setting change immediately
     * @param {string} key 
     * @param {*} value 
     */
    applySettingChange(key, value) {
        switch (key) {
            case 'theme':
                this.app.applyTheme(value);
                break;
                
            case 'gridEnabled':
                this.app.state.gridEnabled = value;
                this.app.modules.canvasManager?.setGridVisible(value);
                break;
                
            case 'gridSize':
                this.app.modules.canvasManager?.setGridSize(value);
                break;
                
            case 'snapEnabled':
                this.app.state.snapEnabled = value;
                break;
                
            case 'rulersEnabled':
                this.app.state.rulersEnabled = value;
                break;
                
            case 'maxUndoSteps':
                this.app.modules.historyManager?.setMaxSteps(value);
                break;
                
            case 'autoSaveEnabled':
                this.app.modules.storageManager?.setAutoSaveEnabled(value);
                break;
                
            case 'autoSaveInterval':
                this.app.modules.storageManager?.setAutoSaveInterval(value);
                break;
                
            case 'performanceMode':
                this.app.state.performanceMode = value;
                break;
                
            case 'showStatusBar':
                this.app.elements.statusBar.style.display = value ? 'flex' : 'none';
                break;
                
            case 'compactMode':
                document.body.classList.toggle('compact-mode', value);
                break;
        }
    }

    /**
     * Reset a setting to its default value
     * @param {string} key 
     * @returns {Promise<void>}
     */
    async resetSetting(key) {
        if (this.defaults[key] !== undefined) {
            await this.setSetting(key, this.defaults[key]);
        }
    }

    /**
     * Reset all settings to defaults
     * @returns {Promise<void>}
     */
    async resetAllSettings() {
        this.settings = { ...this.defaults };
        await this.saveSettings();
        this.applySettings();
        this.app.showToast('تنظیمات به حالت پیش‌فرض بازگشت', 'info');
    }

    /**
     * Open settings modal dialog
     */
    openSettingsModal() {
        const content = this.generateSettingsHTML();
        
        const footer = `
            <button class="btn" onclick="window.PaintProApp.modules.settingsManager.resetAllSettings(); document.querySelector('.modal-wrapper').remove();">
                بازنشانی همه
            </button>
            <button class="btn btn-primary" onclick="window.PaintProApp.modules.settingsManager.saveSettingsFromModal(); document.querySelector('.modal-wrapper').remove();">
                ذخیره تنظیمات
            </button>
        `;
        
        this.app.showModal({
            title: 'تنظیمات',
            content,
            footer,
            size: 'large',
        });
        
        // Initialize modal values
        setTimeout(() => this.initializeModalValues(), 100);
    }

    /**
     * Generate settings HTML content
     * @returns {string}
     */
    generateSettingsHTML() {
        return `
            <div class="settings-tabs">
                <div class="settings-section">
                    <h3>ظاهر</h3>
                    <div class="setting-item">
                        <label>پوسته</label>
                        <select id="setting-theme">
                            <option value="dark">تاریک</option>
                            <option value="light">روشن</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <label>اندازه قلم رابط کاربری</label>
                        <select id="setting-fontSize">
                            <option value="small">کوچک</option>
                            <option value="medium" selected>متوسط</option>
                            <option value="large">بزرگ</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <label>
                            <input type="checkbox" id="setting-compactMode">
                            حالت فشرده
                        </label>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3>بوم نقاشی</h3>
                    <div class="setting-item">
                        <label>اندازه پیش‌فرض عرض</label>
                        <input type="number" id="setting-defaultCanvasWidth" min="100" max="8000" step="1">
                    </div>
                    <div class="setting-item">
                        <label>اندازه پیش‌فرض ارتفاع</label>
                        <input type="number" id="setting-defaultCanvasHeight" min="100" max="8000" step="1">
                    </div>
                    <div class="setting-item">
                        <label>رنگ پس‌زمینه</label>
                        <input type="color" id="setting-backgroundColor">
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3>شبکه و راهنما</h3>
                    <div class="setting-item">
                        <label>
                            <input type="checkbox" id="setting-gridEnabled">
                            فعال‌سازی شبکه
                        </label>
                    </div>
                    <div class="setting-item">
                        <label>اندازه شبکه: <span id="grid-size-display">20</span>px</label>
                        <input type="range" id="setting-gridSize" min="5" max="100" value="20"
                               oninput="document.getElementById('grid-size-display').textContent = this.value">
                    </div>
                    <div class="setting-item">
                        <label>
                            <input type="checkbox" id="setting-snapEnabled">
                            چسبیدن به شبکه
                        </label>
                    </div>
                    <div class="setting-item">
                        <label>
                            <input type="checkbox" id="setting-rulersEnabled">
                            خط‌کش
                        </label>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3>عملکرد</h3>
                    <div class="setting-item">
                        <label>حداکثر مراحل بازگشت (Undo)</label>
                        <input type="number" id="setting-maxUndoSteps" min="10" max="5000" step="10">
                    </div>
                    <div class="setting-item">
                        <label>
                            <input type="checkbox" id="setting-autoSaveEnabled">
                            ذخیره خودکار
                        </label>
                    </div>
                    <div class="setting-item">
                        <label>فاصله ذخیره خودکار (ثانیه): <span id="autosave-interval-display">60</span></label>
                        <input type="range" id="setting-autoSaveInterval" min="10" max="300" value="60"
                               oninput="document.getElementById('autosave-interval-display').textContent = this.value">
                    </div>
                    <div class="setting-item">
                        <label>
                            <input type="checkbox" id="setting-performanceMode">
                            حالت عملکرد بالا (کاهش کیفیت نمایش)
                        </label>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3>خروجی</h3>
                    <div class="setting-item">
                        <label>فرمت پیش‌فرض</label>
                        <select id="setting-defaultExportFormat">
                            <option value="png">PNG</option>
                            <option value="jpeg">JPEG</option>
                            <option value="webp">WEBP</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <label>کیفیت پیش‌فرض: <span id="export-quality-display">100%</span></label>
                        <input type="range" id="setting-defaultExportQuality" min="10" max="100" value="100"
                               oninput="document.getElementById('export-quality-display').textContent = this.value + '%'">
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3>لمس</h3>
                    <div class="setting-item">
                        <label>
                            <input type="checkbox" id="setting-palmRejection">
                            جلوگیری از لمس کف دست
                        </label>
                    </div>
                    <div class="setting-item">
                        <label>حساسیت لمس: <span id="touch-sensitivity-display">50%</span></label>
                        <input type="range" id="setting-touchSensitivity" min="10" max="100" value="50"
                               oninput="document.getElementById('touch-sensitivity-display').textContent = this.value + '%'">
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Initialize modal values with current settings
     */
    initializeModalValues() {
        const mappings = {
            'setting-theme': 'theme',
            'setting-fontSize': 'fontSize',
            'setting-compactMode': 'compactMode',
            'setting-defaultCanvasWidth': 'defaultCanvasWidth',
            'setting-defaultCanvasHeight': 'defaultCanvasHeight',
            'setting-backgroundColor': 'backgroundColor',
            'setting-gridEnabled': 'gridEnabled',
            'setting-gridSize': 'gridSize',
            'setting-snapEnabled': 'snapEnabled',
            'setting-rulersEnabled': 'rulersEnabled',
            'setting-maxUndoSteps': 'maxUndoSteps',
            'setting-autoSaveEnabled': 'autoSaveEnabled',
            'setting-autoSaveInterval': 'autoSaveInterval',
            'setting-performanceMode': 'performanceMode',
            'setting-defaultExportFormat': 'defaultExportFormat',
            'setting-defaultExportQuality': 'defaultExportQuality',
            'setting-palmRejection': 'palmRejection',
            'setting-touchSensitivity': 'touchSensitivity',
        };
        
        for (const [elementId, settingKey] of Object.entries(mappings)) {
            const element = document.getElementById(elementId);
            if (!element) continue;
            
            const value = this.settings[settingKey];
            
            if (element.type === 'checkbox') {
                element.checked = value;
            } else if (element.type === 'range') {
                element.value = value;
                // Trigger display update
                element.dispatchEvent(new Event('input'));
            } else {
                element.value = value;
            }
        }
    }

    /**
     * Save settings from modal
     */
    async saveSettingsFromModal() {
        const mappings = {
            'setting-theme': 'theme',
            'setting-fontSize': 'fontSize',
            'setting-compactMode': 'compactMode',
            'setting-defaultCanvasWidth': 'defaultCanvasWidth',
            'setting-defaultCanvasHeight': 'defaultCanvasHeight',
            'setting-backgroundColor': 'backgroundColor',
            'setting-gridEnabled': 'gridEnabled',
            'setting-gridSize': 'gridSize',
            'setting-snapEnabled': 'snapEnabled',
            'setting-rulersEnabled': 'rulersEnabled',
            'setting-maxUndoSteps': 'maxUndoSteps',
            'setting-autoSaveEnabled': 'autoSaveEnabled',
            'setting-autoSaveInterval': 'autoSaveInterval',
            'setting-performanceMode': 'performanceMode',
            'setting-defaultExportFormat': 'defaultExportFormat',
            'setting-defaultExportQuality': 'defaultExportQuality',
            'setting-palmRejection': 'palmRejection',
            'setting-touchSensitivity': 'touchSensitivity',
        };
        
        for (const [elementId, settingKey] of Object.entries(mappings)) {
            const element = document.getElementById(elementId);
            if (!element) continue;
            
            let value;
            
            if (element.type === 'checkbox') {
                value = element.checked;
            } else if (element.type === 'range' || element.type === 'number') {
                value = element.type === 'range' ? parseInt(element.value) : parseFloat(element.value);
                if (isNaN(value)) value = this.defaults[settingKey];
            } else {
                value = element.value;
            }
            
            await this.setSetting(settingKey, value);
        }
        
        this.app.showToast('تنظیمات ذخیره شد', 'success');
    }

    /**
     * Add a change listener for a specific setting
     * @param {string} key - Setting key
     * @param {Function} callback - Callback function(newValue, oldValue)
     */
    addChangeListener(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
    }

    /**
     * Remove a change listener
     * @param {string} key 
     * @param {Function} callback 
     */
    removeChangeListener(key, callback) {
        if (this.listeners.has(key)) {
            const listeners = this.listeners.get(key);
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Notify all listeners of a setting change
     * @param {string} key 
     * @param {*} newValue 
     * @param {*} oldValue 
     */
    notifyListeners(key, newValue, oldValue) {
        if (this.listeners.has(key)) {
            this.listeners.get(key).forEach(callback => {
                try {
                    callback(newValue, oldValue);
                } catch (error) {
                    console.warn('Settings listener error:', error);
                }
            });
        }
    }

    /**
     * Get recent colors
     * @returns {Array}
     */
    getRecentColors() {
        return this.settings.recentColors || [];
    }

    /**
     * Add a color to recent colors
     * @param {string} color - Hex color string
     */
    async addRecentColor(color) {
        let recent = this.settings.recentColors || [];
        
        // Remove if already exists
        recent = recent.filter(c => c !== color);
        
        // Add to beginning
        recent.unshift(color);
        
        // Limit size
        if (recent.length > this.settings.maxRecentColors) {
            recent = recent.slice(0, this.settings.maxRecentColors);
        }
        
        this.settings.recentColors = recent;
        await this.saveSettings();
        
        // Update UI
        this.app.updateRecentColors?.();
    }

    /**
     * Get recent files
     * @returns {Array}
     */
    getRecentFiles() {
        return this.settings.recentFiles || [];
    }

    /**
     * Add a file to recent files
     * @param {Object} fileInfo - {name, path, id}
     */
    async addRecentFile(fileInfo) {
        let recent = this.settings.recentFiles || [];
        
        // Remove if already exists
        recent = recent.filter(f => f.id !== fileInfo.id);
        
        // Add to beginning
        recent.unshift(fileInfo);
        
        // Limit size
        if (recent.length > this.settings.maxRecentFiles) {
            recent = recent.slice(0, this.settings.maxRecentFiles);
        }
        
        this.settings.recentFiles = recent;
        await this.saveSettings();
    }

    /**
     * Export settings to JSON file
     */
    exportSettings() {
        const data = JSON.stringify(this.settings, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const filename = 'paintpro_settings.json';
        
        this.app.modules.exportManager?.downloadFile(blob, filename);
        this.app.showToast('تنظیمات خروجی گرفته شد', 'success');
    }

    /**
     * Import settings from JSON file
     * @param {File} file 
     * @returns {Promise<void>}
     */
    async importSettings(file) {
        try {
            const text = await file.text();
            const imported = JSON.parse(text);
            
            // Validate settings
            if (typeof imported !== 'object') {
                throw new Error('Invalid settings format');
            }
            
            // Merge with defaults (only import known settings)
            for (const key of Object.keys(this.defaults)) {
                if (imported[key] !== undefined) {
                    this.settings[key] = imported[key];
                }
            }
            
            await this.saveSettings();
            this.applySettings();
            
            this.app.showToast('تنظیمات وارد شد', 'success');
            
        } catch (error) {
            console.error('Import settings failed:', error);
            this.app.showToast('خطا در وارد کردن تنظیمات', 'error');
        }
    }

    /**
     * Get all current settings
     * @returns {Object}
     */
    getAllSettings() {
        return { ...this.settings };
    }

    /**
     * Destroy settings manager
     */
    destroy() {
        this.listeners.clear();
        
        console.log('Settings Manager destroyed');
    }
}

export default SettingsManager;

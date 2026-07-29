// ============================================
// Paint Pro - Professional Paint Application
// storage.js - Storage Manager Module
// Save/load projects in custom .paintproj format,
// auto-save, recovery, LocalStorage & IndexedDB
// ============================================

import { Utils } from './utils.js';

/**
 * @class StorageManager
 * @description Handles all storage operations including
 * project save/load, auto-save, recovery, and managing
 * both LocalStorage and IndexedDB backends
 */
export class StorageManager {
    /**
     * @param {Object} app - Reference to main application instance
     */
    constructor(app) {
        this.app = app;
        
        // Storage configuration
        this.dbName = 'PaintProDB';
        this.dbVersion = 1;
        this.storeName = 'projects';
        this.autoSaveKey = 'paintpro_autosave';
        this.recoveryKey = 'paintpro_recovery';
        this.settingsKey = 'paintpro_settings';
        
        // IndexedDB reference
        this.db = null;
        
        // Project metadata
        this.currentProjectId = null;
        this.currentProjectName = 'بدون عنوان';
        
        // Auto-save state
        this.autoSaveEnabled = true;
        this.autoSaveInterval = 60000; // 60 seconds
        this.lastAutoSave = 0;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.openDatabase = this.openDatabase.bind(this);
        this.saveProject = this.saveProject.bind(this);
        this.saveProjectAs = this.saveProjectAs.bind(this);
        this.openProject = this.openProject.bind(this);
        this.openProjectFromFile = this.openProjectFromFile.bind(this);
        this.autoSave = this.autoSave.bind(this);
        this.emergencySave = this.emergencySave.bind(this);
        this.recoverProject = this.recoverProject.bind(this);
        this.deleteProject = this.deleteProject.bind(this);
        this.listProjects = this.listProjects.bind(this);
        this.exportProjectFile = this.exportProjectFile.bind(this);
        this.importProjectFile = this.importProjectFile.bind(this);
        this.serializeProject = this.serializeProject.bind(this);
        this.deserializeProject = this.deserializeProject.bind(this);
        this.saveSettings = this.saveSettings.bind(this);
        this.loadSettings = this.loadSettings.bind(this);
        this.clearAutoSave = this.clearAutoSave.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    /**
     * Initialize storage manager
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Open IndexedDB
            await this.openDatabase();
            
            // Check for recovery data
            await this.checkRecovery();
            
            // Load settings
            await this.loadSettings();
            
            console.log('Storage Manager initialized');
        } catch (error) {
            console.error('Failed to initialize Storage Manager:', error);
            throw error;
        }
    }

    /**
     * Open IndexedDB database
     * @returns {Promise<IDBDatabase>}
     */
    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { 
                        keyPath: 'id' 
                    });
                    
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('lastModified', 'lastModified', { unique: false });
                    store.createIndex('created', 'created', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                
                if (!db.objectStoreNames.contains('thumbnails')) {
                    db.createObjectStore('thumbnails', { keyPath: 'projectId' });
                }
            };
        });
    }

    /**
     * Save current project
     * @param {string} [name] - Project name
     * @returns {Promise<string>} Project ID
     */
    async saveProject(name = null) {
        try {
            const projectData = this.serializeProject();
            
            if (name) {
                this.currentProjectName = name;
                this.app.state.documentName = name;
                this.app.elements.docName.textContent = name;
            }
            
            projectData.name = this.currentProjectName;
            projectData.lastModified = Date.now();
            
            if (!this.currentProjectId) {
                this.currentProjectId = Utils.generateUUID();
                projectData.id = this.currentProjectId;
                projectData.created = Date.now();
            } else {
                projectData.id = this.currentProjectId;
            }
            
            // Save to IndexedDB
            await this.saveToDB(projectData);
            
            // Save thumbnail
            await this.saveThumbnail(this.currentProjectId);
            
            // Clear auto-save
            this.clearAutoSave();
            
            // Update last modified
            this.app.state.isModified = false;
            
            return this.currentProjectId;
        } catch (error) {
            console.error('Failed to save project:', error);
            throw error;
        }
    }

    /**
     * Save project with a new name (Save As)
     * @param {string} name - New project name
     * @returns {Promise<string>} New project ID
     */
    async saveProjectAs(name) {
        this.currentProjectId = null;
        return this.saveProject(name);
    }

    /**
     * Open a project from IndexedDB
     * @param {string} [projectId] - Project ID to open, or show dialog
     * @returns {Promise<void>}
     */
    async openProject(projectId = null) {
        try {
            if (!projectId) {
                // Show project selection dialog
                this.showOpenProjectDialog();
                return;
            }
            
            const projectData = await this.loadFromDB(projectId);
            
            if (!projectData) {
                throw new Error('Project not found');
            }
            
            await this.deserializeProject(projectData);
            
            this.currentProjectId = projectId;
            this.currentProjectName = projectData.name || 'بدون عنوان';
            this.app.state.documentName = this.currentProjectName;
            this.app.elements.docName.textContent = this.currentProjectName;
            this.app.state.isModified = false;
            
        } catch (error) {
            console.error('Failed to open project:', error);
            throw error;
        }
    }

    /**
     * Open project from .paintproj file
     * @param {File} file - Project file
     * @returns {Promise<void>}
     */
    async openProjectFromFile(file) {
        try {
            const text = await file.text();
            const projectData = JSON.parse(text);
            
            // Validate project data
            if (!projectData.version || !projectData.canvas) {
                throw new Error('Invalid project file format');
            }
            
            await this.deserializeProject(projectData);
            
            this.currentProjectId = Utils.generateUUID();
            this.currentProjectName = projectData.name || file.name.replace('.paintproj', '');
            this.app.state.documentName = this.currentProjectName;
            this.app.elements.docName.textContent = this.currentProjectName;
            this.app.state.isModified = false;
            
            this.app.showToast('پروژه با موفقیت باز شد', 'success');
            
        } catch (error) {
            console.error('Failed to open project file:', error);
            this.app.showToast('خطا در باز کردن فایل پروژه', 'error');
            throw error;
        }
    }

    /**
     * Perform auto-save
     * @returns {Promise<void>}
     */
    async autoSave() {
        if (!this.autoSaveEnabled) return;
        
        const now = Date.now();
        if (now - this.lastAutoSave < this.autoSaveInterval) return;
        
        try {
            const projectData = this.serializeProject();
            projectData.name = this.currentProjectName + ' (ذخیره خودکار)';
            projectData.lastModified = now;
            projectData.isAutoSave = true;
            
            if (!this.currentProjectId) {
                this.currentProjectId = Utils.generateUUID();
                projectData.id = this.currentProjectId;
            } else {
                projectData.id = this.currentProjectId;
            }
            
            // Save to LocalStorage for quick recovery
            localStorage.setItem(this.autoSaveKey, JSON.stringify(projectData));
            
            // Also save to IndexedDB
            await this.saveToDB(projectData);
            
            this.lastAutoSave = now;
            
        } catch (error) {
            console.warn('Auto-save failed:', error);
        }
    }

    /**
     * Emergency save before page unload
     */
    emergencySave() {
        try {
            const projectData = this.serializeProject();
            projectData.name = this.currentProjectName + ' (بازیابی اضطراری)';
            projectData.lastModified = Date.now();
            projectData.isRecovery = true;
            
            localStorage.setItem(this.recoveryKey, JSON.stringify(projectData));
            
        } catch (error) {
            console.warn('Emergency save failed:', error);
        }
    }

    /**
     * Check for recovery data
     * @returns {Promise<void>}
     */
    async checkRecovery() {
        try {
            const recoveryData = localStorage.getItem(this.recoveryKey);
            
            if (recoveryData) {
                const projectData = JSON.parse(recoveryData);
                
                // Show recovery prompt
                this.showRecoveryPrompt(projectData);
            }
        } catch (error) {
            console.warn('Recovery check failed:', error);
        }
    }

    /**
     * Recover project from recovery data
     * @param {Object} projectData - Recovery project data
     * @returns {Promise<void>}
     */
    async recoverProject(projectData) {
        try {
            await this.deserializeProject(projectData);
            
            this.currentProjectId = projectData.id || Utils.generateUUID();
            this.currentProjectName = (projectData.name || 'بازیابی شده').replace(' (بازیابی اضطراری)', '');
            this.app.state.documentName = this.currentProjectName;
            this.app.elements.docName.textContent = this.currentProjectName;
            
            // Clear recovery data
            localStorage.removeItem(this.recoveryKey);
            
            this.app.showToast('پروژه با موفقیت بازیابی شد', 'success');
            
        } catch (error) {
            console.error('Recovery failed:', error);
            this.app.showToast('خطا در بازیابی پروژه', 'error');
        }
    }

    /**
     * Show recovery prompt dialog
     * @param {Object} projectData 
     */
    showRecoveryPrompt(projectData) {
        const content = `
            <p>یک نسخه بازیابی از پروژه "${projectData.name || 'ناشناس'}" پیدا شد.</p>
            <p>تاریخ: ${new Date(projectData.lastModified).toLocaleString('fa-IR')}</p>
            <p>آیا می‌خواهید آن را بازیابی کنید؟</p>
        `;
        
        const footer = `
            <button class="btn" onclick="this.closest('.modal-wrapper').remove(); localStorage.removeItem('${this.recoveryKey}');">
                حذف نسخه بازیابی
            </button>
            <button class="btn btn-primary" onclick="window.PaintProApp.modules.storageManager.recoverProject(JSON.parse(localStorage.getItem('${this.recoveryKey}'))); this.closest('.modal-wrapper').remove();">
                بازیابی
            </button>
        `;
        
        this.app.showModal({
            title: 'بازیابی پروژه',
            content,
            footer,
        });
    }

    /**
     * Show open project dialog
     */
    async showOpenProjectDialog() {
        const projects = await this.listProjects();
        
        let projectListHTML = '';
        
        if (projects.length === 0) {
            projectListHTML = '<p style="text-align: center; padding: 20px;">هیچ پروژه ذخیره شده‌ای یافت نشد</p>';
        } else {
            projectListHTML = '<div class="project-list">';
            
            projects.forEach(project => {
                const date = new Date(project.lastModified).toLocaleString('fa-IR');
                projectListHTML += `
                    <div class="project-item" style="padding: 12px; border: 1px solid var(--md-sys-color-outline-variant); border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s;"
                         onclick="window.PaintProApp.modules.storageManager.openProject('${project.id}'); this.closest('.modal-wrapper').remove();">
                        <div style="font-weight: 500;">${project.name || 'بدون عنوان'}</div>
                        <div style="font-size: 0.8rem; color: var(--md-sys-color-on-surface-variant);">
                            ${date} | ${project.canvas?.width || '?'}×${project.canvas?.height || '?'}
                        </div>
                    </div>
                `;
            });
            
            projectListHTML += '</div>';
        }
        
        const content = `
            <div>
                ${projectListHTML}
            </div>
            <div style="margin-top: 16px;">
                <button class="btn" onclick="document.getElementById('project-file-input').click()">
                    باز کردن از فایل...
                </button>
                <input type="file" id="project-file-input" accept=".paintproj,.json" style="display: none;"
                       onchange="window.PaintProApp.modules.storageManager.openProjectFromFile(this.files[0]); this.closest('.modal-wrapper').remove();">
            </div>
        `;
        
        this.app.showModal({
            title: 'باز کردن پروژه',
            content,
        });
    }

    /**
     * Delete a project from storage
     * @param {string} projectId 
     * @returns {Promise<void>}
     */
    async deleteProject(projectId) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const transaction = this.db.transaction([this.storeName, 'thumbnails'], 'readwrite');
            
            transaction.onerror = () => reject(transaction.error);
            transaction.oncomplete = () => {
                if (this.currentProjectId === projectId) {
                    this.currentProjectId = null;
                }
                resolve();
            };
            
            const store = transaction.objectStore(this.storeName);
            store.delete(projectId);
            
            const thumbStore = transaction.objectStore('thumbnails');
            thumbStore.delete(projectId);
        });
    }

    /**
     * List all saved projects
     * @returns {Promise<Array>}
     */
    async listProjects() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve([]);
                return;
            }
            
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('lastModified');
            const request = index.openCursor(null, 'prev');
            
            const projects = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    // Don't include auto-saves in the list
                    if (!cursor.value.isAutoSave) {
                        projects.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(projects);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Export project as .paintproj file
     * @returns {Promise<void>}
     */
    async exportProjectFile() {
        try {
            const projectData = this.serializeProject();
            projectData.name = this.currentProjectName;
            projectData.exportDate = Date.now();
            
            const json = JSON.stringify(projectData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            
            const filename = `${this.currentProjectName || 'project'}.paintproj`;
            this.app.modules.exportManager?.downloadFile(blob, filename);
            
            this.app.showToast('پروژه با موفقیت خروجی گرفته شد', 'success');
            
        } catch (error) {
            console.error('Export project failed:', error);
            this.app.showToast('خطا در خروجی پروژه', 'error');
        }
    }

    /**
     * Import project from .paintproj file
     * @param {File} file 
     * @returns {Promise<void>}
     */
    async importProjectFile(file) {
        await this.openProjectFromFile(file);
    }

    /**
     * Serialize current project state
     * @returns {Object}
     */
    serializeProject() {
        const canvas = this.app.modules.canvasManager;
        const layers = this.app.modules.layerManager;
        const history = this.app.modules.historyManager;
        const text = this.app.modules.textEngine;
        const pages = canvas.getPages();
        
        return {
            version: '1.0.0',
            name: this.currentProjectName,
            canvas: {
                width: canvas.width,
                height: canvas.height,
                backgroundColor: canvas.backgroundColor,
                zoom: this.app.state.zoom,
            },
            currentPageIndex: canvas.currentPageIndex,
            pages: pages.map(page => ({
                id: page.id,
                name: page.name,
                width: page.width,
                height: page.height,
                backgroundColor: page.backgroundColor,
                order: page.order,
            })),
            layers: layers ? layers.serialize() : [],
            textObjects: text ? text.serialize() : [],
            history: history ? history.serialize() : {},
            settings: {
                gridEnabled: this.app.state.gridEnabled,
                snapEnabled: this.app.state.snapEnabled,
                rulersEnabled: this.app.state.rulersEnabled,
                theme: this.app.state.theme,
            },
            lastModified: Date.now(),
        };
    }

    /**
     * Deserialize and restore project state
     * @param {Object} projectData 
     * @returns {Promise<void>}
     */
    async deserializeProject(projectData) {
        if (!projectData) return;
        
        const canvas = this.app.modules.canvasManager;
        const layers = this.app.modules.layerManager;
        const text = this.app.modules.textEngine;
        
        // Restore canvas
        if (projectData.canvas) {
            canvas.resizeCanvas(
                projectData.canvas.width || 1920,
                projectData.canvas.height || 1080
            );
            canvas.backgroundColor = projectData.canvas.backgroundColor || '#FFFFFF';
            this.app.setZoom(projectData.canvas.zoom || 1);
        }
        
        // Restore pages
        if (projectData.pages && projectData.pages.length > 0) {
            canvas.pages = projectData.pages;
            canvas.totalPages = projectData.pages.length;
            canvas.currentPageIndex = projectData.currentPageIndex || 0;
            canvas.renderPageList();
        }
        
        // Restore layers
        if (layers && projectData.layers) {
            await layers.deserialize(projectData.layers);
        }
        
        // Restore text objects
        if (text && projectData.textObjects) {
            text.deserialize(projectData.textObjects);
        }
        
        // Restore settings
        if (projectData.settings) {
            this.app.state.gridEnabled = projectData.settings.gridEnabled || false;
            this.app.state.snapEnabled = projectData.settings.snapEnabled || false;
            this.app.state.rulersEnabled = projectData.settings.rulersEnabled || false;
            
            if (projectData.settings.theme) {
                this.app.applyTheme(projectData.settings.theme);
            }
        }
        
        // Update UI
        this.app.updateUI();
        canvas.render();
        canvas.renderGrid();
    }

    /**
     * Save project data to IndexedDB
     * @param {Object} projectData 
     * @returns {Promise<void>}
     */
    saveToDB(projectData) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            
            transaction.onerror = () => reject(transaction.error);
            transaction.oncomplete = () => resolve();
            
            const store = transaction.objectStore(this.storeName);
            store.put(projectData);
        });
    }

    /**
     * Load project data from IndexedDB
     * @param {string} projectId 
     * @returns {Promise<Object>}
     */
    loadFromDB(projectId) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(projectId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Save project thumbnail
     * @param {string} projectId 
     * @returns {Promise<void>}
     */
    async saveThumbnail(projectId) {
        const canvas = this.app.modules.canvasManager;
        const thumbnailCanvas = document.createElement('canvas');
        thumbnailCanvas.width = 200;
        thumbnailCanvas.height = 150;
        const thumbCtx = thumbnailCanvas.getContext('2d');
        
        // Scale down main canvas for thumbnail
        thumbCtx.drawImage(
            canvas.mainCanvas,
            0, 0,
            canvas.width, canvas.height,
            0, 0,
            200, 150
        );
        
        const thumbnailData = thumbnailCanvas.toDataURL('image/jpeg', 0.6);
        
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve();
                return;
            }
            
            const transaction = this.db.transaction(['thumbnails'], 'readwrite');
            const store = transaction.objectStore('thumbnails');
            
            store.put({
                projectId,
                thumbnail: thumbnailData,
                updated: Date.now(),
            });
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Save application settings
     * @param {string} key 
     * @param {*} value 
     * @returns {Promise<void>}
     */
    async saveSettings(key, value) {
        // Save to LocalStorage
        const settings = this.loadSettingsFromLocal();
        settings[key] = value;
        localStorage.setItem(this.settingsKey, JSON.stringify(settings));
        
        // Also save to IndexedDB
        if (this.db) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['settings'], 'readwrite');
                const store = transaction.objectStore('settings');
                
                store.put({ key, value });
                
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        }
    }

    /**
     * Load application settings
     * @returns {Promise<Object>}
     */
    async loadSettings() {
        return this.loadSettingsFromLocal();
    }

    /**
     * Load settings from LocalStorage
     * @returns {Object}
     */
    loadSettingsFromLocal() {
        try {
            const data = localStorage.getItem(this.settingsKey);
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    }

    /**
     * Clear auto-save data
     */
    clearAutoSave() {
        localStorage.removeItem(this.autoSaveKey);
    }

    /**
     * Set auto-save enabled state
     * @param {boolean} enabled 
     */
    setAutoSaveEnabled(enabled) {
        this.autoSaveEnabled = enabled;
        this.saveSettings('autoSaveEnabled', enabled);
    }

    /**
     * Set auto-save interval
     * @param {number} interval - Milliseconds
     */
    setAutoSaveInterval(interval) {
        this.autoSaveInterval = Math.max(10000, Math.min(300000, interval));
        this.saveSettings('autoSaveInterval', this.autoSaveInterval);
    }

    /**
     * Get storage usage statistics
     * @returns {Promise<Object>}
     */
    async getStorageStats() {
        const projects = await this.listProjects();
        
        let totalSize = 0;
        
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            totalSize = estimate.usage || 0;
        }
        
        return {
            projectCount: projects.length,
            totalSize: totalSize,
            lastAutoSave: this.lastAutoSave,
            autoSaveEnabled: this.autoSaveEnabled,
        };
    }

    /**
     * Destroy storage manager
     */
    destroy() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        
        console.log('Storage Manager destroyed');
    }
}

export default StorageManager;

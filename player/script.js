'use strict';

/* ============================================================
   SCRIPT.JS — Diyar Player
   Complete application logic: ES2023, modular, production-ready.
   ============================================================ */

// ---------- Polyfill for older browsers ----------
if (!HTMLDialogElement) {
    // minimal no-op
}

// ---------- Utilities ----------
const Utils = {
    formatTime(seconds) {
        if (!seconds || !isFinite(seconds) || seconds < 0) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    },
    formatFileSize(bytes) {
        if (!bytes || bytes < 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        let i = 0;
        let size = bytes;
        while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
        return `${size.toFixed(1)} ${units[i]}`;
    },
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },
    clamp(v, min, max) { return Math.min(Math.max(v, min), max); },
    debounce(fn, ms) {
        let timer;
        return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
    },
    escapeHTML(str) {
        if (!str) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(str).replace(/[&<>"']/g, m => map[m]);
    },
    fileNameWithoutExt(path) {
        if (!path) return '';
        const base = path.split(/[\\/]/).pop() || path;
        return base.replace(/\.[^.]+$/, '');
    },
    extFromPath(path) {
        if (!path) return '';
        const parts = path.split('.');
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    },
    isAudio(file) {
        const exts = ['mp3', 'aac', 'm4a', 'wav', 'ogg', 'opus', 'flac', 'webm', 'mp4'];
        return exts.includes(Utils.extFromPath(file.name || file));
    },
    isVideo(file) {
        const exts = ['mp4', 'webm', 'ogv', 'mkv', 'avi', 'mov'];
        return exts.includes(Utils.extFromPath(file.name || file));
    }
};

// ---------- Storage Manager ----------
class StorageManager {
    constructor() {
        this.prefix = 'diyar_';
    }
    get(key, fallback = null) {
        try {
            const val = localStorage.getItem(this.prefix + key);
            if (val === null) return fallback;
            try { return JSON.parse(val); } catch { return val; }
        } catch { return fallback; }
    }
    set(key, value) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
        } catch { /* ignore */ }
    }
    remove(key) {
        try { localStorage.removeItem(this.prefix + key); } catch { /* ignore */ }
    }
    getPlaylist() {
        return this.get('playlist', []);
    }
    setPlaylist(pl) {
        this.set('playlist', pl);
    }
    getSettings() {
        return this.get('settings', {});
    }
    setSettings(s) {
        this.set('settings', s);
    }
    getFavorites() {
        return this.get('favorites', []);
    }
    setFavorites(favs) {
        this.set('favorites', favs);
    }
    getHistory() {
        return this.get('history', []);
    }
    setHistory(h) {
        this.set('history', h.slice(0, 100));
    }
    getMostPlayed() {
        return this.get('mostPlayed', {});
    }
    setMostPlayed(mp) {
        this.set('mostPlayed', mp);
    }
}

// ---------- Metadata Reader ----------
class MetadataReader {
    static async read(file) {
        return new Promise((resolve) => {
            const result = {
                title: '',
                artist: '',
                album: '',
                genre: '',
                year: '',
                trackNumber: '',
                duration: 0,
                bitrate: 0,
                sampleRate: 0,
                channels: 0,
                codec: '',
                fileSize: file.size || 0,
                cover: null
            };

            // Use filename as fallback
            result.title = Utils.fileNameWithoutExt(file.name) || file.name || 'Unknown';

            // Try to read via FileReader for ID3 tags (MP3)
            if (file.type.startsWith('audio/') || Utils.extFromPath(file.name) === 'mp3') {
                const audio = document.createElement('audio');
                const url = URL.createObjectURL(file);
                audio.src = url;
                audio.addEventListener('loadedmetadata', () => {
                    result.duration = audio.duration || 0;
                    try {
                        if (audio.mozGetMetadata) {
                            const md = audio.mozGetMetadata();
                            if (md.title) result.title = md.title;
                            if (md.artist) result.artist = md.artist;
                            if (md.album) result.album = md.album;
                            if (md.genre) result.genre = md.genre;
                            if (md.year) result.year = md.year;
                            if (md.track) result.trackNumber = String(md.track);
                        }
                    } catch { /* ignore */ }
                    URL.revokeObjectURL(url);
                    resolve(result);
                });
                audio.addEventListener('error', () => {
                    URL.revokeObjectURL(url);
                    resolve(result);
                });
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    resolve(result);
                }, 2000);
            } else {
                const media = document.createElement('video');
                const url = URL.createObjectURL(file);
                media.src = url;
                media.addEventListener('loadedmetadata', () => {
                    result.duration = media.duration || 0;
                    if (file.type) result.codec = file.type;
                    URL.revokeObjectURL(url);
                    resolve(result);
                });
                media.addEventListener('error', () => {
                    URL.revokeObjectURL(url);
                    resolve(result);
                });
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    resolve(result);
                }, 2000);
            }
        });
    }

    static async readCover(file) {
        return new Promise((resolve) => {
            if (file.type === 'audio/mpeg' || Utils.extFromPath(file.name) === 'mp3') {
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const buffer = e.target.result;
                        const data = new Uint8Array(buffer);
                        if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) {
                            const searchStr = 'APIC';
                            const searchBytes = searchStr.split('').map(c => c.charCodeAt(0));
                            for (let i = 10; i < data.length - 10; i++) {
                                let match = true;
                                for (let j = 0; j < 4; j++) {
                                    if (data[i + j] !== searchBytes[j]) { match = false; break; }
                                }
                                if (match) {
                                    const frameSize = (data[i + 4] << 24) | (data[i + 5] << 16) | (data[i + 6] << 8) | data[i + 7];
                                    const imgStart = i + 10;
                                    let mimeEnd = imgStart + 1;
                                    while (mimeEnd < data.length && data[mimeEnd] !== 0) mimeEnd++;
                                    const mimeType = new TextDecoder().decode(data.slice(imgStart + 1, mimeEnd));
                                    const imgDataStart = mimeEnd + 1;
                                    let descEnd = imgDataStart;
                                    while (descEnd < data.length && data[descEnd] !== 0) descEnd++;
                                    const pixelDataStart = descEnd + 1;
                                    const imgData = data.slice(pixelDataStart, Math.min(pixelDataStart + frameSize, data.length));
                                    const blob = new Blob([imgData], { type: mimeType || 'image/jpeg' });
                                    resolve(URL.createObjectURL(blob));
                                    return;
                                }
                            }
                        }
                        resolve(null);
                    } catch { resolve(null); }
                };
                reader.readAsArrayBuffer(file);
            } else {
                resolve(null);
            }
        });
    }
}

// ---------- Audio / Video Engine ----------
class MediaEngine {
    constructor(videoElement, visualizerCanvas) {
        this.media = videoElement;
        this.canvas = visualizerCanvas;
        this.ctx = null;
        this.analyser = null;
        this.dataArray = null;
        this.visualizerRunning = false;
        this.visualizerType = 'bars';
        this._animId = null;
        this._source = null;
        this._audioCtx = null;
        this._initAudioContext();
    }

    _initAudioContext() {
        try {
            this._audioCtx = new(window.AudioContext || window.webkitAudioContext)();
            this.analyser = this._audioCtx.createAnalyser();
            this.analyser.fftSize = 256;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.ctx = this.canvas.getContext('2d');
        } catch { /* fallback */ }
    }

    connectAnalyser() {
        if (!this._audioCtx || !this.analyser) return;
        try {
            if (this.media && this.media.src) {
                if (this._source) {
                    try { this._source.disconnect(); } catch { /* ignore */ }
                }
                this._source = this._audioCtx.createMediaElementSource(this.media);
                this._source.connect(this.analyser);
                this._source.connect(this._audioCtx.destination);
            }
        } catch { /* ignore */ }
    }

    startVisualizer(type = 'bars') {
        this.visualizerType = type;
        if (!this.canvas || !this.ctx || !this.analyser) {
            this._initAudioContext();
            if (!this.analyser) return;
        }
        this.visualizerRunning = true;
        this.canvas.classList.remove('hidden');
        this._drawVisualizer();
    }

    stopVisualizer() {
        this.visualizerRunning = false;
        if (this._animId) {
            cancelAnimationFrame(this._animId);
            this._animId = null;
        }
        if (this.canvas) {
            this.canvas.classList.add('hidden');
            const ctx = this.canvas.getContext('2d');
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    _drawVisualizer() {
        if (!this.visualizerRunning) return;
        if (!this.canvas || !this.ctx || !this.analyser) {
            this.visualizerRunning = false;
            return;
        }

        const W = this.canvas.width = this.canvas.parentElement?.clientWidth || 600;
        const H = this.canvas.height = this.canvas.parentElement?.clientHeight || 80;

        this.analyser.getByteFrequencyData(this.dataArray);
        const ctx = this.ctx;
        ctx.clearRect(0, 0, W, H);

        const len = this.dataArray.length;
        const barWidth = this.visualizerType === 'wave' ? 2 : Math.max(2, (W / len) * 1.2);
        const halfH = H / 2;

        if (this.visualizerType === 'wave') {
            ctx.beginPath();
            ctx.strokeStyle = 'var(--accent, #6c5ce7)';
            ctx.lineWidth = 2;
            for (let i = 0; i < len; i++) {
                const x = (i / len) * W;
                const val = (this.dataArray[i] / 255) * halfH;
                if (i === 0) ctx.moveTo(x, halfH - val);
                else ctx.lineTo(x, halfH - val);
            }
            ctx.stroke();
            ctx.beginPath();
            for (let i = 0; i < len; i++) {
                const x = (i / len) * W;
                const val = (this.dataArray[i] / 255) * halfH;
                if (i === 0) ctx.moveTo(x, halfH + val);
                else ctx.lineTo(x, halfH + val);
            }
            ctx.stroke();
        } else {
            const gradient = ctx.createLinearGradient(0, 0, 0, H);
            gradient.addColorStop(0, 'var(--accent, #6c5ce7)');
            gradient.addColorStop(1, 'var(--accent-hover, #5a4bd1)');
            for (let i = 0; i < len; i++) {
                const val = this.dataArray[i] / 255;
                const barH = val * H;
                const x = i * barWidth;
                ctx.fillStyle = gradient;
                ctx.fillRect(x, H - barH, barWidth - 1, barH);
            }
        }

        this._animId = requestAnimationFrame(() => this._drawVisualizer());
    }

    resizeVisualizer() {
        if (this.canvas) {
            this.canvas.width = this.canvas.parentElement?.clientWidth || 600;
            this.canvas.height = this.canvas.parentElement?.clientHeight || 80;
        }
    }
}

// ---------- Main Player Application ----------
class DiyarPlayer {
    constructor() {
        // DOM refs
        this.video = document.getElementById('player');
        this.canvas = document.getElementById('visualizer');
        this.playlistContainer = document.getElementById('playlistContainer');
        this.playlistCount = document.getElementById('playlistCount');
        this.playlistSearch = document.getElementById('playlistSearch');
        this.trackName = document.getElementById('trackName');
        this.trackArtist = document.getElementById('trackArtist');
        this.trackCover = document.getElementById('trackCover');
        this.currentTimeEl = document.getElementById('currentTime');
        this.durationTimeEl = document.getElementById('durationTime');
        this.progressSlider = document.getElementById('progressSlider');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.playBtn = document.getElementById('playBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.shuffleBtn = document.getElementById('shuffleBtn');
        this.repeatBtn = document.getElementById('repeatBtn');
        this.muteBtn = document.getElementById('muteBtn');
        this.speedBtn = document.getElementById('speedBtn');
        this.themeToggle = document.getElementById('themeToggle');
        this.themeIcon = document.getElementById('themeIcon');
        this.pipToggle = document.getElementById('pipToggle');
        this.fullscreenToggle = document.getElementById('fullscreenToggle');
        this.sleepTimerBtn = document.getElementById('sleepTimerBtn');
        this.visualizerToggle = document.getElementById('visualizerToggle');
        this.menuToggle = document.getElementById('menuToggle');
        this.sidebar = document.getElementById('sidebar');
        this.sidebarOverlay = document.getElementById('sidebarOverlay');
        this.addFilesBtn = document.getElementById('addFilesBtn');
        this.clearPlaylistBtn = document.getElementById('clearPlaylistBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.importBtn = document.getElementById('importBtn');
        this.videoPlaceholder = document.getElementById('videoPlaceholder');
        this.toastContainer = document.getElementById('toastContainer');

        // State
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.isMuted = false;
        this.volume = 0.8;
        this.speed = 1.0;
        this.shuffle = false;
        this.repeatMode = 'off';
        this.favorites = [];
        this.history = [];
        this.mostPlayed = {};
        this.filterText = '';
        this.sortMode = 'default';
        this.sleepTimer = null;
        this.sleepTimerEnd = null;
        this._dragItem = null;
        this._dragOverItem = null;
        this._isDragging = false;
        this._progressUpdating = false;
        this._coverCache = new Map();

        // Storage
        this.storage = new StorageManager();

        // Media engine
        this.engine = new MediaEngine(this.video, this.canvas);

        // Init
        this._init();
    }

    // ---------- Initialization ----------
    _init() {
        this._loadSettings();
        this._loadPlaylist();
        this._loadFavorites();
        this._loadHistory();
        this._loadMostPlayed();
        this._bindEvents();
        this._applyTheme();
        this._renderPlaylist();
        this._updateUI();
        this._setupDragAndDrop();
        this._setupKeyboardShortcuts();
        this._setupMediaSession();
        this._setupPWA();
        this._handleVisibilityChange();

        const lastTrack = this.storage.get('lastTrack', null);
        if (lastTrack && this.playlist.length > 0) {
            const idx = this.playlist.findIndex(t => t.id === lastTrack);
            if (idx >= 0) {
                this.currentIndex = idx;
                this._loadTrack(idx, false);
                const lastPos = this.storage.get('lastPosition', 0);
                if (lastPos > 0) {
                    this.video.currentTime = lastPos;
                }
            }
        }

        if (this.playlist.length > 0 && this.currentIndex === -1) {
            this.currentIndex = 0;
            this._loadTrack(0, false);
        }

        window.addEventListener('resize', () => {
            this.engine.resizeVisualizer();
        });

        console.log('🎵 Diyar Player initialized');
    }

    // ---------- Settings ----------
    _loadSettings() {
        const s = this.storage.getSettings();
        this.volume = s.volume ?? 0.8;
        this.speed = s.speed ?? 1.0;
        this.shuffle = s.shuffle ?? false;
        this.repeatMode = s.repeatMode ?? 'off';
        this.volumeSlider.value = this.volume;
        this.video.volume = this.volume;
        this.video.playbackRate = this.speed;
        this.speedBtn.textContent = `${this.speed}×`;
        if (s.theme) {
            document.documentElement.setAttribute('data-theme', s.theme);
        }
        if (s.playlistWidth) {
            this.sidebar.style.width = s.playlistWidth + 'px';
            this.sidebar.style.minWidth = s.playlistWidth + 'px';
        }
    }

    _saveSettings() {
        const s = {
            volume: this.volume,
            speed: this.speed,
            shuffle: this.shuffle,
            repeatMode: this.repeatMode,
            theme: document.documentElement.getAttribute('data-theme') || 'auto',
            playlistWidth: parseInt(this.sidebar.style.width) || 380
        };
        this.storage.setSettings(s);
    }

    // ---------- Playlist ----------
    _loadPlaylist() {
        const saved = this.storage.getPlaylist();
        if (saved && Array.isArray(saved) && saved.length > 0) {
            this.playlist = saved;
        } else {
            this.playlist = [];
        }
    }

    _savePlaylist() {
        const toSave = this.playlist.map(t => ({
            id: t.id,
            name: t.name,
            artist: t.artist || '',
            album: t.album || '',
            duration: t.duration || 0,
            fileSize: t.fileSize || 0,
            type: t.type || 'audio',
            cover: t.cover || null,
            path: t.path || t.name || '',
            url: t.url || null
        }));
        this.storage.setPlaylist(toSave);
        this.playlistCount.textContent = this.playlist.length;
    }

    _loadFavorites() {
        this.favorites = this.storage.getFavorites() || [];
    }

    _saveFavorites() {
        this.storage.setFavorites(this.favorites);
    }

    _loadHistory() {
        this.history = this.storage.getHistory() || [];
    }

    _saveHistory() {
        this.storage.setHistory(this.history);
    }

    _loadMostPlayed() {
        this.mostPlayed = this.storage.getMostPlayed() || {};
    }

    _saveMostPlayed() {
        this.storage.setMostPlayed(this.mostPlayed);
    }

    // ---------- Track Management ----------
    async addTracks(files) {
        const added = [];
        for (const file of files) {
            const meta = await MetadataReader.read(file);
            let coverUrl = null;
            try {
                coverUrl = await MetadataReader.readCover(file);
            } catch { /* ignore */ }
            const track = {
                id: Utils.generateId(),
                name: meta.title || Utils.fileNameWithoutExt(file.name) || file.name,
                artist: meta.artist || '',
                album: meta.album || '',
                genre: meta.genre || '',
                year: meta.year || '',
                trackNumber: meta.trackNumber || '',
                duration: meta.duration || 0,
                bitrate: meta.bitrate || 0,
                sampleRate: meta.sampleRate || 0,
                channels: meta.channels || 0,
                codec: meta.codec || file.type || '',
                fileSize: file.size || 0,
                type: Utils.isAudio(file) ? 'audio' : (Utils.isVideo(file) ? 'video' : 'other'),
                url: URL.createObjectURL(file),
                path: file.name,
                cover: coverUrl,
                file: file,
                plays: 0
            };
            this.playlist.push(track);
            added.push(track);
        }
        this._savePlaylist();
        this._renderPlaylist();
        this._updateUI();

        if (this.currentIndex === -1 && this.playlist.length > 0) {
            this.currentIndex = 0;
            this._loadTrack(0, false);
        }

        this._toast(`Added ${added.length} track${added.length > 1 ? 's' : ''}`);
        return added;
    }

    _loadTrack(index, autoPlay = true) {
        if (index < 0 || index >= this.playlist.length) {
            this._stop();
            return;
        }
        this.currentIndex = index;
        const track = this.playlist[index];

        if (track.url) {
            this.video.src = track.url;
        } else {
            this.video.removeAttribute('src');
        }
        this.video.load();

        this.trackName.textContent = track.name || 'Unknown';
        this.trackArtist.textContent = track.artist || '–';
        if (track.cover) {
            this.trackCover.src = track.cover;
        } else {
            this.trackCover.src = 'assets/default-cover.png';
        }

        this.video.addEventListener('loadedmetadata', () => {
            const dur = this.video.duration || track.duration || 0;
            this.durationTimeEl.textContent = Utils.formatTime(dur);
            this.progressSlider.max = dur || 1;
        }, { once: true });

        this.videoPlaceholder.classList.add('hidden');

        this._updateUI();

        if (autoPlay) {
            this._play();
        }

        this.storage.set('lastTrack', track.id);
        this._addToHistory(track);

        setTimeout(() => {
            this.engine.connectAnalyser();
        }, 100);

        this._updateMediaSession(track);
    }

    _addToHistory(track) {
        this.history = this.history.filter(t => t.id !== track.id);
        this.history.unshift({ id: track.id, name: track.name, artist: track.artist, playedAt: Date.now() });
        this.history = this.history.slice(0, 100);
        this._saveHistory();
    }

    _recordPlay(track) {
        if (!track) return;
        const id = track.id;
        this.mostPlayed[id] = (this.mostPlayed[id] || 0) + 1;
        this._saveMostPlayed();
        track.plays = (track.plays || 0) + 1;
    }

    removeTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;
        const track = this.playlist[index];
        if (track.url && track.url.startsWith('blob:')) {
            URL.revokeObjectURL(track.url);
        }
        if (track.cover && track.cover.startsWith('blob:')) {
            URL.revokeObjectURL(track.cover);
        }
        this.playlist.splice(index, 1);
        if (this.currentIndex === index) {
            this._stop();
            this.currentIndex = -1;
        } else if (this.currentIndex > index) {
            this.currentIndex--;
        }
        this._savePlaylist();
        this._renderPlaylist();
        this._updateUI();
        this._toast('Track removed');
    }

    clearPlaylist() {
        if (this.playlist.length === 0) return;
        for (const track of this.playlist) {
            if (track.url && track.url.startsWith('blob:')) {
                URL.revokeObjectURL(track.url);
            }
            if (track.cover && track.cover.startsWith('blob:')) {
                URL.revokeObjectURL(track.cover);
            }
        }
        this.playlist = [];
        this.currentIndex = -1;
        this._stop();
        this._savePlaylist();
        this._renderPlaylist();
        this._updateUI();
        this._toast('Playlist cleared');
    }

    // ---------- Playback Controls ----------
    _play() {
        if (this.playlist.length === 0) {
            this._toast('No tracks in playlist');
            return;
        }
        if (this.currentIndex === -1) {
            this.currentIndex = 0;
            this._loadTrack(0, true);
            return;
        }
        const promise = this.video.play();
        if (promise) {
            promise.catch(() => {});
        }
        this.isPlaying = true;
        this._updateUI();
        this._startVisualizer();
        const track = this.playlist[this.currentIndex];
        if (track) this._recordPlay(track);
    }

    _pause() {
        this.video.pause();
        this.isPlaying = false;
        this._updateUI();
        this.engine.stopVisualizer();
    }

    _stop() {
        this.video.pause();
        this.video.currentTime = 0;
        this.isPlaying = false;
        this._updateUI();
        this.engine.stopVisualizer();
        this.currentTimeEl.textContent = '0:00';
        this.progressSlider.value = 0;
        this.videoPlaceholder.classList.remove('hidden');
    }

    _togglePlay() {
        if (this.isPlaying) {
            this._pause();
        } else {
            this._play();
        }
    }

    _next() {
        if (this.playlist.length === 0) return;
        if (this.shuffle) {
            let idx;
            do {
                idx = Math.floor(Math.random() * this.playlist.length);
            } while (idx === this.currentIndex && this.playlist.length > 1);
            this.currentIndex = idx;
        } else {
            this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        }
        this._loadTrack(this.currentIndex, true);
    }

    _prev() {
        if (this.playlist.length === 0) return;
        if (this.video.currentTime > 3) {
            this.video.currentTime = 0;
            return;
        }
        if (this.shuffle) {
            let idx;
            do {
                idx = Math.floor(Math.random() * this.playlist.length);
            } while (idx === this.currentIndex && this.playlist.length > 1);
            this.currentIndex = idx;
        } else {
            this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        }
        this._loadTrack(this.currentIndex, true);
    }

    _seek(percent) {
        const dur = this.video.duration || 0;
        if (dur > 0) {
            this.video.currentTime = percent * dur;
        }
    }

    _setVolume(val) {
        this.volume = Utils.clamp(val, 0, 1);
        this.video.volume = this.isMuted ? 0 : this.volume;
        this.volumeSlider.value = this.volume;
        this._updateMuteIcon();
        this._saveSettings();
    }

    _toggleMute() {
        this.isMuted = !this.isMuted;
        this.video.muted = this.isMuted;
        this._updateMuteIcon();
        this._saveSettings();
    }

    _updateMuteIcon() {
        if (this.isMuted || this.volume === 0) {
            this.muteBtn.textContent = '🔇';
        } else if (this.volume < 0.5) {
            this.muteBtn.textContent = '🔉';
        } else {
            this.muteBtn.textContent = '🔊';
        }
    }

    _setSpeed(val) {
        this.speed = Utils.clamp(val, 0.25, 3.0);
        this.video.playbackRate = this.speed;
        this.speedBtn.textContent = `${this.speed}×`;
        this._saveSettings();
    }

    _toggleShuffle() {
        this.shuffle = !this.shuffle;
        this.shuffleBtn.classList.toggle('active', this.shuffle);
        this._saveSettings();
        this._toast(this.shuffle ? 'Shuffle on' : 'Shuffle off');
    }

    _toggleRepeat() {
        const modes = ['off', 'one', 'all'];
        const idx = (modes.indexOf(this.repeatMode) + 1) % modes.length;
        this.repeatMode = modes[idx];
        const icons = { off: '🔁', one: '🔂', all: '🔁' };
        this.repeatBtn.textContent = icons[this.repeatMode];
        this.repeatBtn.classList.toggle('active', this.repeatMode !== 'off');
        this._saveSettings();
        this._toast(`Repeat: ${this.repeatMode}`);
    }

    _toggleVisualizer() {
        const isVisible = !this.canvas.classList.contains('hidden');
        if (isVisible) {
            this.engine.stopVisualizer();
        } else {
            this._startVisualizer();
        }
    }

    _startVisualizer() {
        if (this.isPlaying) {
            this.engine.startVisualizer('bars');
        }
    }

    // ---------- UI Updates ----------
    _updateUI() {
        this.playBtn.textContent = this.isPlaying ? '⏸' : '▶';
        this.playBtn.classList.toggle('primary', !this.isPlaying);
        this.shuffleBtn.classList.toggle('active', this.shuffle);
        this.repeatBtn.classList.toggle('active', this.repeatMode !== 'off');
        const icons = { off: '🔁', one: '🔂', all: '🔁' };
        this.repeatBtn.textContent = icons[this.repeatMode] || '🔁';
        this._updateMuteIcon();
        const items = this.playlistContainer.querySelectorAll('.playlist-item');
        items.forEach((el, i) => {
            el.classList.toggle('active', i === this.currentIndex);
        });
        if (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) {
            const t = this.playlist[this.currentIndex];
            this.trackName.textContent = t.name || 'Unknown';
            this.trackArtist.textContent = t.artist || '–';
            if (t.cover) {
                this.trackCover.src = t.cover;
            } else {
                this.trackCover.src = 'assets/default-cover.png';
            }
        }
        this.playlistCount.textContent = this.playlist.length;
        if (this.isPlaying) {
            this.storage.set('lastPosition', this.video.currentTime);
        }
    }

    _renderPlaylist() {
        const container = this.playlistContainer;
        const filter = this.filterText.toLowerCase().trim();
        let items = [...this.playlist];

        if (filter) {
            items = items.filter(t =>
                (t.name || '').toLowerCase().includes(filter) ||
                (t.artist || '').toLowerCase().includes(filter) ||
                (t.album || '').toLowerCase().includes(filter)
            );
        }

        if (this.sortMode === 'title') {
            items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } else if (this.sortMode === 'artist') {
            items.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
        } else if (this.sortMode === 'duration') {
            items.sort((a, b) => (a.duration || 0) - (b.duration || 0));
        }

        if (items.length === 0) {
            container.innerHTML = `
                <div style="padding: 40px 20px; text-align:center; color:var(--text-muted); font-size:0.85rem;">
                    ${filter ? 'No matches found' : 'Drop files here to build your playlist'}
                </div>
            `;
            return;
        }

        let html = '';
        for (let i = 0; i < items.length; i++) {
            const track = items[i];
            const globalIdx = this.playlist.indexOf(track);
            const isActive = globalIdx === this.currentIndex;
            const isFav = this.favorites.includes(track.id);
            const duration = track.duration ? Utils.formatTime(track.duration) : '--:--';
            const cover = track.cover || 'assets/default-cover.png';

            html += `
                <div class="playlist-item ${isActive ? 'active' : ''}" 
                     data-index="${globalIdx}" 
                     draggable="true"
                     role="listitem"
                     aria-selected="${isActive}">
                    <div class="drag-handle" aria-hidden="true">⠿</div>
                    <div class="thumb"><img src="${cover}" alt="" loading="lazy" /></div>
                    <div class="info">
                        <div class="title">${Utils.escapeHTML(track.name || 'Unknown')}</div>
                        <div class="sub">${Utils.escapeHTML(track.artist || '–')} · ${track.album || ''}</div>
                    </div>
                    <span class="duration">${duration}</span>
                    <span class="fav ${isFav ? 'active' : ''}" data-id="${track.id}" role="button" tabindex="0" aria-label="Toggle favorite">${isFav ? '⭐' : '☆'}</span>
                </div>
            `;
        }
        container.innerHTML = html;

        container.querySelectorAll('.playlist-item').forEach(el => {
            const idx = parseInt(el.dataset.index);
            el.addEventListener('click', (e) => {
                if (e.target.closest('.fav') || e.target.closest('.drag-handle')) return;
                if (idx !== this.currentIndex) {
                    this.currentIndex = idx;
                    this._loadTrack(idx, true);
                } else {
                    this._togglePlay();
                }
            });
            el.addEventListener('dblclick', () => {
                const favEl = el.querySelector('.fav');
                if (favEl) {
                    this._toggleFavorite(favEl.dataset.id);
                }
            });
        });

        container.querySelectorAll('.fav').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleFavorite(el.dataset.id);
            });
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._toggleFavorite(el.dataset.id);
                }
            });
        });

        this._setupItemDragDrop();
        this.playlistCount.textContent = this.playlist.length;
    }

    _toggleFavorite(id) {
        const idx = this.favorites.indexOf(id);
        if (idx >= 0) {
            this.favorites.splice(idx, 1);
        } else {
            this.favorites.push(id);
        }
        this._saveFavorites();
        this._renderPlaylist();
        this._toast(idx >= 0 ? 'Removed from favorites' : 'Added to favorites');
    }

    // ---------- Drag and Drop (global) ----------
    _setupDragAndDrop() {
        const container = this.video.parentElement;
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.classList.add('drag-over');
        });
        container.addEventListener('dragleave', () => {
            container.classList.remove('drag-over');
        });
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.addTracks(files);
            }
        });

        this.playlistContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        this.playlistContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.addTracks(files);
            }
        });
    }

    // ---------- Item Drag and Drop (reorder) ----------
    _setupItemDragDrop() {
        const items = this.playlistContainer.querySelectorAll('.playlist-item');
        let dragIndex = null;

        items.forEach(el => {
            el.addEventListener('dragstart', (e) => {
                dragIndex = parseInt(el.dataset.index);
                el.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(dragIndex));
            });
            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
                document.querySelectorAll('.playlist-item.drag-over').forEach(el => el.classList.remove('drag-over'));
            });
            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const targetIdx = parseInt(el.dataset.index);
                if (targetIdx !== dragIndex) {
                    document.querySelectorAll('.playlist-item.drag-over').forEach(el => el.classList.remove('drag-over'));
                    el.classList.add('drag-over');
                }
            });
            el.addEventListener('dragleave', () => {
                el.classList.remove('drag-over');
            });
            el.addEventListener('drop', (e) => {
                e.preventDefault();
                el.classList.remove('drag-over');
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                const toIdx = parseInt(el.dataset.index);
                if (fromIdx !== toIdx && !isNaN(fromIdx) && !isNaN(toIdx)) {
                    this._reorderPlaylist(fromIdx, toIdx);
                }
            });
        });
    }

    _reorderPlaylist(from, to) {
        if (from < 0 || from >= this.playlist.length || to < 0 || to >= this.playlist.length) return;
        const [item] = this.playlist.splice(from, 1);
        this.playlist.splice(to, 0, item);
        if (this.currentIndex === from) {
            this.currentIndex = to;
        } else if (this.currentIndex > from && this.currentIndex <= to) {
            this.currentIndex--;
        } else if (this.currentIndex < from && this.currentIndex >= to) {
            this.currentIndex++;
        }
        this._savePlaylist();
        this._renderPlaylist();
        this._updateUI();
        this._toast('Playlist reordered');
    }

    // ---------- Keyboard Shortcuts ----------
    _setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                if (e.key === 'Enter' && e.target === this.playlistSearch) {
                    return;
                }
                return;
            }

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    this._togglePlay();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this._seek(Math.min(1, (this.video.currentTime + 5) / (this.video.duration || 1)));
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this._seek(Math.max(0, (this.video.currentTime - 5) / (this.video.duration || 1)));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this._setVolume(this.volume + 0.05);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this._setVolume(this.volume - 0.05);
                    break;
                case 'm':
                    this._toggleMute();
                    break;
                case 'f':
                    this._toggleFullscreen();
                    break;
                case 'Delete':
                case 'Backspace':
                    if (this.currentIndex >= 0) {
                        this.removeTrack(this.currentIndex);
                    }
                    break;
                case 'Enter':
                    this._togglePlay();
                    break;
                case 'Escape':
                    if (this.sidebar.classList.contains('open')) {
                        this._toggleSidebar(false);
                    }
                    break;
                case 'o':
                case 'O':
                    if ((e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        this._openFileDialog();
                    }
                    break;
            }
        });
    }

    // ---------- Media Session API ----------
    _setupMediaSession() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => this._play());
            navigator.mediaSession.setActionHandler('pause', () => this._pause());
            navigator.mediaSession.setActionHandler('previoustrack', () => this._prev());
            navigator.mediaSession.setActionHandler('nexttrack', () => this._next());
            navigator.mediaSession.setActionHandler('stop', () => this._stop());
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined) {
                    this.video.currentTime = details.seekTime;
                }
            });
        }
    }

    _updateMediaSession(track) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.name || 'Unknown',
                artist: track.artist || '',
                album: track.album || '',
                artwork: track.cover ? [{ src: track.cover, sizes: '512x512', type: 'image/png' }] : []
            });
        }
    }

    // ---------- PWA ----------
    _setupPWA() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(() => console.log('✅ Service Worker registered'))
                .catch(() => console.log('⚠️ SW registration failed'));
        }
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            const installBtn = document.createElement('button');
            installBtn.textContent = '📲 Install';
            installBtn.className = 'install-btn';
            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const result = await deferredPrompt.userChoice;
                    if (result.outcome === 'accepted') {
                        this._toast('App installed!');
                    }
                    deferredPrompt = null;
                    installBtn.remove();
                }
            });
            const actions = document.querySelector('.top-bar .actions');
            if (actions) {
                actions.appendChild(installBtn);
            }
        });
    }

    // ---------- Fullscreen ----------
    _toggleFullscreen() {
        const el = document.documentElement;
        if (!document.fullscreenElement) {
            el.requestFullscreen?.().catch(() => {});
        } else {
            document.exitFullscreen?.().catch(() => {});
        }
    }

    // ---------- Picture in Picture ----------
    _togglePip() {
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture?.().catch(() => {});
        } else if (this.video) {
            this.video.requestPictureInPicture?.().catch(() => {});
        }
    }

    // ---------- Sleep Timer ----------
    _toggleSleepTimer() {
        if (this.sleepTimer) {
            clearTimeout(this.sleepTimer);
            this.sleepTimer = null;
            this.sleepTimerEnd = null;
            this.sleepTimerBtn.textContent = '⏱';
            this._toast('Sleep timer cancelled');
            return;
        }
        const mins = prompt('Sleep timer (minutes):', '15');
        if (mins === null) return;
        const minutes = parseInt(mins);
        if (isNaN(minutes) || minutes < 1) {
            this._toast('Invalid time');
            return;
        }
        const ms = minutes * 60 * 1000;
        this.sleepTimerEnd = Date.now() + ms;
        this.sleepTimer = setTimeout(() => {
            this._pause();
            this.sleepTimer = null;
            this.sleepTimerEnd = null;
            this.sleepTimerBtn.textContent = '⏱';
            this._toast('Sleep timer: playback paused');
        }, ms);
        this.sleepTimerBtn.textContent = `⏱${minutes}m`;
        this._toast(`Sleep timer set for ${minutes} minutes`);
    }

    // ---------- Theme ----------
    _applyTheme() {
        const theme = document.documentElement.getAttribute('data-theme') || 'auto';
        const isDark = theme === 'dark' ||
            (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        this.themeIcon.textContent = isDark ? '☀️' : '🌙';
    }

    _toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'auto';
        const themes = ['auto', 'light', 'dark'];
        const idx = (themes.indexOf(current) + 1) % themes.length;
        const next = themes[idx];
        document.documentElement.setAttribute('data-theme', next === 'auto' ? '' : next);
        if (next === 'auto') document.documentElement.removeAttribute('data-theme');
        this._applyTheme();
        this._saveSettings();
        this._toast(`Theme: ${next}`);
    }

    // ---------- Visibility ----------
    _handleVisibilityChange() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                if (this.isPlaying) {
                    this._startVisualizer();
                }
            } else {
                this.engine.stopVisualizer();
            }
        });
    }

    // ---------- File dialog ----------
    _openFileDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'audio/*,video/*';
        input.onchange = () => {
            if (input.files && input.files.length > 0) {
                this.addTracks(input.files);
            }
        };
        input.click();
    }

    // ---------- Export / Import ----------
    _exportPlaylist() {
        if (this.playlist.length === 0) {
            this._toast('Playlist is empty');
            return;
        }
        const data = this.playlist.map(t => ({
            name: t.name,
            artist: t.artist,
            album: t.album,
            duration: t.duration,
            path: t.path,
            type: t.type
        }));
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `playlist-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this._toast('Playlist exported');
    }

    _importPlaylist() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
            if (!input.files || input.files.length === 0) return;
            const file = input.files[0];
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                if (Array.isArray(data)) {
                    let count = 0;
                    for (const item of data) {
                        const track = {
                            id: Utils.generateId(),
                            name: item.name || 'Unknown',
                            artist: item.artist || '',
                            album: item.album || '',
                            duration: item.duration || 0,
                            path: item.path || item.name || '',
                            type: item.type || 'audio',
                            url: null,
                            cover: null,
                            plays: 0,
                            fileSize: 0
                        };
                        this.playlist.push(track);
                        count++;
                    }
                    this._savePlaylist();
                    this._renderPlaylist();
                    this._updateUI();
                    this._toast(`Imported ${count} tracks`);
                } else {
                    this._toast('Invalid playlist format');
                }
            } catch {
                this._toast('Failed to import playlist');
            }
        };
        input.click();
    }

    // ---------- Toast ----------
    _toast(message) {
        const container = this.toastContainer;
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = message;
        container.appendChild(el);
        setTimeout(() => {
            el.classList.add('out');
            setTimeout(() => el.remove(), 300);
        }, 2500);
    }

    // ---------- Sidebar toggle ----------
    _toggleSidebar(open) {
        const isOpen = this.sidebar.classList.contains('open') || !this.sidebar.classList.contains('collapsed');
        if (open === undefined) {
            open = !isOpen;
        }
        if (window.innerWidth <= 820) {
            this.sidebar.classList.toggle('open', open);
            this.sidebar.classList.toggle('collapsed', !open);
            this.sidebarOverlay.classList.toggle('active', open);
            document.body.style.overflow = open ? 'hidden' : '';
        } else {
            this.sidebar.classList.toggle('collapsed', !open);
        }
    }

    // ---------- Event Binding ----------
    _bindEvents() {
        this.playBtn.addEventListener('click', () => this._togglePlay());
        this.stopBtn.addEventListener('click', () => this._stop());
        this.prevBtn.addEventListener('click', () => this._prev());
        this.nextBtn.addEventListener('click', () => this._next());

        this.shuffleBtn.addEventListener('click', () => this._toggleShuffle());
        this.repeatBtn.addEventListener('click', () => this._toggleRepeat());

        this.volumeSlider.addEventListener('input', (e) => {
            this._setVolume(parseFloat(e.target.value));
        });

        this.muteBtn.addEventListener('click', () => this._toggleMute());

        this.speedBtn.addEventListener('click', () => {
            const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];
            let idx = speeds.indexOf(this.speed);
            idx = (idx + 1) % speeds.length;
            this._setSpeed(speeds[idx]);
        });

        this.progressSlider.addEventListener('input', (e) => {
            this._progressUpdating = true;
            const val = parseFloat(e.target.value);
            const dur = this.video.duration || 0;
            this.video.currentTime = val * dur;
            this.currentTimeEl.textContent = Utils.formatTime(val * dur);
        });
        this.progressSlider.addEventListener('change', () => {
            this._progressUpdating = false;
        });

        this.video.addEventListener('timeupdate', () => {
            if (!this._progressUpdating) {
                const dur = this.video.duration || 0;
                const current = this.video.currentTime || 0;
                this.progressSlider.value = dur > 0 ? current / dur : 0;
                this.currentTimeEl.textContent = Utils.formatTime(current);
                if (this.isPlaying && this.canvas.classList.contains('hidden')) {
                    this._startVisualizer();
                }
                if (this.isPlaying && current > 0) {
                    this.storage.set('lastPosition', current);
                }
            }
        });

        this.video.addEventListener('ended', () => {
            if (this.repeatMode === 'one') {
                this.video.currentTime = 0;
                this._play();
                return;
            }
            if (this.repeatMode === 'all' || this.playlist.length > 1) {
                this._next();
            } else {
                this._pause();
                this.video.currentTime = 0;
            }
        });

        this.video.addEventListener('play', () => {
            this.isPlaying = true;
            this._updateUI();
            this._startVisualizer();
            this._updateMediaSession(this.playlist[this.currentIndex]);
        });

        this.video.addEventListener('pause', () => {
            this.isPlaying = false;
            this._updateUI();
            this.engine.stopVisualizer();
        });

        this.video.addEventListener('error', () => {
            this._toast('Playback error');
            this._stop();
        });

        this.themeToggle.addEventListener('click', () => this._toggleTheme());
        this.fullscreenToggle.addEventListener('click', () => this._toggleFullscreen());
        this.pipToggle.addEventListener('click', () => this._togglePip());
        this.visualizerToggle.addEventListener('click', () => this._toggleVisualizer());
        this.sleepTimerBtn.addEventListener('click', () => this._toggleSleepTimer());

        this.menuToggle.addEventListener('click', () => this._toggleSidebar());
        this.sidebarOverlay.addEventListener('click', () => this._toggleSidebar(false));

        this.addFilesBtn.addEventListener('click', () => this._openFileDialog());
        this.clearPlaylistBtn.addEventListener('click', () => {
            if (this.playlist.length > 0 && confirm('Clear the entire playlist?')) {
                this.clearPlaylist();
            }
        });
        this.exportBtn.addEventListener('click', () => this._exportPlaylist());
        this.importBtn.addEventListener('click', () => this._importPlaylist());

        this.playlistSearch.addEventListener('input', (e) => {
            this.filterText = e.target.value;
            this._renderPlaylist();
        });

        this.volumeSlider.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const step = e.key === 'ArrowUp' ? 0.05 : -0.05;
                this._setVolume(this.volume + step);
            }
        });

        this.trackCover.addEventListener('dblclick', () => {
            if (this.currentIndex >= 0) {
                const track = this.playlist[this.currentIndex];
                if (track) this._toggleFavorite(track.id);
            }
        });
    }

    // ---------- Cleanup ----------
    destroy() {
        for (const track of this.playlist) {
            if (track.url && track.url.startsWith('blob:')) {
                URL.revokeObjectURL(track.url);
            }
            if (track.cover && track.cover.startsWith('blob:')) {
                URL.revokeObjectURL(track.cover);
            }
        }
        this.engine.stopVisualizer();
        if (this.sleepTimer) {
            clearTimeout(this.sleepTimer);
        }
        this.video.pause();
        this.video.src = '';
        this.video.load();
    }
}

// ============================================================
// BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    window.diyarPlayer = new DiyarPlayer();

    window.addEventListener('beforeunload', () => {
        if (window.diyarPlayer) {
            window.diyarPlayer.destroy();
        }
    });

    document.addEventListener('click', () => {
        if (window.diyarPlayer && window.diyarPlayer.engine && window.diyarPlayer.engine._audioCtx) {
            if (window.diyarPlayer.engine._audioCtx.state === 'suspended') {
                window.diyarPlayer.engine._audioCtx.resume().catch(() => {});
            }
        }
    }, { once: true });
});

console.log('🎵 Diyar Player loaded successfully');

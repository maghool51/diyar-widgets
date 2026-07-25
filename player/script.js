// ============================================================
// script.js - دیار قدمگاه پلیر حرفه‌ای
// ============================================================
// Part 1 of 8 - Core Setup, State & Constants
// ============================================================

(function() {
    'use strict';

    // ============================================================
    // STORAGE KEYS
    // ============================================================
    var STORAGE = {
        PLAYLIST: 'diar_playlist',
        LAST_FILE: 'diar_last_file',
        LAST_TIME: 'diar_last_time',
        VOLUME: 'diar_volume',
        SPEED: 'diar_speed',
        THEME: 'diar_theme',
        REPEAT: 'diar_repeat',
        SHUFFLE: 'diar_shuffle',
        FAVORITES: 'diar_favorites',
        RECENT: 'diar_recent',
        EQ: 'diar_eq'
    };

    // ============================================================
    // DOM REFS
    // ============================================================
    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }

    var dom = {
        app: $('.app-container'),
        logoImg: $('#logoImg'),
        logoFallback: $('#logoFallback'),
        clock: $('#clockDisplay'),
        search: $('#searchBox'),
        playlistContainer: $('#playlistContainer'),
        playlistCount: $('#playlistCount'),
        emptyPlaylist: $('#emptyPlaylist'),
        fileInput: $('#fileInput'),
        dropZone: $('#dropZone'),
        addFilesBtn: $('#addFilesBtn'),
        clearPlaylistBtn: $('#clearPlaylistBtn'),
        visualizerCanvas: $('#visualizerCanvas'),
        nowCover: $('#nowCover'),
        nowTrack: $('#nowTrack'),
        nowArtist: $('#nowArtist'),
        playBtn: $('#playBtn'),
        prevBtn: $('#prevBtn'),
        nextBtn: $('#nextBtn'),
        rewindBtn: $('#rewindBtn'),
        forwardBtn: $('#forwardBtn'),
        shuffleBtn: $('#shuffleBtn'),
        repeatBtn: $('#repeatBtn'),
        muteBtn: $('#muteBtn'),
        volumeSlider: $('#volumeSlider'),
        progressTrack: $('#progressTrack'),
        progressFill: $('#progressFill'),
        bufferFill: $('#bufferFill'),
        currentTime: $('#currentTime'),
        totalTime: $('#totalTime'),
        speedBtn: $('#speedBtn'),
        queueToggle: $('#queueToggle'),
        queuePanel: $('#queuePanel'),
        queueList: $('#queueList'),
        clearQueueBtn: $('#clearQueueBtn'),
        favBtn: $('#favBtn'),
        downloadBtn: $('#downloadBtn'),
        pipBtn: $('#pipBtn'),
        fullscreenBtn: $('#fullscreenBtn'),
        eqToggle: $('#eqToggle'),
        eqModal: $('#eqModal'),
        eqBands: $('#eqBands'),
        eqPreset: $('#eqPreset'),
        footerStatus: $('#footerStatus'),
        footerMeta: $('#footerMeta'),
        toastContainer: $('#toastContainer'),
        dragGhost: $('#dragGhost'),
        logoArea: $('#logoArea'),
        albumArtContainer: $('#albumArtContainer'),
        albumBg: $('#albumBg'),
        albumCoverImg: $('#albumCoverImg'),
        defaultCover: $('#defaultCover'),
        videoContainer: $('#videoContainer'),
        videoPlayer: $('#videoPlayer'),
        mobileToggle: $('#mobilePlaylistToggle'),
        drawerOverlay: $('#playlistDrawerOverlay'),
        playlistDrawer: $('#playlistDrawer'),
        drawerClose: $('#drawerCloseBtn'),
        drawerBody: $('#drawerBody'),
    };

    // ============================================================
    // STATE
    // ============================================================
    var state = {
        playlist: [],
        queue: [],
        currentIndex: -1,
        isPlaying: false,
        isPaused: false,
        volume: 0.8,
        muted: false,
        speed: 1.0,
        repeat: 'none',
        shuffle: false,
        favorites: [],
        recent: [],
        theme: 'dark',
        eqValues: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        eqPreset: 'flat',
        visualizerCtx: null,
        audioCtx: null,
        analyser: null,
        dataArray: null,
        animationId: null,
        visualizerRunning: false,
        queueVisible: false,
        eqVisible: false,
        dragIndex: null,
    };

    var audioEl = null;
    var idCounter = Date.now();

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================
    function generateId() { return ++idCounter; }

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
        var m = Math.floor(seconds / 60);
        var s = Math.floor(seconds % 60);
        return m + ':' + String(s).padStart(2, '0');
    }

    function debounce(fn, ms) {
        var timer;
        return function() {
            var args = arguments;
            var context = this;
            clearTimeout(timer);
            timer = setTimeout(function() {
                fn.apply(context, args);
            }, ms);
        };
    }

    function getCurrentItem() {
        if (state.currentIndex >= 0 && state.playlist && state.playlist[state.currentIndex]) {
            return state.playlist[state.currentIndex];
        }
        return null;
    }

    // ============================================================
    // TOAST NOTIFICATIONS
    // ============================================================
    function showToast(message, type) {
        if (type === undefined) type = 'info';
        var container = dom.toastContainer;
        var icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        var toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.innerHTML = '<span class="toast-icon">' + (icons[type] || 'ℹ️') + '</span> ' + message;
        container.appendChild(toast);
        setTimeout(function() {
            if (toast.parentElement) toast.remove();
        }, 3000);
    }

    // ============================================================
    // CLOCK
    // ============================================================
    function updateClock() {
        var now = new Date();
        var h = String(now.getHours()).padStart(2, '0');
        var m = String(now.getMinutes()).padStart(2, '0');
        dom.clock.textContent = h + ':' + m;
    }

    // ============================================================
    // UI UPDATE FUNCTIONS
    // ============================================================
    function updatePlayButton() {
        dom.playBtn.textContent = state.isPlaying ? '⏸' : '▶';
        dom.playBtn.setAttribute('aria-label', state.isPlaying ? 'مکث' : 'پخش');
    }

    function updateFooterStatus(text) {
        dom.footerStatus.textContent = text;
    }

    function updateFooterMeta(item) {
        if (item) {
            var parts = [];
            if (item.artist) parts.push(item.artist);
            if (item.album) parts.push(item.album);
            if (item.year) parts.push(item.year);
            dom.footerMeta.textContent = parts.length ? parts.join(' · ') : (item.type === 'video' ? '🎬 ویدئو' : '🎵 صوتی');
        } else {
            dom.footerMeta.textContent = '—';
        }
    }

    function updateMuteIcon() {
        dom.muteBtn.textContent = state.muted ? '🔇' : '🔊';
    }

    function updateNowPlaying(item) {
        if (!item) {
            dom.nowTrack.textContent = 'هیچ فایلی انتخاب نشده';
            dom.nowArtist.textContent = '—';
            dom.nowCover.textContent = '🎵';
            dom.nowCover.style.background = 'linear-gradient(135deg, var(--primary-dark), var(--primary))';
            dom.nowCover.innerHTML = '🎵';
            return;
        }
        dom.nowTrack.textContent = item.name || 'بدون نام';
        dom.nowArtist.textContent = item.artist || item.album || '—';
        if (item.cover && item.cover.indexOf('data:') === 0) {
            dom.nowCover.innerHTML = '<img src="' + item.cover + '" alt="کاور">';
            dom.nowCover.style.background = 'transparent';
        } else {
            dom.nowCover.textContent = item.type === 'video' ? '🎬' : '🎵';
            dom.nowCover.innerHTML = item.type === 'video' ? '🎬' : '🎵';
            dom.nowCover.style.background = 'linear-gradient(135deg, var(--primary-dark), var(--primary))';
        }
        // Update album art for visualizer
        updateMediaDisplay();
    }

    // ============================================================
    // MEDIA DISPLAY (Album Art / Video / Visualizer)
    // ============================================================
    function updateMediaDisplay() {
        var item = getCurrentItem();
        var canvas = dom.visualizerCanvas;

        if (!item) {
            dom.albumArtContainer.style.display = 'none';
            dom.videoContainer.style.display = 'none';
            if (canvas) canvas.style.display = 'block';
            return;
        }

        if (item.type === 'video') {
            dom.albumArtContainer.style.display = 'none';
            dom.videoContainer.style.display = 'flex';
            if (canvas) canvas.style.display = 'none';
            if (dom.videoPlayer.src !== item.path) {
                dom.videoPlayer.src = item.path;
                dom.videoPlayer.load();
            }
            if (audioEl) {
                if (state.isPlaying) {
                    dom.videoPlayer.play().catch(function() {});
                } else {
                    dom.videoPlayer.pause();
                }
                dom.videoPlayer.currentTime = audioEl.currentTime || 0;
            }
        } else {
            dom.videoContainer.style.display = 'none';
            if (canvas) canvas.style.display = 'block';
            dom.albumArtContainer.style.display = 'flex';

            var coverUrl = item.cover || '';
            if (coverUrl && coverUrl.indexOf('data:') === 0) {
                dom.albumCoverImg.src = coverUrl;
                dom.albumCoverImg.style.display = 'block';
                dom.defaultCover.style.display = 'none';
                dom.albumBg.style.backgroundImage = 'url(' + coverUrl + ')';
            } else {
                dom.albumCoverImg.style.display = 'none';
                dom.defaultCover.style.display = 'flex';
                dom.albumBg.style.backgroundImage = 'url(default-cover.png)';
            }

            if (state.isPlaying) {
                dom.albumArtContainer.classList.add('spin');
            } else {
                dom.albumArtContainer.classList.remove('spin');
            }
        }
    }

    // ============================================================
    // EXPOSE GLOBALS (for UI hooks)
    // ============================================================
    window.state = state;
    window.audioEl = audioEl;
    window.dom = dom;
    window.showToast = showToast;
    window.formatTime = formatTime;
    window.getCurrentItem = getCurrentItem;
    window.updateMediaDisplay = updateMediaDisplay;
    window.updateNowPlaying = updateNowPlaying;
    window.updatePlayButton = updatePlayButton;
    window.updateFooterStatus = updateFooterStatus;
    window.updateFooterMeta = updateFooterMeta;
    window.updateMuteIcon = updateMuteIcon;
    window.debounce = debounce;

    console.log('script.js Part 1 loaded: Core setup complete.');
})();

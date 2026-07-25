کار نمی کنه فکر کنم کد زیر مشکل داشته باشه یه کنترل بکن


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

// ============================================================
// script.js - دیار قدمگاه پلیر حرفه‌ای
// ============================================================
// Part 2 of 8 - Audio Setup, Playlist Management & File Handling
// ============================================================

(function() {
    'use strict';

    // ============================================================
    // AUDIO SETUP
    // ============================================================
    function initAudio() {
        if (audioEl) {
            audioEl.pause();
            audioEl.src = '';
            audioEl.remove();
        }
        audioEl = document.createElement('audio');
        audioEl.preload = 'metadata';
        audioEl.volume = state.muted ? 0 : state.volume;
        audioEl.playbackRate = state.speed;
        audioEl.addEventListener('timeupdate', onTimeUpdate);
        audioEl.addEventListener('loadedmetadata', onLoadedMetadata);
        audioEl.addEventListener('ended', onEnded);
        audioEl.addEventListener('waiting', function() {
            updateFooterStatus('⏳ در حال بافر...');
        });
        audioEl.addEventListener('canplay', function() {
            updateFooterStatus('▶ پخش');
        });
        audioEl.addEventListener('progress', onProgress);
        audioEl.addEventListener('error', function() {
            showToast('خطا در پخش فایل', 'error');
            stopPlayback();
        });
        document.body.appendChild(audioEl);
        setupAudioContext();
        // Update global reference
        window.audioEl = audioEl;
    }

    function setupAudioContext() {
        try {
            if (!state.audioCtx) {
                state.audioCtx = new(window.AudioContext || window.webkitAudioContext)();
            }
            if (!state.analyser && state.audioCtx) {
                state.analyser = state.audioCtx.createAnalyser();
                state.analyser.fftSize = 256;
                state.dataArray = new Uint8Array(state.analyser.frequencyBinCount);
                var source = state.audioCtx.createMediaElementSource(audioEl);
                source.connect(state.analyser);
                state.analyser.connect(state.audioCtx.destination);
            }
        } catch (e) {
            // fallback
        }
    }

    // ============================================================
    // PLAYLIST MANAGEMENT
    // ============================================================
    function loadPlaylist() {
        try {
            var data = localStorage.getItem(STORAGE.PLAYLIST);
            if (data) {
                var parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    state.playlist = parsed;
                    var maxId = 0;
                    for (var i = 0; i < parsed.length; i++) {
                        if (parsed[i].id > maxId) maxId = parsed[i].id;
                    }
                    idCounter = Math.max(maxId, Date.now());
                    return;
                }
            }
        } catch (e) { /* ignore */ }
        state.playlist = [];
    }

    function savePlaylist() {
        try {
            localStorage.setItem(STORAGE.PLAYLIST, JSON.stringify(state.playlist));
        } catch (e) { /* ignore */ }
    }

    function renderPlaylist() {
        var container = dom.playlistContainer;
        var items = state.playlist;
        dom.playlistCount.textContent = items.length;

        var empty = dom.emptyPlaylist;
        container.innerHTML = '';
        if (items.length === 0) {
            container.appendChild(empty);
            empty.style.display = 'flex';
            // Also update drawer
            if (dom.drawerBody) dom.drawerBody.innerHTML = '<div class="empty-state"><div class="icon">🎵</div><p>هیچ فایلی در لیست پخش نیست.</p></div>';
            return;
        }
        empty.style.display = 'none';

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var div = document.createElement('div');
            div.className = 'playlist-item' + (i === state.currentIndex ? ' active' : '');
            div.dataset.index = i;
            div.draggable = true;
            div.role = 'listitem';

            var idxSpan = document.createElement('span');
            idxSpan.className = 'playlist-index';
            idxSpan.textContent = i + 1;

            var cover = document.createElement('div');
            cover.className = 'playlist-cover';
            if (item.cover && item.cover.indexOf('data:') === 0) {
                cover.innerHTML = '<img src="' + item.cover + '" alt="کاور">';
            } else {
                cover.textContent = item.type === 'video' ? '🎬' : '🎵';
            }

            var info = document.createElement('div');
            info.className = 'playlist-info';
            var title = document.createElement('div');
            title.className = 'title';
            title.textContent = item.name || 'بدون نام';
            var sub = document.createElement('div');
            sub.className = 'sub';
            sub.textContent = item.artist || item.album || (item.type === 'video' ? 'ویدئو' : 'صوتی');
            info.appendChild(title);
            info.appendChild(sub);

            var dur = document.createElement('span');
            dur.className = 'playlist-duration';
            dur.textContent = item.duration ? formatTime(item.duration) : '--:--';

            var rm = document.createElement('button');
            rm.className = 'remove-btn';
            rm.textContent = '✕';
            rm.setAttribute('aria-label', 'حذف');
            rm.addEventListener('click', function(e) {
                e.stopPropagation();
                var idx = parseInt(this.parentElement.dataset.index);
                removeFromPlaylist(idx);
            });

            div.appendChild(idxSpan);
            div.appendChild(cover);
            div.appendChild(info);
            div.appendChild(dur);
            div.appendChild(rm);

            div.addEventListener('click', function() {
                var idx = parseInt(this.dataset.index);
                if (idx === state.currentIndex) {
                    togglePlay();
                } else {
                    state.currentIndex = idx;
                    playIndex(idx);
                }
            });

            div.addEventListener('dblclick', function() {
                var idx = parseInt(this.dataset.index);
                if (idx !== state.currentIndex) {
                    state.currentIndex = idx;
                    playIndex(idx);
                } else {
                    togglePlay();
                }
            });

            div.addEventListener('dragstart', function(e) {
                state.dragIndex = parseInt(this.dataset.index);
                this.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(state.dragIndex));
                dom.dragGhost.textContent = item.name;
                dom.dragGhost.style.display = 'block';
                document.body.appendChild(dom.dragGhost);
            });

            div.addEventListener('dragend', function() {
                this.classList.remove('dragging');
                dom.dragGhost.style.display = 'none';
                document.querySelectorAll('.playlist-item.drag-over').forEach(function(el) {
                    el.classList.remove('drag-over');
                });
            });

            div.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                document.querySelectorAll('.playlist-item.drag-over').forEach(function(el) {
                    el.classList.remove('drag-over');
                });
                this.classList.add('drag-over');
            });

            div.addEventListener('dragleave', function() {
                this.classList.remove('drag-over');
            });

            div.addEventListener('drop', function(e) {
                e.preventDefault();
                this.classList.remove('drag-over');
                var from = parseInt(e.dataTransfer.getData('text/plain'));
                var to = parseInt(this.dataset.index);
                if (!isNaN(from) && from !== to) {
                    movePlaylistItem(from, to);
                }
                dom.dragGhost.style.display = 'none';
            });

            container.appendChild(div);
        }

        document.querySelectorAll('.playlist-item').forEach(function(el) {
            var idx = parseInt(el.dataset.index);
            el.classList.toggle('active', idx === state.currentIndex);
        });

        // Update drawer if open
        updateDrawerContent();
    }

    function updatePlaylistUI() {
        renderPlaylist();
        savePlaylist();
    }

    function updateDrawerContent() {
        if (dom.drawerBody && dom.playlistDrawer.classList.contains('open')) {
            var sidebarItems = dom.playlistContainer;
            if (sidebarItems) {
                dom.drawerBody.innerHTML = sidebarItems.innerHTML;
                // Re-bind events for drawer items
                dom.drawerBody.querySelectorAll('.playlist-item').forEach(function(el, idx) {
                    el.addEventListener('click', function() {
                        var sidebarItem = document.querySelector('.playlist-container .playlist-item[data-index="' + idx + '"]');
                        if (sidebarItem) sidebarItem.click();
                        closeDrawer();
                    });
                    var rm = el.querySelector('.remove-btn');
                    if (rm) {
                        rm.addEventListener('click', function(e) {
                            e.stopPropagation();
                            var idx = parseInt(this.parentElement.dataset.index);
                            var sidebarRm = document.querySelector(
                                '.playlist-container .playlist-item[data-index="' + idx + '"] .remove-btn');
                            if (sidebarRm) sidebarRm.click();
                            setTimeout(function() {
                                updateDrawerContent();
                            }, 100);
                        });
                    }
                });
            }
        }
    }

    // ============================================================
    // FILE HANDLING - ADD FILES
    // ============================================================
    function handleFiles(fileList) {
        var files = Array.from(fileList);
        if (files.length === 0) return;
        addFiles(files);
    }

    function addFiles(files) {
        if (!files || files.length === 0) return;
        var added = [];
        for (var f = 0; f < files.length; f++) {
            var file = files[f];
            var ext = file.name.split('.').pop().toLowerCase();
            var type = (file.type.startsWith('video/') || ['mp4', 'webm', 'mkv', 'avi', 'mov', 'mpeg'].indexOf(ext) !== -1) ? 'video' : 'audio';
            var item = {
                id: generateId(),
                name: file.name,
                path: URL.createObjectURL(file),
                duration: 0,
                size: file.size,
                type: type,
                artist: '',
                album: '',
                year: '',
                genre: '',
                bitrate: '',
                sampleRate: '',
                channels: '',
                codec: '',
                resolution: '',
                fps: '',
                cover: '',
                added: new Date().toISOString(),
                _file: file,
            };
            state.playlist.push(item);
            added.push(item);
        }

        updatePlaylistUI();
        showToast(added.length + ' فایل به لیست پخش اضافه شد', 'success');

        // Extract metadata
        for (var a = 0; a < added.length; a++) {
            (function(item) {
                if (item.type === 'video') {
                    var v = document.createElement('video');
                    v.preload = 'metadata';
                    v.src = item.path;
                    v.onloadedmetadata = function() {
                        item.duration = v.duration || 0;
                        item.resolution = (v.videoWidth || 0) + 'x' + (v.videoHeight || 0);
                        if (v.videoWidth && v.videoHeight) {
                            try {
                                var c = document.createElement('canvas');
                                c.width = 80;
                                c.height = 80 * (v.videoHeight / v.videoWidth);
                                var ctx = c.getContext('2d');
                                ctx.drawImage(v, 0, 0, c.width, c.height);
                                item.cover = c.toDataURL('image/jpeg', 0.3);
                            } catch (e) { /* ignore */ }
                        }
                        v.src = '';
                        v.remove();
                        updatePlaylistUI();
                        if (state.currentIndex === -1 && state.playlist.length > 0) {
                            state.currentIndex = 0;
                            playIndex(0);
                        }
                    };
                    v.onerror = function() {
                        v.src = '';
                        v.remove();
                        updatePlaylistUI();
                    };
                    document.body.appendChild(v);
                    v.load();
                } else {
                    var aEl = document.createElement('audio');
                    aEl.preload = 'metadata';
                    aEl.src = item.path;
                    aEl.onloadedmetadata = function() {
                        item.duration = aEl.duration || 0;
                        aEl.src = '';
                        aEl.remove();
                        updatePlaylistUI();
                        if (state.currentIndex === -1 && state.playlist.length > 0) {
                            state.currentIndex = 0;
                            playIndex(0);
                        }
                    };
                    aEl.onerror = function() {
                        aEl.src = '';
                        aEl.remove();
                        updatePlaylistUI();
                    };
                    document.body.appendChild(aEl);
                    aEl.load();
                }
            })(added[a]);
        }

        // Auto-play first item
        if (state.currentIndex === -1 && state.playlist.length > 0) {
            state.currentIndex = 0;
            playIndex(0);
        }
    }

    // ============================================================
    // PLAYLIST MUTATIONS
    // ============================================================
    function removeFromPlaylist(index) {
        if (index < 0 || index >= state.playlist.length) return;
        var item = state.playlist[index];
        if (item.path && item.path.indexOf('blob:') === 0) {
            URL.revokeObjectURL(item.path);
        }
        state.playlist.splice(index, 1);
        if (state.currentIndex === index) {
            state.currentIndex = -1;
            stopPlayback();
        } else if (state.currentIndex > index) {
            state.currentIndex--;
        }
        updatePlaylistUI();
        showToast('فایل از لیست حذف شد', 'warning');
    }

    function clearPlaylist() {
        if (state.playlist.length === 0) return;
        for (var i = 0; i < state.playlist.length; i++) {
            var item = state.playlist[i];
            if (item.path && item.path.indexOf('blob:') === 0) {
                URL.revokeObjectURL(item.path);
            }
        }
        state.playlist = [];
        state.currentIndex = -1;
        stopPlayback();
        updatePlaylistUI();
        showToast('لیست پخش پاک شد', 'warning');
    }

    function movePlaylistItem(from, to) {
        if (from === to || from < 0 || to < 0 || from >= state.playlist.length || to >= state.playlist.length) return;
        var item = state.playlist.splice(from, 1)[0];
        state.playlist.splice(to, 0, item);
        if (state.currentIndex === from) state.currentIndex = to;
        else if (state.currentIndex > from && state.currentIndex <= to) state.currentIndex--;
        else if (state.currentIndex < from && state.currentIndex >= to) state.currentIndex++;
        updatePlaylistUI();
    }

    // ============================================================
    // DRAWER CONTROL
    // ============================================================
    function openDrawer() {
        dom.drawerOverlay.classList.add('open');
        dom.playlistDrawer.classList.add('open');
        updateDrawerContent();
    }

    function closeDrawer() {
        dom.drawerOverlay.classList.remove('open');
        dom.playlistDrawer.classList.remove('open');
    }

    // ============================================================
    // EXPOSE ADDITIONAL FUNCTIONS
    // ============================================================
    window.initAudio = initAudio;
    window.loadPlaylist = loadPlaylist;
    window.savePlaylist = savePlaylist;
    window.renderPlaylist = renderPlaylist;
    window.updatePlaylistUI = updatePlaylistUI;
    window.handleFiles = handleFiles;
    window.addFiles = addFiles;
    window.removeFromPlaylist = removeFromPlaylist;
    window.clearPlaylist = clearPlaylist;
    window.movePlaylistItem = movePlaylistItem;
    window.openDrawer = openDrawer;
    window.closeDrawer = closeDrawer;
    window.updateDrawerContent = updateDrawerContent;

    console.log('script.js Part 2 loaded: Audio Setup, Playlist & File Handling.');
})();
// ============================================================
// script.js - دیار قدمگاه پلیر حرفه‌ای
// ============================================================
// Part 3 of 8 - Playback Controls & Audio Events
// ============================================================

(function() {
    'use strict';

    // ============================================================
    // PLAYBACK CONTROLS
    // ============================================================
    function playIndex(index) {
        if (index < 0 || index >= state.playlist.length) {
            stopPlayback();
            return;
        }
        var item = state.playlist[index];
        if (!item || !item.path) {
            showToast('فایل معتبر نیست', 'error');
            return;
        }
        state.currentIndex = index;
        stopPlayback(false);
        if (!audioEl) initAudio();

        audioEl.src = item.path;
        audioEl.volume = state.muted ? 0 : state.volume;
        audioEl.playbackRate = state.speed;

        updateNowPlaying(item);
        updateFooterMeta(item);
        setupVisualizer();

        var savedTime = getSavedTime(item.id);
        if (savedTime > 0 && savedTime < (item.duration || 0) - 2) {
            audioEl.currentTime = savedTime;
        }

        audioEl.play().then(function() {
            state.isPlaying = true;
            state.isPaused = false;
            updatePlayButton();
            updateFooterStatus('▶ پخش');
            updateRecent(item);
            saveLastFile(item.id);
            startVisualizer();
            updateMediaDisplay();
        }).catch(function(err) {
            console.warn('Play error:', err);
            state.isPlaying = false;
            updatePlayButton();
            updateFooterStatus('⏸ متوقف');
        });
    }

    function togglePlay() {
        if (state.currentIndex === -1 && state.playlist.length > 0) {
            state.currentIndex = 0;
            playIndex(0);
            return;
        }
        if (state.currentIndex === -1) {
            showToast('هیچ فایلی در لیست پخش نیست', 'warning');
            return;
        }
        if (!audioEl || !audioEl.src) {
            playIndex(state.currentIndex);
            return;
        }
        if (state.isPlaying) {
            audioEl.pause();
            state.isPlaying = false;
            state.isPaused = true;
            updatePlayButton();
            updateFooterStatus('⏸ مکث');
            stopVisualizer();
            if (dom.albumArtContainer) dom.albumArtContainer.classList.remove('spin');
        } else {
            audioEl.play().then(function() {
                state.isPlaying = true;
                state.isPaused = false;
                updatePlayButton();
                updateFooterStatus('▶ پخش');
                startVisualizer();
                if (dom.albumArtContainer) dom.albumArtContainer.classList.add('spin');
            }).catch(function(err) {
                console.warn('Play error:', err);
            });
        }
    }

    function stopPlayback(clearSrc) {
        if (clearSrc === undefined) clearSrc = true;
        state.isPlaying = false;
        state.isPaused = false;
        if (audioEl) {
            audioEl.pause();
            if (clearSrc) {
                audioEl.src = '';
            }
        }
        stopVisualizer();
        updatePlayButton();
        updateFooterStatus('⏸ متوقف');
        if (dom.albumArtContainer) dom.albumArtContainer.classList.remove('spin');
        if (dom.videoPlayer) dom.videoPlayer.pause();
    }

    function playNext() {
        if (state.playlist.length === 0) return;
        if (state.shuffle) {
            var idx;
            var attempts = 0;
            do {
                idx = Math.floor(Math.random() * state.playlist.length);
                attempts++;
            } while (idx === state.currentIndex && state.playlist.length > 1 && attempts < 100);
            state.currentIndex = idx;
            playIndex(idx);
            return;
        }
        var next = state.currentIndex + 1;
        if (next >= state.playlist.length) {
            if (state.repeat === 'all') next = 0;
            else { stopPlayback(); return; }
        }
        state.currentIndex = next;
        playIndex(next);
    }

    function playPrev() {
        if (state.playlist.length === 0) return;
        if (state.shuffle) {
            var idx;
            var attempts = 0;
            do {
                idx = Math.floor(Math.random() * state.playlist.length);
                attempts++;
            } while (idx === state.currentIndex && state.playlist.length > 1 && attempts < 100);
            state.currentIndex = idx;
            playIndex(idx);
            return;
        }
        var prev = state.currentIndex - 1;
        if (prev < 0) {
            if (state.repeat === 'all') prev = state.playlist.length - 1;
            else { stopPlayback(); return; }
        }
        state.currentIndex = prev;
        playIndex(prev);
    }

    function seekTo(percent) {
        if (!audioEl || !audioEl.duration) return;
        var time = (percent / 100) * audioEl.duration;
        audioEl.currentTime = Math.min(time, audioEl.duration - 0.1);
        // Sync video player
        if (dom.videoPlayer && dom.videoPlayer.src) {
            dom.videoPlayer.currentTime = audioEl.currentTime;
        }
    }

    function seekDelta(seconds) {
        if (!audioEl || !audioEl.duration) return;
        var newTime = Math.min(Math.max(audioEl.currentTime + seconds, 0), audioEl.duration - 0.1);
        audioEl.currentTime = newTime;
        if (dom.videoPlayer && dom.videoPlayer.src) {
            dom.videoPlayer.currentTime = audioEl.currentTime;
        }
    }

    function setVolume(val) {
        state.volume = Math.max(0, Math.min(1, val));
        if (!state.muted) {
            audioEl.volume = state.volume;
        }
        dom.volumeSlider.value = state.volume;
        updateMuteIcon();
        saveVolume();
    }

    function toggleMute() {
        state.muted = !state.muted;
        if (state.muted) {
            audioEl.volume = 0;
        } else {
            audioEl.volume = state.volume;
        }
        updateMuteIcon();
    }

    function setSpeed(val) {
        state.speed = Math.max(0.25, Math.min(2, val));
        if (audioEl) {
            audioEl.playbackRate = state.speed;
        }
        dom.speedBtn.textContent = state.speed.toFixed(2).replace(/\.?0+$/, '') + 'x';
        saveSpeed();
    }

    function toggleShuffle() {
        state.shuffle = !state.shuffle;
        dom.shuffleBtn.classList.toggle('active', state.shuffle);
        saveShuffle();
        showToast(state.shuffle ? 'تصادفی فعال' : 'تصادفی غیرفعال', 'success');
    }

    function toggleRepeat() {
        var modes = ['none', 'one', 'all'];
        var idx = modes.indexOf(state.repeat);
        idx = (idx + 1) % modes.length;
        state.repeat = modes[idx];
        dom.repeatBtn.classList.toggle('active', state.repeat !== 'none');
        dom.repeatBtn.textContent = state.repeat === 'one' ? '🔂' : '🔁';
        saveRepeat();
        var labels = { none: 'تکرار خاموش', one: 'تکرار یک', all: 'تکرار همه' };
        showToast(labels[state.repeat], 'success');
    }

    // ============================================================
    // AUDIO EVENTS
    // ============================================================
    function onTimeUpdate() {
        if (!audioEl) return;
        var dur = audioEl.duration || 0;
        var cur = audioEl.currentTime || 0;
        var pct = dur > 0 ? (cur / dur) * 100 : 0;
        dom.progressFill.style.width = pct + '%';
        dom.currentTime.textContent = formatTime(cur);
        dom.totalTime.textContent = formatTime(dur);
        dom.progressTrack.setAttribute('aria-valuenow', Math.round(pct));
        if (state.currentIndex >= 0 && state.playlist[state.currentIndex]) {
            saveTime(state.playlist[state.currentIndex].id, cur);
        }
        // Sync video player
        if (dom.videoPlayer && dom.videoPlayer.src && Math.abs(dom.videoPlayer.currentTime - cur) > 0.3) {
            dom.videoPlayer.currentTime = cur;
        }
    }

    function onLoadedMetadata() {
        if (!audioEl || state.currentIndex < 0) return;
        var item = state.playlist[state.currentIndex];
        if (item) {
            item.duration = audioEl.duration || 0;
            dom.totalTime.textContent = formatTime(item.duration);
            updatePlaylistUI();
        }
    }

    function onEnded() {
        if (state.repeat === 'one') {
            audioEl.currentTime = 0;
            audioEl.play().catch(function() {});
            return;
        }
        if (state.repeat === 'all') {
            playNext();
            return;
        }
        if (state.queue.length > 0) {
            var next = state.queue.shift();
            renderQueue();
            var idx = -1;
            for (var i = 0; i < state.playlist.length; i++) {
                if (state.playlist[i].id === next) { idx = i; break; }
            }
            if (idx >= 0) {
                state.currentIndex = idx;
                playIndex(idx);
                return;
            }
        }
        var nextIdx = state.currentIndex + 1;
        if (nextIdx < state.playlist.length) {
            state.currentIndex = nextIdx;
            playIndex(nextIdx);
        } else {
            stopPlayback();
            showToast('پخش به پایان رسید', 'warning');
        }
    }

    function onProgress() {
        if (!audioEl) return;
        if (audioEl.buffered.length > 0) {
            var buffered = audioEl.buffered.end(audioEl.buffered.length - 1);
            var dur = audioEl.duration || 1;
            var pct = Math.min((buffered / dur) * 100, 100);
            dom.bufferFill.style.width = pct + '%';
        }
    }

    // ============================================================
    // KEYBOARD SHORTCUTS
    // ============================================================
    function handleKeyboard(e) {
        var target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
        switch (e.key) {
            case ' ':
                e.preventDefault();
                togglePlay();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                seekDelta(-5);
                break;
            case 'ArrowRight':
                e.preventDefault();
                seekDelta(5);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setVolume(state.volume + 0.05);
                break;
            case 'ArrowDown':
                e.preventDefault();
                setVolume(state.volume - 0.05);
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                toggleFullscreen();
                break;
            case 'm':
            case 'M':
                e.preventDefault();
                toggleMute();
                break;
            case 's':
            case 'S':
                e.preventDefault();
                toggleShuffle();
                break;
            case 'r':
            case 'R':
                e.preventDefault();
                toggleRepeat();
                break;
            case 'Delete':
                if (state.currentIndex >= 0) removeFromPlaylist(state.currentIndex);
                break;
        }
    }

    // ============================================================
    // MOBILE GESTURES
    // ============================================================
    var touchStartX = 0,
        touchStartY = 0,
        touchStartTime = 0;
    var lastTouchDist = 0;

    function setupGestures() {
        var el = dom.app;
        el.addEventListener('touchstart', function(e) {
            var t = e.touches[0];
            touchStartX = t.clientX;
            touchStartY = t.clientY;
            touchStartTime = Date.now();
            if (e.touches.length === 2) {
                lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY);
            }
        }, { passive: true });

        el.addEventListener('touchend', function(e) {
            var dt = Date.now() - touchStartTime;
            if (dt < 300 && e.changedTouches.length === 1) {
                var t = e.changedTouches[0];
                var dx = t.clientX - touchStartX;
                var dy = t.clientY - touchStartY;
                if (Math.abs(dx) > 60 && Math.abs(dy) < 60) {
                    if (dx > 0) playPrev();
                    else playNext();
                }
            }
        }, { passive: true });

        el.addEventListener('touchmove', function(e) {
            if (e.touches.length === 2) {
                var dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY);
                if (lastTouchDist > 0) {
                    var delta = dist - lastTouchDist;
                    if (Math.abs(delta) > 5) {
                        setVolume(state.volume + (delta > 0 ? 0.02 : -0.02));
                        lastTouchDist = dist;
                    }
                }
            }
        }, { passive: true });
    }

    // ============================================================
    // EXPOSE FUNCTIONS
    // ============================================================
    window.playIndex = playIndex;
    window.togglePlay = togglePlay;
    window.stopPlayback = stopPlayback;
    window.playNext = playNext;
    window.playPrev = playPrev;
    window.seekTo = seekTo;
    window.seekDelta = seekDelta;
    window.setVolume = setVolume;
    window.toggleMute = toggleMute;
    window.setSpeed = setSpeed;
    window.toggleShuffle = toggleShuffle;
    window.toggleRepeat = toggleRepeat;
    window.onTimeUpdate = onTimeUpdate;
    window.onLoadedMetadata = onLoadedMetadata;
    window.onEnded = onEnded;
    window.onProgress = onProgress;
    window.handleKeyboard = handleKeyboard;
    window.setupGestures = setupGestures;

    console.log('script.js Part 3 loaded: Playback Controls & Audio Events.');
})();
// ============================================================
// script.js - دیار قدمگاه پلیر حرفه‌ای
// ============================================================
// Part 4 of 8 - Visualizer, Equalizer & Queue
// ============================================================

(function() {
    'use strict';

    // ============================================================
    // VISUALIZER
    // ============================================================
    function setupVisualizer() {
        var canvas = dom.visualizerCanvas;
        var rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width || 600;
        canvas.height = rect.height || 160;
        state.visualizerCtx = canvas.getContext('2d');
    }

    function startVisualizer() {
        if (state.visualizerRunning) return;
        state.visualizerRunning = true;
        drawVisualizer();
    }

    function stopVisualizer() {
        state.visualizerRunning = false;
        if (state.animationId) {
            cancelAnimationFrame(state.animationId);
            state.animationId = null;
        }
        var ctx = state.visualizerCtx;
        if (ctx) {
            ctx.clearRect(0, 0, dom.visualizerCanvas.width, dom.visualizerCanvas.height);
        }
    }

    function drawVisualizer() {
        if (!state.visualizerRunning) return;
        var canvas = dom.visualizerCanvas;
        var ctx = state.visualizerCtx;
        if (!ctx) { state.visualizerRunning = false; return; }

        var w = canvas.width;
        var h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        var data = null;
        try {
            if (state.analyser && state.audioCtx && state.audioCtx.state === 'running') {
                state.analyser.getByteFrequencyData(state.dataArray);
                data = state.dataArray;
            }
        } catch (e) { /* ignore */ }

        if (!data) {
            var now = Date.now() / 1000;
            ctx.beginPath();
            for (var x = 0; x < w; x++) {
                var y = h / 2 + Math.sin(x * 0.05 + now * 2) * 20 + Math.sin(x * 0.08 + now * 3) * 10;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = 'rgba(124, 92, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
            state.animationId = requestAnimationFrame(drawVisualizer);
            return;
        }

        var len = data.length;
        var barWidth = w / len;
        var grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(124, 92, 255, 0.9)');
        grad.addColorStop(0.5, 'rgba(124, 92, 255, 0.6)');
        grad.addColorStop(1, 'rgba(124, 92, 255, 0.2)');

        for (var i = 0; i < len; i++) {
            var val = data[i] / 255;
            var barHeight = val * h * 0.7;
            var xPos = i * barWidth;
            var yPos = h - barHeight;
            ctx.fillStyle = grad;
            ctx.fillRect(xPos, yPos, Math.max(barWidth - 1, 1), barHeight);
        }

        // Glow effect
        ctx.shadowColor = 'rgba(124, 92, 255, 0.2)';
        ctx.shadowBlur = 20;
        ctx.shadowBlur = 0;

        state.animationId = requestAnimationFrame(drawVisualizer);
    }

    // ============================================================
    // EQUALIZER
    // ============================================================
    function renderEqualizer() {
        var container = dom.eqBands;
        var labels = ['32', '64', '128', '256', '512', '1k', '2k', '4k', '8k', '16k'];
        var html = '';
        for (var i = 0; i < 10; i++) {
            var val = state.eqValues[i] || 0;
            html += '<div class="eq-band">' +
                '<span class="eq-val">' + (val >= 0 ? '+' : '') + val.toFixed(1) + '</span>' +
                '<input type="range" min="-12" max="12" step="0.1" value="' + val + '" data-eqidx="' + i + '" orient="vertical">' +
                '<span class="eq-label">' + labels[i] + '</span>' +
                '</div>';
        }
        container.innerHTML = html;
        container.querySelectorAll('input[type="range"]').forEach(function(input) {
            input.addEventListener('input', function() {
                var idx = parseInt(this.dataset.eqidx);
                state.eqValues[idx] = parseFloat(this.value);
                var valSpan = this.parentElement.querySelector('.eq-val');
                if (valSpan) {
                    var v = state.eqValues[idx];
                    valSpan.textContent = (v >= 0 ? '+' : '') + v.toFixed(1);
                }
                state.eqPreset = 'custom';
                dom.eqPreset.value = 'custom';
                saveEQ();
                applyEQ();
            });
        });
        dom.eqPreset.value = state.eqPreset;
        applyEQPreset(state.eqPreset);
    }

    function applyEQPreset(preset) {
        var presets = {
            flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            rock: [4, 3, 2, 0, -1, -2, 0, 2, 3, 4],
            pop: [2, 1, 0, -1, -1, 0, 1, 2, 2, 1],
            jazz: [2, 3, 1, 0, 0, 0, 0, 1, 2, 3],
            classical: [3, 2, 0, 0, 0, 0, 0, 0, 2, 3],
            movie: [4, 3, 2, 0, -1, -2, 0, 1, 3, 4],
            bass: [6, 5, 4, 2, 0, -2, -3, -2, 0, 2],
            treble: [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7],
        };
        if (preset === 'custom') return;
        var vals = presets[preset];
        if (vals) {
            state.eqValues = vals.slice();
            state.eqPreset = preset;
            var inputs = dom.eqBands.querySelectorAll('input[type="range"]');
            var valSpans = dom.eqBands.querySelectorAll('.eq-val');
            inputs.forEach(function(input, i) {
                if (i < state.eqValues.length) {
                    input.value = state.eqValues[i];
                    if (valSpans[i]) {
                        var v = state.eqValues[i];
                        valSpans[i].textContent = (v >= 0 ? '+' : '') + v.toFixed(1);
                    }
                }
            });
            saveEQ();
            applyEQ();
        }
    }

    function applyEQ() {
        // Apply EQ via Web Audio API (simplified)
        // In production, this would use BiquadFilterNode for each band
        // For this demo, we just store the values
        // Future enhancement: implement real-time EQ
        try {
            if (state.audioCtx && state.analyser) {
                // EQ would be applied here using filter nodes
                // This is a placeholder for the actual EQ implementation
                // console.log('EQ applied:', state.eqValues);
            }
        } catch (e) { /* ignore */ }
    }

    // ============================================================
    // QUEUE
    // ============================================================
    function addToQueue(id) {
        if (state.queue.indexOf(id) === -1) {
            state.queue.push(id);
            renderQueue();
            showToast('به صف پخش اضافه شد', 'success');
        }
    }

    function removeFromQueue(index) {
        if (index >= 0 && index < state.queue.length) {
            state.queue.splice(index, 1);
            renderQueue();
        }
    }

    function clearQueue() {
        state.queue = [];
        renderQueue();
        showToast('صف پخش پاک شد', 'warning');
    }

    function renderQueue() {
        var list = dom.queueList;
        if (state.queue.length === 0) {
            list.innerHTML = '<div class="queue-empty">صف پخش خالی است</div>';
            return;
        }
        var html = '';
        for (var i = 0; i < state.queue.length; i++) {
            var id = state.queue[i];
            var item = null;
            for (var j = 0; j < state.playlist.length; j++) {
                if (state.playlist[j].id === id) { item = state.playlist[j]; break; }
            }
            if (!item) continue;
            html += '<div class="queue-item" data-qidx="' + i + '">' +
                '<span class="qidx">' + (i + 1) + '</span>' +
                '<span class="qname">' + (item.name || 'بدون نام') + '</span>' +
                '<button class="qdel" data-qdel="' + i + '">✕</button>' +
                '</div>';
        }
        list.innerHTML = html;
        list.querySelectorAll('.qdel').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var idx = parseInt(this.dataset.qdel);
                removeFromQueue(idx);
            });
        });
        list.querySelectorAll('.queue-item').forEach(function(el) {
            el.addEventListener('click', function() {
                var idx = parseInt(this.dataset.qidx);
                var id = state.queue[idx];
                var pidx = -1;
                for (var k = 0; k < state.playlist.length; k++) {
                    if (state.playlist[k].id === id) { pidx = k; break; }
                }
                if (pidx >= 0) {
                    state.queue.splice(idx, 1);
                    state.currentIndex = pidx;
                    playIndex(pidx);
                    renderQueue();
                }
            });
        });
    }

    // ============================================================
    // EXPOSE FUNCTIONS
    // ============================================================
    window.setupVisualizer = setupVisualizer;
    window.startVisualizer = startVisualizer;
    window.stopVisualizer = stopVisualizer;
    window.drawVisualizer = drawVisualizer;
    window.renderEqualizer = renderEqualizer;
    window.applyEQPreset = applyEQPreset;
    window.applyEQ = applyEQ;
    window.addToQueue = addToQueue;
    window.removeFromQueue = removeFromQueue;
    window.clearQueue = clearQueue;
    window.renderQueue = renderQueue;

    console.log('script.js Part 4 loaded: Visualizer, Equalizer & Queue.');
})();

// ============================================================
// script.js - دیار قدمگاه پلیر حرفه‌ای
// ============================================================
// Part 5 of 8 - Favorites, Save/Load, Fullscreen, PIP, Theme & Init
// ============================================================

(function() {
    'use strict';

    // ============================================================
    // FAVORITES
    // ============================================================
    function toggleFavorite() {
        if (state.currentIndex < 0) {
            showToast('هیچ فایلی انتخاب نشده', 'warning');
            return;
        }
        var item = state.playlist[state.currentIndex];
        var idx = state.favorites.indexOf(item.id);
        if (idx >= 0) {
            state.favorites.splice(idx, 1);
            dom.favBtn.classList.remove('active');
            dom.favBtn.textContent = '❤';
            showToast('از علاقه‌مندی‌ها حذف شد', 'warning');
        } else {
            state.favorites.push(item.id);
            dom.favBtn.classList.add('active');
            dom.favBtn.textContent = '❤';
            showToast('به علاقه‌مندی‌ها اضافه شد', 'success');
        }
        saveFavorites();
    }

    function loadFavorites() {
        try {
            var data = localStorage.getItem(STORAGE.FAVORITES);
            if (data) {
                state.favorites = JSON.parse(data);
                if (!Array.isArray(state.favorites)) state.favorites = [];
            }
        } catch (e) { state.favorites = []; }
        if (state.currentIndex >= 0) {
            var item = state.playlist[state.currentIndex];
            if (item && state.favorites.indexOf(item.id) !== -1) {
                dom.favBtn.classList.add('active');
                dom.favBtn.textContent = '❤';
            } else {
                dom.favBtn.classList.remove('active');
                dom.favBtn.textContent = '❤';
            }
        }
    }

    function saveFavorites() {
        try {
            localStorage.setItem(STORAGE.FAVORITES, JSON.stringify(state.favorites));
        } catch (e) { /* ignore */ }
    }

    function updateRecent(item) {
        if (!item) return;
        state.recent = state.recent.filter(function(id) { return id !== item.id; });
        state.recent.unshift(item.id);
        if (state.recent.length > 50) state.recent.pop();
        try {
            localStorage.setItem(STORAGE.RECENT, JSON.stringify(state.recent));
        } catch (e) { /* ignore */ }
    }

    // ============================================================
    // SAVE / LOAD
    // ============================================================
    function saveLastFile(id) {
        try { localStorage.setItem(STORAGE.LAST_FILE, String(id)); } catch (e) { /* ignore */ }
    }

    function getLastFile() {
        try {
            var id = localStorage.getItem(STORAGE.LAST_FILE);
            return id ? parseInt(id) : null;
        } catch (e) { return null; }
    }

    function saveTime(id, time) {
        try {
            var data = JSON.parse(localStorage.getItem(STORAGE.LAST_TIME) || '{}');
            data[id] = time;
            localStorage.setItem(STORAGE.LAST_TIME, JSON.stringify(data));
        } catch (e) { /* ignore */ }
    }

    function getSavedTime(id) {
        try {
            var data = JSON.parse(localStorage.getItem(STORAGE.LAST_TIME) || '{}');
            return data[id] || 0;
        } catch (e) { return 0; }
    }

    function saveVolume() {
        try { localStorage.setItem(STORAGE.VOLUME, String(state.volume)); } catch (e) { /* ignore */ }
    }

    function loadVolume() {
        try {
            var v = parseFloat(localStorage.getItem(STORAGE.VOLUME));
            if (!isNaN(v) && v >= 0 && v <= 1) state.volume = v;
        } catch (e) { /* ignore */ }
    }

    function saveSpeed() {
        try { localStorage.setItem(STORAGE.SPEED, String(state.speed)); } catch (e) { /* ignore */ }
    }

    function loadSpeed() {
        try {
            var s = parseFloat(localStorage.getItem(STORAGE.SPEED));
            if (!isNaN(s) && s >= 0.25 && s <= 2) state.speed = s;
        } catch (e) { /* ignore */ }
    }

    function saveRepeat() {
        try { localStorage.setItem(STORAGE.REPEAT, state.repeat); } catch (e) { /* ignore */ }
    }

    function loadRepeat() {
        try {
            var r = localStorage.getItem(STORAGE.REPEAT);
            if (r === 'none' || r === 'one' || r === 'all') state.repeat = r;
        } catch (e) { /* ignore */ }
    }

    function saveShuffle() {
        try { localStorage.setItem(STORAGE.SHUFFLE, String(state.shuffle)); } catch (e) { /* ignore */ }
    }

    function loadShuffle() {
        try {
            state.shuffle = localStorage.getItem(STORAGE.SHUFFLE) === 'true';
        } catch (e) { /* ignore */ }
    }

    function saveEQ() {
        try {
            localStorage.setItem(STORAGE.EQ, JSON.stringify({ values: state.eqValues, preset: state.eqPreset }));
        } catch (e) { /* ignore */ }
    }

    function loadEQ() {
        try {
            var data = JSON.parse(localStorage.getItem(STORAGE.EQ));
            if (data) {
                if (Array.isArray(data.values) && data.values.length === 10) state.eqValues = data.values;
                if (data.preset) state.eqPreset = data.preset;
            }
        } catch (e) { /* ignore */ }
    }

    // ============================================================
    // THEME
    // ============================================================
    function loadTheme() {
        try {
            var t = localStorage.getItem(STORAGE.THEME);
            if (t) state.theme = t;
        } catch (e) { /* ignore */ }
        applyTheme(state.theme);
    }

    function saveTheme() {
        try { localStorage.setItem(STORAGE.THEME, state.theme); } catch (e) { /* ignore */ }
    }

    function applyTheme(theme) {
        document.body.className = 'theme-' + theme;
        var icons = { dark: '🌙', light: '☀️', green: '🌿', golden: '🌟' };
        dom.themeToggle.textContent = icons[theme] || '🌙';
        state.theme = theme;
        saveTheme();
    }

    function cycleTheme() {
        var themes = ['dark', 'light', 'green', 'golden'];
        var idx = themes.indexOf(state.theme);
        idx = (idx + 1) % themes.length;
        applyTheme(themes[idx]);
        showToast('تم ' + themes[idx], 'success');
    }

    // ============================================================
    // FULLSCREEN & PIP
    // ============================================================
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(function() {});
        } else {
            document.exitFullscreen().catch(function() {});
        }
    }

    function togglePIP() {
        if (audioEl && audioEl instanceof HTMLVideoElement) {
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture().catch(function() {});
            } else {
                audioEl.requestPictureInPicture().catch(function() {});
            }
        } else {
            showToast('تصویر در تصویر فقط برای ویدئوها قابل استفاده است', 'warning');
        }
    }

    function downloadCurrent() {
        if (state.currentIndex < 0) {
            showToast('هیچ فایلی انتخاب نشده', 'warning');
            return;
        }
        var item = state.playlist[state.currentIndex];
        if (item.path && item.path.indexOf('blob:') === 0) {
            var a = document.createElement('a');
            a.href = item.path;
            a.download = item.name || 'download';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast('دانلود شروع شد', 'success');
        } else {
            showToast('دانلود فایل امکان‌پذیر نیست', 'error');
        }
    }

    // ============================================================
    // FILE HANDLING SETUP (Complete)
    // ============================================================
    function setupFileHandling() {
        dom.fileInput.addEventListener('change', function(e) {
            if (e.target.files && e.target.files.length) {
                handleFiles(e.target.files);
                dom.fileInput.value = '';
            }
        });

        dom.addFilesBtn.addEventListener('click', function(e) {
            e.preventDefault();
            dom.fileInput.click();
        });

        dom.dropZone.addEventListener('click', function(e) {
            e.preventDefault();
            dom.fileInput.click();
        });

        dom.dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dom.dropZone.classList.add('dragover');
        });

        dom.dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            dom.dropZone.classList.remove('dragover');
        });

        dom.dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            dom.dropZone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length) {
                handleFiles(e.dataTransfer.files);
            }
        });

        document.addEventListener('paste', function(e) {
            if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length) {
                handleFiles(e.clipboardData.files);
            }
        });

        dom.app.addEventListener('dragover', function(e) {
            e.preventDefault();
        });
        dom.app.addEventListener('drop', function(e) {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length) {
                handleFiles(e.dataTransfer.files);
            }
        });
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================
    function init() {
        loadPlaylist();
        loadVolume();
        loadSpeed();
        loadRepeat();
        loadShuffle();
        loadEQ();
        loadTheme();
        loadFavorites();

        dom.volumeSlider.value = state.volume;
        dom.speedBtn.textContent = state.speed.toFixed(2).replace(/\.?0+$/, '') + 'x';
        dom.repeatBtn.textContent = state.repeat === 'one' ? '🔂' : '🔁';
        dom.repeatBtn.classList.toggle('active', state.repeat !== 'none');
        dom.shuffleBtn.classList.toggle('active', state.shuffle);
        updateMuteIcon();

        initAudio();
        renderPlaylist();
        renderQueue();
        renderEqualizer();

        updateClock();
        setInterval(updateClock, 10000);

        setupFileHandling();
        setupGestures();

        // ---- Event Listeners ----
        dom.playBtn.addEventListener('click', togglePlay);
        dom.prevBtn.addEventListener('click', playPrev);
        dom.nextBtn.addEventListener('click', playNext);
        dom.rewindBtn.addEventListener('click', function() { seekDelta(-10); });
        dom.forwardBtn.addEventListener('click', function() { seekDelta(10); });
        dom.shuffleBtn.addEventListener('click', toggleShuffle);
        dom.repeatBtn.addEventListener('click', toggleRepeat);

        dom.muteBtn.addEventListener('click', toggleMute);
        dom.volumeSlider.addEventListener('input', function(e) {
            setVolume(parseFloat(e.target.value));
        });

        dom.progressTrack.addEventListener('click', function(e) {
            var rect = dom.progressTrack.getBoundingClientRect();
            var pct = ((e.clientX - rect.left) / rect.width) * 100;
            seekTo(Math.max(0, Math.min(100, pct)));
        });

        dom.speedBtn.addEventListener('click', function() {
            var speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
            var idx = speeds.indexOf(state.speed);
            idx = (idx + 1) % speeds.length;
            setSpeed(speeds[idx]);
            showToast('سرعت: ' + state.speed.toFixed(2) + 'x', 'info');
        });

        dom.queueToggle.addEventListener('click', function() {
            state.queueVisible = !state.queueVisible;
            dom.queuePanel.classList.toggle('open', state.queueVisible);
            if (state.queueVisible) {
                dom.eqModal.classList.remove('open');
                state.eqVisible = false;
            }
        });

        dom.clearQueueBtn.addEventListener('click', clearQueue);
        dom.favBtn.addEventListener('click', toggleFavorite);
        dom.downloadBtn.addEventListener('click', downloadCurrent);
        dom.pipBtn.addEventListener('click', togglePIP);
        dom.fullscreenBtn.addEventListener('click', toggleFullscreen);

        dom.eqToggle.addEventListener('click', function() {
            state.eqVisible = !state.eqVisible;
            dom.eqModal.classList.toggle('open', state.eqVisible);
            if (state.eqVisible) {
                dom.queuePanel.classList.remove('open');
                state.queueVisible = false;
            }
        });

        dom.eqPreset.addEventListener('change', function(e) {
            applyEQPreset(e.target.value);
        });

        dom.themeToggle.addEventListener('click', cycleTheme);

        dom.clearPlaylistBtn.addEventListener('click', function() {
            if (state.playlist.length === 0) return;
            if (confirm('آیا از پاک کردن لیست پخش اطمینان دارید؟')) {
                clearPlaylist();
            }
        });

        dom.logoArea.addEventListener('click', function() {
            showToast('🕌 دیار قدمگاه - پلیر حرفه‌ای', 'info');
        });

        dom.search.addEventListener('input', debounce(function() {
            var q = this.value.trim().toLowerCase();
            var items = dom.playlistContainer.querySelectorAll('.playlist-item');
            items.forEach(function(el) {
                var idx = parseInt(el.dataset.index);
                var item = state.playlist[idx];
                if (!item) return;
                var match = item.name.toLowerCase().indexOf(q) !== -1 ||
                    (item.artist && item.artist.toLowerCase().indexOf(q) !== -1) ||
                    (item.album && item.album.toLowerCase().indexOf(q) !== -1);
                el.style.display = match || !q ? 'flex' : 'none';
            });
        }, 200));

        document.addEventListener('keydown', handleKeyboard);

        // Mobile playlist drawer
        dom.mobileToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            if (dom.playlistDrawer.classList.contains('open')) {
                closeDrawer();
            } else {
                openDrawer();
            }
        });

        dom.drawerClose.addEventListener('click', closeDrawer);
        dom.drawerOverlay.addEventListener('click', closeDrawer);

        // Auto resume
        var lastId = getLastFile();
        if (lastId) {
            var idx = -1;
            for (var i = 0; i < state.playlist.length; i++) {
                if (state.playlist[i].id === lastId) { idx = i; break; }
            }
            if (idx >= 0) {
                state.currentIndex = idx;
                playIndex(idx);
                var saved = getSavedTime(lastId);
                if (saved > 0 && audioEl) {
                    audioEl.currentTime = saved;
                }
            }
        } else if (state.playlist.length > 0) {
            state.currentIndex = 0;
            playIndex(0);
        }

        window.addEventListener('resize', function() {
            setupVisualizer();
        });

        showToast('🎵 دیار قدمگاه آماده است', 'success');
    }

    // ============================================================
    // EXPOSE REMAINING FUNCTIONS
    // ============================================================
    window.toggleFavorite = toggleFavorite;
    window.loadFavorites = loadFavorites;
    window.saveFavorites = saveFavorites;
    window.updateRecent = updateRecent;
    window.saveLastFile = saveLastFile;
    window.getLastFile = getLastFile;
    window.saveTime = saveTime;
    window.getSavedTime = getSavedTime;
    window.saveVolume = saveVolume;
    window.loadVolume = loadVolume;
    window.saveSpeed = saveSpeed;
    window.loadSpeed = loadSpeed;
    window.saveRepeat = saveRepeat;
    window.loadRepeat = loadRepeat;
    window.saveShuffle = saveShuffle;
    window.loadShuffle = loadShuffle;
    window.saveEQ = saveEQ;
    window.loadEQ = loadEQ;
    window.loadTheme = loadTheme;
    window.saveTheme = saveTheme;
    window.applyTheme = applyTheme;
    window.cycleTheme = cycleTheme;
    window.toggleFullscreen = toggleFullscreen;
    window.togglePIP = togglePIP;
    window.downloadCurrent = downloadCurrent;
    window.setupFileHandling = setupFileHandling;
    window.init = init;

    console.log('script.js Part 5 loaded: Favorites, Save/Load, Fullscreen, PIP, Theme & Init.');

})();

// ============================================================
// script.js - دیار قدمگاه پلیر حرفه‌ای
// ============================================================
// Part 6 of 8 - Media Session API, UI Improvements & Enhancements
// ============================================================

(function() {
    'use strict';

    // ============================================================
    // MEDIA SESSION API - Update system media controls
    // ============================================================
    function updateMediaSession(item) {
        if (!item) {
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = null;
                navigator.mediaSession.playbackState = 'none';
            }
            return;
        }

        if ('mediaSession' in navigator) {
            var metadata = new MediaMetadata({
                title: item.name || 'بدون نام',
                artist: item.artist || 'هنرمند ناشناس',
                album: item.album || 'آلبوم ناشناس',
                artwork: []
            });

            // Add artwork if available
            if (item.cover && item.cover.indexOf('data:') === 0) {
                metadata.artwork = [
                    { src: item.cover, sizes: '96x96', type: 'image/jpeg' },
                    { src: item.cover, sizes: '128x128', type: 'image/jpeg' },
                    { src: item.cover, sizes: '192x192', type: 'image/jpeg' },
                    { src: item.cover, sizes: '256x256', type: 'image/jpeg' },
                    { src: item.cover, sizes: '512x512', type: 'image/jpeg' }
                ];
            } else {
                // Use default cover
                metadata.artwork = [
                    { src: 'default-cover.png', sizes: '96x96', type: 'image/png' },
                    { src: 'default-cover.png', sizes: '128x128', type: 'image/png' },
                    { src: 'default-cover.png', sizes: '192x192', type: 'image/png' }
                ];
            }

            navigator.mediaSession.metadata = metadata;
            navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';

            // Set action handlers
            navigator.mediaSession.setActionHandler('play', function() {
                if (!state.isPlaying) togglePlay();
            });
            navigator.mediaSession.setActionHandler('pause', function() {
                if (state.isPlaying) togglePlay();
            });
            navigator.mediaSession.setActionHandler('previoustrack', function() {
                playPrev();
            });
            navigator.mediaSession.setActionHandler('nexttrack', function() {
                playNext();
            });
            navigator.mediaSession.setActionHandler('seekbackward', function(details) {
                var seconds = details.seekOffset || 10;
                seekDelta(-seconds);
            });
            navigator.mediaSession.setActionHandler('seekforward', function(details) {
                var seconds = details.seekOffset || 10;
                seekDelta(seconds);
            });
            navigator.mediaSession.setActionHandler('seekto', function(details) {
                if (details.seekTime && audioEl) {
                    audioEl.currentTime = Math.min(details.seekTime, audioEl.duration || 0);
                }
            });
        }
    }

    // ============================================================
    // OVERRIDE PLAYBACK FUNCTIONS TO UPDATE MEDIA SESSION
    // ============================================================
    var originalPlayIndex = window.playIndex;
    if (typeof window.playIndex === 'function') {
        window.playIndex = function(index) {
            originalPlayIndex.apply(this, arguments);
            var item = getCurrentItem();
            updateMediaSession(item);
        };
    }

    var originalTogglePlay = window.togglePlay;
    if (typeof window.togglePlay === 'function') {
        window.togglePlay = function() {
            originalTogglePlay.apply(this, arguments);
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
            }
        };
    }

    var originalUpdateNowPlaying = window.updateNowPlaying;
    if (typeof window.updateNowPlaying === 'function') {
        window.updateNowPlaying = function(item) {
            originalUpdateNowPlaying.apply(this, arguments);
            updateMediaSession(item);
        };
    }

    // ============================================================
    // UI IMPROVEMENTS - Smooth scrolling to current playlist item
    // ============================================================
    function scrollToCurrentPlaylistItem() {
        var activeItem = document.querySelector('.playlist-item.active');
        if (activeItem) {
            var container = dom.playlistContainer;
            var itemRect = activeItem.getBoundingClientRect();
            var containerRect = container.getBoundingClientRect();
            var scrollOffset = itemRect.top - containerRect.top - containerRect.height / 2 + itemRect.height / 2;
            container.scrollBy({
                top: scrollOffset,
                behavior: 'smooth'
            });
        }
    }

    // Override renderPlaylist to scroll to current item
    var originalRenderPlaylist = window.renderPlaylist;
    if (typeof window.renderPlaylist === 'function') {
        window.renderPlaylist = function() {
            originalRenderPlaylist.apply(this, arguments);
            setTimeout(scrollToCurrentPlaylistItem, 100);
        };
    }

    // ============================================================
    // TOAST IMPROVEMENTS - Better toast with progress indicator
    // ============================================================
    function showToast(message, type) {
        if (type === undefined) type = 'info';
        var container = dom.toastContainer;
        var icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        
        // Remove existing toasts
        var existingToasts = container.querySelectorAll('.toast');
        if (existingToasts.length > 2) {
            existingToasts[0].remove();
        }

        var toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.innerHTML = '<span class="toast-icon">' + (icons[type] || 'ℹ️') + '</span> ' + message;
        
        // Add progress bar
        var progressBar = document.createElement('div');
        progressBar.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:2px;background:rgba(255,255,255,0.1);overflow:hidden;';
        var progressFill = document.createElement('div');
        progressFill.style.cssText = 'height:100%;background:var(--primary);width:100%;animation:toastProgress 2.6s linear forwards;';
        progressBar.appendChild(progressFill);
        toast.appendChild(progressBar);
        
        // Add animation keyframes if not exists
        if (!document.getElementById('toastProgressStyles')) {
            var styleEl = document.createElement('style');
            styleEl.id = 'toastProgressStyles';
            styleEl.textContent = '@keyframes toastProgress { from { width:100%; } to { width:0%; } }';
            document.head.appendChild(styleEl);
        }

        toast.style.position = 'relative';
        container.appendChild(toast);
        setTimeout(function() {
            if (toast.parentElement) toast.remove();
        }, 3000);
    }

    // ============================================================
    // SLEEP TIMER - Auto stop playback after set time
    // ============================================================
    var sleepTimerId = null;
    var sleepTimerMinutes = 0;

    function setSleepTimer(minutes) {
        if (sleepTimerId) {
            clearTimeout(sleepTimerId);
            sleepTimerId = null;
        }
        if (minutes > 0) {
            sleepTimerMinutes = minutes;
            showToast('⏰ تایمر خواب به ' + minutes + ' دقیقه تنظیم شد', 'info');
            sleepTimerId = setTimeout(function() {
                if (state.isPlaying) {
                    stopPlayback();
                    showToast('⏰ تایمر خواب فعال شد - پخش متوقف شد', 'warning');
                }
                sleepTimerId = null;
                sleepTimerMinutes = 0;
            }, minutes * 60 * 1000);
        } else {
            showToast('⏰ تایمر خواب لغو شد', 'info');
        }
    }

    function cancelSleepTimer() {
        if (sleepTimerId) {
            clearTimeout(sleepTimerId);
            sleepTimerId = null;
            sleepTimerMinutes = 0;
            showToast('⏰ تایمر خواب لغو شد', 'info');
        }
    }

    // ============================================================
    // KEYBOARD SHORTCUTS - Add sleep timer shortcuts
    // ============================================================
    var originalHandleKeyboard = window.handleKeyboard;
    if (typeof window.handleKeyboard === 'function') {
        window.handleKeyboard = function(e) {
            // Call original handler
            if (originalHandleKeyboard) {
                originalHandleKeyboard.call(this, e);
            }
            // Add sleep timer shortcuts
            if (e.key === 't' || e.key === 'T') {
                e.preventDefault();
                if (sleepTimerId) {
                    cancelSleepTimer();
                } else {
                    setSleepTimer(15); // Default 15 minutes
                }
            }
        };
    }

    // ============================================================
    // AUDIO VISUALIZER - Add different visualization modes
    // ============================================================
    var visualizerMode = 'spectrum'; // spectrum, wave, bars, circle

    function toggleVisualizerMode() {
        var modes = ['spectrum', 'wave', 'bars', 'circle'];
        var idx = modes.indexOf(visualizerMode);
        idx = (idx + 1) % modes.length;
        visualizerMode = modes[idx];
        showToast('حالت ویژوالایزر: ' + visualizerMode, 'info');
        // Restart visualizer with new mode
        if (state.visualizerRunning) {
            stopVisualizer();
            startVisualizer();
        }
    }

    // Override drawVisualizer to support different modes
    var originalDrawVisualizer = window.drawVisualizer;
    if (typeof window.drawVisualizer === 'function') {
        window.drawVisualizer = function() {
            if (!state.visualizerRunning) return;
            var canvas = dom.visualizerCanvas;
            var ctx = state.visualizerCtx;
            if (!ctx) { state.visualizerRunning = false; return; }

            var w = canvas.width;
            var h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            var data = null;
            try {
                if (state.analyser && state.audioCtx && state.audioCtx.state === 'running') {
                    state.analyser.getByteFrequencyData(state.dataArray);
                    data = state.dataArray;
                }
            } catch (e) { /* ignore */ }

            if (!data) {
                // Fallback wave
                var now = Date.now() / 1000;
                ctx.beginPath();
                for (var x = 0; x < w; x++) {
                    var y = h / 2 + Math.sin(x * 0.05 + now * 2) * 20 + Math.sin(x * 0.08 + now * 3) * 10;
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.strokeStyle = 'rgba(124, 92, 255, 0.4)';
                ctx.lineWidth = 2;
                ctx.stroke();
                state.animationId = requestAnimationFrame(window.drawVisualizer);
                return;
            }

            var len = data.length;
            var barWidth = w / len;
            var grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, 'rgba(124, 92, 255, 0.9)');
            grad.addColorStop(0.5, 'rgba(124, 92, 255, 0.6)');
            grad.addColorStop(1, 'rgba(124, 92, 255, 0.2)');

            if (visualizerMode === 'spectrum' || visualizerMode === 'bars') {
                for (var i = 0; i < len; i++) {
                    var val = data[i] / 255;
                    var barHeight = val * h * 0.7;
                    var xPos = i * barWidth;
                    var yPos = h - barHeight;
                    ctx.fillStyle = grad;
                    var barWidthAdj = visualizerMode === 'spectrum' ? Math.max(barWidth - 1, 1) : 2;
                    ctx.fillRect(xPos, yPos, barWidthAdj, barHeight);
                }
            } else if (visualizerMode === 'wave') {
                ctx.beginPath();
                for (var i = 0; i < len; i++) {
                    var val = data[i] / 255;
                    var xPos = (i / len) * w;
                    var yPos = h / 2 + (val - 0.5) * h * 0.8;
                    if (i === 0) ctx.moveTo(xPos, yPos);
                    else ctx.lineTo(xPos, yPos);
                }
                ctx.strokeStyle = grad;
                ctx.lineWidth = 3;
                ctx.shadowColor = 'rgba(124, 92, 255, 0.5)';
                ctx.shadowBlur = 20;
                ctx.stroke();
                ctx.shadowBlur = 0;
            } else if (visualizerMode === 'circle') {
                var centerX = w / 2;
                var centerY = h / 2;
                var radius = Math.min(w, h) * 0.3;
                var angleStep = (Math.PI * 2) / len;
                for (var i = 0; i < len; i++) {
                    var val = data[i] / 255;
                    var r = radius + val * radius * 0.5;
                    var angle = i * angleStep;
                    var xPos = centerX + Math.cos(angle) * r;
                    var yPos = centerY + Math.sin(angle) * r;
                    ctx.beginPath();
                    ctx.arc(xPos, yPos, 2 + val * 4, 0, Math.PI * 2);
                    ctx.fillStyle = grad;
                    ctx.fill();
                }
            }

            // Glow effect
            ctx.shadowColor = 'rgba(124, 92, 255, 0.2)';
            ctx.shadowBlur = 20;
            ctx.shadowBlur = 0;

            state.animationId = requestAnimationFrame(window.drawVisualizer);
        };
    }

    // ============================================================
    // EXPOSE NEW FUNCTIONS
    // ============================================================
    window.updateMediaSession = updateMediaSession;
    window.scrollToCurrentPlaylistItem = scrollToCurrentPlaylistItem;
    window.setSleepTimer = setSleepTimer;
    window.cancelSleepTimer = cancelSleepTimer;
    window.toggleVisualizerMode = toggleVisualizerMode;
    window.visualizerMode = visualizerMode;

    console.log('script.js Part 6 loaded: Media Session API, UI Improvements, Sleep Timer & Visualizer Modes.');

})();

// ============================================================
// script.js - دیار قدمگاه پلیر حرفه‌ای
// ============================================================
// Part 7 of 8 - Subtitle Support, Lyrics (LRC), Advanced Playlist Features & Error Handling
// ============================================================

(function() {
    'use strict';

    // ============================================================
    // SUBTITLE SUPPORT (for video files)
    // ============================================================
    var subtitleTracks = [];
    var activeSubtitleIndex = -1;

    function loadSubtitle(videoElement, subtitleFile) {
        if (!videoElement || !subtitleFile) return;
        try {
            var reader = new FileReader();
            reader.onload = function(e) {
                var content = e.target.result;
                // Parse SRT or VTT format (basic support)
                var tracks = parseSubtitleContent(content);
                if (tracks.length > 0) {
                    subtitleTracks = tracks;
                    activeSubtitleIndex = 0;
                    showToast('زیرنویس با موفقیت بارگذاری شد', 'success');
                    // Add subtitle track to video
                    if (videoElement.textTracks) {
                        // Use WebVTT API if available
                        try {
                            var track = videoElement.addTextTrack('subtitles', 'Persian', 'fa');
                            track.mode = 'showing';
                            for (var i = 0; i < tracks.length; i++) {
                                var cue = new VTTCue(tracks[i].start, tracks[i].end, tracks[i].text);
                                track.addCue(cue);
                            }
                        } catch (err) {
                            console.warn('WebVTT API not available, using fallback');
                            // Fallback: store subtitle data for manual rendering
                            window._subtitleData = tracks;
                        }
                    }
                } else {
                    showToast('فرمت زیرنویس پشتیبانی نمی‌شود', 'error');
                }
            };
            reader.readAsText(subtitleFile);
        } catch (e) {
            console.error('Error loading subtitle:', e);
            showToast('خطا در بارگذاری زیرنویس', 'error');
        }
    }

    function parseSubtitleContent(content) {
        var tracks = [];
        var lines = content.split(/\r?\n/);
        var current = null;
        var timeRegex = /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/;
        var timeRegexVTT = /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;

            var match = line.match(timeRegex) || line.match(timeRegexVTT);
            if (match) {
                if (current) {
                    tracks.push(current);
                }
                var start = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 1000;
                var end = parseInt(match[5]) * 3600 + parseInt(match[6]) * 60 + parseInt(match[7]) + parseInt(match[8]) / 1000;
                current = { start: start, end: end, text: '' };
            } else if (current && !line.match(/^\d+$/)) {
                // Skip index numbers
                if (current.text) current.text += ' ';
                current.text += line;
            }
        }
        if (current) {
            tracks.push(current);
        }
        return tracks;
    }

    // ============================================================
    // LYRICS SUPPORT (LRC files)
    // ============================================================
    var lyricsData = [];
    var currentLyricIndex = -1;

    function loadLyrics(file) {
        try {
            var reader = new FileReader();
            reader.onload = function(e) {
                var content = e.target.result;
                var parsed = parseLRC(content);
                if (parsed.length > 0) {
                    lyricsData = parsed;
                    showToast('متن ترانه با موفقیت بارگذاری شد', 'success');
                    // Start lyric sync
                    startLyricSync();
                } else {
                    showToast('فرمت فایل LRC معتبر نیست', 'error');
                }
            };
            reader.readAsText(file);
        } catch (e) {
            console.error('Error loading lyrics:', e);
            showToast('خطا در بارگذاری متن ترانه', 'error');
        }
    }

    function parseLRC(content) {
        var lines = content.split(/\r?\n/);
        var lyrics = [];
        var timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;

            var match = line.match(timeRegex);
            if (match) {
                var minutes = parseInt(match[1]);
                var seconds = parseInt(match[2]);
                var centiseconds = parseInt(match[3]);
                var time = minutes * 60 + seconds + centiseconds / 100;
                var text = match[4].trim();
                if (text) {
                    lyrics.push({ time: time, text: text });
                }
            }
        }
        // Sort by time
        lyrics.sort(function(a, b) { return a.time - b.time; });
        return lyrics;
    }

    function startLyricSync() {
        if (lyricsData.length === 0) return;
        currentLyricIndex = 0;
        // Display first lyric
        displayLyric(currentLyricIndex);
    }

    function displayLyric(index) {
        if (index < 0 || index >= lyricsData.length) return;
        var lyric = lyricsData[index];
        // Update UI - show lyric in a dedicated area
        var lyricDisplay = document.getElementById('lyricDisplay');
        if (!lyricDisplay) {
            // Create lyric display if not exists
            lyricDisplay = document.createElement('div');
            lyricDisplay.id = 'lyricDisplay';
            lyricDisplay.style.cssText = 'position:absolute;bottom:80px;left:50%;transform:translateX(-50%);' +
                'background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);padding:8px 20px;' +
                'border-radius:12px;color:var(--text-primary);font-size:1.1rem;' +
                'text-align:center;z-index:20;max-width:80%;transition:all 0.3s ease;' +
                'border:1px solid rgba(255,255,255,0.05);';
            var playerSection = document.querySelector('.player-section');
            if (playerSection) {
                playerSection.style.position = 'relative';
                playerSection.appendChild(lyricDisplay);
            }
        }
        lyricDisplay.textContent = lyric.text;
        lyricDisplay.style.opacity = '1';
        lyricDisplay.style.transform = 'translateX(-50%) translateY(0)';
        currentLyricIndex = index;
    }

    function updateLyrics(currentTime) {
        if (lyricsData.length === 0) return;
        // Find current lyric
        var found = -1;
        for (var i = lyricsData.length - 1; i >= 0; i--) {
            if (lyricsData[i].time <= currentTime) {
                found = i;
                break;
            }
        }
        if (found !== currentLyricIndex && found >= 0) {
            displayLyric(found);
        }
    }

    // Override onTimeUpdate to update lyrics
    var originalOnTimeUpdate = window.onTimeUpdate;
    if (typeof window.onTimeUpdate === 'function') {
        window.onTimeUpdate = function() {
            if (originalOnTimeUpdate) {
                originalOnTimeUpdate.apply(this, arguments);
            }
            if (audioEl && lyricsData.length > 0) {
                updateLyrics(audioEl.currentTime || 0);
            }
        };
    }

    // ============================================================
    // ADVANCED PLAYLIST FEATURES
    // ============================================================
    function sortPlaylist(by, order) {
        if (order === undefined) order = 'asc';
        var items = state.playlist;
        if (items.length === 0) return;

        var sortFn;
        switch (by) {
            case 'name':
                sortFn = function(a, b) {
                    var nameA = (a.name || '').toLowerCase();
                    var nameB = (b.name || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                };
                break;
            case 'duration':
                sortFn = function(a, b) { return (a.duration || 0) - (b.duration || 0); };
                break;
            case 'size':
                sortFn = function(a, b) { return (a.size || 0) - (b.size || 0); };
                break;
            case 'added':
                sortFn = function(a, b) {
                    var dateA = new Date(a.added || 0);
                    var dateB = new Date(b.added || 0);
                    return dateA - dateB;
                };
                break;
            case 'artist':
                sortFn = function(a, b) {
                    var artistA = (a.artist || '').toLowerCase();
                    var artistB = (b.artist || '').toLowerCase();
                    return artistA.localeCompare(artistB);
                };
                break;
            default:
                return;
        }

        state.playlist.sort(sortFn);
        if (order === 'desc') {
            state.playlist.reverse();
        }
        // Update current index
        if (state.currentIndex >= 0) {
            var currentId = state.playlist[state.currentIndex] ? state.playlist[state.currentIndex].id : null;
            if (currentId) {
                for (var i = 0; i < state.playlist.length; i++) {
                    if (state.playlist[i].id === currentId) {
                        state.currentIndex = i;
                        break;
                    }
                }
            } else {
                state.currentIndex = -1;
            }
        }
        updatePlaylistUI();
        showToast('لیست پخش مرتب شد', 'success');
    }

    function shufflePlaylist() {
        var items = state.playlist;
        if (items.length === 0) return;
        // Fisher-Yates shuffle
        for (var i = items.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = items[i];
            items[i] = items[j];
            items[j] = temp;
        }
        // Reset current index
        if (state.currentIndex >= 0) {
            state.currentIndex = 0;
        }
        updatePlaylistUI();
        showToast('لیست پخش به‌هم ریخته شد', 'success');
    }

    function exportPlaylist() {
        if (state.playlist.length === 0) {
            showToast('لیست پخش خالی است', 'warning');
            return;
        }
        var data = state.playlist.map(function(item) {
            return {
                name: item.name,
                artist: item.artist || '',
                album: item.album || '',
                duration: item.duration || 0,
                type: item.type || 'audio'
            };
        });
        var json = JSON.stringify(data, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'playlist_' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('لیست پخش با موفقیت ذخیره شد', 'success');
    }

    function importPlaylist(file) {
        try {
            var reader = new FileReader();
            reader.onload = function(e) {
                var data = JSON.parse(e.target.result);
                if (!Array.isArray(data)) {
                    showToast('فرمت فایل معتبر نیست', 'error');
                    return;
                }
                var added = 0;
                for (var i = 0; i < data.length; i++) {
                    var item = data[i];
                    if (item.name) {
                        // Create placeholder items (file paths won't work, so we add as metadata only)
                        var newItem = {
                            id: generateId(),
                            name: item.name,
                            path: '', // No actual file
                            duration: item.duration || 0,
                            size: 0,
                            type: item.type || 'audio',
                            artist: item.artist || '',
                            album: item.album || '',
                            year: '',
                            genre: '',
                            bitrate: '',
                            sampleRate: '',
                            channels: '',
                            codec: '',
                            resolution: '',
                            fps: '',
                            cover: '',
                            added: new Date().toISOString(),
                            _isPlaceholder: true
                        };
                        state.playlist.push(newItem);
                        added++;
                    }
                }
                updatePlaylistUI();
                showToast(added + ' آیتم به لیست پخش اضافه شد', 'success');
            };
            reader.readAsText(file);
        } catch (e) {
            console.error('Error importing playlist:', e);
            showToast('خطا در بارگذاری لیست پخش', 'error');
        }
    }

    // ============================================================
    // ERROR HANDLING & RECOVERY
    // ============================================================
    function handlePlaybackError(error) {
        console.error('Playback error:', error);
        showToast('خطا در پخش فایل: ' + (error.message || 'خطای ناشناخته'), 'error');
        // Try to recover: skip to next
        if (state.playlist.length > 1) {
            var next = state.currentIndex + 1;
            if (next < state.playlist.length) {
                state.currentIndex = next;
                playIndex(next);
                showToast('پرش به فایل بعدی...', 'warning');
            } else {
                stopPlayback();
            }
        } else {
            stopPlayback();
        }
    }

    // Override audio error handler
    var originalAudioError = audioEl ? audioEl.onerror : null;
    if (audioEl) {
        audioEl.addEventListener('error', function(e) {
            handlePlaybackError(e);
        });
    }

    // ============================================================
    // PERFORMANCE OPTIMIZATION - Debounce frequent operations
    // ============================================================
    var debouncedUpdateUI = debounce(function() {
        updatePlaylistUI();
    }, 300);

    // Optimize renderPlaylist for large playlists
    var originalRenderPlaylist = window.renderPlaylist;
    if (typeof window.renderPlaylist === 'function') {
        window.renderPlaylist = function() {
            if (state.playlist.length > 100) {
                // Use document fragment for better performance
                var fragment = document.createDocumentFragment();
                var container = dom.playlistContainer;
                var items = state.playlist;
                dom.playlistCount.textContent = items.length;

                var empty = dom.emptyPlaylist;
                container.innerHTML = '';
                if (items.length === 0) {
                    container.appendChild(empty);
                    empty.style.display = 'flex';
                    return;
                }
                empty.style.display = 'none';

                for (var i = 0; i < items.length; i++) {
                    var item = items[i];
                    var div = document.createElement('div');
                    div.className = 'playlist-item' + (i === state.currentIndex ? ' active' : '');
                    div.dataset.index = i;
                    div.draggable = true;
                    div.role = 'listitem';

                    var idxSpan = document.createElement('span');
                    idxSpan.className = 'playlist-index';
                    idxSpan.textContent = i + 1;

                    var cover = document.createElement('div');
                    cover.className = 'playlist-cover';
                    if (item.cover && item.cover.indexOf('data:') === 0) {
                        cover.innerHTML = '<img src="' + item.cover + '" alt="کاور">';
                    } else {
                        cover.textContent = item.type === 'video' ? '🎬' : '🎵';
                    }

                    var info = document.createElement('div');
                    info.className = 'playlist-info';
                    var title = document.createElement('div');
                    title.className = 'title';
                    title.textContent = item.name || 'بدون نام';
                    var sub = document.createElement('div');
                    sub.className = 'sub';
                    sub.textContent = item.artist || item.album || (item.type === 'video' ? 'ویدئو' : 'صوتی');
                    info.appendChild(title);
                    info.appendChild(sub);

                    var dur = document.createElement('span');
                    dur.className = 'playlist-duration';
                    dur.textContent = item.duration ? formatTime(item.duration) : '--:--';

                    var rm = document.createElement('button');
                    rm.className = 'remove-btn';
                    rm.textContent = '✕';
                    rm.setAttribute('aria-label', 'حذف');
                    rm.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var idx = parseInt(this.parentElement.dataset.index);
                        removeFromPlaylist(idx);
                    });

                    div.appendChild(idxSpan);
                    div.appendChild(cover);
                    div.appendChild(info);
                    div.appendChild(dur);
                    div.appendChild(rm);

                    div.addEventListener('click', function() {
                        var idx = parseInt(this.dataset.index);
                        if (idx === state.currentIndex) {
                            togglePlay();
                        } else {
                            state.currentIndex = idx;
                            playIndex(idx);
                        }
                    });

                    div.addEventListener('dblclick', function() {
                        var idx = parseInt(this.dataset.index);
                        if (idx !== state.currentIndex) {
                            state.currentIndex = idx;
                            playIndex(idx);
                        } else {
                            togglePlay();
                        }
                    });

                    div.addEventListener('dragstart', function(e) {
                        state.dragIndex = parseInt(this.dataset.index);
                        this.classList.add('dragging');
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(state.dragIndex));
                        dom.dragGhost.textContent = item.name;
                        dom.dragGhost.style.display = 'block';
                        document.body.appendChild(dom.dragGhost);
                    });

                    div.addEventListener('dragend', function() {
                        this.classList.remove('dragging');
                        dom.dragGhost.style.display = 'none';
                        document.querySelectorAll('.playlist-item.drag-over').forEach(function(el) {
                            el.classList.remove('drag-over');
                        });
                    });

                    div.addEventListener('dragover', function(e) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        document.querySelectorAll('.playlist-item.drag-over').forEach(function(el) {
                            el.classList.remove('drag-over');
                        });
                        this.classList.add('drag-over');
                    });

                    div.addEventListener('dragleave', function() {
                        this.classList.remove('drag-over');
                    });

                    div.addEventListener('drop', function(e) {
                        e.preventDefault();
                        this.classList.remove('drag-over');
                        var from = parseInt(e.dataTransfer.getData('text/plain'));
                        var to = parseInt(this.dataset.index);
                        if (!isNaN(from) && from !== to) {
                            movePlaylistItem(from, to);
                        }
                        dom.dragGhost.style.display = 'none';
                    });

                    fragment.appendChild(div);
                }
                container.appendChild(fragment);
                // Update active state
                document.querySelectorAll('.playlist-item').forEach(function(el) {
                    var idx = parseInt(el.dataset.index);
                    el.classList.toggle('active', idx === state.currentIndex);
                });
            } else {
                // Use original render for small playlists
                if (originalRenderPlaylist) {
                    originalRenderPlaylist.apply(this, arguments);
                }
            }
        };
    }

    // ============================================================
    // EXPOSE NEW FUNCTIONS
    // ============================================================
    window.loadSubtitle = loadSubtitle;
    window.loadLyrics = loadLyrics;
    window.sortPlaylist = sortPlaylist;
    window.shufflePlaylist = shufflePlaylist;
    window.exportPlaylist = exportPlaylist;
    window.importPlaylist = importPlaylist;
    window.handlePlaybackError = handlePlaybackError;
    window.debouncedUpdateUI = debouncedUpdateUI;

    console.log('script.js Part 7 loaded: Subtitle Support, Lyrics (LRC), Advanced Playlist Features & Error Handling.');

})();
// ============================================================
// script.js - دیار قدمگاه پلیر حرفه‌ای
// ============================================================
// Part 8 of 8 - Final Enhancements, Cleanup, Utilities & Advanced Features
// ============================================================

(function() {
    'use strict';

    // ============================================================
    // MEDIA SESSION API - Complete implementation
    // ============================================================
    function setupMediaSession() {
        if (!('mediaSession' in navigator)) {
            console.log('Media Session API not supported');
            return;
        }

        // Set action handlers for all standard actions
        try {
            navigator.mediaSession.setActionHandler('play', function() {
                if (!state.isPlaying) togglePlay();
            });
            navigator.mediaSession.setActionHandler('pause', function() {
                if (state.isPlaying) togglePlay();
            });
            navigator.mediaSession.setActionHandler('previoustrack', function() {
                playPrev();
            });
            navigator.mediaSession.setActionHandler('nexttrack', function() {
                playNext();
            });
            navigator.mediaSession.setActionHandler('seekbackward', function(details) {
                var seconds = details.seekOffset || 10;
                seekDelta(-seconds);
            });
            navigator.mediaSession.setActionHandler('seekforward', function(details) {
                var seconds = details.seekOffset || 10;
                seekDelta(seconds);
            });
            navigator.mediaSession.setActionHandler('seekto', function(details) {
                if (details.seekTime && audioEl) {
                    audioEl.currentTime = Math.min(details.seekTime, audioEl.duration || 0);
                }
            });
            navigator.mediaSession.setActionHandler('stop', function() {
                stopPlayback();
            });
            navigator.mediaSession.setActionHandler('togglecamera', function() {
                // Toggle video display if video is playing
                if (getCurrentItem() && getCurrentItem().type === 'video') {
                    var video = dom.videoPlayer;
                    if (video) {
                        video.hidden = !video.hidden;
                    }
                }
            });
        } catch (e) {
            console.warn('Some media session actions not supported:', e);
        }
    }

    // ============================================================
    // KEYBOARD SHORTCUTS - Complete list
    // ============================================================
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            var target = e.target;
            // Ignore if typing in input fields
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
                return;
            }

            // Check for Ctrl/Cmd key combinations
            var ctrl = e.ctrlKey || e.metaKey;

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (e.shiftKey) {
                        seekDelta(-30); // 30 seconds with shift
                    } else {
                        seekDelta(-5);
                    }
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (e.shiftKey) {
                        seekDelta(30);
                    } else {
                        seekDelta(5);
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setVolume(Math.min(state.volume + 0.05, 1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setVolume(Math.max(state.volume - 0.05, 0));
                    break;
                case 'f':
                case 'F':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'm':
                case 'M':
                    e.preventDefault();
                    toggleMute();
                    break;
                case 's':
                case 'S':
                    e.preventDefault();
                    if (ctrl) {
                        // Save current playlist
                        exportPlaylist();
                    } else {
                        toggleShuffle();
                    }
                    break;
                case 'r':
                case 'R':
                    e.preventDefault();
                    if (ctrl) {
                        // Reset all settings
                        if (confirm('آیا از بازنشانی تمام تنظیمات اطمینان دارید؟')) {
                            resetAllSettings();
                        }
                    } else {
                        toggleRepeat();
                    }
                    break;
                case 'Delete':
                case 'Backspace':
                    if (state.currentIndex >= 0) {
                        e.preventDefault();
                        removeFromPlaylist(state.currentIndex);
                    }
                    break;
                case 'l':
                case 'L':
                    e.preventDefault();
                    // Toggle lyrics display
                    if (lyricsData.length > 0) {
                        var lyricDisplay = document.getElementById('lyricDisplay');
                        if (lyricDisplay) {
                            lyricDisplay.style.display = lyricDisplay.style.display === 'none' ? 'block' : 'none';
                        }
                    }
                    break;
                case 't':
                case 'T':
                    e.preventDefault();
                    // Sleep timer
                    if (sleepTimerId) {
                        cancelSleepTimer();
                    } else {
                        var minutes = 15;
                        if (e.shiftKey) minutes = 30;
                        if (e.ctrlKey) minutes = 60;
                        setSleepTimer(minutes);
                    }
                    break;
                case 'v':
                case 'V':
                    e.preventDefault();
                    // Toggle visualizer mode
                    toggleVisualizerMode();
                    break;
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7':
                case '8':
                case '9':
                case '0':
                    if (ctrl) {
                        e.preventDefault();
                        var index = parseInt(e.key);
                        if (index === 0) index = 10;
                        // Jump to playlist item
                        var targetIndex = index - 1;
                        if (targetIndex < state.playlist.length) {
                            state.currentIndex = targetIndex;
                            playIndex(targetIndex);
                        }
                    }
                    break;
                case 'Escape':
                    // Close all panels
                    if (state.queueVisible) {
                        dom.queuePanel.classList.remove('open');
                        state.queueVisible = false;
                    }
                    if (state.eqVisible) {
                        dom.eqModal.classList.remove('open');
                        state.eqVisible = false;
                    }
                    if (dom.playlistDrawer.classList.contains('open')) {
                        closeDrawer();
                    }
                    break;
            }
        });
    }

    // ============================================================
    // CONTEXT MENU - Right-click on playlist items
    // ============================================================
    function setupContextMenu() {
        document.addEventListener('contextmenu', function(e) {
            var item = e.target.closest('.playlist-item');
            if (!item) return;
            e.preventDefault();
            var idx = parseInt(item.dataset.index);
            if (isNaN(idx)) return;

            // Build custom context menu
            var menu = document.getElementById('contextMenu');
            if (!menu) {
                menu = document.createElement('div');
                menu.id = 'contextMenu';
                menu.style.cssText = 'position:fixed;background:rgba(20,20,20,0.95);backdrop-filter:blur(10px);' +
                    'border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:4px 0;' +
                    'box-shadow:0 8px 32px rgba(0,0,0,0.6);z-index:1000;min-width:180px;';
                document.body.appendChild(menu);
            }

            // Clear menu
            menu.innerHTML = '';
            menu.style.display = 'block';
            menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
            menu.style.top = Math.min(e.clientY, window.innerHeight - 300) + 'px';

            var items = [
                { label: '▶ پخش', action: function() { state.currentIndex = idx;
                        playIndex(idx); } },
                { label: '➕ اضافه به صف', action: function() { addToQueue(state.playlist[idx].id); } },
                { label: '❤️ علاقه‌مندی', action: function() {
                        state.currentIndex = idx;
                        toggleFavorite();
                    } },
                { label: '✕ حذف', action: function() { removeFromPlaylist(idx); } },
                { label: '📋 اطلاعات فایل', action: function() { showFileInfo(idx); } },
            ];

            // Add separator
            if (idx !== state.currentIndex) {
                items.push({ label: '─', action: null });
                items.push({ label: '📊 نمایش متادیتا', action: function() { showMetadata(idx); } });
            }

            items.forEach(function(item) {
                var div = document.createElement('div');
                div.style.cssText = 'padding:8px 16px;cursor:pointer;color:var(--text-secondary);' +
                    'transition:all 0.2s;font-size:0.85rem;';
                if (item.label === '─') {
                    div.style.cssText = 'padding:0;height:1px;background:rgba(255,255,255,0.05);margin:4px 8px;';
                    div.textContent = '';
                } else {
                    div.textContent = item.label;
                    div.addEventListener('click', function() {
                        menu.style.display = 'none';
                        if (item.action) item.action();
                    });
                    div.addEventListener('mouseenter', function() {
                        this.style.background = 'rgba(124,92,255,0.15)';
                        this.style.color = 'var(--text-primary)';
                    });
                    div.addEventListener('mouseleave', function() {
                        this.style.background = 'transparent';
                        this.style.color = 'var(--text-secondary)';
                    });
                }
                menu.appendChild(div);
            });

            // Close menu on click outside
            var closeMenu = function(e2) {
                if (!menu.contains(e2.target)) {
                    menu.style.display = 'none';
                    document.removeEventListener('click', closeMenu);
                    document.removeEventListener('keydown', closeMenuOnEsc);
                }
            };
            var closeMenuOnEsc = function(e2) {
                if (e2.key === 'Escape') {
                    menu.style.display = 'none';
                    document.removeEventListener('click', closeMenu);
                    document.removeEventListener('keydown', closeMenuOnEsc);
                }
            };
            setTimeout(function() {
                document.addEventListener('click', closeMenu);
                document.addEventListener('keydown', closeMenuOnEsc);
            }, 10);
        });
    }

    // ============================================================
    // FILE INFO / METADATA DISPLAY
    // ============================================================
    function showFileInfo(index) {
        var item = state.playlist[index];
        if (!item) return;
        var info = '📋 اطلاعات فایل\n';
        info += '─────────────\n';
        info += 'نام: ' + (item.name || 'نامشخص') + '\n';
        info += 'نوع: ' + (item.type || 'نامشخص') + '\n';
        info += 'مدت: ' + (item.duration ? formatTime(item.duration) : 'نامشخص') + '\n';
        info += 'حجم: ' + (item.size ? (item.size / 1024 / 1024).toFixed(2) + ' MB' : 'نامشخص') + '\n';
        info += 'هنرمند: ' + (item.artist || 'نامشخص') + '\n';
        info += 'آلبوم: ' + (item.album || 'نامشخص') + '\n';
        info += 'سال: ' + (item.year || 'نامشخص') + '\n';
        info += 'ژانر: ' + (item.genre || 'نامشخص') + '\n';
        info += 'کدک: ' + (item.codec || 'نامشخص') + '\n';
        info += 'رزولوشن: ' + (item.resolution || 'نامشخص') + '\n';
        info += 'افزوده‌شده: ' + (item.added ? new Date(item.added).toLocaleString() : 'نامشخص') + '\n';
        showToast(info.replace(/\n/g, ' | '), 'info');
    }

    function showMetadata(index) {
        var item = state.playlist[index];
        if (!item) return;
        var info = [];
        if (item.artist) info.push('🎤 ' + item.artist);
        if (item.album) info.push('💿 ' + item.album);
        if (item.year) info.push('📅 ' + item.year);
        if (item.genre) info.push('🎵 ' + item.genre);
        if (item.bitrate) info.push('📊 ' + item.bitrate + ' kbps');
        if (item.sampleRate) info.push('🎛️ ' + item.sampleRate + ' Hz');
        if (item.channels) info.push('🔊 ' + item.channels + ' ch');
        if (item.codec) info.push('💻 ' + item.codec);
        if (item.resolution) info.push('📐 ' + item.resolution);
        if (item.fps) info.push('🎞️ ' + item.fps + ' fps');
        if (info.length === 0) {
            info.push('هیچ متادیتایی موجود نیست');
        }
        showToast(info.join(' | '), 'info');
    }

    // ============================================================
    // RESET ALL SETTINGS
    // ============================================================
    function resetAllSettings() {
        try {
            // Clear localStorage
            var keys = Object.values(STORAGE);
            keys.forEach(function(key) {
                localStorage.removeItem(key);
            });
            // Reset state
            state.volume = 0.8;
            state.speed = 1.0;
            state.repeat = 'none';
            state.shuffle = false;
            state.favorites = [];
            state.recent = [];
            state.eqValues = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            state.eqPreset = 'flat';
            state.theme = 'dark';
            // Apply reset
            applyTheme('dark');
            dom.volumeSlider.value = 0.8;
            dom.speedBtn.textContent = '1.0x';
            dom.repeatBtn.textContent = '🔁';
            dom.repeatBtn.classList.remove('active');
            dom.shuffleBtn.classList.remove('active');
            showToast('تمامی تنظیمات بازنشانی شد', 'success');
            // Clear playlist if user wants
            if (state.playlist.length > 0 && confirm('آیا لیست پخش نیز پاک شود؟')) {
                clearPlaylist();
            }
        } catch (e) {
            console.error('Error resetting settings:', e);
            showToast('خطا در بازنشانی تنظیمات', 'error');
        }
    }

    // ============================================================
    // AUTO-SAVE & RECOVERY
    // ============================================================
    function setupAutoSave() {
        // Auto-save every 30 seconds
        setInterval(function() {
            if (state.playlist.length > 0) {
                savePlaylist();
                if (state.currentIndex >= 0) {
                    var item = state.playlist[state.currentIndex];
                    if (item && audioEl) {
                        saveTime(item.id, audioEl.currentTime || 0);
                    }
                }
            }
        }, 30000);

        // Save on page unload
        window.addEventListener('beforeunload', function() {
            savePlaylist();
            if (state.currentIndex >= 0) {
                var item = state.playlist[state.currentIndex];
                if (item && audioEl) {
                    saveTime(item.id, audioEl.currentTime || 0);
                }
            }
        });
    }

    // ============================================================
    // DRAG AND DROP IMPROVEMENTS
    // ============================================================
    function setupDragAndDrop() {
        // Enhanced drag and drop for the entire app
        var dragCounter = 0;

        document.addEventListener('dragenter', function(e) {
            e.preventDefault();
            dragCounter++;
            if (dragCounter === 1) {
                dom.dropZone.classList.add('dragover');
            }
        });

        document.addEventListener('dragleave', function(e) {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) {
                dom.dropZone.classList.remove('dragover');
            }
        });

        document.addEventListener('dragover', function(e) {
            e.preventDefault();
            dom.dropZone.classList.add('dragover');
        });

        document.addEventListener('drop', function(e) {
            e.preventDefault();
            dragCounter = 0;
            dom.dropZone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length) {
                handleFiles(e.dataTransfer.files);
            }
        });
    }

    // ============================================================
    // NETWORK STATUS HANDLING
    // ============================================================
    function setupNetworkHandling() {
        var wasOnline = navigator.onLine;

        window.addEventListener('online', function() {
            if (!wasOnline) {
                wasOnline = true;
                showToast('🌐 اتصال اینترنت برقرار شد', 'success');
            }
        });

        window.addEventListener('offline', function() {
            wasOnline = false;
            showToast('🌐 اتصال اینترنت قطع شد (حالت آفلاین)', 'warning');
        });

        // Check if we're offline and show status
        if (!navigator.onLine) {
            showToast('🌐 حالت آفلاین - برخی ویژگی‌ها ممکن است محدود شوند', 'warning');
        }
    }

    // ============================================================
    // PERFORMANCE OPTIMIZATION - Lazy loading for large playlists
    // ============================================================
    function optimizePlaylistRendering() {
        var container = dom.playlistContainer;
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 20) {
                    // If many nodes added, optimize rendering
                    requestAnimationFrame(function() {
                        var items = container.querySelectorAll('.playlist-item');
                        if (items.length > 200) {
                            // Virtual scrolling could be implemented here
                            // For now, we just ensure smooth rendering
                            container.style.willChange = 'transform';
                        }
                    });
                }
            });
        });
        observer.observe(container, { childList: true, subtree: true });
    }

    // ============================================================
    // CACHE CLEANUP
    // ============================================================
    function clearCache() {
        if ('caches' in window) {
            caches.keys().then(function(names) {
                names.forEach(function(name) {
                    caches.delete(name);
                });
                showToast('کش مرورگر پاک شد', 'success');
            }).catch(function() {
                showToast('خطا در پاک کردن کش', 'error');
            });
        } else {
            showToast('مرورگر از کش پشتیبانی نمی‌کند', 'warning');
        }
    }

    // ============================================================
    // ABOUT DIALOG
    // ============================================================
    function showAbout() {
        var version = '1.0.0';
        var info = '🎵 دیار قدمگاه\n';
        info += 'پلیر حرفه‌ای صوتی و تصویری\n';
        info += 'نسخه ' + version + '\n';
        info += '─────────────\n';
        info += '✨ ویژگی‌ها:\n';
        info += '• پخش صوتی و تصویری\n';
        info += '• یکسان‌ساز ۱۰ باند\n';
        info += '• ویژوالایزر پیشرفته\n';
        info += '• پشتیبانی از زیرنویس\n';
        info += '• نمایش متن ترانه (LRC)\n';
        info += '• تایمر خواب\n';
        info += '• حالت آفلاین\n';
        info += '• نصب به عنوان PWA\n';
        info += '─────────────\n';
        info += '🖥️ ساخته شده با ❤️ برای ایران';
        showToast(info.replace(/\n/g, ' | '), 'info');
    }

    // ============================================================
    // LOGGING & DEBUGGING
    // ============================================================
    function setupDebugging() {
        // Enable debug mode with localStorage flag
        var debug = localStorage.getItem('diar_debug') === 'true';
        if (debug) {
            console.log('🐛 Debug mode enabled');
            // Log state changes
            var originalState = {};
            Object.keys(state).forEach(function(key) {
                originalState[key] = state[key];
            });
            setInterval(function() {
                Object.keys(state).forEach(function(key) {
                    if (state[key] !== originalState[key]) {
                        console.log('[DEBUG] State changed:', key, state[key]);
                        originalState[key] = state[key];
                    }
                });
            }, 1000);

            // Log audio events
            if (audioEl) {
                var events = ['play', 'pause', 'ended', 'timeupdate', 'volumechange', 'ratechange'];
                events.forEach(function(eventName) {
                    audioEl.addEventListener(eventName, function() {
                        console.log('[DEBUG] Audio event:', eventName);
                    });
                });
            }
        }
    }

    // ============================================================
    // INITIALIZE ALL FINAL FEATURES
    // ============================================================
    function initFinalFeatures() {
        setupMediaSession();
        setupKeyboardShortcuts();
        setupContextMenu();
        setupAutoSave();
        setupDragAndDrop();
        setupNetworkHandling();
        optimizePlaylistRendering();
        setupDebugging();

        // Add global shortcuts for utility functions
        window.showAbout = showAbout;
        window.clearCache = clearCache;
        window.resetAllSettings = resetAllSettings;
        window.showFileInfo = showFileInfo;
        window.showMetadata = showMetadata;

        // Add keyboard shortcut hint
        console.log('⌨️ دیار قدمگاه - میانبرهای صفحه‌کلید:');
        console.log('  Space: پخش/مکث');
        console.log('  ←/→: ۵ ثانیه عقب/جلو');
        console.log('  Shift+←/→: ۳۰ ثانیه');
        console.log('  ↑/↓: تنظیم ولوم');
        console.log('  F: تمام صفحه');
        console.log('  M: بی‌صدا');
        console.log('  S: تصادفی | Ctrl+S: ذخیره لیست');
        console.log('  R: تکرار | Ctrl+R: بازنشانی تنظیمات');
        console.log('  Delete: حذف فایل جاری');
        console.log('  L: نمایش/مخفی کردن متن ترانه');
        console.log('  T: تایمر خواب (15 دقیقه)');
        console.log('  Shift+T: تایمر خواب (30 دقیقه)');
        console.log('  Ctrl+T: تایمر خواب (60 دقیقه)');
        console.log('  V: تغییر حالت ویژوالایزر');
        console.log('  Ctrl+1-0: پرش به آیتم لیست');
        console.log('  Escape: بستن پنل‌ها');

        // Check if PWA is installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('📱 دیار قدمگاه در حالت PWA اجرا می‌شود');
        }

        // Set initial media session if playing
        var currentItem = getCurrentItem();
        if (currentItem) {
            updateMediaSession(currentItem);
        }

        console.log('✅ دیار قدمگاه - تمام ویژگی‌ها بارگذاری شدند');
        console.log('🎵 نسخه 1.0.0 - آماده برای استفاده');
    }

    // ============================================================
    // EXPOSE FINAL FUNCTIONS
    // ============================================================
    window.setupMediaSession = setupMediaSession;
    window.setupKeyboardShortcuts = setupKeyboardShortcuts;
    window.setupContextMenu = setupContextMenu;
    window.setupAutoSave = setupAutoSave;
    window.setupDragAndDrop = setupDragAndDrop;
    window.setupNetworkHandling = setupNetworkHandling;
    window.optimizePlaylistRendering = optimizePlaylistRendering;
    window.setupDebugging = setupDebugging;
    window.initFinalFeatures = initFinalFeatures;
    window.resetAllSettings = resetAllSettings;
    window.clearCache = clearCache;
    window.showAbout = showAbout;
    window.showFileInfo = showFileInfo;
    window.showMetadata = showMetadata;

    // ============================================================
    // AUTO-INITIALIZE FINAL FEATURES AFTER DOM READY
    // ============================================================
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // Wait a bit for other parts to load
        setTimeout(initFinalFeatures, 100);
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(initFinalFeatures, 100);
        });
    }

    console.log('script.js Part 8 loaded: Final Enhancements, Cleanup, Utilities & Advanced Features.');
    console.log('🎵 دیار قدمگاه - پلیر حرفه‌ای کاملاً آماده است!');

})();

// ============================================================
// GLOBAL REGISTRATION - Ensure all functions are accessible
// ============================================================
(function() {
    // Register all functions to window if not already registered
    var functions = [
        'setupMediaSession', 'setupKeyboardShortcuts', 'setupContextMenu',
        'setupAutoSave', 'setupDragAndDrop', 'setupNetworkHandling',
        'optimizePlaylistRendering', 'setupDebugging', 'initFinalFeatures',
        'resetAllSettings', 'clearCache', 'showAbout', 'showFileInfo', 'showMetadata'
    ];

    functions.forEach(function(fn) {
        if (typeof window[fn] === 'function') {
            // Already registered
        } else {
            // Try to get from closure (this should not happen)
            console.warn('Function not registered:', fn);
        }
    });

    // Ensure media session is updated when playback state changes
    var originalTogglePlay = window.togglePlay;
    if (typeof window.togglePlay === 'function') {
        window.togglePlay = function() {
            originalTogglePlay.apply(this, arguments);
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
            }
        };
    }

    console.log('✅ تمام توابع دیار قدمگاه ثبت شدند');
})();

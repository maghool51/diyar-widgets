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

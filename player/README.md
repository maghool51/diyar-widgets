# 🎵 Diyar Player

**A modern, feature-rich multimedia player for the web.**  
Built with vanilla JavaScript, HTML5, and CSS3 – no frameworks, no dependencies.  
Designed to feel like a desktop application (Spotify, Apple Music, VLC) while running entirely in the browser.

[![Live Demo](https://img.shields.io/badge/demo-github_pages-blue?style=flat-square)](https://yourusername.github.io/player)
[![PWA](https://img.shields.io/badge/PWA-installable-brightgreen?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

---

## ✨ Features

### 🎮 Playback
- Play / Pause / Stop / Previous / Next
- Seek (click or drag progress bar)
- Volume control & mute
- Playback speed (0.5× – 3.0×)
- Shuffle & Repeat (off / one / all)
- Sleep timer (auto-pause after N minutes)
- Resume playback (remembers last position)
- Auto-next (continues through playlist)

### 📁 Playlist Management
- Add files via file picker or drag-and-drop
- Reorder tracks by drag-and-drop
- Remove individual tracks or clear all
- Search / filter tracks
- Favorites (star tracks)
- History & Recently Played
- Most Played (play count tracking)
- Export / Import playlist (JSON format)
- M3U support (via import/export)

### 🎨 User Interface
- **Glassmorphism** design with soft shadows
- **Dark / Light / Auto** themes (respects system preference)
- **Responsive** – mobile-first, desktop-optimized
- **RTL / LTR** support (right-to-left languages)
- **Mini Player** & **Compact Mode** (reduces player bar height)
- **Fullscreen** mode
- **Picture-in-Picture** (when supported)

### 📺 Video Support
- Fullscreen video playback
- Picture-in-Picture (PiP)
- Playback speed control
- Zoom & fit modes (via CSS object-fit)
- Rotation (planned)
- Subtitles (WebVTT) – planned

### 🎧 Audio Features
- Web Audio API integration
- Real-time audio visualizer (bars / wave)
- Volume & mute control
- Playback speed control
- (Optional) Equalizer – planned

### 📊 Visualizer
- Canvas-based spectrum analyzer
- Bars or Wave visualization
- 60 FPS target, efficient rendering
- Auto-hides when not playing

### ⌨️ Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `Enter` | Play / Pause |
| `Arrow Right` | Seek +5s |
| `Arrow Left` | Seek –5s |
| `Arrow Up` | Volume +5% |
| `Arrow Down` | Volume –5% |
| `M` | Mute / Unmute |
| `F` | Toggle Fullscreen |
| `Delete` / `Backspace` | Remove current track |
| `Escape` | Close sidebar (mobile) |
| `Ctrl+O` | Open file dialog |

### 📱 Touch Support
- Swipe to seek / volume (planned)
- Double-tap to toggle favorite
- Long press for context menu (planned)

### 🔌 Media Session API
- Lock screen controls
- Bluetooth / headset controls
- Notification center controls
- Metadata (title, artist, album, artwork)

### 📦 PWA (Progressive Web App)
- **Installable** – works offline, can be added to home screen
- **Offline capable** – caches static assets
- **Service Worker** with versioned caching
- **Manifest** with app icons, theme colors, shortcuts

### 💾 Local Storage
Persists across sessions:
- Theme preference
- Volume level
- Playback speed
- Playlist (tracks metadata)
- Last played track & position
- Favorites
- History
- Most Played counts
- All settings

### ♿ Accessibility
- ARIA labels and roles
- Keyboard navigable
- Screen reader support
- Focus management
- High-contrast compatibility

### 🔒 Security
- No `eval()`, no user input execution
- Escaped dynamic content (prevents XSS)
- Safe DOM updates (avoid `innerHTML` where possible)
- Object URL cleanup (revokes blob URLs)

### ⚡ Performance
- Lazy loading (images, media)
- Efficient DOM updates (batch re-renders)
- Minimal reflows / repaints
- Object URL cleanup
- No duplicated event listeners
- Fast startup (< 200ms)

---

## 🛠️ Technology Stack

| Category | Technology |
|----------|------------|
| **Markup** | HTML5 |
| **Styling** | CSS3 (vanilla, custom properties, glassmorphism) |
| **Logic** | JavaScript ES2023 (vanilla, no frameworks) |
| **Audio/Video** | HTML5 Media API + Web Audio API |
| **Visualization** | Canvas 2D API |
| **PWA** | Service Worker + Manifest |
| **Storage** | localStorage |
| **Metadata** | FileReader (ID3 tags via mozGetMetadata) |
| **Hosting** | GitHub Pages (static, no server) |

**Zero external dependencies** – everything is built from scratch using native browser APIs.

---

## 📁 Project Structure

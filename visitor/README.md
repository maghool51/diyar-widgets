# 📊 Visitor — Diyar Widgets

A production-ready, Material Design 3 **visitor statistics widget** — built with
plain HTML5, CSS3, and vanilla ES6+ JavaScript. Fully RTL, Persian-first, themed
for light/dark, and architected so a real backend can be plugged in later by
changing a single function.

Part of the [Diyar Widgets](../) collection, alongside `gallery/`, `hadith/`,
`location/`, `news/`, and `player/`.

---

## ✨ Features

- **Material Design 3** tonal color system (light & dark, auto-detected from
  the browser/OS, with a manual toggle)
- **RTL & Persian-first** — native Persian digits and thousands separators
  (`184352` → `۱۸۴٬۳۵۲`)
- **Six live statistics**: امروز، دیروز، این هفته، این ماه، کل بازدید، کاربران آنلاین
- **Animated counters** with eased motion, staggered card entrance, hover
  elevation — all respecting `prefers-reduced-motion`
- **Responsive** grid layout (3 → 2 columns) down to small phones
- **Accessible**: semantic landmarks, ARIA labels & live regions, full
  keyboard focus states, `prefers-contrast: more` support
- **Zero dependencies** — no Bootstrap, no Tailwind, no jQuery, no build step
- **Future-proof data layer** — swap mock data for a real API by editing one
  function (see [Connecting a Real API](#-connecting-a-real-api))

---

## 📁 Folder Structure

```
visitor/
├── index.html      # Markup & semantic structure
├── visitor.css     # Material Design 3 tokens, layout, animations
├── visitor.js       # Modular ES6 application logic
├── config.js        # Central configuration (loads before visitor.js)
├── README.md        # This file
├── LICENSE           # MIT License
├── CHANGELOG.md      # Version history
├── package.json      # Metadata & optional dev scripts
└── icons/            # SVG icon assets
```

---

## 🚀 Installation

### Option A — Static file, zero setup

Just open `index.html` directly in a browser, or drop the whole `visitor/`
folder into any static site / CMS / iframe embed.

### Option B — Local dev server (recommended)

A local server avoids any browser restrictions around `file://` requests
(useful once real `fetch()` calls are added later).

```bash
cd visitor
npm start
```

This runs a zero-config static server (via `npx serve`) and prints a local
URL, typically `http://localhost:5500`.

### Option C — Embed inside an existing page

```html
<link rel="stylesheet" href="/widgets/visitor/visitor.css">
...
<div id="visitorWidget-container"></div>
...
<script src="/widgets/visitor/config.js"></script>
<script src="/widgets/visitor/visitor.js"></script>
```

> The widget is self-initializing on `DOMContentLoaded` — no manual JS call
> is required as long as the markup from `index.html` (or an equivalent
> `#visitorWidget` structure) is present on the page.

---

## ⚙️ Configuration

All tunables live in `config.js`:

| Key                 | Type    | Description                                              |
|----------------------|---------|-----------------------------------------------------------|
| `VERSION`             | string  | Widget semantic version.                                  |
| `CACHE_TIME`          | number  | How long (ms) fetched stats are cached before refetching. |
| `UPDATE_INTERVAL`     | number  | Background auto-refresh interval (ms).                    |
| `THEME`               | string  | `"auto"` \| `"light"` \| `"dark"`.                         |
| `ANIMATION_SPEED`     | number  | Base duration (ms) for counter animations.                |
| `DEBUG`               | boolean | Enables console logging and a `window.VisitorWidget` debug handle. |
| `API.USE_MOCK`        | boolean | Toggle mock data vs. real network requests.                |
| `API.ENDPOINT`        | string  | REST endpoint used once `USE_MOCK` is `false`.             |
| `API.TIMEOUT_MS`      | number  | Request timeout for the real API call.                     |
| `DEFAULT_DATA`        | object  | Mock statistics payload (see below).                       |

### Mock data shape

```js
{
  today: 128,
  yesterday: 241,
  week: 1385,
  month: 5623,
  total: 184352,
  online: 7
}
```

---

## 🔌 Connecting a Real API

The entire data layer is isolated inside the `DataProvider` module in
`visitor.js`. To go live, replace **only** the body of `fetchVisitorStats`:

```js
// Before (mock)
async function fetchVisitorStats() {
  await simulateNetworkDelay();
  return { ...CONFIG.DEFAULT_DATA, updatedAt: new Date() };
}

// After (real API)
async function fetchVisitorStats() {
  const response = await fetch(CONFIG.API.ENDPOINT, {
    signal: AbortSignal.timeout(CONFIG.API.TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return { ...data, updatedAt: new Date() };
}
```

Then set `CONFIG.API.USE_MOCK = false` and update `CONFIG.API.ENDPOINT` in
`config.js`. No other file needs to change — `render()`, the counter
animations, caching, and auto-refresh all consume the same return shape.

The expected API response shape:

```json
{
  "today": 128,
  "yesterday": 241,
  "week": 1385,
  "month": 5623,
  "total": 184352,
  "online": 7
}
```

---

## 🎨 Theming

The widget reads three color states from `.visitor-widget[data-theme]`:

- `data-theme="auto"` — follows `prefers-color-scheme` (default)
- `data-theme="light"` — forces light mode
- `data-theme="dark"` — forces dark mode

All colors are expressed as CSS custom properties in `visitor.css`, following
the Material Design 3 role naming convention (`--md-primary`,
`--md-surface`, `--md-on-surface`, etc.), so re-theming the widget means
editing values in one place.

---

## ♿ Accessibility

- Landmarks: `<main role="region">`, `<header>`, `<section>`, `<footer>`
- `aria-label` on the widget root, grid, and every stat card
- `aria-live="polite"` on the live status indicator
- Visible focus rings (`:focus-visible`) on every interactive element
- Counter animations disabled under `prefers-reduced-motion: reduce`
- `prefers-contrast: more` fallback with stronger borders

---

## 🧩 Browser Support

Any evergreen browser (Chrome, Edge, Firefox, Safari) with support for CSS
custom properties, `requestAnimationFrame`, and ES6+ syntax. No polyfills are
bundled.

---

## 🤝 Contributing

Issues and pull requests are welcome under the main
[Diyar Widgets](../) repository. Please keep changes to this widget scoped to
the `visitor/` folder and update `CHANGELOG.md` for any user-facing change.

---

## 📄 License

Released under the [MIT License](./LICENSE).

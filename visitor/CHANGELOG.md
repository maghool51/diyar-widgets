# Changelog

All notable changes to the **visitor** widget will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-31

### Added

- Initial release of the Visitor Statistics widget (UI-first, mock data).
- Material Design 3 tonal color system with automatic light/dark theme
  detection (`prefers-color-scheme`) and a manual runtime toggle.
- Six statistic cards: امروز, دیروز, این هفته, این ماه, کل بازدید, کاربران آنلاین.
- Reusable `PersianNumberFormatter` module for Persian-digit, Persian-separator
  number and time formatting.
- Animated counters with ease-out easing, respecting `prefers-reduced-motion`.
- Staggered card fade-in entrance animation and hover elevation.
- Full RTL layout using the Vazirmatn Persian typeface.
- Responsive grid layout (3 → 2 columns) down to small mobile widths.
- `DataProvider` module with an in-memory cache and a single, isolated
  mock-data function designed to be swapped for a real REST call.
- Background auto-refresh loop with tab-visibility awareness (pauses when
  the tab is hidden, refreshes immediately when it becomes visible again).
- Accessibility: semantic landmarks, ARIA labels/live regions, full keyboard
  focus support, and a `prefers-contrast: more` fallback.
- `config.js` with `VERSION`, `CACHE_TIME`, `UPDATE_INTERVAL`, `THEME`,
  `ANIMATION_SPEED`, `DEBUG`, `API`, and `DEFAULT_DATA` settings.

### Notes

- No backend/API integration yet — all data is mocked in `DataProvider`
  inside `visitor.js`. See the README's "Connecting a Real API" section.

[1.0.0]: https://github.com/diyar-widgets/diyar-widgets/releases/tag/visitor-v1.0.0

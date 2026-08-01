# Changelog

All notable changes to the **Diyar Visitor Widget** are documented in this
file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-08-01

### Added

- Initial public release of the Diyar Visitor Widget.
- Six statistic cards: امروز (Today), دیروز (Yesterday), این هفته (This
  Week), این ماه (This Month), کل بازدید (Total Visits), and کاربران آنلاین
  (Online Users).
- Material Design 3 inspired visual language: rounded surfaces, soft
  elevation shadows, glassmorphism containers, and role-based color tokens.
- Full right-to-left (RTL) layout with native Persian typography via the
  Vazirmatn font family.
- Persian (Farsi) digit formatting with locale-correct thousands separators,
  exposed as a reusable `toPersianDigits()` utility.
- Light, Dark, and Auto (system-synced) theming with persisted user
  preference and an animated cross-fade transition between themes.
- Animated numeric counters using an ease-out-cubic roll-up, staggered card
  entrance animations (fade + slide + scale), Material ripple feedback on
  interactive controls, and a shimmering skeleton loading state.
- Fully isolated mock data layer (`fetchVisitorStats` in `utils.js`) designed
  so a future live API integration requires editing a single module.
- Background polling with automatic pause/resume based on tab visibility to
  avoid unnecessary work in hidden tabs.
- Manual refresh control with an accessible live-region announcement.
- Accessibility: semantic landmarks, ARIA roles and labels, visible focus
  rings, `prefers-reduced-motion` support, and `forced-colors` compatibility.
- Responsive layout tuned for mobile, foldables, tablets, desktops, and
  large/ultra-wide displays.
- Zero build step, zero runtime dependencies, and zero frameworks — pure
  ES2023 vanilla JavaScript, loaded as plain `<script>` tags.
- Complete project scaffolding: `README.md`, `CHANGELOG.md`, MIT `LICENSE`,
  `package.json`, `.gitignore`, and a standalone SVG icon set.

[1.0.0]: https://github.com/diyar-widgets/diyar-widgets/releases/tag/visitor-v1.0.0

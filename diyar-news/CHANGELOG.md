# Changelog

تمام تغییرات قابل‌توجه این پروژه در این فایل ثبت می‌شود.
قالب بر اساس [Keep a Changelog](https://keepachangelog.com/) است.

## [1.1.0] - 2026-08-01

### 🔒 امنیت (Security)
- رفع آسیب‌پذیری XSS: تمام محتوای آمده از RSS (عنوان، منبع، دسته، لینک) پیش از درج در HTML خروجی (`index.html`, `news.html`, `news-ticker.html`) با تابع `escapeHtml()` پاک‌سازی می‌شود.
- اعتبارسنجی سخت‌گیرانه‌تر لینک خبر با `new URL()` به‌جای `startsWith("http")` که قابل دور زدن بود.
- رفع همین آسیب‌پذیری در سمت مصرف‌کننده‌ی `news.json`: `news.js` و اسکریپت داخلی `news-ticker.html`.

### 🐛 رفع باگ
- رفع خطای اجرایی `ReferenceError: n is not defined` در تابع `showTicker()` در `news.js`.

### ⚙️ زیرساخت
- Workflow: افزودن `concurrency` برای جلوگیری از اجرای هم‌زمان چند run.
- Workflow: جایگزینی `npm install` با `npm ci` برای نصب قطعی و قابل‌بازتولید.
- Workflow: جایگزینی push با URL هاردکد به‌جای `git push origin HEAD:main` + `git pull --rebase` پیش از push.
- افزودن `timeout-minutes` برای جلوگیری از hang شدن job.

### 📄 مستندات
- افزودن `LICENSE` (MIT، مطابق با آنچه در `package.json` اعلام شده بود).
- افزودن `.gitignore` (جلوگیری از commit شدن `node_modules`).
- بازنویسی کامل `README.md` (رفع قطع‌شدگی، اصلاح تعداد منابع از ۵ به ۱۱، افزودن مستندات schema برای `news.json`، بخش امنیت، بخش توسعه محلی).
- افزودن این فایل (`CHANGELOG.md`).

### 🔍 SEO
- افزودن `meta description`, `meta robots`, و تگ‌های Open Graph به قالب HTML تولیدی در `fetch-news.js`.

### ⚠️ یافته‌های مستندشده (بدون تغییر کد، برای تصمیم‌گیری آینده)
- `news.js` و `news.css` در حال حاضر توسط هیچ صفحه‌ای import/link نمی‌شوند؛ باگ‌های آن‌ها رفع شد اما تصمیم درباره‌ی حذف یا فعال‌سازی آن‌ها به توسعه‌دهنده واگذار شد.
- ساختار `news.json` (وجود همزمان `news` و `categorizedNews`) برای حفظ سازگاری با مصرف‌کنندگان فعلی (Diyar Widgets) بدون تغییر باقی ماند.

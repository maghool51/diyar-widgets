# 📰 Diyar Widgets News Ticker v2.0

ویجت خبری حرفه‌ای، سریع، سبک و مستقل برای نمایش آخرین اخبار.

## ✨ ویژگی‌ها

- ✅ کاملاً مستقل و بدون وابستگی
- ✅ سازگار با GitHub Pages، Blogfa و iframe
- ✅ کش هوشمند با localStorage
- ✅ بروزرسانی خودکار هر ۵ دقیقه
- ✅ حرکت بی‌نهایت با سرعت هوشمند
- ✅ واکنش‌گرا (Responsive) برای تمام دستگاه‌ها
- ✅ دارای حالت شب (Dark Mode)
- ✅ امن در برابر XSS و HTML Injection
- ✅ بهینه برای Core Web Vitals
- ✅ بدون Memory Leak

## 🚀 نصب و راه‌اندازی در GitHub Pages

1. ریپازیتوری جدید بسازید
2. فایل‌های زیر را آپلود کنید:
   - `index.html`
   - `ticker.css`
   - `ticker.js`
   - `config.js`
   - `news.json`
3. در Settings > Pages، branch `main` را انتخاب کنید
4. آدرس `https://YOUR-USERNAME.github.io/REPO-NAME` را باز کنید

## 🔧 تنظیمات

فایل `config.js` را ویرایش کنید:

```javascript
window.TICKER_CONFIG = {
    primarySource: 'URL-اخبار-شما',
    cacheExpiry: 300000,  // ۵ دقیقه
    baseSpeed: 45,        // سرعت حرکت
    // ...
};

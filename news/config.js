/**
 * ============================================
 * Diyar Widgets News Ticker v2.0
 * Config File - تنظیمات کاربر
 * ============================================
 * 
 * این فایل اختیاری است. در صورت وجود، تنظیمات
 * آن بر پیش‌فرض‌ها اعمال می‌شود.
 */

window.TICKER_CONFIG = {
    // ---------- منابع ----------
    primarySource: 'https://maghool51.github.io/diyar-news/news.json',
    fallbackSource: './news.json',
    
    // ---------- زمان‌ها (به میلی‌ثانیه) ----------
    cacheExpiry: 300000,      // ۵ دقیقه
    updateInterval: 300000,   // ۵ دقیقه
    
    // ---------- سرعت حرکت ----------
    baseSpeed: 45,            // پیکسل بر ثانیه
    minSpeed: 25,
    maxSpeed: 80,
    
    // ---------- ظاهر ----------
    labelText: 'اخبار فوری',
    tickerHeight: 50,         // پیکسل
    fontSize: 14.5,           // پیکسل
    itemGap: 24,              // فاصله بین اخبار (پیکسل)
    
    // ---------- فعال/غیرفعال کردن ویژگی‌ها ----------
    enableFade: true,
    enableBlink: true,
    enableHover: true,
    
    // ---------- حالت دیباگ ----------
    debug: false
};

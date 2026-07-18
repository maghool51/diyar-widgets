/**
 * ============================================
 * Diyar Widgets News Ticker v2.0
 * Config File - تنظیمات مخصوص GitHub Pages
 * ============================================
 */

window.TICKER_CONFIG = {
    // ---------- منابع ----------
    // برای GitHub Pages از آدرس کامل استفاده کنید
    primarySource: 'https://maghool51.github.io/diyar-news/news.json',
    fallbackSource: './news.json',  // فایل محلی در همین ریپازیتوری
    
    // ---------- زمان‌ها (میلی‌ثانیه) ----------
    cacheExpiry: 300000,      // ۵ دقیقه
    updateInterval: 300000,   // ۵ دقیقه
    
    // ---------- سرعت ----------
    baseSpeed: 45,
    minSpeed: 25,
    maxSpeed: 80,
    
    // ---------- ظاهر ----------
    labelText: 'اخبار فوری',
    tickerHeight: 50,
    fontSize: 14.5,
    itemGap: 24,
    
    // ---------- ویژگی‌ها ----------
    enableFade: true,
    enableBlink: true,
    enableHover: true,
    
    // ---------- دیباگ (برای تولید خاموش کنید) ----------
    debug: false
};

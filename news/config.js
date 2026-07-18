/**
 * ============================================
 * Diyar Widgets News Ticker v2.0
 * فایل تنظیمات - Config
 * ============================================
 * 
 * @version 2.0.0
 * @author Diyar Widgets
 * @license MIT
 * 
 * برای تغییر تنظیمات، مقادیر زیر را ویرایش کنید.
 * ============================================
 */

window.TICKER_CONFIG = {
    // ========== نسخه ==========
    version: '2.0.0',

    // ========== منابع اخبار ==========
    primarySource: 'https://maghool51.github.io/diyar-news/news.json',
    fallbackSource: './news.json',

    // ========== زمان‌ها (میلی‌ثانیه) ==========
    cacheExpiry: 300000,      // ۵ دقیقه
    updateInterval: 300000,   // ۵ دقیقه

    // ========== سرعت حرکت (پیکسل بر ثانیه) ==========
    baseSpeed: 35,
    minSpeed: 20,
    maxSpeed: 60,

    // ========== ظاهر ==========
    labelText: 'اخبار فوری',
    tickerHeight: 50,
    fontSize: 14.5,
    itemGap: 24,

    // ========== ویژگی‌ها ==========
    enableFade: true,
    enableBlink: true,
    enableHover: true,

    // ========== مدیریت خطا ==========
    requestTimeout: 10000,
    retryCount: 3,
    retryDelay: 2000,

    // ========== دیباگ ==========
    debug: false
};

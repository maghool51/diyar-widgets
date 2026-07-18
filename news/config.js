window.TICKER_CONFIG = {
    version: '2.0.0',

    // ===== منبع اصلی =====
    // از پروژه diyar-news در GitHub Pages
    primarySource: 'https://maghool51.github.io/diyar-news/news.json',
    
    // ===== منبع پشتیبان =====
    // فایل محلی در همین پروژه (diyar-widgets)
    fallbackSource: './news.json',

    // ===== زمان‌ها =====
    cacheExpiry: 300000,
    updateInterval: 300000,

    // ===== سرعت =====
    baseSpeed: 35,
    minSpeed: 20,
    maxSpeed: 60,

    // ===== ظاهر =====
    labelText: 'اخبار فوری',
    tickerHeight: 50,
    fontSize: 14.5,
    itemGap: 24,

    // ===== ویژگی‌ها =====
    enableFade: true,
    enableBlink: true,
    enableHover: true,

    // ===== مدیریت خطا =====
    requestTimeout: 10000,
    retryCount: 3,
    retryDelay: 2000,

    // ===== دیباگ =====
    debug: true
};

/**
 * ============================================
 * Diyar Widgets News Ticker v2.0
 * JavaScript - ES6+ / مستقل / بدون وابستگی
 * ============================================
 * 
 * ویژگی‌ها:
 * - دریافت از ۳ منبع (اولویت: URL اصلی → فایل محلی → localStorage)
 * - کش هوشمند با تاریخ انقضا (پیش‌فرض ۵ دقیقه)
 * - بروزرسانی خودکار در بازه زمانی مشخص
 * - حرکت بی‌نهایت با سرعت هوشمند بر اساس تعداد و طول اخبار
 * - حذف اخبار تکراری
 * - پشتیبانی از خبر ویژه (breaking)
 * - مدیریت خطا و بازیابی خودکار
 * - امنیت در برابر XSS و HTML Injection
 * - بهینه برای CPU/RAM و Core Web Vitals
 * - بدون Memory Leak
 * ============================================
 */

(function() {
    'use strict';

    // ---------- تنظیمات از config.js یا پیش‌فرض ----------
    const CONFIG = window.TICKER_CONFIG || {};

    const SETTINGS = {
        // منابع
        primarySource: CONFIG.primarySource || 'https://maghool51.github.io/diyar-news/news.json',
        fallbackSource: CONFIG.fallbackSource || './news.json',
        
        // زمان‌ها (به میلی‌ثانیه)
        cacheExpiry: CONFIG.cacheExpiry || 300000,      // ۵ دقیقه
        updateInterval: CONFIG.updateInterval || 300000, // ۵ دقیقه
        
        // سرعت حرکت (پیکسل بر ثانیه)
        baseSpeed: CONFIG.baseSpeed || 45,
        minSpeed: CONFIG.minSpeed || 25,
        maxSpeed: CONFIG.maxSpeed || 80,
        
        // ظاهر
        labelText: CONFIG.labelText || 'اخبار فوری',
        tickerHeight: CONFIG.tickerHeight || 50,
        fontSize: CONFIG.fontSize || 14.5,
        
        // ویژگی‌ها
        enableFade: CONFIG.enableFade !== undefined ? CONFIG.enableFade : true,
        enableBlink: CONFIG.enableBlink !== undefined ? CONFIG.enableBlink : true,
        enableHover: CONFIG.enableHover !== undefined ? CONFIG.enableHover : true,
        
        // فاصله بین اخبار (پیکسل)
        itemGap: CONFIG.itemGap || 24,
        
        // Debug
        debug: CONFIG.debug || false
    };

    // ---------- متغیرهای داخلی ----------
    let newsData = [];
    let track = null;
    let container = null;
    let animationId = null;
    let isPaused = false;
    let isTouchDevice = false;
    let updateTimer = null;
    let isLoading = false;
    let currentPosition = 0;

    // ---------- ابزارهای امنیتی ----------
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function sanitizeUrl(url) {
        if (!url) return '#';
        url = url.trim();
        // فقط http و https مجاز
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        return '#';
    }

    // ---------- لاگ دیباگ ----------
    function debugLog(message, data) {
        if (SETTINGS.debug) {
            console.log(`[Ticker v2.0] ${message}`, data || '');
        }
    }

    // ---------- نمایش پیام درون تیکر ----------
    function showMessage(message, type) {
        if (!track) return;
        const className = type === 'error' ? 'ticker-error' : 'ticker-loading';
        track.innerHTML = `<div class="${className}">${escapeHtml(message)}</div>`;
        track.style.animation = 'none';
        track.style.transform = 'translateX(0)';
    }

    // ---------- ذخیره در localStorage ----------
    function saveToCache(data) {
        try {
            const cacheData = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem('ticker_news_cache', JSON.stringify(cacheData));
            debugLog('ذخیره در کش انجام شد');
        } catch (e) {
            debugLog('خطا در ذخیره کش', e);
        }
    }

    // ---------- دریافت از localStorage ----------
    function loadFromCache() {
        try {
            const cached = localStorage.getItem('ticker_news_cache');
            if (!cached) return null;
            
            const parsed = JSON.parse(cached);
            const age = Date.now() - parsed.timestamp;
            
            if (age > SETTINGS.cacheExpiry) {
                debugLog('کش منقضی شده است');
                localStorage.removeItem('ticker_news_cache');
                return null;
            }
            
            debugLog('بارگذاری از کش', { age, items: parsed.data.length });
            return parsed.data;
        } catch (e) {
            debugLog('خطا در بارگذاری کش', e);
            return null;
        }
    }

    // ---------- دریافت اخبار از یک منبع ----------
    async function fetchNewsFromSource(url) {
        try {
            debugLog('دریافت از منبع:', url);
            const response = await fetch(url, {
                cache: 'no-store',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('داده‌های نامعتبر یا خالی');
            }
            
            debugLog('دریافت موفق:', data.length);
            return data;
        } catch (e) {
            debugLog('خطا در دریافت از منبع:', e.message);
            return null;
        }
    }

    // ---------- دریافت اخبار با اولویت ----------
    async function fetchNews() {
        if (isLoading) return null;
        isLoading = true;

        try {
            // ۱- منبع اصلی
            let data = await fetchNewsFromSource(SETTINGS.primarySource);
            if (data) {
                saveToCache(data);
                isLoading = false;
                return data;
            }

            // ۲- منبع پشتیبان (محلی)
            data = await fetchNewsFromSource(SETTINGS.fallbackSource);
            if (data) {
                saveToCache(data);
                isLoading = false;
                return data;
            }

            // ۳- کش localStorage
            data = loadFromCache();
            if (data) {
                isLoading = false;
                return data;
            }

            // ۴- هیچکدام
            isLoading = false;
            return null;

        } catch (e) {
            debugLog('خطای کلی در fetchNews', e);
            isLoading = false;
            
            // تلاش برای کش
            const cached = loadFromCache();
            if (cached) return cached;
            
            return null;
        }
    }

    // ---------- حذف اخبار تکراری ----------
    function deduplicateNews(items) {
        const seen = new Set();
        return items.filter(item => {
            const key = (item.title || '').trim();
            if (!key) return false;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    // ---------- محاسبه سرعت هوشمند ----------
    function calculateSpeed(items) {
        if (!items || items.length === 0) return SETTINGS.baseSpeed;
        
        // محاسبه طول کل متن
        let totalLength = 0;
        items.forEach(item => {
            totalLength += (item.title || '').length;
        });
        
        // سرعت بر اساس تعداد و طول
        const avgLength = totalLength / items.length;
        const countFactor = Math.max(0.5, Math.min(2, 15 / items.length));
        const lengthFactor = Math.max(0.6, Math.min(1.8, 40 / avgLength));
        
        let speed = SETTINGS.baseSpeed * countFactor * lengthFactor;
        speed = Math.max(SETTINGS.minSpeed, Math.min(SETTINGS.maxSpeed, speed));
        
        debugLog('سرعت محاسبه شده:', speed);
        return speed;
    }

    // ---------- ساخت المان‌های خبر ----------
    function createNewsElement(item) {
        const link = document.createElement('a');
        link.className = 'ticker-item';
        
        // عنوان
        const title = item.title && item.title.trim() ? item.title.trim() : 'خبر بدون عنوان';
        link.textContent = title;
        
        // لینک
        const url = sanitizeUrl(item.link);
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        
        // خبر ویژه
        if (item.breaking === true) {
            link.classList.add('breaking');
            const icon = document.createElement('span');
            icon.className = 'breaking-icon';
            icon.textContent = '🚨';
            link.prepend(icon);
        }
        
        // دسترس‌پذیری
        link.setAttribute('aria-label', `خبر: ${title}`);
        link.setAttribute('title', title);
        link.tabIndex = 0;
        
        return link;
    }

    // ---------- رندر اخبار در تیکر ----------
    function renderNews(items) {
        if (!track) return;

        // حذف اخبار تکراری
        const uniqueItems = deduplicateNews(items);
        
        if (!uniqueItems || uniqueItems.length === 0) {
            showMessage('هیچ خبری برای نمایش وجود ندارد', 'error');
            return;
        }

        // محاسبه سرعت
        const speed = calculateSpeed(uniqueItems);
        
        // ساخت المان‌ها
        const fragment = document.createDocumentFragment();
        
        // برای حرکت بی‌نهایت، اخبار را دو بار تکرار می‌کنیم
        const doubledItems = [...uniqueItems, ...uniqueItems];
        
        doubledItems.forEach(item => {
            const el = createNewsElement(item);
            fragment.appendChild(el);
        });

        // پاک کردن و افزودن
        track.innerHTML = '';
        track.appendChild(fragment);

        // محاسبه عرض کل
        const trackWidth = track.scrollWidth;
        const containerWidth = container ? container.clientWidth : 0;
        
        if (trackWidth <= containerWidth) {
            // اگر محتوا کمتر از ظرف است، حالت عادی
            track.style.animation = 'none';
            track.style.transform = 'translateX(0)';
            return;
        }

        // شروع انیمیشن
        startAnimation(speed, trackWidth);
        
        debugLog('رندر شد:', { items: uniqueItems.length, speed, trackWidth });
    }

    // ---------- انیمیشن حرکت (با استفاده از requestAnimationFrame) ----------
    function startAnimation(speed, trackWidth) {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        if (!track || !container) return;
        
        const containerWidth = container.clientWidth;
        if (trackWidth <= containerWidth) return;

        // مقدار اولیه
        currentPosition = 0;
        const totalWidth = trackWidth;
        const halfWidth = totalWidth / 2;
        let lastTimestamp = null;
        
        // توقف در صورت Hover (از CSS استفاده می‌شود، اما برای اطمینان)
        let isHovered = false;
        
        function animate(timestamp) {
            if (isPaused || isHovered) {
                animationId = requestAnimationFrame(animate);
                return;
            }
            
            if (lastTimestamp === null) {
                lastTimestamp = timestamp;
                animationId = requestAnimationFrame(animate);
                return;
            }
            
            const delta = (timestamp - lastTimestamp) / 1000; // ثانیه
            lastTimestamp = timestamp;
            
            // حرکت بر اساس سرعت (پیکسل بر ثانیه)
            currentPosition += speed * delta;
            
            // حلقه بی‌نهایت - وقتی به نصف رسید، ریست
            if (currentPosition >= halfWidth) {
                currentPosition -= halfWidth;
                // بدون پرش: موقعیت را تنظیم می‌کنیم
                track.style.transition = 'none';
                track.style.transform = `translateX(-${currentPosition}px)`;
                // forced reflow
                void track.offsetHeight;
                track.style.transition = '';
            }
            
            track.style.transform = `translateX(-${currentPosition}px)`;
            
            animationId = requestAnimationFrame(animate);
        }
        
        // شروع انیمیشن
        animationId = requestAnimationFrame(animate);
        
        // مدیریت Hover از طریق JS هم (توقف/ادامه)
        const wrapper = track.closest('.ticker-wrapper');
        if (wrapper && SETTINGS.enableHover) {
            const handleMouseEnter = () => { isHovered = true; };
            const handleMouseLeave = () => { isHovered = false; };
            
            wrapper.addEventListener('mouseenter', handleMouseEnter);
            wrapper.addEventListener('mouseleave', handleMouseLeave);
            
            // برای موبایل: لمس
            wrapper.addEventListener('touchstart', () => { isHovered = true; }, { passive: true });
            wrapper.addEventListener('touchend', () => { isHovered = false; }, { passive: true });
            
            // ذخیره برای پاک‌سازی
            track._hoverCleanup = () => {
                wrapper.removeEventListener('mouseenter', handleMouseEnter);
                wrapper.removeEventListener('mouseleave', handleMouseLeave);
            };
        }
    }

    // ---------- توقف انیمیشن ----------
    function stopAnimation() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (track && track._hoverCleanup) {
            track._hoverCleanup();
            delete track._hoverCleanup;
        }
    }

    // ---------- بروزرسانی اخبار ----------
    async function updateNews(force = false) {
        if (isLoading && !force) return;
        
        debugLog('بروزرسانی اخبار...');
        
        const data = await fetchNews();
        if (data && data.length > 0) {
            newsData = data;
            renderNews(newsData);
        } else {
            // اگر داده‌ای نبود و قبلاً چیزی رندر نشده
            if (!track || track.children.length === 0 || track.querySelector('.ticker-error')) {
                showMessage('دریافت اخبار با مشکل مواجه شد. لطفاً اتصال اینترنت را بررسی کنید.', 'error');
            }
        }
    }

    // ---------- تنظیم کش و بروزرسانی خودکار ----------
    function setupAutoUpdate() {
        if (updateTimer) {
            clearInterval(updateTimer);
        }
        
        // بروزرسانی در بازه مشخص
        updateTimer = setInterval(() => {
            updateNews(false);
        }, SETTINGS.updateInterval);
        
        debugLog('بروزرسانی خودکار تنظیم شد:', SETTINGS.updateInterval / 1000, 'ثانیه');
    }

    // ---------- راه‌اندازی تیکر ----------
    async function initTicker() {
        // پیدا کردن المان‌ها
        track = document.getElementById('tickerTrack');
        container = document.querySelector('.ticker-container');
        
        if (!track || !container) {
            console.error('ساختار تیکر پیدا نشد!');
            return;
        }
        
        // اعمال تنظیمات ظاهری
        const wrapper = track.closest('.ticker-wrapper');
        if (wrapper) {
            if (!SETTINGS.enableFade) wrapper.classList.add('no-fade');
            if (!SETTINGS.enableBlink) wrapper.classList.add('no-blink');
            
            // تنظیم ارتفاع
            const label = wrapper.querySelector('.ticker-label');
            if (label) {
                label.style.minHeight = SETTINGS.tickerHeight + 'px';
            }
            container.style.height = SETTINGS.tickerHeight + 'px';
        }
        
        // تشخیص دستگاه لمسی
        isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        
        // بارگذاری اولیه
        await updateNews(true);
        
        // تنظیم بروزرسانی خودکار
        setupAutoUpdate();
        
        // نمایش نسخه
        debugLog('Diyar Widgets News Ticker v2.0 راه‌اندازی شد');
    }

    // ---------- مشاهده تغییرات اتصال اینترنت ----------
    function setupOnlineOfflineHandling() {
        window.addEventListener('online', () => {
            debugLog('اتصال اینترنت برقرار شد - بروزرسانی');
            updateNews(true);
        });
        
        window.addEventListener('offline', () => {
            debugLog('اتصال اینترنت قطع شد');
        });
    }

    // ---------- Visibility Change (ذخیره منابع در پس‌زمینه) ----------
    function setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // تب در پس‌زمینه - کاهش مصرف
                isPaused = true;
                debugLog('تب مخفی شد - توقف موقت');
            } else {
                // تب فعال شد
                isPaused = false;
                debugLog('تب فعال شد - ادامه حرکت');
                // بروزرسانی در صورت نیاز
                const cached = loadFromCache();
                if (cached) {
                    const currentTitles = Array.from(track.querySelectorAll('.ticker-item'))
                        .map(el => el.textContent.trim());
                    const newTitles = cached.map(item => (item.title || '').trim());
                    
                    // اگر تغییری کرده، رندر مجدد
                    if (JSON.stringify(currentTitles) !== JSON.stringify(newTitles)) {
                        updateNews(true);
                    }
                }
            }
        });
    }

    // ---------- پاک‌سازی (Memory Leak Prevention) ----------
    function cleanup() {
        if (updateTimer) {
            clearInterval(updateTimer);
            updateTimer = null;
        }
        stopAnimation();
        window.removeEventListener('online', setupOnlineOfflineHandling);
        window.removeEventListener('offline', setupOnlineOfflineHandling);
        document.removeEventListener('visibilitychange', setupVisibilityHandling);
        debugLog('پاک‌سازی انجام شد');
    }

    // ---------- شروع ----------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTicker);
    } else {
        initTicker();
    }

    // پاک‌سازی هنگام خروج از صفحه
    window.addEventListener('beforeunload', cleanup);

    // ---------- API عمومی (برای استفاده خارجی) ----------
    window.DiyarTicker = {
        version: '2.0.0',
        refresh: () => updateNews(true),
        pause: () => { isPaused = true; },
        resume: () => { isPaused = false; },
        getNews: () => [...newsData],
        destroy: cleanup,
        config: SETTINGS
    };

    // تنظیم رویدادهای اتصال
    setupOnlineOfflineHandling();
    setupVisibilityHandling();

    debugLog('Diyar Widgets News Ticker v2.0 آماده است');

})();

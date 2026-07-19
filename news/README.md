# Diyar Widgets — News Ticker v3.0

ویجت حرفه‌ای، سبک و مستقل برای نمایش آخرین اخبار، نوشته‌شده با **جاوااسکریپت خالص (Vanilla JS)** — بدون jQuery، بدون فریم‌ورک، بدون مرحله‌ی Build. فقط سه فایل را در سایت خود قرار دهید و کار می‌کند؛ حتی روی GitHub Pages.

---

## ✨ ویژگی‌ها

- بدون وابستگی به jQuery / React / Vue / Angular / Bootstrap
- پشتیبانی کامل از **RTL** (فارسی، عربی، اردو) و LTR
- **Dark Mode** خودکار (`prefers-color-scheme`) یا دستی
- کاملاً **Responsive** از ۳۲۰ پیکسل به بالا
- زنجیره‌ی هوشمند دریافت خبر: `منبع اصلی → منبع جایگزین → کش محلی → اخبار پیش‌فرض`
- کش در `localStorage` با زمان انقضای قابل‌تنظیم
- انیمیشن نرم مبتنی بر `requestAnimationFrame` (بدون پرش/لرزش)
- توقف با Hover (دسکتاپ) و Touch (موبایل)
- پشتیبانی از خبر فوری (`breaking`) با افکت چشمک
- ضدXSS: Escape کامل HTML و Sanitize آدرس‌ها
- API عمومی کامل برای کنترل برنامه‌نویسی
- بدون Memory Leak — انیمیشن هنگام مخفی‌شدن تب متوقف می‌شود

---

## 📦 نصب

سه فایل زیر را در سایت خود کپی کنید:

```
ticker.css
ticker.js
config.js
```

سپس در HTML خود:

```html
<link rel="stylesheet" href="ticker.css">

<div id="diyar-ticker"></div>

<script src="config.js"></script>
<script src="ticker.js"></script>
```

همین! ویجت به‌محض لود شدن صفحه، به‌صورت خودکار (auto-init) روی هر المنتی که با `config.selector` مطابقت داشته باشد اجرا می‌شود.

> برای مثال‌های کامل نصب در HTML ساده، وردپرس، بلاگفا و iframe به پوشه‌ی [`examples/`](./examples) مراجعه کنید.

### نسخه‌ی فشرده (Production)

برای محیط عملیاتی/سایت واقعی، به‌جای `ticker.css` و `ticker.js` از نسخه‌های فشرده‌شده استفاده کنید تا حجم انتقال کمتر شود (کد یکسان، بدون کامنت و فاصله‌های اضافی):

```
ticker.min.css   (~3.6KB)
ticker.min.js    (~13.6KB)
```

```html
<link rel="stylesheet" href="ticker.min.css">
<div id="diyar-ticker"></div>
<script src="config.js"></script>
<script src="ticker.min.js"></script>
```

فایل‌های غیرفشرده (`ticker.css` / `ticker.js`) را برای توسعه، دیباگ و مطالعه‌ی کد نگه دارید.

---

## ⚙️ تنظیمات (`config.js`)

همه‌ی تنظیمات در `window.TICKER_CONFIG` قرار دارند:

```js
window.TICKER_CONFIG = {
  primarySource: "news.json",   // منبع اصلی خبر (JSON یا API)
  fallbackSource: "",           // منبع جایگزین در صورت خطا
  defaultNews: [],              // اخبار پیش‌فرض وقتی هیچ منبعی در دسترس نیست

  selector: "#diyar-ticker",    // سلکتور المنت میزبان
  speed: 40,                    // سرعت حرکت (پیکسل بر ثانیه)
  direction: "auto",            // "auto" | "rtl" | "ltr"
  rtl: true,
  theme: "auto",                // "auto" | "light" | "dark"
  height: 44,
  gap: 48,
  showIcon: true,
  showLabel: true,
  label: "آخرین اخبار",
  pauseOnHover: true,
  pauseOnTouch: true,

  updateInterval: 60000,        // 30000 | 60000 | 300000 | 600000
  cacheKey: "diyar_news_cache_v3",
  cacheTTL: 300000,
  requestTimeout: 8000,
  retryCount: 2,
  retryDelay: 2000,

  breakingBlink: true,
  breakingLabel: "فوری",

  debug: false
};
```

---

## 🗂 فرمت داده (`news.json`)

```json
{
  "version": "3.0",
  "updated": "2026-07-19T09:00:00Z",
  "updatedPersian": "۲۸ تیر ۱۴۰۵ - ۱۲:۳۰",
  "news": [
    {
      "id": "n-1001",
      "title": "عنوان خبر",
      "link": "https://example.com/news/1001",
      "category": "فناوری",
      "time": "۱۰ دقیقه پیش",
      "source": "Diyar News",
      "breaking": true,
      "image": ""
    }
  ]
}
```

---

## 🧩 API عمومی

پس از بارگذاری، نمونه‌ی ویجت روی `window.DiyarTicker` در دسترس است (در صورت وجود چند ویجت در صفحه، نمونه‌ی اول در `window.DiyarTicker` و آرایه‌ی کامل در `window.DiyarTickerInstances` قرار می‌گیرد):

| متد | توضیح |
|---|---|
| `DiyarTicker.refresh()` | دریافت مجدد اخبار از شبکه (Promise) |
| `DiyarTicker.pause()` | توقف حرکت |
| `DiyarTicker.resume()` | ادامه‌ی حرکت |
| `DiyarTicker.destroy()` | حذف کامل ویجت و پاکسازی Listenerها |
| `DiyarTicker.getNews()` | برگرداندن آرایه‌ی اخبار فعلی |
| `DiyarTicker.setConfig(cfg)` | تغییر تنظیمات در زمان اجرا |
| `DiyarTicker.setTheme(name)` | `"auto"` \| `"light"` \| `"dark"` |
| `DiyarTicker.reload()` | رندر مجدد از اخبار موجود (بدون درخواست شبکه) |

مثال:

```js
document.getElementById("refresh-btn").addEventListener("click", async () => {
  const news = await DiyarTicker.refresh();
  console.log(`${news.length} خبر دریافت شد`);
});
```

برای استفاده از چند ویجت مستقل در یک صفحه، از کلاس خام استفاده کنید:

```js
const custom = new DiyarNewsTicker(document.querySelector("#my-el"), {
  primarySource: "https://example.com/other-news.json",
  speed: 60
});
```

---

## 🎨 شخصی‌سازی ظاهر

تمام رنگ‌ها و اندازه‌ها از طریق CSS Variables قابل تغییرند — بدون نیاز به دست‌زدن به جاوااسکریپت:

```css
#diyar-ticker {
  --diyar-bg: #0b1220;
  --diyar-fg: #e5e7eb;
  --diyar-label-bg: #16a34a;
  --diyar-breaking-bg: #ef4444;
}
```

---

## 🔒 امنیت

- تمام متن‌های ورودی با `escapeHTML()` عبور داده می‌شوند (جلوگیری از HTML/Script Injection)
- تمام لینک‌ها با `sanitizeURL()` بررسی می‌شوند و فقط پروتکل‌های `http`/`https` مجازند
- لینک‌های خارجی به‌صورت خودکار `rel="noopener noreferrer"` می‌گیرند

---

## ⚡️ عملکرد

- انیمیشن با `requestAnimationFrame` (نه `setInterval`) اجرا می‌شود
- تمام Event Listenerها `passive` هستند
- تغییر اندازه‌ی صفحه با `debounce` مدیریت می‌شود
- انیمیشن هنگام مخفی‌شدن تب (`visibilitychange`) متوقف می‌شود تا CPU/باتری هدر نرود

---

## 🗺 نقشه‌ی راه (نسخه‌های بعدی)

- پشتیبانی از تصاویر خبر (`image`) در حالت کارتی
- حالت عمودی (Vertical Ticker)
- افزودن منبع RSS به‌صورت داخلی بدون نیاز به تبدیل JSON

برای جزئیات کامل تغییرات هر نسخه به [`CHANGELOG.md`](./CHANGELOG.md) مراجعه کنید.

---

## 📄 مجوز

منتشر شده تحت مجوز [MIT](./LICENSE).

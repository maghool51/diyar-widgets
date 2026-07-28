# ویجت حدیث (Hadith Widget)

ویجت سبک، مستقل و بدون وابستگی (vanilla JS) برای نمایش یک حدیث در هر بار بارگذاری صفحه — به‌صورت روزانه‌ی ثابت، تصادفی یا ترتیبی. مناسب برای جاسازی در هر وب‌سایتی با چند خط کد.

## ساختار پروژه

```
hadith/
├── index.html          # دموی ویجت
├── widget.js            # موتور ویجت
├── widget.css           # استایل
├── config.js            # تنظیمات پیش‌فرض
├── manifest.json        # اطلاعات ویجت
├── data/
│   ├── hadiths.json     # داده‌ی احادیث
│   ├── categories.json  # دسته‌بندی‌ها
│   └── version.json     # نسخه‌ی داده
├── assets/
│   ├── logo.svg
│   ├── icon.png
│   └── preview.webp
└── core/
    ├── cache.js         # کش با TTL
    ├── storage.js       # لایه‌ی localStorage
    ├── api.js           # واکشی داده
    ├── utils.js          # توابع کمکی
    ├── renderer.js       # رندر DOM
    └── share.js           # اشتراک‌گذاری
```

## نصب سریع

۱. تمام فایل‌ها را در پوشه‌ای در سایت خود آپلود کنید (ساختار پوشه‌ها را حفظ کنید).
۲. در `HTML` صفحه‌ی خود یک کانتینر بسازید:

```html
<div id="hadith-widget"></div>
```

۳. استایل و اسکریپت‌ها را به همین ترتیب اضافه کنید:

```html
<link rel="stylesheet" href="./widget.css" />

<script src="./config.js"></script>
<script src="./core/utils.js"></script>
<script src="./core/storage.js"></script>
<script src="./core/cache.js"></script>
<script src="./core/api.js"></script>
<script src="./core/renderer.js"></script>
<script src="./core/share.js"></script>
<script src="./widget.js"></script>

<script>
  const widget = new HadithWidget({ containerId: 'hadith-widget' });
  widget.init();
</script>
```

## گزینه‌های تنظیمات (`config.js`)

| گزینه | نوع | پیش‌فرض | توضیح |
|---|---|---|---|
| `dataBaseUrl` | string | `./data` | مسیر پوشه‌ی داده |
| `language` | `'fa' \| 'ar' \| 'en'` | `'fa'` | زبان نمایش متن |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'light'` | تم ظاهری |
| `category` | string | `'all'` | فیلتر دسته‌بندی |
| `showNarrator` | boolean | `true` | نمایش نام راوی |
| `showSource` | boolean | `true` | نمایش منبع حدیث |
| `enableShare` | boolean | `true` | فعال‌سازی دکمه اشتراک‌گذاری |
| `autoRefreshInterval` | number (ms) | `0` | بازه‌ی بروزرسانی خودکار؛ `0` غیرفعال |
| `cacheEnabled` | boolean | `true` | کش کردن داده در localStorage |
| `cacheTTL` | number (ms) | ۶ ساعت | زمان انقضای کش |
| `selectionMode` | `'daily' \| 'random' \| 'sequential'` | `'daily'` | نحوه‌ی انتخاب حدیث |
| `direction` | `'rtl' \| 'ltr'` | `'rtl'` | جهت متن |
| `containerId` | string | `'hadith-widget'` | شناسه‌ی کانتینر HTML |
| `onLoad` | function | `null` | فراخوانی پس از بارگذاری موفق |
| `onError` | function | `null` | فراخوانی در صورت خطا |

## API عمومی کلاس `HadithWidget`

```js
const widget = new HadithWidget(options);

await widget.init();      // مقداردهی اولیه و رندر اول
widget.next();             // نمایش حدیث بعدی
await widget.share();      // اشتراک‌گذاری حدیث جاری
widget.updateConfig({...}); // تغییر تنظیمات در زمان اجرا
widget.destroy();          // پاکسازی تایمرها و رویدادها
```

## افزودن حدیث جدید

آیتم جدید را به آرایه‌ی `hadiths` در `data/hadiths.json` اضافه کنید:

```json
{
  "id": "h011",
  "text": "متن عربی حدیث",
  "translation_fa": "ترجمه فارسی",
  "translation_en": "English translation",
  "narrator": "نام راوی",
  "source": "منبع",
  "category": "akhlaq",
  "grade": "صحیح"
}
```

سپس مقدار `count` و `updated` را در `data/version.json` به‌روز کنید.

## مرورگرهای پشتیبانی‌شده

Chrome 60+، Firefox 60+، Safari 12+ (نسخه‌های جدیدتر Edge نیز پشتیبانی می‌شوند). در مرورگرهایی که `localStorage` در دسترس نباشد، ویجت به‌صورت خودکار بدون کش کار می‌کند.

## مجوز

این پروژه تحت مجوز MIT منتشر شده است؛ فایل [LICENSE](./LICENSE) را ببینید.

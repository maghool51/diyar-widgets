const fs = require("fs");
const Parser = require("rss-parser");

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  },
  timeout: 15000
});

// =====================================================
// ابزارهای امنیتی
// =====================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return "";

  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeLink(url) {
  try {
    const u = new URL(url);

    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.href;
    }
  } catch (e) {}

  return "#";
}

// =====================================================
// ایموجی دسته‌ها
// =====================================================

const categoryEmojis = {
  "سیاسی": "🏛",
  "اقتصادی": "💰",
  "ورزشی": "⚽",
  "فرهنگی و هنری": "🎭",
  "اجتماعی": "👥",
  "علمی و فناوری": "🔬",
  "بین‌الملل": "🌍",
  "متفرقه": "📌"
};

// =====================================================
// کلیدواژه‌های اصلی دسته‌بندی
// =====================================================

const categories = {
  "سیاسی": [
    "رئیس‌جمهور",
    "رئیس جمهور",
    "رئیس مجلس",
    "مجلس",
    "نماینده",
    "نمایندگان",
    "انتخابات",
    "انتخاباتی",
    "سیاست",
    "سیاسی",
    "دولت",
    "هیئت دولت",
    "قوه قضائیه",
    "قوه قضاییه",
    "دادگاه",
    "قانون",
    "مذاکره",
    "برجام",
    "تحریم",
    "سفارت",
    "پارلمان",
    "کنگره",
    "آتش‌بس",
    "آتش بس",
    "صلح",
    "درگیری",
    "عملیات",
    "ترور",
    "موشک",
    "شهادت",
    "جنگ",
    "نیروهای مسلح",
    "سپاه",
    "ارتش",
    "فراجا",
    "سردار",
    "رزمایش",
    "امنیت",
    "دفاع",
    "پدافند",
    "رهبری",
    "رهبر",
    "وزارت",
    "انتصاب",
    "سخنگوی دولت"
  ],

  "اقتصادی": [
    "اقتصاد",
    "اقتصادی",
    "دلار",
    "طلا",
    "سکه",
    "ارز",
    "نرخ ارز",
    "بانک",
    "بانکی",
    "بانک مرکزی",
    "پول",
    "بورس",
    "سهام",
    "قیمت",
    "تورم",
    "گرانی",
    "ارزان",
    "کالا",
    "صادرات",
    "واردات",
    "نفت",
    "گاز",
    "پتروشیمی",
    "صنعت",
    "صنایع",
    "کشاورزی",
    "بازار",
    "تجارت",
    "بودجه",
    "مالیات",
    "یارانه",
    "اشتغال",
    "بیکاری",
    "تعاون",
    "مسکن",
    "تولید",
    "تولیدی",
    "معیشت",
    "بنزین",
    "سوخت",
    "سنگ آهن",
    "سنگ‌آهن",
    "واحد مسکونی",
    "واحد مسکن",
    "تحویل مسکن",
    "شرکت خصوصی"
  ],

  "ورزشی": [
    "ورزش",
    "ورزشی",
    "فوتبال",
    "تیم ملی",
    "استقلال",
    "پرسپولیس",
    "سپاهان",
    "تراکتور",
    "لیگ برتر",
    "جام جهانی",
    "المپیک",
    "پارالمپیک",
    "کشتی",
    "وزنه‌برداری",
    "وزنه برداری",
    "والیبال",
    "بسکتبال",
    "تنیس",
    "شطرنج",
    "قهرمانی",
    "مسابقه",
    "مسابقات",
    "دربی",
    "داربی",
    "مدال",
    "مربی",
    "سرمربی",
    "داور",
    "تماشاگر",
    "ورزشگاه",
    "بازیکن",
    "گلزنی",
    "گل زد",
    "لیگ قهرمانان",
    "آرسنال",
    "چلسی",
    "منچستر",
    "لیورپول",
    "رئال مادرید",
    "بارسلونا",
    "بایرن مونیخ",
    "یوونتوس",
    "AFC",
    "گرندپری",
    "پاراگرندپری",
    "رقابت‌های ورزشی",
    "رقابت های ورزشی",
    "باشگاه ورزشی",
    "مدال‌آور",
    "مدال آور"
  ],

  "فرهنگی و هنری": [
    "فیلم",
    "فیلم سینمایی",
    "سینما",
    "سینمای ایران",
    "تلویزیون",
    "سریال",
    "هنر",
    "هنری",
    "موسیقی",
    "کنسرت",
    "خواننده",
    "بازیگر",
    "کارگردان",
    "نمایش",
    "تئاتر",
    "کتاب",
    "کتاب‌خوان",
    "کتاب خوان",
    "نویسنده",
    "شعر",
    "شاعر",
    "ادبیات",
    "جشنواره",
    "جشنواره فیلم",
    "فرهنگ",
    "هنرمند",
    "جوایز",
    "موزه",
    "نگارخانه",
    "تیزر",
    "امام زمان",
    "ظهور امام زمان",
    "عروسی"
  ],

  "اجتماعی": [
    "آموزش",
    "دانشگاه",
    "مدرسه",
    "دانش‌آموز",
    "دانش آموز",
    "دانشجو",
    "تحصیل",
    "کنکور",
    "بیمه",
    "درمان",
    "سلامت",
    "بیمارستان",
    "پزشک",
    "دارو",
    "واکسن",
    "حوادث",
    "حادثه",
    "تصادف",
    "زلزله",
    "سیل",
    "آتش‌سوزی",
    "آتش سوزی",
    "نجات",
    "جاده",
    "ازدواج",
    "طلاق",
    "جمعیت",
    "مهاجرت",
    "حقوق",
    "آسیب‌های اجتماعی",
    "آسیب های اجتماعی",
    "آسیب اجتماعی",
    "اعتیاد",
    "فقر",
    "بازنشسته",
    "بازنشستگان",
    "مترو",
    "اتوبوس",
    "حمل و نقل",
    "حمل‌ونقل",
    "سرقت",
    "سارق",
    "سارقان",
    "دستگیری",
    "بازداشت",
    "پرونده مالی",
    "تخلفات مالی",
    "تخلفات اداری",
    "هواشناسی",
    "بارندگی",
    "پیاده‌روی",
    "پیاده روی",
    "حمل‌ونقل عمومی",
    "حمل و نقل عمومی"
  ],

  "علمی و فناوری": [
    "فناوری",
    "فناوری اطلاعات",
    "علم",
    "علمی",
    "فضا",
    "فضاپیما",
    "ماهواره",
    "رایانه",
    "کامپیوتر",
    "هوش مصنوعی",
    "یادگیری ماشین",
    "یادگیری ماشینی",
    "پژوهش",
    "پژوهشگر",
    "تحقیق",
    "اختراع",
    "نوآوری",
    "اینترنت",
    "موبایل",
    "گوشی هوشمند",
    "تلفن همراه",
    "نرم‌افزار",
    "نرم افزار",
    "سخت‌افزار",
    "سخت افزار",
    "ربات",
    "رباتیک",
    "ربات چهارپا",
    "نانو",
    "زیست‌فناوری",
    "زیست فناوری",
    "هسته‌ای",
    "هسته ای",
    "انرژی",
    "سیاره",
    "سیارک",
    "ستاره",
    "کهکشان",
    "نجوم",
    "اخترشناسی",
    "تلسکوپ",
    "ژن",
    "ژنتیک",
    "آزمایشگاه",
    "پردازنده",
    "تراشه",
    "لکه‌های خورشیدی",
    "لکه های خورشیدی",
    "خورشیدی",
    "نجومی"
  ],

  "بین‌الملل": [
    "بین‌الملل",
    "بین الملل",
    "سازمان ملل",
    "یونسکو",
    "اروپا",
    "اتحادیه اروپا",
    "آسیا",
    "آفریقا",
    "آمریکای لاتین",
    "کانادا",
    "استرالیا",
    "ژاپن",
    "کره جنوبی",
    "کره شمالی",
    "هند",
    "پاکستان",
    "افغانستان",
    "عراق",
    "یمن",
    "قطر",
    "امارات",
    "عربستان",
    "ترکیه",
    "روسیه",
    "چین",
    "انگلیس",
    "فرانسه",
    "آلمان",
    "بریتانیا",
    "آمریکا",
    "بایدن",
    "ترامپ",
    "پوتین",
    "شی جین پینگ",
    "ناتو",
    "کنگره آمریکا",
    "سنا",
    "کاخ سفید",
    "کرملین",
    "غزه",
    "فلسطین",
    "اسرائیل",
    "حماس",
    "حزب‌الله",
    "حزب الله",
    "لبنان",
    "تل‌آویو",
    "تل آویو",
    "واشنگتن",
    "مسکو",
    "کی‌یف",
    "جنگ اوکراین",
    "جنگ غزه",
    "اوکراین",
    "باب‌المندب",
    "باب المندب",
    "تنگه باب‌المندب",
    "تنگه باب المندب",
    "سفیر",
    "وزیر خارجه",
    "رئیس جمهور آمریکا",
    "رئیس‌جمهور آمریکا"
  ]
};

// =====================================================
// نرمال‌سازی متن
// =====================================================

function normalizeText(text) {
  return String(text || "")
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/ۀ/g, "ه")
    .replace(/ة/g, "ه")
    .replace(/‌/g, " ")
    .replace(/[«»"'`]/g, " ")
    .replace(/[،؛,:!?؟()[\]{}<>]/g, " ")
    .replace(/[\/\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// =====================================================
// بررسی عبارت به‌صورت مستقل
// =====================================================

function hasPhrase(text, phrase) {
  const t = ` ${normalizeText(text)} `;
  const p = ` ${normalizeText(phrase)} `;

  return t.includes(p);
}

// =====================================================
// بررسی چند عبارت
// =====================================================

function hasAny(text, list) {
  return list.some(item => hasPhrase(text, item));
}

// =====================================================
// شمارش عبارات
// =====================================================

function countMatches(text, list) {
  let count = 0;

  for (const item of list) {
    if (hasPhrase(text, item)) {
      count++;
    }
  }

  return count;
}

// =====================================================
// تشخیص دسته‌بندی هوشمند
// =====================================================

function detectCategory(title) {

  const text = normalizeText(title);

  // ===================================================
  // نشانه‌های بسیار اختصاصی سیاسی
  // ===================================================

  const politicalStrong = [
    "رئیس جمهور",
    "رئیس‌جمهور",
    "رئیس مجلس",
    "مجلس شورای اسلامی",
    "نماینده مجلس",
    "نمایندگان مجلس",
    "وزیر",
    "وزارت",
    "دولت",
    "هیئت دولت",
    "استاندار",
    "فرماندار",
    "سیاست",
    "سیاسی",
    "انتخابات",
    "انتخاباتی",
    "قوه قضائیه",
    "قوه قضاییه",
    "دادگاه",
    "مذاکره",
    "برجام",
    "تحریم",
    "پارلمان",
    "کنگره",
    "آتش بس",
    "آتش‌بس",
    "نیروهای مسلح",
    "سپاه",
    "ارتش",
    "فراجا",
    "سردار",
    "رزمایش",
    "پدافند",
    "امنیت ملی",
    "امام جمعه",
    "رهبر",
    "رهبری",
    "انتصاب",
    "سخنگوی دولت",
    "رفع تحریم",
    "روابط خارجی"
  ];

  // ===================================================
  // نشانه‌های ورزشی
  // ===================================================

  const sportsStrong = [
    "فوتبال",
    "تیم ملی",
    "استقلال",
    "پرسپولیس",
    "سپاهان",
    "تراکتور",
    "لیگ برتر",
    "لیگ قهرمانان",
    "جام جهانی",
    "المپیک",
    "پارالمپیک",
    "کشتی",
    "وزنه برداری",
    "وزنه‌برداری",
    "والیبال",
    "بسکتبال",
    "تنیس",
    "شطرنج",
    "دربی",
    "داربی",
    "مدال",
    "ورزشگاه",
    "بازیکن",
    "سرمربی",
    "مربی",
    "داور",
    "تماشاگر",
    "گلزنی",
    "گل زد",
    "مسابقات ورزشی",
    "رقابت های ورزشی",
    "رقابت‌های ورزشی",
    "پاراگرندپری",
    "گرندپری",
    "afc",
    "باشگاه ورزشی",
    "مدال آور",
    "مدال‌آور"
  ];

  const sportsContext = [
    "فوتبال",
    "تیم",
    "باشگاه",
    "لیگ",
    "مسابقه",
    "مسابقات",
    "رقابت",
    "بازیکن",
    "سرمربی",
    "مربی",
    "ورزشگاه",
    "مدال",
    "کشتی",
    "والیبال",
    "بسکتبال",
    "تنیس",
    "شطرنج",
    "دربی",
    "داربی",
    "afc",
    "گرندپری",
    "پاراگرندپری"
  ];

  // ===================================================
  // علمی و فناوری
  // ===================================================

  const scienceStrong = [
    "فناوری",
    "فناوری اطلاعات",
    "هوش مصنوعی",
    "یادگیری ماشین",
    "یادگیری ماشینی",
    "ماهواره",
    "فضاپیما",
    "سیاره",
    "سیارک",
    "کهکشان",
    "تلسکوپ",
    "نجوم",
    "اخترشناسی",
    "رباتیک",
    "ربات چهارپا",
    "پردازنده",
    "تراشه",
    "زیست فناوری",
    "زیست‌فناوری",
    "ژنتیک",
    "آزمایشگاه",
    "نرم افزار",
    "نرم‌افزار",
    "سخت افزار",
    "سخت‌افزار",
    "اینترنت",
    "رایانه",
    "کامپیوتر",
    "لکه های خورشیدی",
    "لکه‌های خورشیدی",
    "خورشیدی",
    "نجومی"
  ];

  // ===================================================
  // اقتصادی
  // ===================================================

  const economicStrong = [
    "اقتصاد",
    "اقتصادی",
    "دلار",
    "طلا",
    "سکه",
    "ارز",
    "نرخ ارز",
    "قیمت دلار",
    "قیمت طلا",
    "قیمت سکه",
    "قیمت خودرو",
    "قیمت مسکن",
    "مسکن",
    "واحد مسکونی",
    "واحد مسکن",
    "تحویل مسکن",
    "تورم",
    "گرانی",
    "بازار سرمایه",
    "بورس",
    "شاخص بورس",
    "سهام",
    "بانک مرکزی",
    "نرخ بهره",
    "نفت",
    "گاز",
    "پتروشیمی",
    "تولید",
    "تولیدی",
    "صنعت",
    "صنایع",
    "کشاورزی",
    "صادرات",
    "واردات",
    "تجارت",
    "بودجه",
    "مالیات",
    "یارانه",
    "اشتغال",
    "بیکاری",
    "معیشت",
    "سنگ آهن",
    "سنگ‌آهن",
    "بنزین",
    "سوخت"
  ];

  // ===================================================
  // اجتماعی
  // ===================================================

  const socialStrong = [
    "آموزش",
    "دانشگاه",
    "مدرسه",
    "دانش آموز",
    "دانش‌آموز",
    "دانشجو",
    "تحصیل",
    "کنکور",
    "بیمه",
    "درمان",
    "سلامت",
    "بیمارستان",
    "پزشک",
    "دارو",
    "واکسن",
    "حوادث",
    "حادثه",
    "تصادف",
    "زلزله",
    "سیل",
    "آتش سوزی",
    "آتش‌سوزی",
    "نجات",
    "جاده",
    "ازدواج",
    "طلاق",
    "جمعیت",
    "مهاجرت",
    "اعتیاد",
    "فقر",
    "بازنشسته",
    "بازنشستگان",
    "مترو",
    "اتوبوس",
    "حمل و نقل",
    "حمل‌ونقل",
    "حمل و نقل عمومی",
    "سرقت",
    "سارق",
    "سارقان",
    "دستگیری",
    "بازداشت",
    "تخلفات مالی",
    "تخلفات اداری",
    "هواشناسی",
    "بارندگی",
    "پیاده روی",
    "پیاده‌روی"
  ];

  // ===================================================
  // فرهنگی و هنری
  // ===================================================

  const culturalStrong = [
    "فیلم",
    "فیلم سینمایی",
    "سینما",
    "سینمای ایران",
    "تلویزیون",
    "سریال",
    "هنر",
    "هنری",
    "موسیقی",
    "کنسرت",
    "خواننده",
    "بازیگر",
    "کارگردان",
    "تئاتر",
    "نمایش",
    "کتاب",
    "کتاب خوان",
    "کتاب‌خوان",
    "نویسنده",
    "شعر",
    "شاعر",
    "ادبیات",
    "جشنواره",
    "جشنواره فیلم",
    "فرهنگ",
    "هنرمند",
    "جوایز",
    "موزه",
    "نگارخانه",
    "تیزر",
    "امام زمان",
    "ظهور امام زمان",
    "عروسی"
  ];

  // ===================================================
  // بین‌الملل
  // ===================================================

  const internationalStrong = [
    "بین الملل",
    "بین‌الملل",
    "سازمان ملل",
    "اتحادیه اروپا",
    "کاخ سفید",
    "کرملین",
    "جنگ اوکراین",
    "جنگ غزه",
    "روسیه و اوکراین",
    "اسرائیل و فلسطین",
    "آمریکا و اروپا",
    "رئیس جمهور آمریکا",
    "رئیس‌جمهور آمریکا",
    "باب المندب",
    "باب‌المندب",
    "تنگه باب المندب",
    "تنگه باب‌المندب",
    "سفیر",
    "وزیر خارجه"
  ];

  // ===================================================
  // مرحله ۱: ورزش
  // ===================================================

  const sportsMatches =
    countMatches(text, sportsStrong);

  const hasSportsContext =
    hasAny(text, sportsContext);

  /*
   * نام‌هایی مثل استقلال، پرسپولیس و تراکتور
   * به تنهایی برای تشخیص ورزش کافی نیستند.
   *
   * باید یک نشانه ورزشی نیز وجود داشته باشد.
   */

  if (
    sportsMatches > 0 &&
    hasSportsContext &&
    !hasAny(text, politicalStrong)
  ) {
    return "ورزشی";
  }

  // ===================================================
  // مرحله ۲: سیاسی
  // ===================================================

  /*
   * خبرهای دولتی، امنیتی، نیروهای مسلح، مجلس،
   * وزیر، انتخابات و... در صورت وجود، سیاسی هستند.
   *
   * این قسمت جلوی خطایی مثل:
   * «نیروهای مسلح ... استقلال ایران»
   * را می‌گیرد.
   */

  if (hasAny(text, politicalStrong)) {
    return "سیاسی";
  }

  // ===================================================
  // مرحله ۳: بین‌الملل
  // ===================================================

  if (hasAny(text, internationalStrong)) {
    return "بین‌الملل";
  }

  // ===================================================
  // مرحله ۴: اقتصادی
  // ===================================================

  if (hasAny(text, economicStrong)) {
    return "اقتصادی";
  }

  // ===================================================
  // مرحله ۵: علمی و فناوری
  // ===================================================

  if (hasAny(text, scienceStrong)) {
    return "علمی و فناوری";
  }

  // ===================================================
  // مرحله ۶: فرهنگی و هنری
  // ===================================================

  if (hasAny(text, culturalStrong)) {
    return "فرهنگی و هنری";
  }

  // ===================================================
  // مرحله ۷: اجتماعی
  // ===================================================

  if (hasAny(text, socialStrong)) {
    return "اجتماعی";
  }

  // ===================================================
  // امتیازدهی ثانویه
  // ===================================================

  const scores = {
    "سیاسی": 0,
    "اقتصادی": 0,
    "ورزشی": 0,
    "فرهنگی و هنری": 0,
    "اجتماعی": 0,
    "علمی و فناوری": 0,
    "بین‌الملل": 0,
    "متفرقه": 0
  };

  // ---------------------------------------------------
  // امتیاز سیاسی
  // ---------------------------------------------------

  scores["سیاسی"] +=
    countMatches(text, [
      "قانون",
      "دادگاه",
      "قوه قضائیه",
      "قوه قضاییه",
      "مذاکره",
      "تحریم",
      "صلح",
      "درگیری",
      "ترور",
      "شهادت",
      "جنگ",
      "موشک",
      "دفاع",
      "امنیت"
    ]) * 3;

  // ---------------------------------------------------
  // امتیاز اقتصادی
  // ---------------------------------------------------

  scores["اقتصادی"] +=
    countMatches(text, [
      "اقتصاد",
      "اقتصادی",
      "قیمت",
      "بازار",
      "تولید",
      "صنعت",
      "صنایع",
      "کشاورزی",
      "مسکن",
      "بانک",
      "بورس",
      "دلار",
      "طلا",
      "نفت",
      "گاز",
      "بنزین",
      "اشتغال"
    ]) * 3;

  // ---------------------------------------------------
  // امتیاز ورزشی
  // ---------------------------------------------------

  if (hasSportsContext) {
    scores["ورزشی"] +=
      countMatches(text, sportsStrong) * 3;
  }

  // ---------------------------------------------------
  // امتیاز فرهنگی
  // ---------------------------------------------------

  scores["فرهنگی و هنری"] +=
    countMatches(text, culturalStrong) * 3;

  // ---------------------------------------------------
  // امتیاز اجتماعی
  // ---------------------------------------------------

  scores["اجتماعی"] +=
    countMatches(text, socialStrong) * 3;

  // ---------------------------------------------------
  // امتیاز علمی
  // ---------------------------------------------------

  scores["علمی و فناوری"] +=
    countMatches(text, scienceStrong) * 3;

  // ---------------------------------------------------
  // امتیاز بین‌الملل
  // ---------------------------------------------------

  scores["بین‌الملل"] +=
    countMatches(text, internationalStrong) * 3;

  // ===================================================
  // انتخاب نهایی
  // ===================================================

  const priority = [
    "سیاسی",
    "اقتصادی",
    "ورزشی",
    "فرهنگی و هنری",
    "اجتماعی",
    "علمی و فناوری",
    "بین‌الملل",
    "متفرقه"
  ];

  let bestCategory = "متفرقه";
  let bestScore = 0;

  for (const category of priority) {

    if (scores[category] > bestScore) {

      bestScore = scores[category];
      bestCategory = category;

    }

  }

  if (bestScore < 3) {
    return "متفرقه";
  }

  return bestCategory;
}

// =====================================================
// منابع اصلی
// =====================================================

const sources = [
  {
    name: "ایرنا",
    url: "https://www.irna.ir/rss",
    flag: "🇮🇷"
  },

  {
    name: "ایسنا",
    url: "https://www.isna.ir/rss",
    flag: "🇮🇷"
  },

  {
    name: "مهر",
    url: "https://www.mehrnews.com/rss",
    flag: "🇮🇷"
  },

  {
    name: "تسنیم",
    url: "https://www.tasnimnews.ir/fa/rss/feed/0/0/8/1/TopStories",
    flag: "🇮🇷"
  },

  {
    name: "فارس",
    url: "https://www.farsnews.ir/rss",
    flag: "🇮🇷"
  },

  {
    name: "ایلنا",
    url: "https://www.ilna.ir/feeds",
    flag: "🇮🇷"
  },

  {
    name: "خبرآنلاین",
    url: "https://www.khabaronline.ir/rss",
    flag: "🇮🇷"
  },

  {
    name: "ایمنا",
    url: "https://www.imna.ir/rss",
    flag: "🇮🇷"
  },

  {
    name: "خبر فوری",
    url: "https://www.khabarfoori.com/fa/feeds/?p=ZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTQzMjAw",
    flag: "🇮🇷"
  },

  {
    name: "قدس آنلاین",
    url: "https://qudsonline.ir/rss",
    flag: "🇮🇷"
  },

  {
    name: "عصر ایران",
    url: "https://www.asriran.com/fa/rss/allnews",
    flag: "🇮🇷"
  },

  {
    name: "تابناک",
    url: "https://www.tabnak.ir/fa/rss/allnews",
    flag: "🇮🇷"
  },

  {
    name: "اطلاعات",
    url: "https://www.ettelaat.com/rss/tp/62",
    flag: "🇮🇷"
  }

  /*
  {
    name: "صدای آمریکا فارسی",
    url: "https://ir.voanews.com/api/zuiypl-vomx-tpeggtm",
    flag: "🌍"
  },

  {
    name: "بی‌بی‌سی فارسی",
    url: "https://feeds.bbci.co.uk/persian/rss.xml",
    flag: "🌍"
  },

  {
    name: "دویچه‌وله فارسی",
    url: "https://rss.dw.com/rdf/rss-fa-all",
    flag: "🌍"
  },

  {
    name: "رادیو فردا",
    url: "https://www.radiofarda.com/api/zpoqil-vomx-tpe_kip",
    flag: "🌍"
  }
  */
];

// =====================================================
// منابع پشتیبان
// =====================================================

const backupSources = [];

// =====================================================
// دریافت RSS با تلاش مجدد
// =====================================================

async function fetchWithRetry(url, retries = 2) {

  for (let i = 0; i < retries; i++) {

    try {

      return await parser.parseURL(url);

    } catch (e) {

      if (i === retries - 1) {
        throw e;
      }

      await new Promise(resolve =>
        setTimeout(resolve, 2000 * (i + 1))
      );

    }

  }
}

// =====================================================
// دریافت اخبار
// =====================================================

async function getNews() {

  console.log("📰 در حال دریافت اخبار فوری ایران و جهان...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  let allNews = [];
  const failedSources = [];

  // ===================================================
  // منابع اصلی
  // ===================================================

  for (const source of sources) {

    try {

      console.log(
        `⏳ ${source.flag} در حال دریافت ${source.name}...`
      );

      const feed =
        await fetchWithRetry(source.url);

      if (
        !feed.items ||
        feed.items.length === 0
      ) {

        console.log(
          `⚠️ ${source.name} هیچ خبری نداشت`
        );

        failedSources.push(source.name);

        continue;
      }

      let count = 0;

      feed.items
        .slice(0, 15)
        .forEach(item => {

          if (
            !item.title ||
            !item.link
          ) {
            return;
          }

          const title =
            item.title.trim();

          const category =
            detectCategory(title);

          allNews.push({

            title: title,

            link:
              safeLink(item.link),

            date:
              item.pubDate ||
              item.isoDate ||
              "",

            source:
              source.name,

            category:
              category,

            flag:
              source.flag

          });

          count++;

        });

      console.log(
        `✅ ${source.flag} ${source.name}: ${count} خبر دریافت شد`
      );

    } catch (e) {

      console.log(
        `❌ ${source.flag} ${source.name} ناموفق: ${e.message}`
      );

      failedSources.push(source.name);

    }

  }

  // ===================================================
  // منابع پشتیبان
  // ===================================================

  console.log("\n🔄 بررسی منابع پشتیبان...");

  for (const backup of backupSources) {

    if (
      failedSources.includes(backup.name) ||
      !sources.find(
        s => s.name === backup.name
      )
    ) {

      try {

        console.log(
          `⏳ در حال دریافت ${backup.name} (پشتیبان)...`
        );

        const feed =
          await fetchWithRetry(backup.url);

        if (
          !feed.items ||
          feed.items.length === 0
        ) {

          console.log(
            `⚠️ ${backup.name} (پشتیبان) هیچ خبری نداشت`
          );

          continue;
        }

        let count = 0;

        feed.items
          .slice(0, 15)
          .forEach(item => {

            if (
              !item.title ||
              !item.link
            ) {
              return;
            }

            const title =
              item.title.trim();

            const category =
              detectCategory(title);

            const originalSource =
              sources.find(
                s => s.name === backup.name
              );

            const flag =
              originalSource?.flag ||
              backup.flag ||
              "🌍";

            allNews.push({

              title: title,

              link:
                safeLink(item.link),

              date:
                item.pubDate ||
                item.isoDate ||
                "",

              source:
                backup.name,

              category:
                category,

              flag:
                flag

            });

            count++;

          });

        console.log(
          `✅ ${backup.name} (پشتیبان): ${count} خبر دریافت شد`
        );

        const index =
          failedSources.indexOf(
            backup.name
          );

        if (index > -1) {
          failedSources.splice(index, 1);
        }

      } catch (e) {

        console.log(
          `❌ ${backup.name} (پشتیبان) نیز ناموفق بود: ${e.message}`
        );

      }

    }

  }

  // ===================================================
  // بررسی دریافت خبر
  // ===================================================

  if (allNews.length === 0) {

    console.log(
      "⚠️ هیچ خبری دریافت نشد!"
    );

    return;
  }

  // ===================================================
  // حذف اخبار تکراری
  // ===================================================

  const seenTitles = new Set();

  allNews = allNews

    .filter(
      n =>
        n.title &&
        /[\u0600-\u06FF]/.test(n.title)
    )

    .filter(n => {

      const key =
        normalizeText(n.title)
          .replace(
            /[«»،:؛!?؟،]/g,
            ""
          )
          .trim();

      if (seenTitles.has(key)) {
        return false;
      }

      seenTitles.add(key);

      return true;

    })

    // =================================================
    // مرتب‌سازی جدیدترین اخبار
    // =================================================

    .sort((a, b) => {

      const dateA =
        new Date(a.date);

      const dateB =
        new Date(b.date);

      if (isNaN(dateA.getTime())) {
        return 1;
      }

      if (isNaN(dateB.getTime())) {
        return -1;
      }

      return dateB - dateA;

    })

    // =================================================
    // حداکثر ۱۰۰ خبر
    // =================================================

    .slice(0, 100);

  console.log(
    `\n📊 مجموع اخبار دریافتی: ${allNews.length}`
  );

  // ===================================================
  // گزارش دسته‌بندی
  // ===================================================

  console.log(
    "\n📊 وضعیت دسته‌بندی اخبار:"
  );

  const categoryStats = {};

  for (const news of allNews) {

    categoryStats[news.category] =
      (categoryStats[news.category] || 0) + 1;

  }

  const statsOrder = [
    "سیاسی",
    "اقتصادی",
    "ورزشی",
    "فرهنگی و هنری",
    "اجتماعی",
    "علمی و فناوری",
    "بین‌الملل",
    "متفرقه"
  ];

  for (const category of statsOrder) {

    console.log(
      `${category}: ${categoryStats[category] || 0}`
    );

  }

  // ===================================================
  // منابع موفق واقعی
  // ===================================================

  const successfulSources =
    new Set(
      allNews.map(
        news => news.source
      )
    );

  // ===================================================
  // دسته‌بندی اخبار
  // ===================================================

  const categorizedNews = {};

  for (const news of allNews) {

    if (!categorizedNews[news.category]) {

      categorizedNews[news.category] = [];

    }

    categorizedNews[
      news.category
    ].push(news);

  }

  // ===================================================
  // ترتیب ثابت دسته‌ها
  // ===================================================

  const categoryOrder = [
    "سیاسی",
    "اقتصادی",
    "ورزشی",
    "فرهنگی و هنری",
    "اجتماعی",
    "علمی و فناوری",
    "بین‌الملل",
    "متفرقه"
  ];

  const orderedCategorizedNews = {};

  for (const category of categoryOrder) {

    if (categorizedNews[category]) {

      orderedCategorizedNews[category] =
        categorizedNews[category];

    }

  }

  // ===================================================
  // ساخت news.json
  // ===================================================

  const jsonData = {

    lastUpdate:
      new Date().toISOString(),

    lastUpdatePersian:
      new Date().toLocaleString("fa-IR"),

    totalNews:
      allNews.length,

    failedSources:
      failedSources,

    categories:
      Object.keys(
        orderedCategorizedNews
      ),

    news:
      allNews,

    categorizedNews:
      orderedCategorizedNews

  };

  fs.writeFileSync(

    "news.json",

    JSON.stringify(
      jsonData,
      null,
      2
    ),

    "utf8"

  );

  console.log(
    `✅ news.json با ${allNews.length} خبر ذخیره شد`
  );

  // ===================================================
  // ساخت index.html
  // ===================================================

  let html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>
🇮🇷 اخبار فوری ایران و جهان - دیار قدمگاه
</title>

<meta
  name="description"
  content="آخرین اخبار فوری ایران و جهان از منابع خبری معتبر، دسته‌بندی شده و به‌صورت خودکار به‌روزرسانی می‌شود."
>

<meta
  name="robots"
  content="index, follow"
>

<meta
  property="og:type"
  content="website"
>

<meta
  property="og:title"
  content="دیار قدمگاه | اخبار فوری ایران"
>

<meta
  property="og:description"
  content="اخبار دسته‌بندی‌شده ایران و جهان از منابع خبری معتبر با بروزرسانی خودکار."
>

<meta
  property="og:locale"
  content="fa_IR"
>

<style>

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Tahoma, Arial, sans-serif;
  background: #f0f2f5;
  padding: 10px;
}

.box {
  max-width: 900px;
  margin: auto;
}

.header {
  background: #b30000;
  color: white;
  padding: 15px;
  border-radius: 12px;
  font-size: 20px;
  font-weight: bold;
  text-align: center;
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 15px 0;
  justify-content: center;
}

.category-tab {
  background: #eee;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.3s;
  border: none;
}

.category-tab:hover {
  background: #ddd;
}

.category-tab.active {
  background: #b30000;
  color: white;
}

.category-section {
  margin-top: 15px;
}

.category-title {
  background: #b30000;
  color: white;
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 10px;
}

.card {
  background: white;
  margin-top: 8px;
  padding: 12px 15px;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.card:hover {
  transform: scale(1.01);
}

.card .title {
  font-weight: bold;
  font-size: 15px;
  line-height: 1.6;
}

.card .title a {
  color: #222;
  text-decoration: none;
}

.card .title a:hover {
  color: #b30000;
}

.card .meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  font-size: 12px;
  flex-wrap: wrap;
  gap: 5px;
}

.card .source {
  color: #b30000;
}

.card .date {
  color: #888;
}

.footer {
  text-align: center;
  color: #888;
  margin: 20px 0;
  font-size: 13px;
}

.count-badge {
  display: inline-block;
  background: #fff;
  color: #b30000;
  padding: 2px 12px;
  border-radius: 20px;
  font-size: 14px;
  margin-right: 10px;
}

@media(max-width:600px) {

  .card {
    padding: 10px;
  }

  .card .title {
    font-size: 13px;
  }

}

</style>

</head>

<body>

<div class="box">

<div class="header">

<div style="
  font-size:24px;
  font-weight:bold;
">
📰 دیار قدمگاه | اخبار فوری ایران
</div>

<div style="
  font-size:13px;
  margin-top:8px;
  opacity:.95
">
آخرین بروزرسانی:
${new Date().toLocaleString("fa-IR")}
</div>

<div style="
  display:flex;
  justify-content:center;
  gap:10px;
  flex-wrap:wrap;
  margin-top:12px
">

<span class="count-badge">
📰 ${allNews.length} خبر
</span>

<span class="count-badge">
🗂 ${Object.keys(orderedCategorizedNews).length} دسته
</span>

<span class="count-badge">
📡 ${successfulSources.size} خبرگزاری
</span>

</div>

</div>

<div class="category-tabs">

<button
  class="category-tab active"
  onclick="filterCategory('all')"
>
📋 همه
</button>

${Object.keys(orderedCategorizedNews)
  .map(
    cat => `
<button
  class="category-tab"
  onclick="filterCategory('${escapeHtml(cat)}')"
>
${categoryEmojis[cat] || "📌"} ${escapeHtml(cat)}
</button>
`
  )
  .join("")}

</div>

<div id="news-container">
`;

  // ===================================================
  // نمایش اخبار
  // ===================================================

  for (
    const [category, newsList]
    of Object.entries(
      orderedCategorizedNews
    )
  ) {

    const emoji =
      categoryEmojis[category] ||
      "📌";

    html += `

<div
  class="category-section"
  data-category="${escapeHtml(category)}"
>

<div class="category-title">

${emoji}
${escapeHtml(category)}

<span style="
  font-size:13px;
  background:#fff;
  color:#b30000;
  padding:0 10px;
  border-radius:12px;
  margin-right:8px;
">
${newsList.length}
</span>

</div>
`;

    for (const news of newsList) {

      const dateDisplay =
        news.date &&
        !isNaN(
          new Date(news.date)
        )
          ? new Date(news.date)
              .toLocaleString("fa-IR")
          : "";

      html += `

<div class="card">

<div class="title">

<a
  href="${escapeHtml(news.link)}"
  target="_blank"
  rel="noopener noreferrer"
>

${escapeHtml(news.title)}

</a>

</div>

<div class="meta">

<span class="source">

${news.flag || "📰"}
${escapeHtml(news.source)}

</span>

${
  dateDisplay
    ? `
<span class="date">
🕐 ${escapeHtml(dateDisplay)}
</span>
`
    : ""
}

</div>

</div>
`;
    }

    html += `
</div>
`;
  }

  html += `

</div>

<div class="footer">

🔄 آخرین بروزرسانی:
${new Date().toLocaleString("fa-IR")}

<br>

${
  failedSources.length
    ? `⚠️ منابع ناموفق:
${failedSources
  .map(escapeHtml)
  .join("، ")}`
    : "✅ همه منابع فعال هستند"
}

</div>

</div>

<script>

function filterCategory(category) {

  document
    .querySelectorAll(".category-tab")
    .forEach(tab =>
      tab.classList.remove("active")
    );

  document
    .querySelectorAll(".category-tab")
    .forEach(tab => {

      if (
        tab.textContent.includes(
          category === "all"
            ? "همه"
            : category
        )
      ) {

        tab.classList.add("active");

      }

    });

  document
    .querySelectorAll(".category-section")
    .forEach(section => {

      if (
        category === "all" ||
        section.dataset.category === category
      ) {

        section.style.display =
          "block";

      } else {

        section.style.display =
          "none";

      }

    });

}

</script>

</body>

</html>
`;

  fs.writeFileSync(
    "index.html",
    html,
    "utf8"
  );

  console.log(
    `✅ index.html با ${allNews.length} خبر ذخیره شد`
  );

  // ===================================================
  // news.html
  // ===================================================
  // بسیار مهم:
  // news.html صفحه ثابت پروژه است و نباید توسط
  // fetch-news.js بازنویسی شود.
  // ===================================================

  console.log(
    "ℹ️ news.html بازنویسی نشد؛ صفحه ثابت پروژه است."
  );

  // ===================================================
  // news-ticker.html
  // ===================================================

  const tickerHtml = `<!DOCTYPE html>

<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<style>

.news-ticker {

  direction: rtl;

  font-family:
    Tahoma,
    Arial,
    sans-serif;

  background: #b30000;

  color: white;

  padding: 8px 15px;

  border-radius: 8px;

  overflow: hidden;

  white-space: nowrap;

  position: relative;

}

.news-ticker-content {

  display: inline-block;

  animation:
    tickerScroll 90s
    linear
    infinite;

}

.news-ticker-content a {

  color: white;

  text-decoration: none;

  margin: 0 15px;

  font-size: 13px;

}

.news-ticker-content a:hover {

  text-decoration: underline;

}

.news-ticker .category-badge {

  background:
    rgba(255,255,255,0.2);

  padding: 2px 10px;

  border-radius: 12px;

  font-size: 11px;

  margin-left: 5px;

}

.news-ticker .separator {

  color: #ff6b6b;

  margin: 0 8px;

}

@keyframes tickerScroll {

  0% {
    transform: translateX(100%);
  }

  100% {
    transform: translateX(-100%);
  }

}

.news-ticker:hover
.news-ticker-content {

  animation-play-state:
    paused;

}

</style>

</head>

<body>

<div class="news-ticker">

<div class="news-ticker-content">

${allNews
  .map(n => {

    return `
<a
  href="${escapeHtml(n.link)}"
  target="_blank"
  rel="noopener noreferrer"
>

<span class="category-badge">
${n.flag || "📰"}
</span>

${escapeHtml(n.title)}

</a>

<span class="separator">
|
</span>
`;

  })
  .join("")}

<span style="color:#ff6b6b;">
●
</span>

آخرین بروزرسانی:
${new Date().toLocaleString("fa-IR")}

</div>

</div>

</body>

</html>
`;

  // ===================================================
  // حفظ نسخه موجود ticker
  // ===================================================

  if (
    !fs.existsSync(
      "news-ticker.html"
    )
  ) {

    fs.writeFileSync(
      "news-ticker.html",
      tickerHtml,
      "utf8"
    );

    console.log(
      `✅ news-ticker.html ساخته شد (${allNews.length} خبر)`
    );

  } else {

    console.log(
      "ℹ️ news-ticker.html موجود است؛ بازنویسی نشد."
    );

  }

  // ===================================================
  // پایان
  // ===================================================

  console.log(
    "\n🎉 عملیات با موفقیت کامل شد!"
  );

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );

}

// =====================================================
// اجرای برنامه
// =====================================================

getNews().catch(err => {

  console.error(
    "❌ خطای کلی:",
    err.message
  );

  process.exit(1);

});

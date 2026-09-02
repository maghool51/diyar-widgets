const fs = require("fs");
const Parser = require("rss-parser");

// ============================================================
// RSS Parser
// ============================================================

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  },
  timeout: 15000
});

// ============================================================
// ابزارهای امنیتی
// ============================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return "";

  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================
// اعتبارسنجی لینک
// ============================================================

function safeLink(url) {
  try {
    const u = new URL(url);

    if (
      u.protocol === "http:" ||
      u.protocol === "https:"
    ) {
      return u.href;
    }
  } catch (e) {}

  return "#";
}

// ============================================================
// ایموجی دسته‌ها
// ============================================================

const categoryEmojis = {
  "سیاسی": "🏛️",
  "بین‌الملل": "🌍",
  "اقتصادی": "💰",
  "اجتماعی": "👥",
  "ورزشی": "⚽",
  "فناوری": "💻",
  "فرهنگی و هنری": "🎭",
  "علمی و پزشکی": "🔬",
  "متفرقه": "📌"
};

// ============================================================
// ترتیب استاندارد دسته‌ها
// ============================================================

const categoryOrder = [
  "سیاسی",
  "بین‌الملل",
  "اقتصادی",
  "اجتماعی",
  "ورزشی",
  "فناوری",
  "فرهنگی و هنری",
  "علمی و پزشکی",
  "متفرقه"
];

// ============================================================
// نرمال‌سازی حرفه‌ای فارسی
// ============================================================

function normalizePersianText(text = "") {
  return String(text)
    .toLowerCase()

    // حروف عربی → فارسی
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ۀ/g, "ه")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/إ/g, "ا")
    .replace(/أ/g, "ا")
    .replace(/ٱ/g, "ا")

    // نیم‌فاصله و کاراکترهای نامرئی
    .replace(/\u200c/g, " ")
    .replace(/\u200b/g, " ")
    .replace(/\u200d/g, " ")
    .replace(/\ufeff/g, " ")

    // اعداد عربی/فارسی
    .replace(/[۰-۹]/g, d =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    )
    .replace(/[٠-٩]/g, d =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(d))
    )

    // فاصله‌های اضافی
    .replace(/\s+/g, " ")

    .trim();
}

// ============================================================
// تبدیل متن به توکن‌های واقعی
// ============================================================
//
// این قسمت مشکل اصلی پزشکیان را حل می‌کند.
//
// پزشکی
// پزشکیان
//
// دو واژه متفاوت هستند و «پزشکی» داخل «پزشکیان» محسوب نمی‌شود.
//
// ============================================================

function tokenizePersian(text = "") {
  const normalized = normalizePersianText(text);

  if (!normalized) return [];

  return normalized
    .split(/[^آ-یa-z0-9]+/i)
    .filter(Boolean);
}

// ============================================================
// بررسی وجود کلمه/عبارت به صورت مستقل
// ============================================================

function containsKeyword(text, keyword) {
  const normalizedText = normalizePersianText(text);
  const normalizedKeyword = normalizePersianText(keyword);

  if (!normalizedText || !normalizedKeyword) {
    return false;
  }

  const textTokens = tokenizePersian(normalizedText);
  const keywordTokens = tokenizePersian(normalizedKeyword);

  if (!keywordTokens.length) {
    return false;
  }

  // عبارت چندکلمه‌ای
  if (keywordTokens.length > 1) {
    for (
      let i = 0;
      i <= textTokens.length - keywordTokens.length;
      i++
    ) {
      let matched = true;

      for (let j = 0; j < keywordTokens.length; j++) {
        if (textTokens[i + j] !== keywordTokens[j]) {
          matched = false;
          break;
        }
      }

      if (matched) return true;
    }

    return false;
  }

  // تک‌کلمه‌ای
  return textTokens.includes(keywordTokens[0]);
}

// ============================================================
// کلمات کلیدی دسته‌ها
// ============================================================

const categories = {

  // ----------------------------------------------------------
  // سیاسی
  // ----------------------------------------------------------

  "سیاسی": [
    "رئیسی",
    "پزشکیان",
    "رئیس جمهور",
    "رئیس‌جمهور",
    "ریاست جمهوری",
    "رئیس مجلس",
    "وزیر",
    "وزارت",
    "مجلس",
    "نماینده",
    "نماینده مجلس",
    "نمایندگان",
    "انتخابات",
    "انتخاباتی",
    "دولت",
    "هیئت دولت",
    "کابینه",
    "سیاست",
    "سیاسی",
    "قوه قضائیه",
    "قوه مقننه",
    "قوه مجریه",
    "شورای نگهبان",
    "مجمع تشخیص",
    "استاندار",
    "فرماندار",
    "شهردار",
    "قانون",
    "لایحه",
    "طرح مجلس",
    "استیضاح",
    "رأی اعتماد",
    "رای اعتماد",
    "تحقیق و تفحص",
    "برجام",
    "مذاکره",
    "مذاکرات",
    "دیپلماسی",
    "سیاست داخلی",
    "سیاست خارجی",
    "دادگاه",
    "قانونگذاری",
    "قانون‌گذاری"
  ],

  // ----------------------------------------------------------
  // بین‌الملل
  // ----------------------------------------------------------

  "بین‌الملل": [
    "جهان",
    "بین الملل",
    "بین‌الملل",
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
    "کره",
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
    "بایدن",
    "ترامپ",
    "پوتین",
    "شی جین پینگ",
    "ناتو",
    "آمریکا",
    "ایالات متحده",
    "کنگره آمریکا",
    "سنا",
    "کاخ سفید",
    "کرملین",
    "اسرائیل",
    "فلسطین",
    "غزه",
    "حماس",
    "حزب الله",
    "حزب‌الله",
    "لبنان",
    "کرانه باختری",
    "جنگ",
    "آتش بس",
    "آتش‌بس",
    "صلح",
    "درگیری نظامی",
    "حمله نظامی",
    "حملات هوایی",
    "موشک",
    "موشکی",
    "تحریم آمریکا",
    "تحریم‌های آمریکا"
  ],

  // ----------------------------------------------------------
  // اقتصادی
  // ----------------------------------------------------------

  "اقتصادی": [
    "اقتصاد",
    "اقتصادی",
    "دلار",
    "یورو",
    "طلا",
    "سکه",
    "ارز",
    "بانک",
    "بانکی",
    "بانک مرکزی",
    "پول",
    "بورس",
    "سهام",
    "شاخص بورس",
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
    "کشاورزی",
    "بازار",
    "تجارت",
    "بودجه",
    "مالیات",
    "یارانه",
    "فقر",
    "اشتغال",
    "بیکاری",
    "تعاون",
    "سرمایه گذاری",
    "سرمایه‌گذاری",
    "مسکن",
    "اجاره",
    "خودرو",
    "خودروسازی"
  ],

  // ----------------------------------------------------------
  // اجتماعی
  // ----------------------------------------------------------

  "اجتماعی": [
    "آموزش",
    "آموزش و پرورش",
    "دانشگاه",
    "مدرسه",
    "دانش آموز",
    "دانش‌آموز",
    "دانشجو",
    "تحصیل",
    "کنکور",
    "بیمه",
    "حوادث",
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
    "کار",
    "حقوق",
    "مسکن",
    "آسیب اجتماعی",
    "آسیب‌های اجتماعی",
    "اعتیاد",
    "کودک",
    "کودکان",
    "زنان",
    "جوانان",
    "سالمندان",
    "مردم",
    "جامعه",
    "خانواده",
    "اورژانس",
    "هلال احمر",
    "تعطیلی",
    "مدارس"
  ],

  // ----------------------------------------------------------
  // ورزشی
  // ----------------------------------------------------------

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
    "لیگ",
    "جام جهانی",
    "جام ملت‌ها",
    "المپیک",
    "پارالمپیک",
    "کشتی",
    "وزنه برداری",
    "وزنه‌برداری",
    "والیبال",
    "بسکتبال",
    "تنیس",
    "شطرنج",
    "قهرمانی",
    "مسابقه",
    "مسابقات",
    "گل",
    "دربی",
    "مدال",
    "مربی",
    "داور",
    "تماشاگر",
    "ورزشگاه",
    "بازیکن",
    "سرمربی",
    "فدراسیون"
  ],

  // ----------------------------------------------------------
  // فناوری
  // ----------------------------------------------------------

  "فناوری": [
    "فناوری",
    "فناوری اطلاعات",
    "تکنولوژی",
    "هوش مصنوعی",
    "هوش مصنوعی مولد",
    "اینترنت",
    "موبایل",
    "گوشی",
    "گوشی هوشمند",
    "تلفن همراه",
    "رایانه",
    "کامپیوتر",
    "نرم افزار",
    "نرم‌افزار",
    "سخت افزار",
    "سخت‌افزار",
    "اپلیکیشن",
    "برنامه کاربردی",
    "ربات",
    "رباتیک",
    "دیجیتال",
    "شبکه",
    "سایبری",
    "امنیت سایبری",
    "هک",
    "هکر",
    "داده",
    "پردازنده",
    "تراشه",
    "الکترونیک",
    "فضای مجازی",
    "شبکه اجتماعی",
    "تلگرام",
    "اینستاگرام",
    "واتساپ",
    "مایکروسافت",
    "گوگل",
    "اپل",
    "سامسونگ",
    "متاورس",
    "بلاکچین",
    "رمزارز",
    "رمز ارز",
    "کریپتو"
  ],

  // ----------------------------------------------------------
  // فرهنگی و هنری
  // ----------------------------------------------------------

  "فرهنگی و هنری": [
    "فیلم",
    "سینما",
    "تلویزیون",
    "سریال",
    "هنر",
    "هنری",
    "موسیقی",
    "کنسرت",
    "بازیگر",
    "کارگردان",
    "نمایش",
    "تئاتر",
    "کتاب",
    "نویسنده",
    "شعر",
    "شاعر",
    "ادبیات",
    "جشنواره",
    "فرهنگ",
    "فرهنگی",
    "هنرمند",
    "جوایز",
    "موزه",
    "نگارخانه",
    "میراث فرهنگی",
    "گردشگری",
    "گردشگر",
    "صنایع دستی"
  ],

  // ----------------------------------------------------------
  // علمی و پزشکی
  // ----------------------------------------------------------

  "علمی و پزشکی": [
    "علم",
    "علمی",
    "پژوهش",
    "پژوهشی",
    "تحقیق",
    "تحقیقات",
    "دانشگاه",
    "استاد دانشگاه",
    "پژوهشگر",
    "دانشمند",
    "کشف علمی",
    "اختراع",
    "نوآوری",

    "پزشکی",
    "پزشک",
    "پزشکان",
    "بیمار",
    "بیماری",
    "درمان",
    "سلامت",
    "بهداشت",
    "بیمارستان",
    "دارو",
    "دارویی",
    "واکسن",
    "ویروس",
    "سرطان",
    "قلب",
    "مغز",
    "جراحی",

    "زیست فناوری",
    "زیست‌فناوری",
    "نانو",
    "فضا",
    "نجوم",
    "ماهواره",
    "هسته‌ای",
    "انرژی",
    "ژنتیک",
    "سلول بنیادی"
  ]
};

// ============================================================
// Keywordهای دارای اولویت بالا
// ============================================================

const priorityKeywords = {

  "ورزشی": [
    "فوتبال",
    "استقلال",
    "پرسپولیس",
    "سپاهان",
    "تراکتور",
    "لیگ برتر",
    "تیم ملی",
    "کشتی",
    "والیبال",
    "بسکتبال",
    "المپیک"
  ],

  "فناوری": [
    "هوش مصنوعی",
    "هوش مصنوعی مولد",
    "امنیت سایبری",
    "سایبری",
    "اینترنت",
    "موبایل",
    "گوشی هوشمند",
    "نرم افزار",
    "نرم‌افزار",
    "کامپیوتر",
    "رایانه",
    "اپلیکیشن",
    "ربات",
    "تراشه",
    "پردازنده"
  ],

  "بین‌الملل": [
    "آمریکا",
    "ایالات متحده",
    "اسرائیل",
    "فلسطین",
    "غزه",
    "حماس",
    "روسیه",
    "اوکراین",
    "ترامپ",
    "پوتین",
    "چین",
    "اروپا",
    "ناتو",
    "جنگ",
    "حمله نظامی",
    "درگیری نظامی",
    "آتش‌بس"
  ],

  "سیاسی": [
    "پزشکیان",
    "رئیسی",
    "رئیس جمهور",
    "رئیس‌جمهور",
    "مجلس",
    "انتخابات",
    "دولت",
    "وزیر",
    "وزارت",
    "استیضاح",
    "برجام",
    "دیپلماسی"
  ]
};

// ============================================================
// امتیازدهی Keyword
// ============================================================

function getKeywordScore(keyword) {
  const length =
    normalizePersianText(keyword).length;

  if (length >= 15) return 6;
  if (length >= 11) return 5;
  if (length >= 8) return 4;
  if (length >= 5) return 3;

  return 2;
}

// ============================================================
// تشخیص دسته‌بندی حرفه‌ای
// ============================================================

function detectCategory(title = "", originalCategory = "") {

  const text =
    `${title} ${originalCategory}`;

  const scores = {};

  for (const category of categoryOrder) {
    scores[category] = 0;
  }

  // ----------------------------------------------------------
  // امتیازدهی
  // ----------------------------------------------------------

  for (const [category, keywords] of Object.entries(categories)) {

    for (const keyword of keywords) {

      if (
        containsKeyword(
          text,
          keyword
        )
      ) {
        scores[category] +=
          getKeywordScore(keyword);
      }
    }
  }

  // ----------------------------------------------------------
  // اولویت‌های تخصصی
  // ----------------------------------------------------------

  for (
    const [category, keywords]
    of Object.entries(priorityKeywords)
  ) {

    for (const keyword of keywords) {

      if (
        containsKeyword(
          text,
          keyword
        )
      ) {

        scores[category] += 10;
      }
    }
  }

  // ----------------------------------------------------------
  // قانون قطعی پزشکیان
  // ----------------------------------------------------------
  //
  // پزشکیان نام شخص است و باید سیاسی باشد.
  //
  // حتی اگر عنوان شامل کلمات پزشکی/درمان/سلامت هم باشد،
  // وجود «پزشکیان» نباید باعث علمی و پزشکی شدن خبر شود.
  //
  // ----------------------------------------------------------

  if (
    containsKeyword(
      text,
      "پزشکیان"
    )
  ) {
    return "سیاسی";
  }

  // ----------------------------------------------------------
  // انتخاب بالاترین امتیاز
  // ----------------------------------------------------------

  let bestCategory = "متفرقه";
  let maxScore = 0;

  for (const category of categoryOrder) {

    const score =
      scores[category];

    if (
      score > maxScore
    ) {
      maxScore = score;
      bestCategory = category;
    }
  }

  return maxScore > 0
    ? bestCategory
    : "متفرقه";
}

// ============================================================
// تست موتور دسته‌بندی
// ============================================================

function runCategorySelfTest() {

  console.log(
    "\n🧪 تست موتور دسته‌بندی"
  );

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );

  const tests = [

    [
      "پزشکیان: دولت برنامه جدیدی برای کشور دارد",
      "سیاسی"
    ],

    [
      "پزشکیان درباره وضعیت اقتصادی کشور توضیح داد",
      "سیاسی"
    ],

    [
      "پزشکی قانونی علت مرگ را اعلام کرد",
      "علمی و پزشکی"
    ],

    [
      "پزشکان درباره روش جدید درمان بیماری هشدار دادند",
      "علمی و پزشکی"
    ],

    [
      "استقلال در لیگ برتر به پیروزی رسید",
      "ورزشی"
    ],

    [
      "هوش مصنوعی جدید گوگل معرفی شد",
      "فناوری"
    ],

    [
      "ترامپ درباره جنگ در منطقه اظهارنظر کرد",
      "بین‌الملل"
    ],

    [
      "قیمت دلار افزایش یافت",
      "اقتصادی"
    ],

    [
      "جشنواره فیلم آغاز شد",
      "فرهنگی و هنری"
    ]
  ];

  let passed = 0;

  for (const [title, expected] of tests) {

    const result =
      detectCategory(title);

    const ok =
      result === expected;

    if (ok) passed++;

    console.log(
      `${ok ? "✅" : "❌"} ${title}`
    );

    console.log(
      `   نتیجه: ${result} | انتظار: ${expected}`
    );
  }

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );

  console.log(
    `🧪 نتیجه تست: ${passed}/${tests.length} موفق`
  );

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
  );
}

// ============================================================
// منابع نهایی
// ============================================================

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
    url:
      "https://www.tasnimnews.ir/fa/rss/feed/0/0/8/1/TopStories",
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
    url:
      "https://www.khabarfoori.com/fa/feeds/?p=ZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTQzMjAw",
    flag: "🇮🇷"
  },

  {
    name: "قدس آنلاین",
    url: "https://qudsonline.ir/rss",
    flag: "🇮🇷"
  },

  {
    name: "عصر ایران",
    url:
      "https://www.asriran.com/fa/rss/allnews",
    flag: "🇮🇷"
  },

  {
    name: "تابناک",
    url:
      "https://www.tabnak.ir/fa/rss/allnews",
    flag: "🇮🇷"
  },

  {
    name: "صدای آمریکا فارسی",
    url:
      "https://ir.voanews.com/api/zuiypl-vomx-tpeggtm",
    flag: "🌍"
  },

  {
    name: "اطلاعات",
    url:
      "https://www.ettelaat.com/rss/tp/62",
    flag: "🇮🇷"
  },

  {
    name: "بی‌بی‌سی فارسی",
    url:
      "https://feeds.bbci.co.uk/persian/rss.xml",
    flag: "🌍"
  },

  {
    name: "دویچه‌وله فارسی",
    url:
      "https://rss.dw.com/rdf/rss-fa-all",
    flag: "🌍"
  },

  {
    name: "رادیو فردا",
    url:
      "https://www.radiofarda.com/api/zpoqil-vomx-tpe_kip",
    flag: "🌍"
  }
];

// ============================================================
// منابع پشتیبان
// ============================================================

const backupSources = [
  {
    name: "رادیو فردا",
    url:
      "https://www.radiofarda.com/api/zrttpol-vomx-tpeoogpi"
  }
];

// ============================================================
// دریافت RSS با Retry
// ============================================================

async function fetchWithRetry(
  url,
  retries = 2
) {

  for (
    let i = 0;
    i < retries;
    i++
  ) {

    try {

      return await parser.parseURL(url);

    } catch (e) {

      if (
        i === retries - 1
      ) {
        throw e;
      }

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            2000 * (i + 1)
          )
      );
    }
  }
}

// ============================================================
// اجرای اصلی
// ============================================================

async function getNews() {

  console.log(
    "📰 در حال دریافت اخبار فوری ایران و جهان..."
  );

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );

  let allNews = [];

  const failedSources = [];

  // ==========================================================
  // منابع اصلی
  // ==========================================================

  for (
    const source of sources
  ) {

    try {

      console.log(
        `⏳ ${source.flag} در حال دریافت ${source.name}...`
      );

      const feed =
        await fetchWithRetry(
          source.url
        );

      if (
        !feed.items ||
        feed.items.length === 0
      ) {

        console.log(
          `⚠️ ${source.name} هیچ خبری نداشت`
        );

        failedSources.push(
          source.name
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
            String(item.title).trim();

          const originalCategory =
            item.category ||
            (
              Array.isArray(
                item.categories
              )
                ? item.categories[0]
                : ""
            ) ||
            "";

          const category =
            detectCategory(
              title,
              originalCategory
            );

          allNews.push({

            title,

            link:
              safeLink(item.link),

            date:
              item.pubDate ||
              item.isoDate ||
              "",

            source:
              source.name,

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

      failedSources.push(
        source.name
      );
    }
  }

  // ==========================================================
  // منابع پشتیبان
  // ==========================================================

  console.log(
    "\n🔄 بررسی منابع پشتیبان..."
  );

  for (
    const backup of backupSources
  ) {

    if (
      failedSources.includes(
        backup.name
      ) ||
      !sources.find(
        s =>
          s.name === backup.name
      )
    ) {

      try {

        console.log(
          `⏳ در حال دریافت ${backup.name} (پشتیبان)...`
        );

        const feed =
          await fetchWithRetry(
            backup.url
          );

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

        const originalSource =
          sources.find(
            s =>
              s.name ===
              backup.name
          );

        const backupFlag =
          originalSource?.flag ||
          "🌍";

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
              String(item.title).trim();

            const originalCategory =
              item.category ||
              (
                Array.isArray(
                  item.categories
                )
                  ? item.categories[0]
                  : ""
              ) ||
              "";

            const category =
              detectCategory(
                title,
                originalCategory
              );

            allNews.push({

              title,

              link:
                safeLink(item.link),

              date:
                item.pubDate ||
                item.isoDate ||
                "",

              source:
                backup.name,

              category,

              flag:
                backupFlag
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

        if (
          index > -1
        ) {
          failedSources.splice(
            index,
            1
          );
        }

      } catch (e) {

        console.log(
          `❌ ${backup.name} (پشتیبان) نیز ناموفق بود: ${e.message}`
        );
      }
    }
  }

  // ==========================================================
  // بررسی نهایی
  // ==========================================================

  if (
    allNews.length === 0
  ) {

    console.log(
      "⚠️ هیچ خبری دریافت نشد!"
    );

    return;
  }

  // ==========================================================
  // حذف اخبار تکراری
  // ==========================================================

  const seenTitles =
    new Set();

  allNews = allNews

    .filter(
      n =>
        n.title &&
        /[\u0600-\u06FF]/.test(
          n.title
        )
    )

    .filter(n => {

      const key =
        normalizePersianText(
          n.title
        )
          .replace(
            /[«»،:؛!?؟،.؛]/g,
            ""
          )
          .trim();

      if (
        seenTitles.has(key)
      ) {
        return false;
      }

      seenTitles.add(key);

      return true;
    })

    .sort((a, b) => {

      const dateA =
        new Date(a.date);

      const dateB =
        new Date(b.date);

      if (
        isNaN(
          dateA.getTime()
        )
      ) {
        return 1;
      }

      if (
        isNaN(
          dateB.getTime()
        )
      ) {
        return -1;
      }

      return dateB - dateA;
    })

    .slice(0, 100);

  console.log(
    `\n📊 مجموع اخبار دریافتی: ${allNews.length}`
  );

  // ==========================================================
  // دسته‌بندی اخبار
  // ==========================================================

  const categorizedNews = {};

  for (
    const category of categoryOrder
  ) {

    categorizedNews[
      category
    ] = [];
  }

  for (
    const news of allNews
  ) {

    if (
      !categorizedNews[
        news.category
      ]
    ) {

      categorizedNews[
        news.category
      ] = [];
    }

    categorizedNews[
      news.category
    ].push(news);
  }

  // ==========================================================
  // حذف دسته‌های خالی
  // ==========================================================

  for (
    const category of Object.keys(
      categorizedNews
    )
  ) {

    if (
      categorizedNews[
        category
      ].length === 0
    ) {

      delete categorizedNews[
        category
      ];
    }
  }

  // ==========================================================
  // ترتیب نهایی دسته‌ها
  // ==========================================================

  const orderedCategorizedNews = {};

  for (
    const category of categoryOrder
  ) {

    if (
      categorizedNews[
        category
      ] &&
      categorizedNews[
        category
      ].length > 0
    ) {

      orderedCategorizedNews[
        category
      ] =
        categorizedNews[
          category
        ];
    }
  }

  const activeCategories =
    Object.keys(
      orderedCategorizedNews
    );

  // ==========================================================
  // زمان ایران
  // ==========================================================

  const now =
    new Date();

  const updateTime =
    now.toLocaleString(
      "fa-IR",
      {
        timeZone:
          "Asia/Tehran"
      }
    );

  // ==========================================================
  // ساخت news.json
  // ==========================================================

  const jsonData = {

    lastUpdate:
      now.toISOString(),

    lastUpdatePersian:
      updateTime,

    totalNews:
      allNews.length,

    failedSources:
      failedSources,

    categories:
      activeCategories,

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

  // ==========================================================
  // ساخت index.html
  // ==========================================================

  let html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<title>
🇮🇷 اخبار فوری ایران و جهان - دیار قدمگاه
</title>

<meta name="description"
content="آخرین اخبار فوری ایران و جهان از ${sources.length} منبع معتبر خبری، دسته‌بندی شده و به‌روزشونده.">

<meta name="robots"
content="index, follow">

<meta property="og:type"
content="website">

<meta property="og:title"
content="دیار قدمگاه | اخبار فوری ایران">

<meta property="og:description"
content="اخبار دسته‌بندی‌شده ایران و جهان از ${sources.length} منبع معتبر.">

<meta property="og:locale"
content="fa_IR">

<style>

*{
margin:0;
padding:0;
box-sizing:border-box
}

body{
font-family:tahoma;
background:#f0f2f5;
padding:10px
}

.box{
max-width:900px;
margin:auto
}

.header{
background:#b30000;
color:white;
padding:15px;
border-radius:12px;
font-size:20px;
font-weight:bold;
text-align:center
}

.category-tabs{
display:flex;
flex-wrap:wrap;
gap:8px;
margin:15px 0;
justify-content:center
}

.category-tab{
background:#eee;
padding:8px 16px;
border-radius:20px;
cursor:pointer;
font-size:13px;
transition:all .3s;
border:none
}

.category-tab:hover{
background:#ddd
}

.category-tab.active{
background:#b30000;
color:white
}

.category-section{
margin-top:15px
}

.category-title{
background:#b30000;
color:white;
padding:10px 15px;
border-radius:8px;
font-size:16px;
font-weight:bold;
margin-bottom:10px
}

.card{
background:white;
margin-top:8px;
padding:12px 15px;
border-radius:8px;
box-shadow:0 1px 4px rgba(0,0,0,.1);
transition:transform .2s
}

.card:hover{
transform:scale(1.01)
}

.card .title{
font-weight:bold;
font-size:15px;
line-height:1.6
}

.card .title a{
color:#222;
text-decoration:none
}

.card .title a:hover{
color:#b30000
}

.card .meta{
display:flex;
justify-content:space-between;
align-items:center;
margin-top:6px;
font-size:12px;
flex-wrap:wrap;
gap:5px
}

.card .source{
color:#b30000
}

.card .date{
color:#888
}

.footer{
text-align:center;
color:#888;
margin:20px 0;
font-size:13px
}

.count-badge{
display:inline-block;
background:#fff;
color:#b30000;
padding:2px 12px;
border-radius:20px;
font-size:14px;
margin-right:10px
}

.flag-badge{
font-size:14px;
margin-right:5px
}

@media(max-width:600px){

.card{
padding:10px
}

.card .title{
font-size:13px
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
${escapeHtml(updateTime)}

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

🗂 ${activeCategories.length} دسته

</span>

<span class="count-badge">

📡 ${sources.length} خبرگزاری

</span>

</div>

</div>

<div class="category-tabs">

<button
class="category-tab active"
onclick="filterCategory('all')">

📋 همه

</button>

${activeCategories
  .map(
    cat => `
<button
class="category-tab"
onclick="filterCategory('${escapeHtml(cat)}')">

${categoryEmojis[cat] || "📌"}
${escapeHtml(cat)}

</button>
`
  )
  .join("")}

</div>

<div id="news-container">
`;

  // ==========================================================
  // نمایش دسته‌ها
  // ==========================================================

  for (
    const category of activeCategories
  ) {

    const newsList =
      orderedCategorizedNews[
        category
      ];

    const emoji =
      categoryEmojis[
        category
      ] || "📌";

    html += `

<div
class="category-section"
data-category="${escapeHtml(category)}">

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

    for (
      const news of newsList
    ) {

      const newsDate =
        news.date
          ? new Date(news.date)
          : null;

      const dateDisplay =
        newsDate &&
        !isNaN(
          newsDate.getTime()
        )
          ? newsDate.toLocaleString(
              "fa-IR",
              {
                timeZone:
                  "Asia/Tehran"
              }
            )
          : "";

      html += `

<div class="card">

<div class="title">

<a
href="${escapeHtml(news.link)}"
target="_blank"
rel="noopener noreferrer">

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

  // ==========================================================
  // پایان HTML
  // ==========================================================

  html += `

</div>

<div class="footer">

🔄 آخرین بروزرسانی:
${escapeHtml(updateTime)}

<br>

${
  failedSources.length
    ? `⚠️ منابع ناموفق:
${escapeHtml(
  failedSources.join("، ")
)}`
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

  // ==========================================================
  // news.html
  // ==========================================================

  fs.writeFileSync(
    "news.html",
    html,
    "utf8"
  );

  console.log(
    `✅ news.html با ${allNews.length} خبر ذخیره شد`
  );

  // ==========================================================
  // news-ticker.html
  // ==========================================================

  const tickerHtml = `<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<style>

.news-ticker{

direction:rtl;
font-family:Tahoma,sans-serif;
background:#b30000;
color:white;
padding:8px 15px;
border-radius:8px;
overflow:hidden;
white-space:nowrap;
position:relative;

}

.news-ticker-content{

display:inline-block;
animation:
tickerScroll
90s
linear
infinite;

}

.news-ticker-content a{

color:white;
text-decoration:none;
margin:0 15px;
font-size:13px;

}

.news-ticker-content a:hover{

text-decoration:underline;

}

.news-ticker .category-badge{

background:
rgba(255,255,255,.2);

padding:
2px 10px;

border-radius:12px;

font-size:11px;

margin-left:5px;

}

.news-ticker .separator{

color:#ff6b6b;
margin:0 8px;

}

@keyframes tickerScroll{

0%{
transform:translateX(100%);
}

100%{
transform:translateX(-100%);
}

}

.news-ticker:hover
.news-ticker-content{

animation-play-state:paused;

}

</style>

</head>

<body>

<div class="news-ticker">

<div class="news-ticker-content">

${allNews
  .map(
    n => `

<a
href="${escapeHtml(n.link)}"
target="_blank"
rel="noopener noreferrer">

<span class="category-badge">

${categoryEmojis[n.category] || n.flag || "📰"}

</span>

${escapeHtml(n.title)}

</a>

<span class="separator">
|
</span>

`
  )
  .join("")}

<span style="color:#ff6b6b;">
●
</span>

آخرین بروزرسانی:

${escapeHtml(updateTime)}

</div>

</div>

</body>

</html>
`;

  // ==========================================================
  // حفظ نسخه دستی news-ticker.html
  // ==========================================================

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

  // ==========================================================
  // گزارش دسته‌ها
  // ==========================================================

  console.log(
    "\n📊 گزارش نهایی دسته‌بندی"
  );

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );

  for (
    const category of activeCategories
  ) {

    console.log(
      `${categoryEmojis[category] || "📌"} ${category}: ${
        orderedCategorizedNews[
          category
        ].length
      } خبر`
    );
  }

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );

  console.log(
    "\n🎉 عملیات با موفقیت کامل شد!"
  );
}

// ============================================================
// اجرای تست دسته‌بندی
// ============================================================

runCategorySelfTest();

// ============================================================
// اجرای برنامه
// ============================================================

getNews().catch(err => {

  console.error(
    "❌ خطای کلی:",
    err.message
  );

  process.exit(1);
});

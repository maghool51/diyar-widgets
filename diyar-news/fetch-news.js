const fs = require("fs");
const Parser = require("rss-parser");

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

function safeLink(url) {
  try {
    const u = new URL(url);

    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.href;
    }
  } catch (e) {}

  return "#";
}

// ============================================================
// استانداردسازی دسته‌بندی اخبار
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

// ترتیب ثابت نمایش دسته‌ها
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
// نرمال‌سازی متن فارسی
// ============================================================

function normalizePersianText(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ۀ/g, "ه")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/إ/g, "ا")
    .replace(/أ/g, "ا")
    .replace(/\u200c/g, " ")
    .replace(/‌/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// کلمات کلیدی دسته‌ها
// ============================================================

const categories = {
  "سیاسی": [
    "رئیس جمهور",
    "رئیس‌جمهور",
    "ریاست جمهوری",
    "رئیس مجلس",
    "وزیر",
    "وزارت",
    "مجلس",
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
    "نماینده",
    "قانون",
    "لایحه",
    "طرح مجلس",
    "استیضاح",
    "رأی اعتماد",
    "رای اعتماد",
    "تحقیق و تفحص",
    "برجام",
    "مذاکره هسته‌ای",
    "مذاکرات هسته‌ای",
    "دیپلماسی",
    "سیاست داخلی"
  ],

  "بین‌الملل": [
    "بین الملل",
    "بین‌الملل",
    "جهان",
    "آمریکا",
    "ایالات متحده",
    "ترامپ",
    "بایدن",
    "کاخ سفید",
    "کنگره آمریکا",
    "سنا",
    "اسرائیل",
    "فلسطین",
    "غزه",
    "حماس",
    "حزب الله",
    "حزب‌الله",
    "لبنان",
    "کرانه باختری",
    "ایران و اسرائیل",
    "روسیه",
    "پوتین",
    "اوکراین",
    "چین",
    "شی جین پینگ",
    "اروپا",
    "اتحادیه اروپا",
    "انگلیس",
    "بریتانیا",
    "فرانسه",
    "آلمان",
    "ناتو",
    "سازمان ملل",
    "شورای امنیت",
    "افغانستان",
    "عراق",
    "سوریه",
    "یمن",
    "عربستان",
    "امارات",
    "قطر",
    "ترکیه",
    "هند",
    "پاکستان",
    "ژاپن",
    "کره جنوبی",
    "کره شمالی",
    "آفریقا",
    "آسیا",
    "جنگ",
    "آتش بس",
    "آتش‌بس",
    "درگیری نظامی",
    "حمله نظامی",
    "حملات هوایی",
    "موشک",
    "موشکی",
    "تحریم آمریکا",
    "تحریم‌های آمریکا",
    "تحریم اروپا",
    "تحریم روسیه",
    "کرملین",
    "پنتاگون"
  ],

  "اقتصادی": [
    "اقتصاد",
    "اقتصادی",
    "دلار",
    "یورو",
    "ارز",
    "ارزی",
    "طلا",
    "سکه",
    "بورس",
    "سهام",
    "شاخص بورس",
    "بانک",
    "بانکی",
    "بانک مرکزی",
    "نرخ بهره",
    "نرخ سود",
    "تورم",
    "گرانی",
    "ارزان",
    "قیمت",
    "بازار",
    "بازار سرمایه",
    "تجارت",
    "صادرات",
    "واردات",
    "نفت",
    "گاز",
    "پتروشیمی",
    "صنعت",
    "تولید",
    "بودجه",
    "مالیات",
    "یارانه",
    "حقوق کارمندان",
    "حقوق بازنشستگان",
    "بازنشستگی",
    "اشتغال",
    "بیکاری",
    "سرمایه گذاری",
    "سرمایه‌گذاری",
    "مسکن",
    "اجاره",
    "خودرو",
    "خودروسازی",
    "کالا",
    "فروش",
    "خرید",
    "تولیدکننده",
    "تعاون"
  ],

  "اجتماعی": [
    "اجتماعی",
    "جامعه",
    "مردم",
    "خانواده",
    "ازدواج",
    "طلاق",
    "جمعیت",
    "مهاجرت",
    "آسیب اجتماعی",
    "آسیب‌های اجتماعی",
    "اعتیاد",
    "کودک",
    "کودکان",
    "زنان",
    "جوانان",
    "سالمندان",
    "مدرسه",
    "دانش آموز",
    "دانش‌آموز",
    "آموزش و پرورش",
    "وزارت آموزش و پرورش",
    "فرهنگیان",
    "معلم",
    "کنکور",
    "امتحانات",
    "حوادث",
    "حادثه",
    "تصادف",
    "زلزله",
    "سیل",
    "آتش سوزی",
    "آتش‌سوزی",
    "نجات",
    "اورژانس",
    "هلال احمر",
    "جاده",
    "هواشناسی",
    "آلودگی هوا",
    "آب و هوا",
    "تعطیلی",
    "مدارس"
  ],

  "ورزشی": [
    "ورزش",
    "ورزشی",
    "فوتبال",
    "استقلال",
    "پرسپولیس",
    "سپاهان",
    "تراکتور",
    "تیم ملی",
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
    "ورزشگاه",
    "بازیکن",
    "سرمربی",
    "فدراسیون"
  ],

  "فناوری": [
    "فناوری",
    "فناوری اطلاعات",
    "تکنولوژی",
    "هوش مصنوعی",
    "هوش مصنوعی مولد",
    "اینترنت",
    "موبایل",
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
    "اقتصاد دیجیتال",
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

  "فرهنگی و هنری": [
    "فرهنگ",
    "فرهنگی",
    "هنر",
    "هنری",
    "سینما",
    "فیلم",
    "فیلم سینمایی",
    "تلویزیون",
    "سریال",
    "موسیقی",
    "کنسرت",
    "خواننده",
    "بازیگر",
    "کارگردان",
    "نمایش",
    "تئاتر",
    "کتاب",
    "نویسنده",
    "شاعر",
    "شعر",
    "ادبیات",
    "جشنواره",
    "هنرمند",
    "موزه",
    "نگارخانه",
    "میراث فرهنگی",
    "گردشگری",
    "گردشگر",
    "صنایع دستی",
    "میراث تاریخی"
  ],

  "علمی و پزشکی": [
    "علم",
    "علمی",
    "پژوهش",
    "پژوهشی",
    "تحقیق",
    "دانشگاه",
    "دانشجو",
    "استاد دانشگاه",
    "پژوهشگر",
    "دانشمند",
    "کشف علمی",
    "اختراع",
    "نوآوری",
    "پزشکی",
    "پزشک",
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
    "پزشکی هسته‌ای",
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
// تشخیص هوشمند دسته‌بندی
// ============================================================

function detectCategory(title = "", originalCategory = "") {

  const text = normalizePersianText(
    `${title} ${originalCategory}`
  );

  const scores = {};

  for (const category of categoryOrder) {
    scores[category] = 0;
  }

  for (const [category, keywords] of Object.entries(categories)) {

    for (const keyword of keywords) {

      const normalizedKeyword =
        normalizePersianText(keyword);

      if (!normalizedKeyword) continue;

      if (text.includes(normalizedKeyword)) {

        if (normalizedKeyword.length >= 12) {
          scores[category] += 3;
        } else if (normalizedKeyword.length >= 7) {
          scores[category] += 2;
        } else {
          scores[category] += 1;
        }
      }
    }
  }

  // ----------------------------------------------------------
  // اولویت ورزشی
  // ----------------------------------------------------------

  if (
    scores["ورزشی"] > 0 &&
    /فوتبال|استقلال|پرسپولیس|سپاهان|تراکتور|لیگ برتر|تیم ملی|کشتی|والیبال|بسکتبال/
      .test(text)
  ) {
    return "ورزشی";
  }

  // ----------------------------------------------------------
  // اولویت فناوری
  // ----------------------------------------------------------

  if (
    scores["فناوری"] > 0 &&
    /هوش مصنوعی|اینترنت|موبایل|گوشی هوشمند|نرم افزار|نرم‌افزار|کامپیوتر|رایانه|اپلیکیشن|سایبری|ربات|تراشه|پردازنده/
      .test(text)
  ) {
    return "فناوری";
  }

  // ----------------------------------------------------------
  // اولویت علمی و پزشکی
  // ----------------------------------------------------------

  if (
    scores["علمی و پزشکی"] > 0 &&
    /پزشکی|پزشک|بیماری|درمان|سلامت|دارو|بیمارستان|واکسن|پژوهش|دانشگاه|دانشمند|کشف علمی/
      .test(text)
  ) {
    return "علمی و پزشکی";
  }

  // ----------------------------------------------------------
  // اولویت بین‌الملل
  // ----------------------------------------------------------

  if (
    scores["بین‌الملل"] > 0 &&
    /آمریکا|اسرائیل|فلسطین|غزه|حماس|روسیه|اوکراین|ترامپ|پوتین|چین|اروپا|ناتو|جنگ|حمله نظامی|درگیری نظامی/
      .test(text)
  ) {
    return "بین‌الملل";
  }

  // ----------------------------------------------------------
  // انتخاب بر اساس بیشترین امتیاز
  // ----------------------------------------------------------

  let bestCategory = "متفرقه";
  let maxScore = 0;

  for (const category of categoryOrder) {

    if (scores[category] > maxScore) {
      maxScore = scores[category];
      bestCategory = category;
    }
  }

  return maxScore > 0
    ? bestCategory
    : "متفرقه";
}

// ============================================================
// منابع اصلی
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
    name: "صدای آمریکا فارسی",
    url: "https://ir.voanews.com/api/zuiypl-vomx-tpeggtm",
    flag: "🌍"
  },
  {
    name: "اطلاعات",
    url: "https://www.ettelaat.com/rss/tp/62",
    flag: "🇮🇷"
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
];

// ============================================================
// منابع پشتیبان
// ============================================================

const backupSources = [
  {
    name: "رادیو فردا",
    url: "https://www.radiofarda.com/api/zrttpol-vomx-tpeoogpi"
  }
];

// ============================================================
// دریافت RSS با تلاش مجدد
// ============================================================

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

// ============================================================
// دریافت اخبار
// ============================================================

async function getNews() {

  console.log("📰 در حال دریافت اخبار فوری ایران و جهان...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  let allNews = [];
  const failedSources = [];

  // ==========================================================
  // منابع اصلی
  // ==========================================================

  for (const source of sources) {

    try {

      console.log(
        `⏳ ${source.flag} در حال دریافت ${source.name}...`
      );

      const feed =
        await fetchWithRetry(source.url);

      if (!feed.items || feed.items.length === 0) {

        console.log(
          `⚠️ ${source.name} هیچ خبری نداشت`
        );

        failedSources.push(source.name);
        continue;
      }

      let count = 0;

      feed.items.slice(0, 15).forEach(item => {

        if (!item.title || !item.link) return;

        const title = item.title.trim();

        const originalCategory =
          item.category ||
          (Array.isArray(item.categories)
            ? item.categories[0]
            : "") ||
          "";

        const category =
          detectCategory(
            title,
            originalCategory
          );

        allNews.push({
          title: title,
          link: safeLink(item.link),
          date: item.pubDate || item.isoDate || "",
          source: source.name,
          category: category,
          flag: source.flag
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

  // ==========================================================
  // منابع پشتیبان
  // ==========================================================

  console.log("\n🔄 بررسی منابع پشتیبان...");

  for (const backup of backupSources) {

    if (
      failedSources.includes(backup.name) ||
      !sources.find(s => s.name === backup.name)
    ) {

      try {

        console.log(
          `⏳ در حال دریافت ${backup.name} (پشتیبان)...`
        );

        const feed =
          await fetchWithRetry(backup.url);

        if (!feed.items || feed.items.length === 0) {

          console.log(
            `⚠️ ${backup.name} (پشتیبان) هیچ خبری نداشت`
          );

          continue;
        }

        let count = 0;

        feed.items.slice(0, 15).forEach(item => {

          if (!item.title || !item.link) return;

          const title = item.title.trim();

          const originalCategory =
            item.category ||
            (Array.isArray(item.categories)
              ? item.categories[0]
              : "") ||
            "";

          const category =
            detectCategory(
              title,
              originalCategory
            );

          const flag =
            sources.find(
              s => s.name === backup.name
            )?.flag || "🌍";

          allNews.push({
            title: title,
            link: safeLink(item.link),
            date: item.pubDate || item.isoDate || "",
            source: backup.name,
            category: category,
            flag: flag
          });

          count++;
        });

        console.log(
          `✅ ${backup.name} (پشتیبان): ${count} خبر دریافت شد`
        );

        const index =
          failedSources.indexOf(backup.name);

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

  // ==========================================================
  // بررسی نهایی
  // ==========================================================

  if (allNews.length === 0) {

    console.log("⚠️ هیچ خبری دریافت نشد!");
    return;
  }

  // ==========================================================
  // حذف اخبار تکراری
  // ==========================================================

  const seenTitles = new Set();

  allNews = allNews
    .filter(n =>
      n.title &&
      /[\u0600-\u06FF]/.test(n.title)
    )

    .filter(n => {

      const key = normalizePersianText(n.title)
        .replace(/[«»،:؛!?؟،.]/g, "")
        .trim();

      if (seenTitles.has(key)) {
        return false;
      }

      seenTitles.add(key);
      return true;
    })

    // مرتب‌سازی جدیدترین خبرها
    .sort((a, b) => {

      const dateA = new Date(a.date);
      const dateB = new Date(b.date);

      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;

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

  // ابتدا دسته‌ها را طبق ترتیب استاندارد ایجاد می‌کنیم
  for (const category of categoryOrder) {
    categorizedNews[category] = [];
  }

  for (const news of allNews) {

    if (!categorizedNews[news.category]) {
      categorizedNews[news.category] = [];
    }

    categorizedNews[news.category].push(news);
  }

  // دسته‌های خالی حذف شوند
  for (const category of Object.keys(categorizedNews)) {

    if (categorizedNews[category].length === 0) {
      delete categorizedNews[category];
    }
  }

  const activeCategories =
    categoryOrder.filter(
      category =>
        categorizedNews[category] &&
        categorizedNews[category].length > 0
    );

  // ==========================================================
  // ساخت news.json
  // ==========================================================

  const jsonData = {

    lastUpdate:
      new Date().toISOString(),

    lastUpdatePersian:
      new Date().toLocaleString(
        "fa-IR",
        {
          timeZone: "Asia/Tehran"
        }
      ),

    totalNews:
      allNews.length,

    failedSources:
      failedSources,

    categories:
      activeCategories,

    news:
      allNews,

    categorizedNews:
      categorizedNews
  };

  fs.writeFileSync(
    "news.json",
    JSON.stringify(jsonData, null, 2),
    "utf8"
  );

  console.log(
    `✅ news.json با ${allNews.length} خبر ذخیره شد`
  );

  console.log(
    `🗂 دسته‌های فعال: ${activeCategories.join(" | ")}`
  );

  // ==========================================================
  // ساخت index.html
  // ==========================================================

  const updateTime =
    new Date().toLocaleString(
      "fa-IR",
      {
        timeZone: "Asia/Tehran"
      }
    );

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
  box-sizing:border-box;
}

body{
  font-family:tahoma;
  background:#f0f2f5;
  padding:10px;
}

.box{
  max-width:900px;
  margin:auto;
}

.header{
  background:#b30000;
  color:white;
  padding:15px;
  border-radius:12px;
  font-size:20px;
  font-weight:bold;
  text-align:center;
}

.category-tabs{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin:15px 0;
  justify-content:center;
}

.category-tab{
  background:#eee;
  padding:8px 16px;
  border-radius:20px;
  cursor:pointer;
  font-size:13px;
  transition:all 0.3s;
  border:none;
}

.category-tab:hover{
  background:#ddd;
}

.category-tab.active{
  background:#b30000;
  color:white;
}

.category-section{
  margin-top:15px;
}

.category-title{
  background:#b30000;
  color:white;
  padding:10px 15px;
  border-radius:8px;
  font-size:16px;
  font-weight:bold;
  margin-bottom:10px;
}

.card{
  background:white;
  margin-top:8px;
  padding:12px 15px;
  border-radius:8px;
  box-shadow:0 1px 4px rgba(0,0,0,0.1);
  transition:transform 0.2s;
}

.card:hover{
  transform:scale(1.01);
}

.card .title{
  font-weight:bold;
  font-size:15px;
  line-height:1.6;
}

.card .title a{
  color:#222;
  text-decoration:none;
}

.card .title a:hover{
  color:#b30000;
}

.card .meta{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-top:6px;
  font-size:12px;
  flex-wrap:wrap;
  gap:5px;
}

.card .source{
  color:#b30000;
}

.card .date{
  color:#888;
}

.footer{
  text-align:center;
  color:#888;
  margin:20px 0;
  font-size:13px;
}

.count-badge{
  display:inline-block;
  background:#fff;
  color:#b30000;
  padding:2px 12px;
  border-radius:20px;
  font-size:14px;
  margin-right:10px;
}

.flag-badge{
  font-size:14px;
  margin-right:5px;
}

@media(max-width:600px){

  .card{
    padding:10px;
  }

  .card .title{
    font-size:13px;
  }

}

</style>

</head>

<body>

<div class="box">

<div class="header">

<div style="font-size:24px;font-weight:bold;">
📰 دیار قدمگاه | اخبار فوری ایران
</div>

<div style="font-size:13px;margin-top:8px;opacity:.95">
آخرین بروزرسانی: ${escapeHtml(updateTime)}
</div>

<div style="
display:flex;
justify-content:center;
gap:10px;
flex-wrap:wrap;
margin-top:12px;
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

${activeCategories.map(cat => `
<button
class="category-tab"
onclick="filterCategory('${escapeHtml(cat)}')">
${categoryEmojis[cat] || "📌"} ${escapeHtml(cat)}
</button>
`).join("")}

</div>

<div id="news-container">
`;

  // ==========================================================
  // نمایش دسته‌ها با ترتیب استاندارد
  // ==========================================================

  for (const category of activeCategories) {

    const newsList =
      categorizedNews[category];

    const emoji =
      categoryEmojis[category] || "📌";

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

    for (const news of newsList) {

      const newsDate =
        news.date
          ? new Date(news.date)
          : null;

      const dateDisplay =
        newsDate &&
        !isNaN(newsDate.getTime())

          ? newsDate.toLocaleString(
              "fa-IR",
              {
                timeZone: "Asia/Tehran"
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
    ? `<span class="date">
       🕐 ${escapeHtml(dateDisplay)}
       </span>`
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
${escapeHtml(updateTime)}

<br>

${
  failedSources.length
    ? `⚠️ منابع ناموفق: ${escapeHtml(
        failedSources.join("، ")
      )}`
    : "✅ همه منابع فعال هستند"
}

</div>

</div>

<script>

function filterCategory(category){

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
      ){

        tab.classList.add("active");

      }

    });

  document
    .querySelectorAll(".category-section")
    .forEach(section => {

      if (
        category === "all" ||
        section.dataset.category === category
      ){

        section.style.display = "block";

      } else {

        section.style.display = "none";

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
  // ساخت news.html
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
  // ساخت news-ticker.html
  // ==========================================================

  const tickerHtml = `<!DOCTYPE html>

<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

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

  animation:tickerScroll 90s linear infinite;

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

  background:rgba(255,255,255,0.2);

  padding:2px 10px;

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

${allNews.map(n => {

  return `
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
`;

}).join("")}

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
  // حفظ news-ticker.html موجود
  // ==========================================================

  if (!fs.existsSync("news-ticker.html")) {

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
  // پایان
  // ==========================================================

  console.log("\n🎉 عملیات با موفقیت کامل شد!");

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );

  console.log(
    "🗂 دسته‌بندی استاندارد:"
  );

  activeCategories.forEach(category => {

    console.log(
      `${categoryEmojis[category] || "📌"} ${category}: ${
        categorizedNews[category].length
      } خبر`
    );

  });

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
}

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

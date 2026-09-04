const fs = require("fs");
const Parser = require("rss-parser");

/* =========================================================
   تنظیمات اصلی
========================================================= */

const NEWS_LIMIT = 100;
const ITEMS_PER_SOURCE = 15;

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  },
  timeout: 15000
});


/* =========================================================
   منابع خبری
========================================================= */

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
];


/* =========================================================
   منابع پشتیبان
========================================================= */

const backupSources = [];


/* =========================================================
   دسته‌ها
========================================================= */

const CATEGORY_ORDER = [
  "سیاسی",
  "اقتصادی",
  "ورزشی",
  "فرهنگی و هنری",
  "اجتماعی",
  "علمی و فناوری",
  "بین‌الملل",
  "متفرقه"
];

const categoryEmojis = {
  "سیاسی": "🏛️",
  "اقتصادی": "💰",
  "ورزشی": "⚽",
  "فرهنگی و هنری": "🎭",
  "اجتماعی": "👥",
  "علمی و فناوری": "🔬",
  "بین‌الملل": "🌍",
  "متفرقه": "📌"
};


/* =========================================================
   ابزارهای متنی
========================================================= */

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ۀ/g, "ه")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/إ/g, "ا")
    .replace(/أ/g, "ا")
    .replace(/‌/g, " ")
    .replace(/\u200c/g, " ")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


function hasPhrase(text, phrase) {
  return text.includes(normalizeText(phrase));
}


function hasAny(text, phrases) {
  return phrases.some((phrase) => hasPhrase(text, phrase));
}


function countMatches(text, phrases) {
  let count = 0;

  for (const phrase of phrases) {
    if (hasPhrase(text, phrase)) {
      count++;
    }
  }

  return count;
}


function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function safeLink(url) {
  try {
    const parsed = new URL(url);

    if (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    ) {
      return parsed.href;
    }

    return "#";
  } catch {
    return "#";
  }
}


/* =========================================================
   واژه‌های تخصصی دسته‌ها
========================================================= */

/* -------------------------
   ورزش
------------------------- */

const sportsStrong = [
  "فوتبال",
  "فوتسال",
  "والیبال",
  "بسکتبال",
  "تنیس",
  "کشتی",
  "تکواندو",
  "جودو",
  "بوکس",
  "دوومیدانی",
  "شنا",
  "ژیمناستیک",
  "وزنه برداری",
  "کاراته",
  "قایقرانی",
  "دوچرخه سواری",
  "پینگ پنگ",
  "تنیس روی میز",
  "المپیک",
  "پارالمپیک",
  "جام جهانی",
  "لیگ برتر",
  "لیگ قهرمانان",
  "لیگ قهرمانان اروپا",
  "لیگ قهرمانان آسیا",
  "لیگ اروپا",
  "جام ملت ها",
  "جام حذفی",
  "باشگاه",
  "استادیوم",
  "ورزشگاه",
  "فدراسیون فوتبال",
  "فدراسیون",
  "بازیکن",
  "سرمربی",
  "مربی",
  "داور",
  "دروازه بان",
  "مهاجم",
  "مدافع",
  "هافبک",
  "گلزن",
  "گلزنی",
  "دربی",
  "پنالتی",
  "کارت قرمز",
  "کارت زرد",
  "قهرمان",
  "قهرمانی",
  "مدال",
  "مسابقات ورزشی",
  "مسابقه ورزشی",
  "ورزشکار",
  "تیم ملی",
  "تیم فوتبال",
  "رئال مادرید",
  "بارسلونا",
  "منچستریونایتد",
  "منچستر سیتی",
  "لیورپول",
  "آرسنال",
  "چلسی",
  "بایرن مونیخ",
  "پاری سن ژرمن",
  "اینتر",
  "میلان",
  "یوونتوس",
  "الهلال",
  "پرسپولیس",
  "استقلال",
  "سپاهان",
  "تراکتور",
  "ذوب آهن",
  "ملوان",
  "نساجی",
  "فولاد",
  "گل گهر",
  "النصر",
  "طارمی",
  "رونالدو",
  "مسی",
  "امباپه",
  "ژاوی",
  "گواردیولا",
  "مورینیو"
];

const sportsContext = [
  "گل",
  "پیروزی",
  "شکست",
  "مساوی",
  "نتیجه",
  "رقابت",
  "دیدار",
  "بازی",
  "مسابقه",
  "قهرمان",
  "نایب قهرمان",
  "صعود",
  "حذف",
  "جدول",
  "امتیاز",
  "نقل و انتقالات",
  "اردوی تیم",
  "تمرین",
  "ترکیب",
  "کاپیتان",
  "مصدوم",
  "مصدومیت"
];


/* -------------------------
   بین‌الملل
------------------------- */

const internationalStrong = [
  "اسرائیل",
  "رژیم صهیونیستی",
  "رژیم اشغالگر",
  "تل آویو",
  "لبنان",
  "حزب الله",
  "حماس",
  "فلسطین",
  "غزه",
  "کرانه باختری",
  "رفح",
  "اوکراین",
  "روسیه",
  "پوتین",
  "مسکو",
  "کی یف",
  "ناتو",
  "آمریکا",
  "ایالات متحده",
  "ترامپ",
  "بایدن",
  "واشنگتن",
  "کاخ سفید",
  "پنتاگون",
  "فرانسه",
  "مکرون",
  "انگلیس",
  "بریتانیا",
  "لندن",
  "آلمان",
  "برلین",
  "چین",
  "پکن",
  "ژاپن",
  "هند",
  "پاکستان",
  "افغانستان",
  "عراق",
  "سوریه",
  "یمن",
  "عربستان",
  "امارات",
  "قطر",
  "ترکیه",
  "اردن",
  "مصر",
  "لیبی",
  "اندونزی",
  "کره جنوبی",
  "کره شمالی",
  "اتحادیه اروپا",
  "اروپا",
  "سازمان ملل",
  "شورای امنیت",
  "آژانس بین المللی انرژی اتمی",
  "آژانس بین المللی",
  "کرملین",
  "باب المندب",
  "تنگه هرمز",
  "دریای سرخ",
  "مدیترانه",
  "نخست وزیر اسرائیل",
  "رئیس جمهور آمریکا",
  "وزیر خارجه آمریکا",
  "وزیر خارجه روسیه",
  "رهبر حزب الله",
  "نیروهای مسلح یمن",
  "حملات اسرائیل",
  "حملات رژیم صهیونیستی",
  "جنگ اوکراین",
  "جنگ غزه"
];

const internationalContext = [
  "حمله",
  "حملات",
  "جنگ",
  "درگیری",
  "آتش بس",
  "موشک",
  "پهپاد",
  "انفجار",
  "تحریم",
  "مذاکره",
  "مقامات خارجی",
  "دیپلمات",
  "سفیر",
  "روابط خارجی",
  "تنش",
  "بحران",
  "نظامی",
  "ارتش",
  "نیروهای نظامی",
  "عملیات نظامی",
  "حمله هوایی",
  "حملات هوایی",
  "آتش بس",
  "مذاکرات",
  "اجلاس",
  "نشست بین المللی"
];


/* -------------------------
   سیاسی داخلی
------------------------- */

const politicalStrong = [
  "رئیس جمهور ایران",
  "رئیس جمهور",
  "مسعود پزشکیان",
  "دولت",
  "هیئت دولت",
  "کابینه",
  "مجلس شورای اسلامی",
  "مجلس",
  "نماینده مجلس",
  "نمایندگان مجلس",
  "وزیر",
  "وزارت",
  "سخنگوی دولت",
  "استاندار",
  "فرماندار",
  "انتخابات",
  "انتخاباتی",
  "رأی گیری",
  "شورای نگهبان",
  "قوه قضائیه",
  "قوه مجریه",
  "قوه مقننه",
  "رهبری",
  "رهبر انقلاب",
  "سپاه پاسداران",
  "سپاه",
  "ارتش جمهوری اسلامی",
  "فراجا",
  "نیروهای مسلح ایران",
  "شورای عالی امنیت ملی",
  "سیاست داخلی",
  "سیاست خارجی ایران",
  "سخنگوی وزارت",
  "استیضاح",
  "طرح استیضاح",
  "استعفا",
  "انتصاب",
  "برکناری",
  "قانون",
  "لایحه",
  "طرح مجلس",
  "بودجه کشور",
  "برجام",
  "مذاکرات هسته ای",
  "پرونده هسته ای ایران",
  "غنی سازی",
  "تحریم های ایران",
  "مذاکره ایران و آمریکا",
  "مذاکرات ایران و آمریکا"
];

const politicalContext = [
  "موضع",
  "هشدار",
  "بیانیه",
  "سخنگو",
  "مقام مسئول",
  "مسئولان",
  "دولت",
  "مجلس",
  "وزیر",
  "نماینده",
  "امنیت ملی",
  "دفاع",
  "دیپلماسی",
  "سیاسی",
  "سیاست",
  "مقام ایرانی",
  "مقامات ایرانی"
];


/* -------------------------
   اقتصادی
------------------------- */

const economicStrong = [
  "دلار",
  "یورو",
  "طلا",
  "سکه",
  "بورس",
  "شاخص بورس",
  "بازار سرمایه",
  "بازار ارز",
  "قیمت ارز",
  "نرخ ارز",
  "تورم",
  "گرانی",
  "ارزان شد",
  "گران شد",
  "قیمت",
  "قیمت ها",
  "اقتصاد",
  "اقتصادی",
  "بانک",
  "بانک مرکزی",
  "نرخ سود",
  "تسهیلات",
  "وام",
  "مالیات",
  "یارانه",
  "بودجه",
  "درآمد",
  "صادرات",
  "واردات",
  "تولید",
  "تولیدکننده",
  "کارخانه",
  "صنعت",
  "صنایع",
  "نفت",
  "گاز",
  "پتروشیمی",
  "بنزین",
  "سوخت",
  "خودرو",
  "خودروساز",
  "خودروسازی",
  "مسکن",
  "اجاره",
  "خانه",
  "ملک",
  "ساخت و ساز",
  "اشتغال",
  "بیکاری",
  "حقوق",
  "دستمزد",
  "معیشت",
  "کالا",
  "مواد غذایی",
  "لوازم خانگی",
  "فروش",
  "خرید",
  "سرمایه گذاری",
  "سرمایه گذاری",
  "بازار",
  "کشاورزی",
  "محصولات کشاورزی",
  "نفتی",
  "ارزش پول"
];

const economicContext = [
  "افزایش قیمت",
  "کاهش قیمت",
  "رشد قیمت",
  "افت قیمت",
  "رشد تولید",
  "جهش تولید",
  "بازار",
  "سرمایه",
  "تجارت",
  "تولید ملی",
  "فعالان اقتصادی",
  "فعالیت اقتصادی",
  "شرکت",
  "شرکت ها",
  "تولیدکنندگان",
  "مصرف کننده",
  "مصرف کنندگان"
];


/* -------------------------
   اجتماعی
------------------------- */

const socialStrong = [
  "تصادف",
  "سانحه",
  "حادثه",
  "حوادث",
  "واژگونی",
  "برخورد خودرو",
  "تصادف جاده ای",
  "آتش سوزی",
  "حریق",
  "آتش سوزی گسترده",
  "انفجار در",
  "فوت",
  "جان باخت",
  "جان باختند",
  "کشته",
  "کشته شد",
  "زخمی",
  "مصدوم",
  "مصدومان",
  "اورژانس",
  "بیمارستان",
  "درمان",
  "درمانی",
  "سلامت",
  "پزشکی",
  "بیمار",
  "خون",
  "فرآورده های خون",
  "مدرسه",
  "دانش آموز",
  "دانش آموزان",
  "دانشگاه",
  "دانشجو",
  "دانشجویان",
  "معلم",
  "آموزش و پرورش",
  "جمعیت",
  "خانواده",
  "کودک",
  "کودکان",
  "زنان",
  "معلولان",
  "سالمندان",
  "سرقت",
  "دزدی",
  "قاتل",
  "قتل",
  "بازداشت",
  "دستگیری",
  "مفقود",
  "گمشدن",
  "جاده",
  "راه ها",
  "ترافیک",
  "آلودگی هوا",
  "آلودگی",
  "زلزله",
  "سیل",
  "بارندگی",
  "طوفان",
  "گرد و غبار",
  "خشکسالی",
  "هواشناسی",
  "محیط زیست",
  "ادارات",
  "تعطیلی مدارس",
  "تعطیلی ادارات"
];

const socialContext = [
  "مردم",
  "شهروندان",
  "شهروند",
  "خدمات عمومی",
  "استان",
  "شهرستان",
  "روستا",
  "مراکز درمانی",
  "مدارس",
  "دانشگاه ها",
  "جامعه",
  "اجتماعی",
  "رفاه",
  "آسیب اجتماعی",
  "خانوار"
];


/* -------------------------
   فرهنگی و هنری
------------------------- */

const culturalStrong = [
  "سینما",
  "فیلم",
  "فیلم سینمایی",
  "سریال",
  "بازیگر",
  "بازیگران",
  "کارگردان",
  "تهیه کننده",
  "موسیقی",
  "خواننده",
  "ترانه",
  "کنسرت",
  "تئاتر",
  "نمایش",
  "نمایشگاه هنری",
  "هنر",
  "هنرمند",
  "کتاب",
  "کتابخوانی",
  "نویسنده",
  "نویسندگان",
  "شاعر",
  "شعر",
  "ادبیات",
  "میراث فرهنگی",
  "صنایع دستی",
  "صنایع دستی",
  "موزه",
  "باستان شناسی",
  "آثار تاریخی",
  "بنای تاریخی",
  "جشنواره",
  "جشنواره فرهنگی",
  "جشنواره هنری",
  "فرهنگ",
  "فرهنگی",
  "تلویزیون",
  "برنامه تلویزیونی",
  "برنامه کودک",
  "کاراکتر",
  "انیمیشن",
  "سینمای ایران",
  "موسیقی ایرانی",
  "فرهنگ و هنر",
  "رواق",
  "شعرخوانی",
  "نقاشی",
  "مجسمه سازی",
  "نگارخانه"
];

const culturalContext = [
  "آیین",
  "جشن",
  "آثار هنری",
  "هنری",
  "فرهنگی",
  "هنرمندان",
  "اهالی فرهنگ",
  "اهالی هنر",
  "اثر هنری",
  "نمایش",
  "رونمایی",
  "اکران",
  "انتشار کتاب"
];


/* -------------------------
   علمی و فناوری
------------------------- */

const scienceStrong = [
  "هوش مصنوعی",
  "فناوری",
  "تکنولوژی",
  "اینترنت",
  "نرم افزار",
  "سخت افزار",
  "کامپیوتر",
  "رایانه",
  "موبایل",
  "گوشی هوشمند",
  "تلفن همراه",
  "اپلیکیشن",
  "برنامه کاربردی",
  "ربات",
  "رباتیک",
  "تراشه",
  "پردازنده",
  "چیپ",
  "ماهواره",
  "فضا",
  "فضاپیما",
  "فضانورد",
  "نجوم",
  "ستاره شناسی",
  "سیاره",
  "کهکشان",
  "تلسکوپ",
  "ناسا",
  "ژنتیک",
  "ژن",
  "زیست فناوری",
  "زیست فناوری",
  "پژوهش",
  "محققان",
  "دانشمندان",
  "آزمایشگاه",
  "کشف علمی",
  "پیشرفت علمی",
  "علم و فناوری",
  "امنیت سایبری",
  "هک",
  "هکر",
  "رمزنگاری",
  "داده",
  "داده های بزرگ",
  "الگوریتم",
  "یادگیری ماشین",
  "ماشین لرنینگ",
  "پردازش زبان طبیعی",
  "شبکه",
  "شبکه های اجتماعی",
  "5g",
  "هوش مصنوعی مولد"
];

const scienceContext = [
  "علم",
  "علمی",
  "فناوری",
  "تحقیقات",
  "تحقیق",
  "پژوهشگر",
  "پژوهشگران",
  "دانشگاه",
  "دانش بنیان",
  "استارتاپ",
  "نوآوری",
  "اختراع",
  "دستگاه",
  "سامانه",
  "سامانه هوشمند"
];


/* =========================================================
   تشخیص دسته
========================================================= */

function detectCategory(title) {
  const text = normalizeText(title);

  if (!text) {
    return "متفرقه";
  }


  /* =======================================================
     امتیازدهی
  ======================================================= */

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


  /* =======================================================
     ورزش
  ======================================================= */

  const sportsStrongCount = countMatches(text, sportsStrong);
  const sportsContextCount = countMatches(text, sportsContext);

  scores["ورزشی"] += sportsStrongCount * 7;
  scores["ورزشی"] += sportsContextCount * 2;

  if (
    sportsStrongCount > 0 &&
    sportsContextCount > 0
  ) {
    scores["ورزشی"] += 12;
  }


  /* =======================================================
     بین‌الملل
  ======================================================= */

  const internationalStrongCount =
    countMatches(text, internationalStrong);

  const internationalContextCount =
    countMatches(text, internationalContext);

  scores["بین‌الملل"] += internationalStrongCount * 6;
  scores["بین‌الملل"] += internationalContextCount * 2;


  /*
     اگر یک نام یا موضوع خارجی با موضوع نظامی/سیاسی
     همراه باشد، احتمال بین‌الملل بسیار بالاست.
  */

  if (
    internationalStrongCount >= 1 &&
    internationalContextCount >= 1
  ) {
    scores["بین‌الملل"] += 15;
  }

  if (internationalStrongCount >= 2) {
    scores["بین‌الملل"] += 10;
  }


  /* =======================================================
     سیاسی
  ======================================================= */

  const politicalStrongCount =
    countMatches(text, politicalStrong);

  const politicalContextCount =
    countMatches(text, politicalContext);

  scores["سیاسی"] += politicalStrongCount * 6;
  scores["سیاسی"] += politicalContextCount * 2;

  if (
    politicalStrongCount >= 1 &&
    politicalContextCount >= 1
  ) {
    scores["سیاسی"] += 10;
  }


  /*
     نکته مهم:

     خبر خارجی نباید فقط به دلیل وجود کلماتی مثل:
     جنگ، موشک، حمله، دفاع و...
     سیاسی داخلی شود.

     بنابراین اگر نشانه خارجی وجود داشته باشد،
     امتیاز بین‌الملل تقویت می‌شود.
  */

  if (
    internationalStrongCount >= 1 &&
    (
      hasAny(text, [
        "جنگ",
        "حمله",
        "حملات",
        "موشک",
        "پهپاد",
        "درگیری",
        "انفجار",
        "تحریم",
        "مذاکره",
        "آتش بس"
      ])
    )
  ) {
    scores["بین‌الملل"] += 20;
  }


  /* =======================================================
     اقتصاد
  ======================================================= */

  const economicStrongCount =
    countMatches(text, economicStrong);

  const economicContextCount =
    countMatches(text, economicContext);

  scores["اقتصادی"] += economicStrongCount * 5;
  scores["اقتصادی"] += economicContextCount * 2;

  if (
    economicStrongCount >= 1 &&
    economicContextCount >= 1
  ) {
    scores["اقتصادی"] += 10;
  }


  /* =======================================================
     اجتماعی
  ======================================================= */

  const socialStrongCount =
    countMatches(text, socialStrong);

  const socialContextCount =
    countMatches(text, socialContext);

  scores["اجتماعی"] += socialStrongCount * 5;
  scores["اجتماعی"] += socialContextCount * 2;

  if (
    socialStrongCount >= 1 &&
    socialContextCount >= 1
  ) {
    scores["اجتماعی"] += 8;
  }


  /* =======================================================
     فرهنگی
  ======================================================= */

  const culturalStrongCount =
    countMatches(text, culturalStrong);

  const culturalContextCount =
    countMatches(text, culturalContext);

  scores["فرهنگی و هنری"] += culturalStrongCount * 6;
  scores["فرهنگی و هنری"] += culturalContextCount * 2;

  if (
    culturalStrongCount >= 1 &&
    culturalContextCount >= 1
  ) {
    scores["فرهنگی و هنری"] += 10;
  }


  /* =======================================================
     علمی و فناوری
  ======================================================= */

  const scienceStrongCount =
    countMatches(text, scienceStrong);

  const scienceContextCount =
    countMatches(text, scienceContext);

  scores["علمی و فناوری"] += scienceStrongCount * 6;
  scores["علمی و فناوری"] += scienceContextCount * 2;

  if (
    scienceStrongCount >= 1 &&
    scienceContextCount >= 1
  ) {
    scores["علمی و فناوری"] += 10;
  }


  /* =======================================================
     اصلاحات ویژه
  ======================================================= */


  /*
     ۱. استقلال به تنهایی سیاسی یا ورزشی نیست.
     اگر استقلال در زمینه باشگاه/فوتبال باشد ورزشی است.
  */

  if (
    hasPhrase(text, "استقلال") &&
    hasAny(text, [
      "فوتبال",
      "باشگاه",
      "لیگ",
      "بازیکن",
      "سرمربی",
      "مربی",
      "گل",
      "مسابقه",
      "دربی",
      "ورزشگاه"
    ])
  ) {
    scores["ورزشی"] += 25;
  }


  /*
     ۲. گل به تنهایی نباید حتماً ورزشی باشد.
  */

  if (
    hasPhrase(text, "گل") &&
    !hasAny(text, [
      "فوتبال",
      "فوتسال",
      "بازیکن",
      "سرمربی",
      "دروازه",
      "لیگ",
      "مسابقه",
      "باشگاه",
      "ورزشگاه"
    ])
  ) {
    scores["ورزشی"] -= 8;
  }


  /*
     ۳. دانشگاه و دانشجو می‌توانند اجتماعی یا علمی باشند.
     اگر فناوری/پژوهش وجود داشته باشد علمی برنده شود.
  */

  if (
    hasAny(text, [
      "دانشگاه",
      "دانشجو",
      "دانشجویان"
    ]) &&
    hasAny(text, [
      "پژوهش",
      "محقق",
      "تحقیقات",
      "فناوری",
      "هوش مصنوعی",
      "آزمایشگاه",
      "دانش بنیان"
    ])
  ) {
    scores["علمی و فناوری"] += 15;
  }


  /*
     ۴. قیمت و بازار اگر در حوزه خودرو، طلا، ارز و...
     باشد اقتصادی است.
  */

  if (
    hasAny(text, [
      "دلار",
      "یورو",
      "طلا",
      "سکه",
      "بورس",
      "قیمت خودرو",
      "قیمت مسکن",
      "قیمت کالا",
      "بازار ارز"
    ])
  ) {
    scores["اقتصادی"] += 20;
  }


  /*
     ۵. صنایع دستی و موزه به صورت پیش‌فرض فرهنگی هستند.
  */

  if (
    hasAny(text, [
      "صنایع دستی",
      "موزه",
      "میراث فرهنگی",
      "باستان شناسی",
      "آثار تاریخی"
    ])
  ) {
    scores["فرهنگی و هنری"] += 20;
  }


  /*
     ۶. حوادث و آتش‌سوزی داخلی اجتماعی هستند.
     اگر همراه با کشور خارجی باشد بین‌الملل برتری می‌گیرد.
  */

  if (
    hasAny(text, [
      "تصادف",
      "واژگونی",
      "آتش سوزی",
      "حریق",
      "زلزله",
      "سیل"
    ])
  ) {
    scores["اجتماعی"] += 12;
  }


  /*
     ۷. اگر خبر خارجی به وضوح درباره یک کشور خارجی باشد،
     بین‌الملل اولویت پیدا کند.
  */

  if (
    internationalStrongCount >= 2
  ) {
    scores["بین‌الملل"] += 25;
  }


  /*
     ۸. ترامپ، پوتین، نتانیاهو و رهبران خارجی
     در صورت نبود موضوع داخلی، بین‌الملل هستند.
  */

  if (
    hasAny(text, [
      "ترامپ",
      "پوتین",
      "نتانیاهو",
      "مکرون",
      "زلنسکی",
      "بایدن"
    ])
  ) {
    scores["بین‌الملل"] += 30;
  }


  /*
     ۹. خبرهای مربوط به آمریکا و اسرائیل،
     حتی اگر واژه سیاسی داشته باشند، بین‌الملل محسوب شوند.
  */

  if (
    hasAny(text, [
      "آمریکا",
      "اسرائیل",
      "رژیم صهیونیستی",
      "لبنان",
      "اوکراین",
      "روسیه",
      "غزه",
      "فلسطین",
      "یمن",
      "سوریه"
    ])
  ) {
    scores["بین‌الملل"] += 18;
  }


  /*
     ۱۰. اگر موضوع مشخصاً داخلی باشد،
     سیاسی داخلی امتیاز بیشتری بگیرد.
  */

  if (
    hasAny(text, [
      "مجلس",
      "نماینده مجلس",
      "دولت",
      "وزیر",
      "استاندار",
      "فرماندار",
      "شورای نگهبان",
      "انتخابات",
      "استیضاح"
    ]) &&
    !hasAny(text, [
      "آمریکا",
      "اسرائیل",
      "اوکراین",
      "روسیه",
      "ترامپ",
      "لبنان",
      "غزه",
      "فلسطین",
      "یمن",
      "ناتو"
    ])
  ) {
    scores["سیاسی"] += 20;
  }


  /* =======================================================
     انتخاب دسته نهایی
  ======================================================= */

  let bestCategory = "متفرقه";
  let bestScore = 0;

  for (const category of CATEGORY_ORDER) {
    if (category === "متفرقه") continue;

    if (scores[category] > bestScore) {
      bestScore = scores[category];
      bestCategory = category;
    }
  }


  /*
     اگر امتیاز بسیار پایین باشد،
     خبر واقعاً نامشخص است.
  */

  if (bestScore < 5) {
    return "متفرقه";
  }


  /*
     اگر بین‌الملل و سیاسی نزدیک باشند و نشانه خارجی
     وجود داشته باشد، بین‌الملل انتخاب شود.
  */

  if (
    scores["بین‌الملل"] >= 12 &&
    scores["بین‌الملل"] >= scores["سیاسی"] - 5 &&
    internationalStrongCount >= 1
  ) {
    bestCategory = "بین‌الملل";
  }


  /*
     ورزش در صورت وجود نشانه بسیار قوی ورزشی
     اولویت خودش را حفظ کند.
  */

  if (
    sportsStrongCount >= 2 &&
    scores["ورزشی"] >= 15
  ) {
    bestCategory = "ورزشی";
  }


  /*
     فرهنگی/هنری با کلیدواژه‌های بسیار اختصاصی
  */

  if (
    culturalStrongCount >= 2 &&
    scores["فرهنگی و هنری"] >= 15
  ) {
    bestCategory = "فرهنگی و هنری";
  }


  /*
     علمی با کلیدواژه‌های بسیار اختصاصی
  */

  if (
    scienceStrongCount >= 2 &&
    scores["علمی و فناوری"] >= 15
  ) {
    bestCategory = "علمی و فناوری";
  }


  return bestCategory;
}


/* =========================================================
   دریافت RSS با تلاش مجدد
========================================================= */

async function fetchWithRetry(url, retries = 2) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      console.log(`📡 دریافت RSS: ${url} | تلاش ${attempt}`);

      const feed = await parser.parseURL(url);

      if (!feed || !Array.isArray(feed.items)) {
        throw new Error("RSS items معتبر نیست");
      }

      return feed;

    } catch (error) {
      lastError = error;

      console.log(
        `⚠️ خطا در دریافت RSS: ${url} | ${error.message}`
      );

      if (attempt <= retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * attempt)
        );
      }
    }
  }

  throw lastError || new Error("خطای نامشخص");
}


/* =========================================================
   تشخیص فارسی بودن خبر
========================================================= */

function isPersianNews(title) {
  const text = String(title || "");

  return /[\u0600-\u06FF]/.test(text);
}


/* =========================================================
   تاریخ
========================================================= */

function getNewsDate(item) {
  return (
    item.pubDate ||
    item.isoDate ||
    item.date ||
    ""
  );
}


/* =========================================================
   تبدیل تاریخ میلادی به شمسی
========================================================= */

function toPersianDate(date) {
  try {
    const d = new Date(date);

    if (isNaN(d.getTime())) {
      return "";
    }

    const formatter = new Intl.DateTimeFormat(
      "fa-IR-u-ca-persian",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }
    );

    return formatter.format(d);

  } catch {
    return "";
  }
}


/* =========================================================
   اجرای اصلی
========================================================= */

async function main() {

  console.log("========================================");
  console.log("🇮🇷 شروع دریافت اخبار دیار قدمگاه");
  console.log("========================================");


  let allNews = [];
  const failedSources = [];
  const successfulSources = [];


  /* =======================================================
     دریافت منابع اصلی
  ======================================================= */

  for (const source of sources) {

    try {

      const feed = await fetchWithRetry(
        source.url,
        2
      );

      const items = feed.items
        .slice(0, ITEMS_PER_SOURCE);


      let addedFromSource = 0;


      for (const item of items) {

        const title =
          String(item.title || "").trim();

        const link =
          safeLink(item.link || item.guid || "");

        const date =
          getNewsDate(item);


        if (!title || link === "#") {
          continue;
        }


        if (!isPersianNews(title)) {
          continue;
        }


        allNews.push({
          title,
          link,
          date,
          datePersian: toPersianDate(date),
          source: source.name,
          flag: source.flag
        });


        addedFromSource++;
      }


      if (addedFromSource > 0) {
        successfulSources.push(source.name);
      }


      console.log(
        `✅ ${source.name}: ${addedFromSource} خبر`
      );


    } catch (error) {

      failedSources.push(source.name);

      console.log(
        `❌ ${source.name}: ${error.message}`
      );
    }
  }


  /* =======================================================
     منابع پشتیبان
  ======================================================= */

  for (const source of backupSources) {

    try {

      const feed = await fetchWithRetry(
        source.url,
        2
      );

      const items =
        feed.items.slice(0, ITEMS_PER_SOURCE);


      let addedFromSource = 0;


      for (const item of items) {

        const title =
          String(item.title || "").trim();

        const link =
          safeLink(item.link || item.guid || "");

        const date =
          getNewsDate(item);


        if (!title || link === "#") {
          continue;
        }


        if (!isPersianNews(title)) {
          continue;
        }


        allNews.push({
          title,
          link,
          date,
          datePersian: toPersianDate(date),
          source: source.name,
          flag: source.flag
        });


        addedFromSource++;
      }


      if (addedFromSource > 0) {
        successfulSources.push(source.name);
      }


      console.log(
        `🔄 ${source.name}: ${addedFromSource} خبر`
      );


    } catch (error) {

      failedSources.push(source.name);

      console.log(
        `⚠️ منبع پشتیبان ${source.name}: ${error.message}`
      );
    }
  }


  /* =======================================================
     حذف اخبار تکراری
  ======================================================= */

  const uniqueNews = [];
  const seenTitles = new Set();


  for (const item of allNews) {

    const normalizedTitle =
      normalizeText(item.title);


    if (!normalizedTitle) {
      continue;
    }


    if (seenTitles.has(normalizedTitle)) {
      continue;
    }


    seenTitles.add(normalizedTitle);

    uniqueNews.push(item);
  }


  allNews = uniqueNews;


  /* =======================================================
     مرتب‌سازی بر اساس تاریخ
  ======================================================= */

  allNews.sort((a, b) => {

    const dateA =
      new Date(a.date || 0).getTime();

    const dateB =
      new Date(b.date || 0).getTime();

    return dateB - dateA;
  });


  /* =======================================================
     محدود کردن به 100 خبر
  ======================================================= */

  allNews =
    allNews.slice(0, NEWS_LIMIT);


  /* =======================================================
     دسته‌بندی
  ======================================================= */

  const categorizedNews = {};

  for (const category of CATEGORY_ORDER) {
    categorizedNews[category] = [];
  }


  for (const item of allNews) {

    const category =
      detectCategory(item.title);


    item.category = category;


    categorizedNews[category].push(item);
  }


  /* =======================================================
     آمار دسته‌بندی
  ======================================================= */

  console.log("");
  console.log("========================================");
  console.log("📊 آمار دسته‌بندی اخبار");
  console.log("========================================");


  for (const category of CATEGORY_ORDER) {

    console.log(
      `${categoryEmojis[category]} ${category}: ` +
      `${categorizedNews[category].length}`
    );
  }


  console.log("========================================");
  console.log(
    `📰 مجموع اخبار: ${allNews.length}`
  );
  console.log("========================================");


  /* =======================================================
     حذف منابع تکراری از successfulSources
  ======================================================= */

  const uniqueSuccessfulSources =
    [...new Set(successfulSources)];


  const uniqueFailedSources =
    [...new Set(failedSources)];


  /* =======================================================
     زمان به‌روزرسانی
  ======================================================= */

  const now =
    new Date();


  const lastUpdate =
    now.toISOString();


  const lastUpdatePersian =
    toPersianDate(lastUpdate);


  /* =======================================================
     خروجی نهایی news.json
  ======================================================= */

  const output = {

    lastUpdate,

    lastUpdatePersian,

    totalNews:
      allNews.length,

    failedSources:
      uniqueFailedSources,

    successfulSources:
      uniqueSuccessfulSources,

    categories:
      CATEGORY_ORDER,

    news:
      allNews,

    categorizedNews:
      categorizedNews
  };


  fs.writeFileSync(
    "news.json",
    JSON.stringify(output, null, 2),
    "utf8"
  );


  console.log("");
  console.log(
    "💾 news.json با موفقیت ذخیره شد."
  );


  /* =======================================================
     تولید index.html
  ======================================================= */

  const htmlNews =
    allNews
      .map((item, index) => {

        const category =
          item.category || "متفرقه";

        const emoji =
          categoryEmojis[category] || "📌";

        const title =
          escapeHtml(item.title);

        const source =
          escapeHtml(item.source);

        const flag =
          escapeHtml(item.flag);

        const link =
          safeLink(item.link);

        const date =
          escapeHtml(
            item.datePersian || ""
          );


        return `
<article class="news-card"
         data-category="${escapeHtml(category)}">

  <div class="news-category">
    ${emoji} ${escapeHtml(category)}
  </div>

  <h2>
    <a href="${link}"
       target="_blank"
       rel="noopener noreferrer">
      ${title}
    </a>
  </h2>

  <div class="news-meta">
    <span>${flag} ${source}</span>
    <span>${date}</span>
  </div>

</article>
`;
      })
      .join("\n");


  const categoryTabs =
    CATEGORY_ORDER
      .map((category) => {

        const count =
          categorizedNews[category].length;

        const emoji =
          categoryEmojis[category];


        return `
<button
  class="category-btn"
  data-category="${escapeHtml(category)}"
  onclick="filterCategory('${escapeHtml(category)}')">
  ${emoji} ${escapeHtml(category)}
  <span>${count}</span>
</button>
`;
      })
      .join("\n");


  const generatedHtml = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<meta name="theme-color"
      content="#263238">

<title>مهم‌ترین اخبار روز | دیار قدمگاه</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family:
    Tahoma,
    Arial,
    sans-serif;

  background:
    #f4f6f8;

  color:
    #263238;
}

header {
  background:
    #263238;

  color:
    white;

  padding:
    20px;

  text-align:
    center;
}

header h1 {
  margin:
    0 0 8px;

  font-size:
    24px;
}

header p {
  margin:
    0;

  opacity:
    .85;

  font-size:
    14px;
}

.container {
  width:
    min(1100px, 94%);

  margin:
    20px auto;
}

.filters {
  display:
    flex;

  flex-wrap:
    wrap;

  gap:
    8px;

  margin-bottom:
    20px;
}

.category-btn {
  border:
    1px solid #cfd8dc;

  background:
    white;

  color:
    #263238;

  padding:
    9px 13px;

  border-radius:
    12px;

  cursor:
    pointer;

  font-family:
    inherit;

  transition:
    .2s;
}

.category-btn:hover,
.category-btn.active {
  background:
    #263238;

  color:
    white;
}

.category-btn span {
  margin-right:
    4px;

  opacity:
    .7;
}

.news-list {
  display:
    grid;

  gap:
    14px;
}

.news-card {
  background:
    white;

  border-radius:
    14px;

  padding:
    18px;

  box-shadow:
    0 2px 8px rgba(0,0,0,.06);
}

.news-category {
  display:
    inline-block;

  font-size:
    13px;

  margin-bottom:
    8px;

  opacity:
    .75;
}

.news-card h2 {
  margin:
    0 0 12px;

  font-size:
    18px;

  line-height:
    1.8;
}

.news-card h2 a {
  color:
    #263238;

  text-decoration:
    none;
}

.news-card h2 a:hover {
  text-decoration:
    underline;
}

.news-meta {
  display:
    flex;

  justify-content:
    space-between;

  gap:
    10px;

  flex-wrap:
    wrap;

  color:
    #78909c;

  font-size:
    12px;
}

.footer {
  text-align:
    center;

  padding:
    25px;

  color:
    #607d8b;

  font-size:
    13px;
}

.hidden {
  display:
    none;
}

</style>

</head>

<body>

<header>

<h1>
🇮🇷 مهم‌ترین اخبار روز
</h1>

<p>
دیار قدمگاه | آخرین به‌روزرسانی:
${escapeHtml(lastUpdatePersian)}
</p>

</header>


<main class="container">

<div class="filters">

<button
  class="category-btn active"
  onclick="filterCategory('همه')">
  📰 همه
  <span>${allNews.length}</span>
</button>

${categoryTabs}

</div>


<div class="news-list">

${htmlNews}

</div>

</main>


<div class="footer">

🏡 دیار قدمگاه ✍️ معقول

</div>


<script>

function filterCategory(category) {

  const cards =
    document.querySelectorAll(
      ".news-card"
    );

  const buttons =
    document.querySelectorAll(
      ".category-btn"
    );


  buttons.forEach(button => {

    button.classList.remove(
      "active"
    );

  });


  buttons.forEach(button => {

    const buttonCategory =
      button.dataset.category;


    if (
      category === "همه" &&
      !buttonCategory
    ) {
      button.classList.add(
        "active"
      );
    }


    if (
      buttonCategory === category
    ) {
      button.classList.add(
        "active"
      );
    }

  });


  cards.forEach(card => {

    const cardCategory =
      card.dataset.category;


    if (
      category === "همه" ||
      cardCategory === category
    ) {

      card.classList.remove(
        "hidden"
      );

    } else {

      card.classList.add(
        "hidden"
      );

    }

  });

}

</script>

</body>

</html>
`;


  fs.writeFileSync(
    "index.html",
    generatedHtml,
    "utf8"
  );


  console.log(
    "🌐 index.html با موفقیت ساخته شد."
  );


  /* =======================================================
     news-ticker.html
     
     فقط اگر وجود نداشته باشد ساخته می‌شود.
     فایل موجود بازنویسی نمی‌شود.
  ======================================================= */

  if (!fs.existsSync("news-ticker.html")) {

    const tickerNews =
      allNews
        .slice(0, 20)
        .map((item) => {

          const title =
            escapeHtml(item.title);

          const link =
            safeLink(item.link);

          return `
<a href="${link}"
   target="_blank"
   rel="noopener noreferrer">
  ${title}
</a>
`;
        })
        .join("\n");


    const tickerHtml = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>خبرهای فوری | دیار قدمگاه</title>

<style>

body {
  margin: 0;
  font-family: Tahoma, Arial, sans-serif;
}

.ticker {
  overflow: hidden;
  white-space: nowrap;
  background: #263238;
  color: white;
  padding: 10px;
}

.ticker a {
  color: white;
  text-decoration: none;
  margin-left: 35px;
}

</style>

</head>

<body>

<div class="ticker">

${tickerNews}

</div>

</body>

</html>
`;


    fs.writeFileSync(
      "news-ticker.html",
      tickerHtml,
      "utf8"
    );


    console.log(
      "📢 news-ticker.html ساخته شد."
    );

  } else {

    console.log(
      "📢 news-ticker.html موجود است؛ بازنویسی نشد."
    );
  }


  /* =======================================================
     پایان
  ======================================================= */

  console.log("");
  console.log("========================================");
  console.log("✅ عملیات دریافت و دسته‌بندی تمام شد");
  console.log("========================================");
}


main().catch((error) => {

  console.error(
    "❌ خطای نهایی:",
    error
  );

  process.exit(1);
});

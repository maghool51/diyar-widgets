const fs = require("fs");
const Parser = require("rss-parser");

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  timeout: 15000
});

// ================ ابزارهای امنیتی (جلوگیری از XSS) ================
// عنوان، منبع و سایر متن‌های آزاد که از RSS خارجی می‌آیند هرگز نباید
// بدون escape مستقیماً داخل HTML قرار بگیرند؛ در غیر این صورت یک منبع
// خبری آلوده (یا حمله MITM روی فید RSS) می‌تواند کد جاوااسکریپت اجرا کند.
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// لینک خبر را اعتبارسنجی می‌کند: فقط http/https معتبر پذیرفته می‌شود.
// startsWith("http") به‌تنهایی کافی نیست چون رشته‌ای مثل
// `http"><script>...</script>` هم آن تست را قبول می‌کند.
function safeLink(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.href;
    }
  } catch (e) {
    // لینک نامعتبر است
  }
  return "#";
}

// ================ دسته‌بندی با ایموجی ================
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

// ================ دسته‌بندی با کلمات کلیدی (متوازن) ================
const categories = {
  "سیاسی": [
    "رئیسی", "وزیر", "رئیس‌جمهور", "مجلس", "نماینده", "انتخابات",
    "جنگ", "غزه", "فلسطین", "اسرائیل", "حماس", "حزب‌الله", "لبنان",
    "آتش‌بس", "صلح", "درگیری", "عملیات", "شهادت", "ترور", "موشک",
    "سفارت", "کنگره", "پارلمان", "تحریم", "مذاکره", "برجام",
    "خارجی", "سیاست", "دولت", "قوه قضائیه", "دادگاه", "قانون"
  ],
  "اقتصادی": [
    "اقتصاد", "دلار", "طلا", "سکه", "ارز", "بانک", "پول", "بورس", "سهام",
    "قیمت", "تورم", "گرانی", "ارزان", "کالا", "صادرات", "واردات", "نفت",
    "گاز", "پتروشیمی", "صنعت", "کشاورزی", "بازار", "تجارت", "بودجه",
    "مالیات", "یارانه", "فقر", "اشتغال", "بیکاری", "تعاون"
  ],
  "ورزشی": [
    "ورزش", "فوتبال", "تیم ملی", "استقلال", "پرسپولیس", "سپاهان",
    "لیگ برتر", "جام جهانی", "المپیک", "کشتی", "وزنه‌برداری", "والیبال",
    "بسکتبال", "تنیس", "شطرنج", "قهرمانی", "مسابقه", "گل", "دربی",
    "مدال", "مربی", "داور", "تماشاگر", "ورزشگاه"
  ],
  "فرهنگی و هنری": [
    "فیلم", "سینما", "تلویزیون", "سریال", "هنر", "موسیقی", "کنسرت",
    "بازیگر", "کارگردان", "نمایش", "تئاتر", "کتاب", "نویسنده", "شعر",
    "ادبیات", "جشنواره", "فرهنگ", "هنرمند", "جوایز", "موزه", "نگارخانه"
  ],
  "اجتماعی": [
    "آموزش", "دانشگاه", "مدرسه", "دانش‌آموز", "دانشجو", "تحصیل", "کنکور",
    "بیمه", "درمان", "سلامت", "بیمارستان", "پزشک", "دارو", "واکسن",
    "حوادث", "تصادف", "زلزله", "سیل", "آتش‌سوزی", "نجات", "جاده",
    "ازدواج", "طلاق", "جمعیت", "مهاجرت", "کار", "حقوق", "مسکن",
    "آسیب‌های اجتماعی", "اعتیاد", "فقر"
  ],
  "علمی و فناوری": [
    "فناوری", "علم", "فضا", "ماهواره", "رایانه", "هوش مصنوعی",
    "پزشکی", "پژوهش", "تحقیق", "کشف", "اختراع", "نوآوری",
    "اینترنت", "موبایل", "تلفن", "نرم‌افزار", "سخت‌افزار", "ربات",
    "نانو", "زیست‌فناوری", "هسته‌ای", "انرژی", "نوین"
  ],
  "بین‌الملل": [
    "جهان", "بین‌الملل", "سازمان ملل", "یونسکو", "اروپا", "اتحادیه اروپا",
    "آسیا", "آفریقا", "آمریکای لاتین", "کانادا", "استرالیا", "ژاپن",
    "کره", "هند", "پاکستان", "افغانستان", "عراق", "یمن", "قطر", "امارات",
    "عربستان", "ترکیه", "روسیه", "چین", "انگلیس", "فرانسه", "آلمان",
    "بایدن", "ترامپ", "پوتین", "شی جین پینگ", "ناتو", "بریتانیا",
    "آمریکا", "کنگره آمریکا", "سنا", "کاخ سفید", "کرملین"
  ]
};

// تابع تشخیص دسته‌بندی خبر
function detectCategory(title) {
  const lowerTitle = title.toLowerCase();
  const scores = {};
  
  for (const [category, keywords] of Object.entries(categories)) {
    scores[category] = 0;
    for (const keyword of keywords) {
      if (lowerTitle.includes(keyword.toLowerCase())) {
        scores[category] += 1;
      }
    }
  }
  
  let bestCategory = "متفرقه";
  let maxScore = 0;
  
  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }
  
  return maxScore > 0 ? bestCategory : "متفرقه";
}

// ================ منابع نهایی ================
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
    // آدرس قبلی (tasnimnews.com/fa/rss/feed/0/8/0/...) کار می‌کرد ولی
    // دامنه‌ی رسمی فعلی تسنیم .ir است (طبق ویکی‌پدیا). این آدرس مستقیماً
    // fetch و محتوای XML واقعی و زنده‌اش تأیید شد.
    name: "تسنیم",
    url: "https://www.tasnimnews.ir/fa/rss/feed/0/0/8/1/TopStories",
    flag: "🇮🇷"
  },
  {
    // ⚠️ اطمینان کمتر: دامنه‌ی farsnews.com از سال ۲۰۲۰ توسط تحریم‌های
    // آمریکا مسدود شده و farsnews.ir جایگزین آن است، اما صفحه‌ی لیست
    // RSSهای رسمی‌شان (farsnews.ir/RSSLinks) یک اپ جاوااسکریپتی است و
    // امکان استخراج مستقیم آدرس فید نهایی از آن نبود. اگر بعد از این
    // اصلاح هم «فارس» در failedSources ظاهر شد، احتمالاً دلیلش مسدود
        // بودن دامنه (نه اشتباه بودن مسیر) است.
    name: "فارس",
    url: "https://www.farsnews.ir/rss",
    flag: "🇮🇷"
  },
  {
    // آدرس قبلی (fa/rss/allnews) با آدرس ارائه‌شده توسط کاربر جایگزین شد.
    // ⚠️ به‌دلیل مسدود بودن دسترسی خودکار به ilna.ir (robots.txt) در این
    // محیط، نتوانستم خودم این آدرس را مستقیماً fetch و تأیید کنم.
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
    // آدرس قبلی یک اشتباه تایپی داشت: «persia» به‌جای «persian»، و
    // دامنه‌ی bbc.com هم اصلاً دامنه‌ی درست فیدهای BBC نیست. آدرس
    // درست بر اساس الگوی رسمی BBC (feeds.bbci.co.uk/<service>/rss.xml).
    name: "بی‌بی‌سی فارسی",
    url: "https://feeds.bbci.co.uk/persian/rss.xml",
    flag: "🌍"
  },
  {
    // آدرس ارائه‌شده توسط کاربر — با کد سه‌حرفی زبان («per») که الگوی
    // واقعی و قدیمی دویچه‌وله برای نام‌گذاری فیدها بوده (مشابه «chi»
    // برای چینی). این محتمل‌تر از حدس قبلی («fa») است، هرچند دامنه‌ی
    // dw-world.de هم robots.txt دارد و نتوانستم مستقیماً تأیید کنم.
    name: "دویچه‌وله فارسی",
    url: "http://rss.dw-world.de/xml/rss-per-all_volltext",
    flag: "🌍"
  },
  {
    // آدرس قبلی (radiofarda.com/rss) اصلاً وجود نداشت. این آدرس مستقیماً
    // از صفحه‌ی رسمی radiofarda.com/rssfeeds («ایران») استخراج و تست شد.
    name: "رادیو فردا",
    url: "https://www.radiofarda.com/api/zpoqil-vomx-tpe_kip",
    flag: "🌍"
  }
];

// ================ منابع پشتیبان ================
// نکته: نسخه‌ی قبلی این لیست برای بی‌بی‌سی/دویچه‌وله/رادیوفردا به
// صفحه‌ی HTML اصلی سایت (نه یک فید RSS واقعی) اشاره می‌کرد؛ چنین
// آدرسی هرگز به‌عنوان RSS پارس نمی‌شود، برای همین کاملاً بی‌فایده
// بود. این‌جا حذف/اصلاح شدند. هر منبعی که برایش فید پشتیبان واقعی
// و تأییدشده پیدا نشد، عمداً از لیست پشتیبان‌ها حذف شد (بهتر از یک
// آدرس نادرست است که فقط توهم داشتن پشتیبان می‌دهد).
const backupSources = [
  {
    name: "رادیو فردا",
    url: "https://www.radiofarda.com/api/zrttpol-vomx-tpeoogpi"
  }
];

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      return await parser.parseURL(url);
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
}

async function getNews() {
  console.log("📰 در حال دریافت اخبار فوری ایران و جهان...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  let allNews = [];
  const failedSources = [];

  // ================ دریافت از منابع اصلی ================
  for (const source of sources) {
    try {
      console.log(`⏳ ${source.flag} در حال دریافت ${source.name}...`);
      const feed = await fetchWithRetry(source.url);
      
      if (!feed.items || feed.items.length === 0) {
        console.log(`⚠️ ${source.name} هیچ خبری نداشت`);
        failedSources.push(source.name);
        continue;
      }
      
      let count = 0;
      feed.items.slice(0, 15).forEach(item => {
        if (!item.title || !item.link) return;
        
        const title = item.title.trim();
        const category = detectCategory(title);
        
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
      
      console.log(`✅ ${source.flag} ${source.name}: ${count} خبر دریافت شد`);
    } catch (e) {
      console.log(`❌ ${source.flag} ${source.name} ناموفق: ${e.message}`);
      failedSources.push(source.name);
      continue;
    }
  }

  // ================ دریافت از منابع پشتیبان ================
  console.log("\n🔄 بررسی منابع پشتیبان...");
  for (const backup of backupSources) {
    if (failedSources.includes(backup.name) || !sources.find(s => s.name === backup.name)) {
      try {
        console.log(`⏳ در حال دریافت ${backup.name} (پشتیبان)...`);
        const feed = await fetchWithRetry(backup.url);
        
        if (!feed.items || feed.items.length === 0) {
          console.log(`⚠️ ${backup.name} (پشتیبان) هیچ خبری نداشت`);
          continue;
        }
        
        let count = 0;
        feed.items.slice(0, 15).forEach(item => {
          if (!item.title || !item.link) return;
          const title = item.title.trim();
          const category = detectCategory(title);
          const flag = sources.find(s => s.name === backup.name)?.flag || "🌍";
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
        
        console.log(`✅ ${backup.name} (پشتیبان): ${count} خبر دریافت شد`);
        const index = failedSources.indexOf(backup.name);
        if (index > -1) failedSources.splice(index, 1);
      } catch (e) {
        console.log(`❌ ${backup.name} (پشتیبان) نیز ناموفق بود: ${e.message}`);
        continue;
      }
    }
  }

  // ================ پردازش نهایی ================
  if (allNews.length === 0) {
    console.log("⚠️ هیچ خبری دریافت نشد!");
    return;
  }

  const seenTitles = new Set();
  allNews = allNews
    .filter(n => n.title && /[\u0600-\u06FF]/.test(n.title))
    .filter(n => {
      const key = n.title
        .replace(/\s+/g, " ")
        .replace(/[«»،:؛!?]/g, "")
        .trim()
        .toLowerCase();

      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      return dateB - dateA;
    })
    .slice(0, 100);

  console.log(`\n📊 مجموع اخبار دریافتی: ${allNews.length}`);

  // ================ دسته‌بندی اخبار ================
  const categorizedNews = {};
  for (const news of allNews) {
    if (!categorizedNews[news.category]) {
      categorizedNews[news.category] = [];
    }
    categorizedNews[news.category].push(news);
  }

  // ================ ساخت فایل news.json ================
  const jsonData = {
    lastUpdate: new Date().toISOString(),
    lastUpdatePersian: new Date().toLocaleString("fa-IR"),
    totalNews: allNews.length,
    failedSources: failedSources,
    categories: Object.keys(categorizedNews),
    news: allNews,
    categorizedNews: categorizedNews
  };

  fs.writeFileSync("news.json", JSON.stringify(jsonData, null, 2), "utf8");
  console.log(`✅ news.json با ${allNews.length} خبر ذخیره شد`);

  // ================ ساخت index.html ================
  let html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🇮🇷 اخبار فوری ایران و جهان - دیار قدمگاه</title>
<meta name="description" content="آخرین اخبار فوری ایران و جهان از ${sources.length} منبع معتبر خبری، دسته‌بندی شده و به‌روزشونده هر ۳۰ دقیقه.">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:title" content="دیار قدمگاه | اخبار فوری ایران">
<meta property="og:description" content="اخبار دسته‌بندی‌شده ایران و جهان از ${sources.length} منبع معتبر، بروزرسانی خودکار هر ۳۰ دقیقه.">
<meta property="og:locale" content="fa_IR">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:tahoma;background:#f0f2f5;padding:10px}
.box{max-width:900px;margin:auto}
.header{background:#b30000;color:white;padding:15px;border-radius:12px;font-size:20px;font-weight:bold;text-align:center}
.category-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:15px 0;justify-content:center}
.category-tab{background:#eee;padding:8px 16px;border-radius:20px;cursor:pointer;font-size:13px;transition:all 0.3s;border:none}
.category-tab:hover{background:#ddd}
.category-tab.active{background:#b30000;color:white}
.category-section{margin-top:15px}
.category-title{background:#b30000;color:white;padding:10px 15px;border-radius:8px;font-size:16px;font-weight:bold;margin-bottom:10px}
.card{background:white;margin-top:8px;padding:12px 15px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.1);transition:transform 0.2s}
.card:hover{transform:scale(1.01)}
.card .title{font-weight:bold;font-size:15px;line-height:1.6}
.card .title a{color:#222;text-decoration:none}
.card .title a:hover{color:#b30000}
.card .meta{display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:12px;flex-wrap:wrap;gap:5px}
.card .source{color:#b30000}
.card .date{color:#888}
.footer{text-align:center;color:#888;margin:20px 0;font-size:13px}
.count-badge{display:inline-block;background:#fff;color:#b30000;padding:2px 12px;border-radius:20px;font-size:14px;margin-right:10px}
.flag-badge{font-size:14px;margin-right:5px}
@media(max-width:600px){.card{padding:10px}.card .title{font-size:13px}}
</style>
</head>
<body>
<div class="box">
<div class="header">
<div style="font-size:24px;font-weight:bold;">
📰 دیار قدمگاه | اخبار فوری ایران
</div>

<div style="font-size:13px;margin-top:8px;opacity:.95">
آخرین بروزرسانی: ${new Date().toLocaleString("fa-IR")}
</div>

<div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:12px">

<span class="count-badge">
📰 ${allNews.length} خبر
</span>

<span class="count-badge">
🗂 ${Object.keys(categorizedNews).length} دسته
</span>

<span class="count-badge">
📡 ${sources.length} خبرگزاری
</span>

</div>
</div>

<div class="category-tabs">
  <button class="category-tab active" onclick="filterCategory('all')">📋 همه</button>
  ${Object.keys(categorizedNews).map(cat => 
    `<button class="category-tab" onclick="filterCategory('${cat}')">${categoryEmojis[cat] || '📌'} ${cat}</button>`
  ).join('')}
</div>

<div id="news-container">`;

  // نمایش همه اخبار
  for (const [category, newsList] of Object.entries(categorizedNews)) {
    const emoji = categoryEmojis[category] || '📌';
    html += `
  <div class="category-section" data-category="${escapeHtml(category)}">
    <div class="category-title">${emoji} ${escapeHtml(category)} <span style="font-size:13px;background:#fff;color:#b30000;padding:0 10px;border-radius:12px;margin-right:8px;">${newsList.length}</span></div>`;
    
    for (const news of newsList) {
      const dateDisplay = news.date && !isNaN(new Date(news.date))
        ? new Date(news.date).toLocaleString("fa-IR")
        : "";
      html += `
    <div class="card">
      <div class="title"><a href="${escapeHtml(news.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(news.title)}</a></div>
      <div class="meta">
        <span class="source">${news.flag || '📰'} ${escapeHtml(news.source)}</span>
        ${dateDisplay ? `<span class="date">🕐 ${escapeHtml(dateDisplay)}</span>` : ''}
      </div>
    </div>`;
    }
    html += `
  </div>`;
  }

  html += `
</div>

<div class="footer">
🔄 آخرین بروزرسانی: ${new Date().toLocaleString("fa-IR")}<br>
${failedSources.length ? `⚠️ منابع ناموفق: ${failedSources.join('، ')}` : '✅ همه منابع فعال هستند'}
</div>
</div>

<script>
function filterCategory(category) {
  document.querySelectorAll('.category-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.category-tab').forEach(tab => {
    if (tab.textContent.includes(category === 'all' ? 'همه' : category)) {
      tab.classList.add('active');
    }
  });
  
  document.querySelectorAll('.category-section').forEach(section => {
    if (category === 'all' || section.dataset.category === category) {
      section.style.display = 'block';
    } else {
      section.style.display = 'none';
    }
  });
}
</script>

</body>
</html>`;

  fs.writeFileSync("index.html", html, "utf8");
  console.log(`✅ index.html با ${allNews.length} خبر ذخیره شد`);

  // ================ ساخت news.html ================
  fs.writeFileSync("news.html", html, "utf8");
  console.log(`✅ news.html با ${allNews.length} خبر ذخیره شد`);

  // ================ ساخت news-ticker.html ================
// ================ ساخت news-ticker.html ================
const tickerHtml = `<!DOCTYPE html>
<html>
<head>
<style>
.news-ticker {
  direction: rtl;
  font-family: Tahoma, sans-serif;
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
  animation: tickerScroll 90s linear infinite;
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
  background: rgba(255,255,255,0.2);
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
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}

.news-ticker:hover .news-ticker-content {
  animation-play-state: paused;
}
</style>
</head>

<body>

<div class="news-ticker">
  <div class="news-ticker-content">
    ${allNews.map(n => {
      return `<a href="${escapeHtml(n.link)}" target="_blank" rel="noopener noreferrer">
      <span class="category-badge">${n.flag || '📰'}</span>
      ${escapeHtml(n.title)}
      </a>
      <span class="separator">|</span>`;
    }).join('')}

    <span style="color:#ff6b6b;">●</span>
    آخرین بروزرسانی: ${new Date().toLocaleString("fa-IR")}
  </div>
</div>

</body>
</html>`;


// فقط اگر فایل وجود نداشته باشد ساخته می‌شود
// تغییرات دستی شما روی نیوزتیکر حفظ خواهد شد
if (!fs.existsSync("news-ticker.html")) {

  fs.writeFileSync("news-ticker.html", tickerHtml, "utf8");

  console.log(`✅ news-ticker.html ساخته شد (${allNews.length} خبر)`);

} else {

  console.log("ℹ️ news-ticker.html موجود است؛ بازنویسی نشد.");

}
  
  console.log("\n🎉 عملیات با موفقیت کامل شد!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

getNews().catch(err => {
  console.error("❌ خطای کلی:", err.message);
  process.exit(1);
});

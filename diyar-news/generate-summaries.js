const fs = require("fs");

/*
 * ============================================================
 * دیار قدمگاه | تولید چکیده خبرها
 * ============================================================
 *
 * ورودی:
 *   news.json
 *
 * خروجی:
 *   news-summary.json
 *
 * اولویت استخراج چکیده:
 *
 * 1) og:description
 * 2) description
 * 3) twitter:description
 * 4) JSON-LD description
 * 5) اولین پاراگراف مناسب صفحه
 *
 * این فایل مستقل است و به fetch-news.js دست نمی‌زند.
 * ============================================================
 */


/* ============================================================
   تنظیمات
   ============================================================ */

const INPUT_FILE = "news.json";
const OUTPUT_FILE = "news-summary.json";

const MAX_SUMMARY_LENGTH = 220;

const REQUEST_TIMEOUT = 12000;

const CONCURRENCY = 5;


/* ============================================================
   User-Agent
   ============================================================ */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36 " +
  "Diyar-Ghadamgah-NewsBot/1.0";


/* ============================================================
   خواندن news.json
   ============================================================ */

function readNews() {

  if (!fs.existsSync(INPUT_FILE)) {

    throw new Error(
      `فایل ${INPUT_FILE} پیدا نشد.`
    );
  }

  const raw =
    fs.readFileSync(
      INPUT_FILE,
      "utf8"
    );

  return JSON.parse(raw);
}


/* ============================================================
   تبدیل HTML Entityها
   ============================================================ */

function decodeHtmlEntities(text) {

  if (!text) {
    return "";
  }

  return String(text)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#039;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, function(_, code) {

      try {
        return String.fromCharCode(
          Number(code)
        );
      } catch {
        return _;
      }

    })
    .replace(/&#x([0-9a-f]+);/gi, function(_, code) {

      try {
        return String.fromCharCode(
          parseInt(code, 16)
        );
      } catch {
        return _;
      }

    });
}


/* ============================================================
   حذف HTML
   ============================================================ */

function stripHtml(text) {

  if (!text) {
    return "";
  }

  return decodeHtmlEntities(
    String(text)
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " "
      )
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " "
      )
      .replace(
        /<noscript[\s\S]*?<\/noscript>/gi,
        " "
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
  );
}


/* ============================================================
   پاکسازی متن
   ============================================================ */

function cleanText(text) {

  if (!text) {
    return "";
  }

  return stripHtml(text)
    .replace(/\u200c+/g, "\u200c")
    .replace(/\s+/g, " ")
    .replace(
      /^(توضیحات|توضیح|خلاصه|چکیده)\s*[:：-]\s*/i,
      ""
    )
    .trim();
}


/* ============================================================
   کوتاه‌کردن چکیده
   ============================================================ */

function shorten(text) {

  text =
    cleanText(text);

  if (!text) {
    return "";
  }

  if (
    text.length <=
    MAX_SUMMARY_LENGTH
  ) {
    return text;
  }


  /*
   * ترجیح می‌دهیم جمله کامل باشد.
   */

  const sentenceEnd =
    text
      .slice(
        0,
        MAX_SUMMARY_LENGTH
      )
      .lastIndexOf(".");

  const persianSentenceEnd =
    text
      .slice(
        0,
        MAX_SUMMARY_LENGTH
      )
      .lastIndexOf(".");

  const bestEnd =
    Math.max(
      sentenceEnd,
      persianSentenceEnd
    );


  if (
    bestEnd >= 100
  ) {

    return (
      text
        .slice(
          0,
          bestEnd + 1
        )
        .trim()
    );
  }


  /*
   * اگر نقطه مناسب نبود،
   * تا آخرین فاصله کوتاه می‌کنیم.
   */

  let result =
    text.slice(
      0,
      MAX_SUMMARY_LENGTH
    );


  const lastSpace =
    result.lastIndexOf(" ");


  if (
    lastSpace > 100
  ) {

    result =
      result.slice(
        0,
        lastSpace
      );
  }


  return result.trim() + "…";
}


/* ============================================================
   استخراج Meta
   ============================================================ */

function extractMetaDescription(
  html
) {

  const patterns = [

    /*
     * og:description
     */

    /<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,

    /<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:description["'][^>]*>/i,


    /*
     * description
     */

    /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,

    /<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i,


    /*
     * twitter description
     */

    /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,

    /<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']twitter:description["'][^>]*>/i

  ];


  for (
    const pattern of patterns
  ) {

    const match =
      html.match(pattern);


    if (
      match &&
      match[1]
    ) {

      const text =
        cleanText(
          match[1]
        );


      if (
        isUsefulSummary(text)
      ) {

        return text;
      }
    }
  }


  return "";
}


/* ============================================================
   استخراج description از JSON-LD
   ============================================================ */

function extractJsonLdDescription(
  html
) {

  const scripts =
    html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
    );


  if (!scripts) {
    return "";
  }


  for (
    const script of scripts
  ) {

    const jsonText =
      script
        .replace(
          /<script[^>]*>/i,
          ""
        )
        .replace(
          /<\/script>$/i,
          ""
        )
        .trim();


    try {

      const data =
        JSON.parse(
          jsonText
        );


      const candidates = [];


      if (
        data &&
        typeof data === "object"
      ) {

        candidates.push(
          data.description
        );


        if (
          Array.isArray(
            data
          )
        ) {

          for (
            const item of data
          ) {

            if (
              item &&
              item.description
            ) {

              candidates.push(
                item.description
              );
            }
          }
        }


        if (
          data["@graph"] &&
          Array.isArray(
            data["@graph"]
          )
        ) {

          for (
            const item of
            data["@graph"]
          ) {

            if (
              item &&
              item.description
            ) {

              candidates.push(
                item.description
              );
            }
          }
        }
      }


      for (
        const candidate of
        candidates
      ) {

        const text =
          cleanText(
            candidate
          );


        if (
          isUsefulSummary(text)
        ) {

          return text;
        }
      }

    } catch {
      /*
       * بعض سایت‌ها JSON-LD
       * ناقص دارند؛ از آن عبور می‌کنیم.
       */
    }
  }


  return "";
}


/* ============================================================
   استخراج اولین پاراگراف مناسب
   ============================================================ */

function extractFirstParagraph(
  html
) {

  const articleMatch =
    html.match(
      /<article[\s\S]*?<\/article>/i
    );


  const area =
    articleMatch
      ? articleMatch[0]
      : html;


  const paragraphs =
    area.match(
      /<p\b[^>]*>[\s\S]*?<\/p>/gi
    );


  if (!paragraphs) {
    return "";
  }


  for (
    const paragraph of
    paragraphs
  ) {

    const text =
      cleanText(
        paragraph
      );


    if (
      isUsefulSummary(text)
    ) {

      return text;
    }
  }


  return "";
}


/* ============================================================
   بررسی مفید بودن چکیده
   ============================================================ */

function isUsefulSummary(
  text
) {

  if (!text) {
    return false;
  }


  const value =
    cleanText(text);


  if (
    value.length < 50
  ) {
    return false;
  }


  /*
   * حذف متن‌های عمومی سایت
   */

  const badPhrases = [

    "عضویت در خبرنامه",
    "عضویت در کانال",
    "دنبال کنید",
    "تمام حقوق محفوظ است",
    "حقوق مادی و معنوی",
    "کپی برداری",
    "اخبار بیشتر",
    "ادامه مطلب",
    "آخرین اخبار",
    "صفحه اصلی",
    "جستجو در سایت",
    "ثبت نام",
    "ورود به حساب"

  ];


  const lower =
    value.toLowerCase();


  if (
    badPhrases.some(
      phrase =>
        lower.includes(
          phrase.toLowerCase()
        )
    )
  ) {

    return false;
  }


  return true;
}


/* ============================================================
   دریافت صفحه خبر
   ============================================================ */

function fetchPage(url) {

  return new Promise(
    function(resolve) {

      let settled = false;


      function finish(
        result
      ) {

        if (settled) {
          return;
        }

        settled = true;

        resolve(result);
      }


      let parsedUrl;

      try {

        parsedUrl =
          new URL(url);

      } catch {

        finish({
          ok: false,
          error: "لینک نامعتبر"
        });

        return;
      }


      const protocol =
        parsedUrl.protocol ===
        "https:"
          ? require("https")
          : require("http");


      const request =
        protocol.get(
          parsedUrl,
          {
            headers: {
              "User-Agent":
                USER_AGENT,

              "Accept":
                "text/html,application/xhtml+xml"
            },

            timeout:
              REQUEST_TIMEOUT
          },

          function(response) {

            /*
             * Redirect
             */

            if (
              response.statusCode >= 300 &&
              response.statusCode < 400 &&
              response.headers.location
            ) {

              response.resume();

              finish(
                {
                  ok: false,
                  redirect:
                    response.headers.location
                }
              );

              return;
            }


            if (
              response.statusCode < 200 ||
              response.statusCode >= 300
            ) {

              response.resume();

              finish({
                ok: false,
                error:
                  `HTTP ${response.statusCode}`
              });

              return;
            }


            let body = "";


            response.setEncoding(
              "utf8"
            );


            response.on(
              "data",
              function(chunk) {

                /*
                 * جلوگیری از مصرف بیش از حد حافظه
                 */

                if (
                  body.length <
                  1000000
                ) {

                  body += chunk;
                }
              }
            );


            response.on(
              "end",
              function() {

                finish({
                  ok: true,
                  html: body
                });

              }
            );

          }
        );


      request.on(
        "timeout",
        function() {

          request.destroy();

          finish({
            ok: false,
            error:
              "Timeout"
          });

        }
      );


      request.on(
        "error",
        function(error) {

          finish({
            ok: false,
            error:
              error.message
          });

        }
      );

    }
  );
}


/* ============================================================
   تولید چکیده یک خبر
   ============================================================ */

async function generateSummary(
  news
) {

  const url =
    news.link;


  if (!url) {

    return {
      summary: "",
      status: "no-link"
    };
  }


  const result =
    await fetchPage(url);


  if (!result.ok) {

    /*
     * اگر Redirect بود،
     * فعلاً چکیده خالی می‌ماند.
     */

    return {
      summary: "",
      status:
        result.error ||
        "fetch-failed"
    };
  }


  const html =
    result.html;


  /*
   * 1. Open Graph
   */

  let summary =
    extractMetaDescription(
      html
    );


  if (
    isUsefulSummary(summary)
  ) {

    return {
      summary:
        shorten(summary),

      status:
        "meta"
    };
  }


  /*
   * 2. JSON-LD
   */

  summary =
    extractJsonLdDescription(
      html
    );


  if (
    isUsefulSummary(summary)
  ) {

    return {
      summary:
        shorten(summary),

      status:
        "jsonld"
    };
  }


  /*
   * 3. اولین پاراگراف مناسب
   */

  summary =
    extractFirstParagraph(
      html
    );


  if (
    isUsefulSummary(summary)
  ) {

    return {
      summary:
        shorten(summary),

      status:
        "paragraph"
    };
  }


  return {
    summary: "",
    status:
      "not-found"
  };
}


/* ============================================================
   اجرای موازی کنترل‌شده
   ============================================================ */

async function processWithConcurrency(
  items,
  worker,
  concurrency
) {

  const results =
    new Array(
      items.length
    );


  let nextIndex = 0;


  async function runner() {

    while (true) {

      const index =
        nextIndex++;


      if (
        index >=
        items.length
      ) {

        return;
      }


      try {

        results[index] =
          await worker(
            items[index],
            index
          );

      } catch (error) {

        results[index] = {

          summary: "",

          status:
            "error",

          error:
            error.message
        };
      }
    }
  }


  const runners =
    Array.from(
      {
        length:
          Math.min(
            concurrency,
            items.length
          )
      },
      runner
    );


  await Promise.all(
    runners
  );


  return results;
}


/* ============================================================
   اجرای اصلی
   ============================================================ */

async function main() {

  console.log(
    "📝 تولید چکیده خبرهای دیار قدمگاه..."
  );


  const data =
    readNews();


  const news =
    Array.isArray(
      data.news
    )
      ? data.news
      : [];


  console.log(
    `📰 تعداد خبرها: ${news.length}`
  );


  if (!news.length) {

    console.log(
      "⚠️ خبری برای پردازش وجود ندارد."
    );

    return;
  }


  const results =
    await processWithConcurrency(
      news,
      async function(
        item,
        index
      ) {

        console.log(
          `⏳ [${index + 1}/${news.length}] ${item.source || ""} - ${item.title}`
        );


        const result =
          await generateSummary(
            item
          );


        if (
          result.summary
        ) {

          console.log(
            `   ✅ چکیده پیدا شد (${result.status})`
          );

        } else {

          console.log(
            `   ⚠️ چکیده پیدا نشد: ${result.status}`
          );
        }


        return result;
      },
      CONCURRENCY
    );


  const summaries =
    news.map(
      function(item, index) {

        return {

          // decodeHtmlEntities به‌عنوان یک لایه‌ی محافظ اضافه شده: اگر
          // news.json (به هر دلیلی، از جمله نسخه‌های قدیمی‌تر فایل) عنوانی
          // از قبل HTML-escape شده داشته باشد، این‌جا به متن خام برمی‌گردد
          // تا news.html/rubika-news.html که خودشان escape می‌کنند، آن را
          // دوباره escape نکنند (جلوگیری از «&amp;amp;»‌های تودرتو).
          title:
            decodeHtmlEntities(item.title || ""),

          link:
            item.link || "",

          source:
            item.source || "",

          category:
            item.category || "متفرقه",

          flag:
            item.flag || "📰",

          date:
            item.date || "",

          summary:
            results[index]?.summary || "",

          status:
            results[index]?.status ||
            "unknown"
        };
      }
    );


  const successful =
    summaries.filter(
      item =>
        item.summary
    ).length;


  const output = {

    lastUpdate:
      new Date().toISOString(),

    sourceLastUpdate:
      data.lastUpdate || "",

    totalNews:
      summaries.length,

    summariesFound:
      successful,

    summariesMissing:
      summaries.length -
      successful,

    news:
      summaries

  };


  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      output,
      null,
      2
    ),
    "utf8"
  );


  console.log(
    ""
  );

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );

  console.log(
    `✅ ${OUTPUT_FILE} ساخته شد`
  );

  console.log(
    `📰 کل اخبار: ${summaries.length}`
  );

  console.log(
    `📝 چکیده پیدا شد: ${successful}`
  );

  console.log(
    `⚠️ چکیده پیدا نشد: ${
      summaries.length - successful
    }`
  );

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
}


/* ============================================================
   شروع
   ============================================================ */

main()
  .catch(
    function(error) {

      console.error(
        "❌ خطای کلی:",
        error.message
      );

      process.exit(1);
    }
  );

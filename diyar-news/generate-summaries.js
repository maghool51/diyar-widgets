const fs = require("fs");
const http = require("http");
const https = require("https");

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
 * قابلیت‌ها:
 *
 * 1) حفظ خلاصه‌های معتبر قبلی
 * 2) پردازش فقط خبرهای جدید یا فاقد خلاصه
 * 3) دنبال‌کردن Redirect
 * 4) استخراج چکیده با اولویت:
 *
 *    1. og:description
 *    2. description
 *    3. twitter:description
 *    4. JSON-LD description
 *    5. اولین پاراگراف مناسب
 *
 * 5) حذف متن‌های عمومی و تبلیغاتی
 * 6) کوتاه‌سازی مناسب متن فارسی
 * 7) کنترل هم‌زمانی درخواست‌ها
 * 8) ثبت وضعیت هر خبر
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

const MAX_RESPONSE_SIZE = 1000000;

const MAX_REDIRECTS = 5;


/* ============================================================
   User-Agent
   ============================================================ */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36 " +
  "Diyar-Ghadamgah-NewsBot/2.0";


/* ============================================================
   خواندن JSON
   ============================================================ */

function readJsonFile(file) {

  if (!fs.existsSync(file)) {

    throw new Error(
      `فایل ${file} پیدا نشد.`
    );
  }

  const raw =
    fs.readFileSync(
      file,
      "utf8"
    );

  try {

    return JSON.parse(raw);

  } catch (error) {

    throw new Error(
      `ساختار JSON فایل ${file} صحیح نیست: ${error.message}`
    );
  }
}


/* ============================================================
   خواندن news.json
   ============================================================ */

function readNews() {

  const data =
    readJsonFile(
      INPUT_FILE
    );

  return data;
}


/* ============================================================
   خواندن خلاصه‌های قبلی
   ============================================================ */

function readPreviousSummaries() {

  if (
    !fs.existsSync(
      OUTPUT_FILE
    )
  ) {

    return null;
  }

  try {

    const data =
      readJsonFile(
        OUTPUT_FILE
      );

    if (
      !data ||
      !Array.isArray(
        data.news
      )
    ) {

      return null;
    }

    return data;

  } catch (error) {

    console.log(
      `⚠️ خواندن ${OUTPUT_FILE} ممکن نبود؛ از صفر پردازش می‌شود.`
    );

    return null;
  }
}


/* ============================================================
   تبدیل HTML Entityها
   ============================================================ */

function decodeHtmlEntities(text) {

  if (!text) {
    return "";
  }

  return String(text)

    .replace(
      /&nbsp;/gi,
      " "
    )

    .replace(
      /&amp;/gi,
      "&"
    )

    .replace(
      /&quot;/gi,
      '"'
    )

    .replace(
      /&#39;/gi,
      "'"
    )

    .replace(
      /&#039;/gi,
      "'"
    )

    .replace(
      /&lt;/gi,
      "<"
    )

    .replace(
      /&gt;/gi,
      ">"
    )

    .replace(
      /&#x27;/gi,
      "'"
    )

    .replace(
      /&#x2F;/gi,
      "/"
    )

    .replace(
      /&#(\d+);/g,
      function(_, code) {

        try {

          return String.fromCodePoint(
            Number(code)
          );

        } catch {

          return _;
        }
      }
    )

    .replace(
      /&#x([0-9a-f]+);/gi,
      function(_, code) {

        try {

          return String.fromCodePoint(
            parseInt(
              code,
              16
            )
          );

        } catch {

          return _;
        }
      }
    );
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
        /<svg[\s\S]*?<\/svg>/gi,
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

  let value =
    stripHtml(
      text
    );

  value =
    value
      .replace(
        /\r?\n|\r/g,
        " "
      )

      .replace(
        /\t+/g,
        " "
      )

      .replace(
        /\u200c{2,}/g,
        "\u200c"
      )

      .replace(
        /\s+/g,
        " "
      )

      .replace(
        /^(توضیحات|توضیح|خلاصه|چکیده)\s*[:：\-]\s*/i,
        ""
      )

      .trim();

  return value;
}


/* ============================================================
   نرمال‌سازی URL
   ============================================================ */

function normalizeUrl(url) {

  if (!url) {
    return "";
  }

  try {

    return new URL(
      String(url).trim()
    ).toString();

  } catch {

    return "";
  }
}


/* ============================================================
   کلید یکتای خبر
   ============================================================ */

function getNewsKey(news) {

  const link =
    normalizeUrl(
      news.link
    );

  if (link) {
    return `link:${link}`;
  }

  const title =
    cleanText(
      news.title || ""
    );

  if (title) {
    return `title:${title}`;
  }

  return "";
}


/* ============================================================
   بررسی مفید بودن چکیده
   ============================================================ */

function isUsefulSummary(text) {

  if (!text) {
    return false;
  }

  const value =
    cleanText(
      text
    );

  if (
    value.length < 50
  ) {
    return false;
  }


  /*
   * متن‌های عمومی، تبلیغاتی و غیرخبری
   */

  const badPhrases = [

    "عضویت در خبرنامه",
    "عضویت در کانال",
    "عضو کانال",
    "دنبال کنید",
    "ما را دنبال کنید",
    "تمام حقوق محفوظ است",
    "حقوق مادی و معنوی",
    "کپی برداری",
    "کپی‌برداری",
    "اخبار بیشتر",
    "ادامه مطلب",
    "ادامه‌ی مطلب",
    "آخرین اخبار",
    "صفحه اصلی",
    "جستجو در سایت",
    "ثبت نام",
    "ثبت‌نام",
    "ورود به حساب",
    "ورود به سایت",
    "اشتراک گذاری",
    "اشتراک‌گذاری",
    "ارسال نظر",
    "نظرات",
    "تبلیغات",
    "پیشنهاد سردبیر",
    "مطالب مرتبط",
    "اخبار مرتبط",
    "منوی سایت",
    "منو",
    "کلیک کنید",
    "اینجا کلیک کنید",
    "دانلود کنید",
    "اپلیکیشن",
    "خبرنامه ایمیلی"

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


  /*
   * متن‌هایی که تقریباً فقط لینک یا ایمیل هستند
   */

  const withoutUrls =
    value
      .replace(
        /https?:\/\/\S+/gi,
        ""
      )
      .replace(
        /www\.\S+/gi,
        ""
      )
      .replace(
        /\S+@\S+\.\S+/gi,
        ""
      )
      .trim();


  if (
    withoutUrls.length < 40
  ) {

    return false;
  }


  return true;
}


/* ============================================================
   کوتاه‌کردن چکیده
   ============================================================ */

function shorten(text) {

  text =
    cleanText(
      text
    );

  if (!text) {
    return "";
  }


  if (
    text.length <=
    MAX_SUMMARY_LENGTH
  ) {

    return text;
  }


  const candidate =
    text.slice(
      0,
      MAX_SUMMARY_LENGTH
    );


  /*
   * پایان جمله فارسی و انگلیسی
   */

  const sentenceEnds = [

    "؟",
    "!",
    "؛",
    ".",
    "؟",
    "！"

  ];


  let bestEnd = -1;


  for (
    const mark of sentenceEnds
  ) {

    const position =
      candidate.lastIndexOf(
        mark
      );

    if (
      position >
      bestEnd
    ) {

      bestEnd =
        position;
    }
  }


  /*
   * اگر جمله تقریباً کامل بود،
   * همان را نگه می‌داریم.
   */

  if (
    bestEnd >= 100
  ) {

    return candidate
      .slice(
        0,
        bestEnd + 1
      )
      .trim();
  }


  /*
   * در غیر این صورت تا آخرین فاصله
   */

  let result =
    candidate;


  const lastSpace =
    result.lastIndexOf(
      " "
    );


  if (
    lastSpace >= 100
  ) {

    result =
      result.slice(
        0,
        lastSpace
      );
  }


  return (
    result.trim() +
    "…"
  );
}


/* ============================================================
   استخراج Meta Description
   ============================================================ */

function extractMetaDescription(
  html
) {

  const patterns = [

    /*
     * og:description
     */

    /<meta\b[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i,

    /<meta\b[^>]*content=["']([\s\S]*?)["'][^>]*property=["']og:description["'][^>]*>/i,


    /*
     * description
     */

    /<meta\b[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i,

    /<meta\b[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["'][^>]*>/i,


    /*
     * twitter description
     */

    /<meta\b[^>]*name=["']twitter:description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i,

    /<meta\b[^>]*content=["']([\s\S]*?)["'][^>]*name=["']twitter:description["'][^>]*>/i

  ];


  for (
    const pattern of patterns
  ) {

    const match =
      html.match(
        pattern
      );


    if (
      match &&
      match[1]
    ) {

      const text =
        cleanText(
          match[1]
        );


      if (
        isUsefulSummary(
          text
        )
      ) {

        return text;
      }
    }
  }


  return "";
}


/* ============================================================
   استخراج JSON-LD
   ============================================================ */

function extractJsonLdDescription(
  html
) {

  const scripts =
    html.match(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
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
          /<script\b[^>]*>/i,
          ""
        )

        .replace(
          /<\/script>\s*$/i,
          ""
        )

        .trim();


    try {

      const data =
        JSON.parse(
          jsonText
        );


      const candidates = [];


      function collect(
        value
      ) {

        if (!value) {
          return;
        }


        if (
          typeof value ===
          "string"
        ) {

          candidates.push(
            value
          );

          return;
        }


        if (
          Array.isArray(
            value
          )
        ) {

          for (
            const item of value
          ) {

            collect(
              item
            );
          }

          return;
        }


        if (
          typeof value ===
          "object"
        ) {

          if (
            value.description
          ) {

            candidates.push(
              value.description
            );
          }


          if (
            value["@graph"]
          ) {

            collect(
              value["@graph"]
            );
          }
        }
      }


      collect(
        data
      );


      for (
        const candidate of
        candidates
      ) {

        const text =
          cleanText(
            candidate
          );


        if (
          isUsefulSummary(
            text
          )
        ) {

          return text;
        }
      }

    } catch {

      /*
       * JSON-LD ناقص یا نامعتبر است.
       * ادامه می‌دهیم.
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
      /<article\b[^>]*>[\s\S]*?<\/article>/i
    );


  const mainMatch =
    html.match(
      /<main\b[^>]*>[\s\S]*?<\/main>/i
    );


  const area =
    articleMatch
      ? articleMatch[0]
      : mainMatch
        ? mainMatch[0]
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
      isUsefulSummary(
        text
      )
    ) {

      return text;
    }
  }


  return "";
}


/* ============================================================
   دریافت صفحه با Redirect
   ============================================================ */

function fetchPage(
  url,
  redirectCount = 0
) {

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

        resolve(
          result
        );
      }


      const normalizedUrl =
        normalizeUrl(
          url
        );


      if (!normalizedUrl) {

        finish({
          ok: false,
          error:
            "لینک نامعتبر"
        });

        return;
      }


      let parsedUrl;

      try {

        parsedUrl =
          new URL(
            normalizedUrl
          );

      } catch {

        finish({
          ok: false,
          error:
            "لینک نامعتبر"
        });

        return;
      }


      const protocol =
        parsedUrl.protocol ===
        "https:"
          ? https
          : http;


      const request =
        protocol.get(
          parsedUrl,
          {
            headers: {

              "User-Agent":
                USER_AGENT,

              "Accept":
                "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",

              "Accept-Language":
                "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",

              "Accept-Encoding":
                "identity",

              "Connection":
                "close"
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

              const location =
                response.headers.location;


              response.resume();


              if (
                redirectCount >=
                MAX_REDIRECTS
              ) {

                finish({
                  ok: false,
                  error:
                    "تعداد Redirect بیش از حد"
                });

                return;
              }


              let nextUrl;

              try {

                nextUrl =
                  new URL(
                    location,
                    normalizedUrl
                  ).toString();

              } catch {

                finish({
                  ok: false,
                  error:
                    "Redirect نامعتبر"
                });

                return;
              }


              fetchPage(
                nextUrl,
                redirectCount + 1
              )
                .then(
                  finish
                )
                .catch(
                  function(error) {

                    finish({
                      ok: false,
                      error:
                        error.message
                    });

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

            let received = 0;


            response.setEncoding(
              "utf8"
            );


            response.on(
              "data",
              function(chunk) {

                received +=
                  Buffer.byteLength(
                    chunk,
                    "utf8"
                  );


                if (
                  received <=
                  MAX_RESPONSE_SIZE
                ) {

                  body +=
                    chunk;
                }

              }
            );


            response.on(
              "end",
              function() {

                if (!body) {

                  finish({
                    ok: false,
                    error:
                      "صفحه خالی است"
                  });

                  return;
                }


                finish({

                  ok: true,

                  html:
                    body,

                  finalUrl:
                    normalizedUrl

                });

              }
            );


            response.on(
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
    normalizeUrl(
      news.link
    );


  if (!url) {

    return {

      summary: "",

      status:
        "no-link"

    };
  }


  const result =
    await fetchPage(
      url
    );


  if (!result.ok) {

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
   * 1. Meta
   */

  let summary =
    extractMetaDescription(
      html
    );


  if (
    isUsefulSummary(
      summary
    )
  ) {

    return {

      summary:
        shorten(
          summary
        ),

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
    isUsefulSummary(
      summary
    )
  ) {

    return {

      summary:
        shorten(
          summary
        ),

      status:
        "jsonld"

    };
  }


  /*
   * 3. اولین پاراگراف
   */

  summary =
    extractFirstParagraph(
      html
    );


  if (
    isUsefulSummary(
      summary
    )
  ) {

    return {

      summary:
        shorten(
          summary
        ),

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
   بررسی اعتبار خلاصه قبلی
   ============================================================ */

function isValidPreviousSummary(
  item
) {

  if (!item) {
    return false;
  }


  if (
    !item.summary
  ) {
    return false;
  }


  return isUsefulSummary(
    item.summary
  );
}


/* ============================================================
   ساخت Map از خلاصه‌های قبلی
   ============================================================ */

function buildPreviousMap(
  previousData
) {

  const map =
    new Map();


  if (
    !previousData ||
    !Array.isArray(
      previousData.news
    )
  ) {

    return map;
  }


  for (
    const item of
    previousData.news
  ) {

    const key =
      getNewsKey(
        item
      );


    if (!key) {
      continue;
    }


    map.set(
      key,
      item
    );
  }


  return map;
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


  const count =
    Math.min(
      concurrency,
      items.length
    );


  const runners =
    Array.from(
      {
        length:
          count
      },
      runner
    );


  await Promise.all(
    runners
  );


  return results;
}


/* ============================================================
   ساخت رکورد نهایی خبر
   ============================================================ */

function buildNewsRecord(
  item,
  result
) {

  return {

    /*
     * decodeHtmlEntities به‌عنوان یک لایه محافظ:
     * جلوگیری از &amp;amp; و موارد مشابه
     */

    title:
      decodeHtmlEntities(
        item.title || ""
      ),

    link:
      item.link || "",

    source:
      item.source || "",

    category:
      item.category ||
      "متفرقه",

    flag:
      item.flag ||
      "📰",

    date:
      item.date || "",

    summary:
      result.summary || "",

    status:
      result.status ||
      "unknown"

  };
}


/* ============================================================
   اجرای اصلی
   ============================================================ */

async function main() {

  console.log("");
  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
  console.log(
    "📝 تولید چکیده خبرهای دیار قدمگاه"
  );
  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
  console.log("");


  /*
   * خواندن news.json
   */

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


  /*
   * خواندن خروجی قبلی
   */

  const previousData =
    readPreviousSummaries();


  const previousMap =
    buildPreviousMap(
      previousData
    );


  /*
   * تشخیص خبرهای نیازمند پردازش
   */

  const itemsToProcess = [];

  const preservedResults =
    new Array(
      news.length
    );


  let preservedCount = 0;


  for (
    let index = 0;
    index < news.length;
    index++
  ) {

    const item =
      news[index];


    const key =
      getNewsKey(
        item
      );


    const previous =
      key
        ? previousMap.get(
            key
          )
        : null;


    /*
     * اگر خلاصه قبلی معتبر باشد،
     * همان را حفظ می‌کنیم.
     */

    if (
      isValidPreviousSummary(
        previous
      )
    ) {

      preservedResults[index] = {

        summary:
          cleanText(
            previous.summary
          ),

        status:
          previous.status ||
          "preserved"

      };


      preservedCount++;

      continue;
    }


    itemsToProcess.push({

      item,

      index

    });
  }


  console.log(
    `♻️ خلاصه‌های قبلی معتبر: ${preservedCount}`
  );


  console.log(
    `🔎 نیازمند بررسی جدید: ${itemsToProcess.length}`
  );


  console.log("");


  /*
   * پردازش خبرهای جدید
   */

  const processed =
    await processWithConcurrency(
      itemsToProcess,

      async function(
        task
      ) {

        const item =
          task.item;


        const index =
          task.index;


        console.log(
          `⏳ [${index + 1}/${news.length}] ${
            item.source || ""
          } - ${
            item.title || ""
          }`
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
            `   ⚠️ چکیده پیدا نشد: ${
              result.status
            }`
          );
        }


        return {

          index,

          result

        };
      },

      CONCURRENCY
    );


  /*
   * قرار دادن نتایج پردازش‌شده
   */

  for (
    const entry of
    processed
  ) {

    if (!entry) {
      continue;
    }


    preservedResults[
      entry.index
    ] =
      entry.result;
  }


  /*
   * ساخت خروجی نهایی
   */

  const summaries =
    news.map(
      function(
        item,
        index
      ) {

        return buildNewsRecord(
          item,
          preservedResults[index] ||
          {
            summary: "",
            status:
              "unknown"
          }
        );
      }
    );


  /*
   * آمار
   */

  const successful =
    summaries.filter(
      function(item) {

        return Boolean(
          item.summary
        );
      }
    ).length;


  const missing =
    summaries.length -
    successful;


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
      missing,

    news:
      summaries

  };


  /*
   * ذخیره
   */

  fs.writeFileSync(

    OUTPUT_FILE,

    JSON.stringify(
      output,
      null,
      2
    ),

    "utf8"

  );


  /*
   * آمار وضعیت‌ها
   */

  const statusCounts =
    {};


  for (
    const item of
    summaries
  ) {

    const status =
      item.status ||
      "unknown";


    statusCounts[status] =
      (
        statusCounts[status] ||
        0
      ) + 1;
  }


  /*
   * نتیجه نهایی
   */

  console.log("");

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
    `♻️ خلاصه‌های حفظ‌شده: ${preservedCount}`
  );

  console.log(
    `📝 چکیده موجود: ${successful}`
  );

  console.log(
    `⚠️ چکیده موجود نیست: ${missing}`
  );

  console.log("");

  console.log(
    "📊 وضعیت پردازش:"
  );


  for (
    const [status, count]
    of Object.entries(
      statusCounts
    )
  ) {

    console.log(
      `   • ${status}: ${count}`
    );
  }


  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );

  console.log("");
}


/* ============================================================
   شروع
   ============================================================ */

main()
  .catch(
    function(error) {

      console.error("");

      console.error(
        "❌ خطای کلی:",
        error.message
      );

      console.error("");

      process.exit(1);
    }
  );

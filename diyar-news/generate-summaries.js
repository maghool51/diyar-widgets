const fs = require("fs");
const http = require("http");
const https = require("https");

/*
 * ============================================================
 * دیار قدمگاه | تولید چکیده خبرها - نسخه 3
 * ============================================================
 *
 * ورودی:
 *   news.json
 *
 * خروجی:
 *   news-summary.json
 *
 * ویژگی‌ها:
 *
 * 1) حفظ چکیده‌های معتبر قبلی
 * 2) پردازش فقط خبرهای فاقد چکیده
 * 3) دنبال کردن Redirect
 * 4) استخراج از:
 *      - og:description
 *      - description
 *      - twitter:description
 *      - JSON-LD
 *      - metaهای اختصاصی
 *      - متن واقعی مقاله
 *      - پاراگراف‌های مقاله
 *
 * 5) تشخیص اختصاصی سایت‌های خبری
 * 6) حذف متن‌های تبلیغاتی و عمومی
 * 7) کوتاه‌سازی طبیعی فارسی
 * 8) جلوگیری از خلاصه‌های ناقص
 * 9) کنترل هم‌زمانی درخواست‌ها
 * 10) عدم تولید خلاصه حدسی
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

const MIN_SUMMARY_LENGTH = 50;

const REQUEST_TIMEOUT = 15000;

const CONCURRENCY = 4;

const MAX_RESPONSE_SIZE = 1500000;

const MAX_REDIRECTS = 5;


/* ============================================================
   User-Agent
   ============================================================ */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36 " +
  "Diyar-Ghadamgah-NewsBot/3.0";


/* ============================================================
   خواندن JSON
   ============================================================ */

function readJsonFile(file) {

  if (!fs.existsSync(file)) {
    throw new Error(`فایل ${file} پیدا نشد.`);
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
      `JSON فایل ${file} معتبر نیست: ${error.message}`
    );
  }
}


/* ============================================================
   HTML Entity
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

    .replace(
      /&#(\d+);/g,
      function (_, code) {

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
      function (_, code) {

        try {
          return String.fromCodePoint(
            parseInt(code, 16)
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
        /<template[\s\S]*?<\/template>/gi,
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
    stripHtml(text);

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
        /\s+/g,
        " "
      )

      .replace(
        /\u200c{2,}/g,
        "\u200c"
      )

      .replace(
        /^(توضیحات|توضیح|خلاصه|چکیده)\s*[:：\-]\s*/i,
        ""
      )

      .trim();

  return value;
}


/* ============================================================
   URL
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
   تشخیص دامنه
   ============================================================ */

function getHostname(url) {

  try {

    return new URL(
      url
    ).hostname
      .toLowerCase()
      .replace(
        /^www\./,
        ""
      );

  } catch {

    return "";
  }
}


/* ============================================================
   تشخیص سایت خبری
   ============================================================ */

function detectSite(url) {

  const host =
    getHostname(url);

  if (!host) {
    return "unknown";
  }

  if (
    host.includes("irna.ir")
  ) {
    return "irna";
  }

  if (
    host.includes("isna.ir")
  ) {
    return "isna";
  }

  if (
    host.includes("mehrnews.com")
  ) {
    return "mehr";
  }

  if (
    host.includes("imna.ir")
  ) {
    return "imna";
  }

  if (
    host.includes("ilna.ir")
  ) {
    return "ilna";
  }

  if (
    host.includes("asriran.com")
  ) {
    return "asriran";
  }

  if (
    host.includes("tasnimnews.com")
  ) {
    return "tasnim";
  }

  if (
    host.includes("farsnews.ir")
  ) {
    return "fars";
  }

  if (
    host.includes("yjc.ir")
  ) {
    return "yjc";
  }

  return "generic";
}


/* ============================================================
   عبارات نامعتبر
   ============================================================ */

const BAD_PHRASES = [

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
  "کلیک کنید",
  "اینجا کلیک کنید",
  "دانلود کنید",
  "خبرنامه ایمیلی",
  "کانال رسمی",
  "صفحه رسمی",
  "اینستاگرام",
  "تلگرام",
  "واتساپ",
  "اپلیکیشن",
  "اپلیکیشن خبر",
  "همراه ما باشید"

];


/* ============================================================
   بررسی متن مفید
   ============================================================ */

function isUsefulSummary(text) {

  const value =
    cleanText(text);

  if (
    value.length <
    MIN_SUMMARY_LENGTH
  ) {
    return false;
  }

  const lower =
    value.toLowerCase();

  for (
    const phrase of
    BAD_PHRASES
  ) {

    if (
      lower.includes(
        phrase.toLowerCase()
      )
    ) {

      return false;
    }
  }


  /*
   * متن‌هایی که عمدتاً URL هستند
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
    withoutUrls.length <
    40
  ) {
    return false;
  }


  /*
   * متن خیلی شبیه عنوان کوتاه نباشد
   */

  if (
    value.split(/\s+/).length <
    8
  ) {
    return false;
  }


  return true;
}


/* ============================================================
   تشخیص پاراگراف خبری
   ============================================================ */

function isLikelyNewsParagraph(text) {

  const value =
    cleanText(text);

  if (
    !isUsefulSummary(value)
  ) {
    return false;
  }


  /*
   * پاراگراف‌هایی که فقط یک جمله خیلی کوتاه هستند
   */

  const words =
    value.split(
      /\s+/
    );


  if (
    words.length <
    10
  ) {
    return false;
  }


  /*
   * متن‌هایی که احتمالاً نویگیشن هستند
   */

  const navigationPatterns = [

    /^خانه\b/i,
    /^خبر\b$/i,
    /^اخبار\b$/i,
    /^سرویس\b/i,
    /^صفحه\b/i,
    /^منو\b/i,
    /^جستجو\b/i

  ];


  if (
    navigationPatterns.some(
      pattern =>
        pattern.test(value)
    )
  ) {
    return false;
  }


  return true;
}


/* ============================================================
   کوتاه‌سازی طبیعی
   ============================================================ */

function shorten(text) {

  const value =
    cleanText(text);

  if (!value) {
    return "";
  }

  if (
    value.length <=
    MAX_SUMMARY_LENGTH
  ) {
    return value;
  }


  const candidate =
    value.slice(
      0,
      MAX_SUMMARY_LENGTH
    );


  /*
   * اولویت با پایان جمله
   */

  const sentenceMarks = [
    "؟",
    "!",
    "؛",
    ".",
    "۔",
    "！"
  ];


  let bestEnd = -1;


  for (
    const mark of
    sentenceMarks
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
   * اگر پایان جمله در محدوده مناسب باشد
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
   * کوتاه‌سازی در آخرین فاصله
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
   استخراج Meta
   ============================================================ */

function extractMetaDescription(
  html
) {

  const patterns = [

    /<meta\b[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i,

    /<meta\b[^>]*content=["']([\s\S]*?)["'][^>]*property=["']og:description["'][^>]*>/i,

    /<meta\b[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i,

    /<meta\b[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["'][^>]*>/i,

    /<meta\b[^>]*name=["']twitter:description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i,

    /<meta\b[^>]*content=["']([\s\S]*?)["'][^>]*name=["']twitter:description["'][^>]*>/i

  ];


  for (
    const pattern of
    patterns
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


  const candidates = [];


  function collect(value) {

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
        const item of
        value
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
        value.articleBody
      ) {

        candidates.push(
          value.articleBody
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


  for (
    const script of
    scripts
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

      collect(
        data
      );

    } catch {

      /*
       * JSON-LD نامعتبر
       */
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
   استخراج عنوان HTML
   ============================================================ */

function extractHtmlTitle(
  html
) {

  const match =
    html.match(
      /<title\b[^>]*>([\s\S]*?)<\/title>/i
    );


  if (!match) {
    return "";
  }


  return cleanText(
    match[1]
  );
}


/* ============================================================
   استخراج Article Body از JSON-LD
   ============================================================ */

function extractJsonLdArticleBody(
  html
) {

  const scripts =
    html.match(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
    );


  if (!scripts) {
    return "";
  }


  function findBody(
    value
  ) {

    if (!value) {
      return "";
    }


    if (
      Array.isArray(
        value
      )
    ) {

      for (
        const item of
        value
      ) {

        const result =
          findBody(
            item
          );

        if (result) {
          return result;
        }
      }

      return "";
    }


    if (
      typeof value !==
      "object"
    ) {

      return "";
    }


    if (
      typeof value.articleBody ===
      "string"
    ) {

      return value.articleBody;
    }


    if (
      value["@graph"]
    ) {

      return findBody(
        value["@graph"]
      );
    }


    return "";
  }


  for (
    const script of
    scripts
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


      const body =
        findBody(
          data
        );


      if (
        isLikelyNewsParagraph(
          body
        )
      ) {

        return body;
      }

    } catch {
      continue;
    }
  }


  return "";
}


/* ============================================================
   استخراج پاراگراف‌ها
   ============================================================ */

function extractParagraphs(
  html
) {

  const paragraphs =
    html.match(
      /<p\b[^>]*>[\s\S]*?<\/p>/gi
    );


  if (!paragraphs) {
    return [];
  }


  return paragraphs

    .map(
      paragraph =>
        cleanText(
          paragraph
        )
    )

    .filter(
      paragraph =>
        isLikelyNewsParagraph(
          paragraph
        )
    );
}


/* ============================================================
   استخراج Article
   ============================================================ */

function extractArticleAreas(
  html
) {

  const areas = [];


  const patterns = [

    /<article\b[^>]*>[\s\S]*?<\/article>/gi,

    /<main\b[^>]*>[\s\S]*?<\/main>/gi,

    /<div\b[^>]*(?:class|id)=["'][^"']*(?:article|story|news-content|news-body|article-body|post-content|entry-content)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi

  ];


  for (
    const pattern of
    patterns
  ) {

    const matches =
      html.match(
        pattern
      );


    if (
      matches
    ) {

      areas.push(
        ...matches
      );
    }
  }


  return areas;
}


/* ============================================================
   استخراج متن مقاله
   ============================================================ */

function extractArticleText(
  html,
  site
) {

  /*
   * ابتدا JSON-LD articleBody
   */

  const jsonBody =
    extractJsonLdArticleBody(
      html
    );


  if (
    isLikelyNewsParagraph(
      jsonBody
    )
  ) {

    return jsonBody;
  }


  /*
   * نواحی مقاله
   */

  const areas =
    extractArticleAreas(
      html
    );


  /*
   * اگر ناحیه مقاله داریم،
   * پاراگراف‌های آن را بررسی می‌کنیم.
   */

  for (
    const area of
    areas
  ) {

    const paragraphs =
      extractParagraphs(
        area
      );


    if (
      paragraphs.length
    ) {

      /*
       * برای اکثر سایت‌ها
       * پاراگراف اول بهترین خلاصه است.
       */

      for (
        const paragraph of
        paragraphs
      ) {

        if (
          paragraph.length >= 70
        ) {

          return paragraph;
        }
      }
    }
  }


  /*
   * حالت عمومی
   */

  const paragraphs =
    extractParagraphs(
      html
    );


  /*
   * پاراگراف‌های بسیار کوتاه را حذف می‌کنیم.
   */

  const strongCandidates =
    paragraphs.filter(
      paragraph =>
        paragraph.length >= 70
    );


  /*
   * سایت‌های خاص
   *
   * فعلاً از همان متن واقعی صفحه استفاده می‌کنیم؛
   * اما ترتیب انتخاب برای سایت‌ها متفاوت است.
   */

  if (
    site === "irna" ||
    site === "isna" ||
    site === "mehr" ||
    site === "imna" ||
    site === "ilna"
  ) {

    if (
      strongCandidates.length
    ) {

      return strongCandidates[0];
    }
  }


  if (
    strongCandidates.length
  ) {

    return strongCandidates[0];
  }


  return "";
}


/* ============================================================
   استخراج چکیده اختصاصی
   ============================================================ */

function extractSiteSpecificSummary(
  html,
  site
) {

  /*
   * کلاس‌ها و ساختارهای رایج سایت‌های خبری
   */

  const selectors = {

    irna: [
      "article",
      ".item-text",
      ".news-body",
      ".article-body",
      ".body-news",
      ".news-text",
      ".article-content"
    ],

    isna: [
      "article",
      ".item-text",
      ".news-body",
      ".article-body",
      ".news-content",
      ".article-content",
      ".single-content"
    ],

    mehr: [
      "article",
      ".item-text",
      ".news-body",
      ".article-body",
      ".news-content",
      ".article-content"
    ],

    imna: [
      "article",
      ".item-text",
      ".news-body",
      ".article-body",
      ".news-content",
      ".article-content"
    ],

    ilna: [
      "article",
      ".item-text",
      ".news-body",
      ".article-body",
      ".news-content",
      ".article-content"
    ]

  };


  const siteSelectors =
    selectors[site];


  if (!siteSelectors) {
    return "";
  }


  /*
   * تبدیل selectorهای ساده به regex
   */

  for (
    const selector of
    siteSelectors
  ) {

    if (
      selector ===
      "article"
    ) {

      const articleMatch =
        html.match(
          /<article\b[^>]*>[\s\S]*?<\/article>/i
        );


      if (
        articleMatch
      ) {

        const paragraphs =
          extractParagraphs(
            articleMatch[0]
          );


        if (
          paragraphs.length
        ) {

          return paragraphs[0];
        }
      }


      continue;
    }


    const className =
      selector
        .replace(
          /^\./,
          ""
        );


    const regex =
      new RegExp(
        `<[^>]+(?:class|id)=["'][^"']*${className}[^"']*["'][^>]*>[\\\\s\\\\S]*?<\\\\/[^>]+>`,
        "i"
      );


    const match =
      html.match(
        regex
      );


    if (
      match
    ) {

      const paragraphs =
        extractParagraphs(
          match[0]
        );


      if (
        paragraphs.length
      ) {

        return paragraphs[0];
      }
    }
  }


  return "";
}


/* ============================================================
   دریافت صفحه
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


      const normalized =
        normalizeUrl(
          url
        );


      if (!normalized) {

        finish({

          ok: false,

          error:
            "لینک نامعتبر"

        });

        return;
      }


      let parsed;

      try {

        parsed =
          new URL(
            normalized
          );

      } catch {

        finish({

          ok: false,

          error:
            "لینک نامعتبر"

        });

        return;
      }


      const client =
        parsed.protocol ===
        "https:"
          ? https
          : http;


      const request =
        client.get(

          parsed,

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
                    "Redirect بیش از حد"

                });

                return;
              }


              let nextUrl;

              try {

                nextUrl =
                  new URL(
                    location,
                    normalized
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

                const size =
                  Buffer.byteLength(
                    chunk,
                    "utf8"
                  );


                received +=
                  size;


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
                    normalized

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
   تولید خلاصه
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


  const site =
    detectSite(
      url
    );


  const page =
    await fetchPage(
      url
    );


  if (!page.ok) {

    return {

      summary: "",

      status:
        page.error ||
        "fetch-failed"

    };
  }


  const html =
    page.html;


  /*
   * ----------------------------------------------------------
   * مرحله 1
   * Meta
   * ----------------------------------------------------------
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
   * ----------------------------------------------------------
   * مرحله 2
   * JSON-LD description
   * ----------------------------------------------------------
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
   * ----------------------------------------------------------
   * مرحله 3
   * استخراج اختصاصی سایت
   * ----------------------------------------------------------
   */

  summary =
    extractSiteSpecificSummary(
      html,
      site
    );


  if (
    isLikelyNewsParagraph(
      summary
    )
  ) {

    return {

      summary:
        shorten(
          summary
        ),

      status:
        `site-${site}`

    };
  }


  /*
   * ----------------------------------------------------------
   * مرحله 4
   * متن مقاله
   * ----------------------------------------------------------
   */

  summary =
    extractArticleText(
      html,
      site
    );


  if (
    isLikelyNewsParagraph(
      summary
    )
  ) {

    return {

      summary:
        shorten(
          summary
        ),

      status:
        `article-${site}`

    };
  }


  /*
   * ----------------------------------------------------------
   * مرحله 5
   * اولین پاراگراف مناسب
   * ----------------------------------------------------------
   */

  const paragraphs =
    extractParagraphs(
      html
    );


  for (
    const paragraph of
    paragraphs
  ) {

    if (
      paragraph.length >= 70
    ) {

      return {

        summary:
          shorten(
            paragraph
          ),

        status:
          "paragraph"

      };
    }
  }


  /*
   * ----------------------------------------------------------
   * هیچ متن معتبر پیدا نشد
   * ----------------------------------------------------------
   */

  return {

    summary: "",

    status:
      "not-found"

  };
}


/* ============================================================
   کلید خبر
   ============================================================ */

function getNewsKey(
  item
) {

  const link =
    normalizeUrl(
      item.link
    );


  if (link) {

    return `link:${link}`;
  }


  const title =
    cleanText(
      item.title || ""
    );


  if (title) {

    return `title:${title}`;
  }


  return "";
}


/* ============================================================
   اعتبار خلاصه قبلی
   ============================================================ */

function isValidPreviousSummary(
  item
) {

  if (!item) {
    return false;
  }


  return isUsefulSummary(
    item.summary
  );
}


/* ============================================================
   ساخت Map خلاصه‌های قبلی
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
   پردازش هم‌زمان
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
   ساخت رکورد خبر
   ============================================================ */

function buildNewsRecord(
  item,
  result
) {

  return {

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
    "📝 دیار قدمگاه | تولید چکیده نسخه 3"
  );

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );

  console.log("");


  /*
   * news.json
   */

  const data =
    readJsonFile(
      INPUT_FILE
    );


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
   * خلاصه قبلی
   */

  const previousData =
    fs.existsSync(
      OUTPUT_FILE
    )
      ? readJsonFile(
          OUTPUT_FILE
        )
      : null;


  const previousMap =
    buildPreviousMap(
      previousData
    );


  const finalResults =
    new Array(
      news.length
    );


  const tasks = [];


  let preserved =
    0;


  /*
   * تشخیص cache
   */

  for (
    let i = 0;
    i < news.length;
    i++
  ) {

    const item =
      news[i];


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


    if (
      isValidPreviousSummary(
        previous
      )
    ) {

      finalResults[i] = {

        summary:
          cleanText(
            previous.summary
          ),

        status:
          previous.status ||
          "preserved"

      };


      preserved++;

    } else {

      tasks.push({

        item,

        index:
          i

      });
    }
  }


  console.log(
    `♻️ خلاصه‌های معتبر حفظ‌شده: ${preserved}`
  );

  console.log(
    `🔎 خبرهای نیازمند پردازش: ${tasks.length}`
  );

  console.log("");


  /*
   * پردازش
   */

  const processed =
    await processWithConcurrency(

      tasks,

      async function(task) {

        const item =
          task.item;


        const index =
          task.index;


        const site =
          detectSite(
            item.link
          );


        console.log(
          `⏳ [${index + 1}/${news.length}] [${site}] ${
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
            `   ✅ ${result.status} | ${result.summary}`
          );

        } else {

          console.log(
            `   ⚠️ ${result.status}`
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
   * انتقال نتایج
   */

  for (
    const entry of
    processed
  ) {

    if (!entry) {
      continue;
    }


    finalResults[
      entry.index
    ] =
      entry.result;
  }


  /*
   * ساخت خروجی
   */

  const summaries =
    news.map(
      function(item, index) {

        return buildNewsRecord(

          item,

          finalResults[index] || {

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
      item =>
        Boolean(
          item.summary
        )
    ).length;


  const missing =
    summaries.length -
    successful;


  /*
   * وضعیت‌ها
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
   * خروجی نهایی
   */

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
   * گزارش
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
    `♻️ حفظ‌شده: ${preserved}`
  );

  console.log(
    `📝 چکیده موجود: ${successful}`
  );

  console.log(
    `⚠️ چکیده موجود نیست: ${missing}`
  );

  console.log("");

  console.log(
    "📊 وضعیت استخراج:"
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

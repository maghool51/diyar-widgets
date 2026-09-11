"use strict";

/*
=========================================================
 generate-summaries.js
 اخبار دیار قدمگاه
 نسخه اصلاح‌شده و پایدار

 ورودی:
   ./news.json

 خروجی:
   ./news-summary.json

 ویژگی‌ها:
   - حفظ خلاصه‌های سالم قبلی
   - بازسازی خلاصه‌های ناقص
   - دنبال کردن Redirect
   - استخراج از OG / Meta / JSON-LD / Article / Paragraph
   - پشتیبانی بهتر از سایت‌های خبری
   - جلوگیری از قطع شدن جمله
   - اضافه کردن ... در پایان خلاصه‌های کوتاه‌شده
   - استانداردسازی سه‌نقطه‌های خراب
   - حذف متن‌های تبلیغاتی
   - عدم تولید خلاصه حدسی
=========================================================
*/

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");


/* ========================================================
   CONFIG
======================================================== */

const INPUT_FILE =
    path.join(__dirname, "news.json");

const OUTPUT_FILE =
    path.join(__dirname, "news-summary.json");

const MAX_SUMMARY_LENGTH = 220;

const MIN_SUMMARY_LENGTH = 45;

const REQUEST_TIMEOUT = 15000;

const MAX_RESPONSE_SIZE = 2000000;

const MAX_REDIRECTS = 5;

const CONCURRENCY = 4;

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/140.0 Safari/537.36 " +
    "Diyar-Ghadamgah-NewsBot/3.0";


/* ========================================================
   GENERAL HELPERS
======================================================== */

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function cleanText(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/\r/g, " ")
        .replace(/\t/g, " ")
        .replace(/\u00a0/g, " ")
        .replace(/\u200c{2,}/g, "\u200c")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}


/* ========================================================
   HTML ENTITIES
======================================================== */

function decodeHtmlEntities(text) {

    if (!text) {
        return "";
    }

    return String(text)
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&hellip;/gi, "…")
        .replace(/&ndash;/gi, "–")
        .replace(/&mdash;/gi, "—")
        .replace(/&#(\d+);/g, (_, n) =>
            String.fromCharCode(Number(n))
        )
        .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
            String.fromCharCode(
                parseInt(n, 16)
            )
        );
}


/* ========================================================
   HTML CLEANING
======================================================== */

function stripHtml(html) {

    if (!html) {
        return "";
    }

    let text = String(html);

    text = text
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<header[\s\S]*?<\/header>/gi, " ")
        .replace(/<form[\s\S]*?<\/form>/gi, " ")
        .replace(/<button[\s\S]*?<\/button>/gi, " ")
        .replace(/<aside[\s\S]*?<\/aside>/gi, " ");

    text = text
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/article>/gi, "\n")
        .replace(/<\/li>/gi, "\n");

    text = text.replace(/<[^>]+>/g, " ");

    text = decodeHtmlEntities(text);

    return cleanText(text);
}


/* ========================================================
   NORMALIZE PERSIAN TEXT
======================================================== */

function normalizePersianText(text) {

    if (!text) {
        return "";
    }

    let value =
        cleanText(text)
            .replace(/ي/g, "ی")
            .replace(/ى/g, "ی")
            .replace(/ك/g, "ک")
            .replace(/ۀ/g, "ه")
            .replace(/ة/g, "ه")
            .replace(/\u0640+/g, "")
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, "'");

    /*
       استانداردسازی سه‌نقطه‌های خراب در پایان متن.

       نمونه‌های خراب:
         . ..
         .. .
         ... ..
         ....
         …..
         .…
         … .
    */

    value =
        value
            .replace(
                /(?:\s*[.]{1,}\s*){2,}$/g,
                "..."
            )
            .replace(
                /(?:\s*…\s*){2,}$/g,
                "..."
            )
            .replace(
                /(?:\s*[.]?\s*…\s*)$/g,
                "..."
            );

    /*
       اگر پایان متن ترکیبی از نقطه و سه‌نقطه باشد،
       آن را به یک ... استاندارد تبدیل می‌کنیم.
    */

    if (
        /(?:\.|\s|…)+$/.test(value) &&
        /(?:\.{2,}|…)/.test(value.slice(-6))
    ) {

        value =
            value
                .replace(
                    /[\s.…]+$/,
                    "..."
                );
    }

    value =
        value
            .replace(/[ ]+([،؛:!؟,.])/g, "$1")
            .replace(/([،؛:!؟,.])([^\s])/g, "$1 $2")
            .replace(/\s{2,}/g, " ")
            .trim();

    return value;
}


/* ========================================================
   ELLIPSIS HELPERS
======================================================== */

function hasEllipsisEnding(text) {

    if (!text) {
        return false;
    }

    const value =
        cleanText(text);

    return (
        value.endsWith("...") ||
        value.endsWith("…")
    );
}


function normalizeEllipsisEnding(text) {

    if (!text) {
        return "";
    }

    let value =
        cleanText(text);

    /*
       هر نوع سه‌نقطه یا نقطه‌های پشت سر هم
       در انتهای متن به ... تبدیل می‌شود.
    */

    if (
        /(?:\.|\s|…)+$/.test(value)
    ) {

        const tail =
            value.slice(-8);

        if (
            /(?:\.{2,}|…)/.test(tail)
        ) {

            value =
                value
                    .replace(
                        /[\s.…]+$/,
                        "..."
                    );
        }
    }

    return value.trim();
}


/* ========================================================
   URL
======================================================== */

function normalizeUrl(value) {

    const text =
        cleanText(value);

    if (!text) {
        return "";
    }

    if (
        text.startsWith("http://") ||
        text.startsWith("https://")
    ) {
        return text;
    }

    return "";
}


/* ========================================================
   SITE DETECTION
======================================================== */

function detectSite(url) {

    try {

        const hostname =
            new URL(url)
                .hostname
                .toLowerCase();

        if (hostname.includes("irna.ir")) {
            return "irna";
        }

        if (hostname.includes("isna.ir")) {
            return "isna";
        }

        if (hostname.includes("mehrnews.com")) {
            return "mehr";
        }

        if (hostname.includes("imna.ir")) {
            return "imna";
        }

        if (hostname.includes("ilna.ir")) {
            return "ilna";
        }

        if (hostname.includes("tasnimnews.com")) {
            return "tasnim";
        }

        if (hostname.includes("farsnews.ir")) {
            return "fars";
        }

        if (hostname.includes("khabaronline.ir")) {
            return "khabaronline";
        }

        if (hostname.includes("asriran.com")) {
            return "asriran";
        }

        if (hostname.includes("yjc.ir")) {
            return "yjc";
        }

        return "generic";

    } catch {

        return "generic";
    }
}


/* ========================================================
   REQUEST
======================================================== */

function requestPage(url, redirectCount = 0) {

    return new Promise((resolve, reject) => {

        if (redirectCount > MAX_REDIRECTS) {

            reject(
                new Error("Too many redirects")
            );

            return;
        }

        let parsed;

        try {
            parsed = new URL(url);
        } catch {

            reject(
                new Error("Invalid URL")
            );

            return;
        }

        const client =
            parsed.protocol === "https:"
                ? https
                : http;

        const request =
            client.get(
                parsed,
                {
                    headers: {
                        "User-Agent": USER_AGENT,
                        "Accept":
                            "text/html,application/xhtml+xml",
                        "Accept-Language":
                            "fa-IR,fa;q=0.9,en;q=0.5",
                        "Cache-Control":
                            "no-cache"
                    }
                },
                response => {

                    const status =
                        response.statusCode || 0;

                    if (
                        [301,302,303,307,308]
                            .includes(status)
                    ) {

                        const location =
                            response.headers.location;

                        response.resume();

                        if (!location) {

                            reject(
                                new Error(
                                    "Redirect without location"
                                )
                            );

                            return;
                        }

                        const nextUrl =
                            new URL(
                                location,
                                url
                            ).toString();

                        requestPage(
                            nextUrl,
                            redirectCount + 1
                        )
                            .then(resolve)
                            .catch(reject);

                        return;
                    }

                    if (
                        status < 200 ||
                        status >= 300
                    ) {

                        response.resume();

                        reject(
                            new Error(
                                "HTTP " + status
                            )
                        );

                        return;
                    }

                    const chunks = [];

                    let totalSize = 0;

                    response.on(
                        "data",
                        chunk => {

                            totalSize +=
                                chunk.length;

                            if (
                                totalSize >
                                MAX_RESPONSE_SIZE
                            ) {

                                response.destroy(
                                    new Error(
                                        "Response too large"
                                    )
                                );

                                return;
                            }

                            chunks.push(chunk);

                        }
                    );

                    response.on(
                        "end",
                        () => {

                            const buffer =
                                Buffer.concat(chunks);

                            const contentType =
                                String(
                                    response.headers[
                                        "content-type"
                                    ] || ""
                                );

                            resolve({
                                url,
                                status,
                                contentType,
                                html:
                                    buffer.toString("utf8")
                            });

                        }
                    );

                }
            );

        request.setTimeout(
            REQUEST_TIMEOUT,
            () => {

                request.destroy(
                    new Error(
                        "Request timeout"
                    )
                );

            }
        );

        request.on(
            "error",
            reject
        );

    });
}


/* ========================================================
   META EXTRACTION
======================================================== */

function getMetaAttributes(html) {

    const result = [];

    const regex =
        /<meta\b[^>]*>/gi;

    const tags =
        html.match(regex) || [];

    for (const tag of tags) {

        const attrs = {};

        const attrRegex =
            /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

        let match;

        while (
            (match = attrRegex.exec(tag))
        ) {

            attrs[
                match[1].toLowerCase()
            ] =
                match[2] ??
                match[3] ??
                match[4] ??
                "";

        }

        result.push(attrs);
    }

    return result;
}


function extractMetaDescriptions(html) {

    const metas =
        getMetaAttributes(html);

    const candidates = [];

    for (const meta of metas) {

        const key =
            (
                meta.name ||
                meta.property ||
                meta.itemprop ||
                ""
            ).toLowerCase();

        const content =
            normalizePersianText(
                decodeHtmlEntities(
                    meta.content || ""
                )
            );

        if (!content) {
            continue;
        }

        if (
            key === "og:description" ||
            key === "description" ||
            key === "twitter:description" ||
            key === "twitter:card"
        ) {

            candidates.push(content);
        }

        if (
            key === "article:description" ||
            key === "description"
        ) {

            candidates.push(content);
        }
    }

    return uniqueTexts(candidates);
}


/* ========================================================
   JSON-LD
======================================================== */

function extractJsonLd(html) {

    const result = [];

    const regex =
        /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

    let match;

    while (
        (match = regex.exec(html))
    ) {

        let raw =
            match[1]
                .trim();

        if (!raw) {
            continue;
        }

        raw =
            raw
                .replace(/^\uFEFF/, "")
                .replace(/<!--/g, "")
                .replace(/-->/g, "")
                .trim();

        try {

            const data =
                JSON.parse(raw);

            collectJsonLd(
                data,
                result
            );

        } catch {

            /*
               JSON-LD خراب را نادیده می‌گیریم.
            */
        }
    }

    return result;
}


function collectJsonLd(
    data,
    result
) {

    if (!data) {
        return;
    }

    if (Array.isArray(data)) {

        data.forEach(item =>
            collectJsonLd(
                item,
                result
            )
        );

        return;
    }

    if (
        typeof data !== "object"
    ) {
        return;
    }

    if (
        typeof data.description ===
        "string"
    ) {

        result.push(
            normalizePersianText(
                decodeHtmlEntities(
                    data.description
                )
            )
        );
    }

    if (
        typeof data.articleBody ===
        "string"
    ) {

        result.push(
            normalizePersianText(
                decodeHtmlEntities(
                    data.articleBody
                )
            )
        );
    }

    if (data["@graph"]) {

        collectJsonLd(
            data["@graph"],
            result
        );
    }
}


/* ========================================================
   TITLE FROM PAGE
======================================================== */

function extractPageTitle(html) {

    const match =
        html.match(
            /<title[^>]*>([\s\S]*?)<\/title>/i
        );

    if (!match) {
        return "";
    }

    return normalizePersianText(
        stripHtml(
            match[1]
        )
    );
}


/* ========================================================
   ARTICLE PARAGRAPHS
======================================================== */

function extractParagraphs(html) {

    const paragraphs = [];

    const regex =
        /<p\b[^>]*>([\s\S]*?)<\/p>/gi;

    let match;

    while (
        (match = regex.exec(html))
    ) {

        const text =
            normalizePersianText(
                stripHtml(
                    match[1]
                )
            );

        if (
            text.length >=
            MIN_SUMMARY_LENGTH
        ) {

            paragraphs.push(text);
        }
    }

    return uniqueTexts(
        paragraphs
    );
}


/* ========================================================
   ARTICLE AREAS
======================================================== */

function extractArticleAreas(html) {

    const areas = [];

    const patterns = [

        /<article\b[^>]*>([\s\S]*?)<\/article>/gi,

        /<main\b[^>]*>([\s\S]*?)<\/main>/gi,

        /<div[^>]+class=["'][^"']*(?:article|news|content|body|detail|post)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi

    ];

    for (const regex of patterns) {

        let match;

        while (
            (match = regex.exec(html))
        ) {

            const text =
                stripHtml(
                    match[1]
                );

            if (
                text.length >=
                MIN_SUMMARY_LENGTH
            ) {

                areas.push(text);
            }
        }
    }

    return uniqueTexts(areas);
}


/* ========================================================
   SITE SPECIFIC EXTRACTION
======================================================== */

function extractSiteSpecificSummary(
    html,
    site
) {

    const selectors = {

        irna: [
            /<div[^>]+class=["'][^"']*(?:body|item-body|news-body|article-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
            /<article[^>]*>([\s\S]*?)<\/article>/gi
        ],

        isna: [
            /<div[^>]+class=["'][^"']*(?:item-text|news-text|article-text|content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
            /<article[^>]*>([\s\S]*?)<\/article>/gi
        ],

        mehr: [
            /<div[^>]+class=["'][^"']*(?:item-text|article-body|news-body|content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
            /<article[^>]*>([\s\S]*?)<\/article>/gi
        ],

        imna: [
            /<div[^>]+class=["'][^"']*(?:news-body|item-body|article-body|content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
            /<article[^>]*>([\s\S]*?)<\/article>/gi
        ],

        ilna: [
            /<div[^>]+class=["'][^"']*(?:news-body|article-body|item-body|content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
            /<article[^>]*>([\s\S]*?)<\/article>/gi
        ],

        tasnim: [
            /<div[^>]+class=["'][^"']*(?:body|news-body|content|article-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
            /<article[^>]*>([\s\S]*?)<\/article>/gi
        ],

        fars: [
            /<div[^>]+class=["'][^"']*(?:news-body|body|content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
            /<article[^>]*>([\s\S]*?)<\/article>/gi
        ],

        khabaronline: [
            /<div[^>]+class=["'][^"']*(?:body|content|article-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
            /<article[^>]*>([\s\S]*?)<\/article>/gi
        ],

        asriran: [
            /<div[^>]+class=["'][^"']*(?:body|content|article-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
            /<article[^>]*>([\s\S]*?)<\/article>/gi
        ],

        yjc: [
            /<div[^>]+class=["'][^"']*(?:news-text|content|article-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
            /<article[^>]*>([\s\S]*?)<\/article>/gi
        ]

    };

    const patterns =
        selectors[site] || [];

    const candidates = [];

    for (const regex of patterns) {

        let match;

        while (
            (match = regex.exec(html))
        ) {

            const text =
                normalizePersianText(
                    stripHtml(
                        match[1]
                    )
                );

            if (
                text.length >=
                MIN_SUMMARY_LENGTH
            ) {

                candidates.push(text);
            }
        }
    }

    return uniqueTexts(candidates);
}


/* ========================================================
   UNIQUE
======================================================== */

function uniqueTexts(values) {

    const seen =
        new Set();

    const result = [];

    for (const value of values) {

        const text =
            normalizePersianText(
                value
            );

        if (!text) {
            continue;
        }

        const key =
            text
                .replace(/\s+/g, " ")
                .trim();

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);

        result.push(text);
    }

    return result;
}


/* ========================================================
   BAD / USELESS TEXT
======================================================== */

const BAD_PHRASES = [

    "بیشتر بخوانید",

    "ادامه مطلب",

    "ادامه خبر",

    "برای مشاهده ادامه",

    "برای خواندن ادامه",

    "کلیک کنید",

    "اینجا کلیک",

    "منبع:",

    "ارسال نظر",

    "نظرات",

    "تبلیغات",

    "خبرنامه",

    "عضویت در خبرنامه",

    "کانال تلگرام",

    "کانال ایتا",

    "کانال روبیکا",

    "واتساپ",

    "اینستاگرام",

    "لینکدین",

    "دنبال کنید",

    "پیشنهاد سردبیر",

    "اخبار مرتبط",

    "مطالب مرتبط",

    "گزارش تصویری",

    "تصاویر بیشتر",

    "کد خبر",

    "کدخبر",

    "انتهای پیام",

    "پایان پیام"

];


function containsBadPhrase(text) {

    const lower =
        text.toLowerCase();

    return BAD_PHRASES.some(
        phrase =>
            lower.includes(
                phrase.toLowerCase()
            )
    );
}


/* ========================================================
   TRUNCATION HELPERS
======================================================== */

function removeTrailingIncomplete(text) {

    let value =
        normalizePersianText(text);

    /*
       سه‌نقطه معتبر را حذف نمی‌کنیم
       تا بتوانیم تشخیص دهیم که خلاصه
       عمداً کوتاه شده است.

       فقط علائم ناقص معمول حذف می‌شوند.
    */

    value =
        value
            .replace(/,+$/g, "")
            .replace(/،+$/g, "")
            .replace(/[:؛]+$/g, "")
            .trim();

    return value;
}


function hasStrongEnding(text) {

    if (!text) {
        return false;
    }

    const value =
        cleanText(text);

    if (
        hasEllipsisEnding(value)
    ) {
        return true;
    }

    return /[.!؟،؛]$/.test(
        value
    );
}


function findSentenceEndings(text) {

    const positions = [];

    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        const char =
            text[i];

        if (
            char === "؟" ||
            char === "!"
        ) {

            positions.push(
                i + 1
            );

            continue;
        }

        if (char === ".") {

            /*
               اگر این نقطه بخشی از
               سه‌نقطه باشد، آن را
               پایان جمله مستقل حساب نکن.
            */

            if (
                text[i + 1] === "." ||
                text[i - 1] === "."
            ) {
                continue;
            }

            const next =
                text[i + 1] || "";

            /*
               اعشار و موارد مشابه
            */

            if (
                /\d/.test(next)
            ) {
                continue;
            }

            positions.push(
                i + 1
            );

            continue;
        }

        /*
           نقطه پایان فارسی/عربی
        */

        if (
            char === "؛"
        ) {

            positions.push(
                i + 1
            );
        }
    }

    return positions;
}


/* ========================================================
   NATURAL SHORTENING
======================================================== */

function shortenNaturally(
    text,
    maxLength = MAX_SUMMARY_LENGTH
) {

    let value =
        normalizePersianText(text);

    if (!value) {
        return "";
    }

    /*
       اگر متن قبلاً با ... تمام شده،
       آن را فقط برای پیدا کردن طول
       واقعی متن حذف می‌کنیم.
    */

    if (
        hasEllipsisEnding(value)
    ) {

        value =
            value
                .replace(
                    /(?:\s*\.{3}|\s*…)$/,
                    ""
                )
                .trim();
    }

    value =
        removeTrailingIncomplete(
            value
        );

    if (!value) {
        return "";
    }

    /*
       اگر متن داخل محدوده است و پایان
       مناسبی دارد، بدون سه‌نقطه برگردانده
       می‌شود.
    */

    if (
        value.length <= maxLength &&
        hasStrongEnding(value)
    ) {

        return normalizeEllipsisEnding(
            value
        );
    }

    /*
       ابتدا تلاش می‌کنیم یک جمله کامل
       قبل از سقف پیدا کنیم.
    */

    const endings =
        findSentenceEndings(
            value
        );

    let best = "";

    for (const end of endings) {

        if (end <= maxLength) {

            const candidate =
                value
                    .slice(0, end)
                    .trim();

            if (
                candidate.length >=
                MIN_SUMMARY_LENGTH
            ) {

                best = candidate;
            }
        }
    }

    /*
       اگر جمله کامل پیدا شد،
       نیازی به ... نیست.
    */

    if (best) {

        return normalizeEllipsisEnding(
            best
        );
    }

    /*
       اگر متن از سقف عبور کرده و
       جمله کاملی در محدوده وجود ندارد،
       سه کاراکتر برای ... رزرو می‌کنیم.
    */

    const needsEllipsis =
        value.length > maxLength;

    const suffix =
        needsEllipsis
            ? "..."
            : "";

    const availableLength =
        Math.max(
            MIN_SUMMARY_LENGTH,
            maxLength -
                suffix.length
        );

    let cut =
        Math.min(
            availableLength,
            value.length
        );

    let candidate =
        value.slice(
            0,
            cut
        );

    /*
       آخرین فاصله مناسب را پیدا می‌کنیم
       تا کلمه نصفه نشود.
    */

    let space =
        candidate.lastIndexOf(" ");

    if (
        space >=
        MIN_SUMMARY_LENGTH
    ) {

        cut = space;

    } else {

        space = cut;
    }

    let result =
        value
            .slice(
                0,
                space
            )
            .trim();

    /*
       انتهای نیمه‌کاره حذف شود.
    */

    result =
        removeTrailingIncomplete(
            result
        );

    /*
       اگر آخر کار هنوز علامت نامناسب
       باقی مانده باشد.
    */

    result =
        result
            .replace(/[،:؛]+$/g, "")
            .trim();

    /*
       اگر واقعاً متن بریده شده،
       سه نقطه استاندارد اضافه می‌کنیم.
    */

    if (
        needsEllipsis &&
        result
    ) {

        /*
           اگر خود result به هر دلیلی
           سه‌نقطه داشت، دوباره اضافه نکن.
        */

        result =
            result
                .replace(
                    /[\s.…]+$/,
                    ""
                )
                .trim();

        return (
            result +
            suffix
        );
    }

    return result;
}


/* ========================================================
   FINAL SUMMARY NORMALIZER
======================================================== */

function finalizeSummary(
    text,
    maxLength = MAX_SUMMARY_LENGTH
) {

    if (!text) {
        return "";
    }

    let value =
        normalizePersianText(text);

    if (!value) {
        return "";
    }

    /*
       استانداردسازی پایان‌های خراب
       مانند:
       . ..
       .. .
       ... ..
       .....
    */

    value =
        normalizeEllipsisEnding(
            value
        );

    /*
       اگر طول مناسب است،
       سه‌نقطه را دست‌کاری نمی‌کنیم.
    */

    if (
        value.length <= maxLength
    ) {

        return value;
    }

    /*
       متن بیش از سقف است؛
       کوتاه‌سازی نهایی حتماً با ...
       انجام می‌شود.
    */

    let result =
        shortenNaturally(
            value,
            maxLength
        );

    if (!result) {
        return "";
    }

    /*
       محافظ نهایی:
       اگر متن هنوز بیش از سقف بود،
       مستقیماً آن را به اندازه مجاز
       با ... محدود می‌کنیم.
    */

    if (
        result.length >
        maxLength
    ) {

        const suffix = "...";

        const limit =
            maxLength -
            suffix.length;

        let cut =
            result
                .slice(
                    0,
                    limit
                )
                .trim();

        const space =
            cut.lastIndexOf(" ");

        if (
            space >=
            MIN_SUMMARY_LENGTH
        ) {

            cut =
                cut
                    .slice(
                        0,
                        space
                    )
                    .trim();
        }

        cut =
            cut
                .replace(
                    /[\s.…]+$/,
                    ""
                )
                .replace(
                    /[،:؛]+$/,
                    ""
                )
                .trim();

        result =
            cut +
            suffix;
    }

    return normalizeEllipsisEnding(
        result
    );
}


/* ========================================================
   SUMMARY VALIDATION
======================================================== */

function isIncompleteSummary(text) {

    if (!text) {
        return true;
    }

    const value =
        normalizePersianText(text);

    if (
        value.length <
        MIN_SUMMARY_LENGTH
    ) {

        return true;
    }

    /*
       سه‌نقطه پایان معتبر یک خلاصه
       کوتاه‌شده است.

       برای بررسی ناقص بودن، آن را
       موقتاً حذف می‌کنیم.
    */

    const validationValue =
        hasEllipsisEnding(value)
            ? value
                .replace(
                    /(?:\.{3}|…)$/,
                    ""
                )
                .trim()
            : value;

    if (
        /[،:؛]$/.test(
            validationValue
        )
    ) {

        return true;
    }

    /*
       پایان‌های رایج متن بریده‌شده
    */

    const incompleteEndings = [

        " و",

        " یا",

        " که",

        " از",

        " به",

        " برای",

        " با",

        " در",

        " همچنین",

        " اما",

        " اگر",

        " این",

        " آن",

        " بر",

        " تا",

        " نیز"

    ];

    for (
        const ending of incompleteEndings
    ) {

        if (
            validationValue.endsWith(
                ending
            )
        ) {

            return true;
        }
    }

    return false;
}


function isUsefulSummary(text) {

    if (!text) {
        return false;
    }

    const value =
        normalizePersianText(text);

    if (
        value.length <
        MIN_SUMMARY_LENGTH
    ) {

        return false;
    }

    if (
        value.length >
        MAX_SUMMARY_LENGTH
    ) {

        return false;
    }

    if (
        containsBadPhrase(value)
    ) {

        return false;
    }

    if (
        isIncompleteSummary(value)
    ) {

        return false;
    }

    /*
       متن‌هایی که تقریباً فقط URL هستند
    */

    if (
        /^https?:\/\//i.test(value)
    ) {

        return false;
    }

    /*
       اگر تعداد حروف خیلی کم باشد،
       احتمالاً متن واقعی خبر نیست.
    */

    const letters =
        (
            value.match(
                /[\u0600-\u06FFa-zA-Z]/g
            ) || []
        ).length;

    if (
        letters <
        MIN_SUMMARY_LENGTH * 0.45
    ) {

        return false;
    }

    return true;
}


/* ========================================================
   CLEAN CANDIDATE
======================================================== */

function cleanCandidate(text) {

    if (!text) {
        return "";
    }

    let value =
        normalizePersianText(
            stripHtml(text)
        );

    if (!value) {
        return "";
    }

    /*
       حذف عبارات تبلیغاتی از ابتدا
    */

    value =
        value.replace(
            /^(?:خبرگزاری\s+)?(?:به گزارش|گزارش\s+)[^:]{0,80}:\s*/i,
            ""
        );

    /*
       حذف انتهای تبلیغاتی
    */

    for (
        const phrase of BAD_PHRASES
    ) {

        const index =
            value.indexOf(
                phrase
            );

        if (
            index >
            MIN_SUMMARY_LENGTH
        ) {

            value =
                value
                    .slice(
                        0,
                        index
                    )
                    .trim();

        }
    }

    return value;
}


/* ========================================================
   CANDIDATE SCORING
======================================================== */

function scoreCandidate(
    text,
    sourceType,
    site
) {

    if (!text) {
        return -999;
    }

    const value =
        normalizePersianText(text);

    let score = 0;

    /*
       طول مناسب
    */

    if (
        value.length >= 80 &&
        value.length <= 500
    ) {

        score += 20;
    }

    /*
       جمله کامل
    */

    if (
        hasStrongEnding(value)
    ) {

        score += 20;
    }

    /*
       متن خیلی طولانی معمولاً
       articleBody است.
    */

    if (
        value.length > 1200
    ) {

        score -= 15;
    }

    /*
       نوع منبع
    */

    if (
        sourceType === "og"
    ) {

        score += 30;
    }

    if (
        sourceType === "meta"
    ) {

        score += 25;
    }

    if (
        sourceType === "jsonld-description"
    ) {

        score += 28;
    }

    if (
        sourceType === "site"
    ) {

        score += 24;
    }

    if (
        sourceType === "paragraph"
    ) {

        score += 18;
    }

    if (
        sourceType === "article"
    ) {

        score += 10;
    }

    /*
       بعضی سایت‌ها Meta خوبی دارند.
    */

    if (
        site === "irna" &&
        sourceType === "site"
    ) {

        score += 8;
    }

    if (
        site === "isna" &&
        sourceType === "site"
    ) {

        score += 8;
    }

    if (
        site === "ilna" &&
        sourceType === "site"
    ) {

        score += 8;
    }

    /*
       متن تبلیغاتی
    */

    if (
        containsBadPhrase(value)
    ) {

        score -= 100;
    }

    /*
       متن‌هایی که با علامت ناقص تمام شده‌اند.
    */

    if (
        isIncompleteSummary(value)
    ) {

        score -= 60;
    }

    return score;
}


/* ========================================================
   BUILD CANDIDATES
======================================================== */

function buildCandidates(
    html,
    site
) {

    const candidates = [];

    /*
       META
    */

    const metas =
        extractMetaDescriptions(
            html
        );

    metas.forEach(
        text => {

            candidates.push({
                text,
                type:"meta"
            });

        }
    );


    /*
       JSON-LD
    */

    const jsonld =
        extractJsonLd(
            html
        );

    jsonld.forEach(
        text => {

            candidates.push({
                text,
                type:
                    text.length > 1000
                        ? "article"
                        : "jsonld-description"
            });

        }
    );


    /*
       Site specific
    */

    const siteSpecific =
        extractSiteSpecificSummary(
            html,
            site
        );

    siteSpecific.forEach(
        text => {

            candidates.push({
                text,
                type:"site"
            });

        }
    );


    /*
       Article / Main
    */

    const areas =
        extractArticleAreas(
            html
        );

    areas.forEach(
        text => {

            candidates.push({
                text,
                type:"article"
            });

        }
    );


    /*
       Paragraphs
    */

    const paragraphs =
        extractParagraphs(
            html
        );

    paragraphs.forEach(
        text => {

            candidates.push({
                text,
                type:"paragraph"
            });

        }
    );


    return candidates;
}


/* ========================================================
   SELECT BEST SUMMARY
======================================================== */

function chooseSummary(
    candidates,
    site
) {

    const prepared = [];

    for (
        const candidate of candidates
    ) {

        const cleaned =
            cleanCandidate(
                candidate.text
            );

        if (!cleaned) {
            continue;
        }

        let summary =
            cleaned;

        if (
            summary.length >
            MAX_SUMMARY_LENGTH
        ) {

            summary =
                shortenNaturally(
                    summary,
                    MAX_SUMMARY_LENGTH
                );
        }

        /*
           آخرین استانداردسازی قبل از اعتبارسنجی
        */

        summary =
            finalizeSummary(
                summary
            );

        if (
            !isUsefulSummary(
                summary
            )
        ) {

            continue;
        }

        const score =
            scoreCandidate(
                cleaned,
                candidate.type,
                site
            );

        prepared.push({
            summary,
            score
        });
    }

    prepared.sort(
        (a,b) =>
            b.score - a.score
    );

    if (!prepared.length) {
        return "";
    }

    return prepared[0].summary;
}


/* ========================================================
   RSS FALLBACK
======================================================== */

function buildSummaryFromRssDescription(
    item
) {

    const raw =
        item &&
        typeof item.rssDescription === "string"
            ? item.rssDescription
            : "";

    if (!raw) {
        return null;
    }

    const cleaned =
        cleanCandidate(
            raw
        );

    if (!cleaned) {
        return null;
    }

    let summary =
        cleaned;

    if (
        summary.length >
        MAX_SUMMARY_LENGTH
    ) {

        summary =
            shortenNaturally(
                summary,
                MAX_SUMMARY_LENGTH
            );
    }

    summary =
        finalizeSummary(
            summary
        );

    if (
        !isUsefulSummary(
            summary
        )
    ) {

        return null;
    }

    return {
        summary,
        status:"found-rss-fallback"
    };
}


/* ========================================================
   EXTRACT SUMMARY FROM PAGE
======================================================== */

async function generateSummary(
    item
) {

    const url =
        normalizeUrl(
            item.link ||
            item.url ||
            item.href
        );

    if (!url) {

        return {
            summary:"",
            status:"no-url"
        };
    }

    const site =
        detectSite(
            url
        );

    let primaryResult;

    try {

        const response =
            await requestPage(
                url
            );

        const html =
            response.html || "";

        if (!html) {

            primaryResult = {
                summary:"",
                status:"empty-response"
            };

        } else {

            const candidates =
                buildCandidates(
                    html,
                    site
                );

            let summary =
                chooseSummary(
                    candidates,
                    site
                );

            /*
               اگر هیچ خلاصه‌ای پیدا نشد،
               یک بار فقط پاراگراف‌ها را
               با سخت‌گیری کمتر بررسی می‌کنیم.
            */

            if (!summary) {

                const paragraphs =
                    extractParagraphs(
                        html
                    );

                for (
                    const paragraph of paragraphs
                ) {

                    const cleaned =
                        cleanCandidate(
                            paragraph
                        );

                    const shortened =
                        shortenNaturally(
                            cleaned
                        );

                    const finalized =
                        finalizeSummary(
                            shortened
                        );

                    if (
                        isUsefulSummary(
                            finalized
                        )
                    ) {

                        summary =
                            finalized;

                        break;
                    }
                }
            }

            primaryResult = summary
                ? {
                    summary:
                        finalizeSummary(
                            summary
                        ),
                    status:"found"
                }
                : {
                    summary:"",
                    status:"not-found"
                };
        }

    } catch (error) {

        primaryResult = {
            summary:"",
            status:"fetch-failed",
            error:
                error.message
        };
    }

    /*
       fallback فقط دقیقاً وقتی اجرا می‌شود که مسیر اصلی
       "not-found" شده باشد.
    */

    if (
        primaryResult.status ===
        "not-found"
    ) {

        const rssFallback =
            buildSummaryFromRssDescription(
                item
            );

        if (rssFallback) {
            return rssFallback;
        }
    }

    return primaryResult;
}


/* ========================================================
   PREVIOUS FILE
======================================================== */

function loadPreviousFile() {

    if (
        !fs.existsSync(
            OUTPUT_FILE
        )
    ) {

        return null;
    }

    try {

        const raw =
            fs.readFileSync(
                OUTPUT_FILE,
                "utf8"
            );

        return JSON.parse(
            raw
        );

    } catch (error) {

        console.warn(
            "⚠️ خواندن news-summary.json قبلی ناموفق بود:",
            error.message
        );

        return null;
    }
}


/* ========================================================
   PREVIOUS MAP
======================================================== */

function getNewsArray(data) {

    if (Array.isArray(data)) {
        return data;
    }

    if (
        data &&
        Array.isArray(data.news)
    ) {
        return data.news;
    }

    if (
        data &&
        Array.isArray(data.items)
    ) {
        return data.items;
    }

    return [];
}


function getItemUrl(item) {

    return normalizeUrl(
        item &&
        (
            item.link ||
            item.url ||
            item.href
        )
    );
}


function buildPreviousMap(data) {

    const map =
        new Map();

    const items =
        getNewsArray(data);

    for (
        const item of items
    ) {

        const url =
            getItemUrl(
                item
            );

        if (!url) {
            continue;
        }

        const summary =
            normalizePersianText(
                item.summary || ""
            );

        map.set(
            url,
            {
                ...item,
                summary
            }
        );
    }

    return map;
}


/* ========================================================
   PREVIOUS SUMMARY VALIDATION
======================================================== */

function isValidPreviousSummary(
    summary
) {

    if (
        !summary
    ) {

        return false;
    }

    const normalized =
        normalizePersianText(
            summary
        );

    if (!normalized) {
        return false;
    }

    /*
       خلاصه‌های خیلی قدیمی که
       پایان خراب مثل . .. دارند،
       نباید reuse شوند.
    */

    if (
        /(?:[\s.]*\.\s*\.)$/.test(
            normalized
        )
    ) {

        return false;
    }

    /*
       خلاصه‌های ناقص قبلی عمداً
       معتبر محسوب نمی‌شوند.
    */

    if (
        isIncompleteSummary(
            normalized
        )
    ) {

        return false;
    }

    if (
        !isUsefulSummary(
            normalized
        )
    ) {

        return false;
    }

    /*
       خلاصه‌های قدیمی که تقریباً به سقف
       ۲۲۰ کاراکتر رسیده‌اند ولی با ...
       تمام نمی‌شوند و پایان جمله قوی هم
       ندارند، احتمالاً در اجرای قبلی
       وسط متن بریده شده‌اند.

       این موارد باید دوباره از صفحه
       اصلی خبر استخراج شوند.
    */

    if (
        normalized.length >=
            MAX_SUMMARY_LENGTH - 3 &&
        !hasEllipsisEnding(normalized) &&
        !hasStrongEnding(normalized)
    ) {

        return false;
    }

    /*
       خلاصه‌های قدیمی ممکن است
       بیشتر از حد مجاز باشند.
       آن‌ها را طبیعی کوتاه می‌کنیم.
    */

    if (
        normalized.length >
        MAX_SUMMARY_LENGTH
    ) {

        const shortened =
            shortenNaturally(
                normalized
            );

        const finalized =
            finalizeSummary(
                shortened
            );

        return isUsefulSummary(
            finalized
        );
    }

    return true;
}


/* ========================================================
   NEWS NORMALIZATION
======================================================== */

function normalizeNewsItem(
    item,
    index
) {

    const source =
        item &&
        typeof item === "object"
            ? item
            : {};

    const normalized = {
        ...source
    };

    normalized.title =
        decodeHtmlEntities(
            cleanText(
                source.title ||
                source.name ||
                source.headline ||
                ""
            )
        );

    normalized.link =
        normalizeUrl(
            source.link ||
            source.url ||
            source.href ||
            ""
        );

    normalized.source =
        cleanText(
            source.source ||
            source.publisher ||
            source.origin ||
            source.site ||
            ""
        );

    normalized.category =
        cleanText(
            source.category ||
            source.cat ||
            source.group ||
            "متفرقه"
        );

    normalized.flag =
        source.flag ??
        "";

    normalized.date =
        source.date ||
        source.pubDate ||
        source.publishedAt ||
        source.published_at ||
        source.createdAt ||
        source.created_at ||
        "";

    normalized._index =
        index;

    return normalized;
}


/* ========================================================
   CONCURRENCY
======================================================== */

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
                    error
                };
            }
        }
    }

    const workers = [];

    const count =
        Math.min(
            concurrency,
            items.length
        );

    for (
        let i = 0;
        i < count;
        i++
    ) {

        workers.push(
            runner()
        );
    }

    await Promise.all(
        workers
    );

    return results;
}


/* ========================================================
   MAIN
======================================================== */

async function main() {

    console.log("");
    console.log(
        "=================================================="
    );
    console.log(
        "📰 تولید خلاصه اخبار دیار قدمگاه"
    );
    console.log(
        "=================================================="
    );
    console.log("");


    /*
       Read input
    */

    if (
        !fs.existsSync(
            INPUT_FILE
        )
    ) {

        throw new Error(
            "فایل news.json پیدا نشد: " +
            INPUT_FILE
        );
    }


    const inputRaw =
        fs.readFileSync(
            INPUT_FILE,
            "utf8"
        );

    const inputData =
        JSON.parse(
            inputRaw
        );


    const inputNews =
        getNewsArray(
            inputData
        )
        .map(
            normalizeNewsItem
        );


    if (!inputNews.length) {

        throw new Error(
            "هیچ خبری در news.json پیدا نشد."
        );
    }


    console.log(
        "📥 تعداد اخبار ورودی:",
        inputNews.length
    );


    /*
       Previous
    */

    const previousData =
        loadPreviousFile();

    const previousMap =
        buildPreviousMap(
            previousData
        );


    let keptCount = 0;

    let needFetchCount = 0;


    /*
       Decide which items need fetching
    */

    const jobs =
        inputNews.map(
            item => {

                const previous =
                    previousMap.get(
                        item.link
                    );

                const previousSummary =
                    previous &&
                    previous.summary
                        ? previous.summary
                        : "";

                if (
                    isValidPreviousSummary(
                        previousSummary
                    )
                ) {

                    /*
                       اگر خلاصه قبلی
                       کمی بزرگ‌تر از سقف است،
                       طبیعی کوتاه شود.
                    */

                    let summary =
                        normalizePersianText(
                            previousSummary
                        );

                    if (
                        summary.length >
                        MAX_SUMMARY_LENGTH
                    ) {

                        summary =
                            shortenNaturally(
                                summary
                            );
                    }

                    summary =
                        finalizeSummary(
                            summary
                        );

                    if (
                        isUsefulSummary(
                            summary
                        )
                    ) {

                        keptCount++;

                        return {
                            item,
                            reuse:true,
                            summary
                        };
                    }
                }

                needFetchCount++;

                return {
                    item,
                    reuse:false,
                    summary:""
                };
            }
        );


    console.log(
        "♻️ خلاصه‌های سالم قبلی:",
        keptCount
    );

    console.log(
        "🌐 نیازمند بررسی اینترنتی:",
        needFetchCount
    );

    console.log("");


    /*
       Fetch only missing / incomplete
    */

    const fetchJobs =
        jobs.filter(
            job =>
                !job.reuse
        );


    let foundCount = 0;

    let notFoundCount = 0;

    let failedCount = 0;


    const fetched =
        await processWithConcurrency(
            fetchJobs,
            async job => {

                const title =
                    job.item.title ||
                    "بدون عنوان";

                const result =
                    await generateSummary(
                        job.item
                    );

                if (
                    result.summary
                ) {

                    foundCount++;

                    console.log(
                        "✅",
                        title
                    );

                    console.log(
                        "   📝",
                        result.summary
                    );

                } else if (
                    result.status ===
                    "fetch-failed"
                ) {

                    failedCount++;

                    console.log(
                        "⚠️",
                        title,
                        "→",
                        result.error ||
                        "خطای دریافت"
                    );

                } else {

                    notFoundCount++;

                    console.log(
                        "ℹ️",
                        title,
                        "→ خلاصه پیدا نشد"
                    );
                }

                return {
                    ...job,
                    ...result
                };
            },
            CONCURRENCY
        );


    /*
       Merge results
    */

    const fetchedMap =
        new Map();

    for (
        const result of fetched
    ) {

        if (!result) {
            continue;
        }

        fetchedMap.set(
            result.item.link,
            result
        );
    }


    const finalNews =
        inputNews.map(
            item => {

                const job =
                    jobs.find(
                        x =>
                            x.item.link ===
                            item.link
                    );

                let summary = "";

                let status =
                    "not-found";

                /*
                   Reused
                */

                if (
                    job &&
                    job.reuse
                ) {

                    summary =
                        job.summary;

                    status =
                        "reused";

                } else {

                    const fetchedResult =
                        fetchedMap.get(
                            item.link
                        );

                    if (
                        fetchedResult
                    ) {

                        summary =
                            fetchedResult.summary ||
                            "";

                        status =
                            fetchedResult.status ||
                            (
                                summary
                                    ? "found"
                                    : "not-found"
                            );
                    }
                }


                /*
                   آخرین کنترل کیفیت
                */

                summary =
                    normalizePersianText(
                        summary
                    );

                summary =
                    finalizeSummary(
                        summary
                    );

                /*
                   اگر خلاصه نهایی معتبر نیست،
                   خالی می‌ماند.
                */

                if (
                    !isUsefulSummary(
                        summary
                    )
                ) {

                    summary = "";

                    if (
                        status === "reused"
                    ) {

                        status =
                            "not-found";
                    }
                }


                /*
                   مهم:
                   ساختار اصلی خبر حفظ می‌شود.
                   فقط summary و status به‌روز می‌شوند.
                */

                return {

                    ...item,

                    summary,

                    status

                };
            }
        );


    /*
       Statistics
    */

    const summariesFound =
        finalNews.filter(
            item =>
                Boolean(
                    item.summary
                )
        ).length;

    const summariesMissing =
        finalNews.length -
        summariesFound;


    /*
       Output
    */

    const output = {

        lastUpdate:
            new Date().toISOString(),

        sourceLastUpdate:
            inputData.sourceLastUpdate ||
            inputData.lastUpdate ||
            null,

        totalNews:
            finalNews.length,

        summariesFound,

        summariesMissing,

        news:
            finalNews

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
       Final report
    */

    console.log("");
    console.log(
        "=================================================="
    );
    console.log(
        "✅ عملیات تولید خلاصه‌ها پایان یافت."
    );
    console.log(
        "=================================================="
    );

    console.log(
        "📊 کل اخبار:",
        finalNews.length
    );

    console.log(
        "📝 خلاصه موجود:",
        summariesFound
    );

    console.log(
        "❌ بدون خلاصه:",
        summariesMissing
    );

    console.log(
        "♻️ استفاده از خلاصه قبلی:",
        keptCount
    );

    console.log(
        "🌐 خلاصه‌های جدید پیدا شده:",
        foundCount
    );

    console.log(
        "ℹ️ خلاصه پیدا نشد:",
        notFoundCount
    );

    console.log(
        "⚠️ خطای دریافت:",
        failedCount
    );

    console.log("");
    console.log(
        "📄 خروجی:",
        OUTPUT_FILE
    );

    console.log("");
}


/* ========================================================
   START
======================================================== */

main()
    .catch(
        error => {

            console.error("");
            console.error(
                "❌ خطای اصلی:"
            );

            console.error(
                error.message
            );

            console.error("");

            process.exit(1);
        }
    );

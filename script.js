"use strict";

/* ==========================================
   DIYAR NEWS TICKER v3.0
   Part 1 : Core & Configuration
========================================== */

// آدرس فایل اخبار
const NEWS_URL =
"https://raw.githubusercontent.com/maghool51/diyar-news/main/news.json";

// زمان بروزرسانی (۵ دقیقه)
const UPDATE_INTERVAL = 5 * 60 * 1000;

// تعداد خبر
const MAX_NEWS = 50;

// کلید ذخیره کش
const CACHE_KEY = "diyar_news_cache_v3";

// سرعت پایه
const BASE_SPEED = 0.65;

// عناصر صفحه
const tickerTrack =
document.getElementById("tickerTrack");

const updateTime =
document.getElementById("updateTime");

// وضعیت برنامه
const App = {

    news: [],

    html: "",

    animationId: null,

    position: 0,

    speed: BASE_SPEED,

    paused: false,

    lastUpdate: "",

    loading: false

};

// کمکی

function $(id){

    return document.getElementById(id);

}

function sleep(ms){

    return new Promise(resolve=>{

        setTimeout(resolve,ms);

    });

}

// تبدیل زمان فارسی

function formatTime(date){

    try{

        return new Date(date).toLocaleString("fa-IR");

    }

    catch(e){

        return "";

    }

}

// ذخیره کش

function saveCache(data){

    try{

        localStorage.setItem(

            CACHE_KEY,

            JSON.stringify(data)

        );

    }

    catch(e){

        console.log("Cache Error");

    }

}

// خواندن کش

function loadCache(){

    try{

        const data=

        localStorage.getItem(CACHE_KEY);

        if(!data) return null;

        return JSON.parse(data);

    }

    catch(e){

        return null;

    }

}

// نمایش پیام

function showLoading(text){

    tickerTrack.innerHTML=

    `<div class="loading">${text}</div>`;

}

showLoading("در حال دریافت اخبار...");
/* ==========================================
   Part 2 : Download News
========================================== */

async function fetchNews(){

    if(App.loading) return;

    App.loading = true;

    try{

        const response = await fetch(

            NEWS_URL + "?v=" + Date.now(),

            {
                cache:"no-store"
            }

        );

        if(!response.ok){

            throw new Error("HTTP Error");

        }

        const json = await response.json();

        if(!json.news){

            throw new Error("Invalid JSON");

        }

        App.news =

            json.news
            .slice(0,MAX_NEWS);

        App.lastUpdate =

            json.lastUpdatePersian ||

            formatTime(

                json.lastUpdate

            );

        saveCache(json);

        console.log(

            "News Loaded :",

            App.news.length

        );

    }

    catch(error){

        console.log(

            "Loading Cache..."

        );

        const cache =

            loadCache();

        if(cache){

            App.news =

                cache.news
                .slice(0,MAX_NEWS);

            App.lastUpdate =

                cache.lastUpdatePersian ||

                formatTime(

                    cache.lastUpdate

                );

        }

        else{

            App.news=[];

        }

    }

    App.loading=false;

}

function updateClock(){

    if(

        App.lastUpdate

    ){

        updateTime.textContent=

        App.lastUpdate;

    }

    else{

        updateTime.textContent=

        "--:--";

    }

}
/* ==========================================
   Part 3 : Build News HTML
========================================== */

function escapeHtml(text){

    if(!text) return "";

    return text
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;");
}

function buildNewsHTML(){

    if(App.news.length===0){

        showLoading("خبری برای نمایش وجود ندارد");

        return;
    }

    let html="";

    App.news.forEach(item=>{

        const title=

            escapeHtml(item.title||"");

        const link=

            item.link||"#";

        const source=

            escapeHtml(item.source||"خبر");

        const flag=

            item.flag||"📰";

        html += `

<a
class="news-link"
href="${link}"
target="_blank"
rel="noopener noreferrer">

<span class="source">

${flag} ${source}

</span>

${title}

</a>

<span class="sep">

◆

</span>

`;

    });

    // تکرار دوباره برای اسکرول بی‌نهایت
    App.html = html + html;

    tickerTrack.innerHTML = App.html;

    updateClock();

}

async function loadTicker(){

    showLoading("در حال دریافت اخبار...");

    await fetchNews();

    buildNewsHTML();

}/* ==========================================
   Part 3 : Build News HTML
========================================== */

function escapeHtml(text){

    if(!text) return "";

    return text
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;");
}

function buildNewsHTML(){

    if(App.news.length===0){

        showLoading("خبری برای نمایش وجود ندارد");

        return;
    }

    let html="";

    App.news.forEach(item=>{

        const title=

            escapeHtml(item.title||"");

        const link=

            item.link||"#";

        const source=

            escapeHtml(item.source||"خبر");

        const flag=

            item.flag||"📰";

        html += `

<a
class="news-link"
href="${link}"
target="_blank"
rel="noopener noreferrer">

<span class="source">

${flag} ${source}

</span>

${title}

</a>

<span class="sep">

◆

</span>

`;

    });

    // تکرار دوباره برای اسکرول بی‌نهایت
    App.html = html + html;

    tickerTrack.innerHTML = App.html;

    updateClock();

}

async function loadTicker(){

    showLoading("در حال دریافت اخبار...");

    await fetchNews();

    buildNewsHTML();

}
/* ==========================================
   Part 4 : Smooth Animation Engine
========================================== */

function calculateSpeed(){

    const width = tickerTrack.scrollWidth;

    if(width <= 0){

        App.speed = BASE_SPEED;

        return;

    }

    // تنظیم سرعت متناسب با طول متن
    App.speed =

        Math.max(

            0.45,

            width / 25000

        );

}

function resetTicker(){

    App.position = 0;

    tickerTrack.style.transform =

        "translateX(0px)";

}

function animateTicker(){

    if(App.paused){

        App.animationId =

            requestAnimationFrame(

                animateTicker

            );

        return;

    }

    App.position -= App.speed;

    tickerTrack.style.transform =

        `translateX(${App.position}px)`;

    const halfWidth =

        tickerTrack.scrollWidth / 2;

    if(

        Math.abs(App.position)

        >= halfWidth

    ){

        App.position = 0;

    }

    App.animationId =

        requestAnimationFrame(

            animateTicker

        );

}

function startTicker(){

    cancelAnimationFrame(

        App.animationId

    );

    calculateSpeed();

    resetTicker();

    animateTicker();

}

// توقف هنگام قرار گرفتن ماوس
tickerTrack.addEventListener(

    "mouseenter",

    ()=>{

        App.paused = true;

    }

);

// ادامه حرکت
tickerTrack.addEventListener(

    "mouseleave",

    ()=>{

        App.paused = false;

    }

);
/* ==========================================
   Part 5 : Start Application
========================================== */

async function initialize(){

    try{

        await loadTicker();

        startTicker();

    }

    catch(error){

        console.error(error);

        showLoading(

            "خطا در دریافت اخبار"

        );

    }

}

// بروزرسانی خودکار
setInterval(

    async()=>{

        const oldPosition =

            App.position;

        const wasPaused =

            App.paused;

        await loadTicker();

        calculateSpeed();

        App.position =

            oldPosition;

        App.paused =

            wasPaused;

    },

    UPDATE_INTERVAL

);

// شروع برنامه
window.addEventListener(

    "load",

    initialize

);

// بروزرسانی هنگام بازگشت به تب
document.addEventListener(

    "visibilitychange",

    ()=>{

        if(

            !document.hidden

        ){

            loadTicker();

        }

    }

);

// اگر اندازه پنجره تغییر کرد
window.addEventListener(

    "resize",

    ()=>{

        calculateSpeed();

    }

);

console.log(

    "✅ DIYAR NEWS TICKER READY"

);

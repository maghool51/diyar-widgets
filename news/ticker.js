/* ==================================
   Diyar Widgets - News Ticker
   ticker.js
   ================================== */


// آدرس فایل اخبار در مخزن اصلی دیار نیوز

const NEWS_URL =
"https://maghool51.github.io/diyar-news/news.json";


// تنظیمات

const CACHE_KEY = "diyar_news_cache";

const CACHE_TIME = 5 * 60 * 1000; // 5 دقیقه


const ticker =
document.getElementById("ticker");




// دریافت اخبار

async function loadNews(){


    try{


        const cached =
        getCache();


        if(cached){


            renderNews(cached);


        }



        const response =
        await fetch(
            NEWS_URL + "?v=" + Date.now()
        );



        if(!response.ok){

            throw new Error(
                "خطا در دریافت اخبار"
            );

        }



        const data =
        await response.json();



        saveCache(data);


        renderNews(data);



    }

    catch(error){


        console.log(error);



        const cached =
        getCache(true);



        if(cached){

            renderNews(cached);

        }

        else{

            ticker.innerHTML =
            "⚠️ دریافت اخبار امکان‌پذیر نیست";

        }


    }


}





// نمایش اخبار

function renderNews(data){


    if(!Array.isArray(data) || data.length===0){


        ticker.innerHTML =
        "خبری موجود نیست";


        return;

    }



    let html="";



    data.forEach(item=>{


        const title =
        item.title || "خبر بدون عنوان";



        const link =
        item.link || "#";



        html += `

        <a class="ticker-item"
           href="${link}"
           target="_blank"
           rel="noopener">

           ${title}

        </a>

        `;


    });



    // کپی برای حرکت بی نهایت

    ticker.innerHTML =
    html + html;



}







// ذخیره کش

function saveCache(data){


    const obj={

        time:Date.now(),

        data:data

    };


    localStorage.setItem(

        CACHE_KEY,

        JSON.stringify(obj)

    );


}





// خواندن کش

function getCache(force=false){


    const saved =
    localStorage.getItem(
        CACHE_KEY
    );



    if(!saved){

        return null;

    }



    try{


        const obj =
        JSON.parse(saved);



        if(

            force ||

            Date.now()-obj.time
            <
            CACHE_TIME

        ){

            return obj.data;

        }



    }

    catch(e){


        localStorage.removeItem(
            CACHE_KEY
        );


    }



    return null;


}






// شروع

loadNews();



// بروزرسانی خودکار

setInterval(

    loadNews,

    CACHE_TIME

);

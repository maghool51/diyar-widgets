/* ==================================
   Diyar Widgets - News Ticker
   ticker.js
   ================================== */


const MAIN_NEWS_URL =
"https://maghool51.github.io/diyar-news/news.json";


const BACKUP_NEWS_URL =
"./news.json";


const CACHE_KEY =
"diyar_news_cache";


const CACHE_TIME =
5 * 60 * 1000;


const ticker =
document.getElementById("ticker");




// دریافت اخبار

async function loadNews(){

    try{

        const response =
        await fetch(
            MAIN_NEWS_URL + "?v=" + Date.now()
        );


        if(!response.ok){

            throw new Error(
                "main source error"
            );

        }


        const data =
        await response.json();


        saveCache(data);

        renderNews(data);


    }


    catch(error){


        console.log(
            "استفاده از منبع پشتیبان"
        );


        try{


            const response =
            await fetch(
                BACKUP_NEWS_URL
            );


            if(!response.ok){

                throw new Error();

            }


            const data =
            await response.json();


            renderNews(data);


        }


        catch(e){


            const cached =
            getCache(true);


            if(cached){

                renderNews(cached);

            }

            else{

                ticker.innerHTML =
                "⚠️ اخبار در دسترس نیست";

            }


        }


    }

}






// نمایش اخبار

function renderNews(data){



    // پشتیبانی از ساختارهای مختلف JSON

    if(data.news && Array.isArray(data.news)){

        data =
        data.news;

    }



    if(!Array.isArray(data) || data.length===0){

        ticker.innerHTML =
        "خبری موجود نیست";

        return;

    }



    let html="";



    data.forEach(item=>{


        const title =
        item.title ||
        item.headline ||
        "خبر بدون عنوان";


        const link =
        item.link ||
        item.url ||
        "#";



        html += `

        <a class="ticker-item"
           href="${link}"
           target="_blank"
           rel="noopener">

           ${title}

        </a>

        `;


    });



    // تکرار برای حرکت بی نهایت

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

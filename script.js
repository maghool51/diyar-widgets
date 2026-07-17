const NEWS_URL = "https://raw.githubusercontent.com/maghool51/diyar-news/main/news.json";

const newsList = document.getElementById("newsList");

async function loadNews(){

    try{

        const response = await fetch(NEWS_URL);

        if(!response.ok){
            throw new Error("خطا");
        }

        const data = await response.json();

        if(!data.news || data.news.length===0){

            newsList.innerHTML="<div class='loading'>خبری یافت نشد.</div>";

            return;

        }

        let html="";

        data.news.forEach(item=>{

            html+=`

            <div class="news-card">

                <div class="news-title">

                    <a href="${item.link}" target="_blank">

                        ${item.title}

                    </a>

                </div>

                <div class="news-meta">

                    <span class="badge">${item.category || "متفرقه"}</span>

                    <span>📰 ${item.source || ""}</span>

                </div>

            </div>

            `;

        });

        newsList.innerHTML=html;

    }

    catch(error){

        newsList.innerHTML="<div class='loading'>❌ خطا در دریافت اخبار</div>";

        console.error(error);

    }

}

loadNews();
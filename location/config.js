/*!
 * Diyar Map Widget - config.js
 * تنظیمات اختصاصی: امام‌زاده سید محمد ساغند
 * پروژه: Diyar Widgets - دیار قدمگاه
 */

window.DiyarMapConfig = {

  // شناسه عنصر HTML ویجت
  containerId: "diyar-map-widget",

  // نام مکان
  placeName: "امام‌زاده سید محمد ساغند",

  // مختصات جغرافیایی
  coordinates: {
    lat: 34.452167,
    lng: 57.273028
  },

  // آدرس
  address:
    "استان خراسان جنوبی، شهرستان بشرویه، منطقه ساغند، نزدیکی روستاهای هنویه و نایگ",

  // تصویر (بعداً می‌توانید تصویر واقعی امام‌زاده را جایگزین کنید)
  image:
    "https://diyarghadamgah.blogfa.com/",

  // توضیحات
  description:
    "السلام علیک یا امام‌زاده سید محمد ساغند (ع) 🌹\n" +
    "معرفی فرهنگ، تاریخ، طبیعت و گردشگری منطقه هنویه و نیگنان؛ " +
    "مکانی زیارتی در شهرستان بشرویه استان خراسان جنوبی.",

  // رنگ اصلی ویجت
  primaryColor: "#00695C",

  // بزرگنمایی نقشه
  mapZoom: 15,


  // دکمه‌های مسیریابی
  buttons: {

    googleMaps: true,

    googleNavigation: true,

    waze: true,

    neshan: true,

    balad: true,

    appleMaps: true

  },


  // امکانات ویجت
  features: {

    showMap: true,

    showShare: true,

    showQRCode: true,

    showDistance: true,

    showDirection: true,

    lazyLoad: true,

    darkMode: "auto"

  },


  // متن‌های نمایشی
  labels: {

    title:
      "موقعیت و مسیریابی امام‌زاده سید محمد ساغند",

    distancePrefix:
      "فاصله شما تا امام‌زاده:",

    copySuccess:
      "کپی شد!",

    copyCoords:
      "کپی مختصات",

    copyLink:
      "کپی لینک نقشه",

    share:
      "اشتراک‌گذاری",

    qrTitle:
      "اسکن برای مسیریابی سریع"

  }

};

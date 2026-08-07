/*!
 * Diyar Map Widget - config.js
 * -----------------------------------------------------------------
 * Imamzadeh Seyyed Mohammad Saghand
 * Diyar Ghadamgah
 * -----------------------------------------------------------------
 * این فایل تنظیمات مکان ویجت است.
 * برای استفاده از مکان جدید فقط مقادیر این فایل تغییر می‌کند.
 * -----------------------------------------------------------------
 */

window.DiyarMapConfig = {

  // شناسه عنصر HTML که ویجت داخل آن ساخته می‌شود
  containerId: "diyar-map-widget",

  // نام مکان
  placeName: "امامزاده سید محمد ساغند",

  // مختصات جغرافیایی
  // 34°27'07.8"N 57°16'22.9"E
  coordinates: {
    lat: 34.452167,
    lng: 57.272083
  },

  // آدرس متنی مکان
  address:
    "روستای ساغند، بین نایگ و هنویه، شهرستان بشرویه، استان خراسان جنوبی",

  // تصویر مکان (در صورت نبود تصویر خالی بماند)
  image: "",

  // توضیح کوتاه
  description:
    "دیار قدمگاه؛ معرفی فرهنگ، تاریخ، طبیعت و گردشگری منطقه هنویه و نیگنان. زیارتگاه امامزاده سید محمد ساغند.",

  // رنگ اصلی ویجت
  primaryColor: "#2E7D32",

  // سطح بزرگ‌نمایی نقشه
  mapZoom: 15,

  // دکمه‌های مسیریابی
  buttons: {

    // Google Maps
    googleMaps: true,

    // Google Navigation
    googleNavigation: true,

    // Waze
    waze: true,

    // نشان
    neshan: true,

    // بلد
    balad: true,

    // Apple Maps
    appleMaps: true
  },

  // امکانات ویجت
  features: {

    // نمایش نقشه Leaflet / OpenStreetMap
    showMap: true,

    // اشتراک‌گذاری موقعیت
    showShare: true,

    // نمایش QR Code
    showQRCode: true,

    // فاصله کاربر تا مقصد با اجازه کاربر
    showDistance: true,

    // جهت تقریبی مقصد
    showDirection: true,

    // بارگذاری تنبل نقشه
    lazyLoad: true,

    // حالت نمایش
    // auto | light | dark
    darkMode: "auto"
  },

  // متن‌های قابل تغییر
  labels: {

    title:
      "موقعیت و مسیریابی امامزاده سید محمد ساغند",

    distancePrefix:
      "فاصله شما تا امامزاده:",

    copySuccess:
      "کپی شد!",

    copyCoords:
      "کپی مختصات",

    copyLink:
      "کپی لینک موقعیت",

    share:
      "اشتراک‌گذاری موقعیت",

    qrTitle:
      "اسکن برای مسیریابی سریع"
  }
};

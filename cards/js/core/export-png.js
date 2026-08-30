/**
 * core/export-png.js — خروجی PNG بدون هیچ کتابخانه‌ی خارجی (سبک‌ترین
 * راهکار ممکن): استایل‌های Computed روی یک کپی از کارت inline می‌شوند،
 * داخل یک SVG(foreignObject) قرار می‌گیرند و روی canvas رسم و سپس
 * PNG خروجی گرفته می‌شود.
 *
 * محدودیت شناخته‌شده: بعضی جلوه‌های پیشرفته‌ی CSS (مثل filter: blur
 * روی برخی مرورگرها) ممکن است در خروجی کمی متفاوت از نمایش زنده باشند؛
 * برای اکثر Layoutها نتیجه تمیز است.
 */
(function (global) {
  'use strict';

  const STYLE_PROPS = [
    'display', 'flex-direction', 'align-items', 'justify-content', 'gap',
    'position', 'top', 'right', 'bottom', 'left', 'inset',
    'width', 'height', 'max-width', 'min-width', 'aspect-ratio',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'background', 'background-color', 'background-image', 'background-position',
    'background-size', 'background-repeat', 'background-clip',
    'color', 'font-family', 'font-size', 'font-weight', 'line-height',
    'text-align', 'white-space', 'word-break', 'letter-spacing',
    'border', 'border-width', 'border-style', 'border-color', 'border-radius',
    'box-shadow', 'opacity', 'filter', 'clip-path', 'transform', 'transform-origin',
    'overflow', 'z-index', 'box-sizing', 'direction',
    '-webkit-line-clamp', '-webkit-box-orient'
  ];

  function inlineStyles(srcEl, dstEl) {
    const computed = global.getComputedStyle(srcEl);
    let css = '';
    STYLE_PROPS.forEach((prop) => {
      const val = computed.getPropertyValue(prop);
      if (val) css += prop + ':' + val + ';';
    });
    dstEl.setAttribute('style', css);
    dstEl.removeAttribute('class');
    dstEl.removeAttribute('id');

    const srcChildren = srcEl.children;
    const dstChildren = dstEl.children;
    for (let i = 0; i < srcChildren.length; i++) {
      inlineStyles(srcChildren[i], dstChildren[i]);
    }
  }

  async function exportCardAsPng(cardEl, filename, scale) {
    scale = scale || 2;
    const rect = cardEl.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    const clone = cardEl.cloneNode(true);
    inlineStyles(cardEl, clone);
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

    const svgMarkup =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
      '<foreignObject width="100%" height="100%">' +
      new XMLSerializer().serializeToString(clone) +
      '</foreignObject></svg>';

    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    try {
      const img = await loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);

      const pngUrl = canvas.toDataURL('image/png');
      downloadDataUrl(pngUrl, filename || 'diyar-postcard.png');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  global.DiyarCardExport = { exportCardAsPng };
})(typeof window !== 'undefined' ? window : this);

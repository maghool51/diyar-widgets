/**
 * core/music.js — دکمه‌ی موسیقی پس‌زمینه. به‌جای بارگذاری یک فایل
 * صوتی (که مسائل کپی‌رایت و حجم را به همراه دارد)، یک ملودی ملایم
 * و کوتاه با Web Audio API «تولید» می‌شود — سبک، بدون هیچ فایل
 * خارجی، و بدون محدودیت مجوز.
 *
 * سازگاری با WebViewهای داخل‌اپ (روبیکا، اینستاگرام و مشابه):
 * این WebViewها معمولاً روی Android WebView مبتنی بر Chromium‌اند و
 * Web Audio API را پشتیبانی می‌کنند، اما سیاست Autoplay را سخت‌گیرانه‌تر
 * اعمال می‌کنند و گاهی resume() کُند یا ناموفق است. برای همین:
 *   - AudioContext فقط داخل خودِ Click Handler ساخته می‌شود (نه زودتر).
 *   - قبل از شروع ملودی، منتظر resume() واقعی می‌مانیم (نه موازی).
 *   - اگر بعد از یک مهلت کوتاه Context هنوز suspended بود (یعنی این
 *     WebView خاص اجازه نمی‌دهد)، دکمه به‌جای گیر کردن، پیام Fallback
 *     «پخش موسیقی در این مرورگر ممکن نیست» را نشان می‌دهد.
 *   - قبل از اولین کلیک، یک راهنمای کوچک «برای پخش موسیقی لمس کنید»
 *     کنار دکمه نمایش داده می‌شود.
 *   - با ترک/بستن صفحه (pagehide/beforeunload)، AudioContext کامل
 *     Close می‌شود تا هیچ منبعی باز نماند.
 */
(function (global) {
  'use strict';

  function isSupported() {
    return !!(global.AudioContext || global.webkitAudioContext);
  }

  // ملودی پنتاتونیک ملایم و گرم — فرکانس‌ها به هرتز
  const NOTES = [523.25, 659.25, 783.99, 659.25, 880.00, 783.99, 659.25, 523.25]; // C5 E5 G5 E5 A5 G5 E5 C5
  const NOTE_DURATION = 0.9; // ثانیه
  const GAP = 0.15;
  const RESUME_TIMEOUT_MS = 900; // اگر تا این مدت Context بیدار نشد، یعنی این مرورگر اجازه نمی‌دهد

  function createPlayer() {
    const Ctx = global.AudioContext || global.webkitAudioContext;
    const ctx = new Ctx();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.06; // خیلی ملایم — پس‌زمینه، نه محور توجه
    masterGain.connect(ctx.destination);

    let stopped = true;
    let timer = null;

    function playNote(freq, startAt) {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      noteGain.gain.setValueAtTime(0, startAt);
      noteGain.gain.linearRampToValueAtTime(1, startAt + 0.25);
      noteGain.gain.linearRampToValueAtTime(0, startAt + NOTE_DURATION);
      osc.connect(noteGain).connect(masterGain);
      osc.start(startAt);
      osc.stop(startAt + NOTE_DURATION + 0.05);
    }

    function scheduleLoop() {
      if (stopped) return;
      const now = ctx.currentTime + 0.05;
      NOTES.forEach((freq, i) => playNote(freq, now + i * (NOTE_DURATION + GAP)));
      const loopLength = NOTES.length * (NOTE_DURATION + GAP);
      timer = setTimeout(scheduleLoop, loopLength * 1000);
    }

    return {
      /** برمی‌گرداند: 'playing' یا 'blocked' (اگر مرورگر بعد از تلاش هنوز اجازه‌ی پخش نداد) */
      async play() {
        stopped = false;
        if (ctx.state === 'suspended') {
          try {
            await Promise.race([
              ctx.resume(),
              new Promise((resolve) => setTimeout(resolve, RESUME_TIMEOUT_MS))
            ]);
          } catch (e) {
            // ادامه می‌دهیم؛ وضعیت واقعی را در ادامه از ctx.state می‌خوانیم
          }
        }
        if (ctx.state !== 'running') {
          stopped = true;
          return 'blocked';
        }
        scheduleLoop();
        return 'playing';
      },
      stop() {
        stopped = true;
        if (timer) clearTimeout(timer);
      },
      dispose() {
        stopped = true;
        if (timer) clearTimeout(timer);
        try { ctx.close(); } catch (e) { /* ignore */ }
      }
    };
  }

  /**
   * دکمه‌ی موسیقی را داخل container می‌سازد. اگر musicKey پشتیبانی‌شده
   * نباشد یا مرورگر Web Audio را نداشته باشد، هیچ‌چیز ساخته نمی‌شود
   * (بدون خطا، بدون دکمه‌ی از‌کارافتاده).
   */
  function createMusicToggle(container, musicKey) {
    if (!container || musicKey !== 'generated' || !isSupported()) return;
    container.textContent = '';

    let player = null;
    let playing = false;
    let everClicked = false;

    const wrap = document.createElement('div');
    wrap.className = 'dq-music-toggle-inner';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dq-music-toggle';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'پخش موسیقی پس‌زمینه');
    btn.textContent = '🎵';

    const hint = document.createElement('span');
    hint.className = 'dq-music-hint';
    hint.textContent = 'برای پخش موسیقی لمس کنید';

    function setBlockedState() {
      btn.textContent = '🔇';
      btn.disabled = true;
      btn.classList.remove('dq-music-toggle--playing');
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'پخش موسیقی در این مرورگر ممکن نیست');
      hint.textContent = 'پخش موسیقی در این مرورگر ممکن نیست';
      hint.hidden = false;
    }

    btn.addEventListener('click', () => {
      everClicked = true;
      hint.hidden = true;
      try {
        if (!player) player = createPlayer();
        if (playing) {
          player.stop();
          playing = false;
          btn.textContent = '🎵';
          btn.classList.remove('dq-music-toggle--playing');
          btn.setAttribute('aria-pressed', 'false');
          btn.setAttribute('aria-label', 'پخش موسیقی پس‌زمینه');
        } else {
          btn.disabled = true; // تا نتیجه‌ی resume مشخص شود از دوبار-کلیک جلوگیری کن
          player.play().then((result) => {
            btn.disabled = false;
            if (result === 'blocked') {
              setBlockedState();
              return;
            }
            playing = true;
            btn.textContent = '🔊';
            btn.classList.add('dq-music-toggle--playing');
            btn.setAttribute('aria-pressed', 'true');
            btn.setAttribute('aria-label', 'قطع موسیقی پس‌زمینه');
          });
        }
      } catch (e) {
        // اگر پخش با خطا مواجه شد، بی‌صدا دکمه را مخفی می‌کنیم؛ کارت باید بدون موسیقی هم کامل قابل‌استفاده بماند
        container.textContent = '';
      }
    });

    wrap.appendChild(btn);
    wrap.appendChild(hint);
    container.appendChild(wrap);

    // با ترک/بستن صفحه، AudioContext را کامل آزاد کن تا هیچ منبعی باز نماند
    const cleanup = () => { if (player) player.dispose(); };
    global.addEventListener('pagehide', cleanup);
    global.addEventListener('beforeunload', cleanup);
  }

  global.DiyarCardMusic = { createMusicToggle };
})(typeof window !== 'undefined' ? window : this);

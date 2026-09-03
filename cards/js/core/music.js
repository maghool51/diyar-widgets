/**
 * core/music.js — کنترل موسیقی پس‌زمینه. به‌جای بارگذاری یک فایل
 * صوتی (که مسائل کپی‌رایت و حجم را به همراه دارد)، یک ملودی ملایم
 * و کوتاه با Web Audio API «تولید» می‌شود — سبک، بدون هیچ فایل
 * خارجی، و بدون محدودیت مجوز.
 *
 * معماری قابل‌توسعه برای موسیقی دلخواه در آینده: اگر یک Template
 * به‌جای "generated"، یک مسیر فایل بدهد (مثلاً
 * "assets/music/birthday.mp3" یا یک URL عمومی)، createPlayer آن را
 * با یک <audio> واقعی پخش می‌کند؛ اگر فایل موجود نبود یا خطا داد،
 * بی‌صدا Unsupported/Blocked اعلام می‌شود و کارت بدون موسیقی کاملاً
 * کار می‌کند.
 *
 * سازگاری با WebViewهای داخل‌اپ (روبیکا و مشابه): چون این WebViewها
 * سیاست Autoplay سخت‌گیرانه‌تری دارند، start() همیشه باید از داخل
 * خودِ Handler یک لمس/کلیک واقعی صدا زده شود (نه بعد از setTimeout).
 *
 * دو حالت استفاده:
 *   - createMusicToggle(container, musicKey): دکمه‌ی مستقل (برای
 *     Templateهایی که تجربه‌ی پاکت ندارند).
 *   - createMusicController(musicKey): یک Controller خام که هم دکمه
 *     می‌سازد و هم start()/stop() می‌دهد تا experience.js بتواند
 *     موسیقی را همزمان با لمس پاکت (همان لمس اول کاربر) شروع کند.
 */
(function (global) {
  'use strict';

  function isGeneratedMood(musicKey) { return musicKey === 'generated' || musicKey === 'generated-warm' || musicKey === 'generated-solemn'; }

  function isSupported(musicKey) {
    if (!musicKey) return false;
    if (isGeneratedMood(musicKey)) return !!(global.AudioContext || global.webkitAudioContext);
    return true; // مسیر/URL فایل — پشتیبانی واقعی هنگام تلاش برای پخش مشخص می‌شود
  }

  // سه حال‌وهوای ملودی — هرکدام برای دسته‌ای از مناسبت‌ها مناسب‌ترند.
  // فرکانس‌ها به هرتز. برای سوگواری/تسلیت عمداً هیچ موسیقی‌ای تعریف
  // نشده (فیلد "music" آن Templateها اصلاً ست نمی‌شود).
  const MOODS = {
    generated: {
      notes: [523.25, 659.25, 783.99, 659.25, 880.00, 783.99, 659.25, 523.25], // شاد — C5 E5 G5 E5 A5 G5 E5 C5
      noteDuration: 0.9, gap: 0.15, gain: 0.06
    },
    'generated-warm': {
      notes: [392.00, 523.25, 587.33, 523.25, 659.25, 587.33, 523.25, 392.00], // گرم/رمانتیک — G4 C5 D5 C5 E5 D5 C5 G4
      noteDuration: 1.15, gap: 0.25, gain: 0.05
    },
    'generated-solemn': {
      notes: [392.00, 466.16, 523.25, 466.16], // باوقار و ساده — G4 A#4 C5 A#4
      noteDuration: 1.6, gap: 0.5, gain: 0.045
    }
  };

  const RESUME_TIMEOUT_MS = 900;
  const FADE_IN_MS = 900;

  function createGeneratedPlayer(musicKey) {
    const mood = MOODS[musicKey] || MOODS.generated;
    const Ctx = global.AudioContext || global.webkitAudioContext;
    const ctx = new Ctx();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0; // با Fade-in شروع می‌شود، نه ناگهانی
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
      noteGain.gain.linearRampToValueAtTime(0, startAt + mood.noteDuration);
      osc.connect(noteGain).connect(masterGain);
      osc.start(startAt);
      osc.stop(startAt + mood.noteDuration + 0.05);
    }

    function scheduleLoop() {
      if (stopped) return;
      const now = ctx.currentTime + 0.05;
      mood.notes.forEach((freq, i) => playNote(freq, now + i * (mood.noteDuration + mood.gap)));
      const loopLength = mood.notes.length * (mood.noteDuration + mood.gap);
      timer = setTimeout(scheduleLoop, loopLength * 1000);
    }

    return {
      async play() {
        stopped = false;
        if (ctx.state === 'suspended') {
          try {
            await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, RESUME_TIMEOUT_MS))]);
          } catch (e) { /* ادامه می‌دهیم؛ وضعیت واقعی از ctx.state خوانده می‌شود */ }
        }
        if (ctx.state !== 'running') { stopped = true; return 'blocked'; }
        masterGain.gain.setValueAtTime(0, ctx.currentTime);
        masterGain.gain.linearRampToValueAtTime(mood.gain, ctx.currentTime + FADE_IN_MS / 1000);
        scheduleLoop();
        return 'playing';
      },
      stop() { stopped = true; if (timer) clearTimeout(timer); },
      dispose() { stopped = true; if (timer) clearTimeout(timer); try { ctx.close(); } catch (e) { /* ignore */ } }
    };
  }

  function createFilePlayer(src) {
    const audio = new Audio();
    audio.src = src;
    audio.loop = true;
    audio.preload = 'none';
    audio.volume = 0;
    let fadeTimer = null;

    function fadeTo(target, ms) {
      clearInterval(fadeTimer);
      const start = audio.volume;
      const steps = 20;
      let i = 0;
      fadeTimer = setInterval(() => {
        i++;
        audio.volume = start + (target - start) * (i / steps);
        if (i >= steps) clearInterval(fadeTimer);
      }, ms / steps);
    }

    return {
      async play() {
        try {
          await audio.play();
          fadeTo(0.5, FADE_IN_MS);
          return 'playing';
        } catch (e) {
          return 'blocked';
        }
      },
      stop() { fadeTo(0, 250); setTimeout(() => audio.pause(), 260); },
      dispose() { clearInterval(fadeTimer); audio.pause(); audio.src = ''; }
    };
  }

  function createPlayer(musicKey) {
    return isGeneratedMood(musicKey) ? createGeneratedPlayer(musicKey) : createFilePlayer(musicKey);
  }

  /**
   * یک Controller خام (بدون UI اجباری) می‌سازد. experience.js از این
   * برای شروع موسیقی همزمان با لمس پاکت استفاده می‌کند؛ getButton()
   * همان دکمه‌ی کوچک پخش/قطع را برمی‌گرداند تا بعداً جایی نشان داده شود.
   */
  function createMusicController(musicKey) {
    if (!isSupported(musicKey)) return null;

    let player = null;
    let playing = false;
    let blocked = false;
    let btn = null;
    let hint = null;

    function applyState() {
      if (!btn) return;
      if (blocked) {
        btn.textContent = '🔇';
        btn.disabled = true;
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', 'پخش موسیقی در این مرورگر ممکن نیست');
        if (hint) { hint.textContent = 'پخش موسیقی در این مرورگر ممکن نیست'; hint.hidden = false; }
        return;
      }
      btn.disabled = false;
      btn.textContent = playing ? '🔊' : '🎵';
      btn.classList.toggle('dq-music-toggle--playing', playing);
      btn.setAttribute('aria-pressed', String(playing));
      btn.setAttribute('aria-label', playing ? 'قطع موسیقی پس‌زمینه' : 'پخش موسیقی پس‌زمینه');
    }

    /** باید همیشه از داخل خودِ Handler یک لمس/کلیک واقعی صدا زده شود */
    async function start() {
      if (playing || blocked) return;
      if (!player) player = createPlayer(musicKey);
      if (btn) btn.disabled = true;
      const result = await player.play();
      if (result === 'blocked') { blocked = true; applyState(); return; }
      playing = true;
      if (hint) hint.hidden = true;
      applyState();
    }

    function stop() {
      if (!playing || !player) return;
      player.stop();
      playing = false;
      applyState();
    }

    function toggle() { playing ? stop() : start(); }

    function dispose() { if (player) player.dispose(); }

    /** دکمه + راهنمای «برای پخش موسیقی لمس کنید» را می‌سازد (فقط یک‌بار) */
    function getButton() {
      if (btn) return { wrap: btn.parentElement, btn, hint };
      const wrap = document.createElement('div');
      wrap.className = 'dq-music-toggle-inner';
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dq-music-toggle';
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'پخش موسیقی پس‌زمینه');
      btn.textContent = '🎵';
      btn.addEventListener('click', toggle);

      hint = document.createElement('span');
      hint.className = 'dq-music-hint';
      hint.textContent = 'برای پخش موسیقی لمس کنید';

      wrap.appendChild(btn);
      wrap.appendChild(hint);
      applyState();
      return { wrap, btn, hint };
    }

    const cleanup = () => dispose();
    global.addEventListener('pagehide', cleanup);
    global.addEventListener('beforeunload', cleanup);

    return { start, stop, toggle, dispose, getButton, isPlaying: () => playing };
  }

  /** حالت مستقل قبلی: یک دکمه‌ی کامل داخل container می‌سازد (برای Templateهای بدون تجربه‌ی پاکت) */
  function createMusicToggle(container, musicKey) {
    if (!container) return;
    container.textContent = '';
    const controller = createMusicController(musicKey);
    if (!controller) return;
    const { wrap } = controller.getButton();
    container.appendChild(wrap);
  }

  global.DiyarCardMusic = { createMusicToggle, createMusicController };
})(typeof window !== 'undefined' ? window : this);

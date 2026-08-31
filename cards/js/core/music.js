/**
 * core/music.js — دکمه‌ی موسیقی پس‌زمینه. به‌جای بارگذاری یک فایل
 * صوتی (که مسائل کپی‌رایت و حجم را به همراه دارد)، یک ملودی ملایم
 * و کوتاه با Web Audio API «تولید» می‌شود — سبک، بدون هیچ فایل
 * خارجی، و بدون محدودیت مجوز.
 *
 * پخش همیشه از داخل خودِ Click Handler دکمه شروع می‌شود، یعنی همان
 * لمس اول کاربر است — دقیقاً مطابق محدودیت Autoplay مرورگرها.
 *
 * برای افزودن یک فایل صوتی واقعی در آینده، به‌جای این ماژول می‌توان
 * از یک عنصر <audio src="assets/music/..."> استفاده کرد؛ ساختار
 * assets/music/ برای همین منظور از قبل آماده است (به README همان
 * پوشه مراجعه کنید).
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
      play() {
        stopped = false;
        if (ctx.state === 'suspended') ctx.resume();
        scheduleLoop();
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

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dq-music-toggle';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'پخش موسیقی پس‌زمینه');
    btn.textContent = '🎵';

    btn.addEventListener('click', () => {
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
          player.play();
          playing = true;
          btn.textContent = '🔊';
          btn.classList.add('dq-music-toggle--playing');
          btn.setAttribute('aria-pressed', 'true');
          btn.setAttribute('aria-label', 'قطع موسیقی پس‌زمینه');
        }
      } catch (e) {
        // اگر پخش با خطا مواجه شد، بی‌صدا دکمه را مخفی می‌کنیم؛ کارت باید بدون موسیقی هم کامل قابل‌استفاده بماند
        container.textContent = '';
      }
    });

    container.appendChild(btn);
  }

  global.DiyarCardMusic = { createMusicToggle };
})(typeof window !== 'undefined' ? window : this);

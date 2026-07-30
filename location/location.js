(function () {
    'use strict';
    try {
        if (document.getElementById('locationWidget')) return;

        /* ==================================================================
           Ù„ÛŒØ³Øª Ù…ÙˆÙ‚Ø¹ÛŒØªâ€ŒÙ‡Ø§: Ø¨Ø±Ø§ÛŒ Ø§ÙØ²ÙˆØ¯Ù† Ù…ÙˆÙ‚Ø¹ÛŒØª Ø¬Ø¯ÛŒØ¯ ÛŒÚ© Ø®Ø· Ø¯ÛŒÚ¯Ø± Ù…Ø«Ù„ Ø²ÛŒØ± Ø§Ø¶Ø§ÙÙ‡ Ú©Ù†ÛŒØ¯:
           { name: 'Ù†Ø§Ù… Ù…ÙˆÙ‚Ø¹ÛŒØª', lat: Ø¹Ø±Ø¶ Ø¬ØºØ±Ø§ÙÛŒØ§ÛŒÛŒ, lng: Ø·ÙˆÙ„ Ø¬ØºØ±Ø§ÙÛŒØ§ÛŒÛŒ }
           ================================================================== */
        var LOCATIONS = [
            { name: 'Ø§Ù…Ø§Ù…Ø²Ø§Ø¯Ù‡ Ø³ÛŒØ¯ Ù…Ø­Ù…Ø¯ Ø³Ø§ØºÙ†Ø¯', lat: 34.452173, lng: 57.273014 },
            { name: 'Ø­ÙˆÙ†ÙˆÛŒÙ‡', lat: 34.463493, lng: 57.280267 }
        ];

        /* ---------- style ---------- */
        var css =
            '.location-widget{max-width:340px;margin:0 auto;padding:16px;background:#fff;border-radius:var(--radius,16px);box-shadow:var(--shadow,0 8px 24px rgba(0,0,0,.12));font-family:var(--font,\'Vazirmatn\',\'Segoe UI\',Tahoma,sans-serif);direction:rtl;text-align:right;box-sizing:border-box}' +
            '.location-widget *{box-sizing:border-box}' +
            '.lw-title{margin:0 0 12px;font-size:16px;font-weight:bold;color:var(--primary,#0b3d2e)}' +
            '.lw-select{width:100%;padding:9px 10px;margin-bottom:10px;border:1px solid #ddd;border-radius:10px;font-size:14px;font-family:inherit;background:#fafafa;color:#222}' +
            '.lw-map{width:100%;height:180px;border:0;border-radius:12px;margin-bottom:10px;display:block}' +
            '.lw-buttons{display:flex;gap:8px;flex-wrap:wrap}' +
            '.lw-btn{flex:1 1 130px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 12px;border:none;border-radius:25px;font-size:13px;font-weight:bold;font-family:inherit;text-decoration:none;cursor:pointer;transition:var(--transition,.25s ease);white-space:nowrap}' +
            '.lw-btn-primary{background:var(--primary,#0b3d2e);color:#fff}' +
            '.lw-btn-primary:hover{background:var(--gold,#f0c040);color:#222}' +
            '.lw-btn-secondary{background:#f0ece2;color:var(--primary,#0b3d2e)}' +
            '.lw-btn-secondary:hover{background:var(--gold,#f0c040);color:#222}' +
            '.lw-btn-outline{display:block;width:100%;margin-top:8px;background:transparent;border:2px solid var(--primary,#0b3d2e);color:var(--primary,#0b3d2e)}' +
            '.lw-btn-outline:hover{background:var(--primary,#0b3d2e);color:#fff}' +
            'body.dark .lw-btn-outline{border-color:var(--gold-light,#ffe082);color:var(--gold-light,#ffe082)}' +
            'body.dark .lw-btn-outline:hover{background:var(--gold-light,#ffe082);color:#222}' +
            '.lw-msg{min-height:18px;margin-top:8px;font-size:12px;color:#2e7d32;text-align:center}' +
            'body.dark .location-widget{background:#1d1d1d;color:#f2f2f2}' +
            'body.dark .lw-select{background:#2a2a2a;color:#fff;border-color:#444}' +
            'body.dark .lw-btn-secondary{background:#2a2a2a;color:var(--gold-light,#ffe082)}';

        var styleEl = document.createElement('style');
        styleEl.textContent = css;
        document.head.appendChild(styleEl);

        /* ---------- markup (built via DOM, not innerHTML) ---------- */
        var wrap = document.createElement('div');
        wrap.className = 'location-widget';
        wrap.id = 'locationWidget';

        var title = document.createElement('h3');
        title.className = 'lw-title';
        title.textContent = 'ðŸ“ Ù†Ù‚Ø´Ù‡ Ùˆ Ù…ÙˆÙ‚Ø¹ÛŒØª';
        wrap.appendChild(title);

        var select = document.createElement('select');
        select.className = 'lw-select';
        select.setAttribute('aria-label', 'Ø§Ù†ØªØ®Ø§Ø¨ Ù…ÙˆÙ‚Ø¹ÛŒØª');
        LOCATIONS.forEach(function (loc) {
            var opt = document.createElement('option');
            opt.textContent = loc.name;
            opt.value = loc.lat + ',' + loc.lng;
            select.appendChild(opt);
        });
        wrap.appendChild(select);

        /* embedded map â€” plain iframe embed, no API key / no billing needed */
        var mapFrame = document.createElement('iframe');
        mapFrame.className = 'lw-map';
        mapFrame.setAttribute('loading', 'lazy');
        mapFrame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
        mapFrame.title = 'Ù†Ù‚Ø´Ù‡ Ù…ÙˆÙ‚Ø¹ÛŒØª';
        wrap.appendChild(mapFrame);

        var msg = document.createElement('div');
        msg.className = 'lw-msg';
        msg.setAttribute('role', 'status');
        msg.setAttribute('aria-live', 'polite');

        function showMsg(t) {
            msg.textContent = t;
            clearTimeout(showMsg._t);
            showMsg._t = setTimeout(function () { msg.textContent = ''; }, 4000);
        }

        function buildUrl(lat, lng, name) {
            return 'https://www.google.com/maps?q=' + encodeURIComponent(lat) + ',' +
                   encodeURIComponent(lng) + '(' + encodeURIComponent(name) + ')';
        }

        function buildEmbedUrl(lat, lng) {
            return 'https://www.google.com/maps?q=' + encodeURIComponent(lat) + ',' +
                   encodeURIComponent(lng) + '&z=15&output=embed';
        }

        function copyText(text) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text);
            }
            return new Promise(function (resolve, reject) {
                try {
                    var d = document.createElement('textarea');
                    d.value = text;
                    document.body.appendChild(d);
                    d.select();
                    document.execCommand('copy');
                    document.body.removeChild(d);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        }

        function currentSelection() {
            var opt = select.options[select.selectedIndex];
            if (!opt) return null;
            var p = opt.value.split(',');
            return { name: opt.textContent, lat: p[0], lng: p[1] };
        }

        var btnRow = document.createElement('div');
        btnRow.className = 'lw-buttons';

        var shareBtn = document.createElement('button');
        shareBtn.type = 'button';
        shareBtn.className = 'lw-btn lw-btn-primary';
        shareBtn.textContent = 'ðŸ”— Ø§Ø´ØªØ±Ø§Ú©â€ŒÚ¯Ø°Ø§Ø±ÛŒ';
        shareBtn.addEventListener('click', function () {
            var loc = currentSelection();
            if (!loc) return;
            var url = buildUrl(loc.lat, loc.lng, loc.name);
            var text = 'ðŸ“ ' + loc.name + '\n' + url;
            if (navigator.share) {
                navigator.share({ title: loc.name, text: text, url: url }).catch(function () {});
                return;
            }
            copyText(text).then(function () {
                showMsg('âœ… Ù„ÛŒÙ†Ú© Ù…ÙˆÙ‚Ø¹ÛŒØª Ú©Ù¾ÛŒ Ø´Ø¯!');
            }).catch(function () {
                showMsg('âŒ Ú©Ù¾ÛŒ Ù†Ø´Ø¯ØŒ Ù„Ø·ÙØ§Ù‹ Ø¯Ø³ØªÛŒ Ú©Ù¾ÛŒ Ú©Ù†ÛŒØ¯.');
            });
        });
        btnRow.appendChild(shareBtn);

        var mapLink = document.createElement('a');
        mapLink.className = 'lw-btn lw-btn-secondary';
        mapLink.target = '_blank';
        mapLink.rel = 'nofollow';
        mapLink.textContent = 'ðŸ—ºï¸ Ù…Ø³ÛŒØ±ÛŒØ§Ø¨ÛŒ';

        function updateMap() {
            var loc = currentSelection();
            if (!loc) return;
            mapLink.href = buildUrl(loc.lat, loc.lng, loc.name);
            mapFrame.src = buildEmbedUrl(loc.lat, loc.lng);
        }
        select.addEventListener('change', updateMap);
        updateMap();
        btnRow.appendChild(mapLink);

        wrap.appendChild(btnRow);

        var myLocBtn = document.createElement('button');
        myLocBtn.type = 'button';
        myLocBtn.className = 'lw-btn lw-btn-outline';
        myLocBtn.textContent = 'ðŸ“± Ø§Ø´ØªØ±Ø§Ú©â€ŒÚ¯Ø°Ø§Ø±ÛŒ Ù…ÙˆÙ‚Ø¹ÛŒØª Ù…Ù†';
        myLocBtn.addEventListener('click', function () {
            if (!navigator.geolocation) {
                showMsg('âŒ Ù…Ø±ÙˆØ±Ú¯Ø± Ø´Ù…Ø§ Ø§Ø² Ù…ÙˆÙ‚Ø¹ÛŒØªâ€ŒÛŒØ§Ø¨ÛŒ Ù¾Ø´ØªÛŒØ¨Ø§Ù†ÛŒ Ù†Ù…ÛŒâ€ŒÚ©Ù†Ø¯');
                return;
            }
            showMsg('â³ Ø¯Ø± Ø­Ø§Ù„ Ø¯Ø±ÛŒØ§ÙØª Ù…ÙˆÙ‚Ø¹ÛŒØª...');
            navigator.geolocation.getCurrentPosition(function (pos) {
                var lat = pos.coords.latitude;
                var lng = pos.coords.longitude;
                var url = buildUrl(lat, lng, 'Ù…ÙˆÙ‚Ø¹ÛŒØª Ù…Ù†');
                var text = 'ðŸ“ Ù…ÙˆÙ‚Ø¹ÛŒØª Ù…Ù†\n' + url;
                mapFrame.src = buildEmbedUrl(lat, lng);
                if (navigator.share) {
                    navigator.share({ title: 'Ù…ÙˆÙ‚Ø¹ÛŒØª Ù…Ù†', text: text, url: url }).catch(function () {});
                    return;
                }
                copyText(text).then(function () {
                    showMsg('âœ… Ù„ÛŒÙ†Ú© Ù…ÙˆÙ‚Ø¹ÛŒØª Ø´Ù…Ø§ Ú©Ù¾ÛŒ Ø´Ø¯!');
                }).catch(function () {
                    showMsg('âŒ Ú©Ù¾ÛŒ Ù†Ø´Ø¯ØŒ Ù„Ø·ÙØ§Ù‹ Ø¯Ø³ØªÛŒ Ú©Ù¾ÛŒ Ú©Ù†ÛŒØ¯.');
                });
            }, function (err) {
                var m = 'âŒ Ø®Ø·Ø§ Ø¯Ø± Ø¯Ø±ÛŒØ§ÙØª Ù…ÙˆÙ‚Ø¹ÛŒØª';
                if (err) {
                    if (err.code === 1) m = 'âŒ Ø§Ø¬Ø§Ø²Ù‡â€ŒÛŒ Ø¯Ø³ØªØ±Ø³ÛŒ Ø¨Ù‡ Ù…ÙˆÙ‚Ø¹ÛŒØª Ø¯Ø§Ø¯Ù‡ Ù†Ø´Ø¯';
                    else if (err.code === 2) m = 'âŒ Ù…ÙˆÙ‚Ø¹ÛŒØª Ù…Ú©Ø§Ù†ÛŒ Ø¯Ø± Ø¯Ø³ØªØ±Ø³ Ù†ÛŒØ³Øª';
                    else if (err.code === 3) m = 'âŒ Ø²Ù…Ø§Ù† Ø¯Ø±ÛŒØ§ÙØª Ù…ÙˆÙ‚Ø¹ÛŒØª ØªÙ…Ø§Ù… Ø´Ø¯';
                }
                showMsg(m);
            }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
        });
        wrap.appendChild(myLocBtn);

        wrap.appendChild(msg);

        /* ---------- insert into the page ---------- */
        if (document.currentScript && document.currentScript.parentNode) {
            document.currentScript.parentNode.insertBefore(wrap, document.currentScript.nextSibling);
        } else {
            document.body.appendChild(wrap);
        }
    } catch (e) {
        try { console.warn('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ ÙˆÛŒØ¬Øª Ù†Ù‚Ø´Ù‡ Ùˆ Ù…ÙˆÙ‚Ø¹ÛŒØª:', e && e.message); } catch (e2) {}
    }
})();

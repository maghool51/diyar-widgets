(function () {
    'use strict';
    try {
        if (document.getElementById('shareLocationWidget')) return;

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
            '.share-location-widget{max-width:340px;margin:0 auto;padding:16px;background:#fff;border-radius:var(--radius,16px);box-shadow:var(--shadow,0 8px 24px rgba(0,0,0,.12));font-family:var(--font,\'Vazirmatn\',\'Segoe UI\',Tahoma,sans-serif);direction:rtl;text-align:right;box-sizing:border-box}' +
            '.share-location-widget *{box-sizing:border-box}' +
            '.slw-title{margin:0 0 12px;font-size:16px;font-weight:bold;color:var(--primary,#0b3d2e)}' +
            '.slw-select{width:100%;padding:9px 10px;margin-bottom:10px;border:1px solid #ddd;border-radius:10px;font-size:14px;font-family:inherit;background:#fafafa;color:#222}' +
            '.slw-buttons{display:flex;gap:8px;flex-wrap:wrap}' +
            '.slw-btn{flex:1 1 130px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 12px;border:none;border-radius:25px;font-size:13px;font-weight:bold;font-family:inherit;text-decoration:none;cursor:pointer;transition:var(--transition,.25s ease);white-space:nowrap}' +
            '.slw-btn-primary{background:var(--primary,#0b3d2e);color:#fff}' +
            '.slw-btn-primary:hover{background:var(--gold,#f0c040);color:#222}' +
            '.slw-btn-secondary{background:#f0ece2;color:var(--primary,#0b3d2e)}' +
            '.slw-btn-secondary:hover{background:var(--gold,#f0c040);color:#222}' +
            '.slw-btn-outline{display:block;width:100%;margin-top:8px;background:transparent;border:2px solid var(--primary,#0b3d2e);color:var(--primary,#0b3d2e)}' +
            '.slw-btn-outline:hover{background:var(--primary,#0b3d2e);color:#fff}' +
            'body.dark .slw-btn-outline{border-color:var(--gold-light,#ffe082);color:var(--gold-light,#ffe082)}' +
            'body.dark .slw-btn-outline:hover{background:var(--gold-light,#ffe082);color:#222}' +
            '.slw-msg{min-height:18px;margin-top:8px;font-size:12px;color:#2e7d32;text-align:center}' +
            'body.dark .share-location-widget{background:#1d1d1d;color:#f2f2f2}' +
            'body.dark .slw-select{background:#2a2a2a;color:#fff;border-color:#444}' +
            'body.dark .slw-btn-secondary{background:#2a2a2a;color:var(--gold-light,#ffe082)}';

        var styleEl = document.createElement('style');
        styleEl.textContent = css;
        document.head.appendChild(styleEl);

        /* ---------- markup (built via DOM, not innerHTML) ---------- */
        var wrap = document.createElement('div');
        wrap.className = 'share-location-widget';
        wrap.id = 'shareLocationWidget';

        var title = document.createElement('h3');
        title.className = 'slw-title';
        title.textContent = 'ðŸ“ Ø§Ø´ØªØ±Ø§Ú©â€ŒÚ¯Ø°Ø§Ø±ÛŒ Ù…ÙˆÙ‚Ø¹ÛŒØª';
        wrap.appendChild(title);

        var select = document.createElement('select');
        select.className = 'slw-select';
        select.setAttribute('aria-label', 'Ø§Ù†ØªØ®Ø§Ø¨ Ù…ÙˆÙ‚Ø¹ÛŒØª');
        LOCATIONS.forEach(function (loc) {
            var opt = document.createElement('option');
            opt.textContent = loc.name;
            opt.value = loc.lat + ',' + loc.lng;
            select.appendChild(opt);
        });
        wrap.appendChild(select);

        var msg = document.createElement('div');
        msg.className = 'slw-msg';
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
        btnRow.className = 'slw-buttons';

        var shareBtn = document.createElement('button');
        shareBtn.type = 'button';
        shareBtn.className = 'slw-btn slw-btn-primary';
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
        mapLink.className = 'slw-btn slw-btn-secondary';
        mapLink.target = '_blank';
        mapLink.rel = 'nofollow';
        mapLink.textContent = 'ðŸ—ºï¸ Ù…Ø³ÛŒØ±ÛŒØ§Ø¨ÛŒ';
        mapLink.href = buildUrl(LOCATIONS[0].lat, LOCATIONS[0].lng, LOCATIONS[0].name);
        function updateMapHref() {
            var loc = currentSelection();
            if (loc) mapLink.href = buildUrl(loc.lat, loc.lng, loc.name);
        }
        select.addEventListener('change', updateMapHref);
        btnRow.appendChild(mapLink);

        wrap.appendChild(btnRow);

        var myLocBtn = document.createElement('button');
        myLocBtn.type = 'button';
        myLocBtn.className = 'slw-btn slw-btn-outline';
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
        try { console.warn('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ ÙˆÛŒØ¬Øª Ø§Ø´ØªØ±Ø§Ú© Ù…ÙˆÙ‚Ø¹ÛŒØª:', e && e.message); } catch (e2) {}
    }
})();

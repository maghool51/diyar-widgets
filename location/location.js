(function () {
    'use strict';
    try {
        if (document.getElementById('locationWidget')) return;

        /* ==================================================================
           \u0644\u06cc\u0633\u062a \u0645\u0648\u0642\u0639\u06cc\u062a\u200c\u0647\u0627: \u0628\u0631\u0627\u06cc \u0627\u0641\u0632\u0648\u062f\u0646 \u0645\u0648\u0642\u0639\u06cc\u062a \u062c\u062f\u06cc\u062f \u06cc\u06a9 \u062e\u0637 \u062f\u06cc\u06af\u0631 \u0645\u062b\u0644 \u0632\u06cc\u0631 \u0627\u0636\u0627\u0641\u0647 \u06a9\u0646\u06cc\u062f:
           { name: '\u0646\u0627\u0645 \u0645\u0648\u0642\u0639\u06cc\u062a', lat: \u0639\u0631\u0636 \u062c\u063a\u0631\u0627\u0641\u06cc\u0627\u06cc\u06cc, lng: \u0637\u0648\u0644 \u062c\u063a\u0631\u0627\u0641\u06cc\u0627\u06cc\u06cc }
           ================================================================== */
        var LOCATIONS = [
            { name: '\u0627\u0645\u0627\u0645\u0632\u0627\u062f\u0647 \u0633\u06cc\u062f \u0645\u062d\u0645\u062f \u0633\u0627\u063a\u0646\u062f', lat: 34.452173, lng: 57.273014 },
            { name: '\u062d\u0648\u0646\u0648\u06cc\u0647', lat: 34.463493, lng: 57.280267 }
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
        title.textContent = '\ud83d\udccd \u0646\u0642\u0634\u0647 \u0648 \u0645\u0648\u0642\u0639\u06cc\u062a';
        wrap.appendChild(title);

        var select = document.createElement('select');
        select.className = 'lw-select';
        select.setAttribute('aria-label', '\u0627\u0646\u062a\u062e\u0627\u0628 \u0645\u0648\u0642\u0639\u06cc\u062a');
        LOCATIONS.forEach(function (loc) {
            var opt = document.createElement('option');
            opt.textContent = loc.name;
            opt.value = loc.lat + ',' + loc.lng;
            select.appendChild(opt);
        });
        wrap.appendChild(select);

        /* embedded map \u2014 plain iframe embed, no API key / no billing needed */
        var mapFrame = document.createElement('iframe');
        mapFrame.className = 'lw-map';
        mapFrame.setAttribute('loading', 'lazy');
        mapFrame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
        mapFrame.title = '\u0646\u0642\u0634\u0647 \u0645\u0648\u0642\u0639\u06cc\u062a';
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
        shareBtn.textContent = '\ud83d\udd17 \u0627\u0634\u062a\u0631\u0627\u06a9\u200c\u06af\u0630\u0627\u0631\u06cc';
        shareBtn.addEventListener('click', function () {
            var loc = currentSelection();
            if (!loc) return;
            var url = buildUrl(loc.lat, loc.lng, loc.name);
            var text = '\ud83d\udccd ' + loc.name + '\n' + url;
            if (navigator.share) {
                navigator.share({ title: loc.name, text: text, url: url }).catch(function () {});
                return;
            }
            copyText(text).then(function () {
                showMsg('\u2705 \u0644\u06cc\u0646\u06a9 \u0645\u0648\u0642\u0639\u06cc\u062a \u06a9\u067e\u06cc \u0634\u062f!');
            }).catch(function () {
                showMsg('\u274c \u06a9\u067e\u06cc \u0646\u0634\u062f\u060c \u0644\u0637\u0641\u0627\u064b \u062f\u0633\u062a\u06cc \u06a9\u067e\u06cc \u06a9\u0646\u06cc\u062f.');
            });
        });
        btnRow.appendChild(shareBtn);

        var mapLink = document.createElement('a');
        mapLink.className = 'lw-btn lw-btn-secondary';
        mapLink.target = '_blank';
        mapLink.rel = 'nofollow';
        mapLink.textContent = '\ud83d\uddfa\ufe0f \u0645\u0633\u06cc\u0631\u06cc\u0627\u0628\u06cc';

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
        myLocBtn.textContent = '\ud83d\udcf1 \u0627\u0634\u062a\u0631\u0627\u06a9\u200c\u06af\u0630\u0627\u0631\u06cc \u0645\u0648\u0642\u0639\u06cc\u062a \u0645\u0646';
        myLocBtn.addEventListener('click', function () {
            if (!navigator.geolocation) {
                showMsg('\u274c \u0645\u0631\u0648\u0631\u06af\u0631 \u0634\u0645\u0627 \u0627\u0632 \u0645\u0648\u0642\u0639\u06cc\u062a\u200c\u06cc\u0627\u0628\u06cc \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc \u0646\u0645\u06cc\u200c\u06a9\u0646\u062f');
                return;
            }
            showMsg('\u23f3 \u062f\u0631 \u062d\u0627\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u0645\u0648\u0642\u0639\u06cc\u062a...');
            navigator.geolocation.getCurrentPosition(function (pos) {
                var lat = pos.coords.latitude;
                var lng = pos.coords.longitude;
                var url = buildUrl(lat, lng, '\u0645\u0648\u0642\u0639\u06cc\u062a \u0645\u0646');
                var text = '\ud83d\udccd \u0645\u0648\u0642\u0639\u06cc\u062a \u0645\u0646\n' + url;
                mapFrame.src = buildEmbedUrl(lat, lng);
                if (navigator.share) {
                    navigator.share({ title: '\u0645\u0648\u0642\u0639\u06cc\u062a \u0645\u0646', text: text, url: url }).catch(function () {});
                    return;
                }
                copyText(text).then(function () {
                    showMsg('\u2705 \u0644\u06cc\u0646\u06a9 \u0645\u0648\u0642\u0639\u06cc\u062a \u0634\u0645\u0627 \u06a9\u067e\u06cc \u0634\u062f!');
                }).catch(function () {
                    showMsg('\u274c \u06a9\u067e\u06cc \u0646\u0634\u062f\u060c \u0644\u0637\u0641\u0627\u064b \u062f\u0633\u062a\u06cc \u06a9\u067e\u06cc \u06a9\u0646\u06cc\u062f.');
                });
            }, function (err) {
                var m = '\u274c \u062e\u0637\u0627 \u062f\u0631 \u062f\u0631\u06cc\u0627\u0641\u062a \u0645\u0648\u0642\u0639\u06cc\u062a';
                if (err) {
                    if (err.code === 1) m = '\u274c \u0627\u062c\u0627\u0632\u0647\u200c\u06cc \u062f\u0633\u062a\u0631\u0633\u06cc \u0628\u0647 \u0645\u0648\u0642\u0639\u06cc\u062a \u062f\u0627\u062f\u0647 \u0646\u0634\u062f';
                    else if (err.code === 2) m = '\u274c \u0645\u0648\u0642\u0639\u06cc\u062a \u0645\u06a9\u0627\u0646\u06cc \u062f\u0631 \u062f\u0633\u062a\u0631\u0633 \u0646\u06cc\u0633\u062a';
                    else if (err.code === 3) m = '\u274c \u0632\u0645\u0627\u0646 \u062f\u0631\u06cc\u0627\u0641\u062a \u0645\u0648\u0642\u0639\u06cc\u062a \u062a\u0645\u0627\u0645 \u0634\u062f';
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
        try { console.warn('\u062e\u0637\u0627 \u062f\u0631 \u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc \u0648\u06cc\u062c\u062a \u0646\u0642\u0634\u0647 \u0648 \u0645\u0648\u0642\u0639\u06cc\u062a:', e && e.message); } catch (e2) {}
    }
})();

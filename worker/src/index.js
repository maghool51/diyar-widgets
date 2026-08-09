/**
 * ==============================================================================
 * Diyar Visitor Widget — Real-Time Tracking Worker
 * ==============================================================================
 * Two routes, nothing else:
 *
 *   POST /hit        Called by visitor/embed.js on every real page load.
 *                     Records one deduplicated visit into D1. Public,
 *                     unauthenticated (it has to be — any visitor's browser
 *                     calls it), returns only `{ ok: true }`.
 *
 *   GET  /aggregate   Called by the GitHub Actions publish workflow on a
 *                     schedule. Requires the `X-Publish-Secret` header to
 *                     match the Worker's PUBLISH_SECRET, returning the exact
 *                     seven-field JSON shape visitor/stats.json has always
 *                     used — { today, yesterday, week, month, total, online,
 *                     updatedAt } — computed live from real D1 rows.
 *
 * PRIVACY
 * ------------------------------------------------------------------------------
 * The visitor's raw IP address is never stored. Deduplication uses
 * SHA-256(IP + User-Agent + calendar day) — a value that rotates every day
 * and cannot be reversed back into the original IP.
 *
 * @module worker
 * @license MIT
 * ==============================================================================
 */

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // a visitor counts as "online" for 5 minutes after their last hit
const WEEK_WINDOW_DAYS = 7;             // rolling 7-day window, not calendar-week
const MONTH_WINDOW_DAYS = 30;           // rolling 30-day window, not calendar-month

/**
 * Formats a Date as 'YYYY-MM-DD' in the Asia/Tehran timezone — matching the
 * timezone `config.js`'s `TIMEZONE` already uses for the widget's own
 * "last updated" display, so the day boundary visitors see matches the day
 * boundary this Worker counts by.
 *
 * @param {Date} date
 * @returns {string}
 */
function tehranDateString(date) {
  // 'en-CA' formats as YYYY-MM-DD, which is exactly the sortable, comparable
  // string format used as the `visit_date` column value throughout.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * @param {number} n - Number of days to go back.
 * @param {Date} from
 * @returns {string} 'YYYY-MM-DD', n days before `from`, in Asia/Tehran.
 */
function daysAgoDateString(n, from) {
  return tehranDateString(new Date(from.getTime() - n * 24 * 60 * 60 * 1000));
}

/**
 * @param {string} input
 * @returns {Promise<string>} Lowercase hex SHA-256 digest of `input`.
 */
async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * @param {string|null} origin
 * @returns {Record<string,string>}
 */
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Publish-Secret',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Records one visit. Idempotent per (visitor, calendar day): a second hit
 * from the same visitor on the same day updates their "last seen" time (for
 * the online figure) but does NOT increase today/week/month/total again.
 *
 * @param {Request} request
 * @param {{DIYAR_DB: import('@cloudflare/workers-types').D1Database}} env
 * @returns {Promise<Response>}
 */
async function handleHit(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  const now = new Date();
  const visitDate = tehranDateString(now);
  const ts = now.getTime();

  const visitorHash = await sha256Hex(`${ip}|${userAgent}|${visitDate}`);

  try {
    await env.DIYAR_DB.batch([
      env.DIYAR_DB.prepare(
        'INSERT OR IGNORE INTO visits (visitor_hash, visit_date, ts) VALUES (?, ?, ?)'
      ).bind(visitorHash, visitDate, ts),
      env.DIYAR_DB.prepare(
        'INSERT INTO sessions (visitor_hash, last_seen) VALUES (?, ?) ' +
          'ON CONFLICT(visitor_hash) DO UPDATE SET last_seen = excluded.last_seen'
      ).bind(visitorHash, ts),
    ]);
  } catch (error) {
    // A visitor-facing beacon endpoint must never surface a 500 that could
    // show up as a console error on someone else's website — log it
    // Worker-side (visible in `wrangler tail`) and still respond 200.
    console.error('handleHit: D1 write failed:', error);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request.headers.get('Origin')),
    },
  });
}

/**
 * Computes and returns the current aggregate stats, in exactly the shape
 * `visitor/stats.json` has always used. Requires a matching
 * `X-Publish-Secret` header — this endpoint is meant to be called only by
 * the GitHub Actions publish workflow, not by visitor browsers.
 *
 * @param {Request} request
 * @param {{DIYAR_DB: import('@cloudflare/workers-types').D1Database, PUBLISH_SECRET: string}} env
 * @returns {Promise<Response>}
 */
async function handleAggregate(request, env) {
  const providedSecret = request.headers.get('X-Publish-Secret');
  if (!env.PUBLISH_SECRET || providedSecret !== env.PUBLISH_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date();
  const today = tehranDateString(now);
  const yesterday = daysAgoDateString(1, now);
  const weekStart = daysAgoDateString(WEEK_WINDOW_DAYS - 1, now);
  const monthStart = daysAgoDateString(MONTH_WINDOW_DAYS - 1, now);
  const onlineThreshold = now.getTime() - ONLINE_WINDOW_MS;

  const [todayRow, yesterdayRow, weekRow, monthRow, totalRow, onlineRow] = await Promise.all([
    env.DIYAR_DB.prepare('SELECT COUNT(*) AS n FROM visits WHERE visit_date = ?').bind(today).first(),
    env.DIYAR_DB.prepare('SELECT COUNT(*) AS n FROM visits WHERE visit_date = ?').bind(yesterday).first(),
    env.DIYAR_DB.prepare('SELECT COUNT(*) AS n FROM visits WHERE visit_date >= ?').bind(weekStart).first(),
    env.DIYAR_DB.prepare('SELECT COUNT(*) AS n FROM visits WHERE visit_date >= ?').bind(monthStart).first(),
    env.DIYAR_DB.prepare('SELECT COUNT(*) AS n FROM visits').first(),
    env.DIYAR_DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE last_seen > ?').bind(onlineThreshold).first(),
  ]);

  // `total` is the running count of every (visitor, day) row ever recorded
  // — i.e. the sum of all daily-unique counts since launch — matching the
  // conventional meaning of "total visits" for this kind of widget, as
  // opposed to "total distinct humans ever" (which daily-rotating hashes
  // cannot answer, by design, for privacy reasons).
  const stats = {
    today: todayRow?.n ?? 0,
    yesterday: yesterdayRow?.n ?? 0,
    week: weekRow?.n ?? 0,
    month: monthRow?.n ?? 0,
    total: totalRow?.n ?? 0,
    online: onlineRow?.n ?? 0,
    updatedAt: now.toISOString(),
  };

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default {
  /**
   * @param {Request} request
   * @param {*} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin')) });
    }

    if (url.pathname === '/hit' && request.method === 'POST') {
      return handleHit(request, env);
    }

    if (url.pathname === '/aggregate' && request.method === 'GET') {
      return handleAggregate(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};

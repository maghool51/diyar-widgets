var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var ONLINE_WINDOW_MS = 5 * 60 * 1e3;
var WEEK_WINDOW_DAYS = 7;
var MONTH_WINDOW_DAYS = 30;
function tehranDateString(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}
__name(tehranDateString, "tehranDateString");
function daysAgoDateString(n, from) {
  return tehranDateString(new Date(from.getTime() - n * 24 * 60 * 60 * 1e3));
}
__name(daysAgoDateString, "daysAgoDateString");
async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Publish-Secret",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
async function handleHit(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const userAgent = request.headers.get("User-Agent") || "unknown";
  const now = /* @__PURE__ */ new Date();
  const visitDate = tehranDateString(now);
  const ts = now.getTime();
  const visitorHash = await sha256Hex(`${ip}|${userAgent}|${visitDate}`);
  try {
    await env.DIYAR_DB.batch([
      env.DIYAR_DB.prepare(
        "INSERT OR IGNORE INTO visits (visitor_hash, visit_date, ts) VALUES (?, ?, ?)"
      ).bind(visitorHash, visitDate, ts),
      env.DIYAR_DB.prepare(
        "INSERT INTO sessions (visitor_hash, last_seen) VALUES (?, ?) ON CONFLICT(visitor_hash) DO UPDATE SET last_seen = excluded.last_seen"
      ).bind(visitorHash, ts)
    ]);
  } catch (error) {
    console.error("handleHit: D1 write failed:", error);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request.headers.get("Origin"))
    }
  });
}
__name(handleHit, "handleHit");
async function handleAggregate(request, env) {
  const providedSecret = request.headers.get("X-Publish-Secret");
  if (!env.PUBLISH_SECRET || providedSecret !== env.PUBLISH_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const now = /* @__PURE__ */ new Date();
  const today = tehranDateString(now);
  const yesterday = daysAgoDateString(1, now);
  const weekStart = daysAgoDateString(WEEK_WINDOW_DAYS - 1, now);
  const monthStart = daysAgoDateString(MONTH_WINDOW_DAYS - 1, now);
  const onlineThreshold = now.getTime() - ONLINE_WINDOW_MS;
  const [todayRow, yesterdayRow, weekRow, monthRow, totalRow, onlineRow] = await Promise.all([
    env.DIYAR_DB.prepare("SELECT COUNT(*) AS n FROM visits WHERE visit_date = ?").bind(today).first(),
    env.DIYAR_DB.prepare("SELECT COUNT(*) AS n FROM visits WHERE visit_date = ?").bind(yesterday).first(),
    env.DIYAR_DB.prepare("SELECT COUNT(*) AS n FROM visits WHERE visit_date >= ?").bind(weekStart).first(),
    env.DIYAR_DB.prepare("SELECT COUNT(*) AS n FROM visits WHERE visit_date >= ?").bind(monthStart).first(),
    env.DIYAR_DB.prepare("SELECT COUNT(*) AS n FROM visits").first(),
    env.DIYAR_DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE last_seen > ?").bind(onlineThreshold).first()
  ]);
  const stats = {
    today: todayRow?.n ?? 0,
    yesterday: yesterdayRow?.n ?? 0,
    week: weekRow?.n ?? 0,
    month: monthRow?.n ?? 0,
    total: totalRow?.n ?? 0,
    online: onlineRow?.n ?? 0,
    updatedAt: now.toISOString()
  };
  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleAggregate, "handleAggregate");

// NEW: public, unauthenticated, live "online" counter.
// Reuses the exact same query/window handleAggregate already uses internally —
// no new logic, no new table, no IP/hash/session data returned.
async function handleOnline(request, env) {
  const onlineThreshold = Date.now() - ONLINE_WINDOW_MS;
  const row = await env.DIYAR_DB.prepare(
    "SELECT COUNT(*) AS n FROM sessions WHERE last_seen > ?"
  ).bind(onlineThreshold).first();
  return new Response(JSON.stringify({ online: row?.n ?? 0 }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request.headers.get("Origin"))
    }
  });
}
__name(handleOnline, "handleOnline");

var index_default = {
  /**
   * @param {Request} request
   * @param {*} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("Origin")) });
    }
    if (url.pathname === "/hit" && request.method === "POST") {
      return handleHit(request, env);
    }
    if (url.pathname === "/aggregate" && request.method === "GET") {
      return handleAggregate(request, env);
    }
    if (url.pathname === "/online" && request.method === "GET") {
      return handleOnline(request, env);
    }
    return new Response("Not found", { status: 404 });
  }
};
export {
  index_default as default
};
/**
 * ==============================================================================
 * Diyar Visitor Widget — Real-Time Tracking Worker
 * ==============================================================================
 * Three routes, nothing else:
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
 *   GET  /online      Public, unauthenticated. Returns only { online }
 *                     computed live from D1 sessions (same 5-minute window
 *                     as /aggregate's online field). Added so the Blogfa
 *                     widget can show a live online count without needing
 *                     the publish secret and without waiting for the
 *                     GitHub Actions snapshot cycle. Does not affect
 *                     /aggregate, /hit, or the stats.json publish flow.
 *
 * PRIVACY
 * ------------------------------------------------------------------------------
 * The visitor's raw IP address is never stored. Deduplication uses
 * SHA-256(IP + User-Agent + calendar day) — a value that rotates every day
 * and cannot be reversed back into the original IP. /online returns only
 * a count — no hash, IP, user agent, or session id ever leaves the Worker.
 *
 * @module worker
 * @license MIT
 * ==============================================================================
 */
//# sourceMappingURL=index.js.map

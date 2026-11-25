// PickHit website (Cloudflare Worker). Serves the app and fetches sports data for it.
// Setup: dash.cloudflare.com -> Workers & Pages -> Create -> Worker -> Deploy -> Edit code ->
// replace everything with this file -> Deploy. Your site is the *.workers.dev link it gives you.

const ALLOW = new Set(["api.prizepicks.com", "partner-api.prizepicks.com", "site.api.espn.com", "site.web.api.espn.com", "sports.core.api.espn.com", "stats.nba.com",
  "www.sofascore.com", "api.sofascore.com", "www.reddit.com", "news.google.com",
  "ufcstats.com", "www.ufcstats.com", "api.nhle.com", "api-web.nhle.com", "statsapi.mlb.com"]);
const HTTP_OK = new Set(["ufcstats.com", "www.ufcstats.com"]);   // UFC Stats only serves plain http
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MIN = 60, HOUR = 3600, DAY = 86400;

// how long everyone shares one copy of an answer (seconds)
function ttl(u) {
  const h = u.hostname, p = u.pathname, q = u.searchParams, now = new Date();
  if (h.endsWith("prizepicks.com")) return 2 * MIN;
  if (h === "site.web.api.espn.com" && p.includes("/gamelog")) {
    const s = +q.get("season"), football = p.includes("/football/");
    const cur = football ? (now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1)
                         : (now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear());
    return s && s < cur ? 30 * DAY : HOUR;
  }
  if (h === "site.api.espn.com" && p.endsWith("/teams")) return 7 * DAY;
  if (h === "site.api.espn.com" && p.includes("/roster")) return 6 * HOUR;
  if (h.includes("espn.com") && (p.endsWith("/scoreboard") || p.endsWith("/summary"))) return 60;   // game states and live box scores
  if (h.includes("espn.com")) return 10 * MIN;
  if (h === "stats.nba.com") return 3 * HOUR;
  if (h.endsWith("sofascore.com")) return p.endsWith("/statistics") ? 30 * DAY : p.includes("/search/") ? 7 * DAY : HOUR;
  if (h === "www.reddit.com") return 15 * MIN;
  if (h === "news.google.com") return 30 * MIN;
  if (h.endsWith("ufcstats.com")) return p.includes("/search") ? 7 * DAY : 6 * HOUR;
  if (h.endsWith("nhle.com")) return 3 * HOUR;
  return MIN;
}
function headersFor(h) {
  const hd = { "User-Agent": UA, "Accept": "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9" };
  if (h.endsWith("prizepicks.com")) { hd.Referer = "https://app.prizepicks.com/"; hd.Origin = "https://app.prizepicks.com"; }
  if (h === "stats.nba.com") { hd.Referer = "https://www.nba.com/"; hd.Origin = "https://www.nba.com"; hd["x-nba-stats-origin"] = "stats"; hd["x-nba-stats-token"] = "true"; }
  if (h.endsWith("sofascore.com")) { hd.Referer = "https://www.sofascore.com/"; hd.Origin = "https://www.sofascore.com"; }
  if (h === "www.reddit.com") hd["User-Agent"] = "web:pickprizer:1.0";
  return hd;
}
async function proxy(req, ctx) {
  let t;
  try { t = new URL(new URL(req.url).searchParams.get("u")); } catch { return json({ message: "bad url" }, 400); }
  if (!(t.protocol === "https:" || (t.protocol === "http:" && HTTP_OK.has(t.hostname))) || !ALLOW.has(t.hostname)) return json({ message: "host not allowed" }, 403);
  const cache = caches.default, key = new Request("https://cache.pickprizer/" + encodeURIComponent(t.toString()));
  const hit = await cache.match(key);
  if (hit) return hit;
  let r, body;
  const tries = t.hostname.endsWith("prizepicks.com") ? 1 : 3;   // PrizePicks either answers or blocks; don't make people wait
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      r = await fetch(t.toString(), { headers: headersFor(t.hostname), signal: AbortSignal.timeout(9000) });
      body = await r.arrayBuffer();
      if (r.status !== 429 && r.status < 500) break;
    } catch (e) { r = null; body = null; }
    await new Promise(z => setTimeout(z, 700 * (attempt + 1)));
  }
  if (!r) return json({ message: "could not reach " + t.hostname }, 502);
  const out = new Response(body, { status: r.status, headers: {
    "content-type": r.headers.get("content-type") || "application/json",
    "cache-control": r.status === 200 ? "public, max-age=" + ttl(t) : "no-store" } });
  if (r.status === 200) ctx.waitUntil(cache.put(key, out.clone()));
  return out;
}
// Shared storage (Cloudflare KV, binding "KV"): the PrizePicks board someone (or the iPhone Shortcut) sent in, and the
// finished ratings, so the next visitor sees picks instantly instead of redoing minutes of work.
// Falls back to memory + cache if KV isn't set up.
const MEM = new Map();
async function kvGet(env, k) {
  if (env.KV) { try { const r = await env.KV.getWithMetadata(k); if (r && r.value) return { text: r.value, t: (r.metadata && r.metadata.t) || 0 }; } catch (e) {} }
  const m = MEM.get(k); if (m) return m;
  const hit = await caches.default.match(new Request("https://cache.pickprizer/" + k));
  return hit ? { text: await hit.text(), t: +(hit.headers.get("x-t") || 0) } : null;
}
async function kvPut(env, ctx, k, text, ttlSec) {
  const t = Date.now();
  MEM.set(k, { text, t });
  if (env.KV) { try { await env.KV.put(k, text, { expirationTtl: ttlSec, metadata: { t } }); } catch (e) {} }
  ctx.waitUntil(caches.default.put(new Request("https://cache.pickprizer/" + k), new Response(text, { headers: { "content-type": "application/json", "x-t": String(t), "cache-control": "public, max-age=" + ttlSec } })));
}
const stored = (o) => new Response(o.text, { headers: { "content-type": "application/json", "cache-control": "no-store", "x-age": String(Math.round((Date.now() - o.t) / 1000)), "access-control-expose-headers": "x-age" } });
// The list of PrizePicks links the iPhone Shortcut loads (one per line), so nobody has to type them.
const SC_LEAGUES = [7, 9, 15, 20, 8, 5, 82, 1, 12, 2, 3];
// period boards PrizePicks lists as separate leagues (their numbers are learned from the league list the Shortcut sends)
const SC_EXTRA = ["NBA2H", "NBA4Q"];
async function scList(env) {
  const ids = [...SC_LEAGUES];
  try { const o = await kvGet(env, "leagues"); if (o) for (const l of JSON.parse(o.text).data || []) if (SC_EXTRA.includes(String(l.attributes && l.attributes.name || "").toUpperCase())) ids.push(+l.id); } catch (e) {}
  const urls = ids.map(l => `https://api.prizepicks.com/projections?per_page=1000&single_stat=true&league_id=${l}`);
  urls.push("https://api.prizepicks.com/leagues");
  return new Response(urls.join("\n"), { headers: { "content-type": "text/plain", "cache-control": "no-store" } });
}
const scListOld = () => new Response(SC_LEAGUES.map(l => `https://api.prizepicks.com/projections?per_page=1000&single_stat=true&league_id=${l}`).join("\n"), { headers: { "content-type": "text/plain", "cache-control": "no-store" } });
async function board(req, env, ctx, league) {
  if (!league) {   // the Shortcut posts every board to /board: read which league it is from the board itself
    if (req.method !== "POST") return json({ message: "method" }, 405);
    const text = await req.text();
    if (text.length < 2e6 && /"type"\s*:\s*"league"/.test(text) && !text.includes('"projection"')) {   // PrizePicks' league list
      try { if (Array.isArray(JSON.parse(text).data)) { const old = await kvGet(env, "leagues"); if (!old || Date.now() - old.t > 12 * 3600e3) await kvPut(env, ctx, "leagues", text, 30 * DAY); return json({ ok: true, leagues: true }, 200); } } catch (e) {}
    }
    const m = text.match(/"league"\s*:\s*\{\s*"data"\s*:\s*\{[^}]*"id"\s*:\s*"?(\d{1,4})/);
    if (!m) return json({ message: "empty or not a PrizePicks board" }, 200);
    return board(new Request(req.url, { method: "POST", body: text }), env, ctx, m[1]);
  }
  const k = "board/" + league;
  if (req.method === "GET") { const o = await kvGet(env, k); return o ? stored(o) : json({ message: "no shared board" }, 404); }
  if (req.method !== "POST") return json({ message: "method" }, 405);
  const text = await req.text();
  if (text.length > 12e6) return json({ message: "too big" }, 413);
  if (!/^\s*\{\s*"data"\s*:\s*\[\s*\{/.test(text.slice(0, 200)) || !text.includes('"projection"')) return json({ message: "not a PrizePicks board" }, 400);
  await kvPut(env, ctx, k, text, 2 * DAY);
  // Time machine: keep one pregame snapshot per day (the last one saved before 7pm ET), for 90 days, straight to KV.
  const now = new Date(), et = new Date(now.getTime() - 5 * 3600e3), day = et.toISOString().slice(0, 10);
  if (env.KV && et.getUTCHours() < 19) ctx.waitUntil(env.KV.put("snap/" + sport + "/" + day, text, { expirationTtl: 90 * DAY, metadata: { t: Date.now() } }).catch(() => {}));
  return json({ ok: true }, 200);
}
async function snap(req, env, sport, day) {
  if (!env.KV) return json({ message: "no storage" }, 404);
  if (!day) { const l = await env.KV.list({ prefix: "snap/" + sport + "/" }); return json({ dates: l.keys.map(k => k.name.split("/")[2]).sort() }, 200); }
  const text = await env.KV.get("snap/" + sport + "/" + day);
  return text ? new Response(text, { headers: { "content-type": "application/json", "cache-control": "public, max-age=86400" } }) : json({ message: "none" }, 404);
}
// Shared track record: graded picks from everyone, deduped per pick, so the app can measure and correct itself.
// Stored as {sport: {key: [predicted, hit, day]}}; GET returns {sport: [[predicted, hit], ...]}.
async function track(req, env, ctx) {
  const o = await kvGet(env, "track"); let data = {};
  try { data = o ? JSON.parse(o.text) : {}; } catch (e) { data = {}; }
  if (req.method === "GET") {
    const out = {}; for (const s in data) out[s] = Object.values(data[s]).map(v => [v[0], v[1]]);
    return new Response(JSON.stringify(out), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
  if (req.method !== "POST") return json({ message: "method" }, 405);
  const text = await req.text(); if (text.length > 200000) return json({ message: "too big" }, 413);
  let b; try { b = JSON.parse(text); } catch (e) { return json({ message: "bad" }, 400); }
  if (!b || b.v !== 1 || !/^[a-z]{2,8}$/.test(b.sport || "") || !Array.isArray(b.rows)) return json({ message: "bad" }, 400);
  const S = data[b.sport] ||= {}, day = Math.floor(Date.now() / 864e5);
  let added = 0;
  for (const r of b.rows.slice(0, 400)) {
    if (!Array.isArray(r) || typeof r[0] !== "string" || r[0].length > 120 || !(r[1] >= 0 && r[1] <= 1) || !(r[2] === 0 || r[2] === 1)) continue;
    if (!S[r[0]]) { S[r[0]] = [Math.round(r[1] * 100) / 100, r[2], day]; added++; }
  }
  if (!added) return json({ ok: true, added: 0 }, 200);
  for (const s in data) { const e = Object.entries(data[s]).filter(([, v]) => day - v[2] <= 30); data[s] = Object.fromEntries(e.slice(-4000)); }
  await kvPut(env, ctx, "track", JSON.stringify(data), 40 * DAY);
  return json({ ok: true, added }, 200);
}
async function rated(req, env, ctx, sport) {
  const k = "rated/" + sport;
  if (req.method === "GET") { const o = await kvGet(env, k); return o ? stored(o) : json({ message: "none yet" }, 404); }
  if (req.method !== "POST") return json({ message: "method" }, 405);
  const text = await req.text();
  if (text.length > 6e6 || !text.startsWith('{"v":16,')) return json({ message: "bad" }, 400);
  const o = await kvGet(env, k);
  if (o && Date.now() - o.t < 4 * MIN * 1000) return json({ ok: true, skipped: true }, 200);   // someone just saved one
  await kvPut(env, ctx, k, text, 2 * DAY);
  return json({ ok: true }, 200);
}

// ---------- ACCOUNTS, PLANS AND PAYMENTS
// Users live in KV ("user/<name>"). Passwords are salted PBKDF2 hashes (never stored or logged in plain text).
// Sessions are signed cookies that carry the plan, so data routes can check access without a KV read per request.
// Plans: guest (not signed in) < free < basic ($4.99) < pro ($14.99). "dev" accounts see everything and can preview plans.
const PLAN_RANK = { guest: 0, free: 1, basic: 2, pro: 3 };
const ITER = 15000;   // PBKDF2 rounds: sized for the free Workers plan's 10 ms CPU budget; stored per user so it can be raised
const SESSION_DAYS = 180, PLAN_FRESH_MS = 3 * DAY * 1000;
const enc = new TextEncoder();
const b64u = buf => { let s = ""; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const same = (a, b) => { if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; };
// the owner's developer account (password hash only; change the password from the account menu any time)
const BUILTIN = { pickhitdev: { u: "PickHitDev", s: "Z8vcqrYMz081-SNOpuPtAA", h: "motRzw3K7mYf6djfVFyc31_tcQshCTeRAiLoGUZzWK0", it: 15000, plan: "pro", role: "dev" } };
const RESERVED = /^(admin|administrator|support|pickhit|pickhitdev|root|system|owner|moderator|staff)$/i;
let HMACKEY = null;
async function hmacKey(env) {
  if (HMACKEY) return HMACKEY;
  let s = env.SESSION_SECRET || (env.KV ? await env.KV.get("cfg/secret") : null);
  if (!s) { s = b64u(crypto.getRandomValues(new Uint8Array(32))); if (env.KV) await env.KV.put("cfg/secret", s); }
  return HMACKEY = await crypto.subtle.importKey("raw", enc.encode(s), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
const sign = async (env, msg) => b64u(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(msg)));
async function pwHash(pw, saltB64, it) {
  const k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return b64u(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unb64u(saltB64), iterations: it }, k, 256));
}
async function getUser(env, name) {
  const k = String(name || "").toLowerCase();
  if (env.KV) { const t = await env.KV.get("user/" + k); if (t) { try { return JSON.parse(t); } catch (e) {} } }
  return BUILTIN[k] ? { ...BUILTIN[k] } : null;
}
const putUser = (env, u) => env.KV.put("user/" + u.u.toLowerCase(), JSON.stringify(u));
const effPlan = u => u.role === "dev" ? "pro" : (u.plan || "free");
async function makeCookie(env, u) {
  const body = b64u(enc.encode(JSON.stringify({ u: u.u.toLowerCase(), n: u.u, p: effPlan(u), r: u.role || "user", v: Date.now(), e: Date.now() + SESSION_DAYS * DAY * 1000 })));
  return `ph=${body}.${await sign(env, body)}; Path=/; Max-Age=${SESSION_DAYS * DAY}; HttpOnly; Secure; SameSite=Lax`;
}
const CLEAR = "ph=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
async function session(req, env) {
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)ph=([^;]+)/); if (!m) return null;
  const [body, sig] = m[1].split("."); if (!body || !sig || !same(sig, await sign(env, body))) return null;
  let s; try { s = JSON.parse(new TextDecoder().decode(unb64u(body))); } catch (e) { return null; }
  return s && s.e > Date.now() ? s : null;
}
// plan check for data routes: the plan inside the cookie must have been confirmed in the last 3 days (the app refreshes it on open)
async function access(req, env) { const s = await session(req, env); return s && Date.now() - s.v < PLAN_FRESH_MS ? s.p : s ? "stale" : "guest"; }
const meOut = u => ({ user: u.u, plan: effPlan(u), role: u.role || "user", base: u.plan || "free", google: !!u.g });
const withCookie = (o, cookie, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "set-cookie": cookie } });
async function readJSON(req, max = 20000) { const t = await req.text(); if (t.length > max) throw new Error("too big"); return JSON.parse(t); }
// failed-login throttle (per name + IP, in the edge cache, so it costs no KV writes)
async function tooMany(req, name, bump) {
  const ip = req.headers.get("cf-connecting-ip") || "x", key = new Request("https://rl.pickhit/" + encodeURIComponent(ip + "|" + name));
  const hit = await caches.default.match(key), n = hit ? +(await hit.text()) : 0;
  if (bump) await caches.default.put(key, new Response(String(n + 1), { headers: { "cache-control": "max-age=900" } }));
  return n >= 10;
}
async function auth(req, env, path) {
  if (!env.KV && path !== "/auth/config" && path !== "/auth/me") return json({ message: "Accounts need the KV storage set up." }, 503);
  if (path === "/auth/config") return json({ google: env.GOOGLE_CLIENT_ID || null, pay: !!(env.WHOP_API_KEY && env.WHOP_PLAN_BASIC && env.WHOP_PLAN_PRO), manage: env.WHOP_MANAGE_URL || "https://whop.com/@me/settings/memberships/" }, 200);
  if (path === "/auth/me") {
    const s = await session(req, env); if (!s) return json({ user: null }, 200);
    const u = await getUser(env, s.u); if (!u) return withCookie({ user: null }, CLEAR);
    return withCookie(meOut(u), await makeCookie(env, u));   // refreshes the plan inside the cookie
  }
  if (path === "/auth/logout") return withCookie({ ok: true }, CLEAR);
  if (req.method !== "POST") return json({ message: "method" }, 405);
  let b; try { b = await readJSON(req); } catch (e) { return json({ message: "bad request" }, 400); }
  if (path === "/auth/signup") {
    const name = String(b.username || "").trim(), pw = String(b.password || "");
    if (!/^[A-Za-z0-9_.]{3,20}$/.test(name)) return json({ message: "Username: 3-20 letters, numbers, dots or underscores." }, 400);
    if (RESERVED.test(name) || BUILTIN[name.toLowerCase()]) return json({ message: "That username is taken." }, 409);
    if (pw.length < 8 || pw.length > 200) return json({ message: "Password needs at least 8 characters." }, 400);
    if (await getUser(env, name)) return json({ message: "That username is taken." }, 409);
    const s = b64u(crypto.getRandomValues(new Uint8Array(16))), u = { u: name, s, h: await pwHash(pw, s, ITER), it: ITER, plan: "free", role: "user", t: Date.now() };
    await putUser(env, u);
    return withCookie(meOut(u), await makeCookie(env, u));
  }
  if (path === "/auth/login") {
    const name = String(b.username || "").trim().toLowerCase(), pw = String(b.password || "");
    if (await tooMany(req, name, false)) return json({ message: "Too many tries. Wait 15 minutes and try again." }, 429);
    const u = await getUser(env, name);
    if (!u || !u.h || !same(await pwHash(pw, u.s, u.it || ITER), u.h)) { await tooMany(req, name, true); return json({ message: "Wrong username or password." }, 401); }
    if ((u.it || 0) < ITER) { u.s = b64u(crypto.getRandomValues(new Uint8Array(16))); u.h = await pwHash(pw, u.s, ITER); u.it = ITER; await putUser(env, u); }
    return withCookie(meOut(u), await makeCookie(env, u));
  }
  if (path === "/auth/password") {
    const s = await session(req, env); if (!s) return json({ message: "Sign in first." }, 401);
    const u = await getUser(env, s.u), np = String(b.next || "");
    if (!u || (u.h && !same(await pwHash(String(b.old || ""), u.s, u.it || ITER), u.h))) return json({ message: "Current password is wrong." }, 401);
    if (np.length < 8 || np.length > 200) return json({ message: "New password needs at least 8 characters." }, 400);
    u.s = b64u(crypto.getRandomValues(new Uint8Array(16))); u.h = await pwHash(np, u.s, ITER); u.it = ITER;
    await putUser(env, u);
    return json({ ok: true }, 200);
  }
  if (path === "/auth/google") {
    if (!env.GOOGLE_CLIENT_ID) return json({ message: "Google sign-in isn't set up." }, 400);
    let info; try { const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(String(b.credential || ""))); info = r.ok ? await r.json() : null; } catch (e) { info = null; }
    if (!info || info.aud !== env.GOOGLE_CLIENT_ID || !/accounts\.google\.com$/.test(info.iss || "") || !(+info.exp * 1000 > Date.now()) || !info.sub) return json({ message: "Google sign-in failed." }, 401);
    // only Google's account id is kept, never the email address
    let name = await env.KV.get("g/" + info.sub), u = name ? await getUser(env, name) : null;
    if (!u) {
      const base = String(info.given_name || "player").replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "player";
      for (let i = 0; i < 6 && !u; i++) { const cand = base + (100 + Math.floor(Math.random() * 9900)); if (!(await getUser(env, cand))) u = { u: cand, g: info.sub, plan: "free", role: "user", t: Date.now() }; }
      if (!u) return json({ message: "Try again." }, 500);
      await putUser(env, u); await env.KV.put("g/" + info.sub, u.u.toLowerCase());
    }
    return withCookie(meOut(u), await makeCookie(env, u));
  }
  return json({ message: "not found" }, 404);
}
// ---------- PAYMENTS (Whop: built for betting-analysis products; no monthly fee, a small cut per payment)
// /pay/checkout makes a Whop checkout link tagged with the PickHit username, so the payment webhook knows whose plan to upgrade.
async function payCheckout(req, env) {
  const s = await session(req, env); if (!s) return json({ message: "Create an account or sign in first." }, 401);
  let b; try { b = await readJSON(req); } catch (e) { return json({ message: "bad request" }, 400); }
  const plan = b.plan === "basic" ? "basic" : b.plan === "pro" ? "pro" : null, planId = plan === "basic" ? env.WHOP_PLAN_BASIC : env.WHOP_PLAN_PRO;
  if (!plan || !env.WHOP_API_KEY || !planId) return json({ message: "Payments aren't switched on yet." }, 503);
  const origin = new URL(req.url).origin;
  const r = await fetch("https://api.whop.com/api/v1/checkout_configurations", { method: "POST",
    headers: { "Authorization": "Bearer " + env.WHOP_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ plan_id: planId, metadata: { pickhit_user: s.u, pickhit_plan: plan }, redirect_url: origin + "/?paid=1" }) });
  const js = await r.json().catch(() => ({}));
  if (!r.ok || !js.purchase_url) return json({ message: "Checkout couldn't start (Whop said: " + String((js.error && js.error.message) || js.message || r.status).slice(0, 120) + ")" }, 502);
  return json({ url: js.purchase_url }, 200);
}
async function whopVerify(req, env, raw) {
  const id = req.headers.get("webhook-id"), ts = req.headers.get("webhook-timestamp"), sigs = (req.headers.get("webhook-signature") || "").split(" ");
  if (!id || !ts || !env.WHOP_WEBHOOK_SECRET || Math.abs(Date.now() / 1000 - +ts) > 300) return false;
  const msg = enc.encode(`${id}.${ts}.${raw}`), sec = env.WHOP_WEBHOOK_SECRET, keys = [enc.encode(sec)];
  try { const k = sec.replace(/^(ws|whsec)_/, ""); keys.push(unb64u(k.replace(/\+/g, "-").replace(/\//g, "_"))); } catch (e) {}   // Standard Webhooks keys may be base64
  for (const kb of keys) {
    const k = await crypto.subtle.importKey("raw", kb, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", k, msg))));
    if (sigs.some(x => same(x.split(",")[1] || "", mac))) return true;
  }
  return false;
}
async function payWebhook(req, env) {
  const raw = await req.text();
  if (!(await whopVerify(req, env, raw))) return json({ message: "bad signature" }, 401);
  let ev; try { ev = JSON.parse(raw); } catch (e) { return json({ message: "bad" }, 400); }
  const d = ev.data || {}, type = String(ev.type || ev.action || "");
  const meta = d.metadata || (d.membership && d.membership.metadata) || (d.checkout_configuration && d.checkout_configuration.metadata) || {};
  const memId = d.membership_id || (d.membership && (d.membership.id || d.membership)) || (/^mem_/.test(d.id || "") ? d.id : null);
  const planId = (d.plan && d.plan.id) || d.plan_id || (d.membership && d.membership.plan && d.membership.plan.id) || null;
  let name = meta.pickhit_user || (memId ? await env.KV.get("mem/" + memId) : null);
  if (!name) return json({ ok: true, note: "no PickHit user on this event" }, 200);
  const u = await getUser(env, name); if (!u) return json({ ok: true, note: "unknown user" }, 200);
  const plan = planId === env.WHOP_PLAN_PRO ? "pro" : planId === env.WHOP_PLAN_BASIC ? "basic" : (meta.pickhit_plan === "pro" || meta.pickhit_plan === "basic" ? meta.pickhit_plan : null);
  const status = String(d.status || "");
  const on = /went_valid|activated|payment\.succeeded|renewed/.test(type) || (/membership\.updated/.test(type) && /^(active|trialing|completed)$/.test(status));
  const off = /went_invalid|deactivated|refund\.created|dispute\.created/.test(type) || (/membership\.updated/.test(type) && /^(canceled|cancelled|expired|past_due|unresolved)$/.test(status));
  if (on && plan) { u.plan = plan; if (memId) { u.mem = memId; await env.KV.put("mem/" + memId, u.u.toLowerCase()); } await putUser(env, u); }
  else if (off && (!memId || !u.mem || u.mem === memId)) { if (u.role !== "dev") u.plan = "free"; await putUser(env, u); }
  return json({ ok: true }, 200);
}
// ---------- PICK OF THE DAY (shown to everyone on the homepage, signed in or not)
async function potd(req, env) {
  const day = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);   // US Eastern-ish day
  const cur = env.KV ? JSON.parse((await env.KV.get("potd/cur")) || "null") : null;
  if (req.method === "GET") return new Response(JSON.stringify(cur && cur.day === day ? cur : { day, picks: {} }), { headers: { "content-type": "application/json", "cache-control": "public, max-age=120" } });
  if (req.method !== "POST" || !env.KV) return json({ message: "method" }, 405);
  if (PLAN_RANK[await access(req, env)] < 2) return json({ message: "members only" }, 403);
  let b; try { b = await readJSON(req, 4000); } catch (e) { return json({ message: "bad" }, 400); }
  const sp = String(b.sport || ""), p = b.pick || {};
  if (!/^[a-z0-9]{2,8}$/.test(sp) || typeof p.player !== "string" || p.player.length > 60 || typeof p.stat !== "string" || p.stat.length > 40 || !(p.prob > 0 && p.prob < 1)) return json({ message: "bad" }, 400);
  const o = cur && cur.day === day ? cur : { day, picks: {} }, old = o.picks[sp];
  if (old && Date.now() - old.t < 2 * 3600e3) return json({ ok: true, skipped: true }, 200);
  const clean = { player: p.player, stat: p.stat, line: +p.line, side: p.side === "Less" ? "Less" : "More", type: ["goblin", "standard", "demon"].includes(p.type) ? p.type : "standard",
    prob: Math.round(p.prob * 1000) / 1000, grade: String(p.grade || "").slice(0, 3), call: String(p.call || "").slice(0, 12), opp: String(p.opp || "").slice(0, 40), team: String(p.team || "").slice(0, 40),
    start: String(p.start || "").slice(0, 40), why: Array.isArray(p.why) ? p.why.slice(0, 3).map(x => String(x).slice(0, 160)) : [], t: Date.now() };
  o.picks[sp] = clean;
  await env.KV.put("potd/cur", JSON.stringify(o), { expirationTtl: 3 * DAY });
  return json({ ok: true }, 200);
}

const json = (o, status) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

const MANIFEST = JSON.stringify({
  name: "PickHit", short_name: "PickHit", start_url: "/", display: "standalone",
  background_color: "#040823", theme_color: "#040823",
  icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" }],
});

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/auth/")) return auth(req, env, url.pathname);
    if (url.pathname === "/pay/checkout") return payCheckout(req, env);
    if (url.pathname === "/pay/whop") return payWebhook(req, env);
    if (url.pathname === "/potd") return potd(req, env);
    // the rating engine's data routes are for paying members (guests and free accounts see the homepage + pick of the day)
    if (url.pathname === "/p" || url.pathname.startsWith("/rated/") || url.pathname.startsWith("/snap/")) {
      const a = await access(req, env);
      if (a === "stale") return json({ message: "refresh", refresh: true }, 401);
      if (PLAN_RANK[a] < 2) return json({ message: "members only", plan: a }, 403);
    }
    if (url.pathname === "/p") return proxy(req, ctx);
    const bm = url.pathname.match(/^\/board(?:\/(\d{1,4}))?\/?$/);
    if (bm) return board(req, env, ctx, bm[1]);
    if (url.pathname === "/sc") return scList(env);
    if (url.pathname === "/leagues") { const o = await kvGet(env, "leagues"); return o ? stored(o) : json({ message: "no league list yet" }, 404); }
    if (url.pathname === "/track") return track(req, env, ctx);
    const sm = url.pathname.match(/^\/snap\/([a-z0-9]{2,8})(?:\/(\d{4}-\d\d-\d\d))?$/);
    if (sm) return snap(req, env, sm[1], sm[2]);
    const rm = url.pathname.match(/^\/rated\/([a-z0-9]{2,8}(?:-nov21)?)$/);
    if (rm) return rated(req, env, ctx, rm[1]);
    if (url.pathname === "/manifest.json") return new Response(MANIFEST, { headers: { "content-type": "application/manifest+json" } });
    if (url.pathname === "/icon.png" || url.pathname === "/apple-touch-icon.png" || url.pathname === "/favicon.ico")
      return new Response(b64(ICON), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    return new Response(HTML, { headers: { "content-type": "text/html;charset=utf-8", "cache-control": "no-cache" } });
  },
};

const ICON = "__ICON__";
const HTML = __HTML__;

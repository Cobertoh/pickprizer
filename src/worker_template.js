// PickPrizer website (Cloudflare Worker). Serves the app and fetches sports data for it.
// Setup: dash.cloudflare.com -> Workers & Pages -> Create -> Worker -> Deploy -> Edit code ->
// replace everything with this file -> Deploy. Your site is the *.workers.dev link it gives you.

const ALLOW = new Set(["api.prizepicks.com", "partner-api.prizepicks.com", "site.api.espn.com", "site.web.api.espn.com", "stats.nba.com",
  "www.sofascore.com", "api.sofascore.com", "www.reddit.com"]);
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
  if (h.includes("espn.com")) return 10 * MIN;
  if (h === "stats.nba.com") return 3 * HOUR;
  if (h.endsWith("sofascore.com")) return p.endsWith("/statistics") ? 30 * DAY : p.includes("/search/") ? 7 * DAY : HOUR;
  if (h === "www.reddit.com") return 15 * MIN;
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
  if (t.protocol !== "https:" || !ALLOW.has(t.hostname)) return json({ message: "host not allowed" }, 403);
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
// A board someone pasted in, shared with every visitor for 20 minutes (PrizePicks blocks this server from fetching it).
const MEM = new Map();   // backup for hosts where the Cache API is a no-op (*.workers.dev)
async function board(req, ctx, league) {
  const key = new Request("https://cache.pickprizer/board/" + league);
  if (req.method === "GET") {
    const hit = await caches.default.match(key); if (hit) return hit;
    const m = MEM.get(league);
    return m && Date.now() - m.t < 1200e3 ? new Response(m.text, { headers: { "content-type": "application/json" } }) : json({ message: "no shared board" }, 404);
  }
  if (req.method !== "POST") return json({ message: "method" }, 405);
  const text = await req.text();
  if (text.length > 8e6) return json({ message: "too big" }, 413);
  let js; try { js = JSON.parse(text); } catch { return json({ message: "not JSON" }, 400); }
  if (!Array.isArray(js.data) || !js.data.length || !js.data.every(d => d && typeof d === "object" && d.attributes)) return json({ message: "not a PrizePicks board" }, 400);
  MEM.set(league, { t: Date.now(), text });
  ctx.waitUntil(caches.default.put(key, new Response(text, { headers: { "content-type": "application/json", "cache-control": "public, max-age=1200" } })));
  return json({ ok: true }, 200);
}
const json = (o, status) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

const MANIFEST = JSON.stringify({
  name: "PickPrizer", short_name: "PickPrizer", start_url: "/", display: "standalone",
  background_color: "#040823", theme_color: "#040823",
  icons: [{ src: "/icon.png", sizes: "192x192", type: "image/png", purpose: "any" }],
});

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === "/p") return proxy(req, ctx);
    const bm = url.pathname.match(/^\/board\/(\d{1,3})$/);
    if (bm) return board(req, ctx, bm[1]);
    if (url.pathname === "/manifest.json") return new Response(MANIFEST, { headers: { "content-type": "application/manifest+json" } });
    if (url.pathname === "/icon.png" || url.pathname === "/apple-touch-icon.png" || url.pathname === "/favicon.ico")
      return new Response(b64(ICON), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    return new Response(HTML, { headers: { "content-type": "text/html;charset=utf-8", "cache-control": "no-cache" } });
  },
};

const ICON = "__ICON__";
const HTML = __HTML__;

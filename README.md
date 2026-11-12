# PickPrizer

Website that rates PrizePicks picks and builds lineups (Pick4Me).

- `src/app.html` – the app page
- `src/worker_template.js` – the Cloudflare server code (fetches sports data, shares pasted boards)
- `public/_worker.js` – the built file Cloudflare Pages runs (`python3 build.py` regenerates it)

Cloudflare Pages settings: no build command, build output directory `public`.

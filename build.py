# Rebuilds public/_worker.js from src/ (the app page + the server template). Run: python3 build.py
import json, base64, pathlib
root = pathlib.Path(__file__).parent
html = (root / "src/app.html").read_text()
tpl = (root / "src/worker_template.js").read_text()
icon = base64.b64encode((root / "src/icon192.png").read_bytes()).decode()
(root / "public/_worker.js").write_text(tpl.replace("__ICON__", icon).replace("__HTML__", json.dumps(html)))
print("built public/_worker.js")

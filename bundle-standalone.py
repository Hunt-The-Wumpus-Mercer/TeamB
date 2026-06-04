#!/usr/bin/env python3
"""
Bundles the Vite dist output into a single standalone HTML file that can be
opened directly from the filesystem (no dev server needed). Run after `npm run build`.

Usage: python3 bundle-standalone.py
Output: dist/standalone.html
"""
import base64, re, mimetypes
from pathlib import Path
from urllib.parse import unquote

dist = Path(__file__).parent / "dist"

js_file = next(dist.glob("assets/index-*.js"))
js = js_file.read_text()

def to_data_uri(match):
    path_str = match.group(1)
    filename = unquote(path_str.lstrip("/"))  # decode %20 etc. to real filename
    asset_path = dist / filename
    ext = asset_path.suffix
    mime_map = {".webp": "image/webp", ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".png": "image/png"}
    mime = mime_map.get(ext, mimetypes.guess_type(str(asset_path))[0] or "application/octet-stream")
    data = base64.b64encode(asset_path.read_bytes()).decode()
    return f'"data:{mime};base64,{data}"'

js_inlined = re.sub(r'"(/assets/[^"]+)"', to_data_uri, js)

html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hunt the Wumpus</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module">
{js_inlined}
    </script>
  </body>
</html>"""

out = dist / "standalone.html"
out.write_text(html)
print(f"Written: {out} ({out.stat().st_size // 1024} KB)")

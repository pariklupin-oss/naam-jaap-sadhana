import base64
import hashlib
import re
from pathlib import Path

page = Path("index.html").read_text(encoding="utf-8")
old_policy = "script-src 'unsafe-inline'; connect-src 'none'"
new_policy = "script-src 'self' 'unsafe-inline'; worker-src 'self'; connect-src 'self'"
if page.count(old_policy) != 1 or page.count("</html>") != 1:
    raise SystemExit("Unexpected HTML layout or policy")
client = Path("dist/speech-browser.js")
client.write_text(client.read_text(encoding="utf-8").replace("./speech/vosk.js?v=2", "./speech/vosk.js?v=3"), encoding="utf-8")
revision = hashlib.sha256(client.read_bytes()).hexdigest()[:12]
page = page.replace(old_policy, new_policy).replace(
    "</html>", f'<script src="./speech-browser.js?v={revision}"></script>\n</html>')
Path("dist/index.html").write_text(page, encoding="utf-8")

# Give the pinned WASM worker its own same-origin URL so its generated bindings
# can initialize without allowing dynamic code evaluation in the app page.
library = Path("dist/speech/vosk.js")
wrapper = library.read_text(encoding="utf-8")
worker_match = re.search(r"var WorkerFactory = createBase64WorkerFactory\('([A-Za-z0-9+/=]+)', null, false\);", wrapper)
if not worker_match:
    raise SystemExit("Missing embedded speech worker")
worker = base64.b64decode(worker_match[1])
Path("dist/speech/vosk-worker.js").write_bytes(worker)
worker_factory = 'var WorkerFactory = function () { return new Worker(new URL("./speech/vosk-worker.js", document.baseURI)); };'
library.write_text(wrapper[:worker_match.start()] + worker_factory + wrapper[worker_match.end():], encoding="utf-8")

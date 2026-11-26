import base64
import hashlib
import re
from pathlib import Path

page = Path("index.html").read_text(encoding="utf-8")
old_policy = "script-src 'unsafe-inline'; connect-src 'none'"
new_policy = "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src blob:; connect-src 'self' blob:"
if page.count(old_policy) != 1 or page.count("</html>") != 1:
    raise SystemExit("Unexpected HTML layout or policy")
revision = hashlib.sha256(Path("speech-browser.js").read_bytes()).hexdigest()[:12]
page = page.replace(old_policy, new_policy).replace(
    "</html>", f'<script src="./speech-browser.js?v={revision}"></script>\n</html>')
Path("dist/index.html").write_text(page, encoding="utf-8")

# The pinned WASM package's worker uses dynamic code generation only to name
# a function wrapper. Keep the wrapper and its name without requiring unsafe-eval.
library = Path("dist/speech/vosk.js")
wrapper = library.read_text(encoding="utf-8")
worker_match = re.search(r"createBase64WorkerFactory\('([A-Za-z0-9+/=]+)'", wrapper)
if not worker_match:
    raise SystemExit("Missing embedded speech worker")
worker = base64.b64decode(worker_match[1]).decode("utf-8")
start = worker.index("function createNamedFunction(name,body){")
end = worker.index("var emval_free_list", start)
if worker[start:end].count("new Function") != 1:
    raise SystemExit("Unexpected speech worker wrapper")
worker = (worker[:start] + 'function createNamedFunction(name,body){const fn=function(){return body.apply(this,arguments)};'
          'Object.defineProperty(fn,"name",{value:makeLegalFunctionName(name),configurable:true});return fn}'
          + worker[end:])
encoded = base64.b64encode(worker.encode("utf-8")).decode("ascii")
library.write_text(wrapper[:worker_match.start(1)] + encoded + wrapper[worker_match.end(1):], encoding="utf-8")

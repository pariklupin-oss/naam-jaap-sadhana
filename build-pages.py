from pathlib import Path

page = Path("index.html").read_text(encoding="utf-8")
old_policy = "script-src 'unsafe-inline'; connect-src 'none'"
new_policy = "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src blob:; connect-src 'self' blob:"
if page.count(old_policy) != 1 or page.count("</html>") != 1:
    raise SystemExit("Unexpected HTML layout or policy")
page = page.replace(old_policy, new_policy).replace("</html>", '<script src="./speech-browser.js"></script>\n</html>')
Path("dist/index.html").write_text(page, encoding="utf-8")
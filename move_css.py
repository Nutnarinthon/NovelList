from pathlib import Path
import re

html_path = Path(r"d:\MyProjects\NovelList\index.html")
css_path = Path(r"d:\MyProjects\NovelList\style.css")

text = html_path.read_text(encoding="utf-8")
match = re.search(r"<style.*?</style>", text, re.S)
if not match:
    raise SystemExit("No style block found in index.html")

css = match.group(0)[match.group(0).index(">") + 1 : -len("</style>")]
css_path.write_text(css, encoding="utf-8")
html_path.write_text(text[:match.start()] + '<link rel="stylesheet" href="style.css">\n' + text[match.end():], encoding="utf-8")
print("CSS moved to style.css")

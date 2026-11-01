"""Собирает статические и реально звучащие в уроках фразы в mockups/voice/parts.json.
Запуск: C:\TST\python.exe -u tools\voice_collect.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent / "chess-leon" / "promo"))
from cdp import start_edge  # noqa: E402

OUT = ROOT / "mockups" / "voice"
OUT.mkdir(parents=True, exist_ok=True)
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def literals(js):
    out, i, n = [], 0, len(js)
    while i < n:
        c = js[i]
        if c == "/" and js[i + 1:i + 2] == "/":
            i = js.find("\n", i)
            i = n if i < 0 else i
            continue
        if c == "/" and js[i + 1:i + 2] == "*":
            i = js.find("*/", i + 2)
            i = n if i < 0 else i + 2
            continue
        if c in "'\"`":
            j, buf = i + 1, []
            while j < n and js[j] != c:
                if js[j] == "\\":
                    buf.append(js[j + 1:j + 2])
                    j += 2
                    continue
                if js[j] == "\n" and c != "`":
                    break
                buf.append(js[j])
                j += 1
            out.append("".join(buf))
            i = j + 1
            continue
        i += 1
    return out


src = (ROOT / "index.html").read_text(encoding="utf-8")
js = src[src.index("<script"):]
ui = set(re.findall(r"name:'([^']+)'", src)) | set(re.findall(r"name: '([^']+)'", src))
static = []
for s in literals(js):
    s = s.strip()
    if not re.search("[А-Яа-яЁё]", s) or "${" in s or re.search("<[a-z/]", s) or s in ui:
        continue
    if re.search(r"[.!?…:]$", s) or len(s.split()) >= 2:
        static.append(s)
static = sorted(set(static))
print(f"Фразы в коде: {len(static)}", flush=True)

HOOK = r"""
(() => {
  window.__said = {};
  const rec = t => {
    if (t === undefined || t === null) return;
    t = String(t).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (t) __said[t] = (__said[t] || 0) + 1;
  };
  window.__rec = rec;
  window.speak = async t => rec(t);
  const result = x => { if (x) { rec(x.text); rec(x.voice); } };
  window.tell = async (text, o = {}) => { rec(text); rec(o.voice); };
  window.askChoice = async a => {
    rec(a.text); rec(a.voice); rec(a.hint); rec(a.hintVoice); result(a.success);
    a.options.forEach(o => { rec(o.speech); rec(o.label); rec(o.say); result(o.success); });
    return a.options.find(o => o.ok);
  };
  window.askMany = async a => { rec(a.text); rec(a.voice); result(a.success); };
  window.askSequence = async a => {
    rec(a.text); rec(a.voice); result(a.success);
    [...new Set(a.answer.split(''))].forEach(c => rec(soundToken(c)));
  };
  LETTERS.forEach(d => { rec(nameToken(d.ch)); rec(soundToken(d.ch)); rec(d.word); });
  for (let n = 1; n <= 90; n++) rec(`Нужно ещё ${n} кристаллов. Пройди ещё один урок!`);
})();
0
"""

proc, page = start_edge()
try:
    page.call("Page.enable")
    page.call("Runtime.enable")
    page.call("Page.navigate", url="http://127.0.0.1:8768/index.html")
    page.wait_event("Page.loadEventFired")
    page.js((ROOT / "tools" / "autorun.js").read_text(encoding="utf-8") + ";0")
    page.js(HOOK)
    result = page.js("BOT.run().then(() => ({ audit: BOT.audit(), said: __said }))")
    if result["audit"]["errors"]:
        sys.exit("Ошибки уроков: " + str(result["audit"]["errors"][:5]))
    phrases = sorted(set(static) | set(result["said"]))
    parts = page.js("(l => { const c={}; l.forEach(t => voiceParts(t).forEach(p => { c[p]=(c[p]||0)+1; })); return c; })(%s)" % json.dumps(phrases, ensure_ascii=False))
    (OUT / "parts.json").write_text(json.dumps(parts, ensure_ascii=False, indent=0), encoding="utf-8")
    (OUT / "phrases.json").write_text(json.dumps(phrases, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"Готово: фраз {len(phrases)}, фрагментов для записи {len(parts)}", flush=True)
finally:
    proc.kill()

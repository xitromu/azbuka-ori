"""Проверка записанного голоса по сети, скачивания и офлайн-режима.
Запуск при работающем сервере на порту 8768: C:\TST\python.exe -u tools\voice_test.py
"""
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent / "chess-leon" / "promo"))
from cdp import start_edge  # noqa: E402

URL = "http://127.0.0.1:8768/index.html"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
INFO = "JSON.stringify({row:document.querySelector('.vrow').textContent,how:vHow,dl:!!S.voiceDL,keys:VOICE_KEYS.size,sw:!!navigator.serviceWorker.controller})"

proc, page = start_edge()
try:
    page.call("Page.enable"); page.call("Runtime.enable"); page.call("Network.enable")
    page.call("Emulation.setDeviceMetricsOverride", width=412, height=780, deviceScaleFactor=1, mobile=False)
    page.call("Network.setCacheDisabled", cacheDisabled=False)
    def load():
        page.call("Page.navigate", url=URL); page.wait_event("Page.loadEventFired", timeout=40); time.sleep(.8)

    print("--- запись из сети")
    load(); print(page.js(INFO))
    print(page.js("""(async()=>{const t='Это буква #а. Послушай её звук: #з_а.';const parts=voiceParts(t);await speak(t);return JSON.stringify({parts,ok:parts.every(p=>VOICE_KEYS.has(vkey(p))),how:vHow});})()"""))
    print("--- покрытие всех собранных фраз")
    phrases = (ROOT / "mockups" / "voice" / "phrases.json").read_text(encoding="utf-8")
    print(page.js("(l=>{const miss=l.filter(t=>!voiceParts(t).every(p=>VOICE_KEYS.has(vkey(p))));return JSON.stringify({checked:l.length,missing:miss.slice(0,10),count:miss.length});})("+phrases+")"))

    print("--- скачивание")
    page.js("voiceDownload();0")
    for _ in range(600):
        time.sleep(.5)
        if page.js("vLoad===0"): break
    print(page.js(INFO))
    print(page.js("caches.open(VOICE_CACHE).then(c=>c.keys()).then(k=>k.length)"))
    if not page.js("S.voiceDL"): raise RuntimeError("Скачан неполный набор голоса")

    print("--- без интернета, запись скачана")
    load(); page.call("Network.emulateNetworkConditions",offline=True,latency=0,downloadThroughput=0,uploadThroughput=0); load()
    print(page.js("(async()=>{await speak('Получился слог #с_ма!');return JSON.stringify({how:vHow,dl:S.voiceDL});})()"))
    print(page.js(INFO))

    print("--- запасной синтез")
    page.js("caches.delete(VOICE_CACHE).then(()=>{vBufs.clear();S.voiceDL=false;save();});0");time.sleep(.4)
    page.js("speak('Выбирай урок!');0");time.sleep(1);print(page.js(INFO))
    page.call("Network.emulateNetworkConditions",offline=False,latency=0,downloadThroughput=-1,uploadThroughput=-1)
    errs=[e["params"]["exceptionDetails"].get("text","") for e in page.events if e.get("method")=="Runtime.exceptionThrown"]
    print("Ошибки страницы:",errs[:5])
finally:
    proc.kill()
print("done")

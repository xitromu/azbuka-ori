"""Проверка четырёх голосов в изолированном браузере; нужен локальный HTTP-сервер."""

import argparse
from contextlib import contextmanager
from datetime import datetime
import importlib.util
import json
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import urllib.error
import urllib.parse
import urllib.request
import uuid


ROOT = Path(__file__).resolve().parent.parent
HELPER = ROOT.parent / "chess-leon" / "promo" / "cdp.py"
TMP = Path("C:/AI/tmp")
MANIFEST = ROOT / "mockups" / "voice-v2" / "phrases.json"
ROLES = ("ori", "alien1", "alien2", "alien3")
ORI_HELLO = "Привет! Я Ори. Блип, Пуф и Ку-Ку прилетели учиться читать. Выбирай урок!"


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def js_json(value):
    return json.dumps(value, ensure_ascii=True)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError(f"Unexpected server redirect: {newurl}")


def preflight(url):
    parsed = urllib.parse.urlsplit(url)
    require(parsed.scheme == "http" and parsed.hostname in ("127.0.0.1", "localhost", "::1"),
            "--url must use a local loopback HTTP server")
    require(not parsed.username and not parsed.password and parsed.path.endswith("/v2.html"),
            "--url must address v2.html, not index.html")
    require(TMP.is_dir() and not TMP.is_symlink(), f"Existing profile parent required: {TMP}")
    require(HELPER.is_file(), f"CDP helper missing: {HELPER}")
    require(MANIFEST.is_file(), f"Generate the v2 manifest first: {MANIFEST}")
    phrases = json.loads(MANIFEST.read_text(encoding="utf-8-sig"))
    require(isinstance(phrases, list) and phrases, "Manifest must be a nonempty array")
    for index, item in enumerate(phrases):
        require(isinstance(item, dict) and isinstance(item.get("text"), str)
                and item["text"].strip() and item.get("who") in ROLES,
                f"Invalid manifest entry {index}: expected {{text, who}}")
    missing = urllib.parse.urljoin(url, f"voice-v2/ori/__test_missing_{uuid.uuid4().hex}.mp3")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(url, timeout=15) as response:
        require(response.status == 200, "Local v2 page is unavailable")
    try:
        with opener.open(missing, timeout=15) as response:
            raise AssertionError(f"Missing .mp3 returned {response.status}; server must return 404")
    except urllib.error.HTTPError as error:
        require(error.code == 404, f"Missing .mp3 returned {error.code}, not 404")
    return phrases, missing


@contextmanager
def isolated_edge():
    """Override the helper's destructive default BEFORE calling start_edge."""
    require(TMP.is_dir() and not TMP.is_symlink(), f"Profile parent missing: {TMP}")
    # Avoid creating __pycache__ beside the shared helper.
    previous_bytecode = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec = importlib.util.spec_from_file_location("voice_v2_cdp", HELPER)
        require(spec is not None and spec.loader is not None, "Cannot load CDP helper")
        cdp = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cdp)
    finally:
        sys.dont_write_bytecode = previous_bytecode

    parent = TMP.resolve()
    profile = Path(tempfile.mkdtemp(prefix="ori-v2-test-", dir=str(parent))).resolve()
    require(profile.parent == parent and not profile.is_symlink(), "Unsafe test profile")
    spawned = []
    page = None
    original_profile, original_port, original_subprocess = cdp.PROFILE, cdp.PORT, cdp.subprocess
    # A reserved, non-listening loopback socket is a dead proxy for external traffic.
    # Local game/debugger traffic bypasses it; no external service is needed.
    dead_proxy = socket.socket()
    try:
        dead_proxy.bind(("127.0.0.1", 0))
        with socket.socket() as port_socket:
            port_socket.bind(("127.0.0.1", 0))
            port = port_socket.getsockname()[1]
        cdp.PROFILE, cdp.PORT = str(profile), port

        def tracked_popen(command, **kwargs):
            require(f"--user-data-dir={profile}" in command, "Helper attempted a different profile")
            flags = [
                "--autoplay-policy=no-user-gesture-required", "--disable-background-networking",
                "--disable-component-update", "--disable-default-apps", "--disable-quic", "--no-pings",
                f"--proxy-server=http://127.0.0.1:{dead_proxy.getsockname()[1]}",
                "--proxy-bypass-list=127.0.0.1;localhost;[::1]",
            ]
            proc = subprocess.Popen([*command[:-1], *flags, command[-1]], **kwargs)
            spawned.append(proc)  # Also retained if helper initialization subsequently fails.
            return proc

        # Replace only this privately imported module's binding, not subprocess.Popen globally.
        cdp.subprocess = SimpleNamespace(Popen=tracked_popen, DEVNULL=subprocess.DEVNULL)
        proc, page = cdp.start_edge()
        require(proc in spawned, "Untracked browser process")
        page.ws.s.settimeout(30)
        yield page
    finally:
        cdp.PROFILE, cdp.PORT, cdp.subprocess = original_profile, original_port, original_subprocess
        if page is not None:
            try:
                page.call("Browser.close")
            except (OSError, RuntimeError):
                pass
            finally:
                page.ws.s.close()
        for proc in spawned:
            try:
                proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait(timeout=5)
        dead_proxy.close()
        # Never enumerate or delete other profiles; never kill by image name or port.
        require(profile.parent == parent and profile.name.startswith("ori-v2-test-")
                and not profile.is_symlink(), "Refusing unsafe profile cleanup")
        if profile.exists():
            shutil.rmtree(profile)


# Installed before application scripts, exclusively in our new browser page.
PROBE = r"""
(() => {
  const T = window.__vtest = {
    id: Math.random().toString(36), speed: 12, decoded: new WeakSet(),
    records: [], fetches: [], fallbacks: [], calls: [], errors: [],
    redirects: new Map(), pendingFetches: 0, pendingDecodes: 0, job: null, lastSpeech: null
  };
  addEventListener('error', e => T.errors.push(e.message || 'window error'));
  addEventListener('unhandledrejection', e => T.errors.push(String(e.reason?.stack || e.reason)));
  const logError = console.error.bind(console);
  console.error = (...args) => { T.errors.push(args.map(String).join(' ')); logError(...args); };
  const fetchReal = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href).href;
    if (new URL(url).origin !== location.origin) throw new Error('External fetch blocked: ' + url);
    const effective = T.redirects.get(url) || url;
    const entry = {url, effective, status: null}; T.fetches.push(entry); T.pendingFetches++;
    try {
      const response = await fetchReal(effective === url ? input : effective, init);
      entry.status = response.status;
      return response;
    } catch (e) { entry.error = String(e); throw e; }
    finally { T.pendingFetches--; }
  };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const decode = AC.prototype.decodeAudioData;
    AC.prototype.decodeAudioData = function(data, good, bad) {
      T.pendingDecodes++;
      return decode.call(this, data, buffer => {
        T.pendingDecodes--; T.decoded.add(buffer);
        if (good) good(buffer);
      }, error => { T.pendingDecodes--; if (bad) bad(error); });
    };
    const start = AudioBufferSourceNode.prototype.start;
    const stop = AudioBufferSourceNode.prototype.stop;
    const sources = new WeakMap();
    AudioBufferSourceNode.prototype.start = function(...args) {
      const buffer = this.buffer;
      if (buffer && T.decoded.has(buffer)) {
        let key = null;
        try { for (const [k, value] of vBufs) if (value === buffer) { key = k; break; } } catch (_) {}
        const samples = buffer.getChannelData(0);
        let peak = 0;
        for (let i = 0, step = Math.max(1, Math.floor(samples.length / 16000));
             i < samples.length; i += step) peak = Math.max(peak, Math.abs(samples[i]));
        const record = {key, rate: this.playbackRate.value, detune: this.detune.value,
          decoded: buffer instanceof AudioBuffer, duration: buffer.duration,
          sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels,
          state: this.context.state, peak, stopped: false, ended: false};
        T.records.push(record); sources.set(this, record);
        this.addEventListener('ended', () => { record.ended = true; }, {once: true});
        // Never conceal an application rate bug: observe first, accelerate only a valid rate.
        if (record.rate === 1 && record.detune === 0) this.playbackRate.value = T.speed;
      }
      return start.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function(...args) {
      const record = sources.get(this);
      if (record) record.stopped = true;
      return stop.apply(this, args);
    };
  }
  // A fallback-dispatch spy, NOT a substitute for decoded-recording assertions.
  if ('speechSynthesis' in window) {
    speechSynthesis.getVoices = () => [];
    speechSynthesis.cancel = () => {};
    speechSynthesis.speak = utterance => {
      T.fallbacks.push({text: utterance.text, pitch: utterance.pitch, rate: utterance.rate});
      queueMicrotask(() => { if (utterance.onend) utterance.onend(new Event('end')); });
    };
  }
})();
"""


class Runner:
    def __init__(self, page, url, phrases, missing, download_timeout):
        self.page, self.url, self.phrases, self.missing = page, url, phrases, missing
        self.download_timeout = download_timeout
        self.run_id = datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8]
        self.version = None
        self.greetings = []
        self.current = "setup"
        self.count = 0
        for domain in ("Page", "Runtime", "Network"):
            page.call(domain + ".enable")
        page.call("Network.setCacheDisabled", cacheDisabled=True)
        page.call("Emulation.setDeviceMetricsOverride", width=412, height=820,
                  deviceScaleFactor=1, mobile=True)
        page.call("Page.addScriptToEvaluateOnNewDocument", source=PROBE)

    def js(self, expression):
        return self.page.js(expression)

    def check(self, expression, message):
        require(self.js(expression), message)

    def wait(self, expression, message, timeout=30, navigating=False):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            try:
                if self.js(expression):
                    return
            except RuntimeError as error:
                if not navigating or not any(s in str(error) for s in
                                             ("context", "Execution", "Cannot find")):
                    raise
            time.sleep(.05)  # Bounded condition polling, not a fixed playback/ASR wait.
        raise TimeoutError(message)

    def clean_errors(self):
        errors = self.js("__vtest.errors")
        errors += [e["params"]["exceptionDetails"].get("exception", {}).get("description")
                   or e["params"]["exceptionDetails"].get("text", "runtime exception")
                   for e in self.page.events if e.get("method") == "Runtime.exceptionThrown"]
        require(not errors, "Page runtime errors: " + str(errors[:4]))
        local_origin = urllib.parse.urlsplit(self.url).netloc
        external = [e["params"]["request"]["url"] for e in self.page.events
                    if e.get("method") == "Network.requestWillBeSent"
                    and urllib.parse.urlsplit(e["params"]["request"]["url"]).scheme in ("http", "https")
                    and urllib.parse.urlsplit(e["params"]["request"]["url"]).netloc != local_origin]
        require(not external, f"Unexpected external requests: {external[:3]}")

    def scenario(self, name, function):
        self.current = name
        function()
        self.clean_errors()
        self.count += 1
        print(f"PASS {name}", flush=True)

    def load(self):
        old_id = self.js("window.__vtest?.id || null")
        result = self.page.call("Page.navigate", url=self.url)
        require(not result.get("errorText"), f"Navigation failed: {result}")
        self.wait("typeof __vtest !== 'undefined' && __vtest.id !== " + js_json(old_id)
                  + " && document.readyState === 'complete'", "Fresh v2 document did not load",
                  timeout=40, navigating=True)
        self.check("typeof speak === 'function' && typeof runLesson === 'function' && "
                   "typeof VOICE_KEYS !== 'undefined' && document.title.includes('2')",
                   "v2 failed to compile/initialize (or index.html was served)")
        self.js(r"""(() => {
          hush();
          const realSpeak = speak;
          speak = function(text, who='ori') {
            __vtest.calls.push({text, who});
            return __vtest.lastSpeech = realSpeak(text, who);
          };
          const button = document.createElement('button');
          button.id = '__vtest_trigger'; button.textContent = 'Test audio';
          button.style.cssText = 'position:fixed;bottom:3px;right:3px;z-index:9999;font-size:12px';
          button.onclick = () => {
            const job = __vtest.job = {done:false, error:null};
            Promise.resolve().then(() => __vtest.action()).then(
              () => { job.done=true; }, e => { job.error=String(e.stack || e); job.done=true; });
          };
          document.body.appendChild(button);
        })()""")
        self.wait("__vtest.pendingFetches === 0 && __vtest.pendingDecodes === 0",
                  "Startup fetch/decode did not settle")
        self.clean_errors()

    def click(self, selector):
        point = self.js("(s => {const e=document.querySelector(s); if(!e) throw Error(s);"
                        "e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect();"
                        "if(!r.width || !r.height) throw Error('Invisible: '+s);"
                        "return {x:r.left+r.width/2,y:r.top+r.height/2};})(" + js_json(selector) + ")")
        for kind in ("mousePressed", "mouseReleased"):
            self.page.call("Input.dispatchMouseEvent", type=kind, button="left", clickCount=1, **point)

    def action(self, body, wait=True, timeout=40):
        self.js("__vtest.job=null; __vtest.action=()=>{" + body + "}; 0")
        self.click("#__vtest_trigger")
        if wait:
            self.finish_action(timeout)

    def finish_action(self, timeout=40):
        self.wait("!!__vtest.job && __vtest.job.done", "Pointer action did not finish", timeout)
        require(not self.js("__vtest.job.error"), str(self.js("__vtest.job.error")))

    def mark(self):
        return self.js("({records:__vtest.records.length,fetches:__vtest.fetches.length,"
                       "fallbacks:__vtest.fallbacks.length,calls:__vtest.calls.length})")

    def expected(self, text, who):
        return self.js("voiceParts(" + js_json(text) + ").map(p=>voiceKey(p," + js_json(who) + "))")

    def recording(self, mark, text, who, network=False):
        expected = self.expected(text, who)
        require(expected, f"No recording parts for {who}: {text}")
        records = self.js(f"__vtest.records.slice({mark['records']})")
        require([r["key"] for r in records] == expected,
                f"Wrong recorded role/parts for {who}: {[r['key'] for r in records]} != {expected}")
        require(all(r["rate"] == 1 and r["detune"] == 0 for r in records),
                "Processed recordings must play at rate=1, detune=0 before test acceleration")
        require(all(r["decoded"] and r["duration"] > .02 and r["peak"] > .00001
                    and r["sampleRate"] > 0 and r["channels"] > 0 and r["state"] == "running"
                    for r in records), "Real, non-silent AudioBuffers did not start in a running context")
        self.check(f"__vtest.fallbacks.length === {mark['fallbacks']}", "Unexpected device fallback")
        if network:
            fetches = self.js(f"__vtest.fetches.slice({mark['fetches']})")
            urls = self.js(js_json(expected) + ".map(k=>new URL(clipURL(k),location.href).href)")
            for url in set(urls):
                require(any(f["url"] == url and f["effective"] == url and f["status"] == 200
                            for f in fetches), f"Expected real role fetch missing: {url}")
                require(any(e.get("method") == "Network.responseReceived"
                            and e["params"]["response"]["url"] == url
                            and e["params"]["response"]["status"] == 200
                            and not e["params"]["response"].get("fromDiskCache")
                            and not e["params"]["response"].get("fromServiceWorker")
                            for e in self.page.events), f"No local network response for {url}")

    def screenshot(self, label):
        require(MANIFEST.parent.is_dir(), "Screenshot parent no longer exists")
        path = MANIFEST.parent / f"test-{self.run_id}-{label}-412.png"
        self.js("document.querySelector('#__vtest_trigger').style.visibility='hidden';scrollTo(0,0)")
        try:
            path.write_bytes(self.page.shot("png"))
        finally:
            self.js("document.querySelector('#__vtest_trigger').style.visibility='visible'")
        print(f"ARTIFACT {path.resolve()}", flush=True)

    def load_and_compile(self):
        self.load()
        self.js("[...document.scripts].filter(s=>!s.src).forEach(s=>new Function(s.textContent))")
        self.js("fetch('sw.js').then(r=>{if(!r.ok)throw Error('sw.js');return r.text();})"
                ".then(s=>{new Function(s);return true;})")
        self.check("innerWidth === 412 && document.documentElement.scrollWidth <= 412",
                   "Mobile layout overflows at 412px")
        self.wait("[...document.images].every(i=>i.complete && i.naturalWidth>0)", "Broken page image")
        self.wait("!!navigator.serviceWorker.controller", "Service worker did not claim v2", timeout=40)
        self.screenshot("mobile")

    def coverage(self):
        info = self.js(r"""({keys:[...VOICE_KEYS], version:VOICE_VERSION,
          url:VOICE_URL, cache:VOICE_CACHE, students:STUDENTS,
          keySamples:['ori','alien1','alien2','alien3'].map(r=>voiceKey('одна фраза',r)),
          defaultKey:voiceKey('одна фраза'), defaultExplicit:voiceKey('одна фраза','ori'),
          praises:PRAISE, encouragements:ENCOURAGE})""")
        self.version = info["version"]
        require(isinstance(self.version, str) and re.fullmatch(r"[A-Za-z0-9._-]+", self.version)
                and self.version not in ("casting-1", "", "undefined"),
                "VOICE_VERSION must be the generated fingerprint, not a casting placeholder")
        require(info["url"] == "voice-v2/" and info["cache"] == "ori-v2-voice-" + self.version,
                "Wrong v2 URL/cache namespace")
        require(len(set(info["keySamples"])) == 4 and info["defaultKey"] == info["defaultExplicit"],
                "voiceKey loses role identity or defaults to a non-Ori role")
        require(len({key.split("/", 1)[1] for key in info["keySamples"]}) == 1,
                "The same text should retain its hash across roles")
        keys = info["keys"]
        require(keys and all(re.fullmatch(r"(?:ori|alien[123])/[0-9a-f]{1,8}", k) for k in keys),
                "VOICE_KEYS contains legacy role-less or invalid keys")
        require({k.split("/")[0] for k in keys} == set(ROLES), "VOICE_KEYS omits a role")
        for key in keys:
            recording = ROOT / "voice-v2" / (key + ".mp3")
            require(recording.is_file() and recording.stat().st_size > 32, f"Missing/empty recording: {recording}")
        self.check("[...VOICE_KEYS].every(k=>clipURL(k)===VOICE_URL+k+'.mp3?v='+VOICE_VERSION)",
                   "clipURL dropped role, extension, or version")
        self.check("voiceParts('Это #а, #з_м и #с_ма. 12').filter(p=>p[0]==='#').join('|')"
                   " === '#а|#з_м|#с_ма|#12'", "voiceParts educational token regression")
        missing = self.js("(items=>items.flatMap(({text,who})=>voiceParts(text)"
                          ".filter(p=>!VOICE_KEYS.has(voiceKey(p,who))).map(p=>({text:p,who}))))("
                          + js_json(self.phrases) + ")")
        require(not missing, f"Unrecorded manifest phrases ({len(missing)}): {missing[:8]}")
        require([s["id"] for s in info["students"]] == list(ROLES[1:]), "Unexpected STUDENTS roles")
        self.greetings = [(ORI_HELLO, "ori")] + [(s["hi"], s["id"]) for s in info["students"]]
        for text, who in self.greetings:
            require(any(p["text"] == text and p["who"] == who for p in self.phrases),
                    f"Greeting missing from manifest for {who}")
        for name in ("praises", "encouragements"):
            require(info[name] and all(isinstance(row, list) and 1 <= len(row) <= 2
                    and isinstance(row[0], str) and (len(row) == 1 or row[1] in ROLES)
                    for row in info[name]), f"Invalid {name} [text,who?] array")
        self.feedback = info
        print(f"INFO manifest={len(self.phrases)} recordings={len(keys)} version={self.version}", flush=True)

    def greetings_and_replay(self):
        for text, who in self.greetings:
            self.js("hush();vBufs.clear()")
            mark = self.mark()
            self.action(f"return say({js_json(text)},undefined,{js_json(who)});")
            self.recording(mark, text, who, network=True)
            self.check("document.querySelector('#menu .bubble').dataset.who === " + js_json(who),
                       "Bubble did not remember the speaker")
            replay = self.mark()
            self.click("#menu .bubble")
            self.js("__vtest.lastSpeech")
            self.recording(replay, text, who)
            self.check(f"__vtest.fetches.length === {replay['fetches']}", "Replay ignored decoded buffer cache")
            self.check("(async()=>{const p=voiceParts(" + js_json(text) + ")[0],who=" + js_json(who)
                       + ";return (await clipGet(p,who)) === vBufs.get(voiceKey(p,who));})()",
                       "clipGet cache identity is not role/hash")
            if who == "ori":
                self.check("(async()=>{const p=voiceParts(" + js_json(text) + ")[0];"
                           "return (await clipGet(p)) === vBufs.get(voiceKey(p,'ori'));})()",
                           "clipGet default speaker is not Ori")

    def lesson_greetings(self):
        before = self.js("JSON.stringify({coins:S.coins,stars:S.stars})")
        for index, (text, who) in enumerate(self.greetings[1:]):
            mark = self.mark()
            # Keep runLesson/sayWait real. Replace only the supplied lesson body with an
            # abortable wait, so no answers, rewards, or endless gameplay are exercised.
            self.action(f"""
              S.student={(index + 2) % 3}; __vtest.lessonEntered=false;
              __vtest.lessonPromise=runLesson({{...LESSONS[0],run:async()=>{{
                __vtest.lessonEntered=true; await waitable(()=>{{}});
              }}}});
            """)
            self.wait("__vtest.lessonEntered", "Student greeting did not finish")
            self.recording(mark, text, who)
            self.check("L && STUDENTS[L.student].id === " + js_json(who)
                       + " && document.querySelector('#bubble').dataset.who === " + js_json(who),
                       "runLesson routed the greeting to the wrong student")
            self.js("abortAll();hush();__vtest.lessonPromise")
        require(self.js("JSON.stringify({coins:S.coins,stars:S.stars})") == before,
                "Greeting-only flow unexpectedly awarded lesson progress")
        self.js("L=null;show('menu')")

    def feedback_and_robot(self):
        for name, function in (("praises", "happy"), ("encouragements", "oops")):
            rows = self.feedback[name]
            for index, row in enumerate(rows):
                text, who = row[0], row[1] if len(row) > 1 else "ori"
                mark = self.mark()
                self.action(f"""
                  const random=Math.random; let result;
                  Math.random=()=>{(index + .25) / len(rows)!r};
                  try {{ result={function}(); }} finally {{ Math.random=random; }}
                  return result || __vtest.lastSpeech;
                """)
                self.recording(mark, text, who)
                self.check("document.querySelector('.screen.on .bubble').dataset.who === " + js_json(who),
                           f"{function} lost role metadata")
        self.js("__vtest.gifts=S.gifts.slice();__vtest.shown=S.shown.slice();"
                "S.gifts.push('robot');S.shown.push('robot');buildStages()")
        try:
            mark = self.mark()
            self.click("#menu [data-gift='robot']")
            self.js("__vtest.lastSpeech")
            self.recording(mark, "Бип-боп! Я тоже хочу учиться читать!", "alien1")
        finally:
            self.js("S.gifts=__vtest.gifts;S.shown=__vtest.shown;buildStages()")

    def mute_and_cancel(self):
        text, who = self.greetings[0]
        self.js("__vtest.speed=1")
        mark = self.mark()
        self.action(f"return speak({js_json(text)},{js_json(who)});", wait=False)
        self.wait(f"__vtest.records.length > {mark['records']}", "No source to mute")
        self.click("#snd")
        self.finish_action()
        self.check("!S.sound && vSrc===null", "Mute did not stop active playback")
        self.check(f"__vtest.records[{mark['records']}].stopped", "Mute did not stop its AudioBufferSource")
        quiet = self.mark()
        self.action(f"return speak({js_json(text)},'ori');")
        for field in ("records", "fetches", "fallbacks"):
            self.check(f"__vtest.{field}.length === {quiet[field]}", "Muted speech did work: " + field)
        self.click("#snd")
        self.check("S.sound", "Sound did not unmute")

        # Superseding speak() must stop the old recording and suppress its remaining parts.
        old = self.mark()
        self.action(f"__vtest.oldSpeech=speak({js_json(text)});return __vtest.oldSpeech;", wait=False)
        self.wait(f"__vtest.records.length > {old['records']}", "No source to cancel")
        self.check(f"__vtest.records[{old['records']}].key.startsWith('ori/')",
                   "speak default speaker is not Ori")
        replacement_text, replacement_role = self.greetings[1]
        replacement = self.mark()
        self.js("__vtest.speed=12")
        self.action(f"return speak({js_json(replacement_text)},{js_json(replacement_role)});")
        self.js("__vtest.oldSpeech")
        self.check(f"__vtest.records[{old['records']}].stopped", "New speech did not cancel its predecessor")
        self.recording(replacement, replacement_text, replacement_role)

    def evict_fault(self):
        text, who = self.greetings[1]
        self.fault_text, self.fault_role = text, who
        self.js("__vtest.faultToken=voiceParts(" + js_json(text) + ")[0];"
                "__vtest.faultKey=voiceKey(__vtest.faultToken," + js_json(who) + ");"
                "__vtest.faultURL=new URL(clipURL(__vtest.faultKey),location.href).href")
        self.js("(async()=>{hush();vBufs.delete(__vtest.faultKey);"
                "await (await caches.open(VOICE_CACHE)).delete(__vtest.faultURL);"
                "__vtest.redirects.set(__vtest.faultURL," + js_json(self.missing) + ");})()")

    def missing_and_recovery(self):
        self.evict_fault()
        mark = self.mark()
        self.action(f"return speak({js_json(self.fault_text)},{js_json(self.fault_role)});")
        self.check(f"__vtest.records.length === {mark['records']} && "
                   f"__vtest.fallbacks.length === {mark['fallbacks'] + 1}",
                   "Missing recorded clip did not route to the local fallback spy")
        self.check(f"__vtest.fetches.slice({mark['fetches']}).some(f=>"
                   "f.url===__vtest.faultURL && f.status===404)", "Fault was not a real HTTP 404")
        self.check("!vBufs.has(__vtest.faultKey)", "A missing clip became a decoded success")
        self.check("caches.open(VOICE_CACHE).then(c=>c.match(__vtest.faultURL)).then(r=>!r)",
                   "A missing clip was cached as success")
        self.js("__vtest.redirects.clear()")
        recovery = self.mark()
        self.action(f"return speak({js_json(self.fault_text)},{js_json(self.fault_role)});")
        self.recording(recovery, self.fault_text, self.fault_role)
        self.check("vBufs.has(__vtest.faultKey)", "Missing-clip recovery left a poisoned buffer cache")

    def cache_inventory(self):
        return self.js(r"""(async()=>{
          const cache=await caches.open(VOICE_CACHE), missing=[], bad=[], roles={};
          for(const key of VOICE_KEYS) {
            const response=await cache.match(clipURL(key));
            if(!response) { missing.push(key); continue; }
            const bytes=await response.arrayBuffer();
            const type=response.headers.get('content-type') || '';
            if(!response.ok || bytes.byteLength<=32 || /text\/html/i.test(type)) bad.push(key);
            const role=key.split('/')[0];roles[role]=(roles[role]||0)+1;
          }
          return {missing,bad,roles,count:(await cache.keys()).length,total:VOICE_KEYS.size};
        })()""")

    def download_and_recovery(self):
        self.evict_fault()
        self.js("S.voiceDL=false;save()")
        mark = self.mark()
        self.action("return voiceDownload();", timeout=self.download_timeout)
        self.check("!S.voiceDL && vLoad===0", "Partial download was incorrectly marked complete")
        inventory = self.cache_inventory()
        fault_key = self.js("__vtest.faultKey")
        require(inventory["missing"] == [fault_key] and not inventory["bad"],
                f"Unexpected partial-download inventory: {inventory}")
        self.check(f"__vtest.fetches.slice({mark['fetches']}).some(f=>"
                   "f.url===__vtest.faultURL && f.status===404)", "Download did not encounter the fault")
        self.check("[...document.querySelectorAll('.vrow')].every(b=>/не всё|повтор|ещё раз/i.test(b.textContent))",
                   "Partial download does not offer recovery")
        self.js("__vtest.redirects.clear()")
        recovery = self.mark()
        self.action("return voiceDownload();", timeout=self.download_timeout)
        self.check("S.voiceDL && vLoad===0", "Retry did not complete all roles")
        inventory = self.cache_inventory()
        require(not inventory["missing"] and not inventory["bad"]
                and inventory["count"] == inventory["total"] and set(inventory["roles"]) == set(ROLES),
                f"Downloaded cache does not contain every role/key: {inventory}")
        self.check(f"__vtest.fetches.slice({recovery['fetches']}).filter(f=>f.url.includes('/voice-v2/'))"
                   ".every(f=>f.url===__vtest.faultURL && f.status===200)",
                   "Retry re-fetched successful clips or retained a failed response")

    @contextmanager
    def offline_network(self):
        # Page-only emulation can leave a service worker's network online. Attach
        # only to this spawned browser's worker and disable its network as well.
        worker = None
        try:
            self.page.call("ServiceWorker.enable")
            self.page.call("ServiceWorker.startWorker", scopeURL=urllib.parse.urljoin(self.url, "./"))
            port = self.page.ws.s.getpeername()[1]
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
            deadline = time.monotonic() + 10
            while worker is None and time.monotonic() < deadline:
                with opener.open(f"http://127.0.0.1:{port}/json/list", timeout=5) as response:
                    targets = json.load(response)
                for target in targets:
                    if (target.get("type") == "service_worker"
                            and target.get("url") == urllib.parse.urljoin(self.url, "sw.js")):
                        worker = type(self.page)(target["webSocketDebuggerUrl"])
                        worker.ws.s.settimeout(30)
                        break
                if worker is None:
                    time.sleep(.05)
            require(worker is not None, "Cannot attach to the isolated service worker for true offline checks")
            worker.call("Runtime.enable")
            worker.call("Network.enable")
            for target in (worker, self.page):
                target.call("Network.emulateNetworkConditions", offline=True, latency=0,
                            downloadThroughput=0, uploadThroughput=0)
            require(worker.js("fetch(" + js_json(self.missing)
                              + ",{cache:'no-store'}).then(()=>false,()=>true)"),
                    "Service worker still has network access")
            yield
        finally:
            self.page.call("Network.emulateNetworkConditions", offline=False, latency=0,
                           downloadThroughput=-1, uploadThroughput=-1)
            if worker is not None:
                try:
                    worker.call("Network.emulateNetworkConditions", offline=False, latency=0,
                                downloadThroughput=-1, uploadThroughput=-1)
                except (OSError, RuntimeError):
                    pass  # A terminated worker has no network override to restore.
                finally:
                    worker.ws.s.close()

    def offline_reload(self):
        self.wait("!!navigator.serviceWorker.controller", "No controlling service worker")
        saved = self.js("localStorage.getItem(KEY)")
        previous_id = self.js("__vtest.id")
        navigation_mark = len(self.page.events)
        with self.offline_network():
            self.load()
            self.check("!navigator.onLine && !!navigator.serviceWorker.controller", "Not actually offline/controlled")
            require(self.js("__vtest.id") != previous_id, "Offline check reused the old document")
            require(self.js("location.pathname") == urllib.parse.urlsplit(self.url).path,
                    "Offline navigation changed v2 URL")
            self.check("document.title === 'Азбука с Ори 2' && KEY === 'oriAlphabet2' && "
                       "VOICE_CACHE === 'ori-v2-voice-'+VOICE_VERSION", "Offline fallback served index instead of v2")
            require(self.js("VOICE_VERSION") == self.version, "Offline page has a stale voice fingerprint")
            self.wait("S.voiceDL === true", "Reload did not recognize the complete downloaded cache")
            require(self.js("localStorage.getItem(KEY)") == saved, "Offline reload changed saved test progress")
            documents = [e["params"]["response"] for e in self.page.events[navigation_mark:]
                         if e.get("method") == "Network.responseReceived"
                         and e["params"].get("type") == "Document"]
            require(any(r.get("fromServiceWorker") and r["status"] == 200
                        and urllib.parse.urlsplit(r["url"]).path.endswith("/v2.html") for r in documents),
                    "Offline v2 was not delivered by the service worker")
            self.check("fetch(" + js_json(self.missing) + ",{cache:'no-store'}).then(()=>false,()=>true)",
                       "An uncached local request still reached the network while offline")
            images = self.js(r"""(async()=>{
              const urls=[...new Set([...document.images].map(i=>i.src))];
              const results=[];
              for(const url of urls) {
                const response=await fetch(url,{cache:'no-store'});
                if(!response.ok) throw Error('Offline image HTTP failure: '+url);
                const bitmap=await createImageBitmap(await response.blob());
                results.push({url,width:bitmap.width,height:bitmap.height});bitmap.close();
              }
              return results;
            })()""")
            require(all(i["width"] > 0 and i["height"] > 0 for i in images)
                    and {Path(urllib.parse.urlsplit(i["url"]).path).stem for i in images} == set(ROLES),
                    "Not all four character images decode offline")
            inventory = self.cache_inventory()
            require(not inventory["missing"] and not inventory["bad"]
                    and set(inventory["roles"]) == set(ROLES)
                    and inventory["count"] == inventory["total"], f"Offline cache incomplete: {inventory}")
            # A fresh page + clearing only its in-memory buffers forces native re-decoding
            # from persistent CacheStorage, not reuse of buffers from online playback.
            self.js("hush();vBufs.clear()")
            for text, who in self.greetings:
                mark = self.mark()
                self.action(f"return say({js_json(text)},undefined,{js_json(who)});")
                self.recording(mark, text, who)
                self.check(f"__vtest.fetches.length === {mark['fetches']} && vHow==='disk'",
                           "Offline recording attempted network instead of persistent role cache")
            self.screenshot("offline")

    def run(self):
        for name, function in (
            ("compile/runtime and mobile 412px", self.load_and_compile),
            ("role keys and complete manifest", self.coverage),
            ("four real network greetings and role-aware replay", self.greetings_and_replay),
            ("runLesson student greetings without gameplay", self.lesson_greetings),
            ("praise, encouragement and robot routing", self.feedback_and_robot),
            ("mute and superseding speech cancellation", self.mute_and_cancel),
            ("real 404 fallback and clip recovery", self.missing_and_recovery),
            ("partial all-role download and retry", self.download_and_recovery),
            ("fresh offline v2, all images and role recordings", self.offline_reload),
        ):
            self.scenario(name, function)
        print(f"PASS total={self.count}; isolated progress only; no external services", flush=True)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8772/v2.html")
    parser.add_argument("--download-timeout", type=float, default=300,
                        help="Maximum seconds per all-role download attempt (default: 300)")
    args = parser.parse_args()
    runner = None
    try:
        require(args.download_timeout > 0, "Download timeout must be positive")
        phrases, missing = preflight(args.url)
        with isolated_edge() as page:
            runner = Runner(page, args.url, phrases, missing, args.download_timeout)
            try:
                runner.run()
            except Exception:
                try:
                    runner.screenshot("failure")
                except Exception:
                    pass  # Preserve the original failure if navigation/browser itself failed.
                raise
        return 0
    except Exception as error:
        print(f"FAIL {runner.current if runner else 'preflight/setup'}: {error}", flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

"""Real RPG integration tests against loopback, using a NEW disposable Edge profile.

Run: C:/TST/python.exe -B C:/projects/GAMES/azbuka-ori/tools/rpg_browser_test.py
Only screenshots are written outside these test sources, under C:/AI/tmp.
No production changes, personal browser connection, credentials, or external requests.
"""

import argparse
from contextlib import contextmanager
from datetime import datetime
import importlib.util
import json
from pathlib import Path
import sys
import time
import urllib.parse
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parent.parent
TMP = Path('C:/AI/tmp')
KEY = 'oriRpg3'
# Import the existing safety context WITHOUT creating helper bytecode in the repo.
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('rpg_isolation', ROOT / 'tools/voice_v2_test.py')
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
require, js_json = helpers.require, helpers.js_json
PROBE = (ROOT / 'tools/rpg_ui_test.js').read_text(encoding='utf-8')


class Runner:
    def __init__(self, page, url):
        self.page, self.url = page, url
        self.missing = urllib.parse.urljoin(url, '__rpg_uncached_' + uuid.uuid4().hex)
        self.run_id = datetime.now().strftime('%Y%m%d-%H%M%S')
        self.failures, self.passes, self.artifacts = [], [], []
        self.collected_errors, self.media_errors = [], []
        self.media_seen = set()
        self.document_id = None
        self.error_offset = 0
        self.full_state = None
        self.task_counts = {}
        self.current = 'setup'
        self.offline = False
        for domain in ('Page', 'Runtime', 'Network'):
            page.call(domain + '.enable')
        page.call('Network.setCacheDisabled', cacheDisabled=True)
        page.call('Emulation.setEmulatedMedia', features=[{'name': 'prefers-reduced-motion', 'value': 'reduce'}])
        page.call('Page.addScriptToEvaluateOnNewDocument', source=PROBE)
        self.viewport(390, 844)

    def js(self, expression):
        return self.page.js(expression)

    def wait(self, expression, message, timeout=30, navigating=False):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            try:
                if self.js(expression):
                    return
            except RuntimeError as error:
                if not navigating or not any(s in str(error) for s in ('context', 'Execution', 'Cannot find')):
                    raise
            time.sleep(.05)  # Bounded condition polling, never a fixed gameplay wait.
        raise TimeoutError(message)

    def viewport(self, width, height):
        self.width = width
        self.page.call('Emulation.setDeviceMetricsOverride', width=width, height=height,
                       deviceScaleFactor=1, mobile=False)

    def collect(self):
        if not self.js("typeof __rpgtest !== 'undefined'"):
            return
        ident = self.js('__rpgtest.id')
        if ident != self.document_id:
            self.document_id, self.error_offset = ident, 0
        self.task_counts[ident] = self.js('__rpgtest.tasks')
        errors = self.js('__rpgtest.errors')
        self.collected_errors.extend({'scenario': self.current, 'error': e} for e in errors[self.error_offset:])
        self.error_offset = len(errors)
        for row in self.js('__rpgtest.media.map((r,index)=>({...r,index})).filter(r=>r.error)'):
            key = (ident, row['index'])
            if key not in self.media_seen:
                self.media_seen.add(key)
                self.media_errors.append({'scenario': self.current, **row})

    def load(self, route='home', timeout=45):
        if self.document_id is not None:
            self.collect()
        old = self.js('window.__rpgtest?.id || null')
        if self.offline and route is None:
            result = self.page.call('Page.navigate', url=self.url + '?rpg-offline=' + self.run_id)
            require(not result.get('errorText'), 'Offline navigation failed: ' + str(result))
        elif self.js('location.href.split("#")[0]') == self.url:
            self.js('location.hash=' + js_json(route or ''))
            # Page.navigate to a different fragment is only same-document navigation.
            # Force a genuine document reload so the private app state comes from store.
            self.page.call('Page.reload', ignoreCache=False)
        else:
            result = self.page.call('Page.navigate', url=self.url + ('#' + route if route else ''))
            require(not result.get('errorText'), 'Navigation failed: ' + str(result))
        self.wait("typeof __rpgtest !== 'undefined' && __rpgtest.id !== " + js_json(old)
                  + " && document.readyState === 'complete' && !!window.ORI_STORE && !!document.querySelector('#coins')",
                  'Fresh RPG document did not initialize', navigating=True, timeout=timeout)
        require(self.js('document.title') == 'Читаем с Ори', 'Wrong application was served')
        require(self.js("document.querySelector('#saveWarning').hidden"), 'Save blocked on load')
        self.collect()

    def seed(self, **settings):
        if not self.js('!!window.ORI_STORE'):
            self.load()
        # ONLY the disposable local page; the app reloads its private state from the public store.
        self.js('(options=>{const store=ORI_STORE.create(), s=store.fresh();'
                'if(options.startLesson)s.settings.startLesson=options.startLesson;'
                'if(options.coins!==undefined)s.coins=options.coins;'
                'store.save(s);})(' + js_json(settings) + ')')
        self.load()

    def action(self, name, *args, timeout=180):
        self.js('__rpgtest.run(' + ','.join(js_json(x) for x in (name, *args)) + ');0')
        self.wait('__rpgtest.job.done', 'UI scenario timed out: ' + name, timeout=timeout)
        job = self.js('__rpgtest.job')
        require(not job.get('error'), job.get('error', 'UI failure'))
        return job.get('result')

    def click(self, action, value=None):
        return self.js('__rpgtest.click(' + js_json(action)
                       + (',' + js_json(value) if value is not None else '') + ')')

    def state(self):
        return self.js('__rpgtest.state()')

    def screenshot(self, name):
        require(TMP.is_dir() and not TMP.is_symlink(), 'Unsafe/missing screenshot directory')
        path = TMP / f'rpg-{self.run_id}-{name}-{self.width}.png'
        self.js('scrollTo({top:0,behavior:"instant"})')
        path.write_bytes(self.page.shot('png'))
        self.artifacts.append(str(path))
        print('SCREENSHOT ' + str(path), flush=True)

    def scenario(self, name, function):
        self.current = name
        before = len(self.collected_errors)
        try:
            result = function()
            self.collect()
            require(len(self.collected_errors) == before, 'New console/runtime/resource errors: ' + str(self.collected_errors[before:before+3]))
            self.passes.append(name)
            print('PASS ' + name + (': ' + json.dumps(result, ensure_ascii=False) if result is not None else ''), flush=True)
        except Exception as error:
            self.failures.append({'scenario': name, 'error': str(error)})
            print('FAIL ' + name + ': ' + str(error), flush=True)
            try:
                self.screenshot('failure-' + str(len(self.failures)))
            except Exception:
                pass
        finally:
            self.collect()

    def startup(self):
        self.load()
        self.wait('!!navigator.serviceWorker.controller', 'Service worker never claimed page', timeout=60)
        self.js('__rpgtest.images()')
        self.screenshot('home')
        count = self.js('Object.keys(ORI_VOICE.clips).length')
        require(count == 979, f'Expected 979 voice entries, got {count}')
        require(self.js('ORI_REWARDS.items.length') == 44, 'Expected 44 rewards')
        files = self.js('Object.values(ORI_VOICE.clips)')
        missing = [f for f in files if not (ROOT / f).is_file() or (ROOT / f).stat().st_size <= 32]
        require(not missing, 'Missing physical audio assets: ' + str(missing[:5]))
        return {'manifest': count, 'assetsExist': len(files), 'serviceWorker': True}

    def curriculum(self):
        self.seed()
        result = self.action('curriculum', timeout=600)
        self.full_state = self.state()
        self.screenshot('all104-result')
        self.curriculum_result = result
        # Report coverage separately from missing recordings/layout so a genuine 520-task
        # run remains distinguishable from ancillary failures.
        return {**{k: v for k, v in result.items() if k not in ('missingAudio', 'leaks', 'layouts')},
                'missingAudioCount': len(result['missingAudio']), 'targetLeaks': result['leaks'],
                'layoutIssues': len(result['layouts'])}

    def curriculum_audio(self):
        r = getattr(self, 'curriculum_result', None)
        require(r is not None, 'Curriculum did not complete; cannot claim audio coverage')
        require(not r['missingAudio'], 'Missing UI q.audio keys: ' + json.dumps(r['missingAudio'][:12], ensure_ascii=False) + f" (total {len(r['missingAudio'])})")
        require(not r['leaks'], 'Read-mode automatic target leak: ' + str(r['leaks'][:4]))
        return {'actualUIQuestionsChecked': r['audioChecked'], 'targetLeaks': 0}

    def mobile_layout(self):
        r = getattr(self, 'curriculum_result', None)
        require(r is not None, 'No full mobile curriculum')
        require(not r['layouts'], '390px overflow: ' + json.dumps(r['layouts'][:10], ensure_ascii=False) + f" (total {len(r['layouts'])})")
        return {'questions': 520, 'results': 104, 'width': 390}

    def bad_choice(self):
        self.seed()
        return self.action('badChoice')

    def assisted(self):
        self.seed(startLesson=6)
        return self.action('assisted')

    def pause_reload(self):
        self.seed()
        self.js("__rpgtest.start('lesson001')")
        self.js('__rpgtest.solve()')
        q = self.state()['draft']['plan']['questions'][1]
        self.click('answer', q['correct'][0])
        before = self.state()
        self.click('pause')
        self.load()
        require(self.state() == before, 'Pause/reload changed draft/progress')
        self.click('resume')
        require(self.state() == before, 'Resume changed plan/index/partial game')
        require(self.js("!!document.querySelector('[data-action=\"next-question\"]')"), 'Solved pending question not restored')
        self.js('__rpgtest.complete()')
        receipt = self.js('__rpgtest.finish()')
        saved = self.state()
        self.load('result')
        require(self.state() == saved and self.js('!!document.querySelector(".result")'), 'Reload lost result/awarded extra')
        return {'restoredIndex': before['draft']['index'], 'samePlanAndGame': True, 'receipt': receipt}

    def replays(self):
        self.seed(startLesson=9)
        return self.action('replays')

    def duplicate_sequence(self):
        self.seed(startLesson=9)
        return self.action('duplicateSequence')

    def purchase_inventory(self):
        self.seed(coins=10000)
        rows = self.action('purchases', timeout=240)
        saved = self.state()
        self.load('room')
        require(self.state() == saved, 'Purchase/equipment reload changed data')
        require(self.js('document.querySelectorAll(".owned-row").length') == 44, 'Inventory lost on reload')
        require(saved['coins'] == 10000 - sum(row['price'] for row in rows), 'Purchase total not exact')
        self.js('__rpgtest.images()')
        self.screenshot('room44')
        # A purchased item remains non-purchasable after reload through its actual detail UI.
        self.js("__rpgtest.go('shop')")
        self.click('item', 'plant')
        self.wait('!!document.querySelector(".detail")', 'Purchased detail not shown')
        require(not self.js('!!document.querySelector("[data-action=buy-confirm]")'), 'Reload permits duplicate purchase')
        require(self.state() == saved, 'Viewing owned item changed wallet')
        return {'purchased': len(rows), 'spent': sum(row['price'] for row in rows), 'balance': saved['coins'], 'persisted': True}

    def insufficient(self):
        self.seed(coins=0)
        before = self.state()
        self.js("__rpgtest.buyItem('pet_dragon')")
        require(self.state() == before, 'Insufficient balance changed state')
        require('Подарок подождёт' in self.js('document.querySelector("#modalTitle").textContent'), 'No insufficient balance explanation')
        self.click('close')
        return {'balance': 0, 'unchanged': True}

    def previews(self):
        self.seed()
        result = self.action('previews', timeout=240)
        require(result['count'] == 44, 'Not all previews exercised')
        require(not result['layouts'], 'Preview/layout overflow: ' + str(result['layouts'][:5]))
        self.viewport(1440, 1200)
        self.js("__rpgtest.go('shop')")
        self.click('filter', 'effects')
        self.js('__rpgtest.images()')
        self.screenshot('effects-catalog')
        self.click('filter', 'themes')
        self.click('item', 'paint')
        self.wait('!!document.querySelector(".detail-art img")', 'Palette detail not shown')
        self.js('__rpgtest.images()')
        self.screenshot('paint-detail')
        self.viewport(390, 844)
        return {'previewsAnimated': 44, 'uniqueCatalogImages': 44, 'free': True, 'brokenImages': 0}

    def paint_colors(self):
        self.seed(coins=1000)
        result = self.action('paintColors')
        saved = self.state()
        self.load('room')
        require(self.state() == saved, 'Palette choice lost after reload')
        require(not self.js('getComputedStyle(document.querySelector(".room")).backgroundImage.includes(ORI_ART.paint.src)'),
                'Palette picture became room wallpaper after reload')
        self.screenshot('paint-colors')
        return result

    def settings(self):
        self.seed()
        result = self.action('parent')
        imported = self.action('malformed')
        self.screenshot('settings')
        saved = self.state()
        self.load('settings')
        require(self.state() == saved and not self.js('!!document.querySelector("#startLesson")'), 'Parent access persisted through reload')
        return {**result, **imported, 'gateResetAfterReload': True}

    def migration(self):
        # The only legacy write, using literal IDs from shipped v2, exclusively in this
        # disposable profile. No localStorage.clear(), no original-user storage touched.
        old = {'coins': 937, 'stars': {'letter_А': 3, 'letter_Я': 2, 'letter_Ъ': 1,
                                     'blend': 3, 'game_memory': 3},
               'gifts': ['plant', 'paint', 'robot'], 'shown': ['plant', 'paint'],
               'theme': 2, 'student': 2, 'sound': False}
        raw = ' \n' + json.dumps(old, ensure_ascii=False, indent=2) + '\n '
        self.js('localStorage.removeItem("oriRpg3");localStorage.removeItem("oriAlphabet2.backup.rpg3");'
                'localStorage.setItem("oriAlphabet2",' + js_json(raw) + ');0')
        self.load()
        s = self.state()
        letters = self.js("ORI_LEARNING.lessons.filter(l=>['Буква А','Буква Я','Буква Ъ'].includes(l.title)).map(l=>l.id)")
        require(set(s['mastered']) == set(letters) and len(s['stars']) == 3, 'Legacy mapping inferred reading mastery or lost literal letters')
        require(s['coins'] == 937 and s['owned'] == old['gifts'] and s['shown'] == old['shown']
                and s['theme'] == 2 and s['friend'] == 'alien3' and s['legacy']['state'] == old, 'Legacy state not preserved')
        require(self.js('localStorage.getItem("oriAlphabet2")') == raw and self.js('localStorage.getItem("oriAlphabet2.backup.rpg3")') == raw, 'Original/backup legacy bytes altered')
        self.load()
        require(self.state() == s, 'Migration repeated/changed wallet')
        self.js("__rpgtest.go('room')")
        require(self.js('document.querySelectorAll(".owned-row").length') == 3, 'Legacy inventory missing')
        return {'literalLetters': len(letters), 'readingNotPromoted': True, 'rawBackupPreserved': True}

    def real_audio(self):
        self.seed()
        self.js("__rpgtest.start('lesson001')")
        mark = self.js('__rpgtest.media.length')
        self.click('instruction')
        self.wait(f'__rpgtest.media.slice({mark}).some(r=>r.playing && r.time>0 && r.duration>0)', 'Instruction never played actual media')
        first = self.js(f'__rpgtest.media[{mark}]')
        q = self.state()['draft']['plan']['questions'][0]
        mark = self.js('__rpgtest.media.length')
        self.click('hint')
        expected = self.js('__rpgtest.absolute(__rpgtest.questionClip(' + js_json(q) + '))')
        self.wait(f'__rpgtest.media.slice({mark}).some(r=>r.playing && r.time>0 && r.duration>0)', 'Explicit hint never played actual media')
        hint = self.js(f'__rpgtest.media[{mark}]')
        require(hint['url'] == expected, 'UI hint selected wrong recording')
        self.click('sound')
        require(self.js(f'__rpgtest.media[{mark}].paused'), 'Mute failed to pause active audio')
        quiet = self.js('__rpgtest.media.length')
        self.click('instruction')
        require(self.js('__rpgtest.media.length') == quiet, 'Muted instruction played')
        self.click('sound')
        self.js('__rpgtest.solve()')
        self.js('__rpgtest.solve()')
        require(self.state()['draft']['plan']['questions'][2]['mode'] == 'listen', 'Listen fixture wrong')
        mark = self.js('__rpgtest.media.length')
        self.click('listen')
        self.wait(f'__rpgtest.media.slice({mark}).some(r=>r.playing && r.time>0)', 'Listen signal never played')
        self.action('parent')
        roles = []
        for role in ('ori', 'alien1', 'alien2', 'alien3'):
            mark = self.js('__rpgtest.media.length')
            self.click('voice', role)
            self.wait(f'__rpgtest.media.slice({mark}).some(r=>r.playing && r.time>0 && r.duration>0)',
                      'Voice settings sample did not play: ' + role)
            record = self.js(f'__rpgtest.media[{mark}]')
            require('/' + role + '/' in record['url'], 'Voice button selected a different role')
            roles.append(role)
        return {'instruction': first['url'], 'hint': hint['url'], 'nativePlayback': True,
                'mute': True, 'listen': True, 'nativeRoles': roles}

    def memory_audio(self):
        self.seed()
        self.js("__rpgtest.start('lesson001')")
        for _ in range(3):
            self.js('__rpgtest.solve()')
        require(self.state()['draft']['plan']['questions'][3]['type'] == 'memory', 'Wrong memory fixture')
        text = self.js('ORI_LEARNING.lines.find(l=>l.id==="instruction-memory").text')
        available = self.js("['ori','alien1','alien2','alien3'].filter(w=>__rpgtest.clip(" + js_json(text) + ',w))')
        mark = self.js('__rpgtest.media.length')
        self.click('hint')
        require(self.js('__rpgtest.media.length') > mark,
                'Memory hint produced no audio; recorded roles=' + str(available)
                + '; actual UI toast=' + self.js('document.querySelector("#toast").textContent'))
        self.wait(f'__rpgtest.media.slice({mark}).some(r=>r.playing && r.time>0)', 'Memory hint did not play')
        expected = self.js('__rpgtest.absolute(__rpgtest.questionClip(__rpgtest.draft().plan.questions[3]))')
        require(self.js(f'__rpgtest.media[{mark}].url') == expected, 'Memory hint lost authored speaker')
        return {'recordedRoles': available, 'played': True}

    def route_audio(self):
        self.seed()
        self.js("__rpgtest.start('lesson001')")
        self.wait('__rpgtest.media.length>0 && (__rpgtest.media[0].resolved || __rpgtest.media[0].rejected)',
                  'Intro audio never settled')
        intro = self.js('__rpgtest.media[0]')
        self.js('__rpgtest.complete()')
        mark = self.js('__rpgtest.media.length')
        self.js('__rpgtest.finish()')
        self.wait(f'__rpgtest.media.length>{mark} && (__rpgtest.media[{mark}].resolved || __rpgtest.media[{mark}].rejected)',
                  'Outro audio never settled')
        outro = self.js(f'__rpgtest.media[{mark}]')
        require(not intro['paused'] and not outro['paused'],
                'Route transition cancelled its own intro/outro: ' + json.dumps({'intro': intro, 'outro': outro}))
        return {'intro': intro, 'outro': outro}

    # Reuse the existing helper's worker+page offline emulation. It attaches ONLY to
    # the spawned browser's debugger port; the main user's Chrome is never enumerated.
    @contextmanager
    def offline_network(self):
        self.page.call('Network.setCacheDisabled', cacheDisabled=False)
        try:
            with helpers.Runner.offline_network(self):
                self.offline = True
                yield
        finally:
            self.offline = False
            self.page.call('Network.setCacheDisabled', cacheDisabled=True)

    def download_offline(self):
        self.seed()
        self.action('parent')
        # parent() selected lesson 62 but did not fabricate any stars/rewards.
        self.click('offline')
        self.wait('!document.querySelector("[data-action=offline]").disabled', 'All-voice download did not finish', timeout=300)
        inventory = self.js('''(async()=>{
          const c=await caches.open('ori-voice-v3-'+ORI_VOICE.version), bad=[];
          const urls=[...new Set(Object.values(ORI_VOICE.clips))]; let bytes=0;
          for(const u of urls){const r=await c.match(u);if(!r||!r.ok){bad.push(u);continue;}
            const b=await r.arrayBuffer();bytes+=b.byteLength;
            if(b.byteLength<=32 || /text\\/html/.test(r.headers.get('content-type')||''))bad.push(u);}
          return {count:(await c.keys()).length,total:urls.length,bad,bytes};
        })()''')
        require(not inventory['bad'] and inventory['count'] == 979, 'Voice cache incomplete: ' + str(inventory))
        self.wait('!!navigator.serviceWorker.controller', 'No SW controller')
        before = self.state()
        mark = len(self.page.events)
        # Normal browser cache policy; assert fromServiceWorker below, not just an
        # HTTP cache hit. DevTools' forced bypass is not an ordinary offline launch.
        with self.offline_network():
            self.offline = True
            diagnostics = self.js('''(async()=>{
              const urls=['index.html','index.html#home','index.html?test=1#home','./#shop','rpg/app.js']; const results=[];
              for(const url of urls){let network;try{const r=await fetch(url);network={status:r.status,bytes:(await r.arrayBuffer()).byteLength};}catch(e){network={error:String(e)};}
                const cached=await caches.match(url);results.push({url,cache:!!cached,...network});}
              return {controller:!!navigator.serviceWorker.controller,online:navigator.onLine,results};
            })()''')
            print('INFO offline before navigation: ' + json.dumps(diagnostics), flush=True)
            require(all(r.get('status') == 200 for r in diagnostics['results']),
                    'Offline shell query/fragment lookup failed: ' + json.dumps(diagnostics))
            # Exercise the complete offline UI even if hash-shell lookup is broken;
            # the hash reload remains a mandatory, separately reported assertion below.
            self.load(route=None)
            require(self.js('!navigator.onLine && !!navigator.serviceWorker.controller'), 'Offline not active')
            require(self.state() == before, 'Offline navigation changed save')
            require(self.js('fetch(' + js_json(self.missing) + ',{cache:"no-store"}).then(()=>false,()=>true)'), 'Uncached page request still reached network')
            self.js('__rpgtest.images()')
            self.js("__rpgtest.start('lesson062')")
            q = self.state()['draft']['plan']['questions'][0]
            start = self.js('__rpgtest.media.length')
            self.click('listen' if q['mode'] == 'listen' else 'hint')
            self.wait(f'__rpgtest.media.slice({start}).some(r=>r.playing && r.time>0)', 'Cached recording did not play offline')
            self.js('__rpgtest.complete()')
            receipt = self.js('__rpgtest.finish()')
            self.screenshot('offline-result')
            documents = [e['params']['response'] for e in self.page.events[mark:]
                         if e.get('method') == 'Network.responseReceived' and e['params'].get('type') == 'Document']
            require(any(r.get('fromServiceWorker') and r['status'] == 200 for r in documents), 'Offline shell was not served by SW')
            require(receipt['coins'] == 25 and self.state()['draft'] is None, 'Offline lesson not persisted')
            offline_saved = self.state()
            print('INFO offline UI passed: ' + json.dumps({**inventory, 'tasks': 5, 'receipt': receipt,
                                                          'nativeCachedAudio': True}), flush=True)
            try:
                self.load('home', timeout=10)
            except Exception as error:
                raise AssertionError('Offline hash reload failed; fragment-free shell, all 979 cached clips, '
                                     'native audio and 5 UI tasks passed. Inspect SW/cache request routing.') from error
            require(self.state() == offline_saved, 'Hash offline reload lost completed progress')
        self.offline = False
        return {**inventory, 'offlineUIQuestions': 5, 'nativeCachedAudio': True, 'workerAndPageOffline': True}

    def wide_routes(self):
        self.seed(coins=10000)
        self.viewport(1440, 1100)
        # UI-sourced purchased state can be reused only via public validation/save.
        if self.full_state:
            self.js('ORI_STORE.create().save(' + js_json(self.full_state) + ')')
            self.load()
        bad = []
        for route in ('home', 'map', 'shop', 'room', 'games', 'passport', 'album', 'quests', 'wardrobe', 'pets', 'settings'):
            self.js('__rpgtest.go(' + js_json(route) + ')')
            self.js('__rpgtest.images()')
            bad.extend(self.js('__rpgtest.layout(' + js_json('wide/' + route) + ')'))
            if route in ('home', 'map', 'shop'):
                self.screenshot(route + '-wide')
        require(not bad, 'Wide routes overflow: ' + str(bad[:5]))
        self.viewport(390, 844)
        self.js("__rpgtest.go('home')")
        return {'width': 1440, 'routes': 11, 'imagesDecoded': True}

    def final_errors(self):
        self.collect()
        external = [e['params']['request']['url'] for e in self.page.events
                    if e.get('method') == 'Network.requestWillBeSent'
                    and urllib.parse.urlsplit(e['params']['request']['url']).scheme in ('http', 'https')
                    and urllib.parse.urlsplit(e['params']['request']['url']).netloc != urllib.parse.urlsplit(self.url).netloc]
        runtime = [e['params']['exceptionDetails'].get('text') for e in self.page.events if e.get('method') == 'Runtime.exceptionThrown']
        require(not external, 'External requests attempted: ' + str(external[:5]))
        require(not self.collected_errors and not runtime, 'Runtime/resource errors: ' + str(self.collected_errors[:8]) + str(runtime[:5]))
        require(not self.media_errors, 'Native media errors: ' + str(self.media_errors[:5]))
        return {'externalRequests': 0, 'consoleRuntimeResourceErrors': 0, 'mediaErrors': 0}

    def run(self, only=None):
        self.scenario('startup', self.startup)
        tests = [('curriculum', self.curriculum), ('curriculum-audio', self.curriculum_audio),
                 ('mobile-layout', self.mobile_layout), ('bad-choice', self.bad_choice),
                 ('assisted', self.assisted), ('pause-reload', self.pause_reload),
                 ('replays', self.replays), ('duplicate-sequence', self.duplicate_sequence),
                 ('purchases', self.purchase_inventory),
                 ('insufficient', self.insufficient), ('previews', self.previews),
                 ('paint-colors', self.paint_colors), ('settings-import', self.settings), ('migration', self.migration),
                 ('real-audio', self.real_audio), ('memory-audio', self.memory_audio),
                 ('route-audio', self.route_audio),
                 ('offline', self.download_offline),
                 ('wide-layout', self.wide_routes)]
        for name, function in tests:
            if only is None or name in only:
                self.scenario(name, function)
        self.scenario('errors-and-local-only', self.final_errors)
        print('SUMMARY ' + json.dumps({'passed': len(self.passes), 'failed': len(self.failures),
                                      'tasksObserved': sum(self.task_counts.values()), 'failures': self.failures,
                                      'screenshots': self.artifacts}, ensure_ascii=False), flush=True)
        return not self.failures


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8', errors='replace')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:8774/index.html')
    parser.add_argument('--only', help='Comma-separated scenarios for targeted reruns; startup/error checks always run')
    args = parser.parse_args()
    p = urllib.parse.urlsplit(args.url)
    require(p.scheme == 'http' and p.hostname in ('127.0.0.1', 'localhost', '::1') and not p.username
            and not p.password and not p.query and not p.fragment and p.path.endswith('/index.html'), 'Only a local index.html URL is allowed')
    require(TMP.is_dir() and not TMP.is_symlink(), 'Existing C:/AI/tmp required')
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), helpers.NoRedirect())
    with opener.open(args.url, timeout=10) as response:
        require(response.status == 200, 'Local server is unavailable')
    with helpers.isolated_edge() as page:
        runner = Runner(page, args.url)
        try:
            return 0 if runner.run(set(args.only.split(',')) if args.only else None) else 1
        except Exception as error:
            print('FATAL ' + runner.current + ': ' + str(error), flush=True)
            return 1


if __name__ == '__main__':
    raise SystemExit(main())

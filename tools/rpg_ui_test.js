'use strict';
// Injected BEFORE app.js, only in voice_v2_test.isolated_edge()'s disposable profile.
// No private IIFE state, no replacement engine, no synthetic completion/reward writes.
(() => {
  const T = window.__rpgtest = {
    id: Math.random().toString(36), errors: [], media: [], fetches: [],
    tasks: 0, lessons: 0, types: {}, mechanics: {}, duplicates: 0,
    audioChecked: 0, missingAudio: [], leaks: [], layouts: [], job: null
  };
  const assert = T.assert = (value, message) => { if (!value) throw Error(message); };
  addEventListener('error', e => {
    if (e.target !== window) T.errors.push('resource: ' + (e.target.src || e.target.href || e.target.tagName));
    else T.errors.push(e.message);
  }, true);
  addEventListener('unhandledrejection', e => T.errors.push(String(e.reason?.stack || e.reason)));
  const realError = console.error.bind(console);
  console.error = (...args) => { T.errors.push(args.map(String).join(' ')); realError(...args); };
  const fetchReal = fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    assert(url.origin === location.origin, 'Non-local fetch: ' + url);
    const entry = {url: url.href}; T.fetches.push(entry);
    try { const r = await fetchReal(input, init); entry.status = r.status; return r; }
    catch (e) { entry.error = String(e); throw e; }
  };
  const playReal = HTMLMediaElement.prototype.play;
  const pauseReal = HTMLMediaElement.prototype.pause;
  const records = new WeakMap();
  HTMLMediaElement.prototype.play = function(...args) {
    const url = new URL(this.currentSrc || this.src, location.href);
    assert(url.origin === location.origin, 'Non-local audio: ' + url);
    const entry = {url: url.href, playing: false, paused: false, time: 0, duration: 0};
    T.media.push(entry); records.set(this, entry);
    this.addEventListener('playing', () => { entry.playing = true; entry.duration = this.duration; });
    this.addEventListener('timeupdate', () => { entry.time = this.currentTime; });
    this.addEventListener('error', () => { entry.error = this.error?.message || 'media error'; });
    const p = playReal.apply(this, args);
    p.then(() => { entry.resolved = true; }, e => { entry.rejected = e.name; });
    return p;
  };
  HTMLMediaElement.prototype.pause = function(...args) {
    if (records.has(this)) records.get(this).paused = true;
    return pauseReal.apply(this, args);
  };
  T.tick = () => new Promise(resolve => setTimeout(resolve, 0));
  T.wait = async (condition, message, timeout = 10000) => {
    const end = performance.now() + timeout;
    while (performance.now() < end) {
      if (condition()) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw Error(message);
  };
  T.state = () => JSON.parse(localStorage.getItem('oriRpg3'));
  T.draft = () => T.state()?.draft;
  T.select = (action, value) => '[data-action="' + action + '"]' +
    (value === undefined ? '' : '[data-value="' + CSS.escape(String(value)) + '"]');
  // Edge's IPC flood protection rejects hundreds of zero-time hash navigations.
  // Pace only real route changes; do not disable that browser protection.
  T.paceNavigation = async () => {
    await T.wait(() => performance.now() - (T.lastNavigation || -1000) >= 140, 'Navigation cadence');
    T.lastNavigation = performance.now();
  };
  T.click = async (action, value) => {
    if (['go', 'chapter', 'start', 'resume', 'pause', 'item', 'replace-draft'].includes(action)) await T.paceNavigation();
    const selector = T.select(action, value), modal = document.querySelector('#modal');
    const root = modal?.open ? modal : document;
    const el = root.querySelector(selector);
    assert(el && !el.disabled && el.getClientRects().length, 'Missing/disabled/invisible UI ' + selector + ' @ ' + location.hash);
    el.click();
    await T.tick();
  };
  T.go = async route => {
    if (document.querySelector('#modal').open) await T.click('close');
    if (location.hash !== '#' + route) {
      await T.paceNavigation();
      const old = document.querySelector('#screen').innerHTML;
      location.hash = route;
      await T.wait(() => document.querySelector('#screen').innerHTML !== old, 'Route did not render: ' + route);
    }
    await T.tick();
  };
  T.hash = text => {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) ^ text.charCodeAt(i)) >>> 0;
    return h.toString(16);
  };
  T.clip = (text, who = 'ori') => ORI_VOICE.clips[who + '/' + T.hash(text)];
  T.absolute = url => new URL(url, location.href).href;
  // Source-aware app questionAudio boundary: engine payloads are semantic tokens,
  // while the shipped manifest uses phoneme/syllable/stress recording keys.
  T.questionText = q => {
    if (q.type === 'memory') return ORI_LEARNING.lines.find(l => l.id === 'instruction-memory').text;
    if (q.mechanic === 'stress') return '#stress_' + q.target.toLocaleLowerCase('ru');
    if (q.audio.startsWith('sound:')) return '#з_' + q.audio.slice(6);
    const lesson = ORI_LEARNING.lessons.find(l => l.id === T.draft().lessonId);
    if (['open', 'soft', 'reverse'].includes(lesson.kind)) return '#с_' + q.audio.toLocaleLowerCase('ru');
    return /^[А-ЯЁ]+$/.test(q.audio) ? q.audio.toLocaleLowerCase('ru') : q.audio.replace(/\s+/g, ' ').trim();
  };
  T.questionClip = q => T.clip(T.questionText(q), q.type === 'memory'
    ? ORI_LEARNING.lines.find(l => l.id === 'instruction-memory').who : 'ori');
  T.layout = label => {
    const selectors = ['html', '#gameFrame', '#gameHeader', '#screen', '.game-board', '.dialogue', '.choices', '.target-text', '.slots', '#modal[open]'];
    const bad = selectors.flatMap(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length && e.scrollWidth > e.clientWidth + 2)
      .map(e => ({selector: s, width: e.clientWidth, scroll: e.scrollWidth})));
    if (bad.length) T.layouts.push({label, viewport: innerWidth, bad});
    return bad;
  };
  T.images = async (root = document) => {
    const imgs = [...root.querySelectorAll('img')];
    imgs.forEach(i => { i.loading = 'eager'; });
    await Promise.all(imgs.map(i => i.decode()));
    assert(imgs.every(i => i.naturalWidth > 0), 'Broken image');
  };
  T.start = async id => {
    await T.go('map');
    const lesson = ORI_LEARNING.lessons.find(l => l.id === id);
    await T.click('chapter', lesson.chapter);
    await T.wait(() => !!document.querySelector(T.select('lesson', id)), 'Chapter not rendered');
    await T.click('lesson', id);
    const mark = T.media.length;
    await T.click('start', id);
    await T.wait(() => !!document.querySelector('.play-screen') && T.draft()?.lessonId === id, 'Lesson did not start: ' + id);
    T.entryMark = mark;
  };
  T.checkAudio = (q, mark) => {
    const path = T.questionClip(q);
    T.audioChecked++;
    if (!path) T.missingAudio.push({lesson: T.draft().lessonId, index: T.draft().index, audio: q.audio, mechanic: q.mechanic});
    // Memory's audio is a generic instruction, not the target; it may auto-play.
    if (q.mode === 'read' && q.type !== 'memory' && path && T.media.slice(mark).some(r => r.url === T.absolute(path)))
      T.leaks.push({lesson: T.draft().lessonId, index: T.draft().index, audio: q.audio});
  };
  T.solve = async () => {
    const d = T.draft(), q = d.plan.questions[d.index];
    assert(q && document.querySelectorAll('.choices [data-action="answer"]').length === q.options.length, 'Question DOM/options mismatch');
    T.checkAudio(q, T.entryMark ?? T.media.length);
    T.layout(d.lessonId + '/' + d.index);
    let indices;
    if (q.type === 'memory') {
      const groups = new Map();
      q.options.forEach((v, i) => { const key = v.toLocaleLowerCase('ru'); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(i); });
      assert([...groups.values()].every(g => g.length % 2 === 0), 'Unpaired memory cards');
      indices = [...groups.values()].flat();
    } else if (q.type === 'sequence') {
      const used = new Set();
      indices = q.answer.map(part => {
        const index = q.options.findIndex((v, i) => v === part && !used.has(i));
        assert(index >= 0, 'Sequence has no DISTINCT index for ' + part); used.add(index); return index;
      });
      if (new Set(q.answer).size < q.answer.length) T.duplicates++;
    } else indices = q.correct;
    assert(indices.length > 0, 'No answer indices');
    for (const i of indices) {
      const g = T.draft().game;
      if ((g.selected || []).includes(i) || (g.matched || []).includes(i)) continue;
      await T.click('answer', i);
    }
    assert(T.draft().game.done === true, 'UI did not solve ' + d.lessonId + '/' + d.index);
    const solved = T.draft(), expectedAnswerCoins = solved.answerCoins + (solved.game.errors ? 1 : 2);
    const money = T.state().coins, mark = T.media.length;
    await T.click('next-question');
    assert(T.draft().index === d.index + 1 && T.draft().results.length === d.index + 1, 'Question progress/result not persisted');
    assert(T.draft().answerCoins === expectedAnswerCoins, 'answerCoins differs from actual answer errors');
    assert(T.state().coins === money, 'Answer paid currency before finish');
    T.entryMark = mark;
    T.tasks++; T.types[q.type] = (T.types[q.type] || 0) + 1;
    T.mechanics[q.mechanic] = (T.mechanics[q.mechanic] || 0) + 1;
  };
  T.complete = async () => { while (T.draft().index < 5) await T.solve(); };
  T.finish = async (adult = true, expectedMastery = true) => {
    const before = T.state(), d = before.draft;
    assert(d.index === 5, 'Attempt not complete');
    const errors = d.results.reduce((n, r) => n + r.errors, 0);
    const stars = errors <= 1 ? 3 : errors <= 4 ? 2 : 1;
    const expectedCoins = d.results.reduce((n, r) => n + (r.errors ? 1 : 2), 0) + 5 * Math.max(0, stars - (before.stars[d.lessonId] || 0));
    const expectedXP = (before.stars[d.lessonId] || Object.values(before.ledger).some(r => r.lessonId === d.lessonId)) ? 3 : 10;
    // Real delegated click twice synchronously, before hashchange removes the completion buttons.
    await T.paceNavigation();
    const el = document.querySelector(T.select('finish', adult ? 'yes' : 'no'));
    assert(el && !el.disabled, 'Finish button absent'); el.click(); el.click();
    await T.wait(() => !!document.querySelector('.result'), 'Result not rendered');
    const after = T.state(), receipt = after.ledger[d.id];
    assert(after.draft === null, 'Draft not cleared');
    assert(after.coins - before.coins === expectedCoins && receipt.coins === expectedCoins, 'Wrong coin reward/double finish');
    assert(after.xp - before.xp === expectedXP && receipt.xp === expectedXP, 'Wrong XP reward');
    assert(after.stars[d.lessonId] === Math.max(before.stars[d.lessonId] || 0, stars) && receipt.stars === stars, 'Wrong stars');
    assert(receipt.mastered === expectedMastery && after.mastered.includes(d.lessonId) === (expectedMastery || before.mastered.includes(d.lessonId)), 'False/missing mastery');
    assert(Object.keys(after.ledger).length === Object.keys(before.ledger).length + 1, 'Receipt duplicated/lost');
    assert(after.attempts[d.lessonId] === before.attempts[d.lessonId], 'Finish incremented reserved attempt twice');
    assert(after.history[d.lessonId] === d.plan.signature, 'History signature not stored');
    assert(after.friendship[before.friend] === before.friendship[before.friend] + 1, 'Friendship not awarded exactly once');
    assert(d.results.every(r => !r.word || after.album.includes(r.word)), 'Completed words missing from album');
    assert(document.querySelector('.result-stars').getAttribute('aria-label') === stars + ' звёзд', 'Rendered stars mismatch');
    assert(document.querySelector('#coins').textContent === String(after.coins), 'Wallet DOM stale');
    T.layout(d.lessonId + '/result');
    return receipt;
  };
  T.curriculum = async () => {
    assert(ORI_LEARNING.lessons.length === 104, 'Expected 104 lessons');
    for (const lesson of ORI_LEARNING.lessons) {
      T.progress = lesson.id;
      await T.start(lesson.id); await T.complete(); await T.finish(); T.lessons++;
    }
    const s = T.state();
    assert(T.lessons === 104 && T.tasks >= 520 && s.mastered.length === 104, 'Incomplete curriculum');
    assert(s.coins === 2610 && s.xp === 1040 && Object.keys(s.ledger).length === 104, 'Full-game aggregate reward mismatch');
    assert(Object.values(s.stars).every(n => n === 3), 'Not all lessons retained 3 stars');
    assert(Object.values(s.ledger).filter(r => r.chapterCompleted).length === 8, 'Missing chapter receipts');
    assert(Object.keys(T.types).length === 4, 'Not all four answer types were exercised');
    return {lessons: T.lessons, tasks: T.tasks, coins: s.coins, xp: s.xp, types: T.types, mechanics: T.mechanics, duplicateSequences: T.duplicates, audioChecked: T.audioChecked, missingAudio: T.missingAudio, leaks: T.leaks, layouts: T.layouts};
  };
  T.badChoice = async () => {
    await T.start('lesson001');
    const before = T.state(), q = T.draft().plan.questions[0];
    const wrong = q.options.findIndex((_, i) => !q.correct.includes(i));
    await T.click('answer', wrong);
    const after = T.state();
    assert(after.coins === before.coins && after.xp === before.xp && JSON.stringify(after.stars) === JSON.stringify(before.stars), 'Wrong answer penalized stored wallet/stars/XP');
    assert(after.draft.errors === 1 && after.draft.questionErrors === 1 && !after.draft.game.done, 'Wrong choice not recorded');
    await T.complete(); assert(T.draft().answerCoins === 9, 'One bad choice must produce 9 answer coins');
    const receipt = await T.finish(); assert(receipt.coins === 24 && receipt.stars === 3, 'One-error finish should pay 24 with 3 stars');
    return receipt;
  };
  T.assisted = async () => {
    await T.start('lesson006');
    assert(T.draft().plan.questions.some(q => q.requiresAdult), 'Fixture lacks adult-required tasks');
    await T.click('hint'); assert(T.draft().helped && T.draft().game.helped && document.querySelector('.help-card'), 'Hint did not mark assisted state');
    await T.complete(); const receipt = await T.finish(false, false);
    assert(receipt.coins === 25, 'Help reduced reward'); return receipt;
  };
  T.replays = async () => {
    const signatures = [], receipts = [];
    for (let n = 0; n < 3; n++) {
      await T.start('lesson009'); signatures.push(T.draft().plan.signature);
      if (n) assert(signatures[n] !== signatures[n - 1], 'Replay repeated previous semantic signature');
      await T.complete(); const receipt = await T.finish(); receipts.push(receipt);
      assert(receipt.coins === (n ? 10 : 25) && receipt.xp === (n ? 3 : 10), 'Replay reward not bounded');
    }
    return {signatures, receipts};
  };
  T.duplicateSequence = async () => {
    for (let n = 0; n < 20; n++) {
      await T.start('lesson009');
      const matches = T.draft().plan.questions.filter(q => q.type === 'sequence' && new Set(q.answer).size < q.answer.length);
      const signature = T.draft().plan.signature;
      await T.complete(); await T.finish();
      if (matches.length) return {attempt: n + 1, signature, questions: matches.map(q => ({answer: q.answer, options: q.options})), distinctIndices: true};
    }
    throw Error('20 genuine UI attempts did not exercise a repeated syllable sequence');
  };
  T.buyItem = async id => {
    await T.go('shop'); await T.click('filter', 'all'); await T.click('item', id);
    await T.wait(() => !!document.querySelector(T.select('buy-confirm', id)), 'Item detail missing');
    await T.click('buy-confirm', id);
    const buy = document.querySelector('#modal ' + T.select('buy', id));
    assert(buy && !buy.disabled, 'Buy confirmation missing');
    buy.click();
    // Failed purchases keep the dialog; successful ones synchronously close it.
    // Clicking a retained stale control must never debit a second time.
    buy.click();
    await T.tick();
  };
  T.purchases = async () => {
    const rows = [];
    for (const item of ORI_REWARDS.items) {
      const before = T.state(); await T.buyItem(item.id); const after = T.state();
      assert(after.coins === before.coins - item.price, 'Wrong price: ' + item.id);
      assert(after.owned.length === before.owned.length + 1 && after.owned.filter(v => v === item.id).length === 1, 'Ownership duplicate/missing: ' + item.id);
      assert(!document.querySelector(T.select('buy-confirm', item.id)), 'Owned item still offers purchase');
      await T.click('equip', item.id); await T.click('equip', item.id);
      assert(T.state().coins === after.coins && JSON.stringify(T.state()) === JSON.stringify(after), 'Equip toggle lost state or charged money: ' + item.id);
      rows.push({id: item.id, price: item.price, coins: after.coins});
    }
    await T.go('room'); await T.images();
    assert(document.querySelectorAll('.owned-row').length === 44, 'Inventory missing purchased items');
    for (const i of ORI_REWARDS.items.filter(i => i.category === 'outfits'))
      assert(T.state().equipment[i.owner + ':' + i.shape] === i.id, 'Equipment missing ' + i.id);
    const theme = ORI_REWARDS.items.filter(i => i.category === 'themes').at(-1);
    assert(T.state().theme === theme.id && getComputedStyle(document.querySelector('.room')).backgroundImage.includes(ORI_ART[theme.id].src), 'Theme not applied to room');
    T.layout('all-owned-room'); return rows;
  };
  T.previews = async () => {
    const before = JSON.stringify(T.state()), rows = [];
    for (const i of ORI_REWARDS.items) {
      await T.go('shop'); await T.click('filter', 'all'); await T.click('item', i.id);
      await T.wait(() => !!document.querySelector(T.select('preview', i.id)), 'Preview detail missing');
      await T.click('preview', i.id); await T.images(document.querySelector('#modal'));
      assert(document.querySelector('.toy-stage').dataset.toy === i.id, 'Wrong preview');
      await T.click('animate', i.id); await T.click('animate', i.id);
      assert(document.querySelector('.toy-object').dataset.animation === (i.category === 'outfits' ? i.shape : i.id), 'Toy did not animate: ' + i.id);
      if (i.id === 'room_crystal_chime') for (const n of [0, 1, 2]) await T.click('note', n);
      T.layout('preview/' + i.id); rows.push(i.id); await T.click('close');
    }
    assert(JSON.stringify(T.state()) === before, 'Free previews mutated saved progress');
    return {count: rows.length, layouts: T.layouts};
  };
  T.parent = async () => {
    await T.go('settings'); assert(!document.querySelector('#startLesson'), 'Ungated settings');
    await T.click('parent'); document.querySelector('#parentAnswer').value = '14'; document.querySelector('#parentForm').requestSubmit(); await T.tick();
    assert(document.querySelector('#modal').open && !document.querySelector('#startLesson'), 'Wrong adult answer granted access');
    document.querySelector('#parentAnswer').value = '15'; document.querySelector('#parentForm').requestSubmit();
    await T.wait(() => !!document.querySelector('#startLesson'), 'Correct adult answer denied');
    const before = T.state(); document.querySelector('#startLesson').value = '62'; await T.click('set-start');
    assert(T.state().settings.startLesson === 62 && T.state().coins === before.coins && T.state().xp === before.xp && JSON.stringify(T.state().stars) === JSON.stringify(before.stars), 'Start selection altered rewards');
    await T.click('motion'); assert(document.body.classList.contains('no-motion') === !T.state().settings.motion, 'Motion toggle DOM mismatch');
    await T.click('sound'); assert(T.state().settings.sound !== before.settings.sound, 'Sound toggle failed'); await T.click('sound');
    return {startLesson: T.state().settings.startLesson};
  };
  T.malformed = async () => {
    const store = ORI_STORE.create(), before = localStorage.getItem('oriRpg3');
    const negative = store.fresh(); negative.coins = -1;
    const duplicate = store.fresh(); duplicate.owned = ['plant', 'plant'];
    const unknown = store.fresh(); unknown.owned = ['unknown_item'];
    const incomplete = store.fresh(); incomplete.draft = {index: 5};
    const raws = ['{', '{}', 'null', '{"__proto__":{}}', JSON.stringify(negative), JSON.stringify(duplicate), JSON.stringify(unknown), JSON.stringify(incomplete)];
    for (const raw of raws) {
      let rejected = false; try { store.import(raw); } catch (_) { rejected = true; }
      assert(rejected, 'Malformed store import accepted: ' + raw);
    }
    const input = document.querySelector('#importFile');
    const transfer = new DataTransfer(); transfer.items.add(new File(['{"coins":-1}'], 'invalid.json', {type: 'application/json'}));
    input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles: true}));
    await T.wait(() => document.querySelector('#toast').textContent.includes('Файл не принят'), 'Malformed UI import not rejected');
    assert(!document.querySelector('#modal').open && localStorage.getItem('oriRpg3') === before, 'Bad import changed saved state/opened confirmation');
    return {storeRejected: raws.length, uiRejected: 1};
  };
  T.run = (name, ...args) => {
    assert(typeof T[name] === 'function' && name !== 'run', 'Unknown test function');
    T.job = {name, done: false};
    Promise.resolve().then(() => T[name](...args)).then(result => { T.job.result = result; T.job.done = true; }, error => { T.job.error = String(error.stack || error); T.job.done = true; });
  };
})();

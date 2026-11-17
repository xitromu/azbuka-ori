'use strict';

// Run with Node: node tools/store_test.js. No packages, browser, or real localStorage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });
for (const file of ['learning.js', 'rewards.js', 'store.js', 'engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'rpg', file), 'utf8'), context, { filename: file });
}
const { ORI_STORE, ORI_LEARNING, ORI_REWARDS } = context.window;
const copy = value => JSON.parse(JSON.stringify(value));
const equal = (actual, expected) => assert.deepEqual(copy(actual), copy(expected));
const KEY = 'oriRpg3';
const OLD = 'oriAlphabet2';
const BACKUP = 'oriAlphabet2.backup.rpg3';
let passed = 0;
function test(name, body) {
  body();
  passed++;
  console.log('ok ' + passed + ' - ' + name);
}
function memory(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data, writes: [], failRead: false, failWrite: false, failKey: null,
    getItem(key) {
      if (this.failRead) throw new Error('read denied');
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      this.writes.push([key, value]);
      if (this.failWrite || key === this.failKey) throw new Error('quota denied');
      data.set(key, String(value));
    }
  };
}
function setup(initial) {
  const storage = memory(initial);
  return { storage, store: ORI_STORE.create(storage) };
}
let serial = 0;
function draft(lessonId = 'lesson006', overrides = {}) {
  const lesson = ORI_LEARNING.lessons.find(l => l.id === lessonId);
  const questions = Array.from({ length: 5 }, (_, i) => ({
    prompt: lesson.sample.prompt + ' ' + i, mode: 'read', mechanic: lesson.mechanics[0],
    answer: lesson.sample.answer, options: copy(lesson.sample.options),
    word: lesson.sample.answer, requiresAdult: false
  }));
  return {
    id: 'attempt-' + ++serial, lessonId, seed: 123, plan: { questions, signature: 'plan-' + serial, version: 1 },
    index: 5, errors: 0, questionErrors: 0, answerCoins: 10, helped: false, adultConfirmed: false,
    results: questions.map(q => ({ completed: true, errors: 0, helped: false, word: q.word, mode: q.mode })),
    game: {}, ...overrides
  };
}
function setErrors(d, values) {
  d.results.forEach((r, i) => { r.errors = values[i]; });
  d.errors = values.reduce((a, b) => a + b, 0);
  d.answerCoins = values.reduce((a, b) => a + (b ? 1 : 2), 0);
}
function setModes(d, modes) {
  modes.forEach((mode, i) => { d.plan.questions[i].mode = mode; d.results[i].mode = mode; });
}

// Derive the migration fixture from the actual shipped v2, not an invented numbering scheme.
const v2 = fs.readFileSync(path.join(root, 'v2.html'), 'utf8');
const lessonBlock = v2.slice(v2.indexOf('const LESSONS=['), v2.indexOf('// Экраны, награды'));
const oldLetters = [...lessonBlock.matchAll(/letterDef\('([^']+)'/g)].map(m => 'letter_' + m[1]);
const oldReading = [...lessonBlock.matchAll(/readDef\('([^']+)'/g)].map(m => m[1]);
const oldGames = [...lessonBlock.matchAll(/id:'(game_[^']+)'/g)].map(m => m[1]);
const giftBlock = v2.slice(v2.indexOf('const GIFTS = ['), v2.indexOf('const THEMES ='));
const oldGifts = [...giftBlock.matchAll(/id:'([^']+)'/g)].map(m => m[1]);
const oldState = {
  coins: 937, stars: Object.fromEntries([...oldLetters, ...oldReading, ...oldGames, 'unknownHistoricalSkill'].map((k, i) => [k, i % 4])),
  gifts: oldGifts, shown: [oldGifts[0], oldGifts[8]], theme: 2, student: 2, sound: false,
  extraOriginalKey: { list: ['keep', 7, false, null], nested: { value: 'original' } }
};
const oldRaw = ' \n' + JSON.stringify(oldState, null, 2) + '\n ';

test('fresh schema, default storage and independent JSON references', () => {
  const { store, storage } = setup();
  context.window.localStorage = storage;
  const a = ORI_STORE.create().load();
  equal(a, {
    schemaVersion: 3, coins: 10, xp: 0, stars: {}, mastered: [], owned: [], shown: [], equipment: {},
    pet: null, theme: null, dream: null, friend: 'alien1', friendship: { alien1: 0, alien2: 0, alien3: 0 },
    album: [], attempts: {}, history: {}, ledger: {}, draft: null,
    settings: { sound: true, motion: true, startLesson: 1 }, quests: []
  });
  a.owned.push('plant');
  a.settings.sound = false;
  assert.equal(store.fresh().owned.length, 0);
  assert.equal(store.fresh().settings.sound, true);
  assert.equal(storage.writes.length, 0);
  const validated = ORI_STORE.validate(a);
  validated.owned.push('lamp');
  assert.equal(a.owned.length, 1);
});

test('exact v2 migration: all letters by title, no invented reading chain', () => {
  assert.equal(oldLetters.length, 33);
  assert.equal(oldGifts.length, 9);
  assert.match(v2, /id:'letter_'\+ch/);
  const { store, storage } = setup({ [OLD]: oldRaw });
  const s = store.load();
  equal(s.legacy, { source: OLD, state: oldState });
  equal(s.owned, oldGifts);
  equal(s.shown, oldState.shown);
  assert.equal(s.coins, 937);
  assert.equal(s.xp, 0);
  assert.equal(s.theme, 2);
  assert.equal(s.friend, 'alien3');
  assert.equal(s.settings.sound, false);
  assert.equal(s.settings.startLesson, 1);
  const expectedStars = {};
  const expectedMastered = [];
  oldLetters.forEach(oldId => {
    const lesson = ORI_LEARNING.lessons.find(l => l.title === 'Буква ' + oldId.slice(7) && l.kind === 'letter');
    assert.ok(lesson, oldId);
    expectedStars[lesson.id] = oldState.stars[oldId];
    if (oldState.stars[oldId] > 0) expectedMastered.push(lesson.id);
  });
  equal(s.stars, expectedStars);
  equal(s.mastered, expectedMastered);
  assert.equal(storage.getItem(OLD), oldRaw);
  assert.equal(storage.getItem(BACKUP), oldRaw);
  equal(storage.writes.map(w => w[0]), [BACKUP, KEY]);
  equal(store.load(), s);
  equal(store.import(store.export(s)), s);
  assert.equal(storage.writes.length, 2);
  s.legacy.state.extraOriginalKey.list.push('changed copy');
  equal(store.load().legacy.state, oldState);
});

test('legacy backup is write-once; v3 takes priority; no old progress means no invented stars', () => {
  const { store, storage } = setup({ [OLD]: oldRaw, [BACKUP]: 'untouched backup' });
  store.load();
  assert.equal(storage.getItem(BACKUP), 'untouched backup');
  assert.equal(storage.writes.length, 1);
  storage.data.set(OLD, '{corrupt');
  assert.equal(store.load().coins, 937);
  const onlyReading = setup({ [OLD]: JSON.stringify({ coins: 0, stars: { blend: 3, firstWords: 3, sentences: 3 } }) }).store.load();
  equal(onlyReading.mastered, []);
  equal(onlyReading.stars, {});
  assert.equal(onlyReading.coins, 0);
});

test('purchase/equipment/pet/theme/dream/claims/start lesson roundtrip uses a single write', () => {
  const { store, storage } = setup();
  const s = store.fresh();
  const bought = ['plant', 'blip_hat', 'puf_cape', 'pet_snail', 'theme_dawn'];
  s.coins = 1000;
  bought.forEach(id => { s.coins -= ORI_REWARDS.items.find(i => i.id === id).price; s.owned.push(id); });
  s.shown = ['plant'];
  s.equipment = { 'alien1:hat': 'blip_hat', 'alien2:cape': 'puf_cape' };
  s.pet = 'pet_snail';
  s.theme = 'theme_dawn';
  s.dream = 'pet_dragon';
  s.quests = ['alien1:3', 'alien2:8'];
  s.settings.startLesson = 95;
  const saved = store.save(s);
  equal(storage.writes.map(w => w[0]), [KEY]);
  equal(store.load(), s);
  equal(store.import(store.export(s)), s);
  saved.equipment['alien1:hat'] = 'kuku_hat';
  assert.equal(s.equipment['alien1:hat'], 'blip_hat');
  equal(s.mastered, []);
  equal(s.stars, {});
});

test('finish counts results, not global helped/counters, and keeps all history', () => {
  const { store, storage } = setup();
  const s = store.fresh();
  s.friend = 'alien2';
  s.history.lesson001 = 'prior-plan';
  s.draft = draft();
  s.draft.helped = true;
  // The UI summary counters are not an authority for minting or stars.
  s.draft.answerCoins = 0;
  s.draft.errors = 100;
  const d = copy(s.draft);
  const r = store.finish(s);
  equal(r, { id: d.id, lessonId: d.lessonId, coins: 25, xp: 10, stars: 3, mastered: true });
  assert.equal(s.coins, 35);
  assert.equal(s.xp, 10);
  assert.equal(s.friendship.alien2, 1);
  assert.equal(s.attempts.lesson006, 1);
  equal(s.history, { lesson001: 'prior-plan', lesson006: d.plan.signature });
  equal(s.album, [d.results[0].word]);
  assert.equal(s.draft, null);
  assert.equal(storage.writes.length, 0);
  r.coins = 0;
  assert.equal(s.ledger[d.id].coins, 25);
});

test('duplicate finish and persisted stale draft never mint twice, even in a new store', () => {
  const { store, storage } = setup();
  const s = store.fresh();
  s.draft = draft();
  const oldDraft = copy(s.draft);
  const r = store.finish(s);
  const after = copy(s);
  equal(store.finish(s), r);
  equal(s, after);
  store.save(s);
  const reopened = ORI_STORE.create(storage);
  const reloaded = reopened.load();
  equal(reopened.finish(reloaded), r);
  equal(reloaded, after);
  reloaded.draft = oldDraft;
  reopened.save(reloaded);
  const pendingDuplicate = reopened.load();
  equal(reopened.finish(pendingDuplicate), r);
  assert.equal(pendingDuplicate.coins, after.coins);
  assert.equal(pendingDuplicate.friendship.alien1, 1);
  assert.equal(pendingDuplicate.attempts.lesson006, 1);
  const receipt = reopened.finish(pendingDuplicate);
  receipt.xp = 999;
  assert.equal(pendingDuplicate.ledger[r.id].xp, 10);
});

test('2/1 answer coins, star thresholds, only incremental star bonus, repeat XP', () => {
  for (const [errors, expectedStars, answerCoins] of [
    [[0, 0, 0, 0, 0], 3, 10], [[1, 0, 0, 0, 0], 3, 9],
    [[2, 0, 0, 0, 0], 2, 9], [[1, 1, 1, 1, 0], 2, 6], [[1, 1, 1, 1, 1], 1, 5]
  ]) {
    const { store } = setup();
    const s = store.fresh();
    s.draft = draft();
    setErrors(s.draft, errors);
    const first = store.finish(s);
    assert.equal(first.stars, expectedStars);
    assert.equal(first.coins, answerCoins + 5 * expectedStars);
    assert.equal(first.xp, 10);
    s.draft = draft();
    const improved = store.finish(s);
    assert.equal(improved.coins, 10 + 5 * (3 - expectedStars));
    assert.equal(improved.xp, 3);
    s.draft = draft();
    setErrors(s.draft, [2, 2, 2, 2, 2]);
    assert.equal(store.finish(s).coins, 5);
    assert.equal(s.stars.lesson006, 3);
    assert.equal(s.attempts.lesson006, 3);
  }
});

test('ordinary mastery needs three unaided read answers OR adult confirmation', () => {
  const { store } = setup();
  for (const [readCount, adult, expected] of [[2, false, false], [3, false, true], [0, true, true]]) {
    const s = store.fresh();
    s.draft = draft('lesson001');
    setModes(s.draft, Array.from({ length: 5 }, (_, i) => i < readCount ? 'read' : i % 2 ? 'memory' : 'listen'));
    s.draft.adultConfirmed = adult;
    const r = store.finish(s);
    assert.equal(r.mastered, expected);
    assert.equal(r.coins, 25);
  }
  const s = store.fresh();
  s.draft = draft();
  s.draft.results.slice(0, 3).forEach(r => { r.helped = true; });
  assert.equal(store.finish(s).mastered, false);
});

test('ANY requiresAdult question gates mastery but never earnings', () => {
  const { store } = setup();
  for (const adult of [false, true]) {
    const s = store.fresh();
    s.draft = draft();
    s.draft.plan.questions[4].requiresAdult = true;
    s.draft.adultConfirmed = adult;
    const r = store.finish(s);
    assert.equal(r.mastered, adult);
    assert.equal(r.coins, 25);
  }
});

test('story mastery uses distinct independent question signatures, not repeated answers', () => {
  const { store } = setup();
  for (const [distinct, helped, adultRequired, adult, expected] of [
    [1, false, false, false, false], [2, false, false, false, true],
    [2, true, false, true, false], [2, false, true, false, false], [2, false, true, true, true]
  ]) {
    const s = store.fresh();
    s.draft = draft('lesson101');
    s.draft.plan.questions.forEach((q, i) => { q.prompt = 'Question ' + (i % distinct); q.requiresAdult = adultRequired; });
    s.draft.results.forEach(r => { r.helped = helped; });
    s.draft.adultConfirmed = adult;
    assert.equal(store.finish(s).mastered, expected);
  }
  const s = store.fresh();
  s.draft = draft('lesson101');
  s.draft.plan.questions.forEach(q => { q.signature = 'same-question'; });
  assert.equal(store.finish(s).mastered, false);
});

test('chapter completion is a one-time mastered transition, no extra money/stars', () => {
  const { store } = setup();
  const s = store.fresh();
  s.mastered = ORI_LEARNING.lessons.filter(l => l.chapter === 'chapter1' && l.id !== 'lesson009').map(l => l.id);
  s.draft = draft('lesson009');
  assert.equal(store.finish(s).chapterCompleted, 'chapter1');
  assert.equal(s.coins, 35);
  equal(Object.keys(s.stars), ['lesson009']);
  s.draft = draft('lesson009');
  assert.equal(store.finish(s).chapterCompleted, undefined);
});

test('pending drafts roundtrip exactly at every question index; incomplete finish throws unchanged', () => {
  const { store } = setup();
  for (let i = 0; i <= 5; i++) {
    const s = store.fresh();
    s.draft = draft();
    s.draft.index = i;
    s.draft.results = s.draft.results.slice(0, i);
    s.draft.answerCoins = i * 2;
    s.draft.game = { flipped: [1, 2], matched: [], phase: 'waiting', nested: { selected: null } };
    const before = copy(s);
    store.save(s);
    equal(store.load(), before);
    const imported = store.import(store.export(s));
    equal(imported, before);
    imported.draft.game.flipped.push(3);
    equal(s.draft.game.flipped, [1, 2]);
    if (i < 5) { assert.throws(() => store.finish(s), /unfinished draft/); equal(s, before); }
    else assert.equal(store.finish(s).coins, 25);
  }
});

test('malformed draft imports are rejected, never discarded or auto-finished', () => {
  const { store, storage } = setup();
  const mutations = [
    d => { d.index = 6; }, d => { d.results.pop(); }, d => { d.results[0].completed = false; },
    d => { d.results[0].errors = -1; }, d => { d.results[0].helped = 'false'; },
    d => { d.plan.questions.pop(); }, d => { d.plan.questions[0].requiresAdult = 1; },
    d => { d.plan.questions[0].mode = 'cheat'; }, d => { d.plan.questions[0].mechanic = 'unknown'; },
    d => { d.plan.questions[0].lessonId = 'lesson999'; }, d => { d.plan.questions[0].options = []; },
    d => { d.results[0].mode = 'listen'; }, d => { d.plan.signature = ''; }, d => { d.game = []; },
    d => { d.lessonId = 'lesson999'; }, d => { d.id = '__proto__'; }, d => { d.adultConfirmed = 'yes'; }
  ];
  mutations.forEach(mutate => {
    const s = store.fresh();
    s.draft = draft();
    mutate(s.draft);
    assert.throws(() => store.import(JSON.stringify(s)), /ORI_STORE/);
    assert.throws(() => store.finish(s), /ORI_STORE/);
  });
  assert.equal(storage.writes.length, 0);
});

test('strict schema/import rejects unknown IDs, invalid ownership, nonfinite and negative balances', () => {
  const { store, storage } = setup();
  const mutations = [
    s => { s.coins = -1; }, s => { s.coins = 0.5; }, s => { s.coins = NaN; }, s => { s.xp = Infinity; },
    s => { s.schemaVersion = 2; }, s => { delete s.quests; }, s => { s.surprise = true; },
    s => { s.stars.lesson999 = 3; }, s => { s.stars.lesson001 = 4; },
    s => { s.mastered = ['blend']; }, s => { s.owned = ['not-an-item']; }, s => { s.shown = ['plant']; },
    s => { s.owned = ['plant', 'plant']; }, s => { s.friend = 'ori'; }, s => { s.friendship.alien4 = 1; },
    s => { s.attempts.lesson001 = -1; }, s => { s.history.lesson999 = 'x'; },
    s => { s.theme = 4; }, s => { s.pet = 'plant'; }, s => { s.dream = 'fake'; },
    s => { s.owned = ['blip_hat']; s.equipment['alien2:hat'] = 'blip_hat'; },
    s => { s.equipment['alien1:hat'] = 'blip_hat'; }, s => { s.settings.startLesson = 105; },
    s => { s.settings.sound = 1; }, s => { s.quests = ['__proto__']; },
    s => { s.ledger.attempt = { id: 'wrong', lessonId: 'lesson001', coins: 25, xp: 10, stars: 3, mastered: false }; }
  ];
  mutations.forEach(mutate => {
    const s = store.fresh();
    mutate(s);
    assert.throws(() => ORI_STORE.validate(s), /ORI_STORE/);
    assert.throws(() => store.save(s), /ORI_STORE/);
    assert.throws(() => store.import(JSON.stringify(s)), /ORI_STORE/);
  });
  for (const raw of ['null', '[]', '{}', '{broken', 'NaN', '1', '"string"']) assert.throws(() => store.import(raw));
  assert.equal(storage.writes.length, 0);
});

test('prototype pollution, executable/non-JSON objects, sparse arrays and excessive nesting rejected', () => {
  const { store } = setup();
  const base = store.export(store.fresh());
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    assert.throws(() => store.import(base.slice(0, -1) + ',"' + key + '":{"polluted":true}}'), /unsafe key/);
    const s = store.fresh();
    s.draft = draft();
    s.draft.game = JSON.parse('{"nested":{"' + key + '":true}}');
    assert.throws(() => store.save(s), /unsafe key/);
  }
  const bad = [undefined, () => {}, Symbol('x'), 1n, new Date(), Object.create({ inherited: true }), Object.create(Object.create(null))];
  for (const value of bad) {
    const s = store.fresh();
    s.draft = draft();
    s.draft.game.value = value;
    assert.throws(() => store.save(s), /ORI_STORE/);
  }
  let called = false;
  const s = store.fresh();
  Object.defineProperty(s, 'coins', { enumerable: true, get() { called = true; return 10; } });
  assert.throws(() => store.save(s), /JSON property/);
  assert.equal(called, false);
  const cyclic = store.fresh();
  cyclic.draft = draft();
  cyclic.draft.game.self = cyclic.draft.game;
  assert.throws(() => store.save(cyclic), /cyclic/);
  const sparse = store.fresh();
  sparse.album = new Array(2);
  assert.throws(() => store.save(sparse), /dense JSON array/);
  let deep = {};
  for (let i = 0; i < 70; i++) deep = { child: deep };
  const nested = store.fresh();
  nested.draft = draft();
  nested.draft.game = deep;
  assert.throws(() => store.save(nested), /complexity/);
  assert.equal({}.polluted, undefined);
});

test('2MB input byte limit applies before parsing, including multi-byte text', () => {
  const { store } = setup();
  const valid = store.export(store.fresh());
  equal(store.import(valid + ' '.repeat(2 * 1024 * 1024 - Buffer.byteLength(valid))), store.fresh());
  assert.throws(() => store.import(valid + ' '.repeat(2 * 1024 * 1024)), /size/);
  assert.throws(() => store.import('"' + 'я'.repeat(1024 * 1024) + '"'), /size/);
});

test('storage failures propagate and leave committed balances/receipts together', () => {
  const { store, storage } = setup();
  const s = store.fresh();
  store.save(s);
  const committed = storage.getItem(KEY);
  s.draft = draft();
  store.finish(s);
  storage.failWrite = true;
  assert.throws(() => store.save(s), /quota denied/);
  assert.equal(storage.getItem(KEY), committed);
  assert.equal(s.coins, 35); // UI must block/retry the commit, not call rewards again.
  assert.equal(store.finish(s).coins, 25);
  storage.failWrite = false;
  store.save(s);
  equal(store.load(), s);
  storage.failRead = true;
  assert.throws(() => store.load(), /read denied/);
});

test('corrupt current/legacy saves never reset progress or overwrite backups', () => {
  for (const initial of [{ [KEY]: '{broken', [OLD]: oldRaw }, { [OLD]: '{broken' }, { [KEY]: '' }]) {
    const { store, storage } = setup(initial);
    assert.throws(() => store.load());
    assert.equal(storage.writes.length, 0);
    equal(Object.fromEntries(storage.data), initial);
  }
  for (const failKey of [BACKUP, KEY]) {
    const { store, storage } = setup({ [OLD]: oldRaw });
    storage.failKey = failKey;
    assert.throws(() => store.load(), /quota denied/);
    assert.equal(storage.getItem(OLD), oldRaw);
    assert.equal(storage.getItem(KEY), null);
    storage.failKey = null;
    assert.equal(store.load().coins, 937);
    assert.equal(storage.getItem(BACKUP), oldRaw);
  }
});

test('finish overflow or invalid state fails before any mutation', () => {
  const { store } = setup();
  for (const field of ['coins', 'xp']) {
    const s = store.fresh();
    s[field] = Number.MAX_SAFE_INTEGER;
    s.draft = draft();
    const before = copy(s);
    assert.throws(() => store.finish(s), /ORI_STORE/);
    equal(s, before);
  }
  assert.throws(() => store.finish(store.fresh()), /no completed draft/);
});

test('real engine/UI integration: every lesson, five seeds, all partial drafts, no double attempt count', () => {
  const engine = context.window.ORI_ENGINE;
  let plans = 0;
  const types = new Set();
  for (const lesson of ORI_LEARNING.lessons) {
    for (let seed = 0; seed < 5; seed++) {
      const { store } = setup();
      const s = store.fresh();
      s.attempts[lesson.id] = 7; // app.js has reserved this number before creating the draft.
      const plan = engine.plan(lesson.id, seed);
      s.draft = draft(lesson.id, { seed, plan, index: 0, results: [], answerCoins: 0 });
      for (let i = 0; i < 5; i++) {
        const q = plan.questions[i];
        types.add(q.type);
        const g = { selected: [], matched: [], open: [], done: false, helped: false, errors: 0, feedback: '' };
        s.draft.game = g;
        store.save(s);
        equal(store.load(), s);
        if (q.type === 'memory') g.matched = q.options.map((_, n) => n);
        else if (q.type === 'sequence') {
          const remaining = q.options.map((_, n) => n);
          g.selected = q.answer.map(part => {
            const j = remaining.findIndex(n => q.options[n] === part);
            return remaining.splice(j, 1)[0];
          });
        } else g.selected = q.correct.slice();
        g.done = true;
        store.save(s); // The UI saves the solved game BEFORE recording the result.
        s.draft.results.push({ completed: true, errors: g.errors, helped: g.helped, word: q.word || '',
          mode: q.mode, prompt: q.prompt, signature: JSON.stringify([q.mechanic, q.target, q.prompt, q.text]) });
        s.draft.answerCoins += 2;
        s.draft.index++;
        s.draft.game = {};
        equal(store.import(store.export(s)), s);
      }
      s.draft.adultConfirmed = true;
      const r = store.finish(s);
      assert.equal(r.mastered, true, lesson.id + ', seed ' + seed);
      assert.equal(s.attempts[lesson.id], 7);
      assert.equal(r.coins, 25);
      store.save(s);
      equal(store.finish(store.load()), r);
      plans++;
    }
  }
  equal([...types].sort(), ['choice', 'many', 'memory', 'sequence']);
  assert.equal(plans, 520);
});

test('real story repeats with different prompts still count as ONE independent question', () => {
  const { store } = setup();
  const s = store.fresh();
  const plan = context.window.ORI_ENGINE.plan('lesson101', 42);
  s.draft = draft('lesson101', { plan });
  const repeatedId = plan.questions[4].questionId;
  s.draft.results = plan.questions.map(q => ({ completed: true, errors: 0,
    helped: q.questionId !== repeatedId, mode: q.mode, word: q.word || '' }));
  assert.equal(s.draft.results.filter(r => !r.helped).length, 2);
  s.draft.adultConfirmed = true;
  assert.equal(store.finish(s).mastered, false);
});

test('typed engine plans and UI game states reject malformed resumptions', () => {
  const { store } = setup();
  for (const mutate of [
    q => { q.correct = [999]; }, q => { q.type = 'fake'; }, q => { delete q.options; },
    q => { q.requiresAdult = 'no'; }, q => { q.questionId = 'lesson101:unknown'; }
  ]) {
    const s = store.fresh();
    s.draft = draft('lesson101', { plan: context.window.ORI_ENGINE.plan('lesson101', 1), index: 0, results: [] });
    mutate(s.draft.plan.questions[0]);
    assert.throws(() => store.import(JSON.stringify(s)), /ORI_STORE/);
  }
  for (const game of [{ selected: 'bad' }, { open: [-1] }, { selected: [99] }, { done: 'yes' },
    { helped: null }, { errors: -1 }, { done: true, selected: [] }]) {
    const s = store.fresh();
    s.draft = draft('lesson101', { plan: context.window.ORI_ENGINE.plan('lesson101', 1), index: 0, results: [], game });
    assert.throws(() => store.import(JSON.stringify(s)), /ORI_STORE/);
  }
  const s = store.fresh();
  s.quests = ['unknown-claim'];
  assert.throws(() => store.import(JSON.stringify(s)), /ORI_STORE/);
});

console.log('PASS: ' + passed + ' store tests');

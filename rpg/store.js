(function (root) {
  'use strict';

  const KEY = 'oriRpg3';
  const OLD_KEY = 'oriAlphabet2';
  const BACKUP_KEY = 'oriAlphabet2.backup.rpg3';
  const MAX_BYTES = 2 * 1024 * 1024;
  const FRIENDS = ['alien1', 'alien2', 'alien3'];
  const LEGACY_GIFTS = ['plant', 'garland', 'lamp', 'holo', 'confetti', 'fireworks', 'music', 'robot', 'paint'];
  // v2.html letterDef uses these literal IDs, NOT lesson positions or reading skills.
  const LEGACY_LETTERS = {
    'letter_А': 'Буква А', 'letter_О': 'Буква О', 'letter_У': 'Буква У',
    'letter_Ы': 'Буква Ы', 'letter_Э': 'Буква Э', 'letter_М': 'Буква М',
    'letter_Н': 'Буква Н', 'letter_Л': 'Буква Л', 'letter_Р': 'Буква Р',
    'letter_С': 'Буква С', 'letter_Т': 'Буква Т', 'letter_Д': 'Буква Д',
    'letter_П': 'Буква П', 'letter_Б': 'Буква Б', 'letter_К': 'Буква К',
    'letter_Г': 'Буква Г', 'letter_И': 'Буква И', 'letter_Е': 'Буква Е',
    'letter_Ё': 'Буква Ё', 'letter_Ю': 'Буква Ю', 'letter_Я': 'Буква Я',
    'letter_З': 'Буква З', 'letter_Ф': 'Буква Ф', 'letter_В': 'Буква В',
    'letter_Х': 'Буква Х', 'letter_Й': 'Буква Й', 'letter_Ш': 'Буква Ш',
    'letter_Ж': 'Буква Ж', 'letter_Ч': 'Буква Ч', 'letter_Щ': 'Буква Щ',
    'letter_Ц': 'Буква Ц', 'letter_Ь': 'Буква Ь', 'letter_Ъ': 'Буква Ъ'
  };
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const check = (ok, path) => { if (!ok) throw new Error('ORI_STORE: invalid ' + path); };
  const integer = (v, path, max = Number.MAX_SAFE_INTEGER) => check(Number.isSafeInteger(v) && v >= 0 && v <= max, path);
  const text = (v, path, max = 4096, empty = false) => check(typeof v === 'string' && (empty || v.length > 0) && v.length <= max, path);
  const boolean = (v, path) => check(typeof v === 'boolean', path);
  const object = (v, path) => check(v !== null && typeof v === 'object' && !Array.isArray(v), path);
  const id = (v, path) => {
    text(v, path, 160);
    check(/^[a-zA-Z0-9_.:-]+$/.test(v) && !['__proto__', 'constructor', 'prototype'].includes(v), path);
  };
  function keys(v, required, optional, path) {
    object(v, path);
    check(required.every(k => has(v, k)), path + ' missing field');
    check(Object.keys(v).every(k => required.includes(k) || optional.includes(k)), path + ' unknown field');
  }
  function list(v, test, path) {
    check(Array.isArray(v), path);
    check(new Set(v).size === v.length, path + ' duplicates');
    v.forEach((x, i) => test(x, path + '[' + i + ']'));
  }
  function size(raw) {
    check(typeof raw === 'string' && raw.length <= MAX_BYTES, 'JSON size (2MB maximum)');
    let bytes = 0;
    for (const ch of raw) {
      const n = ch.codePointAt(0);
      bytes += n < 128 ? 1 : n < 2048 ? 2 : n < 65536 ? 3 : 4;
      check(bytes <= MAX_BYTES, 'JSON size (2MB maximum)');
    }
  }
  // Inspect before stringify: JSON must not silently turn NaN into null, invoke getters,
  // drop undefined, accept a custom prototype, or execute toJSON. Also bound nesting/work.
  function jsonCopy(value) {
    const active = new Set();
    let nodes = 0;
    let characters = 0;
    function spend(n) {
      characters += n;
      check(characters <= MAX_BYTES, 'JSON size (2MB maximum)');
    }
    function visit(v, depth) {
      check(++nodes <= 100000 && depth <= 64, 'JSON complexity');
      spend(1);
      if (v === null || typeof v === 'boolean') return;
      if (typeof v === 'string') { spend(v.length); return; }
      if (typeof v === 'number') { check(Number.isFinite(v), 'finite number'); return; }
      check(typeof v === 'object', 'JSON value');
      check(!active.has(v), 'cyclic JSON');
      const proto = Object.getPrototypeOf(v);
      const ctor = proto && Object.getOwnPropertyDescriptor(proto, 'constructor');
      check(Array.isArray(v) ? proto === Array.prototype || (proto && Array.isArray(proto)) :
        proto === null || (Object.getPrototypeOf(proto) === null && ctor &&
          typeof ctor.value === 'function' && ctor.value.name === 'Object'), 'plain JSON object');
      active.add(v);
      const names = Reflect.ownKeys(v);
      if (Array.isArray(v)) check(names.length === v.length + 1, 'dense JSON array');
      for (const k of names) {
        if (Array.isArray(v) && k === 'length') continue;
        check(typeof k === 'string' && !['__proto__', 'constructor', 'prototype'].includes(k), 'unsafe key');
        spend(k.length);
        if (Array.isArray(v)) check(/^(0|[1-9][0-9]*)$/.test(k) && Number(k) < v.length, 'array key');
        const d = Object.getOwnPropertyDescriptor(v, k);
        check(has(d, 'value') && d.enumerable, 'JSON property');
        visit(d.value, depth + 1);
      }
      active.delete(v);
    }
    visit(value, 0);
    const raw = JSON.stringify(value);
    size(raw);
    return JSON.parse(raw);
  }
  function parse(raw) {
    size(raw);
    return jsonCopy(JSON.parse(raw));
  }
  function catalog() {
    check(root.ORI_LEARNING && Array.isArray(root.ORI_LEARNING.lessons), 'learning catalog');
    check(root.ORI_REWARDS && Array.isArray(root.ORI_REWARDS.items), 'rewards catalog');
    const lessons = new Map(root.ORI_LEARNING.lessons.map(l => [l.id, l]));
    const items = new Map(root.ORI_REWARDS.items.map(i => [i.id, i]));
    const chapters = new Set(root.ORI_LEARNING.chapters.map(c => c.id));
    const mechanics = new Set(root.ORI_LEARNING.lessons.flatMap(l => l.mechanics));
    return { lessons, items, chapters, mechanics };
  }
  function fresh() {
    return {
      schemaVersion: 3, coins: 10, xp: 0, stars: {}, mastered: [], owned: [], shown: [],
      equipment: {}, pet: null, theme: null, dream: null, friend: 'alien1',
      friendship: { alien1: 0, alien2: 0, alien3: 0 }, album: [], attempts: {},
      history: {}, ledger: {}, draft: null,
      settings: { sound: true, motion: true, startLesson: 1 }, quests: []
    };
  }
  function validateDraft(d, c) {
    keys(d, ['id', 'lessonId', 'seed', 'plan', 'index', 'errors', 'questionErrors', 'answerCoins',
      'helped', 'adultConfirmed', 'results', 'game'], [], 'draft');
    id(d.id, 'draft.id');
    check(c.lessons.has(d.lessonId), 'draft.lessonId');
    if (typeof d.seed === 'number') integer(d.seed, 'draft.seed');
    else text(d.seed, 'draft.seed', 160);
    integer(d.index, 'draft.index', 5);
    integer(d.errors, 'draft.errors');
    integer(d.questionErrors, 'draft.questionErrors');
    integer(d.answerCoins, 'draft.answerCoins', 10);
    boolean(d.helped, 'draft.helped');
    boolean(d.adultConfirmed, 'draft.adultConfirmed');
    object(d.game, 'draft.game'); // Mechanic-specific JSON belongs to the engine, not the store.
    keys(d.plan, ['questions', 'signature', 'version'], [], 'draft.plan');
    text(d.plan.signature, 'draft.plan.signature', 32768);
    if (typeof d.plan.version === 'number') integer(d.plan.version, 'draft.plan.version');
    else text(d.plan.version, 'draft.plan.version', 80);
    check(Array.isArray(d.plan.questions) && d.plan.questions.length === 5, 'draft questions (five required)');
    d.plan.questions.forEach(q => {
      keys(q, ['prompt', 'mode'], ['type', 'mechanic', 'text', 'target', 'options', 'audio',
        'requiresAdult', 'correct', 'answer', 'word', 'questionId', 'signature', 'id', 'lessonId'], 'question');
      text(q.prompt, 'question.prompt', 16384);
      check(['read', 'listen', 'memory', 'help'].includes(q.mode), 'question.mode');
      if (has(q, 'requiresAdult')) boolean(q.requiresAdult, 'question.requiresAdult');
      if (has(q, 'signature')) text(q.signature, 'question.signature', 4096);
      if (has(q, 'id')) id(q.id, 'question.id');
      if (has(q, 'questionId')) {
        text(q.questionId, 'question.questionId', 160);
        const lesson = c.lessons.get(d.lessonId);
        const suffixes = lesson.kind === 'story' ? ['a', 'b', 'c', 'd'] :
          lesson.kind === 'sentence' ? lesson.pool.map((_, i) => String(i)) :
          lesson.id === 'lesson088' ? lesson.pool : [];
        check(suffixes.some(suffix => q.questionId === lesson.id + ':' + suffix), 'question.questionId');
      }
      if (has(q, 'lessonId')) check(q.lessonId === d.lessonId, 'question.lessonId');
      // The engine uses safe fallback mechanics outside a lesson's preferred list.
      if (has(q, 'mechanic')) check(c.mechanics.has(q.mechanic), 'question.mechanic');
      for (const field of ['word', 'text', 'target', 'audio']) {
        if (has(q, field)) text(q[field], 'question.' + field, 16384, true);
      }
      if (has(q, 'options')) {
        check(Array.isArray(q.options) && q.options.length >= 1 && q.options.length <= 40, 'question.options length');
        q.options.forEach(v => text(v, 'question.option', 4096)); // Duplicates are intentional in memory/sequence/many.
      }
      if (has(q, 'answer')) {
        if (Array.isArray(q.answer)) {
          check(q.answer.length > 0 && q.answer.length <= 40, 'question.answer length');
          q.answer.forEach(v => text(v, 'question.answer part', 4096));
          check(Array.isArray(q.options) && JSON.stringify(q.answer.slice().sort()) ===
            JSON.stringify(q.options.slice().sort()), 'question.answer tiles');
        } else {
          text(q.answer, 'question.answer', 4096);
          if (has(q, 'options')) check(q.options.includes(q.answer), 'question.answer option');
        }
      }
      if (has(q, 'correct')) {
        check(Array.isArray(q.options), 'question.correct options');
        list(q.correct, v => integer(v, 'question.correct index', q.options.length - 1), 'question.correct');
        check(q.correct.length > 0, 'question.correct empty');
      }
      if (has(q, 'type')) {
        check(['choice', 'many', 'sequence', 'memory'].includes(q.type), 'question.type');
        check(['mechanic', 'text', 'target', 'options', 'audio', 'requiresAdult'].every(k => has(q, k)), 'typed question fields');
        if (q.type === 'choice' || q.type === 'many') {
          check(Array.isArray(q.correct) && !has(q, 'answer'), 'choice/many answer');
          if (q.type === 'choice') check(q.correct.length === 1, 'choice answer count');
        } else if (q.type === 'sequence') {
          check(Array.isArray(q.answer) && !has(q, 'correct'), 'sequence answer');
        } else {
          check(!has(q, 'answer') && !has(q, 'correct') && q.options.length % 2 === 0, 'memory pairs');
          const counts = new Map();
          q.options.forEach(v => { const key = v.toLocaleLowerCase('ru'); counts.set(key, (counts.get(key) || 0) + 1); });
          check([...counts.values()].every(n => n % 2 === 0), 'memory matching pairs');
        }
      }
    });
    check(Array.isArray(d.results) && d.results.length === d.index, 'draft.results/index');
    d.results.forEach((r, i) => {
      keys(r, ['completed', 'errors', 'helped', 'word', 'mode'], ['prompt', 'signature'], 'result');
      check(r.completed === true, 'result.completed');
      integer(r.errors, 'result.errors');
      boolean(r.helped, 'result.helped');
      text(r.word, 'result.word', 4096, true);
      check(r.mode === d.plan.questions[i].mode, 'result.mode');
      if (has(r, 'prompt')) text(r.prompt, 'result.prompt', 16384);
      if (has(r, 'signature')) text(r.signature, 'result.signature', 32768);
    });
    const current = d.plan.questions[Math.min(d.index, 4)];
    for (const field of ['selected', 'matched', 'open']) {
      if (has(d.game, field)) list(d.game[field], v => integer(v, 'game.' + field,
        (current.options || []).length - 1), 'game.' + field);
    }
    for (const field of ['done', 'helped']) if (has(d.game, field)) boolean(d.game[field], 'game.' + field);
    if (has(d.game, 'errors')) integer(d.game.errors, 'game.errors');
    if (has(d.game, 'feedback')) text(d.game.feedback, 'game.feedback', 4096, true);
    if (d.game.done && current.type) {
      const g = d.game;
      if (current.type === 'memory') check(Array.isArray(g.matched) && g.matched.length === current.options.length, 'game incomplete memory');
      else if (current.type === 'sequence') check(Array.isArray(g.selected) &&
        g.selected.length === current.answer.length && g.selected.every((v, i) => current.options[v] === current.answer[i]), 'game incomplete sequence');
      else check(Array.isArray(g.selected) && g.selected.length === current.correct.length &&
        current.correct.every(v => g.selected.includes(v)), 'game incomplete choice');
    }
  }
  // Returns a detached plain JSON state; never fixes malformed imports behind the UI's back.
  function validate(value) {
    const s = jsonCopy(value);
    const c = catalog();
    keys(s, Object.keys(fresh()), ['legacy'], 'state');
    check(s.schemaVersion === 3, 'schemaVersion');
    integer(s.coins, 'coins');
    integer(s.xp, 'xp');
    const lessonId = (v, p) => check(c.lessons.has(v), p);
    const itemId = (v, p) => check(c.items.has(v), p);
    for (const field of ['stars', 'attempts', 'history']) {
      object(s[field], field);
      Object.entries(s[field]).forEach(([k, v]) => {
        lessonId(k, field + ' lessonId');
        if (field === 'history') text(v, 'history signature', 32768);
        else integer(v, field, field === 'stars' ? 3 : Number.MAX_SAFE_INTEGER);
      });
    }
    list(s.mastered, lessonId, 'mastered');
    list(s.owned, itemId, 'owned');
    list(s.shown, (v, p) => { itemId(v, p); check(s.owned.includes(v), p + ' not owned'); }, 'shown');
    object(s.equipment, 'equipment');
    Object.entries(s.equipment).forEach(([slot, v]) => {
      itemId(v, 'equipment item');
      const item = c.items.get(v);
      check(item.category === 'outfits' && slot === item.owner + ':' + item.shape && s.owned.includes(v), 'equipment slot/ownership');
    });
    for (const field of ['pet', 'theme', 'dream']) {
      const v = s[field];
      if (v === null) continue;
      // v2 paint has four numeric palettes; keep the exact selection, including hidden paint.
      if (field === 'theme' && typeof v === 'number') { integer(v, 'theme palette', 3); continue; }
      itemId(v, field);
      if (field !== 'dream') {
        check(s.owned.includes(v), field + ' not owned');
        check(c.items.get(v).category === (field === 'pet' ? 'pets' : 'themes'), field + ' category');
      }
    }
    check(FRIENDS.includes(s.friend), 'friend');
    keys(s.friendship, FRIENDS, [], 'friendship');
    FRIENDS.forEach(f => integer(s.friendship[f], 'friendship.' + f));
    list(s.album, (v, p) => text(v, p, 4096), 'album');
    // app.js claims one friendship postcard at each of these three milestones.
    list(s.quests, (v, p) => check(FRIENDS.some(f => [3, 8, 15].some(n => v === f + ':' + n)), p), 'quests');
    keys(s.settings, ['sound', 'motion', 'startLesson'], [], 'settings');
    boolean(s.settings.sound, 'settings.sound');
    boolean(s.settings.motion, 'settings.motion');
    check([...c.lessons.values()].some(l => l.number === s.settings.startLesson), 'settings.startLesson');
    object(s.ledger, 'ledger');
    Object.entries(s.ledger).forEach(([key, r]) => {
      id(key, 'ledger id');
      keys(r, ['id', 'lessonId', 'coins', 'xp', 'stars', 'mastered'], ['chapterCompleted'], 'receipt');
      check(r.id === key, 'receipt.id');
      lessonId(r.lessonId, 'receipt.lessonId');
      integer(r.coins, 'receipt.coins', 25);
      check(r.coins >= 5, 'receipt.coins minimum');
      check(r.xp === 10 || r.xp === 3, 'receipt.xp');
      integer(r.stars, 'receipt.stars', 3);
      check(r.stars > 0, 'receipt.stars minimum');
      boolean(r.mastered, 'receipt.mastered');
      if (has(r, 'chapterCompleted')) check(c.chapters.has(r.chapterCompleted) &&
        c.lessons.get(r.lessonId).chapter === r.chapterCompleted, 'receipt.chapterCompleted');
      check((s.stars[r.lessonId] || 0) >= r.stars, 'receipt/stars');
      if (r.mastered) check(s.mastered.includes(r.lessonId), 'receipt/mastered');
    });
    if (s.draft !== null) {
      validateDraft(s.draft, c);
      if (has(s.ledger, s.draft.id)) check(s.ledger[s.draft.id].lessonId === s.draft.lessonId, 'draft/receipt lesson');
    }
    if (has(s, 'legacy')) {
      keys(s.legacy, ['source', 'state'], [], 'legacy');
      check(s.legacy.source === OLD_KEY, 'legacy.source');
      object(s.legacy.state, 'legacy.state');
    }
    return s;
  }
  function migrate(raw) {
    const old = parse(raw);
    object(old, 'legacy state');
    const s = fresh();
    const c = catalog();
    if (has(old, 'coins')) { integer(old.coins, 'legacy coins'); s.coins = old.coins; }
    if (has(old, 'gifts')) {
      list(old.gifts, (v, p) => check(LEGACY_GIFTS.includes(v), p), 'legacy gifts');
      s.owned = old.gifts.slice();
    }
    if (has(old, 'shown')) {
      list(old.shown, (v, p) => check(LEGACY_GIFTS.includes(v), p), 'legacy shown');
      s.shown = old.shown.filter(v => s.owned.includes(v));
    }
    if (has(old, 'theme')) { integer(old.theme, 'legacy theme', 3); s.theme = old.theme; }
    if (has(old, 'student')) { integer(old.student, 'legacy student', 2); s.friend = FRIENDS[old.student]; }
    if (has(old, 'sound')) { boolean(old.sound, 'legacy sound'); s.settings.sound = old.sound; }
    if (has(old, 'stars')) {
      object(old.stars, 'legacy stars');
      Object.entries(old.stars).forEach(([oldId, stars]) => {
        integer(stars, 'legacy stars.' + oldId, 3);
        if (!has(LEGACY_LETTERS, oldId)) return;
        const lesson = [...c.lessons.values()].find(l => l.kind === 'letter' && l.title === LEGACY_LETTERS[oldId]);
        check(lesson, 'legacy letter mapping ' + oldId);
        s.stars[lesson.id] = stars;
        if (stars > 0) s.mastered.push(lesson.id);
      });
    }
    // Preserve ALL original keys/stars, including reading skills and minigames. They do not
    // prove the new reading curriculum. An adult chooses startLesson; no inferred chain.
    s.legacy = { source: OLD_KEY, state: old };
    return validate(s);
  }
  function finish(state) {
    const s = validate(state);
    if (s.draft === null) {
      const receipts = Object.values(s.ledger);
      check(receipts.length > 0, 'no completed draft');
      return jsonCopy(receipts[receipts.length - 1]); // Safe repeated click, including after reload.
    }
    const d = s.draft;
    if (has(s.ledger, d.id)) return jsonCopy(s.ledger[d.id]);
    check(d.index === 5 && d.results.length === 5 && d.results.every(r => r.completed), 'unfinished draft');
    const c = catalog();
    const lesson = c.lessons.get(d.lessonId);
    const errors = d.results.reduce((n, r) => n + r.errors, 0);
    integer(errors, 'total errors');
    const stars = errors <= 1 ? 3 : errors <= 4 ? 2 : 1;
    const previousStars = s.stars[d.lessonId] || 0;
    const coins = d.results.reduce((n, r) => n + (r.errors === 0 ? 2 : 1), 0) + 5 * Math.max(0, stars - previousStars);
    const finishedCount = Object.values(s.ledger).filter(r => r.lessonId === d.lessonId).length;
    const repeat = previousStars > 0 || finishedCount > 0;
    const xp = repeat ? 3 : 10;
    const independent = d.results.map((r, i) => ({ r, q: d.plan.questions[i] }))
      .filter(({ r }) => r.mode === 'read' && r.helped === false);
    const adultOK = !d.plan.questions.some(q => q.requiresAdult === true) || d.adultConfirmed;
    // Global helped never discounts money. Adult confirmation can establish reading in a
    // mixed letter/memory/listen lesson. Stories still need TWO different independent answers.
    const mastered = adultOK && (lesson.kind === 'story' ?
      new Set(independent.map(({ q }) => q.questionId || q.signature ||
        q.prompt.replace(/^Повтор для закрепления\.\s*/, ''))).size >= 2 :
      d.adultConfirmed || independent.length >= 3);
    const chapterLessons = [...c.lessons.values()].filter(l => l.chapter === lesson.chapter);
    const chapterWasComplete = chapterLessons.every(l => s.mastered.includes(l.id));
    s.coins += coins;
    s.xp += xp;
    s.stars[d.lessonId] = Math.max(previousStars, stars);
    if (mastered && !s.mastered.includes(d.lessonId)) s.mastered.push(d.lessonId);
    // UI reserves attempt numbers on START, including abandoned attempts. Do not count it
    // twice at finish; only supply the completed-attempt floor for callers without reservation.
    s.attempts[d.lessonId] = Math.max(s.attempts[d.lessonId] || 0, finishedCount + 1);
    s.history[d.lessonId] = d.plan.signature;
    s.friendship[s.friend] += 1;
    d.results.forEach(r => { if (r.word && !s.album.includes(r.word)) s.album.push(r.word); });
    const receipt = { id: d.id, lessonId: d.lessonId, coins, xp, stars, mastered };
    if (!chapterWasComplete && chapterLessons.every(l => s.mastered.includes(l.id))) receipt.chapterCompleted = lesson.chapter;
    s.ledger[d.id] = receipt;
    s.draft = null;
    const next = validate(s); // Overflow/size errors must not leave a half-awarded state.
    Object.assign(state, next);
    return jsonCopy(receipt);
  }
  function create(storage = root.localStorage) {
    function save(state) {
      const safe = validate(state);
      // Web Storage setItem replaces one complete value atomically. Never hide failures,
      // split balances from receipts, or attempt a second write/rollback on quota errors.
      storage.setItem(KEY, JSON.stringify(safe));
      return safe;
    }
    function load() {
      const raw = storage.getItem(KEY);
      if (raw !== null) return validate(parse(raw));
      const oldRaw = storage.getItem(OLD_KEY);
      if (oldRaw === null) return fresh();
      const migrated = migrate(oldRaw);
      if (storage.getItem(BACKUP_KEY) === null) storage.setItem(BACKUP_KEY, oldRaw);
      save(migrated);
      return migrated;
    }
    return { load, save, export: state => JSON.stringify(validate(state)),
      import: raw => validate(parse(raw)), fresh, finish };
  }
  root.ORI_STORE = { create, validate };
})(window);

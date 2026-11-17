'use strict';

// GAMES: run with Node; no packages, browser, network, recordings or persistence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const learningSource = fs.readFileSync(path.join(root, 'rpg', 'learning.js'), 'utf8');
const engineSource = fs.readFileSync(path.join(root, 'rpg', 'engine.js'), 'utf8');
const notes = fs.readFileSync(path.join(root, 'mockups', 'rpg-v3', 'learning-notes.md'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const whole = unit => unit.replace(/\|/g, '');
const count = value => (value.toUpperCase().match(/[АЕЁИОУЫЭЮЯ]/g) || []).length;
const sorted = values => Array.from(values).sort();
const normalized = value => value.toUpperCase();
const normalizePairs = options => sorted(options.map(normalized));
const set = values => new Set(values);
const unique = values => Array.from(set(values));

function load() {
  const context = vm.createContext({window: {}});
  vm.runInContext('Math.random = () => { throw new Error("Hidden randomness"); }; Date = undefined;', context);
  vm.runInContext(learningSource, context, {filename: path.join(root, 'rpg', 'learning.js')});
  vm.runInContext(engineSource, context, {filename: path.join(root, 'rpg', 'engine.js')});
  return context.window;
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
}
const window = load();
const engine = window.ORI_ENGINE;
freeze(window.ORI_LEARNING);
const lessons = plain(window.ORI_LEARNING.lessons);
const knownByLesson = {};
const known = new Set();
for (const lesson of lessons) {
  if (lesson.kind === 'letter') known.add(lesson.sample.answer);
  knownByLesson[lesson.id] = new Set(known);
}

const mechanics = ['letter-find', 'radar', 'bubble', 'memory', 'odd', 'blend', 'bridge', 'train', 'missing', 'syllable-sort', 'stress', 'sentence', 'story'];
const stress = {
  lesson062: {'ЛУ|НА': 2, 'РА|МА': 1, 'ПА|НА|МА': 2, 'МО|ЛО|КО': 3},
  lesson094: {'УМ': 1, 'ЩУ|КА': 1, 'ПА|НА|МА': 2, 'СА|МО|КАТ': 3}
};
const initialWords = {Е: 'ем', Я: 'яма', Ю: 'юла', Ё: 'ёлка'};
const signWords = {Ь: 'КОНЬ', Ъ: 'СЪЕЛ'};
const sentenceAnswers = {
  lesson095: ['Мама', 'Папа', 'Кот', 'Сова'],
  lesson096: ['Под столом', 'На полке', 'У окна', 'На столе'],
  lesson097: ['Миска', 'Книга', 'Молоток', 'Гнездо'],
  lesson098: ['Один', 'Несколько', 'Один', 'Несколько'],
  lesson099: ['Сад', 'Розы', 'Жук', 'Под листом'],
  lesson100: ['Моет и режет', 'Берёт и несёт', 'Ест и спит', 'Смотрит и летит']
};
const sentencePrompts = {
  lesson095: ['Кто читает?', 'Кто рисует?', 'Кто спит?', 'Кто летит?'],
  lesson096: ['Где мяч?', 'Где книга?', 'Где кот?', 'Где чашка?'],
  lesson097: ['Что нужно коту?', 'Что нужно маме?', 'Что нужно папе?', 'Что нужно сове?'],
  lesson098: ['Один кот или несколько?', 'Один кот или несколько?', 'Один мяч или несколько?', 'Один мяч или несколько?'],
  lesson099: ['Что у дома?', 'Что в саду?', 'Кто на розе?', 'Где жук?'],
  lesson100: Array(4).fill('Какие два действия названы?')
};
// Read the independent author table, not the implementation's keys.
const stories = {};
for (const line of notes.split(/\r?\n/)) {
  if (!/^\| 10[1-4] \| [a-d] \|/.test(line)) continue;
  const [, number, id, prompt, answer, distractors] = line.split('|').map(s => s.trim());
  stories['lesson' + number + ':' + id] = {prompt, answer, options: [answer].concat(distractors.split(';').map(s => s.trim()))};
}
assert.equal(Object.keys(stories).length, 16, 'All sixteen authored story questions are parsed');

function includesOnly(values, allowed, label) {
  for (const value of values) assert(allowed.includes(value), label + ': unexpected unit ' + value);
}
function selected(q) { return q.correct.map(i => q.options[i]); }
function expectChoice(q, expected) { assert.deepEqual(selected(q), [expected]); }
function lettersAreKnown(lesson, text) {
  for (const letter of text.toUpperCase().match(/[А-ЯЁ]/g) || []) {
    assert(knownByLesson[lesson.id].has(letter), lesson.id + ': unlearned letter ' + letter + ' in ' + text);
  }
}

function validateShape(lesson, q) {
  assert(['choice', 'many', 'sequence', 'memory'].includes(q.type));
  assert(mechanics.includes(q.mechanic));
  assert(lesson.mechanics.includes(q.mechanic) || (lesson.kind === 'letter' && q.mechanic === 'bubble'));
  for (const key of ['prompt', 'text', 'target', 'audio']) assert(typeof q[key] === 'string' && q[key].trim(), key + ' must be nonempty');
  assert(['read', 'listen'].includes(q.mode));
  assert.equal(typeof q.requiresAdult, 'boolean');
  assert(Array.isArray(q.options) && q.options.length > 0);
  q.options.forEach(value => assert(typeof value === 'string' && value.trim()));
  if (q.mechanic === 'radar') {
    assert.equal(q.mode, 'listen');
    assert.equal(q.text, '?', 'Listening must not display the target as a ready-made visual answer');
  }
  if (q.type === 'choice' || q.type === 'many') {
    assert(Array.isArray(q.correct));
    assert(q.correct.length > 0);
    assert.equal(new Set(q.correct).size, q.correct.length);
    q.correct.forEach(i => assert(Number.isInteger(i) && i >= 0 && i < q.options.length));
    if (q.type === 'choice') {
      assert.equal(q.correct.length, 1);
      assert.equal(set(q.options).size, q.options.length, 'Choice options must not be duplicated');
    } else {
      assert(q.correct.length >= 2 && q.correct.length < q.options.length, 'Many needs all matches and at least one non-match');
    }
    assert(!('answer' in q));
  } else if (q.type === 'sequence') {
    assert(Array.isArray(q.answer) && q.answer.length > 0);
    assert.deepEqual(sorted(q.options), sorted(q.answer), 'Every tile occurrence must be supplied exactly once');
    // Simulate the UI consuming indices, including a second identical МА tile.
    const unused = q.options.map((_, i) => i);
    for (const tile of q.answer) {
      const at = unused.findIndex(i => q.options[i] === tile);
      assert(at >= 0, 'Duplicate tile supply exhausted');
      unused.splice(at, 1);
    }
    assert.equal(unused.length, 0);
    assert(!('correct' in q));
    assert(q.requiresAdult, 'Copying a printed model is not evidence of reading');
  } else {
    const counts = new Map();
    q.options.forEach(v => counts.set(normalized(v), (counts.get(normalized(v)) || 0) + 1));
    assert(counts.size >= 2 && counts.size <= 3);
    counts.forEach(n => assert.equal(n, 2));
    assert.equal(counts.get(normalized(q.target)), 2);
    assert(!('correct' in q) && !('answer' in q));
    assert(q.requiresAdult);
  }
  if (q.word !== undefined) {
    assert(/^[А-ЯЁ]+$/.test(q.word));
    assert(lesson.pool.map(whole).includes(q.word), 'Album word must be a whole authored word');
  }
}

function validateLetters(lesson, questions) {
  const target = lesson.sample.answer;
  const allowed = unique([target].concat(lesson.sample.options)).filter(v => knownByLesson[lesson.id].has(v) || /^[○△×]$/.test(v));
  assert.equal(questions[0].mechanic, 'letter-find');
  assert.equal(questions[1].mechanic, 'letter-find');
  assert.equal(questions[3].type, 'memory');
  assert.equal(questions[1].target.toUpperCase(), target);
  assert.notEqual(questions[1].text, questions[1].target, 'Case-pair trial changes case');
  for (const q of questions) {
    includesOnly(q.options.map(normalized), allowed, lesson.id);
    lettersAreKnown(lesson, q.options.join(''));
    if (q.type === 'choice') expectChoice(q, q.target);
    if (q.type === 'many') assert.deepEqual(q.correct, q.options.map((v, i) => normalized(v) === target ? i : -1).filter(i => i >= 0));
  }
  const listen = questions[2];
  if (signWords[target]) {
    assert.equal(listen.mechanic, 'letter-find');
    assert.equal(listen.audio, signWords[target]);
    assert.equal(listen.text, signWords[target]);
    assert.equal(listen.mode, 'listen');
    assert(listen.requiresAdult);
    assert(!questions.some(q => q.mechanic === 'radar' || q.audio === 'sound:' + target.toLowerCase()));
  } else {
    assert.equal(listen.mechanic, 'radar');
    assert.equal(listen.audio, initialWords[target] || 'sound:' + target.toLowerCase());
    assert(!new RegExp('(^|[^А-Яа-яЁё])' + target + '($|[^А-Яа-яЁё])').test(listen.prompt), 'Listening instruction must not reveal the requested letter');
  }
}

function validateSounds(lesson, q) {
  assert(lesson.pool.includes(q.target));
  if (q.type === 'sequence') {
    assert.deepEqual(q.answer, Array.from(q.target));
    assert.match(q.prompt, /звуковая дорожка/);
    assert.match(q.prompt, /БУКВЫ/);
    assert(q.requiresAdult);
  } else {
    includesOnly(q.options, lesson.pool, lesson.id + ' sound pool');
    if (q.type === 'choice') expectChoice(q, q.target);
    if (q.type === 'many') assert.deepEqual(q.correct, q.options.map((v, i) => v === q.target ? i : -1).filter(i => i >= 0));
  }
  if (q.mechanic === 'odd') {
    assert.equal(q.options.length, 3);
    const letter = q.prompt.match(/«(.)»/)[1];
    const position = q.prompt.includes('начинается') ? 0 : 1;
    assert.equal(q.options.filter(v => v[position] !== letter).length, 1);
    assert.notEqual(selected(q)[0][position], letter);
  }
  lettersAreKnown(lesson, q.options.join(''));
  lettersAreKnown(lesson, q.text);
  assert(!q.word, 'Instructional syllables are not automatically album words');
}

function validateMerge(lesson, q) {
  const unit = lesson.pool.find(v => whole(v) === q.target);
  assert(unit, 'Merge target must come from its own lesson pool');
  const syllables = unit.split('|');
  assert.equal(syllables.length, lesson.kind === 'merge2' ? 2 : 3);
  assert.equal(q.word, whole(unit));
  assert(q.requiresAdult);
  assert.equal(q.mode, 'read');
  if (q.type === 'sequence') {
    assert.equal(q.mechanic, 'train');
    assert.deepEqual(q.answer, syllables, 'Merge tiles are syllables, not letters');
    assert.equal(q.text, q.target);
  } else if (q.mechanic === 'missing') {
    const [model, masked] = q.text.split('\n');
    assert.equal(model, q.target);
    const pieces = masked.split(' | ');
    assert.equal(pieces.filter(v => v === '□').length, 1);
    assert.equal(pieces.length, syllables.length);
    expectChoice(q, syllables[pieces.indexOf('□')]);
    assert.deepEqual(pieces.map((v, i) => v === '□' ? syllables[i] : v), syllables);
    includesOnly(q.options, lesson.pool.flatMap(v => v.split('|')), 'Missing-syllable pool');
  } else {
    assert.equal(q.mechanic, 'bridge');
    expectChoice(q, q.target);
    assert.equal(q.text, syllables.join(' | '));
    includesOnly(q.options, lesson.pool.map(whole), 'Whole-word pool');
  }
  lettersAreKnown(lesson, q.options.join(''));
  lettersAreKnown(lesson, q.text);
}

function validateSyllable(lesson, q) {
  const unit = lesson.pool.find(v => whole(v) === q.target);
  assert(unit);
  assert.equal(q.word, whole(unit));
  if (q.mechanic === 'stress') {
    assert(stress[lesson.id] && stress[lesson.id][unit]);
    const syllables = unit.split('|');
    expectChoice(q, syllables[stress[lesson.id][unit] - 1]);
    assert.deepEqual(sorted(q.options), sorted(unique(syllables)));
    assert.equal(q.text, whole(unit), 'Do not display a stress key or divisions before answering');
    assert(!q.text.includes('\u0301'));
    assert.equal(q.audio, whole(unit));
  } else if (q.mechanic === 'odd') {
    includesOnly(q.options, lesson.pool.map(whole), 'Syllable-count odd pool');
    const common = Number(q.prompt.match(/НЕ (\d)/)[1]);
    assert.equal(q.options.filter(v => count(v) !== common).length, 1);
    assert.notEqual(count(selected(q)[0]), common);
    assert.equal(q.options.length, 3);
  } else if (q.options.every(v => /^[123]$/.test(v))) {
    expectChoice(q, String(count(unit)));
    assert.equal(q.text, whole(unit));
  } else {
    const desired = Number(q.prompt.match(/— (\d)/)[1]);
    includesOnly(q.options, lesson.pool.map(whole), 'Syllable-count choice pool');
    assert.equal(q.options.filter(v => count(v) === desired).length, 1);
    assert.equal(count(selected(q)[0]), desired);
  }
}

function validateRules(lesson, q, slot) {
  const word = q.word;
  assert(lesson.pool.map(whole).includes(word));
  assert.equal(q.target, word);
  if (lesson.id === 'lesson057') {
    if (q.options.every(v => /^[123]$/.test(v))) expectChoice(q, String(count(word)));
    else if (q.options.every(v => v.length === 1)) {
      expectChoice(q, word.slice(-1));
      assert(q.requiresAdult);
      includesOnly(q.options, Array.from(lesson.pool.map(whole).join('')), 'Closed-syllable letter pool');
      assert.equal(q.prompt.includes('согласная'), count(word) === 1);
    } else {
      includesOnly(q.options, lesson.pool.map(whole), 'Closed/open word pool');
      const desired = /из одного закрытого|НЕ из двух открытых/.test(q.prompt) ? 1 : 2;
      assert.equal(q.options.filter(v => count(v) === desired).length, 1);
      assert.equal(count(selected(q)[0]), desired);
      assert.equal(q.options.length, 3);
    }
  } else if (lesson.id === 'lesson072') {
    if (q.mechanic === 'missing') {
      assert.deepEqual(sorted(q.options), ['И', 'Ы']);
      expectChoice(q, 'И');
      assert.equal(q.text.replace('□', 'И'), word);
      assert.equal((q.text.match(/□/g) || []).length, 1);
      assert(!q.options.some(v => /ЖЫ|ШЫ/.test(v)), 'Never present misspellings as ordinary words');
    } else if (q.type === 'many') {
      assert(['ЖИ', 'ШИ'].includes(q.text));
      includesOnly(q.options, lesson.pool.map(whole), 'ЖИ/ШИ pool');
      assert.deepEqual(q.correct, q.options.map((v, i) => v.includes(q.text) ? i : -1).filter(i => i >= 0));
    } else {
      assert.deepEqual(sorted(q.options), ['Мягко', 'Твёрдо']);
      expectChoice(q, 'Твёрдо');
      assert.match(q.prompt, /перед И/);
      assert.equal(q.text, word);
    }
  } else {
    if (slot === 4) { expectChoice(q, String(count(word))); return; }
    const prompts = {
      КОНЬ: 'В каком слове Ь показывает мягкость Н?',
      МЫШЬ: 'В каком слове Ь не делает Ш мягким?',
      СЕМЬЯ: 'В каком слове Ь разделяет чтение перед Я?',
      СЪЕЛ: 'В каком слове чтение разделяет Ъ?'
    };
    assert.equal(q.prompt, prompts[word]);
    expectChoice(q, word);
    includesOnly(q.options, lesson.pool, 'Sign functions pool');
  }
  lettersAreKnown(lesson, q.options.join(''));
}

function validateSentences(lesson, q, slot) {
  const source = q.text.split('\n')[0];
  const index = lesson.pool.indexOf(source);
  assert(index >= 0);
  assert.equal(q.mode, 'read');
  assert.equal(q.audio, source);
  if (slot < 4) {
    const answer = sentenceAnswers[lesson.id][index];
    expectChoice(q, answer);
    assert.equal(q.target, answer);
    assert.equal(q.prompt, sentencePrompts[lesson.id][index]);
    assert.equal(q.questionId, lesson.id + ':' + index);
    let allowed = sentenceAnswers[lesson.id];
    if (lesson.id === 'lesson099') allowed = index === 3 ? ['Под листом', 'На розе', 'У дома'] : ['Сад', 'Розы', 'Жук'];
    includesOnly(q.options, allowed, 'Authored sentence key pool');
    if (lesson.id === 'lesson098') assert.deepEqual(sorted(q.options), ['Несколько', 'Один']);
    if (lesson.id === 'lesson100') assert(!/потом|почему/i.test(q.prompt));
  } else {
    assert(q.requiresAdult);
    if (q.type === 'sequence') assert.deepEqual(q.answer, source.split(' '));
    else {
      const mask = q.text.split('\n')[1].split(' ');
      assert.equal(mask.filter(v => v === '□').length, 1);
      const words = source.split(' ');
      expectChoice(q, words[mask.indexOf('□')]);
      assert.deepEqual(mask.map((v, i) => v === '□' ? words[i] : v), words);
      includesOnly(q.options, lesson.pool.flatMap(v => v.split(' ')), 'Sentence word pool');
    }
  }
}

function validateStories(lesson, questions) {
  const first = questions.slice(0, 4);
  assert.equal(set(first.map(q => q.questionId)).size, 4);
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    assert.equal(q.mechanic, 'story');
    assert.equal(q.mode, 'read');
    assert.equal(q.text, lesson.pool.join('\n'), 'All four original sentences must remain in original order');
    assert.equal(q.audio, q.text, 'Full story is available for explicit help only');
    const authored = stories[q.questionId];
    assert(authored);
    assert.equal(q.prompt, (i === 4 ? 'Повтор для закрепления. ' : '') + authored.prompt);
    assert.equal(q.target, authored.answer);
    expectChoice(q, authored.answer);
    assert.deepEqual(sorted(q.options), sorted(authored.options));
  }
  assert(first.some(q => q.questionId === questions[4].questionId), 'Fifth question is an explicit controlled repeat');
}

function semanticPermutation(questions) {
  return questions.map(q => {
    const copy = plain(q);
    copy.options.reverse();
    if (q.correct) copy.correct = q.correct.map(i => q.options.length - 1 - i).sort((a, b) => a - b);
    return copy;
  });
}

assert.deepEqual(Object.keys(engine).sort(), ['hash', 'plan', 'signature', 'version']);
assert.equal(lessons.length, 104);
assert.equal(lessons.filter(l => l.kind === 'letter').length, 33);
assert.equal(engine.hash(''), 0x811c9dc5);
assert.equal(engine.hash('hello'), 0x4f9f2cab);
for (const text of ['GAMES', 'Читаем с Ори', 'ЕЁЬЪ', '\ud83d\ude80', '\ud800', '\udfff', 'a\u0000б']) {
  let expected = 0x811c9dc5;
  for (const byte of Buffer.from(text, 'utf8')) expected = Math.imul(expected ^ byte, 0x01000193) >>> 0;
  assert.equal(engine.hash(text), expected, 'FNV-1a must use UTF-8 bytes');
}
assert.throws(() => engine.plan('lesson000', 0), /Unknown lesson/);
assert.throws(() => engine.plan('lesson001', NaN), /seed/);
assert.throws(() => engine.plan('lesson001', Infinity), /seed/);
assert.throws(() => engine.plan('lesson001', {}), /seed/);
assert.throws(() => engine.plan('lesson001'), /seed/);
assert.throws(() => engine.plan('lesson001', 1, {}), /previousSignature/);
const unloaded = vm.createContext({window: {}});
vm.runInContext(engineSource, unloaded);
assert.throws(() => unloaded.window.ORI_ENGINE.plan('lesson001', 0), /learning.js/);
vm.runInContext(learningSource, unloaded);
assert.equal(unloaded.window.ORI_ENGINE.plan('lesson001', 0).signature, engine.plan('lesson001', 0).signature);

const seenMechanics = new Set();
const seenTypes = new Set();
const storyQuestions = new Set();
const observedStress = new Set();
let checked = 0;
let minimumVariants = 100;
let duplicateWordSequences = 0;
const savedData = JSON.stringify(window.ORI_LEARNING);
const other = load().ORI_ENGINE;

for (const lesson of lessons) {
  const signatures = new Set();
  const units = new Set();
  for (let seed = 0; seed < 100; seed++) {
    try {
      const raw = engine.plan(lesson.id, seed);
      const result = plain(raw);
      assert.deepEqual(result, plain(engine.plan(lesson.id, seed)), 'Same seed must yield byte-equivalent JSON');
      assert.equal(result.version, engine.version);
      assert.equal(result.questions.length, 5);
      assert.equal(result.signature, engine.signature(lesson.id, result.questions));
      assert.equal(result.signature, engine.signature(lesson.id, semanticPermutation(result.questions)), 'Display option order must not change semantic signature');
      const next = plain(engine.plan(lesson.id, seed, result.signature));
      assert.notEqual(next.signature, result.signature, 'A previous signature must cause a safe different candidate');
      assert.deepEqual(next, plain(engine.plan(lesson.id, seed, result.signature)), 'Retry selection must also be deterministic');
      signatures.add(result.signature);
      if (seed === 0) assert.deepEqual(result, plain(other.plan(lesson.id, seed)), 'Fresh engine must reproduce the plan');
      result.questions.forEach((q, slot) => {
        validateShape(lesson, q);
        seenMechanics.add(q.mechanic);
        seenTypes.add(q.type);
        if (q.questionId && lesson.kind === 'story') storyQuestions.add(q.questionId);
        if (q.mechanic === 'stress') observedStress.add(lesson.id + ':' + q.target + ':' + q.mode);
        if (q.type === 'sequence' && set(q.answer).size < q.answer.length) duplicateWordSequences++;
        if (['open', 'soft', 'reverse'].includes(lesson.kind)) validateSounds(lesson, q);
        if (lesson.kind === 'merge2' || lesson.kind === 'merge3') validateMerge(lesson, q);
        if (lesson.kind === 'syllable') validateSyllable(lesson, q);
        if (lesson.kind === 'rules') validateRules(lesson, q, slot);
        if (lesson.kind === 'sentence') validateSentences(lesson, q, slot);
      });
      if (lesson.kind === 'letter') validateLetters(lesson, result.questions);
      else if (lesson.kind === 'story') validateStories(lesson, result.questions);
      else {
        const material = result.questions.map(q => lesson.kind === 'sentence' ? q.text.split('\n')[0] : q.target);
        assert.equal(set(material.slice(0, Math.min(5, lesson.pool.length))).size, Math.min(5, lesson.pool.length), 'No replacement before exhausting pool');
        material.forEach(v => units.add(v));
      }
      if (lesson.kind === 'merge2' || lesson.kind === 'merge3') {
        assert.deepEqual(sorted(set(result.questions.map(q => q.mechanic))), ['bridge', 'missing', 'train']);
      }
      if (lesson.id === 'lesson072') {
        assert(result.questions.some(q => q.mechanic === 'missing'));
        assert(result.questions.some(q => q.options.includes('Твёрдо')));
        assert.equal(set(result.questions.slice(0, 4).map(q => q.word)).size, 4);
      }
      checked++;
    } catch (error) {
      error.message = lesson.id + ' / seed ' + seed + ': ' + error.message;
      throw error;
    }
  }
  assert(signatures.size >= 6, lesson.id + ': insufficient semantic variation (' + signatures.size + ')');
  minimumVariants = Math.min(minimumVariants, signatures.size);
  if (!['letter', 'story', 'sentence'].includes(lesson.kind)) assert.deepEqual(sorted(units), sorted(lesson.pool.map(whole)), 'Exercise all pool entries across seeds');
}
assert.deepEqual(sorted(seenMechanics), mechanics.sort());
assert.deepEqual(sorted(seenTypes), ['choice', 'many', 'memory', 'sequence']);
assert.equal(storyQuestions.size, 16);
assert(duplicateWordSequences > 0, 'Repeated syllable tile fixtures must actually occur');
for (const [id, entries] of Object.entries(stress)) {
  for (const unit of Object.keys(entries)) {
    assert(observedStress.has(id + ':' + whole(unit) + ':read'), 'Independent stress trial: ' + unit);
    assert(observedStress.has(id + ':' + whole(unit) + ':listen'), 'Listening stress trial: ' + unit);
  }
}
assert.equal(JSON.stringify(window.ORI_LEARNING), savedData, 'Planning must not mutate authored data');
for (const seed of ['Ори | lesson009 | 1', '', -1, 0xffffffff, 1.5, 0x100000001]) {
  assert.deepEqual(plain(engine.plan('lesson009', seed)), plain(other.plan('lesson009', seed)));
}
const pristine = plain(engine.plan('lesson009', 42));
const mutable = engine.plan('lesson009', 42);
mutable.questions[0].options[0] = 'CHANGED';
mutable.questions[0].prompt = 'CHANGED';
assert.deepEqual(plain(engine.plan('lesson009', 42)), pristine, 'Caller mutations must not contaminate future plans');
const sensitive = plain(pristine.questions);
sensitive[0].requiresAdult = !sensitive[0].requiresAdult;
assert.notEqual(engine.signature('lesson009', sensitive), pristine.signature, 'Support is semantic');
sensitive[0].target += '!';
assert.notEqual(engine.signature('lesson009', sensitive), pristine.signature, 'Target is semantic');
assert.notEqual(engine.signature('lesson014', pristine.questions), pristine.signature, 'Lesson ID is semantic');
assert.notEqual(engine.signature('lesson009', pristine.questions.slice().reverse()), pristine.signature, 'Question sequence is semantic');
const pairs = engine.plan('lesson001', 0).questions.find(q => q.type === 'memory');
assert.equal(normalizePairs(pairs.options).length % 2, 0);

console.log('GAMES ORI_ENGINE ' + engine.version + ': ' + checked + ' plans (104 x 100 seeds) passed.');
console.log('Determinism/retries, 13 mechanics, four types, authored answers, pool coverage, UTF-8 FNV, semantic signatures, duplicate tiles, memory pairs and full story order verified.');
console.log('Minimum semantic variants per lesson: ' + minimumVariants + '; duplicate-tile sequences checked: ' + duplicateWordSequences + '.');

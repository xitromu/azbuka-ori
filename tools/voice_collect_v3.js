'use strict';
// Data-only extraction: never execute the engine or collect generated UI instructions.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const roles = ['ori', 'alien1', 'alien2', 'alien3'];
function hkey(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(16);
}
const context = vm.createContext({window: {}});
for (const file of ['learning', 'rewards']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'rpg', file + '.js'), 'utf8'), context, {timeout: 5000});
}
const learning = context.window.ORI_LEARNING;
const rewards = context.window.ORI_REWARDS;
const entries = new Map();
function add(who, text, category, provenance, helpOnly = false) {
  assert(roles.includes(who));
  assert.equal(typeof text, 'string');
  assert(text.length > 0 && text === text.trim());
  const key = who + '/' + hkey(text);
  if (entries.has(key)) {
    const row = entries.get(key);
    assert.equal(row.text, text, 'DJB2 collision: ' + key);
    if (!row.categories.includes(category)) row.categories.push(category);
    if (!row.provenance.includes(provenance)) row.provenance.push(provenance);
    row.helpOnly = row.helpOnly && helpOnly;
  } else entries.set(key, {key, who, text, categories: [category], provenance: [provenance], helpOnly});
}
const lines = [];
for (const [file, catalog] of [['learning', learning], ['rewards', rewards]]) {
  for (const line of catalog.lines) {
    add(line.who, line.text, 'line', `rpg/${file}.js:${line.id}`);
    lines.push({...line, key: line.who + '/' + hkey(line.text)});
  }
}
assert.equal(lines.length, 490, 'Authored catalog changed; review coverage');
assert.equal(new Set(lines.map(row => row.id)).size, 490);
const alphabet = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
for (const letter of alphabet) {
  add('ori', '#' + letter, 'letter-name', 'rpg/learning.js:alphabet');
  if (!'ьъ'.includes(letter)) add('ori', '#з_' + letter, 'sound', 'rpg/learning.js:alphabet');
}
for (const lesson of learning.lessons) {
  const provenance = 'rpg/learning.js:' + lesson.id;
  if (lesson.kind === 'letter') continue; // Its pool contains directions, not lexical targets.
  if (['sentence', 'story'].includes(lesson.kind)) {
    for (const sentence of lesson.pool) add('ori', sentence, 'sentence-help', provenance, true);
    if (lesson.kind === 'story') {
      assert.equal(lesson.pool.length, 4);
      add('ori', lesson.pool.join(' '), 'story-help', provenance, true);
    }
    continue;
  }
  for (const item of lesson.pool) {
    assert(/^[А-ЯЁ|]+$/.test(item));
    add('ori', item.replaceAll('|', '').toLowerCase(), 'word', provenance, true);
    for (const syllable of item.split('|')) add('ori', '#с_' + syllable.toLowerCase(), 'syllable', provenance, true);
  }
}
for (const [letter, word] of Object.entries({е:'ем', ё:'ёлка', ю:'юла', я:'яма'})) {
  add('ori', word, 'support-word', 'rpg/learning.js:letter-' + letter, true);
}
// Dedicated stressed examples avoid reusing v2 words without explicit stress provenance.
for (const word of ['луна', 'рама', 'панама', 'молоко', 'ум', 'щука', 'самокат']) {
  add('ori', '#stress_' + word, 'stress-word', 'rpg/learning.js:lesson062+lesson094', true);
}
// Preserve the four exact v2 greeting/demo texts without loading its application.
const html = fs.readFileSync(path.join(root, 'v2.html'), 'utf8');
const demos = [...html.matchAll(/id:'(alien\d)', name:'[^']+', hi:'([^']+)'/g)].map(m => ({who:m[1], text:m[2]}));
const ori = html.match(/say\(pick\(\['(Привет! Я Ори\.[^']+)'/);
assert(ori);
demos.push({who:'ori', text:ori[1]});
assert.equal(demos.length, 4);
for (const demo of demos) add(demo.who, demo.text, 'demo', 'v2.html:voice-demo');
const rows = [...entries.values()].sort((a, b) => a.key.localeCompare(b.key));
const counts = {};
for (const row of rows) for (const category of row.categories) counts[category] = (counts[category] || 0) + 1;
assert.equal(counts['letter-name'], 33);
assert.equal(counts.sound, 31);
assert.equal(counts['story-help'], 4);
const output = {schema:3, policy:{lexicalVoice:'ori', lexicalPlayback:'explicit-help-or-listening-only', automaticSpeech:'authored-lines-only'}, counts, lines, demos, entries:rows,
  hashVectors:['', 'луна', '#с_ма', 'A\u{1f680}Ё', '\u{1d11e}'].map(text => ({text, hash:hkey(text)}))};
fs.writeFileSync(path.join(root, 'tools', 'voice_v3_parts.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({entries:rows.length, authoredLines:lines.length, counts}));
if (process.argv.includes('--verify')) {
  const crypto = require('node:crypto');
  const manifestContext = vm.createContext({window:{}});
  vm.runInContext(fs.readFileSync(path.join(root, 'rpg', 'voice-manifest.js'), 'utf8'), manifestContext, {timeout:5000});
  const manifest = manifestContext.window.ORI_VOICE;
  assert.deepEqual(Object.keys(manifest.clips).sort(), rows.map(row => row.key).sort());
  let bytes = 0;
  let reused = 0;
  for (const row of rows) {
    const relative = manifest.clips[row.key];
    assert(/^(voice-v2|voice-v3)\/(ori|alien[123])\/[0-9a-f]+\.mp3$/.test(relative));
    const old = 'voice-v2/' + row.key + '.mp3';
    const expected = fs.existsSync(path.join(root, old)) ? old : 'voice-v3/' + row.key + '.mp3';
    assert.equal(relative, expected, 'Reuse/path mismatch: ' + row.key);
    bytes += fs.statSync(path.join(root, relative)).size;
    if (relative.startsWith('voice-v2/')) reused++;
  }
  assert.equal(manifest.bytes, bytes);
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'voice_v3_baseline.json'), 'utf8'));
  for (const [relative, digest] of Object.entries(baseline)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex'), digest, 'Protected file changed: ' + relative);
  }
  const report = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'voice_v3_report.json'), 'utf8'));
  const stress = {луна:'лун+а.', рама:'р+ама.', панама:'пан+ама.', молоко:'молок+о.', ум:'+ум.', щука:'щ+ука.', самокат:'самок+ат.'};
  for (const [word, source] of Object.entries(stress)) {
    assert.equal(report.clips['ori/' + hkey('#stress_' + word)].source, source);
  }
  for (const row of rows) {
    const record = report.clips[row.key];
    assert.equal(record.text, row.text);
    assert.equal(record.path, manifest.clips[row.key]);
    assert(record.provenance.every(item => !/^[A-Za-z]:|^\//.test(item)));
    assert.equal(record.sha256, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, record.path))).digest('hex'));
  }
  const result = {status:'PASS', version:manifest.version, clips:rows.length, authoredLines:lines.length,
    learningLines:learning.lines.length, rewardLines:rewards.lines.length, counts, bytes, reused,
    new:rows.length-reused, protectedFilesUnchanged:Object.keys(baseline).length,
    sha256Checks:rows.length, stressSourceChecks:7, silentSignSoundsAbsent:true,
    relativeProvenance:true, generatedWavs:0};
  for (const who of roles) {
    const directory = path.join(root, 'voice-v3', who);
    assert(fs.readdirSync(directory).every(file => file.endsWith('.mp3')), 'Unexpected disposable audio');
  }
  fs.writeFileSync(path.join(root, 'tools', 'voice_v3_checks.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}

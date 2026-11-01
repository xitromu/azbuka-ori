// Автопрогон всех уроков в консоли браузера. Не меняет сохранённый прогресс.
// await import('/tools/autorun.js?' + Date.now()); await BOT.run(); смотреть BOT.res и BOT.audit()
window.BOT = (() => {
  const res = {}, log = [];
  const fail = msg => { throw new Error(msg); };
  const clean = x => String(x || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const checkText = x => { if (/undefined|NaN/.test(clean(x))) fail('неверный текст: ' + clean(x)); };
  window.tell = async (text) => { checkText(text); log.push('• ' + clean(text)); };
  window.give = async () => {};
  window.askChoice = async a => {
    checkText(a.text); checkText(a.hint);
    const good = a.options.filter(o => o.ok);
    if (good.length !== 1) fail('верных ответов не один: ' + clean(a.text));
    const labels = a.options.map(o => clean(o.html || o.label));
    if (new Set(labels).size !== labels.length) fail('одинаковые ответы: ' + clean(a.text));
    if (labels.some(x => !x)) fail('пустой ответ: ' + clean(a.text));
    labels.forEach(checkText);
    a.options.forEach(o => checkText(o.say));
    log.push(`? ${clean(a.text)} → ${clean(good[0].html || good[0].label)}`);
    return good[0];
  };
  window.askMany = async a => {
    checkText(a.text);
    const good = a.options.filter(o => o.ok);
    if (!good.length) fail('нет верных карточек: ' + clean(a.text));
    a.options.forEach(o => checkText(o.html || o.label));
    log.push(`? ${clean(a.text)} → ${good.length} карточек`);
  };
  window.askSequence = async a => {
    checkText(a.text);
    if (!a.answer || !/^[А-ЯЁ]+$/.test(a.answer)) fail('неверный ответ для сборки: ' + a.answer);
    log.push(`? ${clean(a.text)} → ${a.answer}`);
  };
  async function run(ids) {
    ids = ids || LESSONS.map(l => l.id);
    for (const id of ids) {
      const def = LESSONS.find(l => l.id === id), t0 = performance.now();
      if (!def) { res[id] = 'FAIL нет урока'; continue; }
      L = { def, errors:0, earned:0, student:0 };
      show('lesson'); log.length = 0;
      try { await def.run(); res[id] = `ok ${((performance.now() - t0) / 1000).toFixed(1)} с, шагов ${log.length}`; }
      catch (e) { res[id] = 'FAIL ' + e.message; console.error(id, e); }
    }
    res.done = true;
    return res;
  }
  function audit() {
    const ids = LESSONS.map(l => l.id), letters = LESSONS.filter(l => l.letter).map(l => l.letter);
    const expected = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
    return {
      lessons: LESSONS.length,
      uniqueIds: new Set(ids).size,
      letters: letters.length,
      uniqueLetters: new Set(letters).size,
      all33: [...expected].every(c => letters.includes(c)),
      reading: LESSONS.length - letters.length,
      errors: Object.entries(res).filter(([k,v]) => String(v).startsWith('FAIL'))
    };
  }
  return { run, res, log, audit };
})();

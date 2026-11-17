// Audio payloads are only for explicit help or listening, never automatic answers.
(function (window) {
  'use strict';

  const version = 'rpg-v3-engine-1';
  const vowels = 'АЕЁИОУЫЭЮЯ';
  const whole = value => value.replace(/\|/g, '');
  const unique = values => Array.from(new Set(values));
  const countSyllables = value => Array.from(whole(value).toUpperCase()).filter(c => vowels.includes(c)).length;

  // FNV-1a over UTF-8, including TextEncoder-compatible replacement of lone surrogates.
  // The hand-written encoding also works in a bare browser/Node vm without TextEncoder.
  function hash(value) {
    let h = 0x811c9dc5;
    const byte = b => { h = Math.imul(h ^ b, 0x01000193) >>> 0; };
    for (const char of String(value)) {
      let cp = char.codePointAt(0);
      if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
      if (cp < 0x80) byte(cp);
      else if (cp < 0x800) { byte(0xc0 | (cp >> 6)); byte(0x80 | (cp & 63)); }
      else if (cp < 0x10000) {
        byte(0xe0 | (cp >> 12)); byte(0x80 | ((cp >> 6) & 63)); byte(0x80 | (cp & 63));
      } else {
        byte(0xf0 | (cp >> 18)); byte(0x80 | ((cp >> 12) & 63));
        byte(0x80 | ((cp >> 6) & 63)); byte(0x80 | (cp & 63));
      }
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let state = seed >>> 0;
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), state | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(values, random) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  const pick = (values, random) => values[Math.floor(random() * values.length)];

  function semantic(question) {
    return [question.type, question.mechanic, question.mode, question.prompt,
      question.text, question.target, question.questionId || '', question.requiresAdult,
      question.word || '', question.audio, question.options.slice().sort(),
      (question.correct || []).map(i => question.options[i]).sort(), question.answer || []];
  }

  function signature(lessonId, questions) {
    return version + ':' + hash(JSON.stringify([lessonId, questions.map(semantic)])).toString(16).padStart(8, '0');
  }

  function base(type, mechanic, prompt, text, target, options, extra) {
    return Object.assign({type, mechanic, prompt, text, target, options,
      mode: 'read', audio: target, requiresAdult: false}, extra);
  }

  function choice(mechanic, prompt, text, target, values, answers, random, extra) {
    const options = shuffle(unique(values), random);
    const correct = options.map((value, i) => answers.includes(value) ? i : -1).filter(i => i >= 0);
    if (correct.length !== 1) throw new Error('Choice must have exactly one authored answer');
    return Object.assign(base('choice', mechanic, prompt, text, target, options, extra), {correct});
  }

  function sequence(mechanic, prompt, text, target, answer, random, extra) {
    // Do NOT deduplicate: МА|МА supplies two separate selectable indices.
    return Object.assign(base('sequence', mechanic, prompt, text, target, shuffle(answer, random), extra),
      {answer: answer.slice()});
  }

  function memory(target, pool, random, letterPairs) {
    const pairs = [target].concat(shuffle(unique(pool).filter(v => v !== target), random).slice(0, 1 + Math.floor(random() * 2)));
    const tiles = pairs.flatMap(value => [value, letterPairs ? value.toLowerCase() : value]);
    return base('memory', 'memory', letterPairs
      ? 'Открывай по две карточки: найди пары большой и маленькой буквы; значки совпадают по форме.'
      : 'Открывай по две карточки и находи одинаковые слоги. Это тренировка памяти, не проверка чтения.',
    target, target, shuffle(tiles, random), {requiresAdult: true, audio: 'Найди все пары карточек.'});
  }

  function bubbles(target, text, pool, random, letterPairs) {
    const others = shuffle(unique(pool).filter(v => v.toUpperCase() !== target.toUpperCase()), random).slice(0, 2);
    const options = shuffle([target, letterPairs ? target.toLowerCase() : target].concat(others), random);
    const correct = options.map((v, i) => v.toUpperCase() === target.toUpperCase() ? i : -1).filter(i => i >= 0);
    return Object.assign(base('many', 'bubble', letterPairs
      ? 'Выбери ВСЕ такие буквы — большие и маленькие.'
      : 'Пройди звуковую дорожку и выбери ВСЕ пузыри с получившимся слогом. Затем прочитай его взрослому.',
    text, target, options, {requiresAdult: !letterPairs}), {correct});
  }

  // Fixed meanings of the four letter-pool entries are described in learning-notes.md.
  // Descriptions are never evaluated or sent verbatim to speech (they reveal answers).
  function learnedLetters(lesson, lessons) {
    const byId = new Map(lessons.map(item => [item.id, item]));
    const seen = new Set();
    const letters = new Set();
    function visit(item) {
      if (!item || seen.has(item.id)) return;
      seen.add(item.id);
      if (item.kind === 'letter') letters.add(item.sample.answer);
      item.prerequisites.forEach(id => visit(byId.get(id)));
    }
    visit(lesson);
    return letters;
  }

  const initialWords = {Е: 'ем', Я: 'яма', Ю: 'юла', Ё: 'ёлка'};
  const signWords = {Ь: 'КОНЬ', Ъ: 'СЪЕЛ'};

  function letterPlan(lesson, lessons, random) {
    const target = lesson.sample.answer;
    const known = learnedLetters(lesson, lessons);
    const pool = unique([target].concat(lesson.sample.options)).filter(v => known.has(v) || /^[○△×]$/.test(v));
    const audio = initialWords[target] || signWords[target] || 'sound:' + target.toLowerCase();
    const lowerFirst = random() < 0.5;
    const sample = lowerFirst ? target.toLowerCase() : target;
    const pair = lowerFirst ? target : target.toLowerCase();
    const questions = [
      choice('letter-find', 'Найди такой же знак, как в образце.', target, target, pool, [target], random, {audio}),
      choice('letter-find', lowerFirst ? 'Найди большую пару этой буквы.' : 'Найди маленькую пару этой буквы.',
        sample, pair, pool.map(v => lowerFirst ? v : v.toLowerCase()), [pair], random, {audio})
    ];
    if (signWords[target]) {
      questions.push(choice('letter-find', 'Взрослый прочитает слово. Найди в нём знак без собственного звука.',
        signWords[target], target, pool, [target], random, {mode: 'listen', audio, requiresAdult: true}));
    } else {
      questions.push(choice('radar', initialWords[target]
        ? 'Послушай слово. Какая буква стоит в его начале?'
        : 'Послушай звук, не название буквы. Выбери его букву.',
      '?', target, pool, [target], random, {mode: 'listen', audio}));
    }
    questions.push(memory(target, pool, random, true));
    questions.push(random() < 0.5 ? bubbles(target, target, pool, random, true)
      : choice('letter-find', 'Закрепим пару: найди такую же маленькую букву.', target.toLowerCase(),
        target.toLowerCase(), pool.map(v => v.toLowerCase()), [target.toLowerCase()], random, {audio}));
    questions[4].audio = audio;
    return questions;
  }

  function soundPathPrompt(lesson, target) {
    let prompt = 'Это звуковая дорожка, не слоговые вагоны. Расположи БУКВЫ по образцу и слей звуки без паузы. Не называй буквы; короткий согласный не тяни.';
    if (lesson.kind === 'reverse') prompt += ' Начни с гласного слева, не переставляй звуки.';
    else if (lesson.kind === 'soft') prompt += ' Согласный сразу читай мягко.';
    else if ('ЖШЦ'.includes(target[0])) prompt += ' Первый согласный остаётся твёрдым.';
    return prompt + ' Взрослый подтвердит чтение.';
  }

  function oddSyllable(lesson, target, random) {
    const criteria = [];
    for (let position = 0; position < target.length; position++) {
      for (const letter of unique(lesson.pool.map(v => v[position]))) {
        const same = lesson.pool.filter(v => v[position] === letter && v !== target);
        if (letter !== target[position] && same.length >= 2) criteria.push({position, letter, same});
      }
    }
    if (!criteria.length) return null;
    const {position, letter, same} = pick(criteria, random);
    const options = [target].concat(shuffle(same, random).slice(0, 2));
    return choice('odd', 'Найди слог, который ' + (position === 0 ? 'начинается' : 'заканчивается') + ' НЕ на «' + letter + '».',
      letter, target, options, [target], random);
  }

  function soundQuestion(lesson, target, slot, random, mechanics) {
    const mechanic = mechanics[slot % mechanics.length];
    const path = Array.from(target).join(' → ');
    if (mechanic === 'radar') return choice('radar', 'Послушай слог и выбери услышанное. Это слушание, не самостоятельное чтение.',
      '?', target, [target].concat(shuffle(lesson.pool.filter(v => v !== target), random).slice(0, 2)), [target], random,
      {mode: 'listen', audio: target});
    if (mechanic === 'memory') return memory(target, lesson.pool, random, false);
    if (mechanic === 'bubble') return bubbles(target, path, lesson.pool, random, false);
    if (mechanic === 'odd') {
      const odd = oddSyllable(lesson, target, random);
      if (odd) return odd;
      // No invented distractor when this unit cannot be the sole exception.
    }
    const safeMechanic = mechanic === 'bridge' ? 'bridge' : (lesson.mechanics.includes('blend') ? 'blend' : 'bridge');
    if (safeMechanic === 'bridge' || random() < 0.5) {
      return sequence(safeMechanic, soundPathPrompt(lesson, target), path, target, Array.from(target), random, {requiresAdult: true});
    }
    return choice(safeMechanic, 'Пройди звуковую дорожку слева направо. Выбери слитный слог и прочитай его взрослому; не называй буквы.',
      path, target, [target].concat(shuffle(lesson.pool.filter(v => v !== target), random).slice(0, 2)), [target], random, {requiresAdult: true});
  }

  function mergeQuestion(lesson, unit, slot, random, mechanics) {
    const syllables = unit.split('|');
    const word = whole(unit);
    const mechanic = mechanics[slot % mechanics.length];
    const support = {word, requiresAdult: true, audio: word};
    if (mechanic === 'train') {
      return sequence('train', 'Собери слово по напечатанному образцу из ЦЕЛЫХ СЛОГОВ. Потом прочитай его взрослому: сборка сама по себе не доказывает чтение.',
        word, word, syllables, random, support);
    }
    if (mechanic === 'missing') {
      const position = Math.floor(random() * syllables.length);
      const answer = syllables[position];
      const others = unique(lesson.pool.flatMap(v => v.split('|'))).filter(v => v !== answer);
      const masked = syllables.map((v, i) => i === position ? '□' : v).join(' | ');
      return choice('missing', 'Сверься с целым словом-образцом. Вставь пропущенный СЛОГ, затем прочитай слово взрослому.',
        word + '\n' + masked, word, [answer].concat(shuffle(others, random).slice(0, 2)), [answer], random, support);
    }
    return choice('bridge', 'Соедини готовые слоги. Выбери целое слово, затем прочитай его взрослому: совпадение карточек не заменяет чтение.',
      syllables.join(' | '), word, [word].concat(shuffle(lesson.pool.map(whole).filter(v => v !== word), random).slice(0, 2)), [word], random, support);
  }

  // One-based positions, authored in learning-notes.md §7, NOT inferred from spelling.
  const stressKeys = {
    lesson062: {'ЛУ|НА': 2, 'РА|МА': 1, 'ПА|НА|МА': 2, 'МО|ЛО|КО': 3},
    lesson094: {'УМ': 1, 'ЩУ|КА': 1, 'ПА|НА|МА': 2, 'СА|МО|КАТ': 3}
  };

  function countQuestion(unit, random) {
    const word = whole(unit);
    return choice('syllable-sort', 'Прочитай слово. Сколько в нём слогов? Считай гласные, а не длину слова.',
      word, word, ['1', '2', '3'], [String(countSyllables(unit))], random, {word});
  }

  function syllableQuestion(lesson, unit, slot, random, mechanics) {
    const word = whole(unit);
    // Four different stress words in 062, with separate listening/independent trials.
    const mechanic = lesson.id === 'lesson062' ? (slot % 5 < 4 ? 'stress' : 'syllable-sort') : mechanics[slot % mechanics.length];
    if (mechanic === 'stress' && stressKeys[lesson.id] && stressKeys[lesson.id][unit]) {
      const syllables = unit.split('|');
      const answer = syllables[stressKeys[lesson.id][unit] - 1];
      const listen = slot % 2 === 0;
      return choice('stress', listen ? 'Послушай слово и выбери слог, который звучит сильнее. Это тренировка на слух.'
        : 'Прочитай слово самостоятельно. Выбери ударный слог.',
      word, word, syllables, [answer], random, {word, mode: listen ? 'listen' : 'read', audio: word});
    }
    const count = countSyllables(unit);
    if (mechanic === 'odd') {
      const groups = unique(lesson.pool.map(countSyllables)).filter(n => n !== count && lesson.pool.filter(v => countSyllables(v) === n).length >= 2);
      if (groups.length) {
        const common = pick(groups, random);
        const others = shuffle(lesson.pool.filter(v => countSyllables(v) === common), random).slice(0, 2).map(whole);
        return choice('odd', 'Найди слово, в котором число слогов НЕ ' + common + '.', String(common), word,
          [word].concat(others), [word], random, {word});
      }
    }
    if (mechanic === 'bridge' || (mechanic === 'syllable-sort' && slot % 2 === 1)) {
      const others = shuffle(lesson.pool.filter(v => countSyllables(v) !== count), random).slice(0, 2).map(whole);
      if (others.length) return choice('syllable-sort', 'В каком слове число слогов — ' + count + '?', String(count), word,
        [word].concat(others), [word], random, {word});
    }
    return countQuestion(unit, random);
  }

  const signQuestions = {
    КОНЬ: 'В каком слове Ь показывает мягкость Н?',
    МЫШЬ: 'В каком слове Ь не делает Ш мягким?',
    СЕМЬЯ: 'В каком слове Ь разделяет чтение перед Я?',
    СЪЕЛ: 'В каком слове чтение разделяет Ъ?'
  };

  function rulesQuestion(lesson, unit, slot, random) {
    const word = whole(unit);
    const words = lesson.pool.map(whole);
    if (lesson.id === 'lesson057') {
      if (slot % 5 === 4) return countQuestion(unit, random);
      const closed = countSyllables(unit) === 1;
      if (slot % 5 < 2) {
        const others = words.filter(v => (countSyllables(v) === 1) !== closed);
        const prompt = slot % 5 === 0
          ? (closed ? 'Выбери слово из одного закрытого слога: он заканчивается согласным.' : 'Выбери слово из двух открытых слогов: каждый заканчивается гласным.')
          : (closed ? 'Найди слово НЕ из двух открытых слогов.' : 'Найди слово, в котором НЕ один закрытый слог.');
        return choice(slot % 5 === 0 ? 'syllable-sort' : 'odd', prompt, words.join(' · '), word,
          [word].concat(others), [word], random, {word});
      }
      const end = word.slice(-1);
      return choice('blend', closed ? 'Прочитай слово до конца. Какая согласная закрывает слог?'
        : 'Прочитай слово до конца. Какой гласной заканчивается последний открытый слог?',
      word, word, [end].concat(shuffle(unique(words.join('')).filter(v => v !== end), random).slice(0, 2)), [end], random,
      {word, requiresAdult: true});
    }
    if (lesson.id === 'lesson072') {
      const syllable = unit.split('|').find(v => v === 'ЖИ' || v === 'ШИ');
      if (slot % 5 === 4) {
        const options = shuffle(words, random);
        return Object.assign(base('many', 'bridge', 'Выбери ВСЕ слова со слогом ' + syllable + '. Прочитай их взрослому: Ж и Ш остаются твёрдыми.',
          syllable, word, options, {word, requiresAdult: true}),
        {correct: options.map((v, i) => v.includes(syllable) ? i : -1).filter(i => i >= 0)});
      }
      if (slot % 2 === 0) {
        return choice('missing', 'Вставь букву после ' + syllable[0] + '. Как пишется это слово?',
          word.replace(syllable, syllable[0] + '□'), word, ['И', 'Ы'], ['И'], random, {word, audio: word});
      }
      const listen = slot % 5 === 1;
      return choice('blend', (listen ? 'Послушай слово. ' : 'Прочитай слово. ') + 'Как звучит ' + syllable[0] + ' перед И: твёрдо или мягко?',
        word, word, ['Твёрдо', 'Мягко'], ['Твёрдо'], random,
        {word, mode: listen ? 'listen' : 'read', requiresAdult: !listen, audio: word});
    }
    if (lesson.id === 'lesson088') {
      if (slot % 5 === 4) {
        const question = countQuestion(unit, random);
        question.prompt = 'Сколько в слове слогов? Ь и Ъ не имеют своего звука и не образуют слога.';
        return question;
      }
      return choice(slot % 2 === 0 ? 'letter-find' : 'blend', signQuestions[word], words.join(' · '), word,
        [word].concat(shuffle(words.filter(v => v !== word), random).slice(0, 2)), [word], random,
        {word, questionId: lesson.id + ':' + word});
    }
    throw new RangeError('No authored rule for ' + lesson.id);
  }

  // Authored semantic keys, in pool order (learning-notes.md lines 273–307).
  const sentenceKeys = {
    lesson095: [['Кто читает?', 'Мама'], ['Кто рисует?', 'Папа'], ['Кто спит?', 'Кот'], ['Кто летит?', 'Сова']],
    lesson096: [['Где мяч?', 'Под столом'], ['Где книга?', 'На полке'], ['Где кот?', 'У окна'], ['Где чашка?', 'На столе']],
    lesson097: [['Что нужно коту?', 'Миска'], ['Что нужно маме?', 'Книга'], ['Что нужно папе?', 'Молоток'], ['Что нужно сове?', 'Гнездо']],
    lesson098: [['Один кот или несколько?', 'Один'], ['Один кот или несколько?', 'Несколько'], ['Один мяч или несколько?', 'Один'], ['Один мяч или несколько?', 'Несколько']],
    lesson099: [['Что у дома?', 'Сад'], ['Что в саду?', 'Розы'], ['Кто на розе?', 'Жук'], ['Где жук?', 'Под листом']],
    lesson100: [['Какие два действия названы?', 'Моет и режет'], ['Какие два действия названы?', 'Берёт и несёт'], ['Какие два действия названы?', 'Ест и спит'], ['Какие два действия названы?', 'Смотрит и летит']]
  };

  function sentenceQuestion(lesson, text, slot, random) {
    const index = lesson.pool.indexOf(text);
    if (slot === 4) {
      const words = text.split(' ');
      if (random() < 0.5) return sequence('sentence', 'Восстанови предложение по напечатанному образцу из целых слов. Затем прочитай взрослому: копирование не доказывает понимание.',
        text, text, words, random, {requiresAdult: true, audio: text});
      const position = Math.floor(random() * words.length);
      const answer = words[position];
      const candidates = unique(lesson.pool.flatMap(v => v.split(' '))).filter(v => v !== answer);
      return choice('missing', 'Сверься с полным предложением-образцом. Вставь пропущенное целое слово. Прочитай восстановленное предложение взрослому.',
        text + '\n' + words.map((v, i) => i === position ? '□' : v).join(' '), text,
        [answer].concat(shuffle(candidates, random).slice(0, 2)), [answer], random, {requiresAdult: true, audio: text});
    }
    const keys = sentenceKeys[lesson.id];
    const [prompt, answer] = keys[index];
    let candidates = unique(keys.map(row => row[1]));
    if (lesson.id === 'lesson099') candidates = index === 3 ? ['Под листом', 'На розе', 'У дома'] : ['Сад', 'Розы', 'Жук'];
    return choice('sentence', prompt, text, answer,
      [answer].concat(shuffle(candidates.filter(v => v !== answer), random).slice(0, 2)), [answer], random,
      {audio: text, questionId: lesson.id + ':' + index});
  }

  const storyKeys = {
    lesson101: [
      ['Из чего Нина полила розу?', 'Из лейки.', 'Из чашки.', 'Из миски.'],
      ['На что села бабочка?', 'На розу.', 'На стол.', 'На диван.'],
      ['Что Нина делала в конце?', 'Смотрела на бабочку.', 'Играла с мячом.', 'Раскрывала зонт.'],
      ['Что Нина полила?', 'Розу.', 'Дорогу.', 'Скамейку.']
    ],
    lesson102: [
      ['Куда закатился мяч?', 'Под диван.', 'Под стол.', 'За дверь.'],
      ['Кто достал мяч?', 'Мама.', 'Котёнок.', 'Папа.'],
      ['С чем играл котёнок?', 'С мячом.', 'С кубиком.', 'С лентой.'],
      ['Что котёнок стал делать в конце?', 'Снова играть.', 'Спать.', 'Пить воду.']
    ],
    lesson103: [
      ['Почему Лена раскрыла зонт?', 'Пошёл дождь.', 'Наступила ночь.', 'Выглянуло солнце.'],
      ['Что Лена взяла для прогулки?', 'Зонт.', 'Мяч.', 'Лейку.'],
      ['Где пошёл дождь?', 'Во дворе.', 'В комнате.', 'В шкафу.'],
      ['По чему стучали капли?', 'По зонту.', 'По мячу.', 'По книге.']
    ],
    lesson104: [
      ['Что Миша пустил в ручей?', 'Кораблик.', 'Мяч.', 'Листок.'],
      ['До чего доплыл кораблик?', 'До ветки.', 'До камня.', 'До моста.'],
      ['Откуда Миша достал кораблик?', 'Из воды.', 'Из сумки.', 'Из коробки.'],
      ['Из чего был кораблик?', 'Из бумаги.', 'Из дерева.', 'Из ткани.']
    ]
  };

  function storyPlan(lesson, random) {
    const order = shuffle([0, 1, 2, 3], random);
    order.push(pick(order, random));
    const text = lesson.pool.join('\n'); // Never shuffle, shorten, or fabricate a story.
    return order.map((index, slot) => {
      const [prompt, answer, ...distractors] = storyKeys[lesson.id][index];
      return choice('story', (slot === 4 ? 'Повтор для закрепления. ' : '') + prompt, text, answer,
        [answer].concat(distractors), [answer], random,
        {audio: text, questionId: lesson.id + ':' + 'abcd'[index]});
    });
  }

  function candidate(lesson, lessons, random) {
    if (lesson.kind === 'letter') return letterPlan(lesson, lessons, random);
    if (lesson.kind === 'story') return storyPlan(lesson, random);
    const mechanics = shuffle(lesson.mechanics, random);
    const order = shuffle(lesson.pool, random);
    // Five trials, without replacement until the real pool is exhausted (085 has six).
    if (order.length < 5) order.push(...shuffle(lesson.pool.filter(v => v !== order[order.length - 1]), random));
    const seen = new Set();
    return order.slice(0, 5).map((unit, slot) => {
      let question;
      let key;
      for (let attempt = 0; attempt < 16; attempt++) {
        const variation = slot + attempt;
        if (['open', 'soft', 'reverse'].includes(lesson.kind)) question = soundQuestion(lesson, unit, variation, random, mechanics);
        else if (lesson.kind === 'merge2' || lesson.kind === 'merge3') question = mergeQuestion(lesson, unit, variation, random, mechanics);
        else if (lesson.kind === 'syllable') question = syllableQuestion(lesson, unit, variation, random, mechanics);
        else if (lesson.kind === 'rules') question = rulesQuestion(lesson, unit, variation, random);
        else if (lesson.kind === 'sentence') question = sentenceQuestion(lesson, unit, slot, random);
        else throw new RangeError('Unsupported lesson kind: ' + lesson.kind);
        key = JSON.stringify(semantic(question));
        if (!seen.has(key)) break;
      }
      if (seen.has(key)) question.prompt = 'Повтор для закрепления. ' + question.prompt;
      seen.add(JSON.stringify(semantic(question)));
      return question;
    });
  }

  function plan(lessonId, seed, previousSignature = '') {
    const lessons = window.ORI_LEARNING && window.ORI_LEARNING.lessons;
    if (!Array.isArray(lessons)) throw new Error('Load learning.js before calling ORI_ENGINE.plan');
    const lesson = lessons.find(item => item.id === lessonId);
    if (!lesson) throw new RangeError('Unknown lesson: ' + lessonId);
    if ((typeof seed !== 'string' && typeof seed !== 'number') || (typeof seed === 'number' && !Number.isFinite(seed))) {
      throw new TypeError('seed must be a finite number or a string');
    }
    if (typeof previousSignature !== 'string') throw new TypeError('previousSignature must be a string');
    const normalizedSeed = typeof seed === 'number' ? seed >>> 0 : hash(seed);
    const random = mulberry32(hash(version + '|' + lessonId + '|' + normalizedSeed));
    let result;
    for (let attempt = 0; attempt < 16; attempt++) {
      const questions = candidate(lesson, lessons, random);
      result = {questions, signature: signature(lessonId, questions), version};
      if (result.signature !== previousSignature) return result;
    }
    // Finite safe pool: returning a genuine repeat is preferable to inventing material.
    return result;
  }

  window.ORI_ENGINE = Object.freeze({plan, signature, hash, version});
})(window);

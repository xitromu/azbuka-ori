const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'mockups', 'voice-v2');
const html = fs.readFileSync(path.join(root, 'v2.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const element = () => ({ dataset:{}, classList:{add(){},remove(){},toggle(){}}, style:{setProperty(){}}, children:[] });
const context = vm.createContext({
  console, URL, performance, setTimeout:()=>0, clearTimeout(){},
  document:{addEventListener(){},querySelector:element,querySelectorAll:()=>[]},
  navigator:{onLine:true}, location:{protocol:'file:',href:'file:///v2.html'},
  localStorage:{getItem:()=>null,setItem(){}},
});
context.window = context;
const bootstrap = /\$\('#snd'\)\.textContent=S\.sound\?[^;]+;voiceInit\(\);menu\(\);setTimeout\(voiceCheck,2500\);/;
if (!bootstrap.test(source)) throw new Error('Не найден запуск игры');
vm.runInContext(source.replace(bootstrap,''), context, {timeout:5000});

function literals(js) {
  const result = [];
  for (let i=0;i<js.length;) {
    if (js.slice(i,i+2)==='//') {const end=js.indexOf('\n',i);i=end<0?js.length:end;continue;}
    if (js.slice(i,i+2)==='/*') {const end=js.indexOf('*/',i+2);i=end<0?js.length:end+2;continue;}
    const quote=js[i];
    if (!['\'', '"', '`'].includes(quote)) {i++;continue;}
    let value='',j=i+1;
    for(;j<js.length && js[j]!==quote;j++) {
      if(js[j]==='\\') {value+=js[++j]||'';continue;}
      value+=js[j];
    }
    result.push(value);i=j+1;
  }
  return result;
}
context.staticPhrases = literals(source).filter(s => /[А-Яа-яЁё]/.test(s) && !s.includes('${') && !/[<>]/.test(s) && /[.!?…:]$/.test(s));
const collect = `(async () => {
  const phrases = new Map(), roles = ['ori',...STUDENTS.map(s=>s.id)];
  const rec = (text,who='ori') => {
    if(text===undefined || text===null)return;
    text=String(text).replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim();
    if(!text || !/[а-яё]/i.test(text))return;
    if(!roles.includes(who))throw new Error('Неизвестный персонаж: '+who);
    phrases.set(who+'|'+text,{text,who});
  };
  const success = s => {if(s)rec(s.voice||s.text);};
  const reactions = [...PRAISE,...ENCOURAGE];
  const specific = new Set([...STUDENTS.map(s=>s.hi),...reactions.filter(r=>r[1]).map(r=>r[0]),'Бип-боп! Я тоже хочу учиться читать!']);
  staticPhrases.filter(t=>!specific.has(t)).forEach(t=>rec(t));
  STUDENTS.forEach(s=>rec(s.hi,s.id));
  reactions.forEach(([text,who])=>rec(text,who));
  rec('Бип-боп! Я тоже хочу учиться читать!','alien1');
  window.speak = async (text,who) => rec(text,who);
  window.say = window.sayWait = async (text,voice,who) => rec(voice||text,who);
  window.happy = async (text,voice) => rec(voice||text);
  window.give = async (tries,s) => success(s);
  window.tell = async (text,o={}) => rec(o.voice||text);
  window.askChoice = async a => {
    rec(a.voice||a.text);rec(a.hintVoice||a.hint);success(a.success);
    const good=a.options.filter(o=>o.ok);
    if(good.length!==1)throw new Error('Неверное число ответов: '+a.text);
    a.options.forEach(o=>{if(a.readOptions!==false)rec(o.speech||o.label);rec(o.sayVoice||o.say);success(o.success);});
    return good[0];
  };
  window.askMany = async a => {rec(a.voice||a.text);success(a.success);a.options.forEach(o=>rec(o.say));};
  window.askSequence = async a => {
    rec(a.voice||a.text);success(a.success);
    [...a.answer].forEach((c,i)=>{rec(soundToken(c));rec('Посмотри: следующая буква должна стоять на месте номер '+(i+1)+'.');});
  };
  window.catchWaves = async (waves,forced) => {
    for(const target of forced?[forced]:CATCH_POOL){
      rec('Лопни все пузыри с буквой '+nameToken(target)+'!');rec(nameToken(target));
      for(const ch of CATCH_POOL.filter(c=>c!==target))rec('Это буква '+nameToken(ch)+'. А мы ищем '+nameToken(target)+'!');
    }
  };
  window.letterBonus = async ch => {await radarRound(ch);await oddRound(ch);if(LETTER[ch].kind!=='sign')await catchWaves(1,ch);};
  window.gameMemory = async () => {CATCH_POOL.forEach(ch=>rec(nameToken(ch)));};
  LETTERS.forEach(d=>{rec(nameToken(d.ch));if(d.kind!=='sign')rec(soundToken(d.ch));rec(d.word);});
  Object.values(WORDBANK).flat().forEach(w=>rec(w.word));
  GIFTS.forEach(g=>rec(g.hi));
  for(let n=1;n<=Math.max(...GIFTS.map(g=>g.price));n++)rec('Нужно ещё '+n+' кристаллов. Пройди ещё один урок!');
  const audit=[];
  for(const def of LESSONS){L={def,errors:0,earned:0,student:0};await def.run();audit.push(def.id);}
  for(const def of GAMES){L={def,errors:0,earned:0,student:0};if(def.id==='game_memory')await gameMemory();else await def.run();audit.push(def.id);}
  const parts=Object.fromEntries(roles.map(who=>[who,new Set()]));
  for(const {text,who} of phrases.values())voiceParts(text).forEach(part=>parts[who].add(part));
  const keys=new Map();
  for(const who of roles)for(const part of parts[who]){
    const key=voiceKey(part,who);
    if(keys.has(key)&&keys.get(key)!==part)throw new Error('Коллизия ключей: '+key);
    keys.set(key,part);
  }
  return {parts:Object.fromEntries(roles.map(who=>[who,[...parts[who]].sort()])),phrases:[...phrases.values()],audit};
})()`;
vm.runInContext(collect,context,{timeout:30000}).then(result=>{
  fs.mkdirSync(out,{recursive:true});
  for(const [name,value] of Object.entries(result))fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2)+'\n');
  console.log('Уроков и мини-игр:',result.audit.length,'; фраз:',result.phrases.length);
  for(const [who,parts] of Object.entries(result.parts))console.log(who+': '+parts.length+' фрагментов');
}).catch(error=>{console.error(error);process.exitCode=1;});

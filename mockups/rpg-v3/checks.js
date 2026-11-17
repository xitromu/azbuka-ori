'use strict';
function auditPrototype(){
 const errors=[],assert=(ok,message)=>{if(!ok)errors.push(message);};
 const lessons=ORI_LEARNING.lessons,chapters=ORI_LEARNING.chapters,items=ORI_REWARDS.items,lines=[...ORI_LEARNING.lines,...ORI_REWARDS.lines];
 assert(lessons.length===104,'Нужно ровно 104 урока');
 assert(items.length===44,'Нужно ровно 44 покупки');
 assert(chapters.length===8,'Нужно восемь глав');
 const kinds={letter:33,open:18,soft:8,reverse:4,rules:3,merge2:16,merge3:8,syllable:4,sentence:6,story:4};
 for(const [kind,count] of Object.entries(kinds))assert(lessons.filter(l=>l.kind===kind).length===count,'Неверное количество: '+kind);
 assert(new Set(lessons.filter(l=>l.kind==='letter').map(l=>l.sample.answer)).size===33,'Нужны все 33 разные буквы');
 for(const [name,list] of [['уроки',lessons],['главы',chapters],['товары',items],['реплики',lines]])assert(new Set(list.map(x=>x.id)).size===list.length,'Неуникальные ID: '+name);
 const ids=new Set(lessons.map(l=>l.id)),lineIds=new Set(lines.map(l=>l.id)),chapterIds=new Set(chapters.map(c=>c.id));
 for(const l of lessons){
  assert(chapterIds.has(l.chapter),'Неизвестная глава: '+l.id);
  assert(l.pool.length>=4,'Маленький пул: '+l.id);
  for(const key of ['introLine','hintLine','outroLine'])assert(lineIds.has(l[key]),'Неизвестная реплика: '+l.id+'/'+key);
  for(const id of l.prerequisites)assert(ids.has(id),'Неизвестная предпосылка: '+l.id+'/'+id);
  for(const mechanic of l.mechanics)assert(modes.some(x=>x[0]===mechanic),'Неизвестная механика: '+mechanic);
  assert(Boolean(l.sample.prompt)&&Boolean(l.sample.answer),'Нет примера: '+l.id);
  assert(l.sample.options.filter(x=>x===l.sample.answer).length===1,'Неоднозначный пример: '+l.id);
  if(['merge2','merge3'].includes(l.kind))for(const unit of l.pool){const parts=unit.split('|');assert(parts.length===(l.kind==='merge2'?2:3),'Неверное число слогов: '+l.id);assert(parts.every(p=>(p.match(/[АЕЁИОУЫЭЮЯ]/g)||[]).length===1),'Неверное число гласных в слоге: '+l.id);}
 }
 const visiting=new Set(),visited=new Set();
 function visit(id){if(visiting.has(id)){errors.push('Цикл предпосылок: '+id);return;}if(visited.has(id))return;visiting.add(id);for(const p of lessons.find(l=>l.id===id)?.prerequisites||[])visit(p);visiting.delete(id);visited.add(id);}
 lessons.forEach(l=>visit(l.id));
 for(const i of items){assert(i.price>0,'Неположительная цена: '+i.id);assert(lineIds.has(i.purchaseLine),'Нет реплики покупки: '+i.id);assert(lineIds.has(i.tapLine),'Нет реплики касания: '+i.id);assert(Boolean(i.interaction),'Нет взаимодействия: '+i.id);}
 for(const l of lines)assert(['ori','alien1','alien2','alien3'].includes(l.who),'Неизвестный голос: '+l.id);
 const prices={plant:30,garland:35,lamp:40,holo:45,confetti:50,fireworks:55,music:60,robot:75,paint:90};
 for(const [id,price] of Object.entries(prices))assert(items.find(i=>i.id===id)?.price===price,'Изменён прежний товар: '+id);
 const artIds=items.filter(i=>i.category!=='effects'&&i.id!=='paint').map(i=>i.id);
 assert(Object.keys(ORI_ART).length===36,'Нужно 36 растровых иллюстраций');
 for(const id of artIds)assert(Boolean(ORI_ART[id]?.reviewed),'Нет проверенного изображения: '+id);
 let plans=0;
 for(const [mode] of modes){
  const signatures=new Set();
  for(let seed=1;seed<=100;seed++){
   const g=buildGame(mode,seed,0),same=buildGame(mode,seed,0);plans++;
   assert(JSON.stringify(g)===JSON.stringify(same),'Невоспроизводимый seed: '+mode+'/'+seed);
   assert(g.options.length>=2,'Нет выбора: '+mode+'/'+seed);
   if(['blend','bridge','train'].includes(mode)){
    const stock=[...g.options];for(const part of g.parts){const index=stock.indexOf(part);assert(index>=0,'Не хватает слога: '+mode+'/'+seed);if(index>=0)stock.splice(index,1);}
    assert(g.word===g.parts.join(''),'Слово не соответствует слогам');
   }else if(mode==='memory'){
    const counts={};g.options.forEach(s=>counts[s]=(counts[s]||0)+1);assert(Object.values(counts).every(x=>x===2),'Непарная память');
   }else{
    assert(g.correct.length>0,'Нет решения: '+mode+'/'+seed);
    if(!['letter-find','bubble'].includes(mode))assert(g.correct.length===1,'Неоднозначный ответ: '+mode+'/'+seed);
    assert(g.correct.every(i=>i>=0&&i<g.options.length),'Индекс ответа вне диапазона');
   }
   signatures.add(JSON.stringify([g.word,g.target,g.text,g.options,g.correct]));
  }
  assert(signatures.size>1,'Нет вариативности: '+mode);
 }
 const views={home,map:mapView,chapter:chapterView,play,result,shop,item:itemView,wardrobe,pets,room,album,quests,passport,games,settings,curriculum,lines:linesView,documents};
 for(const [name,view] of Object.entries(views)){try{assert(view().length>100,'Пустой экран: '+name);}catch(error){errors.push('Ошибка экрана '+name+': '+error);}}
 return {lessons:lessons.length,chapters:chapters.length,items:items.length,lines:lines.length,mechanics:modes.length,seedChecks:plans,screens:Object.keys(views).length,images:Object.keys(ORI_ART).length,catalogCost:items.reduce((sum,i)=>sum+i.price,0),errors};
}
const auditNode=document.createElement('pre');
auditNode.id='audit-output';
auditNode.hidden=true;
try{auditNode.textContent=JSON.stringify(auditPrototype());}catch(error){auditNode.textContent=JSON.stringify({errors:[String(error)]});}
document.body.appendChild(auditNode);

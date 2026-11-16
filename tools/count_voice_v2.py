import re, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
src = (ROOT/'v2.html').read_text(encoding='utf-8')
js = src[src.index('<script'):]
m = re.search(r"const VOICE_KEYS = new Set\('([^']*)'", src)
HAVE = set(m.group(1).split())

def literals(js):
    out,i,n=[],0,len(js)
    while i<n:
        c=js[i]
        if c=='/' and js[i+1:i+2]=='/':
            i=js.find('\n',i); i=n if i<0 else i; continue
        if c=='/' and js[i+1:i+2]=='*':
            i=js.find('*/',i+2); i=n if i<0 else i+2; continue
        if c in "'\"`":
            j,buf=i+1,[]
            while j<n and js[j]!=c:
                if js[j]=='\\': buf.append(js[j+1:j+2]); j+=2; continue
                if js[j]=='\n' and c!='`': break
                buf.append(js[j]); j+=1
            out.append(''.join(buf)); i=j+1; continue
        i+=1
    return out

ui=set(re.findall(r"name:'([^']+)'",src))|set(re.findall(r"name: '([^']+)'",src))
static=[]
for s in literals(js):
    s=s.strip()
    if not re.search('[А-Яа-яЁё]',s) or '${' in s or re.search('<[a-z/]',s) or s in ui: continue
    if re.search(r'[.!?…:]$',s) or len(s.split())>=2: static.append(s)
static=sorted(set(static))

CH=[x for x in 'АОУЫЭМНЛРСТДПБКГИЕЁЮЯЗФВХЙШЖЧЩЦЬЪ']
BANK={}
for km in re.finditer(r"'([А-ЯЁ])':\[(.*?)\]",src,re.S):
    BANK[km.group(1)]=[{'word':w} for w in re.findall(r"word:'([^']+)'",km.group(2))]
def nt(c): return '#'+c.lower()
def st(c): return '#з_'+c.lower()
dyn=[]
for c in CH:
    other=[x for x in CH if x!=c and x not in 'ЬЪ'][0]
    dyn.append(f'Лопни все пузыри с буквой {nt(c)}!')
    dyn.append(f'Это буква {nt(c)}. А мы ищем {nt(other)}!')
    tok = nt(c) if c in 'ЬЪ' else st(c)
    dyn.append(f'Послушай: {tok}. Найди эту букву.')
    dyn.append(f'Верно! Это буква {nt(c)}.')
    for cw in ('Два слова','Три слова'):
        dyn.append(f'{cw} начинаются на букву {nt(c)}. Найди лишнюю картинку!')
    dyn.append(f'Послушай слова ещё раз и найди то, что начинается не на букву {nt(c)}.')
for c,words in BANK.items():
    oddc=[k for k in BANK if k!=c][0]
    for w in words:
        dyn.append(w['word'])
    dyn.append('Это слово начинается на ту же букву. Ищем лишнее!')
    dyn.append(f'Верно! Лишнее слово начинается на букву {nt(oddc)}, а не на {nt(c)}.')

EMO=re.compile('[\U0001F000-\U0001FFFF☀-➿️▶←↺✔✘«»]')
VT=re.compile(r'#[а-яё](?:_[а-яё]+)?|\d+')
def parts(t):
    s=EMO.sub('',str(t)); s=re.sub(r'\s+',' ',s).strip(); out=[]; last=0
    def chunk(x):
        x=re.sub(r'^[\s.,:;!?…—–-]+','',x).strip()
        if re.search('[а-яё]',x,re.I): out.append(x)
    for mm in VT.finditer(s):
        chunk(s[last:mm.start()]); g=mm.group(); out.append(g if g[0]=='#' else '#'+g); last=mm.end()
    chunk(s[last:]); return out
def vkey(s):
    x=5381
    for ch in s: x=((x*33)^ord(ch))&0xFFFFFFFF
    return format(x,'x')

allph=sorted(set(static)|set(dyn))
frag=set()
for t in allph:
    for p in parts(t): frag.add(p)
new=sorted(p for p in frag if vkey(p) not in HAVE)
print('static phrases:',len(static),'dynamic:',len(dyn),'total phrases:',len(allph))
print('total fragments:',len(frag),'already recorded:',len(frag)-len(new),'NEW to record:',len(new))
(ROOT/'tools'/'voice_v2_new.json').write_text(json.dumps(new,ensure_ascii=False,indent=1),encoding='utf-8')
for p in new: print(' ',p)
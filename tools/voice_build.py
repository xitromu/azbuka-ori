"""Записывает фрагменты голосом Ори и вписывает их ключи в index.html.
Запуск: C:\projects\CHESS\voicekit\.venv\Scripts\python.exe -u tools\voice_build.py
Дополнительно: --redo "букв|слог" или --limit 10 для пробы.
"""
import argparse
import csv
import json
import re
import sys
import time
from pathlib import Path

KIT = Path(r"C:\projects\CHESS\voicekit")
sys.path.insert(0, str(KIT))
import voice_tool as V  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
WORK, CLIPS, HTML = ROOT / "mockups" / "voice", ROOT / "voice", ROOT / "index.html"
SPEAKER, TEMPO, KBPS = "aidar", 1.05, 40
NAMES = dict(а="а",б="бэ",в="вэ",г="гэ",д="дэ",е="е",ё="ё",ж="жэ",з="зэ",и="и",й="и краткое",к="ка",л="эл",м="эм",н="эн",о="о",п="пэ",р="эр",с="эс",т="тэ",у="у",ф="эф",х="ха",ц="цэ",ч="чэ",ш="ша",щ="ща",ъ="твёрдый знак",ы="ы",ь="мягкий знак",э="э",ю="ю",я="я")
SUPPORT = dict(б="ба",г="га",д="да",п="па",т="та",к="ка",й="йа",ч="ча",щ="ща",ц="ца",ё="йо йо")
ONES = ["ноль","один","два","три","четыре","пять","шесть","семь","восемь","девять","десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать","шестнадцать","семнадцать","восемнадцать","девятнадцать"]
TENS = ["","","двадцать","тридцать","сорок","пятьдесят","шестьдесят","семьдесят","восемьдесят","девяносто"]
SAY = [(r"р-р-р", "ррр"), (r"^Какая буква", "Ккая буква"), (r"^Прочитай", "Ппрочитай")]
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")
log_file = None


def log(*a):
    line = " ".join([time.strftime("%H:%M:%S")] + [str(x) for x in a])
    print(line, flush=True)
    log_file.write(line + "\n")
    log_file.flush()


def number(n):
    if n < 20: return ONES[n]
    return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])


def spoken(part):
    if not part.startswith("#"):
        for a, b in SAY: part = re.sub(a, b, part)
        if len(part.strip()) == 1: return "Буква " + ("йо" if part.lower() == "ё" else part) + "."
        if re.fullmatch(r"[А-ЯЁ]+", part): return part + "!"
        return part
    t = part[1:]
    if t.isdigit(): return number(int(t))
    if t.startswith("с_"): return t[2:] + "!"
    if t.startswith("з_"):
        c = t[2:]
        return SUPPORT.get(c, c * 3)
    if t == "ё": return "Буква йо."
    name = NAMES[t]
    return name if len(name) > 1 else "Буква " + t + "."


def main():
    global log_file
    ap = argparse.ArgumentParser()
    ap.add_argument("--redo")
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()
    WORK.mkdir(parents=True, exist_ok=True)
    CLIPS.mkdir(parents=True, exist_ok=True)
    log_file = open(WORK / "build.log", "a", encoding="utf-8")
    parts = sorted(json.loads((WORK / "parts.json").read_text(encoding="utf-8")), key=len)
    keys = {V.hkey(p): p for p in parts}
    if len(keys) != len(parts): sys.exit("Совпали ключи разных фрагментов")
    report = {}
    if (WORK / "report.csv").exists():
        with open(WORK / "report.csv", encoding="utf-8") as f: report = {r["key"]: r for r in csv.DictReader(f)}
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    todo = [p for p in parts if not (CLIPS / f"{V.hkey(p)}.mp3").exists() or (args.redo and re.search(args.redo, spoken(p), re.I))]
    if args.limit: todo = todo[:args.limit]
    log(f"device {device}; fragments {len(parts)}, to record {len(todo)}")
    if todo:
        stress = V.load_stress(KIT / "stress.txt")
        stress.update(V.load_stress(ROOT / "tools" / "voice_stress.txt"))
        engine = V.SileroEngine(SPEAKER, device)
        log("loading speech checker")
        checker = V.Checker(device, "openai/whisper-large-v3-turbo")
        keywords = set("буква слог слово арбуз окно утка рыба экран мама нос луна сок торт дом пароход банан кот гриб игла ель ёлка юбка яблоко зонт флаг ваза хлеб йогурт шар жук чашка щётка цветок мышь подъезд".split())
        t0 = time.time()
        for i, p in enumerate(todo):
            text = spoken(p)
            best = (-9.0, None, "")
            sources = [text]
            if re.fullmatch(r"[А-ЯЁа-яё]{2}!", text): sources.append(text[:-1])
            sources.append("Слог " + text.rstrip("!.").lower() + ".")
            for attempt, source in enumerate(sources):
                for v in engine.variants(source, stress):
                    log(f"record {i+1}/{len(todo)}: {p!r} -> {v!r}")
                    try:
                        y = engine.model.apply_tts(text=v, speaker=SPEAKER, sample_rate=engine.sr, put_accent=True, put_yo=False).detach().cpu().numpy().astype("float32")
                    except ValueError as e:
                        log(f"synthesis failed: {e}")
                        continue
                    heard = checker(y, engine.sr)
                    sc = V.score(p if not p.startswith("#") else text, heard, keywords)
                    if sc > best[0]: best = (sc, y, heard)
                    if sc >= .97: break
                if best[0] >= .97 or (len(sources) == 1 and best[1] is not None): break
                if not re.fullmatch(r"[А-ЯЁ]+[!.]?", text): break
                log(f"retry as a syllable: {text!r}")
            if best[1] is None: raise RuntimeError(f"Не удалось озвучить {p!r} ({text!r})")
            y, sr = V.postprocess(best[1], engine.sr, 1.0, TEMPO)
            (CLIPS / f"{V.hkey(p)}.mp3").write_bytes(V.to_mp3(y, sr, KBPS))
            report[V.hkey(p)] = {"key": V.hkey(p), "text": p, "score": round(best[0], 3), "heard": best[2]}
            if i % 20 == 0 or i == len(todo) - 1:
                speed = (i + 1) / (time.time() - t0)
                log(f"{i+1}/{len(todo)}, {speed:.2f}/s, last: {text[:65]}")
    rows = sorted([report[k] for k in keys if k in report], key=lambda r: float(r["score"]))
    with open(WORK / "report.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["key","text","score","heard"]); w.writeheader(); w.writerows(rows)
    gone = [f for f in CLIPS.glob("*.mp3") if f.stem not in keys]
    for f in gone: f.unlink()
    have = sorted(k for k in keys if (CLIPS / f"{k}.mp3").exists())
    size = sum((CLIPS / f"{k}.mp3").stat().st_size for k in have)
    html = HTML.read_text(encoding="utf-8")
    block = "// VOICE START (вписывает tools/voice_build.py)\nconst VOICE_KEYS = new Set('" + " ".join(have) + "'.split(' ').filter(Boolean));\n" + f"const VOICE_MB = {max(1, round(size / 1e6))};\n// VOICE END"
    new, n = re.subn(r"// VOICE START.*?// VOICE END", lambda m: block, html, flags=re.S)
    if n != 1: sys.exit("В index.html нет блока VOICE")
    HTML.write_text(new, encoding="utf-8", newline="\n")
    weak = [r for r in rows if float(r["score"]) < .8]
    log(f"recorded {len(have)}/{len(parts)}, {size/1e6:.1f} MB; removed {len(gone)}; weak {len(weak)}")
    for r in weak[:20]: log(f"  {r['score']} {r['text'][:60]} -> {r['heard'][:60]}")
    log("done")


if __name__ == "__main__": main()

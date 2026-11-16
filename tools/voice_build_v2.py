import argparse
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
KIT = Path(r"C:\projects\CHESS\voicekit")
sys.path.insert(0, str(KIT))
import numpy as np
import torch
import voice_tool as V
import voice_build as base

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "mockups" / "voice-v2"
CLIPS = ROOT / "voice-v2"
MODEL = KIT / ".cache/torch/hub/snakers4_silero-models_master/src/silero/model/v5_ru.pt"
PROFILES = {
    "ori": ("eugene", 1.06, .98),
    "alien1": ("kseniya", 1.16, 1.04),
    "alien2": ("eugene", .96, 1.0),
    "alien3": ("xenia", 1.22, 1.04),
}
SOUNDS = {**base.SUPPORT, "е": "йэ", "ё": "йо", "ю": "йу", "я": "йа"}
DICTION = {"Кто плывёт?": "Скажи, кто плывёт?", "КОТ СПИТ.": "Кот, спит."}


def spoken(part):
    if part.startswith("#"):
        token = part[1:]
        if token.isdigit():
            return base.number(int(token)) + "."
        if token.startswith("с_"):
            return token[2:] + "!"
        if token.startswith("з_"):
            letter = token[2:]
            return SOUNDS.get(letter, letter * 3) + "!"
        return ("йо" if token == "ё" else base.NAMES[token]) + "!"
    text = re.sub(r"\[([а-яё-]+)\]", lambda m: SOUNDS.get(m[1], m[1]), DICTION.get(part, part))
    text = re.sub(r"(\b[Бб]укв[ауыойе]+\s+)([А-ЯЁ])\b", lambda m: m[1] + base.NAMES[m[2].lower()], text)
    text = text.replace("Ори", "+Ори")
    text = V.apply_stress(text, V.load_stress(ROOT / "tools" / "voice_stress.txt"))
    return V.clean_for_tts(text)


def log(text):
    print(time.strftime("%H:%M:%S") + " " + text, flush=True)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    parser.add_argument("--redo")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    parts = json.loads((WORK / "parts.json").read_text(encoding="utf-8"))
    report_path = WORK / "report.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}
    entries = [(who, part) for who, items in parts.items() for part in items]
    keys = {who + "/" + V.hkey(part): (who, part) for who, part in entries}
    if len(keys) != len(entries):
        raise RuntimeError("Коллизия ключей фрагментов")
    for who in PROFILES:
        (CLIPS / who).mkdir(parents=True, exist_ok=True)
    todo = []
    for key, (who, part) in keys.items():
        source = spoken(part)
        previous = report.get(key, {})
        if not (CLIPS / (key + ".mp3")).exists() or previous.get("profile") != list(PROFILES[who]) or previous.get("source") != source or (args.redo and re.search(args.redo, part, re.I)):
            todo.append((key, who, part, source))
    if args.limit is not None and args.limit < 1:
        parser.error("--limit должен быть положительным")
    deferred = todo[args.limit:] if args.limit else []
    if args.limit:
        todo = todo[:args.limit]
    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch.set_num_threads(4)
    torch.manual_seed(42)
    log(f"Устройство {device}; всего {len(keys)}; к записи {len(todo)}")
    if todo:
        model = torch.package.PackageImporter(str(MODEL)).load_pickle("tts_models", "model")
        model.to(device)
        for i, (key, who, part, source) in enumerate(todo, 1):
            speaker, pitch, tempo = PROFILES[who]
            with torch.inference_mode():
                raw = model.apply_tts(text=source, speaker=speaker, sample_rate=48000, put_accent=True, put_yo=True).detach().cpu().numpy().astype("float32")
            audio, sr = V.postprocess(raw, 48000, pitch, tempo)
            if not np.isfinite(audio).all() or len(audio) < sr * .15 or np.max(np.abs(audio)) < .05:
                raise RuntimeError(f"Некорректная запись: {key}, {part}")
            (CLIPS / (key + ".mp3")).write_bytes(V.to_mp3(audio, sr, 64))
            report[key] = {"text": part, "source": source, "profile": list(PROFILES[who]), "seconds": round(len(audio) / sr, 3)}
            if i % 25 == 0 or i == len(todo):
                report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                log(f"Записано {i}/{len(todo)}: {who}")
        del model
        if device == "cuda":
            torch.cuda.empty_cache()
    missing = [key for key in keys if not (CLIPS / (key + ".mp3")).exists()]
    if missing or deferred:
        log(f"Осталось обновить {len(set(missing) | {item[0] for item in deferred})} фрагментов; список в игре пока не обновлён")
        return
    digest = hashlib.sha256()
    size = 0
    for key in sorted(keys):
        data = (CLIPS / (key + ".mp3")).read_bytes()
        size += len(data)
        digest.update(key.encode())
        digest.update(data)
    version = digest.hexdigest()[:12]
    block = "// VOICE START (вписывает tools/voice_build_v2.py)\nconst VOICE_KEYS = new Set('" + " ".join(sorted(keys)) + "'.split(' ').filter(Boolean));\n"
    block += f"const VOICE_MB = {max(1, int(np.ceil(size / 1e6)))};\nconst VOICE_VERSION = '{version}';\n// VOICE END"
    html_path = ROOT / "v2.html"
    html = html_path.read_text(encoding="utf-8")
    updated, count = re.subn(r"// VOICE START.*?// VOICE END", lambda m: block, html, flags=re.S)
    if count != 1:
        raise RuntimeError("Не найден единственный блок VOICE")
    if updated != html:
        html_path.write_text(updated, encoding="utf-8", newline="\n")
    log(f"Подключено {len(keys)} записей, {size / 1e6:.2f} МБ, версия {version}")
    if args.check:
        import soundfile as sf
        checker = V.Checker(device, "openai/whisper-large-v3-turbo")
        check = [(key, row) for key, row in report.items() if key in keys and len(V.norm_words(row["source"])) >= 2 and "score" not in row]
        log(f"Проверка распознаванием: {len(check)} реплик")
        for i, (key, row) in enumerate(check, 1):
            audio, sr = sf.read(CLIPS / (key + ".mp3"), dtype="float32")
            heard = checker(audio, sr)
            row["heard"] = heard
            row["score"] = round(V.score(row["source"], heard, set()), 3)
            if i % 10 == 0 or i == len(check):
                report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                log(f"Проверено {i}/{len(check)}")
        for key, row in report.items():
            if key in keys and "heard" in row:
                normalized = re.sub(r"\d+", lambda m: base.number(int(m[0])) if int(m[0]) < 100 else m[0], row["heard"])
                row["score"] = round(V.score(row["source"], normalized, set()), 3)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        weak = [(key, row) for key, row in report.items() if key in keys and row.get("score", 1) < .8]
        log(f"Требуют внимания: {len(weak)}")
        for key, row in weak:
            log(f"{key}: {row['text']} -> {row['heard']} ({row['score']})")


if __name__ == "__main__":
    main()

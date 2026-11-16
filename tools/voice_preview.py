import json
import re
import sys
from pathlib import Path

KIT = Path(r"C:\projects\CHESS\voicekit")
sys.path.insert(0, str(KIT))
import numpy as np
import torch
import voice_tool as V

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "mockups" / "voice-casting"
MODEL = KIT / ".cache/torch/hub/snakers4_silero-models_master/src/silero/model/v5_ru.pt"
PROFILES = [
    ("ori", "a", "eugene", 1.06, .98),
    ("ori", "b", "aidar", 1.12, .98),
    ("alien1", "a", "xenia", 1.12, 1.04),
    ("alien1", "b", "kseniya", 1.16, 1.04),
    ("alien2", "a", "aidar", .90, .94),
    ("alien2", "b", "eugene", .96, 1.00),
    ("alien3", "a", "baya", 1.13, 1.03),
    ("alien3", "b", "xenia", 1.22, 1.04),
]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    source = (ROOT / "v2.html").read_text(encoding="utf-8")
    phrases = dict(re.findall(r"id:'(alien\d)', name:'[^']+', hi:'([^']+)'", source))
    phrases["ori"] = re.search(r"say\(pick\(\['(Привет! Я Ори\.[^']+)'", source).group(1)
    texts = {char: text.replace("Ори", "+Ори").replace("букву П", "букву пэ").replace("буквой К", "буквой ка") for char, text in phrases.items()}
    texts["ori"] += " Это буква а. Получился слог ма! Ёлка. Щётка."
    OUT.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(4)
    torch.manual_seed(42)
    model = torch.package.PackageImporter(str(MODEL)).load_pickle("tts_models", "model")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    print(f"Устройство: {device}; проб: {len(PROFILES)}", flush=True)
    report = []
    raw = {}
    for char, variant, speaker, pitch, tempo in PROFILES:
        key = (char, speaker)
        if key not in raw:
            with torch.inference_mode():
                raw[key] = model.apply_tts(text=texts[char], speaker=speaker, sample_rate=48000, put_accent=True, put_yo=True).detach().cpu().numpy().astype("float32")
        audio, sr = V.postprocess(raw[key].copy(), 48000, pitch, tempo)
        if not np.isfinite(audio).all() or len(audio) < sr or np.max(np.abs(audio)) < .05:
            raise RuntimeError(f"Некорректное аудио: {char}-{variant}")
        filename = f"{char}-{variant}.mp3"
        (OUT / filename).write_bytes(V.to_mp3(audio, sr, 64))
        report.append({"file": filename, "character": char, "variant": variant, "speaker": speaker, "pitch": pitch, "tempo": tempo, "seconds": round(len(audio) / sr, 2), "text": phrases[char], "tts_text": texts[char]})
        print(f"Готово {len(report)}/{len(PROFILES)}: {filename}, {len(audio) / sr:.1f} с", flush=True)
    (OUT / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Все пробы записаны. Игра и её текущая озвучка не изменены.", flush=True)


if __name__ == "__main__":
    main()

"""Offline Silero v5_ru build. Only writes voice-v3, tools/*v3*.json and rpg/voice-manifest.js.
Run voice_collect_v3.js first, then this script using the existing voicekit Python.
--verify-only decodes every manifest candidate and validates provenance without synthesis.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path

os.environ.setdefault('HF_HUB_OFFLINE', '1')
os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')
ROOT = Path(__file__).resolve().parent.parent
KIT = Path(r'C:\projects\CHESS\voicekit')
MODEL = KIT / '.cache/torch/hub/snakers4_silero-models_master/src/silero/model/v5_ru.pt'
sys.path.insert(0, str(KIT))
import numpy as np
import soundfile as sf
import torch
import voice_tool as V
import voice_build as base

PROFILES = {
    'ori': ('kseniya', 1.0, .97),
    'alien1': ('kseniya', 1.16, 1.04),
    'alien2': ('eugene', .96, 1.0),
    'alien3': ('xenia', 1.22, 1.04),
}
STRESS_WORDS = {'луна': 'лун+а', 'рама': 'р+ама', 'панама': 'пан+ама',
                'молоко': 'молок+о', 'ум': '+ум', 'щука': 'щ+ука', 'самокат': 'самок+ат'}
SOUNDS = {**base.SUPPORT, 'е': 'йэ', 'ё': 'йо', 'ю': 'йу', 'я': 'йа'}
REPORT = ROOT / 'tools/voice_v3_report.json'
PARTS = ROOT / 'tools/voice_v3_parts.json'


def load_json(path, default=None):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default


def save_json(path, value):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def dictionary():
    # Existing project dictionary contains both legacy postfix and modern key=value entries.
    result = V.load_stress(KIT / 'stress.txt')
    local = ROOT / 'tools/voice_stress.txt'
    for line in local.read_text(encoding='utf-8').splitlines():
        line = line.split('#', 1)[0].strip()
        if line and '=' not in line and '+' in line:
            result[line.replace('+', '').lower()] = re.sub(r'([аеёиоуыэюяАЕЁИОУЫЭЮЯ])\+', r'+\1', line)
    result.update(V.load_stress(local))
    result.update(STRESS_WORDS)
    result['ори'] = '+Ори'
    return result


STRESS = dictionary()


def spoken(part):
    if part.startswith('#stress_'):
        return STRESS_WORDS[part[len('#stress_'):]] + '.'
    if part.startswith('#'):
        token = part[1:]
        if token.isdigit():
            text = base.number(int(token)) + '.'
        elif token.startswith('с_'):
            text = ('йо' if token[2:] == 'ё' else token[2:]) + '!'
        elif token.startswith('з_'):
            letter = token[2:]
            if letter not in base.NAMES or letter in 'ьъ':
                raise ValueError('No independent sound: ' + letter)
            text = SOUNDS.get(letter, letter * 3) + '!'
        else:
            text = ('йо' if token == 'ё' else base.NAMES[token]) + '!'
    else:
        text = re.sub(r'\[([а-яё-]+)\]', lambda m: SOUNDS.get(m[1], m[1]), part)
        # A single capital letter in an authored explanation denotes its name, not an acronym.
        text = re.sub(r'\b[А-ЯЁ]\b', lambda m: base.NAMES[m[0].lower()], text)
    text = V.apply_stress(text, STRESS)
    # The shared chess dictionary uses стоИт (stands); this catalog also has a price.
    text = re.sub(r'\bсто\+ит(?=\s+\d)', 'ст+оит', text, flags=re.I)
    if '++' in text:
        raise ValueError('Duplicate stress: ' + text)
    return V.clean_for_tts(text)


def log(text):
    print(time.strftime('%H:%M:%S') + ' ' + text, flush=True)


def inspect(path):
    audio, sr = sf.read(path, dtype='float32')
    duration = len(audio) / sr
    if sr != 24000 or audio.ndim != 1 or not np.isfinite(audio).all():
        raise ValueError('Invalid decoded audio: ' + str(path.relative_to(ROOT)))
    peak = float(np.max(np.abs(audio))) if len(audio) else 0
    if not .15 <= duration <= 90 or not .05 <= peak <= 1.0:
        raise ValueError('Invalid duration/level: ' + str(path.relative_to(ROOT)))
    return {'decodedSeconds': round(duration, 4), 'sampleRate': sr, 'peak': round(peak, 5)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify-only', action='store_true')
    parser.add_argument('--limit', type=int)
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error('--limit must be positive')
    assert MODEL.is_file(), 'Local v5_ru model is missing'
    parts = load_json(PARTS)
    entries = parts['entries']
    assert len({r['key'] for r in entries}) == len(entries)
    for vector in parts['hashVectors']:
        assert V.hkey(vector['text']) == vector['hash'], 'JS UTF16 hash mismatch'
    for row in entries:
        assert row['key'] == row['who'] + '/' + V.hkey(row['text'])
        assert row['who'] in PROFILES
    for word, source in STRESS_WORDS.items():
        assert spoken(word) == source
        assert spoken('#stress_' + word) == source + '.'
    for letter in 'ьъ':
        assert not any(row['text'] == '#з_' + letter for row in entries)
    previous = load_json(REPORT, {}).get('clips', {})
    old_report = load_json(ROOT / 'mockups/voice-v2/report.json', {})
    records, todo = {}, []
    for row in entries:
        key, who, text = row['key'], row['who'], row['text']
        source = spoken(text)
        old_path = ROOT / ('voice-v2/' + key + '.mp3')
        legacy = old_report.get(key, {})
        record = {**row, 'profile': list(PROFILES[who]), 'model': 'Silero v5_ru', 'synthesisRate': 48000}
        legacy_matches = legacy.get('text') == text and legacy.get('profile') == list(PROFILES[who])
        if old_path.is_file() and legacy_matches:
            record.update(path='voice-v2/' + key + '.mp3', reused=True, source=legacy['source'])
            record['provenance'] = [*row['provenance'], 'mockups/voice-v2/report.json:' + key]
        else:
            record.update(path='voice-v3/' + key + '.mp3', reused=False, source=source)
            old = previous.get(key, {})
            path = ROOT / record['path']
            if not (path.is_file() and old.get('source') == source and old.get('profile') == list(PROFILES[who])
                    and old.get('sha256') == hashlib.sha256(path.read_bytes()).hexdigest()):
                todo.append(record)
            else:
                for field in ('sha256', 'bytes', 'decodedSeconds', 'sampleRate', 'peak'):
                    if field in old:
                        record[field] = old[field]
        records[key] = record
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    log(f'Entries {len(entries)}; reuse {sum(r["reused"] for r in records.values())}; synthesize {len(todo)}; device {device}')
    if args.verify_only and todo:
        raise RuntimeError(f'{len(todo)} clips need synthesis')
    torch.set_num_threads(4)
    torch.manual_seed(42)
    model_hash = hashlib.sha256(MODEL.read_bytes()).hexdigest()
    report = {'schema': 3, 'model': 'Silero v5_ru', 'modelSha256': model_hash,
              'profiles': PROFILES, 'synthesisRate': 48000, 'counts': parts['counts'], 'clips': records}
    if todo:
        model = torch.package.PackageImporter(str(MODEL)).load_pickle('tts_models', 'model')
        model.to(device)
        for who in PROFILES:
            (ROOT / 'voice-v3' / who).mkdir(parents=True, exist_ok=True)
        selected = todo[:args.limit] if args.limit else todo
        for i, record in enumerate(selected, 1):
            speaker, pitch, tempo = PROFILES[record['who']]
            try:
                with torch.inference_mode():
                    raw = model.apply_tts(text=record['source'], speaker=speaker, sample_rate=48000,
                                          put_accent=True, put_yo=True).detach().cpu().numpy().astype('float32')
            except Exception as error:
                save_json(REPORT, report)
                raise RuntimeError(f'Synthesis failed: {record["key"]} {record["source"]!r}') from error
            if not np.isfinite(raw).all() or len(raw) < 48000 * .1:
                raise RuntimeError('Invalid synthesis: ' + record['key'])
            audio, sr = V.postprocess(raw, 48000, pitch, tempo)
            path = ROOT / record['path']
            data = V.to_mp3(audio, sr, 64)
            path.write_bytes(data)
            record.update(inspect(path))
            record.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
            if i % 20 == 0 or i == len(selected):
                save_json(REPORT, report)
                log(f'Generated {i}/{len(selected)}: {record["who"]}')
        del model
        if device == 'cuda':
            torch.cuda.empty_cache()
        if len(selected) != len(todo):
            log('Partial build saved; manifest not published')
            return
    digest = hashlib.sha256()
    size = 0
    for key, record in sorted(records.items()):
        path = ROOT / record['path']
        data = path.read_bytes()
        record.update(inspect(path))
        record.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        size += len(data)
        digest.update(key.encode('utf-8'))
        digest.update(record['path'].encode('utf-8'))
        digest.update(data)
    version = digest.hexdigest()[:12]
    manifest = {'version': version, 'bytes': size, 'clips': {k:r['path'] for k,r in sorted(records.items())}}
    manifest_path = ROOT / 'rpg/voice-manifest.js'
    manifest_text = ('// Generated locally by tools/voice_build_v3.py. Paths relative to index.html.\n'
                     "(typeof self==='undefined'?window:self).ORI_VOICE=" +
                     json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + ';\n')
    if args.verify_only:
        assert manifest_path.read_text(encoding='utf-8') == manifest_text, 'Manifest differs from verified assets'
    else:
        manifest_path.write_text(manifest_text, encoding='utf-8', newline='\n')
    report['summary'] = {'version':version, 'bytes':size, 'clips':len(records),
        'reused':sum(r['reused'] for r in records.values()), 'new':sum(not r['reused'] for r in records.values()),
        'durationMin':min(r['decodedSeconds'] for r in records.values()),
        'durationMax':max(r['decodedSeconds'] for r in records.values()),
        'authoredLines':len(parts['lines']), 'hashVectorsPassed':len(parts['hashVectors']),
        'stressWordTestsPassed':len(STRESS_WORDS) * 2, 'decodedAll':True,
        'profileProvenanceAll':True, 'asrChecked':False, 'humanListeningChecked':False}
    save_json(REPORT, report)
    log(json.dumps(report['summary'], ensure_ascii=False))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    main()

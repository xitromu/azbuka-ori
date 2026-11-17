import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--zip', type=Path)
    args = parser.parse_args()
    files = ['index.html', 'v1.html', 'v2.html']
    files += ['img/' + name + '.png' for name in ['ori', 'alien1', 'alien2', 'alien3']]
    files += [p.relative_to(ROOT).as_posix() for p in sorted((ROOT / 'rpg').rglob('*'))
              if p.is_file() and p.suffix in {'.js', '.css', '.webp'} and p.name != 'offline-manifest.js']
    digest = hashlib.sha256()
    for name in files:
        digest.update(name.encode('utf-8'))
        digest.update((ROOT / name).read_bytes())
    manifest = {'version': digest.hexdigest()[:16], 'files': files}
    (ROOT / 'rpg/offline-manifest.js').write_text('self.ORI_OFFLINE = ' + json.dumps(manifest, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(f'Offline shell: {len(files)} files; version {manifest["version"]}')
    if args.zip:
        assets = set(files + ['sw.js', 'rpg/offline-manifest.js'])
        for directory in ['voice', 'voice-v2', 'voice-v3']:
            assets.update(p.relative_to(ROOT).as_posix() for p in (ROOT / directory).rglob('*.mp3'))
        with zipfile.ZipFile(args.zip, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name in sorted(assets):
                archive.write(ROOT / name, name)
        with zipfile.ZipFile(args.zip) as archive:
            bad = archive.testzip()
            if bad:
                raise RuntimeError('Invalid archive member: ' + bad)
        print(f'Release archive: {len(assets)} files; {args.zip.stat().st_size} bytes')


if __name__ == '__main__':
    main()

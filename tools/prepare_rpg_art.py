"""Prepare scene art without modifying the catalog, PNG sources, or hero images.

Run with C:/TST/python.exe. Requires only Pillow and numpy.
Writes rpg/assets/*-sprite.webp and rpg/assets.js; review sheets go to OS temp.
The white-background flood starts ONLY outside the image. Enclosed white areas
are intentionally retained (eyes, fabric, glass, and also enclosed decor gaps).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import tempfile
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'mockups/rpg-v3'
DEST = ROOT / 'rpg/assets'
MAX_SIZE = 640
PAD = 8
HEROES = {'blip': 'alien1', 'puf': 'alien2', 'kuku': 'alien3'}
# Pixel rectangles in each ORIGINAL rectangular hero image, NOT its alpha bbox.
# Hats avoid the eyes; capes are below the heads and behind the hero (z=0).
BOXES = {
    'blip_hat': (77, 0, 167, 100),
    'blip_cape': (60, 210, 159, 137),
    'blip_badge': (168, 264, 31, 25),
    'puf_hat': (153, -10, 129, 96),
    'puf_cape': (64, 131, 290, 212),
    'puf_badge': (242, 275, 34, 33),
    'kuku_hat': (132, 3, 130, 79),
    'kuku_cape': (68, 271, 260, 112),
    'kuku_badge': (237, 296, 24, 34),
}
# Independent boot/cuff rectangles retain exposed tentacle tips / blue paws.
# The source product pairs are much too close together for these hero stances.
BOOT_BOXES = {
    'blip_boots': ((45, 345, 75, 73), (142, 341, 79, 72)),
    'puf_boots': ((99, 305, 53, 66), (243, 306, 49, 66)),
    'kuku_boots': ((88, 328, 78, 54), (194, 330, 78, 54)),
}


def exterior_region(passable: np.ndarray) -> np.ndarray:
    """Four-connected scanline flood from a padded, passable outside border."""
    todo = np.pad(passable.astype(bool), 1, constant_values=True)
    outside = np.zeros_like(todo)
    height, width = todo.shape
    queue = deque([(0, 0)])
    while queue:
        x, y = queue.pop()
        if not todo[y, x]:
            continue
        left = x
        while left > 0 and todo[y, left - 1]:
            left -= 1
        right = x + 1
        while right < width and todo[y, right]:
            right += 1
        todo[y, left:right] = False
        outside[y, left:right] = True
        for row in (y - 1, y + 1):
            if not 0 <= row < height:
                continue
            run = todo[row, left:right]
            starts = np.flatnonzero(run & ~np.r_[False, run[:-1]])
            queue.extend((left + int(start), row) for start in starts)
    return outside[1:-1, 1:-1]


def foreground_guard(item_id: str, size: tuple) -> np.ndarray:
    """Reviewed interior guards where white material touches the white backdrop.

    These paths only BLOCK the exterior flood; they do not repaint the image or
    remove any enclosed white. Coordinates refer to the untouched 1024px PNGs.
    """
    guard = Image.new('L', size)
    draw = ImageDraw.Draw(guard)
    if item_id == 'kuku_hat':
        draw.polygon([(187, 521), (201, 483), (229, 450), (273, 429),
                      (319, 417), (367, 415), (390, 363), (424, 325),
                      (473, 302), (525, 295), (575, 301), (620, 322),
                      (648, 354), (668, 392), (679, 449), (705, 450),
                      (760, 465), (796, 489), (824, 528), (840, 570),
                      (840, 635), (827, 667), (791, 687), (729, 700),
                      (610, 694), (430, 680), (252, 655), (205, 618)], fill=255)
        draw.ellipse((180, 414, 512, 675), fill=255)
    elif item_id == 'room_bubble_window':
        draw.ellipse((116, 89, 927, 906), fill=255)
    elif item_id == 'robot':
        draw.polygon([(396, 207), (426, 184), (482, 166), (526, 161),
                      (586, 164), (635, 177), (680, 199), (704, 218),
                      (710, 245), (382, 247)], fill=255)
        for box in ((136, 312, 176, 363), (185, 288, 221, 341),
                    (247, 323, 276, 373), (116, 358, 152, 389)):
            draw.ellipse(box, fill=255)
    elif item_id == 'holo':
        draw.ellipse((319, 480, 730, 738), fill=255)
        draw.polygon([(319, 609), (330, 567), (353, 536), (387, 512),
                      (419, 498), (448, 485), (478, 477), (585, 477),
                      (634, 499), (674, 527), (706, 569), (728, 611),
                      (728, 679), (660, 720), (552, 737), (446, 731),
                      (359, 696), (322, 660)], fill=255)
    elif item_id == 'room_crystal_chime':
        draw.rounded_rectangle((227, 222, 783, 269), radius=11, fill=255)
        draw.rectangle((483, 275, 523, 713), fill=255)
        draw.polygon([(215, 785), (223, 755), (234, 741), (264, 730),
                      (322, 721), (405, 717), (465, 715), (478, 685),
                      (533, 685), (545, 714), (657, 718), (736, 731),
                      (773, 746), (788, 783), (794, 798), (763, 808),
                      (648, 815), (397, 815), (264, 808), (220, 798)], fill=255)
    return np.asarray(guard) > 0


def remove_exterior(image: Image.Image, item_id: str = '') -> tuple[Image.Image, dict]:
    rgba = np.asarray(image.convert('RGBA')).copy()
    rgb = rgba[:, :, :3].astype(np.float32)
    low = rgb.min(axis=2)
    high = rgb.max(axis=2)
    # A small chroma tolerance includes the subtly cool studio background,
    # but protects pale yellow/blue/mint surfaces and colored glow.
    near_white = (low >= 242) & ((high - low) <= 14)
    guard = foreground_guard(item_id, image.size)
    passable = (near_white | (rgba[:, :, 3] == 0)) & ~guard
    exterior = exterior_region(passable)
    solid = Image.fromarray(np.uint8(~exterior) * 255)
    # Inward feather only: never spread a white fringe into removed background.
    softened = np.asarray(solid.filter(ImageFilter.GaussianBlur(0.8))) / 255.0
    matte = np.where(exterior, 0.0, softened)
    if item_id == 'holo':
        # Only the cyan LIGHT outside the globe, never the white projector shell.
        # Recover coverage over a white matte so the glow is not an opaque disk.
        yy, xx = np.indices(low.shape)
        glow = (((xx - 527) / 146) ** 2 + ((yy - 278) / 147) ** 2 > 1) & (yy < 458)
        matte[glow] *= np.clip((242.0 - rgb[:, :, 0][glow]) / 155.0, 0, 1)
    if item_id in ('pet_cat', 'pet_snail'):
        # The studio contact shadow is almost white, but darker than the flood
        # cutoff. Feather ONLY its edge-connected neutral floor region. Keep
        # colored paws, fur and the snail's cream shell out of this operation.
        floor_y = {'pet_cat': 840, 'pet_snail': 720}[item_id]
        yy = np.indices(low.shape)[0]
        floor = (yy >= floor_y) & (low > 155) & ((high - low) < 32)
        floor_edge = exterior_region(passable | floor) & floor & ~guard
        matte[floor_edge] *= np.clip((255.0 - low[floor_edge]) / 150.0, 0, 1)
    alpha = rgba[:, :, 3].astype(np.float32) / 255.0 * matte
    # Remove the white contribution only on the newly feathered silhouette.
    edge = (~exterior) & (matte < 1.0)
    corrected = (rgb - 255.0 * (1.0 - matte[:, :, None])) / np.maximum(
        matte[:, :, None], 1.0 / 255.0
    )
    rgb[edge] = np.clip(corrected[edge], 0, 255)
    rgba[:, :, :3] = np.rint(rgb).astype(np.uint8)
    rgba[:, :, 3] = np.rint(alpha * 255).astype(np.uint8)
    rgba[rgba[:, :, 3] == 0, :3] = 0
    protected = near_white & ~exterior
    # Interior white pixels must keep their source alpha except the 2px edge.
    interior = protected & (matte == 1.0)
    if interior.any():
        assert np.array_equal(rgba[:, :, 3][interior], np.asarray(image)[:, :, 3][interior])
    # Regression probes for the white surfaces that leaked on the first review.
    probes = {
        'kuku_hat': ((520, 335), (319, 440)),
        'robot': ((515, 185), (197, 305)),
        'holo': ((386, 533),),
        'room_bubble_window': ((485, 120),),
        'room_crystal_chime': ((280, 780), (400, 230)),
        'blip_hat': ((476, 300),),
    }
    for x, y in probes.get(item_id, ()):
        assert rgba[y, x, 3] == image.getpixel((x, y))[3], (item_id, x, y)
    return Image.fromarray(rgba), {
        'exterior_pixels': int(exterior.sum()),
        'preserved_near_white_interior': int(interior.sum()),
    }


def tight(image: Image.Image) -> Image.Image:
    box = image.getchannel('A').getbbox()
    if box is None:
        raise ValueError('Empty foreground')
    return image.crop(box)


def finish(image: Image.Image) -> Image.Image:
    image = tight(image)
    image.thumbnail((MAX_SIZE - PAD * 2, MAX_SIZE - PAD * 2), Image.Resampling.LANCZOS)
    result = Image.new('RGBA', (image.width + PAD * 2, image.height + PAD * 2))
    result.alpha_composite(image, (PAD, PAD))
    return result


def arrange_boots(item_id: str, image: Image.Image) -> tuple[Image.Image, tuple]:
    """Repack the two cutouts, rather than scaling their catalog gap to fit."""
    image = tight(image)
    # Every supplied pair has a clear center gap; find its alpha-density valley.
    density = np.asarray(image.getchannel('A')).sum(axis=0)
    lo, hi = int(image.width * 0.4), int(image.width * 0.6)
    split = lo + int(np.argmin(density[lo:hi]))
    parts = [tight(image.crop((0, 0, split, image.height))),
             tight(image.crop((split, 0, image.width, image.height)))]
    boxes = BOOT_BOXES[item_id]
    left = min(box[0] for box in boxes)
    top = min(box[1] for box in boxes)
    right = max(box[0] + box[2] for box in boxes)
    bottom = max(box[1] + box[3] for box in boxes)
    # Work at 3x the hero resolution, leaving room for the final 8px padding.
    scale = min(3.0, (MAX_SIZE - PAD * 2) / max(right - left, bottom - top))
    canvas = Image.new('RGBA', (round((right - left) * scale), round((bottom - top) * scale)))
    for index, (part, (x, y, width, height)) in enumerate(zip(parts, boxes)):
        if item_id == 'blip_boots' and index == 1:
            # The catalog boots both face left; the hero's right toe faces right.
            part = part.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        part = part.resize((round(width * scale), round(height * scale)), Image.Resampling.LANCZOS)
        canvas.alpha_composite(part, (round((x - left) * scale), round((y - top) * scale)))
    padded = Image.new('RGBA', (canvas.width + PAD * 2, canvas.height + PAD * 2))
    padded.alpha_composite(canvas, (PAD, PAD))
    return padded, (left - PAD / scale, top - PAD / scale,
                    padded.width / scale, padded.height / scale)


def catalog() -> list[tuple[str, str, str]]:
    text = (SOURCE / 'assets.js').read_text(encoding='utf-8')
    entries = re.findall(
        r"^\s*(\w+):\s*\{src:'assets/[^']+',original:'(assets/[^']+)',background:'(white|opaque)'",
        text, re.MULTILINE,
    )
    if len(entries) != 36 or len({entry[0] for entry in entries}) != 36:
        raise ValueError('Expected the exact 36-item mockup catalog')
    if dict((key, original) for key, original, _ in entries)['room_orbit_shelf'] != 'assets/room_orbit_shelf-corrected.png':
        raise ValueError('The corrected shelf must be used')
    return entries


def placement(box: tuple, hero: Image.Image, slot: str) -> dict:
    left, top, width, height = box
    return {'left': round(left / hero.width * 100, 4),
            'top': round(top / hero.height * 100, 4),
            'width': round(width / hero.width * 100, 4),
            'height': round(height / hero.height * 100, 4),
            'zIndex': 0 if slot == 'cape' else (3 if slot == 'boots' else 4)}


def write_manifest(art: dict) -> None:
    text = (
        '// Generated by tools/prepare_rpg_art.py from the exact mockup PNG mapping.\n'
        '// src/background describe the unchanged catalog card; sprite is the scene cutout.\n'
        '// Clothing placement: percentages of the FULL original hero img rectangle,\n'
        '// not a square/object-fit container or alpha bbox. Preserve the hero aspect ratio.\n'
        '// Overlay images fill their placement rectangles (no additional object-fit padding).\n'
        '// Use a positioned/isolation:isolate wrapper: cape z=0, hero z=1, accessories z>1.\n'
        '// Enclosed whites are deliberately opaque; this is not semantic glass matting.\n'
        'window.ORI_ART = {\n'
    )
    text += ',\n'.join('  ' + key + ': ' + json.dumps(value, ensure_ascii=False, separators=(',', ':'))
                       for key, value in art.items())
    (ROOT / 'rpg/assets.js').write_text(text + '\n};\n', encoding='utf-8')


def validate(art: dict) -> None:
    assert len(art) == 36
    assert sum('sprite' in value for value in art.values()) == 30
    assert sum('placement' in value for value in art.values()) == 12
    for key, entry in art.items():
        assert (ROOT / entry['src']).is_file(), key
        assert (ROOT / entry['original']).is_file(), key
        if 'sprite' not in entry:
            assert entry['background'] == 'opaque'
            continue
        with Image.open(ROOT / entry['sprite']) as image:
            assert image.mode == 'RGBA' and max(image.size) <= MAX_SIZE, key
            alpha = np.asarray(image.getchannel('A'))
            assert alpha.min() == 0 and alpha.max() >= 250, key
            assert not alpha[0].any() and not alpha[-1].any(), key
            assert not alpha[:, 0].any() and not alpha[:, -1].any(), key
            assert np.count_nonzero(alpha == 0) > alpha.size * 0.04, key
        if 'placement' in entry:
            assert entry['slot'] in ('hat', 'cape', 'boots', 'badge')
            assert entry['placement']['width'] > 0 and entry['placement']['height'] > 0
            assert (entry['placement']['zIndex'] < 1) == (entry['slot'] == 'cape')


def self_test() -> None:
    # A white eye inside a dark outline must survive; an open white notch must not.
    image = Image.new('RGBA', (40, 40), (252, 251, 253, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle((8, 8, 31, 31), fill=(60, 120, 170, 255))
    draw.rectangle((15, 15, 24, 24), fill=(255, 255, 255, 255))
    draw.rectangle((8, 25, 13, 29), fill=(255, 255, 255, 255))
    result, _ = remove_exterior(image)
    assert result.getpixel((20, 20)) == (255, 255, 255, 255)
    assert result.getpixel((9, 27))[3] == 0
    assert result.getpixel((0, 0))[3] == 0


def review_sheets(art: dict, folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 17)
    except OSError:
        font = ImageFont.load_default()
    for group, ids in (
        ('pets', [key for key in art if key.startswith('pet_')]),
        ('decor', [key for key in art if 'sprite' in art[key] and not key.startswith('pet_') and 'slot' not in art[key]]),
        ('outfits', [key for key in art if 'slot' in art[key]]),
    ):
        cols = 3 if group == 'pets' else 4
        sheet = Image.new('RGBA', (cols * 300, ((len(ids) + cols - 1) // cols) * 320), '#202a3a')
        draw = ImageDraw.Draw(sheet)
        for index, key in enumerate(ids):
            x, y = (index % cols) * 300, (index // cols) * 320
            image = Image.open(ROOT / art[key]['sprite']).convert('RGBA')
            image.thumbnail((276, 273), Image.Resampling.LANCZOS)
            sheet.alpha_composite(image, (x + (300 - image.width) // 2, y + (282 - image.height) // 2))
            draw.text((x + 10, y + 288), key, fill='white', font=font)
        sheet.convert('RGB').save(folder / (group + '-dark.png'))
    # Each item separately as well as all four together, from the actual descriptor.
    sheet = Image.new('RGBA', (5 * 440, 3 * 510), '#202a3a')
    draw = ImageDraw.Draw(sheet)
    for row, (prefix, hero_id) in enumerate(HEROES.items()):
        hero = Image.open(ROOT / 'img' / (hero_id + '.png')).convert('RGBA')
        for col, slot in enumerate(('hat', 'cape', 'boots', 'badge', 'all')):
            origin = (col * 440 + (440 - hero.width) // 2, row * 510 + 42)
            layers = [(1, hero, origin)]
            for key, item in art.items():
                if item.get('owner') != hero_id or (slot != 'all' and item.get('slot') != slot):
                    continue
                p = item['placement']
                overlay = Image.open(ROOT / item['sprite']).convert('RGBA').resize(
                    (round(p['width'] / 100 * hero.width), round(p['height'] / 100 * hero.height)),
                    Image.Resampling.LANCZOS,
                )
                position = (origin[0] + round(p['left'] / 100 * hero.width),
                            origin[1] + round(p['top'] / 100 * hero.height))
                layers.append((p['zIndex'], overlay, position))
            for _, layer, position in sorted(layers, key=lambda value: value[0]):
                sheet.alpha_composite(layer, position)
            draw.text((col * 440 + 12, row * 510 + 474), prefix + ' / ' + slot, fill='white', font=font)
    sheet.convert('RGB').save(folder / 'hero-fittings-dark.png')


def digest(paths: list[Path]) -> dict:
    return {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preview-dir', type=Path, default=Path(tempfile.gettempdir()) / 'ori-rpg-art-review')
    args = parser.parse_args()
    # Review output must stay out of the repository.
    preview = args.preview_dir.resolve()
    if preview == ROOT or ROOT in preview.parents:
        parser.error('Use a preview directory outside the game repository')
    self_test()
    entries = catalog()
    originals = [SOURCE / original for _, original, _ in entries]
    catalogs = [DEST / (key + '.webp') for key, _, _ in entries]
    hero_paths = [ROOT / 'img' / (hero_id + '.png') for hero_id in HEROES.values()]
    protected = digest(originals + catalogs + hero_paths)
    for path, expected in zip(hero_paths, ((290, 420), (411, 420), (381, 420))):
        with Image.open(path) as hero:
            if hero.size != expected or hero.mode != 'RGBA':
                raise ValueError('Hero dimensions changed; refit the overlays: ' + str(path))
    art = {}
    for key, original, background in entries:
        descriptor = {'src': 'rpg/assets/' + key + '.webp',
                      'original': 'mockups/rpg-v3/' + original,
                      'background': background}
        if background == 'white':
            image = Image.open(SOURCE / original).convert('RGBA')
            masked, stats = remove_exterior(image, key)
            if key in ('room_sky_globe', 'kuku_hat'):
                # Discard scan/canvas-border noise, not any part of the artwork.
                masked = masked.crop((8, 8, image.width - 8, image.height - 8))
            prefix = key.split('_')[0]
            if prefix in HEROES:
                slot = key.split('_')[1]
                if slot == 'boots':
                    sprite, box = arrange_boots(key, masked)
                else:
                    sprite, box = finish(masked), BOXES[key]
                hero = Image.open(ROOT / 'img' / (HEROES[prefix] + '.png'))
                descriptor.update(slot=slot, owner=HEROES[prefix], placement=placement(box, hero, slot))
            else:
                sprite = finish(masked)
            descriptor['sprite'] = 'rpg/assets/' + key + '-sprite.webp'
            sprite.save(ROOT / descriptor['sprite'], 'WEBP', lossless=True, method=6, exact=True)
            print(key, sprite.size, stats, flush=True)
        art[key] = descriptor
    validate(art)
    assert protected == digest(list(protected)), 'A protected source/catalog/hero changed'
    write_manifest(art)
    review_sheets(art, preview)
    print('Verified: 36 descriptors, 30 transparent sprites, 12 fitted overlays; protected files unchanged.')
    print('Review sheets:', preview)


if __name__ == '__main__':
    main()

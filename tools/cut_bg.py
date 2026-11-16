import sys
from PIL import Image
from collections import deque

def cut(path, out_h):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    def near_white(x, y):
        r, g, b, a = px[x, y]
        return r > 225 and g > 225 and b > 225
    for x in range(w):
        for y in (0, h - 1):
            if near_white(x, y) and not seen[y * w + x]:
                seen[y * w + x] = 1; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if near_white(x, y) and not seen[y * w + x]:
                seen[y * w + x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and near_white(nx, ny):
                seen[ny * w + nx] = 1; q.append((nx, ny))
    # soften white halo next to transparent pixels
    for _ in range(2):
        halo = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a and r > 235 and g > 235 and b > 235:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                            halo.append((x, y)); break
        for x, y in halo:
            px[x, y] = (0, 0, 0, 0)
    bbox = im.getbbox()
    im = im.crop(bbox)
    pad = 8
    canvas = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(im, (pad, pad))
    ratio = out_h / canvas.height
    canvas = canvas.resize((max(1, round(canvas.width * ratio)), out_h), Image.LANCZOS)
    canvas.save(path)
    print(path, canvas.size)

base = 'C:/projects/GAMES/azbuka-ori/img/'
cut(base + 'ori.png', 480)
cut(base + 'alien1.png', 420)
cut(base + 'alien2.png', 420)
cut(base + 'alien3.png', 420)
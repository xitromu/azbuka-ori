from PIL import Image
from collections import deque

BASE = 'C:/projects/GAMES/azbuka-ori/img/'
SRC2 = 'C:/projects/GAMES/vibe_images/alien2-png_1794856917162_d8b9c252.png'

def grayish(p):
    r, g, b, a = p
    return a > 0 and min(r, g, b) >= 185 and max(r, g, b) - min(r, g, b) <= 14

def edge_cut(im):
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    def nw(x, y):
        r, g, b, a = px[x, y]
        return r > 225 and g > 225 and b > 225
    for x in range(w):
        for y in (0, h - 1):
            if nw(x, y) and not seen[y * w + x]:
                seen[y * w + x] = 1; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if nw(x, y) and not seen[y * w + x]:
                seen[y * w + x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and nw(nx, ny):
                seen[ny * w + nx] = 1; q.append((nx, ny))
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
    return im

im2 = edge_cut(Image.open(SRC2).convert('RGBA'))
bbox = im2.getbbox()
im2 = im2.crop(bbox)
pad = 8
c = Image.new('RGBA', (im2.width + pad * 2, im2.height + pad * 2), (0, 0, 0, 0))
c.paste(im2, (pad, pad))
r = 420 / c.height
im2 = c.resize((round(c.width * r), 420), Image.LANCZOS)
im2.save(BASE + 'alien2.png')
print('alien2 restored', im2.size)

for name, ytop in (('ori.png', 428), ('alien1.png', 400), ('alien2.png', 395), ('alien3.png', 398)):
    im = Image.open(BASE + name).convert('RGBA')
    w, h = im.size
    px = im.load()
    n = 0
    for y in range(ytop, h):
        for x in range(w):
            if grayish(px[x, y]):
                px[x, y] = (0, 0, 0, 0); n += 1
    im.save(BASE + name)
    bg = Image.new('RGBA', im.size, (255, 0, 255, 255))
    bg.alpha_composite(im)
    bg.convert('RGB').save('C:/projects/GAMES/azbuka-ori/tools/check_' + name)
    print(name, 'feet pixels cleared:', n)
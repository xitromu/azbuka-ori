import sys
from PIL import Image
from collections import deque

def holes(path):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    cleared = []
    for y in range(h):
        for x in range(w):
            if seen[y * w + x] or px[x, y][3] == 0:
                continue
            r, g, b, a = px[x, y]
            if not (min(r, g, b) >= 250 and max(r, g, b) - min(r, g, b) <= 3):
                continue
            comp = []
            q = deque([(x, y)])
            seen[y * w + x] = 1
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                        rr, gg, bb, aa = px[nx, ny]
                        if aa and min(rr, gg, bb) >= 250 and max(rr, gg, bb) - min(rr, gg, bb) <= 3:
                            seen[ny * w + nx] = 1
                            q.append((nx, ny))
            if len(comp) >= 300:
                xs = [c[0] for c in comp]; ys = [c[1] for c in comp]
                cleared.append((len(comp), min(xs), min(ys), max(xs), max(ys)))
                for cx, cy in comp:
                    px[cx, cy] = (0, 0, 0, 0)
    for _ in range(3):
        halo = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a and min(r, g, b) >= 232:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                            halo.append((x, y)); break
        for x, y in halo:
            px[x, y] = (0, 0, 0, 0)
    im.save(path)
    print(path, 'cleared:', cleared)

base = 'C:/projects/GAMES/azbuka-ori/img/'
for n in ('ori.png', 'alien1.png', 'alien2.png', 'alien3.png'):
    holes(base + n)
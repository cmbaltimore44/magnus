"""Magnus's Home art: the heron crossing the sun (drawn with the pix.py kit).

The heron_sun_vignette function takes the animation frame (glide offset,
wing pose, reflection shimmer); art/export.py writes its frames to
src/ui/art/heronSun.js. The other figures drawn while choosing it are in git
history (commit c0b61b6, art/figures.py).
"""
import math, os, re
from pix import *

HERON = dict(   # the flying heron (raised-wing pose) as shapes, in its own coordinates
    polys=[[(13.4, 10.4), (16, 6), (21, 2.4), (28, 0.4), (35, 0.6), (30, 3.4), (24, 7), (21, 10.6)],
           [(15, 12.4), (19, 16.6), (26, 18.4), (29, 17.4), (22, 12.2)],
           [(23.6, 10.6), (27, 11.4), (23.6, 12.6)], [(8, 10), (1.4, 11), (8, 11.4)],
           [(24, 12.4), (38, 12.8), (38, 13.6), (24, 13.2)], [(24, 14.4), (37, 15), (37, 15.8), (24, 15.2)]],
    ells=[(17.4, 11.6, 7, 2.2, -3), (11.4, 12.2, 1.8, 1.6, 0), (9.6, 10.4, 2, 1.7, 0)])

# The raised wing, and a mid-beat version (tip lowered to about body level).
WING_MID = [(13.4, 10.4), (17, 8.4), (23, 7), (30, 6.6), (36, 8), (30, 9.4), (24, 10), (21, 10.8)]

def heron_parts(k, ox, oy, wing='up'):
    polys = HERON['polys'] if wing == 'up' else [WING_MID] + HERON['polys'][1:]
    parts = [poly([(ox + x * k, oy + y * k) for x, y in pts]) for pts in polys]
    return parts + [ell(ox + cx * k, oy + cy * k, rx * k, ry * k, a) for cx, cy, rx, ry, a in HERON['ells']]

def heron_sun_vignette(dy=0, wing='up', shimmer=0):
    """Heron scene 1 as a vignette: the sun, the heron, a short tapering strip of water.
    dy/wing/shimmer give the animation frames (a glide bob, a wing beat, and the
    reflection's shimmer)."""
    c = Canvas(42, 30)
    sun = ell(21, 13, 11.4, 11.4)
    c.fill(sun, 'redB'); c.fill(ell(21, 13, 9, 9), 'yellowB')
    water = ell(21, 25.6, 17, 3.2)                                                     # tapers to points at both ends
    c.fill(minus(water, rect(0, 0, 42, 24.2)), 'blue')
    c.fill(both(minus(water, rect(0, 0, 42, 24.2)), lambda x, y: int(y) == 24), 'blueB')   # waterline catching light
    for n, (y, half, t) in enumerate(((25, 7, 'redB'), (26.4, 5, 'yellowB'), (27.6, 3, 'redB'))):
        shift = (1 if n % 2 == 0 else -1) * shimmer                                    # the reflection shimmers side to side
        c.fill(rect(21 - half + shift, y, 21 + half + shift, y + 0.7), t)
    for part in heron_parts(0.8, 5.6, 4.4 + dy, wing):
        c.fill(part, 'gray'); c.fill(both(part, sun), 'black')
    return c


FIGURES = {'heron_sun_vignette': heron_sun_vignette}
ALL_FIGURES = FIGURES


def sheet(path, theme, scale=8):
    from PIL import Image
    tiles = []
    for name, fn in FIGURES.items():
        c = fn(); tmp = path + '.' + name + '.png'; c.png(tmp, theme, scale); tiles.append(Image.open(tmp))
    W = max(t.width for t in tiles); H = max(t.height for t in tiles)
    bg = next((tuple(int(m.group(1)[i:i + 2], 16) for i in (1, 3, 5)) for m in (re.match(r'background = (#[0-9a-fA-F]{6})', l) for l in open(theme)) if m), (0, 0, 0))
    cols = 6
    rows = (len(tiles) + cols - 1) // cols
    out = Image.new('RGB', (cols * (W + 16), rows * (H + 16)), bg)
    for i, t in enumerate(tiles):
        out.paste(t, ((i % cols) * (W + 16) + 8, (i // cols) * (H + 16) + 8))
    out.save(path)

"""Heron scene 1: original / vignette / no background, in dark and light mode."""
import os
from PIL import Image, ImageDraw
import figures
S = '/private/tmp/claude-501/-Users-cooperbaltimore-Development-magnus/f33e12ce-d460-491b-868c-ef8085d94926/scratchpad'
names = [('heron_sun', 'Original'), ('heron_sun_vignette', 'Vignette'), ('heron_sun_bare', 'No background')]
rows = []
for mode in ('Dark', 'Light'):
    theme = os.path.expanduser(f'~/.config/ghostty/themes/Beacon {mode}')
    tiles = []
    for key, _ in names:
        c = figures.ALL_FIGURES[key]()
        if mode == 'Light': c = c.for_light()
        c.png(f'{S}/cmp.png', theme, 10); tiles.append(Image.open(f'{S}/cmp.png').copy())
    rows.append((mode, theme, tiles))
W = max(t.width for _, _, ts in rows for t in ts); H = max(t.height for _, _, ts in rows for t in ts)
out = Image.new('RGB', (3 * (W + 40) + 20, 2 * (H + 70) + 10), (128, 128, 128))
d = ImageDraw.Draw(out)
for r, (mode, theme, tiles) in enumerate(rows):
    bg = next(tuple(int(l.split('#')[1][i:i + 2], 16) for i in (0, 2, 4)) for l in open(theme) if l.startswith('background ='))
    y0 = r * (H + 70) + 10
    d.rectangle([10, y0, out.width - 10, y0 + H + 60], fill=bg)
    for i, t in enumerate(tiles):
        x = 20 + i * (W + 40)
        out.paste(t, (x, y0 + 40 + (H - t.height)))
        d.text((x, y0 + 12), f'{names[i][1]} - {mode.lower()} mode', fill=(128, 128, 128))
out.save(os.path.expanduser('~/Development/magnus/art/heron-compare.png'))

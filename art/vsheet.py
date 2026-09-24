"""The shortlist in dark and light mode, one block each."""
import os
from PIL import Image, ImageDraw
import figures
S = '/private/tmp/claude-501/-Users-cooperbaltimore-Development-magnus/f33e12ce-d460-491b-868c-ef8085d94926/scratchpad'
def block(mode, family='Beacon', cols=6, scale=8):
    theme = os.path.expanduser(f'~/.config/ghostty/themes/{family} {mode}')
    tiles = []
    for fn in figures.FIGURES.values():
        c = fn(); c = c.for_light() if mode == 'Light' else c
        c.png(f'{S}/t.png', theme, scale); tiles.append(Image.open(f'{S}/t.png').copy())
    W = max(t.width for t in tiles); H = max(t.height for t in tiles)
    bg = next(tuple(int(l.split('#')[1][i:i + 2], 16) for i in (0, 2, 4)) for l in open(theme) if l.startswith('background ='))
    rows = (len(tiles) + cols - 1) // cols
    img = Image.new('RGB', (cols * (W + 20) + 20, rows * (H + 20) + 50), bg)
    ImageDraw.Draw(img).text((16, 14), f'{family} - {mode.lower()} mode', fill=(128, 128, 128))
    for i, t in enumerate(tiles):
        img.paste(t, (20 + (i % cols) * (W + 20), 40 + (i // cols) * (H + 20) + (H - t.height)))
    return img
for fam in ('Beacon', 'Lakeglow'):
    d, l = block('Dark', fam), block('Light', fam)
    out = Image.new('RGB', (max(d.width, l.width), d.height + l.height), (128, 128, 128))
    out.paste(d, (0, 0)); out.paste(l, (0, d.height))
    out.save(os.path.expanduser(f'~/Development/magnus/art/previews-{fam.lower()}.png'))

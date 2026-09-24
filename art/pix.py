"""Tiny pixel-art kit for Magnus figures.

Figures are drawn from shapes onto a grid of tone names, get an automatic
dark outline, and render to (a) ANSI half-block text using the terminal's own
named colors, so they follow the theme, and (b) a PNG using a Ghostty theme's
palette, for checking the art.
"""
import math, re, os

# tone → ANSI color number (0-15), i.e. the theme's named colors
ANSI = {'black': 0, 'red': 1, 'green': 2, 'yellow': 3, 'blue': 4, 'magenta': 5, 'cyan': 6, 'white': 7,
        'gray': 8, 'redB': 9, 'greenB': 10, 'yellowB': 11, 'blueB': 12, 'magentaB': 13, 'cyanB': 14, 'whiteB': 15}

def ell(cx, cy, rx, ry, ang=0):
    a = math.radians(ang); c, s = math.cos(a), math.sin(a)
    return lambda x, y: (((x-cx)*c+(y-cy)*s)/rx)**2 + ((-(x-cx)*s+(y-cy)*c)/ry)**2 <= 1

def poly(pts):
    def f(x, y):
        ins = False
        for i in range(len(pts)):
            (x1, y1), (x2, y2) = pts[i], pts[(i+1) % len(pts)]
            if (y1 > y) != (y2 > y) and x < (x2-x1)*(y-y1)/(y2-y1)+x1: ins = not ins
        return ins
    return f

def rect(x0, y0, x1, y1): return lambda x, y: x0 <= x <= x1 and y0 <= y <= y1
def both(a, b): return lambda x, y: a(x, y) and b(x, y)
def minus(a, b): return lambda x, y: a(x, y) and not b(x, y)

class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.g = [[None]*w for _ in range(h)]
    def fill(self, shape, tone, only=None):
        for y in range(self.h):
            for x in range(self.w):
                if shape(x+.5, y+.5) and (only is None or self.g[y][x] in only):
                    self.g[y][x] = tone
        return self
    def px(self, pts, tone):
        for x, y in pts:
            if 0 <= x < self.w and 0 <= y < self.h: self.g[y][x] = tone
        return self
    def outline(self, tone='black', skip=()):
        out = [row[:] for row in self.g]
        for y in range(self.h):
            for x in range(self.w):
                t = self.g[y][x]
                if t is None or t in skip: continue
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx, ny = x+dx, y+dy
                    if not (0 <= nx < self.w and 0 <= ny < self.h) or self.g[ny][nx] is None:
                        out[y][x] = tone; break
        self.g = out
        return self
    def ansi(self):
        g = self.g + ([[None]*self.w] if self.h % 2 else [])
        lines = []
        for y in range(0, len(g), 2):
            s = ''
            for x in range(self.w):
                t, b = g[y][x], g[y+1][x]
                fg = lambda c: f"\x1b[{30+ANSI[c] if ANSI[c] < 8 else 90+ANSI[c]-8}m"
                bg = lambda c: f"\x1b[{40+ANSI[c] if ANSI[c] < 8 else 100+ANSI[c]-8}m"
                if t is None and b is None: s += '\x1b[0m '
                elif t is None: s += '\x1b[0m' + fg(b) + '▄'
                elif b is None: s += '\x1b[0m' + fg(t) + '▀'
                elif t == b: s += '\x1b[0m' + fg(t) + '█'
                else: s += '\x1b[0m' + fg(t) + bg(b) + '▀'
            lines.append(s + '\x1b[0m')
        return lines
    # Light themes darken every "white" and "bright" slot so text stays
    # readable, so pale tones would turn muddy: in light mode they become the
    # page itself (transparent) instead. The sun keeps only its accent ring.
    LIGHT = {'whiteB': None, 'white': None, 'yellowB': None}
    EDGE = {'whiteB': 'gray', 'white': 'gray', 'yellowB': 'yellow'}   # outline kept where a pale area meets the page
    def for_light(self):
        out = Canvas(self.w, self.h)
        out.g = [[self.LIGHT.get(t, t) if t else None for t in row] for row in self.g]
        for y in range(self.h):
            for x in range(self.w):
                t = self.g[y][x]
                if t not in self.EDGE: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if not (0 <= nx < self.w and 0 <= ny < self.h) or self.g[ny][nx] is None:
                        out.g[y][x] = self.EDGE[t]; break
        return out
    def png(self, path, theme_file, scale=12):
        from PIL import Image
        pal, bgc = {}, '#000000'
        for line in open(theme_file):
            m = re.match(r'palette = (\d+)=(#[0-9a-fA-F]{6})', line)
            if m: pal[int(m.group(1))] = m.group(2)
            m = re.match(r'background = (#[0-9a-fA-F]{6})', line)
            if m: bgc = m.group(1)
        hexrgb = lambda h: tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
        img = Image.new('RGB', (self.w*scale, self.h*scale), hexrgb(bgc))
        for y in range(self.h):
            for x in range(self.w):
                t = self.g[y][x]
                if t: img.paste(hexrgb(pal[ANSI[t]]), (x*scale, y*scale, (x+1)*scale, (y+1)*scale))
        img.save(path)

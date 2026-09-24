#!/usr/bin/env python3
"""Show the Home art in this terminal, in its theme's own colors (dark, then light)."""
from figures import FIGURES

for name, fn in FIGURES.items():
    c = fn()
    print(name, '(dark mode)'); print('\n'.join(c.ansi())); print()
    print(name, '(light mode)'); print('\n'.join(c.for_light().ansi())); print()

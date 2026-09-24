# Terminal themes

Four theme families for Ghostty + Fresh (+ bat and Magnus, which follow the
terminal's colors). Each family has a light and a dark variant; Ghostty and
Fresh follow macOS light/dark mode.

| Family | Look |
| ------ | ---- |
| `heather` | Slate `#20242A` / Dust `#D2D4C8`, Charcoal highlights, Ash/Steel muted, Lilac accent, green, teal, plus added brick red, ochre and slate blue |
| `lakeglow` | A spring sunset over a lake: twilight-lake `#1B1D30` / sunlit cream, coral sun, gold, rose and lavender sky, lake blues, new-leaf green. Light mode is a pale peach sky with deep-lake text |
| `beacon` | A foggy late night in downtown Boston: blue-gray night `#1A1E25` / fog-gray text, sodium-streetlight orange, lamp-lit yellow, brick and taillight red, Green Line green, harbor teal, a hazy neon magenta. Light mode is a pale fog bank with deep-navy text |
| `hearth` | The Life Tracker web app's original warm palette (parchment / terracotta / amber), contrast-tuned |

## Switching

    magnus-theme                  # show the current family
    magnus-theme heather          # or: lakeglow, beacon, hearth
    magnus-theme install          # (re)install these files into ~/.config

Switching rewrites Ghostty's `theme = light:…,dark:…` line and reloads open
windows, sets Fresh's fallback theme, and records the family in
`~/.config/magnus/terminal-theme`. Fresh (`init.ts`) and Magnus read that file
when they start.

## Files

| Repo file | Installed at |
| --------- | ------------ |
| `<family>/ghostty/*` | `~/.config/ghostty/themes/` |
| `<family>/fresh/*.json` | `~/.config/fresh/themes/` |
| `fresh/init.ts` (picks `<family>-<dark\|light>`) | `~/.config/fresh/init.ts` |
| `bat/config` (`--theme="ansi"`) | `~/.config/bat/config` |

## Color roles

| Slot | Heather | Lakeglow | Beacon | Hearth |
| ---- | ------- | -------- | ------ | ------------ |
| red | brick (errors, overdue) | rose red | brick / taillight | danger red |
| yellow | ochre (warnings, "soon") | gold | lamp-lit yellow | amber |
| green | green (success, code) | new-leaf green | Green Line green | success green |
| blue | slate blue | lake blue (links) | night-fog blue (links) | dusty blue |
| magenta | **lilac (accent)** | lavender | hazy neon | dusty rose |
| cyan | teal (links) | lake teal | harbor teal (code) | sage teal |
| bright red | light brick | **coral sun (accent)** | **sodium orange (accent)** | **terracotta (accent)** |
| bright black | Steel (muted text) | dusk gray | dim fog | muted brown-gray |

Magnus takes its accent and banner gradient from the family (see
`src/lib/theme.js`): lilac → rose for Heather, gold → coral → rose for
Lakeglow, fog blue → sodium orange → lamp yellow for Beacon, terracotta →
amber for Life Tracker.

## Making or tweaking a family

    node terminal-theme/tools/build-theme.mjs <family>

reads `<family>/palette.json` (background, text, 16 starting colors, the
highlight direction, and which slots play which roles). It tunes each
color's lightness only until it meets the contrast target (6.0:1 in dark
mode, 4.8:1 in light by default), picks the strongest selection shade that
keeps all text >= 4.5:1, writes the Ghostty and Fresh files, and prints a
contrast report. `hearth` and `heather` predate the tool and have no
`palette.json`; their files are final. After building, run
`magnus-theme install`, then add the family to `bin/magnus-theme.js` and
`src/lib/theme.js` if it's new.

## Readability

- **Heather dark:** every text color is at least 6.0:1 on the slate background and at least
  4.5:1 on the selection/highlight shade, so a visible Charcoal-slate
  selection fits under colored text.
- **Heather light:** at least 4.8:1 on Dust. Lilac, Ash and Steel are
  deepened (Lilac becomes plum-mauve).
- **Lakeglow, Beacon:** at least 6.0:1 on the background in dark mode, 5.5:1
  in light mode (raised so a visible selection fits), and at least 4.5:1 on
  the selection in both.
- **Hearth:** at least 4.8:1 in both modes. Color 0 in each dark theme
  is a near-background shade by design.
- **Fresh:** highlights keep all text readable, and filled highlights (search,
  errors, diffs) keep text at 7:1 or better.

Checked by rendering Fresh (Markdown, command palette, search), bat, and
every Magnus screen, and scoring each text/background pair.

**Can't be themed:** Fresh's changed-line marker (hardcoded cornflower blue, a
thin bar), and bat's `ansi` theme underlines `--highlight-line` instead of
shading it.

## Web app (Life Tracker)

The same four themes (Heather, Lakeglow, Beacon, Hearth) are available in the Life Tracker web app, generated
from these Ghostty files so both use identical colors:

    npm run themes:web      # = node terminal-theme/tools/build-web.mjs ../LifeTracker

This writes `themes.css` (CSS variables per theme and light/dark mode) and
`js/palettes.js` (the picker's list) into the Life Tracker repo. Commit and
push there to deploy. It also prints a contrast report: every text color on
the page background, cards, sidebar and hover shades is >= 4.5:1, and button
text on accent/danger colors is chosen for the best contrast.

In the web app, the theme picker and the light/dark button (Auto → Light →
Dark; Auto follows the phone/computer setting) are in the sidebar footer.
Choices are saved per device. There's no sync with `magnus-theme`, by design.
After adding a new family here, add it to the FAMILIES list in
`tools/build-web.mjs` and rerun.

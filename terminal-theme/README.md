# Terminal themes

Two theme families for Ghostty + Fresh (+ bat and Magnus, which follow the
terminal's colors). Each family has a light and a dark variant; Ghostty and
Fresh follow macOS light/dark mode.

| Family | Look |
| ------ | ---- |
| `heather` (current) | Slate `#20242A` / Dust `#D2D4C8`, Charcoal highlights, Ash/Steel muted, Lilac accent, green, teal, plus added brick red, ochre and slate blue |
| `life-tracker` (backup) | The Life Tracker web app's warm palette (parchment / terracotta / amber) |

## Switching

    magnus-theme                  # show the current family
    magnus-theme heather     # or: magnus-theme life-tracker
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

| Slot | Heather | Life Tracker |
| ---- | ------------ | ------------ |
| red | brick (errors, overdue) | danger red |
| yellow | ochre (warnings, "soon") | amber |
| green | green (success, code) | success green |
| magenta | **lilac (accent)** | dusty rose |
| cyan | teal (links) | sage teal |
| bright red | light brick | **terracotta (accent)** |
| bright black | Steel (muted text) | muted brown-gray |

Magnus takes its accent from the family: magenta for Heather, bright red
for Life Tracker (see `src/lib/theme.js`).

## Readability

- **Heather dark:** every text color is at least 6.0:1 on the slate background and at least
  4.5:1 on the selection/highlight shade, so a visible Charcoal-slate
  selection fits under colored text.
- **Heather light:** at least 4.8:1 on Dust. Lilac, Ash and Steel are
  deepened (Lilac becomes plum-mauve).
- **Life Tracker:** at least 4.8:1 in both modes. Color 0 in each dark theme
  is a near-background shade by design.
- **Fresh:** highlights keep all text readable, and filled highlights (search,
  errors, diffs) keep text at 7:1 or better.

Checked by rendering Fresh (Markdown, command palette, search), bat, and
every Magnus screen, and scoring each text/background pair.

**Can't be themed:** Fresh's changed-line marker (hardcoded cornflower blue, a
thin bar), and bat's `ansi` theme underlines `--highlight-line` instead of
shading it.

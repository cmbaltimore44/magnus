# Life Tracker terminal theme

Copies of the theme files installed on this Mac, kept here so they're
versioned. Magnus itself uses named ANSI colors and gets its RGB from
whichever of these Ghostty themes is active.

| File | Installed at |
| ---- | ------------ |
| `ghostty/Life Tracker Dark`, `ghostty/Life Tracker Light` | `~/.config/ghostty/themes/` |
| `fresh/themes/life-tracker-{dark,light}.json` | `~/.config/fresh/themes/` |
| `fresh/init.ts` (picks the Fresh theme from macOS light/dark mode) | `~/.config/fresh/init.ts` |
| `bat/config` (`--theme="ansi"`) | `~/.config/bat/config` |

Ghostty config (`~/Library/Application Support/com.mitchellh.ghostty/config`):

    theme = light:Life Tracker Light,dark:Life Tracker Dark

Fresh `~/.config/fresh/config.json` sets `"theme": "life-tracker-dark"` as the
fallback if `init.ts` doesn't run.

## Palette

Colors are the web app's `style.css` palette. Terminal themes need 16 colors,
so blue, magenta and cyan (not in the web palette) are dusty, warm-leaning
additions. Slot meanings: red = danger, bright red = terracotta accent,
yellow = amber, green = success, bright black = muted text.

## Readability

Every text color is at least 4.8:1 contrast on the background (WCAG AA is
4.5:1), in both modes. The one exception is color 0 ("black") in the dark
theme, which is a near-background shade. In the light theme, "white" and
"bright white" are dark warm grays, so programs that print white text stay
readable. The web app's own light-mode amber, muted and terracotta (2.7–3.7:1
on parchment) were darkened, keeping the same hue.

The Fresh themes use exact hex colors. Highlights (current line, selection,
popups) are shifted *away* from the text color, darker in dark mode and
lighter in light mode, so colored text on a highlighted row keeps at least
4.8:1. Filled highlights (search match, errors, diffs) keep text at 7.4:1 or
better.

Known leftovers that can't be themed: Fresh's changed-line marker is
hardcoded cornflower blue (about 2.4:1 in light mode; a thin bar, not text),
and bat's `ansi` theme marks `--highlight-line` with an underline instead of
a background.

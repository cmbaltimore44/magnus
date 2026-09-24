# Magnus

A full-screen terminal companion to Life Tracker (tasks, routines, projects, and
the book/quote library). It talks to the same Supabase project and tables as the
web app, so the two are always in sync. It is also a front door to the journal
scripts on your `$PATH`.

## Install

```sh
npm install
npm run build    # JSX → dist/ (npm 11 skips the "prepare" auto-build unless approved)
npm link         # puts `magnus` on your PATH (symlink to this checkout)
```

After editing anything in `src/`, rebuild with `npm run build` (or leave
`npm run watch` running). `npm link` points at this folder, so the rebuilt
`magnus` picks up changes immediately.

## Run

```sh
magnus            # launch
magnus --logout   # sign out + delete the Keychain item
magnus-theme      # show/switch terminal theme family (see terminal-theme/)
npm run demo      # sample in-memory data: no sign-in, nothing saved
npm test          # unit tests (+ a Keychain round-trip on a throwaway item)
```

Environment variables: `MAGNUS_DEMO=1` (sample data, nothing saved),
`MAGNUS_KITTY=0|1` (force cover images off/on), `MAGNUS_JOURNAL_TABS=0`
(start journal entries in this terminal instead of a new Ghostty tab), and
`VISUAL`/`EDITOR` (editor for long notes; defaults to `fresh`).

On first launch you sign in with an email code. The session is stored in the
macOS Keychain (item `magnus-session`, via the built-in `security` CLI) and
refreshed silently after that. Rotated refresh tokens are written back
automatically. A network failure at startup shows a retry screen and never
discards the saved session.

## Keys

Global: **1–6** jump to a section · **0** home · **ctrl+k** or **/** search ·
**q** quit · **esc** back. Each screen lists its own keys in the footer.

| Screen   | Keys |
| -------- | ---- |
| Today    | ↑↓ · space check off a routine / cycle a starred task's status · enter edit task · s unstar · r new quote |
| Board    | ←→/h l column · ↑↓/j k task · **space** cycle status (H/L back/forward) · s star (max 3) · enter/e edit · n new · d delete · f text filter · c cycle category filter · C manage categories · esc clears filters |
| Routines | space check off · **K/J** move up/down · **H/L** move to the previous/next time of day · n new · d delete |
| Projects | enter open · n new · s cycle status · d delete → in a project: space toggle item · n add · d delete item · K/J reorder · e edit · D delete project |
| Library  | tab Books/Quotes · enter open a book / fold a group · n new → in a book: a add highlight · enter edit · f favorite · e edit book · v view cover · D delete · Quotes tab: F favorites only |
| Journal  | t today · e new essay · b book essay · f film essay · s search (`#tag` = tag search) · g tags · k backlinks · v graph · c quick capture · i triage inbox (opens inbox.md in Fresh) |

In forms: ↑↓ or tab moves between fields, ←→ changes an option, enter saves,
esc cancels. On a Notes field, **ctrl+e** opens `$VISUAL`/`$EDITOR` (or `fresh`)
for multi-line text. Dates accept `2026-10-01`, `10/1`, `today`, `tomorrow`,
`+3`, `fri`, or blank to clear.

## Design notes

- **Colors come from the terminal theme.** Magnus uses named ANSI colors only
  (`src/lib/theme.js` maps accent/muted/danger/… to slots). Two theme
  families for Ghostty, Fresh and bat live in [`terminal-theme/`](terminal-theme/):
  **Heather** (current) and **Life Tracker** (the web app's palette).
  Switch with `magnus-theme heather|life-tracker`. Light/dark follows
  macOS. The banner gradient asks the terminal for the family's two signature
  colors (OSC 4).
- **Handing the terminal to scripts** (`today`, `new-essay`, `jsearch`,
  `jbacklinks`, `$EDITOR`, cover view) goes through Ink 7's `suspendTerminal()`
  plus `spawnSync(…, { stdio: 'inherit' })`. Raw mode, the alternate screen and
  input handling are released while the child runs. ctrl+c belongs to the child.
  If a command exits in under ~1.5s or fails (e.g. "No matches found."), Magnus
  waits for a keypress so you can read the output.
- **Journal entries open in a new Ghostty tab.** Today's Entry and the three
  New Essay items open in a new tab of the front Ghostty window (via Ghostty
  1.3's AppleScript `new tab`), so Magnus keeps running. The tab gets
  Magnus's `PATH`/`JOURNAL_DIR` and closes when Fresh exits. If the script
  fails right away (within ~3s), the tab stays open until you press a key so
  you can read the error. Outside Ghostty (or with
  `MAGNUS_JOURNAL_TABS=0`) they run in this terminal as before. Search and
  Backlinks still take over this terminal.
- **`new-essay --book/--film`**: the script doesn't prompt for a missing
  book/film title (a bare `--book` fails with `$2: unbound variable`), so
  Magnus asks for that one value and lets the script prompt for everything else.
- **Book covers**: `v` in a book downloads the cover, converts it to PNG with
  `sips`, and shows it full-screen via the kitty graphics protocol (Ghostty
  supports it). Any key returns. In the panels a text placeholder is shown,
  since Ink's repaints would wipe inline images.
- **Untrusted text is sanitized.** Supabase responses (via a fetch wrapper),
  journal script output, and the cover caption have terminal control
  sequences stripped (`src/lib/sanitize.js`). Ink already drops most, but not
  OSC 8 hyperlinks or CR/backspace overwrites. Arguments typed into a new
  Ghostty tab are also stripped of control characters and newlines.
- **Schema**: see [MIGRATIONS.md](MIGRATIONS.md). Currently no changes.

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

Global: **1–9** jump to a section · **0** home · **ctrl+k** or **/** search ·
**ctrl+p** or **:** command palette (every action by name: go to a section, new task/project/book, book lookup, any journal action, focus timer controls, switch theme, undo, sign out) · **,** settings (theme, focus length, weight unit, journal entries in a new tab or here, start screen, sign out; saved per device in `prefs.json`) · **a** quick add · **u** undo the last delete (for 10 s, restores children
too: a project's checklist, a book's quotes, a routine's history, a
category's tasks) · **t** start a focus timer on the selected task (Today, Board, Upcoming) · **T** pause / stop / discard it · **q** quit · **esc** back. Each screen lists its own keys in the footer.

| Screen   | Keys |
| -------- | ---- |
| Today    | ↑↓ · space check off a routine / cycle a starred task's status · enter edit task · s unstar · r new quote |
| Board    | ←→/h l column · ↑↓/j k task · **space** cycle status (H/L back/forward) · s star (max 3) · enter/e edit · n new · d delete · f text filter · c cycle category filter · C manage categories · esc clears filters |
| Routines | space check off · **K/J** move up/down · **H/L** move to the previous/next time of day · n new · d delete |
| Projects | enter open · n new · s cycle status · d delete → in a project: space toggle item · n add · d delete item · K/J reorder · e edit · D delete project |
| Library  | tab Books → Quotes → **Stats** (finished this year, ratings, days to finish, per year, by format, repeat authors) · enter open a book / fold a group · **i look up a book on Open Library** by ISBN or title/author and start a New Book prefilled (title, author, ISBN, cover) · n new → in a book: n add highlight · enter edit · f favorite · **w send a quote to an essay** (append to an existing essay, or start a new book essay with the quote on the clipboard) · e edit book · i fill in the cover/ISBN/author from Open Library · v view cover · D delete · Quotes tab: F favorites only |
| Upcoming | overdue, today, tomorrow, next 7 days — tasks by due date and projects by target date · space mark done · enter open |
| Insights | tasks finished per week (8 weeks, from `completed_at`), routine consistency (30 days), focus minutes per week, mood/energy/sleep sparklines and workouts from the Log, writing streak, books this year · ↑↓ scrolls on narrow windows |
| Log      | ←→ day · ↑↓ row · enter set mood/energy (1–5), hours slept, weight · n add a workout (`30 run`) · d clear (u undoes) · t back to today · a two-week table below. Mood/energy/sleep from `today` land here too |
| Journal  | header: writing streak (consecutive days with a daily entry) and entries this month; a heatmap of entries per day sits beside the menu on wide windows (below it on tall ones) · t today (asks for mood, energy and hours slept once a day, e.g. `4 3 7.5`) · e new essay · b book essay · f film essay · s search (`#tag` = tag search) · g tags · k backlinks · v graph · c quick capture · **r triage inbox** one item at a time (t → task via quick add, n → note, e → essay, d delete, u undo, s skip) · i edit inbox.md in Fresh · e/b/f/n end with an optional tags / `[[links]]` prompt · n new note · x note from inbox · w weekly review (`jweek`) · l browse all entries (enter open, d move to Trash, tab type filter, f text filter) · d back up to drive (plug it in first) |

**Focus timer**: one at a time, 25 minutes by default (Settings). The time
left shows at the bottom right; a bell rings when it's done. Finished runs, and
runs stopped after at least a minute, are logged to `focus_sessions` (schema_003).
The timer survives quitting Magnus.

**Quick add** (`a`, anywhere): one line becomes a task —
`renew passport fri !high #home *` sets the due date (`today`, `tom`, weekday
names, `+3`, `10/1`, `2026-10-01`), priority (`!high`/`!h`, `!low`), the category
whose name starts with `home`, and a star. `> some thought` goes to the journal
inbox instead. Anything that doesn't resolve stays in the title.

**Status bar**: between notifications, the line above the key hints shows
overdue and due-today counts, routines done today, and your writing streak;
on the right, the focus timer, the connection state and the time.

**Split view**: at 140+ columns, Projects, Library (books) and the journal
entry browser show the list on the left and a read-only preview of the
selected item on the right (checklist, highlights, the entry's Markdown).

In forms: ↑↓ or tab moves between fields, ←→ changes an option, enter saves,
esc cancels. On a Notes field, **ctrl+e** opens `$VISUAL`/`$EDITOR` (or `fresh`)
for multi-line text. Dates accept `2026-10-01`, `10/1`, `today`, `tomorrow`,
`+3`, `fri`, or blank to clear.

## Design notes

- **Colors come from the terminal theme.** Magnus uses named ANSI colors only
  (`src/lib/theme.js` maps accent/muted/danger/… to slots). Two theme
  families for Ghostty, Fresh and bat live in [`terminal-theme/`](terminal-theme/):
  **Heather**, **Lakeglow** (spring sunset over a lake), **Beacon**
  (foggy late night in downtown Boston) and **Hearth** (the web app's
  original palette). Switch with `magnus-theme heather|lakeglow|beacon|hearth`. Light/dark follows
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

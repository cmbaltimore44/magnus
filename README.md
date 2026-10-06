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
category's tasks) · **t** start a Pomodoro on the selected task (Today, Board, Upcoming) · **T** start one without a task, or pause / skip / +5 / stop it · **q** quit · **esc** back. Each screen lists its own keys in the footer.

| Screen   | Keys |
| -------- | ---- |
| Today    | ↑↓ · space check off a routine / cycle a starred task's status · enter edit task · s unstar · r new quote |
| Board    | ←→/h l column · ↑↓/j k task · **space** cycle status (H/L back/forward) · s star (max 3) · enter/e edit · n new · d delete · f text filter · c cycle category filter · C manage categories · esc clears filters |
| Routines | space check off · **K/J** move up/down · **H/L** move to the previous/next time of day · n new · d delete |
| Projects | enter open · n new · s cycle status · d delete → in a project: space toggle item · n add · d delete item · K/J reorder · e edit · D delete project |
| Library  | tab Books → **Want to Read** (a queue: one line per book in your order, first three "Up next"; n rapid add `Title by Author` or an ISBN; K/J reorder; f filter; **s start reading** sets Currently Reading and today's start date, u undoes; `?` = still missing an author or cover — open it and press i) → Quotes → **Stats** (finished this year, ratings, days to finish, per year, by format, repeat authors) · enter open a book / fold a group · **i look up a book on Open Library** by ISBN or title/author and start a New Book prefilled (title, author, ISBN, cover) · n new → in a book: n add highlight · enter edit · f favorite · **w send a quote to an essay** (append to an existing essay, or start a new book essay with the quote on the clipboard) · e edit book · i fill in the cover/ISBN/author from Open Library · v view cover · D delete · Quotes tab: F favorites only |
| Upcoming | overdue, today, tomorrow, next 7 days — tasks by due date and projects by target date · space mark done · enter open |
| Insights | tasks finished per week (8 weeks, from `completed_at`), routine consistency (30 days), focus minutes per week and by task or label (30 days), mood/energy/sleep sparklines and workouts from the Log, writing streak, books this year · ↑↓ scrolls on narrow windows |
| Log      | ←→ day · ↑↓ row · enter set mood/energy (1–5), hours slept, weight · n add a workout (`30 run`) · d clear (u undoes) · t back to today · a two-week table below. Mood/energy/sleep from `today` land here too |
| Today    | under the date, **◎ Goals**: the unchecked items of a list named *Goals* (make it in Lists; check a goal off when you reach it). The weekly review (`jweek`) gets a Goals section with reflection prompts for each |
| Lists    | `k` from Home (no digit left) or the palette · lists on the left, the open list's items on the right (enter/esc on narrow windows) · space check · n add (stays open for the next item) · e edit text, link, price · o open link · c clear checked · d delete · K/J reorder · checked items sink to the bottom; prices total the unchecked ones |
| Journal  | header: writing streak (consecutive days with a daily entry) and entries this month; a heatmap of entries per day sits beside the menu on wide windows (below it on tall ones) · t today (asks for mood, energy and hours slept once a day, e.g. `4 3 7.5`) · o close the day (`today --close`: adds an Evening section with tasks finished, routines, carry-overs and reflection prompts; run it again to refresh the summary, your answers are kept) · e new essay · b book essay · f film essay · s search (`#tag` = tag search) · g tags · k backlinks · v graph · c quick capture · **r triage inbox** one item at a time (t → task via quick add, n → note, e → essay, d delete, u undo, s skip) · captures from the phone (a Shortcut appending to `iCloud Drive/Magnus/inbox-queue.txt`) move into inbox.md via `capture-batch` whenever the Journal tab or triage opens · i edit inbox.md in the journal editor (`JOURNAL_EDITOR`: fresh, obsidian or nvim; with obsidian, scripts hand the file over without a new tab) · e/b/f/n end with an optional tags / `[[links]]` prompt that suggests tags from TAGS.md and the ones you use (tab completes) · j tag today's entry (`jtag` checklist) · n new note · x note from inbox · w weekly review (`jweek`) · l browse all entries (enter open, t tags, d move to Trash, tab type filter, f text filter) · d back up to drive (plug it in first) |

**Focus timer (Pomodoro)**: `t` on a task (Today, Board, Upcoming) starts a
focus round on it; `T` anywhere asks what to focus on (a task, a recent
label, a recent essay or note, or type anything: "job apps"; enter on the
first row just starts). A round is 25 min focus, 5 min break, and a 15 min long
break after every 4 rounds (all adjustable in Settings). When a phase ends,
Magnus rings, posts a macOS notification and waits: `T` → start the next
phase or add 5 minutes. While it runs, `T` pauses/resumes, skips to the next
phase, adds 5 minutes, stops or discards. Focus minutes (≥1, pauses and
waiting excluded) are logged to `focus_sessions` when you leave a focus
round, with the task or label (labels need `schema_005.sql`; before it,
the time is saved without one). The timer survives quitting Magnus; the
status bar shows it. It lives in `~/.config/magnus/timer.json` (versioned,
written atomically) and is shared with **`magnus timer`**
(`status [--json] | start [--task ID | --label "…"] | pause | resume | skip |
add5 | switch | stop | discard | alerts | minutes`), which runs the same code as
the `t`/`T` keys, logs focus time the same way, and works with or without the
TUI open; changes made there show up in the status bar within a second.
Magnus Tutor displays and controls the timer through these commands (contract:
`magnus-tutor/docs/timer-contract.md`).
**Switching task** keeps the clock and the round count: `t` on another task
while a timer runs, or `T` → *Switch task…* (the same list: tasks, labels,
essays and notes, or type a new label) or *Focus on no task*. Mid-round,
the minutes so far are logged to the old one and the rest go to the new
one. In a break, it sets what the next round is on.

**Tutor** (`o` from Home, or the palette's *Tutor:* actions): the front door to
[Magnus Tutor](../magnus-tutor), a separate local study tutor. Ask a question and
the answer streams in place (math as LaTeX text; `w` opens the conversation in the
web app, `f` asks a follow-up). *Start problem-set session* labels a focus round
`office hours: <course> <pset>` (switching the running round if there is one) and
opens the web app on that session. Also: open the web app, ingest new PDFs, new
course from a syllabus, a journal note for the session, and concepts to review
(`t` → quick add `review: … !low +2`). From a shell: `magnus tutor` (start it and
open the web app), `magnus tutor ask "…" [--course em]`, `magnus tutor stop`. The
tutor starts on demand (`tutor start`) and never touches Supabase. It's found via
`$MAGNUS_TUTOR_BIN`, the `tutorCommand` pref, or `../magnus-tutor/.venv/bin/tutor`.

**Quick add** (`a`, anywhere): one line becomes a task —
`renew passport fri !high #home *` sets the due date (`today`, `tom`, weekday
names, `+3`, `10/1`, `2026-10-01`), priority (`!high`/`!h`, `!low`), the category
whose name starts with `home`, and a star. `book: Piranesi by Susanna Clarke` (or `b: …`, or `b: <ISBN>`) adds a Want to Read book; Magnus then fills in the author, cover and ISBN from Open Library when there's one clear match. `+groceries oat milk` adds to a list (name or prefix). `> some thought` goes to the journal
inbox instead. Anything that doesn't resolve stays in the title.

**Offline mode**: every read is cached in `~/.config/magnus/cache.json`
(readable only by you; cleared on sign-out). Without a network, Magnus opens
on the saved session and cached data, and edits are applied locally and
queued; the status bar shows `○ offline · N queued`. When the network is
back, the queue replays in order (last write wins) and the views refresh.
`magnus context` works offline from the same cache.

**Live updates**: Magnus subscribes to Supabase Realtime (enabled by
schema_003), so a change made on the phone shows up without pressing R.
Updates wait while you're typing in a form. `● live` in the status bar means
the subscription is up.

**Home art**: when the window is wide enough, Home's right side shows a
pixel-art heron crossing the sun, on its own in the open space to the right
of the menu (narrower windows leave it out). It moves
gently: a slow glide, the reflection shimmering, and a wing beat every few
seconds (`MAGNUS_STILL=1` holds it still). The art is drawn in `art/figures.py`
(Python, with a preview tool: `python3 art/preview.py`) and exported to
`src/ui/art/heronSun.js` by `npm run art`, as dark- and light-mode pixel grids
in the theme's named colors; light mode turns pale tones into the page itself so
nothing goes muddy. Magnus follows the macOS appearance for light/dark
(`MAGNUS_APPEARANCE=light|dark` overrides). The tab bar carries a 🪶 feather.

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

**Dictating quotes**: in a quote or highlight form, **ctrl+d** on the Quote
field records from the mic (Enter stops, Esc cancels) and transcribes it
offline with Whisper through `~/bin/dictate`. Whisper gets the book's title,
author and existing quotes as hints, so names and coined words come out
right. Spoken "comma", "period", "em dash", "new paragraph" and so on become
punctuation. Dictating again adds to the end, so a long passage can be read
in pieces. Saving pairs the clip with the final text in
`~/.local/share/dictate/corpus` (training data for tuning Whisper to your
voice later). Setup: `brew install whisper-cpp sox`, plus the model from
`dictate --help`.

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

# Schema changes

Magnus reads and writes the **same Supabase tables and columns** as the Life
Tracker web app. Any change to the schema has to be mirrored in the web app's
UI (in the separate Life Tracker repo), so every change is logged here.

## Current status: no schema changes

Magnus v0.1 needs **no new tables, columns, constraints, or policies**. It uses
exactly what `supabase/schema.sql` and `supabase/schema_002.sql` define:

| Table                 | Columns Magnus reads/writes                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `categories`          | `id, user_id, name, color, sort_order`                                                                               |
| `tasks`               | `id, user_id, category_id, title, notes, status, due_date, priority, sort_order, is_starred`                         |
| `routines`            | `id, user_id, name, time_of_day, sort_order`                                                                         |
| `routine_completions` | `id, user_id, routine_id, completed_date`                                                                            |
| `projects`            | `id, user_id, name, status, notes, target_date, sort_order`                                                          |
| `project_tasks`       | `id, user_id, project_id, title, done, sort_order`                                                                   |
| `books`               | `id, user_id, title, author, cover_image_url, status, format, started_date, finished_date, rating, isbn, notes, sort_order` |
| `quotes`              | `id, user_id, book_id, attribution, quote_text, is_favorite, sort_order`                                             |

## Behavior worth knowing on the web-app side (no schema impact)

- **Category colors.** New categories created in Magnus store one of the web
  app's own eight swatch hex values (`js/views/board.js` `COLORS`), so they
  look normal in the web app. Magnus shows each stored color as its nearest
  terminal color.
- **Palette.** The Life Tracker Ghostty/Fresh themes (`terminal-theme/`) are
  derived from the web app's `style.css` (UI-only, no schema impact). Light-mode
  colors were darkened for contrast. If you change the web palette, regenerate
  or hand-edit those theme files.
- **Rules mirrored from the web app:** max 3 starred tasks; moving a task to
  Done auto-unstars it; the routine-streak grace period; the heatmap's
  "today's routine count" denominator; quote attribution derived from the
  book's current title.
- **Local-only UI state** (which Library groups are collapsed) lives in
  `~/.config/magnus/prefs.json`, the counterpart of the web app's
  `localStorage`. It never touches Supabase.

## Template for future entries

```
## YYYY-MM-DD — <short title>
Why: <Magnus feature that needs it>
SQL (run in Supabase SQL editor):
    alter table ... ;
Web app follow-up: <what the Life Tracker UI needs to show/handle>
Backward compatible with the current web app? yes/no — <details>
```

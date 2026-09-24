import { useState } from 'react';
import { C, FAMILY } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useViewInput } from '../context.js';
import { getPref, setPref } from '../../lib/prefs.js';
import { moveIndex } from '../components/layout.js';

// Per-device preferences (~/.config/magnus/prefs.json), like the web app's
// localStorage settings. Nothing here is stored in Supabase.
const HINTS = '↑↓ setting · ←→ change · enter apply theme / sign out · esc home';
const FAMILIES = ['heather', 'lakeglow', 'beacon', 'hearth'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function Settings({ sections }) {
  const { navigate, notify, capture, signOut, email } = useAppCtx();
  const [row, setRow] = useState(0);
  const [theme, setTheme] = useState(FAMILY);
  const [prefs, setPrefs] = useState(() => ({
    focusMinutes: getPref('focusMinutes', 25),
    breakMinutes: getPref('breakMinutes', 5),
    longBreakMinutes: getPref('longBreakMinutes', 15),
    longBreakEvery: getPref('longBreakEvery', 4),
    weightUnit: getPref('weightUnit', 'lb'),
    journalTabs: getPref('journalTabs', true),
    startView: getPref('startView', 'home'),
  }));
  useHints(HINTS);

  const starts = ['home', ...sections.map((s) => s.view)];
  const startLabel = (v) => (v === 'home' ? 'Home' : sections.find((s) => s.view === v)?.label || v);
  const rows = [
    { key: 'theme', label: 'Theme', values: FAMILIES, show: (v) => `${cap(v)}${v === FAMILY ? ' (current)' : ''}`, note: 'Ghostty, Fresh and bat · enter applies (restart Magnus for its accent)' },
    { key: 'focusMinutes', label: 'Focus length', values: [15, 20, 25, 30, 45, 50, 60, 90], show: (v) => `${v} minutes`, note: 'Pomodoro: focus, break, focus… and a long break every few rounds' },
    { key: 'breakMinutes', label: 'Break', values: [3, 5, 10, 15], show: (v) => `${v} minutes` },
    { key: 'longBreakMinutes', label: 'Long break', values: [10, 15, 20, 25, 30], show: (v) => `${v} minutes` },
    { key: 'longBreakEvery', label: 'Long break after', values: [2, 3, 4, 5, 6], show: (v) => `${v} focus rounds` },
    { key: 'weightUnit', label: 'Weight unit', values: ['lb', 'kg'], show: (v) => v, note: 'label only; values are stored as typed' },
    { key: 'journalTabs', label: 'Journal entries', values: [true, false], show: (v) => (v ? 'open in a new Ghostty tab' : 'open in this terminal') },
    { key: 'startView', label: 'Start screen', values: starts, show: startLabel },
    { key: 'account', label: 'Account', show: () => email || 'signed in', note: 'enter signs out (the Keychain session is removed)' },
  ];
  const current = rows[row];
  const valueOf = (r) => (r.key === 'theme' ? theme : prefs[r.key]);

  const change = (delta) => {
    if (!current.values) return;
    const i = current.values.indexOf(valueOf(current));
    const next = current.values[(i + delta + current.values.length) % current.values.length];
    if (current.key === 'theme') return setTheme(next);
    setPrefs((p) => ({ ...p, [current.key]: next }));
    setPref(current.key, next);
  };

  useViewInput(async (input, key) => {
    if (key.escape) return navigate('home');
    if (key.upArrow || input === 'k') return setRow((r) => moveIndex(r, -1, rows.length));
    if (key.downArrow || input === 'j') return setRow((r) => moveIndex(r, 1, rows.length));
    if (key.leftArrow || input === 'h') return change(-1);
    if (key.rightArrow || input === 'l' || input === ' ') return change(1);
    if (key.return && current.key === 'theme') {
      if (theme === FAMILY) return notify(`${cap(theme)} is already the theme`, 'info');
      const res = await capture('magnus-theme', [theme]);
      return notify(res.ok ? `Theme → ${cap(theme)}. Restart Magnus for its accent color.` : res.stderr.trim() || 'magnus-theme failed', res.ok ? 'success' : 'error');
    }
    if (key.return && current.key === 'account') return signOut();
  });

  return (
    <Box flexDirection="column">
      <Text bold>Settings</Text>
      <Box flexDirection="column" marginTop={1}>
        {rows.map((r, i) => (
          <Box key={r.key} flexDirection="column">
            <Text wrap="truncate-end">
              <Text color={C.accent}>{i === row ? '› ' : '  '}</Text>
              <Text bold={i === row}>{r.label.padEnd(17)}</Text>
              {r.values ? <Text color={C.muted}>{i === row ? '‹ ' : '  '}</Text> : null}
              <Text color={i === row ? C.accent : undefined}>{r.show(valueOf(r))}</Text>
              {r.values && i === row ? <Text color={C.muted}> ›</Text> : null}
            </Text>
            {i === row && r.note ? <Text color={C.muted}>{'   '}{' '.repeat(17)}{r.note}</Text> : null}
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color={C.muted}>Saved on this Mac in ~/.config/magnus/prefs.json. MAGNUS_JOURNAL_TABS=0/1 overrides the journal setting.</Text>
      </Box>
    </Box>
  );
}

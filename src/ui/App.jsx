import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../lib/theme.js';
import { Box, Text, useApp, useInput, useWindowSize } from 'ink';
import { AppContext } from './context.js';
import { truncate } from '../lib/display.js';
import { restoreSession, currentUserId } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { runInteractive, runCapture, editText } from '../lib/shell.js';
import { canOpenGhosttyTabs, openInGhosttyTab } from '../lib/ghostty.js';
import { loadCoverPng, showCoverFullscreen, supportsKittyGraphics } from '../lib/kitty.js';
import { Login } from './views/Login.jsx';
import { Home } from './views/Home.jsx';
import { Today } from './views/Today.jsx';
import { Board } from './views/Board.jsx';
import { Routines } from './views/Routines.jsx';
import { Projects } from './views/Projects.jsx';
import { Library } from './views/Library.jsx';
import { Journal } from './views/Journal.jsx';
import { Search } from './views/Search.jsx';
import { Upcoming } from './views/Upcoming.jsx';
import { Insights } from './views/Insights.jsx';
import { Log } from './views/Log.jsx';
import { QuickAdd } from './components/QuickAdd.jsx';
import { Choice } from './components/Prompt.jsx';
import { useFocusTimer, formatRemaining } from './useFocusTimer.js';

export const SECTIONS = [
  { view: 'today', label: 'Today', key: 't', digit: '1', component: Today },
  { view: 'board', label: 'Board', key: 'b', digit: '2', component: Board },
  { view: 'routines', label: 'Routines', key: 'r', digit: '3', component: Routines },
  { view: 'projects', label: 'Projects', key: 'p', digit: '4', component: Projects },
  { view: 'library', label: 'Library', key: 'l', digit: '5', component: Library },
  { view: 'journal', label: 'Journal', key: 'j', digit: '6', component: Journal },
  { view: 'upcoming', label: 'Upcoming', key: 'w', digit: '7', component: Upcoming },
  { view: 'insights', label: 'Insights', key: 'i', digit: '8', component: Insights },
  { view: 'log', label: 'Log', key: 'g', digit: '9', component: Log },
];

function TabBar({ current, columns }) {
  // Full labels when they fit; otherwise inactive tabs shrink to their digit.
  const fullWidth = 8 + SECTIONS.reduce((n, s) => n + s.label.length + 5, 0);
  const compact = fullWidth > columns - 2;
  return (
    <Box paddingX={1}>
      <Text wrap="truncate-end">
        <Text color={C.accent} bold>
          MAGNUS{' '}
        </Text>
        {SECTIONS.map((s) => {
          const active = current === s.view;
          const label = compact && !active ? ` ${s.digit} ` : ` ${s.digit} ${s.label} `;
          return (
            <Text key={s.view}>
              {' '}
              {active ? (
                <Text color={C.accent} bold inverse>
                  {label}
                </Text>
              ) : (
                <Text color={C.muted}>{label}</Text>
              )}
            </Text>
          );
        })}
      </Text>
    </Box>
  );
}

const STATUS_COLORS = { error: 'danger', success: 'success', info: 'accent' };

function Footer({ hints, status, columns, focus }) {
  const timer = focus ? `${focus.pausedAt ? '⏸' : '◷'} ${formatRemaining(focus)} ${truncate(focus.title, 24)}` : '';
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box width={columns - 2}>
        <Box flexGrow={1} flexShrink={1}>
          <Text wrap="truncate-end">
            {status ? <Text color={C[STATUS_COLORS[status.kind] || 'accent']}>{status.text}</Text> : <Text> </Text>}
          </Text>
        </Box>
        {timer ? (
          <Box flexShrink={0} marginLeft={1}>
            <Text color={focus.pausedAt ? C.muted : C.accent}>{timer}</Text>
          </Box>
        ) : null}
      </Box>
      <Box width={columns - 2}>
        <Text color={C.muted} wrap="truncate-end">
          {hints}
        </Text>
      </Box>
    </Box>
  );
}

export default function App({ gradient }) {
  const { exit, suspendTerminal } = useApp();
  const { columns, rows } = useWindowSize();
  const [auth, setAuth] = useState({ state: 'loading' });
  const [route, setRoute] = useState({ view: 'home', params: {}, key: 0 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  // Bumped whenever data changes outside the current view (quick add, live
  // updates); every useLoader reloads on it.
  const [dataVersion, setDataVersion] = useState(0);
  const dataChanged = useCallback(() => setDataVersion((v) => v + 1), []);
  const [focusMenuOpen, setFocusMenuOpen] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [hints, setHints] = useState('');
  const [status, setStatus] = useState(null);
  const statusTimer = useRef(null);

  const notify = useCallback((text, kind = 'info', ms) => {
    clearTimeout(statusTimer.current);
    setStatus({ text, kind });
    statusTimer.current = setTimeout(() => setStatus(null), ms ?? (kind === 'error' ? 8000 : 4000));
  }, []);

  // Undo after delete: the latest deletion can be restored with u for 10s.
  const undoRef = useRef(null);
  const offerUndo = useCallback(
    (label, restore) => {
      const entry = { restore, expires: Date.now() + 10000 };
      undoRef.current = entry;
      notify(`${label} · u to undo`, 'info', 10000);
    },
    [notify]
  );
  const runUndo = useCallback(async () => {
    const entry = undoRef.current;
    if (!entry || Date.now() > entry.expires) return false;
    undoRef.current = null;
    try {
      await entry.restore();
      notify('Restored', 'success');
      setDataVersion((v) => v + 1);
    } catch (err) {
      notify(`Couldn't undo: ${err.message}`, 'error');
    }
    return true;
  }, [notify]);

  const focus = useFocusTimer({ userId: currentUserId(auth.session), notify, dataChanged });

  const checkSession = useCallback(async () => {
    setAuth({ state: 'loading' });
    const { session, offline, error } = await restoreSession();
    if (session) setAuth({ state: 'ready', session });
    else if (offline) setAuth({ state: 'offline', message: error?.message });
    else setAuth({ state: 'login' });
  }, []);

  useEffect(() => {
    checkSession();
    // If the refresh token is ever revoked mid-session, go back to sign-in.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setAuth({ state: 'login' });
    });
    return () => data.subscription.unsubscribe();
  }, [checkSession]);

  const navigate = useCallback((view, params = {}) => {
    setSearchOpen(false);
    setRoute((r) => ({ view, params, key: r.key + 1 }));
  }, []);

  const ctx = useMemo(
    () => ({
      userId: currentUserId(auth.session),
      searchOpen,
      overlayOpen: searchOpen || quickAddOpen || focusMenuOpen,
      startFocus: focus.start,
      dataVersion,
      dataChanged,
      offerUndo,
      columns,
      rows,
      // tab bar (1) + footer (2), plus the view's own padding line
      contentHeight: Math.max(6, rows - (route.view === 'home' ? 3 : 4)),
      navigate,
      notify,
      setHints,
      setCaptureCount,
      run: (cmd, args, opts) => runInteractive(suspendTerminal, cmd, args, opts),
      capture: (cmd, args) => runCapture(cmd, args),
      // A new Ghostty tab when possible (Magnus stays up here), else this terminal.
      openTab: async (cmd, args = []) => {
        if (canOpenGhosttyTabs()) {
          try {
            return await openInGhosttyTab(cmd, args);
          } catch (err) {
            notify(`Couldn't open a Ghostty tab (${err.message}) — running here instead`, 'error');
          }
        }
        return runInteractive(suspendTerminal, cmd, args);
      },
      editText: (initial) => editText(suspendTerminal, initial),
      showCover: async (url, caption) => {
        if (!url) return notify('This book has no cover image URL.', 'info');
        if (!supportsKittyGraphics()) {
          return notify("This terminal doesn't support the kitty image protocol (set MAGNUS_KITTY=1 to force).", 'error');
        }
        try {
          notify('Loading cover…', 'info');
          const png = await loadCoverPng(url);
          await showCoverFullscreen(suspendTerminal, png, caption);
          setStatus(null);
        } catch (err) {
          notify(`Couldn't show cover: ${err.message}`, 'error');
        }
      },
    }),
    [auth.session, focus.start, focusMenuOpen, searchOpen, quickAddOpen, dataVersion, dataChanged, offerUndo, columns, rows, route.view, navigate, notify, suspendTerminal]
  );

  const ready = auth.state === 'ready';

  useInput(
    (input, key) => {
      if (key.ctrl && input === 'k') {
        setSearchOpen(true);
        return;
      }
      if (key.ctrl || key.meta) return;
      if (input === '/') return setSearchOpen(true);
      if (input === 'q') return exit();
      if (input === 'a') return setQuickAddOpen(true);
      if (input === 'u') return runUndo();
      if (input === 'T') return focus.timer ? setFocusMenuOpen(true) : notify('No focus timer running — press t on a task to start one', 'info');
      if (input === '0') return navigate('home');
      const section = SECTIONS.find((s) => s.digit === input);
      if (section) navigate(section.view);
    },
    { isActive: ready && !searchOpen && !quickAddOpen && !focusMenuOpen && captureCount === 0 }
  );

  useInput(
    (input, key) => {
      if (input === 'q' || (key.ctrl && input === 'c')) exit();
      if (input === 'r') checkSession();
    },
    { isActive: auth.state === 'offline' }
  );

  let body;
  if (auth.state === 'loading') {
    body = (
      <Box padding={1}>
        <Text color={C.muted}>Connecting to Life Tracker…</Text>
      </Box>
    );
  } else if (auth.state === 'offline') {
    body = (
      <Box padding={1} flexDirection="column">
        <Text color={C.danger}>Couldn't reach Supabase{auth.message ? `: ${auth.message}` : ''}.</Text>
        <Text color={C.muted}>Your saved session is kept. [r] retry · [q] quit</Text>
      </Box>
    );
  } else if (auth.state === 'login') {
    body = <Login gradient={gradient} onAuthenticated={(session) => setAuth({ state: 'ready', session })} />;
  } else {
    const View = route.view === 'home' ? Home : SECTIONS.find((s) => s.view === route.view).component;
    // The current view stays mounted (just hidden) under the search overlay,
    // so closing search returns you exactly where you were.
    body = (
      <>
        <Box display={searchOpen ? 'none' : 'flex'} flexDirection="column" flexGrow={1} flexShrink={1} flexBasis={0} minHeight={0} overflow="hidden">
          <View key={route.key} params={route.params} gradient={gradient} sections={SECTIONS} />
        </Box>
        {searchOpen ? <Search onClose={() => setSearchOpen(false)} /> : null}
        {quickAddOpen && !searchOpen ? <QuickAdd onClose={() => setQuickAddOpen(false)} /> : null}
        {focusMenuOpen && focus.timer ? (
          <Box flexShrink={0} flexDirection="column">
          <Choice
            title={`Focus · ${formatRemaining(focus.timer)} left on “${focus.timer.title}”`}
            options={[
              { key: 'pause', label: focus.timer.pausedAt ? 'Resume' : 'Pause' },
              { key: 'stop', label: 'Stop and log the time so far' },
              { key: 'discard', label: 'Discard (log nothing)' },
            ]}
            onPick={(opt) => {
              setFocusMenuOpen(false);
              if (opt.key === 'pause') focus.togglePause();
              else if (opt.key === 'stop') focus.stop();
              else focus.discard();
            }}
            onCancel={() => setFocusMenuOpen(false)}
          />
          </Box>
        ) : null}
      </>
    );
  }

  return (
    <AppContext.Provider value={ctx}>
      <Box flexDirection="column" width={columns} height={rows}>
        {ready && route.view !== 'home' ? <TabBar current={searchOpen ? null : route.view} columns={columns} /> : null}
        <Box flexDirection="column" flexGrow={1} paddingX={1} overflow="hidden">
          {body}
        </Box>
        <Footer hints={ready ? hints : ''} status={status} columns={columns} focus={ready ? focus.timer : null} />
      </Box>
    </AppContext.Provider>
  );
}

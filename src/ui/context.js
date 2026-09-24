import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useInput } from 'ink';

export const AppContext = createContext(null);

export function useAppCtx() {
  return useContext(AppContext);
}

// Components that own a text input (forms, prompts, search) call this so the
// app-wide single-key shortcuts (q, 1-6, /) stand down while you're typing.
export function useCapture(on = true) {
  const { setCaptureCount } = useAppCtx();
  useEffect(() => {
    if (!on) return undefined;
    setCaptureCount((c) => c + 1);
    return () => setCaptureCount((c) => c - 1);
  }, [on, setCaptureCount]);
}

// Each view publishes its key hints for the footer.
export function useHints(hints) {
  const { setHints, searchOpen } = useAppCtx();
  useEffect(() => {
    if (!searchOpen && hints != null) setHints(hints);
  }, [hints, setHints, searchOpen]);
}

// useInput for a view's top-level keys: automatically inactive while the
// global search overlay is open on top of it.
export function useViewInput(handler, active = true) {
  const { searchOpen } = useAppCtx();
  useInput(
    (input, key) => {
      if (key.ctrl || key.meta || input === '/') return; // global shortcuts
      handler(input, key);
    },
    { isActive: active && !searchOpen }
  );
}

// Loads view data; errors go to the status bar instead of crashing the app.
export function useLoader(load) {
  const { notify } = useAppCtx();
  const loadRef = useRef(load);
  loadRef.current = load;
  const [state, setState] = useState({ loading: true, data: null });

  const reload = useCallback(async () => {
    try {
      const data = await loadRef.current();
      setState({ loading: false, data });
      return data;
    } catch (err) {
      notify(err.message || String(err), 'error');
      setState((s) => ({ ...s, loading: false }));
      return null;
    }
  }, [notify]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { data: state.data, loading: state.loading, reload, setData };
}

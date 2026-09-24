import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Supabase Realtime (enabled by schema_003): any change to the shared tables —
// from the web app on the phone, or another Magnus — reloads the open view.
// Bursts are coalesced, and nothing reloads under an open form or prompt
// (paused → flushed once you're done typing).
// Returns 'live' | 'connecting' | 'off'.
export function useLiveUpdates({ ready, paused, onChange }) {
  const [state, setState] = useState('off');
  const pending = useRef(false);
  const timer = useRef(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!ready || !supabase.channel) return undefined;
    setState('connecting');
    const fire = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (pausedRef.current) pending.current = true;
        else onChangeRef.current();
      }, 1000);
    };
    const channel = supabase
      .channel('magnus-live')
      .on('postgres_changes', { event: '*', schema: 'public' }, fire)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setState('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setState('off');
      });
    return () => {
      clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [ready]);

  useEffect(() => {
    if (!paused && pending.current) {
      pending.current = false;
      onChangeRef.current();
    }
  }, [paused]);

  return state;
}

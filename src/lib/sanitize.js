// Strips terminal control sequences from text that didn't originate in
// Magnus (Supabase rows, journal script output, book titles) before it can
// reach the terminal. Ink already drops most escape sequences, but not OSC 8
// hyperlinks (which could disguise a link's target), BEL, CR or backspace
// (which can overwrite what's on a line) — and a few writes bypass Ink.

// ESC-introduced sequences: CSI (ESC [ … final), OSC/DCS/APC/PM/SOS strings
// (ESC ] P _ ^ X … terminated by BEL or ST), and two-character escapes.
const ESC_SEQUENCES = /\x1b(?:\[[0-?]*[ -/]*[@-~]|[\]P_^X][\s\S]*?(?:\x07|\x1b\\|$)|[ -/]*[0-~])?/g;
// C1 controls, and C0 controls other than tab / newline.
const CONTROLS = /[\x00-\x08\x0b-\x1f\x7f-\x9f]/g;

export function cleanText(value, { keepNewlines = true } = {}) {
  if (typeof value !== 'string') return value;
  let s = value.replace(ESC_SEQUENCES, '').replace(/\r\n?/g, '\n').replace(CONTROLS, '');
  if (!keepNewlines) s = s.replace(/[\n\t]+/g, ' ');
  return s;
}

// Recursively clean every string in a JSON-like value.
export function cleanDeep(value) {
  if (typeof value === 'string') return cleanText(value);
  if (Array.isArray(value)) return value.map(cleanDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = cleanDeep(v);
    return out;
  }
  return value;
}

// fetch() wrapper for the Supabase client: every JSON response is cleaned
// before any of it reaches the UI.
export async function sanitizingFetch(input, init) {
  const res = await fetch(input, init);
  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) return res;
  const nullBody = [101, 204, 205, 304].includes(res.status);
  const text = nullBody ? '' : await res.text();
  let body = text;
  try {
    if (text) body = JSON.stringify(cleanDeep(JSON.parse(text)));
  } catch {
    // not valid JSON after all — pass through untouched
  }
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(nullBody ? null : body, { status: res.status, statusText: res.statusText, headers });
}

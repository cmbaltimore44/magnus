// Subsequence match with a score: word starts and consecutive letters rank
// higher, so "nb" finds "New Book" and "trg" finds "Triage Inbox".
export function fuzzyScore(query, text) {
  const q = query.toLowerCase().replace(/\s+/g, '');
  if (!q) return 1;
  const t = text.toLowerCase();
  let score = 0;
  let ti = 0;
  let prev = -2;
  for (const ch of q) {
    const at = t.indexOf(ch, ti);
    if (at < 0) return 0;
    score += 1 + (at === prev + 1 ? 3 : 0) + (at === 0 || /[\s/·:-]/.test(t[at - 1]) ? 2 : 0);
    prev = at;
    ti = at + 1;
  }
  return score - t.length / 100;
}

// Pure helpers for fitting lists into a fixed number of terminal rows.

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// Fixed-height items: returns [start, end) around `selected`.
export function windowRange(total, selected, size) {
  if (size <= 0) return [0, 0];
  if (total <= size) return [0, total];
  const start = clamp(selected - Math.floor(size / 2), 0, total - size);
  return [start, start + size];
}

// Variable-height items: grow a window outward from `selected` until the row
// budget is spent. Returns [start, end).
export function windowByHeight(heights, selected, budget) {
  const n = heights.length;
  if (n === 0) return [0, 0];
  const sel = clamp(selected, 0, n - 1);
  let start = sel;
  let end = sel + 1;
  let used = heights[sel];
  let growDown = true;
  for (;;) {
    const canDown = end < n && used + heights[end] <= budget;
    const canUp = start > 0 && used + heights[start - 1] <= budget;
    if (!canDown && !canUp) break;
    if ((growDown && canDown) || !canUp) {
      used += heights[end];
      end++;
    } else {
      start--;
      used += heights[start];
    }
    growDown = !growDown;
  }
  return [start, end];
}

export function moveIndex(index, delta, length) {
  if (length === 0) return 0;
  return clamp(index + delta, 0, length - 1);
}

// Swap item at `index` with its neighbor; returns a new array or null.
export function swapped(list, index, delta) {
  const j = index + delta;
  if (index < 0 || j < 0 || j >= list.length) return null;
  const next = [...list];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

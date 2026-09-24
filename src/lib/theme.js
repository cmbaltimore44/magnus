// Magnus's semantic colors, as named ANSI slots. The actual RGB values come
// from the terminal theme — the Life Tracker Ghostty themes
// (~/.config/ghostty/themes/Life Tracker Dark|Light) map these slots to the
// web app's palette:
//   red = danger/overdue, bright red = terracotta accent, yellow = amber
//   ("soon"), green = success, bright black ("gray") = muted text.
// `undefined` means the terminal's default foreground/background.
export const C = {
  text: undefined,
  muted: 'gray',
  accent: 'redBright',
  danger: 'red',
  overdue: 'red',
  soon: 'yellow',
  success: 'green',
  border: 'gray',
};

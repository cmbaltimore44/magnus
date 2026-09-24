// Life Tracker theme: follow macOS light/dark mode, like Ghostty's
// `theme = light:Life Tracker Light,dark:Life Tracker Dark`.
// `defaults read -g AppleInterfaceStyle` prints "Dark" in dark mode and exits
// non-zero in light mode. Themes live in ~/.config/fresh/themes/.
// If this fails for any reason, config.json's "theme" is used as-is.
try {
  const r = await editor.spawnProcess("defaults", ["read", "-g", "AppleInterfaceStyle"]);
  const theme = r.exit_code === 0 && r.stdout.trim() === "Dark" ? "life-tracker-dark" : "life-tracker-light";
  editor.applyTheme(theme);
} catch (e) {
  // keep the configured theme
}

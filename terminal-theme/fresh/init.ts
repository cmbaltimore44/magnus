// Fresh theme = <family>-<dark|light>, matching the Ghostty theme:
//   family: ~/.config/magnus/terminal-theme ("heather", "lakeglow", "beacon" or
//           "hearth"), written by `magnus-theme <family>`
//   mode:   macOS appearance — `defaults read -g AppleInterfaceStyle`
//           prints "Dark" in dark mode and exits non-zero in light mode.
// Themes live in ~/.config/fresh/themes/. If anything fails, config.json's
// "theme" is used as-is.
// Fresh runs this as a plain script, where a top-level `await` is a syntax
// error, so the work happens in an async function (like its own plugins).
async function applyMagnusTheme() {
  try {
    const home = editor.getEnv("HOME");
    const state = await editor.spawnProcess("cat", [home + "/.config/magnus/terminal-theme"]);
    let family = state.exit_code === 0 && state.stdout.trim() ? state.stdout.trim() : "hearth";
    if (family === "life-tracker") family = "hearth"; // renamed
    const r = await editor.spawnProcess("defaults", ["read", "-g", "AppleInterfaceStyle"]);
    const mode = r.exit_code === 0 && r.stdout.trim() === "Dark" ? "dark" : "light";
    editor.applyTheme(family + "-" + mode);
  } catch (e) {
    // keep the configured theme
  }
}
applyMagnusTheme();

(function (g) {
  const CALC_THEME_KEY = "calc-theme";
  const VALID_PREFERENCES = new Set(["system", "day", "night"]);
  const systemQuery =
    typeof g.matchMedia === "function"
      ? g.matchMedia("(prefers-color-scheme: dark)")
      : null;

  function readPreference() {
    try {
      const value = g.localStorage?.getItem(CALC_THEME_KEY);
      return VALID_PREFERENCES.has(value) ? value : "night";
    } catch {
      return "night";
    }
  }

  function resolvePreference(preference) {
    const normalized = VALID_PREFERENCES.has(preference)
      ? preference
      : "night";
    if (normalized === "system") {
      return systemQuery?.matches ? "night" : "day";
    }
    return normalized;
  }

  function applyResolved(theme) {
    const resolved = theme === "day" ? "day" : "night";
    document.documentElement.dataset.theme = resolved;
    const meta = document.querySelector?.('meta[name="theme-color"]');
    if (meta) {
      meta.content = resolved === "day" ? "#ffffff" : "#000000";
    }
    return resolved;
  }

  function applyCalculatorTheme() {
    return applyResolved(resolvePreference(readPreference()));
  }

  function onSystemThemeChange() {
    if (!document.body?.classList.contains("panel-open")) {
      applyCalculatorTheme();
    }
  }

  systemQuery?.addEventListener?.("change", onSystemThemeChange);
  applyCalculatorTheme();

  g.CalcTheme = Object.freeze({
    readPreference,
    resolvePreference,
    applyResolved,
    applyCalculatorTheme,
  });
})(globalThis);

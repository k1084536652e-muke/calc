export const CALC_THEME_KEY = "calc-theme";
export const THEME_PREFERENCES = Object.freeze([
  "system",
  "day",
  "night",
]);
export const STANDARD_RETENTION_DAYS = Object.freeze([7, 30, 90]);

export function normalizeThemePreference(value) {
  return THEME_PREFERENCES.includes(value) ? value : "night";
}

export function readCalcThemePreference(storage = globalThis.localStorage) {
  try {
    return normalizeThemePreference(storage?.getItem(CALC_THEME_KEY));
  } catch {
    return "night";
  }
}

export function writeCalcThemePreference(
  storage,
  preference
) {
  const normalized = normalizeThemePreference(preference);
  try {
    storage?.setItem(CALC_THEME_KEY, normalized);
    return true;
  } catch {
    return false;
  }
}

export function retentionLabel(value) {
  return value === null ? "永不自动删除" : `${value} 天`;
}

export function retentionOptions(currentValue) {
  const requested = Number(currentValue);
  const values = [...STANDARD_RETENTION_DAYS];
  if (
    [15, 60].includes(requested) &&
    !values.includes(requested)
  ) {
    values.push(requested);
  }
  values.sort((left, right) => left - right);
  return [...values, null];
}

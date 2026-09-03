// Special mode is intentionally local to this browser/device. It is a preference, not an
// account setting, so it must never be sent to a server or shared with another device.
const LOVED_MODE_KEY = 'khavair.loved-mode.v1';
const THEME_KEY = 'khavair.theme.v1';

export type SavedTheme = 'light' | 'dark';

export function loadLovedMode(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(LOVED_MODE_KEY) === 'active';
}

export function saveLovedMode(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LOVED_MODE_KEY, 'active');
}

export function clearLovedMode(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(LOVED_MODE_KEY);
  localStorage.removeItem(THEME_KEY);
}

export function loadSavedTheme(): SavedTheme | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  if (localStorage.getItem(LOVED_MODE_KEY) !== 'active') return undefined;
  const value = localStorage.getItem(THEME_KEY);
  return value === 'light' || value === 'dark' ? value : undefined;
}

export function saveTheme(theme: SavedTheme): void {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(LOVED_MODE_KEY) !== 'active') return;
  localStorage.setItem(THEME_KEY, theme);
}

export function clearSavedTheme(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(THEME_KEY);
}

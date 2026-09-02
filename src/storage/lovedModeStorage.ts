// Special mode is intentionally local to this browser/device. It is a preference, not an
// account setting, so it must never be sent to a server or shared with another device.
const LOVED_MODE_KEY = 'khavair.loved-mode.v1';

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
}

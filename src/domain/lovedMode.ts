// This gate is an Easter egg, not a security boundary. The app stores only a
// one-way-ish check value rather than the numeric code in plaintext. Because the
// input space is intentionally small, a determined person inspecting the bundle
// could still brute-force it.
const LOVED_MODE_CODE_HASH = 0xe8a786a4;
const LOVED_MODE_STORAGE_KEY = 'khavair:loved-mode';

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

export function loadLovedMode(): boolean {
  return storage()?.getItem(LOVED_MODE_STORAGE_KEY) === '1';
}

export function saveLovedMode(enabled: boolean): void {
  const local = storage();
  if (!local) return;
  if (enabled) local.setItem(LOVED_MODE_STORAGE_KEY, '1');
  else local.removeItem(LOVED_MODE_STORAGE_KEY);
}

export function verifyLovedModeCode(input: string): boolean {
  return /^\d{7}$/.test(input) && fnv1a32(input) === LOVED_MODE_CODE_HASH;
}

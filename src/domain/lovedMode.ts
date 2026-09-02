// This gate is an Easter egg, not a security boundary. The app stores only a
// one-way-ish check value rather than the numeric code in plaintext. Because the
// input space is intentionally small, a determined person inspecting the bundle
// could still brute-force it.
const LOVED_MODE_CODE_HASH = 0xe8a786a4;

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function verifyLovedModeCode(input: string): boolean {
  return /^\d{7}$/.test(input) && fnv1a32(input) === LOVED_MODE_CODE_HASH;
}

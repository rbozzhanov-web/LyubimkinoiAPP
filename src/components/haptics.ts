import { Platform } from 'react-native';

/**
 * Very light interaction feedback.
 *
 * On the web we use the Vibration API when the browser exposes it. iOS Safari/PWA
 * currently does not expose the Taptic Engine to web apps, so this intentionally
 * becomes a no-op there rather than faking feedback with sound or a heavy vibration.
 */
export function softHaptic(): void {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(4); } catch { /* unsupported/blocked browsers simply stay silent */ }
}

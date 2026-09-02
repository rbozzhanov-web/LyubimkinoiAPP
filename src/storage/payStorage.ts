import type { PayMonthOverrides, PayProfile } from '@/src/domain/pay';

const PROFILE_KEY = 'khavair.pay.profile.v1';
const MONTH_PREFIX = 'khavair.pay.month.v1.';

export function loadPayProfile(): Partial<PayProfile> | undefined {
  return readJson<Partial<PayProfile>>(PROFILE_KEY);
}

export function savePayProfile(profile: PayProfile): void {
  writeJson(PROFILE_KEY, profile);
}

export function loadPayMonth(monthKey: string): PayMonthOverrides | undefined {
  return readJson<PayMonthOverrides>(`${MONTH_PREFIX}${monthKey}`);
}

export function savePayMonth(monthKey: string, values: PayMonthOverrides): void {
  writeJson(`${MONTH_PREFIX}${monthKey}`, values);
}

export function clearPayData(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(PROFILE_KEY);
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(MONTH_PREFIX)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
}

function readJson<T>(key: string): T | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  const raw = localStorage.getItem(key);
  if (!raw) return undefined;
  try { return JSON.parse(raw) as T; } catch { return undefined; }
}

function writeJson(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

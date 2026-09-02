import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';

const KEY = 'khavair.roster.v1';

export function loadStoredRoster(): ParsedAirAstanaRoster | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  const raw = localStorage.getItem(KEY);
  if (!raw) return undefined;
  try { return JSON.parse(raw) as ParsedAirAstanaRoster; } catch { return undefined; }
}

export function saveStoredRoster(roster: ParsedAirAstanaRoster): void {
  if (typeof localStorage === 'undefined') return;
  // Only parsed data is stored. The original PDF is never persisted by KhaVair.
  localStorage.setItem(KEY, JSON.stringify(roster));
}

export function clearStoredRoster(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
}

import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';

const KEY = 'khavair.rosters.v2';
const LEGACY_KEY = 'khavair.roster.v1';

function sortRosters(rosters: ParsedAirAstanaRoster[]): ParsedAirAstanaRoster[] {
  return [...rosters].sort((a, b) => a.period.start.localeCompare(b.period.start));
}

export function loadStoredRosters(): ParsedAirAstanaRoster[] {
  if (typeof localStorage === 'undefined') return [];

  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      const value = JSON.parse(raw) as unknown;
      if (Array.isArray(value)) return sortRosters(value as ParsedAirAstanaRoster[]);
    } catch {
      // Fall through to the legacy migration path.
    }
  }

  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) return [];
  try {
    const roster = JSON.parse(legacy) as ParsedAirAstanaRoster;
    const migrated = [roster];
    localStorage.setItem(KEY, JSON.stringify(migrated));
    localStorage.removeItem(LEGACY_KEY);
    return migrated;
  } catch {
    return [];
  }
}

export function upsertStoredRoster(roster: ParsedAirAstanaRoster): ParsedAirAstanaRoster[] {
  if (typeof localStorage === 'undefined') return [roster];
  const next = sortRosters([
    ...loadStoredRosters().filter((item) => item.period.start !== roster.period.start),
    roster,
  ]);
  // KhaVair stores parsed data only. The source PDF bytes are never persisted by the app.
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function removeStoredRoster(periodStart: string): ParsedAirAstanaRoster[] {
  if (typeof localStorage === 'undefined') return [];
  const next = loadStoredRosters().filter((item) => item.period.start !== periodStart);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearStoredRosters(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY_KEY);
}

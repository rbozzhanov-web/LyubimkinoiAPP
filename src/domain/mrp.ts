export type MrpSource = 'official' | 'cache' | 'bundled';

export type MrpSnapshot = {
  year: number;
  valueKzt: number;
  source: MrpSource;
  verifiedAt?: string;
};

export const OFFICIAL_MRP_SOURCE = 'https://www.gov.kz/article/17157?lang=ru';

// Offline safety net. The online official value wins when available.
const BUNDLED_MRP: Record<number, number> = {
  2025: 3932,
  2026: 4325,
};

const CACHE_PREFIX = 'khavair.mrp.v1.';
const MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function cacheKey(year: number) {
  return `${CACHE_PREFIX}${year}`;
}

function readCache(year: number): MrpSnapshot | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  const raw = localStorage.getItem(cacheKey(year));
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as MrpSnapshot;
    return parsed.year === year && parsed.valueKzt > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(snapshot: MrpSnapshot) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(cacheKey(snapshot.year), JSON.stringify(snapshot));
}

export function parseOfficialMrpPage(html: string, year: number): number | undefined {
  const normalized = html.replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ');
  const yearAnchor = normalized.search(new RegExp(`(?:на\\s+)?${year}\\s+год`, 'i'));
  const scoped = yearAnchor >= 0 ? normalized.slice(yearAnchor, yearAnchor + 3000) : normalized;
  const match = scoped.match(/Месячн(?:ый|ого)\s+расчетн(?:ый|ого)\s+показател[ья][^0-9]{0,250}([0-9][0-9\s]{2,8})\s*тенге/i);
  if (!match) return undefined;
  const value = Number(match[1].replace(/\s/g, ''));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export async function resolveMrp(year: number, allowNetwork = true): Promise<MrpSnapshot> {
  const cached = readCache(year);
  if (cached?.verifiedAt) {
    const age = Date.now() - Date.parse(cached.verifiedAt);
    if (Number.isFinite(age) && age >= 0 && age < MAX_CACHE_AGE_MS) {
      return { ...cached, source: 'cache' };
    }
  }

  if (allowNetwork && typeof fetch !== 'undefined') {
    try {
      const response = await fetch(OFFICIAL_MRP_SOURCE, { method: 'GET', cache: 'no-store' });
      if (response.ok) {
        const valueKzt = parseOfficialMrpPage(await response.text(), year);
        if (valueKzt) {
          const snapshot: MrpSnapshot = {
            year,
            valueKzt,
            source: 'official',
            verifiedAt: new Date().toISOString(),
          };
          writeCache(snapshot);
          return snapshot;
        }
      }
    } catch {
      // Offline/CORS failures are expected in a privacy-first PWA; use local data below.
    }
  }

  if (cached) return { ...cached, source: 'cache' };

  const fallback = BUNDLED_MRP[year];
  if (fallback) return { year, valueKzt: fallback, source: 'bundled' };

  throw new Error(`MRP for ${year} is unavailable. Connect to the internet and refresh.`);
}

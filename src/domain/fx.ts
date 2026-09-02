export type FxSource = 'official' | 'cache';

export interface UsdKztSnapshot {
  usdKzt: number;
  source: FxSource;
  rateDate?: string;
  verifiedAt?: string;
}

export const OFFICIAL_NBRK_RATES_URL = 'https://nationalbank.kz/rss/rates_all.xml';

const CACHE_KEY = 'khavair.fx.usdkzt.v1';
const FRESH_MS = 18 * 60 * 60 * 1000;

function readCache(): UsdKztSnapshot | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as UsdKztSnapshot;
    return Number.isFinite(parsed.usdKzt) && parsed.usdKzt > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(snapshot: UsdKztSnapshot) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
}

export function parseNbrkUsdRate(xml: string): { usdKzt: number; rateDate?: string } | undefined {
  const item = xml.match(/<item\b[\s\S]*?<title>\s*USD\s*<\/title>[\s\S]*?<\/item>/i)?.[0]
    ?? xml.match(/<item\b[\s\S]*?<index>\s*USD\s*<\/index>[\s\S]*?<\/item>/i)?.[0];
  if (!item) return undefined;

  const description = item.match(/<description>\s*([0-9]+(?:[.,][0-9]+)?)\s*<\/description>/i)?.[1];
  if (!description) return undefined;
  const usdKzt = Number(description.replace(',', '.'));
  if (!Number.isFinite(usdKzt) || usdKzt <= 0) return undefined;

  const rateDate = item.match(/<pubDate>\s*([^<]+)\s*<\/pubDate>/i)?.[1]?.trim();
  return { usdKzt, rateDate };
}

/**
 * Fetches only the public USD/KZT rate from NBRK. No roster, crew, salary or device data is sent.
 * If the request is unavailable because of offline/CORS conditions, the last cached official rate
 * is returned. There is deliberately no silently bundled exchange-rate fallback because FX moves.
 */
export async function resolveUsdKzt(allowNetwork = true): Promise<UsdKztSnapshot> {
  const cached = readCache();
  if (cached?.verifiedAt) {
    const age = Date.now() - Date.parse(cached.verifiedAt);
    if (Number.isFinite(age) && age >= 0 && age < FRESH_MS) return { ...cached, source: 'cache' };
  }

  if (allowNetwork && typeof fetch !== 'undefined') {
    try {
      const response = await fetch(OFFICIAL_NBRK_RATES_URL, { method: 'GET', cache: 'no-store' });
      if (response.ok) {
        const parsed = parseNbrkUsdRate(await response.text());
        if (parsed) {
          const snapshot: UsdKztSnapshot = {
            ...parsed,
            source: 'official',
            verifiedAt: new Date().toISOString(),
          };
          writeCache(snapshot);
          return snapshot;
        }
      }
    } catch {
      // Offline/CORS is expected to happen occasionally in a privacy-first PWA.
    }
  }

  if (cached) return { ...cached, source: 'cache' };
  throw new Error('USD/KZT rate is unavailable. Connect once to cache the official NBRK rate.');
}

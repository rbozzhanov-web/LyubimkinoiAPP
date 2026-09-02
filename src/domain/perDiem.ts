import type { StationStay } from './layovers';
import { stationLocalDateTimeMs } from './stationTime';
import type { PerDiemRegion, PerDiemRule } from './types';

export interface PerDiemStayResult {
  stay: StationStay;
  region: PerDiemRegion;
  eligible: boolean;
  units: number;
  usdAmount: number;
  kztAmount: number;
}

export interface PerDiemMonthResult {
  items: PerDiemStayResult[];
  foreignUsd: number;
  kazakhstanKzt: number;
  totalUsd?: number;
  totalKzt?: number;
}

export const PER_DIEM_RULES: Record<PerDiemRegion, PerDiemRule> = {
  KZ: { region: 'KZ', minimumStationMinutes: 6 * 60, usdRate: null, mrpMultiplier: 3 },
  FOREIGN_50: { region: 'FOREIGN_50', minimumStationMinutes: 2 * 60, usdRate: 50 },
  EU_UK: { region: 'EU_UK', minimumStationMinutes: 2 * 60, usdRate: 60 },
};

const KZ_STATIONS = new Set([
  'AKX', 'ALA', 'BSZ', 'CIT', 'DMB', 'GUW', 'KGF', 'KSN', 'KZO', 'NQZ', 'PLX', 'PWQ', 'SCO', 'UKK', 'URA',
]);

const EU_UK_STATIONS = new Set(['AMS', 'FRA', 'HER', 'LHR']);

export function classifyPerDiemStation(station: string): PerDiemRegion {
  const code = station.trim().toUpperCase();
  if (KZ_STATIONS.has(code)) return 'KZ';
  if (EU_UK_STATIONS.has(code)) return 'EU_UK';
  return 'FOREIGN_50';
}

export function isLayoverEligible(region: PerDiemRegion, stationMinutes: number) {
  return stationMinutes > PER_DIEM_RULES[region].minimumStationMinutes;
}

export function getConfiguredRate(region: PerDiemRegion) {
  return PER_DIEM_RULES[region].usdRate;
}

export function getKazakhstanPerDiemKzt(mrpKzt: number): number {
  return mrpKzt * (PER_DIEM_RULES.KZ.mrpMultiplier ?? 0);
}

/**
 * Per diem is counted by UTC calendar day, not by the total relay duration.
 * Every UTC day whose station-presence slice is strictly longer than the threshold
 * earns one unit. A multi-day relay can therefore earn multiple units in one payout.
 */
export function kazakhstanQualifyingUtcDays(stay: StationStay): number {
  return qualifyingUtcDays(stay, PER_DIEM_RULES.KZ.minimumStationMinutes);
}

function foreignQualifyingUtcDays(stay: StationStay): number {
  return qualifyingUtcDays(stay, PER_DIEM_RULES.FOREIGN_50.minimumStationMinutes);
}

function qualifyingUtcDays(stay: StationStay, minimumStationMinutes: number): number {
  const start = stationLocalToUtcMs(stay.station, stay.arrivalLocal);
  const end = stationLocalToUtcMs(stay.station, stay.departureLocal);
  if (start === undefined || end === undefined || end <= start) return 0;

  const dayMs = 24 * 60 * 60 * 1000;
  const thresholdMs = minimumStationMinutes * 60 * 1000;
  let cursor = utcDayStart(start);
  let units = 0;

  while (cursor < end) {
    const next = cursor + dayMs;
    const overlap = Math.max(0, Math.min(end, next) - Math.max(start, cursor));
    if (overlap > thresholdMs) units += 1;
    cursor = next;
  }
  return units;
}

export function calculatePerDiemStay(stay: StationStay, mrpKzt: number, usdKzt?: number): PerDiemStayResult {
  const region = classifyPerDiemStation(stay.station);
  const station = stay.station.trim().toUpperCase();

  if (region === 'KZ') {
    // ALA is the home base and is not a downroute stay. Every other Kazakhstan station
    // earns one 3-MRP unit for each UTC day with strictly more than six hours at station.
    if (station === 'ALA') {
      return { stay, region, eligible: false, units: 0, usdAmount: 0, kztAmount: 0 };
    }
    const units = kazakhstanQualifyingUtcDays(stay);
    const kztAmount = units * getKazakhstanPerDiemKzt(mrpKzt);
    return {
      stay,
      region,
      eligible: units > 0,
      units,
      usdAmount: usdKzt && usdKzt > 0 ? kztAmount / usdKzt : 0,
      kztAmount,
    };
  }

  // Foreign stations use the same UTC-day slicing rule with a >2h threshold.
  // Each qualifying UTC day earns one regional rate unit ($50 or $60).
  const units = foreignQualifyingUtcDays(stay);
  const usdAmount = units * (PER_DIEM_RULES[region].usdRate ?? 0);
  return {
    stay,
    region,
    eligible: units > 0,
    units,
    usdAmount,
    kztAmount: usdKzt && usdKzt > 0 ? usdAmount * usdKzt : 0,
  };
}

export function calculatePerDiemMonth(
  stays: StationStay[],
  monthKey: string,
  mrpKzt: number,
  usdKzt?: number,
): PerDiemMonthResult {
  const items = stays
    .filter((stay) => stay.arrivalLocal.startsWith(monthKey))
    .map((stay) => calculatePerDiemStay(stay, mrpKzt, usdKzt));

  const foreignUsd = round2(items.filter((item) => item.region !== 'KZ').reduce((sum, item) => sum + item.usdAmount, 0));
  const kazakhstanKzt = round2(items.filter((item) => item.region === 'KZ').reduce((sum, item) => sum + item.kztAmount, 0));

  return {
    items,
    foreignUsd,
    kazakhstanKzt,
    totalUsd: usdKzt && usdKzt > 0 ? round2(foreignUsd + kazakhstanKzt / usdKzt) : undefined,
    totalKzt: usdKzt && usdKzt > 0 ? round2(kazakhstanKzt + foreignUsd * usdKzt) : undefined,
  };
}

function stationLocalToUtcMs(station: string, value: string): number | undefined {
  const [date, time] = value.split('T');
  if (!date || !time) return undefined;
  return stationLocalDateTimeMs(station, date, time);
}

function utcDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatUsd(value: number): string {
  return `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)}`;
}

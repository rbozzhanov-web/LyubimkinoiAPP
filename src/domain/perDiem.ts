import type { StationStay } from './layovers';
import type { PerDiemRegion, PerDiemRule } from './types';

export type PerDiemStationRegion = PerDiemRegion | 'UNCLASSIFIED';

export interface PerDiemStayResult {
  stay: StationStay;
  region: PerDiemStationRegion;
  eligible: boolean;
  units: number;
  usdAmount: number;
  kztAmount: number;
  needsClassification: boolean;
}

export interface PerDiemMonthResult {
  items: PerDiemStayResult[];
  foreignUsd: number;
  kazakhstanKzt: number;
  totalUsd?: number;
  totalKzt?: number;
  unresolvedStations: string[];
}

export const PER_DIEM_RULES: Record<PerDiemRegion, PerDiemRule> = {
  KZ: { region: 'KZ', minimumStationMinutes: 6 * 60, usdRate: null, mrpMultiplier: 3 },
  ASIA: { region: 'ASIA', minimumStationMinutes: 2 * 60, usdRate: 50 },
  EU_UK: { region: 'EU_UK', minimumStationMinutes: 2 * 60, usdRate: 60 },
};

// Keep this conservative. Only stations that fit a confirmed rate bucket without interpretation are
// classified automatically. Turkey is explicitly Asia per the confirmed user rule. Greece is EU;
// Kyrgyzstan is Asia. Anything whose contractual bucket is not confirmed remains UNCLASSIFIED.
const KZ_STATIONS = new Set([
  'AKX', 'ALA', 'BSZ', 'CIT', 'DMB', 'GUW', 'KGF', 'KSN', 'KZO', 'NQZ', 'PLX', 'PWQ', 'SCO', 'UKK', 'URA',
]);
const EU_UK_STATIONS = new Set(['AMS', 'FRA', 'HER', 'LHR']);
const ASIA_STATIONS = new Set([
  'AUH', 'AYT', 'BJV', 'BKK', 'BOM', 'CAN', 'CMB', 'CTU', 'CXR', 'DAD', 'DEL', 'DOH', 'DXB', 'DYU', 'FRU', 'GOI',
  'HKT', 'ICN', 'IST', 'JED', 'MED', 'MLE', 'OSS', 'PEK', 'PQC', 'SYX', 'TAS', 'TLV', 'UBN', 'URC',
]);

/**
 * Stations present in the current CrewPay route set whose per-diem bucket must not be guessed.
 * Keeping the reasons in code makes future policy updates deliberate rather than geographical
 * assumptions silently changing pay.
 */
export const UNCONFIRMED_PER_DIEM_STATIONS: Readonly<Record<string, string>> = {
  BUS: 'Georgia/Caucasus rate bucket not confirmed',
  GYD: 'Azerbaijan/Caucasus rate bucket not confirmed',
  TBS: 'Georgia/Caucasus rate bucket not confirmed',
  DME: 'Russia rate bucket not confirmed',
  LED: 'Russia rate bucket not confirmed',
  OVB: 'Russia rate bucket not confirmed',
  KBP: 'Ukraine is outside the confirmed EU/UK bucket',
  TGD: 'Montenegro is outside the confirmed EU/UK bucket',
  HRG: 'Egypt/Africa rate bucket not confirmed',
  SSH: 'Egypt/Africa rate bucket not confirmed',
};

export function classifyPerDiemStation(station: string): PerDiemStationRegion {
  const code = station.trim().toUpperCase();
  if (KZ_STATIONS.has(code)) return 'KZ';
  if (EU_UK_STATIONS.has(code)) return 'EU_UK';
  if (ASIA_STATIONS.has(code)) return 'ASIA';
  return 'UNCLASSIFIED';
}

export function getUnconfirmedPerDiemReason(station: string): string | undefined {
  return UNCONFIRMED_PER_DIEM_STATIONS[station.trim().toUpperCase()];
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
 * Kazakhstan rule: count UTC calendar days separately. A UTC day qualifies only if presence at
 * the Kazakhstan station inside that UTC day is strictly more than six hours. Kazakhstan local
 * civil time is UTC+5, so the stay timestamps are shifted by five hours before UTC-day slicing.
 */
export function kazakhstanQualifyingUtcDays(stay: StationStay): number {
  const start = kzLocalToUtcMs(stay.arrivalLocal);
  const end = kzLocalToUtcMs(stay.departureLocal);
  if (start === undefined || end === undefined || end <= start) return 0;

  const dayMs = 24 * 60 * 60 * 1000;
  const thresholdMs = PER_DIEM_RULES.KZ.minimumStationMinutes * 60 * 1000;
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
  if (region === 'UNCLASSIFIED') {
    return { stay, region, eligible: false, units: 0, usdAmount: 0, kztAmount: 0, needsClassification: true };
  }

  if (region === 'KZ') {
    if (stay.station.toUpperCase() === 'ALA') {
      return { stay, region, eligible: false, units: 0, usdAmount: 0, kztAmount: 0, needsClassification: false };
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
      needsClassification: false,
    };
  }

  const eligible = isLayoverEligible(region, stay.durationMinutes);
  const usdAmount = eligible ? (PER_DIEM_RULES[region].usdRate ?? 0) : 0;
  return {
    stay,
    region,
    eligible,
    units: eligible ? 1 : 0,
    usdAmount,
    kztAmount: usdKzt && usdKzt > 0 ? usdAmount * usdKzt : 0,
    needsClassification: false,
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

  const foreignUsd = round2(items.filter((item) => item.region === 'ASIA' || item.region === 'EU_UK').reduce((sum, item) => sum + item.usdAmount, 0));
  const kazakhstanKzt = round2(items.filter((item) => item.region === 'KZ').reduce((sum, item) => sum + item.kztAmount, 0));
  const unresolvedStations = [...new Set(items.filter((item) => item.needsClassification).map((item) => item.stay.station))].sort();

  return {
    items,
    foreignUsd,
    kazakhstanKzt,
    totalUsd: usdKzt && usdKzt > 0 ? round2(foreignUsd + kazakhstanKzt / usdKzt) : undefined,
    totalKzt: usdKzt && usdKzt > 0 ? round2(kazakhstanKzt + foreignUsd * usdKzt) : undefined,
    unresolvedStations,
  };
}

function kzLocalToUtcMs(value: string): number | undefined {
  const stamp = naiveIsoMs(value);
  return stamp === undefined ? undefined : stamp - 5 * 60 * 60 * 1000;
}

function naiveIsoMs(value: string): number | undefined {
  const [date, time] = value.split('T');
  if (!date || !time) return undefined;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if ([year, month, day, hour, minute].some((part) => !Number.isFinite(part))) return undefined;
  return Date.UTC(year, month - 1, day, hour, minute);
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

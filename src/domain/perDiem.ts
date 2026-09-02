import type { PerDiemRegion, PerDiemRule } from './types';

export const PER_DIEM_RULES: Record<PerDiemRegion, PerDiemRule> = {
  KZ: { region: 'KZ', minimumStationMinutes: 6 * 60, usdRate: null, mrpMultiplier: 3 },
  ASIA: { region: 'ASIA', minimumStationMinutes: 2 * 60, usdRate: 50 },
  EU_UK: { region: 'EU_UK', minimumStationMinutes: 2 * 60, usdRate: 60 },
};

export function isLayoverEligible(region: PerDiemRegion, stationMinutes: number) {
  return stationMinutes > PER_DIEM_RULES[region].minimumStationMinutes;
}

export function getConfiguredRate(region: PerDiemRegion) {
  return PER_DIEM_RULES[region].usdRate;
}

export function getKazakhstanPerDiemKzt(mrpKzt: number): number {
  return mrpKzt * (PER_DIEM_RULES.KZ.mrpMultiplier ?? 0);
}

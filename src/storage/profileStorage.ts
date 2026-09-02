import { DEFAULT_PROFILE, type CrewProfile } from '@/src/domain/profile';

const KEY = 'khavair.crewProfile.v1';

export function loadCrewProfile(): CrewProfile {
  if (typeof localStorage === 'undefined') return DEFAULT_PROFILE;
  const raw = localStorage.getItem(KEY);
  if (!raw) return DEFAULT_PROFILE;
  try {
    const value = JSON.parse(raw) as Partial<CrewProfile>;
    const contractRank = typeof value.contractRank === 'string' ? value.contractRank.trim() : '';
    return contractRank ? { contractRank } : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveCrewProfile(profile: CrewProfile): CrewProfile {
  const next = { contractRank: profile.contractRank.trim() || DEFAULT_PROFILE.contractRank };
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearCrewProfile(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
}

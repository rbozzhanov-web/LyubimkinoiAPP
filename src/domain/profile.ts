export interface CrewProfile {
  contractRank: string;
}

// Contract rank drives pay. A roster may show a different operational position on a specific
// sector; that value is display-only and must never silently change compensation rules.
export const DEFAULT_PROFILE: CrewProfile = { contractRank: 'FJ' };

export function payRankFor(profile: CrewProfile): string {
  return profile.contractRank;
}

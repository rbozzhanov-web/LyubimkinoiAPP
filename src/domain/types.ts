export type CrewRole = 'Cabin' | 'Flight deck';

export type CrewMember = {
  id: string;
  name: string;
  role: CrewRole;
  position?: string;
  rosterRank?: string;
  deadhead?: boolean;
};

export type Sector = {
  id: string;
  /** Local departure calendar date from the roster, YYYY-MM-DD. */
  date: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  departureTime: string;
  arrivalTime: string;
  blockMinutes: number;
  crew: CrewMember[];
  deadhead?: boolean;
  actualTimes?: boolean;
};

export type Duty = {
  id: string;
  /** ISO local-station calendar date, YYYY-MM-DD, when parsed from a real roster. */
  date?: string;
  reportDate?: string;
  releaseDate?: string;
  dateLabel: string;
  reportTime: string;
  releaseTime: string;
  sectors: Sector[];
  layoverStation?: string;
};

/** A non-flying roster day (OFF, DOFF, SICK, AVLB, ...), shown with its raw code. */
export type GroundEvent = {
  id: string;
  date: string;
  dateLabel: string;
  code: string;
};

/**
 * Per-diem tariff buckets, not geographic continents:
 * - KZ: Kazakhstan, 3 MRP when the UTC qualification rule is met;
 * - FOREIGN_50: every foreign station that is not EU/UK;
 * - EU_UK: European Union and United Kingdom.
 */
export type PerDiemRegion = 'KZ' | 'FOREIGN_50' | 'EU_UK';
export type PerDiemRule = {
  region: PerDiemRegion;
  minimumStationMinutes: number;
  usdRate: number | null;
  /** Kazakhstan per diem is defined as a multiple of the annual MRP/MCI. */
  mrpMultiplier?: number;
};

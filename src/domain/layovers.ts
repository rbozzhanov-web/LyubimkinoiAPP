import type { ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';
import type { RosterSector } from '@/src/import/duties';

export interface StationStay {
  station: string;
  arrivalLocal: string;
  departureLocal: string;
  durationMinutes: number;
  arrivalFlight: string;
  departureFlight: string;
  crossMonth: boolean;
}

type SequencedSector = RosterSector & { sourceMonth: string; sequence: number };

/**
 * Finds time spent at a non-base station between consecutive roster sectors.
 * Both endpoints use the same station's local clock, so the interval can be calculated before
 * any per-diem rule is applied. Payment qualification is intentionally a separate layer.
 */
export function detectStationStays(rosters: ParsedAirAstanaRoster[], base = 'ALA'): StationStay[] {
  const sectors = sequenceSectors(rosters);
  const stays: StationStay[] = [];

  for (let index = 0; index < sectors.length - 1; index += 1) {
    const arrival = sectors[index];
    const departure = sectors[index + 1];
    if (!arrival.arrivalAirport || arrival.arrivalAirport === base) continue;
    if (arrival.arrivalAirport !== departure.departureAirport) continue;

    const arrivalDate = arrival.arrivalDate ?? arrival.date;
    const arrivalLocal = `${arrivalDate}T${arrival.timeIn}`;
    const departureLocal = `${departure.date}T${departure.timeOut}`;
    const durationMinutes = localDifferenceMinutes(arrivalLocal, departureLocal);
    if (durationMinutes === undefined || durationMinutes <= 0) continue;

    stays.push({
      station: arrival.arrivalAirport,
      arrivalLocal,
      departureLocal,
      durationMinutes,
      arrivalFlight: arrival.flightNumber,
      departureFlight: departure.flightNumber,
      crossMonth: arrival.sourceMonth !== departure.sourceMonth,
    });
  }

  return stays;
}

function sequenceSectors(rosters: ParsedAirAstanaRoster[]): SequencedSector[] {
  const sorted = [...rosters].sort((a, b) => a.period.start.localeCompare(b.period.start));
  const seen = new Set<string>();
  const result: SequencedSector[] = [];
  let sequence = 0;

  for (const roster of sorted) {
    for (const sector of roster.sectors) {
      const key = [sector.date, sector.flightNumber, sector.departureAirport, sector.arrivalAirport, sector.timeOut].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...sector, sourceMonth: roster.period.start.slice(0, 7), sequence: sequence++ });
    }
  }

  return result.sort((a, b) => a.sourceMonth.localeCompare(b.sourceMonth) || a.sequence - b.sequence);
}

function localDifferenceMinutes(start: string, end: string): number | undefined {
  const toMinuteStamp = (value: string): number | undefined => {
    const [date, time] = value.split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    if ([year, month, day, hour, minute].some(Number.isNaN)) return undefined;
    return Math.round(Date.UTC(year, month - 1, day, hour, minute) / 60_000);
  };
  const a = toMinuteStamp(start);
  const b = toMinuteStamp(end);
  return a === undefined || b === undefined ? undefined : b - a;
}

export function formatStayDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

export function sumReportedBlockMinutes(rosters: ParsedAirAstanaRoster[]): number {
  return rosters.reduce((total, roster) => total + (roster.totals.blockMinutes ?? 0), 0);
}

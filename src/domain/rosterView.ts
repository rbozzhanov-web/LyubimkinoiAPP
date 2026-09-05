import type { Duty, CrewMember, GroundEvent, Sector } from './types';
import { getSectorCrew, type ParsedAirAstanaRoster } from '@/src/import/parseAirAstanaRoster';
import type { RosterCrewMember } from '@/src/import/crew';
import type { RosterSector } from '@/src/import/duties';

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export function rosterToGroundEvents(roster: ParsedAirAstanaRoster): GroundEvent[] {
  return (roster.groundDuties ?? []).map((item, index) => ({
    id: `ground-${item.date}-${item.code}-${index}`,
    date: item.date,
    dateLabel: formatDateLabel(item.date),
    code: item.code,
  }));
}

function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return `${String(parsed.getUTCDate()).padStart(2, '0')} ${MONTHS[parsed.getUTCMonth()]}`;
}

export function rosterToDuties(roster: ParsedAirAstanaRoster): Duty[] {
  const visibleSectors = [...roster.sectors, ...(roster.boundarySectors ?? []), ...legacyBoundarySectors(roster)];
  return roster.duties.flatMap((duty) => {
    const sourceSectors = visibleSectors
      .filter((sector) => sector.dutyIndex === duty.index)
      .sort((a, b) => a.dutySectorIndex - b.dutySectorIndex);
    if (sourceSectors.length === 0) return [];
    const first = sourceSectors[0];
    const last = sourceSectors[sourceSectors.length - 1];
    const sectors: Sector[] = sourceSectors.map((sector, index) => {
      const crew = getSectorCrew(roster, sector)?.members
        .filter((member) => member.id !== roster.subject?.staffId)
        .sort(crewOrder)
        .map(toCrewMember) ?? [];
      return {
        id: `${sector.date}-${sector.flightNumber}-${index}`,
        date: sector.date,
        flightNumber: `KC${sector.flightNumber}`,
        departure: sector.departureAirport || '…',
        arrival: sector.arrivalAirport || '…',
        departureTime: sector.timeOut || '—',
        arrivalTime: sector.timeIn || '—',
        blockMinutes: 0,
        crew,
        deadhead: sector.deadhead,
        actualTimes: sector.actualTimes,
      };
    });
    const reportStamp = duty.start?.split('T');
    const releaseStamp = duty.end?.split('T');
    return [{
      id: `duty-${first.date}-${duty.index}`,
      date: first.date,
      reportDate: reportStamp?.[0] ?? first.date,
      releaseDate: releaseStamp?.[0] ?? last.arrivalDate ?? last.date,
      dateLabel: formatDateLabel(first.date),
      reportTime: reportStamp?.[1] ?? (first.timeOut || '—'),
      releaseTime: releaseStamp?.[1] ?? (last.timeIn || '—'),
      sectors,
      layoverStation: last.arrivalAirport || '…',
    }];
  });
}

export type FlightCardGroup = { id: string; duty: Duty; sectors: Sector[] };

/** Every arrival belongs in the displayed chain, including an intermediate turn. */
export function sectorRoute(sectors: Sector[]): string {
  const first = sectors[0];
  return first ? [first.departure, ...sectors.map((sector) => sector.arrival)].join(' → ') : '…';
}

/**
 * Keep a same-duty relay on one roster card when the turnaround is shorter than
 * three hours. The original sectors are retained so their times, crew and DHC
 * status remain available in the detail sheet.
 */
export function rosterToFlightCardGroups(duties: Duty[]): FlightCardGroup[] {
  return duties.flatMap((duty) => {
    const groups: Sector[][] = [];
    for (const sector of duty.sectors) {
      const current = groups.at(-1);
      if (current && isShortRelay(current.at(-1)!, sector)) current.push(sector);
      else groups.push([sector]);
    }
    return groups.map((sectors) => ({
      id: `card-${sectors.map((sector) => sector.id).join('-')}`,
      duty,
      sectors,
    }));
  });
}

function isShortRelay(previous: Sector, next: Sector): boolean {
  if (previous.arrival !== next.departure) return false;
  // A card must never cross a calendar-day boundary: day-based roster logic,
  // sorting and labels remain authoritative even for a short overnight turn.
  if (previous.date !== next.date) return false;
  const arrival = clockMinutes(previous.arrivalTime);
  const departure = clockMinutes(next.departureTime);
  if (arrival === undefined || departure === undefined) return false;
  const turnaround = departure - arrival;
  return turnaround >= 0 && turnaround < 3 * 60;
}

function clockMinutes(value: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : undefined;
}

// Rosters parsed before the month-boundary fix did not persist a final sector when its
// arrival continued beyond the report's last calendar column. The source PDF bytes are not
// stored, but the duty shell and Other Crew record are. Recover only the unambiguous legacy
// case: a one-sector duty with no saved sector and an own-crew record on the report end date.
// Flight number/date are factual; departure is reused only when the same flight number has
// already appeared in this roster. Unknown times/destination stay visibly unknown.
function legacyBoundarySectors(roster: ParsedAirAstanaRoster): RosterSector[] {
  if (roster.boundarySectors !== undefined) return [];
  const represented = new Set(roster.sectors.map((sector) => `${sector.date}|${sector.flightNumber}`));
  const candidates = roster.crewRecords.filter((record) =>
    record.date === roster.period.end &&
    !represented.has(`${record.date}|${record.flightNumber}`) &&
    (!roster.subject?.staffId || record.members.some((member) => member.id === roster.subject?.staffId)),
  );
  if (candidates.length === 0) return [];

  const missingDuties = roster.duties.filter((duty) =>
    duty.sectorCount === 1 && !roster.sectors.some((sector) => sector.dutyIndex === duty.index),
  );

  return missingDuties.flatMap((duty, index) => {
    const record = candidates[index];
    if (!record) return [];
    const reference = roster.sectors.find((sector) => sector.flightNumber === record.flightNumber);
    const own = roster.subject?.staffId ? record.members.find((member) => member.id === roster.subject?.staffId) : undefined;
    return [{
      flightNumber: record.flightNumber,
      date: record.date,
      departureAirport: reference?.departureAirport ?? '',
      arrivalAirport: '',
      timeOut: '',
      timeIn: '',
      deadhead: own?.deadhead ?? false,
      actualTimes: false,
      dutyIndex: duty.index,
      dutySectorIndex: 1,
    }];
  });
}

function toCrewMember(member: RosterCrewMember): CrewMember {
  const flightDeck = member.rank === 'CP' || member.rank === 'FO';
  return {
    id: member.id,
    name: titleCase(member.name),
    role: flightDeck ? 'Flight deck' : 'Cabin',
    // Keep the position code exactly as it appears in the roster PDF. Do not infer or expand it.
    position: `${member.deadhead ? 'DHC · ' : ''}${member.rank}`,
    rosterRank: member.rank,
    deadhead: member.deadhead,
  };
}

function crewOrder(a: RosterCrewMember, b: RosterCrewMember): number {
  const weight = (rank: string) => rank === 'CP' ? 0 : rank === 'FO' ? 1 : rank === 'PU' ? 2 : rank === 'IS' ? 3 : 4;
  return weight(a.rank) - weight(b.rank);
}
function titleCase(value: string): string { return value.toLowerCase().replace(/(^|[ -])\p{L}/gu, (letter) => letter.toUpperCase()); }

export function formatMinutes(minutes?: number): string {
  if (minutes === undefined) return '—';
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

export function rosterMonthLabel(roster: ParsedAirAstanaRoster): string {
  const date = new Date(`${roster.period.start}T00:00:00Z`);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
